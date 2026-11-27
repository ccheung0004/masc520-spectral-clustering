from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"
RAW_DATA_DIR = DATA_DIR / "raw"

print("Config loaded successfully!")
print(RAW_DATA_DIR)


# Experiment parameters
RANDOM_STATE = 42
N_CLUSTERS = 10
N_TRIALS = 5

# PCA parameters
PCA_COMPONENTS = [2, 5, 10, 20, 30, 40, 50]

# K-Means parameters
KMEANS_N_INIT = 10
KMEANS_MAX_ITER = 300

# Spectral clustering parameters
SPECTRAL_AFFINITY = "nearest_neighbors"
SPECTRAL_N_NEIGHBORS = 10
SPECTRAL_ASSIGN_LABELS = "kmeans"

RESULTS_DIR = ROOT_DIR / "results"
FIGURES_DIR = RESULTS_DIR / "figures"
METRICS_DIR = RESULTS_DIR / "metrics"