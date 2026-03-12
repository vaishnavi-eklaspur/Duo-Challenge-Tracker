# ⛓️ Duo Challenge Tracker

*Two people. One chain. Don't break it.*

A real-time habit accountability app for two people doing a shared daily challenge — 14 to 21 days. Built around the psychology of visual momentum, social accountability, and just enough competitive pressure to keep you honest.

![React](https://img.shields.io/badge/React_18-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-F5A623?style=flat-square)

**[Live Demo](https://duo-challenge-tracker-brown.vercel.app)** · **[Report Bug](https://github.com/vaishnavi-eklaspur/Duo-Challenge-Tracker/issues)** · **[Request Feature](https://github.com/vaishnavi-eklaspur/Duo-Challenge-Tracker/issues)**

---

## 💡 The Idea

Most habit apps are built for individuals. But accountability is a social contract — it works better when someone else is watching.

This app puts two people in the same space, each with their own tasks and a shared timeline. A grid fills up amber as days get completed. Skipped days stay dark red. That visual tension is the whole product.

Each person signs in with Google, sets their own tasks independently (1 to 10), and gets a unique invite link per challenge. One person can run multiple challenges with different friends simultaneously — all isolated.

---

## ✨ Features

**🔐 Authentication**
- Google OAuth via Supabase Auth — zero friction, no passwords
- Session-based identity throughout — no localStorage hacks
- RLS policies ensure users only see their own data

**🏠 Dashboard**
- Lists all active challenges the signed-in user is part of
- Each card shows partner name, duration, current day, and completion %
- One-click to start a new challenge room

**🔗 Multi-Room Support**
- Every challenge gets a unique 6-character room ID
- URL structure: `/#/room/AbC123`
- Share the link with your partner — they sign in and join that specific room
- One user can run multiple challenges with different friends, all completely isolated

**✅ Daily Check-in**
- Card-based task toggles with a left-to-right fill sweep animation
- Optimistic UI — state updates instantly, Supabase syncs in background
- All tasks completed → confetti burst + persistent perfect day banner
- Partner's section updates live as they check off tasks (websocket, no polling)

**⛓️ The Chain**
- GitHub contribution graph style grid across the full challenge duration

| Cell | Meaning |
|---|---|
| 🟨 Full amber | Perfect day — all tasks done |
| 🟫 Dim amber | Partial — some tasks done |
| 🟥 Dark red | Gap day — nothing done |
| ⬛ Empty | Future day |

- Hover tooltips showing both users' daily completion
- Animated SVG progress rings with streak and perfect day counts

**🔔 Nudge System**
- 16 priority-ordered contextual nudges computed from live state
- Uses actual names and actual numbers — never generic copy
- Time-aware, partner-aware, streak-aware, gap-aware, milestone-aware

> *"Priya finished all 5 today. You haven't started."*

**⚙️ Settings**
- Tasks are editable during onboarding only — locked permanently once the challenge starts
- View partner's tasks (read-only)
- Reset today's check-ins
- Sign out

**🏁 End Screen**
- Final stats for both users with personalised closing copy
- One-click PNG export of the completed chain grid

---

## 🧠 The Psychology

Every design decision has a behavioral reason.

| Principle | Implementation |
|---|---|
| **Seinfeld Method** | The grid makes streaks viscerally visible — filling it is genuinely satisfying |
| **Loss Aversion** | Gap days are dark red by design. The amber chain pulls you forward |
| **Social Accountability** | Seeing your partner's real-time progress creates pressure without punishment |
| **Identity Reinforcement** | Nudges say *"You're ahead"* not *"Great job"* — identity language, not cheerleading |
| **Progress Framing** | Stats show what you did — never *"you missed X days"* |
| **Zeigarnik Effect** | An incomplete grid creates cognitive tension that motivates completion |

---

## 🛠️ Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React 18 + Vite | Fast builds, single-file component architecture |
| Styling | Tailwind CSS | Utility-first, zero custom CSS files |
| Auth | Supabase Auth (Google OAuth) | Zero-friction sign in, session management out of the box |
| Database | Supabase Postgres | Managed Postgres with RLS, upsert-safe unique constraints |
| Realtime | Supabase Realtime | Websocket subscription — instant partner updates, no polling |
| Deployment | Vercel | Zero-config Vite detection, instant deploys on every push |
| Animations | CSS keyframes + canvas-confetti | No animation library overhead |
| Export | html2canvas | Client-side PNG grid export, no backend needed |

> No external UI library. No routing library. Screen state via `useState`. All business logic computed client-side from Supabase data.

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

RLS is enabled on all three tables — users can only read and write rows in rooms they belong to.

---

## 🏁 Getting Started

**Prerequisites:** Node.js 18+, a free [Supabase](https://supabase.com) account

**1. Clone and install**

```bash
git clone https://github.com/vaishnavi-eklaspur/Duo-Challenge-Tracker.git
cd Duo-Challenge-Tracker
npm install
```

**2. Create Supabase tables**

Go to Supabase → SQL Editor → run:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE challenge_meta (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id text UNIQUE NOT NULL,
  user_a_id uuid NOT NULL,
  user_a_name text NOT NULL,
  user_b_id uuid,
  user_b_name text,
  start_date date NOT NULL,
  duration_days integer NOT NULL CHECK (duration_days IN (14, 16, 18, 21))
);

CREATE TABLE challenge_config (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id text NOT NULL,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  tasks text[] NOT NULL,
  task_count integer NOT NULL CHECK (task_count >= 1 AND task_count <= 10),
  UNIQUE (room_id, user_id)
);

CREATE TABLE challenge_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id text NOT NULL,
  user_id uuid NOT NULL,
  day integer NOT NULL,
  task_index integer NOT NULL,
  completed boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (room_id, user_id, day, task_index)
);
```

**3. Enable RLS**

```sql
ALTER TABLE challenge_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rooms they are part of"
  ON challenge_meta FOR SELECT
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id OR user_b_id IS NULL);

CREATE POLICY "Authenticated users can insert rooms"
  ON challenge_meta FOR INSERT WITH CHECK (auth.uid() = user_a_id);

CREATE POLICY "Users can update rooms they are part of"
  ON challenge_meta FOR UPDATE
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

CREATE POLICY "Users can view configs in their rooms"
  ON challenge_config FOR SELECT
  USING (
    room_id IN (SELECT room_id FROM challenge_meta WHERE user_a_id = auth.uid() OR user_b_id = auth.uid())
    OR room_id IN (SELECT room_id FROM challenge_meta WHERE user_b_id IS NULL)
  );

CREATE POLICY "Users can insert their own config"
  ON challenge_config FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own config"
  ON challenge_config FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view logs in their rooms"
  ON challenge_logs FOR SELECT
  USING (room_id IN (SELECT room_id FROM challenge_meta WHERE user_a_id = auth.uid() OR user_b_id = auth.uid()));

CREATE POLICY "Users can insert their own logs"
  ON challenge_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own logs"
  ON challenge_logs FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own logs"
  ON challenge_logs FOR DELETE USING (auth.uid() = user_id);
```

**4. Enable Realtime**

Database → Replication → find `challenge_logs` → toggle Realtime ON

**5. Set up Google Auth**

- Supabase → Authentication → Providers → Google → enable
- Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com)
- Add Supabase callback URL as an authorised redirect URI
- Paste Client ID and Client Secret back into Supabase
- Set Site URL in Supabase → Authentication → URL Configuration to your Vercel URL

**6. Environment variables**

```bash
cp .env.local.example .env.local
```

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**7. Run**

```bash
npm run dev
# → http://localhost:5173
```

---

## 🚢 Deploying to Vercel

```bash
# Push to GitHub → Vercel → New Project → import repo
# Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY as environment variables
# Deploy — every subsequent push to main auto-deploys
```

---

## 🤝 Starting a challenge with a partner

```
1. Sign in with Google at your Vercel URL
2. Click "Start a new challenge" from the dashboard
3. Complete onboarding — display name, tasks (1–10), duration, start date
4. Copy the unique room URL from the waiting screen
5. Send to partner → they sign in and set their own tasks
6. Challenge starts automatically ✦
```

---

## 📁 Project Structure

```
Duo-Challenge-Tracker/
├── src/
│   ├── App.jsx        # entire app — all components colocated
│   ├── main.jsx       # React entry point
│   └── index.css      # Tailwind directives + CSS variables
├── index.html         # Google Fonts — Syne + DM Mono
├── vite.config.js
├── tailwind.config.js
└── .env.local.example
```

---

## 🗺️ Roadmap

- [x] Core challenge flow — onboarding, daily check-ins, real-time sync
- [x] Chain grid, progress rings, 16-condition nudge system
- [x] Google OAuth via Supabase Auth
- [x] Multi-room support — unique invite links per challenge
- [x] Dashboard listing all active challenges
- [x] Immutable tasks after challenge start date
- [x] Settings redirect after save
- [x] RLS policies on all tables
- [x] End screen with PNG export
- [ ] End-of-day push notifications
- [ ] Weekly summary view
- [ ] Mobile app (React Native, same Supabase backend)

---

## ♻️ Resetting a challenge

```sql
DELETE FROM challenge_logs WHERE room_id = 'YOUR_ROOM_ID';
DELETE FROM challenge_config WHERE room_id = 'YOUR_ROOM_ID';
DELETE FROM challenge_meta WHERE room_id = 'YOUR_ROOM_ID';
```

---

Built by [Vaishnavi Eklaspur](https://github.com/vaishnavi-eklaspur) · MIT License

*The grid doesn't lie.*
