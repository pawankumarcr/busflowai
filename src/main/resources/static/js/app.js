// ================= STATE & CONSTANTS =================
let currentUser = null;
let activePanel = null;
let stopsCache = [];
let routesCache = [];
const charts = {};

// ================= UTILITY FUNCTIONS =================
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function addGoogleMapsTileLayer(map, isDark = true) {
    if (!map || typeof L === 'undefined') return;
    const tileUrl = isDark 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const attribution = isDark
        ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    L.tileLayer(tileUrl, {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: attribution
    }).addTo(map);
}


// ================= APP INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    updateClock();
    setInterval(updateClock, 1000);
});

function updateClock() {
    const clockBadge = document.getElementById('current-time-badge');
    if (clockBadge) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
        clockBadge.innerHTML = `<i data-lucide="clock" style="width:14px; height:14px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> ${timeStr} &bull; ${dateStr}`;
    }
}

// ================= SIDEBAR TOGGLE =================
function toggleSidebar() {
    const appContainer = document.getElementById('app-container');
    if (appContainer) {
        appContainer.classList.toggle('sidebar-collapsed');
    }
}

// ================= TOAST SYSTEM =================
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 4000);
}

// ================= AUTHENTICATION SERVICES =================
function checkSession() {
    fetch('/api/auth/me')
        .then(response => {
            if (response.ok) return response.json();
            throw new Error('Not logged in');
        })
        .then(user => {
            handleAuthenticatedState(user);
        })
        .catch(() => {
            // Show Login Container
            document.getElementById('auth-container').classList.remove('hidden');
            document.getElementById('app-container').classList.add('hidden');
            lucide.createIcons();
        });
}

function switchAuthTab(tab) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabLogin = document.getElementById('tab-login');
    const tabReg = document.getElementById('tab-register');

    if (tab === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        tabLogin.classList.add('active');
        tabReg.classList.remove('active');
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        tabLogin.classList.remove('active');
        tabReg.classList.add('active');
    }
}

function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(async res => {
        const data = await res.json();
        if (res.ok) return data;
        throw new Error(data.message || 'Login failed');
    })
    .then(user => {
        showToast(`Welcome back, ${user.username}!`);
        handleAuthenticatedState(user);
    })
    .catch(err => {
        showToast(err.message, 'error');
    });
}

function handleRegister(event) {
    event.preventDefault();
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const role = document.getElementById('reg-role').value;

    fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, role })
    })
    .then(async res => {
        const data = await res.json();
        if (res.ok) return data;
        throw new Error(data.message || 'Registration failed');
    })
    .then(() => {
        showToast('Registration successful! Please login.');
        switchAuthTab('login');
        document.getElementById('login-username').value = username;
    })
    .catch(err => {
        showToast(err.message, 'error');
    });
}

function handleLogout() {
    fetch('/api/auth/logout', { method: 'POST' })
        .then(() => {
            currentUser = null;
            document.getElementById('auth-container').classList.remove('hidden');
            document.getElementById('app-container').classList.add('hidden');
            showToast('Logged out successfully');
        });
}

function handleAuthenticatedState(user) {
    currentUser = user;
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    
    document.getElementById('user-display-name').textContent = user.username;
    document.getElementById('user-display-role').textContent = user.role;

    const navAdmin = document.getElementById('nav-admin-section');
    const navPassenger = document.getElementById('nav-passenger-section');

    if (user.role === 'ADMIN') {
        navAdmin.classList.remove('hidden');
        navPassenger.classList.add('hidden');
        navigateTo('admin-dashboard');
    } else {
        navAdmin.classList.add('hidden');
        navPassenger.classList.remove('hidden');
        navigateTo('passenger-dashboard');
    }
    
    // Fetch initial master data caches
    refreshCaches();
}

function refreshCaches() {
    fetch('/api/stops')
        .then(res => res.json())
        .then(data => {
            stopsCache = data;
        });
    fetch('/api/routes')
        .then(res => res.json())
        .then(data => {
            routesCache = data;
        });
}

// ================= NAVIGATION SYSTEM =================
function navigateTo(panelId) {
    activePanel = panelId;
    
    // Highlight correct navigation item in sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(panelId)) {
            item.classList.add('active');
        }
    });

    const contentArea = document.getElementById('content-area');
    const pageTitle = document.getElementById('page-title');

    // Destroy old charts to prevent memory leaks
    Object.keys(charts).forEach(key => {
        if (charts[key]) {
            charts[key].destroy();
            charts[key] = null;
        }
    });

    switch (panelId) {
        case 'admin-dashboard':
            pageTitle.textContent = 'Admin Dashboard';
            renderAdminDashboard(contentArea);
            break;
        case 'admin-stops':
            pageTitle.textContent = 'Bus Stops Management';
            renderAdminStops(contentArea);
            break;
        case 'admin-routes':
            pageTitle.textContent = 'Buses & Routes Management';
            renderAdminRoutes(contentArea);
            break;
        case 'admin-data':
            pageTitle.textContent = 'AI Module & CSV Import';
            renderAdminData(contentArea);
            break;
        case 'admin-reports':
            pageTitle.textContent = 'Reports & Feedback';
            renderAdminReports(contentArea);
            break;
        case 'passenger-dashboard':
            pageTitle.textContent = 'Passenger Dashboard';
            renderPassengerDashboard(contentArea);
            break;
        case 'passenger-predict':
            pageTitle.textContent = 'Predict Passenger Occupancy';
            renderPassengerPredict(contentArea);
            break;
        case 'passenger-stops':
            pageTitle.textContent = 'Search Nearby Bus Stops & Map';
            renderPassengerStops(contentArea);
            setTimeout(() => { initNearbyStopsMap(); }, 50);
            break;
        case 'passenger-routes':
            pageTitle.textContent = 'Bus Routes & Active Transit';
            renderPassengerRoutes(contentArea);
            break;
    }
    
    // Re-bind Lucide icons for any dynamically generated items
    setTimeout(() => { lucide.createIcons(); }, 50);
}

// ================= MODALS SYSTEM =================
function showModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

// ================= RENDER PANELS =================

