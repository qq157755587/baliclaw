import type {
  ScheduledTaskDefinitionConfig,
  ScheduledTaskFileConfig
} from "../config/scheduled-task-config.js";
import { ScheduledTaskConfigService } from "../config/scheduled-task-config.js";
import { getAppPaths, type AppPaths } from "../config/paths.js";
import {
  ScheduledTaskStatusStore,
  type ScheduledTaskStatusEntry
} from "../runtime/scheduled-task-status-store.js";

export class ScheduledTaskManager {
  constructor(
    private readonly configService: Pick<ScheduledTaskConfigService, "load" | "save"> = new ScheduledTaskConfigService(),
    private readonly statusStore: Pick<ScheduledTaskStatusStore, "get" | "load" | "delete"> = new ScheduledTaskStatusStore(),
    _paths: AppPaths = getAppPaths()
  ) {}

  async listTasks(): Promise<ScheduledTaskFileConfig["tasks"]> {
    return (await this.configService.load()).tasks;
  }

  async createTask(taskId: string, task: ScheduledTaskDefinitionConfig): Promise<ScheduledTaskDefinitionConfig> {
    const config = await this.configService.load();

    if (config.tasks[taskId]) {
      throw new Error(`Scheduled task "${taskId}" already exists`);
    }

    config.tasks[taskId] = task;
    await this.configService.save(config);
    return task;
  }

  async updateTask(taskId: string, task: ScheduledTaskDefinitionConfig): Promise<ScheduledTaskDefinitionConfig> {
    const config = await this.configService.load();

    if (!config.tasks[taskId]) {
      throw new Error(`Scheduled task "${taskId}" does not exist`);
    }

    config.tasks[taskId] = task;
    await this.configService.save(config);
    return task;
  }

  async deleteTask(taskId: string): Promise<boolean> {
    const config = await this.configService.load();

    if (!config.tasks[taskId]) {
      return false;
    }

    delete config.tasks[taskId];
    await this.configService.save(config);
    await this.statusStore.delete(taskId);
    return true;
  }

  async getTaskStatus(taskId: string): Promise<ScheduledTaskStatusEntry | undefined> {
    return await this.statusStore.get(taskId);
  }
}
