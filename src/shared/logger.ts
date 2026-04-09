import pino, { type DestinationStream, type Logger, type LoggerOptions } from "pino";

export const appSubsystems = [
  "daemon",
  "ipc",
  "config",
  "scheduled-tasks",
  "telegram",
  "wechat",
  "lark",
  "pairing",
  "session",
  "agent",
  "skills"
] as const;

export type AppSubsystem = (typeof appSubsystems)[number];
export type LogLevel = "debug" | "info" | "warn" | "error";

const redactedPaths = [
  "botToken",
  "*.botToken",
  "apiKey",
  "*.apiKey",
  "apiKeys",
  "*.apiKeys",
  "token",
  "*.token",
  "authorization",
  "*.authorization",
  "headers.authorization"
] as const;

export interface CreateLoggerOptions {
  subsystem?: AppSubsystem;
  level?: LogLevel;
  destination?: DestinationStream;
}

export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const loggerOptions: LoggerOptions = {
    name: "baliclaw",
    level: options.level ?? "info",
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [...redactedPaths],
      censor: "[REDACTED]"
    },
    base: options.subsystem
      ? {
          service: "baliclaw",
          subsystem: options.subsystem
        }
      : {
          service: "baliclaw"
        }
  };

  return pino(loggerOptions, options.destination);
}

const rootLogger = createLogger();

export const logger = rootLogger;

export function getLogger(subsystem: AppSubsystem, options: Omit<CreateLoggerOptions, "subsystem"> = {}): Logger {
  return createLogger({
    ...options,
    subsystem
  });
}
