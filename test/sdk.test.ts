import { describe, expect, it, vi } from "vitest";
import { queryAgent } from "../src/runtime/sdk.js";

describe("queryAgent", () => {
  it("passes cwd, sessionId, tool policy, and system prompt into the SDK query call", async () => {
    const query = vi.fn(async function* (params: {
      prompt: string;
      options?: {
        cwd?: string;
        sessionId?: string;
        maxTurns?: number;
        permissionMode?: string;
        allowDangerouslySkipPermissions?: boolean;
        tools?: string[];
        systemPrompt?: {
          type: "preset";
          preset: "claude_code";
          append?: string;
        };
      };
    }) {
      yield {
        type: "result" as const,
        subtype: "success" as const,
        duration_ms: 1,
        duration_api_ms: 1,
        is_error: false,
        num_turns: 2,
        result: "done",
        stop_reason: null,
        total_cost_usd: 0.25,
        usage: {} as never,
        modelUsage: {},
        permission_denials: [],
        uuid: "uuid",
        session_id: "session"
      };
    });

    const result = await queryAgent(
      {
        prompt: "hello",
        sessionId: "telegram:default:direct:42",
        cwd: "/tmp/project",
        maxTurns: 12,
        systemPromptFile: "/tmp/system.md",
        skillDirectories: ["/tmp/extra-skills"],
        tools: ["Read", "Bash"]
      },
      {
        buildSystemPrompt: vi.fn().mockResolvedValue("assembled prompt"),
        loadPromptOnlySkills: vi.fn().mockResolvedValue([
          {
            name: "alpha",
            content: "alpha skill",
            path: "/tmp/project/skills/alpha/SKILL.md"
          }
        ]),
        query: query as never
      }
    );

    expect(result).toEqual({
      text: "done",
      usage: {
        totalCostUsd: 0.25,
        turns: 2
      }
    });
    expect(query).toHaveBeenCalledWith({
      prompt: "hello",
      options: {
        cwd: "/tmp/project",
        maxTurns: 12,
        sessionId: "telegram:default:direct:42",
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        tools: ["Read", "Bash"],
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
          append: "assembled prompt"
        }
      }
    });
  });

  it("uses Phase 1 defaults when optional request fields are omitted", async () => {
    const query = vi.fn(async function* () {
      yield {
        type: "result" as const,
        subtype: "success" as const,
        duration_ms: 1,
        duration_api_ms: 1,
        is_error: false,
        num_turns: 1,
        result: "ok",
        stop_reason: null,
        total_cost_usd: 0,
        usage: {} as never,
        modelUsage: {},
        permission_denials: [],
        uuid: "uuid",
        session_id: "session"
      };
    });

    await queryAgent(
      {
        prompt: "hello",
        sessionId: "telegram:default:direct:42",
        cwd: "/tmp/project"
      },
      {
        buildSystemPrompt: vi.fn().mockResolvedValue("prompt"),
        loadPromptOnlySkills: vi.fn().mockResolvedValue([]),
        query: query as never
      }
    );

    expect(query).toHaveBeenCalledWith({
      prompt: "hello",
      options: {
        cwd: "/tmp/project",
        model: undefined,
        maxTurns: 8,
        sessionId: "telegram:default:direct:42",
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        tools: ["Bash", "Read", "Write", "Edit"],
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
          append: "prompt"
        }
      }
    });
  });

  it("throws when the final SDK result is an error", async () => {
    const query = vi.fn(async function* () {
      yield {
        type: "result" as const,
        subtype: "error_max_turns" as const,
        duration_ms: 1,
        duration_api_ms: 1,
        is_error: true,
        num_turns: 8,
        stop_reason: null,
        total_cost_usd: 0.5,
        usage: {} as never,
        modelUsage: {},
        permission_denials: [],
        errors: ["max turns reached"],
        uuid: "uuid",
        session_id: "session"
      };
    });

    await expect(
      queryAgent(
        {
          prompt: "hello",
          sessionId: "telegram:default:direct:42",
          cwd: "/tmp/project"
        },
        {
          buildSystemPrompt: vi.fn().mockResolvedValue("prompt"),
          loadPromptOnlySkills: vi.fn().mockResolvedValue([]),
          query: query as never
        }
      )
    ).rejects.toThrow("Claude Agent SDK failed: max turns reached");
  });
});
