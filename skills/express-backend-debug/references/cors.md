# CORS deep check

The browser hides the real reason behind "CORS error". Reproduce it outside the browser with a preflight request, using the real frontend origin and the headers the frontend sends:

```bash
curl -i -X OPTIONS http://localhost:5000/api/users/me \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type"
```

Healthy answer: `204` (or `200`) with `Access-Control-Allow-Origin: http://localhost:5173` (exact, not `*` when cookies are used), `Access-Control-Allow-Credentials: true` (if cookies), and `Access-Control-Allow-Headers` listing `authorization`. Then repeat the real request with `-H "Origin: ..."` and check the same `Access-Control-Allow-Origin` header is on it, including on 4xx/5xx answers.

| What you see | Real cause | Fix |
|---|---|---|
| No `Access-Control-Allow-Origin` at all | `cors()` missing, after routes, or origin not in the list | `app.use(cors(...))` first; add origin to the list |
| Origin "almost" matches | Trailing slash (`http://localhost:5173/`), `localhost` vs `127.0.0.1`, wrong port (3000 vs 5173), http vs https | Compare byte for byte; store origins without trailing slash |
| `*` + cookies | Browser rejects wildcard with credentials | Explicit origin list + `credentials: true` on server AND `withCredentials`/`credentials: 'include'` on client |
| Preflight `OPTIONS` gets 401/404/500 | Auth middleware or a custom router runs before CORS on `OPTIONS` | `cors()` globally before auth; never auth `OPTIONS` |
| "Request header field x-... is not allowed" | Custom header not allowed | `allowedHeaders: ['Content-Type', 'Authorization', 'X-...']` |
| CORS error only when server crashes | Error thrown in a middleware ABOVE `cors()`, so the 500 has no CORS headers and the browser hides it | Keep `cors()` as the first `app.use` (only the request-id middleware above it) |
| CORS error on a URL that doesn't exist | Wrong API base URL; a different server (or none) answered | Check frontend `VITE_API_URL`/`REACT_APP_API_URL`; open the URL directly |

Setup: copy `templates/cors.js` into app.js in place of the old `cors()` line (allow-list from `CLIENT_URLS`, logs blocked origin).
