"""Canonical JSON Schema validation with exact decimal multipleOf semantics."""

from decimal import Decimal, DecimalException

from jsonschema import Draft202012Validator, ValidationError, validators


def decimal_multiple_of(validator, divisor, value, schema):
    if not validator.is_type(value, "number"):
        return
    try:
        number, step = Decimal(str(value)), Decimal(str(divisor))
        if number.is_finite() and step > 0 and number % step == 0:
            return
    except DecimalException:
        pass
    yield ValidationError("Number does not satisfy the declared decimal precision")


PreciseValidator = validators.extend(Draft202012Validator, {"multipleOf": decimal_multiple_of})
