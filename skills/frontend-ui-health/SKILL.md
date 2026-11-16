---
name: frontend-ui-health
description: Use when the user asks to health-check, audit, test or fix a web frontend UI (React, Vite, Next.js, plain HTML) - buttons that do nothing, broken links or forms, components that look broken, layout broken on mobile or tablet, horizontal scroll on phone, overlapping or cut-off text, navbar not collapsing, console errors, UI that feels confusing, unpolished or inconsistent (spacing, fonts, colors, low contrast, missing loading/empty/error states, no feedback after actions), or "make the UI user friendly / 100% healthy like a senior frontend developer and give a report".
---

# Frontend UI Health

## Overview

Two jobs: make it **work** (checks 1-14), then make it **feel right** like a senior frontend developer would ship it (checks 15-28). Check the UI the way a user meets it: open it in a real browser, at phone, tablet and desktop size, click every button, and read the console. **A check passes only with evidence from this run** (a screenshot, a snapshot, a console log, or a file:line). Fix every fail, re-check, loop until 100% or blocked, then hand over the report.

Tools: Playwright MCP (`browser_navigate`, `browser_resize`, `browser_snapshot`, `browser_take_screenshot`, `browser_click`, `browser_fill_form`, `browser_console_messages`, `browser_network_requests`, `browser_evaluate`). If they aren't loaded, load them with ToolSearch. If no browser tool is available, say so and fall back to static checks only - and mark the browser checks as "not run", never as passed.

## Step 0: Start the app and draw the map (kid-simple)

1. Read `package.json`; start the dev server (`npm run dev` / `npm start`) in the background; note the URL. Start the backend too if the UI calls it.
2. Find every page (router config: `App.jsx` routes, `pages/`, `app/`) and the main components on each.
3. Draw the map as a house story a 5-year-old gets, with REAL names:

```
 🏠 <app name> = a house

 🚪 Front door        [/            -> Home.jsx]
 🛏️ Bedroom           [/login       -> Login.jsx]   🔑 needs key (auth)
 🍳 Kitchen           [/dashboard   -> Dashboard.jsx]

 On every wall:
   🧭 Map sign         [Navbar.jsx]   -> takes you to rooms
   🔘 Buttons          [Button.jsx]   -> make things happen
   📝 Note paper       [LoginForm.jsx]-> you write, it sends to the backend
   📞 Phone to kitchen [api.js -> http://localhost:5000/api]
```

When reporting, put ✅ or ❌ on each line.

## Step 1: The checks

Viewports: **phone 375x812**, **tablet 768x1024**, **desktop 1440x900**. Run checks 4-10 on every page at all three.

| # | Area | Check | Proof |
|---|---|---|---|
| 1 | Build | `npm run build` succeeds with no errors | command output |
| 2 | Build | Lint has no errors (`npm run lint`, if present) | command output |
| 3 | Console | No red errors or React key/prop warnings on any page | `browser_console_messages` |
| 4 | Buttons | Every button/link does something: navigates, opens, submits or changes state; none dead, none 404 | click each, snapshot after |
| 5 | Forms | Empty submit shows a message; valid submit works; button disables while loading; API errors are shown to the user | fill + submit |
| 6 | Network | No failed requests (4xx/5xx, CORS) on normal use | `browser_network_requests` |
| 7 | Responsive | No horizontal scroll | overflow script below |
| 8 | Responsive | Nothing cut off or overlapping; text readable (>=14px body on phone) | screenshot |
| 9 | Responsive | Navbar collapses to a working menu on phone/tablet; menu opens and closes | click + screenshot |
| 10 | Touch | Tap targets >= 44x44px on phone | tap-size script below |
| 11 | Components | Buttons have hover, focus, disabled and loading states; same style across the app | snapshot + code |
| 12 | Images | Images scale (`max-width: 100%`), have `alt`, don't stretch | screenshot + code |
| 13 | A11y | Every button/input has a name or label; Tab key reaches all controls in order | `browser_snapshot` |
| 14 | Viewport | `<meta name="viewport" content="width=device-width, initial-scale=1">` present | index.html |

