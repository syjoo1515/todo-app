const SUPABASE_URL = 'https://ajwpaliyibpshfueuupl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqd3BhbGl5aWJwc2hmdWV1dXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2Njg0MjQsImV4cCI6MjA5NzI0NDQyNH0.kVXeMeFn_8VYSBJ-YeXK8UJ-QRLBDtBK7VOlBb3HjvY';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- DOM 참조 ---
const authSection  = document.getElementById('authSection');
const todoSection  = document.getElementById('todoSection');
const authMessage  = document.getElementById('authMessage');
const loginBtn     = document.getElementById('loginBtn');
const signupBtn    = document.getElementById('signupBtn');
const logoutBtn    = document.getElementById('logoutBtn');
const userEmailEl  = document.getElementById('userEmail');
const todoInput    = document.getElementById('todoInput');
const addBtn       = document.getElementById('addBtn');
const todoList     = document.getElementById('todoList');

let dragSrc = null;
let currentUserId = null;
let isLoggingOut = false;

// --- 인증 UI ---

document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('loginForm').classList.toggle('hidden', tab.dataset.tab !== 'login');
    document.getElementById('signupForm').classList.toggle('hidden', tab.dataset.tab !== 'signup');
    authMessage.textContent = '';
  });
});

signupBtn.addEventListener('click', async () => {
  const email           = document.getElementById('signupEmail').value.trim();
  const password        = document.getElementById('signupPassword').value;
  const passwordConfirm = document.getElementById('signupPasswordConfirm').value;

  if (password !== passwordConfirm) {
    authMessage.textContent = '비밀번호가 일치하지 않습니다.';
    return;
  }
  if (password.length < 6) {
    authMessage.textContent = '비밀번호는 6자 이상이어야 합니다.';
    return;
  }

  const { error } = await db.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) { authMessage.textContent = error.message; return; }
  authMessage.textContent = '✉️ 이메일로 인증 링크를 보냈습니다. 인증 후 로그인해주세요.';
});

loginBtn.addEventListener('click', async () => {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) { authMessage.textContent = error.message; }
});

document.getElementById('loginPassword').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});

logoutBtn.addEventListener('click', async () => {
  isLoggingOut = true;
  await db.auth.signOut();
  currentUserId = null;
  todoList.innerHTML = '';
  todoSection.classList.add('hidden');
  authSection.classList.remove('hidden');
  isLoggingOut = false;
});

// --- 소셜 로그인 ---

const redirectTo = window.location.origin + window.location.pathname;

document.getElementById('googleLoginBtn').addEventListener('click', async () => {
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) authMessage.textContent = error.message;
});

document.getElementById('githubLoginBtn').addEventListener('click', async () => {
  const { error } = await db.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo },
  });
  if (error) authMessage.textContent = error.message;
});

// --- 이메일 인증 완료 리다이렉트 처리 ---

(async () => {
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  if (hashParams.get('type') === 'signup' && !hashParams.get('provider_token')) {
    await db.auth.signOut();
    history.replaceState(null, '', window.location.pathname);
    alert('회원가입이 완료되었습니다. 로그인해주세요.');
  }
})();

// --- 인증 상태 감지 ---

db.auth.onAuthStateChange(async (event, session) => {
  if (isLoggingOut) return;

  if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session.user.id !== currentUserId) {
    currentUserId = session.user.id;
    authSection.classList.add('hidden');
    todoSection.classList.remove('hidden');
    userEmailEl.textContent = session.user.email;
    todoList.innerHTML = '';
    const { data: todos } = await db.from('todos').select('*').order('position');
    (todos || []).forEach(renderTodo);
    updatePriorityBadges();
  } else if (event === 'SIGNED_OUT') {
    currentUserId = null;
    authSection.classList.remove('hidden');
    todoSection.classList.add('hidden');
    todoList.innerHTML = '';
  }
});

// --- TODO 로직 ---

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
    if (badge) badge.textContent = `${index + 1}위`;
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

  const { data: { session } } = await db.auth.getSession();
  const position = todoList.querySelectorAll('li').length;
  const { data, error } = await db.from('todos')
    .insert({ text, position, user_id: session.user.id })
    .select().single();
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
