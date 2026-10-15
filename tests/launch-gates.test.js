import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

const port=36872;
const child=spawn(process.execPath,['server.js'],{
 env:{
  ...process.env,PORT:String(port),
  STRIPE_SECRET_KEY:'sk_live_fake_not_a_valid_stripe_key',
  STRIPE_WEBHOOK_SECRET:'whsec_fake',
  STRIPE_PRICE_TOOLKIT:'price_fake_toolkit',
  STRIPE_PRICE_REVIEW:'price_fake_review',
  LIVE_SALES_ENABLED:'true',
  LEGAL_READY:'false',
  FULFILMENT_TESTED:'false',
  RESEND_API_KEY:'',
  TOOLKIT_BASE64:'',
  OWNER_EMAIL:'',
  RESEND_FROM_EMAIL:'',
  PUBLIC_CONTACT_EMAIL:''
 },stdio:'ignore'
});
after(()=>child.kill());
async function request(url,options){
 for(let i=0;i<40;i++){try{return await fetch('http://127.0.0.1:'+port+url,options)}catch{await new Promise(r=>setTimeout(r,100))}}
 throw new Error('Launch-gate test process did not start');
}
test('checkout remains blocked despite a true sales flag when compliance/fulfilment not ready',async()=>{
 const r=await request('/api/health');const j=await r.json();
 assert.equal(j.ok,true);assert.equal(j.checkoutEnabled,false);
});
test('public config cannot leak Stripe test-looking secret or email credentials',async()=>{
 const r=await request('/api/config'); const t=await r.text();
 assert.equal(r.status,200);assert.doesNotMatch(t,/sk_live_fake/);
 assert.doesNotMatch(t,/whsec_fake/);
 assert.equal(JSON.parse(t).checkoutReady,false);
});
test('launch gate refuses creating Stripe sessions even when sales flag accidentally true',async()=>{
 const r=await request('/api/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({offer:'toolkit',consent:true})});
 assert.equal(r.status,503);
});
test('unpaid order IDs do not unlock customer download or order intake',async()=>{
 const [a,b,c]=await Promise.all([
  request('/api/download?session_id=cs_live_NOTPAID'),
  request('/api/order?session_id=cs_live_NOTPAID'),
  request('/api/intake',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session_id:'cs_live_NOTPAID',tasks:'A test workflow',goal:'Improve flow'})})
 ]);
 assert.equal(a.status,503);assert.equal(b.status,503);assert.equal(c.status,503);
});
test('site displays closed checkout until launch criteria met',async()=>{
 const r=await request('/');const t=await r.text();
 assert.match(t,/data-checkout-offer="toolkit" disabled/);assert.match(t,/data-checkout-offer="audit" disabled/);assert.match(t,/mailto:aiadminaccelerator@agentmail\.to/);
});
test('sensitive server files remain inaccessible via public URL',async()=>{
 for(const path of ['/server.js','/package.json','/tests/site.test.js']){
  const r=await request(path);assert.equal(r.status,404);
 }
});
