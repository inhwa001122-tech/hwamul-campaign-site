import { getStore } from '@netlify/blobs';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const SID = 'hwamul-campaign-v1';
const storeContent = () => getStore({ name: `${SID}-site`, consistency: 'strong' });
const storeBoards = () => getStore({ name: `${SID}-messages`, consistency: 'strong' });
const storeFiles = () => getStore({ name: `${SID}-media`, consistency: 'strong' });
const storeRate = () => getStore({ name: `${SID}-anti-spam`, consistency: 'strong' });
const MAX_FILE = 3_000_000;
// Add the two special promises to previously saved site data exactly once.
// Preserve the other policies, uploaded images, copy, site settings, and admin edits.
const SPECIAL_PROMISES = [{"id":"special-accountability","kind":"special","title":"공약 이행, 조합원에게 평가받겠습니다!","eyebrow":"특별한 약속 1","sections":[{"title":"","points":["임원 공약 이행 현황과 주요 사업 추진 결과 매 대의원대회 전후 조합원 온오프라인 보고"]}]},{"id":"special-disclosure","kind":"special","title":"후보자부터 재산공개! 투명하고 책임 있는 화물연대!","eyebrow":"특별한 약속 2","sections":[{"title":"","points":["본부 임원후보자 재산공개제도 도입 추진","조합원 의견수렴을 통해 공개 범위와 방식 등 제도화 방안 마련"]}]}];
const includeSpecialPromises = site => {
  if(!site || !Array.isArray(site.policies) || site._migrations?.specialPromisesV1 === true) return site;
  const existing=new Set(site.policies.map(p=>String(p.id)));
  const existingTitles=new Set(site.policies.map(p=>String(p.title)));
  const missing=SPECIAL_PROMISES.filter(p=>!existing.has(p.id)&&!existingTitles.has(p.title));
  return {...site,policies:[...site.policies,...missing],_migrations:{...(site._migrations||{}),specialPromisesV1:true}};
};

const json = (body, status = 200, extraHeaders = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extraHeaders } });
const err = (message, code = 400) => json({ ok: false, error: message }, code);
const text = (value, max=2500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const adminSecret = () => process.env.SESSION_SECRET || '';
const adminPassword = () => process.env.ADMIN_PASSWORD || '';
const isReady = () => adminSecret().length >= 24 && adminPassword().length >= 12;
const b64url = s => Buffer.from(s).toString('base64url');
const signature = v => createHmac('sha256', adminSecret()).update(v).digest('base64url');
const goodCookie = request => {
  if (!isReady()) return false;
  const raw = (request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('hwamul_admin='));
  if (!raw) return false;
  const c = raw.slice('hwamul_admin='.length);
  const sep=c.lastIndexOf('.'); if(sep<0)return false;
  const value = c.slice(0,sep),sig=c.slice(sep+1), want=signature(value);
  if(sig.length!==want.length || !timingSafeEqual(Buffer.from(sig),Buffer.from(want)))return false;
  try {const p=JSON.parse(Buffer.from(value,'base64url').toString());return p.role==='editor' && Date.now()<p.exp;}catch{return false;}
};
const cookieValue = () => {
  const body=b64url(JSON.stringify({ role:'editor', exp:Date.now()+8*3600_000 }));
  return `${body}.${signature(body)}`;
};
const sameOrigin = request => {
  const origin=request.headers.get('origin');
  if(!origin)return true;
  try {return new URL(origin).host === new URL(request.url).host;}catch{return false;}
};
const jsonBody = async request => {
  if(Number(request.headers.get('content-length')) > 1400000) throw new Error('입력할 수 있는 최대 크기를 초과했습니다.');
  return await request.json();
};
const verifyAdmin = request => goodCookie(request) ? null : err('관리자 로그인이 필요합니다.', 401);
const validId = id => /^[\w-]{6,80}$/.test(id||'');
const defaultHeaders = {'cache-control':'no-store','x-content-type-options':'nosniff'};
async function loadBoard(type, administrator=false) {
  const st=storeBoards();
  const prefix='proposal/';
  const result=await st.list({prefix});
  const rows=await Promise.all((result.blobs||[]).slice(0,1000).map(async ({key})=>st.get(key,{type:'json'})));
  return rows.filter(Boolean).filter(r=>administrator || r.visible!==false).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,150);
}
function publicBoardRow(row,administrator) {
  const {id,type,title,name,category,body,status,reply,createdAt,visible}=row;
  return {id,type,title,name,category,body,status,reply,createdAt,...(administrator?{visible}: {})};
}
async function countProposals() {
  // list() automatically includes every page, not only the first 1,000 entries.
  const { blobs }=await storeBoards().list({prefix:'proposal/'});
  return (blobs||[]).length;
}
async function rateLimit(request) {
  const ip=request.headers.get('x-nf-client-connection-ip') || (request.headers.get('x-forwarded-for')||'').split(',')[0]?.trim() || 'unknown';
  // Do not store raw IP addresses. The HMAC is a short-lived anti-spam identifier.
  const key=createHmac('sha256',adminSecret()||'web-guard').update(`${ip}-${new Date().toISOString().slice(0,10)}`).digest('hex');
  const st=storeRate(), previous=await st.get(`post/${key}`,{type:'json'});
  const now=Date.now();
  if(previous && now-Number(previous.last)<25_000) return false;
  await st.setJSON(`post/${key}`,{last:now});
  return true;
}

