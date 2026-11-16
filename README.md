# Health Check Skills for Claude Code

Two [Claude Code](https://claude.com/claude-code) skills that check a web app's health, fix what is broken, and give you a plain-language report of what they fixed.

| Skill | What it checks |
|---|---|
| [`express-backend-debug`](skills/express-backend-debug/SKILL.md) | Node.js / Express backends: server boot and env vars, middleware order, routes, JWT auth, async error handling, database errors, basic security. 16 checks. |
| [`frontend-ui-health`](skills/frontend-ui-health/SKILL.md) | Web frontends (React, Vite, Next.js, plain HTML): every button, link and form, console and network errors, responsive layout at phone (375px), tablet (768px) and desktop (1440px), plus a senior-level UX review: spacing and type scale, contrast, consistency, loading/empty/error states, action feedback, form UX, focus and copy. 28 checks. |

## What you get

- **A kid-simple map of your app.** The backend is drawn as a restaurant (door = CORS, guard = auth, cook = handler, fridge = database). The frontend is drawn as a house (rooms = pages, buttons, map sign = navbar). Each part gets a ✅ or ❌.
- **A fix loop.** The skill runs every check, fixes one failure at a time, re-checks, and keeps going until every check passes or a fix needs your input.
- **A health report.** It shows the before and after score (for example `9/16 → 16/16`), each fix in plain words with file, line and proof, anything still open with what you need to do, and screenshots for the UI.

A check only counts as passed with proof from that run, such as command output, a browser snapshot or a file line. The report never says 100% without it.

## Install

In Claude Code, run:

```
/plugin marketplace add KaranKanakarajan/health-check
/plugin install health-check@health-check
```

Restart Claude Code if the commands don't show up yet. To get new versions later, run `/plugin marketplace update health-check`.

<details>
<summary>Manual install (without the plugin system)</summary>

Copy the skill folders into your skills directory. Without the plugin, the commands have no prefix (`/frontend-ui-health`).

```bash
git clone https://github.com/KaranKanakarajan/health-check.git
cp -r health-check/skills/* ~/.claude/skills/
```

</details>

## Use

In Claude Code, inside your project:

```
/health-check:express-backend-debug   check backend health and give me the report
/health-check:frontend-ui-health      check the UI on mobile, tablet and desktop and fix it
```

Claude also loads them on its own when you say things like "check my backend health", "why does login return 401", "draw my backend simply", or "the navbar is broken on mobile".

## Requirements

- **Backend skill:** a Node.js / Express project. It works best when the server can run locally so the skill can send real requests.
- **Frontend skill:** the [Playwright MCP](https://github.com/microsoft/playwright-mcp) server, so Claude can open a real browser. Without it, the skill runs only the code checks and marks the browser checks as "not run".

## Notes

- The skills fix bugs. They don't redesign your app or change your API shape unless that is the bug, and the report lists any such change.
- When the UI fails because of a backend error (CORS, 401, 500), the frontend skill hands off to the backend skill.

## License

[MIT](LICENSE)
