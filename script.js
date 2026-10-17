// ============================================
// 🍥 Ninja Mission Tracker - Date Based
// ============================================
let tasks = [];
let currentWeekStart = getWeekStart(new Date());
let currentUser = null;
let userProfile = { email: '', displayName: '' };

// Challenge States
let incomingChallenges = [];
let incomingFollowRequests = []; 
let incomingTaskChallenges = []; 
let acceptedChallenges = []; 
let outgoingChallenges = []; 
let searchedUser = null;
let activeProfileUser = null; // For Friend Profile Modal

// Calendar States
let p1State = { start: null, end: null, month: new Date().getMonth(), year: new Date().getFullYear() };
let p2State = { start: null, end: null, month: new Date().getMonth(), year: new Date().getFullYear() };

// 🛡️ SAFE LISTENER
function on(id, event, callback) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, callback);
}

// ---------- Date Helpers ----------
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff); d.setHours(0, 0, 0, 0);
  return d;
}
function formatDate(date) {
  const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function getToday() { return formatDate(new Date()); }
function getTodayIndex() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekStart = new Date(currentWeekStart); weekStart.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today - weekStart) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return -1; if (diffDays > 6) return 7; return diffDays;
}
function getWeekKey(date = new Date()) {
  const d = new Date(date); const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day); const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// ---------- Firestore Refs ----------
function tasksCol() { return db.collection('users').doc(currentUser.uid).collection('tasks'); }
function userDoc(uid) { return db.collection('users').doc(uid); }
function challengesCol() { return db.collection('challenges'); }

// ============================================
// 🔔 FOLLOW REQUESTS PAGE
// ============================================
function openFollowRequestsPage() {
  const page = document.getElementById('followRequestsPage');
  if (page) page.classList.add('active');
  document.body.classList.add('modal-open');
  renderFollowRequests();
}

function closeFollowRequestsPage() {
  const page = document.getElementById('followRequestsPage');
  if (page) page.classList.remove('active');
  document.body.classList.remove('modal-open');
}

function renderFollowRequests() {
  const list = document.getElementById('followRequestsList');
  if (!list) return;

  if (incomingFollowRequests.length === 0) {
    list.innerHTML = `<div class="empty-leaderboard"><span>🔔</span><p>No new follow requests.</p></div>`;
    return;
  }

  list.innerHTML = incomingFollowRequests.map(c => `
    <div class="follow-req-item">
      <div class="follow-req-info">
        <div class="follow-req-avatar">${(c.fromName || 'S')[0].toUpperCase()}</div>
        <div>
          <div class="follow-req-name">${escapeHtml(c.fromName)}</div>
          <div class="follow-req-text">Wants to follow you</div>
        </div>
      </div>
      <div class="incoming-actions">
        <button class="accept-btn" onclick="acceptChallenge('${c.id}')">Accept</button>
        <button class="reject-btn" onclick="rejectChallenge('${c.id}')">Reject</button>
      </div>
    </div>
  `).join('');
}

// ============================================
// 👤 FRIEND PROFILE MODAL (Send Mission)
// ============================================
function openFriendProfile(uid, name, email) {
  activeProfileUser = { uid, name, email };
  
  document.getElementById('friendProfileAvatar').textContent = (name || 'S')[0].toUpperCase();
  document.getElementById('friendProfileName').textContent = name;
  document.getElementById('friendProfileEmail').textContent = email;
  
  // Populate task dropdown
  const select = document.getElementById('profileTaskSelect');
  select.innerHTML = '<option value="">Select one of your missions...</option>' + 
    tasks.map(t => `<option value="${escapeHtml(t.id)}" data-text="${escapeHtml(t.text)}">${escapeHtml(t.text)}</option>`).join('');
  
  document.getElementById('profileMessage').className = 'modal-message';
  document.getElementById('friendProfileModal').classList.add('show');
}

function closeFriendProfileModal() {
  document.getElementById('friendProfileModal').classList.remove('show');
  activeProfileUser = null;
}

