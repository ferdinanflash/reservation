// ================= SUPABASE PUBLIC CONFIGURATION =================
const SUPABASE_URL = 'https://pwqkpeykjyujhnreleax.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3cWtwZXlranl1amhucmVsZWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMzgxNDgsImV4cCI6MjA5ODg'; 
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

function toggleAdminMode() {
    isAdmin = !isAdmin;
    document.getElementById('admin-toggle-btn').innerText = isAdmin ? "Logout Admin" : "Admin Login";
    document.getElementById('admin-indicator').style.display = isAdmin ? "inline" : "none";
    loadApplications();
}

function showSchedule(positionName) {
    currentPosition = positionName;
    document.getElementById('positions-page').classList.add('hidden');
    document.getElementById('schedule-page').classList.remove('hidden');
    document.getElementById('selected-title').innerText = positionName;
    loadApplications();
}

function showPositions() {
    document.getElementById('schedule-page').classList.add('hidden');
    document.getElementById('positions-page').classList.remove('hidden');
}

async function loadApplications() {
    const client = getSupabase();
    if (!client) return;

    try {
        // Ambil data yang sesuai dengan posisi yang dipilih saat ini
        const { data, error } = await client
            .from('reservation_slots')
            .select('*')
            .eq('position', currentPosition);

        if (error) throw error;
        savedApplications = data || [];
    } catch (e) {
        console.error("Database connection failure:", e);
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

        // Cari semua pendaftar di slot waktu ini
        let appsInSlot = savedApplications.filter(a => String(a.time_slot).trim() === utcTimeStr);
        let acceptedApp = appsInSlot.find(a => a.status === 'Accepted');
        let countWaiting = appsInSlot.filter(a => a.status === 'Waiting').length;

        // Jika sudah ada yang di-Accept, slot dikunci untuk pendaftar baru
        if (acceptedApp) {
            let row = document.createElement('tr');
            let actionBtn = isAdmin ? `<button class="btn-apply" style="background:#ef4444;" onclick="removeApp(${acceptedApp.id})">Remove</button>` : '';
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
            tbody.appendChild(row);
        } 
        // Jika belum ada yang di-Accept, tampilkan daftar pendaftar Waiting (atau baris kosong jika tidak ada)
        else {
            let actionBtn = `<button class="btn-apply" onclick="applySlot('${utcTimeStr}')">Apply</button>`;
            let statusText = countWaiting > 0 ? `<span style="color:#f59e0b;">Waiting (${countWaiting})</span>` : '<span class="no-apps">No Applications</span>';

            if (appsInSlot.length === 0) {
                // Tampilkan baris kosong default jika belum ada yang mendaftar
                let row = document.createElement('tr');
                row.innerHTML = `
                    <td>${actionBtn}</td>
                    <td><strong>${utcTimeStr} UTC</strong><br><small style="color:#8a8d98;">Local: ${localTimeStr}</small></td>
                    <td>${statusText}</td>
                    <td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td>
                `;
                tbody.appendChild(row);
            } else {
                // Jika ada pendaftar berstatus Waiting, tampilkan list-nya (Admin bisa klik Accept)
                appsInSlot.forEach(app => {
                    let row = document.createElement('tr');
                    let currentAction = actionBtn;
                    if (isAdmin) {
                        currentAction = `
                            <button class="btn-apply" style="background:#22c55e; margin-bottom:4px;" onclick="acceptApp(${app.id})">Accept</button>
                            <button class="btn-apply" style="background:#ef4444;" onclick="removeApp(${app.id})">Drop</button>
                        `;
                    }
                    row.innerHTML = `
                        <td>${currentAction}</td>
                        <td><strong>${utcTimeStr} UTC</strong><br><small style="color:#8a8d98;">Local: ${localTimeStr}</small></td>
                        <td>${statusText}</td>
                        <td>${app.nickname}</td>
                        <td>${app.game_id}</td>
                        <td>${app.fire_crystal || '-'}</td>
                        <td>${app.construction_speedup || '-'}</td>
                        <td>${app.research_speedup || '-'}</td>
                        <td>${app.training_speedup || '-'}</td>
                    `;
                    tbody.appendChild(row);
                });
            }
        }
    }
}

async function applySlot(time) {
    const client = getSupabase();
    if (!client) return;

    const nickname = prompt("Enter In-Game Nickname:");
    if (!nickname) return;
    const gameId = prompt("Enter In-Game ID:");
    if (!gameId) return;
    
    // Input tambahan baru sesuai permintaan Anda
    const fc = prompt("Enter Fire Crystal Amount:", "0");
    const constSp = prompt("Enter Construction Speedup (e.g., 10d 5h):", "-");
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
            status: 'Waiting' // Default masuk antrean persetujuan
        });

    if (!error) {
        alert("Application submitted! Waiting for Admin approval.");
        loadApplications();
    } else {
        alert("Database error: " + error.message);
    }
}

// Fitur Admin untuk menyetujui pelamar tertentu
async function acceptApp(id) {
    const client = getSupabase();
    if (!client) return;

    if (!confirm("Accept this application? This will lock the slot.")) return;

    const { error } = await client
        .from('reservation_slots')
        .update({ status: 'Accepted' })
        .eq('id', id);

    if (!error) {
        alert("Application Accepted!");
        loadApplications();
    } else {
        alert("Failed to accept application.");
    }
}

async function removeApp(id) {
    const client = getSupabase();
    if (!client) return;

    if (!confirm("Delete this record?")) return;

    const { error } = await client
        .from('reservation_slots')
        .delete()
        .eq('id', id);

    if (!error) {
        alert("Record cleared!");
        loadApplications();
    } else {
        alert("Failed clearing row record.");
    }
}
