# Fight Intelligence

UFC fight stats, rankings and win predictions, with an explanation for every prediction.

[![CI](https://github.com/larissapavan/fight-intelligence/actions/workflows/ci.yml/badge.svg)](https://github.com/larissapavan/fight-intelligence/actions/workflows/ci.yml)
[![Daily data update](https://github.com/larissapavan/fight-intelligence/actions/workflows/update-data.yml/badge.svg)](https://github.com/larissapavan/fight-intelligence/actions/workflows/update-data.yml)

**Pick any two UFC fighters, get a win probability, and see exactly which stats drove it.** Free, no account, works on your phone.

**[Open Fight Intelligence →](https://fight-intelligence.vercel.app/)**

**Contents:** [Try it](#try-it-in-30-seconds) · [In plain words](#part-1-in-plain-words) · [What you can do](#what-you-can-do) · [Under the hood](#part-2-under-the-hood) · [Run it locally](#run-it-locally) · [Limitations](#limitations) · [Author](#author)

---

## Try it in 30 seconds

1. **See the next card.** The main event, the model's pick and who is on a streak: [open the home page](https://fight-intelligence.vercel.app/).
2. **Settle a debate.** [Makhachev vs. Tsarukyan](https://fight-intelligence.vercel.app/matchup-intelligence?a=Islam%20Makhachev&b=Arman%20Tsarukyan) · [Jones vs. Aspinall](https://fight-intelligence.vercel.app/matchup-intelligence?a=Jon%20Jones&b=Tom%20Aspinall) · [Pereira vs. Ankalaev](https://fight-intelligence.vercel.app/matchup-intelligence?a=Alex%20Pereira&b=Magomed%20Ankalaev). Then swap the two names: the answer stays the same.
3. **Open a profile.** [Max Holloway](https://fight-intelligence.vercel.app/fighters?fighter=Max%20Holloway), with a career timeline you can click through fight by fight.
4. **Settle who held the belt.** [Every champion of every division](https://fight-intelligence.vercel.app/champions), newest first.
5. **Check whether the model is any good.** The [track record](https://fight-intelligence.vercel.app/track-record) saves every pick before the fight and grades it afterwards.

## Why it is worth a look

- **Every prediction comes with its reasons**, not just a percentage.
- **It keeps score in public.** Picks are saved before the fight and graded after it, so nothing is replayed with hindsight.
- **It stays fresh.** The data refreshes by itself every day.
- **There is a lot to explore beyond the predictions:** about 2,800 fighter profiles, every title reign, a record book with 32 all-time stats and the full event archive.
- **It fits your pocket.** It works from phones to ultrawide monitors, in dark or light mode.

## Good to know

- Predictions are for fun and learning, not betting advice.
- On recent fights the model gets about six in ten right: better than a coin flip, but not by a lot, and never a safe bet.
- It only knows stats. It has no idea about injuries, weight cuts or camp news. The full list is in [Limitations](#limitations).

---

## Part 1: In plain words

### What it is

A website about the UFC. Look up any fighter and see their record, career and how they win. Check the rankings, the champions and every title reign. Open an upcoming card and see who the model thinks will win each fight, and why.

I started this because most fight predictors hand you a percentage and nothing else. If a model says a fighter is a 63% favorite, I want to know which stats pushed it there. So every prediction on the site comes with a SHAP breakdown of the features that moved it. (SHAP is a method that shows how much each stat pushed the result toward one fighter or the other.)

It runs in the browser. No account, nothing to install.

### How to read a prediction

- **It is a chance, not a verdict.** The model compares the two fighters' numbers (age, reach, record, striking, takedowns and more) with thousands of past fights and gives each fighter a probability. A 60% favorite still loses four times out of ten.
- **The "why" list shows what pushed it.** Each line is a stat and the fighter it favored, for example "Win rate difference pushed the prediction toward" followed by that fighter's name.
- **It does not depend on the order.** Ask about A against B or B against A and you get the same answer.
- **How often is it right?** About six in ten on the most recent fights, a modest edge over a coin flip. The model's own file reports about three in four, but that figure could not be reproduced (see [The model](#the-model)). Fights are unpredictable.
- **Don't take my word for it.** The Track record page saves every pick before the fight and checks it afterwards, so you can watch the real hit rate build up card by card.

### Where the numbers come from

Everything is public: ESPN, ufc.com, UFC Stats, roster.watch and a few Kaggle datasets, all credited on the site's About page. A script refreshes the data once a day, and a set of checks refuses the update if something looks broken, for example when a source changes its format.

---

## What you can do

| Page | What it is |
| --- | --- |
| **Home** | The next UFC card: the main event, the model's pick and win probabilities, who is on a streak, the top of the pound-for-pound ranking, and the latest UFC headlines (via ESPN). |
| **Fighters** | About 2,800 profiles, browsable by weight class. Searching a name jumps to the right division. |
| **Rankings** | The official divisional and pound-for-pound rankings, with photos, win rate and last fight. |
| **Champions** | Current champions, the greatest reigns, and title-fight records. |
| **Record book** | The UFC's all-time career leaders in 32 stats. |
| **Events** | The full event archive and the upcoming cards, with the model's pick for each fight. |
| **Predict, Head-to-Head, Matchup** | Three tools for comparing two fighters. |
| **Track record** | How the model's picks hold up against real fights. |
| **Data, Model, About** | Where the numbers come from, how the model works, and the credits. |

A few details worth knowing:

- **Fighter profiles** have the photo, record, nickname, flags and hometown, a career timeline you can click through fight by fight, win and finish rate by year, how the wins came, and similar fighters.
- **Belts have colors:** **gold** for a current champion, **red** for a former one, **silver** for the BMF belt and **blue** for an interim champion who never went on to win the full title. Title fights in a fighter's history say which belt was at stake, such as "Featherweight title fight" or "Interim Lightweight title win".
- **Champions** shows, under each division, a collapsed **title history** with every fighter who has held that belt: date, how it was won, days held, defenses and how the reign ended. The record lists (most defenses, longest reigns, most times dethroned and more) open to their top 10, and the multi-division champions open to every title fight of their career.
- **Predict** gives the win probability and the factors behind it. **Head-to-Head** lists every meeting between two fighters and their common opponents. **Matchup** breaks the pairing into striking, grappling and physical numbers.
- **Events** include each fight's result, method, round, referee and the judges' scores, and you can search by name, date or place.
- **Track record** starts at zero and fills up as fights happen. It shows live accuracy, how often the model is right at each confidence level, the latest results and the biggest misses.

The layout works from 320px phones to ultrawide monitors, in dark or light mode.

---

## Part 2: Under the hood

### How it fits together

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

| Part | What it is |
| --- | --- |
| **Frontend** | React 19, TypeScript, Vite and Tailwind CSS 4, with React Router, Recharts and Framer Motion. A single-page app on Vercel. Every API call carries the build id as `?v=`, so a new deploy never reads answers the browser cached for the previous one. |
| **Backend** | FastAPI on Render. The data layer is plain CSV files loaded with Pandas and cached in memory; the cache is invalidated when a file's modification time changes. Requests are rate limited with SlowAPI, and each answer is sent with a `Cache-Control` of a few minutes to an hour. |
| **Model** | scikit-learn `HistGradientBoostingClassifier`, explained with SHAP. One file, `models/ufc_winner_model.joblib`: training writes it and the API reads it. |
| **Data** | CSV files in `data/raw/`, kept in the repository. |
| **Automation** | GitHub Actions: CI on every push and a daily data update. |

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

### The model

A `HistGradientBoostingClassifier` trained on past fights with 46 features, mostly differences between the two fighters' attributes and recent form. It was evaluated on a temporal split, so the test fights come after the training fights. On that held-out set:

| Model | Accuracy | ROC AUC | Log loss |
| --- | --- | --- | --- |
| Majority class baseline | 56.4% | 0.500 | 6.02 |
| Logistic regression | 69.8% | 0.820 | 0.577 |
| Random forest | 73.6% | 0.830 | 0.535 |
| **Gradient boosting (used)** | **74.7%** | **0.824** | **0.511** |

Random forest has a slightly higher ROC AUC. I went with gradient boosting because it has the best accuracy and log loss, and the probabilities are what the site shows. About six in ten is a modest edge over a coin flip, and not a safe bet, and fights are unpredictable.

**Read these numbers with care.** The table above is what the model's own file reports. Its training data is not in this repository, so the figures could not be reproduced. Scored on the 1,752 most recent fights (June 2023 to October 2026), with each fighter's age and record as of the fight, the model got 62% right, its log loss was 0.708, and the picks it rated 90% or more were right 71% of the time. The same gradient boosting fed each fighter's career totals as they stand today, which include the fight being predicted and every later one, reaches 73% on those fights. So the reported accuracy is probably inflated by that kind of leakage; I cannot confirm it without the original data. The accuracy tiles on the site show the re-measured 62.2% (from `models/ufc_winner_model.evaluation.json`, written by `scripts/compare_models.py`), not the reported figure.

### A pre-fight candidate (not deployed)

I rebuilt a training set from this repository's own files in which every fight is described by what was known before it: record, streak, days off, a rating, and striking and takedown accuracy from ESPN's per-fight statistics. Fighter A and B are drawn at random, the split is by date, nothing from the fight itself or later is used, and the probabilities are calibrated. On the same 1,752 fights:

| Model | Accuracy | ROC AUC | Log loss | Calibration error |
| --- | --- | --- | --- | --- |
| Deployed model (both orders averaged) | 62.2% | 0.669 | 0.708 | 0.085 |
| **Pre-fight candidate** | 62.3% | 0.666 | 0.650 | 0.023 |

The same accuracy, but better probabilities: when the candidate says 70% to 80%, it is right 77% of the time, while the deployed model's picks of 90% or more are right 71% of the time. It is not deployed. `python -m src.ufc_predictor.train_prefight` trains it in about 15 seconds and `python -m scripts.compare_models` writes the comparison; the full reports are in [`docs/prefight-model-report.md`](docs/prefight-model-report.md) and [`docs/model-comparison.md`](docs/model-comparison.md).

**One answer for both orders.** In the training data the red corner won 56.4% of the fights, and the model learned that, so asking it about (A, B) and (B, A) used to give answers that did not add up to 100%. The site now asks both ways and averages them, `p = (p(A, B) + 1 − p(B, A)) / 2`, so a matchup reads the same whichever fighter is typed first. The factors behind a pick come from SHAP, averaged the same way and credited to the fighter each feature belongs to. This is a correction applied when a prediction is made, not a retrained model; the model file is the same one.

### Data

**Where it comes from.** Everything is public, and every source is credited in the site's About page.
- [UFC Stats](http://ufcstats.com): the historical base for fighter profiles, events, fights and career stats. It now sits behind a browser check, so the daily update does not use it.
- [ESPN](https://www.espn.com/mma/): results, upcoming cards, records, debut fighters, per-fight statistics (strikes, takedowns, control time), photos and the news headlines on the home and events pages (cached for a few minutes, each one links to the original story).
- [ufc.com](https://www.ufc.com/rankings): the official rankings, the champions' photos and hometowns.
- [UFC Stats Leaders](https://statleaders.ufc.com/en/career): the career leaders behind the Record Book.
- [roster.watch](https://www.roster.watch/): who is on the UFC roster (active or former), nationalities, debut and last-fight dates, weight classes, and the Contender Series, TUF, Road to UFC, BMF and Hall of Fame badges.
- [UFC data by scarekrow](https://www.kaggle.com/datasets/scarekrow/ufc-data) on Kaggle: referees, scheduled rounds, title-fight flags and judges' scores.
- My own [UFC Historical Fight Dataset (1993–2026)](https://www.kaggle.com/datasets/larissapavan/ufc-historical-fight-dataset-19942026) on Kaggle, which is the data this site is built on.

**The daily update.** A GitHub Actions workflow runs `python -m scripts.update_all` once a day, in this order:
1. Save the model's pick for every announced fight, before ESPN turns those cards into results.
2. Refresh ESPN: events, results, upcoming cards, records and debut fighters.
3. Settle the saved picks whose fights are now over, for the track record page.
4. Collect ESPN's per-fight statistics for the fights of the last month.
5. Refresh the official rankings.
6. Photos: the champions' belt photos, plus ESPN headshots for new fighters and for active fighters still without one (ESPN often publishes a debutant's photo days after the profile exists, so those are asked again every run).
7. Refresh hometowns, the roster and the record book.
8. Validate, run the tests and, only if everything passes, commit the CSVs and the new photos.

One failing source does not cost the whole day: the steps that worked are still validated and committed, and the run is marked as failed so the problem is not hidden.

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

---

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
| `TRUSTED_PROXY_HOPS` | backend | `0`: rate limits count visitors by the connection address. Set it to the number of proxies in front of the API (for example 1 on Render alone) to count them by the address the outermost proxy saw. Only the end of `X-Forwarded-For` is trusted, since the start is written by the client |
| `RATE_LIMIT_DEBUG` | backend | Off. Set to `1` to log the address, the header and the chosen key for the first 50 requests, to find the right `TRUSTED_PROXY_HOPS` |

```bash
python -m scripts.update_all --dry-run   # preview the ESPN update; nothing is written
python -m scripts.update_all             # the full daily refresh
python -m scripts.validate_data          # check data/raw against the last commit
python -m scripts.log_predictions --refresh-unresolved   # after a model change: re-pick fights still to come
python -m scripts.scrape_fight_stats --dry-run          # per-fight statistics from ESPN: what is still to collect (resumable)
python -m src.ufc_predictor.train_prefight              # train the pre-fight candidate and write docs/prefight-model-report.md
python -m scripts.compare_models                        # deployed model vs candidate on the same fights: docs/model-comparison.md

pytest                                   # backend, model and script tests
cd frontend && npm test                  # smoke tests: every page against a fake API
cd frontend && npm run lint && npm run build
```

The deployed model is a single file, `models/ufc_winner_model.joblib`: the API reads it, and there is no second copy to keep in sync. Its training data is not in this repository, so the old training script (`python -m src.ufc_predictor.train`) cannot reproduce it, and it has not been retrained since it was first built. The pre-fight candidate is trained by `train_prefight` from this repository's files alone, into `models/candidate/`, and does not replace the deployed model. See [Limitations](#limitations).

**Deployment.** The frontend is on Vercel (`frontend/vercel.json` rewrites `/api/*` to the API and every other path to the app). The API is on Render's free plan (`render.yaml`), which sleeps when idle, so the first visit after a quiet spell can take up to a minute; the site says so while it waits. The API redeploys on every push to `main` (`autoDeploy`). The daily data refresh runs in GitHub Actions and commits the new CSVs to `main`, which is how fresh data reaches the API.

**Tests.** There are 366 pytest tests covering the routers, the catalog and champions services, the model API, the feature code and the scrapers, and 22 frontend smoke tests that open every page against a fake API and check the main flows (opening a profile, the multi-division champions, the division title histories, the model's picks, the track record note). Among them, the model tests hold the prediction to the same answer whichever fighter is typed first, on three headline matchups and on 25 real pairs of active fighters. Every push runs pytest, ESLint, the frontend tests and the Vite build (which includes a strict TypeScript check) in CI. The pages were also checked with an automated accessibility audit (axe, WCAG 2 A and AA) in light and dark mode.

**Repository layout**

```
backend/            FastAPI app (routers, services, schemas)
frontend/           React app (pages, shared components, hooks)
models/             the deployed model (read by the API); `train_prefight` writes its candidate to models/candidate/, which is not committed
src/ufc_predictor/  feature engineering and training code (prefight.py builds the training data from what was known before each fight)
scripts/            scrapers, daily update, prediction log, photos, data validation
.github/workflows/  CI and the daily data update
data/raw/           the CSV data
notebooks/          exploratory analysis
docs/               brand assets, the Kaggle dataset README and the model reports
tests/              backend, model and script tests (the frontend tests sit next to the app in frontend/src/test)
```

---

## Limitations

- The data comes from public sources, so it can have mistakes or lag behind real events. The numbers are not official.
- The model only knows what is in the stats. It has no idea about injuries, weight cuts, camp changes or style quirks.
- Fighters with few UFC fights give the model little to work with, so their predictions are less reliable.
- The model has a built-in lean toward the red corner, because that is what its training fights looked like. Averaging both orders removes the effect on a single matchup, but it does not make the model more accurate, and how well its probabilities are calibrated, such as whether a 90% pick really wins nine times in ten, has not been measured yet. Read very confident picks with caution.
- The factors shown for a pick are a good guide to which stats mattered and how much, not an exact breakdown: SHAP's probability output is approximate, and across random matchups the factors miss the final probability by 0.25 percentage points at the median and by up to about 4 points at worst.
- The deployed model cannot be rebuilt from this repository: its training data is not checked in, and without it the old training script falls back to randomly generated data that says nothing about real fights. Its reported accuracy could not be reproduced (see [The model](#the-model)). A different model, trained only on what was known before each fight, can be rebuilt here, and it is what the comparison above is about.
- The track record keeps picks exactly as they were shown. Those saved before 2026-10-20 come from the first version of the model, which answered differently depending on which fighter was listed first, and the page says so.
- The deployed model has not been retrained since it was first built. Retraining honestly needs each fighter's stats as they were before every fight. The repository now has them (the record and ESPN's per-fight statistics) and the pre-fight candidate uses them, but nothing is retrained or swapped automatically. The track record page is how I watch for the model drifting.
- Whether a fighter is active comes from roster.watch. Fighters it does not know yet, such as new debuts, fall back to a guess (fought in the last two years, booked or ranked), with a short manual override list for known retirements.
- A debutant's division comes from roster.watch, or from their profile weight when it has nothing, so it can be off until their first UFC fight.
- Hometowns come from ufc.com and not every fighter has one listed, so some profiles show only a country.
- Photos come from ESPN and ufc.com; a few fighters have none yet, and a handful were added by hand.
- Title reigns and belt changes are entered by hand, so a new champion can show up a little after the fight. The daily update warns when the official rankings and the hand-kept reigns disagree. A title fight is only marked as an interim one when the interim champion won it.

## Like it? Help it grow

- **Try it and tell me what is missing or wrong.** Ideas and bug reports are welcome in the [issues](https://github.com/larissapavan/fight-intelligence/issues).
- **Found a mistake in the data?** Open an issue with the fighter and what you expected to see.
- **Share a matchup.** Every matchup page has a link of its own, so you can send the exact fight you are arguing about.
- **Give the repository a star** if you enjoyed it. It helps other fight fans find it.

## Author

Made by Larissa Pavan ([GitHub](https://github.com/larissapavan)). If you find a data error or have an idea, open an [issue](https://github.com/larissapavan/fight-intelligence/issues).

This is a personal, non-commercial project I built to learn. It isn't connected to the UFC, Zuffa, TKO, any fighter or any employer, and UFC and related marks belong to their owners. Predictions are for fun and learning, not betting advice.
