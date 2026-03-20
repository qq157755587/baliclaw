import { Command } from "commander";
import { runConfigGetCommand, runConfigSetCommand } from "./commands/config.js";
import { runDaemonCommand } from "./commands/daemon.js";
import { runPairingListCommand } from "./commands/pairing.js";
import { runStatusCommand } from "./commands/status.js";

const program = new Command();

program
  .name("baliclaw")
  .description("BaliClaw Phase 1 CLI scaffold")
  .showHelpAfterError();

program
  .command("status")
  .description("Show daemon status")
  .action(async () => {
    console.log(await runStatusCommand());
  });

const configCommand = program
  .command("config")
  .description("Read or update daemon configuration");

configCommand
  .command("get")
  .description("Print the current config")
  .action(async () => {
    console.log(await runConfigGetCommand());
  });

configCommand
  .command("set")
  .description("Set the current config from inline JSON5 or a file")
  .argument("[config]", "inline JSON5 payload")
  .option("-f, --file <path>", "read the config payload from a file")
  .action(async (config: string | undefined, options: { file?: string }) => {
    console.log(await runConfigSetCommand(config, options));
  });

program
  .command("pairing:list")
  .description("List approved pairings")
  .action(async () => {
    console.log(await runPairingListCommand());
  });

const daemonCommand = program
  .command("daemon")
  .description("Daemon process helpers");

daemonCommand
  .command("start")
  .description("Explain how to start the daemon")
  .action(async () => {
    console.log(await runDaemonCommand());
  });

try {
  await program.parseAsync(process.argv);
} catch (error) {
  const message = error instanceof Error ? error.message : "CLI command failed";
  console.error(message);
  process.exitCode = 1;
}
