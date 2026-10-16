// ============================================
// 🍥 Ninja Mission Tracker
// ============================================
let tasks = [];
let currentWeekStart = getWeekStart(new Date());
let currentUser = null;
let userProfile = { email: '', displayName: '' };

// ---------- Date Helpers ----------
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getToday() { return formatDate(new Date()); }

function getTodayIndex() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(currentWeekStart);
  weekStart.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today - weekStart) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return -1;
  if (diffDays > 6) return 7;
  return diffDays;
}

// 🔑 Get ISO week key like "2026-W43"
function getWeekKey(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getLastWeekKey() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return getWeekKey(d);
}

// ---------- Firestore Refs ----------
function tasksCol() {
  return db.collection('users').doc(currentUser.uid).collection('tasks');
}

function leaderboardDoc(uid) {
  return db.collection('leaderboard').doc(uid);
}

// ---------- Load Tasks ----------
async function loadTasks() {
  const snap = await tasksCol().orderBy('createdAt', 'asc').get();
  tasks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  await autoCheckPastDays();
}

async function autoCheckPastDays() {
  const todayIndex = getTodayIndex();
  const batch = db.batch();
  let changed = false;
  tasks.forEach(task => {
    if (!task.days) {
      task.days = [false, false, false, false, false, false, false];
      changed = true;
    }
    for (let i = 0; i < todayIndex && i < 7; i++) {
      if (task.days[i] !== true) task.days[i] = false;
    }
    if (changed) batch.update(tasksCol().doc(task.id), { days: task.days });
  });
  if (changed) await batch.commit();
}

async function addTask() {
  const input = document.getElementById('taskInput');
  const text = input.value.trim();
  if (!text) { alert('Please enter a mission!'); return; }
  const newTask = {
    text,
    createdDate: getToday(),
    days: [false, false, false, false, false, false, false],
    createdAt: Date.now()
  };
  const ref = await tasksCol().add(newTask);
  tasks.push({ id: ref.id, ...newTask });
  input.value = '';
  renderTasks();
  updateStats();
  updateWeekComparison();
  await updateLeaderboardStats();
  await loadLeaderboard();
}

async function toggleDay(taskId, dayIndex) {
  const todayIndex = getTodayIndex();
  if (dayIndex > todayIndex) {
    alert('Future days are locked! 🔒');
    return;
  }
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  task.days[dayIndex] = !task.days[dayIndex];
  await tasksCol().doc(taskId).update({ days: task.days });
  renderTasks();
  updateStats();
  updateWeekComparison();
  await updateLeaderboardStats();
  await loadLeaderboard();
}

async function deleteTask(taskId) {
  if (!confirm('Delete this mission?')) return;
  await tasksCol().doc(taskId).delete();
  tasks = tasks.filter(t => t.id !== taskId);
  renderTasks();
  updateStats();
  updateWeekComparison();
  await updateLeaderboardStats();
  await loadLeaderboard();
}

// ---------- Render Tasks ----------
function renderTasks() {
  const tbody = document.getElementById('taskTableBody');
  tbody.innerHTML = '';
  const todayIndex = getTodayIndex();

  if (tasks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#ffa500; letter-spacing:2px;">📜 No missions assigned yet, shinobi</td></tr>';
    return;
  }

  tasks.forEach((task, index) => {
    const row = document.createElement('tr');
    row.style.animationDelay = `${index * 0.05}s`;
    const nameCell = document.createElement('td');
    nameCell.innerHTML = `${task.text} <button class="delete-btn" onclick="deleteTask('${task.id}')">Delete</button>`;
    row.appendChild(nameCell);

    for (let i = 0; i < 7; i++) {
      const dayCell = document.createElement('td');
      dayCell.className = 'checkbox';

      if (i > todayIndex) {
        dayCell.textContent = '🔒';
        dayCell.classList.add('locked');
        dayCell.style.cursor = 'not-allowed';
      } else if (i === todayIndex) {
        if (task.days[i]) {
          dayCell.textContent = '✓';
          dayCell.classList.add('completed');
        } else {
          dayCell.textContent = '○';
          dayCell.classList.add('today');
        }
        dayCell.style.cursor = 'pointer';
        dayCell.onclick = () => toggleDay(task.id, i);
      } else {
        if (task.days[i]) {
          dayCell.textContent = '✓';
          dayCell.classList.add('completed');
        } else {
          dayCell.textContent = '✗';
          dayCell.classList.add('pending');
        }
        dayCell.style.cursor = 'pointer';
        dayCell.onclick = () => toggleDay(task.id, i);
      }
      row.appendChild(dayCell);
    }
    tbody.appendChild(row);
  });
}

