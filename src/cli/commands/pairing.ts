import { createCliClient } from "../client.js";
import type { IpcClient } from "../../ipc/client.js";

type PairingChannel = "telegram";

export async function runPairingListCommand(
  channel: string,
  client: IpcClient = createCliClient()
): Promise<string> {
  const normalizedChannel = parsePairingChannel(channel);
  const requests = await client.listPairingRequests(normalizedChannel);
  return JSON.stringify(requests, null, 2);
}

export async function runPairingApproveCommand(
  channel: string,
  code: string,
  client: IpcClient = createCliClient()
): Promise<string> {
  const normalizedChannel = parsePairingChannel(channel);
  const approved = await client.approvePairingCode(normalizedChannel, code);
  return JSON.stringify(approved, null, 2);
}

function parsePairingChannel(channel: string): PairingChannel {
  if (channel !== "telegram") {
    throw new Error(`Unsupported pairing channel: ${channel}`);
  }

  return channel;
}
