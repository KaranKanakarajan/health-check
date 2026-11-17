// routes/health.js - mount before auth: app.use('/health', require('./routes/health'))
const router = require('express').Router();
const mongoose = require('mongoose');
// npm sets these when started with npm start/run dev; no fragile ../package.json path.
const name = process.env.npm_package_name || 'api';
const version = process.env.npm_package_version || 'unknown';
const showErrors = process.env.NODE_ENV === 'development'; // DB errors can contain hostnames

// Reject if a check takes too long, so /health always answers.
const withTimeout = (p, ms = 2000) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`timed out after ${ms}ms`)), ms))]);

async function check(fn) {
  const start = Date.now();
  try {
    await withTimeout(fn());
    return { status: 'up', latencyMs: Date.now() - start };
  } catch (err) {
    return { status: 'down', latencyMs: Date.now() - start, ...(showErrors && { error: err.message }) };
  }
}

// Liveness: is the process alive? No dependency checks - restarts happen only on real hangs.
router.get('/live', (req, res) => res.set('Cache-Control', 'no-store').json({ status: 'ok' }));

// Full health: process + every dependency.
router.get('/', async (req, res) => {
  const checks = {
    database: await check(async () => {
      if (mongoose.connection.readyState !== 1) throw new Error('not connected');
      await mongoose.connection.db.admin().ping();
    }),
    // add more: redis: await check(() => redis.ping()), stripe, s3, ...
  };
  const healthy = Object.values(checks).every(c => c.status === 'up');
  res.set('Cache-Control', 'no-store').status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    service: name,
    version,
    env: process.env.NODE_ENV || 'not set',
    uptimeSec: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    checks,
  });
});

module.exports = router;
