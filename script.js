const SUPABASE_URL = 'https://ajwpaliyibpshfueuupl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqd3BhbGl5aWJwc2hmdWV1dXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2Njg0MjQsImV4cCI6MjA5NzI0NDQyNH0.kVXeMeFn_8VYSBJ-YeXK8UJ-QRLBDtBK7VOlBb3HjvY';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const todoInput = document.getElementById('todoInput');
const addBtn = document.getElementById('addBtn');
const todoList = document.getElementById('todoList');

let dragSrc = null;

function getOrderedIds() {
  return [...todoList.querySelectorAll('li')].map(li => li.dataset.id);
}

async function reorderSaved() {
  const ids = getOrderedIds();
  await Promise.all(ids.map((id, index) =>
    db.from('todos').update({ position: index }).eq('id', id)
  ));
  updatePriorityBadges();
}

function updatePriorityBadges() {
  const items = todoList.querySelectorAll('li');
  items.forEach((li, index) => {
    const badge = li.querySelector('.priority-badge');
    if (badge) {
      badge.textContent = `${index + 1}위`;
    }
  });
}

function renderTodo(todo) {
  const li = document.createElement('li');
  li.dataset.id = todo.id;

  const handle = document.createElement('span');
  handle.classList.add('drag-handle');
  handle.innerHTML = '&#8942;&#8942;';
  handle.draggable = true;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';

  const span = document.createElement('span');
  span.classList.add('todo-text');
  span.textContent = todo.text;

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '삭제';
  deleteBtn.classList.add('delete-btn', 'hidden');

  const badge = document.createElement('span');
  badge.classList.add('priority-badge');

  if (todo.completed) {
    checkbox.checked = true;
    li.classList.add('completed');
    deleteBtn.classList.remove('hidden');
  }

  checkbox.addEventListener('change', async () => {
    li.classList.toggle('completed', checkbox.checked);
    deleteBtn.classList.toggle('hidden', !checkbox.checked);
    await db.from('todos').update({ completed: checkbox.checked }).eq('id', todo.id);
  });

  deleteBtn.addEventListener('click', async () => {
    await db.from('todos').delete().eq('id', todo.id);
    li.remove();
    updatePriorityBadges();
  });

  // 드래그앤드롭 — 핸들에서만 시작
  handle.addEventListener('dragstart', (e) => {
    dragSrc = li;
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  handle.addEventListener('dragend', () => {
    li.classList.remove('dragging');
    todoList.querySelectorAll('li').forEach(el => el.classList.remove('drag-over'));
    reorderSaved();
  });

  li.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (li === dragSrc) return;
    todoList.querySelectorAll('li').forEach(el => el.classList.remove('drag-over'));
    li.classList.add('drag-over');

    const rect = li.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    if (e.clientY < mid) {
      todoList.insertBefore(dragSrc, li);
    } else {
      todoList.insertBefore(dragSrc, li.nextSibling);
    }
  });

  li.addEventListener('dragleave', () => {
    li.classList.remove('drag-over');
  });

  li.appendChild(handle);
  li.appendChild(checkbox);
  li.appendChild(span);
  li.appendChild(deleteBtn);
  li.appendChild(badge);
  todoList.appendChild(li);
}

async function addTodo() {
  const text = todoInput.value.trim();
  if (!text) return;

  const position = todoList.querySelectorAll('li').length;
  const { data, error } = await db.from('todos').insert({ text, position }).select().single();
  if (error) { console.error(error); return; }

  renderTodo(data);
  updatePriorityBadges();

  todoInput.value = '';
  todoInput.focus();
}

addBtn.addEventListener('click', addTodo);

todoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addTodo();
});

(async () => {
  const { data: todos } = await db.from('todos').select('*').order('position');
  (todos || []).forEach(renderTodo);
  updatePriorityBadges();
})();
