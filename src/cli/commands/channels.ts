import { createCliClient } from "../client.js";
import type { IpcClient } from "../../ipc/client.js";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

export async function runChannelLoginCommand(
  channel: string,
  options: {
    timeoutMs?: number | undefined;
    verbose?: boolean | undefined;
    mode?: "new" | "existing" | undefined;
    domain?: "feishu" | "lark" | undefined;
    appId?: string | undefined;
    appSecret?: string | undefined;
    onProgressOutput?: ((text: string) => void) | undefined;
    selectLarkDomain?: (() => Promise<"feishu" | "lark">) | undefined;
  } = {},
  client: IpcClient = createCliClient()
): Promise<string> {
  const normalizedChannel = channel.trim();
  if (normalizedChannel.length === 0) {
    throw new Error("Channel must not be empty.");
  }

  const startOptions = normalizedChannel === "lark"
    ? await resolveLarkStartOptions({
        ...(options.mode !== undefined ? { mode: options.mode } : {}),
        ...(options.domain !== undefined ? { domain: options.domain } : {}),
        ...(options.appId !== undefined ? { appId: options.appId } : {}),
        ...(options.appSecret !== undefined ? { appSecret: options.appSecret } : {}),
        ...(options.selectLarkDomain !== undefined ? { selectLarkDomain: options.selectLarkDomain } : {})
      })
    : {};
  const startResult = Object.keys(startOptions).length === 0
    ? await client.startChannelLogin(normalizedChannel)
    : await client.startChannelLogin(normalizedChannel, startOptions);
  const lines = [startResult.message];

  if (startResult.qrDataUrl) {
    lines.push("");
    lines.push("Open this URL to continue the login flow:");
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

async function resolveLarkStartOptions(options: {
  mode?: "new" | "existing";
  domain?: "feishu" | "lark";
  appId?: string;
  appSecret?: string;
  selectLarkDomain?: (() => Promise<"feishu" | "lark">) | undefined;
}): Promise<{
  mode?: "new" | "existing";
  domain?: "feishu" | "lark";
  appId?: string;
  appSecret?: string;
}> {
  if (!options.mode) {
    throw new Error("Lark login requires --mode new|existing");
  }

  if (options.mode === "new") {
    return {
      mode: "new",
      ...(options.domain !== undefined ? { domain: options.domain } : {})
    };
  }

  const domain = options.domain ?? await (options.selectLarkDomain?.() ?? promptForLarkDomain());
  if (!options.appId?.trim()) {
    throw new Error("Lark existing login requires --app-id");
  }
  if (!options.appSecret?.trim()) {
    throw new Error("Lark existing login requires --app-secret");
  }

  return {
    mode: "existing",
    domain,
    appId: options.appId.trim(),
    appSecret: options.appSecret.trim()
  };
}

async function promptForLarkDomain(): Promise<"feishu" | "lark"> {
  const readline = createInterface({
    input: stdin,
    output: stdout
  });

  try {
    while (true) {
      const answer = (await readline.question("Select Lark domain: [1] Feishu [2] Lark: ")).trim();
      if (answer === "1" || answer.toLowerCase() === "feishu") {
        return "feishu";
      }
      if (answer === "2" || answer.toLowerCase() === "lark") {
        return "lark";
      }
    }
  } finally {
    readline.close();
  }
}
