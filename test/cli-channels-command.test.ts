import { describe, expect, it, vi } from "vitest";
import { runChannelLoginCommand } from "../src/cli/commands/channels.js";

describe("CLI channels commands", () => {
  it("renders a login flow from IPC start/wait responses", async () => {
    const client = {
      startChannelLogin: vi.fn().mockResolvedValue({
        channel: "wechat",
        sessionKey: "session-123",
        qrDataUrl: "https://example.com/qr",
        message: "Scan the QR code with WeChat to complete login."
      }),
      waitForChannelLogin: vi.fn().mockResolvedValue({
        channel: "wechat",
        connected: true,
        message: "WeChat login completed."
      })
    } as never;

    const output = await runChannelLoginCommand("wechat", { verbose: true, timeoutMs: 5_000 }, client);

    expect(client.startChannelLogin).toHaveBeenCalledWith("wechat");
    expect(client.waitForChannelLogin).toHaveBeenCalledWith("wechat", "session-123", 5_000);
    expect(output).toContain("Scan the QR code with WeChat to complete login.");
    expect(output).toContain("https://example.com/qr");
    expect(output).toContain("sessionKey: session-123");
    expect(output).toContain("WeChat login completed.");
  });

  it("emits QR output before waiting for login completion when progress output is provided", async () => {
    let resolveWait: ((value: { channel: string; connected: boolean; message: string }) => void) | undefined;
    const waitPromise = new Promise<{ channel: string; connected: boolean; message: string }>((resolve) => {
      resolveWait = resolve;
    });
    const onProgressOutput = vi.fn();
    const client = {
      startChannelLogin: vi.fn().mockResolvedValue({
        channel: "wechat",
        sessionKey: "session-123",
        qrDataUrl: "https://example.com/qr",
        message: "Scan the QR code with WeChat to complete login."
      }),
      waitForChannelLogin: vi.fn().mockReturnValue(waitPromise)
    } as never;

    const commandPromise = runChannelLoginCommand(
      "wechat",
      { verbose: true, timeoutMs: 5_000, onProgressOutput },
      client
    );

    await Promise.resolve();
    expect(onProgressOutput).toHaveBeenCalledTimes(1);
    expect(onProgressOutput.mock.calls[0]?.[0]).toContain("https://example.com/qr");
    expect(onProgressOutput.mock.calls[0]?.[0]).toContain("sessionKey: session-123");

    resolveWait?.({
      channel: "wechat",
      connected: true,
      message: "WeChat login completed."
    });

    await expect(commandPromise).resolves.toBe("WeChat login completed.");
  });

  it("preserves lark domain selection for new-mode logins", async () => {
    const client = {
      startChannelLogin: vi.fn().mockResolvedValue({
        channel: "lark",
        sessionKey: "session-lark",
        qrDataUrl: "https://example.com/lark-qr",
        message: "Open the URL and complete the Lark authorization flow."
      }),
      waitForChannelLogin: vi.fn().mockResolvedValue({
        channel: "lark",
        connected: true,
        message: "Lark login completed."
      })
    } as never;

    await runChannelLoginCommand("lark", {
      mode: "new",
      domain: "lark"
    }, client);

    expect(client.startChannelLogin).toHaveBeenCalledWith("lark", {
      mode: "new",
      domain: "lark"
    });
  });
});
