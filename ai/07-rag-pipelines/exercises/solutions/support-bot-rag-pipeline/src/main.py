import argparse
import asyncio
from pathlib import Path
from .models import IngestedDoc
from .qdrant_client import ensure_support_docs_collection


def query(question, top_k):
    pass


def embed(docs: list[IngestedDoc]):
    pass


def chunk():
    pass


def get_md_files(path: Path) -> list[IngestedDoc]:
    docs: list[IngestedDoc] = []
    for file_path in path.rglob("*.md"):
        content = file_path.read_text(encoding="utf-8")
        docs.append(
            IngestedDoc(
                source=f"{file_path.parent}/{file_path.name}",
                text=content,
            )
        )
    return docs


async def ingest(path: Path):
    docs = get_md_files(path)
    await ensure_support_docs_collection()
    print(docs)
    pass


async def main():
    parser = argparse.ArgumentParser(description="Support Bot RAG Pipeline")
    subparsers = parser.add_subparsers(dest="command")

    ingest_parser = subparsers.add_parser("ingest")
    ingest_parser.add_argument("--folder", required=True)

    query_parser = subparsers.add_parser("query")
    query_parser.add_argument("--question", required=True)
    query_parser.add_argument("--top-k", type=int, default=5)

    args = parser.parse_args()

    if args.command == "ingest":
        await ingest(Path(args.folder))
    elif args.command == "query":
        answer = query(args.question, args.top_k)
        print(f"\nAnswer: {answer}")
    else:
        parser.print_help()


if __name__ == "__main__":
    asyncio.run(main())
