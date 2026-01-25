import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, get } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";

const appId = typeof __app_id !== 'undefined' ? __app_id : 'floor-attendance-system';

const firebaseConfig = {
    apiKey: "AIzaSyBYTnrnXjBCvlfEu2nDc0IVIZ_rtzlix9s",
    authDomain: "floor-attendance-system.firebaseapp.com",
    databaseURL: "https://floor-attendance-system-default-rtdb.firebaseio.com",
    projectId: "floor-attendance-system",
    storageBucket: "floor-attendance-system.firebasestorage.app",
    messagingSenderId: "721240132639",
    appId: "1:721240132639:web:629b90ae09d3fcbcc1d92a",
    measurementId: "G-RZ8YDY6F4S"
};

let db;
let userId = 'system';
let userEmail = 'system@attendance.local';
let currentViewDate = getTodayDateKey();
let isViewingToday = true;
let lastNotifiedTotal = 0;
let hasShownInputWindowReminder = false;
let sentNotifications = {
    reminder1: false,
    reminder2: false,
    reminder3: false
};
let activityLog = [];
let displayedCounts = {};

const ALLOW_TIME_LIMIT = true;
const ALLOWED_START_MINUTES = (18 * 60) + 30;
const ALLOWED_END_MINUTES = 22 * 60;
const SECOND_REMINDER_MINUTES = ALLOWED_END_MINUTES - 60;
const FINAL_REMINDER_MINUTES = ALLOWED_END_MINUTES - 15;

const ROOMS = Array.from({ length: 16 }, (_, i) => 402 + i);
const MAX_CAPACITY = ROOMS.length * 6;

let soundEnabled = localStorage.getItem('fas_sound') !== 'false';
let audioContext;

try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
} catch (e) {
    console.warn('AudioContext not supported:', e);
}

function playSound(type) {
    if (!soundEnabled || !audioContext) return;
    
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        switch(type) {
            case 'click':
                oscillator.frequency.value = 800;
                gainNode.gain.value = 0.1;
                oscillator.type = 'sine';
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.05);
                break;
            case 'success':
                oscillator.frequency.value = 523.25;
                gainNode.gain.value = 0.15;
                oscillator.type = 'sine';
                oscillator.start();
                setTimeout(() => { oscillator.frequency.value = 659.25; }, 100);
                setTimeout(() => { oscillator.frequency.value = 783.99; }, 200);
                oscillator.stop(audioContext.currentTime + 0.3);
                break;
            case 'celebration':
                oscillator.frequency.value = 523.25;
                gainNode.gain.value = 0.2;
                oscillator.type = 'triangle';
                oscillator.start();
                setTimeout(() => { oscillator.frequency.value = 659.25; }, 100);
                setTimeout(() => { oscillator.frequency.value = 783.99; }, 200);
                setTimeout(() => { oscillator.frequency.value = 1046.50; }, 300);
                oscillator.stop(audioContext.currentTime + 0.5);
                break;
            case 'warning':
                oscillator.frequency.value = 300;
                gainNode.gain.value = 0.15;
                oscillator.type = 'square';
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.15);
                break;
        }
    } catch (e) {
        console.warn('Sound playback failed:', e);
    }
}

const confettiCanvas = document.getElementById('confetti-canvas');
const confettiCtx = confettiCanvas ? confettiCanvas.getContext('2d') : null;
let confettiParticles = [];
let confettiAnimating = false;
let hasShownFullConfetti = false;

function resizeConfettiCanvas() {
    if (confettiCanvas) {
        confettiCanvas.width = window.innerWidth;
        confettiCanvas.height = window.innerHeight;
    }
}

if (confettiCanvas) {
    resizeConfettiCanvas();
    window.addEventListener('resize', resizeConfettiCanvas);
}

function createConfettiParticle() {
    const colors = ['#6366f1', '#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6'];
    return {
        x: Math.random() * confettiCanvas.width,
        y: -20,
        size: Math.random() * 10 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        speed: Math.random() * 3 + 2,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.2,
        drift: (Math.random() - 0.5) * 2
    };
}

function animateConfetti() {
    if (!confettiAnimating || !confettiCtx) return;
    
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    
    confettiParticles.forEach((p, i) => {
        p.y += p.speed;
        p.x += p.drift;
        p.angle += p.spin;
        
        confettiCtx.save();
        confettiCtx.translate(p.x, p.y);
        confettiCtx.rotate(p.angle);
        confettiCtx.fillStyle = p.color;
        confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        confettiCtx.restore();
        
        if (p.y > confettiCanvas.height + 20) {
            confettiParticles.splice(i, 1);
        }
    });
    
    if (confettiParticles.length > 0) {
        requestAnimationFrame(animateConfetti);
    } else {
        confettiAnimating = false;
    }
}

