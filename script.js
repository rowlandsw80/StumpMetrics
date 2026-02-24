/* =========================================
   GLOBAL STATE
========================================= */

let battingData = [];
let bowlingData = [];

let battingChartInstance = null;
let bowlingChartInstance = null;
let scatterChartInstance = null;
let seasonTrendChartInstance = null;

/* =========================================
   CLUB CONFIG
========================================= */

const clubs = {
    neath: {
        id: "NeathCC",
        name: "Neath Cricket Club",
        season: "2025",
        team: "1xi",
        logo: "images/clubbadges/neathccbadge.jpg"
    }
};

/* =========================================
   NAVIGATION
========================================= */

function toggleMenu() {
    document.getElementById("menu")?.classList.toggle("hidden");
}

function showPage(pageId) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.getElementById(pageId)?.classList.add("active");
}


/* =========================================
   ROUTING
========================================= */

function openClubTeams() {
    showPage("neathClub");
}

function openTeam() {
    openClub("neath");
}

function openClub(key) {

    const club = clubs[key];
    if (!club) return;

    showPage("neath");

    document.querySelector(".club-title").textContent = club.name;
    document.getElementById("clubLogo").src = club.logo;

    loadClubData(club);
}

function changeSeason(season) {
    clubs.neath.season = season;
    openClub("neath");
}

/* =========================================
   CSV PARSER (AUTO DELIMITER)
========================================= */

function parseCSV(text) {

    const lines = text.trim().split("\n");
    const delimiter = lines[0].includes(",") ? "," : "\t";
    const headers = lines[0].split(delimiter);

    return lines.slice(1).map(line => {
        const values = line.split(delimiter);
        let obj = {};
        headers.forEach((h, i) => {
            obj[h.trim()] = values[i]?.trim();
        });
        return obj;
    });
}

/* =========================================
   LOAD DATA (SAFE)
========================================= */

function loadClubData(club) {

    const base = `data/${club.id}/${club.season}/${club.team}`;

    Promise.all([
        fetch(`${base}_batting_stats.csv`).then(r => r.text()),
        fetch(`${base}_bowling_stats.csv`).then(r => r.text())
    ])
    .then(([batText, bowlText]) => {

        battingData = parseCSV(batText);
        bowlingData = parseCSV(bowlText);

        renderBattingTable();
        renderBowlingTable();

        calculateBattingHighlights();
        calculateBowlingHighlights();
        calculatePerformanceIndex();

        createBattingChart();
        createBowlingChart();
        createScatterChart();

        generateInsights();
        renderPerformanceRanking();
        renderSpotlightPlayer();
    })
    .catch(err => console.error("Data load error:", err));

    fetch(`data/${club.id}/${club.season}/1xi_match_trends.csv`)
    .then(r => r.text())
    .then(text => {
        const matchData = parseCSV(text);
        createSeasonTrendChart(matchData);
    })
    .catch(err => console.error("Trend load error:", err));
}

/* =========================================
   TABLE RENDERING
========================================= */

function renderBattingTable() {

    const tbody = document.querySelector("#battingTable tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    battingData.forEach(p => {
        tbody.innerHTML += `
            <tr onclick="openPlayerProfile('${p.PLAYER}')">
                <td>${p.PLAYER}</td>
                <td>${p.RUNS}</td>
                <td>${p.AVG}</td>
                <td>${p["STRIKE RATE"]}</td>
            </tr>
        `;
    });
}

function renderBowlingTable() {

    const tbody = document.querySelector("#bowlingTable tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    bowlingData.forEach(p => {
        tbody.innerHTML += `
            <tr onclick="openPlayerProfile('${p.PLAYER}')">
                <td>${p.PLAYER}</td>
                <td>${p.WICKETS}</td>
                <td>${p["ECONOMY RATE"]}</td>
                <td>${p.AVERAGE}</td>
            </tr>
        `;
    });
}

/* =========================================
   HIGHLIGHTS
========================================= */

