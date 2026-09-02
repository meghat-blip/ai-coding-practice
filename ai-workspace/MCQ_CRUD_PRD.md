Date created: 2026-09-02
Date last modified: 2026-09-02 (Phase 1: schema contract + local 0002)

# MCQ Create, Update, and Delete - Technical PRD

## Overview/Problem

QuizMaker already has teacher identity (register, login, logout) and a placeholder at `/mcqs`. Teachers still cannot store or manage multiple-choice questions. This capability turns the stub into a question bank: a table of questions, create and edit on a dedicated form page, row actions for edit / preview / delete, and persistence for questions, their choices, and recorded attempts.

---

## Hypothesis

We believe that a D1-backed MCQ list plus a shared create/edit page (shadcn table, buttons, and a row-actions menu) will let teachers author and maintain multiple-choice questions so later sprints can attach quizzes and collaboration to real question records.

---

## Scope

### In Scope

- Three D1 tables, local migration only: `mcqs`, `mcq_choices`, `mcq_attempts`
- `mcqs` columns: `id`, `name`, `question`, `created_by` (FK to `users.id`), `created_at`, `updated_at`
- An MCQ service layer (same pattern as the user service) for all D1 reads and writes
- HTTP routes for listing, creating, reading, updating, and deleting MCQs, and for recording an attempt
- Replace the `/mcqs` stub with a shadcn **Table** of all questions (name, question, actions)
- A **Create** button that navigates to a create/edit page (`Save` and `Cancel`)
- Row **Actions** via a three-dot (vertical ellipsis) menu: Edit, Preview, Delete
- Create/edit form: **name** and **question** (the stem); **two choice fields by default**, add up to **six**; mark exactly one choice as correct
- Preview: show the question stem as a student would see it and submit a choice (records an attempt, returns correct/incorrect)
- Persist `createdBy` on create from the public user id returned by register/login (client-held; there is still no server session)
- shadcn/ui: existing `Table`, `Button`, `Card`, `Field`, `Input`, `Dialog`; add Base UI components as needed (`dropdown-menu`, and likely `textarea` / `radio-group`) via `npx shadcn@latest add @shadcn/<name>` — these are copied source files, not new npm packages
- Test-driven implementation with **Vitest**: each phase starts with failing unit tests, then implementation until those tests pass

### Out of Scope

- Sessions, cookies, JWT, or route guards (identity sprint left `/mcqs` reachable by URL; that remains true)
- Filtering the list to only the current teacher’s questions (the bank stays global; we **store** `created_by`, we do not scope the GET list)
- Storing `user_id` on attempts (no session to identify the attempter)
- Quiz assembly, timed tests, scoring dashboards, or attempt-history UI
- Collaboration, sharing, comments, or TEKS alignment
- Images, rich text, or more than six choices
- Applying D1 migrations to the remote (production) database

### Cut

- Server Actions for these mutations — keep explicit HTTP routes under `src/app/api/` so this sprint matches register/login, not a mixed data-access style
- Zod — identity used `src/lib/auth-http.ts`-style validation; propose Zod before adding it
- `react-hook-form` — not installed; build the editor with local state and shadcn `Field`
- Per-teacher list filtering — without sessions every question is still listed; `created_by` is attribution only
- Changing `created_by` on update — author is set once at create
- Soft delete — delete is a real row delete with FK cascade
- Nested choice-only REST (`POST /api/mcqs/:id/choices`) — choices travel with the MCQ create/update payload

---

## Testing Approach (TDD)

Vitest is already installed (`npm run test`, `npm run test:watch`, `vitest.config.ts`). Follow `.cursor/skills/testing/SKILL.md`.

**Red → green for every phase:**

1. Write the tests listed for that phase **before** the production code they cover. `npm run test` must fail (red) for a real reason: missing module, failing assertion, or unimplemented behavior. Hollow tests (`expect(true).toBe(true)`) are not allowed.
2. Implement the minimum code for those tests to pass (green).
3. A phase is not done until that phase's tests are green **and** the phase acceptance criteria are met.
4. Later phases must keep earlier tests green (including identity tests).

