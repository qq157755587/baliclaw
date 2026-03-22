import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SkillsService, loadPromptOnlySkills } from "../src/runtime/skills.js";

describe("SkillsService", () => {
  it("loads prompt-only skills from the working directory skills folder", async () => {
    const workingDirectory = await mkdtemp(join(tmpdir(), "baliclaw-skills-working-"));
    const alphaDir = join(workingDirectory, "skills", "alpha");
    const betaDir = join(workingDirectory, "skills", "beta");

    try {
      await mkdir(alphaDir, { recursive: true });
      await mkdir(betaDir, { recursive: true });
      await writeFile(join(alphaDir, "SKILL.md"), "Alpha instructions", "utf8");
      await writeFile(join(betaDir, "SKILL.md"), "Beta instructions", "utf8");
      await writeFile(join(betaDir, "helper.sh"), "echo should-not-run", "utf8");

      const skills = await loadPromptOnlySkills({ workingDirectory });

      expect(skills).toEqual([
        {
          name: "alpha",
          content: "Alpha instructions",
          path: join(alphaDir, "SKILL.md")
        },
        {
          name: "beta",
          content: "Beta instructions",
          path: join(betaDir, "SKILL.md")
        }
      ]);
    } finally {
      await rm(workingDirectory, { recursive: true, force: true });
    }
  });

  it("loads skills from configured extra directories", async () => {
    const workingDirectory = await mkdtemp(join(tmpdir(), "baliclaw-skills-extra-work-"));
    const extraRoot = await mkdtemp(join(tmpdir(), "baliclaw-skills-extra-root-"));
    const directDir = join(extraRoot, "direct-skill");
    const nestedDir = join(extraRoot, "team-skill");

    try {
      await mkdir(directDir, { recursive: true });
      await mkdir(nestedDir, { recursive: true });
      await writeFile(join(directDir, "SKILL.md"), "Direct instructions", "utf8");
      await writeFile(join(extraRoot, "SKILL.md"), "Root instructions", "utf8");

      const service = new SkillsService();
      const skills = await service.loadPromptOnlySkills({
        workingDirectory,
        extraDirectories: [extraRoot]
      });

      expect(skills).toEqual([
        {
          name: "direct-skill",
          content: "Direct instructions",
          path: join(directDir, "SKILL.md")
        },
        {
          name: basename(extraRoot),
          content: "Root instructions",
          path: join(extraRoot, "SKILL.md")
        }
      ]);
    } finally {
      await rm(workingDirectory, { recursive: true, force: true });
      await rm(extraRoot, { recursive: true, force: true });
    }
  });

  it("ignores missing or empty skill files", async () => {
    const workingDirectory = await mkdtemp(join(tmpdir(), "baliclaw-skills-empty-"));
    const emptyDir = join(workingDirectory, "skills", "empty");
    const missingDir = join(workingDirectory, "skills", "missing");

    try {
      await mkdir(emptyDir, { recursive: true });
      await mkdir(missingDir, { recursive: true });
      await writeFile(join(emptyDir, "SKILL.md"), "   \n", "utf8");

      const skills = await loadPromptOnlySkills({ workingDirectory });

      expect(skills).toEqual([]);
    } finally {
      await rm(workingDirectory, { recursive: true, force: true });
    }
  });
});

function basename(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1] ?? path;
}
