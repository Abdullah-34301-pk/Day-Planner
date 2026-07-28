const STORAGE_KEY = 'day-planner-items-v1';
const EXPORT_FILE_NAME = 'day-planner-data.json';

const form = document.getElementById('planner-form');
const titleInput = document.getElementById('title');
const dateInput = document.getElementById('date');
const categoryInput = document.getElementById('category');
const notesInput = document.getElementById('notes');
const urgentInput = document.getElementById('urgent');
const tagInput = document.getElementById('tags');
const taskTableBody = document.getElementById('task-table-body');
const statusMessage = document.getElementById('status-message');
const exportButton = document.getElementById('export-btn');
const importInput = document.getElementById('import-json');
const taskCount = document.getElementById('task-count');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const doneCount = document.getElementById('done-count');
const urgentCount = document.getElementById('urgent-count');
const streakCount = document.getElementById('streak-count');
const todayProgress = document.getElementById('today-progress');
const nextTask = document.getElementById('next-task');
const motivationBanner = document.getElementById('motivation-banner');
const searchInput = document.getElementById('search-input');
const filterSelect = document.getElementById('filter-select');
const sortSelect = document.getElementById('sort-select');
const calendarGrid = document.getElementById('calendar-grid');
const calendarMonthLabel = document.getElementById('calendar-month-label');
const calendarDetail = document.getElementById('calendar-detail');
const calendarTodayButton = document.getElementById('calendar-today-btn');
const weeklyBars = document.getElementById('weekly-bars');
const upcomingList = document.getElementById('upcoming-list');
const timerDisplay = document.getElementById('timer-display');
const startTimerButton = document.getElementById('start-timer');
const pauseTimerButton = document.getElementById('pause-timer');
const resetTimerButton = document.getElementById('reset-timer');
const quickAddButtons = document.querySelectorAll('.quick-add-btn');
const viewButtons = document.querySelectorAll('[data-view]');
const viewSurfaces = document.querySelectorAll('.view-surface');
const quickAddCta = document.getElementById('quick-add-cta');
const jumpToView = document.getElementById('jump-to-view');

let tasks = [];
let currentView = 'table';
let pomodoroTime = 25 * 60;
let calendarDisplayDate = new Date();
let selectedCalendarDate = new Date();
let timerInterval = null;
let draggedTaskId = null;
let statsAnimated = false;
let reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function todayString() {
  return new Date().toISOString().split('T')[0];
}

function formatDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
  if (!dateString) return 'No date';
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getDueStatus(task) {
  if (task.done) return 'Completed';
  if (!task.date) return 'No date';
  const today = todayString();
  const taskDate = task.date;
  if (taskDate < today) return 'Overdue';
  if (taskDate === today) return 'Due today';
  return 'Upcoming';
}

function loadTasks() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      tasks = JSON.parse(saved);
    } catch (error) {
      tasks = [];
    }
  }
}

function saveTasks(message = 'Saved locally.') {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  render();
  setStatus(message);
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.style.color = isError ? 'var(--error)' : 'var(--primary)';
}

function getFilteredTasks() {
  const query = searchInput.value.trim().toLowerCase();
  const filter = filterSelect.value;
  const sort = sortSelect.value;

  let filtered = tasks.filter((task) => {
    const matchesQuery = !query || task.title.toLowerCase().includes(query) || task.notes.toLowerCase().includes(query) || task.category.toLowerCase().includes(query);
    const matchesFilter = filter === 'all' || (filter === 'active' && !task.done) || (filter === 'completed' && task.done) || (filter === 'urgent' && task.urgent);
    return matchesQuery && matchesFilter;
  });

  filtered = filtered.sort((a, b) => {
    if (sort === 'urgent') {
      return Number(b.urgent) - Number(a.urgent);
    }
    if (sort === 'status') {
      return Number(a.done) - Number(b.done);
    }
    return a.date.localeCompare(b.date);
  });

  return filtered;
}

