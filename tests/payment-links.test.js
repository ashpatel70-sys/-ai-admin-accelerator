import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHmac} from 'node:crypto';
const port=36931, secret='whsec_test_simulated', child=spawn(process.execPath,['server.js'],{
 env:{...process.env,PORT:String(port),DEPLOYMENT_STAGE:'production',STRIPE_SECRET_KEY:'',STRIPE_WEBHOOK_SECRET:'',
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
after(()=>child.kill());
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
