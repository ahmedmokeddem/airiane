"""Opaque patient/filter-bound list cursors, valid only for this API process lifetime."""

import json

from cryptography.fernet import Fernet, InvalidToken

from .domain import DomainError


class Pages:
    def __init__(self):
        self.cipher = Fernet(Fernet.generate_key())

    def build(self, rows, view, key, query, scope, descending=True):
        try:
            limit = int(query.get("limit", "20"))
            if not 1 <= limit <= 100:
                raise ValueError()
            last = None
            if query.get("cursor"):
                payload = json.loads(self.cipher.decrypt(query["cursor"].encode(), ttl=3600))
                if payload["scope"] != scope:
                    raise ValueError()
                last = tuple(payload["last"])
        except (ValueError, KeyError, TypeError, InvalidToken):
            raise DomainError("VALIDATION_ERROR", 422) from None
        rows = sorted(rows, key=key, reverse=descending)
        if last is not None:
            rows = [r for r in rows if (key(r) < last if descending else key(r) > last)]
        selected = rows[:limit]
        cursor = None
        if len(rows) > limit:
            cursor = self.cipher.encrypt(
                json.dumps({"scope": scope, "last": key(selected[-1])}).encode()
            ).decode()
        return {"items": [view(row) for row in selected], "next_cursor": cursor}