function launchConfetti() {
    if (!confettiCanvas) return;
    confettiParticles = [];
    for (let i = 0; i < 150; i++) {
        setTimeout(() => {
            confettiParticles.push(createConfettiParticle());
        }, i * 20);
    }
    confettiAnimating = true;
    animateConfetti();
    playSound('celebration');
}

let notificationPermission = 'default';

async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        notificationPermission = await Notification.requestPermission();
    } else if ('Notification' in window) {
        notificationPermission = Notification.permission;
    }
}

function sendBrowserNotification(title, body, icon = '📋') {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${icon}</text></svg>`,
            badge: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${icon}</text></svg>`,
            tag: 'fas-notification',
            renotify: true
        });
    }
}

const countdownContainer = document.getElementById('countdown-container');
const countdownTimer = document.getElementById('countdown-timer');
const countdownStatus = document.getElementById('countdown-status');

function updateCountdown() {
    if (!countdownContainer || !countdownTimer || !countdownStatus) return;
    
    const now = new Date();
    const minutes = getMinutesSinceMidnight(now);
    
    if (minutes >= ALLOWED_START_MINUTES && minutes < ALLOWED_END_MINUTES) {
        const remainingMinutes = ALLOWED_END_MINUTES - minutes;
        const hours = Math.floor(remainingMinutes / 60);
        const mins = remainingMinutes % 60;
        const secs = 59 - now.getSeconds();
        
        countdownContainer.classList.remove('hidden');
        countdownTimer.textContent = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        countdownStatus.textContent = 'remaining to submit';
        countdownTimer.classList.remove('text-red-600');
        countdownTimer.classList.add('text-indigo-600');
        
        if (remainingMinutes <= 15) {
            countdownTimer.classList.remove('text-indigo-600');
            countdownTimer.classList.add('text-red-600');
        }
    } else if (minutes < ALLOWED_START_MINUTES) {
        const untilStartMinutes = ALLOWED_START_MINUTES - minutes;
        const hours = Math.floor(untilStartMinutes / 60);
        const mins = untilStartMinutes % 60;
        const secs = 59 - now.getSeconds();
        
        countdownContainer.classList.remove('hidden');
        countdownTimer.textContent = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        countdownStatus.textContent = 'until window opens';
        countdownTimer.classList.remove('text-red-600');
        countdownTimer.classList.add('text-gray-600');
    } else {
        countdownContainer.classList.remove('hidden');
        countdownTimer.textContent = '00:00:00';
        countdownStatus.textContent = 'window closed for today';
        countdownTimer.classList.remove('text-indigo-600');
        countdownTimer.classList.add('text-red-600');
    }
}

const roomSearch = document.getElementById('room-search');
const clearSearchBtn = document.getElementById('clear-search');

function filterRooms(searchTerm) {
    const term = searchTerm.trim().toLowerCase();
    ROOMS.forEach(room => {
        const card = document.getElementById(`room_${room}`);
        if (card) {
            if (term === '' || String(room).includes(term)) {
                card.style.display = '';
                card.classList.remove('room-hidden');
            } else {
                card.style.display = 'none';
                card.classList.add('room-hidden');
            }
        }
    });
    
    if (clearSearchBtn) {
        if (term !== '') {
            clearSearchBtn.classList.remove('hidden');
        } else {
            clearSearchBtn.classList.add('hidden');
        }
    }
}

if (roomSearch) {
    roomSearch.addEventListener('input', (e) => {
        playSound('click');
        filterRooms(e.target.value);
    });
}

if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
        playSound('click');
        if (roomSearch) roomSearch.value = '';
        filterRooms('');
    });
}

const colorPickerBtn = document.getElementById('color-picker-btn');
const colorDropdown = document.getElementById('color-picker-dropdown');
const colorOptions = document.querySelectorAll('.color-option');

