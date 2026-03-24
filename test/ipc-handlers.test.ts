import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../src/config/schema.js";
import { handleConfigGet, handleConfigSet } from "../src/ipc/handlers/config.js";
import { handleStatus } from "../src/ipc/handlers/status.js";

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

describe("IPC handlers", () => {
  it("delegates status reads through the provided getter", async () => {
    const getStatus = vi.fn().mockResolvedValue({
      ok: true,
      service: "baliclaw",
      version: "test"
    });

    await expect(handleStatus(getStatus)).resolves.toEqual({
      ok: true,
      service: "baliclaw",
      version: "test"
    });
    expect(getStatus).toHaveBeenCalledTimes(1);
  });

  it("loads config through ConfigService", async () => {
    const configService = {
      load: vi.fn().mockResolvedValue(config)
    } as never;

    await expect(handleConfigGet(configService)).resolves.toEqual(config);
    expect(configService.load).toHaveBeenCalledTimes(1);
  });

  it("saves config and reloads in-memory state when a reload hook is present", async () => {
    const reloadedConfig: AppConfig = {
      ...config,
      runtime: {
        workingDirectory: "/tmp/reloaded"
      }
    };
    const configService = {
      save: vi.fn().mockResolvedValue(undefined),
      load: vi.fn()
    } as never;
    const reloadConfig = vi.fn().mockResolvedValue(reloadedConfig);

    await expect(handleConfigSet(configService, config, reloadConfig)).resolves.toEqual(reloadedConfig);
    expect(configService.save).toHaveBeenCalledWith(config);
    expect(reloadConfig).toHaveBeenCalledTimes(1);
    expect(configService.load).not.toHaveBeenCalled();
  });

  it("saves config and falls back to loading from disk without a reload hook", async () => {
    const configService = {
      save: vi.fn().mockResolvedValue(undefined),
      load: vi.fn().mockResolvedValue(config)
    } as never;

    await expect(handleConfigSet(configService, config)).resolves.toEqual(config);
    expect(configService.save).toHaveBeenCalledWith(config);
    expect(configService.load).toHaveBeenCalledTimes(1);
  });
});
