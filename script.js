// ================= SUPABASE PUBLIC CONFIGURATION =================
const SUPABASE_URL = 'https://pwqkpeykjyujhnreleax.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3cWtwZXlranl1amhucmVsZWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMzgxNDgsImV4cCI6MjA5ODgxNDE0OH0.6u2CKOPHcMtVeA2ph0QWTqgtvs-4BQJpsz6v2kCyOEY'; 
// =================================================================

let supabaseClient = null;
let isAdmin = false;
let savedApplications = [];
let currentPosition = 'Vice President D1';
let selectedTimeSlot = ''; 
let isReservationOpen = true; // Status kendali default website

document.addEventListener("DOMContentLoaded", () => {
    loadFooterInfo();
    checkReservationStatus(); // Memastikan status database dicek saat web dibuka pertama kali
});

function getSupabase() {
    if (!supabaseClient) {
        if (typeof window.supabase !== 'undefined') {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } else {
            console.error("Supabase CDN library failed to load");
        }
    }
    return supabaseClient;
}

// Fungsi untuk mengambil status terbaru dari Supabase berdasarkan posisi kementerian yang aktif
async function checkReservationStatus() {
    const client = getSupabase();
    if (!client) return;
    try {
        const { data, error } = await client
            .from('system_settings')
            .select('is_open')
            .eq('id', currentPosition)
            .single();
        
        if (data) {
            isReservationOpen = data.is_open;
        } else {
            // Jika posisi belum terdaftar di database, buat default-nya terbuka (true)
            isReservationOpen = true; 
        }
        updateReservationButtonUI();
    } catch (err) {
        console.error("Error checking status:", err);
    }
}

// Perbarui tampilan tombol kendali President
function updateReservationButtonUI() {
    const toggleBtn = document.getElementById('toggle-reservation-btn');
    if (!toggleBtn) return;

    if (isReservationOpen) {
        toggleBtn.innerText = "Close Reservation";
        toggleBtn.style.background = "#dc2626"; // Merah jika status aktif (siap ditutup)
    } else {
        toggleBtn.innerText = "Open Reservation";
        toggleBtn.style.background = "#22c55e"; // Hijau jika status nonaktif (siap dibuka)
    }
}

// Aksi Klik Tombol Kendali Buka/Tutup Reservasi secara mandiri per kementerian
async function handleToggleReservation() {
    if (!isAdmin) return;
    
    const client = getSupabase();
    if (!client) return;

    const newStatus = !isReservationOpen;
    const actionText = newStatus ? "membuka" : "menutup";
    
    if (confirm(`Apakah Anda yakin ingin ${actionText} reservasi khusus untuk ${currentPosition}?`)) {
        const { error } = await client
            .from('system_settings')
            .update({ is_open: newStatus })
            .eq('id', currentPosition);
            
        if (!error) {
            isReservationOpen = newStatus;
            updateReservationButtonUI();
            showToast(`Reservasi ${currentPosition} berhasil di-${newStatus ? 'buka' : 'tutup'}!`, "success");
        } else {
            showToast("Gagal memperbarui status ke database.", "error");
        }
    }
}

// FUNGSI POP-UP NOTIFIKASI KECIL MELAYANG (MENGGANTIKAN ALERT)
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerText = message;

    if (type === 'success') toast.style.borderLeftColor = '#22c55e';
    if (type === 'error') toast.style.borderLeftColor = '#ef4444';
    if (type === 'warning') toast.style.borderLeftColor = '#f59e0b';

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// FUNGSI POP-UP KONFIRMASI KUSTOM (MENGGANTIKAN CONFIRM)
function showCustomConfirm(message, onConfirm, buttonColor = '#ef4444') {
    const modal = document.getElementById('confirm-modal');
    const msgEl = document.getElementById('confirm-message');
    const okBtn = document.getElementById('confirm-ok-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');

    msgEl.innerText = message;
    okBtn.style.background = buttonColor;
    modal.classList.remove('hidden');

    const newOkBtn = okBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newOkBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        onConfirm();
    });

    newCancelBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
}

function loadFooterInfo() {
    const savedName = localStorage.getItem('president_name');
    const savedGuild = localStorage.getItem('guild_name');
    if (savedName) document.getElementById('display-president-name').innerText = savedName;
    if (savedGuild) document.getElementById('display-guild-name').innerText = savedGuild;
}

function handleEditFooter() {
    if (!isAdmin) return;
    const currentName = document.getElementById('display-president-name').innerText;
    const currentGuild = document.getElementById('display-guild-name').innerText;

    const newName = prompt("Enter New President Name:", currentName);
    if (newName === null) return;
    const newGuild = prompt("Enter New Guild Name:", currentGuild);
    if (newGuild === null) return;

    if (newName.trim() !== "") localStorage.setItem('president_name', newName.trim());
    if (newGuild.trim() !== "") localStorage.setItem('guild_name', newGuild.trim());

    loadFooterInfo();
    showToast("President info updated!", "success");
}

