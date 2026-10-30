-- 나의 Todo 앱 DB 스키마 (Supabase Postgres)
-- Supabase 대시보드 → SQL Editor 에 전체를 붙여넣고 Run. 여러 번 실행해도 안전합니다.
-- 관계: auth.users(사용자) 1 ──< todos(할 일)
-- RLS(행 수준 보안)를 켜서, 로그인한 사용자는 자기 할 일만 보고·추가하고·고치고·지울 수 있습니다.

-- ─────────────────────────────── 표 ───────────────────────────────

create table if not exists public.todos (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null check (length(trim(title)) > 0 and length(title) <= 100),
  done       boolean not null default false,
  due_date   date,                                      -- 마감일, null = 마감 없음
  category   text not null default '일반' check (length(trim(category)) > 0 and length(category) <= 20),
  created_at timestamptz not null default now()
);

create index if not exists todos_user_due_idx on public.todos (user_id, due_date);

-- ─────────────────────────────── 권한 ───────────────────────────────
-- 로그인하지 않은 요청(anon)은 아무것도 못 하고, 로그인한 사용자(authenticated)만 표를 다룬다.

revoke all on public.todos from anon, authenticated;
grant select, insert, update, delete on public.todos to authenticated;

-- ─────────────────────────────── RLS ───────────────────────────────

alter table public.todos enable row level security;

drop policy if exists "todos_select_own" on public.todos;
drop policy if exists "todos_insert_own" on public.todos;
drop policy if exists "todos_update_own" on public.todos;
drop policy if exists "todos_delete_own" on public.todos;

create policy "todos_select_own" on public.todos for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "todos_insert_own" on public.todos for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "todos_update_own" on public.todos for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "todos_delete_own" on public.todos for delete to authenticated
  using ((select auth.uid()) = user_id);
