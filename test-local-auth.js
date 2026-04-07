const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const CREDENTIALS_PATH = path.join(CLAUDE_DIR, '.credentials.json');
const DEFAULT_PROMPT = 'Say hello in one short sentence.';

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { prompt: DEFAULT_PROMPT, help: false };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      return parsed;
    }

    if (arg === '--prompt' && args[i + 1]) {
      parsed.prompt = args[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith('--prompt=')) {
      parsed.prompt = arg.slice('--prompt='.length);
    }
  }

  return parsed;
}

function printHelp() {
  console.log('Usage: node test-local-auth.js [--prompt "your prompt"]');
  console.log('');
  console.log('Set token via environment variable for safer input:');
  console.log('  CLAUDE_OAUTH_TOKEN=<your-token> node test-local-auth.js');
}

function ensureClaudeCliInstalled() {
  const result = spawnSync('claude', ['--version'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error('Claude CLI is not available. Install it first: npm install -g @anthropic-ai/claude-code');
  }
}

function promptSecret(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.stdoutMuted = true;
    rl._writeToOutput = function writeMaskedOutput(stringToWrite) {
      if (rl.stdoutMuted) {
        rl.output.write('*');
      } else {
        rl.output.write(stringToWrite);
      }
    };

    rl.question(question, (answer) => {
      rl.close();
      console.log('');
      resolve(answer.trim());
    });
  });
}

function writeCredentials(token) {
  fs.mkdirSync(CLAUDE_DIR, { recursive: true });

  let backupPath = null;
  if (fs.existsSync(CREDENTIALS_PATH)) {
    backupPath = `${CREDENTIALS_PATH}.bak.localtest.${Date.now()}`;
    fs.copyFileSync(CREDENTIALS_PATH, backupPath);
  }

  const payload = {
    claudeAiOauth: {
      accessToken: token,
      refreshToken: token,
      scopes: ['user:inference', 'user:profile'],
      subscriptionType: 'pro'
    }
  };

  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(payload));
  fs.chmodSync(CREDENTIALS_PATH, 0o600);
  return backupPath;
}

function restoreCredentials(backupPath) {
  if (backupPath && fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, CREDENTIALS_PATH);
    fs.unlinkSync(backupPath);
    console.log('Original Claude credentials restored.');
    return;
  }

  if (fs.existsSync(CREDENTIALS_PATH)) {
    fs.unlinkSync(CREDENTIALS_PATH);
    console.log('Temporary Claude credentials removed.');
  }
}

async function main() {
  const { prompt, help } = parseArgs();
  if (help) {
    printHelp();
    return;
  }

  ensureClaudeCliInstalled();

  let token = (process.env.CLAUDE_OAUTH_TOKEN || '').trim();
  if (!token) {
    token = await promptSecret('Paste CLAUDE_OAUTH_TOKEN (input hidden): ');
  }

  if (!token) {
    throw new Error('No token provided.');
  }

  if (!token.startsWith('sk-ant-oat01-')) {
    console.log('Warning: token does not look like a Claude OAuth token.');
  }

  let backupPath = null;
  try {
    backupPath = writeCredentials(token);
    console.log('Running local Claude auth test...');
    const run = spawnSync('claude', ['-p', prompt], { stdio: 'inherit' });
    if (run.error) {
      throw run.error;
    }

    if (run.status !== 0) {
      process.exit(run.status || 1);
    }

    console.log('Local auth test succeeded.');
  } finally {
    restoreCredentials(backupPath);
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
