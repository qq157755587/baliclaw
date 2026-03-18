import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger, getLogger } from "../src/shared/logger.js";

class BufferingDestination extends Writable {
  private buffer = "";

  override _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.buffer += chunk.toString();
    callback();
  }

  readLines(): string[] {
    return this.buffer.trim().split("\n").filter(Boolean);
  }
}

describe("logger", () => {
  it("writes JSON logs with subsystem metadata", () => {
    const destination = new BufferingDestination();
    const logger = createLogger({ subsystem: "config", destination });

    logger.info({ stableSessionKey: "telegram:default:direct:42" }, "config loaded");

    const [line] = destination.readLines();
    const entry = JSON.parse(line);

    expect(entry.msg).toBe("config loaded");
    expect(entry.subsystem).toBe("config");
    expect(entry.service).toBe("baliclaw");
    expect(entry.stableSessionKey).toBe("telegram:default:direct:42");
    expect(typeof entry.time).toBe("string");
    expect(typeof entry.level).toBe("number");
  });

  it("redacts sensitive fields by default", () => {
    const destination = new BufferingDestination();
    const logger = createLogger({ subsystem: "telegram", destination });

    logger.info({
      botToken: "123:secret",
      headers: {
        authorization: "Bearer abc"
      },
      nested: {
        apiKey: "shhh"
      }
    }, "telegram configured");

    const [line] = destination.readLines();
    const entry = JSON.parse(line);

    expect(entry.botToken).toBe("[REDACTED]");
    expect(entry.headers.authorization).toBe("[REDACTED]");
    expect(entry.nested.apiKey).toBe("[REDACTED]");
  });

  it("creates child loggers for known subsystems", () => {
    const destination = new BufferingDestination();
    const root = createLogger({ destination });
    const logger = root.child({ subsystem: "daemon" });

    logger.warn({ senderId: "42" }, "daemon warning");

    const [line] = destination.readLines();
    const entry = JSON.parse(line);

    expect(entry.subsystem).toBe("daemon");
    expect(entry.senderId).toBe("42");
    expect(entry.msg).toBe("daemon warning");
  });

  it("getLogger returns a logger tagged with the requested subsystem", () => {
    const destination = new BufferingDestination();
    const logger = getLogger("ipc", { destination });

    logger.error("request failed");

    const [line] = destination.readLines();
    const entry = JSON.parse(line);

    expect(entry.subsystem).toBe("ipc");
  });
});
