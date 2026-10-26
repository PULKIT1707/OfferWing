import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { STARTER_LIMITS } from "./starter-limits";

// Runs migration 0018 on an in-process Postgres (PGlite) with a stub of Supabase's auth schema and
// roles, then checks the ledger as a signed-in user. Guards the Starter-limit bypass: users used to
// reset their own limit by editing the run rows the limit was counted from.
const MIGRATION = new URL("../../../../../supabase/migrations/0018_starter_usage_ledger.sql", import.meta.url);
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

let db: PGlite;

async function as<T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ""]);
  await db.exec("set role authenticated;");
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role;");
  }
}

const rejects = (uid: string | null, sql: string) => expect(as(uid, sql)).rejects.toThrow();

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    -- Supabase grants every new public table to these roles by default.
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    insert into auth.users values ('${A}'), ('${B}');
  `);
  await db.exec(readFileSync(MIGRATION, "utf8"));
}, 60_000);

describe("starter usage ledger (migration 0018)", () => {
  it("seeds the same limits the app shows", async () => {
    const rows = await db.query<{ agent: string; daily_limit: number }>("select agent, daily_limit from public.starter_limits");
    expect(Object.fromEntries(rows.rows.map((r) => [r.agent, r.daily_limit]))).toEqual(STARTER_LIMITS);
  });

  it("grants claims up to the daily limit, capping batches", async () => {
    expect(await as(A, "select * from public.claim_starter_runs('profile_audit')")).toHaveLength(1);
    expect(await as(A, "select * from public.claim_starter_runs('profile_audit', 5)")).toHaveLength(1);
    expect(await as(A, "select * from public.claim_starter_runs('profile_audit')")).toHaveLength(0);
    expect(await as<{ left: number }>(A, "select public.starter_runs_left('profile_audit') as left")).toEqual([{ left: 0 }]);
    expect(await as<{ left: number }>(B, "select public.starter_runs_left('profile_audit') as left")).toEqual([{ left: 2 }]);
  });

  it("doesn't let a user rewrite, delete, add or refund usage, or change limits", async () => {
    await rejects(A, "update public.starter_usage set used_on = used_on - 1");
    await rejects(A, "delete from public.starter_usage");
    await rejects(A, `insert into public.starter_usage (user_id, agent) values ('${A}', 'job_match')`);
    await rejects(A, "update public.starter_limits set daily_limit = 1000");
    await rejects(A, "select public.release_starter_runs(array(select id from public.starter_usage))");
  });

  it("shows each user only their own usage", async () => {
    expect(await as<{ n: number }>(A, "select count(*)::int as n from public.starter_usage")).toEqual([{ n: 2 }]);
    expect(await as<{ n: number }>(B, "select count(*)::int as n from public.starter_usage")).toEqual([{ n: 0 }]);
  });

  it("rejects unknown agents and anonymous callers, and grants nothing for a zero count", async () => {
    await rejects(A, "select * from public.claim_starter_runs('made_up')");
    await rejects(null, "select * from public.claim_starter_runs('job_match')");
    expect(await as(A, "select * from public.claim_starter_runs('job_match', 0)")).toHaveLength(0);
  });

  it("lets the service role give a failed run back", async () => {
    await db.exec("set role service_role;");
    const ids = (await db.query<{ id: string }>("select id from public.starter_usage where agent = 'profile_audit' limit 1")).rows.map((r) => r.id);
    await db.query("select public.release_starter_runs($1::uuid[])", [ids]);
    await db.exec("reset role;");
    expect(await as<{ left: number }>(A, "select public.starter_runs_left('profile_audit') as left")).toEqual([{ left: 1 }]);
  });

  it("removes usage with the account", async () => {
    await db.exec(`delete from auth.users where id = '${A}'`);
    expect((await db.query<{ n: number }>("select count(*)::int as n from public.starter_usage")).rows).toEqual([{ n: 0 }]);
  });
});
