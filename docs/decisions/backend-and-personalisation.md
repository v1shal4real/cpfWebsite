# Backend and personalisation (KAN-71)

Proposed 2026-11-24. Not yet decided. Spec §3.5, §4.4.

## Context

v1 has no backend. Every input lives in the URL, and the README promises "no
account, storage, cookie or server call". The plan for after v1 is to add
Supabase, and Node.js where needed, so the site can be personalised.

KAN-71 sets two conditions before any of this is built: a personal data and
privacy review is completed first, and accounts stay optional.

The inputs are sensitive. Salary, CPF balances, age and housing plans are
personal data under Singapore's Personal Data Protection Act (PDPA).

## Decision

### 1. Personalisation means saved scenarios, nothing more, at first

The first release stores a signed-in user's scenarios, so they can come back
to them and compare them over time. Three other meanings are out of scope:

| Option                                | Status   | Why                                                                                                                                                                                |
| ------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saved scenarios                       | In scope | Low risk, and it reuses the versioned link format.                                                                                                                                 |
| Real CPF balances, filled in for them | Deferred | CPF Board has no public API for member balances. Singpass Myinfo is the only official route, and it needs approval as an organisation. Confirm eligibility before any design work. |
| Recommendations                       | Excluded | The site states projections, never advice (see `src/framing.test.tsx`). Personalised advice can fall under MAS financial advisory rules.                                           |
| Usage analytics tied to a person      | Excluded | Not needed for saved scenarios.                                                                                                                                                    |

### 2. The projection engine stays in the browser

The engine is pure, deterministic and fast. It is checked by fixtures and
property tests. The backend stores and returns inputs only, and never runs a
projection.

- The site works in full without signing in, as it does today.
- There is one engine to maintain and test, not a client copy and a server copy.
- No projected figure is stored. A saved scenario is re-projected when it is
  opened, under the rule set it is pinned to.

### 3. A saved scenario is its link

A scenario is stored as the query string the page already writes, schema
version 1 (`v=1&r=sg-cpf-2027-01&m=2026-11&a=30&s=5000…`). `urlState.ts`
encodes it and decodes it. The schema version and the pinned rule set are in
the string, so a saved scenario keeps its meaning when rules or the schema
change.

A first sketch of the table:

| Column       | Type        | Notes                                                    |
| ------------ | ----------- | -------------------------------------------------------- |
| `id`         | uuid        | Primary key                                              |
| `user_id`    | uuid        | References `auth.users`; row-level security keys on this |
| `name`       | text        | The user's own label, optional                           |
| `state`      | text        | The link's query string                                  |
| `created_at` | timestamptz |                                                          |
| `updated_at` | timestamptz |                                                          |

No column holds a single input. Salary and balances are inside `state` only.

### 4. Supabase alone first; Node.js when a feature needs it

The browser calls Supabase directly: Supabase Auth for sign-in, and Postgres
with row-level security so each user reads and writes only their own rows.
This needs no server of our own.

A Node.js service (or Supabase Edge Functions) is added only for work that
must hold a secret or run on a schedule:

- Singpass Myinfo, if it is ever approved
- email beyond Supabase's own sign-in emails
- publishing a new rule set, or the open rules dataset (KAN-73)

Each service added is one more thing to host, secure, monitor and pay for.

### 5. Privacy rules

- Accounts are optional, and the no-sign-in path stays the default.
- Store the least data that works: an email for sign-in and the saved
  scenarios. No name, NRIC, phone number or CPF account number.
- Host the database in Supabase's Singapore region.
- Users can export and delete their data, and delete their account, from the
  site.
- Row-level security is on for every table, with a test that one user cannot
  read another's rows.
- Use the anon key in the browser only. The service role key stays server-side
  or in the dashboard.
- Before launch, update the README, the site's own wording, and add a privacy
  notice.

## Order of work

1. Finish v1: KAN-75, KAN-54, KAN-53 (hosting), then the launch (KAN-55).
   Choose a host that suits Supabase later, such as Vercel, Netlify or
   Cloudflare Pages.
2. The privacy review that KAN-71 requires, written up here or alongside.
3. Supabase project in the Singapore region, the `scenarios` table and
   row-level security, with tests.
4. Sign-in, and save, list, open, rename and delete scenarios, behind an
   optional entry point.
5. Data export and account deletion.
6. Only then, any Node.js service a later feature calls for.

## Alternatives considered

- **Projection on the server.** Rejected. It adds latency and a second engine,
  and makes the site depend on a server for something it does today without
  one.
- **Node.js API in front of Supabase from the start.** Rejected for now.
  Row-level security covers per-user access to saved scenarios. A server can
  be added later without changing the table.
- **Inputs as separate columns.** Rejected. It spreads sensitive data across
  the schema and must be migrated with every new input. The link format is
  versioned already.
- **Saving in the browser only (localStorage).** Kept as a possible step
  before accounts. It needs no backend and no personal data, but it does not
  work across devices.

## Open questions

- Whether Myinfo is open to this project at all, and on what terms.
- Sign-in method: email magic link, or also Google or Apple.
- How long data is kept for accounts left inactive.
- Whether a saved scenario under a withdrawn rule set should open as saved, or
  offer to move to the current rules.
