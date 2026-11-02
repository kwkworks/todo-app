# Todo 앱

## 개요
로그인하면 내 할 일 목록이 열리는 1인용 Todo 앱 (Express + Supabase). 터미널용 `todo.js` 명령으로도 데이터를 다룬다.

## 명령 (프로젝트 루트에서 실행)
- 목록: `node --env-file-if-exists=.env todo.js list`
- 추가: `node --env-file-if-exists=.env todo.js add "<내용>" [YYYY-MM-DD] [카테고리]`
- 완료: `node --env-file-if-exists=.env todo.js done <번호>`
- 오늘 완료 요약: `node --env-file-if-exists=.env todo.js summary`
- 앱 실행: `npm start` → localhost:3000

## 규칙
- 데이터는 Supabase 테스트 프로젝트의 `todos` 표에 있다. 로그인 정보(`TODO_EMAIL`, `TODO_PASSWORD`)와 키는 `.env` 환경변수에서만 읽는다. 값을 출력하거나 파일·커밋에 넣지 않는다.
- 관리자 키(secret / service_role)는 쓰지 않는다. RLS를 우회하지 않는다.
- UI 문구는 존댓말로.
- 코드를 고치기 전에는 `git commit`으로 되돌릴 지점을 만든다.

## 하지 말 것
- `.env`를 읽어 값을 보여주거나 수정하지 말 것.
- 테이블 삭제, 데이터 일괄 삭제 등 되돌릴 수 없는 DB 작업을 하지 말 것.
