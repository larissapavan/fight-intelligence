# Fight Intelligence

UFC fight stats, rankings and win predictions, with an explanation for every prediction.

**Use it here: https://fight-intelligence.vercel.app/**

I started this because most fight predictors hand you a percentage and nothing else. If a model says a fighter is a 63% favorite, I want to know which stats pushed it there. So every prediction on the site comes with a SHAP breakdown of the features that moved it.

It runs in the browser. No account, nothing to install.

## What's on the site

**Home.** The next UFC card with the main event, the model's pick and win probabilities for it, who is on a streak, the top of the pound-for-pound ranking, the full card with the model's pick for every fight, and the latest UFC headlines (via ESPN).

**Predict, Head-to-Head and Matchup.** Three tools for comparing two fighters.
- *Predict* gives a win probability plus the features that drove it (reach, age, win rate, striking and grappling differences), with a SHAP breakdown.
- *Head-to-Head* lists every time two fighters have met, who won and how, their common opponents and how many fights apart they are. After you pick the first fighter, the second picker opens with the people they have already fought.
- *Matchup* breaks the pairing down into striking, grappling and physical numbers, plus the factors the model weighed most.

**Fighters.** About 2,800 profiles of everyone who has fought in the UFC or is booked for an upcoming card, browsable by weight class and filterable by active or former fighters, stance, badge and origin. Fighters from other promotions who never fought in the UFC are left out: the model uses them for training, but they are not listed or selectable.
- Each profile has the photo, record, nickname, flags and hometown, a career timeline you can click through fight by fight, win rate and finish rate by year, how the wins came, and similar fighters (KNN over the stats).
- Badges mark where a fighter came from or what they achieved: Contender Series, The Ultimate Fighter, Road to UFC, Hall of Fame, GOAT, former BMF champion and the current BMF champion.
- Title fights, including BMF ones, are flagged in the fight history.

**Rankings.** The official divisional and pound-for-pound rankings with photos, win rate and last fight. Click a fighter to open their profile without leaving the page.

**Champions.** Three views, chosen from a menu.
- *Current*: the champion of every division, with record, last fight and how long they have held the belt.
- *Greatest*: champions ranked by total time as champion.
- *Title fight records*: positive records (most defenses, longest reigns, most title wins and more), negative records (most times dethroned, shortest reigns) and the multi-division champions. Open one of those and you get every title fight of their career: challenges, belts won, defenses and lost belts, with opponent, method, round and event.

**Record book.** The UFC's all-time career leaders in 32 stats, grouped into Fights, Time, Striking and Grappling: total fights, wins, finishes, win streak, control time, significant strikes, accuracy, takedowns, submission attempts and more. Leaders who have a profile on the site link to it.

**Events.** The full event archive with every fight's result, method, round and referee (and the judges' scores when it went to a decision), plus the upcoming cards with the model's pick for each fight. Numbered events, Fight Nights and the rest are grouped, and you can search by name, date or place and filter by year and month.

**Track record.** How the model's picks hold up against real fights. Every pick is saved before the event and checked after it, so nothing is replayed with hindsight: live accuracy, how often it is right at each confidence level, the latest results and the biggest misses. The counter starts at zero and fills up card by card.

**Data, Model and About.** Where the numbers come from, how the model was trained and how it compares with simpler ones, what it can and cannot do, and the credits for every external source.

Fighter names in the rankings, champions pages and record book open that fighter's profile in place, so closing it brings you back to where you were. The layout works from 320px phones to ultrawide monitors, in dark or light mode.

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

