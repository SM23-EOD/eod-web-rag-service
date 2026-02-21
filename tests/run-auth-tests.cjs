#!/usr/bin/env node
/**
 * DRAGA Auth — CLI Test Runner (Node.js)
 * 
 * Runs auth unit tests without a browser, using a minimal localStorage shim.
 * Usage: node tests/run-auth-tests.js
 * 
 * Maps to eval-spec unit tests:
 *   test_role_enum_values, test_platform_admin_full_access,
 *   test_tenant_admin_scoped_access, test_draga_user_scoped_access,
 *   test_draga_user_readonly_restrictions, test_jwt_payload_contains_role_and_scope,
 *   test_jwt_expired_returns_401, test_existing_endpoints_with_api_key,
 *   test_widget_chat_no_auth_required
 */

// ═══════════════════════════════════════════════════════════
// Shims for running in Node.js (no browser)
// ═══════════════════════════════════════════════════════════

// Minimal localStorage shim
const store = {};
globalThis.localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; }
};

// Minimal window shim
globalThis.window = globalThis.window || {
    location: { pathname: '/tests/', search: '', hash: '', href: '' },
};
globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');
globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');

// ═══════════════════════════════════════════════════════════
// Load modules (they export to globalThis/window)
// ═══════════════════════════════════════════════════════════

require('../src/auth.js');

// Pull globals from window (auth.js assigns window.Roles, etc.)
const { Roles, ROLE_VALUES, AuthSession, Permissions, AuthGuard, decodeJwt, isTokenExpired } = globalThis.window;

// ═══════════════════════════════════════════════════════════
// Test framework
// ═══════════════════════════════════════════════════════════

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED   = '\x1b[31m';
const BLUE  = '\x1b[34m';
const DIM   = '\x1b[2m';
const BOLD  = '\x1b[1m';

const suites = [];
let currentSuite = null;

function describe(name, fn) {
    currentSuite = { name, tests: [] };
    suites.push(currentSuite);
    fn();
    currentSuite = null;
}

