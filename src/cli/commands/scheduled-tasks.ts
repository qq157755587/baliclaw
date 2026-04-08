import { readFile } from "node:fs/promises";
import JSON5 from "json5";
import { createCliClient } from "../client.js";
import type { ScheduledTaskDefinitionConfig } from "../../config/scheduled-task-config.js";
import { scheduledTaskDefinitionSchema } from "../../config/scheduled-task-config.js";
import type { IpcClient } from "../../ipc/client.js";

export async function runScheduledTaskListCommand(
  client: IpcClient = createCliClient()
): Promise<string> {
  const tasks = await client.listScheduledTasks();
  return JSON.stringify(tasks, null, 2);
}

export async function runScheduledTaskStatusCommand(
  taskId: string,
  client: IpcClient = createCliClient()
): Promise<string> {
  const status = await client.getScheduledTaskStatus(taskId);
  return JSON.stringify({
    taskId,
    status
  }, null, 2);
}

export async function runScheduledTaskCreateCommand(
  taskId: string,
  rawTask: string | undefined,
  options: { file?: string } = {},
  client: IpcClient = createCliClient()
): Promise<string> {
  const task = await parseScheduledTaskInput(rawTask, options);
  const created = await client.createScheduledTask(taskId, task);
  return JSON.stringify({
    taskId,
    task: created
  }, null, 2);
}

export async function runScheduledTaskUpdateCommand(
  taskId: string,
  rawTask: string | undefined,
  options: { file?: string } = {},
  client: IpcClient = createCliClient()
): Promise<string> {
  const task = await parseScheduledTaskInput(rawTask, options);
  const updated = await client.updateScheduledTask(taskId, task);
  return JSON.stringify({
    taskId,
    task: updated
  }, null, 2);
}

export async function runScheduledTaskDeleteCommand(
  taskId: string,
  client: IpcClient = createCliClient()
): Promise<string> {
  const deleted = await client.deleteScheduledTask(taskId);
  return JSON.stringify({
    taskId,
    deleted
  }, null, 2);
}

async function parseScheduledTaskInput(
  rawTask: string | undefined,
  options: { file?: string }
): Promise<ScheduledTaskDefinitionConfig> {
  const raw = options.file
    ? await readFile(options.file, "utf8")
    : rawTask;

  if (!raw) {
    throw new Error("Provide scheduled task JSON5 inline or with --file <path>.");
  }

  return scheduledTaskDefinitionSchema.parse(JSON5.parse(raw));
}
