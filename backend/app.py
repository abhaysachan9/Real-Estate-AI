from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import os
import numpy as np

app = Flask(__name__)
CORS(app)

# ============================================================
# PATHS
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.path.join(BASE_DIR, "../model/house_price_model.pkl")
COLUMNS_PATH = os.path.join(BASE_DIR, "../model/model_columns.pkl")
DATASET_PATH = os.path.join(BASE_DIR, "../data/Bengaluru_House_Data.csv")

# ============================================================
# LOAD MODEL
# ============================================================

try:
    model = joblib.load(MODEL_PATH)
    columns = joblib.load(COLUMNS_PATH)
except Exception as e:
    raise RuntimeError(f"Could not load model files: {e}")


# ============================================================
# DATASET CLEANING
# ============================================================

_dataset_cache = None


def convert_sqft(value):
    try:
        value = str(value).strip()

        if "-" in value:
            parts = value.split("-")

            if len(parts) == 2:
                return (
                    float(parts[0].strip())
                    + float(parts[1].strip())
                ) / 2

        return float(value)

    except (ValueError, TypeError):
        return np.nan


def load_and_clean_dataset():
    global _dataset_cache

    if _dataset_cache is not None:
        return _dataset_cache.copy()

    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(
            f"Dataset not found at: {DATASET_PATH}"
        )

    df = pd.read_csv(DATASET_PATH)

    # Remove columns that are not useful for the current model analytics.
    df = df.drop(
        columns=[
            c for c in ["society", "availability"]
            if c in df.columns
        ],
        errors="ignore"
    )

    required_columns = [
        "location",
        "size",
        "total_sqft",
        "bath",
        "price"
    ]

    missing = [
        c for c in required_columns
        if c not in df.columns
    ]

    if missing:
        raise ValueError(
            f"Dataset is missing columns: {missing}"
        )

    df = df.dropna(
        subset=required_columns
    )

    # -----------------------------
    # BHK
    # -----------------------------

    df["bhk"] = pd.to_numeric(
        df["size"]
        .astype(str)
        .str.extract(r"(\d+(?:\.\d+)?)")[0],
        errors="coerce"
    )

    # -----------------------------
    # Area
    # -----------------------------

    df["total_sqft"] = (
        df["total_sqft"]
        .apply(convert_sqft)
    )

    # -----------------------------
    # Bathrooms
    # -----------------------------

    df["bath"] = pd.to_numeric(
        df["bath"],
        errors="coerce"
    )

    # -----------------------------
    # Balcony
    # -----------------------------

    if "balcony" in df.columns:

        df["balcony"] = pd.to_numeric(
            df["balcony"],
            errors="coerce"
        )

        df["balcony"] = df[
            "balcony"
        ].fillna(
            df["balcony"].median()
        )

    else:
        df["balcony"] = 0

    # -----------------------------
    # Price
    # -----------------------------

    df["price"] = pd.to_numeric(
        df["price"],
        errors="coerce"
    )

    df = df.dropna(
        subset=[
            "bhk",
            "total_sqft",
            "bath",
            "price"
        ]
    )

    # -----------------------------
    # Basic data sanity checks
    # -----------------------------

    df = df[
        (df["total_sqft"] > 0) &
        (df["bhk"] > 0) &
        (df["price"] > 0)
    ]

    df = df[
        (
            df["total_sqft"]
            /
            df["bhk"]
        ) >= 300
    ]

    # -----------------------------
    # Location cleaning
    # -----------------------------

    df["location"] = (
        df["location"]
        .astype(str)
        .str.strip()
        .str.replace(
            r"\s+",
            " ",
            regex=True
        )
    )

    # -----------------------------
    # Price / sqft
    # -----------------------------

    df["price_per_sqft"] = (
        df["price"] * 100000
    ) / df["total_sqft"]

    df = df.replace(
        [np.inf, -np.inf],
        np.nan
    )

    df = df.dropna(
        subset=["price_per_sqft"]
    )

    # Remove extreme data-entry values using
    # broad percentile boundaries rather than
    # aggressively deleting normal market variation.
    low = df[
        "price_per_sqft"
    ].quantile(0.01)

    high = df[
        "price_per_sqft"
    ].quantile(0.99)

    df = df[
        (df["price_per_sqft"] >= low) &
        (df["price_per_sqft"] <= high)
    ]

    # Basic bathroom sanity check.
    df = df[
        df["bath"] <= df["bhk"] + 2
    ]

    _dataset_cache = df.copy()

    return df.copy()


