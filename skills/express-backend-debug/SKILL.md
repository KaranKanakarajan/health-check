---
name: express-backend-debug
description: Use when the user asks to health-check, audit, or "make 100% healthy" an Express backend and wants a report of what was fixed, when the user wants a simple / kid-level diagram or map of an Express backend's structure and connections, or when a Node.js/Express backend throws or misbehaves anywhere in the request path - 404 on a route that exists, 401/403 with a valid token, "Cannot read properties of undefined (reading 'id')", req.body undefined, CORS blocked, "Cannot set headers after they are sent", unhandled promise rejection, JWT errors (invalid signature, jwt expired, jwt malformed), bcrypt compare always false, Mongoose/Prisma/pg errors, server crash on start, or env vars undefined.
---

# Express Backend Debug

## Overview

A request flows through fixed layers. A bug lives in exactly one layer, but shows up in a later one. **Trace the request layer by layer, from the server boot to the response, and prove each layer works before blaming the next.** Never patch the symptom in the route handler when the cause is upstream (wrong mount order, missing body parser, bad env var).

```
boot (env, DB connect, listen)
  -> global middleware (cors, json parser, cookies, logger)
  -> router mount (app.use('/api/x', router))
  -> route match (method + path)
  -> auth middleware (extract token -> verify -> attach req.user)
  -> validation
  -> handler (async, try/catch or wrapper)
  -> DB / service
  -> response (one send only)
  -> error middleware (4 args, LAST)
```

## Step 0: Draw the map (kid-simple)

Before fixing, draw the user's REAL backend as a picture a 5-year-old understands. Read the entry file (`app.js`/`server.js`/`index.js`), every `routes/*` file, the auth middleware and the models. Then fill this template with the real names you found. It's a restaurant story: one box per layer, one short line per box, small words only.

Output contract:
1. Title line: `🏠 <project name> backend = a restaurant`
2. The diagram below, with REAL route paths, middleware names, model names and DB type in the brackets. Drop a box only if that layer doesn't exist in the code.
3. A "Doors" list: each real route as `METHOD /path -> what it does in 5 words`, with 🔒 if `protect`/auth runs on it.
4. When debugging: put ❌ on the box where the bug is and ✅ on boxes already proven OK.

```
 🧒 YOU (the app / browser)
    │  "I want food!"  = request (GET /api/users)
    ▼
 🚪 FRONT DOOR  [cors]
    │  "Are you allowed in?"  Wrong house -> door stays shut (CORS error)
    ▼
 📬 LETTER OPENER  [express.json, cookieParser]
    │  Opens your note so the cooks can read it (req.body, req.cookies)
    ▼
 🪧 SIGNS ON WALL  [app.use('/api/auth'), app.use('/api/users')]
    │  Points you to the right room. No sign -> "room not found" (404)
    ▼
 💂 GUARD  [protect middleware + JWT]
    │  "Show your sticker!"  Sticker = token.
    │  Good sticker -> go in.  Bad or old sticker -> "Stop!" (401)
    ▼
 👩‍🍳 COOK  [controller / route handler]
    │  Makes what you asked for
    ▼
 🧊 FRIDGE  [MongoDB: User, Post models]
    │  Where all the stuff is kept
    ▼
 🍽️ PLATE BACK TO YOU  = response (200 + data)

 🚑 HELPER  [error handler, last in app.js]
    If anything falls down, helper says what went wrong (500 / 400)
```

Example "Doors" list:
```
POST /api/auth/register      -> make a new friend
POST /api/auth/login         -> get your sticker
GET  /api/users/me        🔒 -> show who I am
```

Keep the analogy fixed (door = CORS, letter opener = body parser, signs = routers, guard = auth, cook = handler, fridge = DB, helper = error handler) so every map reads the same way.

## Step 1: Reproduce and capture

Get the exact failing request and the full server log before touching code.

```bash
curl -i -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"a@b.com","password":"secret"}'
```

Record: status code, response body, server stack trace (top frame in YOUR code, not node_modules). If no stack trace is printed, the error middleware is swallowing it - fix logging first (Step 3).

## Step 2: Boot layer

| Check | How |
|---|---|
| Env loaded before use | `require('dotenv').config()` is the FIRST line of the entry file, before any import that reads `process.env` |
| Env values present | `console.log({ JWT_SECRET: !!process.env.JWT_SECRET, DB: !!process.env.MONGO_URI })` |
| DB connected before listen | `await connectDB(); app.listen(...)` - not listen first |
| Port free | `EADDRINUSE` -> another process holds the port |
| ESM/CJS mix | `require is not defined` / `Cannot use import statement` -> match `"type"` in package.json |

