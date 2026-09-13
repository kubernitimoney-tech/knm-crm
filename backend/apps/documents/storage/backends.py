"""
Storage abstraction — swap LocalStorageBackend for S3Backend in production
without changing service layer.
"""

from abc import ABC, abstractmethod

from django.core.files.storage import default_storage


class BaseStorageBackend(ABC):
    @abstractmethod
    def save(self, path: str, content) -> str:
        pass

    @abstractmethod
    def url(self, path: str) -> str:
        pass

    @abstractmethod
    def delete(self, path: str) -> None:
        pass


class LocalStorageBackend(BaseStorageBackend):
    def save(self, path: str, content) -> str:
        return default_storage.save(path, content)

    def url(self, path: str) -> str:
        return default_storage.url(path)

    def delete(self, path: str) -> None:
        default_storage.delete(path)


def get_storage_backend() -> BaseStorageBackend:
    return LocalStorageBackend()
