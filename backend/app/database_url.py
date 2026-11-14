"""Normalize provider PostgreSQL URLs for the native asyncpg driver."""

from sqlalchemy.engine import make_url


def postgres_dsn(value: str) -> str:
    url = make_url(value)
    if url.drivername not in {"postgres", "postgresql", "postgresql+asyncpg"}:
        raise ValueError("Expected a PostgreSQL connection URL")
    query = dict(url.query)
    if "ssl" in query:
        if "sslmode" in query and query["sslmode"] != query["ssl"]:
            raise ValueError("Conflicting PostgreSQL SSL settings")
        query["sslmode"] = query.pop("ssl")
    return url.set(drivername="postgresql", query=query).render_as_string(hide_password=False)