function handleAdminLogin() {
    const editFooterBtn = document.getElementById('edit-footer-btn');
    const toggleResBtn = document.getElementById('toggle-reservation-btn'); 

    if (!isAdmin) {
        const password = prompt("Enter President Password:");
        if (password === "3475") { 
            isAdmin = true;
            document.getElementById('admin-toggle-btn').innerText = "Logout President";
            document.getElementById('admin-indicator').style.display = "inline";
            if (editFooterBtn) editFooterBtn.style.display = "inline-block";
            if (toggleResBtn) toggleResBtn.style.display = "inline-block"; 
            showToast("Welcome back President!", "success");
        } else {
            showToast("Incorrect password!", "error");
            return;
        }
    } else {
        isAdmin = false;
        document.getElementById('admin-toggle-btn').innerText = "President Login";
        document.getElementById('admin-indicator').style.display = "none";
        if (editFooterBtn) editFooterBtn.style.display = "none";
        if (toggleResBtn) toggleResBtn.style.display = "none"; 
        showToast("Logged out from President Mode.", "info");
    }
    loadApplications();
}

function showSchedule(positionName) {
    currentPosition = positionName;
    document.getElementById('positions-page').classList.add('hidden');
    document.getElementById('schedule-page').classList.remove('hidden');
    document.getElementById('selected-title').innerText = positionName;
    detectAndSetTimezone();
    
    // Tarik status dari database dulu, setelah ter-update baru load data tabelnya
    checkReservationStatus().then(() => {
        loadApplications();
    });
}

