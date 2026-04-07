from __future__ import annotations

import joblib

from .config import MODEL_PATH, PROCESSED_DATA_PATH, REPORT_PATH, TARGET_COLUMN, ensure_directories
from .data import load_or_create_dataset
from .features import build_features, get_feature_columns
from .modeling import temporal_train_test_split, train_model


def main() -> None:
    ensure_directories()

    dataset = load_or_create_dataset()
    modeling_df = build_features(dataset.modeling)
    feature_columns = [column for column in get_feature_columns(modeling_df) if column != TARGET_COLUMN]

    train_df, test_df = temporal_train_test_split(modeling_df, test_size=0.2)
    result = train_model(train_df=train_df, test_df=test_df, feature_columns=feature_columns)

    modeling_df.to_csv(PROCESSED_DATA_PATH, index=False)
    joblib.dump(
        {
            "model": result.model,
            "feature_columns": feature_columns,
            "metrics": result.metrics,
        },
        MODEL_PATH,
    )

    report = "\n".join(
        [
            "Relatorio de treinamento - Previsao UFC",
            f"Total de linhas: {len(modeling_df)}",
            f"Linhas treino: {result.train_rows}",
            f"Linhas teste: {result.test_rows}",
            f"Acuracia: {result.metrics['accuracy']:.4f}",
            f"ROC AUC: {result.metrics['roc_auc']:.4f}",
            f"Log loss: {result.metrics['log_loss']:.4f}",
        ]
    )
    REPORT_PATH.write_text(report, encoding="utf-8")
    print(report)


if __name__ == "__main__":
    main()
