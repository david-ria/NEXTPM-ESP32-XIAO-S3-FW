/**
 * NextPM Monitor Application
 * v1.0.0-prod
 *
 * Main application logic for Pro and Light interfaces
 */

// Global state
const app = {
    kernel: null,
    currentTab: 'light',
    autoRefreshInterval: null,
    charts: {
        pmTimeline: null,
        bins: null,
        proDetail: null
    },
    data: {
        pmHistory: {
            timestamps: [],
            pm1: [],
            pm25: [],
            pm10: []
        },
        maxHistoryPoints: 50
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

/**
 * Initialize application
 */
function initializeApp() {
    console.log('Initializing NextPM Monitor v1.0.0-prod');

    // Check Web Serial API support
    if (!('serial' in navigator)) {
        showError('Web Serial API non supportée. Utilisez Chrome, Edge ou Opera.');
        return;
    }

    // Create kernel instance
    app.kernel = new NextPMKernel();

    // Setup event listeners
    setupKernelListeners();
    setupUIListeners();
    setupCharts();

    console.log('Application initialized');
}

/**
 * Setup kernel event listeners
 */
function setupKernelListeners() {
    // Connection events
    app.kernel.on('connect', () => {
        updateConnectionStatus(true);
        addLog('INFO', 'Connecté au capteur NextPM');
    });

    app.kernel.on('disconnect', () => {
        updateConnectionStatus(false);
        addLog('INFO', 'Déconnecté du capteur');
        stopAutoRefresh();
    });

    // Data events
    app.kernel.on('data', (event) => {
        handleIncomingData(event);
    });

    // Error events
    app.kernel.on('error', (event) => {
        addLog('ERROR', `Erreur: ${event.type}`, event.error);
    });

    // Log events
    app.kernel.on('log', (logEntry) => {
        addDebugLog(logEntry);
    });
}

/**
 * Setup UI event listeners
 */
function setupUIListeners() {
    // Connect button
    document.getElementById('connect-btn').addEventListener('click', toggleConnection);

    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Light mode controls
    document.getElementById('light-interval').addEventListener('change', (e) => {
        if (app.kernel.isConnected) {
            refreshLightData();
        }
    });

    document.getElementById('light-refresh').addEventListener('click', refreshLightData);

    // Pro mode: Quick commands
    document.querySelectorAll('.btn[data-cmd]').forEach(btn => {
        btn.addEventListener('click', () => sendQuickCommand(btn.dataset.cmd));
    });

    // Pro mode: Custom command
    document.getElementById('send-custom-btn').addEventListener('click', sendCustomCommand);
    document.getElementById('custom-command').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendCustomCommand();
        }
    });

    // Pro mode: Clear buttons
    document.getElementById('clear-logs-btn').addEventListener('click', clearDebugLogs);
    document.getElementById('clear-raw-btn').addEventListener('click', clearRawData);

    // Pro mode: Chart tabs
    document.querySelectorAll('.chart-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.chart-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateProChart(btn.dataset.chart);
        });
    });
}

/**
 * Setup Chart.js charts
 */
