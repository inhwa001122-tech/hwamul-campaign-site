(() => {
'use strict';
const NAV=[
  ['home','홈'],['candidates','후보 소개'],['manifesto','출마의 변'],['policy','정책·공약'],
  ['proposal','정책제안'],['news','선거 소식'],['resources','자료실']
];
const $=selector=>document.querySelector(selector);
const demoCache={};
const localGet=k=>{try{return localStorage.getItem(k)}catch{return demoCache[k]??null}};
const localSet=(k,v)=>{demoCache[k]=v;try{localStorage.setItem(k,v)}catch{}};
const state={site:null,admin:false,backend:false,preview:false,page:'home',mobile:false,manifesto:0,policyKind:'change',selectedPolicy:null,boardFilter:'전체',proposalCount:0,boards:{proposal:[]}};
const clone=v=>JSON.parse(JSON.stringify(v));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=v=>{
 const s=String(v||'').trim();
 if(/^\/(?!\/)/.test(s)||/^https:\/\//i.test(s)||/^data:image\/(png|webp|jpeg|gif);base64,/i.test(s))return esc(s);
 return '';
};
const attrs=(name,value)=>`${name}="${esc(value)}"`;
const formatDate=v=>{if(!v)return '';const d=new Date(v);return isNaN(d.getTime())?'':new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'}).format(d)};
const publicHttpsUrl=v=>{ const value=String(v||'').trim(); return /^https:\/\/[^\s<>'\"]+$/i.test(value)?esc(value):''; };
const newBadge=v=>{if(!v)return '';let t=new Date(v).getTime();return isNaN(t)||Date.now()-t>3*86400000?'':'<span class="new-badge">NEW</span>'};
const apiUrl=(action,more='')=>`/api?action=${action}${more}`;
function toast(msg){let el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3500);}
async function api(action,{method='GET',data,form,extra=''}={}){
 const opts={method,credentials:'same-origin',headers:{}};
 if(data!==undefined){opts.headers['content-type']='application/json';opts.body=JSON.stringify(data)}
 if(form)opts.body=form;
 const r=await fetch(apiUrl(action,extra),opts);
 let body;try{body=await r.json()}catch{throw new Error('서버 응답을 읽지 못했습니다.')} 
 if(!r.ok || body.ok===false)throw new Error(body.error||'요청을 처리하지 못했습니다.');
 return body;
}
function editButton(kind,id,caption='수정'){
 if(!state.admin)return '';
 return `<button class="inline-edit" type="button" data-edit="${esc(kind)}" data-id="${esc(id||'')}">✎ ${esc(caption)}</button>`;
}
function navButton(page,label,mode='desktop'){
 return `<button class="nav-item ${state.page===page?'active':''} ${page==='proposal'?'proposal-nav':''}" type="button" data-nav="${page}" aria-current="${state.page===page?'page':'false'}">${label}</button>`;
}
function updateNav(){
 $('#desktop-nav').innerHTML=NAV.map(x=>navButton(...x)).join('');
 $('#mobile-nav').innerHTML=NAV.map(x=>navButton(...x,'mobile')).join('');
 $('#mobile-menu-button').setAttribute('aria-expanded',String(state.mobile));
 $('#mobile-nav').hidden=!state.mobile;
 $('#admin-button').classList.toggle('logged',state.admin);
 $('#admin-button').title=state.admin?'관리자 메뉴':'관리자 로그인';
}
function banner(){
 const n=$('#notice-area');
 n.innerHTML='';
 if(state.preview)n.innerHTML='<div class="banner-notice"><b>미리보기 모드</b> · 이 환경에서 등록한 글과 수정 내용은 현재 브라우저에만 저장됩니다. Netlify 배포 후에는 방문자와 내용이 공유됩니다.</div>';
}
function adminRibbon(){return state.admin?'<div class="admin-ribbon"><div class="container"><span>관리자 편집 모드 · 화면의 <b>수정</b> 버튼으로 바로 편집할 수 있습니다.</span><button type="button" data-admin-menu>관리자 메뉴</button></div></div>':'';}
function head(kicker,title,desc){return `<section class="page-head"><div class="container">${kicker?`<div class="topline"><span class="eyebrow">${esc(kicker)}</span></div>`:''}<h1>${esc(title)}</h1><p class="subcopy">${esc(desc)}</p></div></section>`;}
function home(){
 const hero=state.site.hero;
 return `<section class="hero edit-area">${editButton('hero','','메인 편집')}<div class="container hero-grid">
 <div class="hero-copy"><div class="hero-eyebrow">${esc(hero.eyebrow)}</div>
 ${safeUrl(hero.sloganImage)?`<img class="hero-logo" src="${safeUrl(hero.sloganImage)}" alt="2 판을 뒤집자">`:`<h1 class="hero-title-fallback">${esc(hero.title)}</h1>`}
 <h1 class="sr-only">${esc(hero.title)} — 장정훈, 공성일, 오영학</h1>
 <p class="hero-subtitle">${esc(hero.subtitle)}</p>
 <div class="hero-actions"><button class="btn btn-primary" data-nav="proposal">정책제안하기</button><button class="btn btn-dark" data-nav="policy">4+2 핵심공약 보기</button></div></div>
 <div class="hero-image-wrap"><img class="hero-photo" src="${safeUrl(hero.image)}" alt="왼쪽부터 공성일 수석부위원장 후보, 장정훈 위원장 후보, 오영학 사무처장 후보"></div></div></section>
 <section class="hero-bottom edit-area">${editButton('settings','','하단 문구·채널 수정')}<div class="container"><div class="hero-bottom-claim">${esc(state.site.settings?.bottomClaim||'현장의 목소리가\n조직의 결정이 되는 화물연대').replace(/\n/g,'<br>')}</div><button class="hero-bottom-link" data-nav="manifesto">출마의 변 읽기</button><button class="hero-bottom-link" data-nav="candidates">후보자 알아보기</button></div></section>
`;
}
function candidates(){
 const studio=state.site.gallery?.find(g=>g.id==='studio-portrait')||{image:'/assets/three-studio-cutout.webp',title:'후보 3인 스튜디오 사진',description:'공성일 · 장정훈 · 오영학'};
 const order=['gong','jang','oh'];let cards=order.map(id=>state.site.candidates.find(c=>c.id===id)).filter(Boolean);
 return head('','후보 소개','위원장 장정훈 · 수석부위원장 공성일 · 사무처장 오영학')+`<section class="section-pad"><div class="container"><div class="candidate-overview">${cards.map(c=>`<article class="candidate-card ${c.id==='jang'?'main':''} edit-area">${editButton('candidate',c.id,'후보 수정')}<div class="candidate-photo-zone"><img src="${safeUrl(c.photo)}" alt="${esc(c.name)} ${esc(c.role)}"></div><div class="candidate-info"><span class="candidate-role">${esc(c.role)}</span><h2>${esc(c.name)}</h2><ul class="career-list">${c.bio.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></div></article>`).join('')}</div></div></section>
 <section class="candidate-gallery edit-area">${editButton('gallery',studio.id||'studio-portrait','단체사진 수정')}<div class="container candidate-gallery-grid"><div><h2>세 사람이 함께하는<br>새로운 화물연대</h2><p>공성일 수석부위원장 후보 · 장정훈 위원장 후보 · 오영학 사무처장 후보</p></div><div><img loading="lazy" src="${safeUrl(studio.image)}" alt="${esc(studio.title)}"></div></div></section>`;
}
function manifesto(){
 const entries=state.site.manifesto;let current=entries[state.manifesto]||entries[0];
 return head('MANIFESTO','출마의 변','후보들이 제시한 조직 운영의 방향과 산업 변화에 대한 준비를 확인할 수 있습니다.')+`<section class="section-pad manifesto-paper"><div class="container"><div class="manifesto-tabs">${entries.map((m,i)=>`<button class="pill ${i===state.manifesto?'active':''}" data-manifesto="${i}">${i===0?'조합원이 주인인 화물연대로':'변화를 주도하는 화물연대로'}</button>`).join('')}</div><article class="manifesto-article edit-area">${editButton('manifesto',current.id)}<div class="eyebrow" style="margin-bottom:22px">판을 뒤집자 · ${String(state.manifesto+1).padStart(2,'0')}</div><h2>${esc(current.title)}</h2><h3 class="manifesto-lead">${esc(current.lead)}</h3><p class="manifesto-catch">${esc(current.catch)}</p><div class="article-body">${esc(current.body)}</div></article></div></section>`;
}
function policy(){
 const ps=state.site.policies.filter(x=>x.kind===state.policyKind);
 const detail=ps.find(p=>p.id===state.selectedPolicy);
 return head('CORE POLICIES + SPECIAL PROMISES','정책·공약','4대 핵심공약 · 2대 조직공약 · 특별한 약속 2가지')+`<section class="section-pad"><div class="container"><div class="policy-switch"><button data-policy-kind="change" class="${state.policyKind==='change'?'active':''}"><span class="policy-label-desktop">변화를 주도하는 4대 핵심공약</span><span class="policy-label-mobile">4대 핵심공약</span></button><button data-policy-kind="organization" class="${state.policyKind==='organization'?'active':''}"><span class="policy-label-desktop">아래로부터 새로 쓰는 2대 핵심공약</span><span class="policy-label-mobile">2대 핵심공약</span></button><button data-policy-kind="special" class="${state.policyKind==='special'?'active':''}">특별 공약</button></div><div class="policy-grid">
 ${ps.map((p,i)=>`<button class="policy-card" type="button" data-policy-id="${esc(p.id)}"><span class="count">${String(i+1).padStart(2,'0')}</span><h3>${esc(p.title)}</h3><span class="sub">${esc(p.eyebrow)} · 자세히 보기</span></button>`).join('')}</div>
 ${state.admin?`<button class="admin-add" data-add="policy">＋ 이 그룹에 공약 추가</button>`:''}
 <div class="policy-detail ${detail?'open':''}" id="policy-detail" aria-live="polite">${detail?`<div class="policy-detail-header edit-area">${editButton('policy',detail.id)}<div class="eyebrow">${esc(detail.eyebrow)} · 정책 상세</div><h2>${esc(detail.title)}</h2></div><div class="policy-detail-body">${detail.sections.map(s=>`<section class="policy-subsection">${s.title?`<h3>${esc(s.title)}</h3>`:''}<ul>${s.points.map(point=>`<li>${esc(point)}</li>`).join('')}</ul></section>`).join('')}</div>`:''}</div></div></section>`;
}
function boardHeader(){
 return head('YOUR VOICE · POLICY PROPOSALS','정책제안','현장의 정책제안은 비공개로 접수합니다. 제안 내용은 선거운동본부 관리자만 확인하며 접수 건수만 공개합니다.');
}
function boardCard(item){
 return `<article class="board-card"><div class="board-meta"><span class="category-label">${esc(item.category||'정책제안')}</span><span>·</span><span>${esc(item.name||'익명')}</span><span>·</span><time>${formatDate(item.createdAt)}</time><span class="status-chip ${item.status==='반영'?'done':''}">${esc(item.status||'접수')}</span><span class="status-chip">비공개</span></div><h3>${esc(item.title)}</h3><p>${esc(item.body)}</p>${item.reply?`<div class="board-reply"><b>선본 답변 (관리자 전용)</b><p>${esc(item.reply)}</p></div>`:''}<div class="board-actions"><button class="btn btn-sm btn-outline" data-board-edit="proposal" data-id="${esc(item.id)}">답변·관리</button></div></article>`;
}
function board(){
 const items=state.boards.proposal;
 const count=Number.isFinite(state.proposalCount)?state.proposalCount:0;
 const categories=['전체','안전운임','지입제','플랫폼','노동기본권','조직 민주주의','산업전환','기타'];
 const filtered=state.boardFilter==='전체'?items:items.filter(x=>x.category===state.boardFilter);
 return boardHeader()+`<section class="section-pad"><div class="container board-layout"><aside class="board-side"><div class="eyebrow" style="color:#f48c96;margin-bottom:15px">POLICY SUGGESTION</div><h2>현장에서 필요한<br>정책을 말씀해 주세요.</h2><p>작성하신 제안은 비공개로 접수됩니다. 제안 내용과 작성자 정보는 공개되지 않으며 선거운동본부 관리자만 확인합니다.</p><button class="btn btn-primary" data-compose="proposal">＋ 정책제안 작성하기</button><div class="decor-number">02</div></aside><div class="proposal-board-main"><div class="proposal-count"><div class="proposal-count-label">지금까지 접수된 정책제안</div><div class="proposal-count-number" aria-live="polite">${count.toLocaleString('ko-KR')}<span>건</span></div><p>제안 내용은 비공개이며 접수 건수만 공개합니다.</p></div>${!state.backend&&!state.preview?'<div class="board-error"><b>게시판 서버 연결 전입니다.</b> Netlify 배포와 관리자 설정을 완료하면 실제 제안 작성과 게시물 저장이 가능합니다.</div>':''}${state.admin?`<div class="proposal-admin-only"><div class="board-list-head"><h2>관리자 전용 · 정책제안 목록</h2><span class="muted" style="font-size:12px">외부에 공개되지 않습니다.</span></div><div class="filter-row">${categories.map(c=>`<button class="pill ${state.boardFilter===c?'active':''}" data-board-filter="${esc(c)}">${esc(c)}</button>`).join('')}</div><div class="board-list">${filtered.length?filtered.map(boardCard).join(''):'<div class="board-empty"><b>접수된 정책제안이 없습니다.</b></div>'}</div></div>`:''}</div></div></section>`;
}
function newsVideoMedia(link,orientation='auto',title='선거 영상'){
 const raw=String(link||'').trim();if(!raw)return '';
 let parsed;try{parsed=new URL(raw)}catch{return ''}
 if(parsed.protocol!=='https:')return '';
 const host=parsed.hostname.toLowerCase().replace(/^www\./,'').replace(/^m\./,'');
 let id='',portrait=false;
 if(host==='youtu.be') id=parsed.pathname.split('/').filter(Boolean)[0]||'';
 else if(host==='youtube.com'||host==='youtube-nocookie.com'){
  const parts=parsed.pathname.split('/').filter(Boolean);
  if(parts[0]==='shorts'){id=parts[1]||'';portrait=true}
  else if(parts[0]==='watch')id=parsed.searchParams.get('v')||'';
  else if(parts[0]==='embed'||parts[0]==='live')id=parts[1]||'';
 }
 if(/^[A-Za-z0-9_-]{11}$/.test(id)){
  const mode=orientation==='portrait'?'portrait':orientation==='landscape'?'landscape':portrait?'portrait':'landscape';
  return `<div class="news-video news-video--${mode}"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/${id}" title="${esc(title)}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
 }
 if(/\.(mp4|webm|ogv)$/i.test(parsed.pathname)){
  const mode=orientation==='portrait'?'portrait':orientation==='landscape'?'landscape':'native';
  return `<div class="news-video news-video--${mode}"><video controls playsinline preload="metadata" src="${esc(parsed.href)}" aria-label="${esc(title)}"></video></div>`;
 }
 return '';
}
function openNewsDetail(id){
 const row=state.site.news.find(n=>n.id===id);if(!row)return;
 const urls=[row.image,...(row.images||[])].filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i);
 const video=newsVideoMedia(row.link,row.videoOrientation,`${row.title} 영상`);
 openModal(row.title,`<div class="form-stack"><div class="board-meta"><span class="category-label">${esc(row.category||'현장 소식')}</span><span>${esc(row.date||'')}</span></div><p style="white-space:pre-line;line-height:1.95;color:#444951">${esc(row.body||'')}</p>${video}<div class="news-detail-gallery">${urls.map(src=>`<img loading="lazy" src="${safeUrl(src)}" alt="${esc(row.title)} 현장사진">`).join('')}</div>${!video&&safeUrl(row.link)?`<a class="btn btn-outline" target="_blank" rel="noopener noreferrer" href="${safeUrl(row.link)}">연결된 영상·자료 보기</a>`:''}</div>`,true);
}
function news(){
 const rows=state.site.news.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 return head('CAMPAIGN JOURNAL','선거 소식','후보들의 현장 활동, 사진, 영상, 선거운동 소식을 모아봅니다.')+`<section class="section-pad"><div class="container">${state.admin?'<button class="admin-add" data-add="news" style="margin:0 0 24px">＋ 선거 소식 추가</button>':''}${rows.length?`<div class="news-grid">${rows.map(row=>{
  const cover=safeUrl(row.image||(row.images||[])[0]);
  const video=newsVideoMedia(row.link,row.videoOrientation,`${row.title} 영상`);
  return `<article class="news-card edit-area">${editButton('news',row.id)}<div class="news-image ${!cover&&video?'news-image--video':''}">${cover?`<img loading="lazy" src="${cover}" alt="${esc(row.title)}">`:video||'<span class="muted">사진·영상</span>'}</div><div class="news-body"><small>${esc(row.category||'현장 소식')} · ${esc(row.date||'')}${newBadge(row.date)}</small><h3>${esc(row.title)}</h3><p>${esc(row.body)}</p></div><div class="news-foot"><button class="btn btn-sm btn-outline" data-news-detail="${esc(row.id)}">내용·사진 더 보기</button></div></article>`;
 }).join('')}</div>`:'<div class="empty-state"><h3>선거 소식을 준비하고 있습니다.</h3><p>현장 방문 사진과 영상이 등록되면 이곳에서 확인할 수 있습니다.</p></div>'}</div></section>`;
}
function resources(){
 const items=state.site.resources;
 return head('DOWNLOAD CENTER','자료실','포스터, 선거공보물, 정책자료, 홍보물을 내려받을 수 있습니다.')+`<section class="section-pad"><div class="container">${state.admin?'<button class="admin-add" data-add="resource" style="margin:0 0 27px">＋ 자료 추가</button>':''}<div class="resource-table">${items.length?items.map(f=>`<div class="resource-row edit-area">${editButton('resource',f.id)}<span class="resource-type">${esc(f.category||'자료')}</span><div><h3>${esc(f.title)}${newBadge(f.date)}</h3><p>${esc(f.description)}</p></div>${safeUrl(f.url)?`<a class="btn btn-sm btn-outline" href="${safeUrl(f.url)}" target="_blank" rel="noopener noreferrer">자료 보기</a>`:'<span class="muted">업로드 예정</span>'}</div>`).join(''):'<div class="empty-state">등록된 자료가 없습니다.</div>'}</div></div></section>`;
}
function renderFooter(){
 const target=$('#footer-dynamic'); if(!target)return;
 const settings=state.site?.settings||{},d=settings.donation||{},links=settings.social||{};
 const acct=String(d.account||'').replace(/[^0-9]/g,'');
 const bankVisible=d.enabled!==false && Boolean(acct);
 const youtube=publicHttpsUrl(links.youtube),kakao=publicHttpsUrl(links.kakao);
 const socialLinks=[youtube?`<a class="social-button" target="_blank" rel="noopener noreferrer" href="${youtube}">유튜브 채널</a>`:'',kakao?`<a class="social-button" target="_blank" rel="noopener noreferrer" href="${kakao}">카카오톡 채널</a>`:''].filter(Boolean).join('');
 target.innerHTML=`${state.admin?`<div class="footer-admin-tools"><button class="inline-edit" type="button" data-edit="settings" data-id="">✎ 후원계좌·채널 설정</button></div>`:''}<div class="footer-service">
 ${bankVisible?`<div class="donation-info"><span class="footer-eyebrow">후원계좌</span><div class="donation-details"><strong>${esc(d.bank||'은행')}</strong><span class="donation-account">${esc(acct)}</span><span class="donation-holder">예금주 ${esc(d.holder||'')}</span></div><button class="copy-account-button" type="button" data-copy-account>계좌번호 복사하기</button></div>`:''}
 ${socialLinks?`<div class="social-info"><span class="footer-eyebrow">선본 공식 채널</span><div class="social-buttons">${socialLinks}</div></div>`:''}
 </div>`;
}
function render(){
 if(!state.site)return;
 updateNav();banner();renderFooter();
 const func={home,candidates,manifesto,policy,proposal:()=>board(),news,resources}[state.page]||home;
 $('#app').innerHTML=adminRibbon()+func();
 document.title=`${NAV.find(n=>n[0]===state.page)?.[1]||'홈'} | 판을 뒤집자`;
}
function navigate(page){
 if(!NAV.some(n=>n[0]===page))page='home';
 state.page=page;state.mobile=false;state.selectedPolicy=null;state.boardFilter='전체';
 if(location.hash!==`#${page}`)history.pushState(null,'',`#${page}`);
 render();window.scrollTo({top:0,behavior:'instant'});
 if(page==='proposal')refreshBoard('proposal');
}
function openModal(title,content,wide=false){
 $('#modal-root').innerHTML=`<div class="modal-overlay" role="presentation"><div class="modal-card ${wide?'modal-wide':''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-top"><h2>${esc(title)}</h2><button type="button" class="modal-close" data-close aria-label="닫기">×</button></div><div class="modal-content">${content}</div></div></div>`;
 setTimeout(()=>$('#modal-root .modal-content input:not([type="hidden"]), #modal-root .modal-content textarea, #modal-root .modal-close')?.focus(),10);
}
function closeModal(){$('#modal-root').innerHTML='';}
function formField({name,label,value='',type='text',rows=5,hint='',upload=false,uploadMany=false,options=null}){
 const id='field-'+name;
 const labelMarkup=`<label for="${id}">${esc(label)}</label>`;
 const optionsMarkup=options?`<select id="${id}" name="${name}">${options.map(o=>`<option value="${esc(o[0])}" ${value===o[0]?'selected':''}>${esc(o[1])}</option>`).join('')}</select>`:'';
 const inputMarkup=optionsMarkup|| (type==='textarea'?`<textarea name="${name}" id="${id}" rows="${rows}">${esc(value)}</textarea>`:`<input type="${type}" name="${name}" id="${id}" value="${esc(value)}">`);
 return `<div class="field">${labelMarkup}${inputMarkup}${hint?`<span class="hint">${esc(hint)}</span>`:''}${upload?`<div class="file-upload"><label for="upload-${name}">${uploadMany?'사진 여러 장 업로드 (각 3MB 이하)':'사진·PDF 파일 업로드 (3MB 이하)'}</label><input id="upload-${name}" type="file" accept=".png,.jpg,.jpeg,.webp,.gif,.pdf" ${uploadMany?'multiple':''} data-file-field="${name}"><span class="hint" id="upload-status-${name}">선택한 파일이 저장되면 위 주소에 자동 입력됩니다.</span></div>`:''}</div>`;
}
const policyText=p=>p.sections.map(s=>(s.title?'## '+s.title+'\n':'')+s.points.map(x=>'• '+x).join('\n')).join('\n\n');
function parsePolicy(input){
 const rows=String(input||'').split(/\r?\n/),sections=[];
 for(const raw of rows){const line=raw.trim();if(!line)continue;
  if(line.startsWith('## '))sections.push({title:line.slice(3).trim(),points:[]});
  else {if(!sections.length)sections.push({title:'세부 공약',points:[]});sections.at(-1).points.push(line.replace(/^[•●✓\-]\s*/,''));}
 }
 return sections;
}
function findItem(kind,id){
 if(kind==='hero')return state.site.hero;
 if(kind==='candidate')return state.site.candidates.find(x=>x.id===id);
 if(kind==='manifesto')return state.site.manifesto.find(x=>x.id===id);
 if(kind==='policy')return state.site.policies.find(x=>x.id===id);
 if(kind==='news')return state.site.news.find(x=>x.id===id);
 if(kind==='resource')return state.site.resources.find(x=>x.id===id);
 if(kind==='gallery')return state.site.gallery?.find(x=>x.id===id);
 return null;
}
function openEditor(kind,id='',isNew=false){
 if(!state.admin)return;
 const obj=findItem(kind,id)||{};
 let fields='',title='편집';
 if(kind==='hero') {title='메인 화면 편집';fields=[
 {name:'eyebrow',label:'메인 상단 문구',value:obj.eyebrow},{name:'title',label:'메인 슬로건 (텍스트)',value:obj.title},{name:'subtitle',label:'설명 문구',value:obj.subtitle,type:'textarea',rows:2},
 {name:'sloganImage',label:'슬로건 이미지',value:obj.sloganImage,upload:true},{name:'image',label:'메인 후보 사진',value:obj.image,upload:true},{name:'posterImage',label:'포스터 미리보기 이미지',value:obj.posterImage,upload:true}].map(formField).join(''); }
 if(kind==='candidate'){title=(obj.name||'후보')+' 소개 편집';fields=[
 {name:'name',label:'후보 이름',value:obj.name},{name:'role',label:'후보 직책',value:obj.role},{name:'photo',label:'후보 대표 사진',value:obj.photo,upload:true},{name:'bio',label:'주요 약력 (한 줄에 하나씩)',value:(obj.bio||[]).join('\n'),type:'textarea',rows:8}].map(formField).join('');}
 if(kind==='manifesto'){title='출마의 변 수정';fields=[
 {name:'title',label:'제목',value:obj.title},{name:'lead',label:'도입 질문',value:obj.lead},{name:'catch',label:'핵심 문장',value:obj.catch},{name:'body',label:'전체 본문 (줄바꿈 유지)',value:obj.body,type:'textarea',rows:15}].map(formField).join('');}
 if(kind==='policy'){title=isNew?'공약 추가':'공약 수정';fields=[
 {name:'title',label:'공약 제목',value:obj.title},{name:'eyebrow',label:'공약 분류·키워드',value:obj.eyebrow},{name:'kind',label:'공약 그룹',value:obj.kind||state.policyKind,options:[['change','4대 변화 공약'],['organization','2대 조직 공약'],['special','특별 공약']]},
 {name:'sections',label:'세부 공약 내용',value:obj.sections?policyText(obj):'## 소제목\n• 세부 내용\n• 세부 내용',type:'textarea',rows:14,hint:'「## 소제목」으로 항목을 나누고 「•」로 세부 공약을 적어주세요. 화면에는 1-1 같은 번호가 표시되지 않습니다.'}].map(formField).join('');}
 if(kind==='news'){title=isNew?'선거 소식 추가':'선거 소식 수정';fields=[
 {name:'title',label:'제목',value:obj.title},{name:'category',label:'분류',value:obj.category||'현장 활동',options:[['현장 활동','현장 활동'],['영상','영상'],['공지','공지'],['사진','사진'],['기타','기타']]},
 {name:'date',label:'게시일 (YYYY-MM-DD)',value:obj.date||new Date().toISOString().slice(0,10)},{name:'body',label:'본문',value:obj.body,type:'textarea',rows:7},{name:'image',label:'대표 사진',value:obj.image,upload:true},{name:'images',label:'사진 여러 장 (주소를 한 줄씩)',value:(obj.images||[]).join('\n'),type:'textarea',rows:4,upload:true,uploadMany:true},{name:'link',label:'영상 또는 자세한 내용 링크 (선택)',value:obj.link||'',hint:'유튜브 일반 영상·쇼츠 또는 MP4/WebM 영상 주소를 입력하면 영상이 홈페이지 안에 표시됩니다.'},{name:'videoOrientation',label:'영상 화면 비율',value:obj.videoOrientation||'auto',options:[['auto','자동 (유튜브 쇼츠는 세로형)'],['portrait','세로형 (9:16)'],['landscape','가로형 (16:9)']]}].map(formField).join('');}
 if(kind==='settings'){
  title='후원계좌 · 채널 · 하단 문구 설정';
  const settings=state.site.settings||{},d=settings.donation||{},social=settings.social||{};
  fields=[
   {name:'bottomClaim',label:'메인 하단 소개 문구',value:settings.bottomClaim||'',type:'textarea',rows:2},
   {name:'donationEnabled',label:'후원계좌 홈페이지 표시',value:d.enabled===false?'hide':'show',options:[['show','표시'],['hide','숨김']]},
   {name:'donationBank',label:'은행명',value:d.bank||''},
   {name:'donationAccount',label:'계좌번호 (복사할 숫자)',value:d.account||''},
   {name:'donationHolder',label:'예금주',value:d.holder||''},
   {name:'youtube',label:'유튜브 채널 URL (없으면 비워 두세요)',value:social.youtube||'',hint:'HTTPS 링크가 등록되어야 방문자에게 유튜브 채널 버튼이 표시됩니다.'},
   {name:'kakao',label:'카카오톡 채널 URL (없으면 비워 두세요)',value:social.kakao||'',hint:'HTTPS 링크가 등록되어야 방문자에게 카카오톡 채널 버튼이 표시됩니다.'}
  ].map(formField).join('');
 }
 if(kind==='gallery'){title='단체사진 수정';fields=[{name:'title',label:'사진 이름',value:obj.title},{name:'image',label:'배경 제거한 후보 사진',value:obj.image,upload:true},{name:'description',label:'설명',value:obj.description}].map(formField).join('');}
 if(kind==='resource'){title=isNew?'자료 추가':'자료 수정';fields=[
 {name:'title',label:'자료 제목',value:obj.title},{name:'category',label:'자료 종류',value:obj.category||'홍보물',options:[['포스터','포스터'],['선거공보물','선거공보물'],['정책자료','정책자료'],['홍보물','홍보물'],['보도자료','보도자료'],['기타','기타']]},
 {name:'description',label:'간단한 설명',value:obj.description},{name:'url',label:'파일 또는 링크',value:obj.url||'',upload:true},{name:'date',label:'등록일',value:obj.date||new Date().toISOString().slice(0,10)}].map(formField).join('');}
 if(!fields)return;
 const removable=['news','resource','policy'].includes(kind)&&!isNew;
 openModal(title,`<form class="form-stack" id="edit-form" data-kind="${esc(kind)}" data-id="${esc(id)}" data-new="${String(isNew)}">${fields}<div class="modal-error" id="edit-error"></div><div class="form-submit">${removable?'<button type="button" class="btn btn-sm btn-outline" data-remove-entry>삭제</button>':''}<button type="button" class="btn btn-outline" data-close>취소</button><button type="submit" class="btn btn-primary">저장하고 반영</button></div></form>`,true);
}
async function saveSite(next,success='저장했습니다.'){
 if(state.preview){localSet('hwamul-preview-site',JSON.stringify(next));state.site=next;render();toast('미리보기 브라우저에 저장했습니다. (공개 반영 아님)');return true;}
 if(!state.backend){toast('Netlify 서버 연결 후 저장할 수 있습니다.');return false;}
 try{await api('site',{method:'PUT',data:{site:next}});state.site=next;render();toast(success);return true;}catch(e){toast('저장 실패: '+e.message);return false;}
}
async function submitEditor(form){
 const kind=form.dataset.kind,id=form.dataset.id,isNew=form.dataset.new==='true';
 const values=Object.fromEntries(new FormData(form).entries());
 const site=clone(state.site);
 if(kind==='settings'){
  const goodLink=v=>{const u=String(v||'').trim();if(!u)return '';try{const p=new URL(u);if(p.protocol==='https:' && p.hostname)return u;}catch{}throw new Error('유튜브·카카오톡 채널 주소는 https:// 로 시작하는 전체 링크를 입력해 주세요.');};
  site.settings={
   bottomClaim:String(values.bottomClaim||'').trim().slice(0,160),
   donation:{enabled:values.donationEnabled!=='hide',bank:String(values.donationBank||'').trim().slice(0,50),account:String(values.donationAccount||'').replace(/[^0-9]/g,''),holder:String(values.donationHolder||'').trim().slice(0,50)},
   social:{youtube:goodLink(values.youtube),kakao:goodLink(values.kakao)}
  };
  if(site.settings.donation.enabled && (!site.settings.donation.account || !site.settings.donation.bank))throw new Error('후원계좌를 표시하려면 은행명과 계좌번호를 입력해 주세요.');
  if(await saveSite(site)){closeModal();render();}return;
 }
 let target;
 if(kind==='hero')target=site.hero;
 if(kind==='candidate')target=site.candidates.find(x=>x.id===id);
 if(kind==='manifesto')target=site.manifesto.find(x=>x.id===id);
 if(kind==='policy'){target=isNew?{id:'pol-'+Date.now(),sections:[]}:site.policies.find(x=>x.id===id);}
 if(kind==='news')target=isNew?{id:'news-'+Date.now()}:site.news.find(x=>x.id===id);
 if(kind==='resource')target=isNew?{id:'resource-'+Date.now()}:site.resources.find(x=>x.id===id);
 if(kind==='gallery')target=(site.gallery||[]).find(x=>x.id===id);
 if(!target)throw new Error('편집 대상을 찾지 못했습니다.');
 for(const [key,val]of Object.entries(values)){
  if(key==='bio')target.bio=String(val).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  else if(key==='sections')target.sections=parsePolicy(val);
  else if(key==='images')target.images=String(val).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  else target[key]=String(val).trim();
 }
 if(kind==='policy'&&target.sections.length===0)throw new Error('세부 공약을 한 개 이상 입력해 주세요.');
 if(kind==='policy'&&target.kind==='special'&&target.sections.length===1&&target.sections[0].title==='세부 공약')target.sections[0].title='';
 if(isNew){if(kind==='policy')site.policies.push(target);if(kind==='news')site.news.push(target);if(kind==='resource')site.resources.push(target);}
 const done=await saveSite(site);if(done){closeModal();if(kind==='policy'){state.policyKind=target.kind;state.selectedPolicy=target.id;render();}}
}
function openCompose(type){
 if(type!=='proposal')return;
 if(!state.backend&&!state.preview){toast('실제 게시글 등록은 Netlify 서버 배포 후 가능합니다.');return;}
 const choices=['안전운임','지입제','플랫폼','노동기본권','조직 민주주의','산업전환','기타'];
 openModal('비공개 정책제안 작성하기',`<form class="form-stack" id="board-form" data-type="proposal"><div class="help-note">정책제안은 <b>비공개</b>로 접수됩니다. 제안 내용과 작성자 정보는 선거운동본부 관리자만 열람하며 일반 방문자에게는 전체 제안 건수만 표시됩니다. 필요하지 않은 개인정보는 입력하지 말아 주세요.</div><div class="form-row"><div class="field"><label for="board-name">이름 또는 별명</label><input id="board-name" name="name" maxlength="25" placeholder="익명" autocomplete="off"></div><div class="field"><label for="board-category">제안 분야</label><select id="board-category" name="category">${choices.map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div></div><div class="field"><label for="board-title">제안 제목 <span class="required">*</span></label><input id="board-title" name="title" maxlength="110" required placeholder="제안하고 싶은 내용을 한 줄로 적어주세요"></div><div class="field"><label for="board-body">정책제안 내용 <span class="required">*</span></label><textarea id="board-body" name="body" minlength="5" maxlength="1500" rows="8" required placeholder="현장에서 필요한 정책을 구체적으로 작성해 주세요."></textarea></div><div class="field" style="display:none"><label for="board-website">웹사이트</label><input id="board-website" name="website" tabindex="-1" autocomplete="off"></div><label class="check-line"><input type="checkbox" name="consent" value="yes" required> 정책제안이 비공개로 접수되고 선본 관리자가 내용을 확인하는 것에 동의합니다. <span class="required">*</span></label><div class="modal-error" id="board-error"></div><div class="form-submit"><button class="btn btn-outline" type="button" data-close>취소</button><button class="btn btn-primary" type="submit">비공개 정책제안 등록</button></div></form>`,true);
}
async function refreshBoard(type){
 if(type!=='proposal')return;
 if(state.preview){
  try{state.boards.proposal=JSON.parse(localGet('hwamul-preview-proposal')||'[]')}catch{state.boards.proposal=[]}
  state.proposalCount=state.boards.proposal.length;
 }else if(state.backend){
  try{
   const response=await api('board',{extra:'&type=proposal'});
   state.boards.proposal=Array.isArray(response.items)?response.items:[];
   state.proposalCount=Number.isFinite(response.count)?response.count:state.boards.proposal.length;
  }catch(e){toast('정책제안 현황을 불러오지 못했습니다: '+e.message)}
 }
 if(state.page==='proposal')render();
}
async function submitBoard(form){
 if(form.dataset.type!=='proposal')throw new Error('지원하지 않는 게시판입니다.');
 const fields=Object.fromEntries(new FormData(form).entries());
 const payload={type:'proposal',name:String(fields.name||'익명'),category:fields.category,title:fields.title,body:fields.body,website:fields.website||'',consent:fields.consent==='yes'};
 if(!payload.consent)throw new Error('비공개 정책제안 접수에 동의해 주세요.');
 if(state.preview){
  const row={...payload,id:'demo-'+Date.now(),visible:false,status:'접수',reply:'',createdAt:new Date().toISOString()};
  state.boards.proposal.unshift(row);localSet('hwamul-preview-proposal',JSON.stringify(state.boards.proposal));
 }else{await api('board',{method:'POST',data:payload});}
 closeModal();await refreshBoard('proposal');toast(state.preview?'미리보기 브라우저에만 등록되었습니다.':'정책제안이 비공개로 접수되었습니다.');render();
}
function openBoardEditor(type,id){
 if(!state.admin||type!=='proposal')return;
 const item=state.boards.proposal.find(x=>x.id===id);if(!item)return;
 openModal('비공개 정책제안 답변·관리',`<form id="board-edit-form" class="form-stack" data-type="proposal" data-id="${esc(id)}"><div class="help-note"><b>${esc(item.title)}</b><p style="margin-top:8px;white-space:pre-line">${esc(item.body)}</p><p style="margin-top:8px">이 제안 및 답변은 관리자에게만 표시됩니다.</p></div>${formField({name:'status',label:'처리 상태',value:item.status||'접수',options:[['접수','접수'],['검토중','검토중'],['답변완료','답변완료'],['반영','반영']]})}${formField({name:'reply',label:'선본 답변 (관리자 전용)',value:item.reply||'',type:'textarea',rows:7})}<div class="modal-error" id="board-edit-error"></div><div class="form-submit"><button type="button" data-delete-board class="btn btn-sm btn-outline">게시물 삭제</button><button type="button" data-close class="btn btn-outline">취소</button><button class="btn btn-primary" type="submit">저장</button></div></form>`,true);
}
async function submitBoardEdit(form){
 const type='proposal',id=form.dataset.id,fields=Object.fromEntries(new FormData(form).entries());const payload={type,id,status:fields.status,reply:fields.reply,visible:false};
 if(state.preview){const i=state.boards[type].findIndex(x=>x.id===id);state.boards[type][i]={...state.boards[type][i],...payload};localSet('hwamul-preview-'+type,JSON.stringify(state.boards[type]));}
 else await api('board',{method:'PATCH',data:payload});
 closeModal();await refreshBoard(type);render();toast('게시물 관리 내용이 저장됐습니다.');
}
function adminMenu(){
 openModal('관리자 메뉴',`<div class="form-stack"><p class="help-note">홈페이지에서 직접 내용을 편집할 수 있습니다. 각 페이지의 「✎ 수정」 버튼을 사용하세요.${state.preview?' 현재는 미리보기이므로 본인 브라우저에만 반영됩니다.':''}</p><button type="button" class="btn btn-outline" data-nav="home" data-close>메인 화면으로</button><button type="button" class="btn btn-outline" data-nav="policy" data-close>공약 관리로</button><button type="button" class="btn btn-outline" data-nav="news" data-close>선거 소식 관리로</button><button type="button" class="btn btn-outline" data-nav="resources" data-close>자료실 관리로</button><button type="button" class="btn btn-primary" data-edit="settings" data-id="">후원계좌·유튜브·카카오톡 설정</button><button type="button" class="btn btn-dark" data-logout>로그아웃</button></div>`);
}
function loginModal(){
 if(state.admin){adminMenu();return;}
 if(state.preview){
  openModal('미리보기 편집 모드',`<div class="form-stack"><p class="help-note">미리보기에서는 실제 관리자 비밀번호 없이 화면 편집을 체험할 수 있습니다. 이때 수정한 내용과 게시글은 현재 브라우저에만 남습니다. 정식 홈페이지에서는 서버에서 인증합니다.</p><button type="button" class="btn btn-primary" data-preview-login>미리보기 편집 시작</button></div>`);return;
 }
 if(!state.backend){
  openModal('관리자 로그인',`<p class="help-note">이 파일은 정적 미리보기 상태입니다. Netlify에 프로젝트를 배포하고 서버 기능을 연결하면 실제 홈페이지에서 수정할 수 있습니다.</p>`);return;
 }
 openModal('관리자 로그인',`<form id="login-form" class="form-stack"><div class="field"><label for="admin-password">관리자 비밀번호</label><input id="admin-password" name="password" type="password" autocomplete="current-password" required></div><p class="anon-note">Netlify 환경변수 ADMIN_PASSWORD로 설정된 비밀번호를 사용합니다.</p><div class="modal-error" id="login-error"></div><div class="form-submit"><button type="button" class="btn btn-outline" data-close>취소</button><button type="submit" class="btn btn-primary">로그인</button></div></form>`);
}
async function logout(){
 if(state.backend)try{await api('logout',{method:'POST'})}catch{}
 state.admin=false;render();closeModal();toast('관리자 모드를 종료했습니다.');
}
async function handleFile(input){
 const files=Array.from(input.files||[]);if(!files.length)return;
 const field=input.dataset.fileField,output=$(`#field-${field}`),status=$(`#upload-status-${field}`);
 if(!output)return;
 if(files.some(file=>file.size>3_000_000)){status.textContent='각 파일은 3MB 이하여야 합니다. 큰 사진은 압축해 주세요.';return;}
 status.textContent=`${files.length}개 파일 업로드 중…`;input.disabled=true;
 try{
  const urls=[];
  for(const file of files){
   let url;
   if(state.preview){
    if(!file.type.startsWith('image/'))throw new Error('미리보기에서는 이미지만 임시 등록할 수 있습니다.');
    url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('파일을 읽지 못했습니다.'));reader.readAsDataURL(file);});
   }else {const form=new FormData();form.append('file',file);url=(await api('upload',{method:'POST',form})).url;}
   urls.push(url);
  }
  output.value=input.multiple?[output.value.trim(),...urls].filter(Boolean).join('\n'):urls[0];
  status.textContent=`${urls.length}개 업로드 완료 · 저장을 누르면 홈페이지에 반영됩니다.`;
 }catch(e){status.textContent=e.message;}
 input.disabled=false;
}
async function init(){
 state.page=(location.hash||'#home').slice(1).split('?')[0];if(!NAV.some(x=>x[0]===state.page))state.page='home';
 try{state.site=window.__SITE_SEED || await (await fetch('/content/site.json',{cache:'no-store'})).json()}catch{ $('#app').innerHTML='<div class="empty-state"><h3>기본 자료를 불러오지 못했습니다.</h3><p>웹서버를 실행하거나 Netlify에 배포해 주세요.</p></div>';return;}
 try{const health=await api('health');state.backend=health.ok;if(state.backend){const remote=await api('site');if(remote.site)state.site=remote.site;state.admin=(await api('whoami')).admin;}}catch{state.backend=false;}
 state.preview=!state.backend && (Boolean(window.__SITE_DEMO_MODE)||location.protocol==='file:'||['localhost','127.0.0.1','[::1]'].includes(location.hostname));
 if(state.preview){try{const stored=JSON.parse(localGet('hwamul-preview-site'));if(stored&&stored.hero)state.site=stored;}catch{}}
 await refreshBoard('proposal');render();
}
document.addEventListener('click',async event=>{
 const t=event.target;
 if(t.closest('[data-nav]')){const el=t.closest('[data-nav]');event.preventDefault();closeModal();navigate(el.dataset.nav);return;}
 if(t.closest('[data-copy-account]')){
  const account=String(state.site?.settings?.donation?.account||'').replace(/[^0-9]/g,'');
  if(!account){toast('계좌번호가 등록되지 않았습니다.');return;}
  try{
   if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(account);
   else{const textarea=document.createElement('textarea');textarea.value=account;textarea.setAttribute('readonly','');textarea.style.position='fixed';textarea.style.opacity='0';document.body.appendChild(textarea);textarea.select();const ok=document.execCommand('copy');textarea.remove();if(!ok)throw new Error('복사할 수 없습니다.');}
   toast('계좌번호가 복사되었습니다.');
  }catch{toast('자동 복사가 제한되어 있습니다. 계좌번호를 길게 눌러 복사해 주세요.');}
  return;
 }
 if(t.closest('[data-close]')){closeModal();return;}
 if(t.closest('.modal-overlay')===t){closeModal();return;}
 if(t.closest('#mobile-menu-button')){state.mobile=!state.mobile;updateNav();return;}
 if(t.closest('#admin-button')||t.closest('[data-admin-menu]')){loginModal();return;}
 if(t.closest('[data-preview-login]')){state.admin=true;closeModal();render();toast('미리보기 편집 모드입니다.');return;}
 if(t.closest('[data-logout]')){await logout();return;}
 if(t.closest('[data-manifesto]')){state.manifesto=Number(t.closest('[data-manifesto]').dataset.manifesto);render();return;}
 if(t.closest('[data-policy-kind]')){state.policyKind=t.closest('[data-policy-kind]').dataset.policyKind;state.selectedPolicy=null;render();return;}
 if(t.closest('[data-policy-id]')){state.selectedPolicy=t.closest('[data-policy-id]').dataset.policyId;render();setTimeout(()=>$('#policy-detail')?.scrollIntoView({block:'start',behavior:'smooth'}),0);return;}
 if(t.closest('[data-news-detail]')){openNewsDetail(t.closest('[data-news-detail]').dataset.newsDetail);return;}
 if(t.closest('[data-board-filter]')){state.boardFilter=t.closest('[data-board-filter]').dataset.boardFilter;render();return;}
 if(t.closest('[data-compose]')){openCompose(t.closest('[data-compose]').dataset.compose);return;}
 if(t.closest('[data-edit]')){const el=t.closest('[data-edit]');openEditor(el.dataset.edit,el.dataset.id);return;}
 if(t.closest('[data-add]')){openEditor(t.closest('[data-add]').dataset.add,'',true);return;}
 if(t.closest('[data-board-edit]')){const el=t.closest('[data-board-edit]');openBoardEditor(el.dataset.boardEdit,el.dataset.id);return;}
 if(t.closest('[data-remove-entry]')){
  const f=$('#edit-form');if(!f||!window.confirm('이 항목을 삭제하시겠습니까?'))return;
  const kind=f.dataset.kind,id=f.dataset.id,prop={policy:'policies',news:'news',resource:'resources'}[kind];if(!prop)return;
  const site=clone(state.site);site[prop]=site[prop].filter(x=>x.id!==id);if(await saveSite(site)){closeModal();state.selectedPolicy=null;render();}return;
 }
 if(t.closest('[data-delete-board]')){
  const f=$('#board-edit-form');if(!f||!window.confirm('이 게시물을 완전히 삭제하시겠습니까?'))return;
  const type=f.dataset.type,id=f.dataset.id;
  try{if(state.preview){state.boards[type]=state.boards[type].filter(x=>x.id!==id);localSet('hwamul-preview-'+type,JSON.stringify(state.boards[type]));}else await api('board',{method:'DELETE',data:{type,id}});closeModal();await refreshBoard(type);render();toast('게시물을 삭제했습니다.');}catch(e){toast(e.message)}return;
 }
});
document.addEventListener('change',e=>{if(e.target.matches('[data-file-field]'))handleFile(e.target);});
document.addEventListener('submit',async e=>{
 const f=e.target;if(!['edit-form','board-form','board-edit-form','login-form'].includes(f.id))return;
 e.preventDefault();const submit=f.querySelector('[type="submit"]');if(submit){submit.disabled=true;submit.textContent='처리 중…';}
 const errBox=f.querySelector('.modal-error');if(errBox)errBox.textContent='';
 try{
  if(f.id==='edit-form')await submitEditor(f);
  if(f.id==='board-form')await submitBoard(f);
  if(f.id==='board-edit-form')await submitBoardEdit(f);
  if(f.id==='login-form'){
   const r=await api('login',{method:'POST',data:{password:f.elements.namedItem('password').value}});
   state.admin=r.admin;closeModal();render();await refreshBoard('proposal');toast('관리자 로그인 완료');
  }
 }catch(err){if(errBox)errBox.textContent=err.message;else toast(err.message)}
 if(submit.isConnected){submit.disabled=false;submit.textContent=f.id==='edit-form'?'저장하고 반영':f.id==='board-form'?'등록':'저장';}
});
window.addEventListener('popstate',()=>{const page=(location.hash||'#home').slice(1);state.page=NAV.some(x=>x[0]===page)?page:'home';render();window.scrollTo(0,0);});
window.addEventListener('hashchange',()=>{const page=(location.hash||'#home').slice(1);if(page!==state.page&&NAV.some(x=>x[0]===page)){state.page=page;render();window.scrollTo(0,0)}});
window.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
init();
})();