const themeColors = {
    indigo: { primary: '#EBB328', secondary: '#EBB328', gradient: 'linear-gradient(135deg, #EBB328 0%, #EBB328 100%)' },
    blue: { primary: '#3b82f6', secondary: '#2563eb', gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' },
    green: { primary: '#10b981', secondary: '#059669', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
    purple: { primary: '#8b5cf6', secondary: '#7c3aed', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' },
    rose: { primary: '#f43f5e', secondary: '#e11d48', gradient: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)' }
};

function applyColorTheme(colorName) {
    const theme = themeColors[colorName] || themeColors.indigo;
    document.documentElement.style.setProperty('--theme-primary', theme.primary);
    document.documentElement.style.setProperty('--theme-secondary', theme.secondary);
    document.documentElement.style.setProperty('--theme-gradient', theme.gradient);
    
    const gradientCard = document.getElementById('total-attendance-card');
    if (gradientCard) {
        gradientCard.style.background = theme.gradient;
    }
    
    document.querySelectorAll('.input-number').forEach(input => {
        input.style.setProperty('--focus-color', theme.primary);
    });
    
    localStorage.setItem('fas_color_theme', colorName);
    
    colorOptions.forEach(opt => {
        opt.classList.remove('active');
        if (opt.dataset.color === colorName) {
            opt.classList.add('active');
        }
    });
}

if (colorPickerBtn) {
    colorPickerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playSound('click');
        if (colorDropdown) colorDropdown.classList.toggle('hidden');
    });
}

colorOptions.forEach(option => {
    option.addEventListener('click', (e) => {
        e.stopPropagation();
        playSound('success');
        const color = option.dataset.color;
        applyColorTheme(color);
        if (colorDropdown) colorDropdown.classList.add('hidden');
    });
});

document.addEventListener('click', () => {
    if (colorDropdown) colorDropdown.classList.add('hidden');
});

const soundToggle = document.getElementById('sound-toggle');

function updateSoundToggle() {
    if (soundToggle) {
        soundToggle.textContent = soundEnabled ? '🔊' : '🔇';
        soundToggle.title = soundEnabled ? 'Sound On' : 'Sound Off';
    }
}

if (soundToggle) {
    soundToggle.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        localStorage.setItem('fas_sound', soundEnabled);
        updateSoundToggle();
        if (soundEnabled) playSound('click');
    });
}

