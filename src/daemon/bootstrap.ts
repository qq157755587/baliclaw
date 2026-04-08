import { PairingService } from "../auth/pairing-service.js";
import type { Logger } from "pino";
import { ConfigService } from "../config/service.js";
import { ensureStateDirectories, getAppPaths, type AppPaths } from "../config/paths.js";
import type { AppConfig } from "../config/schema.js";
import { ScheduledTaskConfigService } from "../config/scheduled-task-config.js";
import { IpcServer } from "../ipc/server.js";
import { AgentService, type ScheduledAgentRunOptions } from "../runtime/agent-service.js";
import { buildTelegramDirectSessionId } from "../session/stable-key.js";
import { SessionService } from "../session/service.js";
import {
  createTelegramApi,
  createTelegramTypingHeartbeat,
  sendTelegramText,
  type TelegramTypingHeartbeat
} from "../telegram/send.js";
import { TelegramService, type TelegramPollingBot } from "../telegram/service.js";
import { getLogger } from "../shared/logger.js";
import { ReloadService } from "./reload-service.js";
import { ScheduledTaskRunError, ScheduledTaskService } from "./scheduled-task-service.js";
import { createShutdownController, type ShutdownController } from "./shutdown.js";

export interface BootstrapContext {
  paths: AppPaths;
  config: AppConfig;
  configService: ConfigService;
  logger: Logger;
  ipcServer: IpcServer;
  pairingService: PairingService;
  sessionService: SessionService;
  agentService: AgentService;
  telegramService: TelegramService;
  scheduledTaskService: ScheduledTaskService;
  reloadService: ReloadService;
  shutdownController: ShutdownController;
}

export interface BootstrapOptions {
  paths?: AppPaths;
  configService?: ConfigService;
  ipcServer?: IpcServer;
  telegramService?: TelegramService;
  telegramBot?: TelegramPollingBot;
  pairingService?: PairingService;
  sessionService?: SessionService;
  agentService?: AgentService;
  scheduledTaskService?: ScheduledTaskService;
  reloadService?: ReloadService;
  sendText?: (target: Parameters<typeof sendTelegramText>[0], text: string) => Promise<void>;
  createTypingHeartbeat?: (
    target: Parameters<typeof sendTelegramText>[0]
  ) => TelegramTypingHeartbeat | Promise<TelegramTypingHeartbeat>;
}

