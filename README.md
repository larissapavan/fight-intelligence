# UFC Fight Predictor

Full stack UFC matchup analysis app. Compares two fighters, shows side-by-side stats, and returns a machine learning prediction with confidence and a SHAP-based explanation.

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Axios, React Router, Framer Motion, Recharts
- **Backend**: FastAPI, Uvicorn, Pydantic, SlowAPI (rate limiting)
- **ML**: scikit-learn, Pandas, NumPy, Joblib, SHAP
- **Data pipeline**: Requests + BeautifulSoup4 — scrapers for ufcstats.com and ufc.com, including a proof-of-work bot-challenge solver

## Features

- Matchup prediction with confidence score and SHAP explanation of the leading factors
- Fighter database (4,500+ fighters) with official UFC photos, Active/Retired tabs, and per-fighter profiles (method breakdown, weight class history, last results)
- Head-to-head lookup between any two fighters
- Event archive (numbered events + Fight Night, searchable, filterable by year/month) plus upcoming confirmed events
- Official UFC rankings (divisional + pound-for-pound), cross-referenced with real win-rate/last-fight data
- Fighter Compare with finishing tendencies (avg. time to win, win distribution by round)

All fighter/event/ranking data is scraped from ufcstats.com and ufc.com and kept current by the scripts in `scripts/` — see "Keeping data fresh" below. The backend reloads it automatically when the CSVs change, no restart needed.

## Project Structure

```text
.
├── backend/app/          # FastAPI: routers, schemas, services
├── backend/model/        # Trained model artifact
├── frontend/src/         # React + Vite app
├── tests/                # Pytest suite
├── data/raw/             # Scraped CSV snapshots
├── scripts/              # Scrapers + data pipeline
├── src/ufc_predictor/    # ML feature engineering / training
├── .github/workflows/    # CI (pytest, frontend lint/build)
└── render.yaml           # Render deployment config
```

## API Endpoints

`/health` · `/fighters` · `/events` · `/events/upcoming` · `/rankings` · `/head-to-head?fighter_a=&fighter_b=` · `/fighters/{name}/performance` · `POST /predict` · `/model-info`

## Running Locally

```bash
# Backend
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload   # http://127.0.0.1:8000/docs

# Frontend
cd frontend && npm install && npm run dev   # http://127.0.0.1:5173
```

For local frontend API calls, create `frontend/.env` with `VITE_API_URL=http://127.0.0.1:8000`.

For scraping/training/tests, install the full dev environment instead: `pip install -r requirements.txt`.

## Keeping Data Fresh

| Script | Produces | Runtime |
|---|---|---|
| `python -m scripts.scraper_ufcstats` | fighters/fights/events base data | — |
| `python -m scripts.scrape_fighter_career_stats` | age, striking/takedown %, records | ~45-90 min (resumable) |
| `python -m scripts.scrape_event_cards` | winner, method, round, venue per fight | ~10-15 min (resumable) |
| `python -m scripts.scrape_rankings` | official UFC rankings | seconds |
| `python -m scripts.scrape_upcoming_events` | scheduled events | ~2 min |

All handle ufcstats.com's proof-of-work challenge automatically and are safe to re-run. Head-to-head, fighter performance, and finishing tendencies are computed on the fly from `event_cards.csv` — no separate cache.

## Testing

```bash
pytest -v                                  # backend + ML (44 tests)
cd frontend && npm run lint && npm run build   # frontend lint + typecheck + build
```

## Deployment

- **Backend (Render)**: configured via `render.yaml`. Start command: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`. Health check: `/health`.
- **Frontend (Vercel)**: root directory `frontend`, framework `Vite`, build `npm run build`, output `dist`. `frontend/vercel.json` proxies `/api/*` to the Render backend.

## Model Notes

Features are matchup deltas (age, height, reach, win rate, stance, striking/takedown accuracy). Fighter profiles are sourced live from scraped data; the deployed model artifact itself was trained on a separate historical dataset not checked into this repo — see `src/ufc_predictor/data.py` for details. Predictions are for educational/portfolio purposes only, not betting advice.
