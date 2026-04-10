const CONFIG = window.VIBE_SURVEY_CONFIG;

const CHOICE_COLOR_PALETTE = [
    '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#6366f1', '#a855f7', '#ec4899', '#64748b',
];

const COLOR_NAME_HEX = {
    red: '#ef4444',
    crimson: '#dc2626',
    maroon: '#b91c1c',
    orange: '#f97316',
    amber: '#f59e0b',
    yellow: '#eab308',
    gold: '#ca8a04',
    lime: '#84cc16',
    green: '#22c55e',
    emerald: '#10b981',
    teal: '#14b8a6',
    cyan: '#06b6d4',
    sky: '#0ea5e9',
    blue: '#3b82f6',
    indigo: '#6366f1',
    violet: '#8b5cf6',
    purple: '#a855f7',
    fuchsia: '#d946ef',
    pink: '#ec4899',
    rose: '#f43f5e',
    brown: '#92400e',
    black: '#1e293b',
    white: '#f1f5f9',
    gray: '#64748b',
    grey: '#64748b',
};

function hexToRgba(color, alpha) {
    if (!color || typeof color !== 'string') return 'transparent';
    const c = color.trim();
    if (c.startsWith('rgba')) return c;
    if (c.startsWith('rgb(')) return c.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
    let h = c.replace('#', '');
    if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
    if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return 'transparent';
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function normalizeSurveyColor(raw) {
    if (raw == null || raw === '') return null;
    const s = String(raw).trim();
    if (/^https?:\/\//i.test(s) || s.length > 120) return null;
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) {
        if (s.length === 4) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
        return s.toLowerCase();
    }
    if (/^rgba?\(/i.test(s)) return s;
    const lower = s.toLowerCase();
    for (const [word, hex] of Object.entries(COLOR_NAME_HEX)) {
        const re = new RegExp(`\\b${word}\\b`, 'i');
        if (re.test(lower)) return hex;
    }
    const n = parseInt(s, 10);
    if (!Number.isNaN(n) && /^\d+$/.test(s.trim())) {
        return CHOICE_COLOR_PALETTE[Math.abs(n) % CHOICE_COLOR_PALETTE.length];
    }
    return null;
}

function parseVibeAccent(values) {
    const base = CONFIG.COLOR_QID || 'QID2';
    const keys = [base, `${base}_TEXT`, `${base}_DO`];
    for (const k of keys) {
        const c = normalizeSurveyColor(values[k]);
        if (c) return c;
    }
    return null;
}

function npsGroupLabel(score) {
    const n = parseInt(score, 10);
    if (Number.isNaN(n)) return '—';
    if (n >= 9) return 'Promoter';
    if (n >= 7) return 'Passive';
    return 'Detractor';
}

function npsPillClass(group) {
    if (group === 'Promoter') return 'nps-pill prom';
    if (group === 'Passive') return 'nps-pill pas';
    if (group === 'Detractor') return 'nps-pill det';
    return 'nps-pill na';
}

function emojiFromComment(text) {
    const t = (text || '').toLowerCase();
    if (!t.trim()) return '💭';
    if (/\b(love|loved|awesome|amazing|excellent|perfect|fantastic|brilliant)\b/.test(t)) return '🔥';
    if (/\b(thanks|thank you|thx|appreciate|grateful)\b/.test(t)) return '🙏';
    if (/\b(hate|terrible|awful|worst|horrible|useless|angry|furious)\b/.test(t)) return '😤';
    if (/\b(bug|bugs|broken|crash|error|doesn'?t work|not working)\b/.test(t)) return '🐛';
    if (/\b(slow|lag|latency|timeout)\b/.test(t)) return '🐢';
    if (/\b(beautiful|clean|sleek|smooth|polish)\b/.test(t)) return '✨';
    if (/\?|\b(why|how|what)\b/.test(t)) return '🤔';
    if (/\b(please|hope|wish|would love)\b/.test(t)) return '🌱';
    if (/\b(team|y'?all|you guys|everyone)\b/.test(t)) return '👋';
    if (/\b(wow|omg|incredible)\b/.test(t)) return '😮';
    if (/\b(sad|disappoint|unfortunate|unfortunately)\b/.test(t)) return '💙';
    return '💬';
}

function responseTimestampMs(values) {
    const d = values.recordedDate || values.EndDateStart || values.startDate;
    const t = d != null ? new Date(d).getTime() : 0;
    return Number.isNaN(t) ? 0 : t;
}

const ORIGIN_PIE_COLORS = [
    '#22d3ee', '#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#fb923c', '#60a5fa', '#c084fc', '#2dd4bf', '#f87171',
];

function aggregateOriginHosts(rows) {
    const map = {};
    for (const row of rows) {
        const vals = row.values || {};
        let h =
            vals.OriginHost != null && String(vals.OriginHost).trim() !== ''
                ? String(vals.OriginHost).trim()
                : 'Local';
        if (h.length > 52) h = `${h.slice(0, 49)}…`;
        map[h] = (map[h] || 0) + 1;
    }
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return {
        labels: entries.map(([k]) => k),
        series: entries.map(([, v]) => v),
    };
}

function aggregateNpsGroupsBar(rows) {
    let promoter = 0;
    let passive = 0;
    let detractor = 0;
    let unknown = 0;
    for (const row of rows) {
        const g = npsGroupLabel(row.values?.QID1);
        if (g === 'Promoter') promoter += 1;
        else if (g === 'Passive') passive += 1;
        else if (g === 'Detractor') detractor += 1;
        else unknown += 1;
    }
    const categories = ['Promoter', 'Passive', 'Detractor'];
    const counts = [promoter, passive, detractor];
    const colors = ['#22c55e', '#eab308', '#ef4444'];
    if (unknown > 0) {
        categories.push('No score');
        counts.push(unknown);
        colors.push('#64748b');
    }
    return { categories, counts, colors };
}

function disposeAuxCharts() {
    try {
        if (window.__originPieChart && typeof window.__originPieChart.destroy === 'function') {
            window.__originPieChart.destroy();
        }
    } catch (_) { /* noop */ }
    try {
        if (window.__npsGroupBarChart && typeof window.__npsGroupBarChart.destroy === 'function') {
            window.__npsGroupBarChart.destroy();
        }
    } catch (_) { /* noop */ }
    window.__originPieChart = null;
    window.__npsGroupBarChart = null;
}

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
    disposeAuxCharts();

    const chronological = [...data].sort(
        (a, b) => responseTimestampMs(a.values) - responseTimestampMs(b.values)
    );

    const npsValues = chronological.map((v) => parseInt(v.values.QID1 || 0, 10));
    const labels = chronological.map((_, i) => `Vibe #${i + 1}`);

    const options = {
        chart: { type: 'area', height: 340, sparkline: { enabled: false }, toolbar: { show: false } },
        series: [{ name: 'NPS Score', data: npsValues }],
        stroke: { curve: 'smooth', width: 3 },
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.7, opacityTo: 0.3 } },
        colors: ['#22d3ee'],
        xaxis: { categories: labels, labels: { show: false } },
        theme: { mode: 'dark' },
    };

    document.querySelector('#nps-chart').innerHTML = '';
    new ApexCharts(document.querySelector('#nps-chart'), options).render();

    const originEl = document.getElementById('origin-pie-chart');
    const npsBarEl = document.getElementById('nps-group-bar-chart');
    if (originEl && npsBarEl) {
        if (data.length === 0) {
            originEl.innerHTML = '<p class="chart-empty">No responses yet.</p>';
            npsBarEl.innerHTML = '<p class="chart-empty">No responses yet.</p>';
        } else {
            originEl.innerHTML = '';
            const { labels: hostLabels, series: hostSeries } = aggregateOriginHosts(data);
            const pieOptions = {
                chart: { type: 'pie', height: 300, toolbar: { show: false } },
                labels: hostLabels,
                series: hostSeries,
                colors: ORIGIN_PIE_COLORS,
                legend: {
                    position: 'bottom',
                    fontSize: '11px',
                    itemMargin: { horizontal: 6, vertical: 4 },
                    labels: { colors: '#cbd5e1' },
                    markers: { strokeWidth: 0 },
                },
                dataLabels: {
                    enabled: hostLabels.length <= 10,
                    style: { fontSize: '11px', fontWeight: 600, colors: ['#0f172a'] },
                    dropShadow: { enabled: false },
                },
                stroke: { width: 2, colors: ['#0f172a'] },
                theme: { mode: 'dark' },
            };
            window.__originPieChart = new ApexCharts(originEl, pieOptions);
            window.__originPieChart.render();

            npsBarEl.innerHTML = '';
            const { categories, counts, colors } = aggregateNpsGroupsBar(data);
            const barOptions = {
                chart: { type: 'bar', height: 280, toolbar: { show: false } },
                series: [{ name: 'Responses', data: counts }],
                xaxis: {
                    categories,
                    labels: { style: { colors: '#94a3b8', fontSize: '12px' } },
                },
                yaxis: {
                    labels: { style: { colors: '#94a3b8' } },
                    min: 0,
                    forceNiceScale: true,
                },
                plotOptions: {
                    bar: {
                        borderRadius: 6,
                        columnWidth: '58%',
                        distributed: true,
                        dataLabels: { position: 'top' },
                    },
                },
                dataLabels: {
                    enabled: true,
                    offsetY: -18,
                    style: { fontSize: '12px', fontWeight: 600, colors: ['#f1f5f9'] },
                },
                colors,
                grid: { borderColor: 'rgba(51,65,85,0.45)', strokeDashArray: 4 },
                theme: { mode: 'dark' },
            };
            window.__npsGroupBarChart = new ApexCharts(npsBarEl, barOptions);
            window.__npsGroupBarChart.render();
        }
    }

    const newestFirst = [...data].sort(
        (a, b) => responseTimestampMs(b.values) - responseTimestampMs(a.values)
    );

    const tableData = newestFirst.map((v) => {
        const vals = v.values || {};
        const comment = vals.QID3_TEXT != null ? String(vals.QID3_TEXT) : '';
        const group = npsGroupLabel(vals.QID1);
        const accent = parseVibeAccent(vals);
        const ts = responseTimestampMs(vals);
        const when = vals.recordedDate ? new Date(vals.recordedDate) : null;
        const whenStr = when && !Number.isNaN(when.getTime()) ? when.toLocaleString() : '—';

        return {
            _ts: ts,
            emoji: emojiFromComment(comment),
            nps: vals.QID1,
            npsGroup: group,
            comment,
            whenStr,
            vibeAccent: accent,
        };
    });

    if (window.__vibeTable && typeof window.__vibeTable.destroy === 'function') {
        window.__vibeTable.destroy();
    }

    window.__vibeTable = new Tabulator('#vibe-table', {
        data: tableData,
        layout: 'fitColumns',
        pagination: 'local',
        paginationSize: 8,
        paginationSizeSelector: [5, 8, 15, 25],
        movableColumns: false,
        selectable: false,
        initialSort: [{ column: '_ts', dir: 'desc' }],
        rowFormatter(row) {
            const el = row.getElement();
            const accent = row.getData().vibeAccent;
            if (accent) {
                el.style.borderLeftWidth = '4px';
                el.style.borderLeftStyle = 'solid';
                el.style.borderLeftColor = accent;
                el.style.boxShadow = `inset 16px 0 32px -12px ${hexToRgba(accent, 0.2)}`;
            } else {
                el.style.borderLeft = '';
                el.style.boxShadow = '';
            }
        },
        rowClick(_e, row) {
            row.getElement().classList.toggle('vibe-row-expanded');
        },
        columns: [
            {
                title: '',
                field: 'emoji',
                width: 52,
                hozAlign: 'center',
                headerSort: false,
                cssClass: 'vibe-emoji-cell',
            },
            {
                title: 'NPS',
                field: 'nps',
                width: 64,
                hozAlign: 'center',
                sorter: 'number',
                formatter(cell) {
                    const span = document.createElement('span');
                    span.className = 'vibe-nps-num';
                    span.style.color = '#22d3ee';
                    span.textContent = cell.getValue() != null && cell.getValue() !== '' ? String(cell.getValue()) : '—';
                    return span;
                },
            },
            {
                title: 'NPS group',
                field: 'npsGroup',
                width: 130,
                formatter(cell) {
                    const span = document.createElement('span');
                    span.className = npsPillClass(cell.getValue());
                    span.textContent = cell.getValue();
                    return span;
                },
            },
            {
                title: 'Comment',
                field: 'comment',
                minWidth: 200,
                widthGrow: 3,
                cssClass: 'col-comment',
                formatter(cell) {
                    const div = document.createElement('div');
                    div.textContent = cell.getValue() || '';
                    return div;
                },
            },
            {
                title: 'When',
                field: 'whenStr',
                width: 150,
                sorter(a, b, aRow, bRow) {
                    return (aRow.getData()._ts || 0) - (bRow.getData()._ts || 0);
                },
            },
            { title: '', field: '_ts', visible: false, sorter: 'number' },
        ],
    });
}

fetchVibes();
