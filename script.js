const STORAGE_KEY = "nova-tasks-state-v1";
const RING_RADIUS = 54;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const state = {
  tasks: [],
  filter: "all",
  sort: "smart",
  search: "",
  composerPriority: "medium",
  editPriority: "medium",
  highlightTaskId: null,
  pendingDeleteId: null,
  confirmMode: null
};

const elements = {
  bootSplash: document.getElementById("bootSplash"),
  taskForm: document.getElementById("taskForm"),
  taskTitle: document.getElementById("taskTitle"),
  taskDetails: document.getElementById("taskDetails"),
  clearComposer: document.getElementById("clearComposer"),
  prioritySelector: document.getElementById("prioritySelector"),
  filterControl: document.getElementById("filterControl"),
  searchInput: document.getElementById("searchInput"),
  sortSelect: document.getElementById("sortSelect"),
  taskList: document.getElementById("taskList"),
  emptyState: document.getElementById("emptyState"),
  emptyStateBadge: document.getElementById("emptyStateBadge"),
  emptyStateTitle: document.getElementById("emptyStateTitle"),
  emptyStateMessage: document.getElementById("emptyStateMessage"),
  emptyStatePrimaryAction: document.getElementById("emptyStatePrimaryAction"),
  emptyStateSecondaryAction: document.getElementById("emptyStateSecondaryAction"),
  toastStack: document.getElementById("toastStack"),
  progressRingValue: document.getElementById("progressRingValue"),
  completionPercent: document.getElementById("completionPercent"),
  progressHeadline: document.getElementById("progressHeadline"),
  progressMessage: document.getElementById("progressMessage"),
  totalTasksValue: document.getElementById("totalTasksValue"),
  remainingTasksValue: document.getElementById("remainingTasksValue"),
  completedTodayValue: document.getElementById("completedTodayValue"),
  streakValue: document.getElementById("streakValue"),
  taskCounter: document.getElementById("taskCounter"),
  activeFocusChip: document.getElementById("activeFocusChip"),
  remainingLabel: document.getElementById("remainingLabel"),
  resetTasksButton: document.getElementById("resetTasksButton"),
  liveDate: document.getElementById("liveDate"),
  footerYear: document.getElementById("footerYear"),
  welcomeHeading: document.getElementById("welcomeHeading"),
  taskModal: document.getElementById("taskModal"),
  editTaskForm: document.getElementById("editTaskForm"),
  editTaskId: document.getElementById("editTaskId"),
  editTaskTitle: document.getElementById("editTaskTitle"),
  editTaskDetails: document.getElementById("editTaskDetails"),
  editPrioritySelector: document.getElementById("editPrioritySelector"),
  closeTaskModal: document.getElementById("closeTaskModal"),
  cancelTaskModal: document.getElementById("cancelTaskModal"),
  confirmModal: document.getElementById("confirmModal"),
  confirmModalEyebrow: document.getElementById("confirmModalEyebrow"),
  confirmModalTitle: document.getElementById("confirmModalTitle"),
  confirmModalCopy: document.getElementById("confirmModalCopy"),
  cancelDeleteButton: document.getElementById("cancelDeleteButton"),
  confirmDeleteButton: document.getElementById("confirmDeleteButton"),
  particles: document.getElementById("particles"),
  bubbles: document.getElementById("bubbles")
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.tasks)) {
      return;
    }

    state.tasks = saved.tasks.map((task) => ({
      ...task,
      expanded: Boolean(task.expanded)
    }));
  } catch (error) {
    console.warn("Unable to load state", error);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks: state.tasks }));
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function priorityRank(priority) {
  return { high: 3, medium: 2, low: 1 }[priority] || 0;
}

function getStatusLabel(task) {
  if (task.completed) {
    return "Done";
  }

  if (task.priority === "high") {
    return "In focus";
  }

  if (task.priority === "medium") {
    return "Queued";
  }

  return "On deck";
}

