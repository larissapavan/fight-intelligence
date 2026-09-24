<<<<<<< HEAD
# 🥊 Previsão de Vencedores do UFC com Machine Learning

Projeto de machine learning para prever vencedores de lutas do UFC utilizando atributos pré-luta dos atletas, engenharia de features, divisão temporal dos dados e uma aplicação interativa com Streamlit.

<p align="center">
  <img src="https://media.giphy.com/media/0LadR6PhPoiFukYAlb/giphy.gif" width="700"/>
</p>

## 📌 Visão Geral

Pipeline completo de ML para prever o resultado de lutas do UFC com base em dados estruturados dos lutadores disponíveis antes de cada confronto.

Foco em:
- Avaliação realista com split temporal
- Engenharia de features baseada em diferenças entre lutadores
- Reprodutibilidade e interpretabilidade do modelo
- Exploração interativa via Streamlit

## 🚀 Funcionalidades

- Modelo de classificação supervisionado para prever o vencedor
- Split temporal treino/teste para evitar vazamento de dados
- Engenharia de features com comparações entre lutadores
- Avaliação com métricas padrão de ML (Acurácia, ROC AUC, Log Loss)
- Interface interativa para previsões com Streamlit

## 📁 Estrutura do Projeto

```text
.
|-- app.py
|-- requirements.txt
|-- README.md
|-- data
|   |-- raw
|   `-- processed
|-- models
|-- reports
`-- src
    `-- ufc_predictor
        |-- __init__.py
        |-- config.py
        |-- data.py
        |-- features.py
        |-- modeling.py
        `-- train.py
```

## 📊 Formato dos Dados

O pipeline espera um CSV em `data/raw/ufc_fights.csv` com pelo menos estas colunas:

- `fight_date`
- `fighter_red`
- `fighter_blue`
- `winner`
- `red_age`, `blue_age`
- `red_height_cm`, `blue_height_cm`
- `red_reach_cm`, `blue_reach_cm`
- `red_wins`, `blue_wins`
- `red_losses`, `blue_losses`
- `red_sig_str_acc`, `blue_sig_str_acc`
- `red_takedown_acc`, `blue_takedown_acc`
- `red_stance`, `blue_stance`

Se esse arquivo não existir, o projeto gera uma base sintética para demonstração.

## ⚙️ Como Rodar

1. Instale as dependências:

```bash
pip install -r requirements.txt
```

2. Treine o modelo:

```bash
python -m src.ufc_predictor.train
```

3. Inicie a aplicação:

```bash
streamlit run app.py
```

## 🚢 Publicação

### GitHub

```bash
git add .
git commit -m "Projeto inicial de previsão UFC"
git branch -M main
git remote add origin <URL_DO_REPOSITORIO>
git push -u origin main
```

### Streamlit Community Cloud

1. Publique o código no GitHub.
2. Acesse o [Streamlit Community Cloud](https://streamlit.io/cloud).
3. Escolha o repositório e selecione `app.py` como arquivo principal.
4. O app cria os artefatos automaticamente se `models/` ainda não existir.

Isso permite manter o repositório mais limpo, sem precisar versionar modelo treinado e arquivos processados.

## 🔧 Pipeline de ML

1. Carregamento dos dados e normalização básica
2. Ordenação temporal por `fight_date`
3. Engenharia de features: diferenças, razões e codificação de stance
4. Split temporal em treino e teste
5. Treinamento com `HistGradientBoostingClassifier`
6. Geração de métricas, artefatos do modelo e relatório

## 🖥️ Interface

A aplicação Streamlit conta com três abas:

- **Nova Previsão** — preencha os atributos dos dois lutadores e veja o vencedor previsto com probabilidade, barra comparativa e tabela de vantagens por atributo.
- **Base Processada** — visualize as primeiras linhas do dataset e a distribuição de resultados.
- **Relatório** — métricas de treinamento com opção de download.

## ⚠️ Observações

- O alvo é binário: `1` quando o lutador do canto vermelho vence, `0` quando o azul vence.
- O split temporal simula melhor o cenário real de previsão e evita vazamento de dados futuros.
- Para produção ou TCC, vale enriquecer os dados com estatísticas históricas acumuladas por lutador.

## 🔮 Melhorias Futuras

- Tuning de hiperparâmetros
- Engenharia de features avançada (histórico acumulado por lutador)
- Modelos adicionais (LightGBM, Redes Neurais)
- Integração com API para dados em tempo real
- Deploy em nuvem (AWS / GCP)
=======
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
>>>>>>> bdb4474626da9e3848bca11d5d21a07c9ddfa99b
