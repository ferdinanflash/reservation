// Animasi bara api oranye untuk banner "3475" — menggantikan gambar statis.
// Selama musim Halloween, banner otomatis berganti ke tema labu/jack-o'-lantern.
// Selama musim Natal (1-30 Desember setiap tahun), banner otomatis berganti
// ke tema Natal (lihat SEASONS di bawah). Selama musim Valentine (1-14 Februari)
// banner berganti ke tema Valentine. Presiden (admin) juga bisa memaksa
// tema tertentu lewat menu "Theme Switcher" di panel president — lihat
// window.SVSSeasonalTheme di paling bawah file ini.
(function () {

	// ============ TOGGLE MUSIMAN OTOMATIS ============
	// Rentang tanggal (inklusif) untuk tiap tema musiman, tahun berapa pun.
	// Bulan pakai indeks 0 (Januari=0 ... Desember=11), sesuai Date JS.
	const SEASONS = {
		halloween: { startMonth: 9, startDay: 1, endMonth: 10, endDay: 2 },   // 1 Okt - 2 Nov
		christmas: { startMonth: 11, startDay: 1, endMonth: 11, endDay: 30 }, // 1 - 30 Des
		valentine: { startMonth: 1, startDay: 1, endMonth: 1, endDay: 14 }    // 1 - 14 Feb
	};

	// Override manual dari President sekarang disimpan di DATABASE (tabel
	// `theme_settings`, baris id='main') supaya berlaku untuk SEMUA pengguna,
	// bukan hanya browser President. localStorage di bawah hanya berfungsi
	// sebagai CACHE dari nilai terakhir di server (biar banner langsung benar
	// saat halaman dibuka, tanpa menunggu jaringan). Untuk testing lokal lewat
	// console browser (hanya di browser itu, akan tertimpa nilai server):
	//   localStorage.setItem('svs_theme_override', 'halloween')  -> paksa Halloween
	//   localStorage.setItem('svs_theme_override', 'christmas')  -> paksa Natal
	//   localStorage.setItem('svs_theme_override', 'valentine')  -> paksa Valentine
	//   localStorage.setItem('svs_theme_override', 'none')       -> paksa banner api biasa
	//   localStorage.removeItem('svs_theme_override')            -> ikut tanggal asli (Auto)
	const OVERRIDE_KEY = 'svs_theme_override';
	const VALID_THEMES = ['halloween', 'christmas', 'valentine', 'none'];

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

		if (isInSeason(d, SEASONS.valentine)) return 'valentine';

		return 'none';
	}

	let currentContainer = null;
	let onThemeChangeCb = null;

	// ============ CADANGAN JIKA GAMBAR BANNER GAGAL DIMUAT ============
	// Tiap tema punya gambar banner sendiri. Kalau gambar tema yang AKTIF gagal
	// dimuat (file belum diupload, offline, dsb.), #fire-banner diberi class
	// 'art-failed' dan CSS memunculkan kembali angka api animasi yang lama,
	// supaya banner tidak kosong. Gambar tiap tema hanya dicek saat tema itu aktif.
	const ART_FILES = {
		none: 'default-banner-v2.jpg',
		christmas: 'christmas-banner-v3.jpg',
		valentine: 'valentine-banner-v1.jpg',
		halloween: 'halloween-banner.png'
	};
	const artState = {}; // tema -> 'loading' | 'ok' | 'failed'

	function checkArt(container, theme) {
		const file = ART_FILES[theme];
		if (file && !artState[theme]) {
			artState[theme] = 'loading';
			const img = new Image();
			img.onload = function () { artState[theme] = 'ok'; };
			img.onerror = function () {
				artState[theme] = 'failed';
				if (currentContainer && computeActiveTheme() === theme) {
					currentContainer.classList.add('art-failed');
				}
			};
			img.src = file;
		}
		container.classList.toggle('art-failed', artState[theme] === 'failed');
	}

	function applySeasonalTheme(container) {
		const theme = computeActiveTheme();
		container.classList.toggle('halloween-theme', theme === 'halloween');
		container.classList.toggle('christmas-theme', theme === 'christmas');
		container.classList.toggle('valentine-theme', theme === 'valentine');
		// Also flag it on <body> so page-wide elements (buttons, etc.) that
		// aren't inside the banner can react to the same season via CSS,
		// e.g. `body.christmas-theme .btn-apply { ... }`.
		document.body.classList.toggle('halloween-theme', theme === 'halloween');
		document.body.classList.toggle('christmas-theme', theme === 'christmas');
		document.body.classList.toggle('valentine-theme', theme === 'valentine');
		checkArt(container, theme);
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
			} else if (theme === 'valentine') {
				// Soft pink / red / gold sparkles and tiny hearts floating gently upward.
				const x = w * (0.04 + Math.random() * 0.92);
				const y = h * (0.75 + Math.random() * 0.3);
				const speed = 0.25 + Math.random() * 0.4;
				const size = 0.8 + Math.random() * 1.9;
				particles.push({
					x, y, size, vy: -speed,
					vx: (Math.random() - 0.5) * 0.2,
					life: 0, maxLife: 150 + Math.random() * 120,
					colorPick: Math.random(), sway: Math.random() * Math.PI * 2,
					heart: Math.random() < 0.4
				});
			} else {
				// Default banner: sparks rise from around the flaming shield, which
				// sits in the middle of the picture (not across the whole width).
				const x = w * (0.30 + Math.random() * 0.40);
				const y = h * (0.45 + Math.random() * 0.35);
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
			} else if (theme === 'valentine') {
				if (Math.random() < 0.5) spawnParticle();
			} else {
				if (Math.random() < 0.85) spawnParticle();
				if (Math.random() < 0.35) spawnParticle();
			}

			for (let i = particles.length - 1; i >= 0; i--) {
				const p = particles[i];
				if (theme === 'christmas' || theme === 'valentine') {
					p.x += p.vx + Math.sin((p.life + p.sway * 20) * 0.04) * 0.3;
					p.y += p.vy;
				} else {
					p.x += p.vx + (theme === 'halloween' ? Math.sin(p.life * 0.05) * 0.15 : 0);
					p.y += p.vy;
					p.vy -= 0.002;
				}
				p.life++;
				const t = p.life / p.maxLife;
				if (t >= 1 || p.y > canvas.height + 10 || (theme === 'valentine' && p.y < -10)) { particles.splice(i, 1); continue; }
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
				} else if (theme === 'valentine') {
					if (p.colorPick < 0.4) { r = 255; g = 105; b = 160; }       // rose pink
					else if (p.colorPick < 0.65) { r = 235; g = 45; b = 85; }   // crimson
					else if (p.colorPick < 0.85) { r = 255; g = 215; b = 110; } // gold
					else { r = 255; g = 235; b = 245; }                         // pearl white
				} else {
					r = 255;
					g = 120 + p.hueShift * 100;
					b = 20 + p.hueShift * 60;
				}
				ctx.beginPath();
				ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${alpha})`;
				ctx.shadowColor = (theme === 'halloween' || theme === 'christmas' || theme === 'valentine') ? `rgba(${r | 0},${g | 0},${b | 0},${alpha})` : `rgba(255,140,0,${alpha})`;
				ctx.shadowBlur = theme === 'halloween' ? 4 : 5;
				const radius = p.size * (1 - t * 0.4);
				if (theme === 'valentine' && p.heart) {
					// Tiny heart (two lobes + point), scaled from the particle size.
					const k = radius * 1.6;
					ctx.moveTo(p.x, p.y + k * 0.9);
					ctx.bezierCurveTo(p.x - k * 1.6, p.y - k * 0.2, p.x - k * 0.8, p.y - k * 1.4, p.x, p.y - k * 0.5);
					ctx.bezierCurveTo(p.x + k * 0.8, p.y - k * 1.4, p.x + k * 1.6, p.y - k * 0.2, p.x, p.y + k * 0.9);
				} else {
					ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
				}
				ctx.fill();
			}

			rafId = requestAnimationFrame(draw);
		}

		resize();
		window.addEventListener('resize', resize);
		// Also follow any change of the banner's own size (theme switch, images or
		// fonts finishing loading), not just window resizes.
		if (window.ResizeObserver) new ResizeObserver(resize).observe(container);

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

		// Dipanggil setiap kali tema berubah (President mengganti lewat Theme
		// Switcher, atau perubahan dari server diterima lewat realtime/polling),
		// supaya banner berubah langsung tanpa reload halaman.
		window.__svsReapplyBannerTheme = function () {
			theme = applySeasonalTheme(container);
			particles = [];
			resize(); // the banner height differs per theme on desktop
			notifyThemeChanged(theme);
		};
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initFireBanner);
	} else {
		initFireBanner();
	}

	// ============ SINKRONISASI TEMA DENGAN DATABASE ============
	// Sumber kebenaran tema manual = tabel `theme_settings` (baris 'main').
	// Semua pengunjung membaca nilainya saat halaman dibuka, lalu menerima
	// perubahan lewat Supabase Realtime (plus polling/visibility sebagai
	// cadangan kalau koneksi realtime terputus, mis. PWA di background).
	const THEME_TABLE = 'theme_settings';
	const THEME_ROW_ID = 'main';
	const THEME_POLL_MS = 60000;

	function getClient() {
		try { return (typeof getSupabase === 'function') ? getSupabase() : null; }
		catch (e) { return null; }
	}

	function notifyThemeChanged(theme) {
		if (onThemeChangeCb) onThemeChangeCb(theme);
		try {
			document.dispatchEvent(new CustomEvent('svs-theme-changed', { detail: { theme: theme } }));
		} catch (e) { /* ignore */ }
	}

	function reapplyTheme() {
		if (window.__svsReapplyBannerTheme) window.__svsReapplyBannerTheme();
		else if (currentContainer) notifyThemeChanged(applySeasonalTheme(currentContainer));
	}

	// Terapkan nilai dari server: simpan ke cache lokal, dan hanya render ulang
	// banner kalau override-nya memang berubah (hindari reset animasi tiap polling).
	function applyRemoteValue(value) {
		const before = getOverride();
		setOverride(VALID_THEMES.includes(value) ? value : 'auto');
		if (getOverride() !== before) reapplyTheme();
	}

	async function fetchRemoteTheme() {
		const client = getClient();
		if (!client) return;
		try {
			const { data, error } = await client
				.from(THEME_TABLE)
				.select('theme_override')
				.eq('id', THEME_ROW_ID)
				.maybeSingle();
			if (error) throw error;
			applyRemoteValue(data ? data.theme_override : 'auto');
		} catch (err) {
			// Offline / tabel belum dibuat: tetap pakai cache terakhir.
			console.warn('Could not load seasonal theme from database:', err);
		}
	}

	function subscribeRemoteTheme() {
		const client = getClient();
		if (!client) return;
		try {
			client
				.channel('theme_settings_changes')
				.on('postgres_changes', { event: '*', schema: 'public', table: THEME_TABLE }, (payload) => {
					if (payload.eventType === 'DELETE') applyRemoteValue('auto');
					else applyRemoteValue(payload.new && payload.new.theme_override);
				})
				.subscribe();
		} catch (err) {
			console.warn('Theme realtime subscription failed, relying on polling:', err);
		}
	}

	function startRemoteThemeSync() {
		fetchRemoteTheme();
		subscribeRemoteTheme();
		setInterval(fetchRemoteTheme, THEME_POLL_MS);
		document.addEventListener('visibilitychange', function () {
			if (document.visibilityState === 'visible') fetchRemoteTheme();
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', startRemoteThemeSync);
	} else {
		startRemoteThemeSync();
	}

	// ============ PUBLIC API (dipakai oleh menu Theme Switcher President) ============
	window.SVSSeasonalTheme = {
		// 'halloween' | 'christmas' | 'valentine' | 'none' | 'auto'
		// Menyimpan ke database supaya berlaku untuk semua pengguna. Mengembalikan
		// Promise<boolean>: true kalau berhasil disimpan, false kalau gagal
		// (mis. bukan staff yang login, atau migrasi SQL belum dijalankan).
		setTheme: async function (value) {
			const v = (!value || value === 'auto') ? 'auto' : value;
			if (v !== 'auto' && !VALID_THEMES.includes(v)) return false;
			const client = getClient();
			if (!client) return false;
			try {
				const { error } = await client
					.from(THEME_TABLE)
					.upsert({ id: THEME_ROW_ID, theme_override: v, updated_at: new Date().toISOString() }, { onConflict: 'id' });
				if (error) throw error;
			} catch (err) {
				console.error('Failed to save seasonal theme:', err);
				return false;
			}
			applyRemoteValue(v);
			return true;
		},
		// Ambil ulang nilai terbaru dari server (dipakai saat modal dibuka).
		refresh: fetchRemoteTheme,
		// Tema yang benar-benar tampil sekarang (setelah override/tanggal dihitung).
		getActiveTheme: function () {
			return computeActiveTheme();
		},
		// 'halloween' | 'christmas' | 'valentine' | 'none' jika dipaksa manual, atau null jika Auto.
		getOverride: getOverride,
		onChange: function (cb) { onThemeChangeCb = cb; }
	};
})();
