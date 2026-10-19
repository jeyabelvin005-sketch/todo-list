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

  // Shared missions: show the day name and date (e.g. "Mon 12") above the
  // 7 day buttons. Today is highlighted in the same blue as the rest of the app.
  const originalShared = renderSharedMissions;
  window.renderSharedMissions = async function (incoming, outgoing) {
    await originalShared(incoming, outgoing);
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const todayIdx = getTodayIndex();
    const cells = names.map((n, i) => {
      const d = new Date(currentWeekStart); d.setDate(d.getDate() + i);
      const color = i === todayIdx ? '#00d9ff' : 'rgba(255,200,100,0.8)';
      return `<div style="text-align:center;font-size:10px;line-height:1.3;font-weight:700;color:${color}">${n}<br>${d.getDate()}</div>`;
    }).join('');
    document.querySelectorAll('#sharedMissionsList .shared-week-grid').forEach(grid => {
      const labels = document.createElement('div');
      labels.className = 'shared-week-grid';           // same 7-column grid, so labels line up
      labels.style.cssText = 'background:transparent;padding:0 8px;margin-bottom:-8px;';
      labels.innerHTML = cells;
      grid.parentNode.insertBefore(labels, grid);
    });
  };

  // Shared missions now follow the week arrows / Today button
  // (before, they stayed on the week they first loaded).
  ['prevWeekBtn', 'nextWeekBtn', 'todayBtn'].forEach(id => {
    const btn = byId(id);
    if (!btn) return;
    btn.addEventListener('click', () => setTimeout(() => {
      renderSharedMissions(
        acceptedChallenges,
        outgoingChallenges.filter(c => c.status === 'accepted' && c.taskText !== 'Follow Request')
      );
    }, 0));                                            // wait until script.js has changed the week
  });

  // Broadcast: asks before sending a mission to ALL followers.
  const originalBroadcast = window.broadcastTask;
  window.broadcastTask = function () {
    const select = byId('broadcastTaskSelect');
    if (select && select.value && !confirm('Send this mission to ALL your followers?')) return;
    return originalBroadcast();
  };

  // Chat: very long messages are blocked with a clear message.
  const originalSend = window.sendChatMessage;
  window.sendChatMessage = function () {
    const input = byId('chatInput');
    if (input && input.value.trim().length > 500) { alert('Messages can be up to 500 characters.'); return; }
    return originalSend();
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

  // ------------------------------------------
  // 5. BOTTOM BUTTONS STYLE (Save Scroll / Clear All)
  // Same look as your other buttons: gradient, glow, lift on hover.
  // ------------------------------------------
  const btnStyle = document.createElement('style');
  btnStyle.textContent = `
    .bottom-actions{display:flex;justify-content:center;gap:14px;flex-wrap:wrap;margin-top:10px}
    .export-btn,.clear-btn{padding:14px 28px;border:none;border-radius:12px;font-size:15px;font-weight:700;color:#fff;display:flex;align-items:center;gap:8px;transition:all .3s}
    .export-btn{background:linear-gradient(135deg,var(--sasuke-blue),#2d3a8c);box-shadow:0 5px 20px rgba(74,95,193,.45)}
    .export-btn:hover{transform:translateY(-3px);box-shadow:0 12px 30px rgba(74,95,193,.75)}
    .clear-btn{background:linear-gradient(135deg,#d32f2f,#b71c1c);box-shadow:0 5px 20px rgba(211,47,47,.4)}
    .clear-btn:hover{transform:translateY(-3px);box-shadow:0 12px 30px rgba(211,47,47,.7)}
    @media(max-width:768px){.bottom-actions button{width:100%;justify-content:center}}`;
  document.head.appendChild(btnStyle);

  // ------------------------------------------
  // 6. AVATAR BUILDER: more options + full body
  // Old saved avatars still work. The small round avatars (header, friend
  // profile) stay head-and-shoulders; only the editor preview shows the body.
  // ------------------------------------------
  const P = (d) => `<path d="${d}"/>`;
  const C = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}"/>`;
  const SHORT = P('M 55 90 Q 55 45 100 45 Q 145 45 145 90 Q 130 60 100 60 Q 70 60 55 90 Z');
  const HAIR = {                       // [behind head, in front of head]
    short: ['', SHORT],
    long: [P('M 50 100 Q 50 40 100 40 Q 150 40 150 100 L 165 180 L 35 180 Z'), SHORT],
    spiky: ['', P('M 50 100 L 70 50 L 85 80 L 100 30 L 115 80 L 130 50 L 150 100 Q 130 70 100 70 Q 70 70 50 100 Z')],
    bald: ['', ''],
    mohawk: ['', P('M 85 60 L 85 30 L 95 40 L 100 20 L 105 40 L 115 30 L 115 60 Z M 90 60 L 110 60 L 110 90 L 90 90 Z')],
    bob: ['', P('M 45 90 Q 45 40 100 40 Q 155 40 155 90 L 155 140 Q 140 130 140 80 Q 120 60 100 60 Q 80 60 60 80 Q 60 130 45 140 Z')],
    ponytail: [P('M 120 50 Q 190 60 168 150 Q 152 95 125 75 Z'), SHORT],
    buns: [C(62, 48, 17) + C(138, 48, 17), SHORT],
    sidepart: ['', P('M 52 95 Q 52 42 100 42 Q 148 42 148 95 Q 142 68 112 62 Q 75 72 52 95 Z')],
    curly: [C(66, 58, 15) + C(86, 46, 16) + C(110, 46, 16) + C(134, 58, 15), SHORT]
  };
  const OUTFIT = {                     // top colour, pants colour, extra art
    orange: { top: '#ff6b1a', pants: '#1f3a93', x: '' },
    akatsuki: { top: '#111', pants: '#111', x: '<circle cx="75" cy="195" r="9" fill="#e11" opacity=".85"/><circle cx="125" cy="225" r="8" fill="#e11" opacity=".85"/>' },
    leaf: { top: '#3b4a8a', pants: '#2b2f55', x: '<rect x="64" y="172" width="72" height="80" rx="8" fill="#2d7a3e"/>' },
    sand: { top: '#8d5524', pants: '#5a3a1a', x: '' },
    hokage: { top: '#f5f5f5', pants: '#d9d9d9', x: '<rect x="50" y="240" width="100" height="16" fill="#d32f2f"/>' },
    anbu: { top: '#6b7280', pants: '#374151', x: '<rect x="70" y="176" width="60" height="52" rx="8" fill="#9ca3af"/>' },
    kimono: { top: '#ff69b4', pants: '#e0559c', x: '<rect x="50" y="205" width="100" height="14" fill="#fff"/>' },
    sound: { top: '#a78bfa', pants: '#4b5563', x: '<rect x="50" y="238" width="100" height="9" fill="#fde68a"/>' }
  };
  const band = (fill, mark) => `<path d="M 55 75 Q 100 70 145 75 L 145 90 Q 100 85 55 90 Z" fill="${fill}"/><rect x="85" y="75" width="30" height="15" fill="#bdc3c7" rx="2"/>${mark}`;
  const BAND = {
    none: '',
    leaf: band('#2c3e50', '<path d="M 95 80 L 105 80 L 100 87 Z" fill="#222"/>'),
    sand: band('#8d5524', '<circle cx="100" cy="82" r="4" fill="#222"/>'),
    missing: band('#2c3e50', '<line x1="85" y1="80" x2="115" y2="85" stroke="#222" stroke-width="2"/>'),
    mist: band('#475569', '<path d="M 92 83 Q 100 76 108 83" stroke="#222" fill="none" stroke-width="2"/>'),
    cloud: band('#1e3a8a', '<circle cx="96" cy="82" r="3" fill="#222"/><circle cx="104" cy="82" r="3" fill="#222"/>')
  };
  const eyes2 = (r) => `<circle cx="80" cy="95" r="${r}" fill="currentColor"/><circle cx="120" cy="95" r="${r}" fill="currentColor"/>`;
  const EXPR = {
    happy: { e: eyes2(5), m: 'M 85 120 Q 100 135 115 120' },
    neutral: { e: eyes2(5), m: 'M 85 125 L 115 125' },
    angry: { e: '<path d="M 70 90 L 90 100 M 110 100 L 130 90" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/>', m: 'M 85 130 Q 100 115 115 130' },
    surprised: { e: eyes2(7), m: 'M 92 125 a 8 8 0 1 0 16 0 a 8 8 0 1 0 -16 0' },
    sad: { e: eyes2(5), m: 'M 85 135 Q 100 120 115 135' },
    wink: { e: '<circle cx="80" cy="95" r="5" fill="currentColor"/><path d="M 112 95 L 128 95" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>', m: 'M 85 120 Q 100 135 115 120' },
    smirk: { e: eyes2(5), m: 'M 85 126 Q 105 136 120 118' }
  };
  const ACC = {
    none: '',
    glasses: '<g fill="none" stroke="#222" stroke-width="3"><circle cx="80" cy="95" r="13"/><circle cx="120" cy="95" r="13"/><path d="M 93 95 L 107 95"/></g>',
    mask: '<path d="M 58 108 Q 100 112 142 108 L 142 125 Q 100 152 58 125 Z" fill="#2c3e50"/>',
    whiskers: '<path d="M 62 105 L 76 108 M 62 114 L 76 114 M 62 123 L 76 120 M 138 105 L 124 108 M 138 114 L 124 114 M 138 123 L 124 120" stroke="#222" stroke-width="2" stroke-linecap="round"/>',
    scar: '<path d="M 118 78 L 132 118" stroke="#b33" stroke-width="3" stroke-linecap="round"/>'
  };

  function buildAvatar(cfg, full) {
    const sk = cfg.skin || '#f1c27d', hc = cfg.hairColor || '#2c1b18', ec = cfg.eyeColor || '#222';
    const o = OUTFIT[cfg.outfit] || OUTFIT.orange, h = HAIR[cfg.hairStyle] || HAIR.short, ex = EXPR[cfg.expression] || EXPR.happy;
    const faces = {
      round: `<circle cx="100" cy="105" r="50" fill="${sk}"/>`,
      square: `<rect x="55" y="55" width="90" height="90" rx="25" fill="${sk}"/>`,
      oval: `<ellipse cx="100" cy="105" rx="45" ry="55" fill="${sk}"/>`,
      pointy: `<path d="M 55 85 Q 100 50 145 85 Q 145 120 100 145 Q 55 120 55 85 Z" fill="${sk}"/>`
    };
    const body = `<rect x="85" y="140" width="30" height="30" fill="${sk}"/>
      <path d="M 55 165 L 35 245 L 52 252 L 70 190 Z M 145 165 L 165 245 L 148 252 L 130 190 Z" fill="${o.top}"/>
      <circle cx="43" cy="256" r="8" fill="${sk}"/><circle cx="157" cy="256" r="8" fill="${sk}"/>
      <path d="M 50 255 L 150 255 L 146 330 L 106 330 L 100 285 L 94 330 L 54 330 Z" fill="${o.pants}"/>
      <rect x="50" y="330" width="46" height="14" rx="6" fill="#222"/><rect x="104" y="330" width="46" height="14" rx="6" fill="#222"/>
      <path d="M 55 165 Q 100 150 145 165 L 150 258 L 50 258 Z" fill="${o.top}"/>${o.x}`;
    return `<svg viewBox="0 0 200 ${full ? 350 : 200}" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="${full ? 350 : 200}" fill="#f0f4f8"/>
      <g fill="${hc}">${h[0]}</g>${body}${faces[cfg.faceShape] || faces.round}${BAND[cfg.headband] || ''}
      <g style="color:${ec}">${ex.e}</g><path d="${ex.m}" stroke="#222" stroke-width="3" fill="none" stroke-linecap="round"/>
      ${ACC[cfg.accessory] || ''}<g fill="${hc}">${h[1]}</g></svg>`;
  }
  window.getAvatarSVG = (config, full) => buildAvatar(config || {}, !!full);

  window.renderAvatarPreview = function () {
    const box = byId('avatar-svg-container');
    if (box) { box.style.height = '315px'; box.style.borderRadius = '20px'; box.innerHTML = getAvatarSVG(currentAvatar, true); }
    setActiveColor('skin-palette', currentAvatar.skin); setActiveColor('hair-palette', currentAvatar.hairColor); setActiveColor('eye-palette', currentAvatar.eyeColor);
    setActiveBtn('face-shape-options', currentAvatar.faceShape, 'data-shape'); setActiveBtn('hair-style-options', currentAvatar.hairStyle, 'data-style');
    setActiveBtn('expression-options', currentAvatar.expression, 'data-expr'); setActiveBtn('outfit-options', currentAvatar.outfit, 'data-outfit');
    setActiveBtn('headband-options', currentAvatar.headband, 'data-band'); setActiveBtn('accessory-options', currentAvatar.accessory || 'none', 'data-acc');
  };

  // Ready-made characters: one tap sets the whole look.
  const CHARACTERS = {
    Naruto: { skin: '#f1c27d', faceShape: 'round', hairStyle: 'spiky', hairColor: '#e6c35c', eyeColor: '#4a5fc1', expression: 'happy', outfit: 'orange', headband: 'leaf', accessory: 'whiskers' },
    Sasuke: { skin: '#f1c27d', faceShape: 'oval', hairStyle: 'spiky', hairColor: '#1a1a2e', eyeColor: '#222', expression: 'neutral', outfit: 'sound', headband: 'leaf', accessory: 'none' },
    Sakura: { skin: '#f1c27d', faceShape: 'round', hairStyle: 'bob', hairColor: '#ff69b4', eyeColor: '#2e8b57', expression: 'happy', outfit: 'kimono', headband: 'leaf', accessory: 'none' },
    Kakashi: { skin: '#f1c27d', faceShape: 'oval', hairStyle: 'spiky', hairColor: '#cfd2d6', eyeColor: '#222', expression: 'neutral', outfit: 'leaf', headband: 'leaf', accessory: 'mask' },
    Itachi: { skin: '#f1c27d', faceShape: 'pointy', hairStyle: 'ponytail', hairColor: '#2c1b18', eyeColor: '#ff0000', expression: 'neutral', outfit: 'akatsuki', headband: 'missing', accessory: 'scar' },
    Gaara: { skin: '#f1c27d', faceShape: 'square', hairStyle: 'short', hairColor: '#ff4d4d', eyeColor: '#2e8b57', expression: 'angry', outfit: 'sand', headband: 'sand', accessory: 'none' },
    Hinata: { skin: '#ffe0bd', faceShape: 'round', hairStyle: 'long', hairColor: '#3b3f8f', eyeColor: '#8a4fff', expression: 'sad', outfit: 'anbu', headband: 'leaf', accessory: 'none' },
    Hokage: { skin: '#e0ac69', faceShape: 'oval', hairStyle: 'sidepart', hairColor: '#2c1b18', eyeColor: '#222', expression: 'smirk', outfit: 'hokage', headband: 'none', accessory: 'glasses' }
  };

  // Add the new buttons to the existing groups (your click handlers already cover them).
  const addBtns = (groupId, attr, items) => {
    const g = byId(groupId); if (!g) return;
    items.forEach(([v, label]) => { const b = document.createElement('button'); b.className = 'style-btn'; b.setAttribute(attr, v); b.textContent = label; g.appendChild(b); });
  };
  const addColors = (groupId, colors) => {
    const g = byId(groupId); if (!g) return;
    colors.forEach(c => { const b = document.createElement('button'); b.className = 'color-btn'; b.style.background = c; b.setAttribute('data-color', c); g.appendChild(b); });
  };
  addBtns('hair-style-options', 'data-style', [['ponytail', 'Ponytail'], ['buns', 'Buns'], ['sidepart', 'Side Part'], ['curly', 'Curly']]);
  addBtns('outfit-options', 'data-outfit', [['hokage', 'Hokage'], ['anbu', 'ANBU'], ['kimono', 'Kimono'], ['sound', 'Sound']]);
  addBtns('headband-options', 'data-band', [['mist', 'Mist'], ['cloud', 'Cloud']]);
  addBtns('expression-options', 'data-expr', [['wink', 'Wink'], ['smirk', 'Smirk']]);
  addColors('skin-palette', ['#ffe0bd', '#b87a4b']);
  addColors('hair-palette', ['#cfd2d6', '#2e8b57', '#8a4fff', '#ff8c00']);
  addColors('eye-palette', ['#8a4fff', '#ffd700', '#ff4da6']);

  // New groups: Characters (top) and Accessory (above Save Avatar).
  const controls = document.querySelector('.avatar-controls');
  if (controls) {
    const chars = document.createElement('div');
    chars.innerHTML = '<h4>Characters</h4><div class="style-options" id="character-options"></div>';
    controls.insertBefore(chars, controls.firstChild);
    Object.keys(CHARACTERS).forEach(n => {
      const b = document.createElement('button'); b.className = 'style-btn'; b.dataset.char = n; b.textContent = n; byId('character-options').appendChild(b);
    });
    byId('character-options').addEventListener('click', (e) => {
      const b = e.target.closest('.style-btn'); if (!b || !CHARACTERS[b.dataset.char]) return;
      currentAvatar = { ...CHARACTERS[b.dataset.char] }; renderAvatarPreview();
    });

    const acc = document.createElement('div');
    acc.innerHTML = '<h4>Accessory</h4><div class="style-options" id="accessory-options"></div>';
    controls.insertBefore(acc, controls.querySelector('button.add-btn'));
    [['none', 'None'], ['glasses', 'Glasses'], ['mask', 'Mask'], ['whiskers', 'Whiskers'], ['scar', 'Scar']].forEach(([v, l]) => {
      const b = document.createElement('button'); b.className = 'style-btn'; b.setAttribute('data-acc', v); b.textContent = l; byId('accessory-options').appendChild(b);
    });
    byId('accessory-options').addEventListener('click', (e) => {
      const b = e.target.closest('.style-btn'); if (!b) return;
      currentAvatar.accessory = b.getAttribute('data-acc'); renderAvatarPreview();
    });
  }

  // Apply saved dark mode immediately (avoids a light-mode flash on load).
  checkDarkMode();
})();
