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
    page_title="Previsão UFC",
    page_icon="🥊",
    layout="wide",
)

st.markdown("""
<style>
    .red-card  { background:#1a0000; border:1px solid #c0392b; border-radius:10px; padding:16px; }
    .blue-card { background:#00001a; border:1px solid #2980b9; border-radius:10px; padding:16px; }
    .vs-badge  { font-size:2rem; font-weight:900; color:#f0b429; text-align:center; padding-top:28px; }
    .result-box { border-radius:12px; padding:24px; text-align:center; margin-top:16px; }
    .winner-red  { background:linear-gradient(135deg,#7b0000,#c0392b); }
    .winner-blue { background:linear-gradient(135deg,#00007b,#2980b9); }
    [data-testid="metric-container"] { background:#1a1a2e; border-radius:8px; padding:10px; }
</style>
""", unsafe_allow_html=True)


# ── Carregamento de artefatos ────────────────────────────────────────────────

@st.cache_resource(show_spinner="Carregando modelo…")
def load_artifacts():
    if not MODEL_PATH.exists():
        with st.spinner("Treinando modelo pela primeira vez, aguarde…"):
            train_pipeline()

    if not MODEL_PATH.exists():
        return None, None, None

    bundle     = joblib.load(MODEL_PATH)
    test_frame = (
        pd.read_csv(PROCESSED_DATA_PATH, parse_dates=["fight_date"])
        if PROCESSED_DATA_PATH.exists()
        else None
    )
    report = REPORT_PATH.read_text(encoding="utf-8") if REPORT_PATH.exists() else ""
    return bundle, test_frame, report


bundle, processed_df, report_text = load_artifacts()

# ── Header ───────────────────────────────────────────────────────────────────

st.title("🥊 Previsão de Vencedores do UFC")
st.caption("Modelo treinado com atributos pré-luta · Engenharia de features · Split temporal")

if bundle is None:
    st.error(
        "Não foi possível gerar o modelo automaticamente. "
        "Execute `python -m src.ufc_predictor.train` no terminal."
    )
    st.stop()

model           = bundle["model"]
feature_columns = bundle["feature_columns"]
metrics         = bundle["metrics"]

# ── Métricas do modelo ────────────────────────────────────────────────────────

c1, c2, c3, c4 = st.columns(4)
c1.metric("🎯 Acurácia", f"{metrics['accuracy']:.1%}")
c2.metric("📈 ROC AUC",  f"{metrics['roc_auc']:.3f}")
c3.metric("📉 Log Loss", f"{metrics['log_loss']:.3f}")
c4.metric("⚙️ Features", len(feature_columns))

st.divider()

# ── Tabs ─────────────────────────────────────────────────────────────────────

tab1, tab2, tab3 = st.tabs(["🥊 Nova Previsão", "📊 Base Processada", "📋 Relatório"])

# ── Tab 1: Previsão ───────────────────────────────────────────────────────────

