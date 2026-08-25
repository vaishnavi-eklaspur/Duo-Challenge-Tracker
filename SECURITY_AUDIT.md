# Security & Production-Readiness Audit — Duo Challenge Tracker

**Stack audited:** React 18 + Vite single-page app (no backend server) · Neon serverless Postgres via the [Data API](https://neon.tech/docs/data-api/get-started) (PostgREST) · Google Identity Services for sign-in · hosted on Vercel.

**Date:** 2026-08-25 · **Scope:** working tree + full git history + live deployment + database roles/grants.

This report states what was tested and what was changed. It does **not** claim the application is "secure." The most important finding — an intentionally open database — is architectural and is documented honestly in [Known Limitations](#known-limitations) rather than papered over.

---

## Summary table

| # | Category | Finding | Severity | Status |
|---|----------|---------|----------|--------|
| 1 | Secrets | `.env.local` **and** `.env.local.example` committed in the initial commit with real Supabase URL + anon key | Medium | **Flagged** (history scrub is manual; keys already dead) |
| 1 | Secrets | `.gitignore` now correctly ignores `.env.local` (was UTF-16-encoded and silently non-functional earlier) | — | **Fixed** |
| 1 | Secrets | Current in-code credentials (Neon token, Google client ID, `jwks.json`) are public-by-design, not private secrets | Info | **Verified** |
| 2 | Dependencies | 6 advisories in the dev/build toolchain; **0 in production dependencies** | High→ | **Fixed** (4 patched) |
| 2 | Dependencies | esbuild/vite dev-server advisory (needed breaking `vite@5→8`) — upgraded to Vite 8; `npm audit` now **0 total** | Low (dev-only) | **Fixed** |
| 3 | Auth / access | No RLS; shared static JWT grants any visitor full read/write/delete on **every** challenge (IDOR by design) | High | **Flagged** (architectural) |
| 3 | Auth / access | Google ID token decoded client-side without signature verification | Medium | **Flagged** (identity ≠ access control here) |
| 3 | Auth / access | Static sign-in JWT has a 10-year expiry and never rotates | Low | **Flagged** |
| 4 | Injection | SQL via PostgREST is parameterized; no raw/concatenated SQL | — | **Verified** |
| 4 | Injection | No `dangerouslySetInnerHTML` / `eval` / `innerHTML`; React auto-escapes | — | **Verified** |
| 4 | Injection | No shell execution and no user-driven outbound requests (no command-injection / SSRF surface) | — | **Verified** |
| 5 | Transport / headers | No security response headers were set | Medium | **Fixed** (added via `vercel.json`) |
| 5 | Transport | CORS effectively open at the Data API; no rate limiting (no server tier) | Medium | **Flagged** |
| 6 | Errors / logging | Users see generic messages; no stack traces; prod build minified; no debug mode; no PII in logs | — | **Verified** |
| 7 | Data protection | Neon encrypts at rest; client uses the non-privileged `authenticated` role, not the owner connection string | — | **Verified** |
| 7 | Data protection | Unused `anonymous` role held table grants | Low | **Fixed** (grants revoked) |
| 8 | Config / hygiene | `.gitignore` covers `node_modules` / `.env.local` / `dist`; README documents setup with no live private secrets | — | **Verified** |
| 9 | Code quality | No tests, no CI | Medium | **Fixed** (added 6 unit tests + GitHub Actions) |
| 9 | Code quality | Commit history is granular and meaningful (23 commits), not a single squash | — | **Verified** |

---

## 1. Secrets & credentials

**(a) What I found.** `git log --all --diff-filter=A` shows `.env.local` was committed in the very first commit (`440ab1b`), and a `.env.local.example` was committed carrying the **same real values** (not placeholders):

```
VITE_SUPABASE_URL=https://deleted-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiI...role":"anon"...
```

Both files still exist in git history even though they were later removed from the working tree. Separately, the earlier "fix" that added `.env.local` to `.gitignore` was a no-op because the file was saved as UTF-16, which git cannot parse — that has since been rewritten as ASCII and verified with `git check-ignore`.

The credentials that leaked were the **Supabase project URL and anon key**. The anon key is a client-side key (not a service-role secret), and — critically — **the Supabase project has since been deleted**, so these values now point at nothing.

The application's *current* credentials are all public-by-design, not private secrets:
- the Neon Data API base URL and its long-lived RS256 JWT (the "anon key" equivalent — verified against a public JWKS),
- the Google OAuth **client ID** (a public identifier),
- `public/jwks.json` (a public key, meant to be served publicly).

There is no private key, service-role token, or database owner password anywhere in the tree or history.

**(b) Severity.** Medium. It would be Critical if the leaked key were a live service-role secret; it is downgraded because (i) it was only a client anon key and (ii) the backing project is deleted.

**(c) Fix applied / recommended.**
- ✅ `.gitignore` now genuinely ignores `.env.local` (ASCII, verified).
- ⚠️ **Manual, by you:** the leaked values remain in history. Because the Supabase project is deleted, **rotation is not required** (there is nothing to rotate). If you want a clean history for portfolio presentation, run `git filter-repo --path .env.local --path .env.local.example --invert-paths` (or BFG) and force-push. This is intentionally left as a manual step.

**(d) Interview explanation.** *"An early commit leaked a Supabase URL and anon key through a committed `.env.local`, and the `.gitignore` meant to prevent that was silently broken because it had been saved as UTF-16, which git can't read. I re-saved it as ASCII and verified it with `git check-ignore`. The leaked key was a client-side anon key, not a server secret, and the project it pointed at has since been deleted, so there's nothing live to rotate — but I've flagged that the values still live in git history, and scrubbing history is a deliberate manual step with `filter-repo` rather than something to do silently on a shared branch."*

## 2. Dependency vulnerabilities

**(a) What I found.** `npm audit` reported 6 advisories (1 low, 1 moderate, 4 high). Every one of them is in the **build toolchain** (`@babel/core`, `postcss`, `nanoid`, `picomatch`, `esbuild`, `vite`). Running `npm audit --omit=dev` reports **0 vulnerabilities** — nothing vulnerable is shipped in the production bundle that reaches users.

**(b) Severity.** High as raw numbers, but the real user-facing exposure is Low: these are dev-time tools. The one that matters most (esbuild GHSA-67mh-4wv8-2f99) only affects the local `vite dev` server.

**(c) Fix applied / recommended.**
- ✅ Ran `npm audit fix` (non-breaking): patched `@babel/core`, `postcss`, `nanoid`, `picomatch`. 6 → 2 advisories.
- ✅ Then upgraded `vite@5 → vite@8` (+ `@vitejs/plugin-react@6`) deliberately; the build and the `node:test` suite both pass on the new major, so `npm audit` now reports **0 vulnerabilities** across the whole tree. Pinned `engines.node >= 20.19` (Vite 8's runtime floor).

**(d) Interview explanation.** *"npm audit flagged six issues, but all of them were in build tooling — `npm audit --omit=dev` shows zero in what actually ships to the browser. I applied the non-breaking fixes, which cleared four of them, and deliberately did not force the last two because the only clean fix is a major Vite upgrade that could break the build. I flagged it instead, and wired the CI to fail only on production-dependency vulnerabilities so the dev-only noise doesn't create false alarms."*

## 3. Authentication & session handling

**(a) What I found.**
- **No passwords exist** — sign-in is Google OAuth, so there is no password storage/hashing concern.
- **JWT / session:** the app does not use session cookies; a per-browser identity is kept in `localStorage`. On sign-in, Google's ID token is **decoded client-side (`atob`) without verifying its signature** to read the user's `sub` and name. There is no server, so nothing verifies the token.
- **Database access token:** every request to the Data API carries **one shared, static RS256 JWT** with `role: authenticated` and a **10-year expiry**. Neon verifies its signature against the public JWKS — so the *token* is authentic, but it is the same token for everyone.
- **Authorization / IDOR:** I queried the live database. **RLS is disabled** on all three tables and both `anonymous` and `authenticated` roles hold `SELECT/INSERT/UPDATE/DELETE`. Because everyone shares one token, **any visitor can read, modify, or delete any challenge's rows** by changing IDs in requests. This is an IDOR condition, and it is inherent to the "static SPA + public token, no server" architecture.

**(b) Severity.** High for the open-database/IDOR condition. Medium for the unverified client-side token decode. Low for the 10-year non-rotating token.

**(c) Fix applied / recommended.** These are **architectural** and not safely patchable in a static SPA — see [Known Limitations](#known-limitations). The honest fix is a thin backend (or Postgres RLS driven by per-user JWTs minted server-side) so that each user gets a token scoped to their own `sub`, and RLS policies restrict every row to its owner/partner. One low-risk hardening has been **applied**: the unused `anonymous` role's grants were revoked —

```sql
REVOKE ALL PRIVILEGES ON challenge_meta, challenge_config, challenge_logs FROM anonymous;
```

The `anonymous` role is never used (unauthenticated requests are already rejected), so revoking its grants shrank the attack surface with no functional impact. Verified after the change: the app's `authenticated` role still reads (200) and a no-token request is rejected (400).

**(d) Interview explanation.** *"There are no passwords — it's Google sign-in — so the interesting question is authorization, not authentication. This is a serverless SPA that talks straight to Postgres over Neon's Data API using one shared public token, and I confirmed against the live database that row-level security is off and that token has full CRUD. That means it's identity without authorization: anyone can reach anyone's data. I did not pretend to fix that with a client-side patch, because you can't — the real fix is a small backend that mints per-user tokens plus RLS policies scoping rows to their owner. I documented it as the headline limitation and gave the exact RLS/scoping design, which for a two-person habit tracker is a conscious trade-off, not an oversight."*

## 4. Input validation & injection

**(a) What I found.**
- **SQL injection:** the app never writes SQL. All data access goes through the PostgREST query builder (`from().select().eq()` …), which sends parameterized filters — no string-concatenated SQL exists.
- **XSS:** `grep` found no `dangerouslySetInnerHTML`, `eval`, `innerHTML`, or `document.write`. React escapes interpolated values by default. The only `<style>{…}` injection uses a static constant (the footer CSS), never user input.
- **Command injection / SSRF:** it is a browser app with no shell execution and no outbound requests built from user input (the only external calls are to fixed hosts: the Data API, Google, and Google Fonts).

**(b) Severity.** None found.

**(c) Fix applied / recommended.** Nothing to change. User-supplied task text and names are stored as data and rendered as React text nodes (escaped).

**(d) Interview explanation.** *"There's no injection surface to speak of: database access is parameterized through PostgREST so there's no hand-written SQL, React escapes all interpolated output and there's no `dangerouslySetInnerHTML` or `eval`, and being a static browser app there's no shell or server-side URL fetching, so command injection and SSRF don't apply. I verified each of those with a grep rather than assuming."*

## 5. API & transport security

**(a) What I found.** Vercel serves the site over HTTPS and redirects HTTP→HTTPS by default, but the app set **no security response headers at all** — no CSP, no `X-Content-Type-Options`, no framing protection, no HSTS, no `Referrer-Policy`. CORS at the Data API is effectively open (any origin holding the public token can call it), and there is no application-level rate limiting because there is no server tier.

**(b) Severity.** Medium (missing headers). Medium (open CORS / no rate limiting — bounded by the fact that the token is public-by-design anyway).

**(c) Fix applied / recommended.**
- ✅ Added `vercel.json` setting: a scoped **Content-Security-Policy** (allows only self + the specific Google sign-in, Google Fonts, and Neon Data API origins), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` + `frame-ancestors 'none'` (clickjacking), `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security` (2-year HSTS + preload), and a restrictive `Permissions-Policy`.
- ⚠️ Rate limiting and origin-restricted CORS require a backend or a WAF/edge layer; flagged, not added.

**(d) Interview explanation.** *"The app was served over HTTPS but sent none of the standard hardening headers, so I added a `vercel.json` that sets a content-security-policy allowlisting exactly the origins the app uses — itself, Google sign-in, Google Fonts, and the Neon endpoint — plus nosniff, clickjacking protection via frame-ancestors, HSTS, and a locked-down permissions policy. CSP with a third-party sign-in is easy to get subtly wrong, so I scoped it to the specific Google endpoints and verified the sign-in button still renders under it. Rate limiting I flagged rather than faked, because there's no server to enforce it."*

## 6. Error handling & logging

**(a) What I found.** User-facing failures show generic copy ("Could not save. Check your connection and try again."); internal detail only goes to `console.error` in the browser, never to the UI. The production build is a minified Vite bundle with no debug/verbose mode, and there is no server emitting stack traces or writing logs, so there is no channel that could leak PII or tokens into logs.

**(b) Severity.** None found.

**(c) Fix applied / recommended.** No change. (If a backend is later added, keep this posture: generic client messages, structured server logs with secrets redacted.)

**(d) Interview explanation.** *"Errors are surfaced to users as generic, non-technical messages, and the only detailed output is a client-side console log for debugging — there's no server returning stack traces and no log sink that could capture tokens or personal data. The production build is minified with no debug flag. So the 'don't leak internals to the client' and 'don't log secrets' concerns are both satisfied by construction here."*

## 7. Data protection

**(a) What I found.** Neon (managed Postgres) encrypts data at rest at the platform level. The browser connects with the **non-privileged `authenticated` role**, never the `neondb_owner` connection string (which stays out of the client entirely) — so credential-wise it is least-privilege at the connection layer, even though that role's *grants* are broad (see §3). The PII actually stored is minimal: a Google account ID (`sub`), the user's first name, and their self-entered task text. No emails, no contact info, no location.

**(b) Severity.** Low. Data-at-rest and connection privilege are handled; the residual risk is the broad row access covered in §3.

**(c) Fix applied / recommended.** ✅ Verified encryption-at-rest and least-privilege connection role. ✅ Applied the `REVOKE … FROM anonymous` (see §3). ⚠️ If you ever store more than a first name, reconsider whether it's needed (less stored PII = less risk).

**(d) Interview explanation.** *"Data's encrypted at rest by Neon, and importantly the browser connects as a limited role, not the database owner — the owner connection string never leaves the server side of the tooling. The app deliberately stores very little personal data: a Google user ID, a first name, and the tasks people type. The weakness isn't what's stored or how it's encrypted, it's who can read it, which is the row-level-access issue I covered under authorization."*

## 8. Config & deployment hygiene

**(a) What I found.** `.gitignore` now covers `node_modules/`, `.env.local`, and `dist/`. The README documents setup end-to-end and contains **no live private secrets** (it explains the public-token model rather than embedding a private key). There is no separate dev/staging/prod config — but because the Neon token and Google client ID are public-by-design, there is no dev secret that could leak into prod. One blemish: the committed `.env.local.example` used **real** values instead of placeholders (see §1).

**(b) Severity.** Low.

**(c) Fix applied / recommended.** ✅ Corrected a stale README reference (`@supabase/supabase-js` → `@supabase/postgrest-js`, matching the actual dependency after slimming the client). ⚠️ If scrubbing history (§1), replace the example file's real values with placeholders (`VITE_...=your-value-here`).

**(d) Interview explanation.** *"The ignore rules and README are in good shape — setup is documented and there's no private secret in the docs, just an explanation of the public-token design. There isn't a dev/prod config split, but that's acceptable here because every credential the client holds is public by design, so there's no dev secret that could bleed into production. The one hygiene miss was an example env file committed with real values instead of placeholders, which I've folded into the history-scrub recommendation."*

## 9. Code-quality signals a reviewer will check

**(a) What I found.** There were **no automated tests and no CI**. Commit history, on the other hand, is healthy: 23 commits with descriptive messages showing real iteration (migration, hardening, redesign) — not a single squashed "final commit."

**(b) Severity.** Medium (absence of tests/CI is the kind of gap a reviewer notices immediately).

**(c) Fix applied / recommended.**
- ✅ Extracted the pure logic (date math, pluralization, room-ID generation) into `src/lib.js` and added `src/lib.test.js` — **6 tests on Node's built-in runner, no test-framework dependency** (`npm test` → `node --test`). They cover the calendar-day math (including a DST boundary), 1-indexed challenge day, possessive/plural edge cases, and room-ID format.
- ✅ Added `.github/workflows/ci.yml` (GitHub Actions): on every push/PR it runs `npm ci`, the tests, the production build, and `npm audit --omit=dev --audit-level=high` (fails only on vulnerabilities that reach users).

**(d) Interview explanation.** *"The project had zero tests and no CI, which is the first thing a reviewer checks, so I addressed both. I pulled the pure logic — the streak/date arithmetic especially — out of the 1,500-line component into its own module and wrote tests against it using Node's built-in test runner, so there's meaningful coverage with no extra dependency. Then I added a GitHub Actions pipeline that runs the tests, the build, and a production-scoped dependency audit on every push. The commit history was already granular and honest, which I left alone because that itself is a signal reviewers value."*

---

## Known Limitations

These are **not fixed**, by deliberate decision, scope, or because they require a manual step only you should take:

1. **The database is open by design (highest-priority limitation).** With no server, the app authenticates to Postgres with a single shared public token, RLS is off, and that role has full CRUD — so anyone can read or modify any challenge's data. Genuinely closing this requires an architectural change: a thin backend (or Neon RLS driven by per-user, server-minted JWTs) so each user gets a token scoped to their own identity and row-level policies restrict data to its owner and partner. For a two-person habit tracker shared by link, this was an accepted trade-off; it would be unacceptable for anything holding sensitive data. **This is the one thing I'd fix first if this became a real product.**

2. **Sign-in identity is not cryptographically enforced.** The Google ID token is decoded in the browser without signature verification (there's no server to verify it), and identity lives in `localStorage`. Someone could forge an identity locally. It doesn't grant extra data access beyond limitation #1 (the DB is already open), but it means "who you are" is a convenience, not a security boundary.

3. **Leaked secrets remain in git history — one manual command away from removed.** The old Supabase URL/anon key are still reachable via `git log`. Rotation is unnecessary (the project is deleted). The history rewrite itself is a destructive, force-push operation that must be run by you (it was intentionally not auto-executed):

   ```bash
   git filter-repo --force --invert-paths --path .env.local --path .env.local.example
   git remote add origin https://github.com/vaishnavi-eklaspur/Duo-Challenge-Tracker.git
   git push --force --all && git push --force --tags
   ```

   (`git filter-repo` drops the `origin` remote as a safety measure, hence the re-add.) Verify afterward with `git log --all -S deleted-project` returning nothing.

4. **No rate limiting or origin-restricted CORS.** Both need a server or edge/WAF layer that this static deployment doesn't have. The blast radius is bounded by the fact that the access token is already public.

5. **The CSP is verified for page load and button render, not the full popup flow.** The added Content-Security-Policy allows the specific Google sign-in origins; the sign-in button renders under it and the page loads with no CSP violations, but the complete OAuth popup round-trip should be re-checked in the browser after deploy. If Google sign-in ever breaks after a Google-side change, the CSP `script-src`/`frame-src`/`connect-src` entries for `accounts.google.com` are the first place to look. Rollback is simply removing the `Content-Security-Policy` entry from `vercel.json`.