**Conventions:**

- Colocate: `src/lib/services/mcq-service.ts` ↔ `src/lib/services/mcq-service.test.ts`
- Never hit a real network, real D1, or a real model in unit tests. Mock `getCloudflareContext` and supply a fake `env.DB` in service tests. Mock the MCQ service at the module boundary in route tests. Mock `fetch` and `next/navigation` in client-component tests.
- Assert observable output and side effects. Cover failure paths, not only the happy path.
- Each test must pass in isolation. `vi.clearAllMocks()` in `beforeEach`.
- Server Components: do not render them with Testing Library. Extract `'use client'` list/editor/preview/actions UI.
- Browser verification in the UI phase is **in addition to** Vitest, not a substitute for it.

---

## Technical Requirements

### Database Schema

D1 is already bound as `DB` in `wrangler.jsonc` (`database_name`: `quizmaker`). Add a **new local migration** (do not edit `0001_create_users_table.sql`). Do not apply with `--remote`. Do not create a second D1 database.

SQLite has no boolean type: store flags as `INTEGER` `0` / `1`.

```sql
CREATE TABLE mcqs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  question TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_mcqs_created_by ON mcqs (created_by);

CREATE TABLE mcq_choices (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mcq_id TEXT NOT NULL,
  body TEXT NOT NULL,
  position INTEGER NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mcq_id) REFERENCES mcqs(id) ON DELETE CASCADE
);

CREATE INDEX idx_mcq_choices_mcq_id ON mcq_choices (mcq_id);

CREATE TABLE mcq_attempts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mcq_id TEXT NOT NULL,
  choice_id TEXT NOT NULL,
  is_correct INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mcq_id) REFERENCES mcqs(id) ON DELETE CASCADE,
  FOREIGN KEY (choice_id) REFERENCES mcq_choices(id) ON DELETE CASCADE
);

CREATE INDEX idx_mcq_attempts_mcq_id ON mcq_attempts (mcq_id);
CREATE INDEX idx_mcq_attempts_choice_id ON mcq_attempts (choice_id);
```

Enable foreign keys on this connection if they are not already on (`PRAGMA foreign_keys = ON` as needed so deletes cascade in local D1).

Do **not** `ON DELETE CASCADE` from `users` to `mcqs`: deleting a teacher must not wipe the bank (`RESTRICT` / default).

| Table | Column | Type | Notes |
|-------|--------|------|--------|
| `mcqs` | `id` | TEXT PK | Random 16-byte hex, same pattern as `users` |
| `mcqs` | `name` | TEXT NOT NULL | Short title shown in the list table |
| `mcqs` | `question` | TEXT NOT NULL | The stem shown in the editor, list, and preview (not a separate “description”) |
| `mcqs` | `created_by` | TEXT NOT NULL FK | `users.id` of the teacher who created the row; immutable after insert |
| `mcqs` | `created_at` / `updated_at` | DATETIME | `updated_at` set on service update |
| `mcq_choices` | `mcq_id` | TEXT FK | Parent MCQ |
| `mcq_choices` | `body` | TEXT NOT NULL | Choice text shown to the teacher and in preview |
| `mcq_choices` | `position` | INTEGER NOT NULL | Display order, `0`..`5` |
| `mcq_choices` | `is_correct` | INTEGER NOT NULL | `1` if this is the keyed answer; exactly one `1` per question |
| `mcq_attempts` | `mcq_id` | TEXT FK | MCQ attempted |
| `mcq_attempts` | `choice_id` | TEXT FK | Choice the user selected |
| `mcq_attempts` | `is_correct` | INTEGER NOT NULL | Copied from the selected choice at attempt time (do not recompute later if the key changes) |

**Invariants (enforced in the service, not only in SQL):**

- A question has **2–6** choices
- Every choice `body` is non-empty after trim
- Exactly **one** choice has `is_correct = 1`
- `position` is unique per `mcq_id` and matches display order
- `name` and `question` are required (trimmed, non-empty; `name` max length e.g. 255)
- `created_by` is required on create and must refer to an existing `users.id`
- `updateMcq` must not change `created_by`

