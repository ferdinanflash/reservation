let isAdmin = false;
let savedApplications = [];

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

async function loadApplications() {
    try {
        const response = await fetch('/api/applications');
        savedApplications = await response.json();
    } catch (e) {
        console.log("Backend not running? Using local memory empty array.");
        savedApplications = [];
    }
    renderTimeSlots();
}

function renderTimeSlots() {
    const tbody = document.getElementById('schedule-table-body');
    const offset = parseInt(document.getElementById('timezone').value, 10);
    tbody.innerHTML = "";

    // 48 slots = 24 hours * 2 (every 30 mins)
    for (let i = 0; i < 48; i++) {
        let totalMinutes = i * 30;
        let utcH = Math.floor(totalMinutes / 60);
        let utcM = totalMinutes % 60;
        let utcTimeStr = `${String(utcH).padStart(2, '0')}:${String(utcM).padStart(2, '0')}`;

        // Accurate Timezone Math
        let localH = (utcH + offset) % 24;
        if (localH < 0) localH += 24; 
        let localTimeStr = `${String(localH).padStart(2, '0')}:${String(utcM).padStart(2, '0')}`;

        // Check if an entry exists inside the application state
        let app = savedApplications.find(a => a.time === utcTimeStr);

        let actionBtn = '';
        let appStatus = '<span class="no-apps">No Applications</span>';
        let nick = '-';
        let gameId = '-';

        if (app) {
            nick = app.nickname || '-';
            gameId = app.gameId || '-';
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
    const nickname = prompt("Enter In-Game Nickname:");
    const gameId = prompt("Enter In-Game ID:");
    if (!nickname || !gameId) return;

    try {
        const response = await fetch('/api/applications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ time, nickname, gameId, status: 'Accepted' })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            alert("Application submitted successfully!");
            loadApplications(); // Refresh the table layout
        } else {
            alert("Failed to submit: " + (result.error || "Unknown server error"));
        }
    } catch (error) {
        console.error("Network Error:", error);
        alert("Could not connect to the backend server. Make sure server.js is running.");
    }
}

async function removeApp(time) {
    if (!confirm(`Are you sure you want to remove the application for ${time}?`)) return;
    
    try {
        const response = await fetch('/api/applications/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ time })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            alert("Application removed successfully!");
            loadApplications(); // Refresh the table layout
        } else {
            alert("Failed to remove: " + (result.error || "Unknown server error"));
        }
    } catch (error) {
        console.error("Network Error:", error);
        alert("Could not connect to the backend server.");
    }
}
