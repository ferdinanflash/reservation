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

// Generate Time Rows Programmatically
function generateTimeSlots() {
    const tbody = document.getElementById('schedule-table-body');
    tbody.innerHTML = ""; // Clear old contents

    let currentHour = 0;
    let currentMinute = 0;

    // Generates the first few rows matching your app layout
    for (let i = 0; i < 8; i++) {
        // Format time display values strings (e.g., 01:30)
        let hh = String(currentHour).padStart(2, '0');
        let mm = String(currentMinute).padStart(2, '0');
        
        // Calculate placeholder WIB timezone offset (+7 hours manually for visual decoration)
        let wibHour = (currentHour + 7) % 24;
        let wibHh = String(wibHour).padStart(2, '0');

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><button class="btn-apply" onclick="alert('Applying for ${hh}:${mm} UTC')">Apply</button></td>
            <td>
                <strong>${hh}:${mm} UTC</strong><br>
                <small style="color: #626773;">WIB: ${wibHh}:${mm}</small>
            </td>
            <td class="no-apps">No Applications</td>
            <td>-</td>
            <td>-</td>
        `;
        tbody.appendChild(row);

        // Advance slot by 30 minutes increments
        currentMinute += 30;
        if (currentMinute >= 60) {
            currentMinute = 0;
            currentHour++;
        }
    }
}
