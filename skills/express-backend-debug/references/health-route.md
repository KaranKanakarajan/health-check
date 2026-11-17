# /health route

Every backend gets a `GET /health` route, so devs, uptime monitors, Docker, Kubernetes and load balancers can check if the server is alive and its database is reachable. If the project has none, create it. If one exists (`/health`, `/healthz`, `/api/health`, `/status`), upgrade that one instead of adding a second.

Rules:
- Public: mounted before any auth middleware and never behind `protect`.
- Fast: each dependency check has a timeout (2s), so a hung DB can't hang the route.
- Honest status code: `200` when everything is up, `503` when any dependency is down, so monitors don't need to read the body.
- Safe: no secrets, connection strings, hostnames or env values in the response.
- Not cached: `Cache-Control: no-store`.

Code: copy `templates/health.js` -> `routes/health.js`, mount `app.use('/health', require('./routes/health'))` before auth. Mongoose by default; swap the `database` check:

| DB | Check body |
|---|---|
| Prisma | ``await prisma.$queryRaw`SELECT 1` `` |
| pg (Pool) | `await pool.query('SELECT 1')` |
| mysql2 | `await pool.query('SELECT 1')` |
| Sequelize | `await sequelize.authenticate()` |
| Redis | `await redis.ping()` |

Prove it:

```bash
curl -i http://localhost:5000/health        # 200, status "ok"
curl -i http://localhost:5000/health/live   # 200
# never stop the real DB - run a 2nd instance with a dead URI:
# MONGO_URI=mongodb://127.0.0.1:1/x PORT=5999 node server.js &  then curl :5999/health, then kill it
curl -i http://localhost:5999/health        # 503, status "degraded", database "down"
```

Add it to the map.md map as `🩺 DOCTOR [/health] -> "Are you OK?" Says yes (200) or "something hurts" (503)`, and to the README/API docs if the project has them. For Docker, add `HEALTHCHECK CMD wget -qO- http://localhost:5000/health || exit 1` (Alpine images have wget; use the app's real port).
