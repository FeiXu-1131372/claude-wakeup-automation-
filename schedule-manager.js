const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const TARGET_TIMEZONE = 'Pacific/Auckland';
const CONFIG_PATH = path.join(__dirname, 'config.json');
const WORKFLOW_PATH = path.join(__dirname, '.github', 'workflows', 'wakeup.yml');
const SCHEDULE_FILES = ['config.json', '.github/workflows/wakeup.yml'];

class ScheduleError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'ScheduleError';
    this.statusCode = statusCode;
  }
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatTime(totalMinutes) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`;
}

function parseTimeString(timeStr) {
  const value = String(timeStr || '').trim();

  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw new ScheduleError(`Invalid time format: ${value || '(empty)'}. Use HH:MM.`);
  }

  const [hours, minutes] = value.split(':').map(Number);
  if (hours > 23 || minutes > 59) {
    throw new ScheduleError(`Invalid time value: ${value}. Use a valid 24-hour time.`);
  }

  return {
    value,
    hours,
    minutes,
    totalMinutes: hours * 60 + minutes
  };
}

function getZonedParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23'
  });

  return formatter.formatToParts(date).reduce((parts, part) => {
    if (part.type !== 'literal') {
      parts[part.type] = part.value;
    }
    return parts;
  }, {});
}

function getTimeZoneOffsetMinutes(date, timeZone) {
  const parts = getZonedParts(date, timeZone);
  const zonedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return Math.round((zonedAsUtc - date.getTime()) / 60000);
}

function formatOffsetLabel(offsetMinutes) {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;

  return `UTC${sign}${pad(hours)}${minutes ? `:${pad(minutes)}` : ''}`;
}

function getCurrentTimeZoneInfo(referenceDate = new Date()) {
  const offsetMinutes = getTimeZoneOffsetMinutes(referenceDate, TARGET_TIMEZONE);
  const parts = getZonedParts(referenceDate, TARGET_TIMEZONE);
  const abbreviation = offsetMinutes === 780 ? 'NZDT' : offsetMinutes === 720 ? 'NZST' : formatOffsetLabel(offsetMinutes);

  return {
    timeZone: TARGET_TIMEZONE,
    abbreviation,
    offsetMinutes,
    offsetLabel: formatOffsetLabel(offsetMinutes),
    referenceDate: `${parts.year}-${parts.month}-${parts.day}`
  };
}

function describeDayShift(dayShift) {
  if (dayShift < 0) {
    return ' prev day';
  }

  if (dayShift > 0) {
    return ' next day';
  }

  return '';
}

function normalizeTimes(times) {
  if (!Array.isArray(times) || times.length === 0) {
    throw new ScheduleError('Provide at least one time.');
  }

  const parsed = times.map(parseTimeString).sort((left, right) => left.totalMinutes - right.totalMinutes);
  const seen = new Set();

  parsed.forEach(({ value }) => {
    if (seen.has(value)) {
      throw new ScheduleError(`Duplicate time: ${value}.`);
    }
    seen.add(value);
  });

  return parsed.map(({ value }) => value);
}

function previewSchedule(times, referenceDate = new Date()) {
  const normalizedTimes = normalizeTimes(times);
  const timeZoneInfo = getCurrentTimeZoneInfo(referenceDate);

  const entries = normalizedTimes.map((localTime) => {
    const { totalMinutes } = parseTimeString(localTime);
    const utcTotalMinutes = totalMinutes - timeZoneInfo.offsetMinutes;
    const dayShift = utcTotalMinutes < 0 ? -1 : utcTotalMinutes >= 1440 ? 1 : 0;
    const utcMinutes = ((utcTotalMinutes % 1440) + 1440) % 1440;
    const utcHour = Math.floor(utcMinutes / 60);
    const utcMinute = utcMinutes % 60;
    const cron = `${utcMinute} ${utcHour} * * *`;
    const utcTime = formatTime(utcMinutes);

    return {
      localTime,
      utcTime,
      utcHour,
      utcMinute,
      cron,
      dayShift,
      dayShiftLabel: describeDayShift(dayShift),
      comment: `${localTime} ${timeZoneInfo.abbreviation} = ${utcTime} UTC${describeDayShift(dayShift)}`.trim(),
      cronLine: `    - cron: '${cron}'  # ${localTime} ${timeZoneInfo.abbreviation} = ${utcTime} UTC${describeDayShift(dayShift)}`
    };
  });

  return {
    times: normalizedTimes,
    timeZoneInfo,
    entries,
    cronLines: entries.map((entry) => entry.cronLine)
  };
}

function readScheduleConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new ScheduleError('config.json not found.', 500);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  if (!Array.isArray(config.schedule?.times)) {
    throw new ScheduleError('schedule.times array not found in config.json.', 500);
  }

  return config;
}

function updateConfig(times) {
  const config = readScheduleConfig();
  const nextConfig = {
    ...config,
    schedule: {
      ...config.schedule,
      times
    }
  };

  const previousContent = fs.readFileSync(CONFIG_PATH, 'utf8');
  const nextContent = `${JSON.stringify(nextConfig, null, 2)}\n`;

  if (previousContent !== nextContent) {
    fs.writeFileSync(CONFIG_PATH, nextContent);
    return true;
  }

  return false;
}

function updateWorkflowFile(preview) {
  if (!fs.existsSync(WORKFLOW_PATH)) {
    throw new ScheduleError('Workflow file not found.', 500);
  }

  const previousContent = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  const schedulePattern = /(on:\n  schedule:\n)(?:    - cron: '[^']+'[^\n]*\n)+/m;

  if (!schedulePattern.test(previousContent)) {
    throw new ScheduleError('Could not find cron expressions in workflow file.', 500);
  }

  const nextContent = previousContent.replace(
    schedulePattern,
    `$1${preview.cronLines.join('\n')}\n`
  );

  if (previousContent !== nextContent) {
    fs.writeFileSync(WORKFLOW_PATH, nextContent);
    return true;
  }

  return false;
}

function runGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: __dirname,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
  } catch (error) {
    const message = [error.stdout, error.stderr, error.message].filter(Boolean).join('\n').trim();
    throw new ScheduleError(message || `git ${args.join(' ')} failed.`, 500);
  }
}

function commitAndPush(times, timeZoneInfo, push = true) {
  runGit(['add', ...SCHEDULE_FILES]);

  const stagedFiles = runGit(['diff', '--cached', '--name-only', '--', ...SCHEDULE_FILES])
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean);

  if (stagedFiles.length === 0) {
    return {
      committed: false,
      pushed: false,
      message: 'No schedule changes to push.'
    };
  }

  const stagedDiff = runGit(['diff', '--cached', '--', ...SCHEDULE_FILES]);
  if (/sk-ant-oat01-|CLAUDE_OAUTH_TOKEN/i.test(stagedDiff)) {
    throw new ScheduleError('Refusing to push content that looks like a credential.', 500);
  }

  const message = `schedule: update wake-up times to ${times.join(', ')} ${timeZoneInfo.abbreviation}`;
  runGit(['commit', '-m', message]);

  if (push) {
    runGit(['push']);
  }

  return {
    committed: true,
    pushed: push,
    message
  };
}

function applySchedule({ times, push = true, dryRun = false }) {
  const preview = previewSchedule(times);

  if (dryRun) {
    return {
      ...preview,
      changed: false,
      git: {
        committed: false,
        pushed: false,
        dryRun: true,
        message: 'Dry run completed.'
      }
    };
  }

  const configChanged = updateConfig(preview.times);
  const workflowChanged = updateWorkflowFile(preview);
  const changed = configChanged || workflowChanged;

  if (!push) {
    return {
      ...preview,
      changed,
      git: {
        committed: false,
        pushed: false,
        message: changed ? 'Updated files locally without pushing.' : 'No schedule changes detected.'
      }
    };
  }

  return {
    ...preview,
    changed,
    git: commitAndPush(preview.times, preview.timeZoneInfo, true)
  };
}

module.exports = {
  CONFIG_PATH,
  TARGET_TIMEZONE,
  WORKFLOW_PATH,
  ScheduleError,
  applySchedule,
  getCurrentTimeZoneInfo,
  previewSchedule,
  readScheduleConfig
};
