import type { PairingService } from "../../auth/pairing-service.js";
import type { PairingRequest } from "../../shared/types.js";

export async function handlePairingList(pairingService: PairingService): Promise<PairingRequest[]> {
  return pairingService.listPendingRequests();
}

export async function handlePairingApprove(pairingService: PairingService, code: string): Promise<PairingRequest> {
  return pairingService.approve(code);
}
