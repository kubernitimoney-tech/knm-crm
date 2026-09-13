"""Thread-local markers so audit signals treat soft deletes as delete, not update."""

import threading

_thread = threading.local()


def mark_soft_delete(instance) -> None:
    pending = getattr(_thread, "pending", None)
    if pending is None:
        pending = set()
        _thread.pending = pending
    pending.add((instance._meta.label, str(instance.pk)))


def consume_soft_delete(instance) -> bool:
    pending = getattr(_thread, "pending", None)
    if not pending:
        return False
    key = (instance._meta.label, str(instance.pk))
    if key not in pending:
        return False
    pending.discard(key)
    return True


def clear_soft_delete_marks() -> None:
    if hasattr(_thread, "pending"):
        del _thread.pending
