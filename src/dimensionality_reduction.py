import numpy as np

from sklearn.decomposition import PCA


def apply_pca(X, n_components):

    pca = PCA(
        n_components=n_components,
        svd_solver="full"
    )

    X_reduced = pca.fit_transform(X)

    return X_reduced, pca
def get_explained_variance(pca):
    """
    Return the explained variance ratio of each
    principal component.
    """

    return pca.explained_variance_ratio_


def get_cumulative_variance(pca):
    """
    Return the cumulative explained variance.
    """

    return np.cumsum(pca.explained_variance_ratio_)


def get_eigenvalues(pca):
    """
    Return the eigenvalues associated with the
    retained principal components.
    """

    return pca.explained_variance_


def reconstruct_data(X_reduced, pca):
    """
    Reconstruct the original data from its
    lower-dimensional representation.
    """

    return pca.inverse_transform(X_reduced)
