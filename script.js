// Simple Task Tracker with Date-Based Auto Status
let tasks = [];
let currentWeekStart = getWeekStart(new Date());

// Get week start date (Monday)
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

// Format date as YYYY-MM-DD
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Get today's date
function getToday() {
    return formatDate(new Date());
}

// Get day index (0=Monday, 6=Sunday)
function getTodayIndex() {
    const today = new Date();
    const day = today.getDay();
    return day === 0 ? 6 : day - 1;
}

// Load tasks from localStorage
function loadTasks() {
    const saved = localStorage.getItem('tasks');
    if (saved) {
        tasks = JSON.parse(saved);
    }
    autoCheckPastDays();
}

// Save tasks to localStorage
function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

// Auto check past days - if not completed, mark as not complete
function autoCheckPastDays() {
    const todayIndex = getTodayIndex();
    let changed = false;
    
    tasks.forEach(task => {
        if (!task.days) {
            task.days = [false, false, false, false, false, false, false];
            changed = true;
        }
        
        for (let i = 0; i < todayIndex; i++) {
            if (task.days[i] !== true) {
                task.days[i] = false;
            }
        }
    });
    
    if (changed) {
        saveTasks();
    }
}

// Add task
function addTask() {
    const input = document.getElementById('taskInput');
    const text = input.value.trim();
    
    if (text === '') {
        alert('Please enter a task!');
        return;
    }
    
    const task = {
        id: Date.now(),
        text: text,
        createdDate: getToday(),
        days: [false, false, false, false, false, false, false]
    };
    
    tasks.push(task);
    saveTasks();
    
    input.value = '';
    renderTasks();
    updateStats();
}

// Toggle day completion
function toggleDay(taskId, dayIndex) {
    const todayIndex = getTodayIndex();
    
    if (dayIndex > todayIndex) {
        alert('Future days are locked! 🔒');
        return;
    }
    
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.days[dayIndex] = !task.days[dayIndex];
        saveTasks();
        renderTasks();
        updateStats();
    }
}

// Delete task
function deleteTask(taskId) {
    if (confirm('Delete this task?')) {
        tasks = tasks.filter(t => t.id !== taskId);
        saveTasks();
        renderTasks();
        updateStats();
    }
}

// Render tasks to table
function renderTasks() {
    const tbody = document.getElementById('taskTableBody');
    tbody.innerHTML = '';
    
    const todayIndex = getTodayIndex();
    
    if (tasks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#999;">📝 No tasks added yet</td></tr>';
        return;
    }
    
    tasks.forEach(task => {
        const row = document.createElement('tr');
        
        // Task name cell
        const nameCell = document.createElement('td');
        nameCell.innerHTML = `${task.text} <button class="delete-btn" onclick="deleteTask(${task.id})">Delete</button>`;
        row.appendChild(nameCell);
        
        // Day cells
        for (let i = 0; i < 7; i++) {
            const dayCell = document.createElement('td');
            dayCell.className = 'checkbox';
            
            if (i > todayIndex) {
                // Future day - locked
                dayCell.textContent = '🔒';
                dayCell.classList.add('locked');
                dayCell.title = 'Future day - locked';
                dayCell.style.cursor = 'not-allowed';
                dayCell.style.opacity = '0.5';
            } else if (i === todayIndex) {
                // Today - active
                if (task.days[i]) {
                    dayCell.textContent = '✅';
                    dayCell.classList.add('completed');
                    dayCell.title = 'Completed today - click to undo';
                } else {
                    dayCell.textContent = '⬜';
                    dayCell.classList.add('today');
                    dayCell.title = 'Today - click to complete';
                }
                dayCell.onclick = function() {
                    toggleDay(task.id, i);
                };
                dayCell.style.cursor = 'pointer';
            } else {
                // Past day
                if (task.days[i]) {
                    dayCell.textContent = '✅';
                    dayCell.classList.add('completed');
                    dayCell.title = 'Completed - click to undo';
                } else {
                    dayCell.textContent = '❌';
                    dayCell.classList.add('pending');
                    dayCell.title = 'Not completed - click to complete';
                }
                dayCell.onclick = function() {
                    toggleDay(task.id, i);
                };
                dayCell.style.cursor = 'pointer';
            }
            
            row.appendChild(dayCell);
        }
        
        tbody.appendChild(row);
    });
}

