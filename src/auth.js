/**
 * DRAGA Platform Auth Module
 * 
 * Manages JWT sessions, role-based access control, and scope validation.
 * Works client-side — backend validates JWTs server-side.
 * 
 * Roles (3 levels matching platform hierarchy):
 *   platform_admin → full access to admin.html, all tenants, all DRAGAs
 *   tenant_admin   → access to tenant.html for assigned tenants + their DRAGAs
 *   draga_user     → access to specific DRAGAs only (chat, read-only)
 * 
 * Storage: JWT + refresh_token in localStorage under 'draga-auth-*' keys.
 * Backwards compat: existing X-API-Key auth continues to work.
 */

// ── Role enum ────────────────────────────────────────────────

const Roles = Object.freeze({
    PLATFORM_ADMIN: 'platform_admin',
    TENANT_ADMIN: 'tenant_admin',
    DRAGA_USER: 'draga_user',
});

const ROLE_VALUES = Object.freeze([Roles.PLATFORM_ADMIN, Roles.TENANT_ADMIN, Roles.DRAGA_USER]);

// ── JWT helpers ──────────────────────────────────────────────

/**
 * Decode a JWT payload without verification (client-side only).
 * Server MUST validate signature — this is for UI routing only.
 * @param {string} token 
 * @returns {object|null} decoded payload or null if invalid
 */
function decodeJwt(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
        const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(payload));
    } catch {
        return null;
    }
}

/**
 * Check if a JWT is expired.
 * @param {string} token 
 * @returns {boolean} true if expired or invalid
 */
function isTokenExpired(token) {
    const payload = decodeJwt(token);
    if (!payload || !payload.exp) return true;
    // exp is unix timestamp in seconds
    return Date.now() >= payload.exp * 1000;
}

// ── Session management ───────────────────────────────────────

const STORAGE_KEYS = Object.freeze({
    TOKEN: 'draga-auth-token',
    REFRESH: 'draga-auth-refresh',
    USER: 'draga-auth-user',
});

class AuthSession {
    /**
     * Save auth tokens and user profile after login.
     * @param {{ token: string, refresh_token: string, user: object }} authResponse
     */
    static save(authResponse) {
        if (!authResponse) throw new Error('Auth response is required');
        if (!authResponse.token) throw new Error('Token is required');
        if (!authResponse.user) throw new Error('User data is required');
        localStorage.setItem(STORAGE_KEYS.TOKEN, authResponse.token);
        if (authResponse.refresh_token) {
            localStorage.setItem(STORAGE_KEYS.REFRESH, authResponse.refresh_token);
        }
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(authResponse.user));
    }

    /** Clear all auth data from localStorage. */
    static clear() {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.REFRESH);
        localStorage.removeItem(STORAGE_KEYS.USER);
    }

    /** @returns {string|null} current JWT or null */
    static getToken() {
        return localStorage.getItem(STORAGE_KEYS.TOKEN) || null;
    }

    /** @returns {string|null} current refresh token or null */
    static getRefreshToken() {
        return localStorage.getItem(STORAGE_KEYS.REFRESH) || null;
    }

    /** @returns {object|null} stored user profile or null */
    static getUser() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.USER);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    /** @returns {boolean} true if there is a non-expired token */
    static isAuthenticated() {
        const token = this.getToken();
        return token !== null && !isTokenExpired(token);
    }

    /** @returns {string|null} role from stored user profile */
    static getRole() {
        const user = this.getUser();
        return user?.role || null;
    }

    /** @returns {string[]} scoped tenant IDs for this user */
    static getScopedTenants() {
        const user = this.getUser();
        return Array.isArray(user?.scoped_tenants) ? user.scoped_tenants : [];
    }

    /** @returns {string[]} scoped agent IDs (format: "tenant_id/agent_id") */
    static getScopedAgents() {
        const user = this.getUser();
        return Array.isArray(user?.scoped_agents) ? user.scoped_agents : [];
    }
}

