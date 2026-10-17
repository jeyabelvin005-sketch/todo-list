// ============================================
// 🍥 Ninja Mission Tracker - Date Based
// ============================================
let tasks = [];
let currentWeekStart = getWeekStart(new Date());
let currentUser = null;
let userProfile = { email: '', displayName: '' };
let incomingChallenges = [];
let acceptedChallenges = []; // 🆕 Shared Missions

// Calendar States
let p1State = { start: null, end: null, month: new Date().getMonth(), year: new Date().getFullYear() };
let p2State = { start: null, end: null, month: new Date().getMonth(), year: new Date().getFullYear() };

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
// 📅 CALENDAR LOGIC
// ============================================
function openComparePage() {
  closeProfileMenu();
  document.getElementById('comparePage').classList.add('active');
  document.body.classList.add('modal-open');
  
  const now = new Date();
  p1State.month = now.getMonth(); p1State.year = now.getFullYear();
  p2State.month = now.getMonth(); p2State.year = now.getFullYear();
  
  renderCalendar(1);
  renderCalendar(2);
}

function closeComparePage() {
  document.getElementById('comparePage').classList.remove('active');
  document.body.classList.remove('modal-open');
}

function changeMonth(period, dir) {
  const state = period === 1 ? p1State : p2State;
  state.month += dir;
  if (state.month < 0) { state.month = 11; state.year--; }
  if (state.month > 11) { state.month = 0; state.year++; }
  renderCalendar(period);
}

function selectDate(period, dateStr) {
  const state = period === 1 ? p1State : p2State;
  
  if (!state.start || (state.start && state.end)) {
    state.start = dateStr;
    state.end = null;
  } else if (dateStr >= state.start) {
    state.end = dateStr;
  } else {
    state.start = dateStr; 
  }
  renderCalendar(period);
}

