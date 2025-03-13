const express = require('express');
const fs = require('fs').promises;
const path = require('path');
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
    console.log(`${entry.timestamp.toISOString()} [${type}] ${message}`);
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
module.exports = { log, app };

if (require.main === module) {
    const port = getPort();
    app.listen(port, () => console.log(`Monitor running on http://localhost:${port}`));
}