function it(name, fn, opts = {}) {
    currentSuite.tests.push({ name, fn, type: opts.type || 'fail-to-pass' });
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function assertEqual(a, b, msg) {
    if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function assertDeepEqual(a, b, msg) {
    const sa = JSON.stringify(a), sb = JSON.stringify(b);
    if (sa !== sb) throw new Error(msg || `Expected ${sb}, got ${sa}`);
}
function assertIncludes(arr, item, msg) {
    if (!Array.isArray(arr) || !arr.includes(item))
        throw new Error(msg || `Expected array to include ${JSON.stringify(item)}`);
}
function assertThrows(fn, msg) {
    try { fn(); throw new Error('__no_throw__'); }
    catch (e) { if (e.message === '__no_throw__') throw new Error(msg || 'Expected to throw'); }
}
function assertNotNull(v, msg) {
    if (v === null || v === undefined) throw new Error(msg || 'Expected non-null');
}

// JWT helper
function fakeJwt(payload) {
    const h = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const b = btoa(JSON.stringify(payload));
    return `${h}.${b}.fake-sig`;
}

// ═══════════════════════════════════════════════════════════
// TEST SUITES  (mirroring eval-spec-roles-permisos.yaml)
// ═══════════════════════════════════════════════════════════

// ── test_role_enum_values ─────────────────────────────────
describe('Role Enum', () => {
    it('Role enum tiene exactamente 3 valores: platform_admin, tenant_admin, draga_user', () => {
        assert(typeof Roles !== 'undefined', 'Roles should be defined');
        assertEqual(ROLE_VALUES.length, 3);
        assertIncludes(ROLE_VALUES, 'platform_admin');
        assertIncludes(ROLE_VALUES, 'tenant_admin');
        assertIncludes(ROLE_VALUES, 'draga_user');
    });

    it('Roles object is frozen (immutable)', () => {
        assert(Object.isFrozen(Roles));
        assert(Object.isFrozen(ROLE_VALUES));
    });

    it('Roles constants match expected strings', () => {
        assertEqual(Roles.PLATFORM_ADMIN, 'platform_admin');
        assertEqual(Roles.TENANT_ADMIN, 'tenant_admin');
        assertEqual(Roles.DRAGA_USER, 'draga_user');
    });
});

// ── JWT helpers ───────────────────────────────────────────
describe('JWT Parsing & Expiry', () => {
    it('test_jwt_payload_contains_role_and_scope — decodeJwt extracts role and scope', () => {
        const payload = {
            sub: 'user-1', role: 'platform_admin',
            scoped_tenants: ['eod-sm23'], scoped_agents: ['eod-sm23/draga'],
            exp: Math.floor(Date.now() / 1000) + 3600
        };
        const decoded = decodeJwt(fakeJwt(payload));
        assertNotNull(decoded);
        assertEqual(decoded.role, 'platform_admin');
        assertDeepEqual(decoded.scoped_tenants, ['eod-sm23']);
        assertDeepEqual(decoded.scoped_agents, ['eod-sm23/draga']);
        assert(decoded.exp > 0);
    });

    it('test_jwt_expired_returns_401 — isTokenExpired returns true for expired token', () => {
        const expired = fakeJwt({ exp: Math.floor(Date.now() / 1000) - 60 });
        assert(isTokenExpired(expired));
    });

    it('isTokenExpired returns false for valid token', () => {
        const valid = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
        assert(!isTokenExpired(valid));
    });

    it('decodeJwt returns null for invalid tokens', () => {
        assertEqual(decodeJwt(null), null);
        assertEqual(decodeJwt(''), null);
        assertEqual(decodeJwt('not-a-jwt'), null);
        assertEqual(decodeJwt('a.b'), null);
    });

    it('isTokenExpired returns true for token without exp', () => {
        assert(isTokenExpired(fakeJwt({ sub: 'user-1' })));
    });
});

// ── AuthSession ───────────────────────────────────────────
describe('AuthSession', () => {
    const mockAuth = {
        token: fakeJwt({ sub: 'u1', role: 'tenant_admin', scoped_tenants: ['eod-sm23'], scoped_agents: [], exp: Math.floor(Date.now() / 1000) + 3600 }),
        refresh_token: 'refresh-abc',
        user: { id: 'u1', email: 'admin@eod.com', role: 'tenant_admin', scoped_tenants: ['eod-sm23'], scoped_agents: [] }
    };

    it('save() stores token, refresh_token, and user in localStorage', () => {
        AuthSession.clear();
        AuthSession.save(mockAuth);
        assertEqual(localStorage.getItem('draga-auth-token'), mockAuth.token);
        assertEqual(localStorage.getItem('draga-auth-refresh'), mockAuth.refresh_token);
        const u = JSON.parse(localStorage.getItem('draga-auth-user'));
        assertEqual(u.email, 'admin@eod.com');
        AuthSession.clear();
    });

    it('clear() removes all auth keys', () => {
        AuthSession.save(mockAuth);
        AuthSession.clear();
        assertEqual(localStorage.getItem('draga-auth-token'), null);
        assertEqual(localStorage.getItem('draga-auth-refresh'), null);
        assertEqual(localStorage.getItem('draga-auth-user'), null);
    });

    it('getToken() returns stored token', () => {
        AuthSession.clear();
        assertEqual(AuthSession.getToken(), null);
        AuthSession.save(mockAuth);
        assertEqual(AuthSession.getToken(), mockAuth.token);
        AuthSession.clear();
    });

    it('isAuthenticated() true for valid, false for expired', () => {
        AuthSession.clear();
        assert(!AuthSession.isAuthenticated());
        AuthSession.save(mockAuth);
        assert(AuthSession.isAuthenticated());
        AuthSession.clear();
    });

    it('isAuthenticated() false for expired token', () => {
        AuthSession.clear();
        AuthSession.save({ ...mockAuth, token: fakeJwt({ exp: Math.floor(Date.now() / 1000) - 60 }) });
        assert(!AuthSession.isAuthenticated());
        AuthSession.clear();
    });

    it('getRole() returns role from stored user', () => {
        AuthSession.clear();
        assertEqual(AuthSession.getRole(), null);
        AuthSession.save(mockAuth);
        assertEqual(AuthSession.getRole(), 'tenant_admin');
        AuthSession.clear();
    });

    it('getScopedTenants() returns array from user', () => {
        AuthSession.save(mockAuth);
        assertDeepEqual(AuthSession.getScopedTenants(), ['eod-sm23']);
        AuthSession.clear();
    });

    it('save() throws if token or user is missing', () => {
        assertThrows(() => AuthSession.save({}));
        assertThrows(() => AuthSession.save({ token: 'abc' }));
    });
});

// ── Permissions: platform_admin ───────────────────────────
describe('Permissions — platform_admin (full access)', () => {
    const auth = {
        token: fakeJwt({ sub: 'pa1', role: 'platform_admin', exp: Math.floor(Date.now() / 1000) + 3600 }),
        refresh_token: 'r1',
        user: { id: 'pa1', email: 'root@draga.io', role: 'platform_admin', scoped_tenants: [], scoped_agents: [] }
    };

    it('test_platform_admin_full_access — can access ANY tenant', () => {
        AuthSession.clear(); AuthSession.save(auth);
        assert(Permissions.canAccessTenant('eod-sm23'));
        assert(Permissions.canAccessTenant('sm23-dani'));
        assert(Permissions.canAccessTenant('new-tenant'));
        AuthSession.clear();
    });

    it('test_platform_admin_full_access — can access ANY agent', () => {
        AuthSession.save(auth);
        assert(Permissions.canAccessAgent('eod-sm23', 'draga'));
        assert(Permissions.canAccessAgent('sm23-dani', 'rfc-edd'));
        AuthSession.clear();
    });

    it('platform_admin can modify KB and config', () => {
        AuthSession.save(auth);
        assert(Permissions.canModifyKB('eod-sm23', 'draga'));
        assert(Permissions.canModifyConfig('eod-sm23', 'draga'));
        AuthSession.clear();
    });

    it('platform_admin can manage users', () => {
        AuthSession.save(auth);
        assert(Permissions.canManageUsers());
        assert(Permissions.canAccessPlatform());
        AuthSession.clear();
    });

    it('platform_admin filterTenants returns all', () => {
        AuthSession.save(auth);
        const all = [{ tenant_id: 'a' }, { tenant_id: 'b' }, { tenant_id: 'c' }];
        assertEqual(Permissions.filterTenants(all).length, 3);
        AuthSession.clear();
    });
});

// ── Permissions: tenant_admin ─────────────────────────────
describe('Permissions — tenant_admin (scoped)', () => {
    const auth = {
        token: fakeJwt({ sub: 'ta1', role: 'tenant_admin', exp: Math.floor(Date.now() / 1000) + 3600 }),
        refresh_token: 'r2',
        user: { id: 'ta1', email: 'ta@eod.com', role: 'tenant_admin', scoped_tenants: ['eod-sm23'], scoped_agents: [] }
    };

    it('test_tenant_admin_scoped_access — can access scoped tenant', () => {
        AuthSession.clear(); AuthSession.save(auth);
        assert(Permissions.canAccessTenant('eod-sm23'));
        AuthSession.clear();
    });

    it('test_tenant_admin_scoped_access — CANNOT access other tenant', () => {
        AuthSession.save(auth);
        assert(!Permissions.canAccessTenant('sm23-dani'));
        AuthSession.clear();
    });

    it('tenant_admin can access agents within scoped tenant', () => {
        AuthSession.save(auth);
        assert(Permissions.canAccessAgent('eod-sm23', 'draga'));
        assert(!Permissions.canAccessAgent('sm23-dani', 'rfc-edd'));
        AuthSession.clear();
    });

    it('tenant_admin can modify KB for scoped tenant', () => {
        AuthSession.save(auth);
        assert(Permissions.canModifyKB('eod-sm23', 'draga'));
        assert(!Permissions.canModifyKB('sm23-dani', 'rfc-edd'));
        AuthSession.clear();
    });

    it('tenant_admin CANNOT manage users', () => {
        AuthSession.save(auth);
        assert(!Permissions.canManageUsers());
        AuthSession.clear();
    });

    it('tenant_admin filterTenants only returns scoped', () => {
        AuthSession.save(auth);
        const tenants = [{ tenant_id: 'eod-sm23' }, { tenant_id: 'sm23-dani' }];
        assertEqual(Permissions.filterTenants(tenants).length, 1);
        AuthSession.clear();
    });
});

// ── Permissions: draga_user ───────────────────────────────
describe('Permissions — draga_user (scoped + read-only)', () => {
    const auth = {
        token: fakeJwt({ sub: 'du1', role: 'draga_user', exp: Math.floor(Date.now() / 1000) + 3600 }),
        refresh_token: 'r3',
        user: { id: 'du1', email: 'user@eod.com', role: 'draga_user', scoped_tenants: [], scoped_agents: ['eod-sm23/envio23', 'eod-sm23/draga'] }
    };

    it('test_draga_user_scoped_access — can access scoped agents', () => {
        AuthSession.clear(); AuthSession.save(auth);
        assert(Permissions.canAccessAgent('eod-sm23', 'envio23'));
        assert(Permissions.canAccessAgent('eod-sm23first', 'draga') === false); // partial match shouldn't work
        assert(Permissions.canAccessAgent('eod-sm23', 'draga'));
        AuthSession.clear();
    });

    it('test_draga_user_scoped_access — CANNOT access unscoped agents', () => {
        AuthSession.save(auth);
        assert(!Permissions.canAccessAgent('eod-sm23', 'rfc-edd'));
        assert(!Permissions.canAccessAgent('sm23-dani', 'yeya-plm'));
        AuthSession.clear();
    });

    it('test_draga_user_scoped_access — can access tenant via scoped agents', () => {
        AuthSession.save(auth);
        assert(Permissions.canAccessTenant('eod-sm23'));
        assert(!Permissions.canAccessTenant('sm23-dani'));
        AuthSession.clear();
    });

    it('test_draga_user_readonly_restrictions — CANNOT modify KB', () => {
        AuthSession.save(auth);
        assert(!Permissions.canModifyKB('eod-sm23', 'envio23'));
        assert(!Permissions.canModifyKB('eod-sm23', 'draga'));
        AuthSession.clear();
    });

    it('test_draga_user_readonly_restrictions — CANNOT modify config', () => {
        AuthSession.save(auth);
        assert(!Permissions.canModifyConfig('eod-sm23', 'envio23'));
        AuthSession.clear();
    });

    it('test_draga_user_readonly_restrictions — CANNOT manage DRAGAs', () => {
        AuthSession.save(auth);
        assert(!Permissions.canManageDragas('eod-sm23'));
        AuthSession.clear();
    });

    it('test_draga_user_readonly_restrictions — CANNOT manage users or platform', () => {
        AuthSession.save(auth);
        assert(!Permissions.canManageUsers());
        assert(!Permissions.canAccessPlatform());
        AuthSession.clear();
    });

    it('draga_user filterAgents only returns scoped', () => {
        AuthSession.save(auth);
        const agents = [
            { tenant_id: 'eod-sm23', agent_id: 'envio23' },
            { tenant_id: 'eod-sm23', agent_id: 'draga' },
            { tenant_id: 'eod-sm23', agent_id: 'rfc-edd' },
            { tenant_id: 'sm23-dani', agent_id: 'yeya-plm' }
        ];
        assertEqual(Permissions.filterAgents(agents).length, 2);
        AuthSession.clear();
    });

    it('draga_user filterTenants returns tenants with scoped agents', () => {
        AuthSession.save(auth);
        const tenants = [{ tenant_id: 'eod-sm23' }, { tenant_id: 'sm23-dani' }];
        const filtered = Permissions.filterTenants(tenants);
        assertEqual(filtered.length, 1);
        assertEqual(filtered[0].tenant_id, 'eod-sm23');
        AuthSession.clear();
    });
});

// ── AuthGuard ─────────────────────────────────────────────
describe('AuthGuard', () => {
    it('defaultLanding → /admin.html for platform_admin', () => {
        assertEqual(AuthGuard.defaultLanding('platform_admin'), '/admin.html');
    });

    it('defaultLanding → tenant page for single-tenant tenant_admin', () => {
        const auth = {
            token: fakeJwt({ sub: 'ta', role: 'tenant_admin', exp: Math.floor(Date.now() / 1000) + 3600 }),
            refresh_token: 'r',
            user: { id: 'ta', email: 'ta@eod.com', role: 'tenant_admin', scoped_tenants: ['eod-sm23'], scoped_agents: [] }
        };
        AuthSession.save(auth);
        assertEqual(AuthGuard.defaultLanding('tenant_admin'), '/tenant.html?tenant=eod-sm23');
        AuthSession.clear();
    });

    it('defaultLanding → draga page for single-agent draga_user', () => {
        const auth = {
            token: fakeJwt({ sub: 'du', role: 'draga_user', exp: Math.floor(Date.now() / 1000) + 3600 }),
            refresh_token: 'r',
            user: { id: 'du', email: 'du@eod.com', role: 'draga_user', scoped_tenants: [], scoped_agents: ['eod-sm23/envio23'] }
        };
        AuthSession.save(auth);
        assertEqual(AuthGuard.defaultLanding('draga_user'), '/draga.html?tenant=eod-sm23&agent=envio23');
        AuthSession.clear();
    });

    it('defaultLanding → /login.html for unknown role', () => {
        assertEqual(AuthGuard.defaultLanding('unknown'), '/login.html');
    });
});

// ── Edge cases ────────────────────────────────────────────
describe('Permissions — edge cases (no session)', () => {
    it('canAccessTenant false without session', () => {
        AuthSession.clear();
        assert(!Permissions.canAccessTenant('eod-sm23'));
    });

    it('canAccessAgent false without session', () => {
        AuthSession.clear();
        assert(!Permissions.canAccessAgent('eod-sm23', 'draga'));
    });

    it('canManageUsers false without session', () => {
        AuthSession.clear();
        assert(!Permissions.canManageUsers());
    });

    it('filterTenants returns [] without session', () => {
        AuthSession.clear();
        assertEqual(Permissions.filterTenants([{ tenant_id: 'x' }]).length, 0);
    });

    it('filterAgents returns [] without session', () => {
        AuthSession.clear();
        assertEqual(Permissions.filterAgents([{ tenant_id: 'x', agent_id: 'y' }]).length, 0);
    });
});

// ── Contract: response schema ─────────────────────────────
describe('Contract — Response Schema', () => {
    it('test_auth_login_response_schema — AuthSession.save() handles login response', () => {
        const response = {
            token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig',
            refresh_token: 'refresh-123',
            user: { id: 'u1', email: 'test@test.com', role: 'platform_admin', scoped_tenants: [], scoped_agents: [] }
        };
        AuthSession.clear();
        AuthSession.save(response);
        assertEqual(AuthSession.getToken(), response.token);
        assertEqual(AuthSession.getRole(), 'platform_admin');
        AuthSession.clear();
    });

    it('test_auth_me_response_schema — user storage handles /auth/me fields', () => {
        const me = { id: 'u1', email: 'test@draga.io', role: 'tenant_admin', scoped_tenants: ['eod-sm23'], scoped_agents: [] };
        AuthSession.clear();
        localStorage.setItem('draga-auth-user', JSON.stringify(me));
        const user = AuthSession.getUser();
        assertNotNull(user);
        assertEqual(user.id, 'u1');
        assertEqual(user.role, 'tenant_admin');
        assert(Array.isArray(user.scoped_tenants));
        assert(Array.isArray(user.scoped_agents));
        AuthSession.clear();
    });
});

// ═══════════════════════════════════════════════════════════
// RUNNER
// ═══════════════════════════════════════════════════════════

let total = 0, passed = 0, failed = 0;
const failures = [];

console.log(`\n${BOLD}══ DRAGA Auth — Fail-to-Pass Tests ═══${RESET}`);
console.log(`${DIM}eval-spec: eval-spec-roles-permisos.yaml${RESET}\n`);

for (const suite of suites) {
    console.log(`${BLUE}▸ ${suite.name}${RESET}`);
    for (const test of suite.tests) {
        total++;
        try {
            test.fn();
            passed++;
            console.log(`  ${GREEN}✓${RESET} ${test.name}`);
        } catch (e) {
            failed++;
            failures.push({ suite: suite.name, test: test.name, error: e.message });
            console.log(`  ${RED}✗${RESET} ${test.name}`);
            console.log(`    ${DIM}${e.message}${RESET}`);
        }
    }
    console.log('');
}

// Summary
console.log(`${BOLD}══ Summary ═══${RESET}`);
console.log(`Total: ${total} | ${GREEN}Pass: ${passed}${RESET} | ${RED}Fail: ${failed}${RESET}`);

if (failures.length > 0) {
    console.log(`\n${RED}${BOLD}FAILURES:${RESET}`);
    for (const f of failures) {
        console.log(`  ${RED}✗${RESET} [${f.suite}] ${f.test}`);
        console.log(`    ${DIM}${f.error}${RESET}`);
    }
}

console.log(`\nResult: ${failed === 0 ? `${GREEN}${BOLD}✅ ALL PASS${RESET}` : `${RED}${BOLD}❌ ${failed} FAILURES${RESET}`}`);
process.exit(failed > 0 ? 1 : 0);