function detectAndSetTimezone() {
    const selector = document.getElementById('timezone');
    if (!selector) return;
    selector.innerHTML = "";

    const tzLabels = {
        "-12": "Kwajalein", "-11": "Midway Island", "-10": "Hawaii", "-9": "Alaska", 
        "-8": "Pacific Time", "-7": "Mountain Time", "-6": "Central Time", 
        "-5": "Eastern Time", "-4": "Atlantic Time", "-3.5": "Newfoundland", 
        "-3": "Buenos Aires", "-2": "Mid-Atlantic", "-1": "Azores", 
        "0": "GMT / UTC", "1": "Berlin, Paris", "2": "Cairo, Johannesburg", 
        "3": "Moscow, Nairobi", "3.5": "Tehran", "4": "Dubai", 
        "4.5": "Kabul", "5": "Karachi", "5.5": "New Delhi", 
        "5.75": "Kathmandu", "6": "Dhaka", "6.5": "Yangon", 
        "7": "Jakarta, WIB", "8": "Singapore, WITA", "9": "Tokyo, WIT", 
        "9.5": "Darwin", "10": "Sydney", "10.5": "Lord Howe",
        "11": "Solomon Is.", "11.5": "Norfolk Is.", "12": "Auckland, Fiji", 
        "12.75": "Chatham Is.", "13": "Tonga", "14": "Kiritimati"
    };

    const offsets = [
        -12, -11, -10, -9, -8, -7, -6, -5, -4, -3.5, -3, -2, -1, 0, 
        1, 2, 3, 3.5, 4, 4.5, 5, 5.5, 5.75, 6, 6.5, 7, 8, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.75, 13, 14
    ];

    const userOffsetMinutes = new Date().getTimezoneOffset();
    const userOffsetHours = parseFloat((-(userOffsetMinutes / 60)).toFixed(2));
    let exactMatchFound = false;

    offsets.forEach(offset => {
        const option = document.createElement('option');
        option.value = offset;
        const sign = offset >= 0 ? "+" : "-";
        const absOffset = Math.abs(offset);
        const hours = Math.floor(absOffset);
        const minutes = Math.round((absOffset % 1) * 60);
        const timeString = `UTC ${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        const label = tzLabels[String(offset)] ? ` (${tzLabels[String(offset)]})` : "";
        option.text = `${timeString}${label}`;

        if (Math.abs(offset - userOffsetHours) < 0.1) {
            option.selected = true;
            exactMatchFound = true;
        }
        selector.add(option);
    });

    if (!exactMatchFound) {
        const sign = userOffsetHours >= 0 ? "+" : "-";
        const absOffset = Math.abs(userOffsetHours);
        const hours = Math.floor(absOffset);
        const minutes = Math.round((absOffset % 1) * 60);
        const customOption = document.createElement('option');
        customOption.value = userOffsetHours;
        customOption.text = `UTC ${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} (Your Location)`;
        customOption.selected = true;
        selector.insertBefore(customOption, selector.firstChild);
    }
}

function showPositions() {
    document.getElementById('schedule-page').classList.add('hidden');
    document.getElementById('positions-page').classList.remove('hidden');
}

async function loadApplications() {
    const client = getSupabase();
    if (!client) return;
    try {
        const { data, error } = await client.from('reservation_slots').select('*').eq('position', currentPosition);
        if (error) throw error;
        savedApplications = data || [];
    } catch (e) {
        console.error("Database failure:", e);
        savedApplications = [];
    }
    renderTimeSlots();
}

function renderTimeSlots() {
    const tbody = document.getElementById('schedule-table-body');
    if (!tbody) return;
    const offset = parseFloat(document.getElementById('timezone').value);
    tbody.innerHTML = "";

    for (let i = 0; i < 48; i++) {
        let totalMinutes = i * 30;
        let utcH = Math.floor(totalMinutes / 60);
        let utcM = totalMinutes % 60;
        let utcTimeStr = `${String(utcH).padStart(2, '0')}:${String(utcM).padStart(2, '0')}`;

        let totalLocalMinutes = totalMinutes + Math.round(offset * 60);
        let localH = Math.floor(totalLocalMinutes / 60) % 24;
        if (localH < 0) localH += 24;
        let localM = totalLocalMinutes % 60;
        if (localM < 0) localM += 60;
        let localTimeStr = `${String(localH).padStart(2, '0')}:${String(localM).padStart(2, '0')}`;

        let appsInSlot = savedApplications.filter(a => String(a.time_slot).trim() === utcTimeStr);
        let acceptedApp = appsInSlot.find(a => a.status === 'Accepted');
        let countWaiting = appsInSlot.filter(a => a.status === 'Waiting').length;

        const row = document.createElement('tr');
        if (acceptedApp) {
            let actionBtn = isAdmin ? `<button class="btn-apply" style="background:#ef4444;" onclick="removeApp(${acceptedApp.id})">Remove</button>` : '-';
            row.innerHTML = `
                <td>${actionBtn}</td>
                <td><strong>${utcTimeStr} UTC</strong><br><small style="color:#8a8d98;">Local: ${localTimeStr}</small></td>
                <td><span style="color:#22c55e; font-weight:bold;">Accepted</span></td>
                <td>${acceptedApp.nickname}</td><td>${acceptedApp.game_id}</td><td>${acceptedApp.fire_crystal || '0'}</td>
                <td>${acceptedApp.general_speedup || '0'}</td><td>${acceptedApp.construction_speedup || '0'}</td>
                <td>${acceptedApp.research_speedup || '0'}</td><td>${acceptedApp.training_speedup || '0'}</td>
            `;
        } else {
            let actionBtn = `<button class="btn-apply" onclick="applySlot('${utcTimeStr}')">Apply</button>`;
            let statusText = '<span class="no-apps">No Applications</span>';
            if (countWaiting > 0) {
                statusText = `<span style="color:#f59e0b; font-weight:bold; cursor:pointer; text-decoration:underline;" onclick="openWaitingModal('${utcTimeStr}')">Waiting (${countWaiting})</span>`;
            }
            row.innerHTML = `
                <td>${actionBtn}</td>
                <td><strong>${utcTimeStr} UTC</strong><br><small style="color:#8a8d98;">Local: ${localTimeStr}</small></td>
                <td>${statusText}</td>
                <td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td>
            `;
        }
        tbody.appendChild(row);
    }
}

function openWaitingModal(timeStr) {
    const modal = document.getElementById('waiting-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalTbody = document.getElementById('modal-table-body');
    modalTitle.innerText = `Waiting List - ${timeStr} UTC`;
    modalTbody.innerHTML = "";

    let appsInSlot = savedApplications.filter(a => String(a.time_slot).trim() === timeStr && a.status === 'Waiting');
    const actionHeaders = document.querySelectorAll('.admin-action-col');
    actionHeaders.forEach(el => el.style.display = isAdmin ? 'table-cell' : 'none');

    appsInSlot.forEach(app => {
        const row = document.createElement('tr');
        let actionCell = isAdmin ? `
            <td class="admin-action-col">
                <button class="btn-apply" style="background:#22c55e; margin-bottom:4px; font-size:0.75rem; padding:4px 8px;" onclick="acceptApp(${app.id})">Accept</button>
                <button class="btn-apply" style="background:#ef4444; font-size:0.75rem; padding:4px 8px;" onclick="removeApp(${app.id})">Drop</button>
            </td>
        ` : '';

        row.innerHTML = `
            ${actionCell}
            <td>${app.nickname}</td><td>${app.game_id}</td><td>${app.fire_crystal || '0'}</td>
            <td>${app.general_speedup || '0'}</td><td>${app.construction_speedup || '0'}</td>
            <td>${app.research_speedup || '0'}</td><td>${app.training_speedup || '0'}</td>
        `;
        modalTbody.appendChild(row);
    });
    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('waiting-modal').classList.add('hidden');
}

// FUNGSI UTAMA KETIKA USER KLIK TOMBOL APPLY DI TABEL JADWAL
function applySlot(time) {
    // PROTEKSI UTAMA: Jika status reservasi kementerian terkait ditutup, gagalkan pendaftaran
    if (!isReservationOpen) {
        showToast("SvS Preparation Phase doesnt begin this week", "error");
        return; 
    }

    selectedTimeSlot = time;
    document.getElementById('form-position-title').innerText = currentPosition;
    document.getElementById('form-time-title').innerText = time + " UTC";
    
    document.getElementById('input-nickname').value = "";
    document.getElementById('input-gameid').value = "";
    document.getElementById('input-fc').value = "0";
    document.getElementById('input-gensp').value = "0";
    document.getElementById('input-constsp').value = "0";
    document.getElementById('input-ressp').value = "0";
    document.getElementById('input-trainsp').value = "0";
    
    document.getElementById('apply-modal').classList.remove('hidden');
}

function closeApplyModal() {
    document.getElementById('apply-modal').classList.add('hidden');
}

async function submitApplication() {
    // KEAMANAN GANDA: Validasi status sesaat sebelum melakukan kueri penambahan ke tabel database
    if (!isReservationOpen) {
        showToast("SvS Preparation Phase doesnt begin this week", "error");
        return;
    }

    const client = getSupabase();
    if (!client) return;

    const nickname = document.getElementById('input-nickname').value.trim();
    const gameId = document.getElementById('input-gameid').value.trim();
    const fc = document.getElementById('input-fc').value.trim() || "0";
    const genSp = document.getElementById('input-gensp').value.trim() || "0";
    const constSp = document.getElementById('input-constsp').value.trim() || "0";
    const resSp = document.getElementById('input-ressp').value.trim() || "0";
    const trainSp = document.getElementById('input-trainsp').value.trim() || "0";

    if (!nickname) { showToast("Please enter In-Game Nickname!", "warning"); return; }
    if (!gameId) { showToast("Please enter In-Game ID!", "warning"); return; }

    const { error } = await client
        .from('reservation_slots')
        .insert({ 
            time_slot: selectedTimeSlot, position: currentPosition, nickname: nickname, game_id: gameId, 
            fire_crystal: fc, general_speedup: genSp, construction_speedup: constSp, research_speedup: resSp, training_speedup: trainSp,
            status: 'Waiting'
        });

    if (!error) {
        showToast("Application submitted successfully!", "success");
        closeApplyModal();
        loadApplications();
    } else {
        showToast("Database error: " + error.message, "error");
    }
}

async function acceptApp(id) {
    showCustomConfirm("Accept this application? This will lock this time slot.", async () => {
        const client = getSupabase();
        if (!client) return;
        
        closeModal(); 
        
        const { error } = await client.from('reservation_slots').update({ status: 'Accepted' }).eq('id', id);
        if (!error) {
            showToast("Application Approved!", "success");
            loadApplications();
        } else {
            showToast("Failed to approve.", "error");
        }
    }, '#22c55e');
}

async function removeApp(id) {
    showCustomConfirm("Delete this application record permanently?", async () => {
        const client = getSupabase();
        if (!client) return;
        
        closeModal(); 
        
        const { error } = await client.from('reservation_slots').delete().eq('id', id);
        if (!error) {
            showToast("Record dropped successfully.", "success");
            loadApplications();
        } else {
            showToast("Failed executing delete request.", "error");
        }
    }, '#ef4444');
}

function exportToCSV() {
    if (savedApplications.length === 0) {
        showToast("No data available to export!", "warning");
        return;
    }

    const headers = ["Position", "Time Slot UTC", "Status", "Nickname", "Game ID", "Fire Crystal", "General SP (Days)", "Construction SP (Days)", "Research SP (Days)", "Training SP (Days)"];
    const rows = savedApplications.map(app => [
        `"${app.position}"`, `"${app.time_slot}"`, `"${app.status}"`,
        `"${app.nickname || '-'}"`, `"${app.game_id || '-'}"`, `"${app.fire_crystal || '0'}"`,
        `"${app.general_speedup || '0'}"`, `"${app.construction_speedup || '0'}"`,
        `"${app.research_speedup || '0'}"`, `"${app.training_speedup || '0'}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    link.setAttribute("href", url);
    link.setAttribute("download", `SVS_Ministry_Export_${currentPosition.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast("CSV File downloaded successfully!", "success");
}