**Update strategy for choices:** payload may include existing choice `id`s. Update those rows; insert choices without `id`; delete choices belonging to the MCQ that are omitted. Deleting a choice cascades its attempts.

**`created_by` without sessions:** the server cannot infer the teacher from a cookie. Register and login already return `{ id, ... }`. The client stores that public user (e.g. `sessionStorage`) after a successful register/login, sends `createdBy` on `POST /api/mcqs`, and clears it on logout. This is attribution for a teaching app, not authorization. Reject create if `createdBy` is missing or not a known user (400).

### API Endpoints

Route handlers live under `src/app/api/`. They must call the MCQ service; they must not run SQL themselves. JSON field names are camelCase.

#### GET /api/mcqs

**Request Body:** none

**Response:**

- Success (200): `{ "items": [ { "id", "name", "question", "createdBy", "createdAt", "updatedAt" } ] }` (no nested choices)
- Error (500): unexpected server error

#### POST /api/mcqs

**Request Body:**

```json
{
  "name": "Photosynthesis",
  "question": "Which gas do plants absorb?",
  "createdBy": "user-id-from-register-or-login",
  "choices": [
    { "body": "Carbon dioxide", "isCorrect": true },
    { "body": "Oxygen", "isCorrect": false }
  ]
}
```

`choices` length 2–6. `position` is assigned by the service from array order. New choices have no `id`. `createdBy` is required.

**Response:**

- Success (201): full MCQ including `createdBy`, `question`, and `choices` (each with `id`, `body`, `position`, `isCorrect`)
- Error (400): validation (blank name or question, missing/unknown `createdBy`, fewer than 2 / more than 6 choices, blank choice body, not exactly one correct)
- Error (500): unexpected server error

#### GET /api/mcqs/:id

**Response:**

- Success (200): same full MCQ shape as create
- Error (404): unknown id
- Error (500): unexpected server error

#### PUT /api/mcqs/:id

**Request Body:** `name`, `question`, and `choices` (existing choices include `"id"` when updating in place). Do **not** accept a new `createdBy`; ignore it if sent.

**Response:**

- Success (200): full MCQ after update (`updatedAt` changed; `createdBy` unchanged)
- Error (400): same validation as create except `createdBy`
- Error (404): unknown id
- Error (500): unexpected server error

#### DELETE /api/mcqs/:id

**Request Body:** none

**Response:**

- Success (200): `{ "ok": true }`
- Error (404): unknown id
- Error (500): unexpected server error

Deleting an MCQ must delete its choices and attempts (FK cascade or explicit service deletes).

#### POST /api/mcqs/:id/attempts

**Request Body:**

```json
{
  "choiceId": "..."
}
```

**Response:**

- Success (201): `{ "id", "mcqId", "choiceId", "isCorrect" }` where `isCorrect` is whether that choice was keyed correct **at insert time**
- Error (400): missing `choiceId`, or `choiceId` does not belong to this MCQ
- Error (404): unknown MCQ id
- Error (500): unexpected server error

No GET for attempts in this sprint (no history UI).

### User Interface Requirements

Use shadcn/ui. Prefer `Table`, `Button`, `Card`, `Field`, `Dialog`. Add `@shadcn/dropdown-menu` for the three-dot menu (EllipsisVertical from Lucide). Add `@shadcn/textarea` and `@shadcn/radio-group` if the editor/preview need them. Do not hand-edit files under `src/components/ui/` except via the shadcn CLI. Forms and interactive table chrome are `'use client'`; they must not import D1 or the MCQ service.

Keep the existing **Logout** control on the list page. Logout must clear the stored public user id used for `createdBy`.

After successful register or login, persist the returned `id` (and optionally username) in `sessionStorage` so create can send `createdBy`. Prefer a tiny helper (e.g. `src/lib/client-user.ts`) over scattering storage keys. Identity forms already exist; extend them only as needed so this helper is written on 201/200.

#### Question bank (/mcqs)

