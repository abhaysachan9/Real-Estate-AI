import os
import gzip
import shutil
import joblib


BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.path.join(
    BASE_DIR,
    "model",
    "house_price_model.pkl.gz"
)

COLUMNS_PATH = os.path.join(
    BASE_DIR,
    "model",
    "model_columns.pkl"
)


def load_model():
    try:
        with gzip.open(MODEL_PATH, "rb") as f:
            model = joblib.load(f)

        columns = joblib.load(COLUMNS_PATH)

        return model, columns

    except Exception as e:
        print(f"Error: Could not load model files: {e}")
        raise


model, columns = load_model()
