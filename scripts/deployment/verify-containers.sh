#!/usr/bin/env bash
# Local-only integration; isolated database. Never reads repository .env files.
set -euo pipefail
cd "$(dirname "$0")/../.."
fixture_dir=$(mktemp -d /tmp/airiane-runtime.XXXXXX)
network="airiane-runtime-check-$$"
cleanup(){
 docker rm -f airiane-check-gateway airiane-check-portal airiane-check-api airiane-check-db airiane-check-pdf >/dev/null 2>&1 || true
 docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT
for name in airiane-check-gateway airiane-check-portal airiane-check-api airiane-check-db airiane-check-pdf; do
 if docker container inspect "$name" >/dev/null 2>&1; then echo 'Existing verification containers found; refusing to modify them.' >&2; trap - EXIT; exit 1; fi
done
uv run --directory backend python ../scripts/deployment/fixtures.py "$fixture_dir"
docker network create "$network" >/dev/null
docker run --rm -v "$fixture_dir:/fixtures" --entrypoint sh postgres:16 -c 'chown 999:999 /fixtures/pg.key && chmod 600 /fixtures/pg.key'
docker run -d --name airiane-check-db --network "$network" --network-alias pg.fixture.test -e POSTGRES_USER=re -e POSTGRES_PASSWORD=local_container_fixture -e POSTGRES_DB=re_test -p 127.0.0.1::5432 -v "$fixture_dir:/fixtures:ro" postgres:16 -c ssl=on -c ssl_cert_file=/fixtures/pg.crt -c ssl_key_file=/fixtures/pg.key >/dev/null
for attempt in $(seq 1 40);do if docker exec airiane-check-db pg_isready -h 127.0.0.1 -U re -d re_test >/dev/null 2>&1;then break;fi;sleep 1;done
if ! docker exec airiane-check-db pg_isready -h 127.0.0.1 -U re -d re_test >/dev/null 2>&1;then docker logs --tail 20 airiane-check-db;exit 1;fi
docker run -d --name airiane-check-api --network "$network" --network-alias airiane-api --env-file "$fixture_dir/api.env" -v "$fixture_dir:/fixtures:ro" airiane-api:deployment-check >/dev/null
# All migrations are explicit, only against pg.fixture.test. Second execution must be a no-op.
for migration in 0001_baseline.sql 0002_confirmed_insights.sql 0003_clinical_questionnaires.sql 0004_medication_reminders.sql;do
 docker exec airiane-check-api python -m app.migrate --migration "$migration"
 docker exec airiane-check-api python -m app.migrate --migration "$migration"
done
docker exec airiane-check-api python -m app.seed_catalog
docker run --rm --network "$network" --env-file "$fixture_dir/api.env" -v "$fixture_dir:/fixtures:ro" -v "$PWD/scripts/deployment:/checks:ro" -e PYTHONPATH=/app/backend --entrypoint python airiane-api:deployment-check /checks/seed_fixture.py
docker run -d --name airiane-check-portal --network "$network" --network-alias airiane-portal --env-file "$fixture_dir/portal.env" -v "$fixture_dir:/fixtures:ro" airiane-portal:deployment-check >/dev/null
docker run -d --user 0 --name airiane-check-gateway --network "$network" --network-alias api.fixture.test --network-alias portal.fixture.test --network-alias auth.fixture.test -p 127.0.0.1:9443:443 -v "$fixture_dir:/fixtures" -v "$PWD/scripts/deployment:/checks:ro" --entrypoint python airiane-api:deployment-check /checks/gateway.py >/dev/null
for attempt in $(seq 1 30);do if docker exec airiane-check-gateway python -c "import ssl,urllib.request;urllib.request.urlopen('https://portal.fixture.test/health/live',context=ssl.create_default_context(cafile='/fixtures/ca.pem'),timeout=2)" >/dev/null 2>&1;then break;fi;sleep 1;done
docker exec airiane-check-gateway python /checks/verify.py
# Network fixture credentials must never appear in app logs.
for container in airiane-check-api airiane-check-portal;do
 docker logs "$container" > "$fixture_dir/$container.log" 2>&1
 if grep -F -e local_container_fixture -e local-fixture-password -e fixture-no-provider-calls "$fixture_dir/$container.log" >/dev/null;then echo 'Sensitive fixture value appeared in app logs' >&2;exit 1;fi
done
docker run --rm --network "$network" --env-file "$fixture_dir/api.env" -e PYTHONPATH=/app/backend -v "$fixture_dir:/fixtures:ro" -v "$PWD/scripts/deployment:/checks:ro" --entrypoint python airiane-api:deployment-check /checks/tls_and_migrations.py
test_db_port=$(docker port airiane-check-db 5432/tcp | sed 's/.*://')
[[ "$test_db_port" =~ ^[0-9]+$ ]]
RE_ENVIRONMENT=development RE_SUPABASE_URL='' RE_ELEVENLABS_API_KEY='' TEST_DATABASE_URL="postgresql+asyncpg://re:local_container_fixture@127.0.0.1:$test_db_port/re_test?sslmode=verify-full&sslrootcert=$fixture_dir/ca.pem" uv run --directory backend pytest -q --tb=short -x
mkdir -p docs/deployment/verification
python3 - "$fixture_dir/result.json" docs/deployment/verification/containers.json <<'PYCODE'
import json,sys
from pathlib import Path
p=Path(sys.argv[1]);v=json.loads(p.read_text());v.update(untrusted_ca_rejected=True,wrong_hostname_rejected=True,migration_checksum_drift_rejected=True,existing_untracked_schema_reapply_rejected=True,local_explicit_adoption_test_rolled_back=True,no_known_fixture_secrets_in_app_logs=True);Path(sys.argv[2]).write_text(json.dumps(v,indent=2)+'\n')
PYCODE
# Renderer test has no network, no database and no embedded test PDFs in its image.
docker run --name airiane-check-pdf --memory=1g --cpus=1 --network none -e PYTHONPATH=/app/backend -v "$PWD/scripts/deployment:/checks:ro" --entrypoint sh airiane-api:deployment-check -c 'python -m app.reports.examples --output /tmp/fictional-pdfs && python /checks/pdf_stress.py'
mkdir -p /tmp/airiane-container-pdfs
docker cp airiane-check-pdf:/tmp/fictional-pdfs/. /tmp/airiane-container-pdfs/
cp /tmp/airiane-container-pdfs/large-check.json docs/deployment/verification/pdf-memory.json
docker rm airiane-check-pdf >/dev/null
docker stats --no-stream --format '{{.Name}} {{.MemUsage}}' airiane-check-api airiane-check-portal > docs/deployment/verification/memory.txt
docker stop --time 35 airiane-check-api airiane-check-portal >/dev/null
docker inspect --format '{{.Name}} exit={{.State.ExitCode}}' airiane-check-api airiane-check-portal > docs/deployment/verification/shutdown.txt
rm -rf "$fixture_dir"
printf 'Local fixture checks passed; short-lived private keys removed. Synthetic PDFs: /tmp/airiane-container-pdfs.\n'
