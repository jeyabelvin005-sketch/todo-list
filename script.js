// Global variables
let currentDate = new Date();
let currentWeekStart = getWeekStart(currentDate);

// Get elements
const weekLabel = document.getElementById('weekLabel');
const prevWeekBtn = document.getElementById('prevWeek');
const nextWeekBtn = document.getElementById('nextWeek');
const todayBtn = document.getElementById('todayBtn');
const taskTableBody = document.getElementById('taskTableBody');
const taskInput = document.getElementById('taskInput');
const addBtn = document.getElementById('addBtn');
const clearWeekBtn = document.getElementById('clearWeek');
const totalTasksSpan = document.getElementById('totalTasks');
const completedTasksSpan = document.getElementById('completedTasks');
const pendingTasksSpan = document.getElementById('pendingTasks');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    updateWeekDisplay();
    loadWeekTasks();
    updateStats();
    checkDarkMode();
});

// Event listeners
prevWeekBtn.addEventListener('click', function() {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    updateWeekDisplay();
    loadWeekTasks();
    updateStats();
});

nextWeekBtn.addEventListener('click', function() {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    updateWeekDisplay();
    loadWeekTasks();
    updateStats();
});

todayBtn.addEventListener('click', function() {
    currentDate = new Date();
    currentWeekStart = getWeekStart(currentDate);
    updateWeekDisplay();
    loadWeekTasks();
    updateStats();
});

addBtn.addEventListener('click', addTask);
taskInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addTask();
    }
});

clearWeekBtn.addEventListener('click', clearWeek);
document.getElementById('backupBtn').addEventListener('click', backupData);
document.getElementById('restoreBtn').addEventListener('click', function() {
    document.getElementById('restoreFile').click();
});
document.getElementById('restoreFile').addEventListener('change', function(e) {
    restoreData(e.target.files[0]);
});

// Get week start date (Monday)
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

