import { check_auth, register_passkey, login_passkey, logout } from "$lib/auth";
import type { AuthStatus } from "$lib/auth";

export type AuthState = "loading" | "setup" | "login" | "authenticated" | "error";

class AuthStore {
    state: AuthState = $state("loading");
    error: string = $state("");
    role: string | null = $state(null);
    passkey_id: string | null = $state(null);

    is_admin = $derived(this.role === "admin");

    async check(is_invite_page: boolean): Promise<void> {
        if (is_invite_page) {
            this.state = "authenticated";
            return;
        }
        try {
            const status: AuthStatus = await check_auth();
            if (status.authenticated) {
                this.role = status.role;
                this.passkey_id = status.passkey_id;
                this.state = "authenticated";
            } else if (!status.is_setup) {
                this.state = "setup";
            } else {
                this.state = "login";
            }
        } catch (err) {
            console.error("Auth check failed:", err);
            this.state = "error";
        }
    }

    async register(display_name: string): Promise<boolean> {
        this.error = "";
        try {
            const ok = await register_passkey(display_name || "Admin");
            if (ok) this.state = "authenticated";
            return ok;
        } catch (err: any) {
            this.error = err.message;
            return false;
        }
    }

    async login(): Promise<boolean> {
        this.error = "";
        try {
            const ok = await login_passkey();
            if (ok) {
                const status = await check_auth();
                this.role = status.role;
                this.passkey_id = status.passkey_id;
                this.state = "authenticated";
            }
            return ok;
        } catch (err: any) {
            this.error = err.message;
            return false;
        }
    }

    async sign_out(): Promise<void> {
        await logout();
        this.role = null;
        this.passkey_id = null;
        this.state = "login";
    }
}

export const auth_store = new AuthStore();
