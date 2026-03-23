import { z } from "zod";
import { appConfigSchema } from "../config/schema.js";

const pairingChannelSchema = z.literal("telegram");

export const pairingRequestSchema = z.object({
  code: z.string(),
  senderId: z.string(),
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

export const pairingListResponseSchema = z.object({
  channel: pairingChannelSchema,
  requests: z.array(pairingRequestSchema)
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
export type PairingListResponse = z.infer<typeof pairingListResponseSchema>;
export type PairingApproveRequest = z.infer<typeof pairingApproveRequestSchema>;
export type PairingApproveResponse = z.infer<typeof pairingApproveResponseSchema>;
export type IpcErrorResponse = z.infer<typeof ipcErrorResponseSchema>;