// ---------- Update Stats ----------
function updateStats() {
  document.getElementById('totalTasks').textContent = tasks.length;
  const todayIndex = getTodayIndex();
  let completed = 0, pending = 0;
  tasks.forEach(task => {
    for (let i = 0; i <= todayIndex && i < 7; i++) {
      task.days[i] ? completed++ : pending++;
    }
  });
  document.getElementById('completedTasks').textContent = completed;
  document.getElementById('pendingTasks').textContent = pending;
}

// ---------- Week Comparison ----------
function getWeekStats(weekOffset) {
  // weekOffset: 0 = this week, -1 = last week
  const todayIndex = getTodayIndex();
  // For last week, all 7 days are considered "past"
  const effectiveIndex = weekOffset === 0 ? todayIndex : 6;

  let completed = 0, total = 0;

  const weekStartCheck = new Date(currentWeekStart);
  weekStartCheck.setDate(weekStartCheck.getDate() + (weekOffset * 7));
  const weekEndCheck = new Date(weekStartCheck);
  weekEndCheck.setDate(weekEndCheck.getDate() + 6);
  weekEndCheck.setHours(23, 59, 59, 999);

  tasks.forEach(task => {
    // Check task created before end of that week
    const taskCreatedDate = task.createdDate
      ? new Date(task.createdDate)
      : new Date(task.createdAt || Date.now());

    if (taskCreatedDate > weekEndCheck) return;

    for (let i = 0; i <= effectiveIndex && i < 7; i++) {
      total++;
      if (task.days[i]) completed++;
    }
  });

  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percent };
}

function updateWeekComparison() {
  const thisWeek = getWeekStats(0);
  const lastWeek = getWeekStats(-1);

  document.getElementById('thisWeekPercent').textContent = `${thisWeek.percent}%`;
  document.getElementById('thisWeekCount').textContent = `${thisWeek.completed} completed`;
  document.getElementById('lastWeekPercent').textContent = `${lastWeek.percent}%`;
  document.getElementById('lastWeekCount').textContent = `${lastWeek.completed} completed`;

  const diff = thisWeek.percent - lastWeek.percent;
  const badge = document.getElementById('improvementBadge');
  const message = document.getElementById('compareMessage');

  if (diff > 0) {
    badge.textContent = `↑ ${diff}%`;
    badge.className = 'improvement-badge positive';
    message.textContent = `🔥 Superb! You improved by ${diff}% this week!`;
  } else if (diff < 0) {
    badge.textContent = `↓ ${Math.abs(diff)}%`;
    badge.className = 'improvement-badge negative';
    message.textContent = `⚠️ Down by ${Math.abs(diff)}%. Push harder this week!`;
  } else {
    badge.textContent = '— 0%';
    badge.className = 'improvement-badge neutral';
    message.textContent = `Same as last week. Let's improve!`;
  }
}

// ---------- Leaderboard & Friends ----------

// Update own stats in public leaderboard
async function updateLeaderboardStats() {
  if (!currentUser) return;

  const weeklyStats = {};
  const thisWeekKey = getWeekKey();
  const thisWeekStats = getWeekStats(0);
  weeklyStats[thisWeekKey] = thisWeekStats.completed;

  const lastWeekKey = getLastWeekKey();
  const lastWeekStats = getWeekStats(-1);
  weeklyStats[lastWeekKey] = lastWeekStats.completed;

  try {
    const docRef = leaderboardDoc(currentUser.uid);
    const docSnap = await docRef.get();

    const existing = docSnap.exists ? docSnap.data() : {};
    const mergedStats = { ...(existing.weeklyStats || {}), ...weeklyStats };

    await docRef.set({
      email: (userProfile.email || currentUser.email || '').toLowerCase(),
      displayName: userProfile.displayName || (currentUser.email || '').split('@')[0],
      weeklyStats: mergedStats,
      friends: existing.friends || [],
      updatedAt: Date.now()
    }, { merge: true });
  } catch (err) {
    console.error('Leaderboard update error:', err);
  }
}

