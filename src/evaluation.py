
import numpy as np

from scipy.optimize import linear_sum_assignment

from sklearn.metrics import (
    adjusted_rand_score,
    normalized_mutual_info_score,
    silhouette_score
)

from sklearn.metrics.cluster import contingency_matrix


def clustering_accuracy(y_true, y_pred):
    """
    Calculate clustering accuracy using optimal
    cluster-label matching.
    """

    matrix = contingency_matrix(y_true, y_pred)

    row_ind, col_ind = linear_sum_assignment(
        -matrix
    )

    accuracy = (
        matrix[row_ind, col_ind].sum()
        / len(y_true)
    )

    return accuracy


def evaluate_clustering(X, y_true, y_pred, runtime):
    """
    Evaluate clustering performance using
    internal and external evaluation metrics.
    """

    ari = adjusted_rand_score(
        y_true, y_pred
    )

    nmi = normalized_mutual_info_score(
        y_true, y_pred
    )

    accuracy = clustering_accuracy(
        y_true, y_pred
    )

    n_labels = len(np.unique(y_pred))

    if 1 < n_labels < len(X):
        silhouette = silhouette_score(X, y_pred)
    else:
        silhouette = np.nan

    results = {
        "ARI": ari,
        "NMI": nmi,
        "Accuracy": accuracy,
        "Silhouette": silhouette,
        "Runtime": runtime
    }

    return results
