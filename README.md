<<<<<<< HEAD
# Duo Challenge Tracker

A 14–21 day duo accountability challenge tracker. Dark theme, minimalistic UI, real-time shared state via Supabase.

## Supabase Setup

### 1. Create Tables

Run this SQL in your Supabase SQL Editor (copy-paste the entire block):

```sql
-- Enable uuid generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Challenge metadata (always exactly ONE row)
=======
# 🔥 Duo Challenge Tracker

A minimalistic dark-themed accountability app for two people doing a shared daily challenge together — 14 to 21 days, with real-time progress tracking, motivational nudges, and a satisfying completion grid.

Built with React + Supabase. Deployed on Vercel.

---

## 👥 For Users — How to Use the App

### Starting a challenge with your friend

1. **Open the app** (Vercel URL)
2. **First person** enters their name, adds their daily tasks (1–10), picks challenge duration (14/16/18/21 days) and start date
3. A **waiting screen** appears with the app URL — copy it and send it to your friend
4. **Second person** opens the same URL, enters their name and their own tasks
5. Once both are set up — **the challenge begins automatically**

### Daily use

- Open the app every day
- Check off your tasks by tapping/clicking each card
- See your partner's progress update in real time
- Complete all your tasks → get a 🎉 confetti celebration
- Switch to the **CHAIN tab** to see your progress grid and stats

### The Grid

- 🟨 **Amber** = perfect day (all tasks done)
- 🟫 **Partial** = some tasks done
- 🔴 **Dark red** = gap day (nothing done)
- ⬛ **Empty** = future day

Gaps are intentionally uncomfortable to look at. Complete the chain.

### Settings

- Tap the ⚙️ gear icon anytime to edit your task names, view your partner's tasks, or reset today's check-ins

---

## 🛠 For Developers — Self-Hosting Guide

### Tech Stack

- **React** (Vite)
- **Tailwind CSS**
- **Supabase** (Postgres + Realtime)
- **Vercel** (deployment)

### Prerequisites

- Node.js 18+
- A free [Supabase](https://supabase.com) account
- A free [Vercel](https://vercel.com) account

---

### Step 1 — Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/duo-challenge-tracker.git
cd duo-challenge-tracker
npm install
```

---

### Step 2 — Create Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Open **SQL Editor** and run this entire block:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

>>>>>>> 1954a6e4a4b4547961fdd555a306995fe3c0dee1
CREATE TABLE challenge_meta (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_a_name text NOT NULL,
  user_b_name text,
  start_date date NOT NULL,
  duration_days integer NOT NULL CHECK (duration_days IN (14, 16, 18, 21))
);

<<<<<<< HEAD
-- Per-user task configuration
=======
>>>>>>> 1954a6e4a4b4547961fdd555a306995fe3c0dee1
CREATE TABLE challenge_config (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_name text UNIQUE NOT NULL,
  tasks text[] NOT NULL,
  task_count integer NOT NULL CHECK (task_count >= 1 AND task_count <= 10)
);

<<<<<<< HEAD
-- Daily task completion logs
=======
>>>>>>> 1954a6e4a4b4547961fdd555a306995fe3c0dee1
CREATE TABLE challenge_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_name text NOT NULL,
  day integer NOT NULL,
  task_index integer NOT NULL,
  completed boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_name, day, task_index)
);
```

<<<<<<< HEAD
### 2. Disable RLS

RLS must be OFF on all three tables. In Supabase Dashboard:

1. Go to **Authentication → Policies**
2. For each table (`challenge_meta`, `challenge_config`, `challenge_logs`), ensure RLS is **disabled**

### 3. Enable Realtime on `challenge_logs`

1. Go to **Database → Replication**
2. Find `challenge_logs` in the table list
3. Toggle **Realtime** ON for `challenge_logs` only

## Local Development

### 1. Environment Variables

Copy the example env file and fill in your Supabase credentials:
=======
3. Go to **Database → Tables** → find `challenge_logs` → click ⋮ → Edit table → enable **Realtime** → Save
4. Go to **Authentication → Policies** → disable RLS on all 3 tables

---

### Step 3 — Set up environment variables
>>>>>>> 1954a6e4a4b4547961fdd555a306995fe3c0dee1

```bash
cp .env.local.example .env.local
```

<<<<<<< HEAD
Edit `.env.local`:
=======
Open `.env.local` and fill in:
>>>>>>> 1954a6e4a4b4547961fdd555a306995fe3c0dee1

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

<<<<<<< HEAD
You can find these in your Supabase Dashboard under **Settings → API**.

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Development Server
=======
Find both values in Supabase → **Settings → API Keys**.

---

### Step 4 — Run locally
>>>>>>> 1954a6e4a4b4547961fdd555a306995fe3c0dee1

```bash
npm run dev
```

<<<<<<< HEAD
Open http://localhost:5173 in your browser.

## Deploy on Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repository
3. In the Vercel project settings, add these **Environment Variables**:
   - `VITE_SUPABASE_URL` → your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` → your Supabase anon/public key
4. Deploy

Vercel will auto-detect the Vite framework and build with `npm run build`.

## How to Share with Your Partner

1. Deploy the app to Vercel first
2. Open the Vercel URL — complete onboarding as the first user (set your name, tasks, duration, start date)
3. On the waiting screen, copy the page URL
4. Send the URL to your partner
5. Your partner opens the same URL and completes their onboarding (sets their own name and tasks)
6. Once both users are set up, the challenge begins automatically

## Resetting a Challenge

To start fresh, delete all rows from all three tables in Supabase SQL Editor:
=======
Open [http://localhost:5173](http://localhost:5173)

---

### Step 5 — Deploy to Vercel

1. Push your repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → import your repo
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Click **Deploy**

Vercel auto-detects Vite — no config needed.

---

### Resetting a challenge

Run this in Supabase SQL Editor to start fresh:
>>>>>>> 1954a6e4a4b4547961fdd555a306995fe3c0dee1

```sql
DELETE FROM challenge_logs;
DELETE FROM challenge_config;
DELETE FROM challenge_meta;
```

<<<<<<< HEAD
Then clear `challenge_user_name` from localStorage in your browser (or use the "That's not me" button in Settings).
=======
Then clear `challenge_user_name` from your browser's localStorage (or use the "That's not me" button in Settings).

---

## 📄 License

MIT — use it, fork it, build on it.
>>>>>>> 1954a6e4a4b4547961fdd555a306995fe3c0dee1
