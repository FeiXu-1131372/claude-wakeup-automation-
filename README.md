# Claude AutoRoller - Auto-Refresh Your Claude Pro Quota

Automatically trigger your Claude Pro subscription's 5-hour rolling usage window reset by sending scheduled messages to Claude via GitHub Actions.

## The Problem

Claude Pro subscribers have a **5-hour rolling usage window** with a cap on how many messages you can send. If you don't use Claude for 5+ hours, your quota "goes cold" and resets. But if you use it frequently, you may hit the cap and have to wait.

By sending a small message **every 5 hours (4 times per day)**, you create multiple session start opportunities throughout the day, ensuring you're never more than ~2.5 hours away from a quota reset.

### How It Works

**Schedule (NZDT):**
- 06:00 AM → Session window: 06:00 AM - 11:00 AM
- 11:00 AM → Session window: 11:00 AM - 04:00 PM
- 04:00 PM → Session window: 04:00 PM - 09:00 PM
- 09:00 PM → Session window: 09:00 PM - 02:00 AM

**Key benefits:**
- Maximum wait time reduced from 3.5+ hours to ~2.5 hours
- No matter when you work, you're always in a recent session
- Uses only ~4% of daily quota (1% per message)
- 9-hour overnight gap ensures first message always starts fresh session

### Example Timeline

| Time | Event | Result |
|------|-------|--------|
| 6:00 AM | Automated message #1 | 5-hour window starts |
| 10:30 AM | You hit usage limit | Only 30 min wait until reset |
| 11:00 AM | Automated message #2 | Fresh session and quota available |
| 3:30 PM | Hit limit again | Only 30 min wait |
| 4:00 PM | Automated message #3 | Fresh session available |

Without this automation, if you started at 9:00 AM and hit the limit at 10:30 AM, you'd wait until 2:00 PM for a reset.

## How This Works

This GitHub Actions workflow:
1. Runs automatically **4 times per day**, every 5 hours (06:00, 11:00, 16:00, 21:00 NZDT)
2. Sends a simple prompt to Claude using your OAuth credentials (~1% quota each)
3. Triggers your subscription-based usage (not API billing)
4. Creates multiple session start opportunities throughout the day

**Key difference:** This uses **OAuth/subscription authentication**, NOT API keys. API keys use API billing, while OAuth tokens use your Claude Pro subscription.

**Why 4 times per day?** Running every 5 hours aligns perfectly with Claude's 5-hour session duration, creating optimal coverage with minimal quota usage (4% daily total).

---

## Prerequisites

- A **Claude Pro subscription**
- A **GitHub account**
- Your **Claude OAuth token** (starts with `sk-ant-oat01-`)
- **Node.js** (for the schedule update script, optional)

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

By default, the workflow runs **4 times per day** at 06:00, 11:00, 16:00, and 21:00 NZDT. To change the schedule:

#### Manual Edit (Currently Required)

1. Open `.github/workflows/wakeup.yml`
2. Find the `schedule` section with 4 cron entries:
   ```yaml
   schedule:
     - cron: '0 17 * * *'  # 06:00 NZDT (17:00 UTC prev day)
     - cron: '0 22 * * *'  # 11:00 NZDT (22:00 UTC prev day)
     - cron: '0 3 * * *'   # 16:00 NZDT (03:00 UTC)
     - cron: '0 8 * * *'   # 21:00 NZDT (08:00 UTC)
   ```
3. Adjust times for your timezone, keeping the 5-hour spacing
4. Calculate UTC times:
   - **New Zealand (NZDT, UTC+13)**: Local time - 13 hours (previous day if < 13:00)
   - **New York (EST, UTC-5)**: Local time + 5 hours
   - **London (GMT, UTC+0)**: Same as local time
   - **Tokyo (JST, UTC+9)**: Local time - 9 hours

**Cron format:** `minute hour * * *`
- Example: `0 17 * * *` = 17:00 UTC (5:00 PM UTC) every day

> **Note:** The `update-schedule.js` script currently only supports single daily schedules. Multi-time support is a future enhancement.

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

Keep prompts simple to minimize quota usage (~1% per message).

### Change the Schedule Times

The default 4x daily schedule (06:00, 11:00, 16:00, 21:00) is optimized for 5-hour coverage. To adjust:

1. Edit `.github/workflows/wakeup.yml`
2. Modify the 4 cron entries, maintaining 5-hour spacing
3. Ensure 8-9 hour gap overnight so first message starts fresh session

**Example for different timezone:**
```yaml
schedule:
  - cron: '0 12 * * *'  # 7:00 AM EST
  - cron: '0 17 * * *'  # 12:00 PM EST
  - cron: '0 22 * * *'  # 5:00 PM EST
  - cron: '0 3 * * *'   # 10:00 PM EST
```

### Alternative Strategies

**3x daily (every 6-7 hours):**
- Lower quota usage (3%)
- Less optimal coverage
- Longer maximum wait times

**Once daily:**
- Minimal quota usage (1%)
- Much longer wait times (3.5+ hours)
- Original simple approach

The 4x daily schedule is recommended as the optimal balance.

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
