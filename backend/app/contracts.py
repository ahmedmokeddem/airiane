"""Validate both directions against the committed OpenAPI, never a parallel DTO invention."""

from pathlib import Path

import jsonschema
import yaml

from .domain import DomainError
from .schema_validation import PreciseValidator

SPEC = yaml.safe_load(
    (Path(__file__).resolve().parents[2] / "contracts/openapi.yaml").read_text(encoding="utf-8")
)
RESOLVER = jsonschema.RefResolver.from_schema(SPEC)


def validate(name: str, body: object) -> None:
    errors = list(
        PreciseValidator(
            SPEC["components"]["schemas"][name],
            resolver=RESOLVER,
            format_checker=jsonschema.FormatChecker(),
        ).iter_errors(body)
    )
    if errors:
        raise DomainError("VALIDATION_ERROR", 422)
