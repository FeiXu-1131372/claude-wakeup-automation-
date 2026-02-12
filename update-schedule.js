const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const WORKFLOW_PATH = path.join(__dirname, '.github', 'workflows', 'wakeup.yml');

function getTimezoneAbbreviation() {
  const date = new Date();
  const timeString = date.toLocaleTimeString('en-US', { timeZoneName: 'short' });
  const match = timeString.match(/[A-Z]{2,5}$/);
  return match ? match[0] : Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function convertToUTC(timeStr) {
  const [hour, minute] = timeStr.split(':').map(Number);

  if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid time format: ${timeStr}. Use HH:MM (24-hour format)`);
  }

  const date = new Date();
  date.setHours(hour, minute, 0, 0);

  return { utcHour: date.getUTCHours(), utcMinute: date.getUTCMinutes() };
}

function formatTime(hour, minute) {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function updateWorkflowFile(times, timezone) {
  const content = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  // Build cron lines for all times
  const cronLines = times.map(localTime => {
    const { utcHour, utcMinute } = convertToUTC(localTime);
    const cron = `${utcMinute} ${utcHour} * * *`;
    return `    - cron: '${cron}'  # ${localTime} ${timezone} = ${formatTime(utcHour, utcMinute)} UTC`;
  });

  // Replace all consecutive cron lines in the schedule block
  const newContent = content.replace(
    / +- cron: '[^']+'[^\n]*(\n +- cron: '[^']+'[^\n]*)*/m,
    cronLines.join('\n')
  );

  if (newContent === content) {
    throw new Error('Could not find cron expressions in workflow file');
  }

  fs.writeFileSync(WORKFLOW_PATH, newContent);
  return cronLines;
}

function gitCommitAndPush(times, timezone) {
  try {
    execSync('git add .github/workflows/wakeup.yml', { stdio: 'inherit' });
    execSync(`git commit -m "Update schedule to ${times.join(', ')} ${timezone}"`, { stdio: 'inherit' });
    execSync('git push', { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error('\nGit operation failed:', error.message);
    return false;
  }
}

async function main() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('Error: config.json not found');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const times = config.schedule?.times;

  if (!times || !Array.isArray(times) || times.length === 0) {
    console.error('Error: schedule.times array not found in config.json');
    process.exit(1);
  }

  const timezone = getTimezoneAbbreviation();

  // Show preview for all times
  console.log(`\nSchedule will be updated to ${times.length} daily runs (${timezone}):\n`);
  times.forEach(localTime => {
    const { utcHour, utcMinute } = convertToUTC(localTime);
    console.log(`  ${localTime} ${timezone}  →  ${formatTime(utcHour, utcMinute)} UTC  (cron: ${utcMinute} ${utcHour} * * *)`);
  });
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Push to GitHub? (y/n): ', (answer) => {
    rl.close();

    if (answer.toLowerCase() !== 'y') {
      console.log('Cancelled.');
      process.exit(0);
    }

    try {
      updateWorkflowFile(times, timezone);
      console.log('\nWorkflow file updated.');
    } catch (error) {
      console.error('Error updating workflow:', error.message);
      process.exit(1);
    }

    if (gitCommitAndPush(times, timezone)) {
      console.log('\nDone! Schedule updated successfully.');
    } else {
      process.exit(1);
    }
  });
}

main();
