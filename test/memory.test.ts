import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getAppPaths } from "../src/config/paths.js";
import {
  getProjectMemoryFilePath,
  getProjectMemoryHash,
  readMemory
} from "../src/runtime/memory.js";

describe("memory module", () => {
  it("returns the same project hash for the same working directory", () => {
    expect(getProjectMemoryHash("/tmp/project-a")).toBe(getProjectMemoryHash("/tmp/project-a"));
  });

  it("returns different project hashes for different working directories", () => {
    expect(getProjectMemoryHash("/tmp/project-a")).not.toBe(getProjectMemoryHash("/tmp/project-b"));
  });

  it("truncates memory content to the configured max line count", async () => {
    const home = await mkdtemp(join(tmpdir(), "baliclaw-memory-truncate-"));
    const paths = getAppPaths(home);
    const workingDirectory = "/tmp/project-truncate";
    const memoryFile = getProjectMemoryFilePath(paths, workingDirectory);

    try {
      await mkdir(join(paths.memoryProjectsDir, getProjectMemoryHash(workingDirectory)), { recursive: true });
      await writeFile(memoryFile, "line1\nline2\nline3\nline4", "utf8");

      await expect(
        readMemory({
          paths,
          workingDirectory,
          maxLines: 2
        })
      ).resolves.toBe("line1\nline2");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("returns an empty string when the memory file does not exist", async () => {
    const home = await mkdtemp(join(tmpdir(), "baliclaw-memory-missing-"));

    try {
      await expect(
        readMemory({
          paths: getAppPaths(home),
          workingDirectory: "/tmp/project-missing",
          maxLines: 5
        })
      ).resolves.toBe("");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("creates the project memory directory automatically", async () => {
    const home = await mkdtemp(join(tmpdir(), "baliclaw-memory-dir-"));
    const paths = getAppPaths(home);
    const workingDirectory = "/tmp/project-dir";

    try {
      await readMemory({
        paths,
        workingDirectory,
        maxLines: 5
      });

      const memoryDir = await stat(join(paths.memoryProjectsDir, getProjectMemoryHash(workingDirectory)));
      expect(memoryDir.isDirectory()).toBe(true);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
