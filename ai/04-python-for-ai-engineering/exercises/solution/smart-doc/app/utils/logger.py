import logging
from .context_vars import req_id_context
from pythonjsonlogger.json import JsonFormatter


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # Runs on every log call, for every level
        # Attach req_id to the record — it becomes available to the formatter
        record.req_id = req_id_context.get("no-request-id")
        return True  # True = don't suppress this log entry


logger = logging.getLogger("Smart-doc")
logger.setLevel(logging.INFO)

handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
handler.addFilter(RequestIdFilter())
logger.addHandler(handler)
