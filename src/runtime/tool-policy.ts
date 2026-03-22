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
