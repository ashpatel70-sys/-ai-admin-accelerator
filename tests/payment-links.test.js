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
 STRIPE_PRICE_GROWTH:'price_MOCKGROWTH',STRIPE_PRICE_SPRINT:'price_MOCKSPRINT',STRIPE_PRICE_TRANSFORM:'price_MOCKTRANSFORM',
 STRIPE_PAYMENT_LINK_GROWTH:'plink_MOCKGROWTH',STRIPE_PAYMENT_LINK_SPRINT:'plink_MOCKSPRINT',STRIPE_PAYMENT_LINK_TRANSFORM:'plink_MOCKTRANSFORM',
 STRIPE_PAYMENT_URL_GROWTH:'https://buy.stripe.com/MOCKGROWTH',STRIPE_PAYMENT_URL_SPRINT:'https://buy.stripe.com/MOCKSPRINT',STRIPE_PAYMENT_URL_TRANSFORM:'https://buy.stripe.com/MOCKTRANSFORM',
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
 id:'cs_live_MOCK'+offer.toUpperCase(),mode:'payment',payment_status:'paid',livemode:true,currency:'gbp',
 amount_total:{toolkit:2900,audit:14900,growth:29900,sprint:59900,transform:99900}[offer],payment_link:{toolkit:'plink_live_mock_toolkit',audit:'plink_live_mock_audit',growth:'plink_MOCKGROWTH',sprint:'plink_MOCKSPRINT',transform:'plink_MOCKTRANSFORM'}[offer],
 metadata:{store:'ai-admin-accelerator',offer,v:'1'},customer_details:{email:'testbuyer@example.org'},
 created:Math.floor(Date.now()/1000)
});
test('toolkit: signed paid event delivers zipped attachment and owner email, duplicate ignored',async()=>{
 const first=await signedEvent(paidOrder('toolkit'));assert.equal(first.status,200);assert.equal((await first.json()).result,'fulfilled');
 const buyer=emails.find(m=>m.to?.[0]==='testbuyer@example.org'&&m.subject.includes('Toolkit'));
 assert.ok(buyer);assert.equal(buyer.attachments?.length,1);
 assert.equal(buyer.attachments[0].filename,'AI_Admin_Accelerator_Toolkit.zip');
 assert.equal(Buffer.from(buyer.attachments[0].content,'base64').subarray(0,2).toString(),'PK');
 assert.doesNotMatch(buyer.html,/Example Test Trader|10 Example Street London/);assert.match(buyer.html,/AI Admin Accelerator/);assert.match(buyer.html,/£29.00/);
 assert.ok(emails.some(m=>m.to?.[0]==='aiadminaccelerator@agentmail.to'&&m.subject.includes('paid')));
 const n=emails.length,dup=await signedEvent(paidOrder('toolkit'));
 assert.equal((await dup.json()).result,'duplicate');assert.equal(emails.length,n);
});
test('review: signed paid event emails instructions to customer',async()=>{
 const r=await signedEvent(paidOrder('audit'));assert.equal(r.status,200);assert.equal((await r.json()).result,'fulfilled');
 const m=emails.find(x=>x.to?.[0]==='testbuyer@example.org'&&x.subject.includes('Workflow Review'));
 assert.ok(m);assert.match(m.html,/five UK working days/);assert.doesNotMatch(m.html,/Example Test Trader|10 Example Street London/);
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

test('private personal information never appears on homepage, privacy or public terms',async()=>{
 const homepage=await req('/');assert.equal(homepage.status,200);
 const home=await homepage.text();assert.doesNotMatch(home,/Example Test Trader|10 Example Street London/);
 const privacy=await req('/privacy.html');assert.equal(privacy.status,200);
 const notice=await privacy.text();assert.doesNotMatch(notice,/Example Test Trader|10 Example Street London/);
 assert.match(notice,/Terms of Service/);
 const terms=await req('/terms.html');assert.equal(terms.status,200);
 const disclosures=await terms.text();assert.doesNotMatch(disclosures,/Example Test Trader|10 Example Street London/);assert.match(disclosures,/AI Admin Accelerator/);
 assert.match(terms.headers.get('x-robots-tag'),/noindex/);
 assert.match(terms.headers.get('cache-control'),/no-store/);
});


test('new storefront shows London service map without a pin, expanded services and safe payment controls',async()=>{
 const r=await req('/');assert.equal(r.status,200);
 const html=await r.text();
 assert.match(html,/Greater London|London service area/);
 assert.match(html,/www\.openstreetmap\.org\/export\/embed\.html/);
 assert.match(html,/no personal location pin/i);
 assert.match(html,/Workflow automation planning/);
 assert.match(html,/Client onboarding systems/);
 assert.match(html,/Knowledge bases & SOPs/);
 assert.match(html,/Customer Email Playbook/);
 assert.match(html,/Client Onboarding Pack/);
 assert.match(html,/data-checkout-offer="toolkit"/);
 assert.match(html,/data-checkout-offer="audit"/);
 assert.match(html,/Secure card payments via Stripe/);assert.doesNotMatch(html,/PayPal — activation pending/);
 assert.doesNotMatch(html,/Example Test Trader|10 Example Street London/);
 const script=await req('/checkout.js');assert.equal(script.status,200);
 const code=await script.text();
 assert.match(code,/dataset\.checkoutOffer/);
 assert.match(code,/api\/checkout/);
 assert.doesNotMatch(code,/PAYPAL_CLIENT_SECRET|PAYPAL_CLIENT_ID/);
});


test('production homepage exposes accurate Google Search metadata and five transparent price tiers',async()=>{
 const r=await req('/');assert.equal(r.status,200);
 const html=await r.text();
 assert.match(html,/<link rel="canonical" href="https:\/\/ai-admin-accelerator-shop\.onrender\.com\/">/);
 assert.match(html,/<meta name="robots" content="index,follow">/);
 assert.match(html,/property="og:title"/);
 assert.match(html,/name="twitter:card"/);
  assert.equal(html.split('<h1').length-1,1);
 const markup=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
 assert.ok(markup,'Structured data must be rendered server-side');
 const info=JSON.parse(markup[1]);
 assert.ok(info['@graph'].some(x=>x['@type']==='OnlineStore'&&x.name==='AI Admin Accelerator'));
 assert.ok(info['@graph'].some(x=>x['@type']==='Product'&&x.offers?.price==='29.00'));
 assert.match(html,/£29/);assert.match(html,/£149/);
 assert.match(html,/£299/);assert.match(html,/£599/);assert.match(html,/£999/);
 assert.match(html,/fixed one-time payments|one-off/i);
 assert.equal((html.match(/data-checkout-offer="/g)||[]).length,5);
 assert.doesNotMatch(html,/Example Test Trader|10 Example Street London/);
 const logo=await req('/brand-mark.svg');assert.equal(logo.status,200);
 assert.match(await logo.text(),/<svg/);
});
test('live crawl configuration advertises an XML sitemap with canonical production URL',async()=>{
 const a=await req('/robots.txt');assert.equal(a.status,200);
 const rules=await a.text();assert.match(rules,/User-agent: \*/);
 assert.match(rules,/Allow: \//);
 assert.match(rules,/Sitemap: https:\/\/ai-admin-accelerator-shop\.onrender\.com\/sitemap\.xml/);
 const b=await req('/sitemap.xml');assert.equal(b.status,200);
 assert.match(b.headers.get('content-type'),/application\/xml/);
 const xml=await b.text();assert.match(xml,/<urlset/);
 assert.ok(xml.includes('<loc>https://ai-admin-accelerator-shop.onrender.com/</loc>'));
 assert.doesNotMatch(xml,/terms\.html|privacy\.html|order-received/);
});


test('search pages: toolkit and written review have useful unique content, canonical URLs and safe indexing',async()=>{
 const cases=[['/ai-admin-toolkit.html','£29','AI Admin Toolkit'],['/ai-workflow-review.html','£149','AI Workflow Review']];
 for(const [url,price,title] of cases){
  const r=await req(url);assert.equal(r.status,200);
  assert.match(r.headers.get('x-robots-tag'),/index,follow/);
  const html=await r.text();
  assert.match(html,/<meta name="robots" content="index,follow">/);
  assert.ok(html.includes('<link rel="canonical" href="https://ai-admin-accelerator-shop.onrender.com'+url+'">'));
  assert.ok(html.includes(title));
  assert.ok(html.includes(price));
  assert.equal(html.split('<h1').length-1,1);
  const marker='<script type="application/ld+json">'; const begin=html.indexOf(marker); const end=html.indexOf('</script>',begin);
  assert.ok(begin>=0&&end>begin);assert.ok(JSON.parse(html.slice(begin+marker.length,end))['@type']);
  assert.doesNotMatch(html,/Example Test Trader|10 Example Street London/);
 }
 const home=await (await req('/')).text();
 assert.ok(home.includes('href="/ai-admin-toolkit.html"'));
 assert.ok(home.includes('href="/ai-workflow-review.html"'));
 assert.equal((home.match(/data-checkout-offer="/g)||[]).length,5);
});
test('new searchable landing pages are listed in XML sitemap without exposing private customer routes',async()=>{
 const sitemap=await req('/sitemap.xml');
 assert.equal(sitemap.status,200);
 const xml=await sitemap.text();
 for(const path of ['/','/ai-admin-toolkit.html','/ai-workflow-review.html']){
  assert.ok(xml.includes('<loc>https://ai-admin-accelerator-shop.onrender.com'+path+'</loc>'));
 }
 assert.equal((xml.match(/<url>/g)||[]).length,3);
 for(const path of ['/terms.html','/privacy.html','/cancellation.html','/order-received.html']){
  const r=await req(path);assert.match(r.headers.get('x-robots-tag'),/noindex/);
  assert.doesNotMatch(xml,new RegExp(path.replaceAll('.','\\.')));
 }
});


test('all five secure checkout routes match each configured Stripe live payment link',async()=>{
 const cfg=await (await req('/api/config')).json();
 assert.equal(cfg.premiumCheckoutReady,true);
 assert.deepEqual(cfg.offers,{toolkit:29,audit:149,growth:299,sprint:599,transform:999});
 const urls={toolkit:'MOCKTOOLKIT',audit:'MOCKAUDIT',growth:'MOCKGROWTH',sprint:'MOCKSPRINT',transform:'MOCKTRANSFORM'};
 for(const [offer,slug] of Object.entries(urls)){
  const r=await req('/api/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({offer,consent:true})});
  assert.equal(r.status,200,offer);
  assert.equal((await r.json()).url,'https://buy.stripe.com/'+slug);
 }
});
test('new premium service payments send correct customer intake and owner notification',async()=>{
 for(const [offer,price,name] of [['growth','£299.00','Growth Bundle'],['sprint','£599.00','Team Productivity Sprint'],['transform','£999.00','Operations Transformation Planning']]){
  const r=await signedEvent(paidOrder(offer));assert.equal(r.status,200);
  assert.equal((await r.json()).result,'fulfilled');
  const buyer=emails.find(m=>m.to?.[0]==='testbuyer@example.org'&&m.subject.includes(name));
  assert.ok(buyer,offer);assert.match(buyer.html,/completed|complete|workflow|brief/i);assert.match(buyer.html,/cancellation and statutory rights/i);assert.match(buyer.html,new RegExp(price.replace('.','\\.')));
  assert.doesNotMatch(buyer.html,/Example Test Trader|10 Example Street London/);
  assert.ok(emails.some(m=>m.to?.[0]==='aiadminaccelerator@agentmail.to'&&m.subject.includes(name)));
  const num=emails.length;
  const retry=await signedEvent(paidOrder(offer));
  assert.equal((await retry.json()).result,'duplicate');
  assert.equal(emails.length,num);
  const invalid=paidOrder(offer);invalid.id='cs_live_WRONGAMOUNT'+offer.toUpperCase();invalid.amount_total=1;
  assert.equal((await (await signedEvent(invalid)).json()).result,'ignored');
 }
});
