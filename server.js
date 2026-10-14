import {createServer} from 'node:http';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.dirname(fileURLToPath(import.meta.url)),PUBLIC=path.join(ROOT,'public');
const PORT=Number(process.env.PORT||3000);
const BASE=(process.env.PUBLIC_BASE_URL||'http://localhost:'+PORT).replace(/\/$/,'');
const isQASite=process.env.DEPLOYMENT_STAGE==='qa';
// Sandbox catalogue price IDs are public references, never secret credentials. The production
// storefront must continue reading prices exclusively from its own private environment.
const QA_PRICE_TOOLKIT='price_1UPzSbDZ2uwtomrMbnbVLK5x';
const QA_PRICE_REVIEW='price_1UPzSkDZ2uwtomrMm8kCkPl6';
const PRODUCTS={
 toolkit:{name:'AI Admin Toolkit',amount:2900,price:process.env.STRIPE_PRICE_TOOLKIT||(isQASite?QA_PRICE_TOOLKIT:'')},
 audit:{name:'AI Workflow Review',amount:14900,price:process.env.STRIPE_PRICE_REVIEW||(isQASite?QA_PRICE_REVIEW:'')}
};
const contact=process.env.PUBLIC_CONTACT_EMAIL||'';
const owner=process.env.OWNER_EMAIL||'';
const legalSeller=process.env.PUBLIC_SELLER_LEGAL_NAME||'';
const legalPostal=process.env.PUBLIC_SELLER_POSTAL_ADDRESS||'';
const sellerDetailsReady=Boolean(isQASite||(legalSeller.trim().length>=3&&legalPostal.trim().length>=12&&!/\[(seller|address|todo)\]/i.test(legalSeller+' '+legalPostal)));
const stripeKey=process.env.STRIPE_SECRET_KEY||'';
const webhookSecret=process.env.STRIPE_WEBHOOK_SECRET||'';
const paymentLinkSecret=process.env.STRIPE_PAYMENT_LINK_WEBHOOK_SECRET||'';
const paymentLinkIds={toolkit:process.env.STRIPE_PAYMENT_LINK_TOOLKIT||'',audit:process.env.STRIPE_PAYMENT_LINK_REVIEW||''};
const paymentLinkUrls={toolkit:process.env.STRIPE_PAYMENT_URL_TOOLKIT||'',audit:process.env.STRIPE_PAYMENT_URL_REVIEW||''};
const resendKey=process.env.RESEND_API_KEY||'';
const agentMailKey=process.env.AGENTMAIL_API_KEY||'';
const agentMailInbox=process.env.AGENTMAIL_INBOX||'aiadminaccelerator@agentmail.to';
const fromEmail=process.env.RESEND_FROM_EMAIL||'';
const isLive=/^(sk|rk)_live_/.test(stripeKey);
const isTest=/^(sk|rk)_test_/.test(stripeKey);
// Integration-test endpoints are accepted ONLY on localhost in NODE_ENV=test.
const localMockPattern=/^http:\/\/127\.0\.0\.1:\d+$/;
const localStripeBase=process.env.NODE_ENV==='test'&&localMockPattern.test(process.env.TEST_STRIPE_BASE||'')?process.env.TEST_STRIPE_BASE:null;
const localAgentMailBase=process.env.NODE_ENV==='test'&&localMockPattern.test(process.env.TEST_AGENTMAIL_BASE||'')?process.env.TEST_AGENTMAIL_BASE:null;
const toolkitBase64=process.env.TOOLKIT_BASE64||'';
const toolkitBuffer=toolkitBase64&&toolkitBase64.length<250000?Buffer.from(toolkitBase64,'base64'):null;
const validToolkit=Boolean(toolkitBuffer&&toolkitBuffer.length>100&&toolkitBuffer.subarray(0,2).toString()==='PK');
const mailReady=Boolean((agentMailKey&&agentMailInbox==='aiadminaccelerator@agentmail.to')||(resendKey&&fromEmail));
const configured=Boolean((isLive||isTest)&&webhookSecret&&mailReady&&owner&&contact&&validToolkit&&sellerDetailsReady&&Object.values(PRODUCTS).every(p=>/^price_[A-Za-z0-9]+$/.test(p.price)));
const enabled=configured&&(isQASite?isTest:isLive)&&process.env.LIVE_SALES_ENABLED==='true'&&process.env.LEGAL_READY==='true'&&process.env.FULFILMENT_TESTED==='true';
const linkReady=Boolean(!isQASite&&sellerDetailsReady&&agentMailKey&&validToolkit&&contact&&owner&&paymentLinkSecret.startsWith('whsec_')&&
 /^[a-zA-Z0-9_]+$/.test(paymentLinkIds.toolkit)&&/^plink_/.test(paymentLinkIds.toolkit)&&/^plink_/.test(paymentLinkIds.audit)&&paymentLinkIds.toolkit!==paymentLinkIds.audit&&
 /^https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+$/.test(paymentLinkUrls.toolkit)&&/^https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+$/.test(paymentLinkUrls.audit)&&
 process.env.PAYMENT_LINK_SALES_ENABLED==='true'&&process.env.LEGAL_READY==='true'&&process.env.FULFILMENT_TESTED==='true');
