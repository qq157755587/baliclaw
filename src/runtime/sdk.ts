import { query as sdkQuery, type SDKMessage, type SDKResultError, type SDKResultSuccess } from "@anthropic-ai/claude-agent-sdk";
import { buildSystemPrompt } from "./prompts.js";
import { loadPromptOnlySkills } from "./skills.js";
import { getPhase1ToolPolicy } from "./tool-policy.js";

export interface QueryRequest {
  prompt: string;
  sessionId: string;
  cwd: string;
  model?: string;
  maxTurns?: number;
  systemPromptFile?: string;
  skillDirectories?: string[];
  tools?: string[];
}

export interface QueryUsage {
  totalCostUsd?: number;
  turns?: number;
}

export interface QueryResult {
  text: string;
  usage?: QueryUsage;
}

export interface QueryAgentDependencies {
  buildSystemPrompt?: typeof buildSystemPrompt;
  loadPromptOnlySkills?: typeof loadPromptOnlySkills;
  query?: typeof sdkQuery;
}

export async function queryAgent(
  request: QueryRequest,
  dependencies: QueryAgentDependencies = {}
): Promise<QueryResult> {
  const buildPrompt = dependencies.buildSystemPrompt ?? buildSystemPrompt;
  const loadSkills = dependencies.loadPromptOnlySkills ?? loadPromptOnlySkills;
  const runQuery = dependencies.query ?? sdkQuery;

  const skillOptions: { workingDirectory: string; extraDirectories?: string[] } = {
    workingDirectory: request.cwd
  };
  if (request.skillDirectories) {
    skillOptions.extraDirectories = request.skillDirectories;
  }

  const skillPrompts = await loadSkills(skillOptions);

  const promptOptions: {
    workingDirectory: string;
    systemPromptFile?: string;
    skillPrompts: typeof skillPrompts;
  } = {
    workingDirectory: request.cwd,
    skillPrompts
  };
  if (request.systemPromptFile) {
    promptOptions.systemPromptFile = request.systemPromptFile;
  }

  const systemPrompt = await buildPrompt(promptOptions);
  const toolPolicy = getPhase1ToolPolicy(
    request.tools
      ? {
          tools: {
            availableTools: request.tools
          }
        }
      : undefined
  );

  const options: {
    cwd: string;
    model?: string;
    maxTurns: number;
    sessionId: string;
    permissionMode: "bypassPermissions";
    allowDangerouslySkipPermissions: true;
    tools: string[];
    systemPrompt: {
      type: "preset";
      preset: "claude_code";
      append: string;
    };
  } = {
    cwd: request.cwd,
    maxTurns: request.maxTurns ?? 8,
    sessionId: request.sessionId,
    permissionMode: toolPolicy.permissionMode,
    allowDangerouslySkipPermissions: toolPolicy.allowDangerouslySkipPermissions,
    tools: toolPolicy.tools,
    systemPrompt: {
      type: "preset",
      preset: "claude_code",
      append: systemPrompt
    }
  };

  if (request.model) {
    options.model = request.model;
  }

  const stream = runQuery({
    prompt: request.prompt,
    options
  });

  let finalResult: SDKResultSuccess | SDKResultError | null = null;

  for await (const message of stream) {
    if (isSdkResultMessage(message)) {
      finalResult = message;
    }
  }

  if (!finalResult) {
    throw new Error("Claude Agent SDK did not return a final result");
  }

  if (finalResult.subtype !== "success") {
    const reason = finalResult.errors[0] ?? finalResult.subtype;
    throw new Error(`Claude Agent SDK failed: ${reason}`);
  }

  return {
    text: finalResult.result,
    usage: {
      totalCostUsd: finalResult.total_cost_usd,
      turns: finalResult.num_turns
    }
  };
}

function isSdkResultMessage(message: SDKMessage): message is SDKResultSuccess | SDKResultError {
  return message.type === "result";
}
