
import numpy as np
import matplotlib.pyplot as plt

from src.data_loader import load_data
from src.preprocessing import preprocess_data


def main():

    # Load dataset
    X, y = load_data()

    print("Original shape:", X.shape)
    print("Original minimum:", X.min())
    print("Original maximum:", X.max())

    # Preprocess dataset
    X_processed = preprocess_data(X)

    print("\nAfter preprocessing:")
    print("Processed shape:", X_processed.shape)
    print("Processed minimum:", X_processed.min())
    print("Processed maximum:", X_processed.max())

    # Display original image
    plt.figure()
    plt.imshow(X[0].reshape(8, 8), cmap="gray")
    plt.title("Original Image")
    plt.colorbar()

    # Display normalized image
    plt.figure()
    plt.imshow(X_processed[0].reshape(8, 8), cmap="gray")
    plt.title("Normalized Image")
    plt.colorbar()

    plt.show()


if __name__ == "__main__":
    main()
