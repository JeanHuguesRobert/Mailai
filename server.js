import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import logger from './src/utils/logger.js';

const app = express();

let logs = [];
const MAX_LOGS = 10000;

app.use(express.json());
app.use(express.static('web'));

// Serve Vite build in dev mode
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static('web/dist'));
}

// Logging middleware
function log(type, message) {
    const entry = { timestamp: new Date(), type, message };
    logs.unshift(entry);
    if (logs.length > MAX_LOGS) {
        logs.pop(); // Roll the log after the limit
    }
    logger.monitor(`${entry.timestamp.toISOString()} [${type}] ${message}`);
}

// API Routes
app.get('/api/logs', (req, res) => res.json(logs));

app.get('/api/config', async (req, res) => {
    const config = await fs.readFile('.env', 'utf8');
    res.json({ config });
});

app.post('/api/config', async (req, res) => {
    await fs.writeFile('.env', req.body.config);
    // Unload previous environment variables
    Object.keys(process.env)
        .filter(key => key.startsWith('MAILAI_'))
        .forEach(key => delete process.env[key]);
    // Load new environment variables
    req.body.config.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        // Skip if not a MAILAI_ variable
        if (!key.startsWith('MAILAI_')) return;
        process.env[key] = value;
    });
    log('config', 'Configuration updated');
    res.json({ success: true });
});

function getPort() {
    // Priority: CLI arg > env var > default
    return parseInt(
        process.argv.find(arg => arg.startsWith('--port='))?.split('=')[1] ||
        process.env.MAILAI_HTTP_PORT ||
        3000
    );
}

// Export logging function and app
export { log, app };

if (import.meta.url === `file://${__filename}`) {
    const port = getPort();
    app.listen(port, () => logger.monitor(`Monitor running on http://localhost:${port}`));
}
