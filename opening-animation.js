/* SvS Minister opening animation
 * Overlay-only: tidak mengubah ukuran, posisi, atau tata letak halaman utama.
 * Durasi total 2.5 detik dan selalu tampil setiap kali halaman di-refresh/dibuka.
 */
(function () {
    'use strict';

    function initOpening() {
        var intro = document.getElementById('svs-opening');
        if (!intro) return;

        // Blue Fire: autoplay the supplied 10-second artwork while the intro is visible.
        // The video is muted/inline so mobile browsers can start it without a gesture.
        var bluefireVideo = intro.querySelector('.svs-opening-bluefire-video');
        if (bluefireVideo && document.body.classList.contains('bluefire-theme')) {
            bluefireVideo.muted = true;
            bluefireVideo.playsInline = true;
            bluefireVideo.loop = true;
            var playPromise = bluefireVideo.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(function () {});
            }
        }

        // Failsafe: jangan pernah membiarkan overlay memblokir halaman.
        window.setTimeout(function () {
            intro.classList.add('is-finished');
            intro.style.opacity = '0';
            intro.style.visibility = 'hidden';
            intro.style.pointerEvents = 'none';
            if (bluefireVideo) {
                try { bluefireVideo.pause(); } catch (e) {}
            }
        }, 2500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOpening, { once: true });
    } else {
        initOpening();
    }
})();
