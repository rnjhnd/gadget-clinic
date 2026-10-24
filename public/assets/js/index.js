/**
 * index.js — Login page client-side logic
 *
 * Responsibilities:
 *  1. Surface OAuth error codes from URL query params in the error banner.
 *     Google OAuth redirects back with ?error=access_denied etc. when the
 *     user cancels or something goes wrong. The PHP layer may not always
 *     catch these, so we handle them here as a fallback.
 *  2. Prevent double-submission of the Google sign-in button.
 */
(function () {
    'use strict';

    /** Map of OAuth error codes → human-readable messages */
    const OAUTH_ERROR_MESSAGES = {
        access_denied:          'Sign-in was cancelled. Please try again.',
        server_error:           'Google encountered an error. Please try again in a moment.',
        temporarily_unavailable:'Google sign-in is temporarily unavailable. Please retry.',
        interaction_required:   'Additional confirmation is required. Please try signing in again.',
        login_required:         'Session expired. Please sign in again.',
    };

    const DEFAULT_ERROR = 'Something went wrong during sign-in. Please try again.';

    /**
     * Reads the `error` and `error_description` query params from the current URL
     * and surfaces them in the persistent #auth-error-banner element.
     */
    function handleOAuthErrorParam() {
        const params  = new URLSearchParams(window.location.search);
        const code    = params.get('error');
        const desc    = params.get('error_description');

        if (!code) return;

        const banner  = document.getElementById('auth-error-banner');
        const textEl  = document.getElementById('auth-error-text');

        if (!banner || !textEl) return;

        const message = OAUTH_ERROR_MESSAGES[code] || desc || DEFAULT_ERROR;
        textEl.textContent = message;
        banner.style.display = 'flex';

        // Clean the error params from the URL bar so a refresh does not re-trigger it
        const cleanUrl = window.location.pathname;
        window.history.replaceState(null, '', cleanUrl);
    }

    /**
     * Prevents the user from clicking the Google button multiple times
     * while the OAuth redirect is in flight.
     */
    function lockGoogleButtonOnClick() {
        const btn = document.getElementById('google-login-btn');
        if (!btn) return;

        btn.addEventListener('click', function () {
            setTimeout(function () {
                btn.style.pointerEvents = 'none';
                btn.style.opacity       = '0.65';
            }, 150);
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        handleOAuthErrorParam();
        lockGoogleButtonOnClick();
    });
})();
