# Kid-simple map (Step 0)

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

If `/health` exists, add: `🩺 DOCTOR [/health] -> "Are you OK?" yes (200) or "something hurts" (503)`