function animateNumericValue(element, toValue, { duration = 900, suffix = '' } = {}) {
  const currentText = element.textContent.replace(/[^0-9.-]/g, '');
  const fromValue = Number.parseFloat(currentText || element.dataset.value || '0');
  const safeFrom = Number.isFinite(fromValue) ? fromValue : 0;
  const safeTo = Number(toValue);

  if (reduceMotion || safeFrom === safeTo) {
    element.textContent = `${safeTo}${suffix}`;
    element.dataset.value = String(safeTo);
    return;
  }

  const startTime = performance.now();
  const tick = (time) => {
    const progress = Math.min((time - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = safeFrom + (safeTo - safeFrom) * eased;
    element.textContent = `${Math.round(current)}${suffix}`;
    if (progress < 1) {
      window.requestAnimationFrame(tick);
    } else {
      element.textContent = `${Math.round(safeTo)}${suffix}`;
      element.dataset.value = String(safeTo);
    }
  };

  window.requestAnimationFrame(tick);
}

function renderHeaderStats() {
  const completed = tasks.filter((task) => task.done).length;
  const urgent = tasks.filter((task) => task.urgent).length;

  if (!statsAnimated) {
    animateNumericValue(taskCount, tasks.length, { duration: 900 });
    animateNumericValue(doneCount, completed, { duration: 900 });
    animateNumericValue(urgentCount, urgent, { duration: 900 });
    statsAnimated = true;
  } else {
    taskCount.textContent = tasks.length;
    doneCount.textContent = completed;
    urgentCount.textContent = urgent;
  }

  const completedDates = tasks.filter((task) => task.done && task.completedAt).map((task) => task.completedAt);
  const uniqueDates = new Set(completedDates);
  let streak = 0;
  let cursor = new Date();
  while (uniqueDates.has(cursor.toISOString().split('T')[0])) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  animateNumericValue(streakCount, streak, { duration: 900 });

  const todayTasks = tasks.filter((task) => task.date === todayString());
  const todayCompleted = todayTasks.filter((task) => task.done).length;
  const todayPercent = todayTasks.length ? Math.round((todayCompleted / todayTasks.length) * 100) : 0;
  animateNumericValue(todayProgress, todayPercent, { duration: 900, suffix: '%' });

  const next = [...tasks]
    .filter((task) => !task.done)
    .sort((a, b) => {
      if (a.urgent !== b.urgent) return Number(b.urgent) - Number(a.urgent);
      return (a.date || '').localeCompare(b.date || '');
    })[0];
  nextTask.textContent = next ? next.title : 'All clear';

  if (tasks.length && !tasks.some((task) => !task.done)) {
    motivationBanner.classList.remove('hidden');
    motivationBanner.textContent = 'Everything is wrapped up. That is a strong day.';
  } else {
    motivationBanner.classList.add('hidden');
  }
}

function revealRows() {
  const rows = taskTableBody.querySelectorAll('tr');
  rows.forEach((row, index) => {
    row.classList.add('reveal');
    row.classList.add('is-visible');
    row.style.setProperty('--row-delay', `${index * 40}ms`);
  });
}

function renderTable() {
  const visibleTasks = getFilteredTasks();

  if (!visibleTasks.length) {
    taskTableBody.innerHTML = '<tr><td colspan="6" class="empty-state">No matching plans. Try another search or filter.</td></tr>';
    return;
  }

  taskTableBody.innerHTML = visibleTasks
    .map((task, index) => {
      const status = getDueStatus(task);
      const doneClass = task.done ? 'done' : '';
      const overdueClass = status === 'Overdue' && !task.done ? 'overdue' : '';
      const tags = (task.tags || []).join(', ');
      return `
        <tr class="${doneClass} ${overdueClass}" draggable="true" data-id="${task.id}" style="--row-delay:${index * 40}ms">
          <td>
            <input class="check-box" type="checkbox" data-action="toggle-done" data-id="${task.id}" ${task.done ? 'checked' : ''} />
          </td>
          <td>
            <div class="task-title">${escapeHtml(task.title)}</div>
            <div class="task-notes">${escapeHtml(task.notes || 'No notes')}</div>
            ${task.category ? `<div class="badge">${escapeHtml(task.category)}</div>` : ''}
            ${tags ? `<div class="badge">${escapeHtml(tags)}</div>` : ''}
          </td>
          <td>${escapeHtml(formatDate(task.date))}</td>
          <td>${task.category ? escapeHtml(task.category) : 'General'}</td>
          <td>
            <div class="badge">${escapeHtml(status)}</div>
            ${task.urgent ? '<span class="badge urgent">Urgent</span>' : ''}
            ${task.done ? '<span class="badge done">Done</span>' : ''}
          </td>
          <td>
            <div class="task-actions">
              <button class="icon-btn" data-action="toggle-urgent" data-id="${task.id}">${task.urgent ? '★' : '☆'}</button>
              <button class="icon-btn" data-action="delete" data-id="${task.id}">✕</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  window.requestAnimationFrame(revealRows);
}

function renderCalendar() {
  const year = calendarDisplayDate.getFullYear();
  const month = calendarDisplayDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDay = firstDay.getDay();
  const monthLabel = firstDay.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const selectedDateValue = formatDateValue(selectedCalendarDate);

  calendarMonthLabel.textContent = monthLabel;

  const cells = [];
  for (let i = 0; i < startDay; i += 1) {
    cells.push('<div class="calendar-day empty"></div>');
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayValue = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayTasks = tasks.filter((task) => task.date === dayValue);
    const count = dayTasks.length;
    const completedCount = dayTasks.filter((task) => task.done).length;
    const isToday = dayValue === todayString();
    const isSelected = dayValue === selectedDateValue;
    cells.push(`
      <button type="button" class="calendar-day ${isToday ? 'active' : ''} ${isSelected ? 'selected' : ''}" data-date="${dayValue}">
        <div class="day-label">${day}</div>
        <div class="day-count">${count} plan${count === 1 ? '' : 's'}</div>
        <div class="day-meta">${completedCount}/${count} done</div>
      </button>
    `);
  }

  calendarGrid.innerHTML = cells.join('');
  renderCalendarDetail();
}

function renderCalendarDetail() {
  const selectedDateValue = formatDateValue(selectedCalendarDate);
  const selectedTasks = tasks.filter((task) => task.date === selectedDateValue);
  const completedCount = selectedTasks.filter((task) => task.done).length;
  const selectedLabel = new Date(`${selectedDateValue}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  if (!selectedTasks.length) {
    calendarDetail.innerHTML = `
      <div class="calendar-detail-header">
        <div>
          <h4>${selectedLabel}</h4>
          <p>No plans scheduled for this day.</p>
        </div>
        <span class="calendar-pill">0 plans</span>
      </div>
    `;
    return;
  }

  calendarDetail.innerHTML = `
    <div class="calendar-detail-header">
      <div>
        <h4>${selectedLabel}</h4>
        <p>${completedCount} of ${selectedTasks.length} tasks completed.</p>
      </div>
      <span class="calendar-pill">${completedCount}/${selectedTasks.length} done</span>
    </div>
    <ul class="calendar-task-list">
      ${selectedTasks
        .map((task) => `
          <li class="calendar-task-item ${task.done ? 'done' : ''}">
            <div class="calendar-task-top">
              <strong>${escapeHtml(task.title)}</strong>
              <span class="badge ${task.urgent ? 'urgent' : ''} ${task.done ? 'done' : ''}">${task.done ? 'Done' : task.urgent ? 'Urgent' : 'Planned'}</span>
            </div>
            <div class="calendar-task-meta">${escapeHtml(task.category || 'General')} · ${escapeHtml(task.notes || 'No notes')}</div>
          </li>
        `)
        .join('')}
    </ul>
  `;
}

function renderInsights() {
  const lastSevenDays = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    lastSevenDays.push(d.toISOString().split('T')[0]);
  }

  weeklyBars.innerHTML = lastSevenDays
    .map((day) => {
      const completed = tasks.filter((task) => task.done && task.completedAt === day).length;
      const height = completed ? Math.max(18, completed * 26) : 12;
      const label = day.slice(5);
      return `<div class="week-bar" style="height:${height}px"><span>${label}</span></div>`;
    })
    .join('');

  const upcoming = [...tasks]
    .filter((task) => !task.done)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .slice(0, 5);

  upcomingList.innerHTML = upcoming.length
    ? upcoming.map((task) => `<li>${escapeHtml(task.title)} · ${escapeHtml(formatDate(task.date))}</li>`).join('')
    : '<li>No upcoming work.</li>';
}

function renderTimer() {
  const minutes = Math.floor(pomodoroTime / 60);
  const seconds = pomodoroTime % 60;
  timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function render() {
  renderHeaderStats();
  renderTable();
  renderCalendar();
  renderInsights();
  renderTimer();
}

function addTask(event) {
  event.preventDefault();
  const title = titleInput.value.trim();
  const date = dateInput.value || todayString();
  const notes = notesInput.value.trim();
  const urgent = urgentInput.checked;
  const category = categoryInput.value;
  const tags = tagInput.value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (!title) {
    setStatus('Please add a task title first.', true);
    return;
  }

  tasks.unshift({
    id: createId(),
    title,
    date,
    category,
    urgent,
    notes,
    tags,
    done: false,
    createdAt: new Date().toISOString(),
    completedAt: '',
  });

  saveTasks('Task added and saved locally.');
  form.reset();
  dateInput.value = todayString();
  categoryInput.value = 'General';
}

function handleTaskActions(event) {
  const control = event.target.closest('button, input');
  if (!control) return;

  const action = control.dataset.action;
  const id = control.dataset.id;
  if (!id) return;

  if (action === 'toggle-done') {
    tasks = tasks.map((task) => {
      if (task.id !== id) return task;
      const done = !task.done;
      return { ...task, done, completedAt: done ? todayString() : '' };
    });
    saveTasks('Progress updated.');
  }

  if (action === 'toggle-urgent') {
    tasks = tasks.map((task) => (task.id === id ? { ...task, urgent: !task.urgent } : task));
    saveTasks('Urgency updated.');
  }

  if (action === 'delete') {
    tasks = tasks.filter((task) => task.id !== id);
    saveTasks('Task removed.');
  }
}

function exportToJson() {
  const payload = { exportedAt: new Date().toISOString(), tasks };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = EXPORT_FILE_NAME;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  setStatus('JSON backup exported.');
}

function importFromJson(file) {
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const payload = JSON.parse(event.target.result);
      const importedTasks = Array.isArray(payload) ? payload : payload.tasks || [];
      if (!Array.isArray(importedTasks)) throw new Error('Invalid JSON file.');

      tasks = importedTasks.map((task) => ({
        id: task.id || createId(),
        title: task.title || '',
        date: task.date || todayString(),
        category: task.category || 'General',
        urgent: Boolean(task.urgent),
        notes: task.notes || '',
        tags: Array.isArray(task.tags) ? task.tags : [],
        done: Boolean(task.done),
        createdAt: task.createdAt || new Date().toISOString(),
        completedAt: task.completedAt || '',
      }));

      saveTasks('Tasks imported from JSON file.');
    } catch (error) {
      setStatus(`Unable to import JSON: ${error.message}`, true);
    }
  };
  reader.readAsText(file);
}

function handleImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  importFromJson(file);
  event.target.value = '';
}

function switchTab(tabName) {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  tabContents.forEach((content) => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });
}

