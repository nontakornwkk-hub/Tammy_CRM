const {PGlite}=await import('../.tmp/transaction-verification/node_modules/@electric-sql/pglite/dist/index.js');
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const db=new PGlite();
const fixture=await readFile(new URL('./transaction-reversals.mjs',import.meta.url),'utf8');
await db.exec(fixture.match(/await db.exec\(`([\s\S]*?)`\);/)[1]);
await db.exec("alter role postgres bypassrls");
await db.exec("alter table members add status text default 'active'");
for(const name of ['20261003083711_transaction_reversals.sql','20261003083741_transaction_reversal_details.sql','20261003141506_game_platform.sql','20261004003000_game_actor_verification_permissions.sql','20261004004500_temporary_game_test_draws.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
const owner=randomUUID(),member=randomUUID(),other=randomUUID(),staff=randomUUID();
await db.query('insert into auth.users values($1,now()),($2,now()),($3,now())',[owner,other,staff]);
await db.query('insert into store_settings values($1,$2)',[owner,{}]);
await db.query("insert into members(id,owner_id,points,spending,level,updated_at)values($1,$2,1000,10000,'Gold',now())",[member,owner]);
await db.query("insert into team_accounts values($1,$2,true,now(),'staff')",[owner,staff]);
const prize=(kind='points',weight=50)=>({id:randomUUID(),title:kind,kind,image:'',color:'#1460de',points:5,discountType:'percent',discountValue:10,minSpend:100,maxDiscount:20,expiryMode:'hours',expiryHours:48,expiresAt:null,weight,stock:null,active:true});
let setup={program:{purchaseThreshold:500,earningEnabled:true},game:{key:'paw-wheel',engine:'wheel',name:'วงล้อ',difficulty:'easy',enabled:true,version:0,prizes:[prize(),prize('coupon')]}};
const save=async(actor=owner)=>{const result=await db.query('select save_crm_game($1,$2,$3) result',[owner,actor,setup]);setup.game.version=result.rows[0].result.version;};
const sale=async(amount)=>{const id=randomUUID();await db.query("insert into points_transactions(id,owner_id,member_id,sale_amount,points_delta,transaction_type)values($1,$2,$3,$4,10,'earn')",[id,owner,member,amount]);return id;};
const wallet=async()=>(await db.query('select balance,carry,spent from game_wallets where member_id=$1',[member])).rows[0];
const play=async(draw=0,id=randomUUID(),version=setup.game.version,key='paw-wheel')=>(await db.query('select play_crm_game($1,$2,$3,$4,$5,$6) result',[owner,member,key,id,version,draw])).rows[0].result;
await db.exec('alter role service_role bypassrls; grant select,insert,update,delete on all tables in schema public to service_role; grant usage on schema auth to service_role; revoke select on auth.users from service_role; set role service_role');
await sale(1000);assert.equal(await wallet(),undefined);await save();await assert.rejects(save(other),/FORBIDDEN/);
const first=await sale(350);await sale(200);assert.equal((await wallet()).balance,1);assert.equal(Number((await wallet()).carry),50);
const request=randomUUID();const p=await play(0,request);assert.equal(p.prize.points,5);assert.ok(!('weight' in p.prize));assert.ok(p.slots.every(p=>!('weight' in p)&&!('stock' in p)));assert.equal((await wallet()).balance,0);assert.equal((await wallet()).spent,1);assert.deepEqual(await play(999999999,request,999),p);await assert.rejects(play(),/NO_TICKETS/);
await db.query("select reverse_crm_transaction($1,$2,'points',$3,'cancel','ยกเลิกรายการทดสอบ')",[owner,owner,first]);assert.equal((await wallet()).balance,-1);assert.equal(Number((await wallet()).carry),200);await sale(300);assert.equal((await wallet()).balance,0);await sale(500);assert.equal((await wallet()).balance,1);
const coupon=await play(999999999);assert.equal(coupon.prize.kind,'coupon');const grant=(await db.query('select * from game_grants where id=$1',[coupon.grant_id])).rows[0];assert.equal(Math.round((new Date(grant.expires_at)-new Date(grant.created_at))/3600000),48);
const claim=(actor,amount)=>db.query('select redeem_game_grant($1,$2,$3,$4) result',[owner,actor,grant.qr_token,amount]);await assert.rejects(claim(other,100),/FORBIDDEN/);await assert.rejects(claim(owner,50),/MIN_SPEND/);assert.equal((await claim(staff,1000)).rows[0].result.discount,20);await assert.rejects(claim(owner,100),/ALREADY_USED/);
setup.game.prizes=[{...prize('item',100),stock:1},prize('points',0)];await save();await sale(1500);const oldVersion=setup.game.version;const item=await play();assert.equal(item.prize.kind,'item');assert.equal((await db.query('select version from crm_games')).rows[0].version,oldVersion+1);await assert.rejects(play(0,randomUUID(),oldVersion),/CONFIG_CHANGED/);await assert.rejects(save(),/CONFIG_CHANGED/);setup.game.version=oldVersion+1;await assert.rejects(play(),/PRIZES_EXHAUSTED/);
await db.query("update game_grants set expires_at=now()-interval '1 second' where id=$1",[item.grant_id]);const expired=(await db.query('select qr_token from game_grants where id=$1',[item.grant_id])).rows[0].qr_token;await assert.rejects(db.query('select redeem_game_grant($1,$2,$3)',[owner,owner,expired]),/GRANT_EXPIRED/);
await db.query("select save_game_program($1,$2,200,true,500,true)",[owner,owner]);setup.program.purchaseThreshold=200;setup.game.prizes=[prize(),prize()];await save();await sale(199);assert.equal(Number((await wallet()).carry),199);await sale(1);assert.equal(Number((await wallet()).carry),0);
// Reordering is persisted exactly, including each prize's metadata and color.
setup.game.prizes=[prize('points',10),prize('coupon',20),prize('item',30)];await save();
setup.game.prizes.reverse();await save();
const ordered=(await db.query('select prizes from crm_games where game_key=$1',['paw-wheel'])).rows[0].prizes;
assert.deepEqual(ordered,setup.game.prizes);
const orderMember=randomUUID();await db.query("insert into members(id,owner_id,points,spending,level,updated_at)values($1,$2,0,0,'Member',now())",[orderMember,owner]);await db.query('insert into game_wallets(owner_id,member_id,balance)values($1,$2,1)',[owner,orderMember]);
const orderPlay=(await db.query('select play_crm_game($1,$2,$3,$4,$5,$6) result',[owner,orderMember,'paw-wheel',randomUUID(),setup.game.version,0])).rows[0].result;
assert.deepEqual(orderPlay.slots.map(p=>p.id),setup.game.prizes.map(p=>p.id));
assert.deepEqual(orderPlay.slots.map(p=>p.color),setup.game.prizes.map(p=>p.color));
// Relative rates can total any positive amount; verify exact draw boundaries.
setup.game.prizes=[prize('points',1),prize('points',2)];await save();
const rateMember=randomUUID();await db.query("insert into members(id,owner_id,points,spending,level,updated_at)values($1,$2,0,0,'Member',now())",[rateMember,owner]);await db.query('insert into game_wallets(owner_id,member_id,balance)values($1,$2,4)',[owner,rateMember]);
for(const [draw,index]of [[0,0],[333333333,0],[333333334,1],[999999999,1]]){const drawn=(await db.query('select play_crm_game($1,$2,$3,$4,$5,$6) result',[owner,rateMember,'paw-wheel',randomUUID(),setup.game.version,draw])).rows[0].result;assert.equal(drawn.prize.id,setup.game.prizes[index].id);}
setup.game.prizes.forEach(p=>p.weight=0);await assert.rejects(save(),/INVALID_ODDS/);setup.game.prizes[0].weight=250.5;setup.game.prizes[1].weight=7.25;await save();
const toggle=(actor,version,enabled)=>db.query('select toggle_crm_game($1,$2,$3,$4,$5) result',[owner,actor,'paw-wheel',version,enabled]);
await assert.rejects(toggle(staff,setup.game.version,false),/FORBIDDEN/);
const paused=(await toggle(owner,setup.game.version,false)).rows[0].result;assert.equal(paused.enabled,false);await assert.rejects(play(0,randomUUID(),paused.version),/GAME_UNAVAILABLE/);await assert.rejects(toggle(owner,setup.game.version,true),/CONFIG_CHANGED/);const resumed=(await toggle(owner,paused.version,true)).rows[0].result;assert.equal(resumed.enabled,true);assert.equal(resumed.version,paused.version+1);
// Manual grants are idempotent, restricted to this store, and survive purchase reversals.
const ticketRequest=randomUUID();const give=(actor=owner,amount=3,target=member)=>db.query('select give_game_tickets($1,$2,$3,$4,$5,$6) result',[owner,actor,target,ticketRequest,amount,'กิจกรรมพิเศษ']);
const before=(await wallet()).balance;const given=(await give()).rows[0].result;assert.equal(given.balance,before+3);assert.equal((await give()).rows[0].result.balance,before+3);await assert.rejects(give(staff),/FORBIDDEN/);await assert.rejects(give(owner,4),/REQUEST_CONFLICT/);await assert.rejects(give(owner,0),/INVALID_CONFIG/);
const foreignMember=randomUUID();await db.query('insert into store_settings values($1,$2)',[other,{}]);await db.query("insert into members(id,owner_id,points,spending,level,updated_at)values($1,$2,0,0,'Member',now())",[foreignMember,other]);await assert.rejects(give(owner,3,foreignMember),/MEMBER_NOT_FOUND/);
const laterPurchase=await sale(200);const balanceBeforeCancel=(await wallet()).balance;await db.query("select reverse_crm_transaction($1,$2,'points',$3,'cancel','ทดสอบรักษาสิทธิ์ที่ให้เอง')",[owner,owner,laterPurchase]);assert.equal((await wallet()).balance,balanceBeforeCancel-1);assert.equal((await db.query('select sum(amount) total from game_manual_tickets where member_id=$1',[member])).rows[0].total,3);
await assert.rejects(db.query('select save_game_program($1,$2,300,true,500,true)',[owner,owner]),/CONFIG_CHANGED/);await assert.rejects(db.query('select save_game_program($1,$2,300,true,200,true)',[owner,staff]),/FORBIDDEN/);
await db.query('select save_game_program($1,$2,300,true,200,true)',[owner,owner]);setup.game.version=resumed.version;await save();assert.equal(Number((await db.query('select purchase_threshold from game_programs')).rows[0].purchase_threshold),300);
await db.exec('set role anon');await assert.rejects(db.query('select prizes from crm_games'),/permission denied/);await assert.rejects(db.query('select play_crm_game($1,$2,$3,$4,1,0)',[owner,member,'paw-wheel',randomUUID()]),/permission denied/);await db.exec('reset role');

// Cleanup removes history only; preserve wallets, points, grants, and replay protection.
await db.exec(await readFile(new URL('../supabase/migrations/20261003172834_game_history_cleanup.sql',import.meta.url),'utf8'));
const beforeCleanupWallet=await wallet();
const beforeCleanupPoints=(await db.query('select points from members where id=$1',[member])).rows[0].points;
const grantsBefore=(await db.query('select count(*)::int n from game_grants')).rows[0].n;
const cutoff=new Date(Date.now()+1000).toISOString();
// Fixture timestamps need a cutoff no later than the DB transaction clock.
const dbCutoff=(await db.query('select clock_timestamp() cutoff')).rows[0].cutoff;
const manifest=(await db.query("select count(*)::int n,md5(string_agg(id::text,',' order by id)) hash from game_plays where owner_id=$1 and created_at<$2",[owner,dbCutoff])).rows[0];
await assert.rejects(db.query('select clear_game_history($1,$2,null,$3,$4,$5)',[owner,staff,dbCutoff,manifest.n,manifest.hash]),/FORBIDDEN/);
await assert.rejects(db.query('select clear_game_history($1,$2,null,$3,$4,$5)',[owner,owner,dbCutoff,manifest.n,'wrong']),/ARCHIVE_CHANGED/);
assert.equal((await db.query('select clear_game_history($1,$2,null,$3,$4,$5) result',[owner,owner,dbCutoff,manifest.n,manifest.hash])).rows[0].result.deleted,manifest.n);
assert.deepEqual(await wallet(),beforeCleanupWallet);
assert.equal((await db.query('select points from members where id=$1',[member])).rows[0].points,beforeCleanupPoints);
assert.equal((await db.query('select count(*)::int n from game_grants')).rows[0].n,grantsBefore);
assert.equal((await db.query('select count(*)::int n from game_grants where play_id is not null')).rows[0].n,0);
await assert.rejects(play(0,request),/HISTORY_CLEARED/);
assert.deepEqual(await wallet(),beforeCleanupWallet);
await assert.rejects(db.query('select clear_game_history($1,$2,null,$3,$4,$5)',[owner,owner,dbCutoff,manifest.n,manifest.hash]),/ARCHIVE_CHANGED/);
await db.exec('set role anon');await assert.rejects(db.query('select * from private.game_history_receipts'),/permission denied/);await db.exec('reset role');
console.log('PASS cleanup: owner only, stale backup rejected, grants/wallet/points preserved, retries blocked, anonymous access blocked.');

const testMember=randomUUID(),testBatch=randomUUID(),testRequest=randomUUID();await db.query("insert into members(id,owner_id,points,spending,level,updated_at)values($1,$2,0,0,'Member',now())",[testMember,owner]);
const gameRow=(await db.query('select * from crm_games where owner_id=$1',[owner])).rows[0];setup.game.version=gameRow.version;setup.game.prizes=[{...prize('item',1),stock:1},prize('points',0)];await save();
const testDraw=(id=testRequest)=>db.query('select play_crm_game_test($1,$2,$3,$4,$5,0,$6,1) result',[owner,testMember,'paw-wheel',id,setup.game.version,testBatch]);
const awarded=(await testDraw()).rows[0].result;assert.equal(awarded.prize.kind,'item');assert.ok(awarded.grant_id);assert.equal((await db.query('select count(*)::int n from game_wallets where member_id=$1',[testMember])).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from game_manual_tickets where member_id=$1',[testMember])).rows[0].n,0);assert.equal((await db.query('select prizes from crm_games where owner_id=$1',[owner])).rows[0].prizes[0].stock,0);assert.equal((await testDraw()).rows[0].result.id,awarded.id);await assert.rejects(testDraw(randomUUID()),/NO_TICKETS/);
console.log('PASS temporary test: no persistent tickets/wallet, real grant and stock deduction, idempotency, limit enforced.');
console.log('PASS game DB: purchase carry, no retroactive tickets, idempotent draws, hidden weights, reversal/debt repayment, point reward, coupon expiry/minimum/cap, staff claims, stock/version conflicts, expiry, threshold changes, anonymous access blocked.');await db.close();
