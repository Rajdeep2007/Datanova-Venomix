"""Generate diverse synthetic CSVs for semantic column-type classifier training.

Produces 10 domain-specific CSVs, each containing columns that unambiguously
map to one of the 11 target semantic types:
    currency, zip_code, id, free_text, categorical_low_card,
    categorical_high_card, numeric_continuous, date, email, phone, percentage

Also writes a ground-truth label file (synthetic_labels.csv) mapping every
(csv_filename, column_name) pair to its true semantic_type.

Usage:
    cd backend
    .venv\\Scripts\\python scripts\\generate_synthetic_csvs.py

Everything is local -- no API calls. Uses numpy + pandas + stdlib only.
"""

from __future__ import annotations

import random
import string
from pathlib import Path

import numpy as np
import pandas as pd

SEED = 42
random.seed(SEED)
np.random.seed(SEED)

OUT_DIR = Path(__file__).resolve().parent.parent / "sample_data" / "synthetic"
LABELS_PATH = Path(__file__).resolve().parent / "synthetic_labels.csv"


# =========================================================================
# Helper generators
# =========================================================================

def _rand_str(k=8):
    return "".join(random.choices(string.ascii_lowercase, k=k))


def _gen_id(prefix: str, n: int) -> list[str]:
    return [f"{prefix}-{i:05d}" for i in range(1, n + 1)]


def _gen_currency_dollar(n: int, with_symbol_pct: float = 0.8) -> list:
    """Generate dollar amounts; some formatted with $, some raw floats."""
    vals = np.round(np.random.lognormal(mean=4.5, sigma=1.2, size=n), 2)
    out = []
    for v in vals:
        if random.random() < with_symbol_pct:
            if random.random() < 0.3:
                out.append(f"${v:,.2f}")  # with comma
            else:
                out.append(f"${v:.2f}")
        else:
            out.append(v)  # raw float
    return out


def _gen_zip(n: int) -> list[str]:
    zips = []
    for _ in range(n):
        z = f"{random.randint(10000, 99999)}"
        if random.random() < 0.15:
            z = f"{z}-{random.randint(1000, 9999)}"
        zips.append(z)
    return zips


def _gen_date_mdY(n: int) -> list[str]:
    base = pd.date_range("2018-01-01", periods=n * 2, freq="D")
    chosen = np.random.choice(base, size=n, replace=False)
    return [pd.Timestamp(d).strftime("%m/%d/%Y") for d in chosen]


def _gen_date_ymd(n: int) -> list[str]:
    base = pd.date_range("2019-06-01", periods=n * 2, freq="D")
    chosen = np.random.choice(base, size=n, replace=False)
    return [pd.Timestamp(d).strftime("%Y-%m-%d") for d in chosen]


def _gen_email(n: int) -> list[str]:
    domains = ["gmail.com", "yahoo.com", "outlook.com", "company.io",
               "mail.org", "business.net", "proton.me", "fastmail.fm"]
    first_names = ["alice", "bob", "carol", "dave", "eve", "frank", "grace",
                   "hank", "iris", "jack", "kate", "leo", "mia", "noah",
                   "olivia", "peter", "quinn", "rosa", "sam", "tina"]
    out = []
    for _ in range(n):
        name = random.choice(first_names) + random.choice(["", str(random.randint(1, 99)), "_" + _rand_str(3)])
        out.append(f"{name}@{random.choice(domains)}")
    return out


def _gen_phone(n: int, fmt: int = 0) -> list[str]:
    out = []
    for _ in range(n):
        a, b, c = random.randint(200, 999), random.randint(100, 999), random.randint(1000, 9999)
        if fmt == 0:
            out.append(f"({a}) {b}-{c}")
        elif fmt == 1:
            out.append(f"{a}-{b}-{c}")
        else:
            out.append(f"+1-{a}-{b}-{c}")
    return out


def _gen_pct_string(n: int) -> list:
    vals = np.round(np.random.uniform(0, 100, size=n), 1)
    out = []
    for v in vals:
        if random.random() < 0.7:
            out.append(f"{v}%")
        else:
            out.append(v)  # raw float
    return out


