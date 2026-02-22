# Claude AutoRoller

Run a lightweight Claude prompt from GitHub Actions on a fixed schedule to keep your Claude usage "warm" using OAuth/subscription auth (not API billing auth).

## Current behavior (as implemented)

- Workflow file: `.github/workflows/wakeup.yml`
- Frequency: **once daily**
- Base cron: `0 17 * * *` (06:00 NZDT, 17:00 UTC previous day)
- Runtime jitter: random `0-59` minutes (`+ random seconds`)
- Effective daily run window: **06:00-06:59 NZDT**
- Manual runs are enabled via `workflow_dispatch`
- Claude Code CLI is pinned to: `@anthropic-ai/claude-code@2.1.39`

## What the workflow does

The `wakeup` job:
1. Installs Node 18
2. Installs Claude Code CLI `2.1.39`
3. Verifies CLI version
4. Waits a random startup delay (`0-59` minutes, plus random seconds)
5. Reads secret `CLAUDE_OAUTH_TOKEN`
6. Validates token presence and prefix (`sk-ant-oat01-`)
7. Writes `~/.claude/.credentials.json` using Node (safe JSON generation)
8. Sets file permission to `600`
9. Sends one prompt with `claude -p "<prompt>"`

The `keepalive` job:
1. Checks last commit age
2. Creates and pushes an empty commit when inactivity is `>= 50` days (to avoid workflow auto-disable)

## Authentication model

This project uses Claude OAuth token auth (subscription path):

- Secret name: `CLAUDE_OAUTH_TOKEN`
- Expected token shape: starts with `sk-ant-oat01-`
- Credential file generated at runtime: `~/.claude/.credentials.json`

Credential shape written by workflow:

```json
{
  "claudeAiOauth": {
    "accessToken": "sk-ant-oat01-...",
    "refreshToken": "sk-ant-oat01-...",
    "scopes": ["user:inference", "user:profile"],
    "subscriptionType": "pro"
  }
}
```

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

## Change frequency or time

Edit `.github/workflows/wakeup.yml`:

```yaml
on:
  schedule:
    - cron: '0 17 * * *'
```

Cron is UTC and acts as the base trigger. Current mapping:
- `0 17 * * *` = 17:00 UTC = 06:00 NZDT (next local day when UTC+13)
- Workflow then applies a random delay up to 59 minutes, so execution occurs between 06:00 and 06:59 NZDT.

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

## Security notes

- Never commit tokens to the repository.
- Keep auth only in GitHub Secrets.
- Rotate token immediately if exposed.

## Links

- Claude Code IAM docs: https://code.claude.com/docs/en/iam
- Claude Code GitHub Actions docs: https://code.claude.com/docs/en/github-actions
- Claude Code issue #8938: https://github.com/anthropics/claude-code/issues/8938
