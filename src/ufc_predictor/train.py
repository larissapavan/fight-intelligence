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
    shap_background = train_df[feature_columns].sample(min(80, len(train_df)), random_state=42)

    modeling_df.to_csv(PROCESSED_DATA_PATH, index=False)
    joblib.dump(
        {
            "model": result.model,
            "feature_columns": feature_columns,
            "metrics": result.metrics,
            "baseline_metrics": result.baseline_metrics,
            "shap_background": shap_background,
        },
        MODEL_PATH,
    )

    baseline_lines = []
    for baseline_name, baseline_metrics in result.baseline_metrics.items():
        label = baseline_name.replace("_", " ").title()
        baseline_lines.extend(
            [
                f"{label} accuracy: {baseline_metrics['accuracy']:.4f}",
                f"{label} ROC AUC: {baseline_metrics['roc_auc']:.4f}",
                f"{label} log loss: {baseline_metrics['log_loss']:.4f}",
            ]
        )

    report = "\n".join(
        [
            "Training report - UFC prediction",
            "Selected model: HistGradientBoostingClassifier",
            f"Total rows: {len(modeling_df)}",
            f"Training rows: {result.train_rows}",
            f"Test rows: {result.test_rows}",
            f"Accuracy: {result.metrics['accuracy']:.4f}",
            f"ROC AUC: {result.metrics['roc_auc']:.4f}",
            f"Log loss: {result.metrics['log_loss']:.4f}",
            "",
            "Baseline comparison",
            *baseline_lines,
        ]
    )
    REPORT_PATH.write_text(report, encoding="utf-8")
    print(report)


if __name__ == "__main__":
    main()
