import numpy as np
import matplotlib.pyplot as plt

from scipy.optimize import linear_sum_assignment
from sklearn.metrics.cluster import contingency_matrix

from config import FIGURES_DIR


def save_figure(fig, filename):
    """
    Save a figure to the results directory.
    """

    FIGURES_DIR.mkdir(parents=True, exist_ok=True)

    fig.savefig(
        FIGURES_DIR / filename,
        dpi=300,
        bbox_inches="tight"
    )


def plot_metric_comparison(df):
    """
    Compare clustering evaluation metrics.
    """

    metrics = ["ARI", "NMI", "Accuracy", "Silhouette"]

    fig, axes = plt.subplots(2, 2, figsize=(12, 9))

    for ax, metric in zip(axes.flatten(), metrics):

        bars = ax.bar(
            df["Algorithm"],
            df[metric]
        )

        ax.bar_label(bars, fmt="%.3f", padding=3)

        ax.set_title(metric)
        ax.set_ylabel("Score")

        lower = min(0, df[metric].min() - 0.05)
        ax.set_ylim(lower, 1.1)

        ax.tick_params(axis="x", rotation=20)
        ax.grid(axis="y", alpha=0.3)

    fig.suptitle("Clustering Performance Comparison")

    fig.tight_layout()

    save_figure(fig, "metric_comparison.png")

    return fig


def plot_runtime_comparison(df):
    """
    Compare PCA and clustering computational costs.
    """

    fig, ax = plt.subplots(figsize=(10, 6))

    ax.bar(
        df["Algorithm"],
        df["PCA Runtime"],
        label="PCA Runtime"
    )

    ax.bar(
        df["Algorithm"],
        df["Runtime"],
        bottom=df["PCA Runtime"],
        label="Clustering Runtime"
    )

    ax.set_ylabel("Runtime (seconds)")
    ax.set_title("Computational Runtime Comparison")

    ax.tick_params(axis="x", rotation=20)
    ax.legend()
    ax.grid(axis="y", alpha=0.3)

    fig.tight_layout()

    save_figure(fig, "runtime_comparison.png")

    return fig


def plot_explained_variance(pca):
    """
    Plot individual and cumulative explained variance.
    """

    variance = pca.explained_variance_ratio_
    cumulative = np.cumsum(variance)

    components = np.arange(1, len(variance) + 1)

    fig, axes = plt.subplots(1, 2, figsize=(13, 5))

    axes[0].bar(components, variance)

    axes[0].set_xlabel("Principal Component")
    axes[0].set_ylabel("Explained Variance Ratio")
    axes[0].set_title("Individual Explained Variance")

    axes[1].plot(components, cumulative)

    axes[1].axhline(
        0.95,
        linestyle="--",
        color="red",
        label="95% Variance"
    )

    axes[1].set_xlabel("Number of Components")
    axes[1].set_ylabel("Cumulative Explained Variance")
    axes[1].set_title("Cumulative Explained Variance")
    axes[1].legend()

    for ax in axes:
        ax.grid(alpha=0.3)

    fig.tight_layout()

    save_figure(fig, "explained_variance.png")

    return fig


def plot_cluster_comparison(X_2d, cluster_results):
    """
    Visualize multiple cluster assignments using
    a common two-dimensional projection.
    """

    n_plots = len(cluster_results)
    n_cols = 3
    n_rows = int(np.ceil(n_plots / n_cols))

    fig, axes = plt.subplots(
        n_rows,
        n_cols,
        figsize=(15, 5 * n_rows),
        squeeze=False
    )

    axes = axes.flatten()

    for ax, (name, labels) in zip(
        axes, cluster_results.items()
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

        ax.set_title(name)
        ax.set_xlabel("Principal Component 1")
        ax.set_ylabel("Principal Component 2")

    for ax in axes[n_plots:]:
        ax.axis("off")

    fig.suptitle("Clustering Visualization")

    fig.tight_layout()

    save_figure(fig, "cluster_comparison.png")

    return fig


def plot_confusion_matrix(y_true, y_pred, title):
    """
    Plot a confusion matrix after optimally
    matching predicted clusters to true labels.
    """

    matrix = contingency_matrix(y_true, y_pred)

    row_ind, col_ind = linear_sum_assignment(-matrix)

    # Align predicted clusters with true categories
    aligned = np.zeros_like(matrix)

    aligned[:, row_ind] = matrix[:, col_ind]

    fig, ax = plt.subplots(figsize=(8, 7))

    image = ax.imshow(aligned, cmap="Blues")

    fig.colorbar(image, ax=ax)

    for i in range(aligned.shape[0]):
        for j in range(aligned.shape[1]):

            ax.text(
                j,
                i,
                aligned[i, j],
                ha="center",
                va="center",
                color=(
                    "white"
                    if aligned[i, j] > aligned.max() / 2
                    else "black"
                )
            )

    digits = np.unique(y_true)

    ax.set_xticks(np.arange(len(digits)))
    ax.set_yticks(np.arange(len(digits)))

    ax.set_xticklabels(digits)
    ax.set_yticklabels(digits)

    ax.set_xlabel("Matched Predicted Digit")
    ax.set_ylabel("True Digit")
    ax.set_title(title)

    fig.tight_layout()

    filename = title.lower().replace(" ", "_")
    filename = filename.replace("+", "plus")

    save_figure(fig, f"{filename}.png")

    return fig


def plot_dimension_comparison(summary_df, metric):
    """
    Plot a metric against the number of dimensions,
    including standard deviation error bars.
    """

    fig, ax = plt.subplots(figsize=(10, 6))

    for algorithm, group in summary_df.groupby("Algorithm"):

        group = group.sort_values("Dimensions")

        ax.errorbar(
            group["Dimensions"],
            group[f"{metric}_mean"],
            yerr=group[f"{metric}_std"],
            marker="o",
            capsize=4,
            label=algorithm
        )

    ax.set_xlabel("Number of Dimensions")
    ax.set_ylabel(metric)
    ax.set_title(f"{metric} vs. Number of Dimensions")

    ax.legend()
    ax.grid(alpha=0.3)

    fig.tight_layout()

    filename = metric.lower().replace(" ", "_")

    save_figure(fig, f"{filename}_vs_dimensions.png")

    return fig
