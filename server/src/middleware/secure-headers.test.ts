import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { security_headers } from './security_headers';

describe('secure headers middleware', () => {
    const app = new Hono();
    app.use('*', security_headers);
    app.get('/test', (c) => c.json({ ok: true }));

    it('includes Content-Security-Policy header with default-src self', async () => {
        const res = await app.request('/test');
        const csp = res.headers.get('Content-Security-Policy');
        expect(csp).toBeTruthy();
        expect(csp).toContain('default-src \'self\'');
    });

    it('includes X-Frame-Options header', async () => {
        const res = await app.request('/test');
        expect(res.headers.get('X-Frame-Options')).toBeTruthy();
    });

    it('includes X-Content-Type-Options header', async () => {
        const res = await app.request('/test');
        expect(res.headers.get('X-Content-Type-Options')).toBeTruthy();
    });

    it('includes CSP script-src and style-src directives', async () => {
        const res = await app.request('/test');
        const csp = res.headers.get('Content-Security-Policy') ?? '';
        expect(csp).toContain('script-src \'self\'');
        expect(csp).toContain('style-src \'self\' \'unsafe-inline\'');
    });

    it('includes CSP object-src none directive', async () => {
        const res = await app.request('/test');
        const csp = res.headers.get('Content-Security-Policy') ?? '';
        expect(csp).toContain('object-src \'none\'');
    });
});
