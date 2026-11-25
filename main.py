
import numpy as np
import matplotlib.pyplot as plt

from src.data_loader import load_data


def main():
    X, y = load_data()

    print("Feature matrix shape:", X.shape)
    print("Label vector shape:", y.shape)
    print("Unique labels:", np.unique(y))
    print("Minimum pixel value:", X.min())
    print("Maximum pixel value:", X.max())

    # Display the first handwritten digit
    plt.imshow(X[0].reshape(8, 8), cmap="gray")
    plt.title(f"Digit: {y[0]}")
    plt.colorbar()
    plt.show()


if __name__ == "__main__":
    main()
