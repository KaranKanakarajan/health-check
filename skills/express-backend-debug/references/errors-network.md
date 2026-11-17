# Errors devs understand + Network panel

Every error, from any layer, leaves the server in ONE shape, with the right status code, a stable `code`, a plain message, a hint for the fix, and a `requestId` that matches the server log line. This is also what devs see in the Network panel's Response tab.

```json
{
  "success": false,
  "message": "Some fields are missing or wrong",
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Some fields are missing or wrong",
    "details": { "email": "Path `email` is required." },
    "hint": "Send all required fields in the JSON body",
    "method": "POST",
    "path": "/api/auth/register",
    "requestId": "3f1c9a2e-..."
  }
}
```

Code: copy `templates/AppError.js` -> `utils/AppError.js`, `templates/errors.js` -> `middleware/errors.js`. Wire: `requestId` -> `cors` -> parsers -> routes -> `notFound` -> `errorHandler`. Throw on purpose: `throw new AppError(403, 'NOT_OWNER', 'You can only edit your own posts')`.

Frontend side - show the message, not "Request failed with status code 400":

```js
const msg = err.response?.data?.error?.message ?? err.message;   // axios
const id  = err.response?.headers?.['x-request-id'];              // quote this in bug reports
```

## Network panel

When a frontend calls this backend, collect what DevTools' Network tab shows: it's the ground truth of what the browser sent and got back. If the frontend can run, open it with your agent's browser tool (Playwright MCP: `browser_navigate`, do the failing action, then `browser_network_requests` for the list and `browser_network_request` for one request's headers and body; Antigravity: its built-in browser; or a headless Playwright script that logs `page.on('response')`). Otherwise ask the user for the failing row's Status, Headers and Response tabs (or a HAR file).

| Network tab shows | Meaning | Look at |
|---|---|---|
| `(failed) net::ERR_CONNECTION_REFUSED` | Nothing listening on that host/port | Server running? Same port as frontend's API URL? |
| `net::ERR_NAME_NOT_RESOLVED` | Bad host in API URL | Frontend env var for the API base URL |
| Status `CORS error` | Browser blocked the response | The `OPTIONS` row just above it first, then cors.md |
| `OPTIONS` row 401/404/500 | Preflight blocked | cors.md, "Preflight gets 401/404/500" |
| `(pending)` forever | Server never answered | Handler missing `res.*`, middleware missing `next()`, async error not caught |
| 404 with HTML `Cannot GET /api/x` | Express default 404 - route not mounted and no `notFound` handler | routes section + errors-network.md |
| 401 | Token missing or bad | Request Headers: is `Authorization: Bearer ...` there? Auth section |
| 400 / 409 / 422 | Client sent bad data | Response tab -> `error.details` |
| 413 | Body too large | `express.json({ limit })` / multer limits |
| 500 | Server bug | Response -> `error.requestId` -> grep server log for it |
| "Provisional headers are shown" | Request never finished (blocked, CORS, ad-blocker, cancelled) | Console tab for the reason |
| `Mixed Content` in console | https page calling http API | Use https API URL |

Every failed request found goes in the report's "🌐 Network panel" table (see report.md).
