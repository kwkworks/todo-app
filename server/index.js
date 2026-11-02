import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newClient, saveSession, clearSession, readTokens, requireUser } from './supabase.js';

const app = express();
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '127.0.0.1';
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

app.set('trust proxy', 1); // Render 같은 배포 환경에서 실제 접속 IP를 읽기 위해
app.disable('x-powered-by');

// 기본 보안 헤더
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy':
      "default-src 'self'; style-src 'self' https://cdn.jsdelivr.net; font-src https://cdn.jsdelivr.net; " +
      "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
  });
  next();
});

app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(express.static(publicDir));

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const badRequest = (message) => new HttpError(400, message);

// ─────────────────────────────── 입력 검증 ───────────────────────────────

function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function parseTodoInput(body, { partial }) {
  if (!body || typeof body !== 'object') throw badRequest('JSON 본문이 필요합니다.');
  const out = {};

  if ('title' in body || !partial) {
    if (typeof body.title !== 'string' || !body.title.trim()) throw badRequest('할 일을 입력하세요.');
    if (body.title.trim().length > 100) throw badRequest('할 일은 100자 이하로 입력하세요.');
    out.title = body.title.trim();
  }
  if ('due_date' in body) {
    const d = body.due_date;
    if (d !== null && d !== '' && !isValidDate(d)) throw badRequest('마감일은 YYYY-MM-DD 형식이어야 합니다.');
    out.due_date = d || null;
  }
  if ('category' in body || !partial) {
    const c = typeof body.category === 'string' ? body.category.trim() : '';
    if (c.length > 20) throw badRequest('카테고리는 20자 이하로 입력하세요.');
    out.category = c || '일반';
  }
  if ('done' in body) {
    if (typeof body.done !== 'boolean') throw badRequest('done 은 true/false 여야 합니다.');
    out.done = body.done;
    out.done_at = body.done ? new Date().toISOString() : null; // 완료한 시각 (CLI의 오늘 완료 요약에 사용)
  }
  if (partial && Object.keys(out).length === 0) throw badRequest('바꿀 내용이 없습니다.');
  return out;
}

function parseCredentials(body) {
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw badRequest('올바른 이메일을 입력하세요.');
  if (password.length < 8) throw badRequest('비밀번호는 8자 이상이어야 합니다.');
  if (password.length > 72) throw badRequest('비밀번호는 72자 이하로 입력하세요.');
  return { email, password };
}

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) throw badRequest('잘못된 id 입니다.');
  return id;
}

// Supabase(Postgres) 오류를 사용자에게 보여 줄 메시지로 바꾼다. (내부 정보는 노출하지 않음)
function dbError(error) {
  if (['23514', '22007', '22008', '22P02'].includes(error.code)) return badRequest('입력값이 올바르지 않습니다.');
  if (error.code === '42501') return new HttpError(403, '권한이 없습니다.');
  if (error.code?.startsWith('PGRST3')) return new HttpError(401, '로그인이 필요합니다.');
  console.error('Supabase 오류:', error);
  return new HttpError(500, '서버 오류가 발생했습니다.');
}

// 로그인/가입 시도 횟수 제한 (IP당 1분에 10번) — 비밀번호 무작위 대입을 늦춘다.
const attempts = new Map();
function limitAuth(req, res, next) {
  const now = Date.now();
  const rec = attempts.get(req.ip);
  if (!rec || now - rec.start > 60_000) {
    attempts.set(req.ip, { start: now, count: 1 });
    return next();
  }
  if (++rec.count > 10) {
    return res.status(429).json({ error: '시도가 너무 많습니다. 1분 뒤에 다시 시도하세요.' });
  }
  next();
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of attempts) if (now - rec.start > 60_000) attempts.delete(ip);
}, 60_000).unref();

// ─────────────────────────────── 로그인 (Supabase Auth) ───────────────────────────────

app.post('/api/auth/signup', limitAuth, async (req, res) => {
  const { email, password } = parseCredentials(req.body);
  const options = process.env.APP_URL ? { emailRedirectTo: process.env.APP_URL } : undefined;
  const { data, error } = await newClient().auth.signUp({ email, password, options });
  if (error) {
    if (error.status === 429) throw new HttpError(429, '요청이 너무 많습니다. 잠시 후 다시 시도하세요.');
    if (error.code === 'user_already_exists') throw badRequest('이미 가입된 이메일입니다.');
    if (error.code === 'weak_password') throw badRequest('비밀번호가 너무 약합니다.');
    console.error('회원가입 오류:', error);
    throw badRequest('회원가입에 실패했습니다.');
  }
  if (!data.session) return res.status(201).json({ needsConfirmation: true });
  saveSession(res, data.session);
  res.status(201).json({ user: { email: data.user.email } });
});

