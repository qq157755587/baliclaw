import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getAppPaths } from "../src/config/paths.js";
import { ScheduledTaskStatusStore } from "../src/runtime/scheduled-task-status-store.js";

describe("ScheduledTaskStatusStore", () => {
  it("stores and retrieves task status entries", async () => {
    const home = await mkdtemp(join(tmpdir(), "baliclaw-scheduled-task-status-"));
    const paths = getAppPaths(home);

    try {
      const store = new ScheduledTaskStatusStore(paths);
      await store.set("dailySummary", {
        scheduledAt: "2026-04-08T00:00:00.000Z",
        startedAt: "2026-04-08T00:00:05.000Z",
        finishedAt: "2026-04-08T00:01:00.000Z",
        status: "succeeded"
      });

      await expect(store.get("dailySummary")).resolves.toEqual({
        scheduledAt: "2026-04-08T00:00:00.000Z",
        startedAt: "2026-04-08T00:00:05.000Z",
        finishedAt: "2026-04-08T00:01:00.000Z",
        status: "succeeded"
      });
      await expect(readFile(paths.scheduledTaskStatusFile, "utf8")).resolves.toContain("dailySummary");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("removes stored task status entries", async () => {
    const home = await mkdtemp(join(tmpdir(), "baliclaw-scheduled-task-status-delete-"));
    const paths = getAppPaths(home);

    try {
      const store = new ScheduledTaskStatusStore(paths);
      await store.set("dailySummary", {
        status: "skipped",
        reason: "previous run still active"
      });

      await store.delete("dailySummary");

      await expect(store.get("dailySummary")).resolves.toBeUndefined();
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
