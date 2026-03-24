import type { AppStatus } from "../../shared/types.js";

export async function handleStatus(
  getStatus: () => Promise<AppStatus> | AppStatus
): Promise<AppStatus> {
  return await getStatus();
}