## Step 3: Middleware order (most common root cause)

Order in `app.js` matters. Correct skeleton:

```js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

// 1. CORS before routes. credentials:true needs an explicit origin, never '*'.
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
// 2. Body + cookie parsers before routes, or req.body / req.cookies is undefined.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 3. Routes.
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));

// 4. 404 for unmatched routes - after all routes.
app.use((req, res) => res.status(404).json({ message: `Not found: ${req.method} ${req.originalUrl}` }));

// 5. Error handler - LAST, and MUST have 4 args or Express treats it as normal middleware.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

module.exports = app;
```

## Step 4: Route layer

For a 404 on a route you "know" exists:

- Full path = mount prefix + router path. `app.use('/api/users', r)` + `r.get('/users/:id')` = `/api/users/users/:id`. Usual bug.
- Method matches (`GET` vs `POST`).
- Router file exports the router: `module.exports = router` (not `{ router }`, not missing).
- Static paths before param paths: `/me` must come before `/:id`, or `me` is read as an id.
- Router added to `app` at all, and before the 404 handler.

List what Express actually registered (Express 4):

```js
app._router.stack.filter(l => l.name === 'router').forEach(l =>
  l.handle.stack.forEach(r => r.route && console.log(Object.keys(r.route.methods), l.regexp, r.route.path)));
```

## Step 5: Auth layer

Trace the token end to end. Log at each hop; find the first hop where it is wrong.

| Hop | Check |
|---|---|
| Client sends it | Header is `Authorization: Bearer <token>` (with space), or cookie sent with `credentials: 'include'` / `withCredentials: true` |
| Server reads it | `req.headers.authorization?.split(' ')[1]` or `req.cookies.token` (needs cookie-parser) |
| Sign and verify use same secret | Same `process.env.JWT_SECRET`, loaded (not `undefined`) at both points |
| Payload shape | Signed `{ id: user._id }` -> read `decoded.id`, not `decoded.userId` / `decoded._id` |
| Middleware attaches user | `req.user = await User.findById(decoded.id).select('-password')`, then `next()` |
| Route uses middleware | `router.get('/me', protect, handler)` - `protect` actually in the chain |

Reference auth middleware:

```js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports.protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.token;
    if (!token) return res.status(401).json({ message: 'No token' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET); // throws on bad/expired
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ message: 'User no longer exists' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token' });
  }
};
```

Login/password checks:

- `bcrypt.compare(plain, hash)` - argument order is plain first. It is async: `await` it.
- Password field has `select: false` in schema -> login query needs `.select('+password')`, or hash is `undefined`.
- Pre-save hash hook must skip when unchanged: `if (!this.isModified('password')) return next();` - otherwise every save double-hashes and login breaks.

## Step 6: Handler and async errors

- Every async handler: `try/catch` with `next(err)`, or wrap with `express-async-handler`. Express 4 does NOT catch rejected promises - request hangs or process crashes. (Express 5 does.)
- Every `res.json/res.send` path ends with `return`. Missing `return` -> `Cannot set headers after they are sent to the client`.
- `await` every DB call. Missing `await` -> you send a Promise / `{}`.

## Step 7: DB layer

| Error | Cause |
|---|---|
| `CastError: Cast to ObjectId failed` | Bad id in URL - validate with `mongoose.isValidObjectId(id)`, return 400 |
| `E11000 duplicate key` | Unique field taken - return 409 |
| `ValidationError` | Body missing required fields - return 400 with `err.errors` |
| `MongooseServerSelectionError` / `ECONNREFUSED` | DB not running, wrong URI, or Atlas IP not whitelisted |
| Query returns `null` | Wrong collection/model name, or wrong DB in URI |
| Prisma `P2002` / `P2025` | Unique violation / record not found |

## Quick symptom map

| Symptom | Layer | First thing to check |
|---|---|---|
| `req.body` undefined/`{}` | Middleware | `express.json()` before routes; client sends `Content-Type: application/json` |
| 404 on real route | Route | Mount prefix + path doubled; method; export |
| CORS error in browser | Middleware | `cors()` before routes; explicit origin with credentials |
| 401 with valid token | Auth | Secret mismatch; `Bearer ` prefix; payload key name |
| `jwt malformed` | Auth | Token is `"undefined"`/`null` string from client storage |
| `Cannot read properties of undefined (reading 'id')` on `req.user` | Auth | `protect` not in route chain |
| Login always "invalid credentials" | Auth | `.select('+password')`; double hash; un-awaited `compare` |
| Request hangs forever | Handler | Async error not passed to `next`; middleware never calls `next()` |
| Headers already sent | Handler | Missing `return` before second `res.*` |
| Crash on start | Boot | Env missing; DB URI; port in use |

