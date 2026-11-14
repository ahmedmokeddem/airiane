"""Validate shared fixture payloads against canonical OpenAPI, not copied DTOs."""
from pathlib import Path
import json

import yaml
from jsonschema import FormatChecker
import sys
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
from app.schema_validation import PreciseValidator  # noqa: E402


def main():
    spec = yaml.safe_load((ROOT / 'contracts/openapi.yaml').read_text(encoding="utf-8"))
    registry = Registry().with_resource(
        'urn:re:openapi', Resource.from_contents(spec, default_specification=DRAFT202012)
    )
    count = 0
    for path in sorted((ROOT / 'contracts/fixtures').glob('*.json')):
        fixture = json.loads(path.read_text(encoding="utf-8"))
        schema = fixture['schema']
        PreciseValidator(
            {'$ref': f'urn:re:openapi#/components/schemas/{schema}'},
            registry=registry, format_checker=FormatChecker()
        ).validate(fixture['data'])
        count += 1
    assert count, 'No contract fixtures found'
    tools = json.loads((ROOT / 'contracts/tool_contracts.json').read_text(encoding="utf-8"))
    assert tools['contract_version'] == spec['info']['version']
    def check_tool_refs(value):
        if isinstance(value, dict):
            ref = value.get('$ref', '')
            if ref.startswith('#/$defs/'):
                assert ref.split('/')[-1] in tools['$defs'], f'Missing tool schema: {ref}'
            for child in value.values():
                check_tool_refs(child)
        elif isinstance(value, list):
            for child in value:
                check_tool_refs(child)
    check_tool_refs(tools)
    print(f'{count} fixtures passed against OpenAPI {spec["info"]["version"]}')


if __name__ == '__main__':
    main()