# ============================================================
# HELPERS
# ============================================================

def supported_locations():
    prefix = "location_"

    return sorted(
        c[len(prefix):]
        for c in columns
        if c.startswith(prefix)
    )


def normalise_location(value):
    return (
        str(value)
        .strip()
        .replace("  ", " ")
    )


def build_input(
    total_sqft,
    bath,
    balcony,
    bhk,
    location
):
    location_column = (
        f"location_{location}"
    )

    if location_column not in columns:

        return None, (
            f"Location '{location}' "
            "is not available in the trained model."
        )

    input_data = {
        "total_sqft": total_sqft,
        "bath": bath,
        "balcony": balcony,
        "bhk": bhk,
        location_column: 1
    }

    input_df = pd.DataFrame(
        [input_data]
    )

    input_df = input_df.reindex(
        columns=columns,
        fill_value=0
    )

    return input_df, None


def safe_number(value, digits=2):
    if value is None:
        return None

    try:
        if pd.isna(value):
            return None

        return round(
            float(value),
            digits
        )

    except (TypeError, ValueError):
        return None


# ============================================================
# COMPARABLE PROPERTY ENGINE
# ============================================================

def find_comparables(
    df,
    location,
    bhk,
    total_sqft,
    bath
):
    """
    Find comparable historical records.

    Priority:
      1. Same locality + same BHK + similar area
      2. Same locality + nearby BHK + similar area
      3. Same locality + nearby area
      4. Same BHK + nearby area as a fallback

    A similarity score is used so the dashboard can explain
    that records are ranked rather than treated as identical.
    """

    location_lower = location.lower()

    same_location = (
        df["location"]
        .str.lower()
        ==
        location_lower
    )

    # Start with a reasonably strict pool.
    pool = df[
        same_location
    ].copy()

    if len(pool) == 0:
        pool = df.copy()

    # --------------------------------------------------------
    # Feature differences
    # --------------------------------------------------------

    pool["area_diff"] = (
        abs(
            pool["total_sqft"]
            -
            total_sqft
        )
        /
        total_sqft
    )

    pool["bhk_diff"] = abs(
        pool["bhk"] - bhk
    )

    pool["bath_diff"] = abs(
        pool["bath"] - bath
    )

    # --------------------------------------------------------
    # Similarity score
    #
    # Location is handled first by the pool.
    # Area and BHK receive the strongest weights.
    # Bathroom receives a smaller weight.
    # --------------------------------------------------------

    pool["similarity_score"] = (

        100

        - (
            pool["area_diff"] * 60
        )

        - (
            pool["bhk_diff"] * 12
        )

        - (
            pool["bath_diff"] * 4
        )
    )

    # Prefer records within a reasonable area window.
    strict = pool[
        (pool["area_diff"] <= 0.25) &
        (pool["bhk_diff"] <= 1)
    ].copy()

    if len(strict) >= 3:
        pool = strict

    # If same locality doesn't have enough records,
    # expand carefully rather than mixing arbitrary localities.
    if len(pool) < 3:

        broader = df[
            (
                df["location"]
                .str.lower()
                ==
                location_lower
            )
        ].copy()

        if len(broader) > len(pool):
            broader["area_diff"] = (
                abs(
                    broader["total_sqft"]
                    -
                    total_sqft
                )
                /
                total_sqft
            )

            broader["bhk_diff"] = abs(
                broader["bhk"] - bhk
            )

            broader["bath_diff"] = abs(
                broader["bath"] - bath
            )

            broader["similarity_score"] = (
                100
                - broader["area_diff"] * 60
                - broader["bhk_diff"] * 12
                - broader["bath_diff"] * 4
            )

            pool = broader

    # Final fallback only when the locality has
    # insufficient historical data.
    if len(pool) < 3:

        fallback = df[
            (df["bhk"] == bhk) &
            (
                df["total_sqft"].between(
                    total_sqft * 0.70,
                    total_sqft * 1.30
                )
            )
        ].copy()

        if len(fallback) > 0:

            fallback["area_diff"] = (
                abs(
                    fallback["total_sqft"]
                    -
                    total_sqft
                )
                /
                total_sqft
            )

            fallback["bhk_diff"] = abs(
                fallback["bhk"] - bhk
            )

            fallback["bath_diff"] = abs(
                fallback["bath"] - bath
            )

            fallback["similarity_score"] = (
                100
                - fallback["area_diff"] * 60
                - fallback["bhk_diff"] * 12
                - fallback["bath_diff"] * 4
            )

            pool = fallback

    pool = pool.sort_values(
        [
            "similarity_score",
            "area_diff"
        ],
        ascending=[
            False,
            True
        ]
    )

    return pool.head(8).copy()