// ── Permission checks ────────────────────────────────────────

class Permissions {
    /**
     * Check if user can access a specific tenant.
     * @param {string} tenantId 
     * @returns {boolean}
     */
    static canAccessTenant(tenantId) {
        const role = AuthSession.getRole();
        if (!role) return false;
        if (role === Roles.PLATFORM_ADMIN) return true;
        if (role === Roles.TENANT_ADMIN) {
            return AuthSession.getScopedTenants().includes(tenantId);
        }
        if (role === Roles.DRAGA_USER) {
            // draga_user can access a tenant if they have any agent scoped under it
            return AuthSession.getScopedAgents().some(s => s.startsWith(`${tenantId}/`));
        }
        return false;
    }

    /**
     * Check if user can access a specific DRAGA.
     * @param {string} tenantId 
     * @param {string} agentId 
     * @returns {boolean}
     */
    static canAccessAgent(tenantId, agentId) {
        const role = AuthSession.getRole();
        if (!role) return false;
        if (role === Roles.PLATFORM_ADMIN) return true;
        if (role === Roles.TENANT_ADMIN) {
            return AuthSession.getScopedTenants().includes(tenantId);
        }
        if (role === Roles.DRAGA_USER) {
            return AuthSession.getScopedAgents().includes(`${tenantId}/${agentId}`);
        }
        return false;
    }

    /**
     * Check if user can modify KB (upload docs, delete docs, re-index).
     * Only platform_admin and tenant_admin can modify KB.
     * @param {string} tenantId 
     * @param {string} agentId 
     * @returns {boolean}
     */
    static canModifyKB(tenantId, agentId) {
        const role = AuthSession.getRole();
        if (!role) return false;
        if (role === Roles.PLATFORM_ADMIN) return true;
        if (role === Roles.TENANT_ADMIN) {
            return AuthSession.getScopedTenants().includes(tenantId);
        }
        // draga_user CANNOT modify KB
        return false;
    }

    /**
     * Check if user can modify DRAGA config (settings, labels, pipeline).
     * Only platform_admin and tenant_admin can modify config.
     * @param {string} tenantId 
     * @param {string} agentId 
     * @returns {boolean}
     */
    static canModifyConfig(tenantId, agentId) {
        return this.canModifyKB(tenantId, agentId); // same permission level
    }

    /**
     * Check if user can create/delete DRAGAs.
     * Only platform_admin and tenant_admin for their scope.
     * @param {string} tenantId 
     * @returns {boolean}
     */
    static canManageDragas(tenantId) {
        return this.canModifyKB(tenantId, null);
    }

    /**
     * Check if user can manage users (CRUD, invite, role assignment).
     * Only platform_admin.
     * @returns {boolean}
     */
    static canManageUsers() {
        return AuthSession.getRole() === Roles.PLATFORM_ADMIN;
    }

    /**
     * Check if user can access the platform admin dashboard.
     * Only platform_admin.
     * @returns {boolean}
     */
    static canAccessPlatform() {
        return AuthSession.getRole() === Roles.PLATFORM_ADMIN;
    }

    /**
     * Filter a list of tenants to only those the user can access.
     * @param {Array} tenants - array of tenant objects with tenant_id
     * @returns {Array} filtered tenants
     */
    static filterTenants(tenants) {
        const role = AuthSession.getRole();
        if (role === Roles.PLATFORM_ADMIN) return tenants;
        if (role === Roles.TENANT_ADMIN) {
            const scoped = AuthSession.getScopedTenants();
            return tenants.filter(t => scoped.includes(t.tenant_id));
        }
        if (role === Roles.DRAGA_USER) {
            const scopedAgents = AuthSession.getScopedAgents();
            const tenantIds = [...new Set(scopedAgents.map(s => s.split('/')[0]))];
            return tenants.filter(t => tenantIds.includes(t.tenant_id));
        }
        return [];
    }