**Backend.** FastAPI on Render. The data layer is plain CSV files loaded with Pandas and cached in memory; the cache is invalidated when a file's modification time changes. Requests are rate limited with SlowAPI. The main endpoints are `/predict`, `/fighters`, `/fighters/{name}/performance`, `/fighters/{name}/similar`, `/fighters/{name}/opponents`, `/head-to-head`, `/rankings`, `/champions`, `/record-book`, `/events`, `/news`, `/predict/upcoming`, `/track-record`, `/model-info` and `/health`.

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
- [UFC Stats](http://ufcstats.com): fighter profiles, events, fights and career stats.
- [ESPN](https://www.espn.com/mma/): results, upcoming cards, records, debut fighters, photos and the news headlines on the home and events pages (cached for a few minutes, each one links to the original story).
- [ufc.com](https://www.ufc.com/rankings): the official rankings, the champions' photos and hometowns.
- [UFC Stats Leaders](https://statleaders.ufc.com/en/career): the career leaders behind the Record Book.
- [roster.watch](https://www.roster.watch/): who is on the UFC roster (active or former), nationalities, debut and last-fight dates, and the Contender Series, TUF, Road to UFC, BMF and Hall of Fame badges.
- [UFC data by scarekrow](https://www.kaggle.com/datasets/scarekrow/ufc-data) on Kaggle: referees, scheduled rounds, title-fight flags and judges' scores.
- My own [UFC Historical Fight Dataset (1993–2026)](https://www.kaggle.com/datasets/larissapavan/ufc-historical-fight-dataset-19942026) on Kaggle, which is the data this site is built on.

**How it stays fresh.** A GitHub Actions workflow runs the update scripts once a day. It first saves the model's pick for every announced fight, then refreshes ESPN (events and results), settles the saved picks whose fights are now over for the track record page, and refreshes the rankings, the roster, the hometowns and the record book. A validation step then compares each CSV with the last committed version and rejects the update if a header changed or the row count drops, which is what protects the site when one of the sources changes its format. The tests run before anything is committed.

**Kept by hand.** A few small files are edited manually: `title_reigns.csv` (champions and belt changes), `bmf_title_fights.csv`, `hometown_overrides.csv` (a city that ufc.com lists only as a country) and `name_aliases.csv` (the same fighter spelled differently by ESPN and UFC Stats).

## Quality

The backend has about 150 pytest tests covering the routers, the catalog and champions services, the model API and the scrapers. The frontend has smoke tests that open every page against a fake API and check the main flows (opening a profile, the multi-division champions, the model's picks). Every push runs pytest, ESLint, the frontend tests, a strict TypeScript build and the Vite build in CI. The pages were also checked with an automated accessibility audit (axe, WCAG 2 A and AA) in light and dark mode.

## Repository layout

```
backend/            FastAPI app (routers, services, schemas) and the saved model
frontend/           React app (pages, shared components, hooks)
src/ufc_predictor/  feature engineering and training code
scripts/            scrapers, daily update, prediction log, data validation
.github/workflows/ CI and the daily data update
data/raw/           the CSV data
notebooks/          exploratory analysis
tests/              backend, model and script tests (the frontend tests sit next to the app in frontend/src/test)
```

## Limitations

- The data comes from public sources, so it can have mistakes or lag behind real events. The numbers are not official.
- The model only knows what is in the stats. It has no idea about injuries, weight cuts, camp changes or style quirks.
- Fighters with few UFC fights give the model little to work with, so their predictions are less reliable.
- Whether a fighter is active comes from roster.watch. Fighters it does not know yet, such as new debuts, fall back to a guess (fought in the last two years, booked or ranked), with a short manual override list for known retirements.
- Hometowns come from ufc.com and not every fighter has one listed, so some profiles show only a country.
- Title reigns and belt changes are entered by hand, so a new champion can show up a little after the fight. The daily update warns when the official rankings and the hand-kept reigns disagree.
- The model has not been retrained since it was first built. Retraining honestly needs each fighter's stats as they were before every fight, and the data here only has their current career numbers, so it is not automated. The track record page is how I watch for the model drifting.

## Author

Made by Larissa Pavan ([GitHub](https://github.com/larissapavan)). If you find a data error or have an idea, open an [issue](https://github.com/larissapavan/fight-intelligence/issues).

This is a personal, non-commercial project I built to learn. It isn't connected to the UFC, Zuffa, TKO, any fighter or any employer, and UFC and related marks belong to their owners. Predictions are for fun and learning, not betting advice.
