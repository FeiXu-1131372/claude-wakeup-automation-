# Claude AutoRoller - Auto-Refresh Your Claude Pro Quota

Automatically trigger your Claude Pro subscription's 5-hour rolling usage window reset by sending scheduled messages to Claude via GitHub Actions.

## The Problem

Claude Pro subscribers have a **5-hour rolling usage window** with a cap on how many messages you can send. If you don't use Claude for 5+ hours, your quota "goes cold" and resets. But if you use it frequently, you may hit the cap and have to wait.

By sending a small message every 5 hours, you can **keep your usage window warm** and maintain maximum quota availability.

### Example Timeline

| Time | Event | Result |
|------|-------|--------|
| 6:00 AM | Automated "wake-up" message sent | 5-hour window starts |
| 9:00 AM | You start working | Window already 3 hours in |
| 10:30 AM | You hit usage limit | Only 30 min wait until reset |
| 11:00 AM | Window resets (5h after 6 AM) | Fresh quota available |

Without this automation, if you started at 9:00 AM and hit the limit at 10:30 AM, you'd wait until 2:00 PM for a reset.

## How This Works

This GitHub Actions workflow:
1. Runs automatically every 5 hours at your specified time
2. Sends a meaningful prompt to Claude using your OAuth credentials
3. Triggers your subscription-based usage (not API billing)
4. Keeps your 5-hour rolling window active

**Key difference:** This uses **OAuth/subscription authentication**, NOT API keys. API keys use API billing, while OAuth tokens use your Claude Pro subscription.

---

## Prerequisites

- A **Claude Pro subscription**
- A **GitHub account**
- Your **Claude OAuth token** (starts with `sk-ant-oat01-`)

---

## Step-by-Step Setup

### Step 1: Get Your Claude OAuth Token

Open a terminal and run:

```bash
claude setup-token
```

This will:
1. Open a browser window for authentication
2. Display your OAuth token (starts with `sk-ant-oat01-`)
3. **Copy this token** - you'll need it for the next step

> **Note:** This OAuth token is for CLI/subscription usage. It's different from API keys (which start with `sk-ant-api03-`).

### Step 2: Fork or Copy This Repository

**Option A: Use this template**
1. Click "Use this template" on GitHub
2. Create a new repository in your account

**Option B: Fork the repository**
1. Click "Fork" at the top right
2. Select your GitHub account

### Step 3: Add Your OAuth Token as a GitHub Secret

1. Go to your new repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `CLAUDE_OAUTH_TOKEN`
5. Value: Paste your OAuth token from Step 1
6. Click **Add secret**

### Step 4: Customize the Schedule (Optional)

By default, the workflow runs at 5:30 AM NZDT. To change this:

1. Open `.github/workflows/wakeup.yml`
2. Find the `cron` line:
   ```yaml
   - cron: '30 16 * * *'  # 5:30 AM NZDT (UTC+13) = 16:30 UTC
   ```
3. Calculate your time in UTC:
   - **New Zealand (NZDT, UTC+13)**: 5:30 AM = `30 16 * * *`
   - **New York (EST, UTC-5)**: 5:30 AM = `30 10 * * *`
   - **London (GMT, UTC+0)**: 5:30 AM = `30 5 * * *`
   - **Tokyo (JST, UTC+9)**: 5:30 AM = `30 20 * * *`
4. Update the cron format: `minute hour * * *`

**Cron format:** `minute hour day month day_of_week`
- Example: `30 16 * * *` = 16:30 UTC every day
- Every 5 hours: `0 */5 * * *`

### Step 5: Enable GitHub Actions

1. Go to your repository's **Actions** tab
2. If prompted, click **I understand my workflows, go ahead and enable them**
3. Click **workflow.yml** on the left
4. Click **Run workflow** → **Run workflow** to test manually

### Step 6: Verify It Works

1. In the Actions tab, click on the latest workflow run
2. You should see a green checkmark if successful
3. Click the job to see the logs - Claude should have responded to the prompt

---

## Understanding the Authentication

### Why This Uses OAuth (Not API Keys)

| Method | Used For | Billing |
|--------|----------|---------|
| **OAuth Token** (`sk-ant-oat01-`) | Claude Code CLI, Subscription | Your Pro subscription quota |
| **API Key** (`sk-ant-api03-`) | Direct API calls | API billing (separate from subscription) |

This workflow uses OAuth so it counts against your **Pro subscription quota**, not API billing.

### How Credentials Are Stored

The workflow creates a `~/.claude/.credentials.json` file in the GitHub Actions runner with this format:

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

This approach works around a known bug where `CLAUDE_CODE_OAUTH_TOKEN` environment variable is ignored on Linux (GitHub Issue #8938).

---

## Troubleshooting

### "Invalid API key · Please run /login"

**Cause:** Wrong credentials format or OAuth token not working on Linux.

**Solution:** Make sure your workflow uses the nested `claudeAiOauth` format (not `oauthToken`):

```yaml
run: mkdir -p ~/.claude && echo '{"claudeAiOauth":{"accessToken":"${{ secrets.CLAUDE_OAUTH_TOKEN }}","refreshToken":"${{ secrets.CLAUDE_OAUTH_TOKEN }}","scopes":["user:inference","user:profile"],"subscriptionType":"pro"}}' > ~/.claude/.credentials.json && chmod 600 ~/.claude/.credentials.json
```

### Workflow Runs But Nothing Happens

**Check:**
1. GitHub Secret is named exactly `CLAUDE_OAUTH_TOKEN`
2. OAuth token starts with `sk-ant-oat01-` (not `sk-ant-api03-`)
3. You have an active Claude Pro subscription

### Local Testing

To test the credentials format locally:

```bash
# Create the credentials file
mkdir -p ~/.claude
echo '{"claudeAiOauth":{"accessToken":"YOUR_TOKEN","refreshToken":"YOUR_TOKEN","scopes":["user:inference","user:profile"],"subscriptionType":"pro"}}' > ~/.claude/.credentials.json

# Test
claude -p "Say hello"

# Clean up
rm ~/.claude/.credentials.json
```

---

## Customization

### Change the Prompts

Edit the `PROMPTS` array in `.github/workflows/wakeup.yml`:

```yaml
PROMPTS=(
  "Your custom prompt here"
  "Another prompt"
  "Add as many as you want"
)
```

### Change Run Frequency

To run every N hours instead of daily:

```yaml
schedule:
  - cron: '0 */5 * * *'  # Every 5 hours
```

### Run at Multiple Times

```yaml
schedule:
  - cron: '30 16 * * *'  # 5:30 AM NZDT
  - cron: '0 2 * * *'    # Another time
```

---

## Security Notes

- Your OAuth token is stored as a **GitHub Secret** - never in the code
- The credentials file is created with `chmod 600` (owner read/write only)
- OAuth tokens can be rotated by running `claude setup-token` again

---

## Links

- [Claude Code GitHub Issue #8938](https://github.com/anthropics/claude-code/issues/8938) - Linux OAuth environment variable bug
- [Claude Code Documentation](https://code.claude.com/docs/en/iam)
- [Claude Pro Subscription](https://claude.ai/upgrade)

---

## License

MIT - Feel free to use and modify for your needs.
