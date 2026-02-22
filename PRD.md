# Product Requirements Document: Claude Auto-Trigger

## 1. Objective

Run a GitHub Actions workflow that sends one lightweight Claude prompt daily using OAuth/subscription authentication.

## 2. Technical Specifications

### 2.1 Environment

- **Platform:** GitHub Actions (`ubuntu-latest`)
- **Node.js:** `18`
- **CLI Version Pin:** `@anthropic-ai/claude-code@2.1.39`

### 2.2 Schedule (CRON)

- **Goal:** Run once per day between **06:00 and 06:59 NZDT**
- **Timezone Math:** NZDT (UTC+13)
  - Base trigger: `06:00 NZDT - 13h = 17:00 UTC` (previous UTC day)
- **Base Cron Expression:** `0 17 * * *`
- **Runtime Jitter:** random delay of `0-59` minutes (plus random seconds)

### 2.3 Authentication Strategy

- **Method:** OAuth token from GitHub secret
- **Secret Name:** `CLAUDE_OAUTH_TOKEN`
- **Expected Token Prefix:** `sk-ant-oat01-`
- **Credential File Path:** `~/.claude/.credentials.json`
- **Credential Schema:** nested `claudeAiOauth` object with `accessToken`, `refreshToken`, `scopes`, and `subscriptionType`

### 2.4 Execution Logic

The workflow performs:
1. Install pinned Claude CLI version.
2. Apply runtime startup jitter (`0-59` minutes).
3. Validate secret exists and token prefix is correct.
4. Create credentials file via Node JSON serialization.
5. Apply `chmod 600` to credentials file.
6. Run `claude -p "<prompt>"` in non-interactive mode.

## 3. Deliverables

- Primary workflow: `.github/workflows/wakeup.yml`
- Documentation: `README.md` and this PRD aligned with implementation

## 4. Implementation Notes

- Keep token handling in GitHub Secrets only.
- Avoid shell `echo` JSON construction for credentials to prevent escaping/newline breakage.
- Keep CLI version pinned to avoid auth behavior drift.