# ============================================================
# MARKET POSITION
# ============================================================

def get_market_position(
    predicted_price,
    benchmark_price
):
    if (
        benchmark_price is None
        or benchmark_price <= 0
    ):
        return (
            "INSUFFICIENT DATA",
            "There is not enough historical "
            "benchmark data to classify this property."
        )

    difference = (
        (
            predicted_price
            -
            benchmark_price
        )
        /
        benchmark_price
    ) * 100

    if difference <= -10:

        return (
            "BELOW HISTORICAL BENCHMARK",
            "The model estimate is materially "
            "below the historical benchmark. "
            "This is a valuation signal, not "
            "a guaranteed investment opportunity."
        )

    if difference >= 10:

        return (
            "ABOVE HISTORICAL BENCHMARK",
            "The model estimate is materially "
            "above the historical benchmark. "
            "Property-specific features and "
            "current asking prices should be verified."
        )

    return (
        "MARKET ALIGNED",
        "The model estimate is relatively "
        "close to the available historical benchmark."
    )


# ============================================================
# HOME
# ============================================================

@app.route("/")
def home():

    return jsonify({
        "status": "success",
        "message": "Smart Real Estate API Running",
        "version": "3.0"
    })


# ============================================================
# HEALTH
# ============================================================

@app.route("/health")
def health():

    return jsonify({
        "status": "healthy",
        "model_loaded": True,
        "dataset_available": os.path.exists(
            DATASET_PATH
        ),
        "supported_locations":
            len(supported_locations())
    })


# ============================================================
# LOCATIONS
# ============================================================

@app.route("/locations")
def locations():

    return jsonify({
        "status": "success",
        "locations": supported_locations()
    })


# ============================================================
# PREDICTION
# ============================================================

