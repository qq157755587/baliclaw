import { createCliClient } from "../client.js";
import type { IpcClient } from "../../ipc/client.js";

export async function runStatusCommand(client: IpcClient = createCliClient()): Promise<string> {
  const status = await client.getStatus();
  return JSON.stringify(status, null, 2);
}
