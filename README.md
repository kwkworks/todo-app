# ✅ 나의 Todo 앱

로그인하면 **나만의 할 일 목록**이 열리는 Todo 앱입니다. 어둡고 미니멀한 디자인에, 달력으로 한눈에 볼 수 있어요.

## 배포 주소

(Render 배포 후 주소를 적습니다)

📄 기획 문서(PRD): [docs/PRD.md](docs/PRD.md)

## 기능 소개

### 할 일 관리
- **추가 / 목록 / 완료 표시 / 삭제** — 기본 CRUD (삭제는 한 번 더 눌러 확인)
- **마감일** — 오늘 마감은 노란색, 기한이 지난 일은 빨간색으로 표시
- **카테고리** — 카테고리마다 고정 색이 붙고, 카테고리별로 골라 보기

### 보기
- **캘린더** — 월간 달력에 마감일별로 할 일 표시
- **목록** — 카테고리 필터, 완료 숨기기
- **구글 캘린더로 내보내기** — `.ics` 파일을 받아 구글 캘린더에서 가져오기

### 로그인 · 보안 (사용자별 데이터 분리)
- **회원가입 / 로그인 / 로그아웃** — Supabase Auth (이메일 + 비밀번호)
- **내 할 일만 보기** — 모든 할 일에 주인(`user_id`)이 기록되고, DB의 **RLS(행 수준 보안)** 정책으로 본인 데이터만 조회·추가·수정·삭제할 수 있어요. 서버 코드도 모든 요청에 본인 조건을 붙여서 두 번 막아요.
- **키는 서버에만** — 화면 코드는 백엔드 API만 호출하고, Supabase 키는 서버 환경변수에만 있어요. 관리자 키(secret / service_role)는 쓰지 않아요.
- **안전한 로그인 유지** — 로그인 토큰은 화면 JS가 읽을 수 없는 `httpOnly` 쿠키에 보관해요.
- **그 밖의 보호** — 입력값 검사, 로그인 시도 횟수 제한(IP당 1분 10회), 보안 헤더(CSP 등), 할 일 제목은 항상 글자로만 표시(HTML 실행 안 됨)

### 기술 구성
| 구분 | 사용 기술 |
|---|---|
| 화면 | HTML / CSS / JavaScript |
| 백엔드 | Node.js + Express |
| DB · 로그인 | Supabase (Postgres + Auth + RLS) |
| 배포 | Render |

모두 무료 요금제로 사용합니다.

## 폴더 구조
```
public/            화면 (index.html, style.css, app.js)
server/index.js    백엔드 API
server/supabase.js Supabase 연결, 로그인 쿠키, 로그인 확인
supabase/schema.sql DB 표와 RLS 정책
.env.example       환경변수 예시 (실제 값은 .env 에, GitHub에는 안 올림)
```

## DB 구조 (`todos` 표)
| 열 | 종류 | 설명 |
|---|---|---|
| id | bigint (자동 증가) | 고유 번호 |
| user_id | uuid | 주인 (로그인한 사용자, `auth.users` 연결) |
| title | text (필수, 100자 이하) | 할 일 내용 |
| done | boolean | 완료 여부 |
| due_date | date (비워도 됨) | 마감일 |
| category | text (기본값 '일반', 20자 이하) | 카테고리 |
| created_at | timestamptz | 만든 시각 |

## 실행 방법 (내 컴퓨터)

### 준비물
- Node.js 22.9 이상
- Supabase 프로젝트 (무료)

### 1. 코드 받기 · 설치
```bash
git clone https://github.com/kwkworks/todo-app.git
cd todo-app
npm ci
```

### 2. Supabase DB 준비 (처음 한 번)
Supabase 대시보드 → **SQL Editor** 에 `supabase/schema.sql` 전체를 붙여넣고 **Run**.
`todos` 표와 RLS 정책이 만들어집니다.

### 3. 환경변수 설정
`.env.example` 을 복사해 `.env` 를 만들고 Supabase 값을 넣습니다. (Project Settings → API Keys / Data API)
```
SUPABASE_URL=https://<프로젝트ID>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```
> secret / service_role 키는 넣지 마세요. `.env` 는 GitHub에 올라가지 않습니다.

### 4. 실행
```bash
npm start
```
브라우저에서 `localhost:3000` 에 접속 → 회원가입 / 로그인. 끌 때는 터미널에서 `Ctrl+C`.

## 배포 (Render)

| 항목 | 값 |
|---|---|
| Build Command | `npm ci` |
| Start Command | `npm start` |
| 환경변수 | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `HOST=0.0.0.0`, `NODE_ENV=production`, `APP_URL=<배포 주소>` |

`main` 브랜치에 push 하면 자동으로 다시 배포됩니다.
