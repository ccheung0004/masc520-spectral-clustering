
import time
import pandas as pd

from config import METRICS_DIR

from src.data_loader import load_data
from src.preprocessing import preprocess_data
from src.dimensionality_reduction import apply_pca

from src.clustering import (
    apply_kmeans,
    apply_spectral_clustering
)

from src.evaluation import evaluate_clustering


def main():

    # Load and preprocess dataset
    X, y = load_data()
    X = preprocess_data(X)

    print("Original shape:", X.shape)

    # Apply PCA
    start_time = time.perf_counter()

    X_pca, pca = apply_pca(X, 20)

    pca_runtime = time.perf_counter() - start_time

    print("PCA shape:", X_pca.shape)

    # Define experiments
    experiments = [
        ("K-Means", X, apply_kmeans, 0),
        ("K-Means + PCA", X_pca, apply_kmeans, pca_runtime),
        ("Spectral", X, apply_spectral_clustering, 0),
        (
            "Spectral + PCA",
            X_pca,
            apply_spectral_clustering,
            pca_runtime
        )
    ]

    results = []

    # Run experiments
    for name, data, algorithm, pca_time in experiments:

        print(f"\nRunning {name}...")

        labels, model, runtime = algorithm(data)

        metrics = evaluate_clustering(
            X,
            y,
            labels,
            runtime
        )

        metrics["Algorithm"] = name
        metrics["Dimensions"] = data.shape[1]
        metrics["PCA Runtime"] = pca_time
        metrics["Total Runtime"] = runtime + pca_time

        results.append(metrics)

    # Convert results into a DataFrame
    df = pd.DataFrame(results)

    df = df[
        [
            "Algorithm",
            "Dimensions",
            "ARI",
            "NMI",
            "Accuracy",
            "Silhouette",
            "Runtime",
            "PCA Runtime",
            "Total Runtime"
        ]
    ]

    print("\n--- Experiment Results ---\n")

    print(
        df.to_string(
            index=False,
            float_format=lambda x: f"{x:.4f}"
        )
    )

    # Save results
    METRICS_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    df.to_csv(
        METRICS_DIR / "preliminary_results.csv",
        index=False
    )

    print("\nResults successfully saved!")


if __name__ == "__main__":
    main()