with tab1:
    st.subheader("Simular uma luta")

    col_red, col_vs, col_blue = st.columns([5, 1, 5])

    with col_red:
        st.markdown('<div class="red-card">', unsafe_allow_html=True)
        st.markdown("### 🔴 Canto Vermelho")
        fighter_red      = st.text_input("Nome", "Fighter Red",  key="name_red")
        red_age          = st.number_input("Idade",          18, 50, 29,  key="age_r")
        red_height_cm    = st.number_input("Altura (cm)",   150, 220, 180, key="ht_r")
        red_reach_cm     = st.number_input("Envergadura (cm)", 150, 240, 185, key="rc_r")
        red_wins         = st.number_input("Vitórias",        0, 60, 12,  key="w_r")
        red_losses       = st.number_input("Derrotas",        0, 40,  3,  key="l_r")
        red_sig_str_acc  = st.slider("Precisão de golpes",  0.0, 1.0, 0.48, 0.01, key="sig_r")
        red_takedown_acc = st.slider("Precisão de quedas",  0.0, 1.0, 0.35, 0.01, key="td_r")
        red_stance       = st.selectbox("Estilo de guarda",
                             ["Orthodox", "Southpaw", "Switch", "Open Stance"], key="st_r")
        st.markdown('</div>', unsafe_allow_html=True)

    with col_vs:
        st.markdown('<div class="vs-badge">VS</div>', unsafe_allow_html=True)

    with col_blue:
        st.markdown('<div class="blue-card">', unsafe_allow_html=True)
        st.markdown("### 🔵 Canto Azul")
        fighter_blue      = st.text_input("Nome", "Fighter Blue", key="name_blue")
        blue_age          = st.number_input("Idade",          18, 50, 28,  key="age_b")
        blue_height_cm    = st.number_input("Altura (cm)",   150, 220, 178, key="ht_b")
        blue_reach_cm     = st.number_input("Envergadura (cm)", 150, 240, 182, key="rc_b")
        blue_wins         = st.number_input("Vitórias",        0, 60, 10,  key="w_b")
        blue_losses       = st.number_input("Derrotas",        0, 40,  4,  key="l_b")
        blue_sig_str_acc  = st.slider("Precisão de golpes",  0.0, 1.0, 0.45, 0.01, key="sig_b")
        blue_takedown_acc = st.slider("Precisão de quedas",  0.0, 1.0, 0.31, 0.01, key="td_b")
        blue_stance       = st.selectbox("Estilo de guarda",
                              ["Orthodox", "Southpaw", "Switch", "Open Stance"], key="st_b")
        st.markdown('</div>', unsafe_allow_html=True)

    st.markdown("")
    predict_btn = st.button("⚡ Prever Vencedor", type="primary", use_container_width=True)

    if predict_btn:
        if fighter_red.strip() == fighter_blue.strip():
            st.warning("Os dois lutadores têm o mesmo nome. Confira antes de prever.")
        else:
            with st.spinner("Calculando…"):
                inference_df = build_inference_frame(
                    fight_date=pd.Timestamp.today().normalize(),
                    fighter_red=fighter_red,
                    fighter_blue=fighter_blue,
                    red_age=red_age, blue_age=blue_age,
                    red_height_cm=red_height_cm, blue_height_cm=blue_height_cm,
                    red_reach_cm=red_reach_cm, blue_reach_cm=blue_reach_cm,
                    red_wins=red_wins, blue_wins=blue_wins,
                    red_losses=red_losses, blue_losses=blue_losses,
                    red_sig_str_acc=red_sig_str_acc, blue_sig_str_acc=blue_sig_str_acc,
                    red_takedown_acc=red_takedown_acc, blue_takedown_acc=blue_takedown_acc,
                    red_stance=red_stance, blue_stance=blue_stance,
                )
                X = align_feature_columns(inference_df, feature_columns)
                red_prob       = float(model.predict_proba(X)[0, 1])
                blue_prob      = 1.0 - red_prob
                red_wins_flag  = red_prob >= 0.5
                winner         = fighter_red if red_wins_flag else fighter_blue
                win_prob       = red_prob if red_wins_flag else blue_prob
                css_class      = "winner-red" if red_wins_flag else "winner-blue"
                emoji          = "🔴" if red_wins_flag else "🔵"

            st.markdown(
                f'<div class="result-box {css_class}">'
                f'<h2>{emoji} Vencedor previsto: {winner}</h2>'
                f'<p style="font-size:1.2rem">Confiança: <strong>{win_prob:.1%}</strong></p>'
                f'</div>',
                unsafe_allow_html=True,
            )
            st.markdown("")

            # Barra comparativa de probabilidade
            red_w  = max(int(red_prob  * 100), 1)
            blue_w = max(int(blue_prob * 100), 1)
            bar1, bar2 = st.columns([red_w, blue_w])
            with bar1:
                st.markdown(
                    f"<div style='background:#c0392b;border-radius:6px 0 0 6px;"
                    f"padding:8px;text-align:center;color:white;font-weight:bold'>"
                    f"🔴 {red_prob:.1%}</div>",
                    unsafe_allow_html=True,
                )
            with bar2:
                st.markdown(
                    f"<div style='background:#2980b9;border-radius:0 6px 6px 0;"
                    f"padding:8px;text-align:center;color:white;font-weight:bold'>"
                    f"🔵 {blue_prob:.1%}</div>",
                    unsafe_allow_html=True,
                )

            # Tabela de vantagens
            with st.expander("🔍 Vantagens por atributo"):
                attrs = {
                    "Idade":            (red_age,          blue_age,          False),
                    "Altura (cm)":      (red_height_cm,    blue_height_cm,    True),
                    "Envergadura (cm)": (red_reach_cm,     blue_reach_cm,     True),
                    "Vitórias":         (red_wins,         blue_wins,         True),
                    "Derrotas":         (red_losses,       blue_losses,       False),
                    "Precisão golpes":  (red_sig_str_acc,  blue_sig_str_acc,  True),
                    "Precisão quedas":  (red_takedown_acc, blue_takedown_acc, True),
                }
                rows = []
                for label, (rv, bv, higher_is_better) in attrs.items():
                    diff = rv - bv
                    if diff == 0:
                        adv = "—"
                    elif (diff > 0) == higher_is_better:
                        adv = "🔴"
                    else:
                        adv = "🔵"
                    rows.append({
                        "Atributo":    label,
                        "🔴 Vermelho": rv,
                        "🔵 Azul":     bv,
                        "Diferença":   f"{diff:+.3g}",
                        "Vantagem":    adv,
                    })
                st.dataframe(
                    pd.DataFrame(rows).set_index("Atributo"),
                    use_container_width=True,
                )

# ── Tab 2: Base ───────────────────────────────────────────────────────────────

with tab2:
    st.subheader("Base processada")
    if processed_df is None:
        st.info("Nenhuma base processada encontrada.")
    else:
        total   = len(processed_df)
        red_pct = processed_df[TARGET_COLUMN].mean() if TARGET_COLUMN in processed_df.columns else None

        m1, m2, m3 = st.columns(3)
        m1.metric("Total de lutas", f"{total:,}")
        if red_pct is not None:
            m2.metric("Vitórias vermelho", f"{red_pct:.1%}")
            m3.metric("Vitórias azul",     f"{1 - red_pct:.1%}")

        st.dataframe(processed_df.head(50), use_container_width=True)

        if TARGET_COLUMN in processed_df.columns:
            st.markdown("**Distribuição de resultados**")
            outcome_counts = (
                processed_df[TARGET_COLUMN]
                .value_counts()
                .rename(index={0: "Azul vence", 1: "Vermelho vence"})
            )
            st.bar_chart(outcome_counts)

# ── Tab 3: Relatório ──────────────────────────────────────────────────────────

with tab3:
    st.subheader("Relatório de treinamento")
    if report_text:
        st.code(report_text, language="text")
        st.download_button(
            "⬇️ Baixar relatório",
            data=report_text,
            file_name="training_report.txt",
            mime="text/plain",
        )
    else:
        st.info("Relatório ainda não disponível.")
