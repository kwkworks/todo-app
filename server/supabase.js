// Supabase 연결과 로그인 쿠키 관리
// - 키는 서버 환경변수에만 있고, 화면(브라우저) 코드는 /api 만 호출한다.
// - 관리자 키(secret / service_role)는 쓰지 않는다. publishable 키 + 로그인한 사용자 토큰으로
//   요청하므로 DB의 RLS(행 수준 보안)가 항상 적용된다.
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY 환경변수가 필요합니다. (.env.example 참고)');
  process.exit(1);
}

const isProd = process.env.NODE_ENV === 'production';
const ACCESS = 'sb_access';
const REFRESH = 'sb_refresh';
const cookieOptions = {
  httpOnly: true, // 화면 JS가 토큰을 읽을 수 없음 (XSS로 토큰을 훔쳐 갈 수 없게)
  sameSite: 'lax', // 다른 사이트에서 보낸 POST/DELETE 요청에는 쿠키가 실리지 않음
  secure: isProd, // 배포(https)에서는 https로만 전송
  path: '/',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30일
};

// 요청마다 새 클라이언트를 만든다. (사용자끼리 로그인 상태가 섞이지 않게)
export function newClient() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function saveSession(res, session) {
  res.cookie(ACCESS, session.access_token, cookieOptions);
  res.cookie(REFRESH, session.refresh_token, cookieOptions);
}

export function clearSession(res) {
  const { maxAge, ...opts } = cookieOptions;
  res.clearCookie(ACCESS, opts);
  res.clearCookie(REFRESH, opts);
}

export function readTokens(req) {
  return { access_token: req.cookies[ACCESS], refresh_token: req.cookies[REFRESH] };
}

// 로그인이 필요한 API 앞에 붙이는 검사.
// 쿠키의 토큰으로 사용자를 확인하고(만료됐으면 자동 갱신),
// 그 사용자 권한의 Supabase 클라이언트를 req.supabase 에 넣는다.
export async function requireUser(req, res, next) {
  const { access_token, refresh_token } = readTokens(req);
  if (!access_token || !refresh_token) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }

  const supabase = newClient();
  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error || !data.session || !data.user) {
    clearSession(res);
    return res.status(401).json({ error: '로그인이 만료되었습니다. 다시 로그인하세요.' });
  }
  if (data.session.access_token !== access_token) saveSession(res, data.session);

  req.supabase = supabase;
  req.user = data.user;
  next();
}