- Replace stub copy with a heading (e.g. Question bank), **Create question** button, and a shadcn table
- Columns: **Name**, **Question** (truncate long text), **Actions**
- Empty state: table or a short message plus the same create button (no fake rows)
- Create button → `/mcqs/new`
- Load rows via `GET /api/mcqs` (client fetch is acceptable; do not put D1 in the page)
- Actions column: icon-only button (three vertical dots, `aria-label` such as `Actions for {name}`). Menu items:
  - **Edit** → `/mcqs/[id]/edit`
  - **Preview** → `/mcqs/[id]/preview`
  - **Delete** → confirm (existing `Dialog`), then `DELETE /api/mcqs/:id`, remove the row or refetch; show an error if delete fails

#### Create or edit (/mcqs/new and /mcqs/[id]/edit)

One client form component, two routes:

- `/mcqs/new` — empty name and question; **two** blank choices; no choice marked correct until the teacher picks one
- `/mcqs/[id]/edit` — `GET /api/mcqs/:id`, then the same form; 404/error if missing

Fields:

- Name (required) — short title
- Question (required) — the stem (`textarea` is appropriate)
- Choices: each row is choice text plus a control to mark **the** correct answer (radio across choices)
- **Add choice** until there are 6; **Remove** until there are 2
- **Save** — validate client-side (same rules as API), then `POST /api/mcqs` (include `createdBy` from stored user id) or `PUT /api/mcqs/:id` (no `createdBy`); on 201/200 navigate to `/mcqs`; show 400 errors on the form
- If create is attempted with no stored user id, do not POST; show a message to log in (link to `/login`)
- **Cancel** — navigate to `/mcqs` with no request

#### Preview (/mcqs/[id]/preview)

- Load `GET /api/mcqs/:id`
- Show **name** (optional heading), **question** stem, and choices as selectable options (do not reveal which is correct until after submit)
- Submit → `POST /api/mcqs/:id/attempts` with the selected `choiceId`
- After success, show whether the attempt was correct; disable resubmit or allow another attempt (either is fine; **allow another attempt** so teachers can try both paths)
- Control to return to `/mcqs` (link or button)

#### Validation rules (shared)

- Trim `name`, `question`, and choice `body`
- `name` required, max 255
- `question` required (the stem; not optional)
- 2–6 choices; each body non-empty
- Exactly one choice marked correct before save
- Create requires a stored `createdBy` user id
- Preview requires a selected choice before POST

---

## Implementation Phases

TDD is required in every phase: listed tests first (red), then implementation (green). `npm run test` is a phase gate along with the acceptance criteria.

### Phase 1: Database and MCQ service - IN PROGRESS

**Objective**: Local D1 has `mcqs`, `mcq_choices`, and `mcq_attempts`. The MCQ service can create, list, get, update, delete questions (with choices) and record attempts.

**Schema slice (done):** contract tests went red (no `0002` file), then `migrations/0002_create_mcq_tables.sql` was created and applied with `--local` only. Remaining work is `mcq-service` TDD (red then green).

**TDD — tests to write first (expect red):**

| File | Behavior to assert |
|------|-------------------|
| `src/lib/mcq-schema.contract.test.ts` | Migration `0002_*.sql` defines `mcqs` (`name`, `question`, `created_by`, timestamps; no `description`), `mcq_choices`, `mcq_attempts`, indexes, and FKs (cascade on choices/attempts; not on `users`) — **green** |
| `src/lib/services/mcq-service.test.ts` | `createMcq` inserts name, question, created_by, and 2+ bound choices; returns public MCQ with camelCase (`question`, `createdBy`, `isCorrect` booleans), no `description` / `is_correct` |
| Same | `createMcq` with missing or unknown `createdBy` fails validation (or not-found mapped to 400 at the API) |
| Same | `createMcq` with one choice or seven choices fails validation (service error the API can map to 400) |
| Same | `createMcq` with zero or two+ `isCorrect: true` fails validation |
| Same | blank name, blank question, or blank choice body fails validation |
| Same | `listMcqs` returns items with `name`, `question`, `createdBy` and without requiring choices in the list payload |
| Same | `getMcqById` returns the MCQ and its choices ordered by `position`, or `null` when missing |
| Same | `updateMcq` updates name/question/`updated_at` but not `created_by`; syncs choices (update/insert/delete as specified) |
| Same | `deleteMcq` removes the question; subsequent get returns `null` (choices/attempts gone) |
| Same | `recordAttempt` inserts with `isCorrect` taken from the selected choice; rejects a choice that is not on that MCQ |
| Same | `recordAttempt` on unknown MCQ fails not-found |

