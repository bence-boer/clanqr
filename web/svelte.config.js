import adapter from '@sveltejs/adapter-node';
import path from 'node:path';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    kit: {
        adapter: adapter({
            out: 'build'
        }),
        alias: {
            '@shared': path.resolve('../shared')
        }
    }
};

export default config;
