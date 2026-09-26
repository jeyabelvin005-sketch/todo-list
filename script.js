// 🍥 Ninja Mission Tracker — Firebase + Naruto Theme
let tasks = [];
let currentWeekStart = getWeekStart(new Date());
let currentUser = null;

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

// 🎯 FIX: Based on current week navigation
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

function tasksCol() {
  return db.collection('users').doc(currentUser.uid).collection('tasks');
}

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
}

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
        dayCell.innerHTML = '<span class="cell-icon">🔒</span>';
        dayCell.classList.add('locked');
        dayCell.title = 'Future day - locked';
        dayCell.style.cursor = 'not-allowed';
      } else if (i === todayIndex) {
        if (task.days[i]) {
          dayCell.innerHTML = '<img src="images/naruto-done.jpg" class="cell-img" alt="done">';
          dayCell.classList.add('completed');
          dayCell.title = 'Completed today';
        } else {
          dayCell.innerHTML = '<img src="images/kunai.jpg" class="cell-img" alt="today">';
          dayCell.classList.add('today');
          dayCell.title = 'Today - click to complete';
        }
        dayCell.style.cursor = 'pointer';
        dayCell.onclick = () => toggleDay(task.id, i);
      } else {
        if (task.days[i]) {
          dayCell.innerHTML = '<img src="images/naruto-done.jpg" class="cell-img" alt="done">';
          dayCell.classList.add('completed');
          dayCell.title = 'Completed - click to undo';
        } else {
          dayCell.innerHTML = '<img src="images/failed.jpg" class="cell-img" alt="failed">';
          dayCell.classList.add('pending');
          dayCell.title = 'Not completed';
        }
        dayCell.style.cursor = 'pointer';
        dayCell.onclick = () => toggleDay(task.id, i);
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
      task.days[i] ? completed++ : pending++;
    }
  });
  document.getElementById('completedTasks').textContent = completed;
  document.getElementById('pendingTasks').textContent = pending;
  const total = completed + pending;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  document.getElementById('progressPercent').textContent = `${percent}%`;
  document.getElementById('progressFill').style.width = `${percent}%`;

  const rankEl = document.getElementById('rankLabel');
  if (rankEl) {
    let rank = '🥷 Academy Student';
    if (percent >= 20) rank = '🥷 Genin';
    if (percent >= 40) rank = '⚔️ Chunin';
    if (percent >= 60) rank = '🔥 Jonin';
    if (percent >= 80) rank = '⚡ ANBU';
    if (percent >= 95) rank = '🍥 Hokage';
    rankEl.textContent = rank;
  }
}

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
  }
}

auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = 'login.html'; return; }
  currentUser = user;
  await loadTasks();
  updateWeekDisplay();
  renderTasks();
  updateStats();
  checkDarkMode();
  attachEventListeners();
  setTimeout(() => {
    const loader = document.getElementById('rasenganLoader');
    const main = document.getElementById('mainContainer');
    if (loader) loader.classList.add('hide');
    if (main) main.style.opacity = '1';
  }, 1500);
});

window.toggleDarkMode = toggleDarkMode;
window.deleteTask = deleteTask;
window.logoutUser = logoutUser;

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
}
console.log('🍥 Ninja Mission Tracker loaded!');
https://github.com/jeyabelvin005-sketch/todo-list/edit/main/script.js