Mock `@opennextjs/cloudflare` and a fake D1 (`prepare` / `bind` / `all` / `run`). Do not talk to real D1 in these tests.

**Tasks**:

1. Write the Phase 1 tests above; confirm `npm run test` is red for those files
2. Create a Wrangler migration for the three tables; apply **locally only**
3. Implement `src/lib/services/mcq-service.ts` (prepared statements, `?1` placeholders, no `first()`) until tests are green
4. Confirm the existing `DB` binding; run `npm run cf-typegen` only if types are stale
5. No new `.dev.vars` expected

**Phase 1 gate:** Phase 1 tests green; migration applied locally; service implemented.

**Deliverables**:

- `migrations/` SQL for `mcqs`, `mcq_choices`, `mcq_attempts`
- MCQ service with list/create/get/update/delete and `recordAttempt`, plus colocated tests

### Phase 2: HTTP endpoints - PLANNED

**Objective**: REST handlers sit in front of the MCQ service.

**TDD — tests to write first (expect red):**

| File | Behavior to assert |
|------|-------------------|
| `src/app/api/mcqs/route.test.ts` | GET → 200 `{ items }` from `listMcqs` |
| Same | POST valid body (including `createdBy` and `question`) → 201 full MCQ; service called with trimmed fields and choices |
| Same | POST missing `createdBy` or `question` → 400; service create not called (or only validation error mapped) |
| Same | POST invalid choices → 400 |
| `src/app/api/mcqs/[id]/route.test.ts` | GET known id → 200; unknown → 404 |
| Same | PUT valid (`name`/`question`/`choices`) → 200 and service not given a new author; invalid → 400; unknown → 404 |
| Same | DELETE known → 200 `{ ok: true }`; unknown → 404 |
| `src/app/api/mcqs/[id]/attempts/route.test.ts` | POST valid `choiceId` → 201 with `isCorrect` from the service |
| Same | POST missing body / bad choice → 400 |
| Same | POST unknown MCQ → 404 |

Mock the MCQ service at the module boundary. Do not import a real D1.

**Tasks**:

1. Write the Phase 2 tests; confirm red
2. Implement `src/app/api/mcqs/route.ts` (GET, POST) and `src/app/api/mcqs/[id]/route.ts` (GET, PUT, DELETE)
3. Implement `src/app/api/mcqs/[id]/attempts/route.ts` (POST)
4. Map service validation → 400, not-found → 404
5. Confirm Phase 1 + Phase 2 tests green (identity tests still green)

**Phase 2 gate:** `npm run test` green for identity + Phase 1 + Phase 2 files.

**Deliverables**:

- Route handlers and colocated tests under `src/app/api/mcqs/`

### Phase 3: List, editor, preview UI - PLANNED

**Objective**: Teachers can list, create, edit, preview (with an attempt), and delete MCQs using shadcn.

Extract client components so Vitest can render them. Do not render Server Component page files with Testing Library.

Install missing shadcn pieces with the `@shadcn/` namespace before building UI that needs them, for example:

```bash
npx shadcn@latest add @shadcn/dropdown-menu
npx shadcn@latest add @shadcn/textarea
npx shadcn@latest add @shadcn/radio-group
```

If a component produces no files, it does not exist for this Base UI style; pick an equivalent and note it in this PRD.

**TDD — tests to write first (expect red):**

