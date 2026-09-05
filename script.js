// Global variables
let currentDate = new Date();
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();

// Get elements
const monthYearSpan = document.getElementById('monthYear');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const todayBtn = document.getElementById('todayBtn');
const taskTableBody = document.getElementById('taskTableBody');
const taskDateInput = document.getElementById('taskDate');
const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');
const taskInput = document.getElementById('taskInput');
const addBtn = document.getElementById('addBtn');
const exportCSVBtn = document.getElementById('exportCSV');
const clearMonthBtn = document.getElementById('clearMonth');
const totalTasksSpan = document.getElementById('totalTasks');
const completedTasksSpan = document.getElementById('completedTasks');
const pendingTasksSpan = document.getElementById('pendingTasks');
const totalHoursSpan = document.getElementById('totalHours');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    setDefaultDateTime();
    updateMonthDisplay();
    loadTasks();
    updateStats();
});

// Event listeners
prevMonthBtn.addEventListener('click', function() {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    updateMonthDisplay();
    loadTasks();
    updateStats();
});

nextMonthBtn.addEventListener('click', function() {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    updateMonthDisplay();
    loadTasks();
    updateStats();
});

todayBtn.addEventListener('click', function() {
    currentDate = new Date();
    currentMonth = currentDate.getMonth();
    currentYear = currentDate.getFullYear();
    updateMonthDisplay();
    loadTasks();
    updateStats();
    setDefaultDateTime();
});

addBtn.addEventListener('click', addTask);
taskInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addTask();
    }
});

exportCSVBtn.addEventListener('click', exportToCSV);
clearMonthBtn.addEventListener('click', clearMonth);

