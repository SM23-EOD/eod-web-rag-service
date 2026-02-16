#!/bin/bash
# Integration test suite for backend PR #261 fixes
# Tests bugs #252, #253, #254, #255

BASE="http://167.172.225.44/api/v2"
TENANT="envios23"
PASS=0
FAIL=0
RESULTS=""

test_endpoint() {
    local label="$1"
    local method="$2"
    local url="$3"
    local data="$4"
    local expect_code="${5:-200}"

    if [ -n "$data" ]; then
        HTTP=$(curl -sS -o /tmp/test_resp.json -w "%{http_code}" --connect-timeout 10 --max-time 45 \
            -X "$method" "$url" -H "Content-Type: application/json" -d "$data" 2>/dev/null)
    else
        HTTP=$(curl -sS -o /tmp/test_resp.json -w "%{http_code}" --connect-timeout 10 --max-time 45 \
            -X "$method" "$url" 2>/dev/null)
    fi

    BODY=$(cat /tmp/test_resp.json 2>/dev/null)
    HAS_ERROR=$(echo "$BODY" | python3 -c "import json,sys;d=json.load(sys.stdin);print('ERROR' if 'detail' in d and ('500' in str(d) or 'error' in str(d.get('detail','')).lower() or 'not found' in str(d.get('detail','')).lower()) else 'OK')" 2>/dev/null || echo "PARSE_ERROR")

    if [ "$HTTP" = "$expect_code" ] && [ "$HAS_ERROR" != "ERROR" ]; then
        echo "  ✅ PASS  $label  (HTTP $HTTP)"
        PASS=$((PASS + 1))
        RESULTS+="PASS|$label|$HTTP\n"
    else
        echo "  ❌ FAIL  $label  (HTTP $HTTP, expected $expect_code)"
        echo "         Body: $(echo "$BODY" | head -c 200)"
        FAIL=$((FAIL + 1))
        RESULTS+="FAIL|$label|$HTTP\n"
    fi
}

echo "══════════════════════════════════════════════════"
echo "  INTEGRATION TEST SUITE — PR #261 Bug Fixes"
echo "  Backend: $BASE"
echo "  Tenant:  $TENANT"
echo "  Date:    $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "══════════════════════════════════════════════════"
echo ""

# ── Bug #255: Chat/RAG Retrieval ──────────────────────
echo "▸ Bug #255: Chat/RAG Retrieval"
test_endpoint \
    "POST /query (direct retrieval)" \
    "POST" "$BASE/query" \
    "{\"query\":\"requisitos para enviar paquetes\",\"tenant_id\":\"$TENANT\",\"top_k\":5}"

test_endpoint \
    "POST /chat/completions (v2)" \
    "POST" "$BASE/chat/completions" \
    "{\"messages\":[{\"role\":\"user\",\"content\":\"Hola, que servicios ofrecen?\"}],\"tenant_id\":\"$TENANT\"}"

test_endpoint \
    "POST /v1/chat/completions (OpenAI)" \
    "POST" "http://167.172.225.44/api/v1/chat/completions" \
    "{\"model\":\"envios23\",\"messages\":[{\"role\":\"user\",\"content\":\"Hola\"}]}"

echo ""

# ── Bug #254: Document Management ─────────────────────
echo "▸ Bug #254: Document Management Methods"
test_endpoint \
    "POST /documents/process-pending" \
    "POST" "$BASE/documents/process-pending?tenant_id=$TENANT"

test_endpoint \
    "POST /documents/reset-reindex" \
    "POST" "$BASE/documents/reset-reindex?tenant_id=$TENANT"

test_endpoint \
    "POST /documents/sync/directory" \
    "POST" "$BASE/documents/sync/directory?directory=/app/storage&tenant_id=$TENANT"

test_endpoint \
    "POST /documents/maintenance/cleanup" \
    "POST" "$BASE/documents/maintenance/cleanup-pending-deletes?tenant_id=$TENANT"

