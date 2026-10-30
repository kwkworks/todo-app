// 화면 코드: 백엔드 /api 만 호출한다. (Supabase 키나 로그인 토큰은 여기서 다루지 않음)
// 사용자 입력은 항상 textContent 로 넣어서, 제목에 HTML을 적어도 코드로 실행되지 않는다.

const $ = (sel) => document.querySelector(sel);

// 카테고리별 색 (이름에 따라 항상 같은 색)
const PALETTE = ['#8B5CF6', '#22D3EE', '#F472B6', '#34D399', '#FBBF24', '#60A5FA', '#FB7185'];
const categoryColor = (name) => PALETTE[[...name].reduce((s, ch) => s + ch.codePointAt(0), 0) % PALETTE.length];

const state = {
  todos: [],
  month: null, // 달력에서 보고 있는 달의 1일
  category: '전체',
  hideDone: false,
  authMode: 'login',
};

// ─────────────────────────────── 공통 ───────────────────────────────

// 사용자 컴퓨터 기준 오늘 (YYYY-MM-DD)
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node[k] = v;
  }
  node.append(...children.filter((c) => c != null));
  return node;
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    showAuth('로그인이 만료되었어요. 다시 로그인해 주세요.');
    throw new Error('unauthorized');
  }
  if (!res.ok) throw new Error(data.error || '요청에 실패했어요.');
  return data;
}

function setMsg(node, text, ok = false) {
  node.textContent = text || '';
  node.classList.toggle('ok', ok);
}

// ─────────────────────────────── 로그인 화면 ───────────────────────────────

function showAuth(message = '') {
  $('#app').hidden = true;
  $('#auth').hidden = false;
  state.todos = [];
  setMsg($('#auth-msg'), message);
  $('#email').focus();
}

function setAuthMode(mode) {
  state.authMode = mode;
  for (const b of document.querySelectorAll('.seg-btn')) b.classList.toggle('active', b.dataset.mode === mode);
  $('#auth-submit').textContent = mode === 'login' ? '로그인' : '회원가입';
  $('#password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  setMsg($('#auth-msg'), mode === 'signup' ? '비밀번호는 8자 이상으로 정해 주세요.' : '', true);
}

async function submitAuth(e) {
  e.preventDefault();
  const email = $('#email').value.trim();
  const password = $('#password').value;
  const btn = $('#auth-submit');
  btn.disabled = true;
  try {
    const path = state.authMode === 'login' ? '/api/auth/login' : '/api/auth/signup';
    const data = await api(path, { method: 'POST', body: { email, password } });
    if (data.needsConfirmation) {
      setMsg($('#auth-msg'), '가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.', true);
      setAuthMode('login');
      return;
    }
    $('#password').value = '';
    await showApp(data.user.email);
  } catch (err) {
    setMsg($('#auth-msg'), err.message);
  } finally {
    btn.disabled = false;
  }
}

// ─────────────────────────────── 할 일 화면 ───────────────────────────────

async function showApp(email) {
  $('#auth').hidden = true;
  $('#app').hidden = false;
  $('#user-email').textContent = email;
  const now = new Date();
  $('#today-text').textContent =
    `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 · 오늘도 하나씩 끝내 봐요`;
  state.month = new Date(now.getFullYear(), now.getMonth(), 1);
  await reload();
}

async function reload() {
  state.todos = await api('/api/todos');
  render();
}

function render() {
  renderStats();
  renderCalendar();
  renderList();
}

function renderStats() {
  const today = todayStr();
  const open = state.todos.filter((t) => !t.done);
  const items = [
    [open.length, '남은 일', null],
    [open.filter((t) => t.due_date === today).length, '오늘 마감', 'var(--yellow)'],
    [open.filter((t) => t.due_date && t.due_date < today).length, '기한 지남', 'var(--red)'],
    [state.todos.length - open.length, '완료', 'var(--green)'],
  ];
  $('#stats').replaceChildren(
    ...items.map(([n, label, color]) => {
      const b = el('b', { text: String(n) });
      if (color) b.style.color = color;
      return el('div', { class: 'stat' }, b, el('span', { text: label }));
    }),
  );
}

function renderCalendar() {
  const first = state.month;
  $('#month-title').textContent = `${first.getFullYear()}년 ${String(first.getMonth() + 1).padStart(2, '0')}월`;

  const byDay = new Map();
  for (const t of state.todos) {
    if (!t.due_date) continue;
    if (!byDay.has(t.due_date)) byDay.set(t.due_date, []);
    byDay.get(t.due_date).push(t);
  }

  const cells = ['일', '월', '화', '수', '목', '금', '토'].map((name, i) =>
    el('div', { class: 'cal-head' + (i === 0 ? ' sun' : i === 6 ? ' sat' : ''), text: name }),
  );

  // 일요일부터 시작하는 6주(또는 필요한 만큼)의 칸
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const weeks = Math.ceil((first.getDay() + last.getDate()) / 7);
  const today = todayStr();

  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = ymd(d);
    let cls = 'cal-day';
    if (d.getMonth() !== first.getMonth()) cls += ' other';
    if (key === today) cls += ' today';

    const items = byDay.get(key) || [];
    const evs = items.slice(0, 3).map((t) => {
      const ev = el('div', { class: 'cal-ev' + (t.done ? ' done' : ''), text: t.title, title: t.title });
      ev.style.background = categoryColor(t.category);
      return ev;
    });
    const more = items.length > 3 ? el('div', { class: 'cal-more', text: `+${items.length - 3}개 더` }) : null;
    cells.push(el('div', { class: cls }, el('div', { class: 'cal-num', text: String(d.getDate()) }), ...evs, more));
  }
  $('#cal').replaceChildren(...cells);
}