### Senior UX review (checks 15-28)

Review every page the way a senior frontend developer reviews a PR: does a first-time user know what to do, does every action give feedback, does it look made by one careful person?

| # | Area | Check | Proof |
|---|---|---|---|
| 15 | Hierarchy | Each page has one clear main action (one primary button style); the page title says where you are | screenshot |
| 16 | Spacing | Spacing uses one scale (e.g. 4/8/12/16/24/32px or Tailwind steps); no random `13px`/`37px` values; even gaps between similar items | code grep + screenshot |
| 17 | Type | At most 2 font families; a clear size scale (body, h3, h2, h1); line-height 1.4-1.6 for body; line length <= ~75 characters | code + screenshot |
| 18 | Color | Text contrast >= 4.5:1 (>= 3:1 for large text and icons); colors come from a few tokens/variables, not dozens of one-off hex values | contrast script + code grep |
| 19 | Consistency | Same thing looks the same everywhere: buttons, inputs, cards, radius, shadows, icons from one set | screenshots side by side |
| 20 | Loading | Every data fetch shows a loading state (skeleton or spinner); no layout jump when data arrives | throttle/slow API + screenshot |
| 21 | Empty | Lists/tables with no data show a friendly empty state with a next step ("No tasks yet - Add task") | screenshot with empty data |
| 22 | Errors | Failed requests show a human message and a way to retry, not a blank page or raw error text | block API + screenshot |
| 23 | Feedback | Every action confirms it worked (toast, inline message, UI update); destructive actions ask to confirm | click + snapshot |
| 24 | Forms UX | Visible labels (not placeholder-only); right input types (`email`, `tel`, `password` with show/hide); inline errors next to the field; autofocus first field; Enter submits | snapshot + code |
| 25 | Navigation | Current page is highlighted in the nav; back button works; a 404 page exists; logo goes home | click + screenshot |
| 26 | Focus | Visible focus ring on every interactive element (never `outline: none` without a replacement) | Tab through + screenshot |
| 27 | Motion | Transitions 150-300ms; respects `prefers-reduced-motion`; nothing flashes or jumps | code |
| 28 | Copy | Button text says what happens ("Save changes", not "Submit"/"OK"); no lorem ipsum, typos or dev text ("test", "TODO") | snapshot text |

Score = passed / applicable checks (1-28).

### Scripts for `browser_evaluate`

Horizontal overflow (check 7):

```js
() => {
  const w = document.documentElement.clientWidth;
  const bad = [...document.querySelectorAll('body *')]
    .filter(el => el.getBoundingClientRect().right > w + 1)
    .slice(0, 15)
    .map(el => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} right=${Math.round(el.getBoundingClientRect().right)}`);
  return { scrolls: document.documentElement.scrollWidth > w, width: w, culprits: bad };
}
```

Small tap targets (check 10, run at phone size):

```js
() => [...document.querySelectorAll('button, a, input, select, [role="button"]')]
  .filter(el => el.offsetParent !== null)
  .map(el => ({ el, r: el.getBoundingClientRect() }))
  .filter(({ r }) => r.width < 44 || r.height < 44)
  .slice(0, 20)
  .map(({ el, r }) => `${el.tagName.toLowerCase()} "${(el.innerText || el.ariaLabel || '').trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`)
