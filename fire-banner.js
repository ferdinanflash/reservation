// Animasi bara api oranye untuk banner "3475" — menggantikan gambar statis.
// Selama musim Halloween, banner otomatis berganti ke tema labu/jack-o'-lantern
// (lihat HALLOWEEN_SEASON + applySeasonalTheme di bawah).
(function () {

	// ============ TOGGLE MUSIMAN OTOMATIS ============
	// Rentang tanggal (inklusif) saat tema Halloween aktif, tahun berapa pun.
	// Bulan pakai indeks 0 (Januari=0 ... Desember=11), sesuai Date JS.
	// Default: 1 Oktober s/d 2 November.
	const HALLOWEEN_SEASON = {
		startMonth: 9,  // Oktober
		startDay: 1,
		endMonth: 10,   // November
		endDay: 2
	};

	// Kunci localStorage untuk override manual saat testing/preview, tanpa
	// perlu menunggu bulan Oktober beneran. Di console browser jalankan:
	//   localStorage.setItem('svs_halloween_override', 'on')   -> paksa nyala
	//   localStorage.setItem('svs_halloween_override', 'off')  -> paksa mati
	//   localStorage.removeItem('svs_halloween_override')      -> ikut tanggal asli
	const OVERRIDE_KEY = 'svs_halloween_override';

	function isHalloweenSeason(date) {
		const override = (function () {
			try { return localStorage.getItem(OVERRIDE_KEY); } catch (e) { return null; }
		})();
		if (override === 'on') return true;
		if (override === 'off') return false;

		const d = date || new Date();
		const month = d.getMonth();
		const day = d.getDate();
		const afterStart = (month > HALLOWEEN_SEASON.startMonth) ||
			(month === HALLOWEEN_SEASON.startMonth && day >= HALLOWEEN_SEASON.startDay);
		const beforeEnd = (month < HALLOWEEN_SEASON.endMonth) ||
			(month === HALLOWEEN_SEASON.endMonth && day <= HALLOWEEN_SEASON.endDay);
		return afterStart && beforeEnd;
	}

	function applySeasonalTheme(container) {
		const active = isHalloweenSeason();
		container.classList.toggle('halloween-theme', active);
		return active;
	}

	function initFireBanner() {
		const container = document.getElementById('fire-banner');
		const canvas = document.getElementById('fire-banner-embers');
		if (!container || !canvas) return;

		// Set class SEBELUM membaca isHalloween, supaya CSS & partikel sinkron.
		const isHalloween = applySeasonalTheme(container);

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
			const x = isHalloween ? w * (0.05 + Math.random() * 0.9) : w * (0.15 + Math.random() * 0.7);
			const y = isHalloween ? h * (0.7 + Math.random() * 0.28) : h * (0.35 + Math.random() * 0.4);
			const speed = isHalloween ? 0.15 + Math.random() * 0.35 : 0.3 + Math.random() * 0.7;
			const size = 0.6 + Math.random() * (isHalloween ? 1.6 : 1.4);
			particles.push({
				x, y, size,
				vy: -speed,
				vx: (Math.random() - 0.5) * (isHalloween ? 0.15 : 0.3),
				life: 0,
				maxLife: isHalloween ? 90 + Math.random() * 110 : 40 + Math.random() * 50,
				hueShift: Math.random(),
				warm: Math.random() > 0.35
			});
		}

		function draw() {
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			if (isHalloween) {
				if (Math.random() < 0.5) spawnParticle();
			} else {
				if (Math.random() < 0.85) spawnParticle();
				if (Math.random() < 0.35) spawnParticle();
			}

			for (let i = particles.length - 1; i >= 0; i--) {
				const p = particles[i];
				p.x += p.vx + (isHalloween ? Math.sin(p.life * 0.05) * 0.15 : 0);
				p.y += p.vy;
				p.vy -= 0.002;
				p.life++;
				const t = p.life / p.maxLife;
				if (t >= 1) { particles.splice(i, 1); continue; }
				const alpha = Math.sin(Math.PI * t) * 0.9;
				let r, g, b;
				if (isHalloween) {
					// Mostly warm pumpkin sparks, occasional pale blue-white firefly.
					if (p.warm) { r = 255; g = 170; b = 60; }
					else { r = 200; g = 225; b = 255; }
				} else {
					r = 255;
					g = 120 + p.hueShift * 100;
					b = 20 + p.hueShift * 60;
				}
				ctx.beginPath();
				ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${alpha})`;
				ctx.shadowColor = isHalloween ? `rgba(${r | 0},${g | 0},${b | 0},${alpha})` : `rgba(255,140,0,${alpha})`;
				ctx.shadowBlur = isHalloween ? 4 : 5;
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
