const CONFIG = window.VIBE_SURVEY_CONFIG;

/** @param {{ proxy?: 'pending'|'up'|'down', phase?: 'idle'|'loading'|'success'|'fault', message?: string }} patch */
function setSignal(patch) {
    const panel = document.getElementById('system-signal');
    const line = document.getElementById('signal-message');
    if (panel) {
        if (patch.proxy !== undefined) panel.setAttribute('data-proxy', patch.proxy);
        if (patch.phase !== undefined) panel.setAttribute('data-phase', patch.phase);
    }
    if (line && patch.message !== undefined) line.textContent = patch.message;
}

function isNetworkUnreachable(err) {
    if (!err || typeof err !== 'object') return false;
    if (err.name === 'TypeError' && /fetch|Load failed|NetworkError|Failed to fetch/i.test(String(err.message))) return true;
    return false;
}

async function fetchVibes() {
    const url = `${CONFIG.PROXY_URL.replace('/submit-survey', '/responses')}?surveyId=${CONFIG.SURVEY_ID}&datacenter=${CONFIG.DATA_CENTER}`;

    setSignal({
        proxy: 'pending',
        phase: 'idle',
        message: 'Contacting proxy — checking reachability…',
    });

    let response;
    try {
        response = await fetch(url);
    } catch (err) {
        console.error('Vibe Fetch Failed:', err);
        setSignal({
            proxy: 'down',
            phase: 'fault',
            message: isNetworkUnreachable(err)
                ? 'Proxy unreachable — no response (network, DNS, SSL, or CORS).'
                : `Proxy unreachable: ${err.message || err}`,
        });
        document.getElementById('vibe-count').innerText = 'OFFLINE';
        return;
    }

    // Any resolved Response means the browser reached the proxy host.
    setSignal({
        proxy: 'up',
        phase: 'loading',
        message: 'Proxy online — reading feed…',
    });

    if (!response.ok) {
        const hint = response.statusText || `HTTP ${response.status}`;
        setSignal({
            phase: 'fault',
            message: `Proxy answered but feed failed: ${hint}. Check survey id or proxy logs.`,
        });
        document.getElementById('vibe-count').innerText = '—';
        return;
    }

    let vibes;
    try {
        vibes = await response.json();
    } catch {
        setSignal({
            phase: 'fault',
            message: 'Proxy online — body was not valid JSON.',
        });
        document.getElementById('vibe-count').innerText = '—';
        return;
    }

    if (!Array.isArray(vibes)) {
        setSignal({
            phase: 'fault',
            message: 'Proxy online — expected a JSON array of responses.',
        });
        document.getElementById('vibe-count').innerText = '—';
        return;
    }

    try {
        renderDashboard(vibes);
    } catch (err) {
        console.error('Render failed:', err);
        setSignal({
            phase: 'fault',
            message: `Proxy online — display error: ${err.message || 'chart or table failed.'}`,
        });
        document.getElementById('vibe-count').innerText = '—';
        return;
    }

    const n = vibes.length;
    setSignal({
        phase: 'success',
        message:
            n === 0
                ? 'Proxy OK — feed OK — zero responses so far.'
                : `Proxy OK — feed OK — ${n} response${n === 1 ? '' : 's'} loaded.`,
    });
}

function renderDashboard(data) {
    document.getElementById('vibe-count').innerText = data.length;

    const npsValues = data.map(v => parseInt(v.values.QID1 || 0));
    const labels = data.map((_, i) => `Vibe #${i + 1}`);

    const options = {
        chart: { type: 'area', height: 300, sparkline: { enabled: false }, toolbar: { show: false } },
        series: [{ name: 'NPS Score', data: npsValues }],
        stroke: { curve: 'smooth', width: 3 },
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.7, opacityTo: 0.3 } },
        colors: ['#22d3ee'],
        xaxis: { categories: labels, labels: { show: false } },
        theme: { mode: 'dark' },
    };

    document.querySelector('#nps-chart').innerHTML = '';
    new ApexCharts(document.querySelector('#nps-chart'), options).render();

    const tableData = data.map(v => ({
        nps: v.values.QID1,
        comment: v.values.QID3_TEXT,
        host: v.values.OriginHost || 'Local',
        date: new Date(v.values.recordedDate).toLocaleDateString(),
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
