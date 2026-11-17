# Layer by layer

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
const AppError = require('./utils/AppError');
const { requestId, errorHandler } = require('./middleware/errors');

const app = express();

// 0. Tag every request so errors and logs match (errors-network.md).
app.use(requestId);
// 1. CORS before routes. credentials:true needs an explicit origin, never '*' (full setup: references/cors.md).
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
// 2. Body + cookie parsers before routes, or req.body / req.cookies is undefined.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 3. Routes. /health first - public, no auth (health-route.md).
app.use('/health', require('./routes/health'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));

// 4. 404 for unmatched routes - after all routes (full version in errors-network.md).
app.use((req, res, next) => next(new AppError(404, 'ROUTE_NOT_FOUND', `No route for ${req.method} ${req.originalUrl}`)));

// 5. Error handler - LAST, and MUST have 4 args or Express treats it as normal middleware.
app.use(errorHandler); // errors-network.md

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


```js
Auth middleware: `templates/protect.js`.

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
