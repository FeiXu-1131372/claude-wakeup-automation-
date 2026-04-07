const readline = require('readline');
const { applySchedule, previewSchedule, readScheduleConfig } = require('./schedule-manager');

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    autoConfirm: args.has('--yes') || args.has('-y'),
    dryRun: args.has('--dry-run')
  };
}

function confirm(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

function printPreview(preview) {
  console.log(`\nSchedule will be updated to ${preview.times.length} daily runs (${preview.timeZoneInfo.abbreviation}, ${preview.timeZoneInfo.offsetLabel}):\n`);
  preview.entries.forEach((entry) => {
    console.log(`  ${entry.localTime} ${preview.timeZoneInfo.abbreviation}  →  ${entry.utcTime} UTC${entry.dayShiftLabel}  (cron: ${entry.cron})`);
  });
  console.log('');
}

async function main() {
  const { autoConfirm, dryRun } = parseArgs();
  const config = readScheduleConfig();
  const preview = previewSchedule(config.schedule.times);

  printPreview(preview);

  if (dryRun) {
    console.log('Dry run completed.');
    return;
  }

  const approved = autoConfirm || await confirm('Push to GitHub? (y/n): ');
  if (!approved) {
    console.log('Cancelled.');
    return;
  }

  const result = applySchedule({ times: config.schedule.times, push: true });
  console.log(result.changed ? '\nWorkflow file updated.' : '\nNo schedule changes detected.');
  console.log(result.git.message ? `\n${result.git.message}` : '\nDone! Schedule updated successfully.');
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});