## Common mistakes

- Fixing in the handler what is broken in middleware order. Go upstream first.
- Changing several layers at once. Fix one, re-run the Step 1 curl, then next.
- Returning 500 for client errors. Map Cast/Validation -> 400, duplicate -> 409, auth -> 401, role -> 403.
- Logging the token or password while debugging and leaving it in. Remove debug logs before finishing.

## Health check mode (make it 100% healthy)

Use when the user asks to "check health", "make backend healthy", "audit backend" or "fix everything". Run every check below, fix every fail, re-check, and loop until all pass or a fail is truly blocked (needs a secret, a paid service, or a product decision from the user).

A check passes only with evidence: a file:line you read or a command output you ran. "Looks fine" is not a pass.

| # | Area | Check | Proof |
|---|---|---|---|
| 1 | Boot | Server starts with no error or warning | `npm start` / `node server.js` output |
| 2 | Boot | `.env` loaded first; every `process.env.X` used has a value; `.env.example` lists them | grep `process.env` vs `.env` keys |
| 3 | Boot | DB connects before `listen`; failed connect exits with a clear message | entry file + startup log |
| 4 | Middleware | Order = cors -> parsers -> routes -> 404 -> error handler (Step 3) | `app.js` lines |
| 5 | Middleware | Error handler has 4 args and is last | `app.js` line |
| 6 | Routes | Every route file exported and mounted; no doubled prefix; static before `/:id` | route table from Step 4 |
| 7 | Routes | Every route answers (not 404/hang) | curl each route |
| 8 | Auth | Sign + verify use same loaded secret; payload key matches read key | auth files |
| 9 | Auth | Protected routes return 401 with no token, 401 with bad token, 200 with good token | 3 curls per protected route |
| 10 | Auth | Password hashed once, `select: false` handled, `compare` awaited; password never in responses | model + login + `/me` response |
| 11 | Handlers | Every async handler catches errors (try/catch + `next` or wrapper); every `res.*` returns | grep `async (req` |
| 12 | Handlers | Bad input returns 400, not 500 (bad id, missing field, duplicate -> 409) | curls with bad input |
| 13 | DB | No un-awaited queries; indexes on unique fields | grep models + queries |
| 14 | Safety | No secrets hardcoded or committed; `.env` in `.gitignore` | grep + `.gitignore` |
| 15 | Safety | `npm audit` has no high/critical | `npm audit --omit=dev` |
| 16 | Tests | Existing tests pass (if any) | `npm test` output |

Score = passed / applicable checks. Mark a check N/A only if that layer doesn't exist (e.g. no auth at all), and say why.

### Fix loop

1. Run all checks; record start score.
2. Fix one fail at a time, smallest change, upstream layer first (boot -> middleware -> routes -> auth -> handlers -> DB).
3. Re-run that check's proof. Then re-run checks 1 and 7 so the fix didn't break boot or routes.
4. Repeat until 100% or only blocked items remain.
5. Don't change behavior the user didn't ask for (API shape, response fields) except to fix a real bug - list any such change in the report.

### Health report (output contract)

Give the user exactly this, in this order:

```
🩺 BACKEND HEALTH REPORT - <project>

Before: 9/16 (56%)   After: 16/16 (100%)   ✅

🗺️ Map
<Step 0 diagram, every box ✅ or ❌>

🔧 What I fixed
| # | Problem (simple words) | Where | Fix | Proof |
|---|---|---|---|---|
| 4 | Letter opener came after signs, so notes were empty | app.js:12 | moved express.json() above routes | POST /api/auth/login -> 200 |
| 9 | Guard let in people with no sticker | routes/users.js:8 | added protect to GET /me | no token -> 401 |

⚠️ Still open (only if any)
| # | Problem | Why not fixed | What user must do |

🧪 Proof run
<last startup log + curl status lines, trimmed>
```

Each "Problem" is one plain sentence a beginner understands, using the Step 0 story words. Never write 100% unless every applicable check has proof in this run; if items are blocked, the report shows the real score.

## Done means

Re-run the exact Step 1 request and show the new status code and body. Also hit one unauthenticated and one bad-input request to prove the error paths return the right codes.
