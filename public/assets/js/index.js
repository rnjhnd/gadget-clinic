/**
 * index.js — Login page client-side logic
 *
 * Responsibilities:
 *  1. Surface OAuth error codes from URL query params in the error banner.
 *     Google OAuth redirects back with ?error=access_denied etc. when the
 *     user cancels or something goes wrong. The PHP layer may not always
 *     catch these, so we handle them here as a fallback.
 *  2. Prevent double-submission of the Google sign-in button.
 *  3. Reset button state on bfcache restore (browser Back from Google picker).
 */
(function () {
    'use strict';

    /** Map of OAuth error codes → human-readable messages */
    const OAUTH_ERROR_MESSAGES = {
        access_denied:           'Sign-in was cancelled. Please try again.',
        server_error:            'Google encountered an error. Please try again in a moment.',
        temporarily_unavailable: 'Google sign-in is temporarily unavailable. Please retry.',
        interaction_required:    'Additional confirmation is required. Please try signing in again.',
        login_required:          'Session expired. Please sign in again.',
    };

    const DEFAULT_ERROR = 'Something went wrong during sign-in. Please try again.';

    /**
     * Reads the `error` and `error_description` query params from the current URL
     * and surfaces them in the persistent #auth-error-banner element.
     */
    function handleOAuthErrorParam() {
        const params = new URLSearchParams(window.location.search);
        const code   = params.get('error');
        const desc   = params.get('error_description');

        if (!code) return;

        const banner = document.getElementById('auth-error-banner');
        const textEl = document.getElementById('auth-error-text');

        if (!banner || !textEl) return;

        const message = OAUTH_ERROR_MESSAGES[code] || desc || DEFAULT_ERROR;
        textEl.textContent = message;
        banner.style.display = 'flex';

        // Clean the error params from the URL bar so a refresh does not re-trigger it
        window.history.replaceState(null, '', window.location.pathname);
    }

    /**
     * Resets the Google button to its active, clickable state.
     * Called on initial load, page restoration (bfcache / back button),
     * tab visibility change, and via a safety timer.
     */
    function resetGoogleButton() {
        const btn = document.getElementById('google-login-btn');
        if (!btn) return;
        btn.style.pointerEvents = '';
        btn.style.opacity       = '';
    }

    /**
     * Provides visual feedback on click while preventing accidental rapid double-taps
     * during OAuth redirect initiation, while guaranteeing an auto-reset safety timeout.
     */
    function lockGoogleButtonOnClick() {
        const btn = document.getElementById('google-login-btn');
        if (!btn) return;

        btn.addEventListener('click', function () {
            // Visual indicator that redirect is processing
            setTimeout(function () {
                btn.style.pointerEvents = 'none';
                btn.style.opacity       = '0.65';
            }, 150);

            // Safety unlock: if navigation is delayed, cancelled, or user stays on page
            setTimeout(function () {
                resetGoogleButton();
            }, 2500);
        });
    }

    // On initial load
    document.addEventListener('DOMContentLoaded', function () {
        handleOAuthErrorParam();
        resetGoogleButton();
        lockGoogleButtonOnClick();
    });

    /**
     * Unconditionally reset the button state whenever the page becomes visible again:
     * 1. 'pageshow' fires on both normal loads and back/forward navigation (bfcache)
     * 2. 'pagehide' clears inline styles right before the browser takes a page cache snapshot
     * 3. 'visibilitychange' ensures return to the tab restores active state
     */
    window.addEventListener('pageshow', function () {
        resetGoogleButton();
    });

    window.addEventListener('pagehide', function () {
        resetGoogleButton();
    });

    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
            resetGoogleButton();
        }
    });
})();
