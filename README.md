# Duo Challenge Tracker

A 14–21 day duo accountability challenge tracker with Google Auth, multi-room support, dark theme, and real-time shared state via Supabase.

Built with React + Supabase. Deployed on Vercel.

---

## How It Works

1. **Sign in with Google** — authentication is handled by Supabase Auth
2. **Start a new challenge** from your dashboard — generates a unique room link
3. **Share the link** with your partner — they sign in and join the same room
4. **Track daily tasks** — check off tasks, see your partner's progress in real-time
5. **View the chain** — a visual grid showing completion over the full challenge

---

## Supabase Setup

### 1. Create Tables

Run this SQL in your Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Challenge metadata (one row per room)
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

-- Per-user task configuration (scoped to room + user)
CREATE TABLE challenge_config (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id text NOT NULL,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  tasks text[] NOT NULL,
  task_count integer NOT NULL CHECK (task_count >= 1 AND task_count <= 10),
  UNIQUE (room_id, user_id)
);

-- Daily task completion logs (scoped to room + user)
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

### 2. Enable Google Auth

1. Go to **Authentication → Providers** in Supabase Dashboard
2. Enable **Google** provider
3. Set up OAuth credentials in Google Cloud Console
4. Add the redirect URL from Supabase to your Google OAuth config

### 3. Enable RLS (Row Level Security)

```sql
-- Enable RLS on all tables
ALTER TABLE challenge_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_logs ENABLE ROW LEVEL SECURITY;

-- challenge_meta policies
CREATE POLICY "Users can view rooms they are part of"
  ON challenge_meta FOR SELECT
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id OR user_b_id IS NULL);

CREATE POLICY "Authenticated users can insert rooms"
  ON challenge_meta FOR INSERT
  WITH CHECK (auth.uid() = user_a_id);

CREATE POLICY "Users can update rooms they are part of"
  ON challenge_meta FOR UPDATE
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- challenge_config policies
CREATE POLICY "Users can view configs in their rooms"
  ON challenge_config FOR SELECT
  USING (
    room_id IN (SELECT room_id FROM challenge_meta WHERE user_a_id = auth.uid() OR user_b_id = auth.uid())
    OR room_id IN (SELECT room_id FROM challenge_meta WHERE user_b_id IS NULL)
  );

CREATE POLICY "Users can insert their own config"
  ON challenge_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own config"
  ON challenge_config FOR UPDATE
  USING (auth.uid() = user_id);

-- challenge_logs policies
CREATE POLICY "Users can view logs in their rooms"
  ON challenge_logs FOR SELECT
  USING (room_id IN (SELECT room_id FROM challenge_meta WHERE user_a_id = auth.uid() OR user_b_id = auth.uid()));

CREATE POLICY "Users can insert their own logs"
  ON challenge_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own logs"
  ON challenge_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own logs"
  ON challenge_logs FOR DELETE
  USING (auth.uid() = user_id);
```

### 4. Enable Realtime on `challenge_logs`

1. Go to **Database → Replication**
2. Find `challenge_logs` in the table list
3. Toggle **Realtime** ON

---

## Local Development

### 1. Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Find both values in Supabase → **Settings → API Keys**.

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

Open http://localhost:5173

---

## Deploy on Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repository
3. Add environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
4. Deploy — Vercel auto-detects Vite

---

## Multi-Room Support

Each challenge gets a unique 6-character room ID. URLs look like:

```
https://your-app.vercel.app/#/room/AbC123
```

Share this link with your partner. The dashboard at the root URL lists all your active challenges.

---

## Resetting a Challenge

Delete rows for a specific room:

```sql
DELETE FROM challenge_logs WHERE room_id = 'YOUR_ROOM_ID';
DELETE FROM challenge_config WHERE room_id = 'YOUR_ROOM_ID';
DELETE FROM challenge_meta WHERE room_id = 'YOUR_ROOM_ID';
```

---

## License

MIT
