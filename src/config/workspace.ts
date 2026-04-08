import { readFileSync } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { AppPaths } from "./paths.js";

export const defaultAgentsFileContents = readTemplate("../../resources/AGENTS.default.md");
export const defaultSoulFileContents = readTemplate("../../resources/SOUL.default.md");
export const defaultUserFileContents = readTemplate("../../resources/USER.default.md");
export const defaultToolsFileContents = readTemplate("../../resources/TOOLS.default.md");

export const defaultFindSkillsFileContents = `---
name: find-skills
description: Discover, evaluate, and suggest relevant Claude skills for the current task.
---

# find-skills

Use this skill when the user needs a capability and you should identify which existing skills can help.

## Workflow

1. Clarify the user goal and constraints.
2. Search for candidate skills and list the best matches.
3. Explain tradeoffs and recommend one option first.
4. Offer next steps to install or apply the selected skill.

## Output Guidelines

- Prefer concise, actionable recommendations.
- Include why each suggested skill fits.
- If no strong match exists, say so clearly and suggest creating a new skill.

Reference: https://skills.sh/vercel-labs/skills/find-skills
`;

export const defaultSkillCreatorFileContents = `---
name: skill-creator
description: Design and draft new Claude skills with clear scope, triggers, and reusable assets.
---

# skill-creator

Use this skill when the user wants to create or improve a skill.

## Workflow

1. Define the skill purpose, users, and boundaries.
2. Specify trigger conditions and non-goals.
3. Draft \`SKILL.md\` with step-by-step behavior.
4. Add reusable templates/scripts only when they provide clear value.
5. Validate the skill with one realistic example invocation.

## Quality Checklist

- Single clear responsibility.
- Concrete execution steps.
- Minimal required context and dependencies.
- Explicit fallback behavior when prerequisites are missing.

Reference: https://skills.sh/anthropics/skills/skill-creator
`;

export function getDefaultWorkspaceDirectory(paths: AppPaths): string {
  return paths.workspaceDir;
}

export async function ensureWorkspaceScaffold(paths: AppPaths): Promise<void> {
  await mkdir(paths.workspaceDir, { recursive: true });
  const findSkillsDirectory = join(paths.workspaceDir, ".claude", "skills", "find-skills");
  const skillCreatorDirectory = join(paths.workspaceDir, ".claude", "skills", "skill-creator");
  const globalClaudeSkillsDirectory = join(dirname(paths.rootDir), ".claude", "skills");

  await Promise.all([
    writeDefaultFile(join(paths.workspaceDir, "AGENTS.md"), defaultAgentsFileContents),
    writeDefaultFile(join(paths.workspaceDir, "SOUL.md"), defaultSoulFileContents),
    writeDefaultFile(join(paths.workspaceDir, "USER.md"), defaultUserFileContents),
    writeDefaultFile(join(paths.workspaceDir, "TOOLS.md"), defaultToolsFileContents),
    writeDefaultSkill(findSkillsDirectory, defaultFindSkillsFileContents, globalClaudeSkillsDirectory),
    writeDefaultSkill(skillCreatorDirectory, defaultSkillCreatorFileContents, globalClaudeSkillsDirectory)
  ]);
}

async function writeDefaultSkill(
  skillDirectory: string,
  contents: string,
  globalClaudeSkillsDirectory: string
): Promise<void> {
  if (await pathExists(skillDirectory)) {
    return;
  }

  const globalSkillDirectory = join(globalClaudeSkillsDirectory, basename(skillDirectory));
  if (await pathExists(globalSkillDirectory)) {
    return;
  }

  await writeDefaultFile(join(skillDirectory, "SKILL.md"), contents);
}

async function writeDefaultFile(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });

  try {
    await writeFile(path, `${contents.trim()}\n`, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (isExistingFileError(error)) {
      return;
    }

    throw error;
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isMissingPathError(error)) {
      return false;
    }

    throw error;
  }
}

function readTemplate(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8").trim();
}

function isExistingFileError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST";
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