@app.route(
    "/predict",
    methods=["POST"]
)
def predict():

    try:

        data = request.get_json(
            silent=True
        ) or {}

        required = [
            "total_sqft",
            "bath",
            "balcony",
            "bhk",
            "location"
        ]

        missing = [
            field
            for field in required
            if field not in data
        ]

        if missing:

            return jsonify({
                "status": "error",
                "message":
                    "Missing field(s): "
                    + ", ".join(missing)
            }), 400

        total_sqft = float(
            data["total_sqft"]
        )

        bath = float(
            data["bath"]
        )

        balcony = float(
            data["balcony"]
        )

        bhk = float(
            data["bhk"]
        )

        location = normalise_location(
            data["location"]
        )

        if total_sqft <= 0:
            raise ValueError(
                "Area must be greater than 0."
            )

        if bhk <= 0:
            raise ValueError(
                "BHK must be greater than 0."
            )

        if bath <= 0:
            raise ValueError(
                "Bathrooms must be greater than 0."
            )

        if balcony < 0:
            raise ValueError(
                "Balconies cannot be negative."
            )

        input_df, error = build_input(
            total_sqft,
            bath,
            balcony,
            bhk,
            location
        )

        if error:

            return jsonify({
                "status": "error",
                "message": error,
                "supported_locations":
                    supported_locations()
            }), 400

        prediction = float(
            model.predict(
                input_df
            )[0]
        )

        prediction = round(
            prediction,
            2
        )

        predicted_price_per_sqft = (
            prediction * 100000
        ) / total_sqft

        return jsonify({

            "status": "success",

            "predicted_price":
                prediction,

            "predicted_price_per_sqft":
                round(
                    predicted_price_per_sqft,
                    2
                ),

            "location":
                location,

            "bhk":
                int(bhk)
                if bhk.is_integer()
                else bhk,

            "bath":
                bath,

            "balcony":
                balcony,

            "total_sqft":
                total_sqft,

            "currency":
                "INR",

            "unit":
                "lakhs",

            "data_note":
                "The prediction comes from "
                "the trained Bengaluru house-price "
                "model. Historical benchmarks "
                "are based on the supplied dataset "
                "and are not live market quotes."
        })

    except KeyError as e:

        return jsonify({
            "status": "error",
            "message":
                f"Missing field: {str(e)}"
        }), 400

    except ValueError as e:

        return jsonify({
            "status": "error",
            "message": str(e)
        }), 400

    except Exception as e:

        print(
            "Prediction error:",
            e
        )

        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


# ============================================================
# ANALYTICS
# ============================================================

