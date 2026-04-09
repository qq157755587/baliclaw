import { createCliClient } from "../client.js";
import type { IpcClient } from "../../ipc/client.js";

export async function runChannelLoginCommand(
  channel: string,
  options: {
    timeoutMs?: number | undefined;
    verbose?: boolean | undefined;
    onProgressOutput?: ((text: string) => void) | undefined;
  } = {},
  client: IpcClient = createCliClient()
): Promise<string> {
  const normalizedChannel = channel.trim();
  if (normalizedChannel.length === 0) {
    throw new Error("Channel must not be empty.");
  }

  const startResult = await client.startChannelLogin(normalizedChannel);
  const lines = [startResult.message];

  if (startResult.qrDataUrl) {
    lines.push("");
    lines.push("Open this URL to scan the WeChat QR code:");
    lines.push(startResult.qrDataUrl);
  }

  if (options.verbose) {
    lines.push("");
    lines.push(`sessionKey: ${startResult.sessionKey}`);
  }

  if (options.onProgressOutput) {
    options.onProgressOutput(lines.join("\n"));
  }

  const waitResult = await client.waitForChannelLogin(
    normalizedChannel,
    startResult.sessionKey,
    options.timeoutMs
  );

  if (options.onProgressOutput) {
    return waitResult.message;
  }

  lines.push("");
  lines.push(waitResult.message);
  return lines.join("\n");
}
