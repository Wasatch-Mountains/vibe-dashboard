const CONFIG = window.VIBE_SURVEY_CONFIG;

function setSignalStatus(status, message) {
    const panel = document.getElementById('system-signal');
    const line = document.getElementById('signal-message');
    if (panel) panel.setAttribute('data-status', status);
    if (line) line.textContent = message;
}

async function fetchVibes() {
    const url = `${CONFIG.PROXY_URL.replace('/submit-survey', '/responses')}?surveyId=${CONFIG.SURVEY_ID}&datacenter=${CONFIG.DATA_CENTER}`;

    setSignalStatus('waiting', 'Polling proxy — awaiting payload…');

    try {
        const response = await fetch(url);

        if (!response.ok) {
            const hint = response.statusText || `HTTP ${response.status}`;
            setSignalStatus('error', `Feed error: ${hint}. Check proxy and survey id.`);
            document.getElementById('vibe-count').innerText = '—';
            return;
        }

        let vibes;
        try {
            vibes = await response.json();
        } catch {
            setSignalStatus('error', 'Invalid response: server did not return JSON.');
            document.getElementById('vibe-count').innerText = '—';
            return;
        }

        if (!Array.isArray(vibes)) {
            setSignalStatus('error', 'Unexpected shape: expected a list of responses.');
            document.getElementById('vibe-count').innerText = '—';
            return;
        }

        try {
            renderDashboard(vibes);
        } catch (err) {
            console.error('Render failed:', err);
            setSignalStatus('error', `Display error: ${err.message || 'chart or table failed to build.'}`);
            document.getElementById('vibe-count').innerText = '—';
            return;
        }

        const n = vibes.length;
        setSignalStatus(
            'success',
            n === 0
                ? 'Link OK — zero responses so far.'
                : `Link OK — loaded ${n} response${n === 1 ? '' : 's'}.`
        );
    } catch (err) {
        console.error('Vibe Fetch Failed:', err);
        setSignalStatus(
            'error',
            err.name === 'TypeError' && String(err.message).includes('fetch')
                ? 'Network error — unreachable proxy or blocked request.'
                : `Fetch failed: ${err.message || err}`
        );
        document.getElementById('vibe-count').innerText = 'OFFLINE';
    }
}

function renderDashboard(data) {
    // 1. Stats Counter
    document.getElementById('vibe-count').innerText = data.length;

    // 2. Map the data for Charts
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

    document.querySelector('#nps-chart').innerHTML = '';
    new ApexCharts(document.querySelector('#nps-chart'), options).render();

    // 4. The Drill-Down Table
    const tableData = data.map(v => ({
        nps: v.values.QID1,
        comment: v.values.QID3_TEXT,
        host: v.values.OriginHost || 'Local',
        date: new Date(v.values.recordedDate).toLocaleDateString()
    }));

    new Tabulator('#vibe-table', {
        data: tableData,
        layout: 'fitColumns',
        pagination: 'local',
        paginationSize: 5,
        columns: [
            { title: 'NPS', field: 'nps', width: 80, hozAlign: 'center', color: '#22d3ee' },
            { title: 'Vibe Comment', field: 'comment', widthGrow: 3 },
            { title: 'Origin', field: 'host', width: 120 },
        ],
    });
}

fetchVibes();
