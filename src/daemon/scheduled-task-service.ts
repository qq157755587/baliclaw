import { watch, type FSWatcher } from "node:fs";
import { basename, dirname } from "node:path";
import type { Logger } from "pino";
import type {
  ScheduledTaskDefinitionConfig,
  ScheduledTaskFileConfig
} from "../config/scheduled-task-config.js";
import { ScheduledTaskConfigService } from "../config/scheduled-task-config.js";
import { getAppPaths, type AppPaths } from "../config/paths.js";
import { getLogger } from "../shared/logger.js";
import { ScheduledTaskStatusStore } from "../runtime/scheduled-task-status-store.js";
import { getNextScheduledRun } from "./scheduled-task-schedule.js";

type WatchEvent = "rename" | "change";
type TimerHandle = ReturnType<typeof setTimeout>;
type TimeoutFn = typeof setTimeout;
type ClearTimeoutFn = typeof clearTimeout;

export interface ScheduledTaskTriggerContext {
  taskId: string;
  task: ScheduledTaskDefinitionConfig;
  scheduledAt: string;
}

export interface ScheduledTaskSkipContext extends ScheduledTaskTriggerContext {
  reason: string;
}

export interface ScheduledTaskServiceOptions {
  paths?: AppPaths;
  logger?: Logger;
  configService?: ScheduledTaskConfigService;
  statusStore?: ScheduledTaskStatusStore;
  onTrigger?: (context: ScheduledTaskTriggerContext) => Promise<void> | void;
  onSkip?: (context: ScheduledTaskSkipContext) => Promise<void> | void;
  watchConfigDirectory?: typeof watch;
  setTimeoutFn?: TimeoutFn;
  clearTimeoutFn?: ClearTimeoutFn;
  now?: () => Date;
  debounceMs?: number;
}

export class ScheduledTaskRunError extends Error {
  constructor(
    readonly status: "failed" | "timed_out",
    message: string,
    readonly reason?: string
  ) {
    super(message);
    this.name = "ScheduledTaskRunError";
  }
}

interface ScheduledTaskTimerEntry {
  task: ScheduledTaskDefinitionConfig;
  timer: TimerHandle;
  scheduledAt: string;
}

type FsWatcherLike = Pick<FSWatcher, "close">;

export class ScheduledTaskService {
  private readonly paths: AppPaths;
  private readonly logger: Logger;
  private readonly configService: ScheduledTaskConfigService;
  private readonly statusStore: ScheduledTaskStatusStore;
  private readonly onTrigger: NonNullable<ScheduledTaskServiceOptions["onTrigger"]>;
  private readonly onSkip: NonNullable<ScheduledTaskServiceOptions["onSkip"]>;
  private readonly watchConfigDirectory: typeof watch;
  private readonly setTimeoutFn: TimeoutFn;
  private readonly clearTimeoutFn: ClearTimeoutFn;
  private readonly now: () => Date;
  private readonly debounceMs: number;
  private readonly activeTimers = new Map<string, ScheduledTaskTimerEntry>();
  private readonly runningTasks = new Set<string>();
  private watcher: FsWatcherLike | null = null;
  private reloadTimer: TimerHandle | null = null;
  private currentConfig: ScheduledTaskFileConfig = { tasks: {} };

  constructor(options: ScheduledTaskServiceOptions = {}) {
    this.paths = options.paths ?? getAppPaths();
    this.logger = options.logger ?? getLogger("scheduled-tasks");
    this.configService = options.configService ?? new ScheduledTaskConfigService(this.paths);
    this.statusStore = options.statusStore ?? new ScheduledTaskStatusStore(this.paths);
    this.onTrigger = options.onTrigger ?? (() => undefined);
    this.onSkip = options.onSkip ?? (() => undefined);
    this.watchConfigDirectory = options.watchConfigDirectory ?? watch;
    this.setTimeoutFn = options.setTimeoutFn ?? setTimeout;
    this.clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
    this.now = options.now ?? (() => new Date());
    this.debounceMs = options.debounceMs ?? 50;
  }