const deliveredLinkSessions=new Set(),pendingLinkSessions=new Set();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.ico':'image/x-icon','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8'};
const hits=new Map();
const sleep=()=>new Date().toISOString();
function response(res,status,data,type='application/json; charset=utf-8',extra={}){
 res.writeHead(status,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'strict-origin-when-cross-origin','permissions-policy':'camera=(), microphone=(), geolocation=()',...extra});
 res.end(type.startsWith('application/json')?JSON.stringify(data):data);
}
function limit(req){
 const ip=req.socket.remoteAddress||'unknown',now=Date.now();const existing=(hits.get(ip)||[]).filter(x=>now-x<60000);existing.push(now);hits.set(ip,existing);
 if(hits.size>1500)hits.clear();
 return existing.length>35;
}
async function raw(req,max=65000){
 let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>max)throw new Error('Payload too large');chunks.push(chunk)}return Buffer.concat(chunks);
}
async function body(req){try{return JSON.parse((await raw(req,15000)).toString('utf8'))}catch{throw new Error('Invalid JSON')}}
async function stripe(method,endpoint,params){
 const opts={method,headers:{authorization:'Bearer '+stripeKey}};
 if(params){opts.headers['content-type']='application/x-www-form-urlencoded';opts.body=new URLSearchParams(params).toString()}
 const r=await fetch((localStripeBase||'https://api.stripe.com/v1')+endpoint,opts);const data=await r.json();
 if(!r.ok)throw new Error('Stripe API error '+r.status);
 return data;
}
function signed(buffer,header,secret=webhookSecret){
 if(!secret||!header)return false;
 const parts=header.split(',').map(x=>x.trim().split('='));
 const stamp=parts.find(x=>x[0]==='t')?.[1],proofs=parts.filter(x=>x[0]==='v1').map(x=>x[1]);
 if(!/^\d+$/.test(stamp||'')||Math.abs(Date.now()/1000-Number(stamp))>300)return false;
 const calculated=createHmac('sha256',secret).update(stamp+'.'+buffer.toString('utf8')).digest('hex');
 return proofs.some(p=>/^[a-f0-9]{64}$/i.test(p)&&timingSafeEqual(Buffer.from(p,'hex'),Buffer.from(calculated,'hex')));
}
function safe(str,max=1200){return typeof str==='string'?str.trim().slice(0,max):''}
function escapeHTML(str){return String(str).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]))}
function validSession(id){return typeof id==='string'&&/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)}
async function paid(id){
 if(!configured||!validSession(id))return null;
 const s=await stripe('GET','/checkout/sessions/'+encodeURIComponent(id));
 const offer=s.metadata?.offer,p=PRODUCTS[offer];
 if(!p||s.metadata?.store!=='ai-admin-accelerator'||s.payment_status!=='paid'||s.mode!=='payment'||s.amount_total!==p.amount||s.currency!=='gbp')return null;
 const line=await stripe('GET','/checkout/sessions/'+encodeURIComponent(id)+'/line_items?limit=10');
 if(line.data?.length!==1||line.data[0].price?.id!==p.price||line.data[0].quantity!==1)return null;
 return s;
}
async function sendMail(to,subject,html,key,attachments=[]){
 if(isQASite){
  subject='[SANDBOX TEST — NO PAYMENT] '+subject;
  html='<p style="background:#fff1c0;color:#372a02;padding:12px;font-weight:bold">SANDBOX ONLY — simulated test payment. This is not a real order or commercial receipt.</p>'+html;
 }
 if(agentMailKey){
  const u=(localAgentMailBase||'https://api.agentmail.to/v0')+'/inboxes/'+encodeURIComponent(agentMailInbox)+'/messages/send';
  const r=await fetch(u,{method:'POST',headers:{authorization:'Bearer '+agentMailKey,'content-type':'application/json'},body:JSON.stringify({to:[to],subject,html,text:html.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&'),...(attachments.length?{attachments}: {})})});
  if(!r.ok)throw new Error('AgentMail transactional email failed '+r.status);
  return;
 }
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:'Bearer '+resendKey,'content-type':'application/json','idempotency-key':key},body:JSON.stringify({from:fromEmail,to:[to],subject,html})});
 if(!r.ok)throw new Error('Transactional email failed '+r.status);
}
async function fulfilLinkEvent(event){
 if(!['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type))return 'ignored';
 const order=event.data?.object;
 if(!order||order.payment_status!=='paid'||order.mode!=='payment'||!event.livemode||!order.livemode)return 'ignored';
 const offer=order.metadata?.offer,p=PRODUCTS[offer],knownId=paymentLinkIds[offer];
 if(!p||order.metadata?.store!=='ai-admin-accelerator'||order.metadata?.v!=='1'||
  typeof knownId!=='string'||order.payment_link!==knownId||
  order.amount_total!==p.amount||order.currency!=='gbp'||!/^cs_live_[A-Za-z0-9]+$/.test(order.id||''))return 'ignored';
 const to=order.customer_details?.email||order.customer_email;
 if(typeof to!=='string'||!/^\S+@\S+\.\S+$/.test(to)||to.length>250)throw new Error('Paid order customer email unavailable');
 if(deliveredLinkSessions.has(order.id))return 'duplicate';
 if(pendingLinkSessions.has(order.id))throw new Error('Fulfilment already in progress');
 pendingLinkSessions.add(order.id);
 try{
  const item=escapeHTML(p.name),ref=escapeHTML(order.id),price=offer==='toolkit'?'£29.00':'£149.00';
  const details='<p>Order reference: '+ref+'. Product: '+item+'. Total paid: '+price+' (GBP). Date: '+
    escapeHTML(new Date((order.created||Math.floor(Date.now()/1000))*1000).toISOString().slice(0,10))+'.</p>'+
    '<p>Seller: '+escapeHTML(legalSeller)+', trading as AI Admin Accelerator. Address: '+escapeHTML(legalPostal)+'.'+
    ' Contact: '+escapeHTML(contact)+'.</p>'+
    '<p>Terms: <a href="'+escapeHTML(BASE)+'/terms.html">View and save terms</a>. Cancellation and statutory rights: '+
    '<a href="'+escapeHTML(BASE)+'/cancellation.html">View cancellation information and form</a>. '+
    'For help or a refund request reply to this email. Your statutory rights remain unaffected.</p>';
  if(offer==='toolkit'){
   const zip={filename:'AI_Admin_Accelerator_Toolkit.zip',content_type:'application/zip',content_disposition:'attachment',content:toolkitBase64};
   await sendMail(to,'Your £29 AI Admin Accelerator Toolkit — order '+order.id,
    '<h2>Your download is attached</h2><p>Thank you for buying the AI Admin Toolkit. Save the attached ZIP file, extract it and open the included guide. This purchase is a one-time digital licence; no AI service subscription is included.</p>'+
     details,'paid-toolkit-'+order.id,[zip]);
  }else{
   await sendMail(to,'Your £149 AI Workflow Review — order '+order.id,
    '<h2>Thank you for your order</h2><p>Reply to this message with (1) your business name and sector, (2) the administrative workflow you want improved, (3) the software you use and (4) the outcome you want. Do not send passwords or sensitive customer data.</p>'+
    '<p>A personalised written review is normally delivered within five UK working days after we receive a complete brief.</p>'+details,'paid-review-'+order.id);
  }
  deliveredLinkSessions.add(order.id);
  if(deliveredLinkSessions.size>6000)deliveredLinkSessions.clear();
  try{await sendMail(owner,'New paid '+(offer==='toolkit'?'£29 toolkit':'£149 review')+' order '+order.id,
   '<p>Verified live Stripe Payment Link sale. Product: '+item+'. Buyer: '+escapeHTML(to)+'. Order: '+ref+'.'+
   (offer==='audit'?' Watch for the customer\'s emailed workflow brief.':' The toolkit was sent as an email attachment.')+'</p>',
   'owner-'+order.id);}catch(e){console.error('Owner order notice failed:',e.message)}
  return 'fulfilled';
 }finally{pendingLinkSessions.delete(order.id)}
}
async function fulfil(id){
 const order=await paid(id);if(!order||order.metadata?.fulfilment_email_sent==='yes')return;
 const to=order.customer_details?.email||order.customer_email;
 if(!to)throw new Error('No customer email');
 const url=BASE+'/success.html?session_id='+encodeURIComponent(order.id);
 const link='<a href="'+escapeHTML(url)+'">Open your secure order page</a>';
 const orderPrice=order.metadata.offer==='toolkit'?'£29.00':'£149.00';
 const receipt='<p>Product: '+escapeHTML(PRODUCTS[order.metadata.offer].name)+'; '+(isQASite?'simulated test total':'total charged')+': '+orderPrice+' GBP; order date: '+escapeHTML(new Date(order.created*1000||Date.now()).toISOString().slice(0,10))+'.</p><p>'+(isQASite?'QA SANDBOX — no legal seller or geographic address applies to this simulated transaction.':'Seller: '+escapeHTML(legalSeller)+', '+escapeHTML(legalPostal)+'.')+' Support: '+escapeHTML(contact)+'.</p><p>Your checkout acknowledgement of early performance and applicable cancellation rights was recorded. For the digital download, you expressly agreed to immediate supply and acknowledged the applicable loss of the 14-day cancellation right once supply begins. Your statutory rights for faulty or misdescribed digital content are unaffected.</p><p>For cancellation and complaints: email '+escapeHTML(contact)+'. You can save these terms and cancellation guidance: '+escapeHTML(BASE)+'/terms.html and '+escapeHTML(BASE)+'/cancellation.html.</p>';
 if(order.metadata.offer==='toolkit'){
  await sendMail(to,'Your AI Admin Toolkit', '<p>Thank you for ordering.</p>'+receipt+'<p>'+link+' to download the toolkit.</p><p>Please keep your personal order link private.</p>', 'toolkit-'+id);
 }else{
  await sendMail(to,'Your AI Workflow Review — provide your brief','<p>Thank you for ordering.</p>'+receipt+'<p>'+link+' and complete the workflow intake.</p><p>Delivery is within five UK working days of complete intake.</p>','audit-buyer-'+id);
  await sendMail(owner,'New paid AI workflow review order','<p>New £149 workflow review order: '+escapeHTML(id)+'.</p>','audit-owner-'+id);
 }
 await stripe('POST','/checkout/sessions/'+encodeURIComponent(id),{'metadata[fulfilment_email_sent]':'yes'});
}
async function servePublic(req,res,pathname){
 let file;try{file=path.resolve(PUBLIC,'.'+decodeURIComponent(pathname==='/'?'/index.html':pathname))}catch{return response(res,400,'Bad path','text/plain')}
 if(!file.startsWith(PUBLIC+path.sep))return response(res,403,'Forbidden','text/plain');
 const meta=await stat(file).catch(()=>null);if(!meta?.isFile())return response(res,404,'Not found','text/plain');
 let data=await readFile(file);
 if(['/', '/terms.html','/privacy.html'].includes(pathname)){
  const traderDetails=sellerDetailsReady&&!isQASite?
   '<p><strong>Legal seller:</strong> '+escapeHTML(legalSeller)+' (trading as AI Admin Accelerator). <strong>Business address:</strong> '+escapeHTML(legalPostal)+'.</p>':
   '<p>Trading name: AI Admin Accelerator. Seller identity and business address are not yet finalised for paid ordering.</p>';
  data=Buffer.from(data.toString('utf8').replace('<!--SELLER_DISCLOSURES-->',traderDetails));
 }
 if(pathname==='/terms.html'||pathname==='/privacy.html'){
  // Public contract information appears only after it has been deliberately supplied by the owner.
  const withSeller=data.toString('utf8').replaceAll('[SELLER LEGAL NAME]',escapeHTML(legalSeller)||'[SELLER LEGAL NAME]').replaceAll('[SELLER POSTAL ADDRESS]',escapeHTML(legalPostal)||'[SELLER POSTAL ADDRESS]');
  data=Buffer.from(withSeller);
 }
 if(pathname==='/'){
  // Buttons are disabled in committed HTML; only our runtime JS may enable them after readiness checks.
  const robotsMeta=!isQASite&&sellerDetailsReady?'index,follow':'noindex,nofollow';
  const markup=data.toString('utf8').replace('<meta name="robots" content="noindex,nofollow">','<meta name="robots" content="'+robotsMeta+'">').replace('</body>','<script defer src="/checkout.js"></script></body>');
  data=Buffer.from(markup);
 }
 const ext=path.extname(file);
 response(res,200,req.method==='HEAD'?'':data,mime[ext]||'application/octet-stream',{'cache-control':'public,max-age=90','x-robots-tag':!isQASite&&sellerDetailsReady&&pathname==='/'?'all':'noindex,nofollow'});
}
const server=createServer(async(req,res)=>{
 const u=new URL(req.url,BASE),p=u.pathname;
 try{
  if(req.method==='GET'&&p==='/robots.txt')return response(res,200,(isQASite||!sellerDetailsReady)?'User-agent: *\nDisallow: /\n':'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /success.html\n','text/plain; charset=utf-8');
  if(req.method==='GET'&&p==='/order-received.html'){
   const html='<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Thank you | AI Admin Accelerator</title><style>body{font:16px/1.65 system-ui,-apple-system,sans-serif;background:#f4f7fc;color:#172441;padding:16px}main{background:white;max-width:720px;margin:48px auto;padding:30px;border-radius:16px}a{color:#5159d8}</style></head><body><main><p><a href="/">AI Admin Accelerator</a></p><h1>Thank you for your order</h1><p>Your payment is being verified directly with Stripe. We will email your order confirmation and product delivery to the address you used at checkout.</p><h2>AI Admin Toolkit — £29</h2><p>Following verified payment, your downloadable ZIP toolkit is sent as an email attachment. Check your junk folder. If it is not received by the next UK working day, contact support.</p><h2>AI Workflow Review — £149</h2><p>Reply to the order email with your business sector, current workflow, software and goals. Your written review is normally delivered within five UK working days after receipt of a complete brief.</p><p>Support, cancellations and refunds: <a href="mailto:aiadminaccelerator@agentmail.to">aiadminaccelerator@agentmail.to</a>.</p><p><a href="/terms.html">Terms</a> · <a href="/cancellation.html">Cancellation rights</a> · <a href="/privacy.html">Privacy</a></p></main></body></html>';
   return response(res,200,html,'text/html; charset=utf-8',{'x-robots-tag':'noindex,nofollow'});
  }
  if(req.method==='GET'&&p==='/api/health')return response(res,200,{ok:true,checkoutEnabled:enabled||linkReady,paymentLinkReady:linkReady,mode:isLive?'live':isTest?'test':'unconfigured',siteStage:isQASite?'qa':'production',supportEmailConfigured:Boolean(contact),sellerDetailsReady,emailTransportReady:mailReady,toolkitDeliveryReady:validToolkit,timestamp:sleep()});
  if(req.method==='GET'&&p==='/api/config')return response(res,200,{checkoutReady:enabled||linkReady,paymentLinkCheckout:linkReady,sandbox:isQASite,contactEmail:contact,offers:{toolkit:29,audit:149}});
  if(req.method==='POST'&&p==='/api/checkout'){
   if(!enabled&&!linkReady)return response(res,503,{error:'Checkout is not yet open.'});
   if(limit(req))return response(res,429,{error:'Too many requests'});
   const b=await body(req),offer=safe(b.offer,20);
   if(!Object.hasOwn(PRODUCTS,offer)||b.consent!==true)return response(res,400,{error:'Please choose a product and accept the terms.'});
   if(linkReady)return response(res,200,{url:paymentLinkUrls[offer]});
   const params={mode:'payment','line_items[0][price]':PRODUCTS[offer].price,'line_items[0][quantity]':'1',success_url:BASE+'/success.html?session_id={CHECKOUT_SESSION_ID}',cancel_url:BASE+'/#pricing','customer_creation':'always','metadata[store]':'ai-admin-accelerator','metadata[offer]':offer,'metadata[consent_acknowledged]':'yes','metadata[consent_timestamp]':sleep()};
   const order=await stripe('POST','/checkout/sessions',params);
   return response(res,200,{url:order.url});
  }
  if(req.method==='POST'&&p==='/api/payment-link-webhook'){
   if(!linkReady)return response(res,503,{error:'Payment-link fulfilment is not open'});
   const data=await raw(req);
   if(!signed(data,req.headers['stripe-signature'],paymentLinkSecret))return response(res,400,{error:'Invalid signature'});
   const event=JSON.parse(data.toString('utf8'));
   const result=await fulfilLinkEvent(event);
   return response(res,200,{received:true,result});
  }
  if(req.method==='POST'&&p==='/api/stripe-webhook'){
   if(!configured)return response(res,503,{error:'Webhook not configured'});
   const data=await raw(req);
   if(!signed(data,req.headers['stripe-signature']))return response(res,400,{error:'Invalid signature'});
   const event=JSON.parse(data.toString('utf8'));
   if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type))await fulfil(event.data.object.id);
   return response(res,200,{received:true});
  }
  if(req.method==='GET'&&p==='/api/order'){
   if(!configured)return response(res,503,{error:'Order verification is not configured'});
   let s=null;try{s=await paid(u.searchParams.get('session_id'))}catch{}
   return s?response(res,200,{paid:true,offer:s.metadata.offer}):response(res,404,{error:'Payment not verified'});
  }
  if(req.method==='GET'&&p==='/api/download'){
   if(!enabled||!validToolkit)return response(res,503,'Downloads are not yet available','text/plain');
   if(limit(req))return response(res,429,'Too many requests','text/plain');
   let s=null;try{s=await paid(u.searchParams.get('session_id'))}catch{}
   if(s?.metadata.offer!=='toolkit')return response(res,403,'Verified purchase required','text/plain');
   const zip=toolkitBuffer;
   if(zip.length<100||zip.subarray(0,2).toString()!=='PK')return response(res,503,'Digital delivery temporarily unavailable','text/plain');
   return response(res,200,zip,'application/zip',{'content-disposition':'attachment; filename="AI_Admin_Accelerator_Toolkit.zip"','x-robots-tag':'noindex'});
  }
  if(req.method==='POST'&&p==='/api/intake'){
   if(!enabled)return response(res,503,{error:'Intake not yet available'});
   if(limit(req))return response(res,429,{error:'Too many requests'});
   const b=await body(req);let s=null;try{s=await paid(b.session_id)}catch{}
   if(s?.metadata.offer!=='audit')return response(res,403,{error:'Verified workflow-review purchase required'});
   if(s.metadata?.intake_submitted==='yes')return response(res,409,{error:'Intake already submitted'});
   const fields={business:safe(b.business,150),sector:safe(b.sector,150),tasks:safe(b.tasks,2500),tools:safe(b.tools,600),goal:safe(b.goal,1200)};
   if(!fields.business||fields.tasks.length<20||fields.goal.length<10)return response(res,400,{error:'Please complete all required fields'});
   const content='<h2>Paid workflow review intake</h2><p>Session '+escapeHTML(s.id)+'</p>'+Object.entries(fields).map(([k,v])=>'<p><b>'+escapeHTML(k)+'</b>: '+escapeHTML(v)+'</p>').join('');
   await sendMail(owner,'Paid workflow intake received',content,'intake-'+s.id);
   await stripe('POST','/checkout/sessions/'+encodeURIComponent(s.id),{'metadata[intake_submitted]':'yes'});
   return response(res,200,{ok:true});
  }
  if(!['GET','HEAD'].includes(req.method))return response(res,405,'Method not allowed','text/plain');
  return await servePublic(req,res,p);
 }catch(e){console.error('Request processing failed:',e.message);return response(res,500,{error:'The request could not be completed'});}
});
server.listen(PORT,()=>{
 console.log('AI Admin Accelerator commerce server listening on '+PORT+'; checkout '+(enabled?'ENABLED':'DISABLED'));
 console.log('Launch diagnostics: AgentMail credential present='+Boolean(agentMailKey)+'; email transport configured='+mailReady+'; valid paid toolkit present='+validToolkit);
 // Strictly a self-addressed email. Only the actual Render runtime port runs the temporary test.
 // No API keys or email bodies are logged.
 if(process.env.AGENTMAIL_CONNECTIVITY_CHECK_ON_STARTUP==='true'&&agentMailKey&&PORT===10000){
  sendMail(agentMailInbox,'AI Admin Accelerator — hosted email verification','<p>Internal AgentMail connection test from the Render-hosted AI Admin Accelerator shop. This is not a customer order.</p>','startup-test')
   .then(()=>console.log('AgentMail hosted send verification: SUCCESS'))
   .catch(e=>console.error('AgentMail hosted send verification: FAILED ('+safe(e.message,130)+')'));
 }else if(process.env.AGENTMAIL_CONNECTIVITY_CHECK_ON_STARTUP==='true'&&!agentMailKey&&PORT===10000){
  console.log('AgentMail hosted send verification: SKIPPED (credential not configured)');
 }
});