export default async function handler(request) {
  const url=new URL(request.url),action=url.searchParams.get('action')||'site',method=request.method.toUpperCase();
  if(method!=='GET' && !sameOrigin(request)) return err('허용되지 않은 요청입니다.',403);
  try {
    if(action==='health' && method==='GET')return json({ok:true,storage:'netlify-blobs',adminConfigured:isReady()});
    if(action==='whoami' && method==='GET')return json({ok:true,admin:goodCookie(request),ready:isReady()});
    if(action==='login' && method==='POST') {
      if(!isReady())return err('관리자 환경변수 설정이 필요합니다. README를 확인해 주세요.',503);
      const {password}=await jsonBody(request);
      const actual=createHash('sha256').update(String(password||'')).digest();
      const expected=createHash('sha256').update(adminPassword()).digest();
      if(!timingSafeEqual(actual,expected))return err('비밀번호가 올바르지 않습니다.',401);
      return json({ok:true,admin:true},200,{'set-cookie':`hwamul_admin=${cookieValue()}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800`});
    }
    if(action==='logout' && method==='POST')return json({ok:true},200,{'set-cookie':'hwamul_admin=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0'});
    if(action==='site' && method==='GET') {
      const existing=await storeContent().get('site/main',{type:'json'});
      return json({ok:true,site:includeSpecialPromises(existing)||null});
    }
    if(action==='site' && method==='PUT') {
      const auth=verifyAdmin(request);if(auth)return auth;
      const body=await jsonBody(request);
      const site=includeSpecialPromises(body?.site);
      if(!site || !Array.isArray(site.candidates) || !Array.isArray(site.policies) || !Array.isArray(site.manifesto) || !Array.isArray(site.news) || !Array.isArray(site.resources) || !site.hero)return err('홈페이지 자료 형식이 올바르지 않습니다.');
      const encoded=JSON.stringify(site);
      if(encoded.length>1_200_000)return err('홈페이지 데이터가 너무 큽니다. 큰 사진은 파일 업로드 기능을 사용해 주세요.');
      await storeContent().setJSON('site/main',site);
      return json({ok:true});
    }
    if(action==='board' && method==='GET') {
      const type=url.searchParams.get('type');
      if(type!=='proposal')return err('운영하지 않는 게시판입니다.',404);
      const isAdmin=goodCookie(request);
      const count=await countProposals();
      if(!isAdmin)return json({ok:true,count,items:[]}); // Never send private proposal data to visitors.
      const rows=await loadBoard('proposal',true);
      return json({ok:true,count,items:rows.map(r=>publicBoardRow(r,true))});
    }
    if(action==='board' && method==='POST') {
      const data=await jsonBody(request);
      if(text(data?.website,100))return err('게시글을 등록할 수 없습니다.'); // honeypot
      const type=text(data?.type,20);
      if(type!=='proposal')return err('운영하지 않는 게시판입니다.',404);
      const body=text(data?.body,1500),title=text(data?.title,110),name=text(data?.name,25)||'익명',category=text(data?.category,30);
      if(body.length<5 || title.length<2)return err('제목과 본문을 확인해 주세요.');
      if(data?.consent!==true)return err('비공개 정책제안 접수에 동의해 주세요.');
      if(!await rateLimit(request))return err('연속 등록은 잠시 후 다시 시도해 주세요.',429);
      const id=randomUUID();
      const row={id,type,title,name,category,body,status:'접수',reply:'',visible:false,createdAt:new Date().toISOString()};
      await storeBoards().setJSON(`${type}/${id}`,row,{onlyIfNew:true});
      return json({ok:true,count:await countProposals()},201);
    }
    if(action==='board' && method==='PATCH') {
      const auth=verifyAdmin(request);if(auth)return auth;
      const data=await jsonBody(request);
      const type=text(data?.type,20),id=text(data?.id,100);
      if(type!=='proposal'||!validId(id))return err('게시물 정보가 올바르지 않습니다.',404);
      const store=storeBoards(),key=`${type}/${id}`;
      const existing=await store.get(key,{type:'json'});if(!existing)return err('게시물이 없습니다.',404);
      const next={...existing,status:text(data.status,20)||existing.status,reply:text(data.reply,1200),visible:false};
      await store.setJSON(key,next);
      return json({ok:true,item:publicBoardRow(next,true)});
    }
    if(action==='board' && method==='DELETE') {
      const auth=verifyAdmin(request);if(auth)return auth;
      const data=await jsonBody(request),type=text(data?.type,20),id=text(data?.id,100);
      if(type!=='proposal'||!validId(id))return err('게시물 정보가 올바르지 않습니다.',404);
      await storeBoards().delete(`${type}/${id}`);
      return json({ok:true});
    }
    if(action==='upload' && method==='POST') {
      const auth=verifyAdmin(request);if(auth)return auth;
      const file=(await request.formData()).get('file');
      if(!file || typeof file.arrayBuffer!=='function')return err('파일을 선택해 주세요.');
      if(file.size>MAX_FILE)return err('파일 크기는 3MB 이하여야 합니다. 동영상은 유튜브 링크로 등록해 주세요.');
      const mime=file.type.toLowerCase();
      if(!['image/webp','image/png','image/jpeg','image/gif','application/pdf'].includes(mime))return err('JPG, PNG, WebP, GIF, PDF 파일만 지원합니다.');
      const bytes=await file.arrayBuffer();
      // Guard against MIME spoofing for non-text uploads.
      const sig=Buffer.from(bytes.slice(0,16));
      const valid=(mime==='application/pdf'&&sig.subarray(0,4).toString()==='%PDF')||
        (mime==='image/png'&&sig.subarray(0,4).equals(Buffer.from([137,80,78,71])))||
        (mime==='image/jpeg'&&sig[0]===0xff&&sig[1]===0xd8)||
        (mime==='image/gif'&&sig.subarray(0,3).toString()==='GIF')||
        (mime==='image/webp'&&sig.subarray(0,4).toString()==='RIFF'&&sig.subarray(8,12).toString()==='WEBP');
      if(!valid)return err('파일 형식이 올바르지 않습니다.');
      const id=randomUUID();
      await storeFiles().set(`f/${id}`,bytes,{metadata:{mime,name:text(file.name,90)}});
      return json({ok:true,url:`/api?action=media&id=${id}`,name:text(file.name,90)});
    }
    if(action==='media' && method==='GET') {
      const id=url.searchParams.get('id');if(!validId(id))return err('파일 정보가 올바르지 않습니다.',404);
      const found=await storeFiles().getWithMetadata(`f/${id}`,{type:'arrayBuffer'});
      if(!found)return err('파일을 찾을 수 없습니다.',404);
      const mime=found.metadata?.mime||'application/octet-stream';
      const filename=encodeURIComponent(found.metadata?.name||'자료');
      return new Response(found.data,{headers:{...defaultHeaders,'content-type':mime,'content-disposition':`inline; filename*=UTF-8''${filename}`}});
    }
    return err('지원하지 않는 요청입니다.',404);
  }catch(error){
    console.error('campaign API error',error);
    return err('서버에서 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',500);
  }
}