function compareTasks(a, b) {
  if (state.sort === "priority") {
    return priorityRank(b.priority) - priorityRank(a.priority) || Number(b.createdAt) - Number(a.createdAt);
  }

  if (state.sort === "newest") {
    return Number(b.createdAt) - Number(a.createdAt);
  }

  if (state.sort === "oldest") {
    return Number(a.createdAt) - Number(b.createdAt);
  }

  if (state.sort === "alpha") {
    return a.title.localeCompare(b.title);
  }

  const completedDelta = Number(a.completed) - Number(b.completed);
  if (completedDelta !== 0) {
    return completedDelta;
  }

  const priorityDelta = priorityRank(b.priority) - priorityRank(a.priority);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return Number(b.updatedAt) - Number(a.updatedAt);
}

function getVisibleTasks() {
  const query = state.search.trim().toLowerCase();

  return [...state.tasks]
    .filter((task) => {
      if (state.filter === "active" && task.completed) {
        return false;
      }

      if (state.filter === "completed" && !task.completed) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [task.title, task.details].some((value) => value.toLowerCase().includes(query));
    })
    .sort(compareTasks);
}

function formatTimestamp(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function formatDateBadge(date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(date);
}

function startOfDay(date) {
  const output = new Date(date);
  output.setHours(0, 0, 0, 0);
  return output;
}

function dateKey(timestamp) {
  const date = startOfDay(new Date(timestamp));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getStats() {
  const total = state.tasks.length;
  const completed = state.tasks.filter((task) => task.completed).length;
  const remaining = total - completed;
  const todayKey = dateKey(Date.now());
  const completedToday = state.tasks.filter((task) => task.completed && task.completedAt && dateKey(task.completedAt) === todayKey).length;
  const focusCount = state.tasks.filter((task) => !task.completed && task.priority === "high").length;

  const completionKeys = [...new Set(state.tasks
    .filter((task) => task.completed && task.completedAt)
    .map((task) => dateKey(task.completedAt)))];

  let streak = 0;
  let cursor = startOfDay(new Date());
  const completionSet = new Set(completionKeys);

  while (completionSet.has(dateKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return {
    total,
    completed,
    remaining,
    completedToday,
    focusCount,
    streak,
    percent
  };
}

function bumpValue(element, nextValue) {
  const incoming = String(nextValue);
  if (element.textContent === incoming) {
    return;
  }

  element.textContent = incoming;
  element.classList.remove("is-bumping");
  void element.offsetWidth;
  element.classList.add("is-bumping");
}

function updateDashboard() {
  const stats = getStats();

  bumpValue(elements.totalTasksValue, stats.total);
  bumpValue(elements.remainingTasksValue, stats.remaining);
  bumpValue(elements.completedTodayValue, stats.completedToday);
  bumpValue(elements.streakValue, stats.streak);

  elements.taskCounter.textContent = `${stats.total} ${stats.total === 1 ? "task" : "tasks"} live`;
  elements.activeFocusChip.textContent = `${stats.focusCount} in focus`;
  elements.remainingLabel.textContent = `${stats.remaining} remaining`;
  elements.resetTasksButton.disabled = stats.total === 0;

  elements.completionPercent.textContent = `${stats.percent}%`;
  elements.progressRingValue.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
  elements.progressRingValue.style.strokeDashoffset = `${RING_CIRCUMFERENCE - (stats.percent / 100) * RING_CIRCUMFERENCE}`;

  if (stats.total === 0) {
    elements.progressHeadline.textContent = "Ready when you are";
    elements.progressMessage.textContent = "Add your first task to start the session.";
  } else if (stats.percent === 100) {
    elements.progressHeadline.textContent = "Deck cleared";
    elements.progressMessage.textContent = "Everything is wrapped. Take the win and queue the next move.";
  } else {
    elements.progressHeadline.textContent = `${stats.completed} of ${stats.total} complete`;
    elements.progressMessage.textContent = `${stats.remaining} still active with ${stats.focusCount} high-priority ${stats.focusCount === 1 ? "item" : "items"} in view.`;
  }
}

function iconMarkup(name) {
  const icons = {
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7"></path></svg>',
    pencil: '<svg viewBox="0 0 24 24"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path></svg>',
    chevron: '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"></path></svg>',
    sparkle: '<svg viewBox="0 0 24 24"><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7Z"></path></svg>'
  };

  return icons[name];
}

function createBadge(text, className) {
  const badge = document.createElement("span");
  badge.className = `badge ${className}`;
  badge.textContent = text;
  return badge;
}

function createTaskCard(task) {
  const item = document.createElement("li");
  item.className = "task-card";
  item.dataset.id = task.id;

  if (task.completed) {
    item.classList.add("is-completed");
  }

  if (task.expanded) {
    item.classList.add("is-expanded");
  }

  if (state.highlightTaskId === task.id) {
    item.classList.add("is-entering");
  }

  const statusLabel = getStatusLabel(task);
  const previewText = task.details.trim() || "No extra details yet.";
  const completedLabel = task.completed && task.completedAt ? `Completed ${formatTimestamp(task.completedAt)}` : "Waiting for completion";

  item.innerHTML = `
    <div class="task-main">
      <button class="complete-toggle ${task.completed ? "is-completed" : ""}" type="button" data-action="toggle" aria-label="${task.completed ? "Mark as active" : "Mark as completed"}">
        ${iconMarkup("check")}
      </button>

      <div class="task-copy">
        <div class="task-title-row">
          <div>
            <h3 class="task-title">${escapeHtml(task.title)}</h3>
            <p class="task-preview">${escapeHtml(previewText)}</p>
          </div>
          <div class="badge-row"></div>
        </div>
      </div>

      <div class="task-actions">
        <button class="task-action" type="button" data-action="expand" aria-label="${task.expanded ? "Collapse details" : "Expand details"}" title="${task.expanded ? "Collapse details" : "Expand details"}">
          ${iconMarkup("chevron")}
        </button>
        <button class="task-action" type="button" data-action="edit" aria-label="Edit task" title="Edit task">
          ${iconMarkup("pencil")}
        </button>
        <button class="task-action" type="button" data-action="delete" aria-label="Delete task" title="Delete task">
          ${iconMarkup("trash")}
        </button>
      </div>
    </div>

    <div class="task-details">
      <div class="task-details__inner">
        <p>${escapeHtml(previewText)}</p>
        <div class="task-meta">
          <span>Created ${formatTimestamp(task.createdAt)}</span>
          <span>Updated ${formatTimestamp(task.updatedAt)}</span>
          <span>${completedLabel}</span>
        </div>
      </div>
    </div>
  `;

  const badgeRow = item.querySelector(".badge-row");
  badgeRow.append(
    createBadge(statusLabel, task.completed ? "badge--status-done" : "badge--status"),
    createBadge(capitalize(task.priority), `badge--priority-${task.priority}`)
  );

  return item;
}

function captureRects() {
  const rects = new Map();
  elements.taskList.querySelectorAll(".task-card").forEach((card) => {
    rects.set(card.dataset.id, card.getBoundingClientRect());
  });
  return rects;
}

function animateLayout(previousRects) {
  requestAnimationFrame(() => {
    elements.taskList.querySelectorAll(".task-card").forEach((card) => {
      const previous = previousRects.get(card.dataset.id);
      if (!previous) {
        return;
      }

      const next = card.getBoundingClientRect();
      const deltaX = previous.left - next.left;
      const deltaY = previous.top - next.top;

      if (deltaX || deltaY) {
        card.animate(
          [
            { transform: `translate(${deltaX}px, ${deltaY}px)` },
            { transform: "translate(0, 0)" }
          ],
          {
            duration: 360,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)"
          }
        );
      }
    });
  });
}

function renderTasks() {
  const previousRects = captureRects();
  const visibleTasks = getVisibleTasks();

  elements.taskList.textContent = "";
  const fragment = document.createDocumentFragment();

  visibleTasks.forEach((task) => {
    fragment.append(createTaskCard(task));
  });

  elements.taskList.append(fragment);
  updateEmptyState(visibleTasks);

  animateLayout(previousRects);
  updateDashboard();

  state.highlightTaskId = null;
}

function updateEmptyState(visibleTasks) {
  const hasVisibleTasks = visibleTasks.length > 0;
  elements.emptyState.hidden = hasVisibleTasks;

  if (hasVisibleTasks) {
    return;
  }

  const hasAnyTasks = state.tasks.length > 0;
  const hasSearch = state.search.trim().length > 0;
  const hasFilter = state.filter !== "all";

  if (!hasAnyTasks) {
    elements.emptyStateBadge.textContent = "Clear runway";
    elements.emptyStateTitle.textContent = "No tasks yet";
    elements.emptyStateMessage.textContent = "Capture something important above and it will appear here with full motion and controls.";
    elements.emptyStatePrimaryAction.textContent = "Create a Task";
    elements.emptyStateSecondaryAction.hidden = true;
    return;
  }

  if (hasSearch || hasFilter) {
    elements.emptyStateBadge.textContent = "Filtered view";
    elements.emptyStateTitle.textContent = "Nothing matches this view";
    elements.emptyStateMessage.textContent = "Try clearing the current search or switching back to all tasks to see the rest of your list.";
    elements.emptyStatePrimaryAction.textContent = hasSearch ? "Clear Search" : "Show All Tasks";
    elements.emptyStateSecondaryAction.textContent = "Reset Filters";
    elements.emptyStateSecondaryAction.hidden = false;
    return;
  }

  elements.emptyStateBadge.textContent = "Clear runway";
  elements.emptyStateTitle.textContent = "No tasks in view";
  elements.emptyStateMessage.textContent = "Your current list is empty right now. Add something new above to get moving again.";
  elements.emptyStatePrimaryAction.textContent = "Create a Task";
  elements.emptyStateSecondaryAction.hidden = true;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function createTask({ title, details, priority }) {
  const now = Date.now();
  return {
    id: createId(),
    title,
    details,
    priority,
    completed: false,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    expanded: false
  };
}

function showToast(title, body, icon = "sparkle") {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `
    <div class="toast__icon">${iconMarkup(icon)}</div>
    <div>
      <span class="toast__title">${escapeHtml(title)}</span>
      <span class="toast__body">${escapeHtml(body)}</span>
    </div>
  `;

  elements.toastStack.append(toast);

  window.setTimeout(() => {
    toast.classList.add("is-exiting");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  }, 2800);
}

function resetComposer() {
  state.composerPriority = "medium";
  elements.taskForm.reset();
  elements.taskTitle.closest(".field").classList.remove("is-invalid");
  syncPriorityButtons(elements.prioritySelector, "data-priority", state.composerPriority);
}

function syncPriorityButtons(container, attribute, activeValue) {
  container.querySelectorAll(`[${attribute}]`).forEach((button) => {
    button.classList.toggle("is-active", button.getAttribute(attribute) === activeValue);
  });
}

function handleAddTask(event) {
  event.preventDefault();
  const title = elements.taskTitle.value.trim();
  const details = elements.taskDetails.value.trim();

  if (!title) {
    elements.taskTitle.closest(".field").classList.add("is-invalid");
    elements.taskTitle.focus();
    showToast("Task title needed", "Give the task a short name before adding it.", "sparkle");
    return;
  }

  elements.taskTitle.closest(".field").classList.remove("is-invalid");

  const task = createTask({
    title,
    details,
    priority: state.composerPriority
  });

  state.tasks.unshift(task);
  state.highlightTaskId = task.id;
  saveState();
  renderTasks();
  resetComposer();
  showToast("Task Added", `${task.title} is now in your queue.`, "sparkle");
}

function findTask(taskId) {
  return state.tasks.find((task) => task.id === taskId);
}

function toggleTask(taskId, trigger) {
  const task = findTask(taskId);
  if (!task) {
    return;
  }

  if (!task.completed && trigger) {
    const ripple = document.createElement("span");
    ripple.className = "complete-toggle__ripple";
    const rect = trigger.getBoundingClientRect();
    ripple.style.left = `${rect.width / 2}px`;
    ripple.style.top = `${rect.height / 2}px`;
    trigger.append(ripple);
    ripple.addEventListener("animationend", () => ripple.remove(), { once: true });

    const card = trigger.closest(".task-card");
    card?.classList.add("is-completed");
    trigger.classList.add("is-completed");

    window.setTimeout(() => {
      task.completed = true;
      task.completedAt = Date.now();
      task.updatedAt = Date.now();

      saveState();
      renderTasks();
      showToast("Task Completed", `${task.title} is complete.`, "check");
    }, 180);

    return;
  }

  task.completed = false;
  task.completedAt = null;
  task.updatedAt = Date.now();

  saveState();
  renderTasks();
  showToast("Task Reopened", `${task.title} is active again.`, "check");
}

function toggleExpanded(taskId) {
  const task = findTask(taskId);
  if (!task) {
    return;
  }

  task.expanded = !task.expanded;
  saveState();
  renderTasks();
}

function openTaskModal(taskId) {
  const task = findTask(taskId);
  if (!task) {
    return;
  }

  state.editPriority = task.priority;
  elements.editTaskId.value = task.id;
  elements.editTaskTitle.value = task.title;
  elements.editTaskDetails.value = task.details;
  elements.editTaskTitle.closest(".field").classList.remove("is-invalid");
  syncPriorityButtons(elements.editPrioritySelector, "data-edit-priority", state.editPriority);

  openModal(elements.taskModal);
  elements.editTaskTitle.focus();
}

function closeTaskModal() {
  closeModal(elements.taskModal);
  elements.editTaskForm.reset();
}

function openDeleteModal(taskId) {
  state.confirmMode = "delete";
  state.pendingDeleteId = taskId;
  elements.confirmModalEyebrow.textContent = "Delete task";
  elements.confirmModalTitle.textContent = "Remove this task?";
  elements.confirmModalCopy.textContent = "This removes the card from your deck and clears its progress state.";
  elements.cancelDeleteButton.textContent = "Keep It";
  elements.confirmDeleteButton.textContent = "Delete Task";
  openModal(elements.confirmModal);
}

function closeDeleteModal() {
  state.pendingDeleteId = null;
  state.confirmMode = null;
  closeModal(elements.confirmModal);
}

function openResetModal() {
  if (state.tasks.length === 0) {
    return;
  }

  state.confirmMode = "reset";
  state.pendingDeleteId = null;
  elements.confirmModalEyebrow.textContent = "Reset list";
  elements.confirmModalTitle.textContent = "Clear every task?";
  elements.confirmModalCopy.textContent = "This wipes the entire task list, resets search and filters, and starts you from a clean slate.";
  elements.cancelDeleteButton.textContent = "Cancel";
  elements.confirmDeleteButton.textContent = "Reset Everything";
  openModal(elements.confirmModal);
}

function openModal(modal) {
  window.clearTimeout(modal.hideTimer);
  modal.hidden = false;
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => modal.classList.add("is-open"));
}

function closeModal(modal) {
  modal.classList.remove("is-open");
  modal.hideTimer = window.setTimeout(() => {
    modal.hidden = true;
    if (elements.taskModal.hidden && elements.confirmModal.hidden) {
      document.body.classList.remove("modal-open");
    }
  }, 180);
}

function handleEditTask(event) {
  event.preventDefault();

  const task = findTask(elements.editTaskId.value);
  if (!task) {
    return;
  }

  const title = elements.editTaskTitle.value.trim();
  const details = elements.editTaskDetails.value.trim();

  if (!title) {
    elements.editTaskTitle.closest(".field").classList.add("is-invalid");
    elements.editTaskTitle.focus();
    return;
  }

  elements.editTaskTitle.closest(".field").classList.remove("is-invalid");

  task.title = title;
  task.details = details;
  task.priority = state.editPriority;
  task.updatedAt = Date.now();

  saveState();
  renderTasks();
  closeTaskModal();
  showToast("Task Edited", `${task.title} has been updated.`, "pencil");
}

function deleteTask(taskId) {
  const card = elements.taskList.querySelector(`[data-id="${taskId}"]`);
  const task = findTask(taskId);

  if (!task) {
    closeDeleteModal();
    return;
  }

  const finalize = () => {
    state.tasks = state.tasks.filter((entry) => entry.id !== taskId);
    saveState();
    renderTasks();
    closeDeleteModal();
    showToast("Task Deleted", `${task.title} was removed from your deck.`, "trash");
  };

  if (!card) {
    finalize();
    return;
  }

  card.classList.add("is-removing");
  card.addEventListener("animationend", finalize, { once: true });
}

function resetTaskList() {
  state.tasks = [];
  state.filter = "all";
  state.sort = "smart";
  state.search = "";
  state.pendingDeleteId = null;
  state.confirmMode = null;

  elements.searchInput.value = "";
  elements.sortSelect.value = "smart";
  elements.filterControl.querySelectorAll("[data-filter]").forEach((segment) => {
    segment.classList.toggle("is-active", segment.dataset.filter === "all");
  });

  saveState();
  renderTasks();
  closeDeleteModal();
  showToast("Task List Reset", "Your workspace is clear and ready for a fresh start.", "trash");
}

function handleConfirmAction() {
  if (state.confirmMode === "delete") {
    deleteTask(state.pendingDeleteId);
    return;
  }

  if (state.confirmMode === "reset") {
    resetTaskList();
  }
}

function handleTaskAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }

  const card = event.target.closest(".task-card");
  if (!card) {
    return;
  }

  const taskId = card.dataset.id;
  const action = button.dataset.action;

  if (action === "toggle") {
    toggleTask(taskId, button);
  }

  if (action === "expand") {
    toggleExpanded(taskId);
  }

  if (action === "edit") {
    openTaskModal(taskId);
  }

  if (action === "delete") {
    openDeleteModal(taskId);
  }
}

function handleFilterChange(event) {
  const button = event.target.closest("[data-filter]");
  if (!button) {
    return;
  }

  state.filter = button.dataset.filter;
  elements.filterControl.querySelectorAll("[data-filter]").forEach((segment) => {
    segment.classList.toggle("is-active", segment === button);
  });
  renderTasks();
}

function handlePriorityChange(event) {
  const button = event.target.closest("[data-priority]");
  if (!button) {
    return;
  }

  state.composerPriority = button.dataset.priority;
  syncPriorityButtons(elements.prioritySelector, "data-priority", state.composerPriority);
}

function handleEditPriorityChange(event) {
  const button = event.target.closest("[data-edit-priority]");
  if (!button) {
    return;
  }

  state.editPriority = button.dataset.editPriority;
  syncPriorityButtons(elements.editPrioritySelector, "data-edit-priority", state.editPriority);
}

function handleSearch(event) {
  state.search = event.target.value;
  renderTasks();
}

function handleSort(event) {
  state.sort = event.target.value;
  renderTasks();
}

function resetViewState() {
  state.filter = "all";
  state.search = "";
  elements.searchInput.value = "";
  elements.filterControl.querySelectorAll("[data-filter]").forEach((segment) => {
    segment.classList.toggle("is-active", segment.dataset.filter === "all");
  });
}

function handleEmptyStatePrimaryAction() {
  const hasAnyTasks = state.tasks.length > 0;
  const hasSearch = state.search.trim().length > 0;
  const hasFilter = state.filter !== "all";

  if (!hasAnyTasks) {
    elements.taskTitle.focus();
    return;
  }

  if (hasSearch) {
    state.search = "";
    elements.searchInput.value = "";
    renderTasks();
    return;
  }

  if (hasFilter) {
    resetViewState();
    renderTasks();
    return;
  }

  elements.taskTitle.focus();
}

function handleEmptyStateSecondaryAction() {
  resetViewState();
  renderTasks();
}

function getClosestFromTarget(event, selector) {
  if (!(event.target instanceof Element)) {
    return null;
  }

  return event.target.closest(selector);
}

function applyMagneticEffect(event) {
  const button = getClosestFromTarget(event, "[data-magnetic]");
  if (!button) {
    return;
  }

  const rect = button.getBoundingClientRect();
  const offsetX = event.clientX - rect.left - rect.width / 2;
  const offsetY = event.clientY - rect.top - rect.height / 2;
  button.style.transform = `translate(${offsetX * 0.12}px, ${offsetY * 0.12}px)`;
}

function resetMagneticEffect(event) {
  const button = getClosestFromTarget(event, "[data-magnetic]");
  if (!button) {
    return;
  }

  button.style.transform = "";
}

function updateAmbientPointer(event) {
  const x = `${(event.clientX / window.innerWidth) * 100}%`;
  const y = `${(event.clientY / window.innerHeight) * 100}%`;
  document.documentElement.style.setProperty("--pointer-x", x);
  document.documentElement.style.setProperty("--pointer-y", y);

  document.querySelectorAll("[data-parallax-depth]").forEach((element) => {
    const depth = Number(element.dataset.parallaxDepth) || 0;
    const offsetX = (event.clientX / window.innerWidth - 0.5) * depth;
    const offsetY = (event.clientY / window.innerHeight - 0.5) * depth;
    element.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
  });
}

function hideBootSplash() {
  window.setTimeout(() => {
    elements.bootSplash.classList.add("is-hidden");
  }, 520);
}

function initParticles() {
  for (let index = 0; index < 18; index += 1) {
    const particle = document.createElement("span");
    particle.className = "particle";
    const size = 2 + Math.random() * 4;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.top = `${Math.random() * 100}%`;
    particle.style.animationDelay = `${Math.random() * 18}s`;
    particle.style.animationDuration = `${12 + Math.random() * 12}s`;
    elements.particles.append(particle);
  }

  for (let index = 0; index < 8; index += 1) {
    const bubble = document.createElement("span");
    bubble.className = "bubble";
    const size = 80 + Math.random() * 160;
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.left = `${Math.random() * 100}%`;
    bubble.style.top = `${Math.random() * 100}%`;
    bubble.style.animationDelay = `${Math.random() * 20}s`;
    bubble.style.animationDuration = `${18 + Math.random() * 16}s`;
    elements.bubbles.append(bubble);
  }
}

function setLiveDate() {
  const now = new Date();
  const hours = now.getHours();
  const greeting = hours < 12 ? "Good morning. Build the day with intention." : hours < 18 ? "Good afternoon. Keep the work crisp and calm." : "Good evening. Close the loop with clarity.";
  elements.welcomeHeading.textContent = greeting;
  elements.liveDate.textContent = formatDateBadge(now);
  if (elements.footerYear) {
    elements.footerYear.textContent = String(now.getFullYear());
  }
}

function handleGlobalKeydown(event) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    elements.searchInput.focus();
    elements.searchInput.select();
  }

  if (event.key === "Escape") {
    if (!elements.taskModal.hidden) {
      closeTaskModal();
    }

    if (!elements.confirmModal.hidden) {
      closeDeleteModal();
    }
  }
}

