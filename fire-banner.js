// Animasi bara api oranye untuk banner "3475" — menggantikan gambar statis.
// Selama musim Halloween, banner otomatis berganti ke tema labu/jack-o'-lantern.
// Selama musim Natal (1-30 Desember setiap tahun), banner otomatis berganti
// ke tema Natal (lihat SEASONS di bawah). Selama musim Valentine (1-14 Februari)
// banner berganti ke tema Valentine. Selama Tahun Baru Imlek (tanggalnya
// berbeda tiap tahun, lihat CNY_DATES di bawah) banner berganti ke tema Imlek;
// tema Imlek diprioritaskan di atas Valentine sehingga durasinya tidak
// pernah bentrok. Selama Mid-Autumn Festival (19 - 27 September setiap tahun)
// banner berganti ke tema Mid-Autumn. Tema Idul Fitri ('eid') TIDAK pernah aktif otomatis: hanya
// muncul kalau Presiden memilihnya manual di Theme Switcher. Presiden (admin) juga bisa memaksa
// tema tertentu lewat menu "Theme Switcher" di panel president — lihat
// window.SVSSeasonalTheme di paling bawah file ini.
(function () {

	// ============ TOGGLE MUSIMAN OTOMATIS ============
	// Rentang tanggal (inklusif) untuk tiap tema musiman, tahun berapa pun.
	// Bulan pakai indeks 0 (Januari=0 ... Desember=11), sesuai Date JS.
	const SEASONS = {
		halloween: { startMonth: 9, startDay: 1, endMonth: 10, endDay: 2 },   // 1 Okt - 2 Nov
		christmas: { startMonth: 11, startDay: 1, endMonth: 11, endDay: 30 }, // 1 - 30 Des
		valentine: { startMonth: 1, startDay: 1, endMonth: 1, endDay: 14 },   // 1 - 14 Feb
		midautumn: { startMonth: 8, startDay: 19, endMonth: 8, endDay: 27 }   // 19 - 27 Sep
	};

	// Tahun Baru Imlek mengikuti kalender lunar, jadi tanggalnya BERBEDA tiap
	// tahun dan didaftar per tahun (inklusif). Tahun yang tidak terdaftar = tema
	// Imlek tidak aktif otomatis (Valentine tampil penuh 1 - 14 Feb).
	// Tema Imlek DIPRIORITASKAN di atas Valentine (lihat computeActiveTheme),
	// jadi pada hari-hari yang beririsan Valentine otomatis mengalah dan tidak
	// pernah bentrok. Contoh 2027: Imlek jatuh 6 Feb 2027, banner Imlek tampil
	// 6 - 13 Feb, Valentine tampil 1 - 5 Feb lalu kembali pada 14 Feb.
	// Untuk tahun berikutnya cukup tambah satu baris (bulan indeks 0: Jan=0, Feb=1).
	// KEEP IN SYNC dengan skrip inline di awal <body> pada index.html.
	const CNY_DATES = {
		2027: { startMonth: 1, startDay: 6, endMonth: 1, endDay: 13 }         // 6 - 13 Feb 2027
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
	//   localStorage.setItem('svs_theme_override', 'cny')        -> paksa Tahun Baru Imlek
	//   localStorage.setItem('svs_theme_override', 'midautumn')  -> paksa Mid-Autumn Festival
	//   localStorage.setItem('svs_theme_override', 'eid')        -> paksa Idul Fitri (hanya bisa manual)
	//   localStorage.setItem('svs_theme_override', 'none')       -> paksa banner api biasa
	//   localStorage.removeItem('svs_theme_override')            -> ikut tanggal asli (Auto)
	const OVERRIDE_KEY = 'svs_theme_override';
	const VALID_THEMES = ['halloween', 'christmas', 'valentine', 'cny', 'eid', 'midautumn', 'none'];

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

	// Apakah tanggal ini termasuk rentang Imlek pada tahun tersebut?
	function isInCny(date) {
		const range = CNY_DATES[date.getFullYear()];
		return !!range && isInSeason(date, range);
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

		// Mid-Autumn: 19 - 27 September (tidak beririsan dengan tema lain).
		if (isInSeason(d, SEASONS.midautumn)) return 'midautumn';

		// CATATAN: tema Idul Fitri ('eid') sengaja TIDAK dicek di sini. Ia tidak
		// punya rentang tanggal otomatis; hanya aktif lewat override manual di atas.

		// Imlek dicek SEBELUM Valentine: pada hari yang beririsan Imlek menang,
		// jadi kedua tema tidak pernah tampil/bentrok bersamaan.
		if (isInCny(d)) return 'cny';

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
		cny: 'cny-banner-v1.jpg',
		eid: 'eid-banner-v1.jpg',
		midautumn: 'midautumn-banner-v1.jpg',
		halloween: 'halloween-banner.png'
	};
	const artState = {}; // tema -> 'loading' | 'ok' | 'failed'

	// Posisi dekorasi musiman disimpan sebagai data, bukan elemen HTML.
	// Hanya dekorasi untuk tema yang sedang aktif yang dibuat ke DOM.
	const SEASONAL_DECORATIONS = {"halloween":[["halloween-glow-spot",{"left":"76.5%","top":"42%","width":"3%","height":"6%","animation-delay":".2s"}],["halloween-glow-spot",{"left":"85%","top":"38%","width":"3%","height":"6%","animation-delay":".9s"}],["halloween-glow-spot",{"left":"79%","top":"22%","width":"2.5%","height":"5%","animation-delay":"1.4s"}],["halloween-glow-spot",{"left":"9%","top":"66%","width":"3.5%","height":"7%","animation-delay":".4s"}],["halloween-glow-spot",{"left":"16%","top":"72%","width":"3%","height":"6%","animation-delay":"1.1s"}],["halloween-glow-spot",{"left":"25%","top":"78%","width":"3%","height":"6%","animation-delay":"1.8s"}],["halloween-bat halloween-bat1",{"text":"🦇","aria-hidden":"true"}],["halloween-bat halloween-bat2",{"text":"🦇","aria-hidden":"true"}],["halloween-bat halloween-bat3",{"text":"🦇","aria-hidden":"true"}],["halloween-fog",{}],["halloween-fog halloween-fog2",{}],["halloween-lightning",{}]],"christmas":[["christmas-glow-spot",{"left":"40.2%","top":"6.7%","animation-delay":"0.2s","animation-duration":"2.2s"}],["christmas-glow-spot",{"left":"64.5%","top":"10.5%","animation-delay":"0.9s","animation-duration":"2.6s"}],["christmas-glow-spot",{"left":"73.9%","top":"18.0%","animation-delay":"1.4s","animation-duration":"2.0s"}],["christmas-glow-spot",{"left":"22.6%","top":"31.2%","animation-delay":"0.5s","animation-duration":"2.4s"}],["christmas-glow-spot",{"left":"36.4%","top":"31.2%","animation-delay":"1.1s","animation-duration":"2.8s"}],["christmas-glow-spot",{"left":"52.6%","top":"45.0%","animation-delay":"1.8s","animation-duration":"2.1s"}],["christmas-glow-spot",{"left":"11.3%","top":"48.6%","animation-delay":"0.7s","animation-duration":"2.5s"}],["christmas-glow-spot",{"left":"81.4%","top":"47.9%","animation-delay":"1.5s","animation-duration":"2.3s"}],["christmas-glow-spot",{"left":"35.7%","top":"63.9%","animation-delay":"0.3s","animation-duration":"2.7s"}],["christmas-glow-spot",{"left":"63.7%","top":"64.5%","animation-delay":"1.2s","animation-duration":"2.2s"}]],"valentine":[["valentine-glow-spot",{"left":"23.9%","top":"8.9%","animation-delay":"0.2s","animation-duration":"2.2s"}],["valentine-glow-spot",{"left":"74.4%","top":"8.3%","animation-delay":"0.9s","animation-duration":"2.6s"}],["valentine-glow-spot",{"left":"25.5%","top":"20.2%","animation-delay":"1.4s","animation-duration":"2.0s"}],["valentine-glow-spot",{"left":"75.5%","top":"20.2%","animation-delay":"0.5s","animation-duration":"2.4s"}],["valentine-glow-spot",{"left":"58.2%","top":"25.5%","animation-delay":"1.1s","animation-duration":"2.8s"}],["valentine-glow-spot",{"left":"50.0%","top":"41.5%","animation-delay":"1.8s","animation-duration":"2.1s"}],["valentine-glow-spot",{"left":"0.4%","top":"14.5%","animation-delay":"0.7s","animation-duration":"2.5s"}],["valentine-glow-spot",{"left":"5.0%","top":"13.2%","animation-delay":"1.5s","animation-duration":"2.3s"}],["valentine-glow-spot",{"left":"9.1%","top":"9.8%","animation-delay":"0.3s","animation-duration":"2.7s"}],["valentine-glow-spot",{"left":"15.4%","top":"0.5%","animation-delay":"1.2s","animation-duration":"2.2s"}],["valentine-glow-spot",{"left":"92.7%","top":"11.5%","animation-delay":"0.6s","animation-duration":"2.6s"}],["valentine-glow-spot",{"left":"97.3%","top":"13.5%","animation-delay":"1.7s","animation-duration":"2.0s"}],["valentine-glow-spot",{"left":"2.1%","top":"83.8%","animation-delay":"0.4s","animation-duration":"2.4s"}],["valentine-glow-spot",{"left":"9.0%","top":"87.7%","animation-delay":"1.0s","animation-duration":"2.8s"}],["valentine-glow-spot",{"left":"14.1%","top":"89.6%","animation-delay":"1.9s","animation-duration":"2.1s"}],["valentine-glow-spot",{"left":"85.3%","top":"90.0%","animation-delay":"0.8s","animation-duration":"2.5s"}],["valentine-glow-spot",{"left":"90.4%","top":"88.3%","animation-delay":"1.3s","animation-duration":"2.3s"}],["valentine-glow-spot",{"left":"96.8%","top":"84.4%","animation-delay":"0.1s","animation-duration":"2.7s"}]],"cny":[["cny-glow-spot",{"left":"27.6%","top":"24.7%","animation-delay":"0.2s","animation-duration":"2.2s"}],["cny-glow-spot",{"left":"69.6%","top":"16.0%","animation-delay":"0.9s","animation-duration":"2.6s"}],["cny-glow-spot",{"left":"32.7%","top":"28.0%","animation-delay":"1.4s","animation-duration":"2.0s"}],["cny-glow-spot",{"left":"77.0%","top":"62.0%","animation-delay":"0.5s","animation-duration":"2.4s"}],["cny-glow-spot",{"left":"19.0%","top":"57.3%","animation-delay":"1.1s","animation-duration":"2.8s"}],["cny-glow-spot",{"left":"75.6%","top":"74.6%","animation-delay":"1.8s","animation-duration":"2.1s"}],["cny-glow-spot",{"left":"82.1%","top":"39.0%","animation-delay":"0.7s","animation-duration":"2.5s"}],["cny-glow-spot",{"left":"37.8%","top":"8.5%","animation-delay":"1.5s","animation-duration":"2.3s"}],["cny-glow-spot",{"left":"56.3%","top":"6.5%","animation-delay":"0.3s","animation-duration":"2.7s"}],["cny-glow-spot",{"left":"37.6%","top":"91.0%","animation-delay":"1.2s","animation-duration":"2.2s"}],["cny-glow-spot",{"left":"39.2%","top":"18.9%","animation-delay":"0.6s","animation-duration":"2.6s"}],["cny-glow-spot",{"left":"67.2%","top":"26.7%","animation-delay":"1.7s","animation-duration":"2.0s"}],["cny-glow-spot",{"left":"61.3%","top":"64.1%","animation-delay":"0.4s","animation-duration":"2.4s"}],["cny-glow-spot",{"left":"38.7%","top":"65.8%","animation-delay":"1.0s","animation-duration":"2.8s"}],["cny-glow-spot",{"left":"33.2%","top":"9.8%","animation-delay":"1.9s","animation-duration":"2.1s"}],["cny-glow-spot",{"left":"59.3%","top":"93.5%","animation-delay":"0.8s","animation-duration":"2.5s"}],["cny-lantern-glow",{"left":"22.9%","top":"48.4%","animation-delay":"0.0s","animation-duration":"3.1s"}],["cny-lantern-glow",{"left":"22.9%","top":"66.4%","animation-delay":"1.1s","animation-duration":"3.4s"}],["cny-lantern-glow",{"left":"77.9%","top":"47.9%","animation-delay":"0.6s","animation-duration":"3.2s"}]],"eid":[["eid-glow-spot",{"left":"37.8%","top":"17.6%","animation-delay":"0.2s","animation-duration":"2.2s"}],["eid-glow-spot",{"left":"59.6%","top":"12.8%","animation-delay":"0.9s","animation-duration":"2.6s"}],["eid-glow-spot",{"left":"62.7%","top":"24.7%","animation-delay":"1.4s","animation-duration":"2.0s"}],["eid-glow-spot",{"left":"52.0%","top":"12.8%","animation-delay":"0.5s","animation-duration":"2.4s"}],["eid-glow-spot",{"left":"41.3%","top":"12.0%","animation-delay":"1.1s","animation-duration":"2.8s"}],["eid-glow-spot",{"left":"65.6%","top":"8.6%","animation-delay":"1.8s","animation-duration":"2.1s"}],["eid-glow-spot",{"left":"75.2%","top":"11.7%","animation-delay":"0.7s","animation-duration":"2.5s"}],["eid-glow-spot",{"left":"9.6%","top":"31.5%","animation-delay":"1.5s","animation-duration":"2.3s"}],["eid-glow-spot",{"left":"75.4%","top":"84.6%","animation-delay":"0.3s","animation-duration":"2.7s"}],["eid-glow-spot",{"left":"68.0%","top":"74.2%","animation-delay":"1.2s","animation-duration":"2.2s"}],["eid-glow-spot",{"left":"50.2%","top":"19.5%","animation-delay":"0.6s","animation-duration":"2.6s"}],["eid-glow-spot",{"left":"34.9%","top":"8.9%","animation-delay":"1.7s","animation-duration":"2.0s"}],["eid-glow-spot",{"left":"24.0%","top":"81.8%","animation-delay":"0.4s","animation-duration":"2.4s"}],["eid-glow-spot",{"left":"73.1%","top":"50.1%","animation-delay":"1.0s","animation-duration":"2.8s"}],["eid-lantern-glow",{"left":"13.1%","top":"24.7%","animation-delay":"0.0s","animation-duration":"3.1s"}],["eid-lantern-glow",{"left":"6.7%","top":"41.7%","animation-delay":"1.1s","animation-duration":"3.4s"}],["eid-lantern-glow",{"left":"86.7%","top":"24.7%","animation-delay":"0.6s","animation-duration":"3.2s"}],["eid-lantern-glow",{"left":"92.9%","top":"41.9%","animation-delay":"1.6s","animation-duration":"3.3s"}]],"midautumn":[["midautumn-moon-glow",{"left":"49.8%","top":"30.2%"}],["midautumn-glow-spot",{"left":"21.8%","top":"11.7%","animation-delay":"0.2s","animation-duration":"2.2s"}],["midautumn-glow-spot",{"left":"30.5%","top":"21.5%","animation-delay":"0.9s","animation-duration":"2.6s"}],["midautumn-glow-spot",{"left":"13.8%","top":"29.3%","animation-delay":"1.4s","animation-duration":"2.0s"}],["midautumn-glow-spot",{"left":"75.2%","top":"15.6%","animation-delay":"0.5s","animation-duration":"2.4s"}],["midautumn-glow-spot",{"left":"69.4%","top":"23.4%","animation-delay":"1.1s","animation-duration":"2.8s"}],["midautumn-glow-spot",{"left":"86.1%","top":"26.0%","animation-delay":"1.8s","animation-duration":"2.1s"}],["midautumn-glow-spot",{"left":"18.2%","top":"24.0%","animation-delay":"0.7s","animation-duration":"2.5s"}],["midautumn-glow-spot",{"left":"35.2%","top":"65.8%","animation-delay":"1.5s","animation-duration":"2.3s"}],["midautumn-glow-spot",{"left":"76.0%","top":"72.0%","animation-delay":"0.3s","animation-duration":"2.7s"}],["midautumn-lantern-glow",{"left":"11.6%","top":"4.2%","animation-delay":"0.0s","animation-duration":"3.1s"}],["midautumn-lantern-glow",{"left":"28.0%","top":"4.6%","animation-delay":"1.1s","animation-duration":"3.4s"}],["midautumn-lantern-glow",{"left":"9.1%","top":"16.3%","animation-delay":"0.6s","animation-duration":"3.2s"}],["midautumn-lantern-glow",{"left":"72.9%","top":"2.6%","animation-delay":"1.6s","animation-duration":"3.3s"}],["midautumn-lantern-glow",{"left":"88.8%","top":"8.1%","animation-delay":"0.3s","animation-duration":"3.5s"}],["midautumn-lantern-glow",{"left":"81.8%","top":"10.4%","animation-delay":"1.3s","animation-duration":"3.0s"}],["midautumn-lantern-glow",{"left":"83.7%","top":"19.3%","animation-delay":"0.8s","animation-duration":"3.4s"}],["midautumn-lantern-glow",{"left":"91.9%","top":"23.7%","animation-delay":"1.9s","animation-duration":"3.2s"}],["midautumn-lantern-glow",{"left":"3.8%","top":"41.0%","animation-delay":"0.4s","animation-duration":"3.3s"}],["midautumn-lantern-glow",{"left":"7.1%","top":"49.2%","animation-delay":"1.2s","animation-duration":"3.1s"}],["midautumn-lantern-glow",{"left":"2.0%","top":"52.7%","animation-delay":"0.9s","animation-duration":"3.5s"}],["midautumn-lantern-glow",{"left":"92.7%","top":"41.0%","animation-delay":"1.7s","animation-duration":"3.2s"}],["midautumn-lantern-glow",{"left":"97.2%","top":"54.0%","animation-delay":"0.2s","animation-duration":"3.4s"}],["midautumn-lantern-glow",{"left":"2.2%","top":"74.9%","animation-delay":"1.0s","animation-duration":"3.3s"}],["midautumn-lantern-glow",{"left":"7.6%","top":"82.0%","animation-delay":"1.5s","animation-duration":"3.1s"}],["midautumn-lantern-glow",{"left":"11.3%","top":"89.8%","animation-delay":"0.5s","animation-duration":"3.4s"}],["midautumn-lantern-glow",{"left":"96.3%","top":"82.7%","animation-delay":"1.8s","animation-duration":"3.2s"}],["midautumn-lantern-glow",{"left":"88.7%","top":"89.8%","animation-delay":"0.7s","animation-duration":"3.3s"}]]};

	function renderSeasonalDecorations(container, theme) {
		const layers = container.querySelectorAll('.seasonal-decor-layer');
		layers.forEach(layer => {
			layer.replaceChildren();
			layer.removeAttribute('data-rendered-theme');
		});

		const entries = SEASONAL_DECORATIONS[theme];
		if (!entries) return;

		const layer = container.querySelector(
			theme === 'halloween'
				? '.halloween-decor-layer'
				: '.' + theme + '-art .seasonal-decor-layer'
		);
		if (!layer) return;

		const fragment = document.createDocumentFragment();
		entries.forEach(([className, props]) => {
			const tag = className.includes('halloween-bat') ? 'span' : 'div';
			const el = document.createElement(tag);
			el.className = 'seasonal-generated ' + className;

			if (props.left) el.style.setProperty('--season-x', props.left);
			if (props.top) el.style.setProperty('--season-y', props.top);
			if (props['animation-delay']) el.style.setProperty('--season-delay', props['animation-delay']);
			if (props['animation-duration']) el.style.setProperty('--season-duration', props['animation-duration']);
			if (props.width) el.style.setProperty('--season-width', props.width);
			if (props.height) el.style.setProperty('--season-height', props.height);
			if (props.text) el.textContent = props.text;
			if (props['aria-hidden']) el.setAttribute('aria-hidden', props['aria-hidden']);

			fragment.appendChild(el);
		});
		layer.appendChild(fragment);
		layer.dataset.renderedTheme = theme;
	}

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
		container.classList.toggle('cny-theme', theme === 'cny');
		container.classList.toggle('eid-theme', theme === 'eid');
		container.classList.toggle('midautumn-theme', theme === 'midautumn');
		// Also flag it on <body> so page-wide elements (buttons, etc.) that
		// aren't inside the banner can react to the same season via CSS,
		// e.g. `body.christmas-theme .btn-apply { ... }`.
		document.body.classList.toggle('halloween-theme', theme === 'halloween');
		document.body.classList.toggle('christmas-theme', theme === 'christmas');
		document.body.classList.toggle('valentine-theme', theme === 'valentine');
		document.body.classList.toggle('cny-theme', theme === 'cny');
		document.body.classList.toggle('eid-theme', theme === 'eid');
		document.body.classList.toggle('midautumn-theme', theme === 'midautumn');
		renderSeasonalDecorations(container, theme);
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
			} else if (theme === 'cny') {
				// Gold / red firework sparks floating up, plus a few pink blossom
				// petals drifting down over the artwork.
				const petal = Math.random() < 0.25;
				const x = w * (0.04 + Math.random() * 0.92);
				const size = 0.8 + Math.random() * 1.9;
				if (petal) {
					particles.push({
						x, y: -6, size: size * 1.1, vy: 0.2 + Math.random() * 0.25,
						vx: (Math.random() - 0.5) * 0.25,
						life: 0, maxLife: 190 + Math.random() * 140,
						colorPick: 0, sway: Math.random() * Math.PI * 2,
						petal: true, rot: Math.random() * Math.PI
					});
				} else {
					particles.push({
						x, y: h * (0.75 + Math.random() * 0.3), size, vy: -(0.25 + Math.random() * 0.4),
						vx: (Math.random() - 0.5) * 0.2,
						life: 0, maxLife: 150 + Math.random() * 120,
						colorPick: Math.random(), sway: Math.random() * Math.PI * 2
					});
				}
			} else if (theme === 'eid') {
				// Golden lantern-light sparkles (some 4-point stars) with a touch of
				// emerald and pearl white, floating gently upward.
				particles.push({
					x: w * (0.04 + Math.random() * 0.92),
					y: h * (0.75 + Math.random() * 0.3),
					size: 0.8 + Math.random() * 1.9, vy: -(0.22 + Math.random() * 0.35),
					vx: (Math.random() - 0.5) * 0.2,
					life: 0, maxLife: 160 + Math.random() * 130,
					colorPick: Math.random(), sway: Math.random() * Math.PI * 2,
					star: Math.random() < 0.3
				});
			} else if (theme === 'midautumn') {
				// Warm lantern-light sparkles (gold / orange / lilac / white) rising
				// gently, a few of them 4-point stars, like drifting festival lights.
				particles.push({
					x: w * (0.04 + Math.random() * 0.92),
					y: h * (0.75 + Math.random() * 0.3),
					size: 0.8 + Math.random() * 1.9, vy: -(0.22 + Math.random() * 0.35),
					vx: (Math.random() - 0.5) * 0.2,
					life: 0, maxLife: 160 + Math.random() * 130,
					colorPick: Math.random(), sway: Math.random() * Math.PI * 2,
					star: Math.random() < 0.3
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
			} else if (theme === 'cny') {
				if (Math.random() < 0.55) spawnParticle();
			} else if (theme === 'eid') {
				if (Math.random() < 0.5) spawnParticle();
			} else if (theme === 'midautumn') {
				if (Math.random() < 0.5) spawnParticle();
			} else {
				if (Math.random() < 0.85) spawnParticle();
				if (Math.random() < 0.35) spawnParticle();
			}

			for (let i = particles.length - 1; i >= 0; i--) {
				const p = particles[i];
				if (theme === 'christmas' || theme === 'valentine' || theme === 'cny' || theme === 'eid' || theme === 'midautumn') {
					p.x += p.vx + Math.sin((p.life + p.sway * 20) * 0.04) * 0.3;
					p.y += p.vy;
				} else {
					p.x += p.vx + (theme === 'halloween' ? Math.sin(p.life * 0.05) * 0.15 : 0);
					p.y += p.vy;
					p.vy -= 0.002;
				}
				p.life++;
				const t = p.life / p.maxLife;
				if (t >= 1 || p.y > canvas.height + 10 || ((theme === 'valentine' || theme === 'cny' || theme === 'eid' || theme === 'midautumn') && p.y < -10)) { particles.splice(i, 1); continue; }
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
				} else if (theme === 'cny') {
					if (p.petal) { r = 255; g = 182; b = 203; }                 // blossom pink
					else if (p.colorPick < 0.4) { r = 255; g = 205; b = 90; }   // gold
					else if (p.colorPick < 0.7) { r = 240; g = 50; b = 40; }    // lucky red
					else if (p.colorPick < 0.88) { r = 255; g = 140; b = 40; }  // orange
					else { r = 255; g = 240; b = 200; }                         // warm white
				} else if (theme === 'eid') {
					if (p.colorPick < 0.5) { r = 255; g = 214; b = 110; }        // gold
					else if (p.colorPick < 0.72) { r = 255; g = 240; b = 205; }  // warm pearl
					else if (p.colorPick < 0.88) { r = 80; g = 220; b = 150; }   // emerald
					else { r = 255; g = 255; b = 255; }                          // white sparkle
				} else if (theme === 'midautumn') {
					if (p.colorPick < 0.4) { r = 255; g = 214; b = 110; }        // gold
					else if (p.colorPick < 0.65) { r = 255; g = 150; b = 60; }   // lantern orange
					else if (p.colorPick < 0.85) { r = 205; g = 170; b = 255; }  // lilac
					else { r = 255; g = 250; b = 235; }                          // moon white
				} else {
					r = 255;
					g = 120 + p.hueShift * 100;
					b = 20 + p.hueShift * 60;
				}
				ctx.beginPath();
				ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${alpha})`;
				ctx.shadowColor = (theme === 'halloween' || theme === 'christmas' || theme === 'valentine' || theme === 'cny' || theme === 'eid' || theme === 'midautumn') ? `rgba(${r | 0},${g | 0},${b | 0},${alpha})` : `rgba(255,140,0,${alpha})`;
				ctx.shadowBlur = theme === 'halloween' ? 4 : 5;
				const radius = p.size * (1 - t * 0.4);
				if ((theme === 'eid' || theme === 'midautumn') && p.star) {
					// Tiny 4-point sparkle star.
					const k = radius * 2.2;
					ctx.moveTo(p.x, p.y - k);
					ctx.quadraticCurveTo(p.x, p.y, p.x + k, p.y);
					ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + k);
					ctx.quadraticCurveTo(p.x, p.y, p.x - k, p.y);
					ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - k);
				} else if (theme === 'cny' && p.petal) {
					// Blossom petal: a small tilted ellipse that slowly turns as it falls.
					ctx.ellipse(p.x, p.y, radius * 1.7, radius * 0.95, p.rot + p.life * 0.03, 0, Math.PI * 2);
				} else if (theme === 'valentine' && p.heart) {
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
		// 'halloween' | 'christmas' | 'valentine' | 'cny' | 'eid' | 'midautumn' | 'none' | 'auto'
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
		// 'halloween' | 'christmas' | 'valentine' | 'cny' | 'eid' | 'midautumn' | 'none' jika dipaksa manual, atau null jika Auto.
		getOverride: getOverride,
		onChange: function (cb) { onThemeChangeCb = cb; }
	};
})();
