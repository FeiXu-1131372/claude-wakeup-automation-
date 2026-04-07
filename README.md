# Claude AutoRoller

Run a lightweight Claude prompt from GitHub Actions on a fixed schedule to keep your Claude usage "warm" using OAuth/subscription auth (not API billing auth).

## Current behavior

- Workflow file: `.github/workflows/wakeup.yml`
- Frequency: **4 times daily** at fixed Pacific/Auckland times (no jitter)
- Schedule is managed via `config.json` and applied through the local schedule UI
- Manual runs are enabled via `workflow_dispatch`
- Claude Code CLI is pinned to: `@anthropic-ai/claude-code@2.1.39`

## What the workflow does

The `wakeup` job:
1. Installs Node 18
2. Installs Claude Code CLI `2.1.39`
3. Verifies CLI version
4. Reads secret `CLAUDE_OAUTH_TOKEN`
5. Validates token presence and prefix
6. Writes `~/.claude/.credentials.json` using Node (safe JSON generation)
7. Sets file permission to `600`
8. Selects a random prompt from a pool of 100 (avoiding immediate repeats)
9. Sends the prompt with `claude -p "<prompt>"`

The `keepalive` job:
1. Checks last commit age
2. Creates and pushes an empty commit when inactivity is `>= 50` days (to avoid workflow auto-disable)

## Authentication model

This project uses Claude OAuth token auth (subscription path):

- Secret name: `CLAUDE_OAUTH_TOKEN`
- Expected token shape: starts with `sk-ant-oat01-`
- Credential file generated at runtime: `~/.claude/.credentials.json`

## Setup

1. Run `claude setup-token` locally to create a long-lived OAuth token.
2. In GitHub: `Settings -> Secrets and variables -> Actions`.
3. Add repository secret:
   - Name: `CLAUDE_OAUTH_TOKEN`
   - Value: the full token from step 1
4. Trigger `Claude Wake-Up Automation` manually once from the Actions tab.
5. Verify logs show:
   - Claude CLI version is `2.1.39`
   - `Configure Claude Authentication` completes
   - `Send Wake-Up Message` completes

## Changing the schedule

Use the local schedule UI — double-click `start-scheduler.command` in Finder. This opens a browser UI where you can:

- Set any number of Pacific/Auckland run times
- Preview the UTC conversion and cron expressions live
- Click **Confirm and push** to update `config.json` and `.github/workflows/wakeup.yml` and push to GitHub in one step

The UI reads the current timezone offset for `Pacific/Auckland` at the time you click confirm, so it stays correct across NZST/NZDT transitions.

Alternatively, edit `config.json` and run `npm run update-schedule` from the terminal.

## Local files

| File | Purpose |
|---|---|
| `config.json` | Source of truth for schedule times |
| `schedule-manager.js` | Shared logic: timezone conversion, file updates, git operations |
| `server.js` | Local HTTP server backing the schedule UI |
| `schedule-ui.html` | Browser UI for editing and pushing schedule changes |
| `start-scheduler.command` | macOS double-click launcher |
| `update-schedule.js` | CLI alternative to the UI |
| `test-local-auth.js` | Test Claude auth locally before pushing a new token |

## Troubleshooting

### `CLAUDE_OAUTH_TOKEN is empty or unavailable`
- Secret is missing, misspelled, or inaccessible to this workflow context.
- Confirm exact name: `CLAUDE_OAUTH_TOKEN`.

### `CLAUDE_OAUTH_TOKEN does not look like a Claude OAuth token`
- Secret value is not an OAuth token (wrong key type or malformed value).
- Use `claude setup-token` and replace secret value.

### `Not logged in` / `Please run /login`
- Token is invalid/expired/suspended or has hidden whitespace corruption.
- Rotate token and paste again as a single-line value.

### `Your organization does not have access to Claude`
- Auth token is being read, but account/org entitlement is denied server-side.

### Schedule UI shows "No schedule changes to push"
- The times you submitted match what is already in `config.json` and the workflow. Change at least one time to trigger a commit.

### Port 3456 already in use
- A previous server instance is still running. The launcher auto-kills it on startup, or run: `lsof -nP -iTCP:3456 -sTCP:LISTEN | awk 'NR>1{print $2}' | xargs kill`

## Security notes

- Never commit tokens to the repository.
- Keep auth only in GitHub Secrets.
- Rotate token immediately if exposed.

## Links

- Claude Code IAM docs: https://code.claude.com/docs/en/iam
- Claude Code GitHub Actions docs: https://code.claude.com/docs/en/github-actions
