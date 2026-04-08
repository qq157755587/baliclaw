import type { ScheduledTaskDefinitionConfig } from "../../config/scheduled-task-config.js";
import { ScheduledTaskManager } from "../../daemon/scheduled-task-manager.js";
import type { ScheduledTaskStatusEntry } from "../../runtime/scheduled-task-status-store.js";

export async function handleScheduledTaskList(
  manager: Pick<ScheduledTaskManager, "listTasks">
): Promise<Record<string, ScheduledTaskDefinitionConfig>> {
  return await manager.listTasks();
}

export async function handleScheduledTaskCreate(
  manager: Pick<ScheduledTaskManager, "createTask">,
  taskId: string,
  task: ScheduledTaskDefinitionConfig,
  reloadConfig?: () => Promise<object>
): Promise<ScheduledTaskDefinitionConfig> {
  const created = await manager.createTask(taskId, task);
  if (reloadConfig) {
    await reloadConfig();
  }
  return created;
}

export async function handleScheduledTaskUpdate(
  manager: Pick<ScheduledTaskManager, "updateTask">,
  taskId: string,
  task: ScheduledTaskDefinitionConfig,
  reloadConfig?: () => Promise<object>
): Promise<ScheduledTaskDefinitionConfig> {
  const updated = await manager.updateTask(taskId, task);
  if (reloadConfig) {
    await reloadConfig();
  }
  return updated;
}

export async function handleScheduledTaskDelete(
  manager: Pick<ScheduledTaskManager, "deleteTask">,
  taskId: string,
  reloadConfig?: () => Promise<object>
): Promise<boolean> {
  const deleted = await manager.deleteTask(taskId);
  if (deleted && reloadConfig) {
    await reloadConfig();
  }
  return deleted;
}

export async function handleScheduledTaskStatus(
  manager: Pick<ScheduledTaskManager, "getTaskStatus">,
  taskId: string
): Promise<ScheduledTaskStatusEntry | undefined> {
  return await manager.getTaskStatus(taskId);
}
