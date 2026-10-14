import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {createHmac} from 'node:crypto';
const emails=[];
const mailServer=createServer(async(req,res)=>{
 let buf=[];for await(const block of req)buf.push(block);
 if(req.method==='POST'&&req.url.endsWith('/messages/send')){
  emails.push(JSON.parse(Buffer.concat(buf).toString('utf8')));
  res.writeHead(200,{'content-type':'application/json'});return res.end('{"message_id":"test_send"}');
 }
 res.writeHead(404);res.end();
});
const mailReady=new Promise(resolve=>mailServer.listen(36932,'127.0.0.1',resolve));
const port=36931, secret='whsec_test_simulated', child=spawn(process.execPath,['server.js'],{
 env:{...process.env,PORT:String(port),NODE_ENV:'test',TEST_AGENTMAIL_BASE:'http://127.0.0.1:36932',DEPLOYMENT_STAGE:'production',STRIPE_SECRET_KEY:'',STRIPE_WEBHOOK_SECRET:'',
 STRIPE_PAYMENT_LINK_WEBHOOK_SECRET:secret,STRIPE_PAYMENT_LINK_TOOLKIT:'plink_live_mock_toolkit',
 STRIPE_PAYMENT_LINK_REVIEW:'plink_live_mock_audit',STRIPE_PAYMENT_URL_TOOLKIT:'https://buy.stripe.com/MOCKTOOLKIT',
 STRIPE_PAYMENT_URL_REVIEW:'https://buy.stripe.com/MOCKAUDIT',AGENTMAIL_API_KEY:'am_mock',
 AGENTMAIL_INBOX:'aiadminaccelerator@agentmail.to',OWNER_EMAIL:'aiadminaccelerator@agentmail.to',
 PUBLIC_CONTACT_EMAIL:'aiadminaccelerator@agentmail.to',PUBLIC_SELLER_LEGAL_NAME:'Example Test Trader',
 PUBLIC_SELLER_POSTAL_ADDRESS:'10 Example Street London W1A 1AA GB',
 TOOLKIT_BASE64:Buffer.concat([Buffer.from('PK'),Buffer.alloc(250,65)]).toString('base64'),
 PAYMENT_LINK_SALES_ENABLED:'true',LEGAL_READY:'true',FULFILMENT_TESTED:'true',LIVE_SALES_ENABLED:'false'
 },stdio:'ignore'
});
after(async()=>{child.kill(); await new Promise(done=>mailServer.close(done))});
async function req(p,opts){for(let i=0;i<40;i++){try{return await fetch('http://127.0.0.1:'+port+p,opts)}catch{await new Promise(r=>setTimeout(r,100))}}throw Error('Cannot start mocked payment link server')}
test('configured live payment link returns hosted checkout URL',async()=>{
 const h=await (await req('/api/health')).json();assert.equal(h.paymentLinkReady,true);
 const r=await req('/api/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({offer:'toolkit',consent:true})});
 assert.equal(r.status,200);assert.equal((await r.json()).url,'https://buy.stripe.com/MOCKTOOLKIT');
});
test('payment link webhook rejects unsigned and forged events',async()=>{
 const b=JSON.stringify({type:'checkout.session.completed',livemode:true,data:{object:{id:'cs_live_TEST'}}});
 const r=await req('/api/payment-link-webhook',{method:'POST',body:b});
 assert.equal(r.status,400);
 const t=Math.floor(Date.now()/1000),sig=createHmac('sha256',secret).update(t+'.'+b).digest('hex');
 const bad=await req('/api/payment-link-webhook',{method:'POST',headers:{'stripe-signature':'t='+t+',v1='+'0'.repeat(64)},body:b});
 assert.equal(bad.status,400);assert.notEqual(sig,'0'.repeat(64));
});

async function signedEvent(o,type='checkout.session.completed'){
 await mailReady;
 const evt={id:'evt_mock_'+o.id,type,livemode:true,data:{object:o}};
 const raw=JSON.stringify(evt),t=Math.floor(Date.now()/1000);
 const sig=createHmac('sha256',secret).update(t+'.'+raw).digest('hex');
 return req('/api/payment-link-webhook',{method:'POST',headers:{'stripe-signature':'t='+t+',v1='+sig},body:raw});
}
const paidOrder=(offer)=>({
 id:'cs_live_MOCK'+(offer==='toolkit'?'TOOLKIT':'REVIEW'),mode:'payment',payment_status:'paid',livemode:true,currency:'gbp',
 amount_total:offer==='toolkit'?2900:14900,payment_link:offer==='toolkit'?'plink_live_mock_toolkit':'plink_live_mock_audit',
 metadata:{store:'ai-admin-accelerator',offer,v:'1'},customer_details:{email:'testbuyer@example.org'},
 created:Math.floor(Date.now()/1000)
});
test('toolkit: signed paid event delivers zipped attachment and owner email, duplicate ignored',async()=>{
 const first=await signedEvent(paidOrder('toolkit'));assert.equal(first.status,200);assert.equal((await first.json()).result,'fulfilled');
 const buyer=emails.find(m=>m.to?.[0]==='testbuyer@example.org'&&m.subject.includes('Toolkit'));
 assert.ok(buyer);assert.equal(buyer.attachments?.length,1);
 assert.equal(buyer.attachments[0].filename,'AI_Admin_Accelerator_Toolkit.zip');
 assert.equal(Buffer.from(buyer.attachments[0].content,'base64').subarray(0,2).toString(),'PK');
 assert.match(buyer.html,/Example Test Trader/);assert.match(buyer.html,/£29.00/);
 assert.ok(emails.some(m=>m.to?.[0]==='aiadminaccelerator@agentmail.to'&&m.subject.includes('paid')));
 const n=emails.length,dup=await signedEvent(paidOrder('toolkit'));
 assert.equal((await dup.json()).result,'duplicate');assert.equal(emails.length,n);
});
test('review: signed paid event emails instructions to customer',async()=>{
 const r=await signedEvent(paidOrder('audit'));assert.equal(r.status,200);assert.equal((await r.json()).result,'fulfilled');
 const m=emails.find(x=>x.to?.[0]==='testbuyer@example.org'&&x.subject.includes('Workflow Review'));
 assert.ok(m);assert.match(m.html,/five UK working days/);
});
test('unpaid, wrong link and wrong amount are rejected without delivery',async()=>{
 const n=emails.length,o=paidOrder('toolkit');o.id='cs_live_UNPAID';o.payment_status='unpaid';
 assert.equal((await (await signedEvent(o)).json()).result,'ignored');
 const x=paidOrder('toolkit');x.id='cs_live_WRONGLINK';x.payment_link='plink_live_notours';
 assert.equal((await (await signedEvent(x)).json()).result,'ignored');
 const y=paidOrder('toolkit');y.id='cs_live_WRONGPRICE';y.amount_total=1;
 assert.equal((await (await signedEvent(y)).json()).result,'ignored');
 assert.equal(emails.length,n);
});
test('customer return page provides fulfilment and refund instructions',async()=>{
 const r=await req('/order-received.html');assert.equal(r.status,200);
 const t=await r.text();assert.match(t,/emailed|email attachment/);assert.match(t,/Cancellation rights/);
});