| File | Behavior to assert |
|------|-------------------|
| `src/components/mcqs/mcq-list.test.tsx` | Renders a table with Name, Question, Actions; Create control navigates to `/mcqs/new` |
| Same | After successful `GET /api/mcqs`, rows show `name` and `question` |
| Same | Empty `items` shows an empty state (no crash) |
| `src/components/mcqs/mcq-row-actions.test.tsx` | Actions button has an accessible name; menu includes Edit, Preview, Delete |
| Same | Edit navigates to `/mcqs/{id}/edit`; Preview to `/mcqs/{id}/preview` |
| Same | Delete confirms then `DELETE /api/mcqs/{id}` and notifies parent / refetches |
| `src/components/mcqs/mcq-editor-form.test.tsx` | Create mode: name, question, **two** choice inputs, Save and Cancel |
| Same | Add choice increases fields up to 6; cannot add a 7th; cannot go below 2 |
| Same | Save with blank name, blank question, or no correct choice does not `fetch` |
| Same | Valid create POSTs `/api/mcqs` with `question` and `createdBy` (not `description`) and on 201 navigates to `/mcqs` |
| Same | Create with no stored user id does not `fetch` |
| Same | Cancel navigates to `/mcqs` without `fetch` |
| Same | Edit mode PUTs `/api/mcqs/{id}` on save without sending a new `createdBy` |
| `src/components/mcqs/mcq-preview.test.tsx` | Renders the **question** stem and choices without exposing the key before submit |
| Same | Submit POSTs `/api/mcqs/{id}/attempts` with `choiceId`; shows correct/incorrect from the response |

Mock `fetch` and `next/navigation`. Use Testing Library + `userEvent`; query by role and accessible name. Stub `sessionStorage` (or the client-user helper) in editor tests.

**Tasks**:

1. Add required shadcn components
2. Persist public user id after register/login; clear on logout
3. Write the Phase 3 tests; confirm red
4. Implement list, row actions, editor form, preview until green
5. Wire `/mcqs`, `/mcqs/new`, `/mcqs/[id]/edit`, `/mcqs/[id]/preview`; keep logout on the list
6. Browser verification: create, list, edit, preview correct and incorrect, delete, cancel, validation
7. `npm run test`, `npm run lint`, and `npm run build` succeed

**Phase 3 gate:** Full Vitest suite green; browser pass; lint and build pass.

**Deliverables**:

- Pages and client components under `src/app/mcqs/` and `src/components/mcqs/`
- Client user-id helper used by auth forms, logout, and create
- Colocated `*.test.tsx`

---

## Technical Implementation Details

### Key Files

*(Update paths as files land.)*

- `migrations/0002_create_mcq_tables.sql` — `mcqs`, `mcq_choices`, `mcq_attempts` (applied locally)
- `src/lib/mcq-schema.contract.test.ts` — asserts 0002 SQL matches the schema contract
- `src/lib/services/mcq-service.ts` / `mcq-service.test.ts` — D1 access for questions, choices, attempts
- `src/lib/client-user.ts` — sessionStorage (or equivalent) for public user `id` after login/register
- `src/app/api/mcqs/route.ts` — GET list, POST create
- `src/app/api/mcqs/[id]/route.ts` — GET / PUT / DELETE
- `src/app/api/mcqs/[id]/attempts/route.ts` — POST attempt
- `src/components/mcqs/` — list, row actions, editor, preview (client) and tests
- `src/app/mcqs/page.tsx` — question bank (table + create + logout)
- `src/app/mcqs/new/page.tsx` — create shell
- `src/app/mcqs/[id]/edit/page.tsx` — edit shell
- `src/app/mcqs/[id]/preview/page.tsx` — preview shell

### Implementation Patterns

```typescript
// src/lib/services/mcq-service.ts
// Reach D1 via getCloudflareContext() from @opennextjs/cloudflare, then env.DB.
// Always bind with ?1, ?2, ... Never concatenate SQL.
// Prefer results[0] over first().

export type McqChoice = {
  id: string;
  body: string;
  position: number;
  isCorrect: boolean;
};

export type Mcq = {
  id: string;
  name: string;
  question: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  choices: McqChoice[];
};

export type McqListItem = Omit<Mcq, "choices">;

export async function listMcqs(): Promise<McqListItem[]> { /* select from mcqs */ }
export async function getMcqById(id: string): Promise<Mcq | null> { /* join or two queries, order by position */ }
export async function createMcq(input: {
  name: string;
  question: string;
  createdBy: string;
  choices: { body: string; isCorrect: boolean }[];
}): Promise<Mcq> { /* */ }
export async function updateMcq(
  id: string,
  input: { name: string; question: string; choices: { id?: string; body: string; isCorrect: boolean }[] },
): Promise<Mcq> { /* do not update created_by */ }
export async function deleteMcq(id: string): Promise<void> { /* */ }
export async function recordAttempt(
  mcqId: string,
  choiceId: string,
): Promise<{ id: string; mcqId: string; choiceId: string; isCorrect: boolean }> { /* */ }
```

