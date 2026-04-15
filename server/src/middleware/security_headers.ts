import { secureHeaders } from 'hono/secure-headers';

export const security_headers = secureHeaders({
    contentSecurityPolicy: {
        defaultSrc: ['\'self\''],
        scriptSrc: ['\'self\''],
        styleSrc: ['\'self\'', '\'unsafe-inline\''],
        imgSrc: ['\'self\'', 'data:', 'https:'],
        connectSrc: ['\'self\''],
        fontSrc: ['\'self\''],
        objectSrc: ['\'none\''],
        frameAncestors: ['\'none\'']
    },
    permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: []
    }
});
