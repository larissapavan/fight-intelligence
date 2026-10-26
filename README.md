# Fight Intelligence

### Sports analytics, explainable AI fight predictions, and historical MMA archive.

[![Live Web Application](https://img.shields.io/badge/Live%20App-fight--intelligence.vercel.app-C8102E?style=for-the-badge&logo=vercel&logoColor=white)](https://fight-intelligence.vercel.app/)
[![Bilingual](https://img.shields.io/badge/Language-English%20%7C%20Portugu%C3%AAs-F2C230?style=for-the-badge)](https://fight-intelligence.vercel.app/)
[![Free & Open Access](https://img.shields.io/badge/Access-100%25%20Free%20%26%20No%20Ads-1F4E9C?style=for-the-badge)](https://fight-intelligence.vercel.app/)
[![CI](https://github.com/larissapavan/fight-intelligence/actions/workflows/ci.yml/badge.svg)](https://github.com/larissapavan/fight-intelligence/actions/workflows/ci.yml)
[![Daily data update](https://github.com/larissapavan/fight-intelligence/actions/workflows/update-data.yml/badge.svg)](https://github.com/larissapavan/fight-intelligence/actions/workflows/update-data.yml)

> **No more unexplained betting lines or baseless predictions.** Pick any two fighters, discover who has the statistical edge to win, and see exactly which metrics drive that probability.

**[👉 Launch Fight Intelligence in your browser](https://fight-intelligence.vercel.app/)**  
*(Works seamlessly on desktop and mobile. No account creation, no subscriptions, and instant loading).*

---

## 🌟 Why Fight Intelligence?

Most sports prediction tools provide a single, opaque percentage with no explanation. When a model indicates a 65% favorite, fight fans and analysts want to know *why*: is it reach advantage, takedown defense, striking volume, or recent control time?

**Fight Intelligence** was engineered to bring complete transparency to MMA analytics:

1. **Explainable AI (SHAP):**  
   Every matchup prediction opens the black box. An interactive factor breakdown reveals the exact weight of each technical metric—striking accuracy, takedown defense, finish frequency, reach difference, age differential, and control rate.
2. **Strict Mathematical Symmetry:**  
   Whether evaluating *Fighter A vs. Fighter B* or *Fighter B vs. Fighter A*, the prediction engine evaluates both corners with equal rigor. Outcomes remain strictly consistent regardless of input order.
3. **Publicly Audited Track Record:**  
   Picks are frozen and saved before the event starts. As official results finalize, predictions are settled automatically without hindsight bias or retroactive changes. Accuracy, Brier score, and log loss can be audited directly on the live site.
4. **Interactive Card Simulator:**  
   Compare personal fight instincts directly against the machine learning model across full cards. Build your card, analyze calculated parlay probabilities, and export summaries.
5. **Multi-Promotion Architecture (UFC, PFL, Bellator):**  
   Seamlessly toggle between the **UFC**, **Professional Fighters League (PFL)**, and the complete historical **Bellator MMA archive (2009–2023)**. Profiles cross-reference fighters who have competed across multiple leagues.
6. **Fully Bilingual (EN-US & PT-BR):**  
   Switch dynamically between English and Brazilian Portuguese with full localization of MMA terms (*Disputa de Cinturão*, *Nocaute Técnico*, *Decisão Unânime*, *Canto Vermelho/Azul*).

---

## ⚡ Try It Live

Test the AI model in action with one click:

- 🥊 **[Simulate: Islam Makhachev vs. Arman Tsarukyan](https://fight-intelligence.vercel.app/matchup-intelligence?a=Islam%20Makhachev&b=Arman%20Tsarukyan)**
- 🥊 **[Simulate: Jon Jones vs. Tom Aspinall](https://fight-intelligence.vercel.app/matchup-intelligence?a=Jon%20Jones&b=Tom%20Aspinall)**
- 🥊 **[Simulate: Alex Pereira vs. Magomed Ankalaev](https://fight-intelligence.vercel.app/matchup-intelligence?a=Alex%20Pereira&b=Magomed%20Ankalaev)**
- 📅 **[Explore Upcoming UFC Cards with AI Predictions](https://fight-intelligence.vercel.app/home)**
- 📈 **[Inspect the Public Track Record & Calibration](https://fight-intelligence.vercel.app/track-record)**
- 👑 **[Browse Divisional Champions & Historical Title Reigns](https://fight-intelligence.vercel.app/champions)**
- 📚 **[Explore the All-Time UFC Record Book](https://fight-intelligence.vercel.app/record-book)**

---

## 🛠️ Technology Stack & Architecture

Fight Intelligence is built as a decoupled, high-performance web platform combining machine learning, automated data pipelines, and a modern reactive frontend.

```
┌────────────────────────────────────────────────────────┐
│                   Data Ingestion                       │
│    ESPN MMA  •  UFCStats  •  UFC.com  •  FightHub      │
└──────────────────────────┬─────────────────────────────┘
                           │ Daily automated GitHub Actions
┌──────────────────────────▼─────────────────────────────┐
│                 Data Pipeline & ML                     │
│  • Pandas / NumPy feature engineering                  │
│  • HistGradientBoostingClassifier                      │
│  • TreeSHAP / KernelSHAP explainability                │
│  • Logistic calibration & symmetric corner-averaging   │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│                   FastAPI Backend                      │
│  • RESTful JSON endpoints (predictions, profiles, stats)│
│  • Memory-efficient caching & automated settlement     │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│               React 19 Frontend (Vite)                 │
│  • TypeScript, Tailwind CSS, Recharts, Framer Motion   │
│  • i18next runtime translation (EN-US / PT-BR)         │
│  • Deployed on Vercel Edge Network                     │
└────────────────────────────────────────────────────────┘
```

### Machine Learning Core
- **Algorithm:** `HistGradientBoostingClassifier` trained on thousands of professional UFC bouts.
- **Explainability:** SHAP values calculate the marginal contribution of each physical and statistical feature toward the predicted probability.
- **Symmetric Corner Evaluation:** Predictions are calculated bidirectionally $(A \to B$ and $B \to A)$ and averaged to ensure zero corner bias.
- **Calibration:** Sigmoid/logistic calibration aligns predicted output probabilities with true empirical win rates.

### Backend & API
- **Framework:** FastAPI with Python 3.12+ and Pydantic v2 schemas.
- **Pipelines:** Daily automated scripts scrape, clean, validate, and compute rolling fighter metrics (significant strike differential, control duration, takedown defense rate, win streaks, finishing rate, and Elo ratings).
- **Data Integrity:** Strict schema checks and regression test suites ensure historical records and belt statuses stay synchronized.

### Frontend Client
- **Framework:** React 19 with TypeScript and Vite.
- **Styling:** Modern sports dashboard design with Tailwind CSS, custom responsive typography, and full dark/light theme support.
- **Visualizations:** Interactive radar charts, career timelines, and factor contribution bars built with Recharts and Lucide Icons.
- **Internationalization:** Instant client-side switching between English and Portuguese via `i18next`.

---

## 📊 Features & Modules

### 1. Matchup Intelligence & Radar Comparisons
- Select any two fighters to preview win odds, physical tale-of-the-tape, striking volume, grappling statistics, and top decision factors.
- Generate direct shareable URLs for individual matchups with a one-click copy button.

### 2. Full Card Simulator (You vs. AI)
- Pick every bout on an upcoming card, test your intuition against the model, view agreement percentages, and compute multi-leg parlay odds.

### 3. Champions & Title History
- Visual badges distinguishing **Undisputed Championships** (gold), **Interim Belts** (blue), and the **BMF Title** (silver).
- Chronological timelines tracking belt defenses, days held, multi-division champions, and title vacancy histories.

### 4. Comprehensive Fighter Profiles (2,800+ Athletes)
- Interactive bout-by-bout career logs with victory methods, referee records, rounds, and judge scorecards.
- Annual win/finish trends, similar fighter clustering, nationality flags, and current Elo standings.

### 5. Gyms & Training Centers Directory
- Over 900 gyms cataloged worldwide, mapping fighters to their main training camps and highlighting gyms that have produced champions.

---

## 🚀 Running Locally

### Prerequisites
- **Python 3.11+**
- **Node.js 18+** and **npm**

### 1. Clone the repository
```bash
git clone https://github.com/larissapavan/fight-intelligence.git
cd fight-intelligence
```

### 2. Setup the Backend
```bash
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload --port 8000
```
The API documentation is available at `http://localhost:8000/docs`.

### 3. Setup the Frontend
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` to view the application.

### 4. Running the Test Suite
```bash
# Backend pytest suite (540+ tests):
pytest tests/backend tests/ml tests/scripts

# Frontend test & lint suite:
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
```

---

## ⚠️ Notes & Limitations

- **Statistical Model:** Predictions represent empirical win probabilities derived from historical statistics. In mixed martial arts, unexpected outcomes, flash knockouts, and split decisions occur regularly.
- **Intangible Factors:** The model evaluates recorded technical metrics (striking, grappling, physical attributes, recent form). It does not account for mid-camp injuries, weight-cutting complications, or late-notice replacements with limited data.
- **Public Data Sources:** Data is aggregated from public fight records and news feeds. Official statistics are managed by respective promotional bodies.
- **Educational & Analytical Purpose:** Fight Intelligence is an independent, non-commercial research project intended for sports analysis and data science exploration. It is not financial or betting advice.

---

## 📚 Data Sources & Acknowledgments

We thank the platforms and communities providing accessible public MMA data:
- **[ESPN MMA](https://www.espn.com/mma/)**: Fight schedules, per-round metrics, and fighter imagery.
- **[UFC Stats](http://ufcstats.com/)**: Historical UFC fight statistics, scorecards, and bout details.
- **[UFC Official (ufc.com)](https://www.ufc.com/)**: Official divisional and pound-for-pound rankings.
- **[UFC Stats Leaders](https://statleaders.ufc.com/)**: Historical records for the UFC Record Book.
- **[PFL MMA](https://pflmma.com/)**: Event rosters, tournament brackets, and standings.
- **[FightHub](https://fighthub-app.com/)**: Gym rosters and fighter camp affiliations.
