/* SVS Ministry opening animation
 * The overlay is intentionally isolated from the existing page layout.
 * It shows once per browser session, then disappears permanently for that session.
 */
(function () {
    'use strict';

    function initOpening() {
        var intro = document.getElementById('svs-opening');
        if (!intro) return;

        var storageKey = 'svs-ministry-opening-seen-v1';
        var seen = false;
        try {
            seen = sessionStorage.getItem(storageKey) === '1';
        } catch (_) {}

        if (seen) {
            intro.remove();
            return;
        }

        try {
            sessionStorage.setItem(storageKey, '1');
        } catch (_) {}

        // Failsafe: never leave the overlay blocking the page.
        window.setTimeout(function () {
            intro.classList.add('is-finished');
            intro.style.opacity = '0';
            intro.style.visibility = 'hidden';
            intro.style.pointerEvents = 'none';
        }, 2400);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOpening, { once: true });
    } else {
        initOpening();
    }
})();
