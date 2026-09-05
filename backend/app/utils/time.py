from datetime import datetime, timezone


def utcnow() -> datetime:
    """Return current UTC time as a naive datetime for MySQL DATETIME fields."""
    return datetime.now(timezone.utc).replace(tzinfo=None)