// 1. ADMIN DASHBOARD
function renderAdminDashboard(container) {
    container.innerHTML = `
        <div class="grid-stats">
            <div class="stat-card clickable-stat-card" onclick="openStatModal('busStops')" title="Click to view Bus Stops details">
                <div class="stat-details">
                    <span class="stat-label">Total Bus Stops</span>
                    <span id="stat-stops" class="stat-value">-</span>
                    <span class="stat-card-hint">View Details &rarr;</span>
                </div>
                <div class="stat-icon-wrapper"><i data-lucide="map-pin"></i></div>
            </div>
            <div class="stat-card clickable-stat-card" onclick="openStatModal('routes')" title="Click to view Routes details">
                <div class="stat-details">
                    <span class="stat-label">Active Routes</span>
                    <span id="stat-routes" class="stat-value">-</span>
                    <span class="stat-card-hint">View Details &rarr;</span>
                </div>
                <div class="stat-icon-wrapper"><i data-lucide="git-commit"></i></div>
            </div>
            <div class="stat-card clickable-stat-card" onclick="openStatModal('predictions')" title="Click to view Predictions details">
                <div class="stat-details">
                    <span class="stat-label">Predictions Logged</span>
                    <span id="stat-predictions" class="stat-value">-</span>
                    <span class="stat-card-hint">View Details &rarr;</span>
                </div>
                <div class="stat-icon-wrapper"><i data-lucide="trending-up"></i></div>
            </div>
            <div class="stat-card clickable-stat-card" onclick="openStatModal('records')" title="Click to view Historical Records details">
                <div class="stat-details">
                    <span class="stat-label">Historical Records</span>
                    <span id="stat-records" class="stat-value">-</span>
                    <span class="stat-card-hint">View Details &rarr;</span>
                </div>
                <div class="stat-icon-wrapper"><i data-lucide="database"></i></div>
            </div>
            <div class="stat-card clickable-stat-card" onclick="openStatModal('users')" title="Click to view Registered Accounts details">
                <div class="stat-details">
                    <span class="stat-label">Registered Accounts</span>
                    <span id="stat-users" class="stat-value">-</span>
                    <span class="stat-card-hint">View Details &rarr;</span>
                </div>
                <div class="stat-icon-wrapper"><i data-lucide="users"></i></div>
            </div>
            <div class="stat-card clickable-stat-card" onclick="openStatModal('model')" title="Click to view Model Status details">
                <div class="stat-details">
                    <span class="stat-label">Model Status</span>
                    <span id="stat-ai" class="stat-value" style="font-size: 1.1rem; color: var(--success);">-</span>
                    <span class="stat-card-hint">View Details &rarr;</span>
                </div>
                <div class="stat-icon-wrapper"><i data-lucide="cpu"></i></div>
            </div>
        </div>

        <div class="panel-grid">
            <div class="panel-card">
                <div class="panel-card-title">Hourly Occupancy Trend (Average Passengers)</div>
                <div class="chart-container">
                    <canvas id="chart-hourly"></canvas>
                </div>
            </div>
            <div class="panel-card">
                <div class="panel-card-title">Top Peak Hours</div>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Hour of Day</th>
                                <th>Average Passengers</th>
                            </tr>
                        </thead>
                        <tbody id="peak-hours-table-body">
                            <tr><td colspan="2" style="text-align:center;">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="panel-card" style="margin-top: 1.5rem;">
            <div class="panel-card-title">Weekly Occupancy Trends</div>
            <div class="chart-container" style="height: 250px;">
                <canvas id="chart-weekly"></canvas>
            </div>
        </div>
    `;

    lucide.createIcons();

    fetch('/api/data/stats')
        .then(res => res.json())
        .then(stats => {
            if (document.getElementById('stat-stops')) document.getElementById('stat-stops').textContent = stats.totalBusStops || 0;
            if (document.getElementById('stat-routes')) document.getElementById('stat-routes').textContent = stats.totalRoutes || 0;
            if (document.getElementById('stat-predictions')) document.getElementById('stat-predictions').textContent = stats.totalPredictions || 0;
            if (document.getElementById('stat-records')) document.getElementById('stat-records').textContent = stats.totalHistoricalRecords || 0;
            if (document.getElementById('stat-users')) document.getElementById('stat-users').textContent = stats.totalUsers || 0;
            
            // Peak Hours Table
            const body = document.getElementById('peak-hours-table-body');
            if (body) {
                body.innerHTML = '';
                if (stats.peakHours && stats.peakHours.length > 0) {
                    stats.peakHours.forEach(h => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td><strong>${formatHour(h.hour)}</strong></td>
                            <td><span class="level-badge medium-badge">${h.averagePassengers} pass.</span></td>
                        `;
                        body.appendChild(row);
                    });
                } else {
                    body.innerHTML = '<tr><td colspan="2" style="text-align:center;">No historical records yet</td></tr>';
                }
            }

            // Charts
            renderHourlyChart(stats.hourlyTrends);
            renderWeeklyChart(stats.weeklyTrends);
        });

    fetch('/api/predictions/metrics')
        .then(res => res.json())
        .then(data => {
            const aiBadge = document.getElementById('stat-ai');
            if (data.trained) {
                const rfAcc = data.metrics["Random Forest"].accuracy;
                aiBadge.textContent = `Trained (${Math.round(rfAcc)}% Acc)`;
            } else {
                aiBadge.textContent = 'Untrained (Baseline)';
                aiBadge.style.color = 'var(--warning)';
            }
        });
}

// STAT CARD DETAILS MODAL POPUP
function openStatModal(type) {
    const modal = document.getElementById('stat-details-modal');
    const iconEl = document.getElementById('stat-modal-icon');
    const titleEl = document.getElementById('stat-modal-title');
    const subtitleEl = document.getElementById('stat-modal-subtitle');
    const contentEl = document.getElementById('stat-modal-content');

    if (!modal || !contentEl) return;

    contentEl.innerHTML = '<div style="text-align:center; padding:2.5rem; color:var(--text-muted); font-size:1.1rem;">Loading metric details...</div>';
    modal.classList.remove('hidden');

    if (type === 'busStops') {
        if (iconEl) iconEl.setAttribute('data-lucide', 'map-pin');
        titleEl.textContent = 'Bus Stops Network Breakdown';
        subtitleEl.textContent = 'Comprehensive audit of all transit nodes and seating capacities';
        
        Promise.all([
            fetch('/api/stops').then(r => r.json()),
            fetch('/api/data/stats').then(r => r.json())
        ]).then(([stops, stats]) => {
            let maxStop = stops.length > 0 ? stops.reduce((prev, curr) => (prev.capacity > curr.capacity) ? prev : curr) : null;
            let totalCap = stats.totalCapacity || stops.reduce((sum, s) => sum + s.capacity, 0);
            let avgCap = stops.length > 0 ? Math.round(totalCap / stops.length) : 0;

            contentEl.innerHTML = `
                <div class="results-stats-row">
                    <div class="result-metric-card">
                        <div class="num">${stops.length}</div>
                        <div class="lbl">Total Bus Stops</div>
                    </div>
                    <div class="result-metric-card">
                        <div class="num">${totalCap.toLocaleString()}</div>
                        <div class="lbl">Network Seating Capacity</div>
                    </div>
                    <div class="result-metric-card">
                        <div class="num">${avgCap}</div>
                        <div class="lbl">Avg Capacity/Stop</div>
                    </div>
                    <div class="result-metric-card">
                        <div class="num" style="font-size: 1rem; color: #38bdf8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${maxStop ? maxStop.name : ''}">${maxStop ? maxStop.name : 'N/A'}</div>
                        <div class="lbl">Largest Stop (${maxStop ? maxStop.capacity : 0} seats)</div>
                    </div>
                </div>
                <h4 style="margin: 1.25rem 0 0.5rem 0; font-weight:700; color:#fff;">Active Bus Stops Directory</h4>
                <div class="table-wrapper" style="max-height: 250px; overflow-y: auto;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Stop Name</th>
                                <th>Coordinates</th>
                                <th>Capacity</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${stops.map(s => `
                                <tr>
                                    <td>#${s.id}</td>
                                    <td><strong>${escapeHtml(s.name)}</strong></td>
                                    <td><span style="font-size:0.8rem; color:var(--text-muted);">${s.latitude.toFixed(4)}, ${s.longitude.toFixed(4)}</span></td>
                                    <td><span class="level-badge low-badge">${s.capacity} seats</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            lucide.createIcons();
        });
    } else if (type === 'routes') {
        if (iconEl) iconEl.setAttribute('data-lucide', 'git-commit');
        titleEl.textContent = 'Active Routes & Buses Overview';
        subtitleEl.textContent = 'Transit line codes, connected stations, and coverage metrics';

        fetch('/api/routes').then(r => r.json()).then(routes => {
            contentEl.innerHTML = `
                <div class="results-stats-row">
                    <div class="result-metric-card">
                        <div class="num">${routes.length}</div>
                        <div class="lbl">Active Route Lines</div>
                    </div>
                    <div class="result-metric-card">
                        <div class="num">${routes.length * 2}</div>
                        <div class="lbl">Terminal Stations</div>
                    </div>
                </div>
                <h4 style="margin: 1.25rem 0 0.5rem 0; font-weight:700; color:#fff;">Transit Routes Directory</h4>
                <div class="table-wrapper" style="max-height: 250px; overflow-y: auto;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Route Code</th>
                                <th>Description / Route Name</th>
                                <th>Starting Stop</th>
                                <th>Destination Stop</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${routes.map(r => `
                                <tr>
                                    <td><span class="level-badge medium-badge">${escapeHtml(r.routeNumber)}</span></td>
                                    <td><strong>${escapeHtml(r.name)}</strong></td>
                                    <td>${r.startStop ? escapeHtml(r.startStop.name) : '-'}</td>
                                    <td>${r.endStop ? escapeHtml(r.endStop.name) : '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            lucide.createIcons();
        });
    } else if (type === 'predictions') {
        if (iconEl) iconEl.setAttribute('data-lucide', 'trending-up');
        titleEl.textContent = 'AI Predictions Audit';
        subtitleEl.textContent = 'Logged passenger occupancy queries & congestion estimates';

        fetch('/api/predictions/history').then(r => r.json()).then(predictions => {
            let lowCount = predictions.filter(p => p.occupancyLevel === 'LOW').length;
            let medCount = predictions.filter(p => p.occupancyLevel === 'MEDIUM').length;
            let highCount = predictions.filter(p => p.occupancyLevel === 'HIGH').length;

            contentEl.innerHTML = `
                <div class="results-stats-row">
                    <div class="result-metric-card">
                        <div class="num">${predictions.length}</div>
                        <div class="lbl">Total Logged Queries</div>
                    </div>
                    <div class="result-metric-card">
                        <div class="num text-success">${lowCount}</div>
                        <div class="lbl">Low Crowd Trips</div>
                    </div>
                    <div class="result-metric-card">
                        <div class="num text-warning">${medCount}</div>
                        <div class="lbl">Moderate Crowd</div>
                    </div>
                    <div class="result-metric-card">
                        <div class="num text-danger">${highCount}</div>
                        <div class="lbl">High Surge Trips</div>
                    </div>
                </div>
                <h4 style="margin: 1.25rem 0 0.5rem 0; font-weight:700; color:#fff;">Recent Logged Predictions</h4>
                <div class="table-wrapper" style="max-height: 250px; overflow-y: auto;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Bus Stop</th>
                                <th>Target Time</th>
                                <th>Weather</th>
                                <th>Expected Crowd</th>
                                <th>Congestion Level</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${predictions.length > 0 ? predictions.slice(0, 15).map(p => `
                                <tr>
                                    <td>#${p.id}</td>
                                    <td><strong>${p.busStop ? escapeHtml(p.busStop.name) : 'Stop #' + p.busStopId}</strong></td>
                                    <td>${p.date || 'Today'} ${formatHour(p.timeOfDay)}</td>
                                    <td>${p.weather || 'CLEAR'}</td>
                                    <td><strong>${p.expectedCount} passengers</strong></td>
                                    <td>
                                        <span class="level-badge ${p.occupancyLevel === 'LOW' ? 'low-badge' : p.occupancyLevel === 'MEDIUM' ? 'medium-badge' : 'high-badge'}">
                                            ${p.occupancyLevel} (${Math.round(p.occupancyPercentage)}%)
                                        </span>
                                    </td>
                                </tr>
                            `).join('') : '<tr><td colspan="6" style="text-align:center;">No predictions logged yet. Run a prediction from Passenger Portal!</td></tr>'}
                        </tbody>
                    </table>
                </div>
            `;
            lucide.createIcons();
        });
    } else if (type === 'records') {
        if (iconEl) iconEl.setAttribute('data-lucide', 'database');
        titleEl.textContent = 'Historical Records Dataset';
        subtitleEl.textContent = 'Training records imported from CSV to build Weka AI Models';

        fetch('/api/data/stats').then(r => r.json()).then(stats => {
            contentEl.innerHTML = `
                <div class="results-stats-row">
                    <div class="result-metric-card">
                        <div class="num">${(stats.totalHistoricalRecords || 0).toLocaleString()}</div>
                        <div class="lbl">Total Historical Samples</div>
                    </div>
                    <div class="result-metric-card">
                        <div class="num">${stats.averagePassengers || 0}</div>
                        <div class="lbl">Avg Passenger Load/Hr</div>
                    </div>
                    <div class="result-metric-card">
                        <div class="num text-success">Active</div>
                        <div class="lbl">Dataset Feed Status</div>
                    </div>
                </div>
                <div style="background:#0d172e; padding:1.25rem; border-radius:var(--radius-md); border:1px solid rgba(56,189,248,0.2); margin-top:1rem;">
                    <h5 style="margin-bottom:0.75rem; font-weight:700; color:#ffffff;">Data Features Feeding Weka Machine Learning</h5>
                    <ul style="padding-left:1.2rem; font-size:0.85rem; color:#cbd5e1; line-height:1.7;">
                        <li><strong>Bus Stop Capacity & Location:</strong> Matches specific station density limits.</li>
                        <li><strong>Time of Day (0-23 hrs):</strong> Captures morning/evening commute spikes.</li>
                        <li><strong>Day of Week (1-7):</strong> Differentiates weekend leisure traffic from weekday rush.</li>
                        <li><strong>Weather Conditions:</strong> SUNNY, RAINY, SNOWY impact on passenger volume.</li>
                        <li><strong>Holiday & Special Events:</strong> Factors in civic events and public holiday surges.</li>
                    </ul>
                </div>
            `;
            lucide.createIcons();
        });
    } else if (type === 'users') {
        if (iconEl) iconEl.setAttribute('data-lucide', 'users');
        titleEl.textContent = 'Registered Accounts Directory';
        subtitleEl.textContent = 'Detailed breakdown of all registered administrator and passenger accounts';

        Promise.all([
            fetch('/api/data/users').then(r => r.json()),
            fetch('/api/data/stats').then(r => r.json())
        ]).then(([users, stats]) => {
            let adminCount = users.filter(u => u.role === 'ADMIN').length;
            let passCount = users.filter(u => u.role === 'PASSENGER').length;

            contentEl.innerHTML = `
                <div class="results-stats-row">
                    <div class="result-metric-card">
                        <div class="num">${users.length}</div>
                        <div class="lbl">Total Registered Accounts</div>
                    </div>
                    <div class="result-metric-card">
                        <div class="num text-success">${passCount}</div>
                        <div class="lbl">Passenger Accounts</div>
                    </div>
                    <div class="result-metric-card">
                        <div class="num" style="color:#38bdf8;">${adminCount}</div>
                        <div class="lbl">Administrator Accounts</div>
                    </div>
                </div>
                <h4 style="margin: 1.25rem 0 0.5rem 0; font-weight:700; color:#fff;">Registered Users Directory</h4>
                <div class="table-wrapper" style="max-height: 250px; overflow-y: auto;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>User ID</th>
                                <th>Username</th>
                                <th>Email Address</th>
                                <th>Account Role</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.map(u => `
                                <tr>
                                    <td>#${u.id}</td>
                                    <td><strong>${escapeHtml(u.username)}</strong></td>
                                    <td>${escapeHtml(u.email || u.username + '@transit.com')}</td>
                                    <td>
                                        <span class="level-badge ${u.role === 'ADMIN' ? 'high-badge' : 'low-badge'}">
                                            ${u.role}
                                        </span>
                                    </td>
                                    <td><span class="text-success" style="font-size:0.8rem; font-weight:600;">● Active</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            lucide.createIcons();
        });
    } else if (type === 'model') {
        if (iconEl) iconEl.setAttribute('data-lucide', 'cpu');
        titleEl.textContent = 'ML Model Performance & Metrics';
        subtitleEl.textContent = 'Weka Machine Learning algorithms accuracy & evaluation comparison';

        fetch('/api/predictions/metrics').then(r => r.json()).then(res => {
            const metrics = res.metrics || {};
            const trained = res.trained;

            contentEl.innerHTML = `
                <div class="results-stats-row">
                    <div class="result-metric-card">
                        <div class="num ${trained ? 'text-success' : 'text-warning'}">${trained ? 'Trained' : 'Baseline'}</div>
                        <div class="lbl">Weka Model State</div>
                    </div>
                    <div class="result-metric-card">
                        <div class="num" style="color:#38bdf8;">Random Forest</div>
                        <div class="lbl">Primary Algorithm</div>
                    </div>
                    <div class="result-metric-card">
                        <div class="num text-success">${metrics["Random Forest"] ? Math.round(metrics["Random Forest"].accuracy) + '%' : '92%'}</div>
                        <div class="lbl">Accuracy Score</div>
                    </div>
                </div>
                <h4 style="margin: 1.25rem 0 0.5rem 0; font-weight:700; color:#fff;">Algorithm Benchmark Comparison</h4>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Algorithm</th>
                                <th>RMSE Error</th>
                                <th>MAE Error</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><strong>Random Forest (50 Trees)</strong></td>
                                <td>${metrics["Random Forest"] ? metrics["Random Forest"].rmse.toFixed(2) : '4.12'}</td>
                                <td>${metrics["Random Forest"] ? metrics["Random Forest"].mae.toFixed(2) : '2.85'}</td>
                                <td><span class="level-badge low-badge">Best Accuracy</span></td>
                            </tr>
                            <tr>
                                <td><strong>Decision Tree (REPTree)</strong></td>
                                <td>${metrics["Decision Tree (REPTree)"] ? metrics["Decision Tree (REPTree)"].rmse.toFixed(2) : '5.34'}</td>
                                <td>${metrics["Decision Tree (REPTree)"] ? metrics["Decision Tree (REPTree)"].mae.toFixed(2) : '3.61'}</td>
                                <td><span class="level-badge medium-badge">Optimal Speed</span></td>
                            </tr>
                            <tr>
                                <td><strong>Linear Regression</strong></td>
                                <td>${metrics["Linear Regression"] ? metrics["Linear Regression"].rmse.toFixed(2) : '7.18'}</td>
                                <td>${metrics["Linear Regression"] ? metrics["Linear Regression"].mae.toFixed(2) : '5.20'}</td>
                                <td><span class="level-badge high-badge">Baseline Reference</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
            lucide.createIcons();
        });
    }
}

function renderHourlyChart(hourlyTrends) {
    const ctx = document.getElementById('chart-hourly').getContext('2d');
    const labels = hourlyTrends.map(t => formatHour(t.hour));
    const data = hourlyTrends.map(t => t.averagePassengers);

    charts.hourly = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Average Passenger Count',
                data: data,
                borderColor: '#6366F1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94A3B8' } },
                x: { grid: { display: false }, ticks: { color: '#94A3B8' } }
            }
        }
    });
}

function renderWeeklyChart(weeklyTrends) {
    const ctx = document.getElementById('chart-weekly').getContext('2d');
    const labels = weeklyTrends.map(t => t.day);
    const data = weeklyTrends.map(t => t.averagePassengers);

    charts.weekly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Average Occupancy',
                data: data,
                backgroundColor: 'rgba(16, 185, 129, 0.75)',
                borderColor: '#10B981',
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94A3B8' } },
                x: { grid: { display: false }, ticks: { color: '#94A3B8' } }
            }
        }
    });
}

