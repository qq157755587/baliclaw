import { z } from "zod";
import { appConfigSchema } from "../config/schema.js";
import {
  scheduledTaskDefinitionSchema,
  scheduledTaskFileSchema
} from "../config/scheduled-task-config.js";
import { scheduledTaskStatusEntrySchema } from "../runtime/scheduled-task-status-store.js";

const pairingChannelSchema = z.string().trim().min(1);
const channelLoginChannelSchema = z.string().trim().min(1);
const larkDomainSchema = z.enum(["feishu", "lark"]);

export const pairingRequestSchema = z.object({
  channel: z.string(),
  accountId: z.string(),
  code: z.string(),
  principalKey: z.string(),
  username: z.string().optional(),
  createdAt: z.string(),
  expiresAt: z.string()
});

export const pingResponseSchema = z.object({
  ok: z.literal(true)
});

export const statusResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal("baliclaw"),
  version: z.string()
});

export const configResponseSchema = appConfigSchema;

export const scheduledTaskListResponseSchema = z.object({
  tasks: z.record(z.string(), scheduledTaskDefinitionSchema)
});

export const scheduledTaskCreateRequestSchema = z.object({
  taskId: z.string().trim().min(1),
  task: scheduledTaskDefinitionSchema
});

export const scheduledTaskCreateResponseSchema = z.object({
  taskId: z.string(),
  task: scheduledTaskDefinitionSchema
});

export const scheduledTaskUpdateRequestSchema = scheduledTaskCreateRequestSchema;

export const scheduledTaskUpdateResponseSchema = scheduledTaskCreateResponseSchema;

export const scheduledTaskDeleteRequestSchema = z.object({
  taskId: z.string().trim().min(1)
});

export const scheduledTaskDeleteResponseSchema = z.object({
  taskId: z.string(),
  deleted: z.boolean()
});

export const scheduledTaskStatusResponseSchema = z.object({
  taskId: z.string(),
  status: scheduledTaskStatusEntrySchema.optional()
});

export const pairingListResponseSchema = z.object({
  channel: pairingChannelSchema,
  requests: z.array(pairingRequestSchema)
});

const wechatChannelLoginStartRequestSchema = z.object({
  channel: z.literal("wechat"),
  force: z.boolean().optional()
});

const larkChannelLoginStartRequestSchema = z.object({
  channel: z.literal("lark"),
  force: z.boolean().optional(),
  mode: z.enum(["new", "existing"]),
  domain: larkDomainSchema.optional(),
  appId: z.string().trim().optional(),
  appSecret: z.string().trim().optional()
}).superRefine((input, context) => {
  if (input.mode !== "existing") {
    return;
  }

  if (!input.domain) {
    context.addIssue({
      code: "custom",
      message: "domain is required when starting an existing lark login",
      path: ["domain"]
    });
  }
  if (!input.appId) {
    context.addIssue({
      code: "custom",
      message: "appId is required when starting an existing lark login",
      path: ["appId"]
    });
  }
  if (!input.appSecret) {
    context.addIssue({
      code: "custom",
      message: "appSecret is required when starting an existing lark login",
      path: ["appSecret"]
    });
  }
});

export const channelLoginStartRequestSchema = z.union([
  wechatChannelLoginStartRequestSchema,
  larkChannelLoginStartRequestSchema,
  z.object({
    channel: channelLoginChannelSchema.refine(
      (channel) => channel !== "wechat" && channel !== "lark",
      "Use the channel-specific login request shape for this channel"
    ),
    force: z.boolean().optional()
  })
]);

export const channelLoginStartResponseSchema = z.object({
  channel: channelLoginChannelSchema,
  sessionKey: z.string(),
  qrDataUrl: z.string().optional(),
  message: z.string()
});

export const channelLoginWaitRequestSchema = z.object({
  channel: channelLoginChannelSchema,
  sessionKey: z.string().trim().min(1),
  timeoutMs: z.number().int().positive().optional()
});

export const channelLoginWaitResponseSchema = z.object({
  channel: channelLoginChannelSchema,
  connected: z.boolean(),
  message: z.string()
});

export const pairingApproveRequestSchema = z.object({
  channel: pairingChannelSchema,
  code: z.string().trim().min(1)
});

export const pairingApproveResponseSchema = z.object({
  channel: pairingChannelSchema,
  approved: pairingRequestSchema
});

export const ipcErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string()
  })
});

export type PingResponse = z.infer<typeof pingResponseSchema>;
export type StatusResponse = z.infer<typeof statusResponseSchema>;
export type ConfigResponse = z.infer<typeof configResponseSchema>;
export type ScheduledTaskListResponse = z.infer<typeof scheduledTaskListResponseSchema>;
export type ScheduledTaskCreateRequest = z.infer<typeof scheduledTaskCreateRequestSchema>;
export type ScheduledTaskCreateResponse = z.infer<typeof scheduledTaskCreateResponseSchema>;
export type ScheduledTaskUpdateRequest = z.infer<typeof scheduledTaskUpdateRequestSchema>;
export type ScheduledTaskUpdateResponse = z.infer<typeof scheduledTaskUpdateResponseSchema>;
export type ScheduledTaskDeleteRequest = z.infer<typeof scheduledTaskDeleteRequestSchema>;
export type ScheduledTaskDeleteResponse = z.infer<typeof scheduledTaskDeleteResponseSchema>;
export type ScheduledTaskStatusResponse = z.infer<typeof scheduledTaskStatusResponseSchema>;
export type PairingListResponse = z.infer<typeof pairingListResponseSchema>;
export type ChannelLoginStartRequest = z.infer<typeof channelLoginStartRequestSchema>;
export type ChannelLoginStartResponse = z.infer<typeof channelLoginStartResponseSchema>;
export type ChannelLoginWaitRequest = z.infer<typeof channelLoginWaitRequestSchema>;
export type ChannelLoginWaitResponse = z.infer<typeof channelLoginWaitResponseSchema>;
export type PairingApproveRequest = z.infer<typeof pairingApproveRequestSchema>;
export type PairingApproveResponse = z.infer<typeof pairingApproveResponseSchema>;
export type IpcErrorResponse = z.infer<typeof ipcErrorResponseSchema>;
