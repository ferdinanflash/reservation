// Animasi bara api oranye untuk banner "3475" — menggantikan gambar statis.
(function () {
	function initFireBanner() {
		const container = document.getElementById('fire-banner');
		const canvas = document.getElementById('fire-banner-embers');
		if (!container || !canvas) return;

		const ctx = canvas.getContext('2d');
		let particles = [];
		let rafId = null;

		function resize() {
			const rect = container.getBoundingClientRect();
			canvas.width = Math.max(1, Math.round(rect.width));
			canvas.height = Math.max(1, Math.round(rect.height));
		}

		function spawnParticle() {
			const w = canvas.width;
			const h = canvas.height;
			const x = w * (0.15 + Math.random() * 0.7);
			const y = h * (0.35 + Math.random() * 0.4);
			const speed = 0.3 + Math.random() * 0.7;
			const size = 0.6 + Math.random() * 1.4;
			particles.push({
				x, y, size,
				vy: -speed,
				vx: (Math.random() - 0.5) * 0.3,
				life: 0,
				maxLife: 40 + Math.random() * 50,
				hueShift: Math.random()
			});
		}

		function draw() {
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			if (Math.random() < 0.85) spawnParticle();
			if (Math.random() < 0.35) spawnParticle();

			for (let i = particles.length - 1; i >= 0; i--) {
				const p = particles[i];
				p.x += p.vx;
				p.y += p.vy;
				p.vy -= 0.002;
				p.life++;
				const t = p.life / p.maxLife;
				if (t >= 1) { particles.splice(i, 1); continue; }
				const alpha = Math.sin(Math.PI * t) * 0.9;
				const r = 255;
				const g = 120 + p.hueShift * 100;
				const b = 20 + p.hueShift * 60;
				ctx.beginPath();
				ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${alpha})`;
				ctx.shadowColor = `rgba(255,140,0,${alpha})`;
				ctx.shadowBlur = 5;
				ctx.arc(p.x, p.y, p.size * (1 - t * 0.4), 0, Math.PI * 2);
				ctx.fill();
			}

			rafId = requestAnimationFrame(draw);
		}

		resize();
		window.addEventListener('resize', resize);

		// Hormati preferensi reduced motion pengguna.
		const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!prefersReducedMotion) {
			draw();
		}

		// Hentikan animasi saat tab tidak aktif untuk hemat resource.
		document.addEventListener('visibilitychange', function () {
			if (document.hidden) {
				if (rafId) cancelAnimationFrame(rafId);
				rafId = null;
			} else if (!rafId && !prefersReducedMotion) {
				draw();
			}
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initFireBanner);
	} else {
		initFireBanner();
	}
})();
