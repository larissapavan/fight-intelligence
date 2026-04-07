# 🥊 UFC Predictor

Machine Learning project to predict UFC fight winners using pre-fight fighter attributes, feature engineering, temporal data splitting, and an interactive Streamlit application.

## 📌 Overview

This project builds a complete ML pipeline to predict the outcome of UFC fights based on structured fighter data available before each match.

It focuses on:

Realistic evaluation using temporal splits
Feature engineering based on fighter differences
Model interpretability and reproducibility
Interactive exploration through a Streamlit app

## 🚀 Features
- Supervised classification model for fight outcome prediction
- Temporal train/test split to prevent data leakage
- Feature engineering with fighter comparisons
- Model evaluation with standard ML metrics
- Interactive UI for predictions using Streamlit

# 📁 Project Structure

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

## 📊 Data Format

Expected dataset location: `data/raw/ufc_fights.csv` 

Required columns:

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

If the dataset is not found, the project automatically generates a synthetic dataset for demonstration purposes.

## Installation

1. 

pip install -r requirements.txt

2.  Training

python -m src.ufc_predictor.train

3. Running the App

streamlit run app.py


## Deployment

### GitHub

```bash
git add .
git commit -m "UFC Predictor"
git branch -M main
git remote add origin <URL_DO_REPOSITORIO>
git push -u origin main
```

### Streamlit Community Cloud

Push your project to GitHub
Go to Streamlit Community Cloud
Connect your repository
Select app.py as the entry point

The app automatically generates model artifacts if models/ does not exist.

## ML Pipeline

1. Data loading and preprocessing
2. Temporal sorting (fight_date)
3. Feature engineering
- Fighter differences
- Ratios and derived stats
- Stance encoding
4. Temporal train/test split
5. Model training (HistGradientBoostingClassifier)
6. Evaluation and reporting
7 Model persistence

## Model Details

- Problem type: Binary Classification
- Target:
1 → Red corner wins
0 → Blue corner wins

## ⚠️ Notes

- Temporal splitting is used to simulate real-world prediction scenarios
- Prevents data leakage from future fights
- Designed to be easily extensible

## 🔮 Future Improvements

- Hyperparameter tuning
- Advanced feature engineering (fighter history aggregation)
- Additional models (LightGBM, Neural Networks)
- API integration for real-time data
- Cloud deployment (AWS / GCP)

  ## 🎥 Demo

<p align="center">
  <img src="[https://link-do-gif.gif](https://media.giphy.com/media/0LadR6PhPoiFukYAlb/giphy.gif)" width="700"/>
</p>
