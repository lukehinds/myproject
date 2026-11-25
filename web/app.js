const API_BASE = '/api/todos';

// Elements
const todoForm = document.getElementById('todo-form');
const submitBtn = todoForm.querySelector('button[type="submit"]');
const todoList = document.getElementById('todo-list');
const clearCompletedBtn = document.getElementById('clear-completed');
const errorMessage = document.getElementById('error-message');
const loading = document.getElementById('loading');
const emptyState = document.getElementById('empty-state');
const announcer = document.getElementById('announcer');
const todoCount = document.getElementById('todo-count');
const filterBtns = document.querySelectorAll('.filter-btn');

const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const cancelEditBtn = document.getElementById('cancel-edit');
const editSubmitBtn = editForm.querySelector('button[type="submit"]');

// State
let todos = [];
let currentFilter = 'all'; // all, active, completed
let isFetching = false;

// Helper to extract error message
function getErrorMessage(errData, fallback) {
  if (typeof errData?.detail === 'string') return errData.detail;
  if (Array.isArray(errData?.detail) && errData.detail.length > 0 && errData.detail[0].msg) {
    return errData.detail[0].msg;
  }
  return fallback;
}

// Announcer for screen readers
function announce(message) {
  announcer.textContent = message;
}

// Show error
function showError(msg) {
  errorMessage.textContent = msg;
  errorMessage.hidden = false;
  setTimeout(() => { errorMessage.hidden = true; }, 5000);
}

// Update UI (count + filter state)
function updateUI() {
  const activeCount = todos.filter(t => !t.completed).length;
  const completedCount = todos.length - activeCount;
  
  todoCount.textContent = `${activeCount} item${activeCount !== 1 ? 's' : ''} left`;
  clearCompletedBtn.disabled = completedCount === 0 || isFetching;

  filterBtns.forEach(btn => {
    if (btn.dataset.filter === currentFilter) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  renderTodos();
}

// Set form disabled state
function setFormDisabled(form, submitButton, disabled) {
  Array.from(form.elements).forEach(el => {
    if (el !== submitButton) el.disabled = disabled;
  });
  submitButton.disabled = disabled;
}

// Fetch all ToDos
async function fetchTodos() {
  if (isFetching) return;
  isFetching = true;
  loading.hidden = false;
  emptyState.hidden = true;
  
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(getErrorMessage(errData, 'Failed to load ToDos'));
    }
    todos = await res.json();
    announce('ToDos loaded');
  } catch (err) {
    showError(err.message);
  } finally {
    isFetching = false;
    loading.hidden = true;
    updateUI();
  }
}

// Create a new ToDo
todoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setFormDisabled(todoForm, submitBtn, true);
  
  const formData = new FormData(todoForm);
  const data = {
    title: formData.get('title').trim(),
    notes: formData.get('notes').trim() || null,
    priority: formData.get('priority'),
    due_date: formData.get('due_date') || null
  };

  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(getErrorMessage(errData, 'Failed to create ToDo'));
    }
    
    todoForm.reset();
    await fetchTodos();
    announce('ToDo added');
  } catch (err) {
    showError(err.message);
  } finally {
    setFormDisabled(todoForm, submitBtn, false);
  }
});

// Update a ToDo
async function updateTodo(id, updates, itemEl) {
  // Optimistic UI - disable elements
  const controls = itemEl ? itemEl.querySelectorAll('input, button') : [];
  controls.forEach(c => c.disabled = true);
  
  try {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(getErrorMessage(errData, 'Failed to update ToDo'));
    }
    
    await fetchTodos();
    announce('ToDo updated');
  } catch (err) {
    showError(err.message);
    controls.forEach(c => c.disabled = false);
    // Revert optimistic if needed, but since we re-render on fetch, we just rely on state
    if (itemEl) {
      const checkbox = itemEl.querySelector('.todo-checkbox');
      if (checkbox && 'completed' in updates) {
        checkbox.checked = !updates.completed; // rollback
      }
    }
  }
}

// Delete a ToDo
async function deleteTodo(id, itemEl) {
  itemEl.classList.add('deleting');
  const controls = itemEl.querySelectorAll('input, button');
  controls.forEach(c => c.disabled = true);
  
  try {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE'
    });
    
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(getErrorMessage(errData, 'Failed to delete ToDo'));
    }
    
    await fetchTodos();
    announce('ToDo deleted');
  } catch (err) {
    showError(err.message);
    itemEl.classList.remove('deleting');
    controls.forEach(c => c.disabled = false);
  }
}

