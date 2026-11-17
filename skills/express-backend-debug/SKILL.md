---
name: express-backend-debug
description: Use when an Express/Node backend needs a health check, audit, fix-everything pass, /health route, or kid-simple map - or throws anywhere from routes to auth to DB (404 on real route, CORS/preflight error, 401 with valid token, req.body undefined, jwt errors, headers already sent, Mongoose/Prisma errors, crash on start, unclear error responses, failed requests in Network panel).
---

# Express Backend Debug

Bug lives in one layer, shows up later. Trace request layer by layer, prove each layer before blaming next. Fix upstream, not symptom.

`boot -> requestId -> cors -> parsers -> routes (/health first) -> auth -> handler -> DB -> response -> notFound -> errorHandler`

## Save tokens (always)

- **Talk short.** Caveman style in chat: small words, no filler, no recap. Code, paths, error names stay exact.
- **Load only what you need.** Open a reference file only when its layer is in play. Don't read all of them.
- **Copy, don't type.** For new code, copy from `templates/` with a shell `cp`, then edit the few lines that differ. Never retype a template.
- **Read narrow.** `grep -n` first, then read only the lines you need. Trim command output (`| tail -20`, `curl -s -o /dev/null -w "%{http_code}"`).
- **Batch.** Run independent checks in one shell command.

## Safety (never break real things)

- **Local/dev only.** Run checks against localhost or a dev server. A production or shared URL/DB -> ask first. Bad-input and register curls create data: use test emails (`hc-test-<time>@example.com`) and delete what you created.
- **Never stop or edit the user's real DB** to test "DB down". Start a second app instance with a dead URI instead (`MONGO_URI=mongodb://127.0.0.1:1/x PORT=5999 node server.js`), curl it, kill it.
- **Secrets stay secret.** Print only presence (`JWT_SECRET: set`), never values, in chat, logs or report. Remove any debug log that prints tokens, passwords or headers.
- **Don't clobber files.** Before copying a template, check the target exists (`ls`). Exists -> merge by hand. New -> `cp -n`.
- **Clean up.** Kill every server/process you started. Leave no temp files in the repo.

## No cheating (a fake 100% is worse than a real 70%)

| Shortcut | Not allowed because |
|---|---|
| Delete, skip (`.skip`, `xit`) or weaken a test to pass #16 | Hides the bug. Fix code, or report test as open |
| Mark a check N/A to raise the score | N/A only when that layer truly doesn't exist |
| Remove `protect`/auth so a route "answers" for #7 | Opens a security hole. 401 without token IS a pass |
| `cors({ origin: '*' })` or reflect any origin to pass #17 | Lets every site call the API. Use the allow-list |
| `npm audit fix --force` for #15 | Major-version jumps break the app. List the advisory as open |
| Catch-and-ignore errors, empty `catch {}` | Hides failures from #11/#19. Pass to `next(err)` |
| Claim pass from reading code when the check says curl | Proof column says what counts. Run it |

Same check still failing after 3 real attempts -> stop, mark it open with what you tried. No endless loop.

## Project fit

- **ESM** (`"type": "module"` or `import` in code): convert template `require`/`module.exports` to `import`/`export` while copying.
- **TypeScript**: copy as `.ts`, add types (`Request, Response, NextFunction`), keep logic.
- **Express 5**: async errors reach `next` on their own (no wrapper needed). `app._router` is gone - list routes from the router files instead.
- **Folder layout**: match the project (`src/routes`, `src/middleware`); fix relative import paths after copying.

## Files

| Need | Open |
|---|---|
| Kid-simple map of the backend | `references/map.md` |
| Boot, middleware order, routes, auth, handlers, DB, symptom table | `references/layers.md` |
| CORS error / preflight | `references/cors.md` |
| Clear error format, Network panel reading | `references/errors-network.md` |
| `/health` route | `references/health-route.md` |
| Final report layout | `references/report.md` |
| Code to drop in | `templates/AppError.js`, `errors.js`, `cors.js`, `health.js`, `protect.js` |

Paths are relative to this skill's folder.

## Debug one bug

1. Reproduce: exact `curl -i` + server log. Top stack frame in user code.
2. Find layer with symptom table in `layers.md`. Open only that section.
3. Fix smallest thing. Re-run same curl. Show status + body.

## Health check mode ("check health", "make 100% healthy", "audit")

Pass = proof from this run (command output or file:line). No proof, no pass.

| # | Check | Proof |
|---|---|---|
| 1 | Server starts clean | start log |
| 2 | dotenv first; every `process.env.X` set; `.env.example` lists them | grep vs `.env` |
| 3 | DB connects before `listen`; clear exit on fail | entry file + log |
| 4 | Order: requestId -> cors -> parsers -> routes -> notFound -> errorHandler | app.js lines |
| 5 | Error handler 4 args, last | app.js line |
| 6 | Routers exported + mounted; no doubled prefix; `/me` before `/:id` | route list |
| 7 | Every route answers (no 404/hang) | curl each |
| 8 | Same JWT secret sign/verify; payload key matches | auth files |
| 9 | Protected: no token 401, bad token 401, good 200 | 3 curls |
| 10 | Hash once; `+password` select; `await compare`; no password in responses | model + curl |
| 11 | Async handlers catch -> `next(err)`; every `res.*` returns | grep `async (req` |
| 12 | Bad input 400, duplicate 409, not 500 | bad-input curls |
| 13 | DB calls awaited; unique indexes | grep |
| 14 | No hardcoded secrets; `.env` gitignored | grep |
| 15 | `npm audit --omit=dev` no high/critical | output |
| 16 | Tests pass (if any) | `npm test` |
| 17 | Preflight from real origin -> 204 + exact Allow-Origin | `cors.md` curl |
| 18 | 4xx/5xx also carry CORS headers | curl bad route with Origin |
| 19 | All errors in one JSON shape (code, message, hint, requestId); no HTML pages | curls |
| 20 | Broken JSON -> 400 `INVALID_JSON` | curl `-d '{bad'` |
| 21 | One log line per error with requestId; prod hides stack | log |
| 22 | Network panel clean on normal use (N/A if no frontend) | `errors-network.md` |
| 23 | Public `GET /health`: 200 up, 503 when DB down, no secrets | both curls |

Score = passed / applicable. N/A only if layer doesn't exist; say why.

**Fix loop:** fix one fail, smallest change, upstream first -> re-run its proof + checks 1 and 7 -> repeat until 100% or blocked (needs secret, paid service, or user decision). Missing piece (error handler, `/health`, CORS allow-list)? Copy its template. Keep API shape; error JSON keeps top-level `message` so old frontends still work. List any shape change in report.

**Report:** use `references/report.md`. Problems in one plain sentence using map story words. Never claim 100% without proof for every applicable check.

## Done

Re-run the first failing request, one no-token request, one bad-input request. Show status codes.
