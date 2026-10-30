-- Power Level crews: who's in which crew, a public profile per person, a feed of finished
-- workouts, and reactions. Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to run again: it only creates what's missing and replaces the functions and policies.
--
-- Privacy model: you can only ever read rows of people you share a crew with (and your own).
-- Nothing personal (body weight, food, water, notes) is stored here. Crews are joined only
-- with an invite code, through join_crew(); nobody can list crews they're not in.


-- ---------- Tables ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  avatar text not null default '💪' check (char_length(avatar) between 1 and 8),
  power_level integer not null default 0 check (power_level between 0 and 10000000),
  tier text not null default '' check (char_length(tier) <= 40),
  streak_weeks integer not null default 0 check (streak_weeks between 0 and 1000),
  week_sessions integer not null default 0 check (week_sessions between 0 and 50),
  total_sessions integer not null default 0 check (total_sessions between 0 and 100000),
  -- Best estimated 1RM per big lift, e.g. {"bench": 100, "squat": 140}; null when not shared.
  lifts jsonb check (lifts is null or (jsonb_typeof(lifts) = 'object' and pg_column_size(lifts) < 1000)),
  updated_at timestamptz not null default now()
);

create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  invite_code text not null unique check (invite_code ~ '^[A-Z2-9]{6}$'),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.crew_members (
  crew_id uuid not null references public.crews (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);
create index if not exists crew_members_user_idx on public.crew_members (user_id);

-- One row per finished workout. client_id is the workout's id on the phone, so re-sending the
-- same workout updates it instead of making a copy.
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text not null check (char_length(client_id) between 1 and 40),
  done_on date not null,
  title text not null check (char_length(title) between 1 and 60),
  summary jsonb not null check (jsonb_typeof(summary) = 'object' and pg_column_size(summary) < 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);
create index if not exists posts_feed_idx on public.posts (done_on desc, created_at desc);
create index if not exists posts_user_idx on public.posts (user_id);

create table if not exists public.reactions (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('fist', 'fire', 'strong')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, kind)
);

-- ---------- Helpers (security definer so policies don't recurse into crew_members) ----------

create or replace function public.is_crew_member(crew uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.crew_members m where m.crew_id = crew and m.user_id = (select auth.uid()))
$$;

create or replace function public.shares_crew(other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select other = (select auth.uid()) or exists (
    select 1 from public.crew_members a join public.crew_members b on a.crew_id = b.crew_id
    where a.user_id = (select auth.uid()) and b.user_id = other)
$$;

-- ---------- Crew actions (the only way to create or join a crew) ----------

create or replace function public.create_crew(crew_name text)
returns public.crews language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  code text;
  made public.crews;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if me is null then raise exception 'Sign in first'; end if;
  if char_length(trim(coalesce(crew_name, ''))) not between 1 and 40 then raise exception 'Crew name must be 1 to 40 characters'; end if;
  if (select count(*) from public.crews c where c.created_by = me) >= 10 then raise exception 'You can make up to 10 crews'; end if;
  loop
    code := '';
    for i in 1..6 loop code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from public.crews c where c.invite_code = code);
  end loop;
  insert into public.crews (name, invite_code, created_by) values (trim(crew_name), code, me) returning * into made;
  insert into public.crew_members (crew_id, user_id) values (made.id, me);
  return made;
end $$;

create or replace function public.join_crew(code text)
returns public.crews language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  found public.crews;
begin
  if me is null then raise exception 'Sign in first'; end if;
  select * into found from public.crews c where c.invite_code = upper(trim(code));
  if found.id is null then raise exception 'No crew with that code'; end if;
  if (select count(*) from public.crew_members m where m.crew_id = found.id) >= 50 then raise exception 'That crew is full'; end if;
  insert into public.crew_members (crew_id, user_id) values (found.id, me) on conflict do nothing;
  return found;
end $$;

create or replace function public.leave_crew(crew uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.crew_members m where m.crew_id = crew and m.user_id = (select auth.uid());
  -- The last one out turns off the lights.
  delete from public.crews c where c.id = crew and not exists (select 1 from public.crew_members m where m.crew_id = crew);
$$;

revoke all on function public.create_crew(text), public.join_crew(text), public.leave_crew(uuid), public.is_crew_member(uuid), public.shares_crew(uuid) from public, anon;
grant execute on function public.create_crew(text), public.join_crew(text), public.leave_crew(uuid), public.is_crew_member(uuid), public.shares_crew(uuid) to authenticated;

-- ---------- Row level security ----------

alter table public.profiles enable row level security;
alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.posts enable row level security;
alter table public.reactions enable row level security;

revoke all on public.profiles, public.crews, public.crew_members, public.posts, public.reactions from anon;
grant select, insert, update, delete on public.profiles, public.posts, public.reactions to authenticated;
grant select on public.crews, public.crew_members to authenticated;

drop policy if exists "profiles: crewmates can read" on public.profiles;
create policy "profiles: crewmates can read" on public.profiles for select to authenticated using (public.shares_crew(id));
drop policy if exists "profiles: write your own" on public.profiles;
create policy "profiles: write your own" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists "profiles: update your own" on public.profiles;
create policy "profiles: update your own" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists "profiles: delete your own" on public.profiles;
create policy "profiles: delete your own" on public.profiles for delete to authenticated using (id = (select auth.uid()));

drop policy if exists "crews: members can read" on public.crews;
create policy "crews: members can read" on public.crews for select to authenticated using (public.is_crew_member(id));

drop policy if exists "crew_members: members can read" on public.crew_members;
create policy "crew_members: members can read" on public.crew_members for select to authenticated using (public.is_crew_member(crew_id));

drop policy if exists "posts: crewmates can read" on public.posts;
create policy "posts: crewmates can read" on public.posts for select to authenticated using (public.shares_crew(user_id));
drop policy if exists "posts: add your own" on public.posts;
create policy "posts: add your own" on public.posts for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "posts: update your own" on public.posts;
create policy "posts: update your own" on public.posts for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "posts: delete your own" on public.posts;
create policy "posts: delete your own" on public.posts for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "reactions: read on posts you can see" on public.reactions;
create policy "reactions: read on posts you can see" on public.reactions for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and public.shares_crew(p.user_id)));
drop policy if exists "reactions: react to posts you can see" on public.reactions;
create policy "reactions: react to posts you can see" on public.reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id and public.shares_crew(p.user_id)));
drop policy if exists "reactions: take back your own" on public.reactions;
create policy "reactions: take back your own" on public.reactions for delete to authenticated using (user_id = (select auth.uid()));
