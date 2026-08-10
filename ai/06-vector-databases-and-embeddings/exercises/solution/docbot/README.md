```
docker pull qdrant/qdrant
cd /home/manish/notes/ai/06-vector-databases-and-embeddings/exercises/solution/docbot
docker run -p 6333:6333 -p 6334:6334 \
    -v "$(pwd)/qdrant_storage:/qdrant/storage:z" \
    qdrant/qdrant
```
