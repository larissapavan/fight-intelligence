# UFC Fight Intelligence
 
**Explore UFC fighters, matchups and title history with machine learning predictions you can actually understand.**
 
### 👉 [Try the live app: UFC Fight Intelligence](https://fight-intelligence.vercel.app/)
 
## What you can do
 
- **Predict a matchup:** pick any two fighters and get a win probability, plus a SHAP breakdown showing what drove it (reach, age, win rate, striking and grappling differences).
- **Compare category by category:** striking, grappling, physical attributes and the model's key factors, side by side.
- **Browse the fighters database:** records, divisions, physical and career stats, performance timelines and a KNN-based "similar fighters" search.
- **Head-to-Head:** direct fight history, or common opponents and degrees of separation when two fighters never met.
- **Champions & records:** the current champion of every division, greatest champions by time held, and the record book (most defenses, longest and shortest reigns, most times dethroned, multi-division champions).
- **Rankings & Events:** divisional and pound-for-pound rankings, the full event archive with results, and upcoming cards.
- **Data Intelligence / Model pages:** full transparency about the data pipeline, features and model.
- **Built for everyone:** responsive from 320px to ultrawide, dark and light themes, keyboard-accessible navigation.

## Tech stack
 
| Layer | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, React Router, Recharts, Framer Motion, Lucide icons, Axios |
| Backend | Python 3.12, FastAPI, Uvicorn, Pydantic, SlowAPI (rate limiting) |
| ML / data | scikit-learn (HistGradientBoosting, Random Forest, Logistic Regression), SHAP, Pandas, NumPy, Joblib |
| Data collection | Requests, BeautifulSoup scrapers, ESPN and UFC.com feeds |
| Testing | Pytest, HTTPX |
| Deploy | Vercel (frontend), Render (backend) |
 
## Data and model
 
Fighter, fight, event and ranking data come from public sources (UFC Stats, ESPN, UFC.com). Title history is compiled from published UFC title histories.
 
The classifier is trained on historical fights using differences between fighter attributes and recent form. Every prediction is explained with SHAP, so you can see *why* the model leans one way instead of just seeing a number.
 
**Limitations:** data may contain errors, delays or gaps, and the statistics shown are not official.
 
## Author
 
Built by **Larissa Pavan** · [GitHub](https://github.com/larissapavan)
 
Found a data error or have feedback? Open an [issue](https://github.com/larissapavan/fight-intelligence/issues).
 
## License and disclaimer
 
This is a personal, non-commercial portfolio project created for learning. It has no relationship with the UFC, Zuffa, TKO, any fighter, brand, organization or employer. UFC and related marks belong to their owners. Predictions are for educational purposes only and are **not** betting advice.
