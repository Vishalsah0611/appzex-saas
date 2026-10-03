# AppZex PM - Multi-Tenant Agency Project Management SaaS

A multi-tenant project management platform where many agencies manage their teams, clients and projects with strict data isolation. It has a Super Admin portal, an agency workspace and a client portal.

- **Live app:** https://appzex-saas-sage.vercel.app
- **API:** https://appzex-saas.onrender.com
- **Note:** the API runs on Render's free plan, so it sleeps when idle. The first request after a pause can take about 50 seconds. Open `/api/test` once to wake it up.

## Demo accounts

Password for every demo user: `Demo@1234`

| Role | Email |
|------|-------|
| Super Admin | super@appzex.test |
| Pixel Forge Agency - Admin | admin@pixel.test |
| Pixel Forge Agency - Team member | team@pixel.test |
| Pixel Forge Agency - Client (Acme Corp) | client.acme@pixel.test |
| Pixel Forge Agency - Client (Globex Ltd) | client.globex@pixel.test |
| Nova Digital - Admin | admin@nova.test |
| Nova Digital - Team member | team@nova.test |

Two agencies (Pixel Forge and Nova Digital) are seeded so that isolation can be tested.

## Tech stack

- Frontend: Next.js (deployed on Vercel)
- Backend: Node.js + Express (deployed on Render)
- Database: MySQL (Aiven)
- Auth: JWT, passwords hashed with bcrypt

## Local setup

```bash
git clone <repo-url>
cd backend
npm install
```

Create `backend/.env` (never commit it):

```
DATABASE_URL=mysql://user:password@host:port/dbname
DB_SSL=true            # set to true for hosted MySQL such as Aiven
JWT_SECRET=<long random string>
FRONTEND_ORIGIN=http://localhost:3000
GEMINI_API_KEY=<optional, enables the AI feature>
```

Create the tables, seed demo data and start the API:

```bash
node src/migrate.js    # runs schema.sql
npm run seed           # 2 agencies, users, clients, projects, tasks
npm start              # API on PORT (default 4000)
```

Frontend:

```bash
cd frontend
npm install
# create frontend/.env.local with NEXT_PUBLIC_API_URL=http://localhost:4000
npm run dev
```

### Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `DATABASE_URL` | backend | MySQL connection string |
| `DB_SSL` | backend | `true` to use SSL for the database |
| `JWT_SECRET` | backend | Secret for signing tokens |
| `FRONTEND_ORIGIN` | backend | Allowed CORS origin (the frontend URL) |
| `GEMINI_API_KEY` | backend | Optional. Enables AI Project Health |
| `GEMINI_MODEL` | backend | Optional. Set to `gemini-3.8-flash` on the live deployment |
| `NEXT_PUBLIC_API_URL` | frontend | Base URL of the API |

## Architecture and key decisions

**Tenant isolation (most important).**
- Every operational table (clients, projects, tasks, feedback, files, activity logs) carries an `agency_id`.
- The `agency_id` always comes from the authenticated session, which is re-read from the database on every request. It is never taken from the URL or request body.
- Every query is filtered by that `agency_id`. Project lookups go through one shared function (`getProject`), so another agency's project returns 404 and does not reveal that it exists.
- When a project is created, the client and manager must belong to the same agency.
- Client users are additionally restricted to their own `client_id`, so a client cannot read another client's project even inside the same agency.

**Roles.** `super_admin`, `agency_admin`, `agency_member`, `client`. Each route declares which roles may use it. Super Admin routes (`/api/admin/*`) are separate and return 403 for any other role. Role checks are done on the backend, not only by hiding pages in the frontend.

**Suspended agencies.** User and agency status are checked on login and on each request, so suspending an agency blocks its users immediately with a clear message.

**Support mode.** The Super Admin can open an agency in support mode using a separate 30-minute token. Each session is written to the activity log. Support mode is intended to be read-only so that support staff cannot accidentally change tenant data.

**Progress.** Project progress is derived from real work: `done tasks / total tasks`, computed in SQL. It is never typed in by hand.

**Files.** Uploaded files are stored in a private folder (not served statically) under random names. Downloads go through an authenticated endpoint that checks agency, client and the "shared with client" flag. Clients can only download files the agency has shared with them.

**Activity log.** Events such as `project.created`, `task.completed`, `feedback.submitted` and `agency.status_changed` are stored with agency, actor, entity and a client-visibility flag. The client portal shows only client-visible events. This table can later power notifications.

## AI feature: Project Health

- **Problem:** quickly understand how a project is going and what might go wrong.
- **Input:** only the selected project's data (name, status, due date, tasks with status/priority/due date, feedback titles and statuses). The project is looked up with the same agency-scoped check, so data from another agency cannot be sent.
- **Output:** a short status summary, a risk level (Low/Medium/High), up to 4 concrete risks and up to 3 suggested next actions.
- **Model/API:** Google Gemini API (`gemini-3.8-flash` on the live deployment, set via the `GEMINI_MODEL` environment variable because Google retires model names over time). If `GEMINI_API_KEY` is not set, the code can fall back to the Anthropic API when `ANTHROPIC_API_KEY` is set.
- **Failure handling:** a missing key returns "AI is not configured on this server." Timeouts (20 s) and API errors return a friendly message instead of crashing.
- The API key lives only in environment variables and is never committed.

## Testing tenant isolation

Log in as different users and try to access data you should not see:

1. Pixel Forge admin requests a Nova Digital project, task or client by ID: 404, no data.
2. Pixel Forge client (Acme) requests a Globex project by ID: 404.
3. A client calls an agency route (for example `/api/projects`): 403.
4. A file belonging to another agency or client: 404.
5. Super Admin suspends an agency, then one of its users tries to log in: blocked with a clear message.
6. An agency admin calls a Super Admin route such as `/api/admin/agencies`: 403.

## Known limitations and next steps

Not built because of the time limit:

- Meetings (recording meetings and sharing notes with clients)
- Task comments and comment threads on feedback
- Team management page (inviting members and changing roles). Roles exist in the backend and seed data, but there is no UI
- Rate limiting and automated tests
- Milestones as a separate entity (tasks currently drive progress)

With more time I would add these, plus email-style notifications built on the activity log, client approvals on milestones, per-agency custom stages and an automated isolation test suite.