def _gen_free_text(pool: list[str], n: int) -> list:
    return [random.choice(pool) for _ in range(n)]


def _gen_cat_low(categories: list[str], n: int) -> list[str]:
    out = []
    for _ in range(n):
        val = random.choice(categories)
        if random.random() < 0.05:
            val = val.lower()  # case inconsistency
        out.append(val)
    return out


def _gen_cat_high(pool: list[str], n: int) -> list[str]:
    return [random.choice(pool) for _ in range(n)]


def _gen_numeric(mean: float, std: float, n: int) -> list[float]:
    return np.round(np.random.normal(mean, std, size=n), 2).tolist()


def _inject_nan(series: pd.Series, pct: float) -> pd.Series:
    """Randomly set pct fraction of values to NaN."""
    mask = np.random.random(len(series)) < pct
    series = series.copy()
    series[mask] = np.nan
    return series


# =========================================================================
# Domain-specific CSV generators
# =========================================================================

def _ecommerce(n: int = 220) -> tuple[pd.DataFrame, dict[str, str]]:
    df = pd.DataFrame({
        "order_id": _gen_id("ORD", n),
        "customer_email": _gen_email(n),
        "product_category": _gen_cat_low(
            ["Electronics", "Clothing", "Home & Garden", "Books", "Sports", "Toys"], n),
        "product_name": _gen_cat_high([
            "Wireless Headphones", "Cotton T-Shirt", "Garden Hose", "Python Cookbook",
            "Running Shoes", "Board Game", "Laptop Stand", "Desk Lamp", "Travel Mug",
            "Phone Case", "Yoga Mat", "Bluetooth Speaker", "Sunglasses", "Backpack",
            "Water Bottle", "Wall Clock", "Notebook Set", "USB Cable", "Canvas Bag",
            "Electric Kettle", "Smart Watch", "LED Bulb Pack", "Mouse Pad", "Pen Set",
            "Ceramic Vase", "Door Mat", "Pillow Cover", "Spice Rack", "Bath Towel",
            "Charging Dock", "Mini Fan", "Key Holder", "Shoe Rack", "Plant Pot",
        ], n),
        "price": _gen_currency_dollar(n),
        "discount_pct": _gen_pct_string(n),
        "order_date": _gen_date_mdY(n),
        "shipping_zip": _gen_zip(n),
        "order_notes": _gen_free_text([
            "Please deliver before 5pm",
            "Gift wrap requested",
            "Leave at front door",
            "Handle with care",
            "Second floor apartment, buzz 2B",
            "Call before delivery",
            "",
            "No special instructions",
            "Fragile item inside",
            "Include receipt in package",
        ], n),
    })
    labels = {
        "order_id": "id",
        "customer_email": "email",
        "product_category": "categorical_low_card",
        "product_name": "categorical_high_card",
        "price": "currency",
        "discount_pct": "percentage",
        "order_date": "date",
        "shipping_zip": "zip_code",
        "order_notes": "free_text",
    }
    return df, labels


def _hr_records(n: int = 180) -> tuple[pd.DataFrame, dict[str, str]]:
    df = pd.DataFrame({
        "employee_id": _gen_id("EMP", n),
        "department": _gen_cat_low(
            ["Engineering", "Marketing", "Sales", "HR", "Finance", "Operations"], n),
        "salary": _gen_currency_dollar(n, with_symbol_pct=0.6),
        "years_experience": _gen_numeric(8, 5, n),
        "hire_date": _gen_date_ymd(n),
        "phone_number": _gen_phone(n, fmt=0),
        "performance_notes": _gen_free_text([
            "Exceeds expectations consistently",
            "Needs improvement in communication",
            "Strong team player",
            "Met all quarterly targets",
            "Recently promoted to senior role",
            "Completed leadership training program",
            "Pending review",
            "",
            "New hire, initial evaluation pending",
            "Recognized for innovation award",
        ], n),
        "bonus_pct": _gen_pct_string(n),
    })
    labels = {
        "employee_id": "id",
        "department": "categorical_low_card",
        "salary": "currency",
        "years_experience": "numeric_continuous",
        "hire_date": "date",
        "phone_number": "phone",
        "performance_notes": "free_text",
        "bonus_pct": "percentage",
    }
    return df, labels


