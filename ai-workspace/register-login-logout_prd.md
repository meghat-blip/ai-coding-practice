Date created: 2026-08-28
Date last modified: 2026-08-28 (Phase 1 complete)

# Register, Login, and Logout - Technical PRD

## Overview/Problem

QuizMaker is a greenfield app for multiple teachers who will later collaborate on a shared bank of multiple-choice questions. There is no application identity yet: no user records, no way to register, and no way to sign in or out. This first phase only solves identity so more than one teacher can have an account. Question-bank (MCQ) features are not part of this phase.

---

## Hypothesis

We believe that a simple hashed-password register, login, and logout flow will let multiple teachers create and use accounts so later sprints can attach MCQ work to those users.

---

## Scope

### In Scope

- A `users` table on Cloudflare D1 (SQLite), created via a Wrangler migration
- Password stored only as a hash (never plaintext)
- Client-side hashing of the password before `POST` on both register and login
- A user service with create, update, and delete (plus the reads login needs)
- HTTP endpoints: register, login, logout
- Register and login pages that call those endpoints
- After successful register or login, redirect to a stub MCQ page
- Logout endpoint plus UI that returns the user to a signed-out screen (login or home)
- Unique username and unique email (they may be the same value)
- Test-driven implementation with **Vitest**: each phase starts with failing unit tests, then implementation until those tests pass

### Out of Scope

- Multiple-choice question authoring, test banks, or collaboration on questions
- Social login (Google, GitHub, and similar)
- Tokens (JWT, API keys, refresh tokens)
- Session management (cookies, `Set-Cookie`, server sessions, middleware guards)
- Password reset, email verification, or profile settings UI
- Role-based access control
- Applying D1 migrations to the remote (production) database

### Cut

- Server-side sessions and cookies — deferred so this phase stays a thin identity layer
- Token-based auth — not needed without APIs that must stay authenticated after login
- Hashing-only-on-the-server — this phase hashes on the client and sends the hash in the POST body, then stores that hash
- Route protection for `/mcqs` — without sessions there is nothing to enforce; the stub is reachable by URL
- `@cloudflare/vitest-pool-workers` — unit tests mock D1 via `getCloudflareContext`; do not change the whole suite to the Workers pool unless the user asks

---

## Testing Approach (TDD)

Vitest is the project unit-testing framework (see `.cursor/skills/testing/SKILL.md`). It is not installed yet. Install it the first time tests are needed, with the user's approval (given in this PRD):

```bash
npm install -D vitest@3 @vitejs/plugin-react@4 @testing-library/react @testing-library/user-event jsdom vite-tsconfig-paths
```

Pin `@vitejs/plugin-react` to v4: latest v6 pulls Babel 8 and conflicts with this repo's Babel 7 tree.

Add `vitest.config.ts` (jsdom, `globals: true`, `vite-tsconfig-paths` for `@/`), and scripts `"test": "vitest run"` and `"test:watch": "vitest"`.

**Red → green for every phase:**

1. Write the tests listed for that phase **before** the production code they cover. `npm run test` must fail (red) for a real reason: missing module, failing assertion, or unimplemented behavior. Hollow tests (`expect(true).toBe(true)`) are not allowed.
2. Implement the minimum code for those tests to pass (green).
3. A phase is not done until that phase's tests are green **and** the phase acceptance criteria are met.
4. Later phases must keep earlier tests green.

**Conventions:**

- Colocate: `src/lib/services/user-service.ts` ↔ `src/lib/services/user-service.test.ts`
- Never hit a real network, real D1, or a real model in unit tests. Mock `getCloudflareContext` and supply a fake `env.DB`.
- Assert observable output and side effects. Cover failure paths, not only the happy path.
- Each test must pass in isolation. `vi.clearAllMocks()` in `beforeEach`.
- Server Components: do not render them with Testing Library. Test data/helpers as functions; render only `'use client'` UI.
- Browser verification in Phase 3 is **in addition to** Vitest, not a substitute for it.

---

## Technical Requirements

### Database Schema

