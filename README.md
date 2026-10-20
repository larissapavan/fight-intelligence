# Fight Intelligence

UFC fight stats, rankings and win predictions, with an explanation for every prediction.

[![CI](https://github.com/larissapavan/fight-intelligence/actions/workflows/ci.yml/badge.svg)](https://github.com/larissapavan/fight-intelligence/actions/workflows/ci.yml)
[![Daily data update](https://github.com/larissapavan/fight-intelligence/actions/workflows/update-data.yml/badge.svg)](https://github.com/larissapavan/fight-intelligence/actions/workflows/update-data.yml)

**Use it here: https://fight-intelligence.vercel.app/**

I started this because most fight predictors hand you a percentage and nothing else. If a model says a fighter is a 63% favorite, I want to know which stats pushed it there. So every prediction on the site comes with a SHAP breakdown of the features that moved it.

It runs in the browser. No account, nothing to install.

**Contents:** [What's on the site](#whats-on-the-site) · [How it works](#how-it-works) · [Data](#data) · [Run it locally](#run-it-locally) · [Deployment](#deployment) · [Quality](#quality) · [Repository layout](#repository-layout) · [Limitations](#limitations) · [Author](#author)

## What's on the site

| Page | What it is |
| --- | --- |
| **Home** | The next UFC card: main event, the model's pick and win probabilities, who is on a streak, the top of the pound-for-pound ranking, the full card with a pick for every fight, and the latest UFC headlines (via ESPN). |
| **Predict, Head-to-Head, Matchup** | Three tools for comparing two fighters. |
| **Fighters** | About 2,800 profiles, browsable by weight class. |
| **Rankings** | The official divisional and pound-for-pound rankings. |
| **Champions** | Current champions, the greatest reigns and title-fight records. |
| **Record book** | The UFC's all-time career leaders in 32 stats. |
| **Events** | The full event archive and the upcoming cards. |
| **Track record** | How the model's picks hold up against real fights. |
| **Data, Model, About** | Where the numbers come from, how the model works, and the credits. |

**Predict, Head-to-Head and Matchup**
- *Predict* gives a win probability plus the features that drove it (reach, age, win rate, striking and grappling differences), with a SHAP breakdown.
- *Head-to-Head* lists every time two fighters have met, who won and how, their common opponents and how many fights apart they are. After you pick the first fighter, the second picker opens with the people they have already fought.
- *Matchup* breaks the pairing down into striking, grappling and physical numbers, plus the factors the model weighed most.

**Fighters.** Everyone who has fought in the UFC or is booked for an upcoming card, filterable by active or former fighters, stance, badge and origin. Searching jumps to the division where the fighter is, so a name never hides behind an empty weight class. Fighters from other promotions who never fought in the UFC are left out: the model uses them for training, but they are not listed or selectable.
- Each profile has the photo, record, nickname, flags and hometown, a career timeline you can click through fight by fight, win rate and finish rate by year, how the wins came, and similar fighters (KNN over the stats).
- Badges mark where a fighter came from or what they achieved: Contender Series, The Ultimate Fighter, Road to UFC, Hall of Fame and GOAT. Belts have their own colors: **gold** for a current champion, **red** for a former one, **silver** for the BMF belt (current or former) and **blue** for an interim champion who never went on to win the full title.
- Title fights are flagged in the fight history with the belt at stake: "Featherweight title fight", "BMF title fight", or "Interim Lightweight title fight" (and "title win" when the fighter won the interim belt).

**Rankings.** With photos, win rate and last fight. Click a fighter to open their profile without leaving the page.

**Champions.** Three views, chosen from a menu.
- *Current*: the champion of every division, with record, last fight and how long they have held the belt. Under each one, a collapsed **title history** lists every fighter who has held that belt, newest first, with the date, how the title was won, days held, defenses and how the reign ended (interim reigns are marked).
- *Greatest*: champions ranked by total time as champion.
- *Title fight records*: positive records (most defenses, longest reigns, most title wins and more) and negative records (most times dethroned, shortest reigns), each a collapsible row that opens to its top 10, plus the multi-division champions. Open one of those and you get every title fight of their career: challenges, belts won, defenses and lost belts, with opponent, method, round and event.

**Record book.** Grouped into Fights, Time, Striking and Grappling: total fights, wins, finishes, win streak, control time, significant strikes, accuracy, takedowns, submission attempts and more. Each stat is a collapsible row that opens to its leaders, and leaders who have a profile on the site link to it.

**Events.** Every fight's result, method, round and referee (and the judges' scores when it went to a decision), plus the upcoming cards with the model's pick for each fight. Numbered events, Fight Nights and the rest are grouped, and you can search by name, date or place and filter by year and month.

**Track record.** Every pick is saved before the event and checked after it, so nothing is replayed with hindsight: live accuracy, how often it is right at each confidence level, the latest results and the biggest misses. The counter starts at zero and fills up card by card.

Fighter names in the rankings, champions pages and record book open that fighter's profile in place, so closing it brings you back to where you were. The layout works from 320px phones to ultrawide monitors, in dark or light mode.

## How it works

```
ESPN / ufc.com / roster.watch / statleaders.ufc.com
              |
   scrapers (scripts/)  -->  validate  -->  data/raw/*.csv
                                                 |
                              FastAPI  <---------+
                                 |   \
                                 |    scikit-learn model + SHAP
                                 v
                        React + TypeScript SPA
```

**Frontend.** React 19, TypeScript, Vite and Tailwind CSS 4, with React Router, Recharts and Framer Motion. It is a single-page app deployed on Vercel. Every API call carries the build id as `?v=`, so a new deploy never reads answers the browser cached for the previous one.

**Backend.** FastAPI on Render. The data layer is plain CSV files loaded with Pandas and cached in memory; the cache is invalidated when a file's modification time changes. Requests are rate limited with SlowAPI, and each answer is sent with a `Cache-Control` of a few minutes to an hour.

| Endpoint | Returns |
| --- | --- |
| `POST /predict`, `GET /predict/upcoming` | A win probability with its SHAP factors; the model's pick for every announced fight |
| `GET /fighters`, `/fighters/{name}/performance`, `/similar`, `/opponents` | Profiles, career timeline and trends, similar fighters, past opponents |
| `GET /head-to-head` | Fights between two fighters, common opponents, distance in fights |
| `GET /events`, `/events/upcoming` | The archive and the upcoming cards |
| `GET /rankings`, `/champions`, `/record-book` | Rankings; reigns, records and title histories; career leaders |
| `GET /track-record` | Live accuracy of the saved picks |
| `GET /news` | Headlines from ESPN |
| `GET /model-info`, `/data-info`, `/health` | Model metrics, data sources and freshness, service status |

**Model.** A `HistGradientBoostingClassifier` trained on past fights with 46 features, mostly differences between the two fighters' attributes and recent form. It was evaluated on a temporal split, so the test fights come after the training fights. On that held-out set:

| Model | Accuracy | ROC AUC | Log loss |
| --- | --- | --- | --- |
| Majority class baseline | 56.4% | 0.500 | 6.02 |
| Logistic regression | 69.8% | 0.820 | 0.577 |
| Random forest | 73.6% | 0.830 | 0.535 |
| **Gradient boosting (used)** | **74.7%** | **0.824** | **0.511** |

Random forest has a slightly higher ROC AUC. I went with gradient boosting because it has the best accuracy and log loss, and the probabilities are what the site shows. About three in four is a useful signal but not a safe bet, and fights are unpredictable.

## Data

**Where it comes from.** Everything is public, and every source is credited in the site's About page.
- [UFC Stats](http://ufcstats.com): the historical base for fighter profiles, events, fights and career stats. It now sits behind a browser check, so the daily update does not use it.
- [ESPN](https://www.espn.com/mma/): results, upcoming cards, records, debut fighters, photos and the news headlines on the home and events pages (cached for a few minutes, each one links to the original story).
- [ufc.com](https://www.ufc.com/rankings): the official rankings, the champions' photos and hometowns.
- [UFC Stats Leaders](https://statleaders.ufc.com/en/career): the career leaders behind the Record Book.
- [roster.watch](https://www.roster.watch/): who is on the UFC roster (active or former), nationalities, debut and last-fight dates, weight classes, and the Contender Series, TUF, Road to UFC, BMF and Hall of Fame badges.
- [UFC data by scarekrow](https://www.kaggle.com/datasets/scarekrow/ufc-data) on Kaggle: referees, scheduled rounds, title-fight flags and judges' scores.
- My own [UFC Historical Fight Dataset (1993–2026)](https://www.kaggle.com/datasets/larissapavan/ufc-historical-fight-dataset-19942026) on Kaggle, which is the data this site is built on.

**How it stays fresh.** A GitHub Actions workflow runs `python -m scripts.update_all` once a day, in this order:
1. Save the model's pick for every announced fight, before ESPN turns those cards into results.
2. Refresh ESPN: events, results, upcoming cards, records and debut fighters.
3. Settle the saved picks whose fights are now over, for the track record page.
4. Refresh the official rankings.
5. Photos: the champions' belt photos, plus ESPN headshots for new fighters and for active fighters still without one (ESPN often publishes a debutant's photo days after the profile exists, so those are asked again every run).
6. Refresh hometowns, the roster and the record book.
7. Validate, run the tests and, only if everything passes, commit the CSVs and the new photos.

**Validation.** Each CSV is compared with the last committed version, and the update is rejected if a header changed or the row count drops, which is what protects the site when one of the sources changes its format. It also checks the shape of the data: a partial rankings page never replaces the stored one, a fighter appears at most once per ranking, a bout never has a missing or repeated fighter, records are numbers, and every photo the manifest lists exists on disk. Softer problems are reported as warnings and do not stop the update: the official champion disagreeing with the hand-kept reigns, a ranked or booked fighter with no profile, and a card whose date has passed but is still listed as upcoming.

**Kept by hand.** A few small files in `data/raw/` are edited manually:

| File | What it fixes |
| --- | --- |
| `title_reigns.csv` | Champions and belt changes (including interim titles) |
| `bmf_title_fights.csv` | The BMF title fights |
| `manual_fights.csv` | Fights announced in the news before ESPN lists them; each one drops out by itself once ESPN has it or the date passes |
| `weight_overrides.csv` | A bout ESPN books in the wrong division |
| `name_aliases.csv` | The same fighter spelled differently by ESPN and UFC Stats |
| `status_overrides.csv` | A release or retirement roster.watch has not caught up with |
| `hometown_overrides.csv` | A city that ufc.com lists only as a country |

## Run it locally

You need Python 3.12 and Node 22. The CSV data is in the repository, so nothing has to be scraped first.

```bash
# Backend (from the repository root)
pip install -r requirements.txt          # everything: API, scrapers and tests (backend/requirements.txt is the API alone)
uvicorn backend.app.main:app --reload    # http://127.0.0.1:8000, docs at /docs

# Frontend (in another terminal)
cd frontend
npm install
npm run dev                              # http://localhost:5173
```

| Variable | Where | Default |
| --- | --- | --- |
| `VITE_API_URL` | frontend | `http://127.0.0.1:8000` in development; `/api` (a Vercel rewrite to the API) in production |
| `FRONTEND_ORIGINS` | backend | Extra CORS origins, comma separated; `localhost:5173` and the production sites are always allowed |
| `LOG_LEVEL` | backend | `INFO` |

```bash
python -m scripts.update_all --dry-run   # preview the ESPN update; nothing is written
python -m scripts.update_all             # the full daily refresh
python -m scripts.validate_data          # check data/raw against the last commit

pytest                                   # backend, model and script tests
cd frontend && npm test                  # smoke tests: every page against a fake API
cd frontend && npm run lint && npm run build
```

The training code is in `src/ufc_predictor` (`python -m src.ufc_predictor.train`). The model in `models/` has not been retrained since it was first built; see [Limitations](#limitations).

## Deployment

The frontend is on Vercel (`frontend/vercel.json` rewrites `/api/*` to the API and every other path to the app). The API is on Render's free plan (`render.yaml`), which sleeps when idle, so the first visit after a quiet spell can take up to a minute; the site says so while it waits. The API redeploys on every push to `main` (`autoDeploy`). The daily data refresh runs in GitHub Actions and commits the new CSVs to `main`, which is how fresh data reaches the API.

## Quality

There are 181 pytest tests covering the routers, the catalog and champions services, the model API, the feature code and the scrapers, and 19 frontend smoke tests that open every page against a fake API and check the main flows (opening a profile, the multi-division champions, the division title histories, the model's picks). Every push runs pytest, ESLint, the frontend tests and the Vite build (which includes a strict TypeScript check) in CI. The pages were also checked with an automated accessibility audit (axe, WCAG 2 A and AA) in light and dark mode.

## Repository layout

```
backend/            FastAPI app (routers, services, schemas)
frontend/           React app (pages, shared components, hooks)
models/             the saved model
src/ufc_predictor/  feature engineering and training code
scripts/            scrapers, daily update, prediction log, photos, data validation
.github/workflows/  CI and the daily data update
data/raw/           the CSV data
notebooks/          exploratory analysis
docs/               brand assets and the Kaggle dataset README
tests/              backend, model and script tests (the frontend tests sit next to the app in frontend/src/test)
```

## Limitations

- The data comes from public sources, so it can have mistakes or lag behind real events. The numbers are not official.
- The model only knows what is in the stats. It has no idea about injuries, weight cuts, camp changes or style quirks.
- Fighters with few UFC fights give the model little to work with, so their predictions are less reliable.
- Whether a fighter is active comes from roster.watch. Fighters it does not know yet, such as new debuts, fall back to a guess (fought in the last two years, booked or ranked), with a short manual override list for known retirements.
- A debutant's division comes from roster.watch, or from their profile weight when it has nothing, so it can be off until their first UFC fight.
- Hometowns come from ufc.com and not every fighter has one listed, so some profiles show only a country.
- Photos come from ESPN and ufc.com; a few fighters have none yet, and a handful were added by hand.
- Title reigns and belt changes are entered by hand, so a new champion can show up a little after the fight. The daily update warns when the official rankings and the hand-kept reigns disagree. A title fight is only marked as an interim one when the interim champion won it.
- The model has not been retrained since it was first built. Retraining honestly needs each fighter's stats as they were before every fight, and the data here only has their current career numbers, so it is not automated. The track record page is how I watch for the model drifting.

## Author

Made by Larissa Pavan ([GitHub](https://github.com/larissapavan)). If you find a data error or have an idea, open an [issue](https://github.com/larissapavan/fight-intelligence/issues).

This is a personal, non-commercial project I built to learn. It isn't connected to the UFC, Zuffa, TKO, any fighter or any employer, and UFC and related marks belong to their owners. Predictions are for fun and learning, not betting advice.
