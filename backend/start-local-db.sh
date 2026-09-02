#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── helpers ──────────────────────────────────────────────────────────────────

ensure_container() {
    local name="$1"; shift
    local state
    state=$(podman inspect --format '{{.State.Status}}' "$name" 2>/dev/null || echo "missing")

    case "$state" in
        running)
            echo "✓ $name is already running"
            return 0
            ;;
        exited|created|stopped)
            echo "→ Starting stopped container $name"
            podman start "$name"
            ;;
        *)
            echo "→ Creating container $name"
            # MSYS_NO_PATHCONV prevents Git Bash on Windows from mangling
            # Unix-style paths (e.g. /data → C:\Program Files\Git\data)
            MSYS_NO_PATHCONV=1 podman run -d --name "$name" "$@"
            ;;
    esac
}

wait_for() {
    local label="$1" cmd="$2" timeout="$3"
    local elapsed=0
    echo "⏳ Waiting for $label (up to ${timeout}s)..."
    while ! eval "$cmd" >/dev/null 2>&1; do
        sleep 2
        elapsed=$((elapsed + 2))
        if [ "$elapsed" -ge "$timeout" ]; then
            echo "✗ $label did not become ready within ${timeout}s"
            exit 1
        fi
    done
    echo "✓ $label is ready"
}

# ── PostgreSQL ───────────────────────────────────────────────────────────────

ensure_container ishqnama-db \
    -p 5432:5432 \
    -e POSTGRES_PASSWORD=postgres \
    docker.io/noormahdi/ishqnama-db:dev

# ── Cosmos DB Emulator ───────────────────────────────────────────────────────

ensure_container ishqnama-cosmos \
    -p 8081:8081 \
    -p 1234:1234 \
    -p 8080:8080 \
    -v ishqnama-cosmos-data:/data \
    -v "$SCRIPT_DIR/cosmos-init:/init:ro" \
    -e ENABLE_INIT_DATA=true \
    mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:vnext-latest \
    --protocol https

# ── Wait for readiness ───────────────────────────────────────────────────────

wait_for "PostgreSQL" "podman exec ishqnama-db pg_isready -q" 30
wait_for "Cosmos DB Emulator" "curl -sf http://localhost:8080/ready | grep -q '\"ready\": true'" 120
