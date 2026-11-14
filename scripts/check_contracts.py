"""Validate shared fixture payloads against canonical OpenAPI, not copied DTOs."""
from pathlib import Path
import json

import yaml
from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

ROOT = Path(__file__).resolve().parents[1]


def main():
    spec = yaml.safe_load((ROOT / 'contracts/openapi.yaml').read_text())
    registry = Registry().with_resource(
        'urn:re:openapi', Resource.from_contents(spec, default_specification=DRAFT202012)
    )
    count = 0
    for path in sorted((ROOT / 'contracts/fixtures').glob('*.json')):
        fixture = json.loads(path.read_text())
        schema = fixture['schema']
        Draft202012Validator(
            {'$ref': f'urn:re:openapi#/components/schemas/{schema}'},
            registry=registry, format_checker=FormatChecker()
        ).validate(fixture['data'])
        count += 1
    assert count, 'No contract fixtures found'
    tools = json.loads((ROOT / 'contracts/tool_contracts.json').read_text())
    assert tools['contract_version'] == spec['info']['version']
    print(f'{count} fixtures passed against OpenAPI {spec["info"]["version"]}')


if __name__ == '__main__':
    main()