def _healthcare(n: int = 200) -> tuple[pd.DataFrame, dict[str, str]]:
    df = pd.DataFrame({
        "patient_id": _gen_id("PT", n),
        "diagnosis_category": _gen_cat_low(
            ["Cardiology", "Orthopedics", "Dermatology", "Neurology",
             "Oncology", "Pediatrics", "General"], n),
        "visit_date": _gen_date_mdY(n),
        "insurance_provider": _gen_cat_high([
            "Blue Cross", "Aetna", "Cigna", "UnitedHealth", "Humana",
            "Kaiser", "Anthem", "Molina", "Centene", "WellCare",
            "Oscar Health", "Bright Health", "Clover Health", "Friday Health",
            "Alignment Healthcare", "GoHealth", "Progyny", "Hims & Hers",
            "Noom", "Sharecare", "HealthMarkets", "SelectQuote",
        ], n),
        "patient_zip": _gen_zip(n),
        "notes": _gen_free_text([
            "Patient reported chest pain for 3 days",
            "Follow-up appointment in 2 weeks",
            "Lab results normal, no further action",
            "Referred to specialist for MRI",
            "Medication dosage adjusted",
            "Patient shows improvement since last visit",
            "",
            "Vitals within normal range",
            "Recommend physical therapy 3x/week",
            "Allergy to penicillin noted in chart",
        ], n),
        "bill_amount": _gen_currency_dollar(n, with_symbol_pct=0.5),
        "heart_rate_bpm": _gen_numeric(75, 12, n),
        "contact_email": _gen_email(n),
    })
    labels = {
        "patient_id": "id",
        "diagnosis_category": "categorical_low_card",
        "visit_date": "date",
        "insurance_provider": "categorical_high_card",
        "patient_zip": "zip_code",
        "notes": "free_text",
        "bill_amount": "currency",
        "heart_rate_bpm": "numeric_continuous",
        "contact_email": "email",
    }
    return df, labels


def _real_estate(n: int = 150) -> tuple[pd.DataFrame, dict[str, str]]:
    df = pd.DataFrame({
        "listing_id": _gen_id("LST", n),
        "property_type": _gen_cat_low(
            ["Single Family", "Condo", "Townhouse", "Multi-Family", "Land"], n),
        "price": _gen_currency_dollar(n, with_symbol_pct=0.9),
        "sqft": _gen_numeric(1800, 600, n),
        "listing_zip": _gen_zip(n),
        "listing_date": _gen_date_ymd(n),
        "agent_email": _gen_email(n),
        "agent_phone": _gen_phone(n, fmt=1),
        "description": _gen_free_text([
            "Charming 3BR home with updated kitchen",
            "Modern condo with skyline views",
            "Spacious backyard, great for families",
            "Move-in ready, freshly painted",
            "Close to schools and shopping centers",
            "Open floor plan with hardwood floors",
            "Recently renovated bathroom",
            "",
            "Corner lot with mature trees",
            "HOA includes pool and gym access",
        ], n),
        "commission_pct": _gen_pct_string(n),
    })
    labels = {
        "listing_id": "id",
        "property_type": "categorical_low_card",
        "price": "currency",
        "sqft": "numeric_continuous",
        "listing_zip": "zip_code",
        "listing_date": "date",
        "agent_email": "email",
        "agent_phone": "phone",
        "description": "free_text",
        "commission_pct": "percentage",
    }
    return df, labels