function bindEvents() {
  elements.taskForm.addEventListener("submit", handleAddTask);
  elements.clearComposer.addEventListener("click", resetComposer);
  elements.prioritySelector.addEventListener("click", handlePriorityChange);
  elements.filterControl.addEventListener("click", handleFilterChange);
  elements.searchInput.addEventListener("input", handleSearch);
  elements.sortSelect.addEventListener("change", handleSort);
  elements.emptyStatePrimaryAction.addEventListener("click", handleEmptyStatePrimaryAction);
  elements.emptyStateSecondaryAction.addEventListener("click", handleEmptyStateSecondaryAction);
  elements.taskList.addEventListener("click", handleTaskAction);
  elements.editPrioritySelector.addEventListener("click", handleEditPriorityChange);
  elements.editTaskForm.addEventListener("submit", handleEditTask);
  elements.closeTaskModal.addEventListener("click", closeTaskModal);
  elements.cancelTaskModal.addEventListener("click", closeTaskModal);
  elements.resetTasksButton.addEventListener("click", openResetModal);
  elements.cancelDeleteButton.addEventListener("click", closeDeleteModal);
  elements.confirmDeleteButton.addEventListener("click", handleConfirmAction);
  document.querySelectorAll("[data-close-modal]").forEach((backdrop) => {
    backdrop.addEventListener("click", () => {
      if (backdrop.dataset.closeModal === "task") {
        closeTaskModal();
      } else {
        closeDeleteModal();
      }
    });
  });

  document.addEventListener("mousemove", updateAmbientPointer);
  document.addEventListener("mousemove", applyMagneticEffect);
  document.addEventListener("mouseleave", (event) => {
    document.querySelectorAll("[data-magnetic]").forEach((button) => {
      button.style.transform = "";
    });
    resetMagneticEffect(event);
  });
  document.addEventListener("mouseout", resetMagneticEffect);
  document.addEventListener("keydown", handleGlobalKeydown);
}

function init() {
  elements.progressRingValue.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
  elements.progressRingValue.style.strokeDashoffset = `${RING_CIRCUMFERENCE}`;
  loadState();
  bindEvents();
  initParticles();
  setLiveDate();
  renderTasks();
  resetComposer();
  hideBootSplash();
}

init();
