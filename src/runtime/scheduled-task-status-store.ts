import { z } from "zod";
import { readJson5FileOrDefault, writeJson5File } from "../config/file-store.js";
import { getAppPaths, type AppPaths } from "../config/paths.js";

export const scheduledTaskRunStatusSchema = z.enum([
  "scheduled",
  "running",
  "succeeded",
  "failed",
  "timed_out",
  "skipped"
]);

export const scheduledTaskStatusEntrySchema = z.object({
  scheduledAt: z.iso.datetime().optional(),
  startedAt: z.iso.datetime().optional(),
  finishedAt: z.iso.datetime().optional(),
  status: scheduledTaskRunStatusSchema,
  reason: z.string().optional()
}).strict();

export const scheduledTaskStatusDataSchema = z.object({
  tasks: z.record(z.string(), scheduledTaskStatusEntrySchema).default({})
}).strict();

export type ScheduledTaskRunStatus = z.infer<typeof scheduledTaskRunStatusSchema>;
export type ScheduledTaskStatusEntry = z.infer<typeof scheduledTaskStatusEntrySchema>;
export type ScheduledTaskStatusData = z.infer<typeof scheduledTaskStatusDataSchema>;

const defaultStatusData = (): ScheduledTaskStatusData => ({
  tasks: {}
});

export class ScheduledTaskStatusStore {
  constructor(private readonly paths: AppPaths = getAppPaths()) {}

  async load(): Promise<ScheduledTaskStatusData> {
    const data = await readJson5FileOrDefault<ScheduledTaskStatusData>(
      this.paths.scheduledTaskStatusFile,
      defaultStatusData()
    );
    return scheduledTaskStatusDataSchema.parse(data);
  }

  async get(taskId: string): Promise<ScheduledTaskStatusEntry | undefined> {
    const data = await this.load();
    return data.tasks[taskId];
  }

  async set(taskId: string, entry: ScheduledTaskStatusEntry): Promise<void> {
    const data = await this.load();
    data.tasks[taskId] = scheduledTaskStatusEntrySchema.parse(entry);
    await writeJson5File(this.paths.scheduledTaskStatusFile, data);
  }

  async delete(taskId: string): Promise<void> {
    const data = await this.load();
    delete data.tasks[taskId];
    await writeJson5File(this.paths.scheduledTaskStatusFile, data);
  }
}
