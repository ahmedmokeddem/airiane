import pytest

from app.database_url import postgres_dsn


@pytest.mark.parametrize("scheme", ["postgres", "postgresql", "postgresql+asyncpg"])
def test_tiger_url_preserves_encoded_credentials_and_tls(scheme):
    assert postgres_dsn(f"{scheme}://user:p%40ss@host:30272/tsdb?sslmode=require") == (
        "postgresql://user:p%40ss@host:30272/tsdb?sslmode=require"
    )


def test_sqlalchemy_ssl_alias_is_normalized_for_migrations():
    assert postgres_dsn("postgresql+asyncpg://host/db?ssl=require").endswith("sslmode=require")


def test_conflicting_tls_modes_rejected():
    with pytest.raises(ValueError, match="Conflicting"):
        postgres_dsn("postgresql://host/db?ssl=require&sslmode=disable")
