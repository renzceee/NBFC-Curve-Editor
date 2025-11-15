const express = require('express');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const APPLY_SCRIPT = path.join(__dirname, 'apply_nbfc_curve.sh');
const DEFAULT_PORT = process.env.PORT || 3000;

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (err) {
    return false;
  }
}

async function runScript(scriptPath, args) {
  if (!(await fileExists(scriptPath))) {
    throw new Error(`Helper script not found at ${scriptPath}`);
  }
  return new Promise((resolve, reject) => {
    const child = spawn(scriptPath, args, { stdio: 'inherit' });
    child.on('error', (error) => reject(error));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Helper script exited with code ${code}`));
    });
  });
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.post('/apply', async (req, res) => {
  try {
    const { config, fileName } = req.body || {};
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ status: 'error', message: 'Missing config object in request body.' });
    }
    const safeName = (fileName || 'fan-profile.json').replace(/[^a-zA-Z0-9._-]/g, '_');
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nbfc-curve-'));
    const tempPath = path.join(tempDir, safeName);
    await fs.writeFile(tempPath, JSON.stringify(config, null, 2), 'utf8');

    try {
      await runScript(APPLY_SCRIPT, [tempPath]);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }

    return res.json({ status: 'ok', message: 'Curve applied successfully.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to apply curve.' });
  }
});

app.listen(DEFAULT_PORT, () => {
  console.log(`NBFC helper server listening on http://localhost:${DEFAULT_PORT}`);
});
