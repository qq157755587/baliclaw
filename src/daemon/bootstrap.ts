import { PairingService } from "../auth/pairing-service.js";
import type { Logger } from "pino";
import { ConfigService } from "../config/service.js";
import { ensureStateDirectories, getAppPaths, type AppPaths } from "../config/paths.js";
import type { AppConfig } from "../config/schema.js";
import { IpcServer } from "../ipc/server.js";
import { AgentService } from "../runtime/agent-service.js";
import { SessionService } from "../session/service.js";
import { createTelegramApi, sendTelegramText } from "../telegram/send.js";
import { TelegramService, type TelegramPollingBot } from "../telegram/service.js";
import { getLogger } from "../shared/logger.js";
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
  sendText?: (target: Parameters<typeof sendTelegramText>[0], text: string) => Promise<void>;
}

export async function bootstrap(options: BootstrapOptions = {}): Promise<BootstrapContext> {
  const paths = options.paths ?? getAppPaths();
  const configService = options.configService ?? new ConfigService(paths);

  await ensureStateDirectories(paths);

  const config = await configService.load();
  const logger = getLogger("daemon", {
    level: config.logging.level
  });
  const pairingService = options.pairingService ?? new PairingService();
  const ipcServer = options.ipcServer ?? new IpcServer({
    paths,
    logger: getLogger("ipc", {
      level: config.logging.level
    }),
    configService,
    pairingService
  });
  const sessionService = options.sessionService ?? new SessionService();
  const agentService = options.agentService ?? new AgentService({
    logger: getLogger("agent", {
      level: config.logging.level
    })
  });
  const telegramService = options.telegramService ?? new TelegramService();
  const shutdownController = createShutdownController(logger);

  await ipcServer.start();
  shutdownController.add({
    name: "ipc",
    close: async () => ipcServer.stop()
  });

  if (config.telegram.enabled) {
    const sendText = options.sendText ?? (async (target, text) => {
      await sendTelegramText(target, text, createTelegramApi(config.telegram.botToken));
    });
    const telegramServiceOptions: ConstructorParameters<typeof TelegramService>[0] = {
      token: config.telegram.botToken,
      pairingService,
      logger: getLogger("telegram", {
        level: config.logging.level
      }),
      enqueueInbound: async (message) => {
        await sessionService.runTurn(message, async (turnMessage, sessionId) => {
          const agentRunOptions: Parameters<AgentService["handleMessage"]>[1] extends string | infer T ? T : never = {
            cwd: config.runtime.workingDirectory,
            sessionId,
            tools: config.tools.availableTools
          };

          if (config.runtime.model) {
            agentRunOptions.model = config.runtime.model;
          }
          if (config.runtime.maxTurns !== undefined) {
            agentRunOptions.maxTurns = config.runtime.maxTurns;
          }
          if (config.runtime.systemPromptFile) {
            agentRunOptions.systemPromptFile = config.runtime.systemPromptFile;
          }
          if (config.skills.enabled) {
            agentRunOptions.skillDirectories = config.skills.directories;
          }

          const reply = await agentService.handleMessage(turnMessage, agentRunOptions);

          if (reply.trim().length === 0) {
            return;
          }

          await sendText(
            {
              channel: turnMessage.channel,
              accountId: turnMessage.accountId,
              chatType: turnMessage.chatType,
              conversationId: turnMessage.conversationId
            },
            reply
          );
        });
      },
      sendText
    };

    if (options.telegramBot) {
      telegramServiceOptions.bot = options.telegramBot;
    }

    const configuredTelegramService = options.telegramService ?? new TelegramService(telegramServiceOptions);

    await configuredTelegramService.start();
    shutdownController.add({
      name: "telegram",
      close: async () => configuredTelegramService.stop()
    });
    shutdownController.add({
      name: "logger",
      close: async () => {
        await logger.flush();
      }
    });

    return {
      paths,
      config,
      configService,
      logger,
      ipcServer,
      pairingService,
      sessionService,
      agentService,
      telegramService: configuredTelegramService,
      shutdownController
    };
  }

  shutdownController.add({
    name: "logger",
    close: async () => {
      await logger.flush();
    }
  });

  return {
    paths,
    config,
    configService,
    logger,
    ipcServer,
    pairingService,
    sessionService,
    agentService,
    telegramService,
    shutdownController
  };
}
