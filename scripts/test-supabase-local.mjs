#!/usr/bin/env node
/** Opt-in real local Auth/PostgREST/Storage integration. Downloads Docker images on first use. */
import { mkdtempSync,mkdirSync,readFileSync,writeFileSync,readdirSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve,join,dirname,basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomBytes,createHmac } from 'node:crypto';
import { createCleanupHandler } from '../supabase/functions/cleanup-member-photos/handler.mjs';
import { cleanupMemberPhotos } from './cleanup-member-photos.mjs';
import { createClient } from '@supabase/supabase-js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const supplied=process.argv[2];
const workdir=supplied?resolve(supplied):mkdtempSync(join(tmpdir(),'cc-supa-quality-'));
if(!/^cc-supa-quality[.-]/.test(basename(workdir)))throw new Error('Only a dedicated cc-supa-quality temporary directory is allowed');
const reportPath=join(resolve(root,process.env.CC_VALIDATION_REPORT_DIR||'supabase/.temp/validation'),'supabase-local.json');
const cli=['--yes','supabase@2.120.0'];
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('PG')&&!key.startsWith('SUPABASE_')));
const report={scope:'Fresh local Docker Supabase only, synthetic accounts and a one-pixel image; no hosted project access.',startedAt:new Date().toISOString(),cliVersion:'2.120.0',checks:[],productionValidated:false};
let projectId;let db;let cleanupRequired=false;
function run(bin,args,input,timeout=120000){const r=spawnSync(bin,args,{cwd:root,env,input,encoding:'utf8',timeout,maxBuffer:16*1024*1024});if(r.error||r.status!==0)throw new Error(`${bin} failed: ${r.error?.message||r.stderr.slice(-3000)||'nonzero exit'}`);return r.stdout;}
function command(args,timeout){return run('npx',[...cli,...args,'--workdir',workdir],undefined,timeout);}
function sql(query){if(!db||db.hostname!=='127.0.0.1'||db.port!=='55342')throw new Error('Database target is not the dedicated local test port');const r=spawnSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h',db.hostname,'-p',db.port,'-U',decodeURIComponent(db.username),'-d',db.pathname.slice(1)],{cwd:root,env:{...env,PGPASSWORD:decodeURIComponent(db.password)},input:query,encoding:'utf8',timeout:20000,maxBuffer:4*1024*1024});if(r.status!==0)throw new Error(`Local schema setup failed: ${r.stderr}`);return r.stdout.trim();}
function check(ok,label){if(!ok)throw new Error(label);report.checks.push({label,passed:true});console.log(`PASS ${label}`);}
function result(value,label){if(value.error)throw new Error(`${label}: ${value.error.message}`);return value.data;}
function totp(secret){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of secret.replace(/=+$/,''))bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const h=createHmac('sha1',Buffer.from(bytes)).update(counter).digest();const o=h.at(-1)&15;return String((h.readUInt32BE(o)&0x7fffffff)%1000000).padStart(6,'0');}
try{
 if(!supplied){command(['init']);let config=readFileSync(join(workdir,'supabase/config.toml'),'utf8');projectId='cc-quality-'+randomBytes(4).toString('hex');config=config.replace(/^project_id = .*$/m,`project_id = "${projectId}"`);for(const [a,b]of[[54321,55341],[54322,55342],[54320,55340],[54323,55343],[54324,55344],[54327,55347],[54329,55349]])config=config.replaceAll(String(a),String(b));for(const section of['realtime','studio','local_smtp','edge_runtime','analytics','storage.vector','storage.s3_protocol']){const start=config.indexOf('['+section+']');const next=config.indexOf('\n[',start+section.length+2);const end=next<0?config.length:next;config=config.slice(0,start)+config.slice(start,end).replace('enabled = true','enabled = false')+config.slice(end);}config=config.replace('[auth.mfa.totp]\nenroll_enabled = false\nverify_enabled = false','[auth.mfa.totp]\nenroll_enabled = true\nverify_enabled = true');writeFileSync(join(workdir,'supabase/config.toml'),config);cleanupRequired=true;console.log('Starting dedicated local Supabase services; first use downloads Docker images.');command(['start','-x','realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor'],900000);
 }else{projectId=readFileSync(join(workdir,'supabase/config.toml'),'utf8').match(/^project_id = "([^"]+)"/m)?.[1];if(!projectId?.startsWith('cc-quality-'))throw new Error('Refusing a non-test Supabase project');cleanupRequired=true;}
 report.projectId=projectId;
 const status=JSON.parse(command(['status','-o','json']));
 const api=status.API_URL??status.api?.url;const anon=status.ANON_KEY??status.anon_key??status.auth?.anon_key;const secret=status.SERVICE_ROLE_KEY??status.service_role_key??status.auth?.service_role_key;
 db=new URL(status.DB_URL??status.db?.url);
 if(api!=='http://127.0.0.1:55341'||!anon||!secret)throw new Error('Unexpected local API coordinates or missing local keys; refusing integration');
 const authOptions={persistSession:false,autoRefreshToken:false,detectSessionInUrl:false};
 const client=()=>createClient(api,anon,{auth:authOptions});const service=createClient(api,secret,{auth:authOptions});
 sql(readFileSync(join(root,'supabase/baseline.sql'),'utf8'));
 result(await service.storage.createBucket('student-ids',{public:false,fileSizeLimit:5242880,allowedMimeTypes:['image/png','image/jpeg','image/webp','image/heic','image/heif']}),'create synthetic student ID bucket');
 const migrations=readdirSync(join(root,'supabase/migrations')).filter(n=>n.endsWith('.sql')).sort();
 for(const migration of migrations)sql('BEGIN;\n'+readFileSync(join(root,'supabase/migrations',migration),'utf8')+'\nCOMMIT;');report.migrations=migrations;
 const runtimeSql=readFileSync(join(root,'supabase/operations/20261012010153_member_photo_cleanup_runtime.sql'),'utf8').replace('https://slddnhyvstfvobxxcazt.supabase.co/functions/v1/cleanup-member-photos','http://127.0.0.1:1/never-contact-hosted-projects');
 sql('BEGIN;'+runtimeSql+"SELECT cron.unschedule('member-photo-retention-hourly'); COMMIT;");
 let ready=false;for(let i=0;i<10;i++){const ping=await client().rpc('get_home_stats');if(!ping.error){ready=true;break;}await new Promise(r=>setTimeout(r,300));}check(ready,'fresh local schema is reachable through real PostgREST');
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD0QAAAAASUVORK5CYII=','base64');
 async function signup(name,gender,makeProfile=true){const c=client();const password='Synthetic!'+randomBytes(16).toString('hex');const signup=result(await c.auth.signUp({email:name+'@example.test',password,options:{data:{username:name,name:'Synthetic '+name}}}),'real Auth signup');check(Boolean(signup.session&&signup.user),'real Auth issues a signed session');const id=signup.user.id;const path=id+'/synthetic.png';result(await c.storage.from('student-ids').upload(path,png,{contentType:'image/png'}),'real student image upload');const profile={id,username:name,name:'Synthetic '+name,gender,school:'강원대',contact_type:'kakao',contact_id:'synthetic-'+name,student_id_image_path:path,student_number:'20260001',agreed_privacy:true,agreed_terms:true,agreed_disclaimer:true,terms_version:'v5.1',terms_agreed_at:new Date().toISOString()};if(makeProfile)result(await c.from('profiles').insert(profile),'profile creation after actual upload');return{c,id,path,profile,initialToken:signup.session.access_token};}
 const admin=await signup('qa_local_admin','male');const male=await signup('qa_local_male','male');const female=await signup('qa_local_female','female');const attacker=await signup('qa_local_probe','male',false);
 const escalation=await attacker.c.from('profiles').insert({...attacker.profile,role:'admin',is_verified:true,verification_status:'approved'});check(Boolean(escalation.error),'real signup request cannot self-assign admin or verified role');
 sql("UPDATE public.profiles SET role='admin',is_verified=true,verification_status='approved' WHERE username='qa_local_admin';");
 result(await admin.c.from('profiles').update({is_verified:true,verification_status:'approved'}).in('id',[male.id,female.id]),'admin approves real user profiles');
 check((await male.c.storage.from('student-ids').upload(male.path,png,{contentType:'image/png',upsert:true})).error!==null,'approved verification image replacement is denied by real Storage');
 check((await male.c.storage.from('student-ids').download(female.path)).error!==null,'real Storage denies another member image download');
 check(Boolean((await male.c.rpc('validate_account_deletion',{p_user_id:female.id})).error),'ordinary signed session cannot validate admin deletion');
 const enrolled=result(await admin.c.auth.mfa.enroll({factorType:'totp',friendlyName:'Synthetic QA TOTP'}),'enroll real TOTP');
 result(await admin.c.auth.mfa.challengeAndVerify({factorId:enrolled.id,code:totp(enrolled.totp.secret)}),'verify real TOTP');
 const low=createClient(api,anon,{auth:authOptions,global:{headers:{Authorization:'Bearer '+admin.initialToken}}});
 check(Boolean((await low.rpc('validate_account_deletion',{p_user_id:male.id})).error),'verified-factor admin old AAL1 JWT is blocked at the database');
 result(await admin.c.rpc('validate_account_deletion',{p_user_id:male.id}),'AAL2 admin deletion preflight');check(true,'real TOTP AAL2 JWT restores admin access');
 const members=[1,2].map(n=>({school:'강원대',department:'Synthetic department',student_number:'20260001',nickname:'Synthetic member '+n,smoking:false,contact_type:'kakao',contact_id:'synthetic-contact-'+n,taste_tags:['cafe'],want_tags:['humor']}));
 async function makeTeam(user,intro){return result(await user.c.rpc('save_my_team',{p_team_id:null,p_intro:intro,p_team_size:2,p_members:members,p_members_consent_confirmed:true}),'atomic real API team creation');}
 const a=await makeTeam(male,'Synthetic male team');const b=await makeTeam(female,'Synthetic female team');check(Boolean(a.id&&b.id),'real authenticated RPC creates complete teams');
 const homes=result(await male.c.rpc('get_home_teams'),'home RPC');check(homes.length===1&&homes[0].id===b.id&&homes[0].members.length===2&&!('contact_id'in homes[0].members[0]),'real home response includes matching public roster without contacts');
 // Same-gender examples: real Auth/PostgREST projection and existing access boundaries.
 const exampleTeam=await makeTeam(admin,'Synthetic reference team');
 const examples=result(await male.c.rpc('get_same_gender_team_examples'),'same-gender examples');
 check(examples.length===1&&examples[0].id===exampleTeam.id,'real examples return only another same-gender team');
 check(Object.keys(examples[0]).sort().join(',')==='id,intro,members,owner_verified,team_size'&&Object.keys(examples[0].members[0]).sort().join(',')==='department,member_order,school,smoking,taste_tags,want_tags','real response omits owner identity photos names and contacts');
 check(Boolean((await client().rpc('get_same_gender_team_examples')).error),'anonymous example request denied');
 check(result(await male.c.from('team_members').select('*').eq('team_id',exampleTeam.id),'example private roster').length===0,'example does not grant contact table access');
 check(result(await male.c.rpc('get_member_photos',{p_team_id:exampleTeam.id}),'example photo RPC').length===0,'example does not grant photo access');
 check(Boolean((await male.c.from('match_requests').insert({from_team_id:a.id,to_team_id:exampleTeam.id})).error),'same-gender direct match request denied');
 result(await male.c.rpc('set_department_privacy',{p_enabled:true}),'example privacy on');
 check(result(await male.c.rpc('get_same_gender_team_examples'),'private examples').length===0,'viewer opt-in hides example');
 check(result(await admin.c.rpc('get_same_gender_team_examples'),'reverse private examples').length===0,'other side opt-in hides even in admin reference page');
 result(await male.c.rpc('set_department_privacy',{p_enabled:false}),'example privacy off');
 result(await admin.c.from('teams').update({status:'hidden'}).eq('id',exampleTeam.id),'hide synthetic reference team');
 check(result(await male.c.rpc('get_same_gender_team_examples'),'finished examples').length===0,'hidden reference team excluded');
 // Real PostgREST round trip for optional symmetric department privacy.
 result(await female.c.rpc('set_department_privacy',{p_enabled:true}),'enable department privacy');
 check(result(await male.c.rpc('get_home_teams'),'hidden home response').length===0,'one-sided preference hides opposite team');
 check(result(await female.c.rpc('get_home_teams'),'reverse hidden home response').length===0,'preference hides both directions');
 check(result(await male.c.from('teams').select('id').eq('id',b.id),'hidden direct team').length===0,'direct REST cannot bypass privacy');
 check(result(await male.c.from('team_members_public').select('*').eq('team_id',b.id),'hidden direct roster').length===0,'public roster cannot bypass privacy');
 check(Boolean((await male.c.from('match_requests').insert({from_team_id:a.id,to_team_id:b.id})).error),'hidden team cannot receive matching request');
 result(await female.c.rpc('set_department_privacy',{p_enabled:false}),'disable department privacy');
 check(result(await male.c.rpc('get_home_teams'),'restored home').length===1,'disable restores existing flow');
 const request=result(await male.c.from('match_requests').insert({from_team_id:a.id,to_team_id:b.id}).select('id').single(),'send actual matching request');
 result(await female.c.rpc('accept_match_request',{req_id:request.id}),'accept actual matching request');
 const teams=result(await female.c.from('teams').select('id,status').in('id',[a.id,b.id]),'read accepted teams');check(teams.length===2&&teams.every(t=>t.status==='matched'),'real request acceptance marks both teams matched');
 const roster=result(await female.c.from('team_members_public').select('*').eq('team_id',a.id),'read matched roster');check(roster.length===2&&roster.every(m=>!('contact_id'in m)&&m.student_number.length<=2),'matched counterpart roster is readable and masked');
 const privateRows=result(await female.c.from('team_members').select('id').eq('team_id',a.id),'private counterpart check');check(privateRows.length===0,'real RLS keeps matched counterpart private member records hidden');
 // Photo-first access runs through actual local Auth, Storage and PostgREST.
 const deferred=client();
 const deferredAuth=result(await deferred.auth.signUp({email:'qa_deferred@example.test',password:'Synthetic!'+randomBytes(16).toString('hex')}),'photo-free Auth signup');
 check(Boolean(deferredAuth.session),'photo-free signup immediately issues a real signed session');
 const deferredId=deferredAuth.user.id;
 check(Boolean((await deferred.from('profiles').insert({id:deferredId,username:'qa_deferred',name:'Synthetic deferred',gender:'female',school:'한림대',student_number:'20260001',contact_type:'kakao',contact_id:'synthetic-deferred',student_id_image_path:null,agreed_privacy:true,agreed_terms:true,agreed_disclaimer:true,terms_version:'v5.1',terms_agreed_at:new Date().toISOString()})).error),'real API rejects profile without photo');
 const deferredPath=deferredId+'/ordinary-image.png';
 result(await deferred.storage.from('student-ids').upload(deferredPath,png,{contentType:'image/png'}),'upload ordinary image without content verification');
 result(await deferred.from('profiles').insert({id:deferredId,username:'qa_deferred',name:'Synthetic deferred',gender:'female',school:'한림대',student_number:'20260001',contact_type:'kakao',contact_id:'synthetic-deferred',student_id_image_path:deferredPath,agreed_privacy:true,agreed_terms:true,agreed_disclaimer:true,terms_version:'v5.1',terms_agreed_at:new Date().toISOString()}),'profile with uploaded image');
 check(result(await deferred.rpc('can_participate',{uid:deferredId}),'pending eligibility'),'ordinary uploaded image grants initial participation without badge');
 const photoMembers = [...members, { ...members[0], nickname:'Third optional photo' }];
 const photoPaths=[];
 for (const member of photoMembers) {
   const photo=result(await deferred.rpc('reserve_member_photo',{p_consent:true}),'reserve real member photo');
   result(await deferred.storage.from('member-photos').upload(photo.path,readFileSync(join(root,'e2e/fixtures/member-photo.jpg')),{contentType:'image/jpeg',cacheControl:'0'}),'upload actual member photo');
   member.photo_id=photo.id; photoPaths.push(photo.path);
 }
 check(Boolean((await male.c.storage.from('member-photos').download(photoPaths[0])).error),'other user cannot download unattached photos');
 check(Boolean((await deferred.storage.from('member-photos').upload(deferredId+'/unreserved.jpg',png,{contentType:'image/jpeg'})).error),'unreserved path upload denied by real Storage');
 const args={p_team_id:null,p_intro:'Synthetic private draft',p_team_size:3,p_members:photoMembers,p_members_consent_confirmed:true};
 const draft=result(await deferred.rpc('save_my_team_draft',args),'real private draft save');
 check(Boolean(draft.id)&&draft.members.length===3,'pending account saves draft through real authenticated API');
 const owned=result(await deferred.from('team_drafts').select('*'),'reload private draft');check(owned.length===1,'real RLS lets owner reload private draft');
 check(result(await male.c.from('team_drafts').select('*'),'foreign draft isolation').length===0,'real RLS hides draft contacts from other members');
 check(Boolean((await deferred.from('profiles').update({is_verified:true,verification_status:'approved'}).eq('id',deferredId)).error),'real API denies self-approval');
 check(result(await male.c.rpc('get_home_teams'),'pre-publish browsing').every(t=>t.owner_id!==deferredId),'private draft is not public');
 const published=result(await deferred.rpc('publish_my_team_draft',{p_draft_id:draft.id}),'publish pending draft');
 check(Boolean(published.id)&&result(await deferred.from('team_drafts').select('*'),'draft after publish').length===0,'pending real API publishes atomically and removes draft');
 const deferredHome=result(await male.c.rpc('get_home_teams'),'post-publish browsing');check(deferredHome.some(t=>t.id===published.id&&!t.owner_verified&&t.members.length===3&&!('contact_id' in t.members[0])),'pending published team appears without badge and with contact-free roster');
 check(result(await male.c.from('team_members').select('*').eq('team_id',published.id),'private published roster').length===0,'approval does not expose member contacts to another user');
 const visiblePhotos=result(await male.c.rpc('get_member_photos',{p_team_id:published.id}),'public photo references');
 check(visiblePhotos.length===3,'published team exposes exactly one optional photo per member');
 check(result(await male.c.from('member_photos').select('*'),'private archive isolation').length===0,'public viewer cannot read photo student-number snapshots');
 for (const photo of visiblePhotos) result(await male.c.storage.from('member-photos').download(photo.path),'authorized real photo download');
 check(true,'all three photos downloadable through authenticated Storage');
 result(await deferred.rpc('set_department_privacy',{p_enabled:true}),'photo owner enables department privacy');
 check(result(await male.c.rpc('get_member_photos',{p_team_id:published.id}),'hidden photo references').length===0,'privacy removes photo references through real RPC');
 for(const photo of visiblePhotos) check(Boolean((await male.c.storage.from('member-photos').download(photo.path)).error),'privacy denies known real Storage photo path');
 result(await admin.c.storage.from('member-photos').download(visiblePhotos[0].path),'admin retains real photo moderation');
 result(await deferred.rpc('set_department_privacy',{p_enabled:false}),'photo owner disables privacy');
 result(await male.c.storage.from('member-photos').download(visiblePhotos[0].path),'privacy opt-out restores authorized photo download');
 check(result(await low.from('member_photos').select('*'),'archive MFA isolation').length===0,'AAL1 administrator cannot inspect photo archive');
 check(result(await admin.c.from('member_photos').select('*'),'admin archive').length===3,'AAL2 administrator can inspect all photo snapshots');
 result(await admin.c.from('profiles').update({is_verified:false,verification_status:'rejected'}).eq('id',deferredId),'revoke deferred verification');
 check(Boolean((await male.c.storage.from('member-photos').download(photoPaths[0])).error),'revocation immediately denies new photo downloads');
 check(result(await deferred.rpc('get_home_teams'),'rejected browsing').length===0,'rejection blocks browsing with existing JWT');
 check(Boolean((await deferred.rpc('save_my_team',{...args,p_team_id:published.id})).error),'rejected owner cannot edit team');
 check(Boolean((await deferred.storage.from('member-photos').download(visiblePhotos[0].path)).error),'rejected owner cannot download public member photos');
 const retryPath=deferredId+'/retry.png';
 result(await deferred.storage.from('student-ids').upload(retryPath,png,{contentType:'image/png'}),'restricted user can upload correction');
 result(await deferred.rpc('submit_student_id',{p_path:retryPath}),'restricted user can resubmit');
 const resubmitted=result(await deferred.from('profiles').select('verification_status,verification_restricted,is_verified').single(),'read own restricted status');
 check(resubmitted.verification_status==='pending'&&resubmitted.verification_restricted&&!resubmitted.is_verified,'resubmitted account remains restricted and unverified');
 check(Boolean((await deferred.from('profiles').update({verification_restricted:false}).eq('id',deferredId)).error),'cannot clear restriction through direct REST');
 check(!result(await deferred.rpc('can_participate',{uid:deferredId}),'restricted eligibility'),'resubmission does not unlock participation');
 check(Boolean((await male.c.storage.from('member-photos').download(photoPaths[0])).error),'resubmission does not expose team photos');
 result(await admin.c.from('profiles').update({is_verified:true,verification_status:'approved'}).eq('id',deferredId),'approve corrected photo');
 check(result(await deferred.rpc('can_participate',{uid:deferredId}),'restored eligibility'),'approval restores access');
 check(result(await male.c.rpc('get_home_teams'),'approved badge').some(t=>t.id===published.id&&t.owner_verified),'approval adds visible verified badge');
 result(await male.c.storage.from('member-photos').download(photoPaths[0]),'approval restores actual photo access');
 result(await deferred.from('teams').delete().eq('id',published.id),'delete synthetic photo team');
 const archived=result(await admin.c.from('member_photos').select('*'),'archive survives team deletion');
 check(archived.length===3&&archived.every(p=>p.archived_at&&p.expires_at),'team deletion retains three administrator-only archive records');
 check(Boolean((await deferred.storage.from('member-photos').download(photoPaths[0])).error),'deleted team photos hidden even from original owner');
 result(await admin.c.storage.from('member-photos').download(photoPaths[0]),'admin reads deleted-team archive');
 result(await admin.c.rpc('request_member_photo_deletion',{p_id:archived[0].id}),'admin photo deletion request');
 check(Boolean((await admin.c.storage.from('member-photos').download(photoPaths[0])).error),'deletion request immediately blocks new archive downloads');
 sql("UPDATE public.member_photos SET expires_at=now()-interval '1 second';");
 const scheduler=createCleanupHandler(service);
 check((await scheduler(new Request('http://local.test',{method:'POST',headers:{authorization:'Bearer '+'0'.repeat(64)}}))).status===401,'real Vault rejects invalid scheduler token');
 check(Boolean((await deferred.rpc('authorize_member_photo_cleanup',{p_token:'0'.repeat(64)})).error),'ordinary user cannot call scheduler authentication RPC');
 const schedulerToken=sql("SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='member_photo_cleanup_token';");
 const cleanupResponse=await scheduler(new Request('http://local.test',{method:'POST',headers:{authorization:'Bearer '+schedulerToken}}));
 check(cleanupResponse.status===200,'real Vault authorizes scheduler and worker completes');
 const cleanup=await cleanupResponse.json();
 check(cleanup.complete&&cleanup.removed===3,'real hourly cleanup removes all expired Storage bytes and metadata');
 check(result(await service.storage.from('member-photos').list(deferredId),'remaining expired files').length===0,'expired photos physically removed from real Storage');
 check(result(await service.from('member_photos').select('id'),'remaining expired records').length===0,'expired photo metadata removed after Storage succeeds');
 check(result(await male.c.rpc('get_home_teams'),'revoked team browsing').every(t=>t.id!==published.id),'rejected team disappears from real home API');
 check(Boolean((await client().rpc('purge_user_content',{p_uid:male.id})).error),'anonymous real RPC purge is denied');
 check(Boolean((await admin.c.rpc('validate_account_deletion',{p_user_id:admin.id})).error),'admin self-deletion preflight is denied before files are touched');
 result(await admin.c.storage.from('student-ids').remove([male.path]),'delete synthetic student image through actual Storage service');
 result(await admin.c.rpc('admin_delete_user',{p_uid:male.id}),'admin purge after real file removal');
 const deleted=result(await admin.c.from('profiles').select('status,contact_id,student_id_image_path').eq('id',male.id).single(),'verify anonymized local profile');check(deleted.status==='deleted'&&deleted.contact_id===''&&deleted.student_id_image_path===null,'real admin deletion anonymizes profile after file removal');
 const remaining=result(await service.storage.from('student-ids').list(male.id),'verify actual Storage object removal');check(remaining.length===0,'student image is removed through actual Storage API');
 const authUser=result(await service.auth.admin.getUserById(male.id),'verify retained synthetic Auth account');check(authUser.user&&!('name'in authUser.user.user_metadata)&&authUser.user.user_metadata.username==='qa_local_male','Auth account remains while deleted member name is cleared');
 check(Boolean((await male.c.rpc('save_my_team',{p_team_id:null,p_intro:'Withdrawn retry',p_team_size:2,p_members:members,p_members_consent_confirmed:true})).error),'still-signed-in withdrawn member cannot create another team');
 report.passed=true;
}catch(error){report.passed=false;report.error=error.message;console.error(error.message);process.exitCode=1;}
finally{if(cleanupRequired&&projectId?.startsWith('cc-quality-')){try{command(['stop','--project-id',projectId,'--no-backup'],180000);report.cleanedUp=true;}catch(error){report.cleanedUp=false;report.cleanupError=error.message;console.error('Dedicated local stack cleanup failed');process.exitCode=1;}}report.finishedAt=new Date().toISOString();mkdirSync(dirname(reportPath),{recursive:true});writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');if(report.cleanedUp)rmSync(workdir,{recursive:true,force:true});console.log('Report: '+reportPath);}
