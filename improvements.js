// ============================================
// 🍥 Ninja Mission Tracker — Improvements (add-on)
// ============================================
// Load AFTER script.js:   <script src="improvements.js"></script>
// No markup, CSS or layout is changed. This file only replaces or
// wraps logic functions from script.js to add validation, clearer
// messages, safer saving and keyboard shortcuts.
// To undo everything: remove the <script> tag.
//
// Sections:  1. Missions   2. Profile & Social   3. Leaderboard   4. Keyboard
// ============================================

(function () {
  // Safety check: script.js must load first.
  if (typeof renderTasks !== 'function') {
    console.error('improvements.js: script.js has not loaded. Make sure script.js loads without a 404 and that <script src="improvements.js"> comes AFTER <script src="script.js"> in index.html.');
    return;
  }

  const NAME_PATTERN = /^[a-zA-Z0-9_ ]+$/;   // same rule as the signup page
  const MAX_MISSION_LENGTH = 100;
  const byId = (id) => document.getElementById(id);

  // ------------------------------------------
  // 1. MISSIONS
  // ------------------------------------------

  // Add mission: validates input, blocks duplicates and double-submits,
  // and tells the user if saving fails.
  let addingTask = false;
  window.addTask = async function () {
    const input = byId('taskInput');
    if (!input || addingTask) return;
    const text = input.value.trim();
    if (!text) { alert('Please enter a mission first!'); input.focus(); return; }
    if (text.length > MAX_MISSION_LENGTH) {
      alert(`Mission names can be up to ${MAX_MISSION_LENGTH} characters (yours is ${text.length}).`);
      return;
    }
    if (tasks.some(t => String(t.text).toLowerCase() === text.toLowerCase())) {
      alert('You already have a mission with this name.');
      return;
    }
    addingTask = true;
    const newTask = { text, createdDate: getToday(), completions: {}, createdAt: Date.now() };
    try {
      const ref = await tasksCol().add(newTask);
      tasks.push({ id: ref.id, ...newTask });
      input.value = '';
      renderTasks(); updateStats();
    } catch (err) {
      console.error(err);
      alert('Could not save the mission. Check your connection and try again.');
    } finally {
      addingTask = false;
      input.focus();
    }
  };

  // Tick/untick a day: updates the screen instantly, then saves.
  // If saving fails, the change is undone and the user is told.
  window.toggleDay = async function (taskId, dateStr) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    task.completions = task.completions || {};
    const flip = () => {
      if (task.completions[dateStr]) delete task.completions[dateStr];
      else task.completions[dateStr] = true;
    };
    flip(); renderTasks(); updateStats();
    try {
      await tasksCol().doc(taskId).update({ completions: task.completions });
    } catch (err) {
      console.error(err);
      flip(); renderTasks(); updateStats();
      alert('Could not save your progress. Check your connection and try again.');
    }
  };

  // Delete mission: confirmation names the mission; handles errors.
  window.deleteTask = async function (taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (!confirm(`Delete "${task.text}"?\nIts progress history will be lost.`)) return;
    try {
      await tasksCol().doc(taskId).delete();
      tasks = tasks.filter(t => t.id !== taskId);
      renderTasks(); updateStats();
    } catch (err) {
      console.error(err);
      alert('Could not delete the mission. Try again.');
    }
  };

  // Clear all: clear warning, and works with more than 500 missions
  // (Firestore batches are limited to 500 writes).
  window.clearAllTasks = async function () {
    if (tasks.length === 0) { alert('You have no missions to clear.'); return; }
    if (!confirm(`Delete ALL ${tasks.length} missions?\nThis cannot be undone.`)) return;
    try {
      for (let i = 0; i < tasks.length; i += 400) {
        const batch = db.batch();
        tasks.slice(i, i + 400).forEach(t => batch.delete(tasksCol().doc(t.id)));
        await batch.commit();
      }
      tasks = [];
      renderTasks(); updateStats(); loadLeaderboard();
    } catch (err) {
      console.error(err);
      alert('Could not clear all missions. Some may remain; please refresh and try again.');
    }
  };

  // Backup: tell the user instead of downloading an empty file.
  const originalBackup = window.backupData;
  window.backupData = function () {
    if (!tasks.length) { alert('No missions to back up yet.'); return; }
    originalBackup();
  };

  // Safety: mission names are HTML-escaped when drawn in the table,
  // so a name like <b>hi</b> shows as text instead of being rendered.
  const originalRender = renderTasks;
  window.renderTasks = function () {
    const real = tasks;
    tasks = real.map(t => ({ ...t, text: escapeHtml(t.text) }));
    try { originalRender(); } finally { tasks = real; }
  };

  // ------------------------------------------
  // 2. PROFILE & SOCIAL
  // ------------------------------------------

  // Profile update: same name rules as signup. This also prevents
  // names with quotes that would break buttons in other users' lists.
  const originalSaveDetails = window.saveProfileDetails;
  window.saveProfileDetails = function () {
    const name = byId('usernameInput').value.trim();
    const msg = byId('usernameMessage');
    if (name.length >= 2 && name !== userProfile.displayName && !NAME_PATTERN.test(name)) {
      msg.textContent = 'Use letters, numbers, spaces and underscore only.';
      msg.className = 'modal-message show error';
      return;
    }
    return originalSaveDetails();
  };

  // Follow: stops duplicate requests and explains why.
  const originalFollow = window.followFriend;
  window.followFriend = function (uid, name, email) {
    const existing = outgoingChallenges.find(
      c => c.toUid === uid && c.taskText === 'Follow Request' && c.status !== 'rejected'
    );
    if (existing) {
      showFriendMessage(
        existing.status === 'accepted'
          ? 'You already follow this shinobi.'
          : 'Follow request already sent. Waiting for a reply.',
        'info'
      );
      return Promise.resolve();
    }
    return originalFollow(uid, name, email);
  };

  // Unfollow: the confirmation now says shared missions are removed too,
  // and failures are reported.
  window.removeFriend = async function (friendUid) {
    if (!confirm('Unfollow this shinobi?\nThis also removes any shared missions between you two.')) return;
    try {
      const [sent, received] = await Promise.all([
        challengesCol().where('fromUid', '==', currentUser.uid).where('toUid', '==', friendUid).get(),
        challengesCol().where('fromUid', '==', friendUid).where('toUid', '==', currentUser.uid).get()
      ]);
      const batch = db.batch();
      sent.forEach(d => batch.delete(d.ref));
      received.forEach(d => batch.delete(d.ref));
      await batch.commit();
      await loadChallenges();
      await loadLeaderboard();
      const card = byId('searchResultCard');
      if (card) card.style.display = 'none';
    } catch (err) {
      console.error(err);
      alert('Could not unfollow right now. Try again.');
    }
  };

  // ------------------------------------------
  // 3. LEADERBOARD
  // ------------------------------------------

  // The "friends" counter included you; now it counts only your friends
  // ("1 friend", "2 friends").
  const originalLeaderboard = loadLeaderboard;
  window.loadLeaderboard = async function () {
    await originalLeaderboard();
    const label = byId('friendCount');
    const m = label && label.textContent.match(/^(\d+) friends$/);
    if (m) {
      const n = Math.max(Number(m[1]) - 1, 0);
      label.textContent = `${n} friend${n === 1 ? '' : 's'}`;
    }
  };

  // ------------------------------------------
  // 4. KEYBOARD & STARTUP
  // ------------------------------------------

  // Escape closes whatever is on top: modal, chat, full-screen page, menu.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (byId('friendProfileModal').classList.contains('show')) return closeFriendProfileModal();
    if (byId('searchModal').classList.contains('show')) return closeSearchMenu();
    if (byId('chatWidget').style.display === 'flex') return closeChat();
    const pages = [
      ['comparePage', closeComparePage],
      ['friendProfilePage', closeFriendProfilePage],
      ['followRequestsPage', closeFollowRequestsPage],
      ['myProfilePage', closeMyProfilePage]
    ];
    for (const [id, close] of pages) {
      if (byId(id).classList.contains('active')) return close();
    }
    closeProfileMenu();
  });

  // Apply saved dark mode immediately (avoids a light-mode flash on load).
  checkDarkMode();
})();
