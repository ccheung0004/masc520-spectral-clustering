import numpy as np


def normalize_data(X):
    """
    Normalize pixel intensities to the range [0, 1].
    """

    return X / 16.0


def center_data(X):
    """
    Center each feature by subtracting its mean.
    """

    mean = np.mean(X, axis=0)

    return X - mean


def preprocess_data(X):
    """
    Prepare the dataset for clustering.
    """

    X_normalized = normalize_data(X)

    return X_normalized
