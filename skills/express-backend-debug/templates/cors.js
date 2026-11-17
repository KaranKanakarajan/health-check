// app.js CORS - put right after app.use(requestId); set CLIENT_URLS=http://localhost:5173,https://myapp.com in .env
const cors = require('cors');
const allowed = (process.env.CLIENT_URLS || 'http://localhost:5173').split(',').map(s => s.trim().replace(/\/$/, ''));
app.use(cors({
  origin(origin, cb) {
    if (!origin || allowed.includes(origin)) return cb(null, true); // !origin = curl, Postman, server-to-server
    console.warn(`[CORS] blocked origin "${origin}". Allowed: ${allowed.join(', ')}. Add it to CLIENT_URLS in .env`);
    cb(null, false);
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Request-Id'], // lets the frontend read the id for bug reports
}));