Typed errors such as `McqValidationError` and `McqNotFoundError` keep route mapping clear (same idea as `UserConflictError`).

### Important Notes

- AGENTS.md: ask before adding an **npm** dependency. shadcn `add @shadcn/...` is the approved way to get dropdown/textarea/radio.
- Do not import the MCQ service or `getCloudflareContext` into `'use client'` files.
- There is no `description` column. The stem is `question`. `name` is the short title in the table.
- `createdBy` on POST is client-supplied. Treat that as a teaching constraint, not as authentication.
- `npm run dev` does not prove D1/Workers behavior. Use `npm run preview` for anything runtime-sensitive.
- Without sessions, anyone who knows `/mcqs` can use the bank. Accepted for this sprint.
- Do not deploy. Do not migrate remote D1.
- A phase that implements first and tests after is incomplete. Tests go red first.
- Keep identity routes and tests unchanged unless a bug blocks this work (register/login/logout may call the client-user helper).

---

## Acceptance Criteria

- [x] Local D1 has `mcqs` with `id`, `name`, `question`, `created_by`, `created_at`, `updated_at`, plus `mcq_choices` and `mcq_attempts` (local apply only)
- [ ] Teachers see a table of questions on `/mcqs` (name, question, actions) instead of stub-only copy
- [ ] Create navigates to a form with two choices by default and can add up to six
- [ ] Save on create persists name, question, created_by, and choices and returns to `/mcqs` with the new row visible
- [ ] Edit loads the MCQ, Save updates name/question/choices but not created_by, Cancel does not write
- [ ] Actions menu offers Edit, Preview, and Delete
- [ ] Delete removes the question (and cascaded choices/attempts) after confirmation
- [ ] Preview submits an attempt and shows whether the selected choice was correct
- [ ] API and service reject fewer than 2 or more than 6 choices, blank name, blank question, missing/unknown createdBy, and not exactly one correct choice
- [ ] Phase 1 Vitest tests pass; D1 is mocked
- [ ] Phase 2 Vitest tests pass; MCQ service is mocked
- [ ] Phase 3 Vitest tests pass; `fetch` and router are mocked
- [ ] Identity tests remain green
- [ ] Unit tests do not call real D1, network, or model providers
- [ ] `npm run test`, `npm run lint`, and `npm run build` succeed after Phase 3

---

## Success Metrics

There is no production traffic yet. Success is that the teaching flow works locally.

| Metric | Target | How Measured |
|--------|--------|--------------|
| Create happy path | Row appears; D1 has `question` and `created_by` | Manual browser pass + local D1 query |
| Edit happy path | Name/question/choices change after save; author unchanged | Manual browser pass |
| Delete | Row gone; D1 has no orphan choices | UI + local D1 query |
| Preview attempt | Correct and incorrect feedback both work | Manual browser pass |
| Validation | Invalid editor does not create a row | UI + API 400 tests |
| Build health | Lint, unit tests, and build pass | `npm run lint`, `npm run test`, `npm run build` |

---

## Dependencies

### External Dependencies

- Cloudflare D1 — MCQ storage (existing local DB; do not touch remote)
- Wrangler — migrations list/apply `--local`

### Internal Dependencies

- `@opennextjs/cloudflare` `getCloudflareContext()` — D1 from server code
- `src/lib/services/user-service.ts` — `created_by` must match an existing `users.id`
- shadcn/ui in `src/components/ui/` (`table`, `button`, `dialog`, `field`, …) plus CLI-added dropdown / textarea / radio-group as needed
- **Vitest** (dev) — already installed from the identity sprint

