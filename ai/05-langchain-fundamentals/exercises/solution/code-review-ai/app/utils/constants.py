from enum import Enum


class Severity(str, Enum):
    INFO = "info"
    ERROR = "error"
    WARNING = "warning"
    CRITICAL = "critical"
