
import numpy as np
import matplotlib.pyplot as plt

from src.data_loader import load_data
from src.preprocessing import preprocess_data
from src.dimensionality_reduction import apply_pca

from src.clustering import (
    apply_kmeans,
    apply_spectral_clustering
)


def main():

    # Load and preprocess data
    X, y = load_data()
    X = preprocess_data(X)

    print("Original dataset shape:", X.shape)

    # Apply PCA
    X_pca, pca = apply_pca(X, 20)

    print("PCA dataset shape:", X_pca.shape)

    # Experiment 1: K-Means without PCA
    print("\nRunning K-Means...")

    labels_kmeans, _, time_kmeans = apply_kmeans(X)

    # Experiment 2: K-Means with PCA
    print("Running K-Means with PCA...")

    labels_kmeans_pca, _, time_kmeans_pca = (
        apply_kmeans(X_pca)
    )

    # Experiment 3: Spectral without PCA
    print("Running Spectral Clustering...")

    labels_spectral, _, time_spectral = (
        apply_spectral_clustering(X)
    )

    # Experiment 4: Spectral with PCA
    print("Running Spectral Clustering with PCA...")

    labels_spectral_pca, _, time_spectral_pca = (
        apply_spectral_clustering(X_pca)
    )

    # Display computational runtimes
    print("\n--- Clustering Runtimes ---")

    print(f"K-Means: {time_kmeans:.4f} seconds")
    print(f"K-Means + PCA: {time_kmeans_pca:.4f} seconds")

    print(f"Spectral: {time_spectral:.4f} seconds")
    print(f"Spectral + PCA: {time_spectral_pca:.4f} seconds")

    # Create a common 2D projection for visualization
    X_2d, _ = apply_pca(X, 2)

    fig, axes = plt.subplots(
        2, 3,
        figsize=(16, 10)
    )

    experiments = [
        ("True Labels", y),
        ("K-Means", labels_kmeans),
        ("K-Means + PCA", labels_kmeans_pca),
        ("Spectral", labels_spectral),
        ("Spectral + PCA", labels_spectral_pca)
    ]

    for ax, (title, labels) in zip(
        axes.flatten(), experiments
    ):

        ax.scatter(
            X_2d[:, 0],
            X_2d[:, 1],
            c=labels,
            cmap="tab10",
            s=5,
            alpha=0.6,
            vmin=-0.5,
            vmax=9.5
        )

        ax.set_title(title)
        ax.set_xlabel("Principal Component 1")
        ax.set_ylabel("Principal Component 2")

    axes[1, 2].axis("off")

    fig.suptitle("Comparison of Clustering Algorithms")

    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    main()