### Environment

- D1 binding `DB` in `wrangler.jsonc`
- No new secrets for this capability

---

## Risks and Mitigation

### Technical Risks

- **Risk**: `npm run dev` (Node) hides D1/Workers issues
- **Mitigation**: Verify CRUD against D1 with `npm run preview` after local migrate

- **Risk**: Foreign keys ignored if SQLite `foreign_keys` is off
- **Mitigation**: Confirm cascade in preview; if needed, delete children explicitly in the service before the parent

- **Risk**: Mixing `?` and `?1` in D1 prepared statements
- **Mitigation**: Numbered placeholders only (`?1`, `?2`, …)

- **Risk**: Tests pass while D1 is still broken, because D1 is mocked
- **Mitigation**: Unit tests prove contracts; confirm real D1 in Phase 3 browser/`preview` verification

- **Risk**: Editing choices deletes historical attempts via cascade
- **Mitigation**: Accepted; document it; no attempt-history UI this sprint

- **Risk**: `createdBy` is spoofable because there is no session
- **Mitigation**: Accepted for this teaching sprint; document it; later sprints can set `created_by` from a real session

### User Experience Risks

- **Risk**: Teachers expect the bank to be private to their account
- **Mitigation**: Copy can say questions are listed for everyone on this instance; `created_by` records who wrote them

- **Risk**: Create fails after a hard refresh if sessionStorage was never set (user opened `/mcqs` directly)
- **Mitigation**: Editor shows login prompt when there is no stored user id

- **Risk**: Accidental delete
- **Mitigation**: Confirm dialog before `DELETE`

- **Risk**: Preview reveals the answer in the DOM before submit
- **Mitigation**: Do not render “correct” badges until the attempt response; tests should not find the key in the initial preview UI

---

## Troubleshooting Guide

Add entries here when bugs are found and fixed.

### D1 not available in `npm run dev`

**Problem**: `env.DB` is missing or queries fail under `next dev`.
**Cause**: Bindings are a Workers concern; Node dev does not match production runtime.
**Solution**: Run `npm run preview` and apply migrations with `--local`.
**Code Reference**: `wrangler.jsonc` D1 binding; `.cursor/rules/d1.mdc`

---

## Notes for AI Agents

When working with this PRD:

1. Start by reading the Problem and Hypothesis to understand intent
2. Use Scope (In/Out/Cut) to determine boundaries — do not add sessions, per-user list filtering, Zod, or Server Actions unless the user asks
3. Do not use a `description` column; the stem is `question`. Always persist `created_by` on create
4. Update phase status markers as work progresses
5. Add implementation details under "Technical Implementation Details" as code is written
6. Mark acceptance criteria as complete when features work
7. Add troubleshooting entries when bugs are found and fixed
8. Keep all sections current — remove outdated information
9. Use code references format: `filepath:line-number` when citing code
10. Ask before adding npm packages; shadcn CLI with `@shadcn/` is expected
11. Never apply D1 migrations remotely and never run `npm run deploy` unless the user asks
12. Verify UI in the browser (list, create, edit, preview, delete, validation, empty state), then run `npm run test`, `npm run lint`, and `npm run build` before claiming done
13. TDD: for each phase, write the tests listed in that phase first and show they fail; then implement until green. Do not skip the red step. Follow `.cursor/skills/testing/SKILL.md`
14. Keep `ai-workspace/register-login-logout_prd.md` behavior intact (aside from persisting/clearing the public user id for `createdBy`)
15. After this capability ships, update `AGENTS.md` so it no longer says Sprint 1 is identity-only / `/mcqs` stub

---

## Current Status

**Last Updated**: 2026-09-02
**Current Phase**: Phase 1 - Database and MCQ service
**Status**: IN PROGRESS (schema contract + local 0002 done; MCQ service not started)
**Next Steps**: Write failing `mcq-service` tests (red), then implement the service until green. Do not apply 0002 remotely. Do not deploy.
