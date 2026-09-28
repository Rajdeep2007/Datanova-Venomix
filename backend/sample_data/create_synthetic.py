"""Generate a synthetic messy CSV covering all 11 semantic types so that
generate_weak_labels.py has material to label.

Columns deliberately span: currency, zip_code, id, free_text,
categorical_low_card, categorical_high_card, numeric_continuous, date,
email, phone, percentage.

Run this once to bootstrap sample_data/:
    python backend/sample_data/create_synthetic.py
"""

import random
import string
import pandas as pd
import numpy as np
from pathlib import Path

random.seed(42)
np.random.seed(42)

N = 200  # rows


def _rand_str(k=8):
    return "".join(random.choices(string.ascii_lowercase, k=k))


# ── id column ──
customer_id = [f"CUST-{i:05d}" for i in range(1, N + 1)]

# ── numeric_continuous ──
annual_income = np.round(np.random.lognormal(mean=10.8, sigma=0.5, size=N), 2)
age = np.random.randint(18, 85, size=N).astype(float)
# sprinkle some NaNs
age[np.random.choice(N, 12, replace=False)] = np.nan

# ── currency ──
price_tags = [f"${np.random.uniform(5, 500):.2f}" for _ in range(N)]

# ── date ──
dates = pd.date_range("2020-01-01", periods=N, freq="D").strftime("%m/%d/%Y").tolist()
random.shuffle(dates)

# ── zip_code ──
zips = [f"{random.randint(10000, 99999)}" for _ in range(N)]
# mix in some 5+4 format
for i in random.sample(range(N), 30):
    zips[i] = f"{zips[i]}-{random.randint(1000, 9999)}"

# ── categorical_low_card ──
status = np.random.choice(["Active", "Inactive", "Pending", "Churned"], size=N)

# ── categorical_high_card ──
city = [random.choice([
    "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia",
    "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Jacksonville",
    "Fort Worth", "Columbus", "Charlotte", "Indianapolis", "San Francisco",
    "Seattle", "Denver", "Washington", "Nashville", "Oklahoma City", "El Paso",
    "Boston", "Portland", "Memphis", "Louisville", "Baltimore", "Milwaukee",
    "Albuquerque", "Tucson", "Fresno", "Sacramento", "Kansas City", "Mesa",
    "Atlanta", "Omaha", "Colorado Springs", "Raleigh", "Long Beach", "Virginia Beach",
]) for _ in range(N)]

# ── free_text ──
reviews = [
    random.choice([
        "The product was great, would recommend!",
        "Terrible experience, never buying again.",
        "Average quality, nothing special.",
        "Absolutely love this, 5 stars!",
        "Not worth the price honestly.",
        "Decent but could be better.",
        "Outstanding customer service.",
        "Arrived damaged, very disappointed.",
        "Good value for the money.",
        "Below expectations, returning it.",
    ]) for _ in range(N)
]

# ── email ──
emails = [f"{_rand_str(6)}@{random.choice(['gmail.com', 'yahoo.com', 'outlook.com', 'company.io'])}" for _ in range(N)]

# ── phone ──
phones = [f"+1-{random.randint(200,999)}-{random.randint(100,999)}-{random.randint(1000,9999)}" for _ in range(N)]

# ── percentage ──
completion_pct = [f"{np.random.uniform(0, 100):.1f}%" for _ in range(N)]

# ── boolean (mapped as 0/1 to test label-encoded detection) ──
is_subscribed = np.random.choice([0, 1], size=N)

# ── Another numeric_continuous (to have more variety) ──
transaction_amount = np.round(np.random.exponential(scale=120, size=N), 2)

df = pd.DataFrame({
    "customer_id": customer_id,
    "annual_income": annual_income,
    "age": age,
    "price": price_tags,
    "signup_date": dates,
    "zip_code": zips,
    "status": status,
    "city": city,
    "review_text": reviews,
    "email_address": emails,
    "phone_number": phones,
    "completion_pct": completion_pct,
    "is_subscribed": is_subscribed,
    "transaction_amount": transaction_amount,
})

out_dir = Path(__file__).resolve().parent
out_dir.mkdir(parents=True, exist_ok=True)
out_path = out_dir / "sample_messy_data.csv"
df.to_csv(out_path, index=False)
print(f"Wrote {len(df)} rows × {len(df.columns)} cols → {out_path}")