Cloudflare D1 is not configured yet. Implementation must create a D1 database, bind it as `DB` in `wrangler.jsonc`, run `npm run cf-typegen`, and add a local-only migration. Do not apply migrations with `--remote`.

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_email ON users (email);
```

| Column | Type | Notes |
|--------|------|--------|
| `id` | TEXT PK | Random 16-byte hex, same pattern as the starter template |
| `first_name` | TEXT NOT NULL | Display name |
| `last_name` | TEXT NOT NULL | Display name |
| `username` | TEXT NOT NULL UNIQUE | Login identifier; may equal `email` |
| `email` | TEXT NOT NULL UNIQUE | May equal `username` |
| `password_hash` | TEXT NOT NULL | SHA-256 hex of the password as sent by the client |
| `created_at` | DATETIME | Default now |
| `updated_at` | DATETIME | Updated on user service `update` |

Never select `password_hash` into API success payloads.

### Password hashing (this phase)

This is basic auth for a teaching app, not production-grade identity.

1. On register and login, the **browser** hashes the typed password with SHA-256 (Web Crypto) and sends the hex digest in the POST body.
2. Register **stores** that digest in `users.password_hash`.
3. Login hashes the typed password the same way, then the **server** compares the digest to `password_hash` with a constant-time string compare.
4. The server never writes plaintext passwords. If a request arrives without a 64-character hex digest, reject it (400).

Do not add a hashing library unless the user agrees. Web Crypto works on both the client and the Workers runtime.

### API Endpoints

Route handlers live under `src/app/api/` because this phase uses explicit HTTP POST, not Server Actions.

#### POST /api/auth/register

**Request Body:**

```json
{
  "firstName": "Ada",
  "lastName": "Lovelace",
  "username": "ada@school.edu",
  "email": "ada@school.edu",
  "passwordHash": "64-char-sha256-hex"
}
```

`username` and `email` may be identical.

**Response:**

- Success (201): `{ "id": "...", "firstName": "...", "lastName": "...", "username": "...", "email": "..." }` (no password fields)
- Error (400): missing/invalid fields, or `passwordHash` not a SHA-256 hex digest
- Error (409): username or email already taken
- Error (500): unexpected server error

#### POST /api/auth/login

**Request Body:**

```json
{
  "username": "ada@school.edu",
  "passwordHash": "64-char-sha256-hex"
}
```

Login identifies the user by `username` (which may be the same string as email).

**Response:**

- Success (200): same user object shape as register (no password fields)
- Error (400): missing/invalid fields
- Error (401): unknown username or hash mismatch (same message for both: `"Invalid username or password"`)
- Error (500): unexpected server error

#### POST /api/auth/logout

**Request Body:** none required (`{}` allowed)

**Response:**

- Success (200): `{ "ok": true }`

There is no session to destroy. Logout is a client redirect after this call (or even if the call fails). The endpoint exists so the UI has a single contract and later sprints can add session teardown without changing the page.

Register and login **must** go through the user service for D1 reads and writes. Logout does not need the user service.

### User Interface Requirements

Use existing shadcn/ui (`Input`, `Button`, `Card`, `Label`, `Field`) and Lucide. Forms are `'use client'` only for local state and fetch; they must not import D1.

#### Home (/)

- Replace or slim the starter page so teachers can reach Register and Login
- Optional: a Logout control is not required here until after login

#### Register (/register)

- Fields: first name, last name, username, email, password (password input type, never echo plaintext in logs)
- Validation: all required; email must look like an email; password minimum length 8 (validate **before** hashing)
- Submit: hash password → POST `/api/auth/register` → on 201, navigate to `/mcqs`
- Show field/server errors (400/409) on the form
- Link to `/login`

#### Login (/login)

- Fields: username, password
- Submit: hash password → POST `/api/auth/login` → on 200, navigate to `/mcqs`
- Show 401 as a single non-specific error
- Link to `/register`

#### MCQ stub (/mcqs)

- Placeholder only: heading that this is the question bank, copy that MCQ features come next sprint
- Logout control: POST `/api/auth/logout` then navigate to `/login`
- No question CRUD, no list of questions

#### Validation rules (shared)

- Trim text fields
- Username: non-empty, reasonable max length (e.g. 255)
- Email: non-empty, valid email format
- Password: min 8 characters on the client before hashing
- Do not send the raw password in the JSON body

---

## Implementation Phases

TDD is required in every phase: listed tests first (red), then implementation (green). `npm run test` is a phase gate along with the acceptance criteria.

### Phase 1: Database and user service - COMPLETED

**Objective**: Vitest harness exists; D1 exists locally; `users` is migrated; the user service can create, update, delete, and look up users.

**TDD — tests to write first (expect red):**

| File | Behavior to assert |
|------|-------------------|
| `src/lib/password.test.ts` | `sha256Hex` returns a 64-char lowercase hex digest; same input → same output; different input → different digest |
| `src/lib/password.test.ts` | `isSha256Hex` accepts a valid digest and rejects plaintext, empty, wrong length, and non-hex |
| `src/lib/services/user-service.test.ts` | `createUser` inserts bound fields and returns a `PublicUser` with no `passwordHash` |
| `src/lib/services/user-service.test.ts` | `createUser` with username equal to email succeeds |
| `src/lib/services/user-service.test.ts` | duplicate username or email is treated as a conflict (throw or typed error the API can map to 409) |
| `src/lib/services/user-service.test.ts` | `getUserByUsername` returns the stored hash for compare, or `null` when missing |
| `src/lib/services/user-service.test.ts` | `updateUser` updates allowed fields and `updated_at` |
| `src/lib/services/user-service.test.ts` | `deleteUser` removes the row; subsequent get returns `null` |

Mock `@opennextjs/cloudflare` and a fake D1 (`prepare` / `bind` / `all` / `run`). Do not talk to real D1 in these tests.

**Tasks**:

1. Install Vitest and related packages; add `vitest.config.ts` and `test` / `test:watch` scripts
2. Write the Phase 1 tests above; confirm `npm run test` is red
3. Implement `src/lib/password.ts` until password tests are green
4. Create D1 (`npx wrangler d1 create` — name aligned with `quizmaker`) and add `d1_databases` binding `DB` in `wrangler.jsonc`
5. Run `npm run cf-typegen`
6. Create a migration for `users` and apply **locally only**
7. Implement `src/lib/services/user-service.ts` (prepared statements, `?1` placeholders, no `first()`) until user-service tests are green
8. Add empty placeholders to `.dev.vars.example` if any new vars are introduced (none expected for D1 beyond the binding)

**Phase 1 gate:** `npm run test` green for Phase 1 files; D1 migrated locally; user service implemented.

**Deliverables**:

- Vitest config and npm test scripts
- `wrangler.jsonc` D1 binding
- `migrations/` SQL for `users`
- `src/lib/password.ts` and colocated tests
- User service with create, update, delete, and get-by-username, plus colocated tests

### Phase 2: Auth HTTP endpoints - PLANNED

**Objective**: Register, login, and logout HTTP APIs sit in front of the user service.

**TDD — tests to write first (expect red):**

| File | Behavior to assert |
|------|-------------------|
| `src/app/api/auth/register/route.test.ts` | Valid body → 201 and public user; `createUser` called with the given `passwordHash` |
| `src/app/api/auth/register/route.test.ts` | Username and email the same string still 201 |
| `src/app/api/auth/register/route.test.ts` | Missing fields or non-SHA-256 `passwordHash` → 400; user service not called |
| `src/app/api/auth/register/route.test.ts` | Duplicate identity from the service → 409 |
| `src/app/api/auth/register/route.test.ts` | Success JSON has no `password` / `passwordHash` / `password_hash` |
| `src/app/api/auth/login/route.test.ts` | Matching username + hash → 200 public user |
| `src/app/api/auth/login/route.test.ts` | Unknown user or hash mismatch → 401 `{ "error": "Invalid username or password" }` (same message both cases) |
| `src/app/api/auth/login/route.test.ts` | Invalid body → 400 |
| `src/app/api/auth/login/route.test.ts` | Success JSON has no password fields |
| `src/app/api/auth/logout/route.test.ts` | POST → 200 `{ "ok": true }` (no user-service call required) |

Mock the user service at the module boundary. Do not import a real D1.

**Tasks**:

1. Write the Phase 2 tests above; confirm they are red (`npm run test`)
2. Implement `POST /api/auth/register` and `POST /api/auth/login` using the user service
3. Implement `POST /api/auth/logout` returning `{ "ok": true }`
4. Validate input before touching D1; never return `password_hash`
5. Confirm Phase 1 and Phase 2 tests are all green

**Phase 2 gate:** `npm run test` green for Phase 1 + Phase 2 files.

**Deliverables**:

- Three route handlers under `src/app/api/auth/` and colocated tests
- Duplicate username/email → 409
- Bad credentials → 401 with a generic message

### Phase 3: UI and MCQ stub - PLANNED

**Objective**: Teachers can register, log in, land on `/mcqs`, and log out.

Extract client form logic into testable client components (or small helpers) so Vitest can render them. Do not try to render Server Component page files with Testing Library.

**TDD — tests to write first (expect red):**

| File | Behavior to assert |
|------|-------------------|
| Register form test (e.g. `src/components/auth/register-form.test.tsx`) | Renders first name, last name, username, email, password; password field is `type="password"` |
| Same | Submitting with password shorter than 8 does not `fetch`; shows a validation message |
| Same | Valid submit hashes the password (assert POST body `passwordHash` is 64-char hex and is **not** the typed password) and POSTs `/api/auth/register` |
| Same | 201 response navigates to `/mcqs` |
| Same | 409 / 400 responses show the server error on the form (no navigation) |
| Login form test (e.g. `src/components/auth/login-form.test.tsx`) | Submits hashed password to `/api/auth/login`; 200 → `/mcqs`; 401 shows `"Invalid username or password"` |
| MCQ stub / logout (e.g. `src/components/auth/logout-button.test.tsx`) | Logout control POSTs `/api/auth/logout` then navigates to `/login` |

Mock `fetch` and the Next.js router (`next/navigation`). Use Testing Library + `userEvent`; query by role and accessible name.

**Tasks**:

1. Write the Phase 3 component tests above; confirm they are red
2. Implement register and login client forms (hash then POST) until tests are green
3. Wire pages at `/register`, `/login`, `/mcqs`; home links to register/login
4. `/mcqs` stub copy only — no MCQ CRUD
5. Browser verification of happy path and error paths (register, login, logout, duplicate, validation)
6. Confirm the full Vitest suite stays green

**Phase 3 gate:** `npm run test` green for all phases; browser pass; `npm run lint` and `npm run build` succeed.

**Deliverables**:

- Pages at `/`, `/register`, `/login`, `/mcqs`
- Client form/logout components and colocated tests
- Lint, unit tests, and production build passing

---

## Technical Implementation Details

### Key Files

- `vitest.config.ts` — Vitest + jsdom + `@/` paths
- `wrangler.jsonc` — D1 `DB` binding
- `migrations/` — `users` table
- `src/lib/password.ts` / `src/lib/password.test.ts` — SHA-256 hex helper
- `src/lib/services/user-service.ts` / `src/lib/services/user-service.test.ts` — D1 access for users
- `src/app/api/auth/register/route.ts` / `route.test.ts` — register
- `src/app/api/auth/login/route.ts` / `route.test.ts` — login
- `src/app/api/auth/logout/route.ts` / `route.test.ts` — logout
- `src/components/auth/` — client forms and logout, with `*.test.tsx`
- `src/app/register/page.tsx` — register UI
- `src/app/login/page.tsx` — login UI
- `src/app/mcqs/page.tsx` — MCQ stub
- `src/app/page.tsx` — entry with links to auth

### Implementation Patterns

User service (illustrative; adjust to real types):

```typescript
// src/lib/services/user-service.ts
// Reach D1 via getCloudflareContext() from @opennextjs/cloudflare, then env.DB.
// Always bind with ?1, ?2, ... Never concatenate SQL.
// Prefer results[0] over first().