function setupCharts() {
    // PM Timeline Chart (Light mode)
    const pmTimelineCtx = document.getElementById('pm-timeline-chart');
    if (pmTimelineCtx) {
        app.charts.pmTimeline = new Chart(pmTimelineCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'PM1.0',
                        data: [],
                        borderColor: '#4CAF50',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'PM2.5',
                        data: [],
                        borderColor: '#FF9800',
                        backgroundColor: 'rgba(255, 152, 0, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'PM10',
                        data: [],
                        borderColor: '#F44336',
                        backgroundColor: 'rgba(244, 67, 54, 0.1)',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2.5,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    title: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'µg/m³'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Temps'
                        }
                    }
                }
            }
        });
    }

    // BINS Chart (Light mode)
    const binsCtx = document.getElementById('bins-chart');
    if (binsCtx) {
        app.charts.bins = new Chart(binsCtx, {
            type: 'bar',
            data: {
                labels: ['0.3-0.5 µm', '0.5-1.0 µm', '1.0-2.5 µm', '2.5-5.0 µm', '5.0-10 µm'],
                datasets: [{
                    label: 'Nombre de particules',
                    data: [0, 0, 0, 0, 0],
                    backgroundColor: [
                        'rgba(76, 175, 80, 0.8)',
                        'rgba(33, 150, 243, 0.8)',
                        'rgba(255, 193, 7, 0.8)',
                        'rgba(255, 152, 0, 0.8)',
                        'rgba(244, 67, 54, 0.8)'
                    ],
                    borderColor: [
                        '#4CAF50',
                        '#2196F3',
                        '#FFC107',
                        '#FF9800',
                        '#F44336'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2.5,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Nombre de particules'
                        }
                    }
                }
            }
        });
    }

    // Pro Detail Chart
    const proDetailCtx = document.getElementById('pro-detail-chart');
    if (proDetailCtx) {
        app.charts.proDetail = new Chart(proDetailCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                plugins: {
                    legend: {
                        display: true
                    }
                }
            }
        });
    }
}

/**
 * Toggle connection
 */
async function toggleConnection() {
    const btn = document.getElementById('connect-btn');

    if (!app.kernel.isConnected) {
        btn.disabled = true;
        btn.textContent = 'Connexion...';

        const success = await app.kernel.connect();

        if (success) {
            btn.innerHTML = '<span class="icon">🔌</span> Déconnecter';
            startAutoRefresh();
        } else {
            btn.innerHTML = '<span class="icon">🔌</span> Se connecter';
        }

        btn.disabled = false;
    } else {
        await app.kernel.disconnect();
        btn.innerHTML = '<span class="icon">🔌</span> Se connecter';
    }
}

/**
 * Update connection status indicator
 */
function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connection-status');

    if (connected) {
        statusEl.className = 'status-badge connected';
        statusEl.innerHTML = '<span class="status-icon">●</span><span class="status-text">Connecté</span>';
    } else {
        statusEl.className = 'status-badge disconnected';
        statusEl.innerHTML = '<span class="status-icon">●</span><span class="status-text">Déconnecté</span>';
    }
}

/**
 * Switch between tabs
 */
function switchTab(tabName) {
    app.currentTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `${tabName}-tab`);
    });

    // Refresh data if connected
    if (app.kernel.isConnected) {
        if (tabName === 'light') {
            refreshLightData();
        } else {
            refreshProData();
        }
    }
}

/**
 * Handle incoming data from kernel
 */
function handleIncomingData(event) {
    const { raw, parsed, timestamp } = event;

    // Update raw data display (Pro mode)
    addRawData(raw, parsed);

    // Process parsed data
    if (parsed) {
        updateUIWithData(parsed);
    }
}

/**
 * Update UI with parsed data
 */
