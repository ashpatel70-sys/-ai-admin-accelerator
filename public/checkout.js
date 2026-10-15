(() => {
  'use strict';
  const btns=[...document.querySelectorAll('button[data-checkout-offer]')];
  const notice=document.getElementById('payment-readiness');
  const safeOffers=new Set(['toolkit','audit','growth','sprint','transform']);
  const labels={toolkit:'AI Admin Toolkit — £29 one-time digital download',audit:'AI Workflow Review — £149 one-time personalised written service',growth:'Growth Bundle — £299 one-time remote service',sprint:'Team Productivity Sprint — £599 one-time remote service',transform:'Operations Transformation Planning — £999 one-time remote service'};
  const ctas={toolkit:'Buy toolkit — £29 ↗',audit:'Book workflow review — £149 ↗',growth:'Book Growth Bundle — £299 ↗',sprint:'Book Team Sprint — £599 ↗',transform:'Book planning package — £999 ↗'};
  const premium=new Set(['growth','sprint','transform']);
  let selected=null;
  const overlay=document.createElement('div');
  overlay.hidden=true;
  overlay.setAttribute('role','presentation');
  overlay.style.cssText='position:fixed;inset:0;background:#0c2837bb;z-index:999;display:none;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(6px)';
  overlay.innerHTML='<div role="dialog" aria-modal="true" aria-labelledby="checkout-modal-heading" style="background:white;color:#172c3b;border-radius:20px;padding:clamp(20px,4vw,35px);width:min(560px,100%);max-height:90vh;overflow:auto;box-shadow:0 20px 72px #00182a60"><p style="font-weight:800;font-size:.72rem;letter-spacing:.13em;color:#00776d">SECURE CHECKOUT</p><h2 id="checkout-modal-heading" style="margin:10px 0 18px;font-size:1.9rem;letter-spacing:-.04em">Confirm your purchase</h2><p id="item-description"></p><p style="font-size:.88rem;color:#526879">Please read the <a href="/terms.html" target="_blank" rel="noopener" style="color:#006d65">Terms of Service</a>, <a href="/cancellation.html" target="_blank" rel="noopener" style="color:#006d65">cancellation information</a> and <a href="/privacy.html" target="_blank" rel="noopener" style="color:#006d65">Privacy Policy</a> before proceeding.</p><label style="display:flex;gap:12px;align-items:flex-start;line-height:1.55;font-size:.91rem"><input id="purchase-consent" type="checkbox" style="margin-top:5px;width:19px;height:19px;flex-shrink:0;accent-color:#007e72"><span id="consent-words"></span></label><div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:25px"><button id="pay-confirm" style="border:0;border-radius:11px;background:#172f3d;color:white;padding:14px 22px;cursor:pointer;font-weight:750">Continue to secure Stripe checkout ↗</button><button id="pay-cancel" style="border:1px solid #bcd3d2;border-radius:11px;background:white;padding:14px 20px;cursor:pointer">Cancel</button></div><p id="pay-error" role="status" style="color:#b52132;font-size:.87rem;margin:14px 0 0"></p></div>';
  document.body.appendChild(overlay);
  const confirm=document.getElementById('pay-confirm');
  const consent=document.getElementById('purchase-consent');
  function close(){overlay.hidden=true;overlay.style.display='none';selected=null;}
  function open(offer){
    if(!safeOffers.has(offer))return;
    selected=offer;
    consent.checked=false;
    document.getElementById('pay-error').textContent='';
    document.getElementById('item-description').textContent=labels[offer];
    document.getElementById('consent-words').textContent=offer==='toolkit'
      ?'I expressly request immediate digital delivery and acknowledge that the statutory 14-day cancellation right may be lost once supply begins where the legal conditions are met. My rights relating to faulty digital content remain.'
      :'I have read the package scope, terms and cancellation information. I expressly request service work to begin after my completed intake, including within the 14-day cancellation period, and understand proportionate statutory cancellation charges may apply for work started at my request.';
    overlay.hidden=false;overlay.style.display='flex';consent.focus();
  }
  document.getElementById('pay-cancel').addEventListener('click',close);
  overlay.addEventListener('click',event=>{if(event.target===overlay)close();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!overlay.hidden)close();});
  const setMessage=text=>{if(notice)notice.textContent=text;};
  fetch('/api/config',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Config error');return r.json();}).then(cfg=>{
    if(cfg.sandbox){
      const banner=document.createElement('div');
      banner.setAttribute('role','status');
      banner.style.cssText='position:relative;z-index:99;background:#ffedbe;color:#452e00;padding:14px 20px;text-align:center;font-weight:850;border-bottom:3px solid #dc9a17;font-size:15px';
      banner.textContent='QA TESTING ONLY — no real charges. This is not the live customer storefront.';
      document.body.prepend(banner);
    }
    if(!cfg.checkoutReady){
      setMessage(cfg.sandbox?'QA sandbox: checkout disabled pending integration checks.':'Checkout is temporarily unavailable. Please email our support team to enquire.');
      btns.forEach(btn=>{btn.textContent='Contact us to order';});
      return;
    }
    setMessage(cfg.sandbox?'Sandbox checkout only — no real money is charged.':(cfg.premiumCheckoutReady?'All five one-time offers accept secure Stripe card payments. Prices are in GBP.':'The £29 toolkit and £149 review accept secure card payments. Other packages are currently enquiry-only.'));
    btns.forEach(btn=>{
      const offer=btn.dataset.checkoutOffer;
      if(!safeOffers.has(offer))return;
      if(premium.has(offer)&&!cfg.premiumCheckoutReady){btn.textContent='Enquire about availability';return;}
      btn.disabled=false;btn.removeAttribute('aria-disabled');
      btn.textContent=ctas[offer];
      btn.addEventListener('click',()=>open(offer));
    });
  }).catch(()=>{setMessage('Unable to verify payment status. Purchasing remains disabled for safety.');btns.forEach(btn=>{btn.textContent='Checkout currently unavailable';});});
  confirm.addEventListener('click',async()=>{
    const error=document.getElementById('pay-error');
    if(!consent.checked){error.textContent='Please tick the consent checkbox before continuing.';return;}
    if(!selected)return;
    confirm.disabled=true;confirm.textContent='Opening secure checkout…';
    try{
      const r=await fetch('/api/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({offer:selected,consent:true})});
      const data=await r.json();
      if(!r.ok||typeof data.url!=='string'||!/^https:\/\/(buy\.stripe\.com|checkout\.stripe\.com)\//.test(data.url))throw new Error(data.error||'Checkout is unavailable');
      window.location.assign(data.url);
    }catch(e){
      error.textContent=e.message||'Please try again or contact support.';
      confirm.disabled=false;confirm.textContent='Continue to secure Stripe checkout ↗';
    }
  });
})();