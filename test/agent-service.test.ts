import { describe, expect, it, vi } from "vitest";
import { AgentService } from "../src/runtime/agent-service.js";
import { createLogger } from "../src/shared/logger.js";
import type { InboundMessage } from "../src/shared/types.js";

function makeMessage(text: string, senderId = "42"): InboundMessage {
  return {
    channel: "telegram",
    accountId: "default",
    chatType: "direct",
    conversationId: senderId,
    senderId,
    text
  };
}

describe("AgentService", () => {
  it("uses a stable session id and the provided cwd when calling the SDK wrapper", async () => {
    const queryAgent = vi.fn().mockResolvedValue({
      text: "done"
    });
    const service = new AgentService({
      runQueryAgent: queryAgent
    });

    await expect(service.handleMessage(makeMessage("hello"), "/tmp/project")).resolves.toBe("done");

    expect(queryAgent).toHaveBeenCalledWith({
      prompt: "hello",
      sessionId: "telegram:default:direct:42",
      cwd: "/tmp/project"
    });
  });

  it("passes advanced runtime options through to the SDK wrapper", async () => {
    const queryAgent = vi.fn().mockResolvedValue({
      text: "done"
    });
    const service = new AgentService({
      runQueryAgent: queryAgent
    });

    await service.handleMessage(makeMessage("hello"), {
      cwd: "/tmp/project",
      sessionId: "custom-session",
      model: "claude-sonnet",
      maxTurns: 12,
      systemPromptFile: "/tmp/system.md",
      skillDirectories: ["/tmp/skills"],
      tools: ["Read", "Bash"]
    });

    expect(queryAgent).toHaveBeenCalledWith({
      prompt: "hello",
      sessionId: "custom-session",
      cwd: "/tmp/project",
      model: "claude-sonnet",
      maxTurns: 12,
      systemPromptFile: "/tmp/system.md",
      skillDirectories: ["/tmp/skills"],
      tools: ["Read", "Bash"]
    });
  });

  it("returns a readable max-turns failure message and logs the error", async () => {
    const destination = { write: vi.fn(() => true) };
    const logger = createLogger({ subsystem: "agent", destination });
    const service = new AgentService({
      logger,
      runQueryAgent: vi.fn().mockRejectedValue(new Error("Claude Agent SDK failed: max turns reached"))
    });

    await expect(service.handleMessage(makeMessage("hello"), "/tmp/project")).resolves.toBe(
      "Sorry, I couldn't finish that within the allowed turn limit."
    );
    expect(destination.write).toHaveBeenCalled();
  });

  it("returns a generic readable failure message for unexpected errors", async () => {
    const destination = { write: vi.fn(() => true) };
    const logger = createLogger({ subsystem: "agent", destination });
    const service = new AgentService({
      logger,
      runQueryAgent: vi.fn().mockRejectedValue(new Error("network broke"))
    });

    await expect(service.handleMessage(makeMessage("hello"), "/tmp/project")).resolves.toBe(
      "Sorry, I ran into an internal error while processing your request."
    );
    expect(destination.write).toHaveBeenCalled();
  });
});
