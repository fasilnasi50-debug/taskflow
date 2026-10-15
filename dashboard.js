
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const PAGE_SIZE = 10;

const userName = document.getElementById("userName");
const logoutBtn = document.getElementById("logoutBtn");
const taskForm = document.getElementById("taskForm");
const taskTitle = document.getElementById("taskTitle");
const taskDescription = document.getElementById("taskDescription");
const taskPriority = document.getElementById("taskPriority");
const taskDueDate = document.getElementById("taskDueDate");
const addTaskBtn = document.getElementById("addTaskBtn");
const taskMessage = document.getElementById("taskMessage");
const taskList = document.getElementById("taskList");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");

const totalCount = document.getElementById("totalCount");
const pendingCount = document.getElementById("pendingCount");
const progressCount = document.getElementById("progressCount");
const completedCount = document.getElementById("completedCount");
const taskCountLabel = document.getElementById("taskCountLabel");

const loadMoreBtn = document.getElementById("loadMoreBtn");
const paginationMessage = document.getElementById("paginationMessage");

let currentUser = null;
let tasks = [];
let olderTasks = [];
let lastDocument = null;
let unsubscribeTasks = null;
let isLoadingMore = false;
let hasMoreTasks = true;
let authReady = false;
let paginationVersion = 0;

function showTaskMessage(message, type = "error") {
  taskMessage.textContent = message;
  taskMessage.className = `message ${type}`;
}

function formatStatus(status) {
  return {
    pending: "Pending",
    "in-progress": "In progress",
    completed: "Completed"
  }[status] || status;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

// Combine live tasks and older pages without duplicate task IDs.
function getAllTasks() {
  const taskMap = new Map();

  [...olderTasks, ...tasks].forEach((task) => {
    taskMap.set(task.id, task);
  });

  return [...taskMap.values()].sort((a, b) => {
    const timeA = a.createdAt?.toMillis?.() ?? 0;
    const timeB = b.createdAt?.toMillis?.() ?? 0;
    return timeB - timeA;
  });
}

function renderTasks() {
  const allTasks = getAllTasks();
  const search = searchInput.value.trim().toLowerCase();
  const selectedStatus = statusFilter.value;

  const filteredTasks = allTasks.filter((task) => {
    const title = (task.title || "").toLowerCase();
    const description = (task.description || "").toLowerCase();

    const matchesSearch =
      title.includes(search) || description.includes(search);

    const matchesStatus =
      selectedStatus === "all" || task.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  taskCountLabel.textContent =
    `${filteredTasks.length} ${filteredTasks.length === 1 ? "task" : "tasks"}`;

  if (filteredTasks.length === 0) {
    taskList.innerHTML = `
      <p class="empty-state">
        ${allTasks.length === 0
          ? "No tasks yet. Create your first task above!"
          : "No tasks match your search or filter."}
      </p>`;
    return;
  }

  taskList.innerHTML = filteredTasks.map((task) => `
    <article class="task-item">
      <div class="task-details">
        <h3>${escapeHTML(task.title)}</h3>
        <p>${escapeHTML(task.description || "No description provided.")}</p>

        <div class="task-meta">
          <span class="task-badge">${escapeHTML(formatStatus(task.status))}</span>
          <span class="task-badge">${escapeHTML(task.priority)} priority</span>
          ${task.dueDate
            ? `<span class="task-badge">Due ${escapeHTML(task.dueDate)}</span>`
            : ""}
        </div>
      </div>

      <div class="task-actions">
        <select data-action="status"
                data-id="${escapeHTML(task.id)}"
                aria-label="Change task status">
          <option value="pending" ${task.status === "pending" ? "selected" : ""}>Pending</option>
          <option value="in-progress" ${task.status === "in-progress" ? "selected" : ""}>In progress</option>
          <option value="completed" ${task.status === "completed" ? "selected" : ""}>Completed</option>
        </select>

        <button type="button"
                data-action="delete"
                data-id="${escapeHTML(task.id)}">Delete</button>
      </div>
    </article>
  `).join("");
}

function updateStatistics() {
  const allTasks = getAllTasks();

  totalCount.textContent = allTasks.length;
  pendingCount.textContent =
    allTasks.filter((task) => task.status === "pending").length;
  progressCount.textContent =
    allTasks.filter((task) => task.status === "in-progress").length;
  completedCount.textContent =
    allTasks.filter((task) => task.status === "completed").length;
}

function refreshDashboard() {
  updateStatistics();
  renderTasks();
}

function updatePaginationUI() {
  loadMoreBtn.hidden = !hasMoreTasks;
  loadMoreBtn.disabled = isLoadingMore;

  loadMoreBtn.textContent = isLoadingMore
    ? "Loading..."
    : "Load More Tasks";

  if (!hasMoreTasks && getAllTasks().length > 0) {
    paginationMessage.textContent = "You've reached the end of your tasks.";
  } else {
    paginationMessage.textContent = "";
  }
}

function listenForTasks(user) {
  if (unsubscribeTasks) {
    unsubscribeTasks();
    unsubscribeTasks = null;
  }

  // Reset pagination whenever the signed-in user changes.
  paginationVersion++;
  const currentVersion = paginationVersion;

  tasks = [];
  olderTasks = [];
  lastDocument = null;
  isLoadingMore = false;
  hasMoreTasks = true;
  updatePaginationUI();
  refreshDashboard();

  const firstPageQuery = query(
    collection(db, "tasks"),
    where("ownerId", "==", user.uid),
    orderBy("createdAt", "desc"),
    limit(PAGE_SIZE)
  );

  unsubscribeTasks = onSnapshot(
    firstPageQuery,
    (snapshot) => {
      if (currentVersion !== paginationVersion) return;

      tasks = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data()
      }));

      // Set the cursor only before older pages have been loaded.
      if (olderTasks.length === 0) {
        lastDocument = snapshot.docs[snapshot.docs.length - 1] || null;
        hasMoreTasks = snapshot.docs.length === PAGE_SIZE;
      }

      refreshDashboard();
      updatePaginationUI();
    },
    (error) => {
      if (currentVersion !== paginationVersion) return;

      console.error("Task listener error:", error);
      showTaskMessage(
        "Unable to load tasks. Check Firestore rules and indexes."
      );
    }
  );
}

