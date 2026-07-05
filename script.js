// ================= SUPABASE PUBLIC CONFIGURATION =================
const SUPABASE_URL = 'https://pwqkpeykjyujhnreleax.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3cWtwZXlranl1amhucmVsZWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMzgxNDgsImV4cCI6MjA5ODgxNDE0OH0.6u2CKOPHcMtVeA2ph0QWTqgtvs-4BQJpsz6v2kCyOEY'; 
// =================================================================

let supabaseClient = null;
let isAdmin = false;
let savedApplications = [];
let currentPosition = 'Vice President D1';

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

// Mengubah logika teks login menggunakan istilah President
function handleAdminLogin() {
    if (!isAdmin) {
        const password = prompt("Enter President Password:");
        if (password === "idn") {
            isAdmin = true;
            document.getElementById('admin-toggle-btn').innerText = "Logout President";
            document.getElementById('admin-indicator').style.display = "inline";
            alert("Logged in as President successfully!");
        } else {
            alert("Incorrect password!");
            return;
        }
    } else {
        isAdmin = false;
        document.getElementById('admin-toggle-btn').innerText = "President Login";
        document.getElementById('admin-indicator').style.display = "none";
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

    const offsetMinutes = new Date().getTimezoneOffset();
    const offsetHours = -(offsetMinutes / 60);
    const matchedOption = Array.from(selector.options).find(option => parseInt(option.value, 10) === Math.round(offsetHours));

    if (matchedOption) {
        selector.value = matchedOption.value;
    } else {
        const sign = offsetHours >= 0 ? "+" : "";
        const formattedHours = String(Math.abs(Math.floor(offsetHours))).padStart(2, '0');
        const formattedMinutes = String(Math.abs(offsetMinutes % 60)).padStart(2, '0');
        
        const newOption = document.createElement('option');
        newOption.value = Math.round(offsetHours);
        newOption.text = `Auto: UTC ${sign}${formattedHours}:${formattedMinutes}`;
        newOption.selected = true;
        selector.add(newOption);
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
    
    const offset = parseInt(document.getElementById('timezone').value, 10);
    tbody.innerHTML = "";

    for (let i = 0; i < 48; i++) {
        let totalMinutes = i * 30;
        let utcH = Math.floor(totalMinutes / 60);
        let utcM = totalMinutes % 60;
        let utcTimeStr = `${String(utcH).padStart(2, '0')}:${String(utcM).padStart(2, '0')}`;

        let localH = (utcH + offset) % 24;
        if (localH < 0) localH += 24; 
        let localTimeStr = `${String(localH).padStart(2, '0')}:${String(utcM).padStart(2, '0')}`;

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
                <td>${acceptedApp.fire_crystal || '-'}</td>
                <td>${acceptedApp.construction_speedup || '-'}</td>
                <td>${acceptedApp.research_speedup || '-'}</td>
                <td>${acceptedApp.training_speedup || '-'}</td>
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
                <td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td>
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
            <td>${app.construction_speedup || '-'}</td>
            <td>${app.research_speedup || '-'}</td>
            <td>${app.training_speedup || '-'}</td>
        `;
        modalTbody.appendChild(row);
    });

    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('waiting-modal').classList.add('hidden');
}

async function applySlot(time) {
    const client = getSupabase();
    if (!client) return;

    const nickname = prompt("Enter In-Game Nickname:");
    if (!nickname) return;
    const gameId = prompt("Enter In-Game ID:");
    if (!gameId) return;
    
    const fc = prompt("Enter Fire Crystal Amount:", "0");
    const constSp = prompt("Enter Construction Speedup:", "-");
    const resSp = prompt("Enter Research Speedup:", "-");
    const trainSp = prompt("Enter Training Speedup:", "-");

    const { error } = await client
        .from('reservation_slots')
        .insert({ 
            time_slot: time, 
            position: currentPosition,
            nickname: nickname, 
            game_id: gameId, 
            fire_crystal: fc,
            construction_speedup: constSp,
            research_speedup: resSp,
            training_speedup: trainSp,
            status: 'Waiting'
        });

    if (!error) {
        alert("Application submitted successfully! Status: Waiting.");
        loadApplications();
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
