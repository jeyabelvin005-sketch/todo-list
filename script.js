// ============================================
// 🍥 Ninja Mission Tracker - Date Based
// ============================================
let tasks = [];
let currentWeekStart = getWeekStart(new Date());
let currentUser = null;
let userProfile = { email: '', displayName: '' };
let incomingChallenges = [];

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

function getWeekKey(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// ---------- Firestore Refs ----------
function tasksCol() { return db.collection('users').doc(currentUser.uid).collection('tasks'); }
function userDoc(uid) { return db.collection('users').doc(uid); }
function challengesCol() { return db.collection('challenges'); }

// ============================================
// 👤 PROFILE DROPDOWN MENU
// ============================================
function toggleProfileMenu() {
  const wrapper = document.getElementById('profileWrapper');
  const btn = document.getElementById('profileBtn');
  const isOpen = wrapper.classList.contains('open');
  wrapper.classList.toggle('open', !isOpen);
  btn.setAttribute('aria-expanded', String(!isOpen));
}

function closeProfileMenu() {
  document.getElementById('profileWrapper').classList.remove('open');
}

function updateProfileUI() {
  const name = userProfile.displayName || 'Shinobi';
  const email = userProfile.email || currentUser?.email || '';
  const initial = (name || 'S')[0].toUpperCase();

  document.getElementById('profileAvatar').textContent = initial;
  document.getElementById('profileName').textContent = name;
  document.getElementById('dropdownHeaderName').textContent = name;
  document.getElementById('dropdownHeaderEmail').textContent = email;
}

function exportBackupFromMenu() { closeProfileMenu(); backupData(); }

async function loadProfile() {
  try {
    const snap = await userDoc(currentUser.uid).get();
    if (snap.exists && snap.data().displayName) {
      userProfile.displayName = snap.data().displayName;
    } else {
      const defaultName = (currentUser.email || 'shinobi').split('@')[0];
      userProfile.displayName = defaultName;
      await userDoc(currentUser.uid).set({ email: currentUser.email, displayName: defaultName, createdAt: Date.now() }, { merge: true });
    }
    userProfile.email = currentUser.email;
    updateProfileUI();
  } catch (err) {
    userProfile.displayName = (currentUser.email || 'shinobi').split('@')[0];
    userProfile.email = currentUser.email;
    updateProfileUI();
  }
}

// ---------- Username Modal ----------
function openUsernameModal() {
  closeProfileMenu();
  document.getElementById('usernameModal').classList.add('show');
  document.getElementById('usernameInput').value = userProfile.displayName || '';
  document.getElementById('usernameMessage').className = 'modal-message';
  setTimeout(() => document.getElementById('usernameInput').focus(), 150);
}

function closeUsernameModal() {
  document.getElementById('usernameModal').classList.remove('show');
}

async function saveUsername() {
  const input = document.getElementById('usernameInput');
  const msg = document.getElementById('usernameMessage');
  const btn = document.getElementById('saveUsernameBtn');
  const name = input.value.trim();

  if (name.length < 2 || name.length > 20) {
    msg.textContent = 'Name should be 2-20 characters.';
    msg.className = 'modal-message show error'; return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  try {
    await userDoc(currentUser.uid).set({ displayName: name, email: currentUser.email, updatedAt: Date.now() }, { merge: true });
    userProfile.displayName = name;
    updateProfileUI();
    msg.textContent = '✓ Ninja name updated!';
    msg.className = 'modal-message show success';
    setTimeout(() => {
      closeUsernameModal();
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check"></i> Save';
      loadChallenges();
      loadLeaderboard();
    }, 1000);
  } catch (err) {
    msg.textContent = 'Could not save. Try again.';
    msg.className = 'modal-message show error';
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check"></i> Save';
  }
}

// ============================================
// 📊 COMPARE PAGE (New Feature)
// ============================================
function openComparePage() {
  closeProfileMenu();
  document.getElementById('comparePage').classList.add('active');
  document.body.classList.add('modal-open');
  
  // Set default dates if empty (Last week vs This week)
  const today = new Date();
  const thisMon = new Date(today); thisMon.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
  const lastMon = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7);
  const lastSun = new Date(thisMon); lastSun.setDate(thisMon.getDate() - 1);
  const thisSun = new Date(thisMon); thisSun.setDate(thisMon.getDate() + 6);

  if (!document.getElementById('p1Start').value) {
    document.getElementById('p1Start').value = formatDate(lastMon);
    document.getElementById('p1End').value = formatDate(lastSun);
    document.getElementById('p2Start').value = formatDate(thisMon);
    document.getElementById('p2End').value = formatDate(thisSun);
  }
}

function closeComparePage() {
  document.getElementById('comparePage').classList.remove('active');
  document.body.classList.remove('modal-open');
}

function getStatsForRange(startStr, endStr) {
  const start = new Date(startStr);
  const end = new Date(endStr);
  start.setHours(0,0,0,0);
  end.setHours(23,59,59,999);
  
  const today = new Date();
  today.setHours(23,59,59,999); // End of today

  if (isNaN(start) || isNaN(end) || start > end) return { total: 0, completed: 0, failed: 0, rate: 0 };

  let total = 0, completed = 0, failed = 0;

  // Loop through each day in the range
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    // Only count if the day is today or in the past
    if (d > today) continue;

    const dateStr = formatDate(d);

    tasks.forEach(task => {
      const taskCreated = new Date(task.createdDate || task.createdAt);
      // Only count if task existed on this day
      if (taskCreated <= d) {
        total++;
        // Check if completion exists for this specific date
        if (task.completions && task.completions[dateStr]) {
          completed++;
        } else {
          failed++;
        }
      }
    });
  }

  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, failed, rate };
}