async function loadMoreTasks() {
  if (!currentUser || isLoadingMore || !hasMoreTasks || !lastDocument) {
    return;
  }

  isLoadingMore = true;
  const currentVersion = paginationVersion;
  updatePaginationUI();

  try {
    const nextPageQuery = query(
      collection(db, "tasks"),
      where("ownerId", "==", currentUser.uid),
      orderBy("createdAt", "desc"),
      startAfter(lastDocument),
      limit(PAGE_SIZE)
    );

    const snapshot = await getDocs(nextPageQuery);

    if (currentVersion !== paginationVersion) return;

    const existingIds = new Set(
      [...tasks, ...olderTasks].map((task) => task.id)
    );

    const nextTasks = snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data()
    }));

    olderTasks = [
      ...olderTasks,
      ...nextTasks.filter((task) => !existingIds.has(task.id))
    ];

    if (snapshot.docs.length > 0) {
      lastDocument = snapshot.docs[snapshot.docs.length - 1];
    }

    hasMoreTasks = snapshot.docs.length === PAGE_SIZE;

    refreshDashboard();
  } catch (error) {
    console.error("Load more tasks error:", error);
    showTaskMessage("Could not load more tasks. Please try again.");
  } finally {
    if (currentVersion === paginationVersion) {
      isLoadingMore = false;
      updatePaginationUI();
    }
  }
}

onAuthStateChanged(auth, (user) => {
  authReady = true;

  if (!user) {
    currentUser = null;

    if (unsubscribeTasks) {
      unsubscribeTasks();
      unsubscribeTasks = null;
    }

    window.location.replace("index.html");
    return;
  }

  currentUser = user;
  userName.textContent = user.displayName || user.email || "User";
  listenForTasks(user);
});

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!authReady || !currentUser) {
    showTaskMessage("Please sign in again.");
    return;
  }

  const title = taskTitle.value.trim();

  if (!title) {
    showTaskMessage("Please enter a task title.");
    return;
  }

  addTaskBtn.disabled = true;
  addTaskBtn.textContent = "Adding...";

  try {
    await addDoc(collection(db, "tasks"), {
      ownerId: currentUser.uid,
      title,
      description: taskDescription.value.trim(),
      status: "pending",
      priority: taskPriority.value,
      dueDate: taskDueDate.value,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    taskForm.reset();
    taskPriority.value = "medium";
    showTaskMessage("Task created successfully!", "success");
  } catch (error) {
    console.error("Create task error:", error);
    showTaskMessage(
      "Could not create task. Check your Firestore rules and connection."
    );
  } finally {
    addTaskBtn.disabled = false;
    addTaskBtn.textContent = "+ Add task";
  }
});

taskList.addEventListener("change", async (event) => {
  const target = event.target;

  if (target.dataset.action !== "status") return;

  const taskId = target.dataset.id;
  const newStatus = target.value;

  if (!["pending", "in-progress", "completed"].includes(newStatus)) {
    showTaskMessage("Invalid task status.");
    return;
  }

  try {
    await updateDoc(doc(db, "tasks", taskId), {
      status: newStatus,
      updatedAt: serverTimestamp()
    });

    showTaskMessage("Task status updated.", "success");
  } catch (error) {
    console.error("Update task error:", error);
    showTaskMessage("Could not update task status.");
  }
});

taskList.addEventListener("click", async (event) => {
  const button = event.target.closest('button[data-action="delete"]');

  if (!button) return;

  const taskId = button.dataset.id;

  if (!window.confirm("Are you sure you want to delete this task?")) {
    return;
  }

  button.disabled = true;

  try {
    await deleteDoc(doc(db, "tasks", taskId));

    // Remove locally as well; the listener will reconcile the first page.
    tasks = tasks.filter((task) => task.id !== taskId);
    olderTasks = olderTasks.filter((task) => task.id !== taskId);

    refreshDashboard();
    showTaskMessage("Task deleted successfully.", "success");
  } catch (error) {
    console.error("Delete task error:", error);
    showTaskMessage("Could not delete task.");
    button.disabled = false;
  }
});

searchInput.addEventListener("input", renderTasks);
statusFilter.addEventListener("change", renderTasks);
loadMoreBtn.addEventListener("click", loadMoreTasks);

logoutBtn.addEventListener("click", async () => {
  logoutBtn.disabled = true;

  try {
    paginationVersion++;

    if (unsubscribeTasks) {
      unsubscribeTasks();
      unsubscribeTasks = null;
    }

    await signOut(auth);
    window.location.replace("index.html");
  } catch (error) {
    console.error("Logout error:", error);
    showTaskMessage("Unable to sign out. Please try again.");
    logoutBtn.disabled = false;
  }
});
