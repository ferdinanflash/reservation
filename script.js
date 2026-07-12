// ================= SUPABASE PUBLIC CONFIGURATION =================
const SUPABASE_URL = 'https://pwqkpeykjyujhnreleax.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3cWtwZXlranl1amhucmVsZWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMzgxNDgsImV4cCI6MjA5ODgxNDE0OH0.6u2CKOPHcMtVeA2ph0QWTqgtvs-4BQJpsz6v2kCyOEY'; 
// =================================================================

let supabaseClient = null;
let isAdmin = false;
let savedApplications = [];
let currentPosition = 'Vice President D1';
let selectedTimeSlot = ''; 
let isReservationOpen = true; 

document.addEventListener("DOMContentLoaded", () => {
    if (sessionStorage.getItem('isPresidentMode') === 'true') {
        isAdmin = true;
        updateAdminUI(); 
    }
    loadFooterInfo();
    checkReservationStatus(); 
    startLiveClock();
    loadRecentAccepts();
    setInterval(() => {
        loadRecentAccepts();
        loadFooterInfo(); 
    }, 30000);
});

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast(`ID ${text} copied to clipboard!`, "success");
    }).catch(err => {
        console.error('Failed to copy: ', err);
        showToast("Failed to copy", "error");
    });
}

function updateAdminUI() {
    const adminBtn = document.getElementById('admin-toggle-btn');
    const adminInd = document.getElementById('admin-indicator');
    const editFooterBtn = document.getElementById('edit-footer-btn');
    const toggleResBtn = document.getElementById('toggle-reservation-btn'); 
    const finishSvsBtn = document.getElementById('finish-svs-btn'); 

    if (adminBtn) adminBtn.innerText = "Logout President";
    if (adminInd) adminInd.style.display = "inline";
    if (editFooterBtn) editFooterBtn.style.display = "inline-block";
    if (toggleResBtn) toggleResBtn.style.display = "inline-block"; 
    if (finishSvsBtn) finishSvsBtn.style.display = "inline-block"; 
}

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

async function checkReservationStatus() {
    const client = getSupabase();
    if (!client) return;
    try {
        const { data, error } = await client.from('system_settings').select('is_open').eq('id', currentPosition).single();
        isReservationOpen = data ? data.is_open : true;
        updateReservationButtonUI();
    } catch (err) { console.error("Error checking status:", err); }
}

function updateReservationButtonUI() {
    const toggleBtn = document.getElementById('toggle-reservation-btn');
    if (!toggleBtn) return;
    toggleBtn.innerText = isReservationOpen ? "Close Reservation" : "Open Reservation";
    toggleBtn.style.background = isReservationOpen ? "#dc2626" : "#22c55e"; 
}

async function handleToggleReservation() {
    if (!isAdmin) return;
    const client = getSupabase();
    if (!client) return;
    const newStatus = !isReservationOpen;
    if (confirm(`Are you sure to ${newStatus ? "open" : "close"} reservation for ${currentPosition}?`)) {
        const { error } = await client.from('system_settings').update({ is_open: newStatus }).eq('id', currentPosition); 
        if (!error) { isReservationOpen = newStatus; updateReservationButtonUI(); showToast(`Reservation now-${newStatus ? 'open' : 'close'}!`, "success"); }
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerText = message;
    if (type === 'success') toast.style.borderLeftColor = '#22c55e';
    if (type === 'error') toast.style.borderLeftColor = '#ef4444';
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

function showCustomConfirm(message, onConfirm, buttonColor = '#ef4444') {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-message').innerText = message;
    document.getElementById('confirm-ok-btn').style.background = buttonColor;
    modal.classList.remove('hidden');
    document.getElementById('confirm-ok-btn').onclick = () => { modal.classList.add('hidden'); onConfirm(); };
    document.getElementById('confirm-cancel-btn').onclick = () => modal.classList.add('hidden');
}

async function loadFooterInfo() {
    const client = getSupabase();
    if (!client) return;
    try {
        const { data } = await client.from('footer_settings').select('president_name, guild_name').eq('id', 'main').single();
        if (data) {
            if (data.president_name) document.getElementById('display-president-name').innerText = data.president_name;
            if (data.guild_name) document.getElementById('display-guild-name').innerText = data.guild_name;
        }
    } catch (err) { console.error("Error loading footer:", err); }
}

function handleAdminLogin() {
    if (!isAdmin) {
        if (prompt("Enter President Password:") === "3475") { 
            isAdmin = true;
            sessionStorage.setItem('isPresidentMode', 'true');
            updateAdminUI();
            showToast("Welcome back President!", "success");
        } else { showToast("Incorrect password!", "error"); }
    } else {
        isAdmin = false;
        sessionStorage.removeItem('isPresidentMode');
        location.reload();
    }
    loadApplications();
}

// Fungsi Modal Waiting List (Accordion)
function openWaitingModal(timeStr) {
    const modal = document.getElementById('waiting-modal');
    const modalTbody = document.getElementById('modal-table-body');
    document.getElementById('modal-title').innerText = `Waiting List - ${timeStr} UTC`;
    modalTbody.innerHTML = "";

    let appsInSlot = savedApplications.filter(a => String(a.time_slot).trim() === timeStr && a.status === 'Waiting');

    if (appsInSlot.length === 0) {
        modalTbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No waiting applications</td></tr>';
    }

    appsInSlot.forEach(app => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="text-align:center; width:40px;">
                <button onclick="toggleDetails(${app.id})" style="background:none; border:none; cursor:pointer; font-size:1.2rem;">👁️</button>
            </td>
            <td>${app.nickname}</td>
            <td style="cursor:pointer; color:#3b82f6; text-decoration:underline;" onclick="copyToClipboard('${app.game_id}')">${app.game_id}</td>
        `;
        modalTbody.appendChild(row);

        const detailRow = document.createElement('tr');
        detailRow.id = `detail-${app.id}`;
        detailRow.style.display = 'none';
        detailRow.innerHTML = `
            <td colspan="3" style="background:#1a1a1a; padding:10px; font-size:0.85rem;">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div>FC: ${app.fire_crystal || '0'}</div>
                    <div>Gen: ${app.general_speedup || '0'}</div>
                    <div>Const: ${app.construction_speedup || '0'}</div>
                    <div>Res: ${app.research_speedup || '0'}</div>
                    <div>Train: ${app.training_speedup || '0'}</div>
                </div>
                ${isAdmin ? `
                    <div style="margin-top:10px; display:flex; gap:10px;">
                        <button class="btn-apply" style="background:#22c55e; flex:1;" onclick="acceptApp(${app.id})">Accept</button>
                        <button class="btn-apply" style="background:#ef4444; flex:1;" onclick="removeApp(${app.id})">Drop</button>
                    </div>
                ` : ''}
            </td>
        `;
        modalTbody.appendChild(detailRow);
    });
    modal.classList.remove('hidden');
}

function toggleDetails(id) {
    const row = document.getElementById(`detail-${id}`);
    row.style.display = (row.style.display === 'none') ? 'table-row' : 'none';
}

function closeModal() { document.getElementById('waiting-modal').classList.add('hidden'); }

// ... (Tambahkan fungsi lainnya seperti loadApplications, renderTimeSlots, applySlot, dll. di bawah sini)
// Fungsi-fungsi tersebut tetap sama seperti di script asli Anda.
