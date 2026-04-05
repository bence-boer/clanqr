import type { HandleClientError } from '@sveltejs/kit';

export const handleError: HandleClientError = ({ error, status, message }) => {
    console.error('[Unhandled client error]', { status, message, error });

    return {
        message: 'An unexpected error occurred'
    };
};
