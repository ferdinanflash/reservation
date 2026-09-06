/* SvS Minister opening animation
 * Overlay-only: tidak mengubah ukuran, posisi, atau tata letak halaman utama.
 * Durasi total 2.5 detik dan selalu tampil setiap kali halaman di-refresh/dibuka.
 */
(function () {
    'use strict';

    function initOpening() {
        var intro = document.getElementById('svs-opening');
        if (!intro) return;

        // Failsafe: jangan pernah membiarkan overlay memblokir halaman.
        window.setTimeout(function () {
            intro.classList.add('is-finished');
            intro.style.opacity = '0';
            intro.style.visibility = 'hidden';
            intro.style.pointerEvents = 'none';
        }, 2500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOpening, { once: true });
    } else {
        initOpening();
    }
})();
