import { readFile } from "node:fs/promises";
import JSON5 from "json5";
import { createCliClient } from "../client.js";
import { appConfigSchema, type AppConfig } from "../../config/schema.js";
import type { IpcClient } from "../../ipc/client.js";

export async function runConfigGetCommand(client: IpcClient = createCliClient()): Promise<string> {
  const config = await client.getConfig();
  return JSON.stringify(config, null, 2);
}

export async function runConfigSetCommand(
  rawConfig: string | undefined,
  options: { file?: string } = {},
  client: IpcClient = createCliClient()
): Promise<string> {
  const config = await parseConfigInput(rawConfig, options);
  const saved = await client.setConfig(config);
  return JSON.stringify(saved, null, 2);
}

async function parseConfigInput(rawConfig: string | undefined, options: { file?: string }): Promise<AppConfig> {
  const raw = options.file
    ? await readFile(options.file, "utf8")
    : rawConfig;

  if (!raw) {
    throw new Error("Provide config JSON5 inline or with --file <path>.");
  }

  return appConfigSchema.parse(JSON5.parse(raw));
}