function renderCalendar(period) {
  const state = period === 1 ? p1State : p2State;
  const container = document.getElementById(`p${period}Calendar`);
  const monthLabel = document.getElementById(`p${period}MonthLabel`);
  const rangeLabel = document.getElementById(`p${period}RangeLabel`);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  monthLabel.textContent = `${monthNames[state.month]} ${state.year}`;

  const firstDay = new Date(state.year, state.month, 1).getDay();
  const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();

  let html = '';
  for (let i = 0; i < firstDay; i++) html += `<div></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${state.year}-${String(state.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    let classes = 'cal-day';

    if (state.start === dateStr) classes += ' selected start';
    if (state.end === dateStr) classes += ' selected end';
    if (state.start && state.end && dateStr > state.start && dateStr < state.end) classes += ' in-range';

    html += `<div class="${classes}" onclick="selectDate(${period}, '${dateStr}')">${d}</div>`;
  }
  container.innerHTML = html;

  if (state.start && state.end) {
    rangeLabel.textContent = `${state.start} → ${state.end}`;
  } else if (state.start) {
    rangeLabel.textContent = `Start: ${state.start} (Select end date)`;
  } else {
    rangeLabel.textContent = `Select start date`;
  }
}

// ============================================
// 📊 COMPARE LOGIC
// ============================================
function getStatsForRange(startStr, endStr) {
  const start = new Date(startStr); start.setHours(0,0,0,0);
  const end = new Date(endStr); end.setHours(23,59,59,999);
  const today = new Date(); today.setHours(23,59,59,999); 

  if (isNaN(start) || isNaN(end) || start > end) return { total: 0, completed: 0, failed: 0, rate: 0 };

  let total = 0, completed = 0, failed = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d > today) continue; 
    const dateStr = formatDate(d);

    tasks.forEach(task => {
      const taskCreated = new Date(task.createdDate || task.createdAt);
      if (taskCreated <= d) {
        total++;
        if (task.completions && task.completions[dateStr]) completed++;
        else failed++;
      }
    });
  }

  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, failed, rate };
}

function runComparison() {
  if (!p1State.start || !p1State.end) { alert('Please select complete dates for Period 1.'); return; }
  if (!p2State.start || !p2State.end) { alert('Please select complete dates for Period 2.'); return; }

  const stats1 = getStatsForRange(p1State.start, p1State.end);
  const stats2 = getStatsForRange(p2State.start, p2State.end);

  document.getElementById('res1Total').textContent = stats1.total;
  document.getElementById('res1Completed').textContent = stats1.completed;
  document.getElementById('res1Failed').textContent = stats1.failed;
  document.getElementById('res1Rate').textContent = `${stats1.rate}%`;

  document.getElementById('res2Total').textContent = stats2.total;
  document.getElementById('res2Completed').textContent = stats2.completed;
  document.getElementById('res2Failed').textContent = stats2.failed;
  document.getElementById('res2Rate').textContent = `${stats2.rate}%`;

  const verdictEl = document.getElementById('verdictMessage');
  if (stats2.rate > stats1.rate) {
    verdictEl.textContent = `🔥 Period 2 is ${stats2.rate - stats1.rate}% better!`;
    verdictEl.className = 'verdict-message verdict-win';
  } else if (stats1.rate > stats2.rate) {
    verdictEl.textContent = `⚠️ Period 1 was ${stats1.rate - stats2.rate}% better!`;
    verdictEl.className = 'verdict-message verdict-win';
  } else {
    verdictEl.textContent = `⚖️ Both periods have the same success rate.`;
    verdictEl.className = 'verdict-message verdict-tie';
  }

  document.getElementById('compareResults').classList.remove('hidden');
}

// ============================================
// ✅ TASKS LOGIC
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
    text, createdDate: getToday(), completions: {}, createdAt: Date.now()
  };
  const ref = await tasksCol().add(newTask);
  tasks.push({ id: ref.id, ...newTask });
  input.value = '';
  renderTasks(); updateStats(); updateTaskDropdown();
}

async function toggleDay(taskId, dateStr) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  
  if (!task.completions) task.completions = {};
  if (task.completions[dateStr]) delete task.completions[dateStr];
  else task.completions[dateStr] = true;
  
  await tasksCol().doc(taskId).update({ completions: task.completions });
  renderTasks(); updateStats();
}

async function deleteTask(taskId) {
  if (!confirm('Delete this mission?')) return;
  await tasksCol().doc(taskId).delete();
  tasks = tasks.filter(t => t.id !== taskId);
  renderTasks(); updateStats(); updateTaskDropdown();
}

function renderTasks() {
  const tbody = document.getElementById('taskTableBody');
  tbody.innerHTML = '';
  const todayIndex = getTodayIndex();

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
      
      const cellDate = new Date(currentWeekStart);
      cellDate.setDate(cellDate.getDate() + i);
      const dateStr = formatDate(cellDate);
      const isCompleted = task.completions && task.completions[dateStr];

      if (i > todayIndex) {
        dayCell.textContent = '🔒'; dayCell.classList.add('locked'); dayCell.style.cursor = 'not-allowed';
      } else if (i === todayIndex) {
        dayCell.textContent = isCompleted ? '✓' : '○';
        dayCell.classList.add(isCompleted ? 'completed' : 'today');
        dayCell.style.cursor = 'pointer'; dayCell.onclick = () => toggleDay(task.id, dateStr);
      } else {
        dayCell.textContent = isCompleted ? '✓' : '✗';
        dayCell.classList.add(isCompleted ? 'completed' : 'pending');
        dayCell.style.cursor = 'pointer'; dayCell.onclick = () => toggleDay(task.id, dateStr);
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
      const cellDate = new Date(currentWeekStart); cellDate.setDate(cellDate.getDate() + i);
      const dateStr = formatDate(cellDate);
      if (task.completions && task.completions[dateStr]) completed++; else pending++;
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
  const weekEnd = new Date(currentWeekStart); weekEnd.setDate(weekEnd.getDate() + 6);
  document.getElementById('weekLabel').textContent = `${currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const todayIndex = getTodayIndex();

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(currentWeekStart); dayDate.setDate(dayDate.getDate() + i);
    let badge = '';
    if (i === todayIndex) badge = '<br><span style="color:#00d9ff;font-size:11px;">⚔️ Today</span>';
    else if (i < todayIndex) badge = '<br><span style="color:#ff9999;font-size:11px;">Past</span>';
    else badge = '<br><span style="color:#90ee90;font-size:11px;">Future</span>';
    document.getElementById(`day${i + 1}Header`).innerHTML = `${dayNames[i]} ${dayDate.getDate()}${badge}`;
  }
}

