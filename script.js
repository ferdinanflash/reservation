// ================= SUPABASE PUBLIC CONFIGURATION =================
const SUPABASE_URL = 'https://pwqkpeykjyujhnreleax.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3cWtwZXlranl1amhucmVsZWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMzgxNDgsImV4cCI6MjA5ODgxNDE0OH0.6u2CKOPHcMtVeA2ph0QWTqgtvs-4BQJpsz6v2kCyOEY'; 
// =================================================================

let supabaseClient = null;
let isAdmin = false;
let savedApplications = [];
let currentPosition = 'Vice President D1';
let selectedTimeSlot = ''; // Menyimpan slot waktu yang sedang dipilih

document.addEventListener("DOMContentLoaded", () => {
    loadFooterInfo();
});

function getSupabase() {
    if (!supabaseClient) {
        if (typeof window.supabase !== 'undefined') {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } else {
            console.error("Supabase CDN library failed to load in index.html");
        }
    }
    return supabaseClient;
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
    alert("President information updated successfully!");
}

function handleAdminLogin() {
    const editFooterBtn = document.getElementById('edit-footer-btn');

    if (!isAdmin) {
        const password = prompt("Enter President Password:");
        if (password === "3475") { 
            isAdmin = true;
            document.getElementById('admin-toggle-btn').innerText = "Logout President";
            document.getElementById('admin-indicator').style.display = "inline";
            if (editFooterBtn) editFooterBtn.style.display = "inline-block";
            alert("Welcome back President!");
        } else {
            alert("Incorrect password!");
            return;
        }
    } else {
        isAdmin = false;
        document.getElementById('admin-toggle-btn').innerText = "President Login";
        document.getElementById('admin-indicator').style.display = "none";
        if (editFooterBtn) editFooterBtn.style.display = "none";
        alert("Logged out from President Mode.");
    }
    loadApplications();
}

function showSchedule(positionName) {
    currentPosition = positionName;
    document.getElementById('positions-page').classList.add('hidden');
    document.getElementById('schedule-page').classList.remove('hidden');
    document.getElementById('selected-title').innerText = positionName;
    
    detectAndSetTimezone();
    loadApplications();
}

