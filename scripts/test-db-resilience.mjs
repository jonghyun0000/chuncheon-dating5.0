#!/usr/bin/env node
/** Synthetic recovery/load drill. All connections are pinned to newly created local Unix sockets. */
import { mkdtempSync,mkdirSync,readFileSync,writeFileSync,appendFileSync,readdirSync,statSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve,join,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const fixtures=join(root,'supabase/tests');
const temp=mkdtempSync(join(tmpdir(),'ccres-'));
const reportPath=process.argv[2]?resolve(root,process.argv[2]):join(resolve(root,process.env.CC_VALIDATION_REPORT_DIR||'supabase/.temp/validation'),'db-resilience.json');
const cleanEnv=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('PG')));
const clusters=[];
const report={scope:'Isolated synthetic PostgreSQL 17; no production connections or data; no actual Storage file bytes.',startedAt:new Date().toISOString(),checks:[],load:[],productionBackupValidated:false};
function run(binary,args,input,cluster,db='postgres') {
 const env={...cleanEnv,PGHOST:cluster.socket,PGPORT:'55441',PGUSER:'postgres',PGDATABASE:db,PGPASSWORD:''};
 const result=spawnSync(binary,args,{cwd:root,env,input,encoding:'utf8',maxBuffer:16*1024*1024,timeout:120000});
 if(result.error||result.status!==0) throw new Error(`${binary}: ${result.error?.message||result.stderr||result.stdout}`);
 return result.stdout;
}
function sql(text,cluster,db='source') {return run('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1'],text,cluster,db).trim();}
function makeCluster(name) {
 const base=join(temp,name); mkdirSync(base); const cluster={data:join(base,'data'),socket:join(base,'socket'),started:false};mkdirSync(cluster.socket);clusters.push(cluster);
 run('initdb',['-D',cluster.data,'--username=postgres','--auth=trust','--no-locale','--encoding=UTF8'],undefined,cluster);
 appendFileSync(join(cluster.data,'postgresql.conf'),`\nlisten_addresses = ''\nunix_socket_directories = '${cluster.socket.replaceAll("'","''")}'\nport = 55441\nstatement_timeout = '20s'\n`);
 run('pg_ctl',['-D',cluster.data,'-l',join(base,'server.log'),'-w','-t','20','start'],undefined,cluster);cluster.started=true;
 return cluster;
}
function assert(ok,label) {if(!ok)throw new Error(label); report.checks.push({label,passed:true});console.log(`PASS ${label}`);}
function ident(value){return '"'+value.replaceAll('"','""')+'"';}
const schemaFilter="n.nspname IN ('public','auth','storage','test_support')";
function snapshot(cluster,db) {
 const tableNames=JSON.parse(sql(`SELECT coalesce(jsonb_agg(jsonb_build_array(n.nspname,c.relname) ORDER BY n.nspname,c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${schemaFilter} AND c.relkind IN('r','p');`,cluster,db));
 const rows={};for(const [schema,name] of tableNames)rows[schema+'.'+name]=JSON.parse(sql(`SELECT jsonb_build_object('rows',count(*),'digest',md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),''))) FROM ${ident(schema)}.${ident(name)} t;`,cluster,db));
 const definitions=JSON.parse(sql(`SELECT jsonb_build_object(
 'schemas',(SELECT jsonb_agg(jsonb_build_object('name',n.nspname,'owner',pg_get_userbyid(n.nspowner)) ORDER BY n.nspname) FROM pg_namespace n WHERE ${schemaFilter}),
 'relations',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${schemaFilter} AND c.relkind IN('r','p','v','S')),
 'columns',(SELECT jsonb_agg(jsonb_build_object('table',c.oid::regclass::text,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'generated',a.attgenerated) ORDER BY n.nspname,c.relname,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE ${schemaFilter} AND c.relkind IN('r','p') AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('table',c.oid::regclass::text,'name',x.conname,'definition',pg_get_constraintdef(x.oid)) ORDER BY n.nspname,c.relname,x.conname) FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${schemaFilter}),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.schemaname,p.tablename,p.policyname) FROM pg_policies p WHERE p.schemaname IN('public','auth','storage','test_support')),
 'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'definition',pg_get_functiondef(p.oid)) ORDER BY n.nspname,p.oid::regprocedure::text) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE ${schemaFilter}),
 'views',(SELECT jsonb_agg(jsonb_build_object('name',c.oid::regclass::text,'definition',pg_get_viewdef(c.oid),'options',c.reloptions) ORDER BY c.oid::regclass::text) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${schemaFilter} AND c.relkind='v'),
 'indexes',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.schemaname,i.tablename,i.indexname) FROM pg_indexes i WHERE i.schemaname IN('public','auth','storage','test_support')),
 'triggers',(SELECT jsonb_agg(pg_get_triggerdef(t.oid) ORDER BY n.nspname,c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${schemaFilter} AND NOT t.tgisinternal),
 'roles',(SELECT jsonb_agg(jsonb_build_object('name',rolname,'super',rolsuper,'bypass_rls',rolbypassrls,'inherit',rolinherit,'login',rolcanlogin) ORDER BY rolname) FROM pg_roles WHERE rolname IN('postgres','anon','authenticated','service_role'))
 );`,cluster,db));
 const permissions=JSON.parse(sql(`WITH privileges AS (
 SELECT 'schema' AS kind,n.nspname AS object,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE ${schemaFilter}
 UNION ALL SELECT 'relation',n.nspname||'.'||c.relname,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,a.privilege_type,a.is_grantable FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 's'::"char" ELSE 'r'::"char" END,c.relowner))) a WHERE ${schemaFilter} AND c.relkind IN('r','p','v','S')
 UNION ALL SELECT 'function',p.oid::regprocedure::text,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,a.privilege_type,a.is_grantable FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE ${schemaFilter}
 ) SELECT jsonb_agg(to_jsonb(x) ORDER BY kind,object,grantee,privilege_type,is_grantable) FROM privileges x;`,cluster,db));
 return {rows,definitions,permissions};
}
function equal(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function bench(cluster,name,transactionsPerClient) {
 const prefix=join(temp,`bench-${name}`);const started=performance.now();
 const summary=run('pgbench',['-n','-M','prepared','-c','16','-j','4','-t',String(transactionsPerClient),'-f',join(fixtures,'resilience',name+'.sql'),'-l','--log-prefix',prefix,'--random-seed=20260925','--exit-on-abort','--failures-detailed','source'],undefined,cluster,'source');
 const elapsedMs=performance.now()-started;
 const logFiles=readdirSync(temp).filter(file=>file.startsWith(`bench-${name}.`));
 const latencies=logFiles.flatMap(file=>readFileSync(join(temp,file),'utf8').trim().split('\n').filter(Boolean).map(line=>Number(line.trim().split(/\s+/)[2])/1000)).sort((a,b)=>a-b);
 const expected=16*transactionsPerClient;
 assert(latencies.length===expected&&latencies.every(Number.isFinite),`${name}: ${expected} transactions completed without aborted log rows`);
 assert(/number of failed transactions:\s+0\b/.test(summary),`${name}: zero failed transactions`);
 const percentile=p=>latencies[Math.max(0,Math.ceil(latencies.length*p)-1)];
 const result={name,clients:16,transactions:expected,elapsedMs:Number(elapsedMs.toFixed(1)),p50Ms:percentile(.5),p95Ms:percentile(.95),maxMs:latencies.at(-1),transactionsPerSecond:Number(summary.match(/tps = ([\d.]+)/)?.[1]||0),failedTransactions:0};
 report.load.push(result);console.log(JSON.stringify(result));
}
try {
 const stub={socket:join(temp,'unused')}; report.postgresVersion=run('initdb',['--version'],undefined,stub).trim();
 if(!/PostgreSQL\) 17\./.test(report.postgresVersion))throw new Error('PostgreSQL 17 is required');
 const source=makeCluster('source');sql('CREATE DATABASE source;',source,'postgres');
 sql('CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN BYPASSRLS;',source,'postgres');
 sql(readFileSync(join(fixtures,'supabase-stubs.sql'),'utf8'),source);
 sql(readFileSync(join(root,'supabase/baseline.sql'),'utf8'),source);
 sql(readFileSync(join(fixtures,'fixtures.sql'),'utf8'),source);
 const migrations=readdirSync(join(root,'supabase/migrations')).filter(name=>name.endsWith('.sql')).sort();
 report.migrations=migrations.map(name=>({name,sha256:createHash('sha256').update(readFileSync(join(root,'supabase/migrations',name))).digest('hex')}));
 for(const migration of migrations)sql('BEGIN;\n'+readFileSync(join(root,'supabase/migrations',migration),'utf8')+'\nCOMMIT;',source);
 sql(readFileSync(join(fixtures,'resilience/load-fixtures.sql'),'utf8'),source);
 report.durability=JSON.parse(sql("SELECT jsonb_build_object('fsync',current_setting('fsync'),'synchronous_commit',current_setting('synchronous_commit'));",source));
 const before=snapshot(source,'source'); report.dataset=before.rows;
 const dump=join(temp,'snapshot.dump');const backupStart=performance.now();
 const globals=run('pg_dumpall',['--globals-only','--no-role-passwords'],undefined,source);
 run('pg_dump',['--format=custom','--file',dump,'source'],undefined,source,'source');
 report.backup={durationMs:Number((performance.now()-backupStart).toFixed(1)),bytes:statSync(dump).size,sourceQuiescentDuringSnapshot:true};
 const backupCompleted=performance.now();
 sql("INSERT INTO public.reviews(id,user_id,nickname,school,rating,content,status) VALUES('40000000-0000-4000-8000-000000000099','90000000-0000-4000-8000-000000000001','Synthetic after backup','강원대',4,'Known post-backup test row','pending');",source);
 const restoreStart=performance.now(); const restore=makeCluster('restore');
 sql(globals.replace(/^CREATE ROLE postgres;\s*$/m,''),restore,'postgres');
 sql('CREATE DATABASE restored;',restore,'postgres');
 run('pg_restore',['--exit-on-error','--dbname=restored',dump],undefined,restore,'restored');
 const restored=snapshot(restore,'restored');
 assert(equal(before.rows,restored.rows),'restore reproduces all table row counts and content digests');
 assert(equal(before.definitions,restored.definitions),'restore preserves functions views policies triggers indexes owners and roles');
 assert(equal(before.permissions,restored.permissions),'restore preserves every normalized schema table sequence and function ACL');
 assert(sql("SELECT count(*) FROM public.reviews WHERE id='40000000-0000-4000-8000-000000000099';",restore,'restored')==='0','snapshot correctly excludes the known post-backup write');
 const restoredSafety=JSON.parse(sql("BEGIN READ ONLY;SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true) IS NOT NULL;SET LOCAL ROLE authenticated;SELECT jsonb_build_object('own_profile',(SELECT count(*) FROM public.profiles WHERE id=auth.uid()),'foreign_profiles',(SELECT count(*) FROM public.profiles WHERE id<>auth.uid()),'purge_execute',has_function_privilege(current_user,'public.purge_user_content(uuid)','execute'),'roster_update',has_table_privilege(current_user,'public.team_members_public','update'));ROLLBACK;",restore,'restored').split('\n').at(-1));
 assert(restoredSafety.own_profile===1&&restoredSafety.foreign_profiles===0&&!restoredSafety.purge_execute&&!restoredSafety.roster_update,'restored database retains real ordinary-user isolation and blocked privileged writes');
 report.recovery={localMeasuredRestoreAndVerificationMs:Number((performance.now()-restoreStart).toFixed(1)),backupAgeAtSimulatedFailureMs:Number((restoreStart-backupCompleted).toFixed(1)),knownCommittedRowsAfterSnapshotNotRecovered:1,scope:'Clean native cluster reconstruction plus roles, pg_restore and verification; excludes real incident detection, infrastructure provisioning, hosted backups/PITR, and Storage object bytes. This is not a production RTO/RPO guarantee.'};
 for(const [name,transactions] of [['home-read',20],['team-write',10],['team-contention',10]])bench(source,name,transactions);
 const consistency=JSON.parse(sql("SELECT jsonb_build_object('load_teams',(SELECT count(*) FROM public.teams WHERE id::text LIKE '91000000-%'),'load_members',(SELECT count(*) FROM public.team_members WHERE team_id::text LIKE '91000000-%'),'roster_mismatches',(SELECT count(*) FROM public.teams t WHERE t.id::text LIKE '91000000-%' AND (SELECT count(*) FROM public.team_members m WHERE m.team_id=t.id)<>t.team_size),'torn_edits',(SELECT count(*) FROM public.team_members m JOIN public.teams t ON t.id=m.team_id WHERE t.id::text LIKE '91000000-%' AND t.intro LIKE 'Edit %' AND m.nickname<>t.intro),'duplicate_open_owners',(SELECT count(*) FROM (SELECT owner_id FROM public.teams WHERE status IN('active','matched') GROUP BY owner_id HAVING count(*)>1) s));",source));
 assert(consistency.load_teams===200&&consistency.load_members===400&&consistency.roster_mismatches===0&&consistency.torn_edits===0&&consistency.duplicate_open_owners===0,'load leaves all teams complete with no torn roster edits or duplicate open teams');report.loadConsistency=consistency;
 report.passed=true;
} catch(error) {report.passed=false;report.error=error.message;console.error(error.message);process.exitCode=1;}
finally {
 for(const cluster of clusters.reverse())if(cluster.started){try{run('pg_ctl',['-D',cluster.data,'-m','immediate','-w','-t','20','stop'],undefined,cluster);}catch(error){console.error(error.message);process.exitCode=1;}}
 report.finishedAt=new Date().toISOString();mkdirSync(dirname(reportPath),{recursive:true});writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');rmSync(temp,{recursive:true,force:true});console.log(`Report: ${reportPath}`);
}
