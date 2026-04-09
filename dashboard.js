const CONFIG = window.VIBE_SURVEY_CONFIG;

const LAMPS = { proxy: 'lamp-proxy', feed: 'lamp-feed', display: 'lamp-display' };

const ARIA = {
    proxy: { off: 'Proxy: waiting', pending: 'Proxy: checking', ok: 'Proxy: OK', bad: 'Proxy: failed' },
    feed: { off: 'Feed: waiting', pending: 'Feed: checking', ok: 'Feed: OK', bad: 'Feed: failed' },
    display: { off: 'Dashboard: waiting', pending: 'Dashboard: checking', ok: 'Dashboard: OK', bad: 'Dashboard: failed' },
};

/** @param {{ proxy?: string, feed?: string, display?: string, message?: string }} patch — lamp keys: off | pending | ok | bad */
function setHealth(patch) {
    const panel = document.getElementById('system-signal');
    const line = document.getElementById('signal-message');

    ['proxy', 'feed', 'display'].forEach((key) => {
        if (patch[key] === undefined) return;
        const el = document.getElementById(LAMPS[key]);
        if (!el) return;
        const state = patch[key];
        el.setAttribute('data-state', state);
        const labels = ARIA[key];
        el.setAttribute('aria-label', labels[state] || state);
    });

    if (line && patch.message !== undefined) line.textContent = patch.message;

    if (panel) {
        const states = ['proxy', 'feed', 'display'].map((k) =>
            document.getElementById(LAMPS[k])?.getAttribute('data-state') || 'off'
        );
        if (states.includes('bad')) panel.setAttribute('data-summary', 'fault');
        else if (states.every((s) => s === 'ok')) panel.setAttribute('data-summary', 'all-green');
        else panel.setAttribute('data-summary', 'progress');
    }
}

function isNetworkUnreachable(err) {
    if (!err || typeof err !== 'object') return false;
    if (err.name === 'TypeError' && /fetch|Load failed|NetworkError|Failed to fetch/i.test(String(err.message))) return true;
    return false;
}

async function fetchVibes() {
    const url = `${CONFIG.PROXY_URL.replace('/submit-survey', '/responses')}?surveyId=${CONFIG.SURVEY_ID}&datacenter=${CONFIG.DATA_CENTER}`;

    setHealth({
        proxy: 'pending',
        feed: 'off',
        display: 'off',
        message: 'Step 1 — contacting proxy…',
    });

    let response;
    try {
        response = await fetch(url);
    } catch (err) {
        console.error('Vibe Fetch Failed:', err);
        setHealth({
            proxy: 'bad',
            feed: 'off',
            display: 'off',
            message: isNetworkUnreachable(err)
                ? 'Step 1 failed — no response from proxy (network, DNS, SSL, or CORS).'
                : `Step 1 failed — ${err.message || err}`,
        });
        document.getElementById('vibe-count').innerText = 'OFFLINE';
        return;
    }

    setHealth({
        proxy: 'ok',
        feed: 'pending',
        display: 'off',
        message: 'Step 1 OK — Step 2 — reading feed…',
    });

    if (!response.ok) {
        const hint = response.statusText || `HTTP ${response.status}`;
        setHealth({
            feed: 'bad',
            message: `Step 2 failed — HTTP ${hint}. Check survey id or proxy.`,
        });
        document.getElementById('vibe-count').innerText = '—';
        return;
    }

    let vibes;
    try {
        vibes = await response.json();
    } catch {
        setHealth({
            feed: 'bad',
            message: 'Step 2 failed — response body is not valid JSON.',
        });
        document.getElementById('vibe-count').innerText = '—';
        return;
    }

    if (!Array.isArray(vibes)) {
        setHealth({
            feed: 'bad',
            message: 'Step 2 failed — expected a JSON array of responses.',
        });
        document.getElementById('vibe-count').innerText = '—';
        return;
    }

    setHealth({
        feed: 'ok',
        display: 'pending',
        message: 'Steps 1–2 OK — Step 3 — rendering chart and table…',
    });

    try {
        renderDashboard(vibes);
    } catch (err) {
        console.error('Render failed:', err);
        setHealth({
            display: 'bad',
            message: `Step 3 failed — ${err.message || 'chart or table could not build.'}`,
        });
        document.getElementById('vibe-count').innerText = '—';
        return;
    }

    const n = vibes.length;
    setHealth({
        display: 'ok',
        message:
            n === 0
                ? 'All steps OK — 0 responses in feed.'
                : `All steps OK — ${n} response${n === 1 ? '' : 's'} on dashboard.`,
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
