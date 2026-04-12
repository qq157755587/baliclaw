import { afterEach, describe, expect, it, vi } from "vitest";
import { sendMessage } from "../src/channel/wechat/api.js";
import { createWeChatTypingHeartbeat, sendWeChatText, WeChatSendError } from "../src/channel/wechat/send.js";

const directTarget = {
  channel: "wechat",
  accountId: "default",
  chatType: "direct" as const,
  conversationId: "wx-user-1"
};

describe("sendWeChatText", () => {
  it("sends a markdown-filtered text payload to the WeChat API", async () => {
    const sendMessageImpl = vi.fn().mockResolvedValue(undefined);

    await sendWeChatText(
      directTarget,
      "# Title\n- **bold** item\n[docs](https://example.com)\n`code`",
      {
        apiBaseUrl: "https://ilinkai.weixin.qq.com",
        token: "secret-token",
        contextToken: "ctx-123"
      },
      sendMessageImpl
    );

    expect(sendMessageImpl).toHaveBeenCalledWith(expect.objectContaining({
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "secret-token",
      body: {
        msg: expect.objectContaining({
          to_user_id: "wx-user-1",
          context_token: "ctx-123",
          item_list: [{
            type: 1,
            text_item: {
              text: "Title\n- bold item\ndocs\ncode"
            }
          }]
        })
      }
    }));
  });

  it("rejects empty rendered text", async () => {
    await expect(sendWeChatText(
      directTarget,
      "![image](https://example.com/image.png)",
      {
        apiBaseUrl: "https://ilinkai.weixin.qq.com",
        token: "secret-token"
      },
      vi.fn()
    )).rejects.toThrowError(new WeChatSendError("WeChat text message must not be empty"));
  });

  it("rejects WeChat API business errors", async () => {
    const sendMessageImpl = vi.fn().mockRejectedValue(new Error("sendmessage returned ret=-2"));

    await expect(sendWeChatText(
      directTarget,
      "hello",
      {
        apiBaseUrl: "https://ilinkai.weixin.qq.com",
        token: "secret-token"
      },
      sendMessageImpl
    )).rejects.toThrowError(/ret=-2/);
  });
});

describe("sendMessage", () => {
  it("rejects non-zero WeChat business return codes", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ ret: -2 })
    } as Response);

    await expect(sendMessage({
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "secret-token",
      body: {
        msg: {
          to_user_id: "wx-user-1"
        }
      }
    })).rejects.toThrow("sendmessage returned ret=-2");

    fetchMock.mockRestore();
  });
});

describe("createWeChatTypingHeartbeat", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends typing heartbeats and a final cancel event", async () => {
    vi.useFakeTimers();
    const sendTypingImpl = vi.fn().mockResolvedValue(undefined);

    const heartbeat = createWeChatTypingHeartbeat(
      directTarget,
      {
        apiBaseUrl: "https://ilinkai.weixin.qq.com",
        token: "secret-token",
        typingTicket: "typing-ticket",
        intervalMs: 1_000
      },
      sendTypingImpl
    );

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1_000);
    await heartbeat.stop();

    expect(sendTypingImpl).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({
        ilink_user_id: "wx-user-1",
        typing_ticket: "typing-ticket",
        status: 1
      })
    }));
    expect(sendTypingImpl).toHaveBeenLastCalledWith(expect.objectContaining({
      body: expect.objectContaining({
        status: 2
      })
    }));
  });
});