function updateUIWithData(data) {
    // Update sensor info (Pro mode)
    if (data.fw_esp32) {
        document.getElementById('pro-fw-esp').textContent = data.fw_esp32;
    }

    if (data.nextpm && data.nextpm.fw) {
        const fw = data.nextpm.fw.u16_swap;
        document.getElementById('pro-fw-sensor').textContent = `${fw} (0x${fw.toString(16).toUpperCase()})`;

        const binsSupported = fw >= 1047;
        document.getElementById('pro-bins-support').textContent = binsSupported ? 'Oui' : 'Non';
        document.getElementById('pro-bins-support').style.color = binsSupported ? '#4CAF50' : '#F44336';
    }

    if (data.nextpm && typeof data.nextpm.state !== 'undefined') {
        const state = data.nextpm.state;
        document.getElementById('pro-sensor-state').textContent = state === 0 ? 'Ready (0)' : `State ${state}`;
    }

    if (data.ts_ms) {
        const uptime = formatUptime(data.ts_ms);
        document.getElementById('pro-uptime').textContent = uptime;
    }

    if (data.nextpm && typeof data.nextpm.chk_ok !== 'undefined') {
        const checksumEl = document.getElementById('pro-checksum');

        // Special handling for BINS checksum issue on FW 1047
        if (data.info === 'bins' && !data.nextpm.chk_ok) {
            checksumEl.textContent = 'FAIL (FW 1047 bug)';
            checksumEl.style.color = '#FF9800'; // Orange instead of red
            checksumEl.title = 'Bug cosmétique connu sur FW 1047 - données utilisables';
        } else {
            checksumEl.textContent = data.nextpm.chk_ok ? 'OK' : 'FAIL';
            checksumEl.style.color = data.nextpm.chk_ok ? '#4CAF50' : '#F44336';
            checksumEl.title = '';
        }
    }

    // Update environmental data (Light mode)
    if (data.trh) {
        updateTemperature(data.trh.t_c_swap);
        updateHumidity(data.trh.rh_pct_swap);
    }

    // Update PM data (Light mode)
    if (data.pm && data.pm.ug_m3) {
        updatePMValues(data.pm.ug_m3.pm1_swap, data.pm.ug_m3.pm25_swap, data.pm.ug_m3.pm10_swap);
        addPMToHistory(data.pm.ug_m3.pm1_swap, data.pm.ug_m3.pm25_swap, data.pm.ug_m3.pm10_swap);
    }

    // Update BINS data (Light mode)
    if (data.info === 'bins') {
        // PRIORITY: Parse from raw data (most reliable)
        if (data.raw) {
            const rawBytes = data.raw.split(' ').map(b => parseInt(b, 16));
            const bins = app.kernel.parseBinsData(rawBytes);
            if (bins) {
                updateBINSChart(bins);
            }
        }
        // FALLBACK: Try to extract from bins JSON
        else if (data.bins) {
            // Firmware returns bins with ch_* keys (with dots: "ch_0.3_0.5")
            const bins = {
                bin0: data.bins['ch_0.3_0.5'] || data.bins['ch_0_3_0_5'] || 0,
                bin1: data.bins['ch_0.5_1'] || data.bins['ch_0_5_1'] || 0,
                bin2: data.bins['ch_1_2.5'] || data.bins['ch_1_2_5'] || 0,
                bin3: data.bins['ch_2.5_5'] || data.bins['ch_2_5_5'] || 0,
                bin4: data.bins['ch_5_10'] || 0
            };

            // Apply 16-bit mask to handle 32-bit encoding issue
            Object.keys(bins).forEach(key => {
                if (bins[key] > 65535) {
                    bins[key] = bins[key] & 0xFFFF;
                }
            });

            updateBINSChart(bins);
        }
    }
}

/**
 * Update temperature display
 */
function updateTemperature(temp) {
    document.getElementById('temp-value').textContent = temp.toFixed(1);
}

/**
 * Update humidity display
 */
function updateHumidity(humidity) {
    document.getElementById('humidity-value').textContent = humidity.toFixed(1);
}

/**
 * Update PM values and bars
 */