export async function bootstrap(options: BootstrapOptions = {}): Promise<BootstrapContext> {
  const paths = options.paths ?? getAppPaths();
  const configService = options.configService ?? new ConfigService(paths);

  await ensureStateDirectories(paths);

  let currentConfig = await configService.load();
  const logger = getLogger("daemon", {
    level: currentConfig.logging.level
  });
  const ipcLogger = getLogger("ipc", {
    level: currentConfig.logging.level
  });
  const configLogger = getLogger("config", {
    level: currentConfig.logging.level
  });
  const agentLogger = getLogger("agent", {
    level: currentConfig.logging.level
  });
  const scheduledTaskLogger = getLogger("scheduled-tasks", {
    level: currentConfig.logging.level
  });
  const telegramLogger = getLogger("telegram", {
    level: currentConfig.logging.level
  });
  const pairingService = options.pairingService ?? new PairingService();
  const sessionService = options.sessionService ?? new SessionService();
  const agentService = options.agentService ?? new AgentService({
    logger: agentLogger
  });
  let activeTelegramService = options.telegramService ?? new TelegramService();
  let activeScheduledTaskService = options.scheduledTaskService ?? new ScheduledTaskService();
  const shutdownController = createShutdownController(logger);
  const sendText = options.sendText ?? (async (target, text) => {
    await sendTelegramText(target, text, createTelegramApi(currentConfig.channels.telegram.botToken));
  });
  const createTypingHeartbeat = options.createTypingHeartbeat ?? ((target) =>
    createTelegramTypingHeartbeat(target, createTelegramApi(currentConfig.channels.telegram.botToken), {
      onError: (error) => {
        telegramLogger.warn(
          {
            err: error,
            conversationId: target.conversationId
          },
          "failed to send telegram typing action"
        );
      }
    }));

  const createConfiguredTelegramService = (config: AppConfig): TelegramService => {
    const telegramServiceOptions: ConstructorParameters<typeof TelegramService>[0] = {
      token: config.channels.telegram.botToken,
      pairingService,
      logger: telegramLogger,
      enqueueInbound: async (message) => {
        await sessionService.runTurn(message, async (turnMessage, sessionId) => {
          const runtimeConfig = currentConfig;
          const agentRunOptions = buildAgentRunOptions(runtimeConfig, sessionId);
          const deliveryTarget = {
            channel: turnMessage.channel,
            accountId: turnMessage.accountId,
            chatType: turnMessage.chatType,
            conversationId: turnMessage.conversationId
          } as const;
          const typingHeartbeat = await createTypingHeartbeat(deliveryTarget);
          let reply: string;

          try {
            const result = await agentService.handleMessageWithMetadata(turnMessage, agentRunOptions);
            reply = result.text;

            if (result.autoCompacted) {
              const notice = typeof result.autoCompactionPreTokens === "number"
                ? `Session context was automatically compacted at about ${result.autoCompactionPreTokens} tokens so the conversation could continue.`
                : "Session context was automatically compacted so the conversation could continue.";
              await sendText(deliveryTarget, notice);
            }
            if (result.todoNotice) {
              await sendText(deliveryTarget, result.todoNotice);
            }
          } finally {
            await typingHeartbeat.stop();
          }

          if (reply.trim().length === 0) {
            return;
          }

          await sendText(deliveryTarget, reply);
        });
      },
      resetSession: async (message) => {
        await sessionService.runTurn(message, async (_turnMessage, sessionId) => {
          await agentService.resetSession(sessionId);
        });
        return "Started a fresh session. Your next message will use a new Claude session.";
      },
      compactSession: async (message) => {
        return sessionService.runTurn(message, async (turnMessage, sessionId) => {
          const runtimeConfig = currentConfig;
          const agentRunOptions = buildAgentRunOptions(runtimeConfig, sessionId);
          const deliveryTarget = {
            channel: turnMessage.channel,
            accountId: turnMessage.accountId,
            chatType: turnMessage.chatType,
            conversationId: turnMessage.conversationId
          } as const;
          const typingHeartbeat = await createTypingHeartbeat(deliveryTarget);

          try {
            return await agentService.compactSession(turnMessage, agentRunOptions);
          } finally {
            await typingHeartbeat.stop();
          }
        });
      },
      getSessionTodo: async (message) => {
        return agentService.getTodoSummary(buildTelegramDirectSessionId(message));
      },
      sendText
    };

    if (options.telegramBot) {
      telegramServiceOptions.bot = options.telegramBot;
    }

    return new TelegramService(telegramServiceOptions);
  };

  const createConfiguredScheduledTaskService = (config: AppConfig): ScheduledTaskService =>
    new ScheduledTaskService({
      paths,
      logger: scheduledTaskLogger,
      configService: new ScheduledTaskConfigService(paths, config.scheduledTasks.file),
      onTrigger: async ({ taskId, task, scheduledAt }) => {
        const deliveryTarget = {
          channel: "telegram",
          accountId: "default",
          chatType: "direct",
          conversationId: task.telegram.conversationId
        } as const;
        const abortController = new AbortController();
        const timeoutMs = task.timeoutMinutes * 60 * 1000;
        const timeoutHandle = setTimeout(() => {
          abortController.abort();
        }, timeoutMs);
        timeoutHandle.unref?.();

        try {
          const result = await agentService.runPrompt(task.prompt, {
          ...buildAgentRunOptions(currentConfig, `scheduled:${taskId}:${scheduledAt}`),
          abortController
        });

          if (result.autoCompacted) {
            const notice = typeof result.autoCompactionPreTokens === "number"
              ? `Scheduled task ${taskId} auto-compacted at about ${result.autoCompactionPreTokens} tokens so the run could continue.`
              : `Scheduled task ${taskId} auto-compacted so the run could continue.`;
            await sendText(deliveryTarget, notice);
          }
          if (result.todoNotice) {
            await sendText(deliveryTarget, result.todoNotice);
          }
          if (result.text.trim().length > 0) {
            await sendText(deliveryTarget, result.text);
          }
        } catch (error) {
          if (abortController.signal.aborted) {
            const message = `Scheduled task ${taskId} timed out after ${task.timeoutMinutes} minute(s) and was stopped.`;
            await sendText(deliveryTarget, message);
            throw new ScheduledTaskRunError("timed_out", message, "timeout reached");
          }

          const reason = error instanceof Error ? error.message : String(error);
          await sendText(deliveryTarget, `Scheduled task ${taskId} failed: ${reason}`);
          throw new ScheduledTaskRunError("failed", `Scheduled task ${taskId} failed`, reason);
        } finally {
          clearTimeout(timeoutHandle);
        }
      },
      onSkip: async ({ taskId, task, scheduledAt, reason }) => {
        await sendText(
          {
            channel: "telegram",
            accountId: "default",
            chatType: "direct",
            conversationId: task.telegram.conversationId
          },
          `Scheduled task ${taskId} was skipped for the run scheduled at ${scheduledAt}: ${reason}.`
        );
      }
    });

  const reconcileTelegramService = async (nextConfig: AppConfig, previousConfig: AppConfig): Promise<void> => {
    const telegramChanged = nextConfig.channels.telegram.enabled !== previousConfig.channels.telegram.enabled
      || nextConfig.channels.telegram.botToken !== previousConfig.channels.telegram.botToken;

    if (!telegramChanged) {
      return;
    }

    if (previousConfig.channels.telegram.enabled) {
      await activeTelegramService.stop();
    }

    if (options.telegramService) {
      activeTelegramService = options.telegramService;
      if (nextConfig.channels.telegram.enabled) {
        await activeTelegramService.start();
      }
      return;
    }

    activeTelegramService = nextConfig.channels.telegram.enabled
      ? createConfiguredTelegramService(nextConfig)
      : new TelegramService();

    if (nextConfig.channels.telegram.enabled) {
      await activeTelegramService.start();
    }
  };

  const reconcileScheduledTaskService = async (nextConfig: AppConfig, previousConfig: AppConfig): Promise<void> => {
    const scheduledTasksChanged =
      nextConfig.scheduledTasks.enabled !== previousConfig.scheduledTasks.enabled ||
      nextConfig.scheduledTasks.file !== previousConfig.scheduledTasks.file;

    if (!scheduledTasksChanged) {
      return;
    }

    if (previousConfig.scheduledTasks.enabled) {
      await activeScheduledTaskService.stop();
    }

    if (options.scheduledTaskService) {
      activeScheduledTaskService = options.scheduledTaskService;
      if (nextConfig.scheduledTasks.enabled) {
        await activeScheduledTaskService.start();
      }
      return;
    }

    activeScheduledTaskService = nextConfig.scheduledTasks.enabled
      ? createConfiguredScheduledTaskService(nextConfig)
      : new ScheduledTaskService({
          paths,
          logger: scheduledTaskLogger
        });

    if (nextConfig.scheduledTasks.enabled) {
      await activeScheduledTaskService.start();
    }
  };

  const reloadService = options.reloadService ?? new ReloadService({
    paths,
    configService,
    logger: configLogger,
    initialConfig: currentConfig,
    applyConfig: async (nextConfig, previousConfig) => {
      currentConfig = nextConfig;
      logger.level = nextConfig.logging.level;
      ipcLogger.level = nextConfig.logging.level;
      configLogger.level = nextConfig.logging.level;
      agentLogger.level = nextConfig.logging.level;
      scheduledTaskLogger.level = nextConfig.logging.level;
      telegramLogger.level = nextConfig.logging.level;

      await reconcileTelegramService(nextConfig, previousConfig);
      await reconcileScheduledTaskService(nextConfig, previousConfig);
    }
  });
  const ipcServer = options.ipcServer ?? new IpcServer({
    paths,
    logger: ipcLogger,
    configService,
    pairingService,
    reloadConfig: async () => await reloadService.reload("ipc")
  });

  await ipcServer.start();
  shutdownController.add({
    name: "ipc",
    close: async () => ipcServer.stop()
  });
  await reloadService.start();
  shutdownController.add({
    name: "reload",
    close: async () => reloadService.stop()
  });

  if (currentConfig.channels.telegram.enabled) {
    activeTelegramService = options.telegramService ?? createConfiguredTelegramService(currentConfig);
    await activeTelegramService.start();
  }

  if (currentConfig.scheduledTasks.enabled) {
    activeScheduledTaskService = options.scheduledTaskService ?? createConfiguredScheduledTaskService(currentConfig);
    await activeScheduledTaskService.start();
  }

  shutdownController.add({
    name: "telegram",
    close: async () => activeTelegramService.stop()
  });
  shutdownController.add({
    name: "scheduled-tasks",
    close: async () => activeScheduledTaskService.stop()
  });

  shutdownController.add({
    name: "logger",
    close: async () => {
      await logger.flush();
    }
  });

  return {
    paths,
    config: currentConfig,
    configService,
    logger,
    ipcServer,
    pairingService,
    sessionService,
    agentService,
    telegramService: activeTelegramService,
    scheduledTaskService: activeScheduledTaskService,
    reloadService,
    shutdownController
  };
}

function buildAgentRunOptions(config: AppConfig, sessionId: string): ScheduledAgentRunOptions {
  const options: ScheduledAgentRunOptions = {
    cwd: config.runtime.workingDirectory,
    sessionId,
    tools: config.tools.availableTools
  };

  if (config.runtime.model) {
    options.model = config.runtime.model;
  }
  if (config.runtime.maxTurns !== undefined) {
    options.maxTurns = config.runtime.maxTurns;
  }
  if (config.runtime.systemPromptFile) {
    options.systemPromptFile = config.runtime.systemPromptFile;
  }
  if (config.runtime.soulFile) {
    options.soulFile = config.runtime.soulFile;
  }
  if (config.runtime.userFile) {
    options.userFile = config.runtime.userFile;
  }
  if (config.skills.enabled) {
    options.skillDirectories = config.skills.directories;
  }
  options.loadFilesystemSettings = config.runtime.loadFilesystemSettings;

  if (Object.keys(config.mcp.servers).length > 0) {
    options.mcpServers = config.mcp.servers;
  }
  if (Object.keys(config.agents).length > 0) {
    options.agents = config.agents;
  }
  options.memoryEnabled = config.memory.enabled;
  options.memoryMaxLines = config.memory.maxLines;

  return options;
}
