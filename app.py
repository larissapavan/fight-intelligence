from pathlib import Path

import joblib
import pandas as pd
import streamlit as st

from src.ufc_predictor.config import (
    MODEL_PATH,
    PROCESSED_DATA_PATH,
    REPORT_PATH,
    TARGET_COLUMN,
)
from src.ufc_predictor.features import align_feature_columns, build_inference_frame
from src.ufc_predictor.train import main as train_pipeline


st.set_page_config(
    page_title="Previsao UFC",
    page_icon="🥊",
    layout="wide",
)


def load_artifacts():
    if not MODEL_PATH.exists():
        train_pipeline()

    if not MODEL_PATH.exists():
        return None, None, None

    bundle = joblib.load(MODEL_PATH)
    test_frame = (
        pd.read_csv(PROCESSED_DATA_PATH, parse_dates=["fight_date"])
        if PROCESSED_DATA_PATH.exists()
        else None
    )
    report = REPORT_PATH.read_text(encoding="utf-8") if REPORT_PATH.exists() else ""
    return bundle, test_frame, report


bundle, processed_df, report_text = load_artifacts()

st.title("Previsao de vencedores do UFC")
st.caption("Modelo com atributos pre-luta, engenharia de features e split temporal.")

if bundle is None:
    st.warning(
        "Nao foi possivel gerar o modelo automaticamente. Execute `python -m src.ufc_predictor.train`."
    )
    st.stop()

model = bundle["model"]
feature_columns = bundle["feature_columns"]
metrics = bundle["metrics"]

col1, col2, col3 = st.columns(3)
col1.metric("Acuracia teste", f"{metrics['accuracy']:.3f}")
col2.metric("ROC AUC teste", f"{metrics['roc_auc']:.3f}")
col3.metric("Log loss teste", f"{metrics['log_loss']:.3f}")

tab1, tab2, tab3 = st.tabs(["Nova previsao", "Base processada", "Relatorio"])

with tab1:
    st.subheader("Simular uma luta")
    input_col1, input_col2 = st.columns(2)

    with input_col1:
        fighter_red = st.text_input("Lutador vermelho", "Fighter Red")
        red_age = st.number_input("Idade vermelho", 18, 50, 29)
        red_height_cm = st.number_input("Altura vermelho (cm)", 150, 220, 180)
        red_reach_cm = st.number_input("Envergadura vermelho (cm)", 150, 240, 185)
        red_wins = st.number_input("Vitorias vermelho", 0, 60, 12)
        red_losses = st.number_input("Derrotas vermelho", 0, 40, 3)
        red_sig_str_acc = st.slider("Precisao golpes vermelho", 0.0, 1.0, 0.48, 0.01)
        red_takedown_acc = st.slider("Precisao quedas vermelho", 0.0, 1.0, 0.35, 0.01)
        red_stance = st.selectbox("Base vermelho", ["Orthodox", "Southpaw", "Switch", "Open Stance"])

    with input_col2:
        fighter_blue = st.text_input("Lutador azul", "Fighter Blue")
        blue_age = st.number_input("Idade azul", 18, 50, 28)
        blue_height_cm = st.number_input("Altura azul (cm)", 150, 220, 178)
        blue_reach_cm = st.number_input("Envergadura azul (cm)", 150, 240, 182)
        blue_wins = st.number_input("Vitorias azul", 0, 60, 10)
        blue_losses = st.number_input("Derrotas azul", 0, 40, 4)
        blue_sig_str_acc = st.slider("Precisao golpes azul", 0.0, 1.0, 0.45, 0.01)
        blue_takedown_acc = st.slider("Precisao quedas azul", 0.0, 1.0, 0.31, 0.01)
        blue_stance = st.selectbox("Base azul", ["Orthodox", "Southpaw", "Switch", "Open Stance"])

    if st.button("Prever vencedor", type="primary"):
        inference_df = build_inference_frame(
            fight_date=pd.Timestamp.today().normalize(),
            fighter_red=fighter_red,
            fighter_blue=fighter_blue,
            red_age=red_age,
            blue_age=blue_age,
            red_height_cm=red_height_cm,
            blue_height_cm=blue_height_cm,
            red_reach_cm=red_reach_cm,
            blue_reach_cm=blue_reach_cm,
            red_wins=red_wins,
            blue_wins=blue_wins,
            red_losses=red_losses,
            blue_losses=blue_losses,
            red_sig_str_acc=red_sig_str_acc,
            blue_sig_str_acc=blue_sig_str_acc,
            red_takedown_acc=red_takedown_acc,
            blue_takedown_acc=blue_takedown_acc,
            red_stance=red_stance,
            blue_stance=blue_stance,
        )

        X = align_feature_columns(inference_df, feature_columns)
        red_win_probability = model.predict_proba(X)[0, 1]
        predicted_winner = fighter_red if red_win_probability >= 0.5 else fighter_blue

        st.success(f"Vencedor previsto: {predicted_winner}")
        st.write(f"Probabilidade de vitoria do vermelho: **{red_win_probability:.2%}**")
        st.progress(float(red_win_probability))

with tab2:
    st.subheader("Base processada")
    if processed_df is None:
        st.info("Nenhuma base processada encontrada.")
    else:
        st.dataframe(processed_df.head(50), use_container_width=True)
        if TARGET_COLUMN in processed_df.columns:
            outcome_counts = processed_df[TARGET_COLUMN].value_counts().rename(
                index={0: "Azul vence", 1: "Vermelho vence"}
            )
            st.bar_chart(outcome_counts)

with tab3:
    st.subheader("Relatorio de treinamento")
    if report_text:
        st.code(report_text)
    else:
        st.info("Relatorio ainda nao disponivel.")
