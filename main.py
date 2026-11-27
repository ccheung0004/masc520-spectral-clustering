
import time
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from config import (
    METRICS_DIR,
    FIGURES_DIR,
    RANDOM_STATE,
    N_TRIALS,
    PCA_COMPONENTS,
    METRICS
)

from src.data_loader import load_data
from src.preprocessing import preprocess_data
from src.dimensionality_reduction import apply_pca

from src.clustering import (
    apply_kmeans,
    apply_spectral_clustering
)

from src.evaluation import evaluate_clustering

from src.visualization import (
    plot_explained_variance,
    plot_dimension_comparison,
    plot_cluster_comparison,
    plot_confusion_matrix
)


def run_experiments(X, y):

    results = []
    saved_labels = {}

    dimensions = PCA_COMPONENTS + [X.shape[1]]

    algorithms = {
        "K-Means": apply_kmeans,
        "Spectral": apply_spectral_clustering
    }

    total_experiments = (
        len(dimensions)
        * len(algorithms)
        * N_TRIALS
    )

    experiment_number = 0

    for k in dimensions:

        print(f"\n{'=' * 50}")
        print(f"Number of dimensions: {k}")
        print("=" * 50)

        for trial in range(N_TRIALS):

            seed = RANDOM_STATE + trial

            # Apply PCA unless using the baseline
            if k == X.shape[1]:

                X_reduced = X
                pca_runtime = 0.0
                explained_variance = 1.0

            else:

                start_time = time.perf_counter()

                X_reduced, pca = apply_pca(X, k)

                pca_runtime = (
                    time.perf_counter() - start_time
                )

                explained_variance = (
                    pca.explained_variance_ratio_.sum()
                )

            # Run both clustering algorithms
            for name, algorithm in algorithms.items():

                experiment_number += 1

                print(
                    f"[{experiment_number}/"
                    f"{total_experiments}] "
                    f"{name} | "
                    f"k={k} | "
                    f"seed={seed}",
                    flush=True
                )

                labels, model, runtime = algorithm(
                    X_reduced,
                    random_state=seed
                )

                # Evaluate using original feature space
                metrics = evaluate_clustering(
                    X,
                    y,
                    labels,
                    runtime
                )

                metrics.update({
                    "Algorithm": name,
                    "Dimensions": k,
                    "Trial": trial + 1,
                    "Seed": seed,
                    "PCA Runtime": pca_runtime,
                    "Total Runtime": (
                        runtime + pca_runtime
                    ),
                    "Explained Variance": (
                        explained_variance
                    )
                })

                results.append(metrics)

                saved_labels[
                    (name, k, seed)
                ] = labels

                print(
                    f"    ARI: {metrics['ARI']:.4f} | "
                    f"NMI: {metrics['NMI']:.4f} | "
                    f"Accuracy: "
                    f"{metrics['Accuracy']:.4f} | "
                    f"Runtime: {runtime:.4f}s"
                )

                # Save progress after every experiment
                pd.DataFrame(results).to_csv(
                    METRICS_DIR / "raw_results.csv",
                    index=False
                )

    return pd.DataFrame(results), saved_labels


def summarize_results(df):

    summary = (
        df.groupby(
            ["Algorithm", "Dimensions"]
        )[METRICS + ["Explained Variance"]]
        .agg(["mean", "std"])
        .reset_index()
    )

    # Flatten multi-level column names
    summary.columns = [
        "_".join(col).rstrip("_")
        for col in summary.columns
    ]

    return summary


def identify_best_results(summary):

    best_results = []

    for algorithm in summary["Algorithm"].unique():

        group = summary[
            summary["Algorithm"] == algorithm
        ]

        best_index = group["ARI_mean"].idxmax()

        best_results.append(
            group.loc[best_index]
        )

    return pd.DataFrame(best_results)


def generate_figures(X, y, df, summary, saved_labels):

    print("\nGenerating final figures...")

    # Explained variance
    _, pca_full = apply_pca(X, X.shape[1])

    plot_explained_variance(pca_full)

    # Performance against number of dimensions
    for metric in METRICS:

        plot_dimension_comparison(
            summary,
            metric
        )

    # Common 2D PCA projection
    X_2d, _ = apply_pca(X, 2)

    cluster_results = {
        "True Labels": y
    }

    best_results = identify_best_results(summary)

    for _, row in best_results.iterrows():

        name = row["Algorithm"]
        k = int(row["Dimensions"])

        # Use the trial closest to the mean ARI
        trials = df[
            (df["Algorithm"] == name)
            & (df["Dimensions"] == k)
        ]

        representative_index = (
            trials["ARI"] - row["ARI_mean"]
        ).abs().idxmin()

        seed = int(
            trials.loc[representative_index, "Seed"]
        )

        best_labels = saved_labels[
            (name, k, seed)
        ]

        baseline_labels = saved_labels[
            (name, X.shape[1], seed)
        ]

        baseline_title = f"{name} Baseline"

        best_title = f"{name} Best (k={k})"

        cluster_results[baseline_title] = (
            baseline_labels
        )

        cluster_results[best_title] = best_labels

        plot_confusion_matrix(
            y,
            baseline_labels,
            baseline_title
        )

        plot_confusion_matrix(
            y,
            best_labels,
            best_title
        )

    plot_cluster_comparison(
        X_2d,
        cluster_results
    )


def main():

    start_time = time.perf_counter()

    # Create output directories
    METRICS_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    FIGURES_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    # Load and preprocess data
    X, y = load_data()
    X = preprocess_data(X)

    print("Dataset shape:", X.shape)

    # Run full experiment
    df, saved_labels = run_experiments(X, y)

    # Summarize results
    summary = summarize_results(df)

    summary.to_csv(
        METRICS_DIR / "summary_results.csv",
        index=False
    )

    # Identify best configurations
    best_results = identify_best_results(summary)

    best_results.to_csv(
        METRICS_DIR / "best_results.csv",
        index=False
    )

    print("\n--- BEST CONFIGURATIONS ---\n")

    print(
        best_results[
            [
                "Algorithm",
                "Dimensions",
                "ARI_mean",
                "NMI_mean",
                "Accuracy_mean",
                "Silhouette_mean",
                "Total Runtime_mean"
            ]
        ].to_string(
            index=False,
            float_format=lambda x: f"{x:.4f}"
        )
    )

    # Generate visualizations
    generate_figures(
        X,
        y,
        df,
        summary,
        saved_labels
    )

    total_runtime = (
        time.perf_counter() - start_time
    )

    print("\nAll experiments completed!")

    print(
        f"Total execution time: "
        f"{total_runtime:.2f} seconds"
    )

    print(f"Metrics saved to: {METRICS_DIR}")
    print(f"Figures saved to: {FIGURES_DIR}")

    plt.show()


if __name__ == "__main__":
    main()