export type PublicUser = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
};

export async function createUser(/* fields including passwordHash */): Promise<PublicUser> { /* insert */ }
export async function updateUser(/* id + fields */): Promise<PublicUser> { /* update */ }
export async function deleteUser(id: string): Promise<void> { /* delete */ }
export async function getUserByUsername(username: string): Promise<(PublicUser & { passwordHash: string }) | null> {
  /* select including password_hash for login compare only; never send hash to the client */
}
```

Client hash then POST:

```typescript
async function sha256Hex(plaintext: string): Promise<string> {
  const data = new TextEncoder().encode(plaintext);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

### Important Notes

- AGENTS.md: ask before adding a dependency. Prefer Web Crypto over bcrypt/argon2 packages. If Zod is added for request validation (Next.js rule), propose it first.
- Do not import the user service or `getCloudflareContext` into `'use client'` files.
- `npm run dev` does not prove D1/Workers behavior. Use `npm run preview` for anything runtime-sensitive.
- Without sessions, a user who knows `/mcqs` can open it without logging in. That is accepted for this phase.
- Logout cannot invalidate anything server-side yet.
- Client-side hashing does not replace HTTPS: the digest is the stored secret. Treat it as a teaching constraint, not a security claim.
- Unique indexes: handle D1 unique-constraint failures as 409, not 500.
- Do not deploy. Do not migrate remote D1.
- Follow `.cursor/skills/testing/SKILL.md`. User approved Vitest for this work; do not add other test runners.
- A phase that implements first and tests after is incomplete. Tests go red first.

---

## Acceptance Criteria

- [ ] A teacher can register with first name, last name, username, email, and password and is taken to `/mcqs`
- [ ] Username and email may be the same string and still succeed
- [ ] The database stores `password_hash` only; plaintext password is not stored
- [ ] Register and login POST bodies send a SHA-256 hex digest, not the typed password
- [ ] A teacher can log in with username and password and is taken to `/mcqs`
- [ ] Wrong username or password returns 401 with a generic message and the user stays on `/login`
- [ ] Duplicate username or email on register returns 409 and is shown on the form
- [ ] Validation errors (missing fields, bad email, short password) return 400 and are shown on the form
- [ ] Logout from `/mcqs` calls POST `/api/auth/logout` and returns the user to `/login` (or home)
- [ ] `/mcqs` is a stub only: no MCQ create/edit/list
- [x] User service supports create, update, and delete even if only create/read are used by HTTP in this phase
- [x] Phase 1 Vitest tests were written first (red: missing modules) and pass after implementation (green: 12 tests)
- [x] Unit tests do not call real D1, network, or model providers
- [ ] Remaining phase Vitest tests (Phase 2–3) written first (red) then green
- [x] `npm run test`, `npm run lint`, and `npm run build` succeed after Phase 1

---

## Success Metrics

There is no production traffic yet. Success for this phase is that the teaching flow works locally.

| Metric | Target | How Measured |
|--------|--------|--------------|
| Register happy path | Completes to `/mcqs` | Manual browser pass |
| Login happy path | Completes to `/mcqs` | Manual browser pass |
| Logout | Lands on signed-out page | Manual browser pass |
| Duplicate identity | 409, no second row | Local D1 query / UI error |
| Build health | Lint, unit tests, and build pass | `npm run lint`, `npm run test`, `npm run build` |

---

## Dependencies

### External Dependencies

- Cloudflare D1 — user storage (create locally; do not touch remote)
- Wrangler — database create, migrations list/apply `--local`, typegen

### Internal Dependencies

- `@opennextjs/cloudflare` `getCloudflareContext()` — D1 access from server code
- `src/lib/services/user-service.ts` — all user persistence
- shadcn/ui form primitives already in `src/components/ui/`
- Web Crypto (`crypto.subtle.digest`) — SHA-256, no extra hashing package
- **Vitest** (dev) — unit tests; also `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `vite-tsconfig-paths` (user approved)

### Environment

- D1 binding `DB` in `wrangler.jsonc` (not a secret in `.dev.vars`)
- No auth secrets required for this phase
- If any secret is added later, put local values in `.dev.vars` and an empty key in `.dev.vars.example`

---

## Risks and Mitigation

### Technical Risks

- **Risk**: `npm run dev` (Node) hides D1/Workers issues
- **Mitigation**: Verify register/login against D1 with `npm run preview`

- **Risk**: Unique constraint on username/email surfaces as an uncaught exception
- **Mitigation**: Catch and map to 409

- **Risk**: Client-side SHA-256 is not a password KDF; intercepted hashes are replayable
- **Mitigation**: Accepted for this phase; document it; do not claim production security. Later phases can add HTTPS, a KDF, and sessions

- **Risk**: Mixing `?` and `?1` in D1 prepared statements
- **Mitigation**: Numbered placeholders only (`?1`, `?2`, …)

- **Risk**: Tests pass while D1 is still broken, because D1 is mocked
- **Mitigation**: Unit tests prove service/API contracts; confirm real D1 with `npm run preview` and a local migration during Phase 1/3 verification

- **Risk**: `@/` imports fail in Vitest
- **Mitigation**: `vite-tsconfig-paths` in `vitest.config.ts`

### User Experience Risks

- **Risk**: Teachers assume they are “logged in” after login, but `/mcqs` is not protected
- **Mitigation**: Stub copy can say identity is not persisted in a session yet

- **Risk**: Logout looks like it did nothing if they expect a server session
- **Mitigation**: Always navigate away from `/mcqs` after logout

---

## Troubleshooting Guide

Add entries here when bugs are found and fixed.

### D1 not available in `npm run dev`

**Problem**: `env.DB` is missing or queries fail under `next dev`.
**Cause**: Bindings are a Workers concern; Node dev does not match production runtime.
**Solution**: Run `npm run preview` and apply migrations with `--local`.
**Code Reference**: `wrangler.jsonc` D1 binding; `.cursor/rules/d1.mdc`

### Unique username/email insert fails as 500

**Problem**: Second register with the same username or email returns 500.
**Cause**: Unique constraint not mapped to 409.
**Solution**: Catch D1 constraint errors in register and return 409. The user service throws `UserConflictError` (`src/lib/services/user-service.ts`) for the API to map.
**Code Reference**: `src/lib/services/user-service.ts` (`UserConflictError`); `src/app/api/auth/register/route.ts` (once implemented)

### Remote D1 not created in Phase 1

**Problem**: `wrangler.jsonc` uses placeholder `database_id` `local-quizmaker-db`.
**Cause**: Creating a remote D1 database was blocked so Phase 1 stayed local-only.
**Solution**: When ready, run `npx wrangler d1 create quizmaker-db`, put the returned id in `wrangler.jsonc`, run `npm run cf-typegen`. Do not apply migrations with `--remote` unless the user asks.
**Code Reference**: `wrangler.jsonc`

---

## Notes for AI Agents

When working with this PRD:

1. Start by reading the Problem and Hypothesis to understand intent
2. Use Scope (In/Out/Cut) to determine boundaries — do not build MCQ features, social login, tokens, cookies, or sessions
3. Update phase status markers as work progresses
4. Add implementation details under "Technical Implementation Details" as code is written
5. Mark acceptance criteria as complete when features work
6. Add troubleshooting entries when bugs are found and fixed
7. Keep all sections current — remove outdated information
8. Use code references format: `filepath:line-number` when citing code
9. Ask before adding npm packages
10. Never apply D1 migrations remotely and never run `npm run deploy` unless the user asks
11. Verify UI in the browser (register, login, logout, error states), then run `npm run test`, `npm run lint`, and `npm run build` before claiming done
12. TDD: for each phase, write the tests listed in that phase first and show they fail; then implement until green. Do not skip the red step. Follow `.cursor/skills/testing/SKILL.md`

---

## Current Status

**Last Updated**: 2026-08-28
**Current Phase**: Phase 1 - Database and user service
**Status**: COMPLETED (awaiting review before Phase 2)
**Next Steps**: After review, start Phase 2 with failing register/login/logout route tests, then implement until green. Remote D1 (`wrangler d1 create quizmaker-db`) was not provisioned; local binding uses placeholder `database_id`. Replace it when a remote database is created.
