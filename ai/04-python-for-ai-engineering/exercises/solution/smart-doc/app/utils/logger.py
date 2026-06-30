import logging
import sys

logger = logging.getLogger("Smart-doc")
logger.setLevel(logging.INFO)

if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    logger.addHandler(handler)