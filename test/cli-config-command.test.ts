import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { runConfigGetCommand, runConfigSetCommand } from "../src/cli/commands/config.js";
import type { AppConfig } from "../src/config/schema.js";

const config: AppConfig = {
  telegram: {
    enabled: false,
    botToken: ""
  },
  runtime: {
    workingDirectory: "/tmp/baliclaw"
  },
  tools: {
    availableTools: ["Bash", "Read", "Write", "Edit"]
  },
  skills: {
    enabled: true,
    directories: []
  },
  logging: {
    level: "info"
  }
};

describe("CLI config commands", () => {
  it("prints the current config from IPC", async () => {
    const client = {
      getConfig: vi.fn<() => Promise<AppConfig>>().mockResolvedValue(config)
    } as never;

    await expect(runConfigGetCommand(client)).resolves.toBe(JSON.stringify(config, null, 2));
  });

  it("updates config from inline JSON5", async () => {
    const client = {
      setConfig: vi.fn<(value: AppConfig) => Promise<AppConfig>>().mockImplementation(async (value) => value)
    } as never;

    const output = await runConfigSetCommand(
      `{ telegram: { enabled: false, botToken: "" }, runtime: { workingDirectory: "/tmp/updated" }, tools: { availableTools: ["Bash"] }, skills: { enabled: true, directories: [] }, logging: { level: "warn" } }`,
      {},
      client
    );

    expect(client.setConfig).toHaveBeenCalledWith({
      telegram: {
        enabled: false,
        botToken: ""
      },
      runtime: {
        workingDirectory: "/tmp/updated"
      },
      tools: {
        availableTools: ["Bash"]
      },
      skills: {
        enabled: true,
        directories: []
      },
      logging: {
        level: "warn"
      }
    });
    expect(output).toContain("\"workingDirectory\": \"/tmp/updated\"");
  });

  it("updates config from a file payload", async () => {
    const home = await mkdtemp(join(tmpdir(), "baliclaw-cli-config-"));
    const file = join(home, "config.json5");
    const client = {
      setConfig: vi.fn<(value: AppConfig) => Promise<AppConfig>>().mockImplementation(async (value) => value)
    } as never;

    try {
      await writeFile(
        file,
        `{ telegram: { enabled: false, botToken: "" }, runtime: { workingDirectory: "/tmp/from-file" }, tools: { availableTools: ["Read"] }, skills: { enabled: true, directories: [] }, logging: { level: "debug" } }\n`,
        "utf8"
      );

      await runConfigSetCommand(undefined, { file }, client);

      expect(client.setConfig).toHaveBeenCalledWith({
        telegram: {
          enabled: false,
          botToken: ""
        },
        runtime: {
          workingDirectory: "/tmp/from-file"
        },
        tools: {
          availableTools: ["Read"]
        },
        skills: {
          enabled: true,
          directories: []
        },
        logging: {
          level: "debug"
        }
      });
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