function detectAndSetTimezone() {
    const selector = document.getElementById('timezone');
    if (!selector) return;

    selector.innerHTML = "";

    const tzLabels = {
        "-12": "Kwajalein", "-11": "Midway Island", "-10": "Hawaii", "-9": "Alaska", 
        "-8": "Pacific Time (US/Canada)", "-7": "Mountain Time (US/Canada)", "-6": "Central Time (US/Canada)", 
        "-5": "Eastern Time (US/Canada)", "-4": "Atlantic Time", "-3.5": "Newfoundland", 
        "-3": "Buenos Aires, Sao Paulo", "-2": "Mid-Atlantic", "-1": "Azores", 
        "0": "London, GMT, UTC", "1": "Berlin, Paris, Rome", "2": "Cairo, Johannesburg", 
        "3": "Moscow, Baghdad, Nairobi", "3.5": "Tehran", "4": "Dubai, Baku", 
        "4.5": "Kabul", "5": "Karachi, Tashkent", "5.5": "Mumbai, New Delhi", 
        "5.75": "Kathmandu", "6": "Dhaka, Almaty", "6.5": "Yangon (Myanmar)", 
        "7": "Jakarta, Bangkok, WIB", "8": "Singapore, Manila, Beijing, WITA", "9": "Tokyo, Seoul, WIT", 
        "9.5": "Darwin, Adelaide", "10": "Sydney, Melbourne, Vladivostok", "10.5": "Lord Howe Island",
        "11": "Solomon Islands", "11.5": "Norfolk Island", "12": "Auckland, Fiji", 
        "12.75": "Chatham Islands", "13": "Nuku'alofa (Tonga)", "14": "Kiritimati"
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
        const { data, error } = await client
            .from('reservation_slots')
            .select('*')
            .eq('position', currentPosition);

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
                <td>${acceptedApp.nickname}</td>
                <td>${acceptedApp.game_id}</td>
                <td>${acceptedApp.fire_crystal || ''}</td>
                <td>${acceptedApp.general_speedup || ''}</td>
                <td>${acceptedApp.construction_speedup || ''}</td>
                <td>${acceptedApp.research_speedup || ''}</td>
                <td>${acceptedApp.training_speedup || ''}</td>
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
            <td>${app.nickname}</td>
            <td>${app.game_id}</td>
            <td>${app.fire_crystal || '-'}</td>
            <td>${app.general_speedup || '0'}</td>
            <td>${app.construction_speedup || '0'}</td>
            <td>${app.research_speedup || '0'}</td>
            <td>${app.training_speedup || '0'}</td>
        `;
        modalTbody.appendChild(row);
    });

    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('waiting-modal').classList.add('hidden');
}

// 1. Membuka Custom Apply Modal
function applySlot(time) {
    selectedTimeSlot = time;
    
    // Tampilkan informasi text di dalam form info
    document.getElementById('form-position-title').innerText = currentPosition;
    document.getElementById('form-time-title').innerText = time + " UTC";
    
    // Reset isi semua field form sebelum diisi baru
    document.getElementById('input-nickname').value = "";
    document.getElementById('input-gameid').value = "";
    document.getElementById('input-fc').value = "0";
    document.getElementById('input-gensp').value = "-";
    document.getElementById('input-constsp').value = "-";
    document.getElementById('input-ressp').value = "-";
    document.getElementById('input-trainsp').value = "-";
    
    // Munculkan Modal ke layar
    document.getElementById('apply-modal').classList.remove('hidden');
}

// 2. Menutup Custom Apply Modal
function closeApplyModal() {
    document.getElementById('apply-modal').classList.add('hidden');
}

// 3. Mengirim Data Form Kustom ke Supabase
async function submitApplication() {
    const client = getSupabase();
    if (!client) return;

    // Ambil nilai data dari setiap elemen input form kustom
    const nickname = document.getElementById('input-nickname').value.trim();
    const gameId = document.getElementById('input-gameid').value.trim();
    const fc = document.getElementById('input-fc').value.trim() || "0";
    const genSp = document.getElementById('input-gensp').value.trim() || "-";
    const constSp = document.getElementById('input-constsp').value.trim() || "-";
    const resSp = document.getElementById('input-ressp').value.trim() || "-";
    const trainSp = document.getElementById('input-trainsp').value.trim() || "-";

    // Validasi data penting wajib diisi
    if (!nickname) { alert("Please enter In-Game Nickname!"); return; }
    if (!gameId) { alert("Please enter In-Game ID!"); return; }

    const { error } = await client
        .from('reservation_slots')
        .insert({ 
            time_slot: selectedTimeSlot, 
            position: currentPosition,
            nickname: nickname, 
            game_id: gameId, 
            fire_crystal: fc,
            general_speedup: genSp,
            construction_speedup: constSp,
            research_speedup: resSp,
            training_speedup: trainSp,
            status: 'Waiting'
        });

    if (!error) {
        alert("Application submitted successfully! Status: Waiting.");
        closeApplyModal(); // Tutup modal setelah berhasil
        loadApplications(); // Refresh tabel data jadwal
    } else {
        alert("Database error: " + error.message);
    }
}

async function acceptApp(id) {
    const client = getSupabase();
    if (!client) return;

    if (!confirm("Accept this application? This action will overwrite and lock this time slot.")) return;

    const { error } = await client
        .from('reservation_slots')
        .update({ status: 'Accepted' })
        .eq('id', id);

    if (!error) {
        alert("Application Accepted and Slot Locked!");
        closeModal();
        loadApplications();
    } else {
        alert("Failed approving target application.");
    }
}

async function removeApp(id) {
    const client = getSupabase();
    if (!client) return;

    if (!confirm("Delete this application record?")) return;

    const { error } = await client
        .from('reservation_slots')
        .delete()
        .eq('id', id);

    if (!error) {
        alert("Record permanently dropped.");
        closeModal();
        loadApplications();
    } else {
        alert("Failed executing delete request.");
    }
}
