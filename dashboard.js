async function fetchVibes() {
    const url = `${CONFIG.PROXY_URL.replace('/submit-survey', '/responses')}?surveyId=${CONFIG.SURVEY_ID}&datacenter=${CONFIG.DATA_CENTER}`;
    
    try {
        const response = await fetch(url);
        const vibes = await response.json(); // This is the array of responses
        renderDashboard(vibes);
    } catch (err) {
        console.error("Vibe Fetch Failed:", err);
        document.getElementById('vibe-count').innerText = "OFFLINE";
    }
}

function renderDashboard(data) {
    // 1. Stats Counter
    document.getElementById('vibe-count').innerText = data.length;

    // 2. Map the data for Charts
    // We reach into values[QID1] for the NPS and values[QID3_TEXT] for the comment
    const npsValues = data.map(v => parseInt(v.values.QID1 || 0));
    const labels = data.map((_, i) => `Vibe #${i + 1}`);

    // 3. The "Pulse" Line Chart
    const options = {
        chart: { type: 'area', height: 300, sparkline: { enabled: false }, toolbar: { show: false } },
        series: [{ name: 'NPS Score', data: npsValues }],
        stroke: { curve: 'smooth', width: 3 },
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.7, opacityTo: 0.3 } },
        colors: ['#22d3ee'],
        xaxis: { categories: labels, labels: { show: false } },
        theme: { mode: 'dark' }
    };
    
    document.querySelector("#nps-chart").innerHTML = ''; // Clear loading
    new ApexCharts(document.querySelector("#nps-chart"), options).render();

    // 4. The Drill-Down Table
    const tableData = data.map(v => ({
        nps: v.values.QID1,
        comment: v.values.QID3_TEXT,
        host: v.values.OriginHost || 'Local',
        date: new Date(v.values.recordedDate).toLocaleDateString()
    }));

    new Tabulator("#vibe-table", {
        data: tableData,
        layout: "fitColumns",
        pagination: "local",
        paginationSize: 5,
        columns: [
            {title: "NPS", field: "nps", width: 80, hozAlign: "center", color: "#22d3ee"},
            {title: "Vibe Comment", field: "comment", widthGrow: 3},
            {title: "Origin", field: "host", width: 120},
        ],
    });
}

// Initial pull
fetchVibes();