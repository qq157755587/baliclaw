import { bootstrap } from "./bootstrap.js";
import { getLogger } from "../shared/logger.js";

const logger = getLogger("daemon");

export async function runDaemon(): Promise<void> {
  const context = bootstrap();
  const config = await context.configService.load();
  logger.info({ cwd: config.runtime.workingDirectory }, "daemon bootstrapped");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void runDaemon();
}
