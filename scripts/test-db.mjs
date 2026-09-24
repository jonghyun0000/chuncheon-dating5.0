#!/usr/bin/env node
/** Runs schema regressions in a disposable, socket-only PostgreSQL cluster. Never uses remote credentials. */
import { mkdtempSync, mkdirSync, readFileSync, appendFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testDir = join(root, 'supabase/tests');
const baseline = join(root, 'supabase/baseline.sql');
const migrationDir = join(root, 'supabase/migrations');
const cases = readFileSync(join(testDir, 'regressions.sql'), 'utf8').split(/^-- TEST /m).slice(1).map(part => {
  const [header, ...lines] = part.split('\n');
  const [id, mode, ...label] = header.trim().split(' ');
  return { id, mode, label: label.join(' '), sql: lines.join('\n') };
});
const temp = mkdtempSync(join(tmpdir(), 'ccdb-'));
const data = join(temp, 'data');
const socket = join(temp, 'socket');
mkdirSync(socket);
let started = false;
// Drop inherited libpq settings (especially PGHOSTADDR/PGSERVICE) before pinning
// every connection to this temporary Unix socket. No .env file is loaded.
const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PG'))),
  PGHOST: socket, PGPORT: '55439', PGUSER: 'postgres', PGPASSWORD: '', PGDATABASE: 'postgres' };