async function sendMissionFromProfile() {
  if (!activeProfileUser) return;
  const select = document.getElementById('profileTaskSelect');
  const msg = document.getElementById('profileMessage');
  
  if (!select.value) {
    msg.textContent = 'Please select a mission first.';
    msg.className = 'modal-message show error';
    return;
  }

  const taskText = select.options[select.selectedIndex].dataset.text;
  const btn = document.getElementById('sendMissionFromProfileBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

  try {
    await challengesCol().add({
      fromUid: currentUser.uid, fromName: userProfile.displayName, fromEmail: currentUser.email,
      toEmail: activeProfileUser.email, toUid: activeProfileUser.uid, taskText: taskText,
      weekKey: getWeekKey(), status: 'pending', createdAt: Date.now()
    });
    
    msg.textContent = `🍥 Mission "${taskText}" sent to ${activeProfileUser.name}!`;
    msg.className = 'modal-message show success';
    select.value = '';
    
    setTimeout(() => { closeFriendProfileModal(); }, 2000);
  } catch (err) {
    msg.textContent = 'Error sending mission.';
    msg.className = 'modal-message show error';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Invite';
  }
}

// ============================================
// 📅 CALENDAR LOGIC
// ============================================
function openComparePage() {
  closeProfileMenu(); 
  const cp = document.getElementById('comparePage');
  if(cp) cp.classList.add('active'); 
  document.body.classList.add('modal-open');
  const now = new Date(); p1State.month = now.getMonth(); p1State.year = now.getFullYear(); p2State.month = now.getMonth(); p2State.year = now.getFullYear();
  renderCalendar(1); renderCalendar(2);
}
function closeComparePage() { 
  const cp = document.getElementById('comparePage');
  if(cp) cp.classList.remove('active'); 
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
  if (!state.start || (state.start && state.end)) { state.start = dateStr; state.end = null; }
  else if (dateStr >= state.start) { state.end = dateStr; }
  else { state.start = dateStr; }
  renderCalendar(period);
}
function renderCalendar(period) {
  const state = period === 1 ? p1State : p2State;
  const container = document.getElementById(`p${period}Calendar`);
  const monthLabel = document.getElementById(`p${period}MonthLabel`);
  const rangeLabel = document.getElementById(`p${period}RangeLabel`);
  if(!container) return;

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
  if (state.start && state.end) rangeLabel.textContent = `${state.start} → ${state.end}`;
  else if (state.start) rangeLabel.textContent = `Start: ${state.start} (Select end)`;
  else rangeLabel.textContent = `Select start date`;
}

// ============================================
// 📊 COMPARE LOGIC
// ============================================
function getStatsForRange(startStr, endStr) {
  const start = new Date(startStr); start.setHours(0,0,0,0); const end = new Date(endStr); end.setHours(23,59,59,999);
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
        if (task.completions && task.completions[dateStr]) completed++; else failed++;
      }
    });
  }
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, failed, rate };
}
function runComparison() {
  if (!p1State.start || !p1State.end) { alert('Select complete dates for Period 1.'); return; }
  if (!p2State.start || !p2State.end) { alert('Select complete dates for Period 2.'); return; }
  const stats1 = getStatsForRange(p1State.start, p1State.end); const stats2 = getStatsForRange(p2State.start, p2State.end);
  
  const r1T = document.getElementById('res1Total'); if(r1T) r1T.textContent = stats1.total;
  const r1C = document.getElementById('res1Completed'); if(r1C) r1C.textContent = stats1.completed;
  const r1F = document.getElementById('res1Failed'); if(r1F) r1F.textContent = stats1.failed;
  const r1R = document.getElementById('res1Rate'); if(r1R) r1R.textContent = `${stats1.rate}%`;
  
  const r2T = document.getElementById('res2Total'); if(r2T) r2T.textContent = stats2.total;
  const r2C = document.getElementById('res2Completed'); if(r2C) r2C.textContent = stats2.completed;
  const r2F = document.getElementById('res2Failed'); if(r2F) r2F.textContent = stats2.failed;
  const r2R = document.getElementById('res2Rate'); if(r2R) r2R.textContent = `${stats2.rate}%`;

  const verdictEl = document.getElementById('verdictMessage');
  if(verdictEl) {
    if (stats2.rate > stats1.rate) { verdictEl.textContent = `🔥 Period 2 is ${stats2.rate - stats1.rate}% better!`; verdictEl.className = 'verdict-message verdict-win'; }
    else if (stats1.rate > stats2.rate) { verdictEl.textContent = `⚠️ Period 1 was ${stats1.rate - stats2.rate}% better!`; verdictEl.className = 'verdict-message verdict-win'; }
    else { verdictEl.textContent = `⚖️ Both periods have the same success rate.`; verdictEl.className = 'verdict-message verdict-tie'; }
  }
  const resDiv = document.getElementById('compareResults'); if(resDiv) resDiv.classList.remove('hidden');
}

