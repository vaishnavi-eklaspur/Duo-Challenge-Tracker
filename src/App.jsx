import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { PostgrestClient } from '@supabase/postgrest-js';
import confetti from 'canvas-confetti';
import html2canvas from 'html2canvas';

// ============================================================
// DATABASE CLIENT (Neon Data API, PostgREST protocol)
// ============================================================
// ponytail: the key is a static public JWT (same model as a Supabase anon
// key, verified against /jwks.json on this site). No per-user auth — anyone
// with the app can write. Add real auth if griefing ever matters.
const db = new PostgrestClient(
  'https://ep-autumn-sun-af5lfcfl.apirest.c-2.us-west-2.aws.neon.tech/neondb/rest/v1',
  { headers: { Authorization: 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImR1by0xIn0.eyJpc3MiOiJkdW8tY2hhbGxlbmdlLXRyYWNrZXIiLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsInN1YiI6ImFub24iLCJpYXQiOjE3ODQzNjc1OTQsImV4cCI6MjA5OTcyNzU5NH0.Nl0cESNl4LxpJm1cH89RhMnRS4wvk5lBM2JwjiG1tdDIjSGPWoL0F6HK5KBdmgycyJ6yAZ6vvDWPbOG4kpztucD_V-XE-ukPczf2mduaAGeTTWe716foc5A-unXq5BXUm4GLxVZ7XI3YcXX7TWhoEfx3exPj_HikHFaOhYYNRpTecSyk67yJXygogGib57bUqrW-WipbeJhYDiBTSbxMcCqrxNfMvC0a-JLalsH-LNz9UFMy33bIhKr7ztFo8q6pKZISXbGn5-AKgBWXvfbkdJBIAUK-MxZeQDA7fxy5NuLu-BDc8Bxuqtcb71tepahRXoMKrwFTdVOgIOtYbf70oA' } }
);

// Identity: "Sign in with Google" (GIS browser SDK, no auth server).
// The stable Google account id (`sub`) is the user id, so the same person is
// recognized on every device. Public client id, safe to ship.
const GOOGLE_CLIENT_ID = '191385615834-pms2fcmvi9c4ml804kue7emc5c8cjmls.apps.googleusercontent.com';

function loadIdentity() {
  try { return JSON.parse(localStorage.getItem('duo_identity')); } catch { return null; }
}

function signOut() {
  localStorage.removeItem('duo_identity');
  window.location.hash = '';
  window.location.reload();
}

// ============================================================
// HELPERS
// ============================================================
function possessive(name) {
  if (!name) return '';
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

function plural(n, singular, pluralForm) {
  return n === 1 ? singular : (pluralForm || singular + 's');
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function daysBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1 + 'T00:00:00');
  const d2 = new Date(dateStr2 + 'T00:00:00');
  return Math.floor((d2 - d1) / 86400000);
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function computeCurrentDay(startDate) {
  return daysBetween(startDate, todayStr()) + 1;
}

function generateRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 6; i++) result += chars[arr[i] % chars.length];
  return result;
}

function getRoomIdFromHash() {
  const hash = window.location.hash;
  const match = hash.match(/^#\/room\/([A-Za-z0-9]{6})$/);
  return match ? match[1] : null;
}

function setHashRoute(roomId) {
  window.location.hash = roomId ? `#/room/${roomId}` : '';
}

// ============================================================
// SIGN-IN SCREEN (Google Identity Services)
// ============================================================
function SignInScreen({ onSignIn }) {
  const btnRef = useRef(null);

  useEffect(() => {
    // GIS script loads async; poll until it's there, then render the button
    const t = setInterval(() => {
      if (!window.google?.accounts?.id) return;
      clearInterval(t);
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: ({ credential }) => {
          // ponytail: client-side decode of Google's ID token, no server-side
          // verification — there is no server. Identity is for convenience,
          // not access control; DB writes are open either way.
          const b64 = credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(atob(b64));
          const identity = { id: 'g-' + payload.sub, name: payload.given_name || payload.name || '' };
          localStorage.setItem('duo_identity', JSON.stringify(identity));
          onSignIn(identity);
        },
      });
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'rectangular',
      });
    }, 100);
    return () => clearInterval(t);
  }, [onSignIn]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 animate-fade-in">
      <h1 className="font-syne text-text-primary text-3xl font-extrabold mb-2">Duo Challenge Tracker</h1>
      <p className="font-mono text-text-muted text-sm mb-10">Sign in to start or join a challenge.</p>
      <div ref={btnRef} />
    </div>
  );
}

