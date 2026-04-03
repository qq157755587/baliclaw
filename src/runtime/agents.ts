import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import type {
  AgentDefinition as SdkAgentDefinition,
  AgentMcpServerSpec,
  McpServerConfig as SdkMcpServerConfig
} from "@anthropic-ai/claude-agent-sdk";
import type { AgentDefinitionConfig } from "../config/schema.js";
import { AppError, appErrorCodes } from "../shared/errors.js";

export interface BuildAgentDefinitionsOptions {
  workingDirectory: string;
  agents: Record<string, AgentDefinitionConfig>;
  mcpServers?: Record<string, SdkMcpServerConfig>;
}

export async function buildAgentDefinitions(
  options: BuildAgentDefinitionsOptions
): Promise<Record<string, SdkAgentDefinition> | undefined> {
  const entries = await Promise.all(
    Object.entries(options.agents).map(async ([name, agent]) => {
      const prompt = agent.prompt ?? await loadPromptFromFile(name, agent.promptFile, options.workingDirectory);
      const definition: SdkAgentDefinition = {
        description: agent.description,
        prompt
      };

      if (agent.tools) {
        definition.tools = agent.tools;
      }
      if (agent.model) {
        definition.model = agent.model;
      }
      if (agent.skills) {
        definition.skills = agent.skills;
      }
      if (agent.mcpServers) {
        definition.mcpServers = resolveAgentMcpServers(name, agent.mcpServers, options.mcpServers);
      }

      return [name, definition] as const;
    })
  );

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

async function loadPromptFromFile(
  agentName: string,
  promptFile: string | undefined,
  workingDirectory: string
): Promise<string> {
  if (!promptFile) {
    throw new AppError(
      `Agent "${agentName}" is missing both prompt and promptFile`,
      appErrorCodes.configInvalid,
      undefined,
      { agent: agentName }
    );
  }

  const path = isAbsolute(promptFile) ? promptFile : resolve(workingDirectory, promptFile);

  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new AppError(
        `Subagent prompt file not found for "${agentName}"`,
        appErrorCodes.configInvalid,
        error,
        {
          agent: agentName,
          promptFile: path
        }
      );
    }

    throw error;
  }
}

function resolveAgentMcpServers(
  agentName: string,
  agentMcpServerNames: string[],
  availableMcpServers: Record<string, SdkMcpServerConfig> | undefined
): AgentMcpServerSpec[] {
  return agentMcpServerNames.map((serverName) => {
    const definition = availableMcpServers?.[serverName];

    if (!definition) {
      throw new AppError(
        `Subagent "${agentName}" references unknown MCP server "${serverName}"`,
        appErrorCodes.configInvalid,
        undefined,
        {
          agent: agentName,
          mcpServer: serverName
        }
      );
    }

    return {
      [serverName]: definition
    };
  });
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
