import { z } from "zod";

export const defaultAvailableTools = ["Bash", "Read", "Write", "Edit"] as const;

const telegramConfigSchema = z.object({
  enabled: z.boolean().default(false),
  botToken: z.string().default("")
}).strict();

const channelsConfigSchema = z.object({
  telegram: withObjectDefaults(telegramConfigSchema)
}).strict();

const runtimeConfigSchema = z.object({
  model: z.string().optional(),
  maxTurns: z.number().int().positive().optional(),
  workingDirectory: z.string().default(process.cwd()),
  systemPromptFile: z.string().optional()
}).strict();

const toolsConfigSchema = z.object({
  availableTools: z.array(z.string()).default([...defaultAvailableTools])
}).strict();

const skillsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  directories: z.array(z.string()).default([])
}).strict();

const loggingConfigSchema = z.object({
  level: z.enum(["debug", "info", "warn", "error"]).default("info")
}).strict();

function withObjectDefaults<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => value ?? {}, schema);
}

export const appConfigSchema = z.object({
  channels: withObjectDefaults(channelsConfigSchema),
  runtime: withObjectDefaults(runtimeConfigSchema),
  tools: withObjectDefaults(toolsConfigSchema),
  skills: withObjectDefaults(skillsConfigSchema),
  logging: withObjectDefaults(loggingConfigSchema)
}).strict().superRefine((config, context) => {
  if (config.channels.telegram.enabled && config.channels.telegram.botToken.trim().length === 0) {
    context.addIssue({
      code: "custom",
      message: "channels.telegram.botToken is required when channels.telegram.enabled is true",
      path: ["channels", "telegram", "botToken"]
    });
  }
});

export type AppConfig = z.infer<typeof appConfigSchema>;

export function getDefaultConfig(): AppConfig {
  return appConfigSchema.parse({});
}
