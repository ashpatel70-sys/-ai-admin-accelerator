import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const port=36889;
const app=spawn(process.execPath,['server.js'],{env:{
 ...process.env,
 PORT:String(port),
 DEPLOYMENT_STAGE:'qa',
 STRIPE_SECRET_KEY:'rk_live_fake_staging_regression_only',
 STRIPE_WEBHOOK_SECRET:'whsec_fake_regression',
 STRIPE_PRICE_TOOLKIT:'price_testToolkit',
 STRIPE_PRICE_REVIEW:'price_testReview',
 AGENTMAIL_API_KEY:'am_fake_testonly',
 AGENTMAIL_INBOX:'aiadminaccelerator@agentmail.to',
 OWNER_EMAIL:'aiadminaccelerator@agentmail.to',
 PUBLIC_CONTACT_EMAIL:'aiadminaccelerator@agentmail.to',
 PUBLIC_SELLER_LEGAL_NAME:'Example Test Trader',
 PUBLIC_SELLER_POSTAL_ADDRESS:'42 Test Street, London W1A 1AA',
 TOOLKIT_BASE64:Buffer.concat([Buffer.from('PK'),Buffer.alloc(500,65)]).toString('base64'),
 LIVE_SALES_ENABLED:'true',
 LEGAL_READY:'true',
 FULFILMENT_TESTED:'true'
},stdio:'ignore'});
after(()=>app.kill());
async function api(path,opts){
 for(let i=0;i<36;i++){try{return await fetch('http://127.0.0.1:'+port+path,opts)}catch{await new Promise(resolve=>setTimeout(resolve,120))}}
 throw Error('QA guard process unavailable');
}
test('QA refuses restricted live Stripe key even when all payment flags are true',async()=>{
 const r=await api('/api/health');
 const v=await r.json();
 assert.equal(v.siteStage,'qa');
 assert.equal(v.mode,'live');
 assert.equal(v.emailTransportReady,true);
 assert.equal(v.toolkitDeliveryReady,true);
 assert.equal(v.sellerDetailsReady,true);
 assert.equal(v.checkoutEnabled,false);
 const cfg=await (await api('/api/config')).json();
 assert.equal(cfg.sandbox,true);
 assert.equal(cfg.checkoutReady,false);
 const page=await api('/'); assert.match(page.headers.get('x-robots-tag'),/noindex/);
});
test('QA endpoint denies checkout even with a live restricted key and full configuration',async()=>{
 const r=await api('/api/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({offer:'toolkit',consent:true})});
 assert.equal(r.status,503);
 const body=await r.json();assert.match(body.error,/not yet open/i);
});