// Format date
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Update week display
function updateWeekDisplay() {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const startMonth = currentWeekStart.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });
    const startDay = currentWeekStart.getDate();
    const endDay = weekEnd.getDate();
    
    if (startMonth === endMonth) {
        weekLabel.textContent = `${startMonth} ${startDay} - ${endDay}`;
    } else {
        weekLabel.textContent = `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
    }
    
    // Update day headers
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const fullDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    for (let i = 0; i < 7; i++) {
        const dayDate = new Date(currentWeekStart);
        dayDate.setDate(dayDate.getDate() + i);
        const dayHeader = document.getElementById(`day${i + 1}Header`);
        const today = new Date();
        
        if (formatDate(dayDate) === formatDate(today)) {
            dayHeader.innerHTML = `${dayNames[i]}<br><span style="color: #ffeb3b; font-size: 11px;">● Today</span>`;
        } else {
            dayHeader.innerHTML = `${dayNames[i]}<br><span style="font-size: 11px; font-weight: 400;">${dayDate.getDate()}</span>`;
        }
    }
}

// Add new task
function addTask() {
    const taskText = taskInput.value.trim();
    
    if (taskText === '') {
        alert('Please enter a task!');
        taskInput.focus();
        return;
    }
    
    const task = {
        id: Date.now(),
        text: taskText,
        date: formatDate(new Date()), // Today's date
        completedDays: {} // Store completion status for each day
    };
    
    // Save task
    saveTask(task);
    
    // Clear input
    taskInput.value = '';
    taskInput.focus();
    
    // Refresh display
    loadWeekTasks();
    updateStats();
}

// Save task to localStorage
function saveTask(task) {
    const allTasks = getAllTasks();
    allTasks.push(task);
    localStorage.setItem('weeklyTasks', JSON.stringify(allTasks));
}

// Get all tasks from localStorage
function getAllTasks() {
    return JSON.parse(localStorage.getItem('weeklyTasks')) || [];
}

// Get tasks for current week
function getWeekTasks() {
    const allTasks = getAllTasks();
    const weekTasks = [];
    
    allTasks.forEach(task => {
        const taskDate = new Date(task.date);
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        if (taskDate >= currentWeekStart && taskDate <= weekEnd) {
            weekTasks.push(task);
        }
    });
    
    return weekTasks;
}

// Toggle task completion for a specific day
function toggleTaskCompletion(taskId, dayIndex) {
    const allTasks = getAllTasks();
    const taskIndex = allTasks.findIndex(task => task.id === taskId);
    
    if (taskIndex !== -1) {
        const dayKey = `day${dayIndex}`;
        const currentStatus = allTasks[taskIndex].completedDays[dayKey] || false;
        allTasks[taskIndex].completedDays[dayKey] = !currentStatus;
        localStorage.setItem('weeklyTasks', JSON.stringify(allTasks));
        loadWeekTasks();
        updateStats();
    }
}

// Delete task
function deleteTask(taskId) {
    if (confirm('Are you sure you want to delete this task?')) {
        const allTasks = getAllTasks();
        const filteredTasks = allTasks.filter(task => task.id !== taskId);
        localStorage.setItem('weeklyTasks', JSON.stringify(filteredTasks));
        loadWeekTasks();
        updateStats();
    }
}

// Load and display tasks for current week
function loadWeekTasks() {
    const weekTasks = getWeekTasks();
    taskTableBody.innerHTML = '';
    
    if (weekTasks.length === 0) {
        taskTableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: #7f8c8d;">
                    <div style="font-size: 48px; margin-bottom: 10px;">📝</div>
                    <div style="font-size: 18px; font-weight: 500;">No tasks for this week</div>
                    <div style="font-size: 14px; margin-top: 5px;">Add tasks above!</div>
                </td>
            </tr>
        `;
        return;
    }
    
    weekTasks.forEach(task => {
        const row = document.createElement('tr');
        
        // Task name cell
        let taskCell = `
            <td class="task-text-cell">
                ${task.text}
                <button class="delete-btn" onclick="deleteTask(${task.id})" style="margin-left: 10px; padding: 2px 8px; font-size: 11px;">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        row.innerHTML = taskCell;
        
        // Checkbox cells for each day
        for (let i = 0; i < 7; i++) {
            const dayKey = `day${i}`;
            const isCompleted = task.completedDays[dayKey] || false;
            const dayCell = document.createElement('td');
            dayCell.className = 'checkbox-cell';
            
            if (isCompleted) {
                dayCell.classList.add('completed');
                dayCell.innerHTML = '✅';
            } else {
                dayCell.classList.add('pending');
                dayCell.innerHTML = '❌';
            }
            
            dayCell.onclick = function() {
                toggleTaskCompletion(task.id, i);
            };
            
            dayCell.title = `Click to toggle ${isCompleted ? 'incomplete' : 'complete'}`;
            
            row.appendChild(dayCell);
        }
        
        taskTableBody.appendChild(row);
    });
}

// Update statistics
function updateStats() {
    const weekTasks = getWeekTasks();
    const totalTasks = weekTasks.length;
    
    // Count completed and pending across all days
    let totalChecks = 0;
    let completedChecks = 0;
    
    weekTasks.forEach(task => {
        for (let i = 0; i < 7; i++) {
            const dayKey = `day${i}`;
            if (task.completedDays[dayKey] !== undefined) {
                totalChecks++;
                if (task.completedDays[dayKey]) {
                    completedChecks++;
                }
            }
        }
    });
    
    const pendingChecks = totalChecks - completedChecks;
    
    totalTasksSpan.textContent = totalTasks;
    completedTasksSpan.textContent = completedChecks;
    pendingTasksSpan.textContent = pendingChecks;
    
    // Calculate progress percentage
    const progressPercent = totalChecks > 0 ? Math.round((completedChecks / totalChecks) * 100) : 0;
    document.getElementById('progressPercent').textContent = `${progressPercent}%`;
    document.getElementById('progressFill').style.width = `${progressPercent}%`;
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

// Check saved dark mode on load
function checkDarkMode() {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'true') {
        document.body.classList.add('dark-mode');
        document.getElementById('darkModeBtn').innerHTML = '<i class="fas fa-sun"></i> Light Mode';
    }
}

// Backup data
function backupData() {
    const allTasks = getAllTasks();
    const dataStr = JSON.stringify(allTasks, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weekly_task_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Restore data
function restoreData(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const tasks = JSON.parse(e.target.result);
            localStorage.setItem('weeklyTasks', JSON.stringify(tasks));
            loadWeekTasks();
            updateStats();
            alert('Data restored successfully!');
        } catch (error) {
            alert('Invalid backup file!');
        }
    };
    reader.readAsText(file);
}

// Clear all tasks for current week
function clearWeek() {
    const weekTasks = getWeekTasks();
    
    if (weekTasks.length === 0) {
        alert('No tasks to clear for this week!');
        return;
    }
    
    if (confirm(`Are you sure you want to delete ALL ${weekTasks.length} tasks for this week?`)) {
        const allTasks = getAllTasks();
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        const remainingTasks = allTasks.filter(task => {
            const taskDate = new Date(task.date);
            return !(taskDate >= currentWeekStart && taskDate <= weekEnd);
        });
        
        localStorage.setItem('weeklyTasks', JSON.stringify(remainingTasks));
        loadWeekTasks();
        updateStats();
    }
}
