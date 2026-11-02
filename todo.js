// 터미널용 Todo 명령 (AI가 앱 데이터를 읽고 다루는 입구)
// 사용: node --env-file-if-exists=.env todo.js <list|add|done|summary> ...
// 웹 앱과 같은 Supabase 연결(publishable 키 + 로그인한 사용자 권한)을 쓰므로 RLS가 그대로 적용된다.
// 로그인 정보는 환경변수 TODO_EMAIL / TODO_PASSWORD 에서만 읽는다.
import { newClient } from './server/supabase.js';

const COLUMNS = 'id, title, done, due_date, category, done_at';

const USAGE = `사용법:
  node todo.js list                         할 일 목록
  node todo.js add "<내용>" [YYYY-MM-DD] [카테고리]   추가
  node todo.js done <번호>                  완료 처리
  node todo.js summary                      오늘 완료한 일 요약`;

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function login() {
  const email = process.env.TODO_EMAIL;
  const password = process.env.TODO_PASSWORD;
  if (!email || !password) fail('TODO_EMAIL / TODO_PASSWORD 환경변수가 필요합니다. (.env.example 참고)');
  const supabase = newClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) fail('로그인에 실패했습니다. 이메일/비밀번호와 가입 확인 여부를 확인하세요.');
  return { supabase, userId: data.user.id };
}

const line = (t) => {
  const due = t.due_date ? ` (마감 ${t.due_date})` : '';
  return `[${t.done ? 'x' : ' '}] ${t.id}. ${t.title}${due} #${t.category}`;
};

async function list({ supabase, userId }) {
  const { data, error } = await supabase
    .from('todos')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('done')
    .order('due_date', { nullsFirst: false })
    .order('id');
  if (error) fail('목록을 불러오지 못했습니다.');
  console.log(data.length ? data.map(line).join('\n') : '할 일이 없습니다.');
}

async function add({ supabase, userId }, [title, ...rest]) {
  if (!title || !title.trim()) fail('추가할 내용을 입력하세요.');
  if (title.trim().length > 100) fail('할 일은 100자 이하로 입력하세요.');
  let due_date = null;
  if (rest[0] && /^\d{4}-\d{2}-\d{2}$/.test(rest[0])) due_date = rest.shift();
  const category = (rest.join(' ').trim() || '일반').slice(0, 20);
  const { data, error } = await supabase
    .from('todos')
    .insert({ title: title.trim(), due_date, category, user_id: userId })
    .select(COLUMNS)
    .single();
  if (error) fail('추가하지 못했습니다. 마감일 형식(YYYY-MM-DD)을 확인하세요.');
  console.log(`추가: ${line(data)}`);
}

async function done({ supabase, userId }, [rawId]) {
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) fail('완료할 할 일 번호를 입력하세요.');
  const { data, error } = await supabase
    .from('todos')
    .update({ done: true, done_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select(COLUMNS);
  if (error) fail('완료 처리하지 못했습니다. (done_at 열이 DB에 추가됐는지 확인하세요.)');
  if (!data.length) fail('할 일을 찾을 수 없습니다.');
  console.log(`완료: ${line(data[0])}`);
}

async function summary({ supabase, userId }) {
  const start = new Date();
  start.setHours(0, 0, 0, 0); // 내 컴퓨터 시간대 기준 오늘 0시
  const end = new Date(start.getTime() + 86_400_000);
  const { data, error } = await supabase
    .from('todos')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('done', true)
    .gte('done_at', start.toISOString())
    .lt('done_at', end.toISOString())
    .order('done_at');
  if (error) fail('요약을 불러오지 못했습니다. (done_at 열이 DB에 추가됐는지 확인하세요.)');
  const today = start.toLocaleDateString('sv-SE');
  console.log(`오늘(${today}) 완료 ${data.length}건`);
  for (const t of data) console.log(`- ${t.title} (#${t.category})`);
}

const commands = { list, add, done, summary };
const [command, ...args] = process.argv.slice(2);
if (!commands[command]) fail(USAGE);
await commands[command](await login(), args);
