(() => {
  'use strict';
  const form=document.getElementById('feedback-form');
  const message=document.getElementById('feedback-status');
  const submit=document.getElementById('feedback-submit');
  const list=document.getElementById('published-comments');
  const count=document.getElementById('comment-count');
  if(!form||!message||!submit||!list)return;
  const limits={name:80,email:180,orderReference:90,comment:1600};
  const visibleText=(text,max)=>typeof text==='string'?text.trim().slice(0,max):'';
  const loadApproved=async()=>{
    try{
      const r=await fetch('/reviews.json',{cache:'no-store'});
      if(!r.ok)throw new Error('Cannot load reviews');
      const j=await r.json();
      const reviews=Array.isArray(j.reviews)?j.reviews.filter(x=>x&&typeof x.name==='string'&&typeof x.comment==='string'&&Number.isInteger(x.rating)&&x.rating>=1&&x.rating<=5).slice(0,30):[];
      list.replaceChildren();
      if(!reviews.length){
        const empty=document.createElement('p');
        empty.className='feedback-empty';
        empty.textContent='No customer comments have been published yet. Be among the first to share your experience.';
        list.appendChild(empty);
        if(count)count.textContent='No published customer comments yet';
        return;
      }
      if(count)count.textContent=reviews.length+' published customer comment'+(reviews.length===1?'':'s');
      for(const item of reviews){
        const article=document.createElement('article');article.className='review-entry';
        const top=document.createElement('div');top.className='review-meta';
        const name=document.createElement('strong');name.textContent=visibleText(item.name,80);
        const rating=document.createElement('span');rating.className='customer-stars';rating.setAttribute('aria-label',item.rating+' out of 5, website customer feedback');rating.textContent='★'.repeat(item.rating)+'☆'.repeat(5-item.rating);
        const quote=document.createElement('p');quote.textContent=visibleText(item.comment,1600);
        top.append(name,rating);article.append(top,quote);
        if(/^\\d{4}-\\d{2}-\\d{2}$/.test(item.date||'')){
          const date=document.createElement('small');date.textContent=item.date;article.appendChild(date);
        }
        list.appendChild(article);
      }
    }catch{
      if(count)count.textContent='Customer feedback';
      list.textContent='Published comments are temporarily unavailable. You can still send us your experience below.';
    }
  };
  loadApproved();
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!form.reportValidity())return;
    const get=name=>String(new FormData(form).get(name)||'');
    const payload={
      name:visibleText(get('name'),limits.name),
      email:visibleText(get('email'),limits.email),
      orderReference:visibleText(get('orderReference'),limits.orderReference),
      rating:Number(get('rating')),
      comment:visibleText(get('comment'),limits.comment),
      publishConsent:form.elements.namedItem('publishConsent')?.checked===true,
      privacyAcknowledged:form.elements.namedItem('privacyAcknowledged')?.checked===true,
      honey:get('honey')
    };
    if(payload.comment.length<25){message.textContent='Please write at least 25 characters about your experience.';return;}
    if(!payload.publishConsent||!payload.privacyAcknowledged){message.textContent='Please confirm both permissions before submitting.';return;}
    submit.disabled=true;submit.textContent='Sending feedback…';
    message.textContent='';
    try{
      const response=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Unable to submit feedback. Please try again.');
      form.reset();
      message.textContent='Thank you. Your feedback has been sent to our business inbox for review. It is not publicly displayed yet.';
      message.classList.add('success');
    }catch(err){
      message.textContent=err.message||'Please try again or email our support team.';
      message.classList.remove('success');
    }finally{submit.disabled=false;submit.textContent='Submit your comment →';}
  });
})();