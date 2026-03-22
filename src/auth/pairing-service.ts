import { randomInt } from "node:crypto";
import type { PairingRequest } from "../shared/types.js";
import { PairingStore } from "./pairing-store.js";

const pairingCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const pairingCodeLength = 8;
const pairingTtlMs = 60 * 60 * 1000;
const maxPendingRequests = 3;

export interface CreatePairingRequestInput {
  senderId: string;
  username?: string;
  now?: Date;
}

export class PairingService {
  constructor(private readonly store = new PairingStore()) {}

  async listApprovedSenders(): Promise<string[]> {
    const data = await this.store.loadAllowlist();
    return data.approvedSenderIds;
  }

  async isApprovedSender(senderId: string): Promise<boolean> {
    const data = await this.store.loadAllowlist();
    return data.approvedSenderIds.includes(senderId);
  }

  async getOrCreatePendingRequest(input: CreatePairingRequestInput): Promise<PairingRequest> {
    const now = input.now ?? new Date();
    const pending = await this.store.loadPendingRequests();
    const activeRequests = pruneExpiredRequests(pending.requests, now);
    const existing = activeRequests.find((request) => request.senderId === input.senderId);

    if (existing) {
      if (activeRequests.length !== pending.requests.length) {
        await this.store.savePendingRequests({ requests: activeRequests });
      }

      return existing;
    }

    if (activeRequests.length >= maxPendingRequests) {
      throw new Error("Maximum pending pairing requests reached");
    }

    const request = createPairingRequest(input.senderId, input.username, now, activeRequests);
    activeRequests.push(request);
    await this.store.savePendingRequests({ requests: activeRequests });
    return request;
  }

  async approve(code: string, now = new Date()): Promise<PairingRequest> {
    const normalizedCode = code.trim().toUpperCase();
    const pending = await this.store.loadPendingRequests();
    const allowlist = await this.store.loadAllowlist();
    const activeRequests = pruneExpiredRequests(pending.requests, now);
    const approved = activeRequests.find((request) => request.code === normalizedCode);

    if (!approved) {
      if (activeRequests.length !== pending.requests.length) {
        await this.store.savePendingRequests({ requests: activeRequests });
      }

      throw new Error("Pairing code is invalid or expired");
    }

    const remainingRequests = activeRequests.filter((request) => request.code !== normalizedCode);
    const approvedSenderIds = allowlist.approvedSenderIds.includes(approved.senderId)
      ? allowlist.approvedSenderIds
      : [...allowlist.approvedSenderIds, approved.senderId];

    await this.store.saveAllowlist({ approvedSenderIds });
    await this.store.savePendingRequests({ requests: remainingRequests });
    return approved;
  }

  async pruneExpiredRequests(now = new Date()): Promise<void> {
    const pending = await this.store.loadPendingRequests();
    const activeRequests = pruneExpiredRequests(pending.requests, now);

    if (activeRequests.length !== pending.requests.length) {
      await this.store.savePendingRequests({ requests: activeRequests });
    }
  }
}

function createPairingRequest(
  senderId: string,
  username: string | undefined,
  now: Date,
  existingRequests: PairingRequest[]
): PairingRequest {
  const request: PairingRequest = {
    code: generateUniquePairingCode(existingRequests),
    senderId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + pairingTtlMs).toISOString()
  };

  if (username) {
    request.username = username;
  }

  return request;
}

function generateUniquePairingCode(existingRequests: PairingRequest[]): string {
  const existingCodes = new Set(existingRequests.map((request) => request.code));

  while (true) {
    const code = Array.from({ length: pairingCodeLength }, () =>
      pairingCodeAlphabet[randomInt(0, pairingCodeAlphabet.length)]
    ).join("");

    if (!existingCodes.has(code)) {
      return code;
    }
  }
}

function pruneExpiredRequests(requests: PairingRequest[], now: Date): PairingRequest[] {
  return requests.filter((request) => new Date(request.expiresAt).getTime() > now.getTime());
}
