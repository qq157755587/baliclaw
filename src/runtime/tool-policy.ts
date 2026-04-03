import { defaultAvailableTools, type AppConfig } from "../config/schema.js";

export interface ToolPolicy {
  permissionMode: "bypassPermissions";
  allowDangerouslySkipPermissions: true;
  tools: string[];
}

export function getPhase1ToolPolicy(config?: Pick<AppConfig, "tools">): ToolPolicy {
  return {
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    tools: [...(config?.tools.availableTools ?? defaultAvailableTools)]
  };
}

export function getToolPolicy(
  config: {
    tools: Pick<AppConfig["tools"], "availableTools">;
    mcp: { servers: Record<string, unknown> };
    skills: Pick<AppConfig["skills"], "sdkNative">;
    agents: Record<string, unknown>;
  }
): ToolPolicy {
  const tools = [...config.tools.availableTools];

  for (const serverName of Object.keys(config.mcp.servers)) {
    const wildcard = `mcp__${serverName}__*`;
    if (!tools.includes(wildcard)) {
      tools.push(wildcard);
    }
  }

  if (config.skills.sdkNative && !tools.includes("Skill")) {
    tools.push("Skill");
  }

  if (Object.keys(config.agents).length > 0 && !tools.includes("Agent")) {
    tools.push("Agent");
  }

  return {
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    tools
  };
}