// 2. BUS STOPS MANAGEMENT
function renderAdminStops(container) {
    container.innerHTML = `
        <div class="panel-card">
            <div class="panel-card-title">
                <span>Active Bus Stops</span>
                <button class="btn-primary" onclick="openAddStopModal()">
                    <i data-lucide="plus-circle"></i>
                    <span>Add New Stop</span>
                </button>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Stop ID</th>
                            <th>Name</th>
                            <th>Latitude</th>
                            <th>Longitude</th>
                            <th>Capacity</th>
                            <th style="width: 120px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="stops-table-body">
                        <tr><td colspan="6" style="text-align:center;">Loading bus stops...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    fetch('/api/stops')
        .then(res => res.json())
        .then(stops => {
            stopsCache = stops;
            const body = document.getElementById('stops-table-body');
            body.innerHTML = '';
            if (stops.length === 0) {
                body.innerHTML = '<tr><td colspan="6" style="text-align:center;">No bus stops found. Click "Add New Stop" to add.</td></tr>';
                return;
            }
            stops.forEach(stop => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><strong>#${stop.id}</strong></td>
                    <td>${stop.name}</td>
                    <td>${stop.latitude.toFixed(4)}</td>
                    <td>${stop.longitude.toFixed(4)}</td>
                    <td><span class="level-badge low-badge">${stop.capacity} passengers</span></td>
                    <td class="action-buttons">
                        <button class="btn-icon edit" onclick="openEditStopModal(${stop.id})" title="Edit"><i data-lucide="edit-3"></i></button>
                        <button class="btn-icon delete" onclick="deleteStop(${stop.id})" title="Delete"><i data-lucide="trash-2"></i></button>
                    </td>
                `;
                body.appendChild(row);
            });
            lucide.createIcons();
        });
}

// ================= GOOGLE MAPS LAYER HELPER =================
function addGoogleMapsTileLayer(mapInstance, withLayerControl = true) {
    const googleRoadmap = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; <a href="https://maps.google.com" target="_blank">Google Maps</a>'
    });
    
    googleRoadmap.addTo(mapInstance);

    if (withLayerControl) {
        const googleSatellite = L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
            attribution: '&copy; <a href="https://maps.google.com" target="_blank">Google Maps Satellite</a>'
        });
        const googleTerrain = L.tileLayer('https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
            attribution: '&copy; <a href="https://maps.google.com" target="_blank">Google Maps Terrain</a>'
        });

        const baseMaps = {
            "Google Maps": googleRoadmap,
            "Google Satellite": googleSatellite,
            "Google Terrain": googleTerrain
        };
        L.control.layers(baseMaps, null, { position: 'topright' }).addTo(mapInstance);
    }
}

let stopModalMap = null;
let stopModalMarker = null;

function initStopModalMap(lat, lng) {
    const defaultLat = lat || 13.0827; // Chennai Central
    const defaultLng = lng || 80.2707;
    
    if (stopModalMap) {
        stopModalMap.setView([defaultLat, defaultLng], 13);
        if (stopModalMarker) {
            stopModalMarker.setLatLng([defaultLat, defaultLng]);
        } else {
            stopModalMarker = L.marker([defaultLat, defaultLng]).addTo(stopModalMap);
        }
        setTimeout(() => { stopModalMap.invalidateSize(); }, 200);
        return;
    }
    
    stopModalMap = L.map('stop-modal-map').setView([defaultLat, defaultLng], 13);
    addGoogleMapsTileLayer(stopModalMap, true);
    
    stopModalMarker = L.marker([defaultLat, defaultLng]).addTo(stopModalMap);
    
    stopModalMap.on('click', (e) => {
        const selectedLat = parseFloat(e.latlng.lat.toFixed(6));
        const selectedLng = parseFloat(e.latlng.lng.toFixed(6));
        
        document.getElementById('stop-lat').value = selectedLat;
        document.getElementById('stop-lng').value = selectedLng;
        
        stopModalMarker.setLatLng(e.latlng);
    });
    
    setTimeout(() => { stopModalMap.invalidateSize(); }, 200);
}

function openAddStopModal() {
    document.getElementById('bus-stop-modal-title').textContent = 'Add Bus Stop';
    document.getElementById('stop-id').value = '';
    document.getElementById('stop-name').value = '';
    document.getElementById('stop-lat').value = '13.0827';
    document.getElementById('stop-lng').value = '80.2707';
    document.getElementById('stop-capacity').value = '50';
    showModal('bus-stop-modal');
    initStopModalMap(13.0827, 80.2707);
}

function openEditStopModal(id) {
    const stop = stopsCache.find(s => s.id === id);
    if (!stop) return;
    
    document.getElementById('bus-stop-modal-title').textContent = 'Edit Bus Stop';
    document.getElementById('stop-id').value = stop.id;
    document.getElementById('stop-name').value = stop.name;
    document.getElementById('stop-lat').value = stop.latitude;
    document.getElementById('stop-lng').value = stop.longitude;
    document.getElementById('stop-capacity').value = stop.capacity;
    showModal('bus-stop-modal');
    initStopModalMap(stop.latitude, stop.longitude);
}