function setView(viewName) {
  currentView = viewName;
  viewButtons.forEach((button) => {
    const isActive = button.dataset.view === viewName;
    button.classList.toggle('active', isActive);
  });
  viewSurfaces.forEach((surface) => {
    surface.classList.toggle('active', surface.id === `${viewName === 'table' ? 'table' : 'calendar'}-view`);
  });
}

function changeCalendarMonth(step) {
  calendarDisplayDate = new Date(calendarDisplayDate.getFullYear(), calendarDisplayDate.getMonth() + step, 1);
  if (selectedCalendarDate.getMonth() !== calendarDisplayDate.getMonth() || selectedCalendarDate.getFullYear() !== calendarDisplayDate.getFullYear()) {
    selectedCalendarDate = new Date(calendarDisplayDate.getFullYear(), calendarDisplayDate.getMonth(), 1);
  }
  renderCalendar();
}

function changeCalendarYear(step) {
  calendarDisplayDate = new Date(calendarDisplayDate.getFullYear() + step, calendarDisplayDate.getMonth(), 1);
  if (selectedCalendarDate.getFullYear() !== calendarDisplayDate.getFullYear() || selectedCalendarDate.getMonth() !== calendarDisplayDate.getMonth()) {
    selectedCalendarDate = new Date(calendarDisplayDate.getFullYear(), calendarDisplayDate.getMonth(), 1);
  }
  renderCalendar();
}