function runComparison() {
  const p1s = document.getElementById('p1Start').value;
  const p1e = document.getElementById('p1End').value;
  const p2s = document.getElementById('p2Start').value;
  const p2e = document.getElementById('p2End').value;

  if (!p1s || !p1e || !p2s || !p2e) {
    alert('Please select all 4 dates.'); return;
  }

  const stats1 = getStatsForRange(p1s, p1e);
  const stats2 = getStatsForRange(p2s, p2e);

  // Update UI
  document.getElementById('res1Total').textContent = stats1.total;
  document.getElementById('res1Completed').textContent = stats1.completed;
  document.getElementById('res1Failed').textContent = stats1.failed;
  document.getElementById('res1Rate').textContent = `${stats1.rate}%`;

  document.getElementById('res2Total').textContent = stats2.total;
  document.getElementById('res2Completed').textContent = stats2.completed;
  document.getElementById('res2Failed').textContent = stats2.failed;
  document.getElementById('res2Rate').textContent = `${stats2.rate}%`;

  // Determine winner
  const verdictEl = document.getElementById('verdictMessage');
  if (stats2.rate > stats1.rate) {
    verdictEl.textContent = `🔥 Period 2 is ${stats2.rate - stats1.rate}% better!`;
    verdictEl.className = 'verdict-message verdict-win';
  } else if (stats1.rate > stats2.rate) {
    verdictEl.textContent = `⚠️ Period 1 was ${stats1.rate - stats2.rate}% better!`;
    verdictEl.className = 'verdict-message verdict-win'; // Still show green
  } else {
    verdictEl.textContent = `⚖️ Both periods have the same success rate.`;
    verdictEl.className = 'verdict-message verdict-tie';
  }

  document.getElementById('compareResults').classList.remove('hidden');
}

// ============================================
// ✅ TASKS LOGIC (Date-Based)
// ============================================
async function loadTasks() {
  const snap = await tasksCol().orderBy('createdAt', 'asc').get();
  tasks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function addTask() {
  const input = document.getElementById('taskInput');
  const text = input.value.trim();
  if (!text) { alert('Please enter a mission!'); return; }
  
  const newTask = {
    text,
    createdDate: getToday(),
    completions: {}, // 🆕 New Date-based storage
    createdAt: Date.now()
  };
  const ref = await tasksCol().add(newTask);
  tasks.push({ id: ref.id, ...newTask });
  input.value = '';
  renderTasks();
  updateStats();
  updateTaskDropdown();
}

async function toggleDay(taskId, dateStr) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  
  if (!task.completions) task.completions = {};
  
  if (task.completions[dateStr]) {
    delete task.completions[dateStr];
  } else {
    task.completions[dateStr] = true;
  }
  
  await tasksCol().doc(taskId).update({ completions: task.completions });
  renderTasks();
  updateStats();
}

async function deleteTask(taskId) {
  if (!confirm('Delete this mission?')) return;
  await tasksCol().doc(taskId).delete();
  tasks = tasks.filter(t => t.id !== taskId);
  renderTasks();
  updateStats();
  updateTaskDropdown();
}