def _banking(n: int = 250) -> tuple[pd.DataFrame, dict[str, str]]:
    df = pd.DataFrame({
        "transaction_id": _gen_id("TXN", n),
        "account_type": _gen_cat_low(
            ["Checking", "Savings", "Credit", "Investment"], n),
        "amount": _gen_currency_dollar(n, with_symbol_pct=0.4),
        "transaction_date": _gen_date_mdY(n),
        "merchant_category": _gen_cat_high([
            "Grocery", "Restaurant", "Gas Station", "Online Retail",
            "Pharmacy", "Utility", "Insurance", "Healthcare",
            "Travel", "Entertainment", "Subscription", "Education",
            "Electronics Store", "Department Store", "Hardware",
            "Pet Store", "Sporting Goods", "Auto Parts", "Coffee Shop",
            "Bakery", "Bookstore", "Clothing Store", "Florist",
        ], n),
        "fee_pct": _gen_pct_string(n),
        "memo": _gen_free_text([
            "Monthly subscription payment",
            "ATM withdrawal",
            "Direct deposit - payroll",
            "Wire transfer to savings",
            "Refund processed",
            "Overdraft fee applied",
            "",
            "Mobile check deposit",
            "International transaction fee",
            "Recurring bill payment",
        ], n),
        "branch_zip": _gen_zip(n),
        "balance": _gen_numeric(5200, 3500, n),
    })
    labels = {
        "transaction_id": "id",
        "account_type": "categorical_low_card",
        "amount": "currency",
        "transaction_date": "date",
        "merchant_category": "categorical_high_card",
        "fee_pct": "percentage",
        "memo": "free_text",
        "branch_zip": "zip_code",
        "balance": "numeric_continuous",
    }
    return df, labels


def _saas_usage(n: int = 170) -> tuple[pd.DataFrame, dict[str, str]]:
    df = pd.DataFrame({
        "user_id": _gen_id("USR", n),
        "plan_type": _gen_cat_low(
            ["Free", "Starter", "Pro", "Enterprise"], n),
        "monthly_revenue": _gen_currency_dollar(n, with_symbol_pct=0.7),
        "signup_date": _gen_date_ymd(n),
        "usage_notes": _gen_free_text([
            "Heavy API user, near rate limit",
            "Inactive for 30+ days",
            "Upgraded from free tier last month",
            "Reported bug in dashboard",
            "Requested custom integration",
            "",
            "Trial period ending soon",
            "Uses SSO with corporate IdP",
            "Submitted feature request for exports",
            "Power user, active daily",
        ], n),
        "support_email": _gen_email(n),
        "support_phone": _gen_phone(n, fmt=2),
        "storage_used_gb": _gen_numeric(12, 8, n),
        "uptime_pct": _gen_pct_string(n),
    })
    labels = {
        "user_id": "id",
        "plan_type": "categorical_low_card",
        "monthly_revenue": "currency",
        "signup_date": "date",
        "usage_notes": "free_text",
        "support_email": "email",
        "support_phone": "phone",
        "storage_used_gb": "numeric_continuous",
        "uptime_pct": "percentage",
    }
    return df, labels


def _retail_inventory(n: int = 200) -> tuple[pd.DataFrame, dict[str, str]]:
    df = pd.DataFrame({
        "sku_id": _gen_id("SKU", n),
        "category": _gen_cat_low(
            ["Apparel", "Electronics", "Food", "Furniture", "Beauty", "Outdoor"], n),
        "product_line": _gen_cat_high([
            "Summer Collection", "Winter Basics", "Premium Line", "Eco Series",
            "Budget Range", "Limited Edition", "Classic Range", "Sport Line",
            "Kids Collection", "Vintage Series", "Urban Style", "Country Living",
            "Tech Essentials", "Home Comfort", "Travel Gear", "Office Supplies",
            "Kitchen Must-haves", "Garden Tools", "Pet Supplies", "Wellness Kit",
            "Gift Sets", "Back to School", "Holiday Special", "Clearance",
        ], n),
        "unit_cost": _gen_currency_dollar(n, with_symbol_pct=0.5),
        "stock_pct": _gen_pct_string(n),
        "restock_date": _gen_date_mdY(n),
        "supplier_notes": _gen_free_text([
            "Lead time 2-3 weeks from overseas",
            "Domestic supplier, ships within 5 days",
            "Backordered until next quarter",
            "New vendor, quality TBD",
            "Bulk discount available at 500+ units",
            "",
            "Seasonal item, discontinue after March",
            "Recall notice issued, hold shipments",
            "Organic certified, updated labeling",
            "Packaging redesign in progress",
        ], n),
        "weight_kg": _gen_numeric(2.5, 1.5, n),
        "warehouse_zip": _gen_zip(n),
    })
    labels = {
        "sku_id": "id",
        "category": "categorical_low_card",
        "product_line": "categorical_high_card",
        "unit_cost": "currency",
        "stock_pct": "percentage",
        "restock_date": "date",
        "supplier_notes": "free_text",
        "weight_kg": "numeric_continuous",
        "warehouse_zip": "zip_code",
    }
    return df, labels


