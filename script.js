let isAdmin = false;
let savedApplications = [];

// ================= GITHUB CONFIGURATION =================
const GITHUB_TOKEN = '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'; // Set your token here
const OWNER = 'ferdinanflash';                 
const REPO = 'reservation';                     
const FILE_PATH = 'application.xml';            
const BRANCH = 'main';                          
// ========================================================

const GITHUB_API_URL = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
let fileSHA = null; // Track file state for updates

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

// Fetch XML straight from GitHub tree
async function loadApplications() {
    try {
        const response = await fetch(`${GITHUB_API_URL}?ref=${BRANCH}`, {
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github+json',
                'User-Agent': 'SVS-App'
            }
        });

        if (response.status === 404) {
            savedApplications = [];
            renderTimeSlots();
            return;
        }

        const data = await response.json();
        fileSHA = data.sha; // Save the SHA identifier for updating later
        const rawXml = atob(data.content); // Decode Base64 from GitHub
        
        // Parse basic XML properties manually to get rid of xml2js dependency on frontend
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(rawXml, "text/xml");
        const slots = xmlDoc.getElementsByTagName("slot");
        
        savedApplications = [];
        for (let i = 0; i < slots.length; i++) {
            savedApplications.push({
                time: slots[i].getElementsByTagName("time")[0]?.textContent,
                nickname: slots[i].getElementsByTagName("nickname")[0]?.textContent,
                gameId: slots[i].getElementsByTagName("gameId")[0]?.textContent,
                status: slots[i].getElementsByTagName("status")[0]?.textContent
            });
        }
    } catch (e) {
        console.error("Error connecting directly to GitHub:", e);
        savedApplications = [];
    }
    renderTimeSlots();
}

function renderTimeSlots() {
    const tbody = document.getElementById('schedule-table-body');
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

        let app = savedApplications.find(a => String(a.time).trim() === utcTimeStr);

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

// Convert JavaScript Array back to String XML structure
function buildXMLString(slotsArray) {
    let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<applications>\n`;
    slotsArray.forEach(s => {
        xml += `  <slot>\n    <time>${s.time}</time>\n    <nickname>${s.nickname}</nickname>\n    <gameId>${s.gameId}</gameId>\n    <status>${s.status}</status>\n  </slot>\n`;
    });
    xml += `</applications>`;
    return xml;
}

async function saveToGitHub(updatedXML, commitMessage) {
    const base64Content = btoa(unescape(encodeURIComponent(updatedXML))); // Safely turn text into base64
    
    const body = {
        message: commitMessage,
        content: base64Content,
        branch: BRANCH
    };
    if (fileSHA) body.sha = fileSHA;

    const response = await fetch(GITHUB_API_URL, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            'User-Agent': 'SVS-App'
        },
        body: JSON.stringify(body)
    });

    return response.ok;
}

async function applySlot(time) {
    const nickname = prompt("Enter In-Game Nickname:");
    const gameId = prompt("Enter In-Game ID:");
    if (!nickname || !gameId) return;

    // Add new application to our local array state
    const targetList = savedApplications.filter(a => a.time !== time);
    targetList.push({ time, nickname, gameId, status: 'Accepted' });

    const updatedXML = buildXMLString(targetList);
    const success = await saveToGitHub(updatedXML, `Apply slot for ${time}`);

    if (success) {
        alert("Application updated directly on GitHub!");
        loadApplications();
    } else {
        alert("Failed pushing update to GitHub tree. Check token permissions.");
    }
}

async function removeApp(time) {
    if (!confirm(`Remove reservation for ${time}?`)) return;

    const targetList = savedApplications.filter(a => a.time !== time);
    const updatedXML = buildXMLString(targetList);
    const success = await saveToGitHub(updatedXML, `Remove slot for ${time}`);

    if (success) {
        alert("Application removed!");
        loadApplications();
    } else {
        alert("Failed to remove data from GitHub.");
    }
}
