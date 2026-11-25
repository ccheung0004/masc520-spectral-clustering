
import numpy as np
import pandas as pd

from config import RAW_DATA_DIR


BASE_URL = (
    "https://archive.ics.uci.edu/ml/"
    "machine-learning-databases/optdigits/"
)


def download_data():
    """Download and save the original UCI dataset."""

    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)

    files = ["optdigits.tra", "optdigits.tes"]

    for filename in files:
        filepath = RAW_DATA_DIR / filename

        if not filepath.exists():
            print(f"Downloading {filename}...")

            data = pd.read_csv(
                BASE_URL + filename,
                header=None
            )

            data.to_csv(
                filepath,
                index=False,
                header=False
            )

        else:
            print(f"{filename} already exists.")


def load_data():
    """Load the dataset and separate features and labels."""

    download_data()

    train = pd.read_csv(
        RAW_DATA_DIR / "optdigits.tra",
        header=None
    )

    test = pd.read_csv(
        RAW_DATA_DIR / "optdigits.tes",
        header=None
    )

    # Combine both datasets
    data = pd.concat(
        [train, test],
        ignore_index=True
    )

    # First 64 columns are features
    X = data.iloc[:, :-1].to_numpy(dtype=float)

    # Last column contains the true digit labels
    y = data.iloc[:, -1].to_numpy(dtype=int)

    return X, y


if __name__ == "__main__":
    X, y = load_data()

    print("Feature matrix shape:", X.shape)
    print("Label vector shape:", y.shape)
    print("Unique labels:", np.unique(y))
    print("Minimum pixel value:", X.min())
    print("Maximum pixel value:", X.max())
