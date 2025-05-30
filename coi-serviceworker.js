/*! coi-serviceworker v0.1.6 - Guido Zuidhof, licensed under MIT */
let coepCredentialless = false;
if (typeof window === 'undefined') {
    self.addEventListener('install', () => self.skipWaiting());
    self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

    self.addEventListener('message', ev => {
        if (!ev.data) {
            return;
        } else if (ev.data.type === 'deregister') {
            self.registration
                .unregister()
                .then(() => self.clients.matchAll())
                .then(clients => {
                    clients.forEach(client => client.navigate(client.url));
                });
        } else if (ev.data.type === 'coepCredentialless') {
            coepCredentialless = ev.data.value;
        }
    });

    self.addEventListener('fetch', function(event) {
        const request = event.request;
        if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') {
            return;
        }

        const credentials = coepCredentialless ? 'omit' : 'same-origin';
        
        event.respondWith(
            fetch(request, { credentials })
                .then(response => {
                    if (response.status === 0) {
                        return response;
                    }

                    const newHeaders = new Headers(response.headers);
                    newHeaders.set('Cross-Origin-Embedder-Policy', coepCredentialless ? 'credentialless' : 'require-corp');
                    newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

                    return new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: newHeaders,
                    });
                })
                .catch(e => console.error(e))
        );
    });

} else {
    (() => {
        // You can customize the behavior of this script through these variables
        const coi = {
            shouldRegister: () => true,
            shouldDeregister: () => false,
            coepCredentialless: () => false,
            doReload: () => window.location.reload(),
            quiet: false,
        };

        const n = navigator;
        
        if (n.serviceWorker && n.serviceWorker.controller) {
            n.serviceWorker.controller.postMessage({
                type: 'coepCredentialless',
                value: coi.coepCredentialless(),
            });

            if (coi.shouldDeregister()) {
                n.serviceWorker.controller.postMessage({ type: 'deregister' });
            }
        }

        // If we're already coi: do nothing. Perhaps it's due to this script doing its job, or COOP/COEP are
        // already set from the server/worker side.
        if (window.crossOriginIsolated !== false) {
            if (!coi.quiet) console.log('Already cross-origin isolated.');
            return;
        }

        if (!coi.shouldRegister()) {
            if (!coi.quiet) console.log('Skipping registration as per shouldRegister() hook.');
            return;
        }

        if (!n.serviceWorker) {
            console.error('Service workers are not supported in this browser.');
            return;
        }

        // Register the service worker, and wait for it to become active
        n.serviceWorker.register(new URL(document.currentScript.src))
            .then(registration => {
                if (!coi.quiet) console.log('Registered service worker for COOP/COEP isolation.');

                registration.addEventListener('updatefound', () => {
                    const worker = registration.installing;
                    worker.addEventListener('statechange', () => {
                        if (worker.state === 'activated') {
                            if (!coi.quiet) console.log('Reloading page to make use of COOP/COEP service worker.');
                            coi.doReload();
                        }
                    });
                });

                // If the registration is active, but it's not controlling the page
                if (registration.active && !n.serviceWorker.controller) {
                    if (!coi.quiet) console.log('Reloading page to make use of COOP/COEP service worker.');
                    coi.doReload();
                }
            })
            .catch(err => {
                console.error('Failed to register COOP/COEP service worker:', err);
            });
    })();
} 