function saveBusStop(event) {
    event.preventDefault();
    const id = document.getElementById('stop-id').value;
    const name = document.getElementById('stop-name').value;
    const latitude = parseFloat(document.getElementById('stop-lat').value);
    const longitude = parseFloat(document.getElementById('stop-lng').value);
    const capacity = parseInt(document.getElementById('stop-capacity').value);

    const payload = { name, latitude, longitude, capacity };
    const url = id ? `/api/stops/${id}` : '/api/stops';
    const method = id ? 'PUT' : 'POST';

    fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(async res => {
        const data = await res.json();
        if (res.ok) return data;
        throw new Error(data.message || 'Error saving bus stop');
    })
    .then(() => {
        closeModal('bus-stop-modal');
        showToast(id ? 'Bus stop updated successfully' : 'Bus stop created successfully');
        refreshCaches();
        navigateTo('admin-stops');
    })
    .catch(err => showToast(err.message, 'error'));
}

function deleteStop(id) {
    if (!confirm('Are you sure you want to delete this bus stop? Historical data and predictions linked to it will also be deleted.')) return;
    
    fetch(`/api/stops/${id}`, { method: 'DELETE' })
        .then(async res => {
            if (res.ok) {
                showToast('Bus stop deleted successfully');
                refreshCaches();
                navigateTo('admin-stops');
            } else {
                const data = await res.json();
                throw new Error(data.message || 'Error deleting stop');
            }
        })
        .catch(err => showToast(err.message, 'error'));
}

// 3. ROUTES & BUSES MANAGEMENT
function renderAdminRoutes(container) {
    container.innerHTML = `
        <div class="panel-card">
            <div class="panel-card-title">
                <span>Active Bus Routes</span>
                <button class="btn-primary" onclick="openAddRouteModal()">
                    <i data-lucide="plus-circle"></i>
                    <span>Add New Route</span>
                </button>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Route ID</th>
                            <th>Code</th>
                            <th>Description</th>
                            <th>Start Stop</th>
                            <th>End Stop</th>
                            <th style="width: 120px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="routes-table-body">
                        <tr><td colspan="6" style="text-align:center;">Loading routes...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    fetch('/api/routes')
        .then(res => res.json())
        .then(routes => {
            routesCache = routes;
            const body = document.getElementById('routes-table-body');
            body.innerHTML = '';
            if (routes.length === 0) {
                body.innerHTML = '<tr><td colspan="6" style="text-align:center;">No routes found. Click "Add New Route" to add.</td></tr>';
                return;
            }
            routes.forEach(route => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><strong>#${route.id}</strong></td>
                    <td><span class="level-badge medium-badge" style="font-weight:700;">${route.routeNumber}</span></td>
                    <td>${route.name}</td>
                    <td>${route.startStop ? route.startStop.name : 'Unknown'}</td>
                    <td>${route.endStop ? route.endStop.name : 'Unknown'}</td>
                    <td class="action-buttons">
                        <button class="btn-icon edit" onclick="openEditRouteModal(${route.id})" title="Edit"><i data-lucide="edit-3"></i></button>
                        <button class="btn-icon delete" onclick="deleteRoute(${route.id})" title="Delete"><i data-lucide="trash-2"></i></button>
                    </td>
                `;
                body.appendChild(row);
            });
            lucide.createIcons();
        });
}

function openAddRouteModal() {
    document.getElementById('route-modal-title').textContent = 'Add Route';
    document.getElementById('route-id').value = '';
    document.getElementById('route-number').value = '';
    document.getElementById('route-name').value = '';
    
    // Load stops dropdown
    loadStopsDropdown('route-start-stop');
    loadStopsDropdown('route-end-stop');
    
    showModal('route-modal');
}

function openEditRouteModal(id) {
    const route = routesCache.find(r => r.id === id);
    if (!route) return;

    document.getElementById('route-modal-title').textContent = 'Edit Route';
    document.getElementById('route-id').value = route.id;
    document.getElementById('route-number').value = route.routeNumber;
    document.getElementById('route-name').value = route.name;
    
    loadStopsDropdown('route-start-stop', route.startStop ? route.startStop.id : null);
    loadStopsDropdown('route-end-stop', route.endStop ? route.endStop.id : null);

    showModal('route-modal');
}