// Set default date and time
function setDefaultDateTime() {
    const now = new Date();
    const formattedDate = formatDate(now);
    const formattedTime = now.toTimeString().slice(0, 5);
    
    taskDateInput.value = formattedDate;
    startTimeInput.value = formattedTime;
    endTimeInput.value = formattedTime;
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Update month/year display
function updateMonthDisplay() {
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    monthYearSpan.textContent = `${monthNames[currentMonth]} ${currentYear}`;
}

// Add new task
function addTask() {
    const taskText = taskInput.value.trim();
    const taskDate = taskDateInput.value;
    const startTime = startTimeInput.value;
    const endTime = endTimeInput.value;
    
    if (taskText === '') {
        alert('Please enter a task!');
        taskInput.focus();
        return;
    }
    
    if (taskDate === '') {
        alert('Please select a date!');
        return;
    }
    
    if (startTime === '') {
        alert('Please select start time!');
        return;
    }
    
    if (endTime === '') {
        alert('Please select end time!');
        return;
    }
    
    if (endTime <= startTime) {
        alert('End time must be after start time!');
        return;
    }
    
    const duration = calculateDuration(startTime, endTime);
    
    const task = {
        id: Date.now(),
        date: taskDate,
        text: taskText,
        startTime: startTime,
        endTime: endTime,
        duration: duration,
        status: 'normal' // normal, completed, pending
    };
    
    // Save task
    saveTask(task);
    
    // Clear input
    taskInput.value = '';
    taskInput.focus();
    
    // Refresh display
    loadTasks();
    updateStats();
}

// Calculate duration between two times
function calculateDuration(startTime, endTime) {
    const start = new Date(`2000-01-01 ${startTime}`);
    const end = new Date(`2000-01-01 ${endTime}`);
    
    let diff = (end - start) / (1000 * 60);
    
    if (diff < 0) {
        diff += 24 * 60;
    }
    
    const hours = Math.floor(diff / 60);
    const minutes = Math.round(diff % 60);
    
    return {
        hours: hours,
        minutes: minutes,
        display: formatDuration(hours, minutes)
    };
}

function formatDuration(hours, minutes) {
    if (hours === 0) {
        return `${minutes}m`;
    } else if (minutes === 0) {
        return `${hours}h`;
    } else {
        return `${hours}h ${minutes}m`;
    }
}

// Save task to localStorage
function saveTask(task) {
    const allTasks = getAllTasks();
    allTasks.push(task);
    localStorage.setItem('tasks', JSON.stringify(allTasks));
}

// Get all tasks from localStorage
function getAllTasks() {
    return JSON.parse(localStorage.getItem('tasks')) || [];
}

// Get tasks for current month
function getMonthTasks() {
    const allTasks = getAllTasks();
    const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    
    return allTasks
        .filter(task => task.date.startsWith(monthPrefix))
        .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}

// Check if task is overdue (yesterday or older)
function isTaskOverdue(taskDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const taskDateObj = new Date(taskDate);
    taskDateObj.setHours(0, 0, 0, 0);
    
    return taskDateObj < today;
}

// Load and display tasks for current month
function loadTasks() {
    const monthTasks = getMonthTasks();
    taskTableBody.innerHTML = '';
    
    if (monthTasks.length === 0) {
        taskTableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: #7f8c8d;">
                    <div style="font-size: 48px; margin-bottom: 10px;">📝</div>
                    <div style="font-size: 18px; font-weight: 500;">No tasks for this month</div>
                    <div style="font-size: 14px; margin-top: 5px;">Start adding tasks above!</div>
                </td>
            </tr>
        `;
        return;
    }
    
    monthTasks.forEach(task => {
        const row = document.createElement('tr');
        
        // Determine task status and apply color coding
        if (task.status === 'completed') {
            // GREEN for completed tasks
            row.classList.add('task-completed');
        } else if (task.status === 'pending') {
            // Check if overdue (yesterday or older)
            if (isTaskOverdue(task.date)) {
                // DARK RED for overdue pending tasks
                row.classList.add('task-overdue');
            } else {
                // LIGHT RED for pending tasks
                row.classList.add('task-pending');
            }
        } else {
            // WHITE for normal tasks
            row.classList.add('task-normal');
        }
        
        const dateObj = new Date(task.date);
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = dayNames[dateObj.getDay()];
        
        // Determine status badge
        let statusBadge = '';
        if (task.status === 'completed') {
            statusBadge = `<span class="status-badge completed">✓ Completed</span>`;
        } else if (task.status === 'pending' && isTaskOverdue(task.date)) {
            statusBadge = `<span class="status-badge overdue">⚠ Overdue</span>`;
        } else if (task.status === 'pending') {
            statusBadge = `<span class="status-badge pending">⏳ Pending</span>`;
        } else {
            statusBadge = `<span class="status-badge">📋 Normal</span>`;
        }
        
        // Determine action buttons
        let actionButtons = '';
        if (task.status === 'completed') {
            actionButtons = `
                <button class="complete-btn pending-btn" onclick="markAsPending(${task.id})">
                    <i class="fas fa-undo"></i> Pending
                </button>
                <button class="delete-btn" onclick="deleteTask(${task.id})">
                    <i class="fas fa-trash"></i>
                </button>
            `;
        } else if (task.status === 'pending') {
            actionButtons = `
                <button class="complete-btn" onclick="markAsCompleted(${task.id})">
                    <i class="fas fa-check"></i> Complete
                </button>
                <button class="delete-btn" onclick="deleteTask(${task.id})">
                    <i class="fas fa-trash"></i>
                </button>
            `;
        } else {
            // Normal status - show both options
            actionButtons = `
                <button class="complete-btn" onclick="markAsCompleted(${task.id})">
                    <i class="fas fa-check"></i> Complete
                </button>
                <button class="complete-btn pending-btn" onclick="markAsPending(${task.id})">
                    <i class="fas fa-times"></i> Not Complete
                </button>
                <button class="delete-btn" onclick="deleteTask(${task.id})">
                    <i class="fas fa-trash"></i>
                </button>
            `;
        }
        
        row.innerHTML = `
            <td>${formatDisplayDate(task.date)}</td>
            <td>${dayName}</td>
            <td class="task-text">${task.text}</td>
            <td>${formatTime12h(task.startTime)}</td>
            <td>${formatTime12h(task.endTime)}</td>
            <td><span class="duration-badge">${task.duration?.display || 'N/A'}</span></td>
            <td>${statusBadge}</td>
            <td>${actionButtons}</td>
        `;
        
        taskTableBody.appendChild(row);
    });
}

function formatDisplayDate(dateString) {
    const date = new Date(dateString);
    const options = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function formatTime12h(time24) {
    if (!time24) return 'N/A';
    
    const [hours, minutes] = time24.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
}

// Mark task as completed
function markAsCompleted(taskId) {
    updateTaskStatus(taskId, 'completed');
}

// Mark task as pending (not complete)
function markAsPending(taskId) {
    updateTaskStatus(taskId, 'pending');
}

// Update task status
function updateTaskStatus(taskId, newStatus) {
    const allTasks = getAllTasks();
    const taskIndex = allTasks.findIndex(task => task.id === taskId);
    
    if (taskIndex !== -1) {
        allTasks[taskIndex].status = newStatus;
        localStorage.setItem('tasks', JSON.stringify(allTasks));
        loadTasks();
        updateStats();
    }
}

// Delete task
function deleteTask(taskId) {
    if (confirm('Are you sure you want to delete this task?')) {
        const allTasks = getAllTasks();
        const filteredTasks = allTasks.filter(task => task.id !== taskId);
        localStorage.setItem('tasks', JSON.stringify(filteredTasks));
        loadTasks();
        updateStats();
    }
}

// Update statistics
function updateStats() {
    const monthTasks = getMonthTasks();
    const totalTasks = monthTasks.length;
    const completedTasks = monthTasks.filter(task => task.status === 'completed').length;
    const pendingTasks = monthTasks.filter(task => task.status === 'pending').length;
    
    // Calculate total hours
    let totalMinutes = 0;
    monthTasks.forEach(task => {
        if (task.duration) {
            totalMinutes += (task.duration.hours * 60) + task.duration.minutes;
        }
    });
    
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    const totalHoursDisplay = `${totalHours}h ${remainingMinutes}m`;
    
    totalTasksSpan.textContent = totalTasks;
    completedTasksSpan.textContent = completedTasks;
    pendingTasksSpan.textContent = pendingTasks;
    totalHoursSpan.textContent = totalHoursDisplay;
}

// Export to CSV (Excel compatible)
function exportToCSV() {
    const monthTasks = getMonthTasks();
    
    if (monthTasks.length === 0) {
        alert('No tasks to export for this month!');
        return;
    }
    
    let csv = 'Date,Day,Task,Start Time,End Time,Duration,Status\n';
    
    monthTasks.forEach(task => {
        const dateObj = new Date(task.date);
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = dayNames[dateObj.getDay()];
        const status = task.status === 'completed' ? 'Completed' : task.status === 'pending' ? 'Pending' : 'Normal';
        
        csv += `"${task.date}","${dayName}","${task.text}","${task.startTime}","${task.endTime}","${task.duration?.display || 'N/A'}","${status}"\n`;
    });
    
    const totalMinutes = monthTasks.reduce((sum, task) => {
        if (task.duration) {
            return sum + (task.duration.hours * 60) + task.duration.minutes;
        }
        return sum;
    }, 0);
    
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    
    csv += `\n"","","TOTAL","","","${totalHours}h ${remainingMinutes}m",""\n`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tasks_${currentYear}_${String(currentMonth + 1).padStart(2, '0')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Clear all tasks for current month
function clearMonth() {
    const monthTasks = getMonthTasks();
    
    if (monthTasks.length === 0) {
        alert('No tasks to clear for this month!');
        return;
    }
    
    if (confirm(`Are you sure you want to delete ALL ${monthTasks.length} tasks for this month?`)) {
        const allTasks = getAllTasks();
        const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        const remainingTasks = allTasks.filter(task => !task.date.startsWith(monthPrefix));
        localStorage.setItem('tasks', JSON.stringify(remainingTasks));
        loadTasks();
        updateStats();
    }
}