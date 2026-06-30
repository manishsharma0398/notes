import json
from pydantic import TypeAdapter
from ..utils.models import Database, Document

database_adapter = TypeAdapter(Database)


def get_db() -> Database:
    try:
        with open("database.json", "r", encoding="utf-8") as db:
            content = db.read().strip()
            if not content:
                return {}
            raw = json.loads(content)
            return database_adapter.validate_python(raw)
    except FileNotFoundError:
        return database_adapter.validate_python({})
    except json.JSONDecodeError:
        raise ValueError("Error: The file is not a valid JSON format.")


def add_to_db(payload: Document):
    db = get_db()
    db[payload.id] = payload

    with open("database.json", "w", encoding="utf-8") as db_file:
        json.dump(
            database_adapter.dump_python(db, mode="json"),
            db_file,
            indent=2,
        )

    return payload
