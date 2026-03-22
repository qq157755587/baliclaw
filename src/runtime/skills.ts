import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { PromptSkill } from "./prompts.js";

export interface LoadedPromptSkill extends PromptSkill {
  path: string;
}

export interface LoadPromptOnlySkillsOptions {
  workingDirectory: string;
  extraDirectories?: string[];
}

export class SkillsService {
  async loadPromptOnlySkills(options: LoadPromptOnlySkillsOptions): Promise<LoadedPromptSkill[]> {
    const roots = buildSkillRoots(options);
    const discovered = await Promise.all(roots.map((root) => readSkillsFromRoot(root)));

    return discovered
      .flat()
      .sort((left, right) => left.path.localeCompare(right.path));
  }
}

export async function loadPromptOnlySkills(
  options: LoadPromptOnlySkillsOptions
): Promise<LoadedPromptSkill[]> {
  return await new SkillsService().loadPromptOnlySkills(options);
}

function buildSkillRoots(options: LoadPromptOnlySkillsOptions): string[] {
  return [
    join(options.workingDirectory, "skills"),
    ...(options.extraDirectories ?? [])
  ];
}

async function readSkillsFromRoot(root: string): Promise<LoadedPromptSkill[]> {
  const rootEntries = await safeReadDir(root);

  if (!rootEntries) {
    return [];
  }

  const directSkill = await readSkillFile(join(root, "SKILL.md"), basename(root));
  const nestedSkills = await Promise.all(
    rootEntries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => readSkillFile(join(root, entry.name, "SKILL.md"), entry.name))
  );

  return [
    ...(directSkill ? [directSkill] : []),
    ...nestedSkills.filter((skill): skill is LoadedPromptSkill => skill !== null)
  ];
}

async function readSkillFile(path: string, fallbackName: string): Promise<LoadedPromptSkill | null> {
  try {
    const content = await readFile(path, "utf8");
    if (content.trim().length === 0) {
      return null;
    }

    return {
      name: fallbackName,
      content: content.trim(),
      path
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    throw error;
  }
}

async function safeReadDir(path: string) {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    throw error;
  }
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