```

Low contrast text (check 18):

```js
() => {
  const lum = c => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const bg = el => { for (; el; el = el.parentElement) { const c = getComputedStyle(el).backgroundColor; if (!/rgba\(.*, 0\)|transparent/.test(c)) return c; } return 'rgb(255,255,255)'; };
  return [...document.querySelectorAll('body *')]
    .filter(el => el.offsetParent !== null && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
    .map(el => { const s = getComputedStyle(el); const a = lum(s.color), b = lum(bg(el)); const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); const large = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && +s.fontWeight >= 700); return { text: el.innerText.trim().slice(0, 30), ratio: +ratio.toFixed(2), need: large ? 3 : 4.5 }; })
    .filter(x => x.ratio < x.need)
    .slice(0, 20);
}
```

One-off spacing and colors (checks 16, 18):

```bash
# many distinct values = no system
grep -rhoE "(margin|padding|gap)[^;]*[0-9]+px" src | sort | uniq -c | sort -rn | head -30
grep -rhoE "#[0-9a-fA-F]{3,8}\b" src | sort | uniq -c | sort -rn | head -30
```

## Step 2: Fix loop

1. Run all checks; record start score; take a screenshot of each failing view (before).
2. Fix one fail at a time, smallest change. Typical fixes:
   - Overflow: fixed `width: 600px` -> `max-width: 100%`; flex row -> `flex-wrap: wrap` or column under `md`; tables in `overflow-x: auto` wrapper; long words `overflow-wrap: anywhere`.
   - Navbar: hide links under `md`, add a hamburger button with `aria-expanded`, close menu on link click.
   - Dead button: missing `onClick`, `type="button"` inside a form submitting by accident, wrong route path, handler not awaited.
   - Tap size: `min-height: 44px; padding` - don't shrink text.
   - API fails (CORS, 401, 500): that's the backend - use **express-backend-debug**.
3. Re-run that check at all three sizes, then re-run checks 1 and 3 so nothing else broke. Take the after screenshot.
4. Repeat until 100% or only blocked items remain (needs a design choice, missing asset, or backend the user owns).
5. Polish inside the user's existing look: same brand colors, fonts and layout idea, made consistent and clear. Typical UX fixes:
   - Pull repeated values into tokens (CSS variables or the Tailwind theme) and replace one-offs with the nearest scale step.
   - One shared `Button` with variants (primary, secondary, ghost, danger) and states (hover, focus-visible, disabled, loading spinner) used everywhere.
   - Add loading / empty / error states to every data view; add toasts or inline confirms after actions; confirm before delete.
   - Darken text or lighten backgrounds until contrast passes; keep the hue.
6. If a change would alter the brand or layout a lot (new color palette, new navigation pattern, page restructure), don't do it alone: list it under "💡 Senior suggestions" in the report with why, and ask the user.

## Step 3: UI health report (output contract)

```
🎨 FRONTEND HEALTH REPORT - <app>

Before: 12/28 (43%)   After: 28/28 (100%)   ✅
  Works (1-14): 7/14 -> 14/14     UX polish (15-28): 5/14 -> 14/14

📱 Sizes tested: phone 375 ✅ | tablet 768 ✅ | desktop 1440 ✅

🗺️ Map
<Step 0 house map, each line ✅ or ❌>

🔧 What I fixed
| # | Problem (simple words) | Where | Fix | Proof |
|---|---|---|---|---|
| 7 | Page slid sideways on phone | Hero.jsx:22 | width:600px -> max-width:100% | overflow script: scrolls=false at 375 |
| 4 | "Sign up" button did nothing | Navbar.jsx:41 | link pointed to /singup -> /signup | click -> Signup page |
| 21 | Empty task list showed a blank white box | TaskList.jsx:30 | added "No tasks yet" + Add button | screenshot with 0 tasks |
| 18 | Grey text was too light to read | index.css:8 | #aaa -> #595959 (4.6:1) | contrast script: 0 fails |

⚠️ Still open (only if any)
| # | Problem | Why not fixed | What user must do |

💡 Senior suggestions (bigger changes, need your OK)
| Idea | Why it helps | Effort |

📸 Screenshots: <before/after paths>
```

Each "Problem" is one plain sentence a beginner understands. Never write 100% unless every applicable check has proof from this run; if any browser check was not run, the report says so and shows the real score.

## Common mistakes

- Checking only desktop. Most layout bugs only show at 375px.
- Calling a button "working" because it has an `onClick` - click it and see what happens.
- Fixing a backend 500 in the frontend (hiding the error). Fix the backend.
- Leaving the dev server running - stop background servers when done.
