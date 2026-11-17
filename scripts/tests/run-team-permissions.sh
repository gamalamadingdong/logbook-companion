#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
container="lc-team-permissions-$$"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run --rm -d --name "$container" -e POSTGRES_PASSWORD=local-test postgres:16-alpine >/dev/null
for attempt in {1..30}; do
 if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
 sleep 1
done
for sql in scripts/tests/team_permissions_fixture.sql supabase/migrations/20261116215714_team_seasons_and_rosters.sql supabase/migrations/20261117010000_team_admin_and_coxswain_access.sql scripts/tests/team_permissions.sql; do
 docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < "$sql"
done
