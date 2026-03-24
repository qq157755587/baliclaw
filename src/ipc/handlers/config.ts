import { ConfigService } from "../../config/service.js";
import type { AppConfig } from "../../config/schema.js";

export async function handleConfigGet(configService: ConfigService): Promise<AppConfig> {
  return await configService.load();
}

export async function handleConfigSet(
  configService: ConfigService,
  config: AppConfig,
  reloadConfig?: () => Promise<object>
): Promise<AppConfig> {
  await configService.save(config);

  if (reloadConfig) {
    return await reloadConfig() as AppConfig;
  }

  return await configService.load();
}