// Clear completed ToDos
clearCompletedBtn.addEventListener('click', async () => {
  clearCompletedBtn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/clear-completed`, {
      method: 'POST'
    });
    
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(getErrorMessage(errData, 'Failed to clear completed ToDos'));
    }
    
    const data = await res.json();
    await fetchTodos();
    announce(`${data.deleted} completed ToDos cleared`);
  } catch (err) {
    showError(err.message);
    updateUI(); // restore button state
  }
});

// Edit form submission
editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setFormDisabled(editForm, editSubmitBtn, true);
  cancelEditBtn.disabled = true;
  
  const formData = new FormData(editForm);
  const id = formData.get('id');
  const updates = {
    title: formData.get('title').trim(),
    notes: formData.get('notes').trim() || null,
    priority: formData.get('priority'),
    due_date: formData.get('due_date') || null
  };
  
  try {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(getErrorMessage(errData, 'Failed to update ToDo'));
    }
    
    editModal.close();
    await fetchTodos();
    announce('ToDo updated');
  } catch (err) {
    showError(err.message);
  } finally {
    setFormDisabled(editForm, editSubmitBtn, false);
    cancelEditBtn.disabled = false;
  }
});

cancelEditBtn.addEventListener('click', () => {
  editModal.close();
});

// Filtering
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    currentFilter = btn.dataset.filter;
    updateUI();
  });
});

// Render ToDos
function renderTodos() {
  todoList.innerHTML = '';
  
  // Filter
  const filteredTodos = todos.filter(todo => {
    if (currentFilter === 'active') return !todo.completed;
    if (currentFilter === 'completed') return todo.completed;
    return true;
  });
  
  if (filteredTodos.length === 0) {
    if (todos.length > 0) {
      emptyState.textContent = `No ${currentFilter} ToDos.`;
    } else {
      emptyState.textContent = 'No ToDos yet.';
    }
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;
  
  // Sort
  const priorityValues = { 'high': 3, 'normal': 2, 'low': 1 };
  const sortedTodos = [...filteredTodos].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (priorityValues[a.priority] !== priorityValues[b.priority]) {
      return priorityValues[b.priority] - priorityValues[a.priority];
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });
  
  sortedTodos.forEach(todo => {
    const li = document.createElement('li');
    li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
    li.dataset.id = todo.id;
    
    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'todo-checkbox';
    checkbox.checked = todo.completed;
    checkbox.setAttribute('aria-label', `Mark "${todo.title}" as ${todo.completed ? 'incomplete' : 'completed'}`);
    checkbox.addEventListener('change', () => {
      updateTodo(todo.id, { completed: checkbox.checked }, li);
    });
    
    // Content container
    const content = document.createElement('div');
    content.className = 'todo-content';
    
    // Header (Title, Priority, Date)
    const header = document.createElement('div');
    header.className = 'todo-header';
    
    const title = document.createElement('span');
    title.className = 'todo-title';
    title.textContent = todo.title;
    
    const priorityBadge = document.createElement('span');
    priorityBadge.className = `todo-badge badge-${todo.priority}`;
    priorityBadge.textContent = todo.priority.charAt(0).toUpperCase() + todo.priority.slice(1);
    
    header.appendChild(title);
    header.appendChild(priorityBadge);
    
    if (todo.due_date) {
      const dateBadge = document.createElement('span');
      dateBadge.className = 'todo-date';
      dateBadge.textContent = `Due: ${todo.due_date}`;
      header.appendChild(dateBadge);
    }
    
    content.appendChild(header);
    
    if (todo.notes) {
      const notes = document.createElement('div');
      notes.className = 'todo-notes';
      notes.textContent = todo.notes;
      content.appendChild(notes);
    }
    
    // Actions
    const actions = document.createElement('div');
    actions.className = 'todo-actions';
    
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn-icon';
    editBtn.textContent = 'Edit';
    editBtn.setAttribute('aria-label', `Edit ${todo.title}`);
    editBtn.addEventListener('click', () => {
      document.getElementById('edit-id').value = todo.id;
      document.getElementById('edit-title').value = todo.title;
      document.getElementById('edit-notes').value = todo.notes || '';
      document.getElementById('edit-priority').value = todo.priority;
      document.getElementById('edit-due_date').value = todo.due_date || '';
      editModal.showModal();
    });
    
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-icon btn-delete';
    delBtn.textContent = 'Delete';
    delBtn.setAttribute('aria-label', `Delete ${todo.title}`);
    delBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to delete this ToDo?')) {
        deleteTodo(todo.id, li);
      }
    });
    
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    
    li.appendChild(checkbox);
    li.appendChild(content);
    li.appendChild(actions);
    
    todoList.appendChild(li);
  });
}

// Initial fetch
fetchTodos();
