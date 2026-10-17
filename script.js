// ============================================
// 🍥 Ninja Mission Tracker
// ============================================
let tasks = [];
let currentWeekStart = getWeekStart(new Date());
let currentUser = null;
let userProfile = { email: '', displayName: '' };
let incomingChallenges = [];
let outgoingChallenges = [];

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
function tasksCol() {
  return db.collection('users').doc(currentUser.uid).collection('tasks');
}

function userDoc(uid) {
  return db.collection('users').doc(uid);
}

function challengesCol() {
  return db.collection('challenges');
}

// ============================================
// 👤 PROFILE DROPDOWN MENU
// ============================================
function toggleProfileMenu() {
  const wrapper = document.getElementById('profileWrapper');
  const btn = document.getElementById('profileBtn');
  const isOpen = wrapper.classList.contains('open');

  if (isOpen) {
    wrapper.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  } else {
    wrapper.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
  }
}

function closeProfileMenu() {
  const wrapper = document.getElementById('profileWrapper');
  const btn = document.getElementById('profileBtn');
  if (wrapper) wrapper.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function updateProfileUI() {
  const name = userProfile.displayName || 'Shinobi';
  const email = userProfile.email || currentUser?.email || '';
  const initial = (name || 'S')[0].toUpperCase();

  const avatarEl = document.getElementById('profileAvatar');
  const nameEl = document.getElementById('profileName');
  const headerNameEl = document.getElementById('dropdownHeaderName');
  const headerEmailEl = document.getElementById('dropdownHeaderEmail');

  if (avatarEl) avatarEl.textContent = initial;
  if (nameEl) nameEl.textContent = name;
  if (headerNameEl) headerNameEl.textContent = name;
  if (headerEmailEl) headerEmailEl.textContent = email;
}

function exportBackupFromMenu() {
  closeProfileMenu();
  backupData();
}

async function loadProfile() {
  try {
    const snap = await userDoc(currentUser.uid).get();
    if (snap.exists && snap.data().displayName) {
      userProfile.displayName = snap.data().displayName;
    } else {
      const defaultName = (currentUser.email || 'shinobi').split('@')[0];
      userProfile.displayName = defaultName;
      await userDoc(currentUser.uid).set({
        email: currentUser.email,
        displayName: defaultName,
        createdAt: Date.now()
      }, { merge: true });
    }
    userProfile.email = currentUser.email;
    updateProfileUI();
  } catch (err) {
    console.error('Profile load error:', err);
    userProfile.displayName = (currentUser.email || 'shinobi').split('@')[0];
    userProfile.email = currentUser.email;
    updateProfileUI();
  }
}

// ---------- Username Modal ----------
function openUsernameModal() {
  closeProfileMenu();
  const modal = document.getElementById('usernameModal');
  const input = document.getElementById('usernameInput');
  const msg = document.getElementById('usernameMessage');
  msg.className = 'modal-message';
  input.value = userProfile.displayName || '';
  modal.classList.add('show');
  document.body.classList.add('modal-open');
  setTimeout(() => input.focus(), 150);
}

function closeUsernameModal() {
  document.getElementById('usernameModal').classList.remove('show');
  document.body.classList.remove('modal-open');
}

async function saveUsername() {
  const input = document.getElementById('usernameInput');
  const msg = document.getElementById('usernameMessage');
  const btn = document.getElementById('saveUsernameBtn');
  const name = input.value.trim();

  if (!name) { msg.textContent = 'Please enter a name.'; msg.className = 'modal-message show error'; return; }
  if (name.length < 2) { msg.textContent = 'Name should be at least 2 characters.'; msg.className = 'modal-message show error'; return; }
  if (name.length > 20) { msg.textContent = 'Name should be under 20 characters.'; msg.className = 'modal-message show error'; return; }
  if (!/^[a-zA-Z0-9_ ]+$/.test(name)) { msg.textContent = 'Use letters, numbers, spaces, and underscore only.'; msg.className = 'modal-message show error'; return; }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  try {
    await userDoc(currentUser.uid).set({
      displayName: name,
      email: currentUser.email,
      updatedAt: Date.now()
    }, { merge: true });

    userProfile.displayName = name;
    updateProfileUI();

    msg.textContent = '✓ Ninja name updated!';
    msg.className = 'modal-message show success';

    setTimeout(async () => {
      closeUsernameModal();
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check"></i> Save';
      await loadChallenges();
      await loadLeaderboard();
    }, 1000);
  } catch (err) {
    console.error(err);
    msg.textContent = 'Could not save. Try again.';
    msg.className = 'modal-message show error';
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check"></i> Save';
  }
}

// ============================================
// 📊 WEEKLY PROGRESS REPORT (Spreadsheet)
// ============================================
function openProgressReport() {
  closeProfileMenu();
  renderProgressReport();
  const modal = document.getElementById('progressReportModal');
  modal.classList.add('show');
  document.body.classList.add('modal-open');
}

function closeProgressReport() {
  document.getElementById('progressReportModal').classList.remove('show');
  document.body.classList.remove('modal-open');
}

function getDaySpecificStats(dayIndex, weekOffset) {
  // weekOffset: 0 = this week, -1 = last week
  const todayIndex = getTodayIndex();
  // For last week, all days are past. For this week, future days are locked.
  if (weekOffset === 0 && dayIndex > todayIndex) {
    return { completed: 0, total: 0, locked: true };
  }

  let completed = 0;
  let total = 0;

  const weekStartCheck = new Date(currentWeekStart);
  weekStartCheck.setDate(weekStartCheck.getDate() + (weekOffset * 7));
  
  // The specific date for this day
  const targetDate = new Date(weekStartCheck);
  targetDate.setDate(targetDate.getDate() + dayIndex);
  targetDate.setHours(23, 59, 59, 999);

  tasks.forEach(task => {
    const taskCreatedDate = task.createdDate
      ? new Date(task.createdDate)
      : new Date(task.createdAt || Date.now());

    // Count only if task existed on or before this day
    if (taskCreatedDate <= targetDate) {
      total++;
      if (task.days[dayIndex]) completed++;
    }
  });

  return { completed, total, locked: false };
}

function renderProgressReport() {
  const tbody = document.getElementById('progressReportBody');
  if (!tbody) return;

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let html = '';

  for (let i = 0; i < 7; i++) {
    const thisWeek = getDaySpecificStats(i, 0);
    const lastWeek = getDaySpecificStats(i, -1);
    
    let thisWeekDisplay = `${thisWeek.completed}/${thisWeek.total}`;
    let lastWeekDisplay = `${lastWeek.completed}/${lastWeek.total}`;
    
    if (thisWeek.locked) {
      thisWeekDisplay = '🔒';
    }

    let diff = thisWeek.completed - lastWeek.completed;
    let diffHtml = '—';
    
    if (!thisWeek.locked) {
      if (diff > 0) diffHtml = `<span style="color:#4ade80; font-weight:bold;">+${diff}</span>`;
      else if (diff < 0) diffHtml = `<span style="color:#ff5555; font-weight:bold;">${diff}</span>`;
      else diffHtml = `<span style="color:#aaa;">0</span>`;
    }

    html += `
      <tr>
        <td style="font-weight:700; color:#ffd700;">${days[i]}</td>
        <td>${lastWeekDisplay}</td>
        <td style="color:#00d9ff; font-weight:bold;">${thisWeekDisplay}</td>
        <td>${diffHtml}</td>
      </tr>
    `;
  }

  tbody.innerHTML = html;
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
  updateTaskDropdown();
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
}

async function deleteTask(taskId) {
  if (!confirm('Delete this mission?')) return;
  await tasksCol().doc(taskId).delete();
  tasks = tasks.filter(t => t.id !== taskId);
  renderTasks();
  updateStats();
  updateTaskDropdown();
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

// ---------- Task Dropdown ----------
function updateTaskDropdown() {
  const select = document.getElementById('challengeTaskSelect');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Select a mission to challenge...</option>' +
    tasks.map(t => `<option value="${escapeHtml(t.id)}" data-text="${escapeHtml(t.text)}">${escapeHtml(t.text)}</option>`).join('');
  if (current) select.value = current;
}

// ============================================
// 🎯 CHALLENGES SYSTEM
// ============================================
async function sendChallenge() {
  const emailInput = document.getElementById('friendEmail');
  const select = document.getElementById('challengeTaskSelect');
  const email = emailInput.value.trim().toLowerCase();
  const taskId = select.value;
  const taskText = select.options[select.selectedIndex]?.dataset.text || '';

  if (!taskId) { showFriendMessage('Please select a mission to challenge.', 'error'); return; }
  if (!email) { showFriendMessage('Please enter a friend\'s email.', 'error'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showFriendMessage('Please enter a valid email.', 'error'); return; }
  if (email === (currentUser.email || '').toLowerCase()) { showFriendMessage("You can't challenge yourself! 😅", 'error'); return; }

  showFriendMessage('Sending challenge...', 'info');

  try {
    const userSnap = await db.collection('users').where('email', '==', email).limit(1).get();
    if (userSnap.empty) { showFriendMessage(`No shinobi found with "${email}". They need to signup first!`, 'error'); return; }

    const existing = await challengesCol()
      .where('fromUid', '==', currentUser.uid)
      .where('toEmail', '==', email)
      .where('taskText', '==', taskText)
      .where('status', '==', 'pending')
      .get();

    if (!existing.empty) { showFriendMessage('You already have a pending challenge for this mission!', 'error'); return; }

    await challengesCol().add({
      fromUid: currentUser.uid,
      fromName: userProfile.displayName,
      fromEmail: currentUser.email,
      toEmail: email,
      toUid: userSnap.docs[0].id,
      taskText: taskText,
      weekKey: getWeekKey(),
      status: 'pending',
      createdAt: Date.now()
    });

    showFriendMessage(`🍥 Challenge sent to ${email} for "${taskText}"!`, 'success');
    emailInput.value = '';
    select.value = '';
    await loadChallenges();
  } catch (err) {
    console.error(err);
    showFriendMessage('Something went wrong. Try again.', 'error');
  }
}

async function loadChallenges() {
  if (!currentUser) return;
  try {
    const incomingSnap = await challengesCol().where('toEmail', '==', currentUser.email).get();
    incomingChallenges = incomingSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.status === 'pending');

    const outgoingSnap = await challengesCol().where('fromUid', '==', currentUser.uid).get();
    outgoingChallenges = outgoingSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    renderIncomingChallenges();
  } catch (err) {
    console.error('Load challenges error:', err);
  }
}

function renderIncomingChallenges() {
  const section = document.getElementById('incomingSection');
  const list = document.getElementById('incomingList');
  const count = document.getElementById('incomingCount');

  if (incomingChallenges.length === 0) { section.style.display = 'none'; return; }

  section.style.display = 'block';
  count.textContent = incomingChallenges.length;

  list.innerHTML = incomingChallenges.map(c => `
    <div class="incoming-item">
      <div class="incoming-info">
        <span class="incoming-from">🥷 ${escapeHtml(c.fromName)}</span>
        <span class="incoming-task">challenged you on "<strong>${escapeHtml(c.taskText)}</strong>"</span>
      </div>
      <div class="incoming-actions">
        <button class="accept-btn" onclick="acceptChallenge('${c.id}')">
          <i class="fas fa-check"></i> Accept
        </button>
        <button class="reject-btn" onclick="rejectChallenge('${c.id}')">
          <i class="fas fa-times"></i> Reject
        </button>
      </div>
    </div>
  `).join('');
}

async function acceptChallenge(challengeId) {
  try {
    await challengesCol().doc(challengeId).update({ status: 'accepted', acceptedAt: Date.now() });
    await loadChallenges();
    await loadLeaderboard();
    showFriendMessage('🍥 Challenge accepted! Now compare on the leaderboard.', 'success');
  } catch (err) { console.error(err); }
}

async function rejectChallenge(challengeId) {
  if (!confirm('Reject this challenge?')) return;
  try {
    await challengesCol().doc(challengeId).update({ status: 'rejected', rejectedAt: Date.now() });
    await loadChallenges();
    showFriendMessage('Challenge rejected.', 'info');
  } catch (err) { console.error(err); }
}

// ============================================
// 🏆 LEADERBOARD
// ============================================
async function loadLeaderboard() {
  const container = document.getElementById('leaderboard');
  try {
    const [sentSnap, receivedSnap] = await Promise.all([
      challengesCol().where('fromUid', '==', currentUser.uid).where('status', '==', 'accepted').get(),
      challengesCol().where('toEmail', '==', currentUser.email).where('status', '==', 'accepted').get()
    ]);

    const friendUids = new Set();
    sentSnap.docs.forEach(d => friendUids.add(d.data().toUid));
    receivedSnap.docs.forEach(d => friendUids.add(d.data().fromUid));

    const allUids = [currentUser.uid, ...Array.from(friendUids)];

    if (allUids.length === 1) {
      container.innerHTML = `<div class="empty-leaderboard"><span>🥷</span><p>No accepted challenges yet. Send a challenge and wait for them to accept!</p></div>`;
      document.getElementById('friendCount').textContent = '0 shinobi';
      return;
    }

    const userDocs = await Promise.all(allUids.map(uid => userDoc(uid).get()));
    const entries = [];

    for (const docSnap of userDocs) {
      if (!docSnap.exists) continue;
      const uid = docSnap.id;
      const data = docSnap.data();
      let weeklyCount = 0;

      if (uid === currentUser.uid) {
        const todayIdx = getTodayIndex();
        for (let i = 0; i <= todayIdx && i < 7; i++) {
          tasks.forEach(t => { if (t.days[i]) weeklyCount++; });
        }
      } else {
        try {
          const taskSnap = await userDoc(uid).collection('tasks').get();
          const todayIdx = getTodayIndex();
          taskSnap.docs.forEach(td => {
            const t = td.data();
            const days = t.days || [];
            for (let i = 0; i <= todayIdx && i < 7; i++) { if (days[i]) weeklyCount++; }
          });
        } catch (err) { console.warn('Cannot read friend tasks:', err); }
      }

      entries.push({
        uid, displayName: data.displayName || 'Shinobi', email: data.email || '', thisWeek: weeklyCount, isSelf: uid === currentUser.uid
      });
    }

    entries.sort((a, b) => b.thisWeek - a.thisWeek);
    document.getElementById('friendCount').textContent = `${entries.length} shinobi`;

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
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Leaderboard error:', err);
    container.innerHTML = `<div class="empty-leaderboard"><p>Could not load leaderboard.</p></div>`;
  }
}

// ---------- Helpers ----------
function showFriendMessage(text, type) {
  const el = document.getElementById('friendMessage');
  if (!el) return;
  el.textContent = text;
  el.className = `friend-message show ${type}`;
  if (type === 'success' || type === 'info') { setTimeout(() => { el.className = 'friend-message'; }, 4500); }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
}

function updateWeekDisplay() {
  const weekEnd = new Date(currentWeekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const startMonth = currentWeekStart.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });
  document.getElementById('weekLabel').textContent = `${startMonth} ${currentWeekStart.getDate()} - ${endMonth} ${weekEnd.getDate()}`;

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
  document.getElementById('darkModeBtn').innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

function checkDarkMode() {
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
    document.getElementById('darkModeBtn').innerHTML = '<i class="fas fa-sun"></i>';
  }
}

// ---------- Other Actions ----------
function logoutUser() {
  closeProfileMenu();
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
    updateTaskDropdown();
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
    console.error('Init error:', err);
    if (loader) loader.classList.add('hide');
    if (main) main.style.opacity = '1';
  }
});

