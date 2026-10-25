from abc import ABC, abstractmethod


class StorageProvider(ABC):
    @abstractmethod
    def save(self, content: bytes, destination_path: str) -> str:
        """Saves content to destination and returns storage key or relative path."""
        pass

    @abstractmethod
    def load(self, file_path: str) -> bytes:
        """Loads and returns file content as bytes."""
        pass

    @abstractmethod
    def delete(self, file_path: str) -> bool:
        """Deletes file from storage."""
        pass

    @abstractmethod
    def exists(self, file_path: str) -> bool:
        """Checks if file exists in storage."""
        pass
