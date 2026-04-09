#!/usr/bin/env node

import { Command } from "commander";
import { runChannelLoginCommand } from "./commands/channels.js";
import { runConfigGetCommand, runConfigSetCommand } from "./commands/config.js";
import { runDaemonCommand } from "./commands/daemon.js";
import { runPairingApproveCommand, runPairingListCommand } from "./commands/pairing.js";
import {
  runScheduledTaskCreateCommand,
  runScheduledTaskDeleteCommand,
  runScheduledTaskListCommand,
  runScheduledTaskStatusCommand,
  runScheduledTaskUpdateCommand
} from "./commands/scheduled-tasks.js";
import { runStatusCommand } from "./commands/status.js";
import { runTuiCommand } from "./commands/tui.js";

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


program
  .command("tui")
  .description("Run a local terminal chat interface")
  .action(async () => {
    await runTuiCommand();
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
  .description("Set the current config from inline JSON5, a file, or a single config path")
  .argument("[config]", "inline JSON5 payload or value when used with --path")
  .option("-f, --file <path>", "read the config payload from a file")
  .option("-p, --path <config.path>", "update a single config path, for example channels.telegram.botToken")
  .action(async (config: string | undefined, options: { file?: string; path?: string }) => {
    console.log(await runConfigSetCommand(config, options));
  });

const pairingCommand = program
  .command("pairing")
  .description("Pairing request operations");

pairingCommand
  .command("list")
  .description("List pending pairing requests for a channel")
  .argument("<channel>", "pairing channel, for example telegram")
  .action(async (channel: string) => {
    console.log(await runPairingListCommand(channel));
  });

pairingCommand
  .command("approve")
  .description("Approve a pairing code for a channel")
  .argument("<channel>", "pairing channel, for example telegram")
  .argument("<code>", "pairing code to approve")
  .action(async (channel: string, code: string) => {
    console.log(await runPairingApproveCommand(channel, code));
  });

const channelsCommand = program
  .command("channels")
  .description("Generic channel control-plane operations");

channelsCommand
  .command("login")
  .description("Start a channel login flow")
  .requiredOption("--channel <channel>", "channel id, for example wechat")
  .option("--timeoutMs <timeoutMs>", "how long to wait for the login confirmation in milliseconds")
  .option("--verbose", "include extra local output")
  .action(async (options: { channel: string; timeoutMs?: string; verbose?: boolean }) => {
    const timeoutMs = options.timeoutMs ? Number.parseInt(options.timeoutMs, 10) : undefined;
    console.log(await runChannelLoginCommand(options.channel, {
      ...(Number.isFinite(timeoutMs) ? { timeoutMs } : {}),
      ...(options.verbose !== undefined ? { verbose: options.verbose } : {}),
      onProgressOutput: (text: string) => {
        console.log(text);
      }
    }));
  });

const scheduledTasksCommand = program
  .command("scheduled-tasks")
  .description("Manage scheduled tasks through the daemon control plane");

scheduledTasksCommand
  .command("list")
  .description("List scheduled tasks")
  .action(async () => {
    console.log(await runScheduledTaskListCommand());
  });

scheduledTasksCommand
  .command("status")
  .description("Show the latest status for one scheduled task")
  .argument("<taskId>", "scheduled task id")
  .action(async (taskId: string) => {
    console.log(await runScheduledTaskStatusCommand(taskId));
  });

scheduledTasksCommand
  .command("create")
  .description("Create a scheduled task from inline JSON5 or a file")
  .argument("<taskId>", "scheduled task id")
  .argument("[task]", "inline JSON5 task payload")
  .option("-f, --file <path>", "read the task payload from a file")
  .action(async (taskId: string, task: string | undefined, options: { file?: string }) => {
    console.log(await runScheduledTaskCreateCommand(taskId, task, options));
  });

scheduledTasksCommand
  .command("update")
  .description("Update a scheduled task from inline JSON5 or a file")
  .argument("<taskId>", "scheduled task id")
  .argument("[task]", "inline JSON5 task payload")
  .option("-f, --file <path>", "read the task payload from a file")
  .action(async (taskId: string, task: string | undefined, options: { file?: string }) => {
    console.log(await runScheduledTaskUpdateCommand(taskId, task, options));
  });

scheduledTasksCommand
  .command("delete")
  .description("Delete a scheduled task")
  .argument("<taskId>", "scheduled task id")
  .action(async (taskId: string) => {
    console.log(await runScheduledTaskDeleteCommand(taskId));
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