// ---------- Global functions (onclick handlers) ----------
window.toggleDarkMode = toggleDarkMode;
window.deleteTask = deleteTask;
window.logoutUser = logoutUser;
window.openUsernameModal = openUsernameModal;
window.closeUsernameModal = closeUsernameModal;
window.acceptChallenge = acceptChallenge;
window.rejectChallenge = rejectChallenge;
window.exportBackupFromMenu = exportBackupFromMenu;
window.openProgressReport = openProgressReport;
window.closeProgressReport = closeProgressReport;

let listenersAttached = false;
function attachEventListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  const profileBtn = document.getElementById('profileBtn');
  if (profileBtn) {
    profileBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleProfileMenu(); });
  }

  document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('profileWrapper');
    if (wrapper && !wrapper.contains(e.target)) closeProfileMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeProfileMenu();
      const um = document.getElementById('usernameModal');
      if (um && um.classList.contains('show')) closeUsernameModal();
      const pm = document.getElementById('progressReportModal');
      if (pm && pm.classList.contains('show')) closeProgressReport();
    }
  });

  const usernameModal = document.getElementById('usernameModal');
  if (usernameModal) {
    usernameModal.addEventListener('click', (e) => { if (e.target.id === 'usernameModal') closeUsernameModal(); });
  }

  const progressReportModal = document.getElementById('progressReportModal');
  if (progressReportModal) {
    progressReportModal.addEventListener('click', (e) => { if (e.target.id === 'progressReportModal') closeProgressReport(); });
  }

  document.getElementById('addBtn').addEventListener('click', addTask);
  document.getElementById('taskInput').addEventListener('keypress', e => { if (e.key === 'Enter') addTask(); });

  document.getElementById('prevWeekBtn').addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    updateWeekDisplay(); renderTasks(); updateStats();
  });
  document.getElementById('nextWeekBtn').addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    updateWeekDisplay(); renderTasks(); updateStats();
  });
  document.getElementById('todayBtn').addEventListener('click', () => {
    currentWeekStart = getWeekStart(new Date());
    updateWeekDisplay(); renderTasks(); updateStats();
  });

  document.getElementById('backupBtn').addEventListener('click', backupData);
  document.getElementById('clearBtn').addEventListener('click', clearAllTasks);

  document.getElementById('addFriendBtn').addEventListener('click', sendChallenge);
  document.getElementById('friendEmail').addEventListener('keypress', e => { if (e.key === 'Enter') sendChallenge(); });

  document.getElementById('saveUsernameBtn').addEventListener('click', saveUsername);
  document.getElementById('usernameInput').addEventListener('keypress', e => { if (e.key === 'Enter') saveUsername(); });
}

// PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('service-worker.js').catch(() => {}); });
}

console.log('🍥 Ninja Mission Tracker loaded!');