function calculateBattingHighlights() {
    if (!battingData.length) return;

    const top = battingData.reduce((a,b) =>
        parseInt(a.RUNS) > parseInt(b.RUNS) ? a : b
    );

    document.getElementById("topRuns").textContent = top.RUNS;
}

function calculateBowlingHighlights() {
    if (!bowlingData.length) return;

    const top = bowlingData.reduce((a,b) =>
        parseInt(a.WICKETS) > parseInt(b.WICKETS) ? a : b
    );

    document.getElementById("topWickets").textContent = top.WICKETS;
}

/* =========================================
   PERFORMANCE INDEX
========================================= */

function calculatePerformanceIndex() {

    if (!battingData.length || !bowlingData.length) return;

    const performance = buildPerformanceTable();

    document.getElementById("performanceLeader").textContent =
        performance[0]?.score || 0;
}

function buildPerformanceTable() {

    let performance = battingData.map(b => {

        const bowl = bowlingData.find(p => p.PLAYER === b.PLAYER);

        let score =
            (parseInt(b.RUNS || 0) * 0.4) +
            (parseFloat(b.AVG || 0) * 10) +
            (parseFloat(b["STRIKE RATE"] || 0) * 0.2);

        if (bowl) {
            score += (parseInt(bowl.WICKETS || 0) * 25);
        }

        return { player: b.PLAYER, score: Math.round(score) };
    });

    return performance.sort((a,b) => b.score - a.score);
}

function getTeamRank(playerName) {

    const performance = buildPerformanceTable();

    const index = performance.findIndex(p => p.player === playerName);

    return index >= 0 ? index + 1 : "-";
}

/* =========================================
   ROLE DETECTION
========================================= */

function detectPlayerRole(name) {

    const bat = battingData.find(p => p.PLAYER === name);
    const bowl = bowlingData.find(p => p.PLAYER === name);

    if (bat) {
        const runs = parseInt(bat.RUNS || 0);
        const avg = parseFloat(bat.AVG || 0);
        const sr = parseFloat(bat["STRIKE RATE"] || 0);

        if (runs >= 400) return { label:"Top Order Engine", class:"role-engine" };
        if (avg >= 30 && sr < 80) return { label:"Anchor", class:"role-anchor" };
        if (sr > 95) return { label:"Power Hitter", class:"role-power" };
        if (sr > 85 && avg < 25) return { label:"Finisher", class:"role-finisher" };
    }

    if (bowl) {
        const eco = parseFloat(bowl["ECONOMY RATE"] || 0);
        const strike = parseFloat(bowl["STRIKE RATE"] || 0);
        const overs = parseFloat(bowl.OVERS || 0);

        if (strike < 25) return { label:"Strike Bowler", class:"role-strike" };
        if (eco < 4) return { label:"Economy Controller", class:"role-economy" };
        if (overs >= 100) return { label:"Workhorse", class:"role-workhorse" };
    }

    return { label:"Squad Player", class:"" };
}

/* =========================================
   RANKING TABLE
========================================= */