// ============================================================
// DASHBOARD SCREEN (multi-room)
// ============================================================
function Dashboard({ user, onEnterRoom }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const fetchRooms = async () => {
      const { data, error } = await db
        .from('challenge_meta')
        .select('*')
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);
      if (!error && data) setRooms(data);
      setLoading(false);
    };
    fetchRooms();
  }, [user.id]);

  const handleNewChallenge = async () => {
    if (creating) return;
    setCreating(true);
    const roomId = generateRoomId();
    setHashRoute(roomId);
    onEnterRoom(roomId);
  };

  const getPartnerName = (room) => {
    if (room.user_a_id === user.id) return room.user_b_name || 'Waiting for partner';
    return room.user_a_name;
  };

  const getRoomProgress = (room) => {
    const cd = computeCurrentDay(room.start_date);
    const clamped = Math.min(Math.max(cd, 1), room.duration_days);
    return { currentDay: clamped, total: room.duration_days, isOver: cd > room.duration_days };
  };

  return (
    <div className="min-h-screen bg-bg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h1 className="font-syne text-text-primary text-lg font-extrabold">Your Challenges</h1>
        <button onClick={signOut} className="font-mono text-text-muted text-xs hover:text-text-primary transition-colors">Sign out</button>
      </div>
      <div className="max-w-xl mx-auto px-4 py-6 animate-fade-in">
        {loading ? (
          <p className="font-mono text-text-muted text-sm animate-pulse">Loading...</p>
        ) : (
          <>
            {rooms.length > 0 && (
              <div className="space-y-3 mb-8">
                {rooms.map((room) => {
                  const progress = getRoomProgress(room);
                  return (
                    <button
                      key={room.id}
                      onClick={() => { setHashRoute(room.room_id); onEnterRoom(room.room_id); }}
                      className="w-full text-left bg-surface border border-border-muted rounded-[4px] p-4 hover:border-amber transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-syne text-text-primary font-semibold">{getPartnerName(room)}</span>
                        <span className="font-mono text-text-muted text-xs">{room.room_id}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-text-muted text-xs">{room.duration_days} days</span>
                        <span className="font-mono text-text-muted text-xs">Started {formatDate(room.start_date)}</span>
                        <span className="font-mono text-amber text-xs">
                          {progress.isOver ? 'Complete' : `Day ${progress.currentDay}/${progress.total}`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {rooms.length === 0 && (
              <p className="font-mono text-text-muted text-sm mb-8">No challenges yet. Start one and share the link with your partner.</p>
            )}
            <button
              onClick={handleNewChallenge}
              disabled={creating}
              className="bg-amber text-bg font-syne font-semibold px-8 py-3 rounded-[4px] hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Start a new challenge
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ONBOARDING — STEP COMPONENTS
// ============================================================

function OnboardingNameStep({ label, subtext, name, setName, error, onNext }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 animate-fade-in">
      <label className="font-syne text-text-primary text-2xl font-semibold mb-2 text-center">{label}</label>
      <p className="font-mono text-text-muted text-sm mb-8 text-center max-w-md">{subtext}</p>
      <input
        autoFocus
        type="text"
        maxLength={24}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onNext()}
        className="w-full max-w-xs bg-surface border border-border-muted text-text-primary font-syne text-lg px-4 py-3 rounded-[4px] text-center focus:border-amber transition-colors"
        placeholder="Your name"
      />
      {error && <p className="text-red-400 font-mono text-xs mt-2">{error}</p>}
      <button
        onClick={onNext}
        className="mt-6 bg-amber text-bg font-syne font-semibold px-8 py-3 rounded-[4px] hover:opacity-90 transition-opacity"
      >
        Next →
      </button>
    </div>
  );
}

function OnboardingTasksStep({ label, subtext, tasks, setTasks, onNext, onBack }) {
  const addTask = () => {
    if (tasks.length < 10) setTasks([...tasks, '']);
  };
  const removeTask = (i) => {
    if (tasks.length > 1) setTasks(tasks.filter((_, idx) => idx !== i));
  };
  const updateTask = (i, val) => {
    const copy = [...tasks];
    copy[i] = val;
    setTasks(copy);
  };
  const inputRefs = useRef([]);
  const allFilled = tasks.every((t) => t.trim().length > 0);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 animate-fade-in">
      <label className="font-syne text-text-primary text-2xl font-semibold mb-2 text-center">{label}</label>
      <p className="font-mono text-text-muted text-sm mb-8 text-center max-w-md">{subtext}</p>
      <div className="w-full max-w-md space-y-3">
        {tasks.map((task, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="font-mono text-text-muted text-xs w-6 text-right">{String(i + 1).padStart(2, '0')}</span>
            <input
              ref={(el) => (inputRefs.current[i] = el)}
              type="text"
              maxLength={60}
              value={task}
              onChange={(e) => updateTask(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Tab' && !e.shiftKey && i < tasks.length - 1) {
                  e.preventDefault();
                  inputRefs.current[i + 1]?.focus();
                }
              }}
              placeholder="e.g. Run 5km"
              className="flex-1 bg-surface border border-border-muted text-text-primary font-syne text-sm px-3 py-2 rounded-[4px] focus:border-amber transition-colors"
            />
            <button
              onClick={() => removeTask(i)}
              disabled={tasks.length <= 1}
              className="text-text-muted hover:text-text-primary disabled:opacity-20 text-lg leading-none px-1 transition-colors"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={addTask}
        disabled={tasks.length >= 10}
        className="mt-4 font-mono text-amber text-sm disabled:opacity-30 transition-opacity"
      >
        + Add task
      </button>
      <div className="flex gap-4 mt-8">
        <button onClick={onBack} className="font-syne text-text-muted px-6 py-3 hover:text-text-primary transition-colors">← Back</button>
        <button
          onClick={onNext}
          disabled={!allFilled}
          className="bg-amber text-bg font-syne font-semibold px-8 py-3 rounded-[4px] disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function OnboardingSetupStep({ duration, setDuration, startDate, setStartDate, onNext, onBack }) {
  const durations = [14, 16, 18, 21];
  const minDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  })();
  const maxDate = todayStr();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 animate-fade-in">
      <label className="font-syne text-text-primary text-2xl font-semibold mb-2 text-center">How long is your challenge?</label>
      <div className="flex gap-2 mt-6 mb-8">
        {durations.map((d) => (
          <button
            key={d}
            onClick={() => setDuration(d)}
            className={`font-mono text-sm px-4 py-2 rounded-[4px] border transition-colors ${
              duration === d ? 'bg-amber text-bg border-amber' : 'bg-surface border-border-muted text-text-muted hover:border-amber'
            }`}
          >
            {d} days
          </button>
        ))}
      </div>
      <label className="font-syne text-text-primary text-lg font-semibold mb-2">When does it start?</label>
      <input
        type="date"
        value={startDate}
        min={minDate}
        max={maxDate}
        onChange={(e) => setStartDate(e.target.value)}
        className="bg-surface border border-border-muted text-text-primary font-mono px-4 py-2 rounded-[4px] focus:border-amber transition-colors"
      />
      <p className="font-mono text-text-muted text-xs mt-4 text-center max-w-sm">Your partner will set their own tasks when they open your shared link.</p>
      <div className="flex gap-4 mt-8">
        <button onClick={onBack} className="font-syne text-text-muted px-6 py-3 hover:text-text-primary transition-colors">← Back</button>
        <button onClick={onNext} className="bg-amber text-bg font-syne font-semibold px-8 py-3 rounded-[4px] hover:opacity-90 transition-opacity">Next →</button>
      </div>
    </div>
  );
}

function OnboardingReviewStep({ name, tasks, duration, startDate, ctaLabel, onConfirm, onBack, readOnlySetup, error }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 animate-fade-in">
      <h2 className="font-syne text-text-primary text-2xl font-extrabold mb-6">Review & Confirm</h2>
      <div className="bg-surface border border-border-muted rounded-[4px] p-6 w-full max-w-md">
        <p className="font-syne text-text-primary text-lg font-semibold mb-1">{name}</p>
        <div className="mt-4">
          <p className="font-syne text-text-muted text-xs uppercase tracking-widest mb-2">Tasks</p>
          <ol className="space-y-1">
            {tasks.map((t, i) => (
              <li key={i} className="font-mono text-text-primary text-sm flex gap-2">
                <span className="text-text-muted">{String(i + 1).padStart(2, '0')}.</span>
                {t}
              </li>
            ))}
          </ol>
        </div>
        <div className="mt-4 flex gap-6">
          <div>
            <p className="font-syne text-text-muted text-xs uppercase tracking-widest mb-1">Duration</p>
            <p className="font-mono text-text-primary">{duration} days {readOnlySetup && <span className="text-text-muted text-xs">(set by partner)</span>}</p>
          </div>
          <div>
            <p className="font-syne text-text-muted text-xs uppercase tracking-widest mb-1">Start</p>
            <p className="font-mono text-text-primary">{formatDate(startDate)} {readOnlySetup && <span className="text-text-muted text-xs">(set by partner)</span>}</p>
          </div>
        </div>
      </div>
      {error && <p className="text-red-400 font-mono text-xs mt-4">{error}</p>}
      <div className="flex gap-4 mt-8">
        <button onClick={onBack} className="font-syne text-text-muted px-6 py-3 hover:text-text-primary transition-colors">← Back</button>
        <button onClick={onConfirm} className="bg-amber text-bg font-syne font-semibold px-8 py-3 rounded-[4px] hover:opacity-90 transition-opacity">{ctaLabel}</button>
      </div>
    </div>
  );
}

function WaitingScreen({ url }) {
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback: no-op */ }
  };
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 animate-fade-in">
      <h2 className="font-syne text-text-primary text-2xl font-extrabold mb-4">Waiting for your partner to join.</h2>
      <p className="font-mono text-text-muted text-sm mb-6 text-center max-w-md">Share this link. Once they set up, the challenge begins automatically.</p>
      <div className="bg-surface border border-border-muted rounded-[4px] px-4 py-3 flex items-center gap-3 max-w-lg w-full">
        <span className="font-mono text-text-primary text-xs truncate flex-1">{url}</span>
        <button onClick={copyLink} className="font-syne text-amber text-sm font-semibold shrink-0 hover:opacity-80 transition-opacity">
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// ONBOARDING ORCHESTRATOR
// ============================================================
function Onboarding({ meta, roomId, user, onComplete }) {
  const isFirstUser = !meta;
  const isSecondUser = meta && !meta.user_b_id;

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [tasks, setTasks] = useState(['', '', '']);
  const [duration, setDuration] = useState(21);
  const [startDate, setStartDate] = useState(todayStr());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const validateName = () => {
    const trimmed = name.trim();
    if (!trimmed) { setNameError('Name cannot be empty.'); return false; }
    if (trimmed.length > 24) { setNameError('Max 24 characters.'); return false; }
    if (isSecondUser && trimmed.toLowerCase() === meta.user_a_name.toLowerCase()) {
      setNameError('That name is taken by your partner. Use a different name.');
      return false;
    }
    setNameError('');
    return true;
  };

  const handleNameNext = () => { if (validateName()) setStep(2); };

  const handleTasksNext = () => {
    if (tasks.every((t) => t.trim().length > 0)) setStep(3);
  };

  const handleSetupNext = () => setStep(4);

  const handleSubmitFirstUser = async () => {
    if (submitting) return;
    setSubmitting(true);
    const trimmedName = name.trim();
    const trimmedTasks = tasks.map((t) => t.trim());
    try {
      const { error: metaErr } = await db.from('challenge_meta').insert({
        room_id: roomId,
        user_a_id: user.id,
        user_a_name: trimmedName,
        user_b_id: null,
        user_b_name: null,
        start_date: startDate,
        duration_days: duration,
      });
      if (metaErr) throw metaErr;
      const { error: configErr } = await db.from('challenge_config').insert({
        room_id: roomId,
        user_id: user.id,
        user_name: trimmedName,
        tasks: trimmedTasks,
        task_count: trimmedTasks.length,
      });
      if (configErr) throw configErr;
      onComplete(trimmedName, 'waiting');
    } catch (e) {
      console.error(e);
      setSubmitError('Could not save. Check your connection and try again.');
      setSubmitting(false);
    }
  };

  const handleSubmitSecondUser = async () => {
    if (submitting) return;
    setSubmitting(true);
    const trimmedName = name.trim();
    const trimmedTasks = tasks.map((t) => t.trim());
    try {
      const { error: metaErr } = await db.from('challenge_meta').update({
        user_b_id: user.id,
        user_b_name: trimmedName,
      }).eq('id', meta.id);
      if (metaErr) throw metaErr;
      const { error: configErr } = await db.from('challenge_config').insert({
        room_id: roomId,
        user_id: user.id,
        user_name: trimmedName,
        tasks: trimmedTasks,
        task_count: trimmedTasks.length,
      });
      if (configErr) throw configErr;
      onComplete(trimmedName, 'app');
    } catch (e) {
      console.error(e);
      setSubmitError('Could not save. Check your connection and try again.');
      setSubmitting(false);
    }
  };

  // PATH A — first user
  if (isFirstUser) {
    if (step === 1) {
      return (
        <OnboardingNameStep
          label="What's your name?"
          subtext="This is how you'll appear to your partner and everywhere in the app."
          name={name} setName={setName} error={nameError} onNext={handleNameNext}
        />
      );
    }
    if (step === 2) {
      return (
        <OnboardingTasksStep
          label="What will you do every day for the challenge?"
          subtext="Add 1 to 10 tasks. Be specific — 'Run 5km' beats 'Exercise'."
          tasks={tasks} setTasks={setTasks} onNext={handleTasksNext} onBack={() => setStep(1)}
        />
      );
    }
    if (step === 3) {
      return (
        <OnboardingSetupStep
          duration={duration} setDuration={setDuration}
          startDate={startDate} setStartDate={setStartDate}
          onNext={handleSetupNext} onBack={() => setStep(2)}
        />
      );
    }
    if (step === 4) {
      return (
        <OnboardingReviewStep
          name={name.trim()} tasks={tasks.map((t) => t.trim())}
          duration={duration} startDate={startDate}
          ctaLabel="Lock it in →" onConfirm={handleSubmitFirstUser} onBack={() => setStep(3)}
          error={submitError}
        />
      );
    }
  }

  // PATH B — second user
  if (isSecondUser) {
    if (step === 1) {
      return (
        <OnboardingNameStep
          label={`${meta.user_a_name} is ready. What's your name?`}
          subtext="This is how you'll appear to your partner and everywhere in the app."
          name={name} setName={setName} error={nameError} onNext={handleNameNext}
        />
      );
    }
    if (step === 2) {
      return (
        <OnboardingTasksStep
          label="Your daily tasks for the challenge."
          subtext={`${meta.user_a_name} has already set their tasks. These are yours — they can be completely different.`}
          tasks={tasks} setTasks={setTasks} onNext={handleTasksNext} onBack={() => setStep(1)}
        />
      );
    }
    if (step === 3) {
      return (
        <OnboardingReviewStep
          name={name.trim()} tasks={tasks.map((t) => t.trim())}
          duration={meta.duration_days} startDate={meta.start_date}
          ctaLabel="Join the challenge →" onConfirm={handleSubmitSecondUser} onBack={() => setStep(2)}
          readOnlySetup error={submitError}
        />
      );
    }
  }

  return null;
}

// ============================================================
// TASK CARD
// ============================================================
function TaskCard({ index, text, completed, onToggle, readOnly }) {
  const [bouncing, setBouncing] = useState(false);
  const [sweeping, setSweeping] = useState(false);

  const handleClick = () => {
    if (readOnly) return;
    setBouncing(true);
    if (!completed) setSweeping(true);
    setTimeout(() => { setBouncing(false); setSweeping(false); }, 300);
    onToggle();
  };

  return (
    <div
      onClick={handleClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-[4px] border-l-2 transition-colors ${bouncing ? 'animate-scale-bounce' : ''} ${
        completed
          ? `border-l-amber ${sweeping ? 'fill-sweep' : 'bg-surface-warm'}`
          : 'border-l-border-muted bg-surface'
      } ${readOnly ? 'cursor-default' : 'cursor-pointer hover:border-l-amber'}`}
    >
      <span className="font-mono text-text-muted text-xs w-5 text-right shrink-0">{String(index + 1).padStart(2, '0')}</span>
      <span className={`font-syne text-sm flex-1 ${completed ? 'line-through text-text-muted' : 'text-text-primary'}`}>{text}</span>
      {!readOnly && (
        <div className={`w-4 h-4 rounded-[2px] border shrink-0 flex items-center justify-center transition-colors ${
          completed ? 'bg-amber border-amber' : 'border-border-muted'
        }`}>
          {completed && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4.5 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// NUDGE BANNER
// ============================================================
function NudgeBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="animate-fade-in relative border-l-[3px] border-l-amber px-4 py-3 mb-6 rounded-[4px]" style={{ background: '#141410' }}>
      <p className="font-mono text-text-primary text-sm pr-6">{message}</p>
      <button onClick={onDismiss} className="absolute top-2 right-3 text-text-muted hover:text-text-primary text-lg leading-none transition-colors">×</button>
    </div>
  );
}

// ============================================================
// PROGRESS RING
// ============================================================
function ProgressRing({ pct, name, streak, perfectDays }) {
  const radius = 52;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (circumference * Math.min(pct, 100)) / 100;

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="120" className="transform -rotate-90">
        <circle cx="60" cy="60" r={radius} stroke="#1e1e1e" strokeWidth={stroke} fill="none" />
        <circle
          cx="60" cy="60" r={radius}
          stroke="#f5a623" strokeWidth={stroke} fill="none"
          strokeLinecap="butt"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            '--circumference': circumference,
            '--target-offset': offset,
            animation: 'ring-draw 800ms ease-out forwards',
            strokeDashoffset: circumference,
          }}
        />
      </svg>
      <span className="font-mono font-medium text-2xl text-text-primary -mt-[78px] mb-[48px]">{Math.round(pct)}%</span>
      <p className="font-syne font-semibold text-text-primary text-sm mt-1">{name}</p>
      <div className="flex gap-4 mt-1">
        <span className="font-mono text-text-muted text-xs">{streak} day streak</span>
        <span className="font-mono text-text-muted text-xs">{perfectDays} perfect {plural(perfectDays, 'day')}</span>
      </div>
    </div>
  );
}

// ============================================================
// CHAIN GRID
// ============================================================
function ChainGrid({ meta, configs, logs, currentDay }) {
  const durationDays = meta.duration_days;
  const users = [
    { id: meta.user_a_id, name: meta.user_a_name },
    meta.user_b_id ? { id: meta.user_b_id, name: meta.user_b_name } : null,
  ].filter(Boolean);

  const getTaskCount = (userId) => {
    const cfg = configs.find((c) => c.user_id === userId);
    return cfg ? cfg.task_count : 0;
  };

  const getCompletedCount = (userId, day) => {
    return logs.filter((l) => l.user_id === userId && l.day === day && l.completed).length;
  };

  const getCellColor = (userId, day) => {
    if (day > currentDay) return '#0f0f0f';
    const taskCount = getTaskCount(userId);
    if (taskCount === 0) return '#0f0f0f';
    const completed = getCompletedCount(userId, day);
    if (completed === 0) return '#1a0a0a';
    if (completed >= taskCount) return '#f5a623';
    return 'rgba(245, 166, 35, 0.3)';
  };

  const getTooltip = (day) => {
    const parts = users.map((u) => {
      const tc = getTaskCount(u.id);
      const c = getCompletedCount(u.id, day);
      return `${u.name}: ${c}/${tc}`;
    });
    return `Day ${day} — ${parts.join(' | ')}`;
  };

  return (
    <div id="chain-grid" className="w-full">
      <p className="font-syne font-semibold text-text-muted text-[0.65rem] uppercase tracking-[0.15em] mb-4">THE CHAIN</p>
      <div className="space-y-2 overflow-x-auto">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-2">
            <span className="font-mono text-text-muted text-xs w-20 text-right shrink-0 truncate">{u.name}</span>
            <div className="flex gap-[3px] flex-1 min-w-0">
              {Array.from({ length: durationDays }, (_, i) => i + 1).map((day) => (
                <div key={day} className="tooltip-container" style={{ flex: '1 1 0', maxWidth: '24px' }}>
                  <div
                    className={`aspect-square rounded-[2px] ${day === currentDay ? 'cell-today border-[1.5px] border-amber' : ''}`}
                    style={{ backgroundColor: getCellColor(u.id, day), minWidth: '10px' }}
                  />
                  {day <= currentDay && <span className="tooltip-text">{getTooltip(day)}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-3">
        {[
          { color: '#f5a623', label: 'Perfect' },
          { color: 'rgba(245, 166, 35, 0.3)', label: 'Partial' },
          { color: '#1a0a0a', label: 'Gap' },
          { color: '#0f0f0f', label: 'Upcoming' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: color }} />
            <span className="font-mono text-text-muted text-[0.7rem]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// SETTINGS PANEL
// ============================================================
function SettingsPanel({ open, onClose, myName, partnerName, myConfig, partnerConfig, meta, currentDay, roomId, user, onTasksSaved, onResetToday, onSettingsSaveRedirect }) {
  const [editTasks, setEditTasks] = useState(myConfig?.tasks || []);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Determine if tasks are locked (challenge has started)
  const tasksLocked = meta && computeCurrentDay(meta.start_date) >= 1;

  useEffect(() => {
    if (myConfig) setEditTasks([...myConfig.tasks]);
    setSaveMsg('');
  }, [myConfig, open]);

  const handleSaveTasks = async () => {
    if (editTasks.some((t) => !t.trim()) || saving || tasksLocked) return;
    setSaving(true);
    const trimmed = editTasks.map((t) => t.trim());
    const { error } = await db
      .from('challenge_config')
      .update({ tasks: trimmed })
      .eq('room_id', roomId)
      .eq('user_id', user.id);
    if (!error) {
      onTasksSaved(trimmed);
      setSaveMsg('Changes saved');
      setTimeout(() => {
        onSettingsSaveRedirect();
      }, 1500);
    } else {
      setSaveMsg('Save failed. Try again.');
    }
    setSaving(false);
  };

  const handleResetToday = async () => {
    if (resetting) return;
    setResetting(true);
    const { error } = await db
      .from('challenge_logs')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .eq('day', currentDay);
    if (!error) onResetToday();
    setResetting(false);
    setShowResetConfirm(false);
  };

  const handleBackToDashboard = () => {
    window.location.hash = '';
    window.location.reload();
  };

  if (!open) return null;

  const daysRemaining = Math.max(0, meta.duration_days - currentDay);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-bg border-l border-border overflow-y-auto animate-fade-in">
        <div className="p-6">
          <div className="flex justify-between items-center mb-8">
            <h2 className="font-syne text-text-primary text-lg font-extrabold">Settings</h2>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl leading-none transition-colors">×</button>
          </div>

          {/* Tasks section */}
          <div className="mb-8">
            <p className="font-syne text-text-muted text-[0.65rem] uppercase tracking-[0.15em] mb-3">
              {tasksLocked ? 'Your tasks' : 'Edit your tasks'}
            </p>
            {tasksLocked ? (
              <>
                <div className="space-y-1">
                  {(myConfig?.tasks || []).map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="font-mono text-text-muted text-xs w-5 text-right">{String(i + 1).padStart(2, '0')}</span>
                      <span className="font-mono text-text-primary text-sm">{t}</span>
                    </div>
                  ))}
                </div>
                <p className="font-mono text-text-muted text-xs mt-2">Tasks locked — challenge in progress</p>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  {editTasks.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="font-mono text-text-muted text-xs w-5 text-right">{String(i + 1).padStart(2, '0')}</span>
                      <input
                        type="text" maxLength={60} value={t}
                        onChange={(e) => { const c = [...editTasks]; c[i] = e.target.value; setEditTasks(c); }}
                        className="flex-1 bg-surface border border-border-muted text-text-primary font-syne text-sm px-3 py-2 rounded-[4px] focus:border-amber transition-colors"
                      />
                    </div>
                  ))}
                </div>
                {saveMsg && <p className="font-mono text-amber text-xs mt-2 animate-fade-in">{saveMsg}</p>}
                <button
                  onClick={handleSaveTasks}
                  disabled={editTasks.some((t) => !t.trim()) || saving}
                  className="mt-3 font-syne text-amber text-sm font-semibold disabled:opacity-40 hover:opacity-80 transition-opacity"
                >
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              </>
            )}
          </div>

          {/* Partner tasks */}
          {partnerConfig && (
            <div className="mb-8">
              <p className="font-syne text-text-muted text-[0.65rem] uppercase tracking-[0.15em] mb-3">{possessive(partnerName)} tasks</p>
              <div className="space-y-1">
                {partnerConfig.tasks.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="font-mono text-text-muted text-xs w-5 text-right">{String(i + 1).padStart(2, '0')}</span>
                    <span className="font-mono text-text-primary text-sm">{t}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reset today */}
          <div className="mb-8">
            <p className="font-syne text-text-muted text-[0.65rem] uppercase tracking-[0.15em] mb-3">Reset {possessive(myName)} check-ins for today</p>
            {!showResetConfirm ? (
              <button onClick={() => setShowResetConfirm(true)} className="font-mono text-red-400 text-sm hover:text-red-300 transition-colors">Reset today</button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="font-mono text-text-muted text-xs">Are you sure?</span>
                <button onClick={handleResetToday} disabled={resetting} className="font-mono text-red-400 text-sm hover:text-red-300">{resetting ? 'Resetting...' : 'Yes, reset'}</button>
                <button onClick={() => setShowResetConfirm(false)} className="font-mono text-text-muted text-sm hover:text-text-primary">Cancel</button>
              </div>
            )}
          </div>

          {/* Challenge info */}
          <div className="mb-8">
            <p className="font-syne text-text-muted text-[0.65rem] uppercase tracking-[0.15em] mb-3">Challenge info</p>
            <div className="space-y-1 font-mono text-text-primary text-sm">
              <p>Room: {roomId}</p>
              <p>Start: {formatDate(meta.start_date)}</p>
              <p>Duration: {meta.duration_days} days</p>
              <p>Current day: {Math.min(Math.max(currentDay, 1), meta.duration_days)}</p>
              <p>Days remaining: {daysRemaining}</p>
            </div>
          </div>

          {/* Navigation */}
          <div className="space-y-3">
            <button onClick={handleBackToDashboard} className="font-mono text-text-muted text-sm hover:text-text-primary transition-colors underline block">
              ← Back to dashboard
            </button>
            <button onClick={signOut} className="font-mono text-text-muted text-sm hover:text-text-primary transition-colors underline block">
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ROOM VIEW (main challenge experience for a single room)
// ============================================================
function RoomView({ user, roomId }) {
  // --- App state ---
  const [screen, setScreen] = useState('loading'); // loading | onboarding | waiting | app | error
  const [meta, setMeta] = useState(null);
  const [configs, setConfigs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [myName, setMyName] = useState('');
  const [activeTab, setActiveTab] = useState('today');
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confettiFiredForPerfect, setConfettiFiredForPerfect] = useState(false);
  const [confettiFiredForEnd, setConfettiFiredForEnd] = useState(false);

  // --- Derived values ---
  const myUserId = user.id;

  const partnerName = useMemo(() => {
    if (!meta || !myUserId) return '';
    if (meta.user_a_id === myUserId) return meta.user_b_name || '';
    return meta.user_a_name || '';
  }, [meta, myUserId]);

  const partnerId = useMemo(() => {
    if (!meta || !myUserId) return null;
    if (meta.user_a_id === myUserId) return meta.user_b_id;
    return meta.user_a_id;
  }, [meta, myUserId]);

  const myConfig = useMemo(() => configs.find((c) => c.user_id === myUserId), [configs, myUserId]);
  const partnerConfig = useMemo(() => configs.find((c) => c.user_id === partnerId), [configs, partnerId]);

  const currentDay = useMemo(() => {
    if (!meta) return 0;
    return computeCurrentDay(meta.start_date);
  }, [meta]);

  const durationDays = meta?.duration_days || 21;
  const clampedDay = Math.min(Math.max(currentDay, 1), durationDays);

  const myTaskCount = myConfig?.task_count || 0;
  const partnerTaskCount = partnerConfig?.task_count || 0;

  // My logs for today
  const myTodayLogs = useMemo(() => {
    return logs.filter((l) => l.user_id === myUserId && l.day === clampedDay);
  }, [logs, myUserId, clampedDay]);

  const partnerTodayLogs = useMemo(() => {
    return logs.filter((l) => l.user_id === partnerId && l.day === clampedDay);
  }, [logs, partnerId, clampedDay]);

  const myTodayCount = myTodayLogs.filter((l) => l.completed).length;
  const partnerTodayCount = partnerTodayLogs.filter((l) => l.completed).length;

  // Streaks & stats
  const computeStats = useCallback((userId, taskCount) => {
    if (!taskCount || !meta) return { streak: 0, perfectDays: 0, totalCompleted: 0, completionPct: 0, daysSinceLastComplete: 0, bestStreak: 0 };
    const userLogs = logs.filter((l) => l.user_id === userId && l.completed);
    const totalCompleted = userLogs.length;
    const completionPct = clampedDay > 0 ? Math.round((totalCompleted / (taskCount * clampedDay)) * 100) : 0;

    let perfectDays = 0;
    const dayLimit = Math.min(currentDay, durationDays);
    for (let d = 1; d <= dayLimit; d++) {
      const dayCompleted = userLogs.filter((l) => l.day === d).length;
      if (dayCompleted >= taskCount) perfectDays++;
    }

    let streak = 0;
    for (let d = dayLimit; d >= 1; d--) {
      const dayCompleted = userLogs.filter((l) => l.day === d).length;
      if (dayCompleted >= taskCount) streak++;
      else break;
    }

    let bestStreak = 0;
    let currentStrk = 0;
    for (let d = 1; d <= dayLimit; d++) {
      const dayCompleted = userLogs.filter((l) => l.day === d).length;
      if (dayCompleted >= taskCount) { currentStrk++; bestStreak = Math.max(bestStreak, currentStrk); }
      else currentStrk = 0;
    }

    let daysSinceLastComplete = 0;
    if (dayLimit > 1) {
      for (let d = dayLimit - 1; d >= 1; d--) {
        const dayTotal = logs.filter((l) => l.user_id === userId && l.day === d).length;
        const dayCompleted = userLogs.filter((l) => l.day === d).length;
        if (dayCompleted === 0 && dayTotal === 0) daysSinceLastComplete++;
        else break;
      }
    }

    return { streak, perfectDays, totalCompleted, completionPct: Math.min(completionPct, 100), daysSinceLastComplete, bestStreak };
  }, [logs, meta, currentDay, durationDays, clampedDay]);

  const myStats = useMemo(() => computeStats(myUserId, myTaskCount), [computeStats, myUserId, myTaskCount]);
  const partnerStats = useMemo(() => computeStats(partnerId, partnerTaskCount), [computeStats, partnerId, partnerTaskCount]);

  // --- Nudge ---
  const nudgeMessage = useMemo(() => {
    if (!myName || !meta || currentDay < 1 || currentDay > durationDays) return null;
    const hourNow = new Date().getHours();
    const halfwayDay = Math.floor(durationDays / 2);
    const tasksLeft = myTaskCount - myTodayCount;
    const taskWord = tasksLeft === 1 ? 'task' : 'tasks';

    if (currentDay === 1 && hourNow < 10) return `${myName}, day one. This is where it starts.`;
    if (hourNow >= 21 && myTodayCount < myTaskCount) return `The day's almost gone. ${tasksLeft} ${taskWord} left.`;
    if (partnerTodayCount === partnerTaskCount && partnerTaskCount > 0 && myTodayCount === 0) return `${partnerName} finished all ${partnerTaskCount} today. You haven't started.`;
    if (partnerTodayCount === partnerTaskCount && partnerTaskCount > 0 && myTodayCount > 0 && myTodayCount < myTaskCount) return `${possessive(partnerName)} done for today. You're at ${myTodayCount}/${myTaskCount}.`;
    if (myTodayCount === myTaskCount && myTaskCount > 0 && partnerTodayCount === 0 && partnerTaskCount > 0) return `You're done. ${partnerName} still has ${partnerTaskCount} to go today.`;
    if (myTodayCount === myTaskCount && myTaskCount > 0 && partnerTodayCount === partnerTaskCount && partnerTaskCount > 0) return 'Both locked in today. ✦';
    if (myStats.daysSinceLastComplete >= 2 && myTodayCount > 0) return `${myStats.daysSinceLastComplete} days missed. The chain restarts now, ${myName}.`;
    if (myStats.daysSinceLastComplete === 1 && myTodayCount > 0) return "Yesterday was a gap. Today you're back.";
    if (myStats.streak >= 7) return `${myStats.streak} perfect days straight. Don't stop now.`;
    if (myStats.streak >= 5) return `${myStats.streak} days in a row, ${myName}. Momentum is real.`;
    if (myStats.streak >= 3) return `${myStats.streak} days strong. Keep the chain.`;
    if (currentDay === halfwayDay) return `Halfway, ${myName}. Most people quit here. You didn't.`;
    if (myStats.completionPct >= 85) return `You're at ${myStats.completionPct}%. That's exceptional.`;
    if (myStats.completionPct >= 60) return `${myStats.completionPct}% done. Imperfect and still going.`;
    if (currentDay > 3 && myStats.completionPct < 60) return `You're at ${myStats.completionPct}%. Today is the whole gap.`;
    return null;
  }, [myName, partnerName, meta, currentDay, durationDays, myTaskCount, partnerTaskCount, myTodayCount, partnerTodayCount, myStats]);

  // --- Perfect day confetti ---
  const isPerfectDay = myTodayCount === myTaskCount && myTaskCount > 0 && currentDay >= 1 && currentDay <= durationDays;

  useEffect(() => {
    if (isPerfectDay && !confettiFiredForPerfect && screen === 'app') {
      confetti({ colors: ['#f5a623', '#f0ece4', '#ffffff'], particleCount: 120, spread: 70, origin: { y: 0.6 } });
      setConfettiFiredForPerfect(true);
    }
    if (!isPerfectDay) {
      setConfettiFiredForPerfect(false);
    }
  }, [isPerfectDay, confettiFiredForPerfect, screen]);

  // End screen confetti
  useEffect(() => {
    if (currentDay > durationDays && !confettiFiredForEnd && screen === 'app' && activeTab === 'chain') {
      confetti({ colors: ['#f5a623', '#f0ece4', '#ffffff'], particleCount: 200, spread: 90, origin: { y: 0.5 }, ticks: 300 });
      setConfettiFiredForEnd(true);
    }
  }, [currentDay, durationDays, confettiFiredForEnd, screen, activeTab]);

  // --- Data fetching ---
  const fetchAll = useCallback(async () => {
    try {
      const { data: metaData, error: metaErr } = await db
        .from('challenge_meta')
        .select('*')
        .eq('room_id', roomId)
        .maybeSingle();
      if (metaErr) throw metaErr;
      setMeta(metaData);

      if (metaData) {
        const { data: configData } = await db
          .from('challenge_config')
          .select('*')
          .eq('room_id', roomId);
        setConfigs(configData || []);
        const { data: logData } = await db
          .from('challenge_logs')
          .select('*')
          .eq('room_id', roomId);
        setLogs(logData || []);
      }

      return metaData;
    } catch (e) {
      console.error('Fetch error:', e);
      setScreen('error');
      return null;
    }
  }, [roomId]);

  // --- Init ---
  useEffect(() => {
    const init = async () => {
      const metaData = await fetchAll();

      if (!metaData) {
        // No meta for this room — first user creates it
        setScreen('onboarding');
        return;
      }

      // Check if current user is part of this room
      if (metaData.user_a_id === myUserId || metaData.user_b_id === myUserId) {
        // Determine display name
        const displayName = metaData.user_a_id === myUserId ? metaData.user_a_name : metaData.user_b_name;
        setMyName(displayName);
        if (!metaData.user_b_id) {
          setScreen('waiting');
        } else {
          setScreen('app');
        }
        return;
      }

      // User is not part of this room — if second slot open, onboard
      if (!metaData.user_b_id) {
        setScreen('onboarding');
        return;
      }

      // Room is full and user is not a participant
      setScreen('error');
    };

    init();
  }, [fetchAll, myUserId]);

  // --- Partner sync ---
  // ponytail: 4s polling instead of websockets — two users, tiny payloads.
  // Move to a realtime channel if it ever feels slow.
  const lastToggleRef = useRef(0);
  useEffect(() => {
    if (screen !== 'app') return;
    const interval = setInterval(() => {
      // Hidden tabs don't poll — a forgotten tab would keep Neon compute awake 24/7
      if (document.hidden) return;
      // Skip polls right after a toggle so the optimistic update isn't clobbered
      if (Date.now() - lastToggleRef.current < 3000) return;
      fetchAll();
    }, 4000);
    return () => clearInterval(interval);
  }, [screen, fetchAll]);

  // --- Waiting screen poll ---
  useEffect(() => {
    if (screen !== 'waiting') return;
    const interval = setInterval(async () => {
      const { data } = await db
        .from('challenge_meta')
        .select('*')
        .eq('room_id', roomId)
        .maybeSingle();
      if (data && data.user_b_id) {
        setMeta(data);
        const { data: configData } = await db.from('challenge_config').select('*').eq('room_id', roomId);
        setConfigs(configData || []);
        const { data: logData } = await db.from('challenge_logs').select('*').eq('room_id', roomId);
        setLogs(logData || []);
        setScreen('app');
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [screen, roomId]);

  // --- Task toggle ---
  const toggleTask = useCallback(async (taskIndex) => {
    lastToggleRef.current = Date.now();
    const existing = logs.find((l) => l.user_id === myUserId && l.day === clampedDay && l.task_index === taskIndex);
    const newCompleted = existing ? !existing.completed : true;

    // Optimistic update
    setLogs((prev) => {
      const idx = prev.findIndex((l) => l.user_id === myUserId && l.day === clampedDay && l.task_index === taskIndex);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], completed: newCompleted };
        return copy;
      }
      return [...prev, { room_id: roomId, user_id: myUserId, day: clampedDay, task_index: taskIndex, completed: newCompleted, id: 'temp-' + Date.now() }];
    });

    await db.from('challenge_logs').upsert(
      { room_id: roomId, user_id: myUserId, day: clampedDay, task_index: taskIndex, completed: newCompleted, updated_at: new Date().toISOString() },
      { onConflict: 'room_id,user_id,day,task_index' }
    );
  }, [logs, myUserId, clampedDay, roomId]);

  // --- Settings callbacks ---
  const handleTasksSaved = (newTasks) => {
    setConfigs((prev) => prev.map((c) => c.user_id === myUserId ? { ...c, tasks: newTasks } : c));
  };

  const handleResetToday = () => {
    setLogs((prev) => prev.filter((l) => !(l.user_id === myUserId && l.day === clampedDay)));
  };

  const handleSettingsSaveRedirect = () => {
    setSettingsOpen(false);
    setActiveTab('today');
  };

  // --- Onboarding complete ---
  const handleOnboardingComplete = async (displayName, destination) => {
    setMyName(displayName);
    await fetchAll();
    setScreen(destination);
  };

  // --- Grid screenshot ---
  const handleSaveGrid = async () => {
    const el = document.getElementById('chain-grid');
    if (!el) return;
    try {
      const canvas = await html2canvas(el, { backgroundColor: '#0a0a0a' });
      const link = document.createElement('a');
      link.download = 'challenge-grid.png';
      link.href = canvas.toDataURL();
      link.click();
    } catch (e) {
      console.error('Screenshot error:', e);
    }
  };

  // --- Motivational copy ---
  const getMotivationalCopy = () => {
    if (currentDay <= 3) return 'Early days. Build the habit before the motivation fades.';
    if (myStats.completionPct >= 85) return `${myName}, you're in the top tier. Most people never make it this far.`;
    if (myStats.completionPct >= 70) return "Imperfect and still going. That's what discipline actually looks like.";
    if (myStats.completionPct >= 50) return "The gap between where you are and where you want to be is exactly today's effort.";
    return 'Every task today closes the gap. Start there.';
  };

  const getEndCopy = () => {
    const myPct = myStats.completionPct;
    const partPct = partnerStats.completionPct;
    if (myPct >= 80 && partPct >= 80) return "You both showed up. That's rare.";
    if (myPct >= 80 && partPct < 80) return `${myName} led the way. ${partnerName}, the next one starts whenever you're ready.`;
    if (partPct >= 80 && myPct < 80) return `${partnerName} led the way. ${myName}, the next one starts whenever you're ready.`;
    return "It wasn't perfect. It never is. The grid is still yours.";
  };

  // =========================================
  // RENDER
  // =========================================

  if (screen === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="font-mono text-text-muted text-sm animate-pulse">Loading...</p>
      </div>
    );
  }

  if (screen === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6">
        <p className="font-syne text-text-primary text-lg font-semibold mb-2">Couldn&apos;t connect.</p>
        <p className="font-mono text-text-muted text-sm mb-4">Check your internet and refresh.</p>
        <button onClick={() => { window.location.hash = ''; window.location.reload(); }} className="font-mono text-amber text-sm hover:opacity-80 transition-opacity">← Back to dashboard</button>
      </div>
    );
  }

  if (screen === 'onboarding') {
    return (
      <Onboarding meta={meta} roomId={roomId} user={user} onComplete={handleOnboardingComplete} />
    );
  }

  if (screen === 'waiting') {
    const inviteUrl = window.location.origin + '/#/room/' + roomId;
    return <WaitingScreen url={inviteUrl} />;
  }

  // --- MAIN APP ---
  const isPreChallenge = currentDay < 1;
  const isPostChallenge = currentDay > durationDays;
  const isActive = currentDay >= 1 && currentDay <= durationDays;

  const isTaskCompleted = (taskIndex) => {
    const log = myTodayLogs.find((l) => l.task_index === taskIndex);
    return log ? log.completed : false;
  };

  const isPartnerTaskCompleted = (taskIndex) => {
    const log = partnerTodayLogs.find((l) => l.task_index === taskIndex);
    return log ? log.completed : false;
  };

  return (
    <>
      <div className="min-h-screen bg-bg pb-16">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-4">
            <button
              onClick={() => { window.location.hash = ''; window.location.reload(); }}
              className="text-text-muted hover:text-text-primary text-sm font-mono transition-colors"
            >
              ←
            </button>
            <div className="flex gap-6">
              {['today', 'chain'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`font-syne text-sm font-semibold pb-1 transition-colors ${
                    activeTab === tab
                      ? 'text-text-primary border-b-2 border-b-amber'
                      : 'text-text-muted border-b-2 border-b-transparent'
                  }`}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => setSettingsOpen(true)} className="text-text-muted hover:text-text-primary text-lg transition-colors">⚙</button>
        </div>

        {/* ====================== TODAY TAB ====================== */}
        {activeTab === 'today' && (
          <div className="max-w-xl mx-auto px-4 py-6 animate-fade-in">
            {/* Pre-challenge */}
            {isPreChallenge && (
              <>
                <h1 className="font-syne font-extrabold text-3xl text-text-primary mb-2">
                  Challenge starts in {Math.abs(currentDay - 1)} {plural(Math.abs(currentDay - 1), 'day')}
                </h1>
                <p className="font-mono text-text-muted text-sm mb-6">Get ready. Come back on {formatDate(meta.start_date)}.</p>
                {myConfig && (
                  <div className="mb-6">
                    <p className="font-syne text-text-muted text-[0.65rem] uppercase tracking-[0.15em] mb-3">{possessive(myName)} tasks</p>
                    <div className="space-y-2">
                      {myConfig.tasks.map((t, i) => (
                        <TaskCard key={i} index={i} text={t} completed={false} readOnly />
                      ))}
                    </div>
                  </div>
                )}
                {partnerConfig && (
                  <div>
                    <p className="font-syne text-text-muted text-[0.65rem] uppercase tracking-[0.15em] mb-3">{possessive(partnerName)} tasks</p>
                    <div className="space-y-2">
                      {partnerConfig.tasks.map((t, i) => (
                        <TaskCard key={i} index={i} text={t} completed={false} readOnly />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Active challenge */}
            {isActive && (
              <>
                {/* Header */}
                <div className="mb-6">
                  <h1 className="font-syne font-extrabold text-[4rem] leading-none text-text-primary tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                    DAY {clampedDay} <span className="text-text-muted">/ {durationDays}</span>
                  </h1>
                  <p className="font-mono text-text-muted text-sm mt-1">{formatDate(todayStr())}</p>
                  <div className="w-full h-[2px] bg-border mt-3">
                    <div className="h-full bg-amber transition-all duration-500" style={{ width: `${(clampedDay / durationDays) * 100}%` }} />
                  </div>
                </div>

                {/* Nudge */}
                {!nudgeDismissed && nudgeMessage && (
                  <NudgeBanner message={nudgeMessage} onDismiss={() => setNudgeDismissed(true)} />
                )}

                {/* Your tasks */}
                <div className="mb-8">
                  <p className="font-syne text-text-muted text-[0.65rem] uppercase tracking-[0.15em] mb-3">{possessive(myName)} moves today</p>
                  <div className="space-y-2">
                    {myConfig?.tasks.map((t, i) => (
                      <TaskCard key={i} index={i} text={t} completed={isTaskCompleted(i)} onToggle={() => toggleTask(i)} />
                    ))}
                  </div>
                </div>

                {/* Perfect day */}
                {isPerfectDay && (
                  <div className="animate-fade-in text-center mb-8">
                    <p className="font-syne font-extrabold text-3xl text-amber">PERFECT DAY ✦</p>
                  </div>
                )}

                {/* Partner tasks */}
                <div>
                  <p className="font-syne text-text-muted text-[0.65rem] uppercase tracking-[0.15em] mb-3">{possessive(partnerName)} moves today</p>
                  {partnerConfig ? (
                    <div className="space-y-2">
                      {partnerConfig.tasks.map((t, i) => (
                        <div key={i} className="animate-fade-in">
                          <TaskCard index={i} text={t} completed={isPartnerTaskCompleted(i)} readOnly />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-3 rounded-[4px] bg-surface border-l-2 border-l-border-muted">
                      <span className="font-mono text-text-muted text-sm">Your partner hasn&apos;t joined yet</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Post-challenge (Today tab) */}
            {isPostChallenge && (
              <>
                <h1 className="font-syne font-extrabold text-3xl text-text-primary mb-4">Challenge complete.</h1>
                {myConfig && (
                  <div className="mb-6">
                    <p className="font-syne text-text-muted text-[0.65rem] uppercase tracking-[0.15em] mb-3">{possessive(myName)} final day</p>
                    <div className="space-y-2">
                      {myConfig.tasks.map((t, i) => {
                        const lastDayLog = logs.find((l) => l.user_id === myUserId && l.day === durationDays && l.task_index === i);
                        return <TaskCard key={i} index={i} text={t} completed={lastDayLog?.completed || false} readOnly />;
                      })}
                    </div>
                  </div>
                )}
                <button
                  onClick={() => setActiveTab('chain')}
                  className="font-syne text-amber font-semibold text-sm hover:opacity-80 transition-opacity"
                >
                  See your results →
                </button>
              </>
            )}
          </div>
        )}

        {/* ====================== CHAIN TAB ====================== */}
        {activeTab === 'chain' && (
          <div className="max-w-3xl mx-auto px-4 py-6 animate-fade-in">
            {/* Grid */}
            <ChainGrid meta={meta} configs={configs} logs={logs} currentDay={Math.min(Math.max(currentDay, 0), durationDays + 1)} />

            {/* Progress rings */}
            <div className="flex flex-col sm:flex-row justify-center gap-10 mt-10 mb-10">
              <ProgressRing pct={myStats.completionPct} name={myName} streak={myStats.streak} perfectDays={myStats.perfectDays} />
              {partnerConfig && (
                <ProgressRing pct={partnerStats.completionPct} name={partnerName} streak={partnerStats.streak} perfectDays={partnerStats.perfectDays} />
              )}
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { label: 'Completion rate', value: `${myStats.completionPct}%` },
                { label: 'Tasks done', value: `${myStats.totalCompleted} / ${myTaskCount * clampedDay} possible` },
                { label: 'Perfect days', value: `${myStats.perfectDays}` },
                { label: 'Days left', value: `${Math.max(0, durationDays - currentDay)}` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-surface border border-border-muted rounded-[4px] p-4">
                  <p className="font-syne text-text-muted text-[0.65rem] uppercase tracking-[0.15em] mb-1">{label}</p>
                  <p className="font-mono font-medium text-2xl text-text-primary">{value}</p>
                </div>
              ))}
            </div>

            {/* Motivational copy */}
            {!isPostChallenge && (
              <p className="font-syne text-text-muted text-sm text-center mb-8">{getMotivationalCopy()}</p>
            )}

            {/* End screen */}
            {isPostChallenge && (
              <div className="mt-10 animate-fade-in">
                <h2 className="font-syne font-extrabold text-[3rem] leading-none text-text-primary tracking-tight mb-6" style={{ letterSpacing: '-0.02em' }}>
                  {durationDays} DAYS. DONE.
                </h2>

                {/* Final stats for both */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {[
                    { name: myName, stats: myStats },
                    ...(partnerConfig ? [{ name: partnerName, stats: partnerStats }] : []),
                  ].map(({ name: userName, stats }) => (
                    <div key={userName} className="bg-surface border border-border-muted rounded-[4px] p-4">
                      <p className="font-syne text-text-primary font-semibold mb-2">{userName}</p>
                      <div className="space-y-1 font-mono text-text-muted text-sm">
                        <p>Completion: {stats.completionPct}%</p>
                        <p>Tasks done: {stats.totalCompleted}</p>
                        <p>Perfect days: {stats.perfectDays}</p>
                        <p>Best streak: {stats.bestStreak}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="font-syne text-text-muted text-sm mb-6">{getEndCopy()}</p>

                <button
                  onClick={handleSaveGrid}
                  className="bg-amber text-bg font-syne font-semibold px-6 py-3 rounded-[4px] hover:opacity-90 transition-opacity"
                >
                  Save your grid
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Settings */}
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        myName={myName}
        partnerName={partnerName}
        myConfig={myConfig}
        partnerConfig={partnerConfig}
        meta={meta}
        currentDay={clampedDay}
        roomId={roomId}
        user={user}
        onTasksSaved={handleTasksSaved}
        onResetToday={handleResetToday}
        onSettingsSaveRedirect={handleSettingsSaveRedirect}
      />
    </>
  );
}

// ============================================================
// MAIN APP COMPONENT — auth + routing
// ============================================================
export default function App() {
  const [identity, setIdentity] = useState(loadIdentity);
  const [roomId, setRoomId] = useState(getRoomIdFromHash());

  // Listen for hash changes (back/forward)
  useEffect(() => {
    const onHashChange = () => setRoomId(getRoomIdFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (!identity) return <SignInScreen onSignIn={setIdentity} />;

  const user = { id: identity.id };

  // No room in URL → Dashboard
  if (!roomId) return <Dashboard user={user} onEnterRoom={(id) => setRoomId(id)} />;

  // Room view
  return <RoomView key={roomId} user={user} roomId={roomId} />;
}