@app.route(
    "/analytics",
    methods=["POST"]
)
def analytics():

    try:

        data = request.get_json(
            silent=True
        ) or {}

        total_sqft = float(
            data["total_sqft"]
        )

        bhk = int(
            float(data["bhk"])
        )

        bath = float(
            data["bath"]
        )

        balcony = float(
            data["balcony"]
        )

        location = normalise_location(
            data["location"]
        )

        predicted_price = float(
            data["predicted_price"]
        )

        if total_sqft <= 0:
            raise ValueError(
                "Area must be greater than 0."
            )

        if predicted_price <= 0:
            raise ValueError(
                "Predicted price must be greater than 0."
            )

        df = load_and_clean_dataset()

        # ====================================================
        # LOCATION DATA
        # ====================================================

        location_df = df[
            df["location"]
            .str.lower()
            ==
            location.lower()
        ].copy()

        location_sample_count = len(
            location_df
        )

        if location_sample_count > 0:

            location_average_price = float(
                location_df["price"].mean()
            )

            location_median_price = float(
                location_df["price"].median()
            )

            location_average_pps = float(
                location_df[
                    "price_per_sqft"
                ].mean()
            )

            location_median_pps = float(
                location_df[
                    "price_per_sqft"
                ].median()
            )

            location_min_price = float(
                location_df["price"].min()
            )

            location_max_price = float(
                location_df["price"].max()
            )

        else:

            location_average_price = None
            location_median_price = None
            location_average_pps = None
            location_median_pps = None
            location_min_price = None
            location_max_price = None

        # ====================================================
        # CURRENT PROPERTY METRICS
        # ====================================================

        predicted_price_per_sqft = (
            predicted_price * 100000
        ) / total_sqft

        # ====================================================
        # COMPARABLES
        # ====================================================

        comparables = find_comparables(
            df,
            location,
            bhk,
            total_sqft,
            bath
        )

        comparable_count = len(
            comparables
        )

        if comparable_count > 0:

            comparable_average_price = float(
                comparables["price"].mean()
            )

            comparable_median_price = float(
                comparables["price"].median()
            )

            comparable_average_pps = float(
                comparables[
                    "price_per_sqft"
                ].mean()
            )

        else:

            comparable_average_price = None
            comparable_median_price = None
            comparable_average_pps = None

        # ====================================================
        # SIZE-ADJUSTED BENCHMARK SELECTION
        #
        # IMPORTANT:
        # Never compare the total price of the target property
        # with the median total price of every property in the
        # locality. Bengaluru listings have very different sizes.
        #
        # Instead, compare PRICE PER SQ.FT and then scale the
        # historical benchmark to the target property's area.
        #
        # Example:
        # HSR median = Rs 4,891/sq.ft
        # Target = 10,000 sq.ft
        # Benchmark = 4,891 * 10,000 / 100,000 = Rs 489.1L
        # ====================================================

        if (
            location_median_pps is not None
            and location_median_pps > 0
        ):

            benchmark_price = (
                location_median_pps
                * total_sqft
                / 100000
            )

            benchmark_type = (
                "size_adjusted_locality_median_pps"
            )

        elif (
            comparable_average_pps is not None
            and comparable_average_pps > 0
        ):

            benchmark_price = (
                comparable_average_pps
                * total_sqft
                / 100000
            )

            benchmark_type = (
                "size_adjusted_comparable_pps"
            )

        else:

            benchmark_price = None
            benchmark_type = (
                "insufficient_data"
            )

        # ====================================================
        # MARKET DIFFERENCE
        # ====================================================

        if (
            benchmark_price is not None
            and benchmark_price > 0
        ):

            market_difference_percent = (

                (
                    predicted_price
                    -
                    benchmark_price
                )
                /
                benchmark_price

            ) * 100

        else:

            market_difference_percent = 0

        # ====================================================
        # PREDICTED VS HISTORICAL P/SQFT
        # ====================================================

        if (
            location_median_pps is not None
            and location_median_pps > 0
        ):

            pps_difference_percent = (

                (
                    predicted_price_per_sqft
                    -
                    location_median_pps
                )
                /
                location_median_pps

            ) * 100

        else:

            pps_difference_percent = None

        # ====================================================
        # SIZE-ADJUSTED HISTORICAL PRICE RANGE
        #
        # The chart/range should represent what properties of
        # THIS SIZE would historically cost, rather than showing
        # raw prices of much smaller/larger homes.
        # ====================================================

        if len(location_df) >= 3:

            range_pps_source = (
                location_df["price_per_sqft"]
            )

        elif len(comparables) >= 3:

            range_pps_source = (
                comparables["price_per_sqft"]
            )

        else:

            range_pps_source = None

        if range_pps_source is not None:

            historical_lower = (
                float(
                    range_pps_source.quantile(0.25)
                )
                * total_sqft
                / 100000
            )

            historical_upper = (
                float(
                    range_pps_source.quantile(0.75)
                )
                * total_sqft
                / 100000
            )

        else:

            historical_lower = None
            historical_upper = None

        # ====================================================
        # LOCATION COMPARISON
        #
        # Use sample count >= 5 to avoid tiny samples.
        # ====================================================

        location_stats = (
            df
            .groupby("location")
            .agg(
                average_pps=(
                    "price_per_sqft",
                    "mean"
                ),
                sample_count=(
                    "price_per_sqft",
                    "count"
                )
            )
            .query("sample_count >= 5")
            .sort_values(
                "average_pps",
                ascending=False
            )
            .head(10)
        )

        location_comparison = []

        for (
            location_name,
            row
        ) in location_stats.iterrows():

            location_comparison.append({

                "location":
                    location_name,

                "price_per_sqft":
                    round(
                        float(
                            row[
                                "average_pps"
                            ]
                        ),
                        2
                    ),

                "sample_count":
                    int(
                        row[
                            "sample_count"
                        ]
                    )
            })

        # Always add selected location if it has data.
        if (
            location_average_pps
            is not None
        ):

            exists = any(
                item["location"].lower()
                ==
                location.lower()
                for item
                in location_comparison
            )

            if not exists:

                location_comparison.append({

                    "location":
                        location,

                    "price_per_sqft":
                        round(
                            location_average_pps,
                            2
                        ),

                    "sample_count":
                        location_sample_count
                })

        max_location_pps = max(
            [
                item[
                    "price_per_sqft"
                ]
                for item
                in location_comparison
            ],
            default=1
        )

        # ====================================================
        # BHK COMPARISON
        # ====================================================

        bhk_stats = (
            df
            .groupby("bhk")
            .agg(
                average_price=(
                    "price",
                    "mean"
                ),
                median_price=(
                    "price",
                    "median"
                ),
                sample_count=(
                    "price",
                    "count"
                )
            )
            .reset_index()
        )

        bhk_stats = bhk_stats[
            (bhk_stats["bhk"] >= 1)
            &
            (bhk_stats["bhk"] <= 6)
        ]

        bhk_comparison = []

        for _, row in bhk_stats.iterrows():

            bhk_comparison.append({

                "bhk":
                    int(
                        row["bhk"]
                    ),

                "average_price":
                    round(
                        float(
                            row[
                                "average_price"
                            ]
                        ),
                        2
                    ),

                "median_price":
                    round(
                        float(
                            row[
                                "median_price"
                            ]
                        ),
                        2
                    ),

                "sample_count":
                    int(
                        row[
                            "sample_count"
                        ]
                    )
            })

        # ====================================================
        # AREA VS PRICE
        # ====================================================

        chart_df = (
            comparables
            if len(comparables) >= 3
            else location_df
        ).copy()

        if len(chart_df) > 30:

            chart_df = (
                chart_df
                .sort_values(
                    "total_sqft"
                )
                .iloc[
                    np.linspace(
                        0,
                        len(chart_df) - 1,
                        30
                    ).astype(int)
                ]
            )

        area_price_chart = []

        for _, row in chart_df.iterrows():

            area_price_chart.append({

                "area":
                    round(
                        float(
                            row[
                                "total_sqft"
                            ]
                        ),
                        2
                    ),

                "price":
                    round(
                        float(
                            row[
                                "price"
                            ]
                        ),
                        2
                    ),

                "price_per_sqft":
                    round(
                        float(
                            row[
                                "price_per_sqft"
                            ]
                        ),
                        2
                    )
            })

        # ====================================================
        # COMPARABLE CARDS
        # ====================================================

        comparable_list = []

        if comparable_count > 0:

            sample = (
                comparables
                .sort_values(
                    [
                        "similarity_score",
                        "area_diff"
                    ],
                    ascending=[
                        False,
                        True
                    ]
                )
                .head(8)
            )

            for _, row in sample.iterrows():

                comparable_list.append({

                    "location":
                        row["location"],

                    "price":
                        round(
                            float(
                                row["price"]
                            ),
                            2
                        ),

                    "total_sqft":
                        round(
                            float(
                                row[
                                    "total_sqft"
                                ]
                            ),
                            2
                        ),

                    "bhk":
                        int(
                            row["bhk"]
                        ),

                    "bath":
                        round(
                            float(
                                row["bath"]
                            ),
                            1
                        ),

                    "price_per_sqft":
                        round(
                            float(
                                row[
                                    "price_per_sqft"
                                ]
                            ),
                            2
                        ),

                    "similarity_score":
                        round(
                            max(
                                0,
                                float(
                                    row[
                                        "similarity_score"
                                    ]
                                )
                            ),
                            1
                        )
                })

        # ====================================================
        # MARKET POSITION
        # ====================================================

        recommendation, recommendation_reason = (
            get_market_position(
                predicted_price,
                benchmark_price
            )
        )

        # ====================================================
        # DATA STRENGTH
        # ====================================================

        if location_sample_count >= 50:
            data_strength = "HIGH"
        elif location_sample_count >= 15:
            data_strength = "MEDIUM"
        elif location_sample_count >= 5:
            data_strength = "LOW"
        else:
            data_strength = "VERY LOW"

        # ====================================================
        # PROPERTY CONFIGURATION / SIZE ANOMALY
        # ====================================================
        target_sqft_per_bhk = total_sqft / max(bhk, 1)
        location_bhk_df = location_df[location_df["bhk"] == bhk].copy()
        reference_df = location_bhk_df if len(location_bhk_df) >= 5 else df[df["bhk"] == bhk].copy()

        if len(reference_df) >= 5:
            ref_sqft_per_bhk = reference_df["total_sqft"] / reference_df["bhk"].clip(lower=1)
            p95_size_per_bhk = float(ref_sqft_per_bhk.quantile(0.95))
            p05_size_per_bhk = float(ref_sqft_per_bhk.quantile(0.05))
        else:
            p95_size_per_bhk = None
            p05_size_per_bhk = None

        configuration_flag = False
        configuration_message = "Property configuration is within the historical range of the available dataset."
        if p95_size_per_bhk is not None and target_sqft_per_bhk > p95_size_per_bhk:
            configuration_flag = True
            configuration_message = (
                f"This {bhk}-BHK property has about {target_sqft_per_bhk:,.0f} sq.ft per bedroom, "
                f"above the historical 95th-percentile reference of about {p95_size_per_bhk:,.0f} sq.ft per bedroom. "
                "The prediction may involve extrapolation."
            )
        elif p05_size_per_bhk is not None and target_sqft_per_bhk < p05_size_per_bhk:
            configuration_flag = True
            configuration_message = (
                f"This {bhk}-BHK property has about {target_sqft_per_bhk:,.0f} sq.ft per bedroom, "
                f"below the historical 5th-percentile reference of about {p05_size_per_bhk:,.0f} sq.ft per bedroom. "
                "The prediction may involve extrapolation."
            )

        if comparable_count >= 5:
            comparable_strength = "STRONG"
        elif comparable_count >= 3:
            comparable_strength = "MODERATE"
        elif comparable_count >= 1:
            comparable_strength = "LIMITED"
        else:
            comparable_strength = "NONE"

        # ====================================================
        # CHART MAX
        # ====================================================

        chart_values = [
            predicted_price
        ]

        for value in [
            location_average_price,
            comparable_average_price,
            historical_lower,
            historical_upper
        ]:

            if value is not None:
                chart_values.append(
                    value
                )

        chart_max = (
            max(chart_values) * 1.15
            if chart_values
            else 1
        )

        # ====================================================
        # RESPONSE
        # ====================================================

        return jsonify({

            "status":
                "success",

            # ----------------------------------------------
            # Property
            # ----------------------------------------------

            "property": {

                "location":
                    location,

                "bhk":
                    bhk,

                "bath":
                    bath,

                "balcony":
                    balcony,

                "total_sqft":
                    total_sqft,

                "predicted_price":
                    round(
                        predicted_price,
                        2
                    ),

                "predicted_price_per_sqft":
                    round(
                        predicted_price_per_sqft,
                        2
                    )
            },

            # ----------------------------------------------
            # Keep old frontend keys
            # ----------------------------------------------

            "predicted_price_per_sqft":
                round(
                    predicted_price_per_sqft
                ),

            "location_average_price":
                safe_number(
                    location_average_price
                ),

            "location_average_pps":
                safe_number(
                    location_average_pps,
                    0
                ),

            "comparable_average_price":
                safe_number(
                    comparable_average_price
                ),

            "comparable_count":
                comparable_count,

            "market_difference_percent":
                round(
                    market_difference_percent,
                    2
                ),

            "location_comparison":
                location_comparison,

            "max_location_pps":
                max_location_pps,

            "chart_max":
                chart_max,

            "comparables":
                comparable_list,

            "recommendation":
                recommendation,

            "recommendation_reason":
                recommendation_reason,

            # ----------------------------------------------
            # New detailed analytics
            # ----------------------------------------------

            "location_benchmark": {

                "average_price":
                    safe_number(
                        location_average_price
                    ),

                "median_price":
                    safe_number(
                        location_median_price
                    ),

                "average_price_per_sqft":
                    safe_number(
                        location_average_pps,
                        0
                    ),

                "median_price_per_sqft":
                    safe_number(
                        location_median_pps,
                        0
                    ),

                "min_price":
                    safe_number(
                        location_min_price
                    ),

                "max_price":
                    safe_number(
                        location_max_price
                    ),

                "sample_count":
                    location_sample_count
            },

            "comparables_summary": {

                "average_price":
                    safe_number(
                        comparable_average_price
                    ),

                "median_price":
                    safe_number(
                        comparable_median_price
                    ),

                "average_price_per_sqft":
                    safe_number(
                        comparable_average_pps,
                        0
                    ),

                "sample_count":
                    comparable_count
            },

            "historical_price_range": {

                "lower":
                    safe_number(
                        historical_lower
                    ),

                "upper":
                    safe_number(
                        historical_upper
                    )
            },

            "benchmark": {

                "price":
                    safe_number(
                        benchmark_price
                    ),

                "type":
                    benchmark_type,

                "historical_price_per_sqft":
                    safe_number(
                        location_median_pps
                        if location_median_pps is not None
                        else comparable_average_pps,
                        0
                    ),

                "target_area_sqft":
                    total_sqft,

                "difference_percent":
                    round(
                        market_difference_percent,
                        2
                    ),

                "price_per_sqft_difference_percent":
                    safe_number(
                        pps_difference_percent
                    ),

                "interpretation":
                    (
                        "Benchmark is calculated from historical "
                        "price per square foot and scaled to the "
                        "target property's area."
                    )
            },

            "data_quality": {

                "locality_sample_count":
                    location_sample_count,

                "comparable_count":
                    comparable_count,

                "strength":
                    data_strength,

                "comparable_strength":
                    comparable_strength
            },

            "property_quality": {
                "configuration_flag": configuration_flag,
                "message": configuration_message,
                "target_sqft_per_bhk": round(target_sqft_per_bhk, 2),
                "reference_p95_sqft_per_bhk": safe_number(p95_size_per_bhk),
                "reference_p05_sqft_per_bhk": safe_number(p05_size_per_bhk)
            },

            "charts": {

                "location_comparison":
                    location_comparison,

                "bhk_comparison":
                    bhk_comparison,

                "area_price":
                    area_price_chart
            },

            "data_source": {

                "type":
                    "historical_dataset",

                "file":
                    "Bengaluru_House_Data.csv",

                "note":
                    "Historical dataset benchmark. "
                    "Not a live market quote and not "
                    "a guaranteed transaction price."
            }
        })

    except KeyError as e:

        return jsonify({

            "status":
                "error",

            "message":
                f"Missing field: {str(e)}"

        }), 400

    except FileNotFoundError:

        return jsonify({

            "status":
                "error",

            "message":
                (
                    "Dataset not found. "
                    f"Expected at: {DATASET_PATH}"
                )

        }), 500

    except ValueError as e:

        return jsonify({

            "status":
                "error",

            "message":
                str(e)

        }), 400

    except Exception as e:

        print(
            "Analytics error:",
            e
        )

        return jsonify({

            "status":
                "error",

            "message":
                str(e)

        }), 500


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":

    app.run(
        host="127.0.0.1",
        port=5001,
        debug=True
    )
