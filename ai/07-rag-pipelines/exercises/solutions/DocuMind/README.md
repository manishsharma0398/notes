# DocuMind

## Running

```bash
# run the app
uv run python -m src.main

# ingest a folder of notes
uv run python -m src.main ingest ~/notes

# ask a single question
uv run python -m src.main query --question "..."

# interactive chat
uv run python -m src.main chat
```

```
docker run -p 6333:6333 -p 6334:6334 \
    -v "$(pwd)/qdrant_storage:/qdrant/storage:z" \
    qdrant/qdrant
```
