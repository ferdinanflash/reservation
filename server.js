const express = require('express');
const xml2js = require('xml2js');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// ================= GITHUB CONFIGURATION =================
const GITHUB_TOKEN = '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'; // Replace with your token
const OWNER = 'ferdinanflash';                    // Replace with your GitHub username
const REPO = 'reservation';                     // Replace with your repository name
const FILE_PATH = 'application.xml';                      // Path to the file in your repo
const BRANCH = 'main';                                    // Your default branch (e.g., main or master)
// ========================================================

const GITHUB_API_URL = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;

// Helper to handle API requests to GitHub
async function fetchFromGitHub() {
    const response = await fetch(`${GITHUB_API_URL}?ref=${BRANCH}`, {
        headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        }
    });

    if (response.status === 404) {
        // File doesn't exist yet, return empty application template
        return { sha: null, content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><applications></applications>' };
    }

    const data = await response.json();
    // GitHub returns file content encoded in Base64; decode it to plain text string
    const decodedContent = Buffer.from(data.content, 'base64').toString('utf-8');
    return { sha: data.sha, content: decodedContent };
}

async function pushToGitHub(content, sha, message) {
    const base64Content = Buffer.from(content).toString('base64');
    
    const body = {
        message: message,
        content: base64Content,
        branch: BRANCH
    };
    if (sha) body.sha = sha; // GitHub requires the existing file's SHA to update it

    const response = await fetch(GITHUB_API_URL, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify(body)
    });

    return response.ok;
}

// API Endpoint: Get data from GitHub XML
app.get('/api/applications', async (req, res) => {
    try {
        const { content } = await fetchFromGitHub();
        xml2js.parseString(content, { explicitArray: false }, (err, result) => {
            if (err) return res.status(500).json({ error: "XML Parsing Error" });
            let slots = (result && result.applications && result.applications.slot) || [];
            if (!Array.isArray(slots)) slots = [slots];
            res.json(slots);
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API Endpoint: Accept / Add Application to GitHub XML
app.post('/api/applications', async (req, res) => {
    try {
        const { time, nickname, gameId, status } = req.body;
        const { sha, content } = await fetchFromGitHub();

        xml2js.parseString(content, { explicitArray: false }, async (err, result) => {
            if (err) return res.status(500).json({ error: "XML Parsing Error" });
            
            if (!result || !result.applications) result = { applications: { slot: [] } };
            let slots = result.applications.slot || [];
            if (!Array.isArray(slots)) slots = [slots];

            const existingIndex = slots.findIndex(s => s.time === time);
            const newData = { time, nickname, gameId, status };

            if (existingIndex > -1) {
                slots[existingIndex] = newData;
            } else {
                slots.push(newData);
            }

            result.applications.slot = slots;
            const builder = new xml2js.Builder();
            const updatedXML = builder.buildObject(result);

            await pushToGitHub(updatedXML, sha, `Update slot application for ${time}`);
            res.json({ success: true });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API Endpoint: Remove Application from GitHub XML
app.post('/api/applications/remove', async (req, res) => {
    try {
        const { time } = req.body;
        const { sha, content } = await fetchFromGitHub();

        xml2js.parseString(content, { explicitArray: false }, async (err, result) => {
            if (err) return res.status(500).json({ error: "XML Parsing Error" });
            
            let slots = (result && result.applications && result.applications.slot) || [];
            if (!Array.isArray(slots)) slots = [slots];

            // Filter out the requested time slot
            const filteredSlots = slots.filter(s => s.time !== time);
            result.applications.slot = filteredSlots;

            const builder = new xml2js.Builder();
            const updatedXML = builder.buildObject(result);

            await pushToGitHub(updatedXML, sha, `Remove slot application for ${time}`);
            res.json({ success: true });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => console.log('Server running on http://localhost:3000 - Connected to GitHub tree'));

let slots = (result && result.applications && result.applications.slot) || [];
if (!Array.isArray(slots)) slots = [slots];


if (!result || !result.applications) result = { applications: { slot: [] } };
let slots = result.applications.slot || [];
if (!Array.isArray(slots)) slots = [slots];
// ... slots.findIndex is called here ...
result.applications.slot = slots; 
// This is what the 'result' variable looks like inside your app.get() or app.post() endpoints:
{ 
  applications: { 
    slot: { 
      time: "00:00", 
      nickname: "Player1" 
    } 
  } 
}

// Inside fetchFromGitHub():
headers: {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'SVS-Ministry-App' // <-- ADD THIS LINE
}

// Inside pushToGitHub():
headers: {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'SVS-Ministry-App' // <-- ADD THIS LINE
}
