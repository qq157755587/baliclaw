import { PairingService } from "../auth/pairing-service.js";
import type { Logger } from "pino";
import { ConfigService } from "../config/service.js";
import { ensureStateDirectories, getAppPaths, type AppPaths } from "../config/paths.js";
import type { AppConfig } from "../config/schema.js";
import { IpcServer } from "../ipc/server.js";
import { createTelegramApi, sendTelegramText } from "../telegram/send.js";
import { TelegramService } from "../telegram/service.js";
import { getLogger } from "../shared/logger.js";
import { createShutdownController, type ShutdownController } from "./shutdown.js";

export interface BootstrapContext {
  paths: AppPaths;
  config: AppConfig;
  configService: ConfigService;
  logger: Logger;
  ipcServer: IpcServer;
  telegramService: TelegramService;
  shutdownController: ShutdownController;
}

export interface BootstrapOptions {
  paths?: AppPaths;
  configService?: ConfigService;
  ipcServer?: IpcServer;
  telegramService?: TelegramService;
}

export async function bootstrap(options: BootstrapOptions = {}): Promise<BootstrapContext> {
  const paths = options.paths ?? getAppPaths();
  const configService = options.configService ?? new ConfigService(paths);

  await ensureStateDirectories(paths);

  const config = await configService.load();
  const logger = getLogger("daemon", {
    level: config.logging.level
  });
  const ipcServer = options.ipcServer ?? new IpcServer({
    paths,
    logger: getLogger("ipc", {
      level: config.logging.level
    }),
    configService
  });
  const pairingService = new PairingService();
  const telegramService = options.telegramService ?? new TelegramService();
  const shutdownController = createShutdownController(logger);

  await ipcServer.start();
  shutdownController.add({
    name: "ipc",
    close: async () => ipcServer.stop()
  });

  if (config.telegram.enabled) {
    const configuredTelegramService = options.telegramService ?? new TelegramService({
      token: config.telegram.botToken,
      pairingService,
      logger: getLogger("telegram", {
        level: config.logging.level
      }),
      sendText: async (target, text) => {
        await sendTelegramText(target, text, createTelegramApi(config.telegram.botToken));
      }
    });

    await configuredTelegramService.start();
    shutdownController.add({
      name: "telegram",
      close: async () => configuredTelegramService.stop()
    });

    return {
      paths,
      config,
      configService,
      logger,
      ipcServer,
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
    telegramService,
    shutdownController
  };
}