def _marketing(n: int = 160) -> tuple[pd.DataFrame, dict[str, str]]:
    df = pd.DataFrame({
        "campaign_id": _gen_id("CMP", n),
        "channel": _gen_cat_low(
            ["Email", "Social Media", "Search", "Display", "Affiliate", "TV"], n),
        "ad_creative": _gen_cat_high([
            "Summer Sale Banner", "Holiday Promo Video", "Flash Deal Carousel",
            "New Arrival Spotlight", "Customer Testimonial", "Brand Story",
            "Product Demo GIF", "Influencer Collab", "Retargeting Static",
            "Newsletter Header", "Exit Intent Popup", "Welcome Series",
            "Cart Abandonment", "Win-back Campaign", "Referral Program",
            "Loyalty Reward", "Seasonal Lookbook", "UGC Showcase",
            "Behind the Scenes", "FAQ Infographic", "Countdown Timer",
        ], n),
        "ctr_pct": _gen_pct_string(n),
        "spend": _gen_currency_dollar(n, with_symbol_pct=0.85),
        "campaign_date": _gen_date_ymd(n),
        "contact_email": _gen_email(n),
        "impressions": _gen_numeric(50000, 30000, n),
        "campaign_brief": _gen_free_text([
            "Target millennials in urban areas",
            "Focus on brand awareness for Q4",
            "A/B test headline variations",
            "Retarget users who visited pricing page",
            "Cross-promote with partner brand",
            "",
            "Optimize for mobile-first experience",
            "Seasonal push for back-to-school",
            "Leverage user-generated content",
            "Test new landing page design",
        ], n),
    })
    labels = {
        "campaign_id": "id",
        "channel": "categorical_low_card",
        "ad_creative": "categorical_high_card",
        "ctr_pct": "percentage",
        "spend": "currency",
        "campaign_date": "date",
        "contact_email": "email",
        "impressions": "numeric_continuous",
        "campaign_brief": "free_text",
    }
    return df, labels


def _education(n: int = 190) -> tuple[pd.DataFrame, dict[str, str]]:
    df = pd.DataFrame({
        "student_id": _gen_id("STU", n),
        "major": _gen_cat_low(
            ["Computer Science", "Biology", "English", "Business",
             "Engineering", "Psychology", "Art"], n),
        "gpa": _gen_numeric(3.2, 0.5, n),
        "enrollment_date": _gen_date_mdY(n),
        "campus_zip": _gen_zip(n),
        "student_email": _gen_email(n),
        "student_phone": _gen_phone(n, fmt=0),
        "tuition_paid": _gen_currency_dollar(n, with_symbol_pct=0.75),
        "attendance_pct": _gen_pct_string(n),
        "advisor_notes": _gen_free_text([
            "Dean's list candidate",
            "Struggling with calculus, needs tutoring",
            "Study abroad application submitted",
            "Changed major from pre-med",
            "Active in student government",
            "",
            "Scholarship renewal under review",
            "Completed honors thesis",
            "Internship placement confirmed",
            "Academic probation warning issued",
        ], n),
    })
    labels = {
        "student_id": "id",
        "major": "categorical_low_card",
        "gpa": "numeric_continuous",
        "enrollment_date": "date",
        "campus_zip": "zip_code",
        "student_email": "email",
        "student_phone": "phone",
        "tuition_paid": "currency",
        "attendance_pct": "percentage",
        "advisor_notes": "free_text",
    }
    return df, labels


