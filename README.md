# Claude Pro "Wake-Up" Automation

## Context
Claude Pro has a usage limit that resets on a **rolling 5-hour window**. The window begins counting down the moment the first message is sent.

* **The Problem:** If I start working at 9:00 AM, my usage window resets at 2:00 PM. If I burn through my limit by 11:00 AM, I am blocked for 3 full hours.
* **The Strategy:** I want to "trick" the system by sending a dummy message at **6:00 AM**. This starts the 5-hour clock early. When I sit down to work at 9:00 AM, the timer is already running. If I hit the limit at 10:30 AM, the reset happens at **11:00 AM** (5 hours after 6 AM), effectively giving me a fresh allowance just before lunch.
* **The Constraint:** I do not want to wake up at 6:00 AM, and I do not want to leave my personal computer running.

## The Solution
We will use **GitHub Actions** (Free Tier) to run a scheduled job in the cloud.
1.  It wakes up at 6:00 AM local time.
2.  It installs the `claude-code` CLI tool.
3.  It injects my saved session credentials (so no browser login is needed).
4.  It sends one single "ping" message to start the timer.