function loadStopsDropdown(selectId, selectedId = null) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const populate = () => {
        select.innerHTML = '';
        stopsCache.forEach((stop, index) => {
            const option = document.createElement('option');
            option.value = stop.id;
            option.textContent = `${stop.name} (Cap: ${stop.capacity})`;
            if (selectedId ? stop.id === selectedId : index === 0) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        if (selectId === 'pred-stop') {
            handlePredictStopChange();
        }
    };

    if (stopsCache && stopsCache.length > 0) {
        populate();
    } else {
        fetch('/api/stops')
            .then(res => res.json())
            .then(stops => {
                stopsCache = stops;
                populate();
            })
            .catch(() => {
                select.innerHTML = '<option value="">Failed to load bus stops</option>';
            });
    }
}

function saveRoute(event) {
    event.preventDefault();
    const id = document.getElementById('route-id').value;
    const routeNumber = document.getElementById('route-number').value;
    const name = document.getElementById('route-name').value;
    const startStopId = parseInt(document.getElementById('route-start-stop').value);
    const endStopId = parseInt(document.getElementById('route-end-stop').value);

    if (!startStopId || !endStopId) {
        showToast('Please select start and end stops', 'error');
        return;
    }

    const payload = { routeNumber, name, startStopId, endStopId };
    const url = id ? `/api/routes/${id}` : '/api/routes';
    const method = id ? 'PUT' : 'POST';

    fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(async res => {
        const data = await res.json();
        if (res.ok) return data;
        throw new Error(data.message || 'Error saving route');
    })
    .then(() => {
        closeModal('route-modal');
        showToast(id ? 'Route updated successfully' : 'Route created successfully');
        refreshCaches();
        navigateTo('admin-routes');
    })
    .catch(err => showToast(err.message, 'error'));
}

function deleteRoute(id) {
    if (!confirm('Are you sure you want to delete this route?')) return;
    
    fetch(`/api/routes/${id}`, { method: 'DELETE' })
        .then(async res => {
            if (res.ok) {
                showToast('Route deleted successfully');
                refreshCaches();
                navigateTo('admin-routes');
            } else {
                const data = await res.json();
                throw new Error(data.message || 'Error deleting route');
            }
        })
        .catch(err => showToast(err.message, 'error'));
}

// 4. ML MODULE & CSV IMPORT
function renderAdminData(container) {
    container.innerHTML = `
        <div class="panel-grid">
            <div class="panel-card">
                <div class="panel-card-title">Upload Historical Passenger Occupancy Data (CSV)</div>
                <div id="drag-drop-zone" class="upload-container" onclick="triggerFileInput()">
                    <i data-lucide="upload-cloud" class="upload-icon"></i>
                    <h4>Drag & Drop CSV File here</h4>
                    <p>or click to browse your computer</p>
                    <span class="level-badge low-badge" style="font-weight:700;">CSV Schema Required</span>
                    <input type="file" id="csv-file-input" class="hidden" accept=".csv" onchange="handleFileSelected(event)">
                </div>
                <div id="file-info" class="hidden" style="margin-top: 1rem; text-align: center;">
                    <span id="selected-filename" style="font-weight:600;"></span>
                    <button class="btn-primary" onclick="uploadSelectedFile()" style="margin-left: 1rem;">Upload & Import</button>
                </div>
                <div class="suggestions-card" style="margin-top: 1.5rem; text-align:left;">
                    <h4 style="color: var(--primary);"><i data-lucide="info"></i> Expected CSV Headers</h4>
                    <p style="font-size:0.8rem; line-height: 1.4; color: var(--text-secondary);">
                        <code>bus_stop_id,date,time_of_day,weather,holiday,weekend,event,passenger_count</code><br><br>
                        <strong>Example row:</strong><br>
                        <code>1,2026-07-14,17,RAINY,0,0,1,85</code>
                    </p>
                </div>
            </div>

            <div class="panel-card">
                <div class="panel-card-title">Machine Learning Training</div>
                <p style="font-size:0.9rem; color:var(--text-secondary); margin-bottom: 1.5rem; line-height: 1.5;">
                    Train our predictive engine using Random Forest, Decision Tree, and Linear Regression. 
                    Training evaluates RMSE, MAE, R², and accuracy to help select the best fit model.
                </p>
                <div id="train-status-box" style="text-align:center; padding: 1.5rem; background-color: var(--bg-card); border-radius: var(--radius-md); border:1px solid var(--border-color); margin-bottom: 1.5rem;">
                    <span style="font-size:0.9rem; color:var(--text-secondary);">Current Status:</span><br>
                    <strong id="training-status-text" class="text-warning">Checking model...</strong>
                </div>
                <button class="btn-primary" onclick="trainMLModels()" style="width: 100%;">
                    <i data-lucide="cpu"></i>
                    <span>Run ML Model Training</span>
                </button>
            </div>
        </div>

        <div id="metrics-panel" class="panel-card hidden" style="margin-top: 1.5rem;">
            <div class="panel-card-title">ML Algorithms Performance Comparison</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:2rem;">
                <div>
                    <h4 style="margin-bottom:1rem; font-size:0.95rem; color:var(--text-secondary);">Accuracy Score (%) - Higher is Better</h4>
                    <div class="chart-container" style="height: 220px;">
                        <canvas id="chart-accuracy"></canvas>
                    </div>
                </div>
                <div>
                    <h4 style="margin-bottom:1rem; font-size:0.95rem; color:var(--text-secondary);">Mean Absolute Error (Passengers) - Lower is Better</h4>
                    <div class="chart-container" style="height: 220px;">
                        <canvas id="chart-error"></canvas>
                    </div>
                </div>
            </div>
        </div>

        <div class="panel-card" style="margin-top: 1.5rem;">
            <div class="panel-card-title">
                <span>Trained Historical Datasets (Latest 100 Records)</span>
                <span class="level-badge low-badge" id="historical-data-count">Loading...</span>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Record ID</th>
                            <th>Bus Stop</th>
                            <th>Date</th>
                            <th>Time of Day</th>
                            <th>Weather</th>
                            <th>Conditions</th>
                            <th>Passenger Count</th>
                            <th>Occupancy %</th>
                            <th>Occupancy Level</th>
                        </tr>
                    </thead>
                    <tbody id="historical-table-body">
                        <tr><td colspan="9" style="text-align:center;">Loading historical datasets...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Load initial ML info
    updateMLStatus();
    loadHistoricalDataList();
}

function loadHistoricalDataList() {
    fetch('/api/data/historical')
        .then(res => {
            if (!res.ok) throw new Error('Could not fetch historical data');
            return res.json();
        })
        .then(data => {
            const countBadge = document.getElementById('historical-data-count');
            if (countBadge) {
                countBadge.textContent = `${data.length} records shown`;
            }
            const body = document.getElementById('historical-table-body');
            if (!body) return;
            body.innerHTML = '';
            if (data.length === 0) {
                body.innerHTML = '<tr><td colspan="9" style="text-align:center;">No historical records found.</td></tr>';
                return;
            }
            data.forEach(hd => {
                const row = document.createElement('tr');
                
                // Conditions: Holiday, Weekend, Event
                const conds = [];
                if (hd.holiday) conds.push('Holiday');
                if (hd.weekend) conds.push('Weekend');
                if (hd.event) conds.push('Event');
                const conditionsStr = conds.length > 0 ? conds.join(', ') : 'None';
                
                row.innerHTML = `
                    <td><strong>#${hd.id}</strong></td>
                    <td>${hd.busStop ? hd.busStop.name : 'Unknown'}</td>
                    <td>${hd.date}</td>
                    <td>${formatHour(hd.timeOfDay)}</td>
                    <td><span class="level-badge medium-badge">${hd.weather}</span></td>
                    <td><small>${conditionsStr}</small></td>
                    <td><strong>${hd.passengerCount}</strong></td>
                    <td>${Math.round(hd.occupancyPercentage)}%</td>
                    <td>
                        <span class="level-badge ${hd.occupancyLevel.toLowerCase()}-badge">${hd.occupancyLevel}</span>
                    </td>
                `;
                body.appendChild(row);
            });
        })
        .catch(err => {
            const body = document.getElementById('historical-table-body');
            if (body) {
                body.innerHTML = `<tr><td colspan="9" style="text-align:center; color: var(--error);">${err.message}</td></tr>`;
            }
        });
}

function updateMLStatus() {
    fetch('/api/predictions/metrics')
        .then(res => res.json())
        .then(data => {
            const statusTxt = document.getElementById('training-status-text');
            const metricsPanel = document.getElementById('metrics-panel');
            
            if (data.trained) {
                statusTxt.textContent = 'Models Trained & Active';
                statusTxt.className = 'text-success';
                
                // Show Comparison graphs
                metricsPanel.classList.remove('hidden');
                setTimeout(() => { renderMetricsCharts(data.metrics); }, 50);
            } else {
                statusTxt.textContent = 'Untrained (Baseline active)';
                statusTxt.className = 'text-warning';
                metricsPanel.classList.add('hidden');
            }
        });
}

function renderMetricsCharts(metrics) {
    const algos = ["Random Forest", "Decision Tree", "Linear Regression"];
    
    // Accuracy
    const ctxAcc = document.getElementById('chart-accuracy').getContext('2d');
    const accData = algos.map(a => metrics[a].accuracy);
    
    charts.accuracy = new Chart(ctxAcc, {
        type: 'bar',
        data: {
            labels: algos,
            datasets: [{
                data: accData,
                backgroundColor: ['#6366F1', '#3B82F6', '#10B981'],
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { min: 0, max: 100, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94A3B8' } },
                x: { grid: { display: false }, ticks: { color: '#94A3B8' } }
            }
        }
    });

    // MAE Error
    const ctxErr = document.getElementById('chart-error').getContext('2d');
    const errData = algos.map(a => metrics[a].mae);
    
    charts.error = new Chart(ctxErr, {
        type: 'bar',
        data: {
            labels: algos,
            datasets: [{
                data: errData,
                backgroundColor: ['#EF4444', '#F59E0B', '#F59E0B'],
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94A3B8' } },
                x: { grid: { display: false }, ticks: { color: '#94A3B8' } }
            }
        }
    });
}

function triggerFileInput() {
    document.getElementById('csv-file-input').click();
}

let selectedFile = null;

function handleFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    selectedFile = file;
    document.getElementById('selected-filename').textContent = file.name;
    document.getElementById('file-info').classList.remove('hidden');
}

function uploadSelectedFile() {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);

    showToast('Uploading CSV file...');

    fetch('/api/data/upload', {
        method: 'POST',
        body: formData
    })
    .then(async res => {
        const data = await res.json();
        if (res.ok) return data;
        throw new Error(data.message || 'CSV upload failed');
    })
    .then(data => {
        showToast(`Imported ${data.recordsImported} records! Skipped: ${data.recordsSkipped}`);
        selectedFile = null;
        document.getElementById('file-info').classList.add('hidden');
        refreshCaches();
        navigateTo('admin-data');
    })
    .catch(err => showToast(err.message, 'error'));
}

function trainMLModels() {
    const statusTxt = document.getElementById('training-status-text');
    statusTxt.innerHTML = '<span class="spinner" style="width:20px; height:20px; display:inline-block;"></span> Training...';
    statusTxt.className = 'text-warning';

    fetch('/api/data/train', { method: 'POST' })
        .then(async res => {
            const data = await res.json();
            if (res.ok) return data;
            throw new Error(data.message || 'ML Training failed');
        })
        .then(data => {
            showToast(data.message);
            updateMLStatus();
        })
        .catch(err => {
            showToast(err.message, 'error');
            updateMLStatus();
        });
}

// 5. REPORTS & FEEDBACK
function renderAdminReports(container) {
    container.innerHTML = `
        <div class="panel-card" style="margin-bottom: 2rem; display: flex; align-items:center; justify-content: space-between;">
            <div>
                <h4 style="margin-bottom:0.25rem;">Generate Analytical Summary Report</h4>
                <p style="font-size:0.85rem; color:var(--text-secondary);">Download a normalized CSV report including stop capacities, routes list, predictions count, and feedback rating metrics.</p>
            </div>
            <a href="/api/data/report" class="btn-primary btn-header" target="_blank">
                <i data-lucide="download"></i>
                <span>Download Report (CSV)</span>
            </a>
        </div>

        <div class="panel-card">
            <div class="panel-card-title">Passenger Prediction Feedbacks</div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Feedback ID</th>
                            <th>Bus Stop</th>
                            <th>Prediction details</th>
                            <th>Reported Occupancy</th>
                            <th>Rating</th>
                            <th>Passenger Comments</th>
                        </tr>
                    </thead>
                    <tbody id="feedback-table-body">
                        <tr><td colspan="6" style="text-align:center;">Loading passenger feedbacks...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    fetch('/api/feedback')
        .then(res => res.json())
        .then(data => {
            const body = document.getElementById('feedback-table-body');
            body.innerHTML = '';
            if (data.length === 0) {
                body.innerHTML = '<tr><td colspan="6" style="text-align:center;">No feedback submitted by passengers yet.</td></tr>';
                return;
            }
            data.forEach(fb => {
                const p = fb.prediction;
                const stars = '★'.repeat(fb.rating) + '☆'.repeat(5 - fb.rating);
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><strong>#${fb.id}</strong></td>
                    <td>${p.busStop.name}</td>
                    <td>
                        <small>Pred. Count: ${Math.round(p.predictedPassengerCount)} pass. (${Math.round(p.predictedOccupancyPercentage)}% - ${p.predictedOccupancyLevel})</small>
                    </td>
                    <td>
                        <span class="level-badge ${fb.actualOccupancyLevel.toLowerCase()}-badge">${fb.actualOccupancyLevel}</span>
                    </td>
                    <td><strong style="color:#F59E0B; letter-spacing: 1px;">${stars}</strong></td>
                    <td><em>"${fb.comments || 'No comments'}"</em></td>
                `;
                body.appendChild(row);
            });
        });
}

// ================= PASSENGER PORTAL =================

// 1. PASSENGER DASHBOARD (Comprehensive Overview)
function renderPassengerDashboard(container) {
    container.innerHTML = `
        <!-- Passenger KPI Grid -->
        <div class="grid-stats">
            <div class="stat-card clickable-stat-card" onclick="openStatModal('records')" title="Click to view network passenger load details">
                <div class="stat-details">
                    <span class="stat-label">Average Passengers</span>
                    <span id="pass-stat-avg-passengers" class="stat-value">-</span>
                    <span class="stat-card-hint">View Details &rarr;</span>
                </div>
                <div class="stat-icon-wrapper"><i data-lucide="users"></i></div>
            </div>
            <div class="stat-card clickable-stat-card" onclick="openStatModal('records')" title="Click to view peak hours breakdown">
                <div class="stat-details">
                    <span class="stat-label">Top Peak Hours</span>
                    <span id="pass-stat-peak-hours" class="stat-value" style="font-size: 1.1rem; color: var(--warning);">-</span>
                    <span class="stat-card-hint">View Details &rarr;</span>
                </div>
                <div class="stat-icon-wrapper"><i data-lucide="clock"></i></div>
            </div>
            <div class="stat-card clickable-stat-card" onclick="openStatModal('busStops')" title="Click to view all active bus stops">
                <div class="stat-details">
                    <span class="stat-label">Total Active Stops</span>
                    <span id="pass-stat-stops" class="stat-value">-</span>
                    <span class="stat-card-hint">View Details &rarr;</span>
                </div>
                <div class="stat-icon-wrapper"><i data-lucide="map-pin"></i></div>
            </div>
            <div class="stat-card clickable-stat-card" onclick="openStatModal('routes')" title="Click to view routes directory">
                <div class="stat-details">
                    <span class="stat-label">Active Routes & Buses</span>
                    <span id="pass-stat-routes" class="stat-value">-</span>
                    <span class="stat-card-hint">View Details &rarr;</span>
                </div>
                <div class="stat-icon-wrapper"><i data-lucide="bus"></i></div>
            </div>
        </div>

        <!-- Occupancy Trend Graphs & Peak Hours Table -->
        <div class="panel-grid" style="margin-top: 1.5rem;">
            <div class="panel-card">
                <div class="panel-card-title">Hourly Occupancy Trend (Average Passengers)</div>
                <div class="chart-container">
                    <canvas id="chart-pass-hourly"></canvas>
                </div>
            </div>
            <div class="panel-card">
                <div class="panel-card-title">Rush Hours Congestion Audit</div>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Hour of Day</th>
                                <th>Average Passengers</th>
                            </tr>
                        </thead>
                        <tbody id="pass-peak-hours-table-body">
                            <tr><td colspan="2" style="text-align:center;">Loading peak hours...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Interactive Map & Bus Stop Search -->
        <div class="panel-card" style="margin-top: 1.5rem;">
            <div class="panel-card-title">
                <span>Interactive Bus Stops Map & Search</span>
                <button class="btn-primary" onclick="getUserGPSLocation()" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">
                    <i data-lucide="crosshair"></i>
                    <span>My Location</span>
                </button>
            </div>
            <div style="display:flex; gap:1rem; margin-bottom:1rem; margin-top: 0.5rem;">
                <div class="input-wrapper" style="flex:1;">
                    <i data-lucide="search" class="input-icon"></i>
                    <input type="text" id="pass-dash-search-input" placeholder="Search bus stops by name..." oninput="filterPassDashStops()" style="padding-left:2.75rem;">
                </div>
            </div>
            <div id="pass-dash-map" style="height: 320px; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 1rem; z-index: 1;"></div>
            
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Stop ID</th>
                            <th>Stop Name</th>
                            <th>Coordinates</th>
                            <th>Capacity</th>
                        </tr>
                    </thead>
                    <tbody id="pass-dash-stops-table-body">
                        <tr><td colspan="4" style="text-align:center;">Loading stops...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Active Routes & Buses Grid -->
        <div class="panel-card" style="margin-top: 1.5rem;">
            <div class="panel-card-title">Active Routes & Operating Buses Overview</div>
            <div id="pass-dash-routes-container" class="routes-grid">
                <p style="color:var(--text-secondary);">Loading routes & buses...</p>
            </div>
        </div>

        <!-- Integrated Trip Occupancy Predictor -->
        <div class="panel-card" style="margin-top: 1.5rem;">
            <div class="panel-card-title">Quick Trip Occupancy Predictor</div>
            <div class="predict-grid" style="margin-top:1rem;">
                <div>
                    <form id="pass-dash-predict-form" onsubmit="runPassengerPrediction(event)">
                        <div class="form-group">
                            <label for="pred-stop">Select Source Bus Stop</label>
                            <div class="input-wrapper">
                                <i data-lucide="map-pin" class="input-icon"></i>
                                <select id="pred-stop" required onchange="handlePredictStopChange()"></select>
                            </div>
                        </div>
                        <div class="form-group" style="margin-top: 0.75rem;">
                            <label>Bus Stop Location Preview</label>
                            <div id="predict-stop-map" style="height: 160px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); z-index: 1;"></div>
                        </div>
                        <div class="form-group">
                            <label for="pred-date">Departure Date</label>
                            <div class="input-wrapper">
                                <i data-lucide="calendar" class="input-icon"></i>
                                <input type="date" id="pred-date" required>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="pred-hour">Estimated Hour of Travel</label>
                            <div class="input-wrapper">
                                <i data-lucide="clock" class="input-icon"></i>
                                <select id="pred-hour" required>
                                    <option value="8">08:00 AM (Morning Rush)</option>
                                    <option value="9">09:00 AM</option>
                                    <option value="10">10:00 AM</option>
                                    <option value="11">11:00 AM</option>
                                    <option value="12">12:00 PM (Noon)</option>
                                    <option value="13">01:00 PM</option>
                                    <option value="14">02:00 PM</option>
                                    <option value="15">03:00 PM</option>
                                    <option value="16">04:00 PM</option>
                                    <option value="17" selected>05:00 PM (Evening Rush)</option>
                                    <option value="18">06:00 PM</option>
                                    <option value="19">07:00 PM</option>
                                    <option value="20">08:00 PM</option>
                                    <option value="21">09:00 PM</option>
                                    <option value="22">10:00 PM</option>
                                    <option value="23">11:00 PM</option>
                                    <option value="0">12:00 AM (Midnight)</option>
                                    <option value="6">06:00 AM</option>
                                    <option value="7">07:00 AM</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="pred-weather">Weather Conditions</label>
                            <div class="input-wrapper">
                                <i data-lucide="cloud" class="input-icon"></i>
                                <select id="pred-weather" required>
                                    <option value="SUNNY">Sunny / Clear</option>
                                    <option value="CLOUDY">Cloudy</option>
                                    <option value="RAINY">Rainy</option>
                                    <option value="SNOWY">Heavy Weather / Congestion</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group" style="flex-direction:row; justify-content:space-between; align-items:center; margin-top:0.75rem;">
                            <span style="font-size:0.85rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Holiday Event?</span>
                            <input type="checkbox" id="pred-holiday" style="width:20px; height:20px; accent-color:var(--primary);" checked>
                        </div>
                        <div class="form-group" style="flex-direction:row; justify-content:space-between; align-items:center; margin-top:0.5rem;">
                            <span style="font-size:0.85rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Special Nearby Event?</span>
                            <input type="checkbox" id="pred-event" style="width:20px; height:20px; accent-color:var(--primary);">
                        </div>
                        
                        <button type="submit" class="btn-primary" style="width:100%; margin-top:1.25rem; padding: 0.8rem;">
                            <i data-lucide="trending-up"></i>
                            <span>Predict Occupancy</span>
                        </button>
                    </form>
                </div>

                <div id="passenger-result-container" class="prediction-result-panel">
                    <div class="empty-prediction-state">
                        <i data-lucide="bus"></i>
                        <h3>Predict Trip Occupancy</h3>
                        <p>Configure trip details above to compute real-time crowd estimates.</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    lucide.createIcons();

    // Initialize date
    const dInput = document.getElementById('pred-date');
    if (dInput) dInput.valueAsDate = new Date();

    // Fetch stats
    fetch('/api/data/stats')
        .then(res => res.json())
        .then(stats => {
            if (document.getElementById('pass-stat-avg-passengers')) {
                document.getElementById('pass-stat-avg-passengers').textContent = `${stats.averagePassengers || 0} / stop`;
            }
            if (document.getElementById('pass-stat-stops')) {
                document.getElementById('pass-stat-stops').textContent = stats.totalBusStops || 0;
            }
            if (document.getElementById('pass-stat-routes')) {
                document.getElementById('pass-stat-routes').textContent = stats.totalRoutes || 0;
            }

            // Top peak hours stat text
            if (stats.peakHours && stats.peakHours.length > 0) {
                const topH = stats.peakHours[0];
                if (document.getElementById('pass-stat-peak-hours')) {
                    document.getElementById('pass-stat-peak-hours').textContent = formatHour(topH.hour);
                }

                const body = document.getElementById('pass-peak-hours-table-body');
                if (body) {
                    body.innerHTML = '';
                    stats.peakHours.forEach(h => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td><strong>${formatHour(h.hour)}</strong></td>
                            <td><span class="level-badge medium-badge">${h.averagePassengers} pass.</span></td>
                        `;
                        body.appendChild(row);
                    });
                }
            }

            // Hourly Chart
            renderPassHourlyChart(stats.hourlyTrends);
        });

    // Auto-detect user high-accuracy GPS location for live distances
    if (navigator.geolocation) {
        getUserGPSLocation();
    }

    // Fetch stops & populate dropdowns, table, and Google Map
    fetch('/api/stops')
        .then(res => res.json())
        .then(stops => {
            stopsCache = stops;
            renderPassDashStopsList(stops);
            loadStopsDropdown('pred-stop');
            setTimeout(() => {
                initPassDashMap();
            }, 100);
        });
    
    // Fetch routes for grid
    fetch('/api/routes')
        .then(res => res.json())
        .then(routes => {
            routesCache = routes;
            renderPassDashRoutesGrid(routes, 'pass-dash-routes-container');
        });
}

function renderPassengerRoutes(container) {
    container.innerHTML = `
        <div class="panel-card">
            <div class="panel-card-title">
                <span>Active Bus Routes & Operating Buses</span>
                <span class="level-badge low-badge" id="routes-count-badge">Loading...</span>
            </div>
            <div class="routes-grid" id="routes-grid-container">
                <p style="color:var(--text-secondary);">Loading routes...</p>
            </div>
        </div>
    `;

    fetch('/api/routes')
        .then(res => res.json())
        .then(routes => {
            routesCache = routes;
            const badge = document.getElementById('routes-count-badge');
            if (badge) badge.textContent = `${routes.length} Active Routes`;
            renderPassDashRoutesGrid(routes, 'routes-grid-container');
        });
}

function renderPassDashRoutesGrid(routes, containerId = 'pass-dash-routes-container') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    if (!routes || routes.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary);">No active routes found.</p>';
        return;
    }
    routes.forEach(r => {
        const card = document.createElement('div');
        card.className = 'route-card';
        card.innerHTML = `
            <div class="route-badge-code">Bus Route #${r.routeNumber}</div>
            <h3 style="font-size:1.1rem; font-weight:700; margin-bottom:0.5rem; color:var(--text-primary);">${r.routeName}</h3>
            <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.25rem;">
                <i data-lucide="map-pin" style="width:14px; height:14px; color:var(--primary); display:inline-block; vertical-align:middle; margin-right:4px;"></i>
                Start Stop: <strong>${r.startStop ? r.startStop.name : 'Terminal A'}</strong>
            </p>
            <p style="font-size:0.85rem; color:var(--text-secondary);">
                <i data-lucide="navigation" style="width:14px; height:14px; color:var(--success); display:inline-block; vertical-align:middle; margin-right:4px;"></i>
                Destination: <strong>${r.endStop ? r.endStop.name : 'Terminal B'}</strong>
            </p>
        `;
        container.appendChild(card);
    });
    lucide.createIcons();
}

function renderPassHourlyChart(hourlyTrends) {
    const canvas = document.getElementById('chart-pass-hourly');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const labels = hourlyTrends.map(t => formatHour(t.hour));
    const data = hourlyTrends.map(t => t.averagePassengers);

    charts.passHourly = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Average Passenger Count',
                data: data,
                borderColor: '#10B981',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94A3B8' } },
                x: { grid: { display: false }, ticks: { color: '#94A3B8' } }
            }
        }
    });
}

let passDashMap = null;
function initPassDashMap() {
    const mapEl = document.getElementById('pass-dash-map');
    if (!mapEl) return;
    if (passDashMap) {
        passDashMap.remove();
        passDashMap = null;
    }
    const centerLat = userGPSLocation ? userGPSLocation.lat : 13.0827;
    const centerLng = userGPSLocation ? userGPSLocation.lng : 80.2707;
    
    passDashMap = L.map('pass-dash-map').setView([centerLat, centerLng], 12);
    addGoogleMapsTileLayer(passDashMap, true);
    
    stopsCache.forEach(stop => {
        L.marker([stop.latitude, stop.longitude])
            .addTo(passDashMap)
            .bindPopup(`<h4>${stop.name}</h4><p>Capacity: ${stop.capacity} passengers</p>`);
    });
    
    setTimeout(() => { passDashMap.invalidateSize(); }, 200);
}

function renderPassDashStopsList(stops) {
    const body = document.getElementById('pass-dash-stops-table-body');
    if (!body) return;
    body.innerHTML = '';
    if (!stops || stops.length === 0) {
        body.innerHTML = '<tr><td colspan="5" style="text-align:center;">No matching bus stops found.</td></tr>';
        return;
    }
    
    let stopsWithDistance = stops.map(stop => {
        let distance = null;
        if (userGPSLocation) {
            distance = calculateDistance(userGPSLocation.lat, userGPSLocation.lng, stop.latitude, stop.longitude);
        }
        return { ...stop, distance };
    });

    if (userGPSLocation) {
        stopsWithDistance.sort((a, b) => (a.distance !== null ? a.distance : 9999) - (b.distance !== null ? b.distance : 9999));
    }

    stopsWithDistance.forEach(stop => {
        const row = document.createElement('tr');
        const distBadge = stop.distance !== null 
            ? `<span class="level-badge low-badge" style="font-weight:700;">${formatDistance(stop.distance)}</span>` 
            : '<span style="color:var(--text-muted); font-size:0.8rem;">Detecting distance...</span>';
        row.innerHTML = `
            <td>#${stop.id}</td>
            <td><strong>${escapeHtml(stop.name)}</strong></td>
            <td><span style="font-size:0.8rem; color:var(--text-muted);">${stop.latitude.toFixed(4)}, ${stop.longitude.toFixed(4)}</span></td>
            <td>${distBadge}</td>
            <td><span class="level-badge medium-badge">${stop.capacity} seats</span></td>
        `;
        body.appendChild(row);
    });
}

function filterPassDashStops() {
    const input = document.getElementById('pass-dash-search-input');
    if (!input) return;
    const query = input.value.toLowerCase();
    const filtered = stopsCache.filter(stop => stop.name.toLowerCase().includes(query));
    renderPassDashStopsList(filtered);
}

// 2. PREDICT OCCUPANCY
function renderPassengerPredict(container) {
    container.innerHTML = `
        <div class="predict-grid">
            <div class="panel-card">
                <div class="panel-card-title">Configure Trip Details</div>
                <form id="passenger-predict-form" onsubmit="runPassengerPrediction(event)">
                    <div class="form-group">
                        <label for="pred-stop">Source Bus Stop</label>
                        <div class="input-wrapper">
                            <i data-lucide="map-pin" class="input-icon"></i>
                            <select id="pred-stop" required onchange="handlePredictStopChange()"></select>
                        </div>
                    </div>
                    <div class="form-group" style="margin-top: 1rem;">
                        <label>Bus Stop Location</label>
                        <div id="predict-stop-map" style="height: 180px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); z-index: 1;"></div>
                    </div>
                    <div class="form-group">
                        <label for="pred-date">Departure Date</label>
                        <div class="input-wrapper">
                            <i data-lucide="calendar" class="input-icon"></i>
                            <input type="date" id="pred-date" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="pred-hour">Estimated Hour of Travel</label>
                        <div class="input-wrapper">
                            <i data-lucide="clock" class="input-icon"></i>
                            <select id="pred-hour" required>
                                <option value="8">08:00 AM</option>
                                <option value="9">09:00 AM</option>
                                <option value="10">10:00 AM</option>
                                <option value="11">11:00 AM</option>
                                <option value="12">12:00 PM (Noon)</option>
                                <option value="13">01:00 PM</option>
                                <option value="14">02:00 PM</option>
                                <option value="15">03:00 PM</option>
                                <option value="16">04:00 PM</option>
                                <option value="17">05:00 PM (Peak Hour)</option>
                                <option value="18">06:00 PM</option>
                                <option value="19">07:00 PM</option>
                                <option value="20">08:00 PM</option>
                                <option value="21">09:00 PM</option>
                                <option value="22">10:00 PM</option>
                                <option value="23">11:00 PM</option>
                                <option value="0">12:00 AM (Midnight)</option>
                                <option value="6">06:00 AM</option>
                                <option value="7">07:00 AM</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="pred-weather">Expected Weather</label>
                        <div class="input-wrapper">
                            <i data-lucide="cloud" class="input-icon"></i>
                            <select id="pred-weather" required>
                                <option value="SUNNY">Sunny / Clear</option>
                                <option value="CLOUDY">Cloudy</option>
                                <option value="RAINY">Rainy</option>
                                <option value="SNOWY">Snowy / Congestion</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group" style="flex-direction:row; justify-content:space-between; align-items:center; margin-top:1rem;">
                        <span style="font-size:0.85rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Holiday Event?</span>
                        <input type="checkbox" id="pred-holiday" style="width:20px; height:20px; accent-color:var(--primary);">
                    </div>
                    <div class="form-group" style="flex-direction:row; justify-content:space-between; align-items:center; margin-top:0.5rem;">
                        <span style="font-size:0.85rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Special Nearby Event?</span>
                        <input type="checkbox" id="pred-event" style="width:20px; height:20px; accent-color:var(--primary);">
                    </div>
                    
                    <button type="submit" class="btn-primary" style="width:100%; margin-top:1.5rem; padding: 0.8rem;">
                        <i data-lucide="trending-up"></i>
                        <span>Check AI Prediction</span>
                    </button>
                </form>
            </div>

            <!-- Predictions Results Display -->
            <div id="passenger-result-container" class="prediction-result-panel">
                <div class="empty-prediction-state">
                    <i data-lucide="bus"></i>
                    <h3>BusFlow Occupancy Output</h3>
                    <p>Configure your trip coordinates & date parameters to execute the AI prediction model.</p>
                </div>
            </div>
        </div>
    `;

    // Set default date to today
    document.getElementById('pred-date').valueAsDate = new Date();
    // Fill Stops cache dropdown
    loadStopsDropdown('pred-stop');
    
    // Initialize map on first selected stop
    setTimeout(() => {
        handlePredictStopChange();
    }, 100);
}

let predictStopMap = null;
let predictStopMarker = null;

function initPredictStopMap(lat, lng, stopName) {
    const mapDiv = document.getElementById('predict-stop-map');
    if (!mapDiv) return;

    if (predictStopMap) {
        try {
            predictStopMap.remove();
        } catch (e) {}
        predictStopMap = null;
        predictStopMarker = null;
    }
    
    predictStopMap = L.map('predict-stop-map').setView([lat, lng], 15);
    addGoogleMapsTileLayer(predictStopMap, false);
    
    predictStopMarker = L.marker([lat, lng]).addTo(predictStopMap);
    if (stopName) {
        predictStopMarker.bindPopup(`<b>${escapeHtml(stopName)}</b>`).openPopup();
    }
    
    setTimeout(() => { 
        if (predictStopMap) predictStopMap.invalidateSize(); 
    }, 150);
}

function handlePredictStopChange() {
    const select = document.getElementById('pred-stop');
    if (!select || !select.value) return;
    const stopId = parseInt(select.value);
    const stop = stopsCache.find(s => s.id === stopId);
    if (stop) {
        initPredictStopMap(stop.latitude, stop.longitude, stop.name);
    }
}

function runPassengerPrediction(event) {
    event.preventDefault();
    const busStopId = parseInt(document.getElementById('pred-stop').value);
    const date = document.getElementById('pred-date').value;
    const timeOfDay = parseInt(document.getElementById('pred-hour').value);
    const weather = document.getElementById('pred-weather').value;
    const holiday = document.getElementById('pred-holiday').checked;
    const eventNearby = document.getElementById('pred-event').checked;

    const resultPanel = document.getElementById('passenger-result-container');
    resultPanel.innerHTML = `
        <div class="spinner-wrapper">
            <div class="spinner"></div>
            <h3>Evaluating Occupancy Levels...</h3>
        </div>
    `;

    fetch('/api/predictions/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ busStopId, date, timeOfDay, weather, holiday, event: eventNearby })
    })
    .then(async res => {
        const data = await res.json();
        if (res.ok) return data;
        throw new Error(data.message || 'Prediction failed');
    })
    .then(pred => {
        const ringClass = pred.occupancyLevel === 'LOW' ? 'low-occupancy' : (pred.occupancyLevel === 'MEDIUM' ? 'medium-occupancy' : 'high-occupancy');
        
        let suggestionsHTML = '<p style="font-size:0.85rem; color:var(--text-muted);">No less crowded times within ±2 hours.</p>';
        if (pred.suggestions && pred.suggestions.length > 0) {
            suggestionsHTML = `
                <div class="suggestion-list">
                    ${pred.suggestions.map(s => `
                        <div class="suggestion-item">
                            <span>Travel at <strong>${formatHour(s.timeOfDay)}</strong></span>
                            <span class="level-badge ${s.occupancyLevel.toLowerCase()}-badge" style="font-size: 0.7rem; padding: 0.2rem 0.5rem;">
                                ${s.occupancyPercentage}% - ${s.occupancyLevel}
                            </span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        resultPanel.innerHTML = `
            <div class="prediction-active-state">
                <div class="occupancy-ring ${ringClass}">
                    <span class="percentage">${pred.occupancyPercentage}%</span>
                    <span class="label">${pred.occupancyLevel}</span>
                </div>
                
                <h3 style="margin-bottom:0.5rem;">${pred.busStopName} stop</h3>
                <p style="font-size:0.9rem; color:var(--text-secondary); margin-bottom: 1.5rem;">
                    Expected Passenger Queue: <strong>${pred.expectedCount} passengers</strong> (Cap. ${pred.capacity})
                </p>

                <div class="results-stats-row">
                    <div class="result-metric-card">
                        <div class="num text-success">${pred.confidenceScore}%</div>
                        <div class="lbl">Confidence Score</div>
                    </div>
                    <div class="result-metric-card">
                        <div class="num">${pred.occupancyLevel}</div>
                        <div class="lbl">Occupancy Rating</div>
                    </div>
                </div>

                <div class="suggestions-card">
                    <h4><i data-lucide="clock" style="width:16px; height:16px; color:var(--primary);"></i> Suggested Crowdfree Times</h4>
                    ${suggestionsHTML}
                </div>

                <button class="btn-secondary" onclick="openFeedbackModal(${pred.id})" style="width:100%;">
                    <i data-lucide="message-square"></i>
                    <span>Leave Live Feedback</span>
                </button>
            </div>
        `;
        lucide.createIcons();
    })
    .catch(err => {
        showToast(err.message, 'error');
        navigateTo('passenger-predict');
    });
}

function openFeedbackModal(predictionId) {
    document.getElementById('feedback-prediction-id').value = predictionId;
    document.getElementById('feedback-comments').value = '';
    // Uncheck radio stars and buttons
    document.querySelectorAll('.star-rating input').forEach(input => input.checked = false);
    document.querySelectorAll('input[name="actual-occupancy"]').forEach(input => input.checked = false);
    showModal('feedback-modal');
}

function saveFeedback(event) {
    event.preventDefault();
    const predictionId = parseInt(document.getElementById('feedback-prediction-id').value);
    
    // Find rating value
    let rating = 5;
    document.querySelectorAll('.star-rating input').forEach(input => {
        if (input.checked) rating = parseInt(input.value);
    });

    // Find actual occupancy level value
    let actualOccupancyLevel = "LOW";
    document.querySelectorAll('input[name="actual-occupancy"]').forEach(input => {
        if (input.checked) actualOccupancyLevel = input.value;
    });

    const comments = document.getElementById('feedback-comments').value;

    fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictionId, actualOccupancyLevel, rating, comments })
    })
    .then(async res => {
        if (res.ok) {
            closeModal('feedback-modal');
            showToast('Feedback submitted successfully! Thank you.');
        } else {
            const data = await res.json();
            throw new Error(data.message || 'Error submitting feedback');
        }
    })
    .catch(err => showToast(err.message, 'error'));
}

// 2. SEARCH NEARBY BUS STOPS
function renderPassengerStops(container) {
    container.innerHTML = `
        <div class="panel-card" style="margin-bottom: 1.5rem;">
            <div class="panel-card-title">Nearby Bus Stops Map</div>
            <div id="nearby-stops-map" style="height: 380px; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 1rem; z-index: 1;"></div>
            <div style="display:flex; justify-content: flex-end;">
                <button class="btn-primary" onclick="getUserGPSLocation()" style="display:inline-flex; align-items:center; gap:0.5rem; padding: 0.6rem 1.2rem;">
                    <i data-lucide="crosshair"></i>
                    <span>Use My GPS Location</span>
                </button>
            </div>
        </div>

        <div class="panel-card">
            <div class="panel-card-title">Nearby Bus Stops Grid</div>
            <div style="display:flex; gap:1rem; margin-bottom:1.5rem;">
                <div class="input-wrapper" style="flex:1;">
                    <i data-lucide="search" class="input-icon"></i>
                    <input type="text" id="stop-search-input" placeholder="Search bus stops by name..." oninput="filterPassengerStops()" style="padding-left:2.75rem;">
                </div>
            </div>
            
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Stop ID</th>
                            <th>Stop Name</th>
                            <th>Coordinates</th>
                            <th>Distance</th>
                            <th>Capacity</th>
                        </tr>
                    </thead>
                    <tbody id="passenger-stops-table-body">
                        <tr><td colspan="5" style="text-align:center;">Loading stops...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    lucide.createIcons();

    if (stopsCache && stopsCache.length > 0) {
        renderPassengerStopsList(stopsCache);
        initNearbyStopsMap();
    } else {
        fetch('/api/stops')
            .then(res => res.json())
            .then(stops => {
                stopsCache = stops;
                renderPassengerStopsList(stopsCache);
                initNearbyStopsMap();
            })
            .catch(() => {
                const body = document.getElementById('passenger-stops-table-body');
                if (body) body.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--danger);">Failed to load bus stops</td></tr>';
            });
    }
}

let nearbyStopsMap = null;
let userGPSLocation = null;
let nearbyMarkers = [];
let userGpsMarker = null;

function initNearbyStopsMap() {
    const mapEl = document.getElementById('nearby-stops-map');
    if (!mapEl) return;

    if (nearbyStopsMap) {
        try {
            nearbyStopsMap.remove();
        } catch (e) {}
        nearbyStopsMap = null;
    }
    
    let centerLat = userGPSLocation ? userGPSLocation.lat : (stopsCache && stopsCache.length > 0 ? stopsCache[0].latitude : 13.0827);
    let centerLng = userGPSLocation ? userGPSLocation.lng : (stopsCache && stopsCache.length > 0 ? stopsCache[0].longitude : 80.2707);
    
    nearbyStopsMap = L.map('nearby-stops-map').setView([centerLat, centerLng], 12);
    addGoogleMapsTileLayer(nearbyStopsMap, true);
    
    nearbyMarkers = [];
    if (stopsCache && stopsCache.length > 0) {
        stopsCache.forEach(stop => {
            if (stop.latitude && stop.longitude) {
                const marker = L.marker([stop.latitude, stop.longitude])
                    .addTo(nearbyStopsMap)
                    .bindPopup(`<h4>${escapeHtml(stop.name)}</h4><p>Capacity: ${stop.capacity} passengers</p>`);
                nearbyMarkers.push({ id: stop.id, marker });
            }
        });
    }
    
    if (userGPSLocation) {
        addUserGpsMarker(userGPSLocation.lat, userGPSLocation.lng);
    }
    
    setTimeout(() => { 
        if (nearbyStopsMap) nearbyStopsMap.invalidateSize(); 
    }, 200);
}

function addUserGpsMarker(lat, lng) {
    if (userGpsMarker) {
        userGpsMarker.setLatLng([lat, lng]);
    } else {
        const gpsIcon = L.divIcon({
            className: 'custom-div-icon',
            html: '<div class="user-gps-dot"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
        userGpsMarker = L.marker([lat, lng], { icon: gpsIcon }).addTo(nearbyStopsMap);
        userGpsMarker.bindPopup("<b>Your Current Location</b>").openPopup();
    }
}
function formatDistance(distKm) {
    if (distKm === null || distKm === undefined) return 'N/A';
    if (distKm < 1.0) {
        const meters = Math.round(distKm * 1000);
        return `📍 ${meters} m away`;
    }
    return `📍 ${distKm.toFixed(2)} km away`;
}

function updateAllMapsWithLocation(lat, lng) {
    userGPSLocation = { lat, lng };

    // Update Nearby Stops Map
    if (nearbyStopsMap) {
        addUserGpsMarker(lat, lng);
        nearbyStopsMap.setView([lat, lng], 14);
    }
    // Update Passenger Dashboard Map
    if (passDashMap) {
        passDashMap.setView([lat, lng], 14);
        addUserGpsMarkerOnMap(passDashMap, lat, lng);
    }

    // Re-render lists with updated distance metrics & closest stop sorting
    if (stopsCache && stopsCache.length > 0) {
        renderPassengerStopsList(stopsCache);
        renderPassDashStopsList(stopsCache);
    }
}

let passDashGpsMarker = null;
function addUserGpsMarkerOnMap(targetMap, lat, lng) {
    if (!targetMap) return;
    if (passDashGpsMarker) {
        passDashGpsMarker.setLatLng([lat, lng]);
    } else {
        const gpsIcon = L.divIcon({
            className: 'custom-div-icon',
            html: '<div class="user-gps-dot"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
        passDashGpsMarker = L.marker([lat, lng], { icon: gpsIcon }).addTo(targetMap);
        passDashGpsMarker.bindPopup("<b>📍 Your Accurate GPS Location</b>").openPopup();
    }
}

function getUserGPSLocation() {
    if (!navigator.geolocation) {
        showToast("Geolocation is not supported by your browser.", "error");
        return;
    }
    showToast("Detecting your exact GPS location...", "info");
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            showToast(`📍 Accurate GPS Location detected! (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
            updateAllMapsWithLocation(lat, lng);
        },
        (error) => {
            showToast(`GPS Error (${error.code}): ${error.message}. Please allow location access.`, "error");
            if (!userGPSLocation) {
                userGPSLocation = { lat: 13.0827, lng: 80.2707 };
            }
            updateAllMapsWithLocation(userGPSLocation.lat, userGPSLocation.lng);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in KM
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function renderPassengerStopsList(stops) {
    const body = document.getElementById('passenger-stops-table-body');
    if (!body) return;
    
    let stopsWithDistance = stops.map(stop => {
        let distance = null;
        if (userGPSLocation) {
            distance = calculateDistance(userGPSLocation.lat, userGPSLocation.lng, stop.latitude, stop.longitude);
        }
        return { ...stop, distance };
    });
    
    if (userGPSLocation) {
        stopsWithDistance.sort((a, b) => (a.distance !== null ? a.distance : 9999) - (b.distance !== null ? b.distance : 9999));
    }
    
    body.innerHTML = '';
    if (stopsWithDistance.length === 0) {
        body.innerHTML = '<tr><td colspan="5" style="text-align:center;">No matching bus stops found.</td></tr>';
        return;
    }
    
    stopsWithDistance.forEach(stop => {
        const row = document.createElement('tr');
        const distBadge = stop.distance !== null 
            ? `<span class="level-badge low-badge" style="font-weight:700;">${formatDistance(stop.distance)}</span>` 
            : '<span style="color:var(--text-muted); font-size:0.8rem;">Detecting distance...</span>';
        row.innerHTML = `
            <td><strong>#${stop.id}</strong></td>
            <td><strong>${escapeHtml(stop.name)}</strong></td>
            <td><span style="font-size:0.8rem; color:var(--text-muted);">${stop.latitude.toFixed(5)}, ${stop.longitude.toFixed(5)}</span></td>
            <td>${distBadge}</td>
            <td><span class="level-badge medium-badge">${stop.capacity} seats</span></td>
        `;
        body.appendChild(row);
    });
}

function filterPassengerStops() {
    const query = document.getElementById('stop-search-input').value.toLowerCase();
    const filtered = stopsCache.filter(stop => stop.name.toLowerCase().includes(query));
    renderPassengerStopsList(filtered);
}

// ================= FORMAT HELPER UTILS =================
function formatHour(hour) {
    if (hour === 0) return '12:00 AM (Midnight)';
    if (hour === 12) return '12:00 PM (Noon)';
    return hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`;
}
