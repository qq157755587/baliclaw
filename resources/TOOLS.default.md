# TOOLS.md - BaliClaw Operations Manual

This file describes BaliClaw-specific commands and control-plane operations that are safe and expected to use from this workspace.

Use this file as the practical operating manual for BaliClaw itself.

## Core Rule

- Prefer BaliClaw's daemon-managed control plane over direct edits to config, pairing, or scheduled task state files.
- Do not edit BaliClaw state files directly when an equivalent CLI / IPC operation exists.

## General CLI Entry Points

- Use the installed `baliclaw` CLI for operational changes.
- Prefer the CLI over hand-editing JSON5 state.

Common examples:

- `baliclaw status`
- `baliclaw config get`
- `baliclaw config set runtime.model '"claude-sonnet"'`
- `baliclaw pairing list`
- `baliclaw scheduled-tasks list`

## Config Management

Use CLI / IPC for config changes instead of editing `~/.baliclaw/baliclaw.json5` directly.

Useful commands:

- `baliclaw config get`
- `baliclaw config get <json-path>`
- `baliclaw config set <json-path> <json5-value>`

Examples:

- `baliclaw config get runtime`
- `baliclaw config set runtime.model '"claude-opus"'`
- `baliclaw config set logging.level '"debug"'`

## Pairing Management

Use pairing commands for allowlist workflows instead of editing pairing files directly.

Useful commands:

- `baliclaw pairing list`
- `baliclaw pairing pending`
- `baliclaw pairing approve <senderId>`
- `baliclaw pairing revoke <senderId>`

## Scheduled Task Management

Manage scheduled tasks through the scheduled task control plane. Do not edit scheduled task config files directly.

Useful commands:

- `baliclaw scheduled-tasks list`
- `baliclaw scheduled-tasks status <taskId>`
- `baliclaw scheduled-tasks create <taskId> '<task-json5>'`
- `baliclaw scheduled-tasks update <taskId> '<task-json5>'`
- `baliclaw scheduled-tasks delete <taskId>`

### Scheduled Task JSON5 Shape

A scheduled task definition is a JSON5 object with:

- `schedule`
- `prompt`
- `telegram.conversationId`
- `timeoutMinutes`

Supported schedule shapes:

- `{ kind: 'everyHours', intervalHours: <positive integer> }`
- `{ kind: 'daily', time: 'HH:mm' }`
- `{ kind: 'weekly', days: ['mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun', ...], time: 'HH:mm' }`

### Scheduled Task Operating Rules

- When the user asks to create or update a scheduled task, infer a stable `taskId` when needed and then use the scheduled task CLI/control plane.
- Unless the user explicitly asks for another Telegram target, use the current conversationId from interaction context as `telegram.conversationId`.
- If the user explicitly mentions another timezone, convert that requested time into the daemon machine's local timezone before writing the task schedule.
- If the user does not specify a timeout, set `timeoutMinutes: 30`.
- After creating or updating a task, report the final applied task details clearly.

## Notes

- BaliClaw scheduled tasks run as fresh Claude sessions.
- Scheduled task schedule times are stored and executed in the daemon machine's local timezone.
- Use existing project files for implementation details, but use BaliClaw CLI / IPC for BaliClaw state mutations whenever possible.
