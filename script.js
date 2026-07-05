// ================= SUPABASE PUBLIC CONFIGURATION =================
const SUPABASE_URL = 'https://pwqkpeykjyujhnreleax.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3cWtwZXlranl1amhucmVsZWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMzgxNDgsImV4cCI6MjA5ODg'; 
// =================================================================


let supabaseClient = null;
let isAdmin = false;
let savedApplications = [];

// Secure connection initializer
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
    document.getElementById('positions-page').classList.add('hidden');
    document.getElementById('schedule-page').classList.remove('hidden');
    document.getElementById('selected-title').innerText = positionName;
    loadApplications();
}

function showPositions() {
    document.getElementById('schedule-page').classList.add('hidden');
    document.getElementById('positions-page').classList.remove('hidden');
}

// Fetch reservations straight from the database table
async function loadApplications() {
    const client = getSupabase();
    if (!client) return;

    try {
        const { data, error } = await client
            .from('reservation_slots')
            .select('*');

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

        let app = savedApplications.find(a => String(a.time_slot).trim() === utcTimeStr);

        let actionBtn = '';
        let appStatus = '<span class="no-apps">No Applications</span>';
        let nick = '-';
        let gameId = '-';

        if (app) {
            nick = app.nickname || '-';
            gameId = app.game_id || '-';
            appStatus = app.status === 'Accepted' ? '<span style="color:#22c55e;">Accepted</span>' : 'Pending';
            
            if (isAdmin) {
                actionBtn = `<button class="btn-apply" style="background:#ef4444;" onclick="removeApp('${utcTimeStr}')">Remove</button>`;
            }
        } else {
            actionBtn = `<button class="btn-apply" onclick="applySlot('${utcTimeStr}')">Apply</button>`;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${actionBtn}</td>
            <td><strong>${utcTimeStr} UTC</strong><br><small style="color:#8a8d98;">Local: ${localTimeStr}</small></td>
            <td>${appStatus}</td>
            <td>${nick}</td>
            <td>${gameId}</td>
        `;
        tbody.appendChild(row);
    }
}

async function applySlot(time) {
    const client = getSupabase();
    if (!client) return;

    const nickname = prompt("Enter In-Game Nickname:");
    const gameId = prompt("Enter In-Game ID:");
    if (!nickname || !gameId) return;

    const { error } = await client
        .from('reservation_slots')
        .upsert({ time_slot: time, nickname, game_id: gameId, status: 'Accepted' }, { onConflict: 'time_slot' });

    if (!error) {
        alert("Application saved successfully!");
        loadApplications();
    } else {
        alert("Database execution error: " + error.message);
    }
}

async function removeApp(time) {
    const client = getSupabase();
    if (!client) return;

    if (!confirm(`Delete reservation for ${time}?`)) return;

    const { error } = await client
        .from('reservation_slots')
        .delete()
        .eq('time_slot', time);

    if (!error) {
        alert("Application dropped successfully!");
        loadApplications();
    } else {
        alert("Failed clearing row record.");
    }
}
