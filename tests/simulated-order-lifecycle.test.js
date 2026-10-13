import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHmac} from 'node:crypto';
import {spawn} from 'node:child_process';

const ports={stripe:36911,mail:36912,shop:36913};
const offers={toolkit:{id:'cs_test_toolkit1234',price:'price_testtoolkit',amount:2900},audit:{id:'cs_test_audit1234',price:'price_testaudit',amount:14900}};
const sessions=new Map();
const sent=[];
let app;
const postal=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body))};
const stripeServer=createServer(async(req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1'),p=u.pathname;
 if(req.method==='POST'&&p==='/checkout/sessions'){
  const chunks=[];for await(const c of req)chunks.push(c);
  const f=new URLSearchParams(Buffer.concat(chunks).toString()),offer=f.get('metadata[offer]');
  if(!offers[offer])return postal(res,400,{error:'offer'});
  const d=offers[offer];
  if(f.get('line_items[0][price]')!==d.price)return postal(res,400,{error:'price'});
  sessions.set(d.id,{id:d.id,mode:'payment',payment_status:'paid',metadata:{store:'ai-admin-accelerator',offer},amount_total:d.amount,currency:'gbp',customer_details:{email:'buyer@example.test'}});
  return postal(res,200,{id:d.id,url:'https://checkout.stripe.com/pay/test-not-a-live-payment'});
 }
 const m=p.match(/^\/checkout\/sessions\/(cs_test_[A-Za-z0-9]+)(?:\/line_items)?$/);
 if(!m||!sessions.has(m[1]))return postal(res,404,{error:'Not found'});
 const session=sessions.get(m[1]), d=offers[session.metadata.offer];
 if(p.endsWith('/line_items')&&req.method==='GET')return postal(res,200,{data:[{price:{id:d.price},quantity:1}]});
 if(req.method==='GET')return postal(res,200,session);
 if(req.method==='POST'){
  const chunks=[];for await(const c of req)chunks.push(c);
  const f=new URLSearchParams(Buffer.concat(chunks).toString());
  for(const [key,value] of f.entries()){const meta=key.match(/^metadata\[([a-z_]+)\]$/);if(meta)session.metadata[meta[1]]=value}
  return postal(res,200,session);
 }
 return postal(res,405,{error:'Method not allowed'});
});
const mailServer=createServer(async(req,res)=>{
 if(req.method!=='POST'||!req.url?.endsWith('/messages/send'))return postal(res,404,{error:'Not found'});
 if(req.headers.authorization!=='Bearer am_test_mock_key')return postal(res,403,{error:'Invalid mock key'});
 const chunks=[];for await(const c of req)chunks.push(c);
 const b=JSON.parse(Buffer.concat(chunks).toString());sent.push(b);
 return postal(res,200,{message_id:'mock_'+sent.length,thread_id:'mock_thread_'+sent.length});
});
const listen=(server,port)=>new Promise((resolve,reject)=>server.listen(port,'127.0.0.1',e=>e?reject(e):resolve()));
const setup=Promise.all([listen(stripeServer,ports.stripe),listen(mailServer,ports.mail)]).then(()=>{
 app=spawn(process.execPath,['server.js'],{env:{
 ...process.env,NODE_ENV:'test',DEPLOYMENT_STAGE:'qa',PORT:String(ports.shop),
 STRIPE_SECRET_KEY:'sk_test_mock_only',
 STRIPE_WEBHOOK_SECRET:'whsec_test_demo',
 STRIPE_PRICE_TOOLKIT:offers.toolkit.price,
 STRIPE_PRICE_REVIEW:offers.audit.price,
 TEST_STRIPE_BASE:'http://127.0.0.1:'+ports.stripe,
 AGENTMAIL_API_KEY:'am_test_mock_key',
 AGENTMAIL_INBOX:'aiadminaccelerator@agentmail.to',
 TEST_AGENTMAIL_BASE:'http://127.0.0.1:'+ports.mail,
 OWNER_EMAIL:'aiadminaccelerator@agentmail.to',
 PUBLIC_CONTACT_EMAIL:'aiadminaccelerator@agentmail.to',
 PUBLIC_SELLER_LEGAL_NAME:'Example Test Trader Ltd',
 PUBLIC_SELLER_POSTAL_ADDRESS:'11 Example Testing Road, London W1A 1AA',
 RESEND_API_KEY:'',RESEND_FROM_EMAIL:'',
 TOOLKIT_BASE64:Buffer.concat([Buffer.from('PK'),Buffer.alloc(500,65)]).toString('base64'),
 LIVE_SALES_ENABLED:'true',LEGAL_READY:'true',FULFILMENT_TESTED:'true'
 },stdio:'ignore'});
});
after(async()=>{
 if(app)app.kill();
 await Promise.all([new Promise(r=>stripeServer.close(r)),new Promise(r=>mailServer.close(r))]);
});
async function api(route,options){
 await setup;
 for(let k=0;k<40;k++){try{return await fetch('http://127.0.0.1:'+ports.shop+route,options)}catch{await new Promise(r=>setTimeout(r,100))}}
 throw new Error('Simulated shop failed to start');
}
const checkout=offer=>api('/api/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({offer,consent:true})});
async function webhook(id,signatureValid=true){
 const raw=JSON.stringify({id:'evt_mock'+id,type:'checkout.session.completed',data:{object:{id}}});
 const t=Math.floor(Date.now()/1000);
 const sig=createHmac('sha256','whsec_test_demo').update(t+'.'+raw).digest('hex');
 return api('/api/stripe-webhook',{method:'POST',headers:{'stripe-signature':'t='+t+',v1='+(signatureValid?sig:'0'.repeat(64))},body:raw});
}
test('locally simulated checkout creates a session with a server-selected price',async()=>{
 const config=await (await api('/api/config')).json();assert.equal(config.checkoutReady,true);
 const r=await checkout('toolkit');assert.equal(r.status,200);
 const b=await r.json();assert.match(b.url,/checkout\.stripe\.com\/pay/);
 assert.equal(sessions.get(offers.toolkit.id).amount_total,2900);
});
test('invalid webhook signature is rejected without email',async()=>{
 const before=sent.length,r=await webhook(offers.toolkit.id,false);
 assert.equal(r.status,400);assert.equal(sent.length,before);
});
test('valid paid toolkit webhook emails buyer and validates order against line items',async()=>{
 const r=await webhook(offers.toolkit.id,true);
 assert.equal(r.status,200);assert.equal(sent.length,1);
 assert.deepEqual(sent[0].to,['buyer@example.test']);
 assert.match(sent[0].subject,/Toolkit/);
 assert.match(sent[0].html,/Example Test Trader Ltd/);
 assert.match(sent[0].html,/£29\.00/);
 assert.match(sent[0].html,/cancellation\.html/);
 assert.equal(sessions.get(offers.toolkit.id).metadata.fulfilment_email_sent,'yes');
});
test('simulated paid toolkit can download and unpaid/unknown session cannot',async()=>{
 const r=await api('/api/download?session_id='+offers.toolkit.id);
 assert.equal(r.status,200);
 assert.equal(r.headers.get('content-type'),'application/zip');
 assert.equal((await r.arrayBuffer()).byteLength,502);
 const no=await api('/api/download?session_id=cs_test_fakeunpaid');
 assert.notEqual(no.status,200);
});
test('review webhook sends buyer and owner notifications then accepts intake once',async()=>{
 const r=await checkout('audit');assert.equal(r.status,200);
 const before=sent.length;
 const webhookResult=await webhook(offers.audit.id);assert.equal(webhookResult.status,200);
 assert.equal(sent.length,before+2);
 const intake=await api('/api/intake',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
 session_id:offers.audit.id,business:'Example & Co',sector:'Services',tasks:'We routinely have to manually write weekly customer status emails.',tools:'Email',goal:'Reduce drafting time with reviews'
 })});
 assert.equal(intake.status,200);assert.equal(sent.length,before+3);
 assert.match(sent.at(-1).html,/Example &amp; Co/);
 const again=await api('/api/intake',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
 session_id:offers.audit.id,business:'Example',tasks:'This is the second intake example with enough text.',goal:'Should not be accepted again'
 })});
 assert.equal(again.status,409);
});
