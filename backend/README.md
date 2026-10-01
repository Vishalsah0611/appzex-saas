# AppZex Multi-Tenant Agency PM SaaS: Backend

Node.js + Express + MySQL. Frontend (Next.js) lives in `../frontend` and consumes this REST API.

## Setup
    cp .env.example .env      # fill DATABASE_URL, JWT_SECRET (+ optional ANTHROPIC_API_KEY)
    mysql -u user -p appzex < schema.sql
    npm install && npm run seed && npm start

## Demo accounts (password `Demo@1234`)
| Role | Email |
|---|---|
| Super Admin | super@appzex.test |
| Agency Admin (A / B) | admin@pixel.test / admin@nova.test |
| Team (A / B) | team@pixel.test / team@nova.test |
| Client (A / B) | client.acme@pixel.test / client.acme@nova.test |

## Multi-tenancy & security decisions
- Every operational table carries `agency_id`; **every query filters by `agency_id` taken from the verified session, never from request input**.
- Project access goes through one function (`getProject`): wrong agency or wrong client returns **404** (no existence leak). Clients are additionally pinned to their own `client_id`.
- `auth` middleware re-reads user + agency status from DB on every request, so **suspension is instant** (clear message on login and API).
- Roles are enforced with `allow(...)` on the server; Super Admin routes are unreachable by any other role.
- **Support mode**: Super Admin gets a 30-minute token scoped to one agency, **read-only** (safer default), and the session start is written to `activity_logs`.
- Passwords: bcrypt. Files: stored outside any static dir under random names; downloads go through a permission check (agency match; clients only if `shared_with_client=1` and own project).
- Cross-tenant references are validated on write (client/manager/assignee must belong to the same agency).
- **Progress** = done tasks / total tasks (derived in SQL, never stored).

## AI: Project Health
`POST /api/projects/:id/ai/health`. **Problem:** managers need a quick risk read on a project. **Input:** only that project's tasks, feedback and dates (tenant-scoped). **Output:** summary, risk level, risks, next actions. **Model:** Claude via Anthropic Messages API (`AI_MODEL`, default `claude-sonnet-5-5`). Missing key returns 503, timeout/errors return a friendly 502.

## Known limitations / next
Frontend not included yet; no task comments, meetings CRUD, feedback comment threads, invite emails or rate limiting; add automated isolation tests (Section 13 scenarios).
