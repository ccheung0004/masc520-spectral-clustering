import time

from sklearn.cluster import KMeans, SpectralClustering

from config import (
    N_CLUSTERS,
    RANDOM_STATE,
    KMEANS_N_INIT,
    KMEANS_MAX_ITER,
    SPECTRAL_AFFINITY,
    SPECTRAL_N_NEIGHBORS,
    SPECTRAL_ASSIGN_LABELS
)


def apply_kmeans(
    X,
    n_clusters=N_CLUSTERS,
    random_state=RANDOM_STATE
):
    """
    Apply K-Means clustering to the dataset.
    """

    model = KMeans(
        n_clusters=n_clusters,
        random_state=random_state,
        n_init=KMEANS_N_INIT,
        max_iter=KMEANS_MAX_ITER
    )

    start_time = time.perf_counter()

    labels = model.fit_predict(X)

    runtime = time.perf_counter() - start_time

    return labels, model, runtime


def apply_spectral_clustering(
    X,
    n_clusters=N_CLUSTERS,
    random_state=RANDOM_STATE,
    n_neighbors=SPECTRAL_N_NEIGHBORS
):
    """
    Apply Spectral Clustering to the dataset.
    """

    model = SpectralClustering(
        n_clusters=n_clusters,
        affinity=SPECTRAL_AFFINITY,
        n_neighbors=n_neighbors,
        assign_labels=SPECTRAL_ASSIGN_LABELS,
        random_state=random_state,
        n_init=KMEANS_N_INIT
    )

    start_time = time.perf_counter()

    labels = model.fit_predict(X)

    runtime = time.perf_counter() - start_time

    return labels, model, runtime