// ---------- Profile Dropdown ----------
function toggleProfileMenu() { document.getElementById('profileWrapper').classList.toggle('open'); }
function closeProfileMenu() { document.getElementById('profileWrapper').classList.remove('open'); }

function updateProfileUI() {
  const name = userProfile.displayName || 'Shinobi';
  const email = userProfile.email || currentUser?.email || '';
  const initial = (name || 'S')[0].toUpperCase();
  document.getElementById('profileAvatar').textContent = initial;
  document.getElementById('profileName').textContent = name;
  document.getElementById('dropdownHeaderName').textContent = name;
  document.getElementById('dropdownHeaderEmail').textContent = email;
}

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
  } catch (err) { updateProfileUI(); }
}

function openUsernameModal() {
  closeProfileMenu();
  document.getElementById('usernameModal').classList.add('show');
  document.getElementById('usernameInput').value = userProfile.displayName || '';
  document.getElementById('usernameMessage').className = 'modal-message';
  setTimeout(() => document.getElementById('usernameInput').focus(), 150);
}
function closeUsernameModal() { document.getElementById('usernameModal').classList.remove('show'); }

async function saveUsername() {
  const input = document.getElementById('usernameInput');
  const msg = document.getElementById('usernameMessage');
  const btn = document.getElementById('saveUsernameBtn');
  const name = input.value.trim();

  if (name.length < 2 || name.length > 20) {
    msg.textContent = 'Name should be 2-20 characters.'; msg.className = 'modal-message show error'; return;
  }
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  try {
    await userDoc(currentUser.uid).set({ displayName: name, updatedAt: Date.now() }, { merge: true });
    userProfile.displayName = name; updateProfileUI();
    msg.textContent = '✓ Name updated!'; msg.className = 'modal-message show success';
    setTimeout(() => { closeUsernameModal(); btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Save'; loadLeaderboard(); }, 1000);
  } catch (err) {
    msg.textContent = 'Error saving.'; msg.className = 'modal-message show error';
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Save';
  }
}

// ============================================
// 🤝 FRIEND CHALLENGES & SHARED MISSIONS
// ============================================
async function sendChallenge() {
  const email = document.getElementById('friendEmail').value.trim().toLowerCase();
  const select = document.getElementById('challengeTaskSelect');
  const taskText = select.options[select.selectedIndex]?.dataset.text || '';

  if (!select.value || !email) { showFriendMessage('Select a mission and enter email.', 'error'); return; }
  showFriendMessage('Sending...', 'info');
  
  try {
    const userSnap = await db.collection('users').where('email', '==', email).limit(1).get();
    if (userSnap.empty) { showFriendMessage(`No shinobi found.`, 'error'); return; }

    await challengesCol().add({
      fromUid: currentUser.uid, fromName: userProfile.displayName, fromEmail: currentUser.email,
      toEmail: email, toUid: userSnap.docs[0].id, taskText: taskText,
      weekKey: getWeekKey(), status: 'pending', createdAt: Date.now()
    });
    showFriendMessage(`🍥 Challenge sent!`, 'success');
    document.getElementById('friendEmail').value = ''; select.value = ''; 
    loadChallenges();
  } catch (err) { showFriendMessage('Error. Try again.', 'error'); }
}

async function loadChallenges() {
  if (!currentUser) return;
  try {
    // Get all challenges sent TO me
    const snap = await challengesCol().where('toUid', '==', currentUser.uid).get();
    const allChallenges = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    incomingChallenges = allChallenges.filter(c => c.status === 'pending');
    acceptedChallenges = allChallenges.filter(c => c.status === 'accepted'); 
    
    renderIncomingChallenges();
    renderSharedMissions(); 
  } catch (err) {
    console.error('Load challenges error:', err);
  }
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
    </div>`).join('');
}

// 🆕 SHARED MISSIONS (Accepted Tasks)
function renderSharedMissions() {
  const section = document.getElementById('sharedMissionsSection');
  const list = document.getElementById('sharedMissionsList');
  const count = document.getElementById('sharedCount');

  if (acceptedChallenges.length === 0) { section.style.display = 'none'; return; }

  section.style.display = 'block';
  count.textContent = acceptedChallenges.length;

  const todayStr = getToday();

  list.innerHTML = acceptedChallenges.map(c => {
    const isCompleted = c.completions && c.completions[todayStr];
    return `
      <div class="shared-item">
        <div class="shared-info">
          <span class="shared-from">🥷 From ${escapeHtml(c.fromName)}</span>
          <span class="shared-task">${escapeHtml(c.taskText)}</span>
        </div>
        <button class="shared-toggle ${isCompleted ? 'done' : ''}" onclick="toggleSharedDay('${c.id}', '${todayStr}')">
          ${isCompleted ? '<i class="fas fa-check"></i> Done Today' : '<i class="fas fa-circle"></i> Mark Done'}
        </button>
      </div>
    `;
  }).join('');
}

async function toggleSharedDay(challengeId, dateStr) {
  const challenge = acceptedChallenges.find(c => c.id === challengeId);
  if (!challenge) return;

  if (!challenge.completions) challenge.completions = {};

  if (challenge.completions[dateStr]) delete challenge.completions[dateStr];
  else challenge.completions[dateStr] = true;

  try {
    await challengesCol().doc(challengeId).update({ completions: challenge.completions });
    renderSharedMissions(); // Refresh UI
    loadLeaderboard(); // Update score
  } catch (err) { console.error('Error updating shared task:', err); }
}

async function acceptChallenge(id) { 
  await challengesCol().doc(id).update({ status: 'accepted' }); 
  loadChallenges(); 
  loadLeaderboard(); 
  showFriendMessage('🍥 Challenge accepted! Check Shared Missions.', 'success');
}

async function rejectChallenge(id) { 
  await challengesCol().doc(id).update({ status: 'rejected' }); 
  loadChallenges(); 
}

// ============================================
// 🏆 LEADERBOARD
// ============================================
async function loadLeaderboard() {
  const container = document.getElementById('leaderboard');
  try {
    const [sSnap, rSnap] = await Promise.all([
      challengesCol().where('fromUid', '==', currentUser.uid).where('status', '==', 'accepted').get(),
      challengesCol().where('toEmail', '==', currentUser.email).where('status', '==', 'accepted').get()
    ]);
    const friendUids = new Set();
    sSnap.docs.forEach(d => friendUids.add(d.data().toUid));
    rSnap.docs.forEach(d => friendUids.add(d.data().fromUid));
    const allUids = [currentUser.uid, ...Array.from(friendUids)];

    if (allUids.length === 1) { container.innerHTML = `<div class="empty-leaderboard"><p>No challenges yet.</p></div>`; document.getElementById('friendCount').textContent = '0 shinobi'; return; }

    const userDocs = await Promise.all(allUids.map(uid => userDoc(uid).get()));
    const entries = [];

    for (const doc of userDocs) {
      if (!doc.exists) continue;
      let count = 0;
      const tIdx = getTodayIndex();
      
      if (doc.id === currentUser.uid) {
        for (let i = 0; i <= tIdx && i < 7; i++) {
          const d = new Date(currentWeekStart); d.setDate(d.getDate() + i); const ds = formatDate(d);
          tasks.forEach(t => { if (t.completions && t.completions[ds]) count++; });
        }
      } else {
        const tSnap = await userDoc(doc.id).collection('tasks').get();
        tSnap.docs.forEach(td => {
          const t = td.data();
          for (let i = 0; i <= tIdx && i < 7; i++) {
            const d = new Date(currentWeekStart); d.setDate(d.getDate() + i); const ds = formatDate(d);
            if (t.completions && t.completions[ds]) count++;
          }
        });
      }
      
      // Add shared missions to count
      const sharedSnap = await challengesCol().where('toUid', '==', doc.id).where('status', '==', 'accepted').get();
      sharedSnap.docs.forEach(sd => {
        const c = sd.data();
        for (let i = 0; i <= tIdx && i < 7; i++) {
          const d = new Date(currentWeekStart); d.setDate(d.getDate() + i); const ds = formatDate(d);
          if (c.completions && c.completions[ds]) count++;
        }
      });

      entries.push({ uid: doc.id, name: doc.data().displayName, email: doc.data().email, count, self: doc.id === currentUser.uid });
    }

    entries.sort((a,b) => b.count - a.count);
    document.getElementById('friendCount').textContent = `${entries.length} shinobi`;
    container.innerHTML = entries.map((e, i) => `
      <div class="leaderboard-item ${e.self ? 'is-self' : ''}">
        <span class="rank-badge">${i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1)}</span>
        <div class="friend-avatar">${(e.name||'S')[0].toUpperCase()}</div>
        <div class="friend-info"><span class="friend-name">${escapeHtml(e.name)}${e.self?' (You)':''}</span><span class="friend-email">${escapeHtml(e.email)}</span></div>
        <div class="friend-score"><span class="score-value">${e.count}</span><span class="score-label">completed</span></div>
      </div>`).join('');
  } catch(e) { console.error(e); }
}

// ---------- Helpers & Init ----------
function showFriendMessage(text, type) {
  const el = document.getElementById('friendMessage'); if (!el) return;
  el.textContent = text; el.className = `friend-message show ${type}`;
  if (type === 'success') setTimeout(() => el.className = 'friend-message', 4000);
}
function escapeHtml(str) { return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); const isDark = document.body.classList.contains('dark-mode'); localStorage.setItem('darkMode', isDark); document.getElementById('darkModeBtn').innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>'; }
function checkDarkMode() { if (localStorage.getItem('darkMode') === 'true') { document.body.classList.add('dark-mode'); document.getElementById('darkModeBtn').innerHTML = '<i class="fas fa-sun"></i>'; } }
function logoutUser() { closeProfileMenu(); if (confirm('Logout?')) auth.signOut(); }
function backupData() { const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `missions_${getToday()}.json`; a.click(); }
function exportBackupFromMenu() { closeProfileMenu(); backupData(); }
async function clearAllTasks() { if (tasks.length === 0 || !confirm('Delete ALL?')) return; const b = db.batch(); tasks.forEach(t => b.delete(tasksCol().doc(t.id))); await b.commit(); tasks = []; renderTasks(); updateStats(); loadLeaderboard(); }

auth.onAuthStateChanged(async (user) => {
  const loader = document.getElementById('rasenganLoader'); const main = document.getElementById('mainContainer');
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

    await loadChallenges(); 
    await loadLeaderboard();
    
    if (loader) loader.classList.add('hide'); 
    if (main) main.style.opacity = '1';
  } catch (err) { console.error(err); if (loader) loader.classList.add('hide'); if (main) main.style.opacity = '1'; }
});

window.toggleDarkMode = toggleDarkMode; window.deleteTask = deleteTask; window.logoutUser = logoutUser;
window.openUsernameModal = openUsernameModal; window.closeUsernameModal = closeUsernameModal;
window.acceptChallenge = acceptChallenge; window.rejectChallenge = rejectChallenge;
window.exportBackupFromMenu = exportBackupFromMenu;
window.openComparePage = openComparePage; window.closeComparePage = closeComparePage;
window.runComparison = runComparison; window.changeMonth = changeMonth; window.selectDate = selectDate;
window.toggleSharedDay = toggleSharedDay; // 🆕 Expose this!

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js').catch(() => {}));
console.log('🍥 Ninja Mission Tracker loaded!');