function renderList() {
  const categories = [...new Set(state.todos.map((t) => t.category))].sort();
  if (state.category !== '전체' && !categories.includes(state.category)) state.category = '전체';

  $('#cats').replaceChildren(
    ...['전체', ...categories].map((c) => {
      const b = el('button', { type: 'button', class: 'pill' + (c === state.category ? ' active' : ''), text: c });
      b.addEventListener('click', () => {
        state.category = c;
        renderList();
      });
      return b;
    }),
  );

  const today = todayStr();
  const shown = state.todos.filter(
    (t) => (state.category === '전체' || t.category === state.category) && !(state.hideDone && t.done),
  );
  $('#empty').hidden = shown.length > 0;

  $('#list').replaceChildren(
    ...shown.map((t) => {
      // 완료 체크
      const check = el('input', { type: 'checkbox', checked: t.done, title: '완료' });
      check.setAttribute('aria-label', `${t.title} 완료`);
      check.addEventListener('change', () => updateTodo(t.id, { done: check.checked }));

      // 제목 + 카테고리 + 마감일
      const color = categoryColor(t.category);
      const chip = el('span', { class: 'chip', text: t.category });
      chip.style.color = color;
      chip.style.borderColor = color + '55';
      let due = null;
      if (t.due_date) {
        if (!t.done && t.due_date < today) due = el('span', { class: 'due late', text: `${t.due_date} · 지남` });
        else if (!t.done && t.due_date === today) due = el('span', { class: 'due today', text: `${t.due_date} · 오늘` });
        else due = el('span', { class: 'due', text: t.due_date });
      }
      const body = el('div', {}, el('div', { class: 'item-title', text: t.title }), el('div', { class: 'meta' }, chip, due));

      // 삭제 (한 번 더 눌러야 지워짐)
      const del = el('button', { type: 'button', class: 'ghost small', text: '삭제' });
      let armed = false;
      let timer;
      del.addEventListener('click', () => {
        if (!armed) {
          armed = true;
          del.textContent = '정말 삭제?';
          del.className = 'danger small';
          timer = setTimeout(() => {
            armed = false;
            del.textContent = '삭제';
            del.className = 'ghost small';
          }, 3000);
          return;
        }
        clearTimeout(timer);
        deleteTodo(t.id);
      });

      return el('li', { class: 'item' + (t.done ? ' done' : '') }, check, body, del);
    }),
  );
}

// ─────────────────────────────── 추가 · 수정 · 삭제 ───────────────────────────────

async function addTodo(e) {
  e.preventDefault();
  const title = $('#new-title').value.trim();
  if (!title) return setMsg($('#add-msg'), '할 일을 입력해 주세요.');
  try {
    await api('/api/todos', {
      method: 'POST',
      body: { title, due_date: $('#new-due').value || null, category: $('#new-cat').value.trim() || '일반' },
    });
    $('#new-title').value = '';
    $('#new-due').value = '';
    setMsg($('#add-msg'), '');
    await reload();
    $('#new-title').focus();
  } catch (err) {
    if (err.message !== 'unauthorized') setMsg($('#add-msg'), err.message);
  }
}

async function updateTodo(id, patch) {
  try {
    await api(`/api/todos/${id}`, { method: 'PATCH', body: patch });
  } catch (err) {
    if (err.message !== 'unauthorized') alert(err.message);
  }
  await reload().catch(() => {});
}

async function deleteTodo(id) {
  try {
    await api(`/api/todos/${id}`, { method: 'DELETE' });
  } catch (err) {
    if (err.message !== 'unauthorized') alert(err.message);
  }
  await reload().catch(() => {});
}

// ─────────────────────────────── 이벤트 연결 · 시작 ───────────────────────────────

for (const b of document.querySelectorAll('.seg-btn')) b.addEventListener('click', () => setAuthMode(b.dataset.mode));
$('#auth-form').addEventListener('submit', submitAuth);
$('#add-form').addEventListener('submit', addTodo);

$('#logout').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  showAuth('로그아웃했어요.');
});

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => {
    for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t === tab);
    $('#view-cal').hidden = tab.dataset.view !== 'cal';
    $('#view-list').hidden = tab.dataset.view !== 'list';
  });
}

const moveMonth = (step) => {
  state.month = new Date(state.month.getFullYear(), state.month.getMonth() + step, 1);
  renderCalendar();
};
$('#prev-month').addEventListener('click', () => moveMonth(-1));
$('#next-month').addEventListener('click', () => moveMonth(1));
$('#this-month').addEventListener('click', () => {
  const now = new Date();
  state.month = new Date(now.getFullYear(), now.getMonth(), 1);
  renderCalendar();
});
$('#hide-done').addEventListener('change', (e) => {
  state.hideDone = e.target.checked;
  renderList();
});

// 처음 열었을 때: 이미 로그인돼 있으면 바로 할 일 화면, 아니면 로그인 화면
api('/api/auth/me')
  .then((data) => showApp(data.user.email))
  .catch(() => showAuth());
