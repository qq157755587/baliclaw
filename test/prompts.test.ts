import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "../src/runtime/prompts.js";

describe("buildSystemPrompt", () => {
  it("returns the base prompt when no optional files are present", async () => {
    const workingDirectory = await mkdtemp(join(tmpdir(), "baliclaw-prompts-base-"));

    try {
      const prompt = await buildSystemPrompt({
        workingDirectory
      });

      expect(prompt).toContain("You are the BaliClaw Phase 1 agent.");
      expect(prompt).toContain("=== USER.md ===");
      expect(prompt).toContain(`lives at ${join(workingDirectory, "USER.md")}`);
      expect(prompt).toContain("## Current USER.md contents:\n(empty)");
    } finally {
      await rm(workingDirectory, { recursive: true, force: true });
    }
  });

  it("assembles the final prompt in the documented order", async () => {
    const workingDirectory = await mkdtemp(join(tmpdir(), "baliclaw-prompts-order-"));
    const extraPromptFile = join(workingDirectory, "extra-prompt.md");

    try {
      await writeFile(join(workingDirectory, "SOUL.md"), "Agent soul", "utf8");
      await writeFile(join(workingDirectory, "USER.md"), "User profile", "utf8");
      await writeFile(join(workingDirectory, "AGENTS.md"), "Repository rules", "utf8");
      await writeFile(join(workingDirectory, "TOOLS.md"), "Workspace tools", "utf8");
      await writeFile(extraPromptFile, "Extra runtime instructions", "utf8");

      const prompt = await buildSystemPrompt({
        workingDirectory,
        systemPromptFile: extraPromptFile,
        memoryEnabled: true,
        memoryFilePath: "/tmp/.baliclaw/memory/projects/abc123/MEMORY.md",
        memoryContent: "Remember this",
        skillPrompts: [
          {
            name: "foo",
            content: "Skill foo instructions"
          },
          {
            name: "bar",
            content: "Skill bar instructions"
          }
        ]
      });

      expect(prompt).toBe(
        [
          "You are the BaliClaw Phase 1 agent.",
          "=== SOUL.md ===\nAgent soul",
          [
            "=== USER.md ===",
            `This file describes the user and lives at ${join(workingDirectory, "USER.md")}. Keep it updated when you learn durable preferences or context.`,
            "Use the Write or Edit tool to create or update this file, and correct outdated information instead of appending duplicate notes.",
            "Keep it concise and avoid sensitive information that does not improve future help.",
            "",
            "## Current USER.md contents:",
            "User profile"
          ].join("\n"),
          "=== AGENTS.md ===\nRepository rules",
          "=== TOOLS.md ===\nWorkspace tools",
          "=== SYSTEM PROMPT ===\nExtra runtime instructions",
          [
            "=== PERSISTENT MEMORY ===",
            "You have a persistent memory file at /tmp/.baliclaw/memory/projects/abc123/MEMORY.md. Its current contents are shown below.",
            "",
            "## How to use memory:",
            "- Use the Edit or Write tool to update this file when you learn important information",
            "- Organize by topic, not chronologically",
            "- Keep it concise - this file is injected into every conversation",
            "- Remove outdated information when you notice it",
            "",
            "## What to remember:",
            "- Project architecture decisions and conventions",
            "- Recurring patterns and solutions",
            "- Important context from past conversations",
            "- Things the user explicitly asks you to remember",
            "",
            "## What NOT to remember:",
            "- Transient task details or in-progress state",
            "- Information already documented in project files",
            "- Sensitive credentials or secrets",
            "- Anything redundant with SOUL.md or USER.md",
            "",
            "## Current memory contents:",
            "Remember this"
          ].join("\n"),
          "=== SKILL: foo ===\nSkill foo instructions",
          "=== SKILL: bar ===\nSkill bar instructions"
        ].join("\n\n")
      );
    } finally {
      await rm(workingDirectory, { recursive: true, force: true });
    }
  });

  it("skips empty optional sections", async () => {
    const workingDirectory = await mkdtemp(join(tmpdir(), "baliclaw-prompts-empty-"));
    const extraPromptFile = join(workingDirectory, "extra-prompt.md");

    try {
      await writeFile(join(workingDirectory, "AGENTS.md"), "   \n", "utf8");
      await writeFile(extraPromptFile, "\n", "utf8");

      const prompt = await buildSystemPrompt({
        workingDirectory,
        systemPromptFile: extraPromptFile,
        skillPrompts: [
          {
            name: "empty",
            content: "   "
          }
        ]
      });

      expect(prompt).toContain("You are the BaliClaw Phase 1 agent.");
      expect(prompt).toContain("=== USER.md ===");
      expect(prompt).toContain("## Current USER.md contents:\n(empty)");
      expect(prompt).not.toContain("=== AGENTS.md ===");
      expect(prompt).not.toContain("=== TOOLS.md ===");
      expect(prompt).not.toContain("=== SYSTEM PROMPT ===");
      expect(prompt).not.toContain("=== SKILL:");
    } finally {
      await rm(workingDirectory, { recursive: true, force: true });
    }
  });

  it("uses the configured soul file path before the working directory default", async () => {
    const workingDirectory = await mkdtemp(join(tmpdir(), "baliclaw-prompts-soul-"));
    const customSoulFile = join(tmpdir(), `baliclaw-custom-soul-${Date.now()}.md`);

    try {
      await writeFile(join(workingDirectory, "SOUL.md"), "Default soul", "utf8");
      await writeFile(customSoulFile, "Configured soul", "utf8");

      const prompt = await buildSystemPrompt({
        workingDirectory,
        soulFile: customSoulFile
      });

      expect(prompt).toContain("=== SOUL.md ===\nConfigured soul");
      expect(prompt).not.toContain("Default soul");
    } finally {
      await rm(customSoulFile, { force: true });
      await rm(workingDirectory, { recursive: true, force: true });
    }
  });

  it("uses the configured user file path before the working directory default", async () => {
    const workingDirectory = await mkdtemp(join(tmpdir(), "baliclaw-prompts-user-"));
    const customUserFile = join(tmpdir(), `baliclaw-custom-user-${Date.now()}.md`);

    try {
      await writeFile(join(workingDirectory, "USER.md"), "Default user", "utf8");
      await writeFile(customUserFile, "Configured user", "utf8");

      const prompt = await buildSystemPrompt({
        workingDirectory,
        userFile: customUserFile
      });

      expect(prompt).toContain(`lives at ${customUserFile}`);
      expect(prompt).toContain("Configured user");
      expect(prompt).not.toContain("Default user");
    } finally {
      await rm(customUserFile, { force: true });
      await rm(workingDirectory, { recursive: true, force: true });
    }
  });

  it("includes the memory section even when memory content is empty", async () => {
    const workingDirectory = await mkdtemp(join(tmpdir(), "baliclaw-prompts-memory-empty-"));

    try {
      const prompt = await buildSystemPrompt({
        workingDirectory,
        memoryEnabled: true,
        memoryFilePath: "/tmp/.baliclaw/memory/projects/empty/MEMORY.md",
        memoryContent: ""
      });

      expect(prompt).toContain("=== PERSISTENT MEMORY ===");
      expect(prompt).toContain("/tmp/.baliclaw/memory/projects/empty/MEMORY.md");
      expect(prompt).toContain("## Current memory contents:\n(empty)");
    } finally {
      await rm(workingDirectory, { recursive: true, force: true });
    }
  });

  it("includes an empty USER section when USER.md does not exist yet", async () => {
    const workingDirectory = await mkdtemp(join(tmpdir(), "baliclaw-prompts-user-empty-"));

    try {
      const prompt = await buildSystemPrompt({
        workingDirectory
      });

      expect(prompt).toContain("=== USER.md ===");
      expect(prompt).toContain(`lives at ${join(workingDirectory, "USER.md")}`);
      expect(prompt).toContain("## Current USER.md contents:\n(empty)");
    } finally {
      await rm(workingDirectory, { recursive: true, force: true });
    }
  });

  it("includes TOOLS.md when present", async () => {
    const workingDirectory = await mkdtemp(join(tmpdir(), "baliclaw-prompts-tools-"));

    try {
      await writeFile(join(workingDirectory, "TOOLS.md"), "BaliClaw commands", "utf8");

      const prompt = await buildSystemPrompt({
        workingDirectory
      });

      expect(prompt).toContain("=== TOOLS.md ===\nBaliClaw commands");
    } finally {
      await rm(workingDirectory, { recursive: true, force: true });
    }
  });

  it("resolves relative prompt file overrides against the working directory", async () => {
    const workingDirectory = await mkdtemp(join(tmpdir(), "baliclaw-prompts-relative-"));

    try {
      await writeFile(join(workingDirectory, "custom-soul.md"), "Relative soul", "utf8");
      await writeFile(join(workingDirectory, "custom-user.md"), "Relative user", "utf8");
      await writeFile(join(workingDirectory, "custom-system.md"), "Relative system", "utf8");

      const prompt = await buildSystemPrompt({
        workingDirectory,
        soulFile: "custom-soul.md",
        userFile: "custom-user.md",
        systemPromptFile: "custom-system.md"
      });

      expect(prompt).toContain("=== SOUL.md ===\nRelative soul");
      expect(prompt).toContain("Relative user");
      expect(prompt).toContain("=== SYSTEM PROMPT ===\nRelative system");
    } finally {
      await rm(workingDirectory, { recursive: true, force: true });
    }
  });
});
