from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, log_loss, roc_auc_score
from sklearn.pipeline import Pipeline

from .config import TARGET_COLUMN


@dataclass
class TrainResult:
    model: Pipeline
    metrics: dict
    train_rows: int
    test_rows: int


def temporal_train_test_split(
    df: pd.DataFrame,
    test_size: float = 0.2,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    cutoff = int(len(df) * (1 - test_size))
    train_df = df.iloc[:cutoff].copy()
    test_df = df.iloc[cutoff:].copy()
    return train_df, test_df


def train_model(
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
    feature_columns: list[str],
) -> TrainResult:
    X_train = train_df[feature_columns]
    y_train = train_df[TARGET_COLUMN]
    X_test = test_df[feature_columns]
    y_test = test_df[TARGET_COLUMN]

    model = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            (
                "classifier",
                HistGradientBoostingClassifier(
                    max_depth=6,
                    learning_rate=0.05,
                    max_iter=250,
                    random_state=42,
                ),
            ),
        ]
    )

    model.fit(X_train, y_train)
    probabilities = model.predict_proba(X_test)[:, 1]
    predictions = (probabilities >= 0.5).astype(int)

    metrics = {
        "accuracy": float(accuracy_score(y_test, predictions)),
        "roc_auc": float(roc_auc_score(y_test, probabilities)),
        "log_loss": float(log_loss(y_test, np.clip(probabilities, 1e-6, 1 - 1e-6))),
    }

    return TrainResult(
        model=model,
        metrics=metrics,
        train_rows=len(train_df),
        test_rows=len(test_df),
    )
