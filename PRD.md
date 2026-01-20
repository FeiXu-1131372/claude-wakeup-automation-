# Product Requirements Document: Claude Auto-Trigger

## 1. Objective
Create a GitHub Actions workflow that automatically interacts with the Anthropic Claude CLI once per day to reset the user's rolling usage window.

## 2. Technical Specifications

### 2.1 Environment
* **Platform:** GitHub Actions (Ubuntu Latest).
* **Tooling:** Node.js (v18+), `@anthropic-ai/claude-code` (Global Install).

### 2.2 Schedule (CRON)
* **Goal:** Run at 06:00 AM Local Time.
* **Timezone Math:** * User Location: New Zealand (NZDT).
    * Offset: UTC+13.
    * Target UTC: 06:00 - 13 hours = **17:00 UTC** (Previous Day).
* **Cron Expression:** `0 17 * * *`

### 2.3 Authentication Strategy
* **Method:** Session Cookie Injection.
* **Security:** The user will provide their local session JSON as a GitHub Secret.
* **Secret Name:** `CLAUDE_CREDENTIALS`
* **File Path:** The workflow must write this secret to `~/.claude/claude_code_credentials.json` before running the CLI.

### 2.4 Execution Logic
The workflow must perform these steps in order:
1.  **Install:** `npm install -g @anthropic-ai/claude-code`
2.  **Auth:** `mkdir -p ~/.claude && echo "${{ secrets.CLAUDE_CREDENTIALS }}" > ~/.claude/claude_code_credentials.json`
3.  **Run:** `claude -p "System check. Reset usage window."`
    * Flag `-p` is critical: It runs in non-interactive mode (print and exit).

## 3. Deliverables
* A single file at: `.github/workflows/wakeup.yml`

## 4. Implementation Notes for Agent
* Do not create any Python or JS scripts. This is a pure YAML workflow.
* Ensure the `chmod 600` permission is applied to the credentials file to avoid CLI warnings.
* Verify the node version is set to 18 or higher.