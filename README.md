# Fight Intelligence

UFC fight stats, rankings and win predictions, with an explanation for every prediction.

**Use it here: https://fight-intelligence.vercel.app/**

I started this because most fight predictors hand you a percentage and nothing else. If a model says a fighter is a 63% favorite, I want to know which stats pushed it there. So every prediction on the site comes with a SHAP breakdown of the features that moved it.

It runs in the browser. No account, nothing to install.

## What's on the site

- **Predict.** Pick two fighters and get a win probability plus the features that drove it (reach, age, win rate, striking and grappling differences).
- **Fighters.** About 4,500 profiles with records, career stats and year-by-year results, split by weight class. A "similar fighters" search runs KNN over the stats.
- **Rankings.** Official divisional and pound-for-pound rankings with fighter photos.
- **Champions.** Current champion of every division, greatest champions by time held, and a record book: most defenses, longest and shortest reigns, most times dethroned, multi-division champions.
- **Events.** The full archive with results, plus upcoming cards.
- **Data and Model.** Where the numbers come from and how the model was trained.

The layout works from 320px phones to ultrawide monitors, in dark or light mode.

## How it works

```
ESPN / ufc.com / UFC Stats
        |
   scrapers (scripts/)  -->  validate  -->  data/raw/*.csv
                                                 |
                              FastAPI  <---------+
                                 |   \
                                 |    scikit-learn model + SHAP
                                 v
                        React + TypeScript SPA
```

**Frontend.** React 19, TypeScript, Vite and Tailwind CSS 4, with React Router, Recharts and Framer Motion. It is a single-page app deployed on Vercel.

**Backend.** FastAPI on Render. The data layer is plain CSV files loaded with Pandas and cached in memory; the cache is invalidated when a file's modification time changes. Requests are rate limited with SlowAPI. The main endpoints are `/predict`, `/fighters`, `/fighters/{name}/performance`, `/fighters/{name}/similar`, `/rankings`, `/champions`, `/events`, `/model-info` and `/health`.

**Model.** A `HistGradientBoostingClassifier` trained on past fights with 46 features, mostly differences between the two fighters' attributes and recent form. It was evaluated on a temporal split, so the test fights come after the training fights. On that held-out set:

| Model | Accuracy | ROC AUC | Log loss |
| --- | --- | --- | --- |
| Majority class baseline | 56.4% | 0.500 | 6.02 |
| Logistic regression | 69.8% | 0.820 | 0.577 |
| Random forest | 73.6% | 0.830 | 0.535 |
| **Gradient boosting (used)** | **74.7%** | **0.824** | **0.511** |

Random forest has a slightly higher ROC AUC. I went with gradient boosting because it has the best accuracy and log loss, and the probabilities are what the site shows. About three in four is a useful signal but not a safe bet, and fights are unpredictable.

**Data.** Fights, events, results, upcoming cards and rankings come from public sources: ESPN, ufc.com and UFC Stats. A GitHub Actions workflow runs the update scripts once a day. Before anything is committed, a validation step compares each CSV to the last committed version and rejects the update if a header changed or the row count drops. This is what protects the site if one of those sources changes its format. Title reigns are entered by hand.

## Quality

The backend has about 100 pytest tests covering the routers, the catalog and champions services, the model API and the scrapers. Every push runs pytest, ESLint, a strict TypeScript build and the Vite build in CI.

## Repository layout

```
backend/            FastAPI app (routers, services, schemas) and the saved model
frontend/           React app (pages, shared components, hooks)
src/ufc_predictor/  feature engineering and training code
scripts/            scrapers, daily update, data validation
data/raw/           the CSV data
notebooks/          exploratory analysis
tests/              backend, model and script tests
```

## Limitations

- The data comes from public sources, so it can have mistakes or lag behind real events. The numbers are not official.
- The model only knows what is in the stats. It has no idea about injuries, weight cuts, camp changes or style quirks.
- Fighters with few UFC fights give the model little to work with, so their predictions are less reliable.
- The active-fighter filter is inferred (fought in the last two years, booked, or ranked), with a short manual override list for known retirements.

## Author

Made by Larissa Pavan ([GitHub](https://github.com/larissapavan)). If you find a data error or have an idea, open an [issue](https://github.com/larissapavan/fight-intelligence/issues).

This is a personal, non-commercial project I built to learn. It isn't connected to the UFC, Zuffa, TKO, any fighter or any employer, and UFC and related marks belong to their owners. Predictions are for fun and learning, not betting advice.

To try it, go to https://fight-intelligence.vercel.app/.
