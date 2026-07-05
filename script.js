// Toggle Between Pages
function showSchedule(positionName) {
    document.getElementById('positions-page').classList.add('hidden');
    document.getElementById('schedule-page').classList.remove('hidden');
    document.getElementById('selected-title').innerText = positionName;
    
    generateTimeSlots();
}

function showPositions() {
    document.getElementById('schedule-page').classList.add('hidden');
    document.getElementById('positions-page').classList.remove('hidden');
}

// Generate Time Rows Programmatically based on GMT option
function generateTimeSlots() {
    const tbody = document.getElementById('schedule-table-body');
    const tzSelect = document.getElementById('timezone');
    
    // Get the selected integer offset (e.g., 7, 0, -5)
    const offset = parseInt(tzSelect.value, 10);
    const selectedText = tzSelect.options[tzSelect.selectedIndex].text.split(' ')[0]; // Gets "GMT" or "UTC"
    
    tbody.innerHTML = ""; // Reset table

    let currentHour = 0;
    let currentMinute = 0;

    // Loop 48 times to cover all 30-minute intervals in a 24-hour window
    for (let i = 0; i < 48; i++) {
        // Format Base UTC string
        let utcHH = String(currentHour).padStart(2, '0');
        let utcMM = String(currentMinute).padStart(2, '0');
        
        // Calculate Target GMT/Offset Time
        let targetHour = currentHour + offset;
        
        // Handle negative offsets (e.g., -5) and wrapping past midnight (> 24)
        if (targetHour < 0) {
            targetHour = 24 + (targetHour % 24);
        }
        targetHour = targetHour % 24;

        let targetHH = String(targetHour).padStart(2, '0');
        let targetMM = String(currentMinute).padStart(2, '0');

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><button class="btn-apply" onclick="alert('Applying for ${utcHH}:${utcMM} UTC')">Apply</button></td>
            <td>
                <strong>${utcHH}:${utcMM} UTC</strong><br>
                <small style="color: #8a8d98;">${selectedText}: ${targetHH}:${targetMM}</small>
            </td>
            <td class="no-apps">No Applications</td>
            <td>-</td>
            <td>-</td>
        `;
        tbody.appendChild(row);

        // Step forward by 30 minutes
        currentMinute += 30;
        if (currentMinute >= 60) {
            currentMinute = 0;
            currentHour++;
        }
    }
}