function selectCalendarDate(dateValue) {
  const [year, month, day] = dateValue.split('-').map(Number);
  selectedCalendarDate = new Date(year, month - 1, day);
  calendarDisplayDate = new Date(year, month - 1, 1);
  renderCalendar();
}

function startTimer() {
  if (timerInterval) return;
  timerInterval = window.setInterval(() => {
    pomodoroTime -= 1;
    if (pomodoroTime <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      pomodoroTime = 25 * 60;
      setStatus('Focus session complete. Nice work.');
    }
    renderTimer();
  }, 1000);
}

function pauseTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function resetTimer() {
  pauseTimer();
  pomodoroTime = 25 * 60;
  renderTimer();
}

function handleQuickAdd(event) {
  const button = event.target.closest('button');
  if (!button) return;
  titleInput.value = button.dataset.title || '';
  categoryInput.value = button.dataset.category || 'General';
  urgentInput.checked = true;
  dateInput.value = todayString();
  switchTab('add');
}

function reorderTasks(fromId, toId) {
  const fromIndex = tasks.findIndex((task) => task.id === fromId);
  const toIndex = tasks.findIndex((task) => task.id === toId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
  const [moved] = tasks.splice(fromIndex, 1);
  tasks.splice(toIndex, 0, moved);
  saveTasks('Tasks reordered.');
}

function initRevealObserver() {
  const revealTargets = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    revealTargets.forEach((target) => target.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18 }
  );

  revealTargets.forEach((target) => observer.observe(target));
}

