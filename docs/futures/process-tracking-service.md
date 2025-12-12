# Process Tracking Service

Status: intake
Created: 2025-12-11
Last Updated: 2025-12-11

## The Idea

A service that tracks running hyperyolo processes across your system, making them visible and manageable from anywhere. Could manifest as:
- Desktop widget showing active tasks
- Menu bar app with status indicators
- Push notifications for task completion/errors
- Web dashboard
- CLI command to list running processes

## Why

When running autonomous AI tasks, especially long-running ones, you lose visibility once the terminal is backgrounded or you switch contexts. Questions like:
- "Is that task still running?"
- "Did it finish while I was away?"
- "How many tasks do I have going?"

Currently require hunting through terminals or process lists.

## Open Questions

- [ ] How would processes register with the tracking service?
- [ ] Should this be a daemon, a file-based approach, or something else?
- [ ] What metadata should be tracked? (backend, prompt, start time, status, output location?)
- [ ] How to handle crashed/orphaned processes?
- [ ] Platform considerations—macOS widgets vs. cross-platform approaches?
- [ ] Push notifications: native OS, Slack/Discord, email?
- [ ] Should this live in hyperyolo or be a separate companion tool?

## Notes

Could start simple:
- Write process info to a known location on start
- Clean up on exit
- Separate tool reads that location and displays status

More sophisticated:
- Actual daemon with IPC
- Real-time streaming of task progress
- Historical log of completed tasks

Desktop widget idea is compelling for personal use—always visible, low friction.

## Related

- Session management (`src/core/session-store.ts`) - already tracks session mappings
- Could share infrastructure with session persistence
