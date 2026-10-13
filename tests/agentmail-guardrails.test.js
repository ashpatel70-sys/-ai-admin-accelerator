import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const port=36874;
const app=spawn(process.execPath,['server.js'],{env:{
 ...process.env,
 PORT:String(port),
 LIVE_SALES_ENABLED:'true',
 LEGAL_READY:'false',
 FULFILMENT_TESTED:'false',
 STRIPE_SECRET_KEY:'sk_live_fake_credentials_for_guardrail_test',
 STRIPE_WEBHOOK_SECRET:'whsec_fake_signature',
 STRIPE_PRICE_TOOLKIT:'price_fake_toolkit',
 STRIPE_PRICE_REVIEW:'price_fake_review',
 AGENTMAIL_API_KEY:'am_fake_key_for_guardrail_test',
 AGENTMAIL_INBOX:'aiadminaccelerator@agentmail.to',
 RESEND_API_KEY:'',
 RESEND_FROM_EMAIL:'',
 OWNER_EMAIL:'aiadminaccelerator@agentmail.to',
 PUBLIC_CONTACT_EMAIL:'aiadminaccelerator@agentmail.to',
 TOOLKIT_BASE64:'UEsDBAoA' // an incomplete archive must never enable sales
},stdio:'ignore'});
after(()=>app.kill());
async function req(url,opts){
 for(let i=0;i<35;i++){try{return await fetch('http://127.0.0.1:'+port+url,opts)}catch{await new Promise(resolve=>setTimeout(resolve,120))}}
 throw new Error('Could not start launch-safety process');
}
test('AgentMail transport can be selected without exposing its API key',async()=>{
 const r=await req('/api/health');const j=await r.json();
 assert.equal(j.ok,true);assert.equal(j.emailTransportReady,true);
 assert.equal(j.toolkitDeliveryReady,false);
 assert.equal(j.checkoutEnabled,false);
 assert.doesNotMatch(JSON.stringify(j),/am_fake_key|sk_live_fake|whsec_fake/);
});
test('No payment despite AgentMail being ready because toolkit and compliance gates fail',async()=>{
 const r=await req('/api/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({offer:'toolkit',consent:true})});
 assert.equal(r.status,503);
});
test('Paid product cannot download with an incomplete private archive',async()=>{
 const r=await req('/api/download?session_id=cs_live_999999');
 assert.equal(r.status,503);
});
test('Static storefront does not disclose the private key',async()=>{
 const r=await req('/');const h=await r.text();
 assert.equal(r.status,200);assert.doesNotMatch(h,/am_fake_key|sk_live_fake|whsec_fake/);
});
