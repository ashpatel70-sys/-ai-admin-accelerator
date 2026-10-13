import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

const port=36891;
const child=spawn(process.execPath,['server.js'],{env:{
 ...process.env, PORT:String(port),DEPLOYMENT_STAGE:'production',
 STRIPE_SECRET_KEY:'rk_test_not_a_real_key',STRIPE_WEBHOOK_SECRET:'whsec_fake',
 STRIPE_PRICE_TOOLKIT:'price_testToolkit',STRIPE_PRICE_REVIEW:'price_testReview',
 AGENTMAIL_API_KEY:'am_fake_for_test',AGENTMAIL_INBOX:'aiadminaccelerator@agentmail.to',
 OWNER_EMAIL:'aiadminaccelerator@agentmail.to',PUBLIC_CONTACT_EMAIL:'aiadminaccelerator@agentmail.to',
 PUBLIC_SELLER_LEGAL_NAME:'Example Fully Identified Sole Trader',
 PUBLIC_SELLER_POSTAL_ADDRESS:'19 Example Business Street, London W1A 1AA',
 TOOLKIT_BASE64:Buffer.concat([Buffer.from('PK'),Buffer.alloc(500,65)]).toString('base64'),
 LIVE_SALES_ENABLED:'true',LEGAL_READY:'true',FULFILMENT_TESTED:'true'
},stdio:'ignore'});
after(()=>child.kill());
async function req(url,init){
 for(let i=0;i<45;i++){try{return await fetch('http://127.0.0.1:'+port+url,init)}catch{await new Promise(r=>setTimeout(r,100))}}
 throw Error('Production key safety-test server unavailable');
}
test('production cannot open checkout with sandbox key even if all flags, seller, mail and toolkit are configured',async()=>{
 const r=await req('/api/health'),j=await r.json();
 assert.equal(j.mode,'test');
 assert.equal(j.siteStage,'production');
 assert.equal(j.sellerDetailsReady,true);
 assert.equal(j.emailTransportReady,true);
 assert.equal(j.toolkitDeliveryReady,true);
 assert.equal(j.checkoutEnabled,false);
 const c=await req('/api/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({offer:'toolkit',consent:true})});
 assert.equal(c.status,503);
});