form.addEventListener('submit', addTask);
taskTableBody.addEventListener('click', (event) => {
  if (event.target.closest('button')) {
    handleTaskActions(event);
  }
});
taskTableBody.addEventListener('change', (event) => {
  if (event.target.classList.contains('check-box')) {
    handleTaskActions(event);
  }
});
taskTableBody.addEventListener('dragstart', (event) => {
  const row = event.target.closest('tr');
  if (!row) return;
  draggedTaskId = row.dataset.id;
});
taskTableBody.addEventListener('dragover', (event) => {
  event.preventDefault();
});
taskTableBody.addEventListener('drop', (event) => {
  event.preventDefault();
  const row = event.target.closest('tr');
  if (!row || !draggedTaskId) return;
  reorderTasks(draggedTaskId, row.dataset.id);
  draggedTaskId = null;
});

exportButton.addEventListener('click', exportToJson);
importInput.addEventListener('change', handleImport);
startTimerButton.addEventListener('click', startTimer);
pauseTimerButton.addEventListener('click', pauseTimer);
resetTimerButton.addEventListener('click', resetTimer);
calendarGrid.addEventListener('click', (event) => {
  const dayButton = event.target.closest('button[data-date]');
  if (dayButton) {
    selectCalendarDate(dayButton.dataset.date);
  }
});
document.querySelectorAll('[data-calendar-nav]').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.calendarNav === 'prev-month') changeCalendarMonth(-1);
    if (button.dataset.calendarNav === 'next-month') changeCalendarMonth(1);
    if (button.dataset.calendarNav === 'prev-year') changeCalendarYear(-1);
    if (button.dataset.calendarNav === 'next-year') changeCalendarYear(1);
  });
});
calendarTodayButton.addEventListener('click', () => {
  calendarDisplayDate = new Date();
  selectedCalendarDate = new Date();
  renderCalendar();
});
quickAddButtons.forEach((button) => button.addEventListener('click', handleQuickAdd));
viewButtons.forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
searchInput.addEventListener('input', render);
filterSelect.addEventListener('change', render);
sortSelect.addEventListener('change', render);

tabButtons.forEach((button) => {
  button.addEventListener('click', () => switchTab(button.dataset.tab));
});

quickAddCta.addEventListener('click', () => {
  titleInput.value = 'Write one focused note';
  categoryInput.value = 'Study';
  dateInput.value = todayString();
  switchTab('add');
});

jumpToView.addEventListener('click', () => {
  setView('table');
  switchTab('view');
});

dateInput.value = todayString();
categoryInput.value = 'General';
switchTab('add');
setView('table');
loadTasks();
render();
calendarDisplayDate = new Date();
selectedCalendarDate = new Date();
renderCalendar();
initRevealObserver();
