import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [sveltekit()],
    build: {
        cssMinify: 'lightningcss'
    },
    environments: {
        client: {
            build: {
                rollupOptions: {
                    output: {
                        manualChunks: {
                            'markdown-vendor': ['highlight.js/lib/core', 'marked', 'dompurify']
                        }
                    }
                }
            }
        }
    }
});