function renderTasks() {
  const tbody = document.getElementById('taskTableBody');
  tbody.innerHTML = '';
  const todayIndex = getTodayIndex();
  const todayStr = getToday();

  if (tasks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#ffa500;">📜 No missions assigned yet.</td></tr>';
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
      
      // Calculate the exact date for this cell
      const cellDate = new Date(currentWeekStart);
      cellDate.setDate(cellDate.getDate() + i);
      const dateStr = formatDate(cellDate);
      
      const isCompleted = task.completions && task.completions[dateStr];

      if (i > todayIndex) {
        dayCell.textContent = '🔒';
        dayCell.classList.add('locked');
        dayCell.style.cursor = 'not-allowed';
      } else if (i === todayIndex) {
        if (isCompleted) {
          dayCell.textContent = '✓';
          dayCell.classList.add('completed');
        } else {
          dayCell.textContent = '○';
          dayCell.classList.add('today');
        }
        dayCell.style.cursor = 'pointer';
        dayCell.onclick = () => toggleDay(task.id, dateStr);
      } else {
        if (isCompleted) {
          dayCell.textContent = '✓';
          dayCell.classList.add('completed');
        } else {
          dayCell.textContent = '✗';
          dayCell.classList.add('pending');
        }
        dayCell.style.cursor = 'pointer';
        dayCell.onclick = () => toggleDay(task.id, dateStr);
      }
      row.appendChild(dayCell);
    }
    tbody.appendChild(row);
  });
}

function updateStats() {
  document.getElementById('totalTasks').textContent = tasks.length;
  const todayIndex = getTodayIndex();
  let completed = 0, pending = 0;

  tasks.forEach(task => {
    for (let i = 0; i <= todayIndex && i < 7; i++) {
      const cellDate = new Date(currentWeekStart);
      cellDate.setDate(cellDate.getDate() + i);
      const dateStr = formatDate(cellDate);
      
      if (task.completions && task.completions[dateStr]) completed++;
      else pending++;
    }
  });
  
  document.getElementById('completedTasks').textContent = completed;
  document.getElementById('pendingTasks').textContent = pending;
}

function updateTaskDropdown() {
  const select = document.getElementById('challengeTaskSelect');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Select a mission...</option>' +
    tasks.map(t => `<option value="${escapeHtml(t.id)}" data-text="${escapeHtml(t.text)}">${escapeHtml(t.text)}</option>`).join('');
  if (current) select.value = current;
}

