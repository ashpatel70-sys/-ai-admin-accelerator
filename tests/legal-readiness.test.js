import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const port=36878;
const child=spawn(process.execPath,['server.js'],{env:{
 ...process.env,PORT:String(port),NODE_ENV:'production',DEPLOYMENT_STAGE:'production',
 STRIPE_SECRET_KEY:'sk_test_faux',STRIPE_WEBHOOK_SECRET:'whsec_faux',
 STRIPE_PRICE_TOOLKIT:'price_testToolkit',STRIPE_PRICE_REVIEW:'price_testAudit',
 AGENTMAIL_API_KEY:'am_test_mock_key',AGENTMAIL_INBOX:'aiadminaccelerator@agentmail.to',
 OWNER_EMAIL:'aiadminaccelerator@agentmail.to',PUBLIC_CONTACT_EMAIL:'aiadminaccelerator@agentmail.to',
 TOOLKIT_BASE64:Buffer.concat([Buffer.from('PK'),Buffer.alloc(500,65)]).toString('base64'),
 PUBLIC_SELLER_LEGAL_NAME:'',PUBLIC_SELLER_POSTAL_ADDRESS:'',
 LIVE_SALES_ENABLED:'true',LEGAL_READY:'true',FULFILMENT_TESTED:'true',
 AGENTMAIL_CONNECTIVITY_CHECK_ON_STARTUP:'false'
},stdio:'ignore'});
after(()=>child.kill());
async function get(p,init){
 for(let i=0;i<40;i++){try{return await fetch('http://127.0.0.1:'+port+p,init)}catch{await new Promise(r=>setTimeout(r,100))}}
 throw Error('Could not start legal-readiness test app');
}
test('no seller identity/address blocks checkout even when all readiness flags mistakenly enabled',async()=>{
 const r=await get('/api/health'); const j=await r.json();
 assert.equal(j.ok,true);assert.equal(j.sellerDetailsReady,false);assert.equal(j.emailTransportReady,true);assert.equal(j.checkoutEnabled,false);
});
test('checkout refuses charges without verified legal identity and address',async()=>{
 const r=await get('/api/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({offer:'toolkit',consent:true})});
 assert.equal(r.status,503);
});
test('business cancellation form is accessible, and trader identity is marked unfinished until approved',async()=>{
 const a=await get('/cancellation.html'),b=await get('/terms.html'),c=await get('/privacy.html');
 assert.equal(a.status,200);assert.match(await a.text(),/Model cancellation form/);
 assert.match(await b.text(),/chosen trading name/);
 assert.match(await c.text(),/legally responsible/);
});
