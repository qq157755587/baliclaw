import type { ChannelControlService } from "../../channel/control.js";

export async function handleChannelLoginStart(
  channelControlService: Pick<ChannelControlService, "startLogin">,
  input: {
    channel: string;
    force?: boolean;
    mode?: "new" | "existing";
    domain?: "feishu" | "lark";
    appId?: string;
    appSecret?: string;
  }
) {
  return await channelControlService.startLogin(input);
}

export async function handleChannelLoginWait(
  channelControlService: Pick<ChannelControlService, "waitForLogin">,
  input: {
    channel: string;
    sessionKey: string;
    timeoutMs?: number;
  }
) {
  return await channelControlService.waitForLogin(input);
}
