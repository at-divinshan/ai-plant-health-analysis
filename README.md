# AI Plant Health Analysis

React (Vite) frontend + FastAPI backend using Google Gemini.

## Backend
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env   (then put your real GEMINI_API_KEY in .env)
uvicorn main:app --reload --port 8000

## Frontend
cd frontend
npm install
npm run dev
Open http://localhost:5173

## GitHub Pages deployment

The frontend is deployed from `frontend/dist` by the GitHub Actions workflow
when changes are pushed to `main`. In the repository, select **Settings →
Pages → Build and deployment → Source: GitHub Actions**. The Vite build uses
the `/ai-plant-health-analysis/` base path for the project site.

GitHub Pages hosts only the static frontend; it does not host the Python API,
Gemini service, or MySQL database. Analysis, saved database records, people,
and sharing features require the backend and database to be hosted separately.
After deploying the backend, set the repository Actions variable `VITE_API_URL`
to its public API base URL (for example, `https://api.example.com`) and
configure the backend's CORS policy to allow
`https://at-divinshan.github.io`. Keep backend credentials and database secrets
on the backend; Vite variables are included in the public frontend build.

## MySQL storage and people

The backend reads `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`
from `backend/.env`. Keep these values on the backend. Install the updated
backend requirements before starting the server:

```sh
cd backend
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Use the virtual environment path for your platform (`venv` is also supported if
that is the environment you normally use). The frontend uses its existing
`VITE_API_URL` setting, defaulting to `http://localhost:8000`.

Models map the existing `plants`, `plant_analyses`, `people`, and
`analysis_shares` tables in `plant_health_db`. There is no `create_all`, table
recreation, seed routine, or automatic database migration. Gemini settings and
`POST /analyze` are unchanged.

### Database APIs

- `GET /analyses`, `GET /analyses/{id}`, `POST /analyses`, `DELETE /analyses/{id}`
- `GET /people?q=...`, `POST /people`, `PUT /people/{id}`, `DELETE /people/{id}`
- `GET /analyses/{id}/shares`, `PUT /analyses/{id}/shares`

Saving accepts the existing `{id, analyzedAt, plant, result}` browser record.
The stable client ID makes retries idempotent; returned `id` is the database ID
and `clientId` preserves the source reference. Analysis dates are stored and
returned in UTC and displayed in the browser's local timezone. Sharing accepts
`{person_ids: [...]}` and atomically replaces the selected people. Duplicate
people in the request are removed. It records associations only: it sends no
email/message and grants no private access link. No login was added; these
pages use the application's shared database.

Deleting an analysis removes its sharing associations but retains the plant
record, because plants may be reused by other analyses. Deleting a person removes
that person's assignments without deleting analyses. UI deletions require
confirmation.

### Existing browser saves

On load, browser records in `plant-health-ai.saved-analyses.v1` are imported
through the API. The original key is never erased or overwritten. A separate
receipt key tracks successful imports, preventing intentionally deleted imports
from reappearing. Failed imports retain their backup and display a retry message.
Saved Analyses displays only records returned by MySQL; localStorage is used only
for legacy migration/receipts, not for current saving or page data. Records in a
different browser or origin are imported when that browser/origin opens the app.

The existing temperature and humidity columns are `VARCHAR(100)`. To preserve
full AI text without altering the schema, new `care_suggestions` JSON values use
`{items: [...], metadata: {client_id, analyzed_at, full_result}}`. Short values
also populate the dedicated columns; longer values are retained in `full_result`
and returned intact by the API. Existing JSON arrays remain readable. Original
millisecond timestamps and older analyses without the four recommendations are
also retained. Do not strip this metadata when updating records outside the app.

### Tests

```sh
# From backend; integration writes use savepoints inside rollback-only transactions.
RUN_MYSQL_TESTS=1 .venv/bin/python -m unittest discover -s tests -v
# Without the flag, database integration tests are skipped.

# From frontend
node tests/savedAnalyses.test.js
npm run build
```

Integration tests use the configured MySQL database without DDL and verify row
counts after rollback. Fixtures are confined to tests; the application has no
mock-data or sample-data fallback. Tests do not call live Gemini or deliver shares.

### Person-based plant management

Choose an optional person in the plant analysis form, analyze, then save. The selected ID is sent only to `POST /analyses`, not Gemini. People → View Plants loads `GET /people/{person_id}/plants`, including each plant's symptoms, saved date, and complete analysis history. Sharing assignments remain separate from ownership.

The explicit migration `backend/migrations/add_plant_person.py` adds a nullable, indexed `plants.person_id` foreign key to `people.id` with `ON DELETE SET NULL`. Run `.venv/bin/python migrations/add_plant_person.py` from `backend` when setting up another existing database, before starting the updated backend. It does not recreate tables or assign old records. Re-running verifies the existing link. Deleting a person preserves plants and analyses as unassigned; deleting an analysis preserves its plant.

Regression checks: from `backend`, run `RUN_MYSQL_TESTS=1 .venv/bin/python -m unittest discover -s tests -v`. Database fixtures use rollback-only transactions. From `frontend`, run `npm run build` and `node --test tests/savedAnalyses.test.js`.
