import contextvars

req_id_context: contextvars.ContextVar[str] = contextvars.ContextVar("request_id")
