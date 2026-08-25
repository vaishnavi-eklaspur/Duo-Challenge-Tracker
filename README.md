# ⛓️ Duo Challenge Tracker

*Two people. One chain. Don't break it.*

A habit accountability app for two people doing a shared daily challenge — 14 to 21 days. Built around the psychology of visual momentum, social accountability, and just enough competitive pressure to keep you honest.

![React](https://img.shields.io/badge/React_18-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Neon](https://img.shields.io/badge/Neon-00E599?style=flat-square&logo=postgresql&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-F5A623?style=flat-square)

**[Live App](https://duo-challenge-tracker-brown.vercel.app)** · **[Report Bug](https://github.com/vaishnavi-eklaspur/Duo-Challenge-Tracker/issues)** · **[Request Feature](https://github.com/vaishnavi-eklaspur/Duo-Challenge-Tracker/issues)**

---

## 💡 The Idea

Most habit apps are built for individuals. But accountability is a social contract — it works better when someone else is watching.

This app puts two people in the same space, each with their own tasks and a shared timeline. A grid fills up amber as days get completed. Skipped days stay dark red. That visual tension is the whole product.

No sign-up, no passwords. Each browser gets a generated identity, each challenge gets a unique invite link, and one person can run multiple challenges with different friends simultaneously — all completely isolated.

---

> ## 👤 Just here to use the app?
>
> **No setup. No installation. No account. Nothing.**
>
> ### **→ [Open the App](https://duo-challenge-tracker-brown.vercel.app)**
>
> ```
> 1. Click "Start a new challenge"
> 2. Set your name, tasks, duration, and start date
> 3. Copy the unique room link from the waiting screen
> 4. Send it to your partner — they open it and set their own tasks
> 5. Challenge starts automatically ✦
> ```
>
> That's it. Everything is already live and hosted.
> **You can stop reading here.**
>
> ⚠️ One catch of the no-account design: your identity lives in this browser's
> localStorage. Open the app on a different device (or clear site data) and
> you're a stranger to your own challenge — stick to one browser.

---

> ## 🧑‍💻 Are you a developer looking to self-host?
>
> You'll need your own free [Neon](https://neon.tech) project and a Vercel account.
> **Everything you need is in the [Self-Hosting](#-self-hosting) section below.**

---

## ✨ Features

**👤 Identity without accounts**
- No sign-in at all — a UUID is generated per browser and kept in localStorage
- Zero onboarding friction: open link, type name, go
- Trade-off: identity is per-browser (see the warning above)

**🏠 Dashboard**
- Lists every active challenge this browser's identity is part of
- Each card shows partner name, duration, current day, and completion %
- One-click to create a new challenge room

**🔗 Multi-Room Support**
- Every challenge gets a unique 6-character room ID
- URL structure: `/#/room/AbC123`
- Share the link — partner opens it and joins that specific room
- Run multiple challenges with different friends simultaneously, all isolated

**✅ Daily Check-in**
- Card-based task toggles with a left-to-right fill sweep animation
- Optimistic UI — state updates instantly, database upserts in background
- All tasks done → confetti burst + persistent perfect day banner
- Partner's section refreshes every 4 seconds via polling

**⛓️ The Chain**
- GitHub contribution graph style grid across the full challenge duration

| Cell | Meaning |
|---|---|
| 🟨 Full amber | Perfect day — all tasks done |
| 🟫 Dim amber | Partial — some tasks done |
| 🟥 Dark red | Gap day — nothing done |
| ⬛ Empty | Future day |

- Hover tooltips showing per-day completion for both users
- Animated SVG progress rings with streak count and perfect day tally

**🔔 Nudge System**
- 16 priority-ordered contextual nudges computed entirely client-side from live state
- Uses actual names and actual numbers — never generic motivational copy
- Time-aware, partner-aware, streak-aware, gap-aware, milestone-aware

> *"Priya finished all 5 today. You haven't started."*

**⚙️ Settings**
- Tasks editable during onboarding only — locked permanently once the challenge start date is reached
- View partner's tasks (read-only)
- Reset today's check-ins

**🏁 End Screen**
- Final stats for both users with personalised closing copy based on completion rate
- One-click PNG export of the completed chain grid via html2canvas

---

## 🧠 The Psychology

Every design decision has a behavioral reason.

| Principle | Implementation |
|---|---|
| **Seinfeld Method** | The grid makes streaks viscerally visible — filling it is genuinely satisfying |
| **Loss Aversion** | Gap days are dark red by design. The amber chain pulls you forward |
| **Social Accountability** | Seeing your partner's progress creates pressure without punishment |
| **Identity Reinforcement** | Nudges say *"You're ahead"* not *"Great job"* — identity language, not cheerleading |
| **Progress Framing** | Stats always show what you did — never *"you missed X days"* |
| **Zeigarnik Effect** | An incomplete grid creates cognitive tension that motivates completion |

---

## 🛠️ Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React 18 + Vite | Fast builds, single-file component architecture |
| Styling | Tailwind CSS | Utility-first, zero custom CSS files |
| Identity | localStorage UUID | No accounts, no OAuth, zero sign-up friction |
| Database | Neon Postgres via the [Data API](https://neon.tech/docs/data-api/get-started) | Serverless Postgres queried straight from the browser over PostgREST |
| Query client | `@supabase/postgrest-js` | Neon's Data API speaks PostgREST, so the standalone PostgREST client drives every query (no auth/realtime/storage bundle) |
| Sync | 4-second polling | Two users, tiny payloads — websockets would be overkill |
| Deployment | Vercel | Zero-config Vite detection, auto-deploys on every push to main |
| Animations | CSS keyframes + canvas-confetti | No animation library overhead |
| Export | html2canvas | Client-side PNG export, no backend needed |

> No external UI library. No routing library. No environment variables. Screen state via `useState`. All business logic computed client-side.

**How auth-less database access works:** the app ships a static, public RS256 JWT (same trust model as a Supabase anon key). Neon's Data API verifies it against a JWKS file hosted at `/jwks.json` on the deployed site. There is no per-user auth — anyone with the app can write. Fine for a tracker between friends; add real auth if griefing ever matters.

---

## 🗄️ Schema

```sql
challenge_meta     -- one row per room
                   -- room_id (unique), user_a_id, user_b_id, start_date, duration_days

challenge_config   -- one row per (room × user)
                   -- room_id, user_id, user_name, tasks[], task_count
                   -- UNIQUE (room_id, user_id)

challenge_logs     -- one row per (room × user × day × task)
                   -- room_id, user_id, day, task_index, completed
                   -- UNIQUE (room_id, user_id, day, task_index) → safe upserts
```

---

## 🧑‍💻 Self-Hosting

**Prerequisites:** Node.js 18+, a free [Neon](https://neon.tech) account, a [Vercel](https://vercel.com) account

**1. Clone and install**

```bash
git clone https://github.com/vaishnavi-eklaspur/Duo-Challenge-Tracker.git
cd Duo-Challenge-Tracker
npm install
```

**2. Create the Neon tables**

Neon Console → SQL Editor → run:

```sql
CREATE TABLE challenge_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text UNIQUE NOT NULL,
  user_a_id uuid NOT NULL,
  user_a_name text NOT NULL,
  user_b_id uuid,
  user_b_name text,
  start_date date NOT NULL,
  duration_days integer NOT NULL CHECK (duration_days IN (14, 16, 18, 21))
);

CREATE TABLE challenge_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  tasks text[] NOT NULL,
  task_count integer NOT NULL CHECK (task_count >= 1 AND task_count <= 10),
  UNIQUE (room_id, user_id)
);

CREATE TABLE challenge_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  user_id uuid NOT NULL,
  day integer NOT NULL,
  task_index integer NOT NULL,
  completed boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (room_id, user_id, day, task_index)
);

GRANT ALL ON challenge_meta, challenge_config, challenge_logs TO authenticated;
```

**3. Enable the Data API**

Neon Console → your branch → **Data API** → enable. Note the Data API base URL (looks like `https://<endpoint>.apirest.<region>.aws.neon.tech/neondb`).

**4. Set up the static JWT**

The Data API requires a JWT verified against a JWKS URL. This app uses one long-lived public token instead of per-user auth:

1. Generate an RS256 keypair.
2. Publish the public key as a JWKS file at `https://your-domain/jwks.json` (put it in `public/jwks.json` so Vercel serves it).
3. Point the Data API's auth provider at that JWKS URL in the Neon console.
4. Sign a long-expiry JWT with the private key, with claim `"role": "authenticated"`. This token is public by design — it grants the same access to everyone.

**5. Point the app at your backend**

There are no environment variables. Edit the two constants at the top of [src/App.jsx](src/App.jsx) — the Data API URL and the JWT.

**6. Run locally**

```bash
npm run dev
# → http://localhost:5173
```

**7. Deploy**

```bash
# Push to GitHub → Vercel → New Project → import repo → Deploy
# No env vars needed. Every push to main triggers an automatic redeploy.
```

---

## 📁 Project Structure

```
Duo-Challenge-Tracker/
├── src/
│   ├── App.jsx        # entire app — all components colocated (DB client at top)
│   ├── main.jsx       # React entry point
│   └── index.css      # Tailwind directives + CSS variables
├── public/            # static assets incl. jwks.json
├── index.html         # Google Fonts — Syne + DM Mono
├── vite.config.js
└── tailwind.config.js
```

---

## 🗺️ Roadmap

**Completed**
- [x] Core challenge flow — onboarding, daily check-ins, partner sync
- [x] Chain grid, progress rings, 16-condition nudge system
- [x] Zero-friction identity — no accounts, localStorage UUID per browser
- [x] Multi-room support — unique invite links per challenge
- [x] Dashboard listing all active challenges
- [x] Immutable tasks after challenge start date
- [x] End screen with PNG export

**Coming next**
- [ ] End-of-day push notifications when tasks are incomplete
- [ ] Weekly summary card — auto-generated, shareable as image
- [ ] Mobile-first responsive redesign

**Future scope**
- [ ] Optional real accounts — carry your identity across devices
- [ ] Streak freeze days — one intentional skip per week that doesn't break the chain
- [ ] In-app reactions — tap 🔥 or 👀 on your partner's completed day
- [ ] Challenge templates — pre-built task sets like "DSA grind" or "Morning routine"
- [ ] Challenge history — archived past challenges with final stats on the dashboard
- [ ] Multi-person rooms — accountability groups of 3 to 5
- [ ] Public challenge profiles — shareable proof-of-work page for completed chains
- [ ] React Native mobile app — same backend, native mobile experience

---

## ♻️ Resetting a challenge

Run in the Neon SQL Editor:

```sql
DELETE FROM challenge_logs WHERE room_id = 'YOUR_ROOM_ID';
DELETE FROM challenge_config WHERE room_id = 'YOUR_ROOM_ID';
DELETE FROM challenge_meta WHERE room_id = 'YOUR_ROOM_ID';
```

---

Built by [Vaishnavi Eklaspur](https://github.com/vaishnavi-eklaspur) · MIT License

*The grid doesn't lie.*