app.post('/api/auth/login', limitAuth, async (req, res) => {
  const { email, password } = parseCredentials(req.body);
  const { data, error } = await newClient().auth.signInWithPassword({ email, password });
  if (error) {
    if (error.status === 429) throw new HttpError(429, '요청이 너무 많습니다. 잠시 후 다시 시도하세요.');
    if (error.code === 'email_not_confirmed') throw new HttpError(403, '메일함에서 가입 확인 링크를 먼저 눌러 주세요.');
    throw new HttpError(401, '이메일 또는 비밀번호가 올바르지 않습니다.');
  }
  saveSession(res, data.session);
  res.json({ user: { email: data.user.email } });
});

app.post('/api/auth/logout', async (req, res) => {
  const { access_token, refresh_token } = readTokens(req);
  if (access_token && refresh_token) {
    const supabase = newClient();
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (!error) await supabase.auth.signOut({ scope: 'local' }); // 이 기기의 로그인 토큰 폐기
  }
  clearSession(res);
  res.status(204).end();
});

app.get('/api/auth/me', requireUser, (req, res) => {
  res.json({ user: { email: req.user.email } });
});

// ─────────────────────────────── 할 일 (로그인 필요) ───────────────────────────────
// 모든 조회·수정·삭제에 user_id 조건을 직접 붙이고, DB의 RLS도 한 번 더 막는다. (이중 잠금)

const COLUMNS = 'id, title, done, due_date, category';

app.get('/api/todos', requireUser, async (req, res) => {
  const { data, error } = await req.supabase
    .from('todos')
    .select(COLUMNS)
    .eq('user_id', req.user.id)
    .order('done')
    .order('due_date', { nullsFirst: false })
    .order('id');
  if (error) throw dbError(error);
  res.json(data);
});

app.post('/api/todos', requireUser, async (req, res) => {
  const input = parseTodoInput(req.body, { partial: false });
  const { data, error } = await req.supabase
    .from('todos')
    .insert({ ...input, user_id: req.user.id })
    .select(COLUMNS)
    .single();
  if (error) throw dbError(error);
  res.status(201).json(data);
});

app.patch('/api/todos/:id', requireUser, async (req, res) => {
  const id = parseId(req.params.id);
  const patch = parseTodoInput(req.body, { partial: true });
  const { data, error } = await req.supabase
    .from('todos')
    .update(patch)
    .eq('id', id)
    .eq('user_id', req.user.id)
    .select(COLUMNS);
  if (error) throw dbError(error);
  if (!data.length) throw new HttpError(404, '할 일을 찾을 수 없습니다.');
  res.json(data[0]);
});

app.delete('/api/todos/:id', requireUser, async (req, res) => {
  const id = parseId(req.params.id);
  const { data, error } = await req.supabase
    .from('todos')
    .delete()
    .eq('id', id)
    .eq('user_id', req.user.id)
    .select('id');
  if (error) throw dbError(error);
  if (!data.length) throw new HttpError(404, '할 일을 찾을 수 없습니다.');
  res.status(204).end();
});

// ─────────────────────────────── 구글 캘린더용 .ics 파일 ───────────────────────────────

const icsEscape = (text) =>
  text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

// 캘린더 파일 규칙: 한 줄은 75바이트까지, 넘으면 다음 줄을 공백으로 시작해 이어 쓴다.
function icsFold(line) {
  const out = [];
  let cur = '';
  let curBytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (curBytes + b > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      curBytes = 0;
    }
    cur += ch;
    curBytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

function buildIcs(todos, userId) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//kwkworks//todo-app//KO',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:나의 Todo',
  ];
  for (const t of todos) {
    if (!t.due_date) continue; // 마감일이 없는 일은 달력에 넣을 날짜가 없다
    const start = new Date(t.due_date + 'T00:00:00Z');
    const end = new Date(start.getTime() + 86_400_000);
    lines.push(
      'BEGIN:VEVENT',
      `UID:todo-${t.id}-${userId.slice(0, 8)}@kwkworks-todo`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(start)}`,
      `DTEND;VALUE=DATE:${ymd(end)}`,
      `SUMMARY:${icsEscape((t.done ? '✓ ' : '') + t.title)}`,
      `CATEGORIES:${icsEscape(t.category)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}

app.get('/api/export.ics', requireUser, async (req, res) => {
  const { data, error } = await req.supabase
    .from('todos')
    .select(COLUMNS)
    .eq('user_id', req.user.id)
    .not('due_date', 'is', null);
  if (error) throw dbError(error);
  res.set({
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': 'attachment; filename="my-todo.ics"',
    'Cache-Control': 'no-store',
  });
  res.send(buildIcs(data, req.user.id));
});

// ─────────────────────────────── 오류 처리 ───────────────────────────────

app.use('/api', (req, res) => res.status(404).json({ error: '없는 API 입니다.' }));

app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON 형식이 올바르지 않습니다.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: '요청이 너무 큽니다.' });
  console.error(err);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

app.listen(port, host, () => {
  console.log(`Todo 앱 실행 중: http://localhost:${port}`);
});