function updatePMValues(pm1, pm25, pm10) {
    // Update values
    document.getElementById('pm1-value').textContent = pm1.toFixed(1);
    document.getElementById('pm25-value').textContent = pm25.toFixed(1);
    document.getElementById('pm10-value').textContent = pm10.toFixed(1);

    // Update bars (scale to 100 max)
    const maxPM = 100;
    document.getElementById('pm1-bar').style.width = `${Math.min((pm1 / maxPM) * 100, 100)}%`;
    document.getElementById('pm25-bar').style.width = `${Math.min((pm25 / maxPM) * 100, 100)}%`;
    document.getElementById('pm10-bar').style.width = `${Math.min((pm10 / maxPM) * 100, 100)}%`;

    // Update AQI indicator
    const aqi = NextPMKernel.calculateAQI(pm25);
    const indicator = document.getElementById('aqi-indicator');
    indicator.style.background = `conic-gradient(${aqi.color} ${aqi.value}%, #ddd 0)`;
    indicator.querySelector('.aqi-value').textContent = aqi.value;

    document.getElementById('aqi-status').textContent = aqi.label;
    document.getElementById('aqi-status').style.color = aqi.color;

    // Update message based on level
    const messages = {
        'good': 'La qualité de l\'air est excellente.',
        'moderate': 'La qualité de l\'air est acceptable.',
        'unhealthy-sensitive': 'Les groupes sensibles peuvent être affectés.',
        'unhealthy': 'Tout le monde peut être affecté. Limitez les activités extérieures.',
        'very-unhealthy': 'Avertissement sanitaire. Évitez les activités extérieures.',
        'hazardous': 'Alerte sanitaire. Restez à l\'intérieur.'
    };
    document.getElementById('aqi-message').textContent = messages[aqi.level] || '';
}

/**
 * Add PM data to history
 */
function addPMToHistory(pm1, pm25, pm10) {
    const now = new Date();
    const timeLabel = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    app.data.pmHistory.timestamps.push(timeLabel);
    app.data.pmHistory.pm1.push(pm1);
    app.data.pmHistory.pm25.push(pm25);
    app.data.pmHistory.pm10.push(pm10);

    // Limit history
    if (app.data.pmHistory.timestamps.length > app.data.maxHistoryPoints) {
        app.data.pmHistory.timestamps.shift();
        app.data.pmHistory.pm1.shift();
        app.data.pmHistory.pm25.shift();
        app.data.pmHistory.pm10.shift();
    }

    // Update chart
    updatePMTimelineChart();
}

/**
 * Update PM timeline chart
 */
function updatePMTimelineChart() {
    if (!app.charts.pmTimeline) return;

    app.charts.pmTimeline.data.labels = app.data.pmHistory.timestamps;
    app.charts.pmTimeline.data.datasets[0].data = app.data.pmHistory.pm1;
    app.charts.pmTimeline.data.datasets[1].data = app.data.pmHistory.pm25;
    app.charts.pmTimeline.data.datasets[2].data = app.data.pmHistory.pm10;

    app.charts.pmTimeline.update('none'); // Update without animation
}

/**
 * Update BINS chart
 */
function updateBINSChart(bins) {
    if (!app.charts.bins) return;

    app.charts.bins.data.datasets[0].data = [
        bins.bin0,
        bins.bin1,
        bins.bin2,
        bins.bin3,
        bins.bin4
    ];

    app.charts.bins.update();

    // Hide info message
    document.getElementById('bins-info').style.display = 'none';
}

/**
 * Refresh light mode data
 */
async function refreshLightData() {
    if (!app.kernel.isConnected) return;

    try {
        const interval = document.getElementById('light-interval').value;

        // Get TRH
        const trh = await app.kernel.getTRH();
        if (trh) {
            updateTemperature(trh.temperature);
            updateHumidity(trh.humidity);
        }

        // Get PM
        const pm = await app.kernel.getPM(interval);
        if (pm) {
            updatePMValues(pm.pm1, pm.pm25, pm.pm10);
            addPMToHistory(pm.pm1, pm.pm25, pm.pm10);
        }

        // Try to get BINS (may fail if not supported)
        if (app.kernel.sensorInfo.binsSupported) {
            const bins = await app.kernel.getBINS(interval);
            if (bins && bins.bins) {
                updateBINSChart(bins.bins);
            }
        }

    } catch (error) {
        console.error('Refresh failed:', error);
    }
}

/**
 * Refresh pro mode data
 */
