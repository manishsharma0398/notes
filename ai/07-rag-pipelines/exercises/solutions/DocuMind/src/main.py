from .utils.models import Document
from pathlib import Path


def chunk_docs(docs: list[dict]):
    pass


def get_all_files(path: Path) -> list[Document]:
    print("path:", path)
    if not path:
        return "Path required"
    docs: list[Document] = []
    for pattern in ("*.md", "*.txt"):
        for file_path in path.rglob(pattern):
            docs.append(
                Document(
                    source=str(file_path.relative_to(path)),
                    filename=file_path.name,
                    extension=file_path.suffix,
                )
            )
    return docs


def main():
    docs = get_all_files(Path("./docs"))


if __name__ == "__main__":
    main()
