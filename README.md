# ✅ 나의 Todo 앱

내 컴퓨터에서 실행하는 할 일 관리 앱입니다. 어둡고 미니멀한 디자인에, 달력으로 한눈에 볼 수 있어요.

👉 **바로 써 보기: https://kwkworks-todo.streamlit.app**
(무료 서버라 데이터는 모두가 함께 쓰고, 서버가 다시 시작되면 초기화될 수 있어요.)

📄 기획 문서(PRD): [docs/PRD.md](docs/PRD.md)

## 기능
- **기본(CRUD)**: 할 일 추가 / 목록 보기 / 완료 표시 / 삭제(한 번 더 확인)
- **추가 기능 1. 마감일 표시**: 오늘 마감은 노란색, 기한이 지난 일은 빨간색으로 보여요.
- **추가 기능 2. 카테고리(태그)**: 카테고리마다 색이 붙고, 카테고리별로 골라 볼 수 있어요.
- **캘린더 보기**: 월간 달력에 마감일별로 할 일이 표시돼요.
- **구글 캘린더로 내보내기**: `.ics` 파일을 받아 구글 캘린더에서 가져오기 하면 돼요.

## 사용한 도구 (모두 무료)
| 도구 | 역할 |
|---|---|
| Python | 프로그래밍 언어 |
| Streamlit | 파이썬만으로 웹 화면을 만드는 라이브러리 |
| SQLite | 파일 하나(`todo.db`)로 된 무료 DB. 껐다 켜도 데이터가 남아요. |
| python-dotenv | `.env` 파일의 설정값을 읽어 와요. |

## DB 구조 (`todos` 테이블)
| 열 | 종류 | 설명 |
|---|---|---|
| id | INTEGER (자동 증가) | 고유 번호 |
| title | TEXT (필수) | 할 일 내용 |
| done | INTEGER (0/1) | 완료 여부 |
| due_date | TEXT (비워도 됨) | 마감일 (YYYY-MM-DD) |
| category | TEXT (기본값 '일반') | 카테고리 |

## 실행 방법 (Windows)
```bash
py -m pip install -r requirements.txt
py -m streamlit run app.py
```
위 명령을 실행하면 내 컴퓨터에서 서버가 켜지고 브라우저가 자동으로 열려요. 자동으로 열리지 않으면 주소창에 `localhost:8501`을 직접 입력하세요. (서버를 켠 본인 컴퓨터에서만 열리는 주소이고, 실행 중인 터미널 창을 닫으면 접속할 수 없어요.)

## 설정과 비밀값 관리
- 설정값은 코드에 직접 쓰지 않고 `.env` 파일에서 읽어요. 지금 설정은 DB 파일 위치(`DB_PATH`) 하나뿐이고, `.env`가 없으면 기본값 `todo.db`를 써요. 그래서 내려받은 그대로 실행돼요.
- DB 파일 위치를 바꾸고 싶을 때만 `.env.example`을 복사해 `.env`를 만들어 고치세요.
- SQLite는 비밀번호가 없는 DB라서, 이 프로젝트에는 비밀번호나 API 키가 필요 없어요.
- 나중에 비밀값이 생기면 `.env`에만 적어요. `.env`와 `todo.db`는 `.gitignore`에 있어서 GitHub에 올라가지 않아요.
<img width="1170" height="823" alt="image" src="https://github.com/user-attachments/assets/2beb85fe-f1df-4915-b4f5-aab97afd7f04" />
<img width="939" height="807" alt="image" src="https://github.com/user-attachments/assets/616bb5d1-209a-46e9-b1d1-be64193ce19a" />
<img width="951" height="830" alt="image" src="https://github.com/user-attachments/assets/73f83998-5474-4162-ad4e-80b75b8eecd7" />
<img width="1046" height="786" alt="image" src="https://github.com/user-attachments/assets/e45c6ee2-7c32-4006-b8c1-5e82577de497" />

