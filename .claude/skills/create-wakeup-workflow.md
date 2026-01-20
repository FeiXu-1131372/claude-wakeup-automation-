---
description: Generate the GitHub Actions workflow YAML file for Claude wake-up automation based on the PRD specifications
---

# Create Wake-Up Workflow Skill

You are tasked with generating the GitHub Actions workflow file for the Claude Auto-Trigger automation.

## Context
Claude Pro has a rolling 5-hour usage window that starts when the first message is sent. This automation runs a scheduled job at 6:00 AM local time to send a "ping" message to Claude, starting the usage window early.

## Your Task

1. Ask the user for their **timezone** (UTC offset, e.g., UTC+13 for NZDT, UTC-5 for EST)

2. Calculate the correct UTC time for the cron schedule:
   - Formula: `06:00 AM Local Time - UTC Offset = Target UTC Time`
   - If the result is negative, add 24 hours (it runs the previous day in UTC)

3. Create the file at `.github/workflows/wakeup.yml` with the following specifications:

### Workflow File Contents

```yaml
name: Claude Wake-Up Automation

on:
  schedule:
    - cron: '0 {HOUR} * * *'  # Replace {HOUR} with calculated UTC hour
  workflow_dispatch:  # Allow manual triggering

jobs:
  wakeup:
    runs-on: ubuntu-latest

    steps:
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install Claude Code CLI
        run: npm install -g @anthropic-ai/claude-code

      - name: Send Wake-Up Message
        env:
          ANTHROPIC_AUTH_TOKEN: ${{ secrets.ANTHROPIC_AUTH_TOKEN }}
        run: |
          # Array of varied, token-intensive prompts
          PROMPTS=(
            "Explain the concept of recursion in computer science with examples, then compare it with iterative approaches. Include time and space complexity analysis for common algorithms like factorial, Fibonacci, and tree traversal."
            "Describe the history and evolution of version control systems from SCCS to Git. Compare centralized vs distributed models, and explain branching strategies like Git Flow and trunk-based development."
            "Write a comprehensive overview of design patterns in software engineering. Cover creational, structural, and behavioral patterns with practical examples for Singleton, Factory, Observer, Strategy, and Decorator patterns."
            "Explain the differences between SQL and NoSQL databases. Discuss ACID properties, CAP theorem, and when to use relational vs document vs key-value vs graph databases with specific use cases."
            "Provide a detailed explanation of containerization and orchestration. Cover Docker concepts (images, containers, Dockerfile), and Kubernetes architecture (pods, services, deployments, namespaces) with practical examples."
          )
          # Select random prompt
          SELECTED_PROMPT=${PROMPTS[$RANDOM % ${#PROMPTS[@]}]}
          claude -p "$SELECTED_PROMPT"
```

## Example Calculations

| Local Timezone | UTC Offset | Target UTC | Cron Expression |
|----------------|------------|------------|-----------------|
| NZDT (New Zealand) | UTC+13 | 17:00 | `0 17 * * *` |
| AEDT (Australia) | UTC+11 | 19:00 | `0 19 * * *` |
| EST (US East) | UTC-5 | 11:00 | `0 11 * * *` |
| PST (US Pacific) | UTC-8 | 14:00 | `0 14 * * *` |

## Post-Generation Instructions

After creating the workflow file, remind the user to:

1. **Set up the GitHub Secret:**
   - Get their Claude API token by running `claude setup-token` locally
   - Go to: Repository Settings → Secrets and variables → Actions
   - Create a new secret named `ANTHROPIC_AUTH_TOKEN`
   - Paste the API token (starts with `sk-ant-`) as the secret value

2. **Commit and push the workflow file to GitHub**

3. **Verify the workflow runs at the scheduled time** by checking the Actions tab