  async start(): Promise<void> {
    if (this.watcher) {
      return;
    }

    await this.reload("start");
    this.watcher = this.watchConfigDirectory(
      dirname(this.configService.getPath()),
      (_eventType: WatchEvent, filename: string | Buffer | null) => {
        if (!shouldReloadForFile(this.configService.getPath(), filename)) {
          return;
        }

        this.scheduleReload("watch");
      }
    );
  }

  async stop(): Promise<void> {
    if (this.reloadTimer) {
      this.clearTimeoutFn(this.reloadTimer);
      this.reloadTimer = null;
    }

    this.watcher?.close();
    this.watcher = null;
    this.clearScheduledTimers();
  }

  getConfig(): ScheduledTaskFileConfig {
    return this.currentConfig;
  }

  async reload(reason: "start" | "watch" | "manual" = "manual"): Promise<ScheduledTaskFileConfig> {
    const nextConfig = await this.configService.load();
    this.currentConfig = nextConfig;
    this.rebuildTimers(nextConfig);
    this.logger.info({ reason, taskCount: Object.keys(nextConfig.tasks).length }, "scheduled task config reloaded");
    return nextConfig;
  }

  private scheduleReload(reason: "watch"): void {
    if (this.reloadTimer) {
      this.clearTimeoutFn(this.reloadTimer);
    }

    this.reloadTimer = this.setTimeoutFn(() => {
      this.reloadTimer = null;
      void this.reload(reason).catch((error: unknown) => {
        this.logger.error({ err: error, reason }, "scheduled task reload failed");
      });
    }, this.debounceMs);
  }

  private rebuildTimers(config: ScheduledTaskFileConfig): void {
    this.clearScheduledTimers();

    for (const [taskId, task] of Object.entries(config.tasks)) {
      this.scheduleTask(taskId, task);
    }
  }

  private clearScheduledTimers(): void {
    for (const entry of this.activeTimers.values()) {
      this.clearTimeoutFn(entry.timer);
    }
    this.activeTimers.clear();
  }

  private scheduleTask(
    taskId: string,
    task: ScheduledTaskDefinitionConfig,
    fromDate: Date = this.now()
  ): void {
    const scheduledFor = getNextScheduledRun(task.schedule, fromDate);
    const delayMs = Math.max(0, scheduledFor.getTime() - this.now().getTime());
    const scheduledAt = scheduledFor.toISOString();
    const timer = this.setTimeoutFn(() => {
      void this.fireTask(taskId, task, scheduledAt);
    }, delayMs);

    this.activeTimers.set(taskId, {
      task,
      timer,
      scheduledAt
    });
  }

  private async fireTask(taskId: string, task: ScheduledTaskDefinitionConfig, scheduledAt: string): Promise<void> {
    this.activeTimers.delete(taskId);
    this.scheduleTask(taskId, task, new Date(scheduledAt));

    if (this.runningTasks.has(taskId)) {
      const reason = "previous run still active";
      await this.statusStore.set(taskId, {
        scheduledAt,
        finishedAt: this.now().toISOString(),
        status: "skipped",
        reason
      });
      await this.onSkip({
        taskId,
        task,
        scheduledAt,
        reason
      });
      return;
    }

    this.runningTasks.add(taskId);
    const startedAt = this.now().toISOString();

    await this.statusStore.set(taskId, {
      scheduledAt,
      startedAt,
      status: "running"
    });

    try {
      await this.onTrigger({
        taskId,
        task,
        scheduledAt
      });
      await this.statusStore.set(taskId, {
        scheduledAt,
        startedAt,
        finishedAt: this.now().toISOString(),
        status: "succeeded"
      });
    } catch (error) {
      const status = error instanceof ScheduledTaskRunError ? error.status : "failed";
      const reason = error instanceof ScheduledTaskRunError
        ? error.reason ?? error.message
        : error instanceof Error
          ? error.message
          : String(error);
      await this.statusStore.set(taskId, {
        scheduledAt,
        startedAt,
        finishedAt: this.now().toISOString(),
        status,
        reason
      });
      this.logger.error({ err: error, taskId, scheduledAt }, "scheduled task run failed");
    } finally {
      this.runningTasks.delete(taskId);
    }
  }
}

function shouldReloadForFile(configFile: string, filename: string | Buffer | null): boolean {
  if (!filename) {
    return true;
  }

  return filename.toString() === basename(configFile);
}
