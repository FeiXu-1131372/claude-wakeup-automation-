const http = require('http');
const fs = require('fs');
const path = require('path');
const { ScheduleError, applySchedule, previewSchedule, readScheduleConfig } = require('./schedule-manager');

const PORT = Number(process.env.PORT) || 3456;
const UI_PATH = path.join(__dirname, 'schedule-ui.html');

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new ScheduleError('Request body is too large.', 413));
        req.destroy();
      }
    });

    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function getStatePayload() {
  const config = readScheduleConfig();
  const preview = previewSchedule(config.schedule.times);

  return {
    times: preview.times,
    timeZoneInfo: preview.timeZoneInfo,
    preview: preview.entries
  };
}

function sendHtml(res) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fs.readFileSync(UI_PATH, 'utf8'));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/') {
      sendHtml(res);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/state') {
      sendJson(res, 200, getStatePayload());
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/apply') {
      const rawBody = await readBody(req);
      let payload = {};
      if (rawBody) {
        try {
          payload = JSON.parse(rawBody);
        } catch (error) {
          throw new ScheduleError('Invalid JSON body.', 400);
        }
      }
      const result = applySchedule({
        times: payload.times,
        push: payload.push !== false,
        dryRun: payload.dryRun === true
      });

      sendJson(res, 200, {
        times: result.times,
        timeZoneInfo: result.timeZoneInfo,
        preview: result.entries,
        changed: result.changed,
        git: result.git
      });
      return;
    }

    sendJson(res, 404, { error: 'Not found.' });
  } catch (error) {
    const statusCode = error instanceof ScheduleError ? error.statusCode : 500;
    console.error('Server error:', error.message);
    sendJson(res, statusCode, { error: error.message });
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Run with PORT=<other-port> node server.js.`);
    process.exit(1);
  }

  console.error('Server error:', error.message);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Schedule UI running at http://localhost:${PORT}`);
  console.log('Open in your browser to configure schedule times.');
});
