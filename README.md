# Fight Intelligence

A full stack UFC analytics platform: real fighter data, a machine learning model that predicts fight outcomes with explainability, and a live dashboard built around what's actually happening in the UFC right now — not a static demo.

## [→ Try it live](https://fight-intelligence.vercel.app)

Open the link and start exploring, every number on the site is real.

---

## What's inside

**Home dashboard**: The next real UFC event, its main event fighters, a live model prediction for that fight, current win/loss momentum, and the pound-for-pound top 3, all pulled fresh from the same data the model predicts from. Every other fight on the card is one click away from its own full breakdown.

**Predictor**: Pick any two of 4,500+ fighters and get a win probability with a full SHAP explanation of what drove the model's read: Reach, age, win rate, striking and grappling deltas, ranked by actual contribution.

**Matchup Intelligence**: A category-by-category breakdown of *why* a matchup is interesting: striking (accuracy, significant strikes/min, defense), grappling (takedown accuracy/defense, submission attempts), physical attributes, and the model's key factors side by side.

**Fighters database**: Every fighter's real record, division, physical stats, striking/grappling numbers, and a full performance history: career timeline (win/loss by year), win rate and finish rate trends, round-by-round distribution, and a similarity search (KNN over physical and performance stats) that surfaces genuinely comparable fighters, not random suggestions.

**Head-to-Head**: Direct fight history between any two fighters, and when they've never actually fought, a real network analysis of common opponents and degrees of separation through the "who fought whom" graph.

**Rankings & Events**: Official UFC divisional and pound-for-pound rankings, plus the full event archive (numbered PPVs and Fight Nights) with every result, searchable and filterable.

**Champions & Records**: Every UFC title reign in history: current champions per division, the greatest champions ranked by time held, and the record book itself, most title defenses, longest and shortest reigns, most times dethroned, and multi-division champions.

**Data Intelligence**: A transparent look at the pipeline itself: where the data comes from, how it's cleaned and engineered into features, and live counts of exactly how many fighters, events, and fights are tracked.

## Real data, not a mock

Every fighter, fight, event, and ranking is scraped from ufcstats.com and ufc.com, there are no placeholder records or synthetic stats anywhere in the app. The prediction model is a real trained classifier (not a random number), explained live with SHAP on every request. Predictions are estimates for portfolio/educational purposes and should never be used for betting decisions.

## Built with

React · TypeScript · Vite · Tailwind CSS · FastAPI · scikit-learn · SHAP · Pandas — deployed on Vercel (frontend) and Render (backend).

---

**[→ fight-intelligence.vercel.app](https://fight-intelligence.vercel.app)**