// ============================================
// ✅ TASKS LOGIC
// ============================================
async function loadTasks() {
  const snap = await tasksCol().orderBy('createdAt', 'asc').get();
  tasks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
async function addTask() {
  const input = document.getElementById('taskInput'); if(!input) return;
  const text = input.value.trim(); if (!text) { alert('Please enter a mission!'); return; }
  const newTask = { text, createdDate: getToday(), completions: {}, createdAt: Date.now() };
  const ref = await tasksCol().add(newTask); tasks.push({ id: ref.id, ...newTask });
  input.value = ''; renderTasks(); updateStats();
}
async function toggleDay(taskId, dateStr) {
  const task = tasks.find(t => t.id === taskId); if (!task) return;
  if (!task.completions) task.completions = {};
  if (task.completions[dateStr]) delete task.completions[dateStr]; else task.completions[dateStr] = true;
  await tasksCol().doc(taskId).update({ completions: task.completions }); renderTasks(); updateStats();
}
async function deleteTask(taskId) {
  if (!confirm('Delete this mission?')) return; await tasksCol().doc(taskId).delete();
  tasks = tasks.filter(t => t.id !== taskId); renderTasks(); updateStats();
}
function renderTasks() {
  const tbody = document.getElementById('taskTableBody'); if(!tbody) return;
  tbody.innerHTML = ''; const todayIndex = getTodayIndex();
  if (tasks.length === 0) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#ffa500;">📜 No missions assigned yet.</td></tr>'; return; }
  tasks.forEach((task, index) => {
    const row = document.createElement('tr'); row.style.animationDelay = `${index * 0.05}s`;
    const nameCell = document.createElement('td'); nameCell.innerHTML = `${task.text} <button class="delete-btn" onclick="deleteTask('${task.id}')">Delete</button>`; row.appendChild(nameCell);
    for (let i = 0; i < 7; i++) {
      const dayCell = document.createElement('td'); dayCell.className = 'checkbox';
      const cellDate = new Date(currentWeekStart); cellDate.setDate(cellDate.getDate() + i); const dateStr = formatDate(cellDate);
      const isCompleted = task.completions && task.completions[dateStr];
      if (i > todayIndex) { dayCell.textContent = '🔒'; dayCell.classList.add('locked'); dayCell.style.cursor = 'not-allowed'; }
      else if (i === todayIndex) { dayCell.textContent = isCompleted ? '✓' : '○'; dayCell.classList.add(isCompleted ? 'completed' : 'today'); dayCell.style.cursor = 'pointer'; dayCell.onclick = () => toggleDay(task.id, dateStr); }
      else { dayCell.textContent = isCompleted ? '✓' : '✗'; dayCell.classList.add(isCompleted ? 'completed' : 'pending'); dayCell.style.cursor = 'pointer'; dayCell.onclick = () => toggleDay(task.id, dateStr); }
      row.appendChild(dayCell);
    }
    tbody.appendChild(row);
  });
}
function updateStats() {
  const tt = document.getElementById('totalTasks'); if(tt) tt.textContent = tasks.length;
  const todayIndex = getTodayIndex(); let completed = 0, pending = 0;
  tasks.forEach(task => {
    for (let i = 0; i <= todayIndex && i < 7; i++) {
      const cellDate = new Date(currentWeekStart); cellDate.setDate(cellDate.getDate() + i); const dateStr = formatDate(cellDate);
      if (task.completions && task.completions[dateStr]) completed++; else pending++;
    }
  });
  const ct = document.getElementById('completedTasks'); if(ct) ct.textContent = completed; 
  const pt = document.getElementById('pendingTasks'); if(pt) pt.textContent = pending;
}
function updateWeekDisplay() {
  const wl = document.getElementById('weekLabel'); if(!wl) return;
  const weekEnd = new Date(currentWeekStart); weekEnd.setDate(weekEnd.getDate() + 6);
  wl.textContent = `${currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; const todayIndex = getTodayIndex();
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(currentWeekStart); dayDate.setDate(dayDate.getDate() + i);
    let badge = '';
    if (i === todayIndex) badge = '<br><span style="color:#00d9ff;font-size:11px;">⚔️ Today</span>';
    else if (i < todayIndex) badge = '<br><span style="color:#ff9999;font-size:11px;">Past</span>';
    else badge = '<br><span style="color:#90ee90;font-size:11px;">Future</span>';
    const dh = document.getElementById(`day${i + 1}Header`); 
    if (dh) dh.innerHTML = `${dayNames[i]} ${dayDate.getDate()}${badge}`;
  }
}

// ---------- Profile Dropdown ----------
function toggleProfileMenu() { const pw = document.getElementById('profileWrapper'); if(pw) pw.classList.toggle('open'); }
function closeProfileMenu() { const pw = document.getElementById('profileWrapper'); if(pw) pw.classList.remove('open'); }
function updateProfileUI() {
  const name = userProfile.displayName || 'Shinobi'; const email = userProfile.email || currentUser?.email || ''; const initial = (name || 'S')[0].toUpperCase();
  const pa = document.getElementById('profileAvatar'); if(pa) pa.textContent = initial;
  const pn = document.getElementById('profileName'); if(pn) pn.textContent = name;
  const dhn = document.getElementById('dropdownHeaderName'); if(dhn) dhn.textContent = name;
  const dhe = document.getElementById('dropdownHeaderEmail'); if(dhe) dhe.textContent = email;
}
async function loadProfile() {
  try {
    const snap = await userDoc(currentUser.uid).get();
    if (snap.exists && snap.data().displayName) { userProfile.displayName = snap.data().displayName; }
    else { const defaultName = (currentUser.email || 'shinobi').split('@')[0]; userProfile.displayName = defaultName; await userDoc(currentUser.uid).set({ email: currentUser.email, displayName: defaultName, createdAt: Date.now() }, { merge: true }); }
    userProfile.email = currentUser.email; updateProfileUI();
  } catch (err) { updateProfileUI(); }
}
function openUsernameModal() {
  closeProfileMenu(); 
  const um = document.getElementById('usernameModal'); if(um) um.classList.add('show'); 
  const ui = document.getElementById('usernameInput'); if(ui) ui.value = userProfile.displayName || ''; 
  const msg = document.getElementById('usernameMessage'); if(msg) msg.className = 'modal-message'; 
  setTimeout(() => { if(ui) ui.focus(); }, 150);
}
function closeUsernameModal() { const um = document.getElementById('usernameModal'); if(um) um.classList.remove('show'); }
async function saveUsername() {
  const input = document.getElementById('usernameInput'); const msg = document.getElementById('usernameMessage'); const btn = document.getElementById('saveUsernameBtn'); 
  if(!input || !msg || !btn) return;
  const name = input.value.trim();
  if (name.length < 2 || name.length > 20) { msg.textContent = 'Name should be 2-20 characters.'; msg.className = 'modal-message show error'; return; }
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  try {
    await userDoc(currentUser.uid).set({ displayName: name, updatedAt: Date.now() }, { merge: true }); userProfile.displayName = name; updateProfileUI();
    msg.textContent = '✓ Name updated!'; msg.className = 'modal-message show success';
    setTimeout(() => { closeUsernameModal(); btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Save'; loadLeaderboard(); }, 1000);
  } catch (err) { msg.textContent = 'Error saving.'; msg.className = 'modal-message show error'; btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Save'; }
}

// ============================================
// 🔍 SEARCH & FOLLOW LOGIC
// ============================================
async function searchFriend() {
  const emailInput = document.getElementById('searchFriendEmail');
  const resultCard = document.getElementById('searchResultCard');
  const msg = document.getElementById('friendMessage');
  if(!emailInput || !resultCard || !msg) return;

  const email = emailInput.value.trim().toLowerCase();
  msg.className = 'friend-message';

  if (!email) { alert('Please enter an email to search.'); return; }

  try {
    const snap = await db.collection('users').where('email', '==', email).limit(1).get();
    if (snap.empty) { resultCard.style.display = 'none'; showFriendMessage('No shinobi found with this email.', 'error'); return; }
    const doc = snap.docs[0];
    if (doc.id === currentUser.uid) { resultCard.style.display = 'none'; showFriendMessage("You can't search for yourself!", 'error'); return; }

    searchedUser = { uid: doc.id, ...doc.data() };
    const sa = document.getElementById('searchAvatar'); if(sa) sa.textContent = (searchedUser.displayName || 'S')[0].toUpperCase();
    const sn = document.getElementById('searchName'); if(sn) sn.textContent = searchedUser.displayName || 'Shinobi';
    const se = document.getElementById('searchEmail'); if(se) se.textContent = searchedUser.email;
    resultCard.style.display = 'flex';

    const isFriend = acceptedChallenges.some(c => c.fromUid === searchedUser.uid || c.toUid === searchedUser.uid);
    const isPending = outgoingChallenges.some(c => c.toUid === searchedUser.uid && c.status === 'pending');
    const actionArea = document.getElementById('searchActionArea');

    if (isFriend) {
      if(actionArea) actionArea.innerHTML = `
        <div style="display:flex; gap:8px;">
            <button class="unfollow-btn" onclick="removeFriend('${searchedUser.uid}')"><i class="fas fa-user-check"></i> Following</button>
            <button class="follow-btn" style="background:linear-gradient(135deg, #ffd700, #ffa500); color:#000;" onclick="openFriendProfile('${searchedUser.uid}', '${searchedUser.displayName}', '${searchedUser.email}')"><i class="fas fa-user-circle"></i> Profile</button>
        </div>
      `;
    } else if (isPending) {
      if(actionArea) actionArea.innerHTML = `<button class="pending-btn"><i class="fas fa-clock"></i> Pending</button>`;
    } else {
      if(actionArea) actionArea.innerHTML = `<button class="follow-btn" onclick="followFriend('${searchedUser.uid}')"><i class="fas fa-heart"></i> Follow</button>`;
    }
  } catch (err) { console.error(err); alert('Error searching.'); }
}

async function followFriend(uid) {
  try {
    await challengesCol().add({
      fromUid: currentUser.uid, fromName: userProfile.displayName, fromEmail: currentUser.email,
      toEmail: searchedUser.email, toUid: searchedUser.uid, taskText: "Follow Request",
      weekKey: getWeekKey(), status: 'pending', createdAt: Date.now()
    });
    showFriendMessage(`🍥 Follow request sent to ${searchedUser.displayName}!`, 'success');
    await loadChallenges(); 
    searchFriend(); 
  } catch (err) { console.error(err); }
}

async function loadChallenges() {
  if (!currentUser) return;
  try {
    const toSnap = await challengesCol().where('toUid', '==', currentUser.uid).get();
    const incomingAll = toSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const fromSnap = await challengesCol().where('fromUid', '==', currentUser.uid).get();
    outgoingChallenges = fromSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    incomingChallenges = incomingAll.filter(c => c.status === 'pending');
    acceptedChallenges = incomingAll.filter(c => c.status === 'accepted'); 
    
    incomingFollowRequests = incomingChallenges.filter(c => c.taskText === 'Follow Request');
    incomingTaskChallenges = incomingChallenges.filter(c => c.taskText !== 'Follow Request');
    
    renderIncomingChallenges();
    renderFollowRequests();
    renderSharedMissions(); 
    
    const dot = document.getElementById('notificationDot');
    if (dot) {
      dot.style.display = (incomingFollowRequests.length > 0 || incomingTaskChallenges.length > 0) ? 'block' : 'none';
    }
  } catch (err) { console.error('Load challenges error:', err); }
}

function renderIncomingChallenges() {
  const section = document.getElementById('incomingSection');
  const list = document.getElementById('incomingList');
  
  if (!section || !list) return;
  if (incomingTaskChallenges.length === 0) { section.style.display = 'none'; return; }
  
  section.style.display = 'block';
  const ic = document.getElementById('incomingCount'); if(ic) ic.textContent = incomingTaskChallenges.length;
  
  list.innerHTML = incomingTaskChallenges.map(c => `
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

function renderSharedMissions() {
  const section = document.getElementById('sharedMissionsSection');
  const list = document.getElementById('sharedMissionsList');
  const count = document.getElementById('sharedCount');
  if(!section || !list) return;

  const missions = acceptedChallenges.filter(c => c.taskText !== 'Follow Request');
  if (missions.length === 0) { section.style.display = 'none'; return; }

  section.style.display = 'block';
  if(count) count.textContent = missions.length;
  const todayIndex = getTodayIndex();

  list.innerHTML = missions.map(c => {
    let daysHtml = '';
    for (let i = 0; i < 7; i++) {
      const cellDate = new Date(currentWeekStart); cellDate.setDate(cellDate.getDate() + i);
      const dateStr = formatDate(cellDate);
      const isCompleted = c.completions && c.completions[dateStr];
      
      let stateClass = 'shared-day';
      let symbol = '○';

      if (i > todayIndex) { stateClass += ' locked'; symbol = '🔒'; }
      else if (i === todayIndex) { stateClass += isCompleted ? ' completed' : ' today'; symbol = isCompleted ? '✓' : '○'; }
      else { stateClass += isCompleted ? ' completed' : ' pending'; symbol = isCompleted ? '✓' : '✗'; }

      const disabled = i > todayIndex ? 'disabled' : '';
      daysHtml += `<button class="${stateClass}" ${disabled} onclick="toggleSharedDay('${c.id}', '${dateStr}')">${symbol}</button>`;
    }
    return `
      <div class="shared-card">
        <div class="shared-info">
          <span class="shared-from">🥷 From ${escapeHtml(c.fromName)}</span>
          <span class="shared-task">${escapeHtml(c.taskText)}</span>
        </div>
        <div class="shared-week-grid">${daysHtml}</div>
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
    renderSharedMissions(); loadLeaderboard(); 
  } catch (err) { console.error('Error updating shared task:', err); }
}

async function acceptChallenge(id) { 
  await challengesCol().doc(id).update({ status: 'accepted' }); 
  loadChallenges(); loadLeaderboard(); showFriendMessage('🍥 Accepted!', 'success');
}
async function rejectChallenge(id) { 
  await challengesCol().doc(id).update({ status: 'rejected' }); 
  loadChallenges(); 
}
async function removeFriend(friendUid) {
  if (!confirm('Unfollow this shinobi?')) return;
  try {
    const [sSnap, rSnap] = await Promise.all([
      challengesCol().where('fromUid', '==', currentUser.uid).where('toUid', '==', friendUid).get(),
      challengesCol().where('fromUid', '==', friendUid).where('toUid', '==', currentUser.uid).get()
    ]);
    const b = db.batch(); sSnap.forEach(d => b.delete(d.ref)); rSnap.forEach(d => b.delete(d.ref));
    await b.commit(); await loadChallenges(); await loadLeaderboard();
    const src = document.getElementById('searchResultCard'); if(src) src.style.display = 'none';
    showFriendMessage('Shinobi removed.', 'info');
  } catch (err) { console.error(err); }
}

// ============================================
// 🏆 LEADERBOARD
// ============================================
async function loadLeaderboard() {
  const container = document.getElementById('leaderboard'); if(!container) return;
  try {
    const [sSnap, rSnap] = await Promise.all([
      challengesCol().where('fromUid', '==', currentUser.uid).where('status', '==', 'accepted').get(),
      challengesCol().where('toEmail', '==', currentUser.email).where('status', '==', 'accepted').get()
    ]);
    const fUids = new Set();
    sSnap.docs.forEach(d => fUids.add(d.data().toUid)); rSnap.docs.forEach(d => fUids.add(d.data().fromUid));
    const allUids = [currentUser.uid, ...Array.from(fUids)];

    if (allUids.length === 1) { container.innerHTML = `<div class="empty-leaderboard"><p>No friends yet.</p></div>`; const fc = document.getElementById('friendCount'); if(fc) fc.textContent = '0 friends'; return; }

    const userDocs = await Promise.all(allUids.map(uid => userDoc(uid).get()));
    const entries = [];
    for (const doc of userDocs) {
      if (!doc.exists) continue;
      let count = 0; const tIdx = getTodayIndex();
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
      const sharedSnap = await challengesCol().where('toUid', '==', doc.id).where('status', '==', 'accepted').get();
      sharedSnap.docs.forEach(sd => {
        const c = sd.data(); if (c.taskText === 'Follow Request') return;
        for (let i = 0; i <= tIdx && i < 7; i++) {
          const d = new Date(currentWeekStart); d.setDate(d.getDate() + i); const ds = formatDate(d);
          if (c.completions && c.completions[ds]) count++;
        }
      });
      entries.push({ uid: doc.id, name: doc.data().displayName, email: doc.data().email, count, self: doc.id === currentUser.uid });
    }

    entries.sort((a,b) => b.count - a.count);
    const fc = document.getElementById('friendCount'); if(fc) fc.textContent = `${entries.length} friends`;
    
    container.innerHTML = entries.map((e, i) => `
      <div class="leaderboard-item ${e.self ? 'is-self' : ''}">
        <span class="rank-badge">${i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1)}</span>
        <div class="friend-avatar">${(e.name||'S')[0].toUpperCase()}</div>
        <div class="friend-info" style="cursor:pointer;" onclick="${!e.self ? `openFriendProfile('${e.uid}', '${e.name}', '${e.email}')` : ''}">
            <span class="friend-name" style="text-decoration: ${!e.self ? 'underline' : 'none'};">${escapeHtml(e.name)}${e.self?' (You)':''}</span>
            <span class="friend-email">${escapeHtml(e.email)}</span>
        </div>
        <div class="friend-score"><span class="score-value">${e.count}</span><span class="score-label">completed</span></div>
        ${!e.self ? `<button class="remove-friend-btn" onclick="removeFriend('${e.uid}')" title="Unfollow"><i class="fas fa-user-minus"></i></button>` : ''}
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
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); const isDark = document.body.classList.contains('dark-mode'); localStorage.setItem('darkMode', isDark); const btn = document.getElementById('darkModeBtn'); if(btn) btn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>'; }
function checkDarkMode() { if (localStorage.getItem('darkMode') === 'true') { document.body.classList.add('dark-mode'); const btn = document.getElementById('darkModeBtn'); if(btn) btn.innerHTML = '<i class="fas fa-sun"></i>'; } }
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
    await loadProfile(); await loadTasks(); updateWeekDisplay(); renderTasks(); updateStats(); checkDarkMode();
    
    on('profileBtn', 'click', (e) => { e.stopPropagation(); toggleProfileMenu(); });
    document.addEventListener('click', (e) => { const pw = document.getElementById('profileWrapper'); if (pw && !pw.contains(e.target)) closeProfileMenu(); });
    
    on('addBtn', 'click', addTask);
    on('taskInput', 'keypress', e => { if (e.key === 'Enter') addTask(); });
    
    on('prevWeekBtn', 'click', () => { currentWeekStart.setDate(currentWeekStart.getDate() - 7); updateWeekDisplay(); renderTasks(); updateStats(); });
    on('nextWeekBtn', 'click', () => { currentWeekStart.setDate(currentWeekStart.getDate() + 7); updateWeekDisplay(); renderTasks(); updateStats(); });
    on('todayBtn', 'click', () => { currentWeekStart = getWeekStart(new Date()); updateWeekDisplay(); renderTasks(); updateStats(); });
    
    on('backupBtn', 'click', backupData);
    on('clearBtn', 'click', clearAllTasks);
    
    on('searchFriendBtn', 'click', searchFriend);
    on('searchFriendEmail', 'keypress', e => { if (e.key === 'Enter') searchFriend(); });
    
    on('sendMissionFromProfileBtn', 'click', sendMissionFromProfile);

    on('saveUsernameBtn', 'click', saveUsername);
    on('usernameInput', 'keypress', e => { if (e.key === 'Enter') saveUsername(); });

    await loadChallenges(); await loadLeaderboard();
    
    if (loader) loader.classList.add('hide'); if (main) main.style.opacity = '1';
  } catch (err) { console.error(err); if (loader) loader.classList.add('hide'); if (main) main.style.opacity = '1'; }
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
window.changeMonth = changeMonth; 
window.selectDate = selectDate;
window.toggleSharedDay = toggleSharedDay; 
window.removeFriend = removeFriend;
window.followFriend = followFriend;
window.openFollowRequestsPage = openFollowRequestsPage;
window.closeFollowRequestsPage = closeFollowRequestsPage;
window.openFriendProfile = openFriendProfile;
window.closeFriendProfileModal = closeFriendProfileModal;

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js').catch(() => {}));
console.log('🍥 Ninja Mission Tracker loaded!');
