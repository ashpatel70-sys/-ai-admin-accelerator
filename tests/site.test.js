import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const port=36871;
const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),STRIPE_SECRET_KEY:'',STRIPE_WEBHOOK_SECRET:'',RESEND_API_KEY:'',TOOLKIT_BASE64:'',PUBLIC_SELLER_LEGAL_NAME:'',PUBLIC_SELLER_POSTAL_ADDRESS:'',PAYMENT_LINK_SALES_ENABLED:'false',LIVE_SALES_ENABLED:'false'},stdio:'ignore'});
after(()=>child.kill());
async function request(endpoint,options){
 for(let i=0;i<30;i++){try{return await fetch('http://127.0.0.1:'+port+endpoint,options)}catch{await new Promise(resolve=>setTimeout(resolve,100))}}
 throw new Error('Local test app failed to start');
}
test('Store homepage is accessible',async()=>{const r=await request('/');assert.equal(r.status,200);assert.match(await r.text(),/AI Admin Accelerator/);assert.match(r.headers.get('x-robots-tag'),/noindex/);assert.match(await (await request('/')).text(),/data-checkout-offer="toolkit" disabled/);});
test('Configured readiness defaults to disabled',async()=>{const r=await request('/api/config');const j=await r.json();assert.equal(j.checkoutReady,false)});
test('Health check is healthy without taking payments',async()=>{const r=await request('/api/health');const j=await r.json();assert.equal(j.ok,true);assert.equal(j.checkoutEnabled,false)});
test('Checkout does not permit payments',async()=>{const r=await request('/api/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({offer:'toolkit',consent:true})});assert.equal(r.status,503)});
test('Digital files are not publicly served',async()=>{const r=await request('/product/AI_Admin_Accelerator_Toolkit.zip');assert.equal(r.status,404)});
test('Toolkit download requires operational checkout',async()=>{const r=await request('/api/download?session_id=cs_live_fake');assert.equal(r.status,503)});
test('Workflow intake is disabled prior to launch',async()=>{const r=await request('/api/intake',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session_id:'cs_live_fake'})});assert.equal(r.status,503)});
test('Unsigned webhook not accepted before configuration',async()=>{const r=await request('/api/stripe-webhook',{method:'POST',body:'{}'});assert.equal(r.status,503)});
test('Privacy and terms available as drafts',async()=>{for(const p of ['/privacy.html','/terms.html']){const r=await request(p);assert.equal(r.status,200);assert.match(await r.text(),/AI Admin Accelerator/)}});
test('Traversal attempts cannot read server files',async()=>{const r=await request('/server.js');assert.notEqual(r.status,200)});
