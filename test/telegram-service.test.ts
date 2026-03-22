import { describe, expect, it, vi } from "vitest";
import { TelegramService } from "../src/telegram/service.js";
import { createLogger } from "../src/shared/logger.js";

interface RegisteredHandler {
  (context: { update: unknown }): unknown;
}

class FakeTelegramBot {
  handler: RegisteredHandler | undefined;
  start = vi.fn(async () => undefined);
  stop = vi.fn(async () => undefined);

  on(_filter: "message", handler: RegisteredHandler): void {
    this.handler = handler;
  }
}

describe("TelegramService", () => {
  it("starts and stops grammy polling only once", async () => {
    const bot = new FakeTelegramBot();
    const service = new TelegramService({ bot, token: "unused" });

    await service.start();
    await service.start();
    await service.stop();
    await service.stop();

    expect(bot.start).toHaveBeenCalledTimes(1);
    expect(bot.stop).toHaveBeenCalledTimes(1);
  });

  it("enqueues only private text messages", async () => {
    const bot = new FakeTelegramBot();
    const enqueueInbound = vi.fn();
    const service = new TelegramService({ bot, enqueueInbound });

    expect(service).toBeDefined();
    expect(bot.handler).toBeTypeOf("function");

    bot.handler?.({
      update: {
        message: {
          from: { id: 42 },
          chat: { id: 42, type: "private" },
          text: "hello"
        }
      }
    });

    bot.handler?.({
      update: {
        message: {
          from: { id: 42 },
          chat: { id: -100, type: "group" },
          text: "ignored"
        }
      }
    });

    bot.handler?.({
      update: {
        message: {
          from: { id: 42 },
          chat: { id: 42, type: "private" }
        }
      }
    });

    expect(enqueueInbound).toHaveBeenCalledTimes(1);
    expect(enqueueInbound).toHaveBeenCalledWith({
      channel: "telegram",
      accountId: "default",
      chatType: "direct",
      conversationId: "42",
      senderId: "42",
      text: "hello"
    });
  });

  it("returns from the handler immediately after queueing work", async () => {
    const bot = new FakeTelegramBot();
    let resolveEnqueue: (() => void) | undefined;
    const enqueueInbound = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveEnqueue = resolve;
        })
    );

    new TelegramService({ bot, enqueueInbound });

    const started = performance.now();
    const result = bot.handler?.({
      update: {
        message: {
          from: { id: 7 },
          chat: { id: 7, type: "private" },
          text: "slow turn"
        }
      }
    });
    const elapsed = performance.now() - started;

    expect(result).toBeUndefined();
    expect(elapsed).toBeLessThan(50);
    expect(enqueueInbound).toHaveBeenCalledTimes(1);

    resolveEnqueue?.();
  });

  it("logs enqueue failures without throwing from the handler", async () => {
    const bot = new FakeTelegramBot();
    const destination = { write: vi.fn(() => true) };
    const logger = createLogger({ subsystem: "telegram", destination });
    const enqueueInbound = vi.fn().mockRejectedValue(new Error("queue full"));

    new TelegramService({ bot, enqueueInbound, logger });

    expect(() =>
      bot.handler?.({
        update: {
          message: {
            from: { id: 9 },
            chat: { id: 9, type: "private" },
            text: "hello"
          }
        }
      })
    ).not.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(destination.write).toHaveBeenCalled();
  });
});
