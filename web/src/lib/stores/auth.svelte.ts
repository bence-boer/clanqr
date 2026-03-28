import { check_auth, login_github, logout, type AuthStatus } from '$lib/auth';

type AuthState = 'loading' | 'unauthenticated' | 'redirecting' | 'authenticated' | 'error';

class AuthStore {
    state: AuthState = $state('loading');
    error: string | null = $state(null);
    role: string | null = $state(null);
    user_id: string | null = $state(null);
    user: AuthStatus['user'] = $state(null);
    pending = $state(false);
    is_admin = $derived(this.role === 'admin');

    async check() {
        this.state = 'loading';
        this.error = null;
        try {
            const status = await check_auth();
            if (status.authenticated && status.user) {
                this.state = 'authenticated';
                this.role = status.user.role;
                this.user_id = status.user.id;
                this.user = status.user;
            }
            else {
                this.state = 'unauthenticated';
                this.role = null;
                this.user_id = null;
                this.user = null;
            }
        }
        catch (err) {
            this.state = 'error';
            this.error = err instanceof Error ? err.message : 'Auth check failed';
        }
    }

    login() {
        this.state = 'redirecting';
        this.pending = true;
        login_github();
    }

    async sign_out() {
        try {
            await logout();
        }
        finally {
            this.state = 'unauthenticated';
            this.role = null;
            this.user_id = null;
            this.user = null;
            this.pending = false;
            this.error = null;
        }
    }

    reset() {
        this.state = 'unauthenticated';
        this.role = null;
        this.user_id = null;
        this.user = null;
        this.pending = false;
        this.error = null;
    }
}

export const auth_store = new AuthStore();
