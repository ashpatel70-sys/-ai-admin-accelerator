(() => {
  const btns=[...document.querySelectorAll('button.disabled[disabled]')];
  const notice=document.createElement('p');notice.id='payment-readiness';
  notice.style.cssText='font-size:.85rem;color:#60708c;text-align:center;margin:16px auto;max-width:660px';
  notice.setAttribute('role','status');
  notice.textContent='Checkout disabled: private-launch staging preview. No purchases are being accepted.';
  document.getElementById('pricing')?.querySelector('.wrap')?.appendChild(notice);
  let selected=null;
  const overlay=document.createElement('div');
  overlay.hidden=true;overlay.style.cssText='position:fixed;inset:0;background:#142042a8;z-index:999;display:none;align-items:center;justify-content:center;padding:20px';
  overlay.innerHTML='<div style="background:white;border-radius:18px;padding:28px;width:min(530px,100%);max-height:90vh;overflow:auto;box-shadow:0 15px 70px #171b3e55"><h2 style="margin-top:0">Confirm your purchase</h2><p id="item-description"></p><p style="font-size:.88rem">Read our <a href="/terms.html" target="_blank" rel="noopener" style="text-decoration:underline;color:#434dcf">terms and cancellation policy</a> and <a href="/privacy.html" target="_blank" rel="noopener" style="text-decoration:underline;color:#434dcf">privacy notice</a>.</p><label style="display:flex;gap:12px;align-items:flex-start;line-height:1.5"><input id="purchase-consent" type="checkbox" style="margin-top:6px"><span id="consent-words"></span></label><div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:24px"><button id="pay-confirm" style="background:#5056da;color:white;border:0;padding:13px 20px;border-radius:10px;cursor:pointer;font-weight:bold">Continue to Stripe</button><button id="pay-cancel" style="border:1px solid #ccd3e4;background:white;padding:13px 20px;border-radius:10px;cursor:pointer">Cancel</button></div><p id="pay-error" role="status" style="color:#ad2831"></p></div>';
  document.body.appendChild(overlay);
  function close(){overlay.hidden=true;overlay.style.display='none';selected=null;}
  document.getElementById('pay-cancel').addEventListener('click',close);
  overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)close()});
  fetch('/api/config',{cache:'no-store'}).then(r=>r.json()).then(cfg=>{
   if(!cfg.checkoutReady)return;
   notice.textContent='Secure Stripe checkout is available. Prices are in GBP.';
   btns.forEach((btn,i)=>{
    btn.disabled=false;btn.removeAttribute('aria-disabled');btn.style.cssText='background:#5056da;color:white;cursor:pointer';
    btn.textContent=i===0?'Buy toolkit — £29':'Book workflow review — £149';
    btn.addEventListener('click',()=>{
      selected=i===0?'toolkit':'audit';
      document.getElementById('purchase-consent').checked=false;
      document.getElementById('pay-error').textContent='';
      document.getElementById('item-description').textContent=selected==='toolkit'?'AI Admin Toolkit — £29 one-time download':'AI Workflow Review — £149 written personalised service';
      document.getElementById('consent-words').textContent=selected==='toolkit'
       ?'I expressly request immediate delivery of digital content and acknowledge that I lose the 14-day cancellation right once digital supply begins, where the statutory conditions are met. My rights regarding faulty content remain.'
       :'I have read the terms and expressly request the service to start after intake, including within 14 days. I understand applicable cancellation charges may be due for work already completed.';
      overlay.hidden=false;overlay.style.display='flex';
    });
   });
  }).catch(()=>{notice.textContent='Unable to verify checkout availability; purchasing remains disabled.'});
  document.getElementById('pay-confirm').addEventListener('click',async e=>{
   const error=document.getElementById('pay-error');
   if(!document.getElementById('purchase-consent').checked){error.textContent='Please tick the consent checkbox first.';return;}
   if(!selected)return;
   const button=e.currentTarget;button.disabled=true;button.textContent='Opening secure checkout…';
   try{
     const r=await fetch('/api/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({offer:selected,consent:true})});
     const data=await r.json();
     if(!r.ok||!data.url)throw new Error(data.error||'Checkout unavailable');
     location.href=data.url;
   }catch(e){error.textContent=e.message;button.disabled=false;button.textContent='Continue to Stripe'}
  });
})();