def _logistics(n: int = 210) -> tuple[pd.DataFrame, dict[str, str]]:
    df = pd.DataFrame({
        "shipment_id": _gen_id("SHP", n),
        "carrier": _gen_cat_low(
            ["FedEx", "UPS", "USPS", "DHL", "Amazon Logistics"], n),
        "destination_city": _gen_cat_high([
            "New York", "Los Angeles", "Chicago", "Houston", "Phoenix",
            "Philadelphia", "San Antonio", "San Diego", "Dallas", "Austin",
            "San Jose", "Jacksonville", "Fort Worth", "Columbus", "Charlotte",
            "Indianapolis", "San Francisco", "Seattle", "Denver", "Nashville",
            "Oklahoma City", "El Paso", "Boston", "Portland", "Memphis",
        ], n),
        "shipping_cost": _gen_currency_dollar(n, with_symbol_pct=0.6),
        "ship_date": _gen_date_ymd(n),
        "dest_zip": _gen_zip(n),
        "weight_lbs": _gen_numeric(15, 10, n),
        "delivery_notes": _gen_free_text([
            "Signature required on delivery",
            "Leave at back door if not home",
            "Fragile contents, handle with care",
            "Oversized package, curbside delivery",
            "Expedited shipping requested",
            "",
            "Return shipment, include RMA label",
            "Residential address confirmed",
            "Package contains lithium batteries",
            "Customs documentation included",
        ], n),
        "on_time_pct": _gen_pct_string(n),
        "dispatch_email": _gen_email(n),
        "driver_phone": _gen_phone(n, fmt=1),
    })
    labels = {
        "shipment_id": "id",
        "carrier": "categorical_low_card",
        "destination_city": "categorical_high_card",
        "shipping_cost": "currency",
        "ship_date": "date",
        "dest_zip": "zip_code",
        "weight_lbs": "numeric_continuous",
        "delivery_notes": "free_text",
        "on_time_pct": "percentage",
        "dispatch_email": "email",
        "driver_phone": "phone",
    }
    return df, labels


# =========================================================================
# Main
# =========================================================================

GENERATORS = {
    "ecommerce_orders.csv": _ecommerce,
    "hr_records.csv": _hr_records,
    "healthcare_patients.csv": _healthcare,
    "real_estate_listings.csv": _real_estate,
    "banking_transactions.csv": _banking,
    "saas_usage.csv": _saas_usage,
    "retail_inventory.csv": _retail_inventory,
    "marketing_campaigns.csv": _marketing,
    "education_students.csv": _education,
    "logistics_shipments.csv": _logistics,
}


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    all_labels: list[dict] = []

    for filename, gen_fn in GENERATORS.items():
        df, col_labels = gen_fn()

        # Inject realistic messiness: per-CSV NaN rate between 5-20%
        nan_rate = random.uniform(0.05, 0.20)
        cols_to_dirty = random.sample(
            list(df.columns),
            k=min(len(df.columns), random.randint(3, len(df.columns) - 1))
        )
        for col in cols_to_dirty:
            # Don't NaN the ID column (it's always full)
            if col_labels.get(col) == "id":
                continue
            col_nan_rate = random.uniform(nan_rate * 0.5, nan_rate)
            df[col] = _inject_nan(df[col], col_nan_rate)

        out_path = OUT_DIR / filename
        df.to_csv(out_path, index=False)

        for col, sem_type in col_labels.items():
            all_labels.append({
                "csv_filename": filename,
                "column_name": col,
                "semantic_type": sem_type,
            })

        print(f"  {filename}: {len(df)} rows x {len(df.columns)} cols (NaN rate ~{nan_rate:.0%})")

    # Write ground-truth labels
    labels_df = pd.DataFrame(all_labels)
    labels_df.to_csv(LABELS_PATH, index=False)

    # Summary
    print(f"\nWrote {len(GENERATORS)} CSVs to {OUT_DIR}")
    print(f"Wrote {len(all_labels)} ground-truth labels to {LABELS_PATH}")
    print(f"\nLabel distribution:")
    print(labels_df["semantic_type"].value_counts().to_string())


if __name__ == "__main__":
    main()
