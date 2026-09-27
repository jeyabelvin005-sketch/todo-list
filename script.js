// script.js

(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const CHARACTER_DATA = {
    naruto: {
      name: "Naruto",
      fullName: "Naruto Uzumaki",
      image: "images/naruto.svg",
      color: "#ff8a3d",
      quote: "The next great Hokage is built one mission at a time.",
      jutsu: "影分身の術!",
      achievement: "Unlock by default"
    },
    sasuke: {
      name: "Sasuke",
      fullName: "Sasuke Uchiha",
      image: "images/sasuke.svg",
      color: "#7c9cff",
      quote: "Sharpen your focus until every mission has only one outcome.",
      jutsu: "千鳥!",
      achievement: "Complete 10 missions"
    },
    sakura: {
      name: "Sakura",
      fullName: "Sakura Haruno",
      image: "images/sakura.svg",
      color: "#ff6fae",
      quote: "Strength grows when discipline and compassion work together.",
      jutsu: "怪力!",
      achievement: "Complete 25 missions"
    },
    kakashi: {
      name: "Kakashi",
      fullName: "Kakashi Hatake",
      image: "images/kakashi.svg",
      color: "#9aa6bd",
      quote: "Those who abandon their mission are scum; those who abandon friends are worse.",
      jutsu: "雷切!",
      achievement: "Complete 50 missions"
    },
    itachi: {
      name: "Itachi",
      fullName: "Itachi Uchiha",
      image: "images/itachi.svg",
      color: "#c283ff",
      quote: "Even the strongest shinobi must choose what they protect.",
      jutsu: "月読!",
      achievement: "Complete 100 missions"
    },
    gaara: {
      name: "Gaara",
      fullName: "Gaara of the Sand",
      image: "images/gaara.svg",
      color: "#e6a65e",
      quote: "A strong heart can turn isolation into purpose.",
      jutsu: "砂瀑送葬!",
      achievement: "Reach Jonin rank"
    }
  };

  const RANKS = [
    { name: "Academy Student", minimum: 0, maximum: 99, color: "#9ca3af" },
    { name: "Genin", minimum: 100, maximum: 299, color: "#6ee7b7" },
    { name: "Chunin", minimum: 300, maximum: 699, color: "#60a5fa" },
    { name: "Jonin", minimum: 700, maximum: 1499, color: "#c084fc" },
    { name: "ANBU", minimum: 1500, maximum: 2999, color: "#f472b6" },
    { name: "Hokage", minimum: 3000, maximum: Infinity, color: "#fbbf24" }
  ];

  const PRIORITY_POINTS = {
    S: 40,
    A: 25,
    B: 15,
    C: 8
  };

  const CATEGORY_LABELS = {
    training: "Training",
    missions: "Missions",
    study: "Study",
    personal: "Personal"
  };

  const QUOTES = [
    ["“Hard work is worthless for those that do not believe in themselves.”", "— Naruto Uzumaki"],
    ["“In this world, where there is light, there are also shadows.”", "— Madara Uchiha"],
    ["“The hole in one's heart gets filled by others around you.”", "— Kakashi Hatake"],
    ["“Growth occurs when one goes beyond one's limits.”", "— Itachi Uchiha"],
    ["“When people are protecting something truly special to them, they truly can become as strong as they can be.”", "— Jiraiya"],
    ["“A smile is the best way to get oneself out of a tight spot.”", "— Minato Namikaze"]
  ];

  const ACHIEVEMENTS = [
    {
      id: "first-mission",
      title: "First Scroll",
      description: "Create your first mission.",
      icon: "fa-scroll",
      test: ({ tasks }) => tasks.length >= 1
    },
    {
      id: "first-victory",
      title: "First Victory",
      description: "Complete your first mission.",
      icon: "fa-check",
      test: ({ totalCompletions }) => totalCompletions >= 1
    },
    {
      id: "ten-missions",
      title: "Rookie Shinobi",
      description: "Complete 10 missions.",
      icon: "fa-user-ninja",
      test: ({ totalCompletions }) => totalCompletions >= 10
    },
    {
      id: "streak-seven",
      title: "Seven-Day Resolve",
      description: "Complete at least one mission on 7 days.",
      icon: "fa-fire",
      test: ({ activeDays }) => activeDays >= 7
    },
    {
      id: "s-rank",
      title: "S-Rank Commander",
      description: "Complete an S-Rank mission.",
      icon: "fa-star",
      test: ({ tasks }) => tasks.some((task) => task.priority === "S" && totalTaskCompletions(task) > 0)
    },
    {
      id: "jonin",
      title: "Jonin Ascension",
      description: "Reach Jonin rank.",
      icon: "fa-crown",
      test: ({ points }) => points >= 700
    },
    {
      id: "all-categories",
      title: "Four Paths",
      description: "Complete a mission in every category.",
      icon: "fa-compass",
      test: ({ tasks }) => {
        const categories = new Set();
        tasks.forEach((task) => {
          if (totalTaskCompletions(task) > 0) categories.add(task.category);
        });
        return categories.size === 4;
      }
    },
    {
      id: "hundred",
      title: "Legendary Shinobi",
      description: "Complete 100 mission check-ins.",
      icon: "fa-dragon",
      test: ({ totalCompletions }) => totalCompletions >= 100
    }
  ];

  const state = {
    user: null,
    profile: {
      character: "naruto",
      theme: "dark",
      soundEnabled: false
    },
    tasks: [],
    weekOffset: 0,
    view: "scroll",
    filters: {
      search: "",
      category: "all",
      priority: "all",
      status: "all"
    },
    unsubscribe: null,
    quoteIndex: 0,
    quoteTimer: null,
    reminderTimer: null,
    draggedTaskId: null
  };

  let audioContext = null;

  function uid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function dateFromKey(key) {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function startOfWeek(date) {
    const result = new Date(date);
    const day = result.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    result.setDate(result.getDate() + diff);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  function getWeekDates(offset = state.weekOffset) {
    const start = startOfWeek(new Date());
    start.setDate(start.getDate() + offset * 7);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }

  function getCurrentWeekKeys() {
    return getWeekDates().map(localDateKey);
  }

  function formatDate(date, options = {}) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      ...options
    }).format(date);
  }

  function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    }[character]));
  }

  function totalTaskCompletions(task) {
    return Object.values(task.completions || {}).filter(Boolean).length;
  }

  function getRank(points) {
    return [...RANKS].reverse().find((rank) => points >= rank.minimum) || RANKS[0];
  }

  function getProfileStats() {
    const totalCompletions = state.tasks.reduce((sum, task) => sum + totalTaskCompletions(task), 0);
    const points = state.tasks.reduce((sum, task) => sum + totalTaskCompletions(task) * (PRIORITY_POINTS[task.priority] || 8), 0);
    const activeDays = new Set(
      state.tasks.flatMap((task) =>
        Object.entries(task.completions || {})
          .filter(([, completed]) => completed)
          .map(([day]) => day)
      )
    ).size;

    const rank = getRank(points);

    return {
      totalCompletions,
      points,
      activeDays,
      rank
    };
  }

  function getCompletionForDay(task, dayKey) {
    return Boolean(task.completions && task.completions[dayKey]);
  }

  function isPastDay(dayKey) {
    return dayKey < localDateKey();
  }

  function isToday(dayKey) {
    return dayKey === localDateKey();
  }

  function isFutureDay(dayKey) {
    return dayKey > localDateKey();
  }

  function getWeekStats() {
    const weekKeys = getCurrentWeekKeys();
    const totalPossible = state.tasks.length * weekKeys.length;

    let completed = 0;
    let todayCompleted = 0;
    let failed = 0;
    let overdue = 0;

    state.tasks.forEach((task) => {
      weekKeys.forEach((dayKey) => {
        if (getCompletionForDay(task, dayKey)) completed++;
        if (isToday(dayKey) && getCompletionForDay(task, dayKey)) todayCompleted++;
        if (isPastDay(dayKey) && !getCompletionForDay(task, dayKey)) failed++;
      });

      if (task.deadline && task.deadline < localDateKey() && !getCompletionForDay(task, task.deadline)) {
        overdue++;
      }
    });

    const completionPercent = totalPossible
      ? Math.round((completed / totalPossible) * 100)
      : 0;

    return {
      totalPossible,
      completed,
      todayCompleted,
      failed,
      overdue,
      completionPercent
    };
  }

  function filteredTasks() {
    const { search, category, priority, status } = state.filters;
    const query = search.trim().toLowerCase();

    return [...state.tasks]
      .filter((task) => {
        const haystack = `${task.title} ${task.notes} ${task.category} ${task.priority}`.toLowerCase();

        if (query && !haystack.includes(query)) return false;
        if (category !== "all" && task.category !== category) return false;
        if (priority !== "all" && task.priority !== priority) return false;

        if (status === "completed" && !getCompletionForDay(task, localDateKey())) return false;
        if (status === "active" && getCompletionForDay(task, localDateKey())) return false;
        if (status === "overdue" && !(task.deadline && task.deadline < localDateKey() && !getCompletionForDay(task, task.deadline))) {
          return false;
        }

        return true;
      })
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  function getUserDocument() {
    return db.collection("users").doc(state.user.uid);
  }

  function getTasksCollection() {
    return getUserDocument().collection("tasks");
  }

  async function saveProfile(patch) {
    state.profile = { ...state.profile, ...patch };

    await getUserDocument().set({
      ...patch,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  async function saveTask(task) {
    const payload = {
      ...task,
      updatedAt: serverTimestamp()
    };

    await getTasksCollection().doc(task.id).set(payload, { merge: true });
  }

  async function deleteTask(taskId) {
    await getTasksCollection().doc(taskId).delete();
  }

  function normalizeTask(task) {
    return {
      id: task.id || uid(),
      title: String(task.title || "Untitled mission").slice(0, 120),
      category: CATEGORY_LABELS[task.category] ? task.category : "personal",
      priority: PRIORITY_POINTS[task.priority] ? task.priority : "C",
      deadline: task.deadline || "",
      notes: String(task.notes || "").slice(0, 500),
      avatar: CHARACTER_DATA[task.avatar] ? task.avatar : "naruto",
      reminderEnabled: Boolean(task.reminderEnabled),
      completions: task.completions || {},
      order: Number.isFinite(task.order) ? task.order : Date.now(),
      createdAt: task.createdAt || null,
      updatedAt: task.updatedAt || null
    };
  }

  function showToast(message, type = "success") {
    const toast = $("#toast");
    toast.textContent = message;
    toast.className = `toast visible ${type}`;

    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toast.classList.remove("visible");
    }, 3200);
  }

  function setLoading(visible) {
    $("#loadingScreen").classList.toggle("hidden", !visible);
  }

  function openModal(id) {
    const modal = $(`#${id}`);
    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");

    const focusTarget = modal.querySelector("input:not([type='hidden']), select, textarea");
    if (focusTarget) setTimeout(() => focusTarget.focus(), 100);
  }

  function closeModal(id) {
    $(`#${id}`).classList.add("hidden");

    if ($$(".modal-backdrop:not(.hidden)").length === 0) {
      document.body.classList.remove("modal-open");
    }
  }

  function updateProfileUI() {
    const character = CHARACTER_DATA[state.profile.character] || CHARACTER_DATA.naruto;
    const stats = getProfileStats();

    document.documentElement.style.setProperty("--character-color", character.color);
    document.documentElement.style.setProperty("--character-color-soft", `${character.color}33`);

    $("#headerAvatar").src = character.image;
    $("#headerAvatar").alt = character.fullName;
    $("#headerCharacterName").textContent = character.name;

    $("#heroAvatar").src = character.image;
    $("#heroAvatar").alt = `${character.fullName} avatar`;
    $("#heroCharacterName").textContent = character.name === "Naruto"
      ? "Believe it!"
      : `${character.name}'s path awaits.`;

    $("#characterQuote").textContent = character.quote;
    $("#heroJutsu").textContent = character.jutsu;

    $("#rankBadge").textContent = stats.rank.name;
    $("#rankBadge").style.setProperty("--rank-color", stats.rank.color);
    $("#tournamentRank").textContent = stats.rank.name;
    $("#tournamentRank").style.setProperty("--rank-color", stats.rank.color);

    document.body.classList.toggle("light-theme", state.profile.theme === "light");

    $("#soundToggle i").className = state.profile.soundEnabled
      ? "fa-solid fa-volume-high"
      : "fa-solid fa-volume-xmark";

    $("#themeToggle i").className = state.profile.theme === "light"
      ? "fa-solid fa-sun"
      : "fa-solid fa-moon";

    const nextRank = RANKS.find((rank) => rank.minimum > stats.points);
    const currentMinimum = stats.rank.minimum;
    const currentMaximum = Number.isFinite(stats.rank.maximum)
      ? stats.rank.maximum
      : stats.points + 100;

    const percentage = stats.rank.name === "Hokage"
      ? 100
      : Math.min(100, Math.max(0, ((stats.points - currentMinimum) / (currentMaximum - currentMinimum + 1)) * 100));

    $("#rankProgress").style.width = `${percentage}%`;
    $("#rankPoints").textContent = `${stats.points} XP`;
    $("#nextRankText").textContent = nextRank
      ? `${Math.max(0, nextRank.minimum - stats.points)} XP to ${nextRank.name}`
      : "Maximum rank achieved";
  }

  function renderStats() {
    const stats = getWeekStats();
    const profileStats = getProfileStats();

    $("#totalTasks").textContent = state.tasks.length;
    $("#completionPercent").textContent = `${stats.completionPercent}%`;
    $("#completedToday").textContent = stats.todayCompleted;
    $("#currentStreak").textContent = calculateCurrentStreak();

    $("#tournamentScore").textContent = `${profileStats.points} points`;
    $("#tournamentProgress").style.width = `${Math.min(100, (profileStats.points / 3000) * 100)}%`;
    $("#tournamentMessage").textContent = stats.completed
      ? `${stats.completed} check-ins completed in this weekly scroll.`
      : "Complete missions to climb the tournament board.";
  }

  function calculateCurrentStreak() {
    let streak = 0;
    const date = new Date();

    while (true) {
      const key = localDateKey(date);
      const completed = state.tasks.some((task) => getCompletionForDay(task, key));

      if (!completed) break;

      streak++;
      date.setDate(date.getDate() - 1);

      if (streak > 3650) break;
    }

    return streak;
  }

  function renderWeekHeader() {
    const dates = getWeekDates();
    const start = dates[0];
    const end = dates[6];

    $("#weekLabel").textContent = state.weekOffset === 0
      ? `This week · ${formatDate(start)} – ${formatDate(end)}`
      : `${formatDate(start)} – ${formatDate(end)}`;

    $("#currentDateLabel").textContent = formatDate(new Date(), {
      weekday: "long",
      month: "long",
      day: "numeric"
    });
  }

  function renderWeekGrid() {
    const weekGrid = $("#weekGrid");
    const dates = getWeekDates();
    const tasks = filteredTasks();

    if (!tasks.length) {
      weekGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-seal">巻</div>
          <h3>No missions found</h3>
          <p>Write your first mission scroll or adjust your filters.</p>
          <button class="primary-button" data-action="new-task">
            <i class="fa-solid fa-plus"></i>
            Add mission
          </button>
        </div>
      `;
      return;
    }

    weekGrid.innerHTML = `
      <div class="week-grid-header">
        <div class="mission-header-cell">Mission scroll</div>
        ${dates.map((date) => {
          const key = localDateKey(date);
          const today = isToday(key);
          return `
            <div class="day-header ${today ? "today" : ""}">
              <span>${date.toLocaleDateString(undefined, { weekday: "short" })}</span>
              <strong>${date.getDate()}</strong>
              ${today ? "<small>Today</small>" : ""}
            </div>
          `;
        }).join("")}
      </div>

      <div class="mission-rows">
        ${tasks.map((task) => renderTaskRow(task, dates)).join("")}
      </div>
    `;

    attachTaskEvents();
  }

  function renderTaskRow(task, dates) {
    const character = CHARACTER_DATA[task.avatar] || CHARACTER_DATA.naruto;
    const deadlineOverdue = task.deadline &&
      task.deadline < localDateKey() &&
      !getCompletionForDay(task, task.deadline);

    return `
      <article class="mission-row" draggable="true" data-task-id="${escapeHTML(task.id)}">
        <div class="mission-info">
          <button class="drag-handle" title="Drag to reorder" aria-label="Drag to reorder">
            <i class="fa-solid fa-grip-vertical"></i>
          </button>

          <img
            class="task-avatar"
            src="${character.image}"
            alt="${escapeHTML(character.fullName)}"
            style="--avatar-color: ${character.color}"
          >

          <div class="mission-main">
            <button class="mission-title" data-action="edit-task" data-id="${escapeHTML(task.id)}">
              ${escapeHTML(task.title)}
            </button>

            <div class="mission-meta">
              <span class="category-chip category-${task.category}">
                ${escapeHTML(CATEGORY_LABELS[task.category])}
              </span>
              <span class="priority-chip priority-${task.priority}">
                ${escapeHTML(task.priority)}-Rank
              </span>
              ${task.deadline ? `
                <span class="deadline-chip ${deadlineOverdue ? "overdue" : ""}">
                  <i class="fa-regular fa-clock"></i>
                  ${escapeHTML(formatDate(dateFromKey(task.deadline)))}
                </span>
              ` : ""}
            </div>

            ${task.notes ? `<p class="mission-notes">${escapeHTML(task.notes)}</p>` : ""}
          </div>

          <div class="mission-actions">
            <button class="row-action" data-action="edit-task" data-id="${escapeHTML(task.id)}" title="Edit mission" aria-label="Edit mission">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="row-action danger-text" data-action="delete-task" data-id="${escapeHTML(task.id)}" title="Delete mission" aria-label="Delete mission">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>

        <div class="mission-days">
          ${dates.map((date) => renderDayCell(task, localDateKey(date))).join("")}
        </div>
      </article>
    `;
  }

  function renderDayCell(task, dayKey) {
    const completed = getCompletionForDay(task, dayKey);
    const past = isPastDay(dayKey);
    const today = isToday(dayKey);
    const future = isFutureDay(dayKey);

    let stateClass = "future";
    let symbol = "🔒";
    let label = "Future day";

    if (completed) {
      stateClass = "completed";
      symbol = "✓";
      label = "Completed";
    } else if (past) {
      stateClass = "failed";
      symbol = "💢";
      label = "Failed";
    } else if (today) {
      stateClass = "today";
      symbol = "⚔️";
      label = "Complete today";
    }

    return `
      <button
        class="day-cell ${stateClass}"
        data-action="toggle-day"
        data-task-id="${escapeHTML(task.id)}"
        data-day="${dayKey}"
        ${future ? "disabled" : ""}
        title="${label}"
        aria-label="${label}"
      >
        <span>${symbol}</span>
      </button>
    `;
  }

  function renderTournament() {
    const dates = getWeekDates();
    const summaryGrid = $("#summaryGrid");

    summaryGrid.innerHTML = dates.map((date) => {
      const key = localDateKey(date);
      const completed = state.tasks.filter((task) => getCompletionForDay(task, key)).length;
      const failed = state.tasks.filter((task) => isPastDay(key) && !getCompletionForDay(task, key)).length;

      return `
        <div class="summary-day ${isToday(key) ? "is-today" : ""}">
          <div>
            <strong>${date.toLocaleDateString(undefined, { weekday: "short" })}</strong>
            <span>${date.getDate()}</span>
          </div>
          <div class="summary-bar">
            <span style="width: ${state.tasks.length ? Math.min(100, (completed / state.tasks.length) * 100) : 0}%"></span>
          </div>
          <small>${completed} completed${isPastDay(key) ? ` · ${failed} failed` : ""}</small>
        </div>
      `;
    }).join("");

    const categoryStats = Object.keys(CATEGORY_LABELS).map((category) => {
      const tasks = state.tasks.filter((task) => task.category === category);
      const completions = tasks.reduce((sum, task) => sum + totalTaskCompletions(task), 0);

      return {
        category,
        tasks: tasks.length,
        completions
      };
    });

    $("#tournamentStats").innerHTML = categoryStats.map((item) => `
      <div class="tournament-stat">
        <span>${escapeHTML(CATEGORY_LABELS[item.category])}</span>
        <strong>${item.completions}</strong>
        <small>${item.tasks} missions</small>
      </div>
    `).join("");
  }

  function renderAchievements() {
    const stats = getProfileStats();
    const data = {
      tasks: state.tasks,
      totalCompletions: stats.totalCompletions,
      activeDays: stats.activeDays,
      points: stats.points
    };

    const unlocked = ACHIEVEMENTS.filter((achievement) => achievement.test(data)).length;
    $("#achievementCount").textContent = `${unlocked}/${ACHIEVEMENTS.length}`;

    $("#achievementsGrid").innerHTML = ACHIEVEMENTS.map((achievement) => {
      const isUnlocked = achievement.test(data);

      return `
        <div class="achievement ${isUnlocked ? "unlocked" : "locked"}">
          <div class="achievement-icon">
            <i class="fa-solid ${achievement.icon}"></i>
          </div>
          <div>
            <strong>${escapeHTML(achievement.title)}</strong>
            <p>${escapeHTML(achievement.description)}</p>
          </div>
          <span class="achievement-state">${isUnlocked ? "Unlocked" : "Locked"}</span>
        </div>
      `;
    }).join("");
  }

  function renderCharacters() {
    const current = state.profile.character;

    $("#characterGrid").innerHTML = Object.entries(CHARACTER_DATA).map(([id, character]) => `
      <button class="character-option ${id === current ? "selected" : ""}" data-character="${id}" style="--character-option-color: ${character.color}">
        <span class="character-option-image">
          <img src="${character.image}" alt="${escapeHTML(character.fullName)}">
        </span>
        <strong>${escapeHTML(character.name)}</strong>
        <small>${escapeHTML(character.achievement)}</small>
        ${id === current ? '<i class="fa-solid fa-circle-check"></i>' : ""}
      </button>
    `).join("");
  }

  function renderAll() {
    updateProfileUI();
    renderStats();
    renderWeekHeader();
    renderWeekGrid();
    renderTournament();
    renderAchievements();
    renderCharacters();
  }

  function openTaskModal(task = null) {
    $("#taskForm").reset();
    $("#taskId").value = task ? task.id : "";
    $("#taskModalTitle").textContent = task ? "Edit mission" : "New mission";

    $("#taskTitle").value = task?.title || "";
    $("#taskCategory").value = task?.category || "training";
    $("#taskPriority").value = task?.priority || "B";
    $("#taskDeadline").value = task?.deadline || "";
    $("#taskAvatar").value = task?.avatar || state.profile.character;
    $("#taskNotes").value = task?.notes || "";
    $("#reminderEnabled").checked = Boolean(task?.reminderEnabled);

    openModal("taskModal");
  }

  async function handleTaskSubmit(event) {
    event.preventDefault();

    const title = $("#taskTitle").value.trim();

    if (!title) {
      showToast("Every mission needs a title.", "error");
      return;
    }

    const existingId = $("#taskId").value;
    const existingTask = state.tasks.find((task) => task.id === existingId);

    const task = normalizeTask({
      ...(existingTask || {}),
      id: existingId || uid(),
      title,
      category: $("#taskCategory").value,
      priority: $("#taskPriority").value,
      deadline: $("#taskDeadline").value,
      avatar: $("#taskAvatar").value,
      notes: $("#taskNotes").value.trim(),
      reminderEnabled: $("#reminderEnabled").checked,
      completions: existingTask?.completions || {},
      order: existingTask?.order || Date.now(),
      createdAt: existingTask?.createdAt || serverTimestamp()
    });

    try {
      await saveTask(task);
      closeModal("taskModal");
      showToast(existingTask ? "Mission scroll updated." : "New mission added.");
      playSound("save");
    } catch (error) {
      console.error(error);
      showToast("Could not save the mission.", "error");
    }
  }

  async function toggleDay(taskId, dayKey) {
    if (isFutureDay(dayKey)) return;

    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;

    const wasCompleted = getCompletionForDay(task, dayKey);
    const completions = { ...(task.completions || {}) };

    if (wasCompleted) {
      delete completions[dayKey];
    } else {
      completions[dayKey] = true;
    }

    try {
      await saveTask({
        ...task,
        completions
      });

      if (!wasCompleted) {
        createParticleExplosion(event);
        showJutsu(task.avatar);
        playSound("complete");
      }

      renderAll();
    } catch (error) {
      console.error(error);
      showToast("Could not update mission status.", "error");
    }
  }

  async function handleDeleteTask(taskId) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;

    const confirmed = window.confirm(`Delete "${task.title}" from your mission scroll?`);
    if (!confirmed) return;

    try {
      await deleteTask(taskId);
      showToast("Mission deleted.");
    } catch (error) {
      console.error(error);
      showToast("Could not delete the mission.", "error");
    }
  }

  function attachTaskEvents() {
    $$("[data-action='toggle-day']").forEach((button) => {
      button.addEventListener("click", (event) => {
        toggleDay(button.dataset.taskId, button.dataset.day, event);
      });
    });

    $$("[data-action='edit-task']").forEach((button) => {
      button.addEventListener("click", () => {
        const task = state.tasks.find((item) => item.id === button.dataset.id);
        if (task) openTaskModal(task);
      });
    });

    $$("[data-action='delete-task']").forEach((button) => {
      button.addEventListener("click", () => handleDeleteTask(button.dataset.id));
    });

    $$("[data-action='new-task']").forEach((button) => {
      button.addEventListener("click", () => openTaskModal());
    });

    $$(".mission-row").forEach((row) => {
      row.addEventListener("dragstart", () => {
        state.draggedTaskId = row.dataset.taskId;
        row.classList.add("dragging");
      });

      row.addEventListener("dragend", () => {
        state.draggedTaskId = null;
        row.classList.remove("dragging");
        $$(".mission-row").forEach((item) => item.classList.remove("drag-over"));
      });

      row.addEventListener("dragover", (event) => {
        event.preventDefault();
        if (state.draggedTaskId !== row.dataset.taskId) row.classList.add("drag-over");
      });

      row.addEventListener("dragleave", () => row.classList.remove("drag-over"));

      row.addEventListener("drop", async (event) => {
        event.preventDefault();
        row.classList.remove("drag-over");

        const source = state.tasks.find((task) => task.id === state.draggedTaskId);
        const target = state.tasks.find((task) => task.id === row.dataset.taskId);

        if (!source || !target || source.id === target.id) return;

        const ordered = [...state.tasks].sort((a, b) => (a.order || 0) - (b.order || 0));
        const sourceIndex = ordered.findIndex((task) => task.id === source.id);
        const targetIndex = ordered.findIndex((task) => task.id === target.id);

        ordered.splice(sourceIndex, 1);
        ordered.splice(targetIndex, 0, source);

        try {
          await Promise.all(
            ordered.map((task, index) =>
              saveTask({ ...task, order: index + 1 })
            )
          );
          showToast("Mission order updated.");
        } catch (error) {
          console.error(error);
          showToast("Could not reorder missions.", "error");
        }
      });
    });
  }

  function createParticleExplosion(event) {
    const x = event?.clientX || window.innerWidth / 2;
    const y = event?.clientY || window.innerHeight / 2;
    const layer = $("#particleLayer");

    for (let index = 0; index < 18; index++) {
      const particle = document.createElement("span");
      const angle = (Math.PI * 2 * index) / 18;
      const distance = 45 + Math.random() * 70;

      particle.className = "completion-particle";
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
      particle.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
      particle.style.background = CHARACTER_DATA[state.profile.character].color;

      layer.appendChild(particle);
      setTimeout(() => particle.remove(), 850);
    }
  }

  function showJutsu(characterId) {
    const element = $("#heroJutsu");
    const character = CHARACTER_DATA[characterId] || CHARACTER_DATA.naruto;

    element.textContent = character.jutsu;
    element.classList.remove("jutsu-active");
    void element.offsetWidth;
    element.classList.add("jutsu-active");

    setTimeout(() => {
      element.classList.remove("jutsu-active");
    }, 1000);
  }

  function playSound(type) {
    if (!state.profile.soundEnabled) return;

    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = type === "complete" ? "sine" : "triangle";
      oscillator.frequency.value = type === "complete" ? 660 : 420;
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.3);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.32);
    } catch (error) {
      console.warn("Sound unavailable.", error);
    }
  }

  function rotateQuote() {
    const [quote, author] = QUOTES[state.quoteIndex % QUOTES.length];

    $("#rotatingQuote").classList.remove("quote-visible");
    setTimeout(() => {
      $("#rotatingQuote").textContent = quote;
      $("#quoteAuthor").textContent = author;
      $("#rotatingQuote").classList.add("quote-visible");
    }, 250);

    state.quoteIndex++;
  }

  function startQuoteRotation() {
    rotateQuote();
    state.quoteTimer = window.setInterval(rotateQuote, 7000);
  }

  function checkReminders() {
    const today = localDateKey();

    const reminders = state.tasks.filter((task) => {
      return task.reminderEnabled &&
        task.deadline === today &&
        !getCompletionForDay(task, today);
    });

    if (reminders.length && "Notification" in window && Notification.permission === "granted") {
      new Notification("Ninja Mission Tracker", {
        body: `${reminders.length} mission deadline${reminders.length > 1 ? "s" : ""} today.`
      });
    }
  }

  async function requestNotifications() {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
  }

  function exportBackup() {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: state.profile,
      tasks: state.tasks
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ninja-missions-${localDateKey()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);

    showToast("Mission backup downloaded.");
  }

  function restoreBackup(file) {
    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const backup = JSON.parse(reader.result);

        if (!backup || !Array.isArray(backup.tasks)) {
          throw new Error("Invalid backup");
        }

        const tasks = backup.tasks.map(normalizeTask);

        await Promise.all(tasks.map(saveTask));

        if (backup.profile && CHARACTER_DATA[backup.profile.character]) {
          await saveProfile({
            character: backup.profile.character,
            theme: backup.profile.theme === "light" ? "light" : "dark",
            soundEnabled: Boolean(backup.profile.soundEnabled)
          });
        }

        showToast("Mission backup restored.");
      } catch (error) {
        console.error(error);
        showToast("This backup file is invalid.", "error");
      }
    };

    reader.readAsText(file);
  }

  function bindEvents() {
    $("#addTaskButton").addEventListener("click", () => openTaskModal());
    $("#taskForm").addEventListener("submit", handleTaskSubmit);

    $("#previousWeek").addEventListener("click", () => {
      state.weekOffset--;
      renderAll();
    });

    $("#nextWeek").addEventListener("click", () => {
      state.weekOffset++;
      renderAll();
    });

    $("#todayButton").addEventListener("click", () => {
      state.weekOffset = 0;
      renderAll();
    });

    $("#searchInput").addEventListener("input", (event) => {
      state.filters.search = event.target.value;
      renderWeekGrid();
    });

    $("#categoryFilter").addEventListener("change", (event) => {
      state.filters.category = event.target.value;
      renderWeekGrid();
    });

    $("#priorityFilter").addEventListener("change", (event) => {
      state.filters.priority = event.target.value;
      renderWeekGrid();
    });

    $("#statusFilter").addEventListener("change", (event) => {
      state.filters.status = event.target.value;
      renderWeekGrid();
    });

    $$(".view-button").forEach((button) => {
      button.addEventListener("click", () => {
        state.view = button.dataset.view;

        $$(".view-button").forEach((item) => {
          item.classList.toggle("active", item === button);
        });

        $("#scrollView").classList.toggle("hidden", state.view !== "scroll");
        $("#tournamentView").classList.toggle("hidden", state.view !== "tournament");
      });
    });

    $("#profileButton").addEventListener("click", () => {
      const menu = $("#profileMenu");
      const isHidden = menu.classList.contains("hidden");

      menu.classList.toggle("hidden", !isHidden);
      $("#profileButton").setAttribute("aria-expanded", String(isHidden));
    });

    $("#openCharacterModal").addEventListener("click", () => {
      $("#profileMenu").classList.add("hidden");
      openModal("characterModal");
    });

    $("#backupButton").addEventListener("click", () => {
      $("#profileMenu").classList.add("hidden");
      exportBackup();
    });

    $("#restoreButton").addEventListener("click", () => {
      $("#profileMenu").classList.add("hidden");
      $("#restoreInput").click();
    });

    $("#restoreInput").addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (file) restoreBackup(file);
      event.target.value = "";
    });

    $("#logoutButton").addEventListener("click", async () => {
      await auth.signOut();
      window.location.href = "login.html";
    });

    $("#themeToggle").addEventListener("click", async () => {
      const theme = state.profile.theme === "light" ? "dark" : "light";
      await saveProfile({ theme });
      updateProfileUI();
    });

    $("#soundToggle").addEventListener("click", async () => {
      const soundEnabled = !state.profile.soundEnabled;
      await saveProfile({ soundEnabled });
      updateProfileUI();
      playSound("save");
    });

    $("#characterGrid").addEventListener("click", async (event) => {
      const option = event.target.closest("[data-character]");
      if (!option) return;

      const character = option.dataset.character;
      await saveProfile({ character });
      renderAll();
      closeModal("characterModal");
      showToast(`${CHARACTER_DATA[character].name} is now your active ninja.`);
      showJutsu(character);
    });

    document.addEventListener("click", (event) => {
      const closeButton = event.target.closest("[data-close-modal]");
      if (closeButton) closeModal(closeButton.dataset.closeModal);

      if (event.target.classList.contains("modal-backdrop")) {
        closeModal(event.target.id);
      }

      if (!event.target.closest(".user-menu")) {
        $("#profileMenu").classList.add("hidden");
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        $$(".modal-backdrop:not(.hidden)").forEach((modal) => closeModal(modal.id));
      }
    });
  }

  async function loadProfile() {
    const snapshot = await getUserDocument().get();

    if (snapshot.exists) {
      const data = snapshot.data();

      state.profile = {
        character: CHARACTER_DATA[data.character] ? data.character : "naruto",
        theme: data.theme === "light" ? "light" : "dark",
        soundEnabled: Boolean(data.soundEnabled)
      };
    } else {
      await saveProfile(state.profile);
    }
  }

  function listenForTasks() {
    state.unsubscribe = getTasksCollection()
      .orderBy("order", "asc")
      .onSnapshot((snapshot) => {
        state.tasks = snapshot.docs.map((doc) => normalizeTask({
          id: doc.id,
          ...doc.data()
        }));

        renderAll();
        checkReminders();
      }, (error) => {
        console.error(error);
        showToast("Could not load your mission scroll.", "error");
      });
  }

  async function boot(user) {
    state.user = user;

    try {
      await loadProfile();
      bindEvents();
      listenForTasks();
      startQuoteRotation();
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
      showToast("Could not summon your mission scroll.", "error");
    }
  }

  auth.onAuthStateChanged((user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    boot(user);
  });

  window.addEventListener("beforeunload", () => {
    if (state.unsubscribe) state.unsubscribe();
    window.clearInterval(state.quoteTimer);
    window.clearInterval(state.reminderTimer);
  });
})();