// Add friend by email
async function addFriend() {
  const emailInput = document.getElementById('friendEmail');
  const email = emailInput.value.trim().toLowerCase();
  const msgEl = document.getElementById('friendMessage');

  if (!email) {
    showFriendMessage('Please enter an email address.', 'error');
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFriendMessage('Please enter a valid email address.', 'error');
    return;
  }

  if (email === (userProfile.email || currentUser.email || '').toLowerCase()) {
    showFriendMessage("You can't challenge yourself! 😅", 'error');
    return;
  }

  showFriendMessage('Searching for shinobi...', 'info');

  try {
    const snapshot = await db.collection('leaderboard')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (snapshot.empty) {
      showFriendMessage(`No shinobi found with "${email}". They need to signup first!`, 'error');
      return;
    }

    const friendDoc = snapshot.docs[0];
    const friendUid = friendDoc.id;

    const myDoc = leaderboardDoc(currentUser.uid);
    const mySnap = await myDoc.get();
    const existingFriends = mySnap.exists ? (mySnap.data().friends || []) : [];

    if (existingFriends.includes(friendUid)) {
      showFriendMessage('Already challenging this shinobi!', 'error');
      return;
    }

    const updatedFriends = [...existingFriends, friendUid];
    await myDoc.set({ friends: updatedFriends }, { merge: true });

    showFriendMessage(`🍥 ${friendDoc.data().displayName} added to challenge!`, 'success');
    emailInput.value = '';
    await loadLeaderboard();
  } catch (err) {
    console.error(err);
    showFriendMessage('Something went wrong. Try again.', 'error');
  }
}

// Remove friend
async function removeFriend(friendUid) {
  if (!confirm('Remove this shinobi from your challenge?')) return;
  try {
    const myDoc = leaderboardDoc(currentUser.uid);
    const mySnap = await myDoc.get();
    const existingFriends = mySnap.exists ? (mySnap.data().friends || []) : [];
    const updatedFriends = existingFriends.filter(id => id !== friendUid);
    await myDoc.set({ friends: updatedFriends }, { merge: true });
    await loadLeaderboard();
  } catch (err) {
    console.error(err);
  }
}