function getTodayDateKey() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateKey) {
    const [year, month, day] = dateKey.split('-');
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

function getMinutesSinceMidnight(date = new Date()) {
    return date.getHours() * 60 + date.getMinutes();
}

function isWithinAllowedTime() {
    if (!ALLOW_TIME_LIMIT) return true;
    const minutes = getMinutesSinceMidnight();
    return minutes >= ALLOWED_START_MINUTES && minutes < ALLOWED_END_MINUTES;
}

const totalCountDisplay = document.getElementById('total-count-display');
const roomGrid = document.getElementById('room-grid');
const loadingStatus = document.getElementById('loading-status');
const dateDisplay = document.getElementById('date-display');
const errorDiv = document.getElementById('error-message');
const errorText = document.getElementById('error-text');
const datePicker = document.getElementById('date-picker');
const todayBtn = document.getElementById('today-btn');
const viewModeIndicator = document.getElementById('view-mode-indicator');
const notificationContainer = document.getElementById('notification-container');

const activityLogModal = document.getElementById('activity-log-modal');
const closeActivityLog = document.getElementById('close-activity-log');
const activityLogContent = document.getElementById('activity-log-content');
const logDateFilter = document.getElementById('log-date-filter');
const logUserFilter = document.getElementById('log-user-filter');
const logRoomFilter = document.getElementById('log-room-filter');

function displayError(message) {
    console.error(message);
    if (errorText) errorText.textContent = message;
    if (errorDiv) errorDiv.classList.remove('hidden');
    if (loadingStatus) loadingStatus.classList.add('hidden');
}

if (logDateFilter) logDateFilter.addEventListener('change', () => filterActivityLog());
if (logUserFilter) logUserFilter.addEventListener('change', () => filterActivityLog());
if (logRoomFilter) logRoomFilter.addEventListener('change', () => filterActivityLog());

async function logActivity(action, details) {
    if (!db || !userId) return;
    
    const logEntry = {
        user: userId,
        action: action,
        details: details,
        timestamp: new Date().toISOString(),
        date: getTodayDateKey()
    };
    
    const logRef = ref(db, `activity_logs/${Date.now()}`);
    await set(logRef, logEntry);
}

async function loadActivityLog() {
    if (!db) return [];
    
    const logsRef = ref(db, 'activity_logs');
    const snapshot = await get(logsRef);
    
    if (snapshot.exists()) {
        const logs = [];
        snapshot.forEach((child) => {
            logs.push({ id: child.key, ...child.val() });
        });
        return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
    return [];
}

async function showActivityLog() {
    if (!activityLogModal) return;
    activityLogModal.classList.remove('hidden');
    if (activityLogContent) {
        activityLogContent.innerHTML = '<p class="text-center text-gray-500 py-8">Loading activity log...</p>';
    }
    
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    if (logDateFilter) logDateFilter.value = `${year}-${month}-${day}`;
    
    activityLog = await loadActivityLog();
    
    const users = [...new Set(activityLog.map(log => log.user))];
    if (logUserFilter) {
        logUserFilter.innerHTML = '<option value="">All Users</option>';
        users.forEach(user => {
            logUserFilter.innerHTML += `<option value="${user}">${user}</option>`;
        });
    }
    
    if (logRoomFilter) {
        logRoomFilter.innerHTML = '<option value="">All Rooms</option>';
        ROOMS.forEach(room => {
            logRoomFilter.innerHTML += `<option value="${room}">Room ${room}</option>`;
        });
    }
    
    filterActivityLog();
}

function filterActivityLog() {
    const dateFilter = logDateFilter ? logDateFilter.value : '';
    const userFilter = logUserFilter ? logUserFilter.value : '';
    const roomFilter = logRoomFilter ? logRoomFilter.value : '';
    
    let filtered = activityLog;
    
    if (dateFilter) {
        filtered = filtered.filter(log => log.date === dateFilter);
    }
    
    if (userFilter) {
        filtered = filtered.filter(log => log.user === userFilter);
    }
    
    if (roomFilter) {
        filtered = filtered.filter(log => 
            log.details && log.details.includes(`Room ${roomFilter}`)
        );
    }
    
    displayActivityLog(filtered);
}

function displayActivityLog(logs) {
    if (!activityLogContent) return;
    
    if (logs.length === 0) {
        activityLogContent.innerHTML = '<p class="text-center text-gray-500 py-8">No activity found for selected filters.</p>';
        return;
    }
    
    activityLogContent.innerHTML = logs.map(log => {
        const time = new Date(log.timestamp).toLocaleString();
        const actionColor = log.action === 'update' ? 'text-blue-600' : 
                           log.action === 'reset' ? 'text-red-600' : 'text-green-600';
        
        return `
            <div class="activity-log-item border border-gray-200 rounded-lg p-4">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <p class="font-semibold ${actionColor}">${log.action.toUpperCase()}</p>
                        <p class="text-sm text-gray-700 mt-1">${log.details}</p>
                        <p class="text-xs text-gray-500 mt-2">by <strong>${log.user}</strong> at ${time}</p>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function showNotification(message, type = 'info', duration = 5000) {
    if (!notificationContainer) return;
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type} text-white p-4 rounded-lg shadow-lg flex items-start gap-3`;
    
    const icon = {
        'info': 'ℹ️',
        'warning': '⚠️',
        'success': '✓',
        'danger': '⚡'
    }[type] || 'ℹ️';
    
    notification.innerHTML = `
        <span class="text-2xl">${icon}</span>
        <div class="flex-1">
            <p class="font-semibold text-sm">${message}</p>
        </div>
        <button class="text-white hover:text-gray-200 font-bold text-xl leading-none" onclick="this.parentElement.remove()">×</button>
    `;
    
    notificationContainer.appendChild(notification);
    
    if (duration > 0) {
        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
}

function checkCapacityAndNotify(total) {
    const percentFull = (total / MAX_CAPACITY) * 100;
    
    if (percentFull >= 80 && percentFull < 95 && lastNotifiedTotal < (MAX_CAPACITY * 0.8)) {
        showNotification(`Capacity Alert: ${total}/${MAX_CAPACITY} students (${Math.round(percentFull)}% full)`, 'warning', 7000);
        playSound('warning');
    }
    else if (percentFull >= 95 && percentFull < 100 && lastNotifiedTotal < (MAX_CAPACITY * 0.95)) {
        showNotification(`Critical: Near Maximum Capacity! ${total}/${MAX_CAPACITY} students (${Math.round(percentFull)}% full)`, 'danger', 10000);
        playSound('warning');
    }
    else if (percentFull >= 100 && !hasShownFullConfetti) {
        showNotification(`🎉 Maximum Capacity Reached! ${total}/${MAX_CAPACITY} students - Great job everyone!`, 'success', 0);
        sendBrowserNotification('🎉 Full Attendance!', `All ${MAX_CAPACITY} students present on floor!`, '🎊');
        launchConfetti();
        hasShownFullConfetti = true;
    }
    
    lastNotifiedTotal = total;
}

function checkInputWindowAndNotify() {
    if (!isViewingToday) return;
    
    const now = new Date();
    const minutes = getMinutesSinceMidnight(now);
    
    if (minutes >= ALLOWED_START_MINUTES && minutes < ALLOWED_START_MINUTES + 5 && !sentNotifications.reminder1) {
        showNotification(`🔔 Reminder for ${userId}: Attendance input window is now OPEN! Please update room attendance until 10:00 PM.`, 'info', 10000);
        sendEmailReminder('first');
        sentNotifications.reminder1 = true;
    }
    else if (minutes >= SECOND_REMINDER_MINUTES && minutes < SECOND_REMINDER_MINUTES + 5 && !sentNotifications.reminder2) {
        showNotification(`⏰ Second Reminder for ${userId}: Only 1 hour left! Attendance window closes at 10:00 PM.`, 'warning', 10000);
        sendEmailReminder('second');
        sentNotifications.reminder2 = true;
    }
    else if (minutes >= FINAL_REMINDER_MINUTES && minutes < FINAL_REMINDER_MINUTES + 5 && !sentNotifications.reminder3) {
        showNotification(`🚨 FINAL Reminder for ${userId}: Only 15 minutes left to submit attendance! Window closes at 10:00 PM.`, 'danger', 12000);
        sendEmailReminder('final');
        sentNotifications.reminder3 = true;
    }
    
    if (minutes < ALLOWED_START_MINUTES || minutes >= ALLOWED_END_MINUTES) {
        sentNotifications = {
            reminder1: false,
            reminder2: false,
            reminder3: false
        };
    }
}

async function sendEmailReminder(type) {
    if (!db || !userId || !userEmail) return;
    
    const reminderData = {
        user: userId,
        email: userEmail,
        type: type,
        timestamp: new Date().toISOString(),
        date: getTodayDateKey(),
        message: type === 'first' ? 'Attendance window is now open (6:30 PM - 10:00 PM)' :
                 type === 'second' ? 'Only 1 hour left to submit attendance' :
                 'Final reminder: 15 minutes left to submit attendance'
    };
    
    try {
        const reminderRef = ref(db, `email_reminders/${Date.now()}`);
        await set(reminderRef, reminderData);
        console.log(`Email reminder (${type}) logged for ${userEmail}`);
    } catch (error) {
        console.error('Failed to log email reminder:', error);
    }
}

function hidePageLoader() {
    const loader = document.getElementById('page-loader');
    if (loader && !loader.classList.contains('hidden')) {
        setTimeout(() => {
            loader.classList.add('hidden');
            setTimeout(() => {
                loader.style.display = 'none';
            }, 200);
        }, 100);
    }
}

async function initializeFirebase() {
    try {
        if (Object.keys(firebaseConfig).length === 0) {
            throw new Error("Firebase configuration is missing. Cannot initialize database.");
        }

        const app = initializeApp(firebaseConfig);
        db = getDatabase(app);

        try {
            const analytics = getAnalytics(app);
            console.log('Firebase Analytics initialized.');
        } catch (e) {
            console.warn('Firebase Analytics not initialized:', e.message);
        }

        if (loadingStatus) loadingStatus.textContent = 'Connected. Setting up real-time listener...';
        setupRealtimeListener();
        checkAndRunDailyReset();
        hidePageLoader();

    } catch (error) {
        displayError(`Firebase Initialization failed: ${error.message}`);
        hidePageLoader();
    }
}

function renderRoomCard(roomNumber, currentCount) {
    const docId = `room_${roomNumber}`;
    const existingCard = document.getElementById(docId);
    const isEditable = isViewingToday && isWithinAllowedTime();

    if (existingCard) {
        const input = existingCard.querySelector('input');
        if (input && parseInt(String(input.value).replace(/\D/g, ''), 10) !== currentCount) {
            if (document.activeElement !== input) {
                input.value = String(currentCount);
            }
        }
        updateRoomBadge(roomNumber, currentCount);
        updateRoomProgress(roomNumber, currentCount);
        if (input) {
            input.disabled = !isEditable;
            input.style.opacity = isEditable ? '1' : '0.6';
            input.style.cursor = isEditable ? 'text' : 'not-allowed';
        }
        displayedCounts[roomNumber] = currentCount;
        return;
    }

    const card = document.createElement('div');
    card.id = docId;
    card.className = 'room-card p-5 rounded-2xl';
    card.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <div class="text-lg font-bold text-gray-800">Room ${roomNumber}</div>
            <div class="room-badge" id="badge-${roomNumber}">-</div>
        </div>
        <div class="text-sm text-gray-500 mb-2">Students Present:</div>
        <div class="input-with-controls" style="display:flex;gap:8px;align-items:center;justify-content:center;">
            <input
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                id="input-${roomNumber}"
                value="${String(currentCount)}"
                placeholder="0"
                class="input-number"
                ${!isEditable ? 'disabled' : ''}
            />
        </div>
        <div class="mt-3">
            <div class="progress-track" id="progress-${roomNumber}">
                <div class="progress-fill" style="width: 0%;"></div>
            </div>
            <div class="progress-label text-xs text-gray-500 mt-1" id="progress-label-${roomNumber}">0/6</div>
        </div>
    `;

    const inputElement = card.querySelector(`#input-${roomNumber}`);

    function sanitizeAndSave(val) {
        const digits = String(val || '').replace(/\D/g, '');
        let num = digits === '' ? 0 : parseInt(digits, 10);
        if (isNaN(num) || num < 0) num = 0;
        if (num > 6) num = 6;
        if (inputElement) inputElement.value = String(num);
        updateAttendance(roomNumber, num);
    }

    if (isEditable && inputElement) {
        inputElement.addEventListener('input', (event) => {
            sanitizeAndSave(event.target.value);
        });
    } else if (inputElement) {
        inputElement.style.opacity = '0.6';
        inputElement.style.cursor = 'not-allowed';
    }
    
    updateRoomBadge(roomNumber, currentCount);
    if (roomGrid) roomGrid.appendChild(card);
}

function renderInitialRooms() {
    if (!roomGrid) return;
    roomGrid.innerHTML = '';
    ROOMS.forEach(room => {
        renderRoomCard(room, 0);
        displayedCounts[room] = 0;
    });
    if (totalCountDisplay) {
        totalCountDisplay.textContent = '0';
    }
}

function calculateTotal(attendanceData) {
    const total = attendanceData.reduce((sum, doc) => sum + (doc.present_count || 0), 0);
    if (totalCountDisplay) totalCountDisplay.textContent = total;
    animateTotalChange();
    
    if (isViewingToday) {
        checkCapacityAndNotify(total);
    }
}

function setupRealtimeListener(dateKey = null) {
    if (!db) return;

    const viewDateKey = dateKey || currentViewDate;
    const todayDateKey = getTodayDateKey();
    
    isViewingToday = (viewDateKey === todayDateKey);
    
    lastNotifiedTotal = 0;
    hasShownInputWindowReminder = false;
    
    if (dateDisplay) {
        dateDisplay.innerHTML = `Viewing Date: <strong>${formatDisplayDate(viewDateKey)}</strong>`;
    }
    
    if (viewModeIndicator) {
        if (isViewingToday) {
            viewModeIndicator.innerHTML = '<strong>Live View</strong> - Data updates in real-time';
            viewModeIndicator.className = 'text-xs text-center mt-3 text-green-600 font-medium';
        } else {
            viewModeIndicator.innerHTML = '<strong>Historical View</strong> - Read-only mode';
            viewModeIndicator.className = 'text-xs text-center mt-3 text-blue-600 font-medium';
        }
    }
    
    const attendanceRef = ref(db, `attendance/${viewDateKey}`);

    onValue(attendanceRef, (snapshot) => {
        if (loadingStatus) loadingStatus.classList.add('hidden');
        
        const data = snapshot.val() || {};
        
        if (Object.keys(data).length === 0 && isViewingToday) {
            console.log('No data found for today, initializing...');
            seedInitialRooms();
        } else if (Object.keys(data).length === 0) {
            console.log(`No attendance data found for ${viewDateKey}`);
            if (roomGrid) {
                roomGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 py-8">No attendance records found for this date.</p>';
            }
            if (totalCountDisplay) totalCountDisplay.textContent = '0';
            return;
        }
        
        const newTotals = [];

        ROOMS.forEach(room => {
            const roomKey = `room_${room}`;
            const roomData = data[roomKey];
            const presentCount = roomData ? (roomData.present_count || 0) : 0;
            newTotals.push(presentCount);

            const existing = document.getElementById(`room_${room}`);
            const prev = typeof displayedCounts[room] === 'number' ? displayedCounts[room] : null;

            if (!existing) {
                renderRoomCard(room, presentCount);
                setTimeout(() => updateRoomProgress(room, presentCount), 50);
                displayedCounts[room] = presentCount;
                return;
            }

            if (prev === null || prev !== presentCount) {
                const inputEl = existing.querySelector(`#input-${room}`);
                if (inputEl && document.activeElement !== inputEl) {
                    inputEl.value = String(presentCount);
                }
                updateRoomBadge(room, presentCount);
                updateRoomProgress(room, presentCount);
                displayedCounts[room] = presentCount;
            }
        });

        const newTotal = newTotals.reduce((s, v) => s + (v || 0), 0);
        const oldTotal = totalCountDisplay ? parseInt(totalCountDisplay.textContent) || 0 : 0;
        if (newTotal !== oldTotal) {
            if (totalCountDisplay) totalCountDisplay.textContent = newTotal;
            animateTotalChange();
            if (isViewingToday) checkCapacityAndNotify(newTotal);
        }

    }, (error) => {
        displayError(`Real-time listener failed: ${error.message}`);
    });
}

async function seedInitialRooms() {
    if (!db) return;
    
    const todayDateKey = getTodayDateKey();
    console.log(`Initializing database for date: ${todayDateKey}`);
    
    const updates = {};

    ROOMS.forEach(room => {
        const roomKey = `room_${room}`;
        updates[`attendance/${todayDateKey}/${roomKey}`] = {
            room: room,
            present_count: 0,
            updated_by: 'system',
            timestamp: new Date().toISOString(),
            date: todayDateKey
        };
    });

    try {
        await update(ref(db), updates);
        console.log(`Database structure initialized for ${todayDateKey} with ${ROOMS.length} rooms.`);
    } catch (error) {
        console.error('Failed to seed initial rooms:', error.message);
        displayError(`Failed to initialize database: ${error.message}`);
    }
}

async function clearAllAttendance(isManual = false) {
    if (!db) {
        if (isManual) displayError("Database not initialized. Please wait.");
        return;
    }

    if (errorDiv) errorDiv.classList.add('hidden');
    if (loadingStatus) loadingStatus.textContent = 'Auto-reset in progress...';

    try {
        const todayDateKey = getTodayDateKey();
        const updates = {};

        ROOMS.forEach(room => {
            const roomKey = `room_${room}`;
            updates[`attendance/${todayDateKey}/${roomKey}`] = {
                room: room,
                present_count: 0,
                updated_by: userId,
                timestamp: new Date().toISOString()
            };
        });

        updates['reset_tracker/last_reset'] = new Date().toISOString();

        await update(ref(db), updates);

        console.log('Automatic daily reset successfully completed.');
        
        if (userId) {
            await logActivity('reset', `Daily attendance reset completed - all rooms set to 0`);
        }

    } catch (error) {
        displayError(`Failed to complete automatic reset: ${error.message}`);
    } finally {
        if (loadingStatus) loadingStatus.textContent = 'Database loaded and real-time listener active.';
    }
}

async function checkAndRunDailyReset() {
    if (!db) return;

    const now = new Date();
    
    const targetResetTimeToday = new Date();
    targetResetTimeToday.setHours(18, 0, 0, 0);

    if (now.getTime() < targetResetTimeToday.getTime()) {
        console.log("Auto-reset skipped: Current time is before 6:00 PM.");
        return;
    }
    
    const resetRef = ref(db, 'reset_tracker/last_reset');

    try {
        const snapshot = await get(resetRef);
        const lastResetTimestamp = snapshot.exists() ? snapshot.val() : null;
        let lastResetTime = null;

        if (lastResetTimestamp) {
            lastResetTime = new Date(lastResetTimestamp);
        }

        const resetAlreadyDone = lastResetTime && lastResetTime.getTime() > targetResetTimeToday.getTime();

        if (!resetAlreadyDone) {
            console.log("Auto-reset triggered: Past 6:00 PM and reset has not run today. Executing reset...");
            await clearAllAttendance(false); 
        } else {
            console.log("Auto-reset skipped: Already performed today after 6:00 PM.");
        }

    } catch (error) {
        console.error("Error during automatic reset check:", error.message);
    }
}

async function updateAttendance(roomNumber, value) {
    if (!db) return;

    if (!isWithinAllowedTime()) {
        displayError('Attendance can only be updated between 6:30 PM to 10:00 PM.');
        return;
    }

    let count = parseInt(value);
    if (isNaN(count) || count < 0) {
        count = 0;
    }
    if (count > 6) {
        displayError('Maximum 6 students allowed per room.');
        count = 6;
        const inputElement = document.getElementById(`input-${roomNumber}`);
        if (inputElement) inputElement.value = 6;
    }

    const todayDateKey = getTodayDateKey();
    const roomKey = `room_${roomNumber}`;
    const roomRef = ref(db, `attendance/${todayDateKey}/${roomKey}`);

    try {
        await set(roomRef, {
            room: roomNumber,
            present_count: count,
            updated_by: userId,
            timestamp: new Date().toISOString()
        });
        
        await logActivity('update', `Room ${roomNumber} attendance set to ${count} students`);

        showNotification(`Thank you-Room ${roomNumber} updated (${count})`, 'success', 2500);
        playSound('success');
        
        if (count === 6) {
            showNotification(`🎉 Room ${roomNumber} is FULL! Great job!`, 'success', 4000);
        }

        try {
            updateRoomBadge(roomNumber, count);
            updateRoomProgress(roomNumber, count);
            const inputEl = document.getElementById(`input-${roomNumber}`);
            if (inputEl) {
                inputEl.classList.add('input-saved');
                setTimeout(() => inputEl.classList.remove('input-saved'), 900);
            }
        } catch (e) {
            console.warn('UI update after save failed', e);
        }

    } catch (error) {
        displayError(`Failed to update attendance for Room ${roomNumber}: ${error.message}`);
    }
}

function setDatePickerToToday() {
    if (!datePicker) return;
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    datePicker.value = `${year}-${month}-${day}`;
}

function initializeDatePicker() {
    setDatePickerToToday();
    
    if (datePicker) {
        datePicker.addEventListener('change', (event) => {
            const selectedDate = new Date(event.target.value + 'T00:00:00');
            currentViewDate = formatDateKey(selectedDate);
            setupRealtimeListener(currentViewDate);
            if (errorDiv) errorDiv.classList.add('hidden');
        });
    }

    if (todayBtn) {
        todayBtn.addEventListener('click', () => {
            setDatePickerToToday();
            currentViewDate = getTodayDateKey();
            setupRealtimeListener(currentViewDate);
            if (errorDiv) errorDiv.classList.add('hidden');
        });
    }
}

const themeToggle = document.getElementById('theme-toggle');

function applyTheme(isDark) {
    if (isDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('fas_theme', 'dark');
        if (themeToggle) {
            themeToggle.setAttribute('aria-pressed', 'true');
            themeToggle.textContent = '☀️';
            themeToggle.classList.add('is-dark');
        }
    } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('fas_theme', 'light');
        if (themeToggle) {
            themeToggle.setAttribute('aria-pressed', 'false');
            themeToggle.textContent = '🌙';
            themeToggle.classList.remove('is-dark');
        }
    }
}

function initTheme() {
    const saved = localStorage.getItem('fas_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved === 'dark' || (!saved && prefersDark));
}

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.classList.contains('dark');
        applyTheme(!isDark);
    });
}

function updateRoomBadge(roomNumber, count) {
    const badge = document.getElementById(`badge-${roomNumber}`);
    if (!badge) return;
    badge.className = 'room-badge';
    if (count >= 6) {
        badge.textContent = 'Full';
        badge.classList.add('badge-full');
    } else if (count >= 5) {
        badge.textContent = 'Near-full';
        badge.classList.add('badge-warning');
    } else {
        badge.textContent = 'Open';
        badge.classList.add('badge-normal');
    }
}

function updateRoomProgress(roomNumber, count) {
    const track = document.getElementById(`progress-${roomNumber}`);
    const label = document.getElementById(`progress-label-${roomNumber}`);
    const card = document.getElementById(`room_${roomNumber}`);
    if (!track || !label) return;
    const capacity = 6;
    const percent = Math.min(100, Math.round((count / capacity) * 100));
    const fill = track.querySelector('.progress-fill');
    if (fill) {
        fill.style.width = percent + '%';
        fill.setAttribute('aria-valuenow', count);
        
        if (count >= capacity) {
            fill.classList.add('full');
            if (card) card.classList.add('room-full');
        } else {
            fill.classList.remove('full');
            if (card) card.classList.remove('room-full');
        }
    }
    label.textContent = `${count}/${capacity}`;
}

function animateTotalChange() {
    const el = document.getElementById('total-count-display');
    if (!el) return;
    el.classList.remove('count-pop');
    void el.offsetWidth;
    el.classList.add('count-pop');
}

function init() {
    updateSoundToggle();
    
    const savedColorTheme = localStorage.getItem('fas_color_theme') || 'indigo';
    applyColorTheme(savedColorTheme);
    
    updateCountdown();
    setInterval(updateCountdown, 1000);
    
    requestNotificationPermission();
    
    checkInputWindowAndNotify();
    setInterval(checkInputWindowAndNotify, 60000);
    
    setTimeout(() => {
        hidePageLoader();
    }, 8000);
    
    renderInitialRooms();
    initializeFirebase();
    initializeDatePicker();
    
    initTheme();
}

init();
