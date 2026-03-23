import { describe, expect, it, vi } from "vitest";
import {
  runPairingApproveCommand,
  runPairingListCommand
} from "../src/cli/commands/pairing.js";

const pendingRequest = {
  code: "ABCD2345",
  senderId: "42",
  username: "alice",
  createdAt: "2026-03-23T09:00:00.000Z",
  expiresAt: "2026-03-23T10:00:00.000Z"
} as const;

describe("CLI pairing commands", () => {
  it("lists pending pairing requests through IPC", async () => {
    const client = {
      listPairingRequests: vi.fn().mockResolvedValue([pendingRequest])
    } as never;

    await expect(runPairingListCommand("telegram", client)).resolves.toBe(
      JSON.stringify([pendingRequest], null, 2)
    );
    expect(client.listPairingRequests).toHaveBeenCalledWith("telegram");
  });

  it("approves a pairing code through IPC", async () => {
    const client = {
      approvePairingCode: vi.fn().mockResolvedValue(pendingRequest)
    } as never;

    await expect(runPairingApproveCommand("telegram", "ABCD2345", client)).resolves.toBe(
      JSON.stringify(pendingRequest, null, 2)
    );
    expect(client.approvePairingCode).toHaveBeenCalledWith("telegram", "ABCD2345");
  });

  it("rejects unsupported pairing channels before calling IPC", async () => {
    const client = {
      listPairingRequests: vi.fn()
    } as never;

    await expect(runPairingListCommand("slack", client)).rejects.toThrow(
      "Unsupported pairing channel: slack"
    );
    expect(client.listPairingRequests).not.toHaveBeenCalled();
  });
});