// Load leaderboard
async function loadLeaderboard() {
  const container = document.getElementById('leaderboard');
  const thisWeekKey = getWeekKey();

  try {
    const myDoc = leaderboardDoc(currentUser.uid);
    const mySnap = await myDoc.get();
    const myFriends = mySnap.exists ? (mySnap.data().friends || []) : [];

    const allUids = [currentUser.uid, ...myFriends];

    const docs = await Promise.all(
      allUids.map(uid => leaderboardDoc(uid).get())
    );

    const entries = docs
      .filter(d => d.exists)
      .map(d => {
        const data = d.data();
        const weeklyStats = data.weeklyStats || {};
        const thisWeekCompleted = weeklyStats[thisWeekKey] || 0;
        return {
          uid: d.id,
          displayName: data.displayName || 'Shinobi',
          email: data.email || '',
          thisWeek: thisWeekCompleted,
          isSelf: d.id === currentUser.uid
        };
      })
      .sort((a, b) => b.thisWeek - a.thisWeek);

    document.getElementById('friendCount').textContent = `${entries.length} shinobi`;

    if (entries.length === 1) {
      container.innerHTML = `
        <div class="empty-leaderboard">
          <span>🥷</span>
          <p>No friends yet. Add a shinobi to start the challenge!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = entries.map((entry, index) => {
      const rank = index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
      const initial = (entry.displayName || 'S')[0].toUpperCase();

      return `
        <div class="leaderboard-item ${entry.isSelf ? 'is-self' : ''}">
          <span class="rank-badge">${medal}</span>
          <div class="friend-avatar">${initial}</div>
          <div class="friend-info">
            <span class="friend-name">${escapeHtml(entry.displayName)}${entry.isSelf ? ' (You)' : ''}</span>
            <span class="friend-email">${escapeHtml(entry.email)}</span>
          </div>
          <div class="friend-score">
            <span class="score-value">${entry.thisWeek}</span>
            <span class="score-label">completed</span>
          </div>
          ${!entry.isSelf ? `<button class="remove-friend" onclick="removeFriend('${entry.uid}')" title="Remove">✕</button>` : ''}
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="empty-leaderboard"><p>Could not load leaderboard.</p></div>`;
  }
}

function showFriendMessage(text, type) {
  const el = document.getElementById('friendMessage');
  el.textContent = text;
  el.className = `friend-message show ${type}`;
  if (type === 'success') {
    setTimeout(() => {
      el.className = 'friend-message';
    }, 4000);
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[ch]));
}

// ---------- Week Display ----------
function updateWeekDisplay() {
  const weekEnd = new Date(currentWeekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const startMonth = currentWeekStart.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });
  document.getElementById('weekLabel').textContent =
    `${startMonth} ${currentWeekStart.getDate()} - ${endMonth} ${weekEnd.getDate()}`;

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const todayIndex = getTodayIndex();

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(currentWeekStart);
    dayDate.setDate(dayDate.getDate() + i);
    const dayHeader = document.getElementById(`day${i + 1}Header`);
    let badge = '';
    if (i === todayIndex) badge = '<br><span style="color:#00d9ff;font-size:11px;">⚔️ Today</span>';
    else if (i < todayIndex) badge = '<br><span style="color:#ff9999;font-size:11px;">Past</span>';
    else badge = '<br><span style="color:#90ee90;font-size:11px;">Future</span>';
    dayHeader.innerHTML = `${dayNames[i]} ${dayDate.getDate()}${badge}`;
  }
}

// ---------- Dark Mode ----------
function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('darkMode', isDark);
  document.getElementById('darkModeBtn').innerHTML = isDark ?
    '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

function checkDarkMode() {
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
    document.getElementById('darkModeBtn').innerHTML = '<i class="fas fa-sun"></i>';
  }
}

// ---------- Other Actions ----------
function logoutUser() {
  if (confirm('Logout from Konoha?')) auth.signOut();
}

function backupData() {
  const dataStr = JSON.stringify(tasks, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ninja_missions_${getToday()}.json`;
  a.click();
  window.URL.revokeObjectURL(url);
}

async function clearAllTasks() {
  if (tasks.length === 0) { alert('No missions to clear!'); return; }
  if (confirm(`Delete ALL ${tasks.length} missions?`)) {
    const batch = db.batch();
    tasks.forEach(t => batch.delete(tasksCol().doc(t.id)));
    await batch.commit();
    tasks = [];
    renderTasks();
    updateStats();
    updateWeekComparison();
    await updateLeaderboardStats();
    await loadLeaderboard();
  }
}

// ---------- Init ----------
auth.onAuthStateChanged(async (user) => {
  const loader = document.getElementById('rasenganLoader');
  const main = document.getElementById('mainContainer');

  setTimeout(() => {
    if (loader) loader.classList.add('hide');
    if (main) main.style.opacity = '1';
  }, 2000);

  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  currentUser = user;
  userProfile = {
    email: user.email,
    displayName: (user.email || '').split('@')[0]
  };

  try {
    await loadTasks();
    updateWeekDisplay();
    renderTasks();
    updateStats();
    updateWeekComparison();
    checkDarkMode();
    attachEventListeners();
    await updateLeaderboardStats();
    await loadLeaderboard();

    if (loader) loader.classList.add('hide');
    if (main) main.style.opacity = '1';
  } catch (err) {
    console.error('Init error:', err);
    if (loader) loader.classList.add('hide');
    if (main) main.style.opacity = '1';
  }
});

window.toggleDarkMode = toggleDarkMode;
window.deleteTask = deleteTask;
window.logoutUser = logoutUser;
window.removeFriend = removeFriend;

let listenersAttached = false;
function attachEventListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  document.getElementById('addBtn').addEventListener('click', addTask);
  document.getElementById('taskInput').addEventListener('keypress', e => {
    if (e.key === 'Enter') addTask();
  });
  document.getElementById('prevWeekBtn').addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    updateWeekDisplay(); renderTasks(); updateStats(); updateWeekComparison();
  });
  document.getElementById('nextWeekBtn').addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    updateWeekDisplay(); renderTasks(); updateStats(); updateWeekComparison();
  });
  document.getElementById('todayBtn').addEventListener('click', () => {
    currentWeekStart = getWeekStart(new Date());
    updateWeekDisplay(); renderTasks(); updateStats(); updateWeekComparison();
  });
  document.getElementById('backupBtn').addEventListener('click', backupData);
  document.getElementById('clearBtn').addEventListener('click', clearAllTasks);
  document.getElementById('addFriendBtn').addEventListener('click', addFriend);
  document.getElementById('friendEmail').addEventListener('keypress', e => {
    if (e.key === 'Enter') addFriend();
  });
}

// PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}

console.log('🍥 Ninja Mission Tracker loaded!');
