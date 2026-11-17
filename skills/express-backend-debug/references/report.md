# Health report template

Give the user exactly this, in this order:

```
🩺 BACKEND HEALTH REPORT - <project>

Before: 11/23 (48%)   After: 23/23 (100%)   ✅
🩺 GET /health -> 200 {"status":"ok", database up 3ms}

🗺️ Map
<map.md diagram, every box ✅ or ❌>

🔧 What I fixed
| # | Problem (simple words) | Where | Fix | Proof |
|---|---|---|---|---|
| 4 | Letter opener came after signs, so notes were empty | app.js:12 | moved express.json() above routes | POST /api/auth/login -> 200 |
| 9 | Guard let in people with no sticker | routes/users.js:8 | added protect to GET /me | no token -> 401 |
| 17 | Front door said "no" to the app because of a "/" at the end of its address | .env CLIENT_URL | removed trailing slash | OPTIONS -> 204, Allow-Origin: http://localhost:5173 |
| 19 | Errors came back as an HTML page nobody could read | app.js:40 | added notFound + errorHandler | GET /api/nope -> 404 ROUTE_NOT_FOUND json |

🌐 Network panel (what the browser saw)
| Method | URL | Status before | Dev saw | Real cause | Status now |
|---|---|---|---|---|---|
| OPTIONS | /api/users/me | 401 | "CORS error" | auth ran on preflight | 204 ✅ |
| POST | /api/auth/login | 500 | "Request failed" | bad JSON body crashed parser | 400 INVALID_JSON ✅ |

🧾 Error guide for devs (codes this API now returns)
| Code | Status | Means | Fix on client |
|---|---|---|---|
| VALIDATION_FAILED | 400 | Missing/wrong fields | Read error.details |
| TOKEN_EXPIRED | 401 | Login expired | Log in again |

⚠️ Still open (only if any)
| # | Problem | Why not fixed | What user must do |

🧪 Proof run
<last startup log + curl status lines, trimmed>
```

Each "Problem" is one plain sentence a beginner understands, using the map.md story words. Never write 100% unless every applicable check has proof in this run; if items are blocked, the report shows the real score.