// Update stats
function updateStats() {
    document.getElementById('totalTasks').textContent = tasks.length;
    
    const todayIndex = getTodayIndex();
    let completed = 0;
    let pending = 0;
    
    tasks.forEach(task => {
        for (let i = 0; i <= todayIndex; i++) {
            if (task.days[i]) {
                completed++;
            } else {
                pending++;
            }
        }
    });
    
    document.getElementById('completedTasks').textContent = completed;
    document.getElementById('pendingTasks').textContent = pending;
    
    const total = completed + pending;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    document.getElementById('progressPercent').textContent = `${percent}%`;
    document.getElementById('progressFill').style.width = `${percent}%`;
}

// Update week display
function updateWeekDisplay() {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const startMonth = currentWeekStart.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });
    const startDay = currentWeekStart.getDate();
    const endDay = weekEnd.getDate();
    
    let weekLabel = `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
    document.getElementById('weekLabel').textContent = weekLabel;
    
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = getToday();
    
    for (let i = 0; i < 7; i++) {
        const dayDate = new Date(currentWeekStart);
        dayDate.setDate(dayDate.getDate() + i);
        const dateStr = formatDate(dayDate);
        const dayHeader = document.getElementById(`day${i + 1}Header`);
        
        let badge = '';
        if (dateStr === today) {
            badge = '<br><span style="color:#ffeb3b;font-size:11px;">● Today</span>';
        } else if (dateStr < today) {
            badge = '<br><span style="color:#ffcccc;font-size:11px;">Past</span>';
        } else {
            badge = '<br><span style="color:#c8e6c9;font-size:11px;">Future</span>';
        }
        
        dayHeader.innerHTML = `${dayNames[i]} ${dayDate.getDate()}${badge}`;
    }
}

// Dark mode toggle
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark);
    
    const btn = document.getElementById('darkModeBtn');
    if (isDark) {
        btn.innerHTML = '<i class="fas fa-sun"></i> Light Mode';
    } else {
        btn.innerHTML = '<i class="fas fa-moon"></i> Dark Mode';
    }
}

// Check saved dark mode
function checkDarkMode() {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'true') {
        document.body.classList.add('dark-mode');
        document.getElementById('darkModeBtn').innerHTML = '<i class="fas fa-sun"></i> Light Mode';
    }
}

// Backup data
function backupData() {
    const dataStr = JSON.stringify(tasks, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `task_backup_${getToday()}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Clear all tasks
function clearAllTasks() {
    if (tasks.length === 0) {
        alert('No tasks to clear!');
        return;
    }
    
    if (confirm(`Delete ALL ${tasks.length} tasks?`)) {
        tasks = [];
        saveTasks();
        renderTasks();
        updateStats();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    loadTasks();
    updateWeekDisplay();
    renderTasks();
    updateStats();
    checkDarkMode();
});

// Event listeners
document.getElementById('addBtn').addEventListener('click', addTask);
document.getElementById('taskInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addTask();
    }
});
document.getElementById('prevWeekBtn').addEventListener('click', function() {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    updateWeekDisplay();
    renderTasks();
    updateStats();
});
document.getElementById('nextWeekBtn').addEventListener('click', function() {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    updateWeekDisplay();
    renderTasks();
    updateStats();
});
document.getElementById('todayBtn').addEventListener('click', function() {
    currentWeekStart = getWeekStart(new Date());
    updateWeekDisplay();
    renderTasks();
    updateStats();
});
document.getElementById('backupBtn').addEventListener('click', backupData);
document.getElementById('clearBtn').addEventListener('click', clearAllTasks);

console.log('✅ Script loaded successfully!');