# Get first doc ID for reindex test
DOC_ID=$(curl -sS "$BASE/documents?tenant_id=$TENANT" 2>/dev/null | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['documents'][0]['document_id'])" 2>/dev/null)
if [ -n "$DOC_ID" ]; then
    test_endpoint \
        "POST /documents/{id}/reindex" \
        "POST" "$BASE/documents/${DOC_ID}/reindex?tenant_id=$TENANT"
fi

echo ""

# ── Bug #252: Feedback (asyncpg) ──────────────────────
echo "▸ Bug #252: Feedback (asyncpg event loop)"
test_endpoint \
    "POST /feedback" \
    "POST" "$BASE/feedback" \
    "{\"query\":\"test integration\",\"response\":\"test response\",\"rating\":\"positive\",\"tenant_id\":\"$TENANT\",\"session_id\":\"test-integration-$(date +%s)\"}"

test_endpoint \
    "GET /feedback" \
    "GET" "$BASE/feedback?limit=5"

test_endpoint \
    "GET /feedback/stats" \
    "GET" "$BASE/feedback/stats"

echo ""

# ── Bug #253: Metrics/Gaps ────────────────────────────
echo "▸ Bug #253: Metrics/Gaps (event loop)"
test_endpoint \
    "GET /metrics/dashboard" \
    "GET" "$BASE/metrics/dashboard?tenant_id=$TENANT"

test_endpoint \
    "GET /metrics/coverage" \
    "GET" "$BASE/metrics/coverage?tenant_id=$TENANT"

test_endpoint \
    "GET /metrics/gaps" \
    "GET" "$BASE/metrics/gaps?tenant_id=$TENANT"

test_endpoint \
    "GET /metrics/grounding" \
    "GET" "$BASE/metrics/grounding?tenant_id=$TENANT"

test_endpoint \
    "GET /metrics/operational" \
    "GET" "$BASE/metrics/operational?tenant_id=$TENANT"

echo ""

# ── Additional endpoints ──────────────────────────────
echo "▸ Additional endpoints"
test_endpoint \
    "GET /health" \
    "GET" "$BASE/health"

test_endpoint \
    "GET /health/deep" \
    "GET" "$BASE/health/deep"

test_endpoint \
    "GET /tenants" \
    "GET" "$BASE/tenants"

test_endpoint \
    "GET /documents" \
    "GET" "$BASE/documents?tenant_id=$TENANT"

test_endpoint \
    "GET /stats" \
    "GET" "$BASE/stats?tenant_id=$TENANT"

test_endpoint \
    "GET /quality/summary" \
    "GET" "$BASE/quality/$TENANT/summary"

test_endpoint \
    "GET /quality/recent" \
    "GET" "$BASE/quality/$TENANT/recent"

test_endpoint \
    "GET /conversations" \
    "GET" "$BASE/conversations?tenant_id=$TENANT"

echo ""
echo "══════════════════════════════════════════════════"
echo "  RESULTS: $PASS PASS / $FAIL FAIL / $((PASS + FAIL)) total"
echo "══════════════════════════════════════════════════"

# Check retrieval quality (Bug #255 deep test)
echo ""
echo "▸ Bug #255: Retrieval quality check"
CHUNKS=$(curl -sS --max-time 45 -X POST "$BASE/query" \
    -H "Content-Type: application/json" \
    -d "{\"query\":\"requisitos envio Cuba\",\"tenant_id\":\"$TENANT\",\"top_k\":5}" 2>/dev/null \
    | python3 -c "import json,sys;d=json.load(sys.stdin);print(f'chunks={len(d.get(\"retrieved_chunks\",[]))} sources={len(d.get(\"sources\",[]))} confidence={d.get(\"confidence\",0)}')" 2>/dev/null)
echo "  Retrieval: $CHUNKS"

VCHUNKS=$(curl -sS "$BASE/stats?tenant_id=$TENANT" 2>/dev/null \
    | python3 -c "import json,sys;d=json.load(sys.stdin);print(f'vector_chunks={d[\"vector_database\"][\"total_chunks\"]} collection={d[\"vector_database\"][\"collection_name\"]}')" 2>/dev/null)
echo "  Vector DB: $VCHUNKS"