    /**
     * Filter a list of agents to only those the user can access.
     * @param {Array} agents - array of agent objects with tenant_id and agent_id
     * @returns {Array} filtered agents
     */
    static filterAgents(agents) {
        const role = AuthSession.getRole();
        if (role === Roles.PLATFORM_ADMIN) return agents;
        if (role === Roles.TENANT_ADMIN) {
            const scoped = AuthSession.getScopedTenants();
            return agents.filter(a => scoped.includes(a.tenant_id));
        }
        if (role === Roles.DRAGA_USER) {
            const scopedAgents = AuthSession.getScopedAgents();
            return agents.filter(a => scopedAgents.includes(`${a.tenant_id}/${a.agent_id}`));
        }
        return [];
    }
}

// ── Auth Guard ───────────────────────────────────────────────

class AuthGuard {
    /**
     * Require authentication. Redirects to login if not authenticated.
     * Call at page load in each protected page.
     * @param {object} options
     * @param {string} [options.requiredRole] - minimum role required
     * @param {string} [options.tenantId] - required tenant access
     * @param {string} [options.agentId] - required agent access (with tenantId)
     * @param {string} [options.loginUrl] - redirect URL (default: '/login.html')
     * @returns {boolean} true if access granted, false if redirecting
     */
    static require(options = {}) {
        const { requiredRole, tenantId, agentId, loginUrl = '/login.html' } = options;

        // Check authentication
        if (!AuthSession.isAuthenticated()) {
            const returnUrl = window.location.pathname + window.location.search + window.location.hash;
            window.location.href = `${loginUrl}?return=${encodeURIComponent(returnUrl)}`;
            return false;
        }

        const role = AuthSession.getRole();

        // Check role requirement
        if (requiredRole) {
            const hierarchy = [Roles.DRAGA_USER, Roles.TENANT_ADMIN, Roles.PLATFORM_ADMIN];
            const userLevel = hierarchy.indexOf(role);
            const requiredLevel = hierarchy.indexOf(requiredRole);
            if (userLevel < requiredLevel) {
                window.location.href = `${loginUrl}?error=forbidden`;
                return false;
            }
        }

        // Check tenant access
        if (tenantId && !Permissions.canAccessTenant(tenantId)) {
            window.location.href = `${loginUrl}?error=forbidden`;
            return false;
        }

        // Check agent access
        if (tenantId && agentId && !Permissions.canAccessAgent(tenantId, agentId)) {
            window.location.href = `${loginUrl}?error=forbidden`;
            return false;
        }

        return true;
    }

    /**
     * Get the default landing page for a role after login.
     * @param {string} role 
     * @returns {string} URL to redirect to
     */
    static defaultLanding(role) {
        switch (role) {
            case Roles.PLATFORM_ADMIN:
                return '/admin.html';
            case Roles.TENANT_ADMIN: {
                const tenants = AuthSession.getScopedTenants();
                return tenants.length === 1
                    ? `/tenant.html?tenant=${tenants[0]}`
                    : '/admin.html';
            }
            case Roles.DRAGA_USER: {
                const agents = AuthSession.getScopedAgents();
                if (agents.length === 1) {
                    const [tid, aid] = agents[0].split('/');
                    return `/draga.html?tenant=${tid}&agent=${aid}`;
                }
                const tenants = [...new Set(agents.map(s => s.split('/')[0]))];
                return tenants.length === 1
                    ? `/tenant.html?tenant=${tenants[0]}`
                    : '/admin.html';
            }
            default:
                return '/login.html';
        }
    }
}

// ── Exports (module-compatible + global) ─────────────────────

// Make available globally for non-module scripts
window.Roles = Roles;
window.ROLE_VALUES = ROLE_VALUES;
window.AuthSession = AuthSession;
window.Permissions = Permissions;
window.AuthGuard = AuthGuard;
window.decodeJwt = decodeJwt;
window.isTokenExpired = isTokenExpired;