async function refreshProData() {
    if (!app.kernel.isConnected) return;

    try {
        await app.kernel.sendCommand('SNAPSHOT');
    } catch (error) {
        console.error('Pro refresh failed:', error);
    }
}

/**
 * Start auto-refresh
 */
function startAutoRefresh() {
    stopAutoRefresh();

    // Refresh every 10 seconds
    app.autoRefreshInterval = setInterval(() => {
        if (app.currentTab === 'light') {
            refreshLightData();
        }
    }, 10000);

    // Initial refresh
    setTimeout(() => refreshLightData(), 1000);
}

/**
 * Stop auto-refresh
 */
function stopAutoRefresh() {
    if (app.autoRefreshInterval) {
        clearInterval(app.autoRefreshInterval);
        app.autoRefreshInterval = null;
    }
}

/**
 * Send quick command (Pro mode)
 */
async function sendQuickCommand(command) {
    try {
        await app.kernel.sendCommand(command);
    } catch (error) {
        console.error('Command failed:', error);
    }
}

/**
 * Send custom command (Pro mode)
 */
async function sendCustomCommand() {
    const input = document.getElementById('custom-command');
    const command = input.value.trim();

    if (!command) return;

    try {
        await app.kernel.sendCommand(command);
        input.value = '';
    } catch (error) {
        console.error('Custom command failed:', error);
    }
}

/**
 * Add raw data to display (Pro mode)
 */
function addRawData(raw, parsed) {
    const container = document.getElementById('raw-data-display');

    const entry = document.createElement('div');
    entry.className = 'raw-data-entry';

    const timestamp = new Date().toLocaleTimeString('fr-FR');
    const status = parsed && parsed.ok ? 'ok' : parsed && parsed.ok === false ? 'error' : 'info';

    entry.innerHTML = `
        <span class="raw-timestamp">${timestamp}</span>
        <span class="raw-status ${status}">${status.toUpperCase()}</span>
        <pre class="raw-content">${raw}</pre>
    `;

    container.appendChild(entry);

    // Limit entries
    while (container.children.length > 50) {
        container.removeChild(container.firstChild);
    }

    // Auto-scroll
    container.scrollTop = container.scrollHeight;
}

/**
 * Clear raw data display
 */
function clearRawData() {
    document.getElementById('raw-data-display').innerHTML = '';
}

/**
 * Add debug log (Pro mode)
 */
function addDebugLog(logEntry) {
    const container = document.getElementById('debug-logs');

    const entry = document.createElement('div');
    entry.className = `log-entry log-${logEntry.level.toLowerCase()}`;

    const time = new Date(logEntry.timestamp).toLocaleTimeString('fr-FR');

    entry.innerHTML = `
        <span class="log-time">${time}</span>
        <span class="log-level">${logEntry.level}</span>
        <span class="log-message">${logEntry.message}</span>
        ${logEntry.data ? `<pre class="log-data">${JSON.stringify(logEntry.data, null, 2)}</pre>` : ''}
    `;

    container.appendChild(entry);

    // Limit entries
    while (container.children.length > 100) {
        container.removeChild(container.firstChild);
    }

    // Auto-scroll if enabled
    const autoScroll = document.getElementById('auto-scroll-logs').checked;
    if (autoScroll) {
        container.scrollTop = container.scrollHeight;
    }
}

/**
 * Add simple log message
 */
function addLog(level, message) {
    addDebugLog({
        timestamp: new Date().toISOString(),
        level,
        message,
        data: null
    });
}

/**
 * Clear debug logs
 */
function clearDebugLogs() {
    document.getElementById('debug-logs').innerHTML = '';
}

/**
 * Update pro detail chart
 */
function updateProChart(chartType) {
    // TODO: Implement different chart types for pro mode
    console.log('Update pro chart:', chartType);
}

/**
 * Format uptime
 */
function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days}j ${hours % 24}h`;
    } else if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

/**
 * Show error message
 */
function showError(message) {
    alert(message);
}
