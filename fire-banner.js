// Animasi bara api oranye untuk banner "3475" — menggantikan gambar statis.
// Selama musim Halloween, banner otomatis berganti ke tema labu/jack-o'-lantern.
// Selama musim Natal (1-30 Desember setiap tahun), banner otomatis berganti
// ke tema Natal (lihat SEASONS di bawah). Presiden (admin) juga bisa memaksa
// tema tertentu lewat menu "Theme Switcher" di panel president — lihat
// window.SVSSeasonalTheme di paling bawah file ini.
(function () {

	// ============ TOGGLE MUSIMAN OTOMATIS ============
	// Rentang tanggal (inklusif) untuk tiap tema musiman, tahun berapa pun.
	// Bulan pakai indeks 0 (Januari=0 ... Desember=11), sesuai Date JS.
	const SEASONS = {
		halloween: { startMonth: 9, startDay: 1, endMonth: 10, endDay: 2 },   // 1 Okt - 2 Nov
		christmas: { startMonth: 11, startDay: 1, endMonth: 11, endDay: 30 }  // 1 - 30 Des
	};

	// Kunci localStorage untuk override manual (dipakai oleh menu "Theme
	// Switcher" di panel president, dan juga bisa diset lewat console browser
	// untuk testing/preview tanpa perlu menunggu tanggal aslinya):
	//   localStorage.setItem('svs_theme_override', 'halloween')  -> paksa Halloween
	//   localStorage.setItem('svs_theme_override', 'christmas')  -> paksa Natal
	//   localStorage.setItem('svs_theme_override', 'none')       -> paksa banner api biasa
	//   localStorage.removeItem('svs_theme_override')            -> ikut tanggal asli (Auto)
	const OVERRIDE_KEY = 'svs_theme_override';
	const VALID_THEMES = ['halloween', 'christmas', 'none'];

	// Kunci lama (per-musim on/off) tetap didukung untuk kompatibilitas
	// mundur, tapi override terpadu di atas selalu diprioritaskan.
	const LEGACY_KEYS = { halloween: 'svs_halloween_override', christmas: 'svs_christmas_override' };

	function getOverride() {
		try {
			const v = localStorage.getItem(OVERRIDE_KEY);
			return VALID_THEMES.includes(v) ? v : null;
		} catch (e) { return null; }
	}

	function setOverride(value) {
		try {
			if (!value || value === 'auto') {
				localStorage.removeItem(OVERRIDE_KEY);
			} else if (VALID_THEMES.includes(value)) {
				localStorage.setItem(OVERRIDE_KEY, value);
			}
		} catch (e) { /* localStorage unavailable, ignore */ }
	}

	function isInSeason(date, season) {
		const month = date.getMonth();
		const day = date.getDate();
		const afterStart = (month > season.startMonth) ||
			(month === season.startMonth && day >= season.startDay);
		const beforeEnd = (month < season.endMonth) ||
			(month === season.endMonth && day <= season.endDay);
		return afterStart && beforeEnd;
	}

	function legacyOverride(theme) {
		try {
			return localStorage.getItem(LEGACY_KEYS[theme]);
		} catch (e) { return null; }
	}

	// Menentukan tema yang aktif sekarang: override terpadu > override lama
	// (per tema) > deteksi otomatis berdasarkan tanggal.
	function computeActiveTheme(date) {
		const override = getOverride();
		if (override) return override;

		const d = date || new Date();

		if (legacyOverride('halloween') === 'off') { /* dipaksa mati, lewati */ }
		else if (legacyOverride('halloween') === 'on' || isInSeason(d, SEASONS.halloween)) return 'halloween';

		if (legacyOverride('christmas') === 'off') { /* dipaksa mati, lewati */ }
		else if (legacyOverride('christmas') === 'on' || isInSeason(d, SEASONS.christmas)) return 'christmas';

		return 'none';
	}

	let currentContainer = null;
	let onThemeChangeCb = null;

	function applySeasonalTheme(container) {
		const theme = computeActiveTheme();
		container.classList.toggle('halloween-theme', theme === 'halloween');
		container.classList.toggle('christmas-theme', theme === 'christmas');
		// Also flag it on <body> so page-wide elements (buttons, etc.) that
		// aren't inside the banner can react to the same season via CSS,
		// e.g. `body.christmas-theme .btn-apply { ... }`.
		document.body.classList.toggle('halloween-theme', theme === 'halloween');
		document.body.classList.toggle('christmas-theme', theme === 'christmas');
		return theme;
	}

	function initFireBanner() {
		const container = document.getElementById('fire-banner');
		const canvas = document.getElementById('fire-banner-embers');
		if (!container || !canvas) return;
		currentContainer = container;

		// Set class SEBELUM membaca tema, supaya CSS & partikel sinkron.
		let theme = applySeasonalTheme(container);

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
			if (theme === 'halloween') {
				const x = w * (0.05 + Math.random() * 0.9);
				const y = h * (0.7 + Math.random() * 0.28);
				const speed = 0.15 + Math.random() * 0.35;
				const size = 0.6 + Math.random() * 1.6;
				particles.push({
					x, y, size, vy: -speed,
					vx: (Math.random() - 0.5) * 0.15,
					life: 0, maxLife: 90 + Math.random() * 110,
					hueShift: Math.random(), warm: Math.random() > 0.35
				});
			} else if (theme === 'christmas') {
				// Gentle falling gold/red/green glitter drifting down over the artwork.
				const x = w * (0.05 + Math.random() * 0.9);
				const y = -6;
				const speed = 0.22 + Math.random() * 0.3;
				const size = 0.7 + Math.random() * 1.7;
				particles.push({
					x, y, size, vy: speed,
					vx: (Math.random() - 0.5) * 0.25,
					life: 0, maxLife: 170 + Math.random() * 140,
					colorPick: Math.random(), sway: Math.random() * Math.PI * 2
				});
			} else {
				const x = w * (0.15 + Math.random() * 0.7);
				const y = h * (0.35 + Math.random() * 0.4);
				const speed = 0.3 + Math.random() * 0.7;
				const size = 0.6 + Math.random() * 1.4;
				particles.push({
					x, y, size, vy: -speed,
					vx: (Math.random() - 0.5) * 0.3,
					life: 0, maxLife: 40 + Math.random() * 50,
					hueShift: Math.random(), warm: Math.random() > 0.35
				});
			}
		}

		function draw() {
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			if (theme === 'halloween') {
				if (Math.random() < 0.5) spawnParticle();
			} else if (theme === 'christmas') {
				if (Math.random() < 0.55) spawnParticle();
			} else {
				if (Math.random() < 0.85) spawnParticle();
				if (Math.random() < 0.35) spawnParticle();
			}

			for (let i = particles.length - 1; i >= 0; i--) {
				const p = particles[i];
				if (theme === 'christmas') {
					p.x += p.vx + Math.sin((p.life + p.sway * 20) * 0.04) * 0.3;
					p.y += p.vy;
				} else {
					p.x += p.vx + (theme === 'halloween' ? Math.sin(p.life * 0.05) * 0.15 : 0);
					p.y += p.vy;
					p.vy -= 0.002;
				}
				p.life++;
				const t = p.life / p.maxLife;
				if (t >= 1 || p.y > canvas.height + 10) { particles.splice(i, 1); continue; }
				const alpha = Math.sin(Math.PI * t) * 0.9;
				let r, g, b;
				if (theme === 'halloween') {
					if (p.warm) { r = 255; g = 170; b = 60; }
					else { r = 200; g = 225; b = 255; }
				} else if (theme === 'christmas') {
					if (p.colorPick < 0.4) { r = 255; g = 215; b = 110; }       // gold
					else if (p.colorPick < 0.65) { r = 235; g = 60; b = 70; }   // red
					else if (p.colorPick < 0.85) { r = 70; g = 200; b = 120; }  // green
					else { r = 255; g = 255; b = 255; }                        // white sparkle
				} else {
					r = 255;
					g = 120 + p.hueShift * 100;
					b = 20 + p.hueShift * 60;
				}
				ctx.beginPath();
				ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${alpha})`;
				ctx.shadowColor = theme === 'halloween' ? `rgba(${r | 0},${g | 0},${b | 0},${alpha})` : (theme === 'christmas' ? `rgba(${r | 0},${g | 0},${b | 0},${alpha})` : `rgba(255,140,0,${alpha})`);
				ctx.shadowBlur = theme === 'halloween' ? 4 : (theme === 'christmas' ? 5 : 5);
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

		// Dipanggil oleh window.SVSSeasonalTheme.setTheme() saat President
		// mengganti tema secara manual lewat Theme Switcher, supaya banner
		// berubah langsung tanpa reload halaman.
		window.__svsReapplyBannerTheme = function () {
			theme = applySeasonalTheme(container);
			particles = [];
			if (onThemeChangeCb) onThemeChangeCb(theme);
		};
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initFireBanner);
	} else {
		initFireBanner();
	}

	// ============ PUBLIC API (dipakai oleh menu Theme Switcher President) ============
	window.SVSSeasonalTheme = {
		// 'halloween' | 'christmas' | 'none' | 'auto'
		setTheme: function (value) {
			setOverride(value);
			if (window.__svsReapplyBannerTheme) window.__svsReapplyBannerTheme();
			else if (currentContainer) applySeasonalTheme(currentContainer);
		},
		// Tema yang benar-benar tampil sekarang (setelah override/tanggal dihitung).
		getActiveTheme: function () {
			return computeActiveTheme();
		},
		// 'halloween' | 'christmas' | 'none' jika dipaksa manual, atau null jika Auto.
		getOverride: getOverride,
		onChange: function (cb) { onThemeChangeCb = cb; }
	};
})();