function renderPerformanceRanking() {

    const tbody = document.querySelector("#rankingTable tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    const performance = buildPerformanceTable();

    performance.forEach((p,index) => {

        let tier = "Contributor";
        let tierClass = "tier-support";

        if (p.score >= 800) {
            tier = "Elite";
            tierClass = "tier-elite";
        } else if (p.score >= 500) {
            tier = "Strong";
            tierClass = "tier-strong";
        }

        const role = detectPlayerRole(p.player);

        tbody.innerHTML += `
            <tr>
                <td>${index+1}</td>
                <td onclick="openPlayerProfile('${p.player}')" style="cursor:pointer;">
                ${p.player}
                </td>
                <td>${p.score}</td>
                <td><span class="role-badge ${role.class}">${role.label}</span></td>
                <td class="${tierClass}">${tier}</td>
            </tr>
        `;
    });
}

/* =========================================
   INSIGHTS
========================================= */

function generateInsights() {

    const list = document.getElementById("insightList");
    if (!list) return;

    list.innerHTML = "";

    const topBat = battingData.reduce((a,b) =>
        parseInt(a.RUNS) > parseInt(b.RUNS) ? a : b
    );

    const topBowl = bowlingData.reduce((a,b) =>
        parseInt(a.WICKETS) > parseInt(b.WICKETS) ? a : b
    );

    list.innerHTML += `<li>${topBat.PLAYER} leads with ${topBat.RUNS} runs.</li>`;
    list.innerHTML += `<li>${topBowl.PLAYER} leads with ${topBowl.WICKETS} wickets.</li>`;
}

/* =========================================
   CHARTS
========================================= */

function createBattingChart() {

    if (battingChartInstance) battingChartInstance.destroy();

    battingChartInstance = new Chart(
        document.getElementById("battingChart"),
        {
            type: "bar",
            data: {
                labels: battingData.map(p => p.PLAYER),
                datasets: [{
                    data: battingData.map(p => parseInt(p.RUNS)),
                    backgroundColor: "#F28C18"
                }]
            },
            options: { plugins:{ legend:{ display:false } } }
        }
    );
}

function createBowlingChart() {

    if (bowlingChartInstance) bowlingChartInstance.destroy();

    bowlingChartInstance = new Chart(
        document.getElementById("bowlingChart"),
        {
            type: "bar",
            data: {
                labels: bowlingData.map(p => p.PLAYER),
                datasets: [{
                    data: bowlingData.map(p => parseInt(p.WICKETS)),
                    backgroundColor: "#172643"
                }]
            },
            options: { plugins:{ legend:{ display:false } } }
        }
    );
}

function createScatterChart() {

    if (scatterChartInstance) scatterChartInstance.destroy();

    scatterChartInstance = new Chart(
        document.getElementById("scatterChart"),
        {
            type:"scatter",
            data:{
                datasets:[{
                    label:"Avg vs SR",
                    data: battingData.map(p => ({
                        x: parseFloat(p.AVG),
                        y: parseFloat(p["STRIKE RATE"])
                    })),
                    backgroundColor:"#1F4D2B"
                }]
            },
            options:{
                scales:{
                    x:{ title:{ display:true, text:"Average" }},
                    y:{ title:{ display:true, text:"Strike Rate" }}
                }
            }
        }
    );
}

/* =========================================
   SPOTLIGHT PLAYER
========================================= */

function renderSpotlightPlayer() {

    if (!battingData.length) return;

    let performance = battingData.map(b => {

        const bowl = bowlingData.find(p => p.PLAYER === b.PLAYER);

        let score =
            (parseInt(b.RUNS || 0) * 0.4) +
            (parseFloat(b.AVG || 0) * 10);

        if (bowl) {
            score += (parseInt(bowl.WICKETS || 0) * 25);
        }

        return { player: b.PLAYER, score: Math.round(score) };
    });

    performance.sort((a,b) => b.score - a.score);

    const top = performance[0];

    const bat = battingData.find(p => p.PLAYER === top.player);
    const bowl = bowlingData.find(p => p.PLAYER === top.player);

    const role = detectPlayerRole(top.player);

    const spotlightName = document.getElementById("spotlightName");
    spotlightName.innerHTML = `<span style="cursor:pointer;">${top.player}</span>`;
    spotlightName.onclick = () => openPlayerProfile(top.player);

    document.getElementById("spotlightRole").innerHTML =
        `<span class="role-badge ${role.class}">${role.label}</span>`;

    document.getElementById("spotlightRuns").textContent =
        `Runs: ${bat ? bat.RUNS : 0}`;

    document.getElementById("spotlightWickets").textContent =
        `Wickets: ${bowl ? bowl.WICKETS : 0}`;

    document.getElementById("spotlightScore").textContent =
        `Performance Index: ${top.score}`;
}

/* =========================================
   PLAYER PROFILE
========================================= */

let profileBatChart;
let profileBowlChart;

function openPlayerProfile(playerName) {

    showPage("playerProfile");

    const bat = battingData.find(p => p.PLAYER === playerName);
    const bowl = bowlingData.find(p => p.PLAYER === playerName);

    const rank = getTeamRank(playerName);

    document.getElementById("profileName").textContent = playerName;

    const role = detectPlayerRole(playerName);

    document.getElementById("profileRole").innerHTML =
        `<span class="role-badge ${role.class}">${role.label}</span>`;

    document.getElementById("profileRuns").textContent = bat ? bat.RUNS : 0;
    document.getElementById("profileAvg").textContent = bat ? bat.AVG : 0;
    document.getElementById("profileWickets").textContent = bowl ? bowl.WICKETS : 0;

    document.getElementById("profileScore").textContent =
        calculatePerformanceIndexForPlayer(playerName);

    document.getElementById("profileRank").textContent =
    `#${rank}`;

    createProfileCharts(playerName);
}

function calculatePerformanceIndexForPlayer(name) {

    const bat = battingData.find(p => p.PLAYER === name);
    const bowl = bowlingData.find(p => p.PLAYER === name);

    let score = 0;

    if (bat) {
        score += (parseInt(bat.RUNS || 0) * 0.4);
        score += (parseFloat(bat.AVG || 0) * 10);
        score += (parseFloat(bat["STRIKE RATE"] || 0) * 0.2);
    }

    if (bowl) {
        score += (parseInt(bowl.WICKETS || 0) * 25);
    }

    return Math.round(score);
}

function createProfileCharts(name) {

    const bat = battingData.find(p => p.PLAYER === name);
    const bowl = bowlingData.find(p => p.PLAYER === name);

    if (profileBatChart) profileBatChart.destroy();
    if (profileBowlChart) profileBowlChart.destroy();

    profileBatChart = new Chart(
        document.getElementById("profileBatChart"),
        {
            type: "bar",
            data: {
                labels: ["Runs", "Average", "Strike Rate"],
                datasets: [{
                    data: [
                        bat ? parseInt(bat.RUNS) : 0,
                        bat ? parseFloat(bat.AVG) : 0,
                        bat ? parseFloat(bat["STRIKE RATE"]) : 0
                    ],
                    backgroundColor: "#F28C18"
                }]
            },
            options: { plugins: { legend: { display: false } } }
        }
    );

    profileBowlChart = new Chart(
        document.getElementById("profileBowlChart"),
        {
            type: "bar",
            data: {
                labels: ["Wickets", "Economy"],
                datasets: [{
                    data: [
                        bowl ? parseInt(bowl.WICKETS) : 0,
                        bowl ? parseFloat(bowl["ECONOMY RATE"]) : 0
                    ],
                    backgroundColor: "#1F4D2B"
                }]
            },
            options: { plugins: { legend: { display: false } } }
        }
    );
}

function createSeasonTrendChart(matchData) {

    if (seasonTrendChartInstance) {
        seasonTrendChartInstance.destroy();
    }

    const labels = matchData.map(m => `${m.DATE} - ${m.OPPOSITION}`);

    const runsFor = matchData.map(m => parseInt(m.RUNS_FOR));
    const runsAgainst = matchData.map(m => parseInt(m.RUNS_AGAINST));

    seasonTrendChartInstance = new Chart(
        document.getElementById("seasonTrendChart"),
        {
            type: "line",
            data: {
                labels: labels,
                datasets: [
                    {
                        label: "Runs For",
                        data: runsFor,
                        borderColor: "#F28C18",
                        backgroundColor: "rgba(242,140,24,0.1)",
                        tension: 0.3
                    },
                    {
                        label: "Runs Against",
                        data: runsAgainst,
                        borderColor: "#4caf50",
                        backgroundColor: "rgba(76,175,80,0.1)",
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: { color: "#e6edf3" }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: "#9fb3c8" }
                    },
                    y: {
                        ticks: { color: "#9fb3c8" }
                    }
                }
            }
        }
    );
}