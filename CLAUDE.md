# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Movie catalog demo app: Express + SQLite (`better-sqlite3`) backend, zero-build static HTML/vanilla JS frontend. Demonstrates session-based auth with a role/permission system. Documentation and some API error messages are in Chinese (see README.md for full Chinese-language API reference).

## Commands

```bash
npm install     # install dependencies
npm start       # run the server (node server.js), listens on :3000 (override with PORT env var)
```

There is no build step, lint config, or test suite in this repo.

On first run, `db.js` auto-creates `movies.db` (SQLite file, gitignored) and `seed.js` seeds a default admin account (`admin` / `admin`) if no admin exists yet. Delete `movies.db` and restart to get a fresh database.

## Architecture

**Request flow:** `server.js` wires everything together — it creates the Express app, mounts `express-session` (in-memory store; secret from `SESSION_SECRET` env var, defaults to a hardcoded dev secret), runs `loadUser` middleware on every request to attach `req.user` from the session, serves `public/` statically, then mounts `routes/auth.js` at `/api` and `routes/users.js` at `/api/users`. The `/movies` endpoints are defined inline in `server.js` rather than in a separate routes file.

**Auth/permission model** (`middleware/auth.js`):
- `loadUser` — reads `req.session.userId`, loads the user row, attaches `req.user` (or destroys the session if the user is missing/disabled).
- `requireAuth` — 401 if no `req.user`.
- `requireAdmin` — 403 if `req.user.role !== 'admin'`.
- `requirePermission(flag)` — 403 unless `req.user.role === 'admin'` or `req.user[flag]` is truthy. Admins always implicitly pass `can_view`/`can_add` checks regardless of the stored flag values.

**Users table invariants** (enforced in `routes/users.js`, not at the DB layer):
- A `user`-role account's effective permissions come entirely from `can_view`/`can_add` booleans; `role` cannot be changed after creation via the API.
- The system must always retain at least one admin: deleting/disabling the last remaining admin is blocked, and a user can't delete/disable their own account.
- Login lockout (`routes/auth.js`): 4 failed attempts locks a non-admin account for 2 hours (`failed_attempts`/`locked_until` columns); admin accounts are exempt from lockout by design so the last admin can never be locked out.
- Disabling a user immediately invalidates their session on their next request (via `loadUser`'s disabled check), not just future logins.

**DB layer** (`db.js`): single shared `better-sqlite3` connection, synchronous `.prepare()/.run()/.get()/.all()` calls used directly in route handlers — no query builder/ORM. Schema changes are additive migrations done with `PRAGMA table_info` + `ALTER TABLE ADD COLUMN IF NOT EXISTS`-style checks at startup (see the `disabled`/`failed_attempts`/`locked_until` migration block); follow this pattern for new columns rather than editing the `CREATE TABLE` in place (existing databases won't get new columns from a changed `CREATE TABLE IF NOT EXISTS`).

**Password handling** (`auth.js`): `scrypt` with a random salt per user, stored as `salt`/`password_hash` columns; comparison uses `crypto.timingSafeEqual`.

**Frontend** (`public/`): no build step, no framework. Each HTML page is standalone and loads `app.js` for shared helpers (`apiFetch`, `getMe`, `requireLogin`, `logout`, `renderNav`). Pages call `requireLogin()` on load to redirect to `/login.html` if unauthenticated, and use `/api/me`'s returned permissions to decide which nav links/UI to show — but all real authorization happens server-side; the frontend only hides/shows based on what the backend already enforces.
