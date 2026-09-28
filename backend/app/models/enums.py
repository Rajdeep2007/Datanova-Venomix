from __future__ import annotations

from enum import Enum


class SemanticType(str, Enum):
    currency = "currency"
    date = "date"
    zip_code = "zip_code"
    free_text = "free_text"
    categorical_low_card = "categorical_low_card"
    categorical_high_card = "categorical_high_card"
    id = "id"
    numeric_continuous = "numeric_continuous"
    boolean = "boolean"
    email = "email"
    phone = "phone"
    percentage = "percentage"


class RecommendedAction(str, Enum):
    impute_median = "impute_median"
    impute_mode = "impute_mode"
    drop_column = "drop_column"
    clip_outliers = "clip_outliers"
    log_transform = "log_transform"
    merge_categories = "merge_categories"
    none = "none"