function updateWeekDisplay() {
  const weekEnd = new Date(currentWeekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  document.getElementById('weekLabel').textContent = `${currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const todayIndex = getTodayIndex();

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(currentWeekStart);
    dayDate.setDate(dayDate.getDate() + i);
    let badge = '';
    if (i === todayIndex) badge = '<br><span style="color:#00d9ff;font-size:11px;">⚔️ Today</span>';
    else if (i < todayIndex) badge = '<br><span style="color:#ff9999;font-size:11px;">Past</span>';
    else badge = '<br><span style="color:#90ee90;font-size:11px;">Future</span>';
    document.getElementById(`day${i + 1}Header`).innerHTML = `${dayNames[i]} ${dayDate.getDate()}${badge}`;
  }
}

// ============================================
// 🎯 CHALLENGES SYSTEM
// ============================================
async function sendChallenge() {
  const email = document.getElementById('friendEmail').value.trim().toLowerCase();
  const select = document.getElementById('challengeTaskSelect');
  const taskText = select.options[select.selectedIndex]?.dataset.text || '';

  if (!select.value || !email) { showFriendMessage('Select a mission and enter email.', 'error'); return; }
  if (email === (currentUser.email || '').toLowerCase()) { showFriendMessage("You can't challenge yourself!", 'error'); return; }

  showFriendMessage('Sending...', 'info');
  try {
    const userSnap = await db.collection('users').where('email', '==', email).limit(1).get();
    if (userSnap.empty) { showFriendMessage(`No shinobi found with "${email}".`, 'error'); return; }

    await challengesCol().add({
      fromUid: currentUser.uid, fromName: userProfile.displayName, fromEmail: currentUser.email,
      toEmail: email, toUid: userSnap.docs[0].id, taskText: taskText,
      weekKey: getWeekKey(), status: 'pending', createdAt: Date.now()
    });

    showFriendMessage(`🍥 Challenge sent!`, 'success');
    document.getElementById('friendEmail').value = '';
    select.value = '';
    loadChallenges();
  } catch (err) { showFriendMessage('Error. Try again.', 'error'); }
}

async function loadChallenges() {
  const incomingSnap = await challengesCol().where('toEmail', '==', currentUser.email).get();
  incomingChallenges = incomingSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.status === 'pending');
  renderIncomingChallenges();
}

function renderIncomingChallenges() {
  const section = document.getElementById('incomingSection');
  const list = document.getElementById('incomingList');
  
  if (incomingChallenges.length === 0) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  document.getElementById('incomingCount').textContent = incomingChallenges.length;

  list.innerHTML = incomingChallenges.map(c => `
    <div class="incoming-item">
      <div class="incoming-info">
        <span class="incoming-from">🥷 ${escapeHtml(c.fromName)}</span>
        <span class="incoming-task">challenged you on "<strong>${escapeHtml(c.taskText)}</strong>"</span>
      </div>
      <div class="incoming-actions">
        <button class="accept-btn" onclick="acceptChallenge('${c.id}')">Accept</button>
        <button class="reject-btn" onclick="rejectChallenge('${c.id}')">Reject</button>
      </div>
    </div>
  `).join('');
}

async function acceptChallenge(id) {
  await challengesCol().doc(id).update({ status: 'accepted', acceptedAt: Date.now() });
  loadChallenges(); loadLeaderboard();
  showFriendMessage('🍥 Challenge accepted!', 'success');
}

async function rejectChallenge(id) {
  await challengesCol().doc(id).update({ status: 'rejected', rejectedAt: Date.now() });
  loadChallenges(); showFriendMessage('Challenge rejected.', 'info');
}

async function loadLeaderboard() {
  const container = document.getElementById('leaderboard');
  const [sentSnap, recvSnap] = await Promise.all([
    challengesCol().where('fromUid', '==', currentUser.uid).where('status', '==', 'accepted').get(),
    challengesCol().where('toEmail', '==', currentUser.email).where('status', '==', 'accepted').get()
  ]);

  const friendUids = new Set();
  sentSnap.docs.forEach(d => friendUids.add(d.data().toUid));
  recvSnap.docs.forEach(d => friendUids.add(d.data().fromUid));

  const allUids = [currentUser.uid, ...Array.from(friendUids)];

  if (allUids.length === 1) {
    container.innerHTML = `<div class="empty-leaderboard"><span>🥷</span><p>No accepted challenges yet.</p></div>`;
    document.getElementById('friendCount').textContent = '0 shinobi'; return;
  }

  const userDocs = await Promise.all(allUids.map(uid => userDoc(uid).get()));
  const entries = [];

  for (const doc of userDocs) {
    if (!doc.exists) continue;
    let weeklyCount = 0;
    
    // Calculate current week for each user
    if (doc.id === currentUser.uid) {
      const todayIdx = getTodayIndex();
      for (let i = 0; i <= todayIdx && i < 7; i++) {
        const d = new Date(currentWeekStart); d.setDate(d.getDate() + i);
        const dStr = formatDate(d);
        tasks.forEach(t => { if (t.completions && t.completions[dStr]) weeklyCount++; });
      }
    } else {
      try {
        const tSnap = await userDoc(doc.id).collection('tasks').get();
        const todayIdx = getTodayIndex();
        tSnap.docs.forEach(td => {
          const t = td.data();
          for (let i = 0; i <= todayIdx && i < 7; i++) {
            const d = new Date(currentWeekStart); d.setDate(d.getDate() + i);
            const dStr = formatDate(d);
            if (t.completions && t.completions[dStr]) weeklyCount++;
          }
        });
      } catch (e) { console.warn(e); }
    }

    entries.push({ uid: doc.id, name: doc.data().displayName, email: doc.data().email, count: weeklyCount, self: doc.id === currentUser.uid });
  }

  entries.sort((a, b) => b.count - a.count);
  document.getElementById('friendCount').textContent = `${entries.length} shinobi`;

  container.innerHTML = entries.map((e, idx) => {
    const rank = idx + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
    return `
      <div class="leaderboard-item ${e.self ? 'is-self' : ''}">
        <span class="rank-badge">${medal}</span>
        <div class="friend-avatar">${(e.name||'S')[0].toUpperCase()}</div>
        <div class="friend-info">
          <span class="friend-name">${escapeHtml(e.name)}${e.self ? ' (You)' : ''}</span>
          <span class="friend-email">${escapeHtml(e.email)}</span>
        </div>
        <div class="friend-score"><span class="score-value">${e.count}</span><span class="score-label">completed</span></div>
      </div>
    `;
  }).join('');
}

// ---------- Helpers ----------
function showFriendMessage(text, type) {
  const el = document.getElementById('friendMessage');
  if (!el) return;
  el.textContent = text; el.className = `friend-message show ${type}`;
  if (type === 'success') setTimeout(() => el.className = 'friend-message', 4000);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('darkMode', isDark);
  document.getElementById('darkModeBtn').innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}
function checkDarkMode() {
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
    document.getElementById('darkModeBtn').innerHTML = '<i class="fas fa-sun"></i>';
  }
}

function logoutUser() { closeProfileMenu(); if (confirm('Logout?')) auth.signOut(); }
function backupData() {
  const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `missions_${getToday()}.json`; a.click();
}
async function clearAllTasks() {
  if (tasks.length === 0 || !confirm('Delete ALL missions?')) return;
  const batch = db.batch(); tasks.forEach(t => batch.delete(tasksCol().doc(t.id)));
  await batch.commit(); tasks = []; renderTasks(); updateStats(); updateTaskDropdown(); loadLeaderboard();
}

// ---------- Init ----------
auth.onAuthStateChanged(async (user) => {
  const loader = document.getElementById('rasenganLoader');
  const main = document.getElementById('mainContainer');

  setTimeout(() => { if (loader) loader.classList.add('hide'); if (main) main.style.opacity = '1'; }, 1500);

  if (!user) { window.location.href = 'login.html'; return; }
  currentUser = user;

  try {
    await loadProfile();
    await loadTasks();
    updateWeekDisplay();
    renderTasks();
    updateStats();
    updateTaskDropdown();
    checkDarkMode();
    attachEventListeners();
    await loadChallenges();
    await loadLeaderboard();

    if (loader) loader.classList.add('hide');
    if (main) main.style.opacity = '1';
  } catch (err) {
    console.error(err);
    if (loader) loader.classList.add('hide');
    if (main) main.style.opacity = '1';
  }
});

window.toggleDarkMode = toggleDarkMode;
window.deleteTask = deleteTask;
window.logoutUser = logoutUser;
window.openUsernameModal = openUsernameModal;
window.closeUsernameModal = closeUsernameModal;
window.acceptChallenge = acceptChallenge;
window.rejectChallenge = rejectChallenge;
window.exportBackupFromMenu = exportBackupFromMenu;
window.openComparePage = openComparePage;
window.closeComparePage = closeComparePage;
window.runComparison = runComparison;

let listenersAttached = false;
function attachEventListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  document.getElementById('profileBtn').addEventListener('click', (e) => { e.stopPropagation(); toggleProfileMenu(); });
  document.addEventListener('click', (e) => { if (!document.getElementById('profileWrapper').contains(e.target)) closeProfileMenu(); });

  document.getElementById('addBtn').addEventListener('click', addTask);
  document.getElementById('taskInput').addEventListener('keypress', e => { if (e.key === 'Enter') addTask(); });

  document.getElementById('prevWeekBtn').addEventListener('click', () => { currentWeekStart.setDate(currentWeekStart.getDate() - 7); updateWeekDisplay(); renderTasks(); updateStats(); });
  document.getElementById('nextWeekBtn').addEventListener('click', () => { currentWeekStart.setDate(currentWeekStart.getDate() + 7); updateWeekDisplay(); renderTasks(); updateStats(); });
  document.getElementById('todayBtn').addEventListener('click', () => { currentWeekStart = getWeekStart(new Date()); updateWeekDisplay(); renderTasks(); updateStats(); });

  document.getElementById('backupBtn').addEventListener('click', backupData);
  document.getElementById('clearBtn').addEventListener('click', clearAllTasks);
  document.getElementById('addFriendBtn').addEventListener('click', sendChallenge);
  document.getElementById('saveUsernameBtn').addEventListener('click', saveUsername);
  document.getElementById('usernameInput').addEventListener('keypress', e => { if (e.key === 'Enter') saveUsername(); });
}

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js').catch(() => {}));
console.log('🍥 Ninja Mission Tracker loaded!');
