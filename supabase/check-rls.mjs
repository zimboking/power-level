// Checks the row-level security in schema.sql without a Supabase project: runs it in PGlite
// (Postgres in WebAssembly) with stand-ins for Supabase's auth schema and roles.
//   npm i --no-save @electric-sql/pglite@0.3.11 && node supabase/check-rls.mjs supabase/schema.sql
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const schema = readFileSync(process.argv[2], 'utf8')
const db = new PGlite()
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`)
await db.exec(schema)
await db.exec(schema) // runs twice cleanly

const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b', C = '00000000-0000-0000-0000-00000000000c'
await db.exec(`insert into auth.users values ('${A}','a@x'),('${B}','b@x'),('${C}','c@x')`)

async function as(user, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user || ''}', false); set role ${user ? 'authenticated' : 'anon'};`)
  try { return (await db.query(sql, params)).rows } finally { await db.exec('reset role') }
}
const fails = async (p, re) => { await assert.rejects(p, re); }

// Everyone makes a profile and a post.
for (const [u, n] of [[A, 'Alex'], [B, 'Bo'], [C, 'Cy']]) {
  await as(u, `insert into public.profiles (id, display_name, power_level) values ($1, $2, 100)`, [u, n])
  await as(u, `insert into public.posts (user_id, client_id, done_on, title, summary) values ($1, 'w1', '2026-10-29', 'Push', '{"sets":10}')`, [u])
}
// Can't write as someone else.
await fails(as(A, `insert into public.profiles (id, display_name) values ($1, 'fake')`, [C]), /row-level security/)
await fails(as(A, `insert into public.posts (user_id, client_id, done_on, title, summary) values ($1, 'x', '2026-10-29', 'x', '{}')`, [B]), /row-level security/)

// Before any crew: you only see yourself.
assert.deepEqual((await as(A, 'select display_name from public.profiles')).map(r => r.display_name), ['Alex'])
assert.equal((await as(A, 'select * from public.posts')).length, 1)

// A makes a crew, B joins with the code; C stays out.
const [crew] = await as(A, `select * from public.create_crew('Tuesday Lifters')`)
assert.match(crew.invite_code, /^[A-HJ-NP-Z2-9]{6}$/)
await as(B, `select * from public.join_crew($1)`, [crew.invite_code.toLowerCase()])
await fails(as(C, `select * from public.join_crew('ZZZZZZ')`), /No crew with that code/)

const names = async u => (await as(u, 'select display_name from public.profiles order by display_name')).map(r => r.display_name)
assert.deepEqual(await names(A), ['Alex', 'Bo'])
assert.deepEqual(await names(B), ['Alex', 'Bo'])
assert.deepEqual(await names(C), ['Cy'])
assert.equal((await as(B, 'select * from public.posts')).length, 2)
assert.equal((await as(C, 'select * from public.posts')).length, 1)
assert.equal((await as(C, 'select * from public.crews')).length, 0, 'outsiders cannot list crews')
assert.equal((await as(C, 'select * from public.crew_members')).length, 0)
assert.equal((await as(B, 'select * from public.crew_members')).length, 2)

// Can't join by inserting a membership directly, or make a crew without the function.
await fails(as(C, `insert into public.crew_members (crew_id, user_id) values ($1, $2)`, [crew.id, C]), /permission denied/)
await fails(as(C, `insert into public.crews (name, invite_code, created_by) values ('x', 'ABCDEF', $1)`, [C]), /permission denied/)

// Reactions: crewmates yes, outsiders no, and not on someone else's behalf.
const [aPost] = await as(A, `select id from public.posts where user_id = $1`, [A])
await as(B, `insert into public.reactions (post_id, user_id, kind) values ($1, $2, 'fist')`, [aPost.id, B])
await fails(as(C, `insert into public.reactions (post_id, user_id, kind) values ($1, $2, 'fire')`, [aPost.id, C]), /row-level security/)
await fails(as(B, `insert into public.reactions (post_id, user_id, kind) values ($1, $2, 'fire')`, [aPost.id, A]), /row-level security/)
assert.equal((await as(A, 'select * from public.reactions')).length, 1)
assert.equal((await as(C, 'select * from public.reactions')).length, 0)

// Can't edit or delete someone else's post (silently affects nothing under RLS).
await as(B, `update public.posts set title = 'hacked' where user_id = $1`, [A])
await as(B, `delete from public.posts where user_id = $1`, [A])
assert.equal((await as(A, `select title from public.posts where user_id = $1`, [A]))[0].title, 'Push')

// Anonymous visitors see nothing at all.
await fails(as(null, 'select * from public.profiles'), /permission denied/)
await fails(as(null, `select * from public.join_crew($1)`, [crew.invite_code]), /permission denied/)

// Leaving: B no longer sees A; the last one out deletes the crew.
await as(B, `select public.leave_crew($1)`, [crew.id])
assert.deepEqual(await names(B), ['Bo'])
await as(A, `select public.leave_crew($1)`, [crew.id])
assert.equal((await db.query('select count(*)::int as n from public.crews')).rows[0].n, 0)

// Size limits hold.
await fails(as(A, `update public.profiles set display_name = $1 where id = $2`, ['x'.repeat(31), A]), /check constraint/)
console.log('RLS checks passed')