function run(binary, args, input, database = 'postgres', check = true) {
  const result = spawnSync(binary, args, { cwd: root, env: { ...env, PGDATABASE: database }, input, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw new Error(`${binary} is required: ${result.error.message}`);
  if (check && result.status !== 0) throw new Error(`${binary} failed: ${result.stderr || result.stdout}`);
  return result;
}
function sql(input, database, check = true) {
  return run('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], input, database, check);
}
async function concurrent(firstStatement, secondStatement, database) {
  const results = [];
  let secondStarted = false;
  return await new Promise((resolvePair, rejectPair) => {
    const children = [];
    const timeout = setTimeout(() => {
      for (const child of children) child.kill('SIGKILL');
      rejectPair(new Error('Concurrent database regression timed out'));
    }, 12000);
    function start(statement, index) {
      const child = spawn('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], {
        cwd: root, env: { ...env, PGDATABASE: database }, stdio: ['pipe', 'pipe', 'pipe'],
      });
      children.push(child);
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', chunk => {
        stdout += chunk;
        if (index === 0 && stdout.includes('LOCKS_HELD') && !secondStarted) {
          secondStarted = true;
          start(secondStatement, 1);
        }
      });
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('error', error => { clearTimeout(timeout); rejectPair(error); });
      child.on('close', status => {
        results[index] = { status, stdout, stderr };
        if (index === 0 && !secondStarted) {
          clearTimeout(timeout);
          rejectPair(new Error(`First transaction failed before race began: ${stderr}`));
        } else if (results[0] && results[1]) {
          clearTimeout(timeout);
          resolvePair(results);
        }
      });
      child.stdin.end(`BEGIN; SET LOCAL statement_timeout='8s';\n${statement}\nCOMMIT;`);
    }
    start(firstStatement, 0);
  });
}
try {
  const version = run('initdb', ['--version']).stdout.trim();
  if (!/PostgreSQL\) 17\./.test(version)) throw new Error(`PostgreSQL 17 required; found ${version}`);
  run('initdb', ['-D', data, '--username=postgres', '--auth=trust', '--no-locale', '--encoding=UTF8']);
  appendFileSync(join(data, 'postgresql.conf'), `\nlisten_addresses = ''\nunix_socket_directories = '${socket.replaceAll("'", "''")}'\nport = 55439\nfsync = off\n`);
  run('pg_ctl', ['-D', data, '-l', join(temp, 'server.log'), '-w', '-t', '20', 'start']);
  started = true;
  sql('CREATE DATABASE baseline; CREATE DATABASE hardened;');
  sql('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;');
  const setup = [readFileSync(join(testDir, 'supabase-stubs.sql'), 'utf8'), readFileSync(baseline, 'utf8')].join('\n');
  const fixtures = readFileSync(join(testDir, 'fixtures.sql'), 'utf8');
  const migrations = readdirSync(migrationDir).filter(name => name.endsWith('.sql')).sort();
  if (!migrations.length) throw new Error('No hardening migration found');
  for (const db of ['baseline', 'hardened']) {
    sql(setup, db);
    sql(fixtures, db);
    if (db === 'hardened') {
      for (const name of migrations) sql('BEGIN;\n' + readFileSync(join(migrationDir, name), 'utf8') + '\nCOMMIT;', db);
      // Deployment retries must not fail or recreate weaker privileges.
      for (const name of migrations) sql('BEGIN;\n' + readFileSync(join(migrationDir, name), 'utf8') + '\nCOMMIT;', db);
    }
  }
  let failed = 0;
  let reproduced = 0;
  for (const test of cases.filter(test => test.mode === 'BASELINE_FAIL')) {
    const result = sql(`BEGIN;\n${test.sql}\nROLLBACK;`, 'baseline', false);
    if (result.status === 0) {
      failed++;
      console.error(`FAIL baseline ${test.id}: regression did not reproduce`);
    } else if (!/TEST ASSERTION FAILED:/.test(result.stderr)) {
      failed++;
      console.error(`FAIL baseline ${test.id}: setup/error rather than expected security assertion\n${result.stderr}`);
    } else {
      reproduced++;
      console.log(`REPRODUCED baseline ${test.id}: ${test.label}`);
    }
  }
  let passed = 0;
  for (const test of cases) {
    const result = sql(`BEGIN;\n${test.sql}\nROLLBACK;`, 'hardened', false);
    if (result.status !== 0) {
      failed++;
      console.error(`FAIL ${test.id}: ${test.label}\n${result.stderr}`);
    } else {
      passed++;
      console.log(`PASS ${test.id}: ${test.label}`);
    }
  }
  const redaction = migrations.find(name => name.endsWith('_redact_completed_deletion_snapshots.sql'));
  if (redaction) {
    const repair = readFileSync(join(migrationDir, redaction), 'utf8');
    sql('BEGIN;\n' + readFileSync(join(testDir, 'redaction-fixtures.sql'), 'utf8') + '\n' + repair + '\n' + repair + '\n' + readFileSync(join(testDir, 'redaction-assertions.sql'), 'utf8') + '\nROLLBACK;', 'hardened');
    console.log('PASS historical redaction: idempotent, preserves all rows and unrelated content');
  }
  // Two separate connections overlap while the first transaction holds its locks.
  for (const race of [
    { name: 'matching', uid: '00000000-0000-4000-8000-000000000003',
      first: "SELECT public.accept_match_request('30000000-0000-4000-8000-000000000001');",
      second: "SELECT public.accept_match_request('30000000-0000-4000-8000-000000000002');",
      error: '이미 처리된 신청',
      check: "SELECT test_support.assert((SELECT count(*)=1 FROM public.match_requests WHERE status='accepted'),'one accepted match'); SELECT test_support.assert((SELECT count(*)=2 FROM public.teams WHERE status='matched'),'exactly two matched teams');" },
    { name: 'creation', uid: '00000000-0000-4000-8000-000000000009',
      first: "SELECT public.save_my_team(NULL,'First browser tab',2,test_support.members(),true);",
      second: "SELECT public.save_my_team(NULL,'Second browser tab',2,test_support.members(),true);",
      error: '이미 진행 중인 팀',
      check: "SELECT test_support.assert((SELECT count(*)=1 FROM public.teams WHERE owner_id='00000000-0000-4000-8000-000000000009'),'one open team'); SELECT test_support.assert((SELECT count(*)=2 FROM public.team_members WHERE team_id IN (SELECT id FROM public.teams WHERE owner_id='00000000-0000-4000-8000-000000000009')),'one complete roster');" },
  ]) {
    const database = `race_${race.name}`;
    sql(`CREATE DATABASE ${database} TEMPLATE hardened;`);
    const login = `SELECT set_config('request.jwt.claim.sub','${race.uid}',true); SET LOCAL ROLE authenticated;`;
    const [first, second] = await concurrent(`${login}\n${race.first}\n\\echo LOCKS_HELD\nSELECT pg_sleep(0.4);`, `${login}\n${race.second}`, database);
    if (first.status !== 0 || second.status === 0 || !second.stderr.includes(race.error)) {
      failed++;
      console.error(`FAIL concurrent ${race.name}: unexpected transaction outcomes\n${first.stderr}\n${second.stderr}`);
    } else {
      sql(race.check, database);
      console.log(`PASS concurrent ${race.name}: competing transactions preserve one valid outcome`);
    }
  }
  console.log(`\n${reproduced} baseline vulnerabilities reproduced; ${passed}/${cases.length} hardened regressions checked, plus historical redaction and 2 concurrency cases.`);
  if (failed) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (started) run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', '-t', '20', 'stop'], undefined, 'postgres', false);
  rmSync(temp, { recursive: true, force: true });
}
