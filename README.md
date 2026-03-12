# Duo Challenge Tracker

A 14–21 day duo accountability challenge tracker. Dark theme, minimalistic UI, real-time shared state via Supabase.

## Supabase Setup

### 1. Create Tables

Run this SQL in your Supabase SQL Editor (copy-paste the entire block):

```sql
-- Enable uuid generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Challenge metadata (always exactly ONE row)
CREATE TABLE challenge_meta (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_a_name text NOT NULL,
  user_b_name text,
  start_date date NOT NULL,
  duration_days integer NOT NULL CHECK (duration_days IN (14, 16, 18, 21))
);

-- Per-user task configuration
CREATE TABLE challenge_config (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_name text UNIQUE NOT NULL,
  tasks text[] NOT NULL,
  task_count integer NOT NULL CHECK (task_count >= 1 AND task_count <= 10)
);

-- Daily task completion logs
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

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

You can find these in your Supabase Dashboard under **Settings → API**.

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

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

```sql
DELETE FROM challenge_logs;
DELETE FROM challenge_config;
DELETE FROM challenge_meta;
```

Then clear `challenge_user_name` from localStorage in your browser (or use the "That's not me" button in Settings).
