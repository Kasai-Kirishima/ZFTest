/* Zero Football — self-contained browser prototype.
   Progress is saved locally in this browser. The matchmaking opponent is a bot in this version. */
(() => {
  'use strict';
  const STORE_KEY = 'zeroFootball.save.v1';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const COUNTRY = window.ZF_DATA.COUNTRY;

  // User-provided real-player database for Zero Football. Ratings are the user's starting values.
  // Images are resolved from English Wikipedia page thumbnails at runtime; if unavailable, initials remain visible.
  const REAL_PLAYERS = window.ZF_DATA.REAL_PLAYERS;
  const REAL_PLAYER_POSITIONS = window.ZF_DATA.REAL_PLAYER_POSITIONS;
  const PLAYER_COUNTRIES = window.ZF_DATA.PLAYER_COUNTRIES;
  // Direct photo links supplied for selected real players. Others keep the existing Wikipedia/fallback behavior.
  const PLAYER_PHOTOS = window.ZF_DATA.PLAYER_PHOTOS;
  const PLAYER_IMAGE_CACHE={};
  const SAFE_CREST_GLYPHS=new Set(['★','☆','✦','✧','✶','✷','✸','✹','◆','◇','♦','♢','◈','◊','●','○','◉','◎','◐','◑','◌','▲','△','▼','▽','■','□','▣','▢','▪','▫','+','✚','✛','×','✕','✖','⊕','⊗','⊙','⌖','☼','☀','☾','☽','∞','⚑']);
  let PLAYER_IMAGE_OBSERVER=null;
  function resolvePlayerImages(){
    const cards=$$('.player-card[data-portrait-key],.squad-item[data-portrait-key],.modal-player[data-portrait-key],.opponent-star-card[data-portrait-key],.player-slot[data-portrait-key],.forced-sub-option[data-portrait-key]');
    cards.filter(card=>card.classList.contains('opponent-star-card')||card.closest('.opponent-best-grid')).forEach(loadPlayerImage);
    if(!PLAYER_IMAGE_OBSERVER&&'IntersectionObserver' in window)PLAYER_IMAGE_OBSERVER=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){PLAYER_IMAGE_OBSERVER.unobserve(entry.target);loadPlayerImage(entry.target);}}),{rootMargin:'320px'});
    cards.forEach(card=>{if(PLAYER_IMAGE_OBSERVER){if(!card.dataset.imageObserved){card.dataset.imageObserved='1';PLAYER_IMAGE_OBSERVER.observe(card);}}else loadPlayerImage(card);});
  }
  function makeFallbackPortrait(seed){
    let h=0;for(let i=0;i<String(seed).length;i++)h=(h*31+String(seed).charCodeAt(i))>>>0;
    const shirts=['#1d4ed8','#b91c1c','#047857','#6d28d9','#0f766e','#334155','#be123c','#a16207'];
    const hairs=['#211915','#4b2e20','#171717','#76543b','#b9a06a','#d7d7d7'];
    const skins=['#f1c7a5','#d9a079','#b97951','#8d563c','#f0d0b0','#c68b65'];
    const shirt=shirts[h%shirts.length],hair=hairs[(h>>>3)%hairs.length],skin=skins[(h>>>7)%skins.length];
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 190"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#26364d"/><stop offset="1" stop-color="#101827"/></linearGradient><linearGradient id="j" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${shirt}"/><stop offset=".5" stop-color="#ffffff" stop-opacity=".12"/><stop offset="1" stop-color="${shirt}"/></linearGradient></defs><rect width="160" height="190" rx="18" fill="url(#bg)"/><circle cx="80" cy="68" r="43" fill="#ffffff" opacity=".05"/><path d="M20 190 Q27 130 63 122 L97 122 Q133 130 140 190Z" fill="url(#j)"/><path d="M64 118 L80 140 L96 118" fill="#f8fafc" opacity=".9"/><path d="M65 112 L95 112 L98 132 Q80 147 62 132Z" fill="${skin}"/><ellipse cx="80" cy="71" rx="31" ry="39" fill="${skin}"/><path d="M49 68 Q43 25 79 24 Q115 22 112 68 L105 53 Q86 43 69 50 L54 61Z" fill="${hair}"/><path d="M50 68 Q46 51 54 43 Q49 73 58 84 L51 83Z" fill="${hair}"/><path d="M110 65 Q115 78 106 88 L109 65Z" fill="${hair}"/><ellipse cx="68" cy="72" rx="3" ry="2.6" fill="#18202a"/><ellipse cx="92" cy="72" rx="3" ry="2.6" fill="#18202a"/><path d="M72 91 Q80 97 88 91" fill="none" stroke="#754a3d" stroke-width="2.8" stroke-linecap="round"/><path d="M61 62 Q68 57 74 62 M86 62 Q93 57 99 62" fill="none" stroke="${hair}" stroke-width="3.5" stroke-linecap="round"/><path d="M39 190 Q46 153 63 143 L80 158 L97 143 Q116 153 121 190" fill="${shirt}" opacity=".92"/></svg>`;
    return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  }
  function showPortrait(img,url,key){
    if(!img)return;
    const portraitKey=String(key||img.alt||'player');
    const markLoaded=()=>{img.closest('.player-portrait')?.classList.add('has-photo');img.closest('.opponent-star-photo')?.classList.add('has-photo');};
    img.onload=markLoaded;
    img.onerror=()=>{
      img.onerror=null;
      if(img.dataset.wikiFallback!=='1'&&img.dataset.photoFinal!=='1'&&portraitKey){
        img.dataset.wikiFallback='1';
        findPlayerPortrait(portraitKey).then(remote=>{
          if(remote&&remote!==url){PLAYER_IMAGE_CACHE[portraitKey]=remote;showPortrait(img,remote,portraitKey);}
          else{img.dataset.photoFinal='1';showPortrait(img,makeFallbackPortrait(portraitKey),portraitKey);}
        }).catch(()=>{img.dataset.photoFinal='1';showPortrait(img,makeFallbackPortrait(portraitKey),portraitKey);});
        return;
      }
      if(img.dataset.photoFinal!=='1'){
        img.dataset.photoFinal='1';
        img.onload=markLoaded;
        img.src=makeFallbackPortrait(portraitKey);
        img.style.display='block';
        return;
      }
      img.style.display='none';
      img.closest('.player-portrait')?.classList.remove('has-photo');
      img.closest('.opponent-star-photo')?.classList.remove('has-photo');
    };
    img.src=url;
    img.style.display='block';
    const card=img.closest('.player-card');card?.querySelector('.portrait-circle')?.classList.add('photo-hidden');
  }
  async function findPlayerPortrait(key){
    const title=String(key).replaceAll(' ','_');
    try{
      const r=await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(title),{headers:{'accept':'application/json'}});
      if(r.ok){const d=await r.json();if(d?.thumbnail?.source)return d.thumbnail.source;}
    }catch(e){}
    try{
      const u='https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=300&titles='+encodeURIComponent(key);
      const r=await fetch(u);if(r.ok){const d=await r.json();const pages=Object.values(d?.query?.pages||{});const url=pages.find(x=>x?.thumbnail?.source)?.thumbnail?.source;if(url)return url;}
    }catch(e){}
    return null;
  }
  function loadPlayerImage(card){
    const key=card.dataset.wiki||card.dataset.portraitKey;const img=card.querySelector('.portrait-photo,.squad-photo');if(!key||!img)return;
    const fallback=makeFallbackPortrait(key);if(!img.dataset.fallbackShown){img.dataset.fallbackShown='1';if(card.classList.contains('opponent-star-card'))img.loading='eager';showPortrait(img,fallback,key);if(card.classList.contains('opponent-star-card'))card.querySelector('.opponent-star-photo')?.classList.add('has-photo');}
    if(!card.dataset.wiki)return;
    const direct=PLAYER_PHOTOS[key];
    if(direct){showPortrait(img,direct,key);return;}
    const cached=PLAYER_IMAGE_CACHE[key];
    if(cached&&cached!=='pending'){showPortrait(img,cached,key);return;}
    if(cached==='pending')return;
    PLAYER_IMAGE_CACHE[key]='pending';
    findPlayerPortrait(key).then(url=>{
      // Keep real player photos where Wikipedia provides them; use a built-in illustrated portrait if not.
      const finalUrl=url||makeFallbackPortrait(key);PLAYER_IMAGE_CACHE[key]=finalUrl;
      $$('[data-wiki]').forEach(c=>{if(c.dataset.wiki===key){const target=c.querySelector('.portrait-photo,.squad-photo');if(target)showPortrait(target,finalUrl,key);}});
    }).catch(()=>{
      const fallback=makeFallbackPortrait(key);PLAYER_IMAGE_CACHE[key]=fallback;
      $$('[data-wiki]').forEach(c=>{if(c.dataset.wiki===key){const target=c.querySelector('.portrait-photo,.squad-photo');if(target)showPortrait(target,fallback,key);}});
    });
  }

  const SYMBOLS = window.ZF_DATA.SYMBOLS;
  // Thirty curated, explicitly-supported emoji for club crests.
  const EMBLEM_EMOJIS = ['⚽','🏆','🥇','🥈','🥉','⭐','🌟','🔥','⚡','💎','👑','🦁','🐺','🦅','🐉','🐯','🐻','🦈','🐍','🛡️','⚔️','🎯','🚀','💀','☠️','🌪️','🌊','🌹','☀️','🍀'];
  const SAFE_CREST_EMOJIS = new Set(EMBLEM_EMOJIS);
  const RARITY = window.ZF_DATA.RARITY;
  const POSITIONS = window.ZF_DATA.POSITIONS;
  const POS_NAMES = window.ZF_DATA.POS_NAMES;
  const FORMATIONS = window.ZF_DATA.FORMATIONS;
  const KIT_PATTERNS = [
    ['plain','Однотонная'],['stripes','Вертикальные полосы'],['halves','Две половины'],['hoops','Поперечные полосы'],
    ['diagonal','Диагональ'],['pinstripes','Тонкие полосы'],['sash','Диагональная лента'],['chevron','Шевроны'],
    ['quartered','Четверти'],['cross','Крест'],['thin-hoops','Узкие поперечные'],['gradient','Градиент'],
    ['center-stripe','Центральная полоса'],['side-stripes','Боковые полосы'],['three-stripes','Три полосы'],
    ['wide-hoops','Широкие поперечные'],['shoulders','Цветные плечи'],['v-shape','V-образный узор'],
    ['checker','Шахматка'],['dots','Точки'],['split-diagonal','Разделённая диагональ'],
    ['vertical-blocks','Вертикальные блоки'],['horizontal-blocks','Горизонтальные блоки'],
    ['wave','Волна'],['double-sash','Двойная лента'],['collar','Контрастный воротник'],
    ['sleeve-bars','Полосы на рукавах'],['asymmetric','Асимметрия'],['diamond-grid','Ромбовидная сетка'],
    ['pin-center','Центральные тонкие линии']
  ];
  function kitPatternName(id){return KIT_PATTERNS.find(x=>x[0]===id)?.[1]||'Однотонная';}

  // Дополнительные схемы: все варианты сохраняют 11 позиций и совместимы с текущей расстановкой.
  const EXTRA_FORMATIONS = window.ZF_DATA.EXTRA_FORMATIONS;
  const FORMATION_COORDS = window.ZF_DATA.FORMATION_COORDS;
  function formationLane(count,min,max){
    if(count<=1)return [50];
    if(count===2)return [min,max];
    return Array.from({length:count},(_,i)=>min+(max-min)*i/(count-1));
  }
  Object.entries(EXTRA_FORMATIONS).forEach(([name,roles])=>{
    const totals=roles.reduce((a,role)=>(a[role]=(a[role]||0)+1,a),{}),seen={};
    FORMATIONS[name]=roles.map(role=>{
      const n=seen[role]||0;seen[role]=n+1;
      const base=FORMATION_COORDS[role]||[50,50];
      const ranges={CB:[27,73],CM:[34,66],CDM:[40,60],CAM:[38,62],ST:[38,62]};
      const range=ranges[role];
      const x=range?formationLane(totals[role],range[0],range[1])[n]:base[0];
      return {role,x:Math.round(x*10)/10,y:base[1]};
    });
  });
  const STYLES = window.ZF_DATA.STYLES;
  const BOT_CLUBS = window.ZF_DATA.BOT_CLUBS;
  const BOT_PLAYER_NAMES = window.ZF_DATA.BOT_PLAYER_NAMES;
  const TROPHIES = window.ZF_DATA.TROPHIES;
  let db = loadDB();
  // Persistent presentation preferences; defaults keep the full experience enabled.
  if(!db.language)db.language='ru';
  if(typeof db.sound!=='boolean')db.sound=true;
  if(typeof db.vibration!=='boolean')db.vibration=true;
  if(typeof db.packAnimations!=='boolean')db.packAnimations=true;
  if(!['cinematic','normal','fast'].includes(db.packAnimationSpeed))db.packAnimationSpeed='normal';
  if(typeof db.packSound!=='boolean')db.packSound=true;
  if(typeof db.packVibration!=='boolean')db.packVibration=true;
  if(typeof db.musicEnabled!=='boolean')db.musicEnabled=true;
  if(!['ambient','electronic','stadium','lofi','rock'].includes(db.musicStyle))db.musicStyle='ambient';
  if(!Number.isInteger(Number(db.musicTrack))||Number(db.musicTrack)<0||Number(db.musicTrack)>4)db.musicTrack=0;
  if(!Number.isFinite(Number(db.musicVolume)))db.musicVolume=28;
  db.musicVolume=clamp(Number(db.musicVolume),0,100);
  let packAnimationSerial=0;
  let packAudioContext=null;
  let musicBus=null,musicLoopTimer=null,musicStep=0,musicGeneration=0,musicUnlocked=false;
  let view = 'home';
  let startMode = 'choose';
  let createDraft = {symbol:'★',logoColor:'#c8ff44',shape:'shield',layers:[{id:'base',kind:'symbol',value:'★',x:50,y:48,size:34,color:'#10140c'}]};
  let editSlotIndex = null;
  let reveal = null;
  let matchState = {stage:'idle'};
  let toastTimer = null;
  let collectionMode = 'owned';
  let themePanelOpen = false;
  let contractsPanelOpen = false;
  let playerModalRef = null;
  let matchCountdownInterval = null;
  let loginClubId = null;

  function loadDB(){
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {clubs:[],activeClubId:null,stats:{}};
      if (!Array.isArray(parsed.clubs)) parsed.clubs = [];
      let strippedLegacySecrets=false;
      parsed.clubs = parsed.clubs.filter(c => c && typeof c === 'object' && typeof c.id === 'string').map(c => {
        // Migrate older/partially-written saves instead of letting one incomplete club break startup.
        if ('password' in c || 'plainPassword' in c || 'passwordPlain' in c) strippedLegacySecrets=true;
        delete c.password;delete c.plainPassword;delete c.passwordPlain;
        if (!Array.isArray(c.players)) c.players = [];
        // Requested roster cleanup: remove the Uruguayan Luis Suárez from old local saves too.
        const removedLuisIds=new Set(c.players.filter(p=>p&&((p.wiki||'')==='Luis Suárez'||(p.name||'').trim()==='Луис Суарес'||((p.name||'').trim()==='Luis Suárez'&&p.country==='uy'))).map(p=>p.id));
        c.players=c.players.filter(p=>!p||!((p.wiki||'')==='Luis Suárez'||(p.name||'').trim()==='Луис Суарес'||((p.name||'').trim()==='Luis Suárez'&&p.country==='uy')));
        if(removedLuisIds.size)c.lineup=Array.isArray(c.lineup)?c.lineup.filter(id=>!removedLuisIds.has(id)):[];
        if (!Array.isArray(c.lineup)) c.lineup = c.players.slice(0,11).map(p => p && p.id).filter(Boolean);
        if (!c.logo || typeof c.logo !== 'object') c.logo = {symbol:'⚡',color:'#c8ff44'};
        if (!c.kit || typeof c.kit !== 'object') c.kit = {primary:'#c8ff44',secondary:'#172318',pattern:'plain'};
        const statDefaults={matches:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,packsOpened:0};
        c.stats={...statDefaults,...(c.stats&&typeof c.stats==='object'?c.stats:{})};
        Object.keys(statDefaults).forEach(key=>{const value=Number(c.stats[key]);c.stats[key]=Number.isFinite(value)?Math.max(0,value):0;});
        if (!c.trophyUnlocks || typeof c.trophyUnlocks !== 'object') c.trophyUnlocks = {};delete c.trophyUnlocks.rich_1000;delete c.trophyUnlocks.rich_5000;
        if (!Array.isArray(c.history)) c.history = [];
        if (!c.style) c.style = 'balanced';
        if (!Number.isFinite(c.energy)) c.energy = 5; c.energy=Math.min(5,Math.max(0,c.energy)); if (!Number.isFinite(c.energyAt)) c.energyAt = Date.now(); if (!Array.isArray(c.sponsors)) c.sponsors = [];
        c.players.forEach(p=>{const canonical=REAL_PLAYERS.find(r=>p&&(p.wiki===r.wiki||p.name===r.wiki));if(canonical)p.name=canonical.name;else if(p&&/[A-Za-z]/.test(String(p.name||'')))p.name=transliterateName(p.name);if(!p.contractUntil)p.contractUntil=Date.now()+30*86400000;if(!Array.isArray(p.positions))p.positions=[p.position];if(!Number.isFinite(p.stamina))p.stamina=100;delete p.positionPenalty;}); c.players.forEach(p=>{const rb=REAL_PLAYERS.find(x=>x.wiki===p.wiki||x.name===p.name);if(rb){p.realClub=rb.club;p.rating=rb.rating;p.position=rb.position;p.positions=REAL_PLAYER_POSITIONS[rb.wiki]||p.positions||[rb.position];}});
        if (!c.formation) c.formation = '4-3-3';
        if(c.lineup.length<11){const used=new Set(c.lineup);for(const p of c.players){if(c.lineup.length>=11)break;if(p?.id&&!used.has(p.id)){c.lineup.push(p.id);used.add(p.id);}}}
        if (typeof c.coins !== 'number' || !Number.isFinite(c.coins)) c.coins = 0.5;
        if(c.economyVersion!==2){c.coins=Math.max(0,Number(c.coins)||0)/500;c.economyVersion=2;}
        return c;
      });
      if (!parsed.stats || typeof parsed.stats !== 'object') parsed.stats = {};
      // Club-profile model: every club is an independent profile with its own credentials.
      const legacy=[...(parsed.clubs||[]),...(Array.isArray(parsed.archivedClubs)?parsed.archivedClubs:[])];
      const seen=new Set();
      parsed.clubs=legacy.filter(c=>{if(!c||seen.has(c.id))return false;seen.add(c.id);return true;});
      parsed.accounts=[];parsed.activeAccountId=null;parsed.archivedClubs=[];
      parsed.clubs.forEach((c,i)=>{
        delete c.accountId;
        if(!c.login)c.login='legacy_'+String(c.id||i).replace(/[^a-z0-9]/gi,'').slice(-12);
        if(typeof c.passwordHash!=='string')c.passwordHash='';
        if(!c.sponsorContract)c.sponsorContract=null;if(!c.sponsorSlots)c.sponsorSlots={kit:null,title:null,extra:null};if(c.sponsorContract&&!Object.values(c.sponsorSlots).some(Boolean)){c.sponsorSlots[c.sponsorContract.type||'title']=c.sponsorContract;}if(!Array.isArray(c.logo.layers)||!c.logo.layers.length)c.logo.layers=[{id:'base',kind:'symbol',value:c.logo.symbol||'★',x:50,y:48,size:34,color:'#10140c'}];c.logo.layers=c.logo.layers.map(l=>({...l,value:l?.kind==='emoji'&&SAFE_CREST_EMOJIS.has(String(l.value||''))?String(l.value):sanitizeCrestText(l.value)}));c.logo.symbol=sanitizeCrestText(c.logo.symbol);if(!c.logo.shape)c.logo.shape='shield';
      });
      // Require credentials again after a page reload; do not persist an authenticated session.
      parsed.activeClubId=null;
      if(strippedLegacySecrets){try{localStorage.setItem(STORE_KEY,JSON.stringify(parsed));}catch(secretCleanupError){console.warn('Could not rewrite a legacy save after removing plaintext password fields:',secretCleanupError);}}
      return parsed;
    } catch(e) { return {clubs:[],activeClubId:null,stats:{}}; }
  }
  function saveDB(){
    try {
      (db.clubs||[]).forEach(c=>{delete c.password;delete c.plainPassword;delete c.passwordPlain;});
      localStorage.setItem(STORE_KEY, JSON.stringify(db));
      return true;
    } catch(e) { console.warn('Local save unavailable',e);return false; }
  }
  function esc(value){return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function rand(min,max){return Math.floor(Math.random()*(max-min+1))+min;}
  function pick(arr){return arr[Math.floor(Math.random()*arr.length)];}
  function shuffle(arr){const out=[...arr];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
  function accountClubs(){return db.clubs||[];}
  function currentClub(){return db.clubs.find(c=>c.id===db.activeClubId)||null;}
  const PASSWORD_KDF_ITERATIONS = 210000;
  const AUTH_FAILURES=new Map();
  const AUTH_MAX_FAILURES=5;
  const AUTH_LOCK_MS=60_000;
  const toHex = bytes => [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
  const fromHex = hex => Uint8Array.from(String(hex||'').match(/.{1,2}/g)||[],x=>parseInt(x,16));
  function constantTimeEqual(a,b){a=String(a||'');b=String(b||'');let diff=a.length^b.length;const n=Math.max(a.length,b.length);for(let i=0;i<n;i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;}
  async function hashPassword(value){
    if(!globalThis.crypto?.subtle||!globalThis.crypto?.getRandomValues)throw new Error('Браузер не поддерживает безопасное шифрование паролей. Открой игру через HTTPS или localhost.');
    const salt=crypto.getRandomValues(new Uint8Array(16));
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(String(value)),'PBKDF2',false,['deriveBits']);
    const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:PASSWORD_KDF_ITERATIONS,hash:'SHA-256'},key,256);
    return {hash:toHex(bits),salt:toHex(salt),algorithm:'PBKDF2-SHA256',iterations:PASSWORD_KDF_ITERATIONS};
  }
  async function verifyClubPassword(club,password){
    if(club.passwordSalt&&club.passwordHash){
      if(!globalThis.crypto?.subtle)throw new Error('Для проверки защищённого пароля нужен HTTPS или localhost.');
      const salt=fromHex(club.passwordSalt);const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(String(password)),'PBKDF2',false,['deriveBits']);
      const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:Math.max(100000,Math.min(500000,Number(club.passwordIterations)||PASSWORD_KDF_ITERATIONS)),hash:'SHA-256'},key,256);
      return constantTimeEqual(toHex(bits),club.passwordHash);
    }
    // One-time compatibility for older v31 profiles (unsalted SHA-256 or the old fallback).
    let legacy='';
    if(globalThis.crypto?.subtle){const bits=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(password)));legacy=toHex(bits);}
    else {let h=2166136261;const bytes=new TextEncoder().encode(String(password));for(let round=0;round<12000;round++){for(const b of bytes){h^=(b+round)&255;h=Math.imul(h,16777619)>>>0;}h=Math.imul(h^(round+1),2246822519)>>>0;}legacy='fallback-'+h.toString(16);}
    if(!constantTimeEqual(legacy,club.passwordHash||''))return false;
    if(globalThis.crypto?.subtle){const upgraded=await hashPassword(password);club.passwordHash=upgraded.hash;club.passwordSalt=upgraded.salt;club.passwordAlgorithm=upgraded.algorithm;club.passwordIterations=upgraded.iterations;}
    return true;
  }
  function countryData(code){return COUNTRY[code]||COUNTRY.ua;}
  function playerCountryData(code){
    const raw=String(code||'ua').toLowerCase();
    const aliases={eng:'GB',uk:'GB',en:'GB',us:'US',kr:'KR',cz:'CZ',ru:'RU',ua:'UA',br:'BR',de:'DE',fr:'FR',es:'ES',it:'IT',pt:'PT',nl:'NL',ar:'AR',jp:'JP',pl:'PL',be:'BE',hr:'HR',tr:'TR',se:'SE',ch:'CH',at:'AT',rs:'RS',gr:'GR',no:'NO',dk:'DK',mx:'MX',co:'CO',ma:'MA',by:'BY',kz:'KZ',ci:'CI',ge:'GE',ec:'EC',cm:'CM',sn:'SN',gn:'GN',am:'AM',sk:'SK',gp:'GP',uy:'UY',ve:'VE',pa:'PA'};
    const cc=aliases[raw]||raw.toUpperCase();const source=PLAYER_COUNTRIES[raw]||PLAYER_COUNTRIES[cc.toLowerCase()]||{name:countryData(raw).name,flag:countryData(raw).flag};
    let name=source.name;
    const language=db.language||'ru';
    if(raw==='eng'){const englandNames={ru:'Англия',en:'England',uk:'Англія',de:'England',fr:'Angleterre',es:'Inglaterra',ja:'イングランド',zh:'英格兰',kk:'Англия',pl:'Anglia'};name=englandNames[language]||'England';}
    else{try{const dn=new Intl.DisplayNames([language],{type:'region',fallback:'none'});const localized=dn.of(cc);if(localized&&localized!==cc)name=localized;}catch(e){}}
    return {name,flag:source.flag||countryData(raw).flag||'🌍'};
  }
  function displayClubName(c){return `${countryData(c.country).flag} ${c.name}`;}
  const POSITION_LABELS={
    en:{GK:'Goalkeeper',LB:'Left-back',CB:'Centre-back',RB:'Right-back',LWB:'Left wing-back',RWB:'Right wing-back',CDM:'Defensive midfielder',CM:'Central midfielder',CAM:'Attacking midfielder',LM:'Left midfielder',RM:'Right midfielder',LW:'Left winger',RW:'Right winger',ST:'Striker',CF:'Centre-forward'},
    uk:{GK:'Воротар',LB:'Лівий захисник',CB:'Центральний захисник',RB:'Правий захисник',LWB:'Лівий латераль',RWB:'Правий латераль',CDM:'Опорний півзахисник',CM:'Центральний півзахисник',CAM:'Атакувальний півзахисник',LM:'Лівий півзахисник',RM:'Правий півзахисник',LW:'Лівий вінгер',RW:'Правий вінгер',ST:'Нападник',CF:'Форвард'},
    de:{GK:'Torwart',LB:'Linksverteidiger',CB:'Innenverteidiger',RB:'Rechtsverteidiger',LWB:'Linker Schienenspieler',RWB:'Rechter Schienenspieler',CDM:'Defensives Mittelfeld',CM:'Zentrales Mittelfeld',CAM:'Offensives Mittelfeld',LM:'Linkes Mittelfeld',RM:'Rechtes Mittelfeld',LW:'Linksaußen',RW:'Rechtsaußen',ST:'Stürmer',CF:'Mittelstürmer'},
    fr:{GK:'Gardien',LB:'Latéral gauche',CB:'Défenseur central',RB:'Latéral droit',LWB:'Piston gauche',RWB:'Piston droit',CDM:'Milieu défensif',CM:'Milieu central',CAM:'Milieu offensif',LM:'Milieu gauche',RM:'Milieu droit',LW:'Ailier gauche',RW:'Ailier droit',ST:'Avant-centre',CF:'Buteur'},
    es:{GK:'Portero',LB:'Lateral izquierdo',CB:'Central',RB:'Lateral derecho',LWB:'Carrilero izquierdo',RWB:'Carrilero derecho',CDM:'Mediocentro defensivo',CM:'Centrocampista',CAM:'Mediapunta',LM:'Volante izquierdo',RM:'Volante derecho',LW:'Extremo izquierdo',RW:'Extremo derecho',ST:'Delantero',CF:'Delantero centro'},
    ja:{GK:'ゴールキーパー',LB:'左サイドバック',CB:'センターバック',RB:'右サイドバック',LWB:'左ウイングバック',RWB:'右ウイングバック',CDM:'守備的MF',CM:'中央MF',CAM:'攻撃的MF',LM:'左MF',RM:'右MF',LW:'左ウイング',RW:'右ウイング',ST:'ストライカー',CF:'センターフォワード'},
    zh:{GK:'守门员',LB:'左后卫',CB:'中后卫',RB:'右后卫',LWB:'左翼卫',RWB:'右翼卫',CDM:'防守型中场',CM:'中前卫',CAM:'进攻型中场',LM:'左中场',RM:'右中场',LW:'左边锋',RW:'右边锋',ST:'前锋',CF:'中锋'},
    kk:{GK:'Қақпашы',LB:'Сол қаптал қорғаушысы',CB:'Орталық қорғаушы',RB:'Оң қаптал қорғаушысы',LWB:'Сол қаптал қорғаушысы',RWB:'Оң қаптал қорғаушысы',CDM:'Тірек жартылай қорғаушы',CM:'Орталық жартылай қорғаушы',CAM:'Шабуылдаушы жартылай қорғаушы',LM:'Сол жартылай қорғаушы',RM:'Оң жартылай қорғаушы',LW:'Сол қанат',RW:'Оң қанат',ST:'Шабуылшы',CF:'Орталық шабуылшы'},
    pl:{GK:'Bramkarz',LB:'Lewy obrońca',CB:'Środkowy obrońca',RB:'Prawy obrońca',LWB:'Lewy wahadłowy',RWB:'Prawy wahadłowy',CDM:'Defensywny pomocnik',CM:'Środkowy pomocnik',CAM:'Ofensywny pomocnik',LM:'Lewy pomocnik',RM:'Prawy pomocnik',LW:'Lewy skrzydłowy',RW:'Prawy skrzydłowy',ST:'Napastnik',CF:'Środkowy napastnik'}
  };
  function positionLabel(code){const lang=db.language||'ru';return POSITION_LABELS[lang]?.[code]||POS_NAMES[code]||code||'—';}
  function playerPositionsLabel(player){return (player.positions||[player.position]).filter(Boolean).map(positionLabel).join(' / ');}
  function playerDisplayName(player){const local=String(player?.name||'');if((db.language||'ru')==='ru')return local;const canonical=String(player?.wiki||'').trim();return canonical&&/[A-Za-z]/.test(canonical)?canonical.replaceAll('_',' '):local;}
  const PLAYER_CLUB_LABELS={
    en:{'АЕК Афины':'AEK Athens','Аль-Наср':'Al Nassr','Арсенал':'Arsenal','Астон Вилла':'Aston Villa','Атлетико Мадрид':'Atlético Madrid','Бавария':'Bayern Munich','Барселона':'Barcelona','Борнмут':'Bournemouth','Боруссия Дортмунд':'Borussia Dortmund','Брайтон':'Brighton & Hove Albion','Брюгге':'Club Brugge','Будё-Глимт':'Bodø/Glimt','Вест Хэм':'West Ham United','Викинг':'Viking FK','Вильярреал':'Villarreal','Динамо Киев':'Dynamo Kyiv','Интер':'Inter Milan','Интер Майами':'Inter Miami','Комо':'Como 1907','Кристал Пэлас':'Crystal Palace','Кёльн':'1. FC Köln','Ливерпуль':'Liverpool','Лидс':'Leeds United','Лилль':'Lille','Манчестер Сити':'Manchester City','Манчестер Юнайтед':'Manchester United','Марсель':'Marseille','Милан':'AC Milan','Ньюкасл':'Newcastle United','Ньюкасл Юнайтед':'Newcastle United','ПСВ':'PSV Eindhoven','ПСЖ':'Paris Saint-Germain','Порту':'FC Porto','Реал Бетис':'Real Betis','Реал Мадрид':'Real Madrid','Рома':'AS Roma','Сабах':'Sabah FC','Сантос':'Santos FC','Слован Братислава':'ŠK Slovan Bratislava','Спортинг':'Sporting CP','Тоттенхэм':'Tottenham Hotspur','Фейеноорд':'Feyenoord','Челси':'Chelsea','Шахтёр':'Shakhtar Donetsk','Штутгарт':'VfB Stuttgart'},
    uk:{'АЕК Афины':'АЕК Афіни','Аль-Наср':'Аль-Наср','Арсенал':'Арсенал','Астон Вилла':'Астон Вілла','Атлетико Мадрид':'Атлетіко Мадрид','Бавария':'Баварія','Барселона':'Барселона','Борнмут':'Борнмут','Боруссия Дортмунд':'Боруссія Дортмунд','Брайтон':'Брайтон','Брюгге':'Брюгге','Будё-Глимт':'Буде-Глімт','Вест Хэм':'Вест Гем','Викинг':'Вікінг','Вильярреал':'Вільярреал','Динамо Киев':'Динамо Київ','Интер':'Інтер','Интер Майами':'Інтер Маямі','Комо':'Комо','Кристал Пэлас':'Крістал Пелес','Кёльн':'Кельн','Ливерпуль':'Ліверпуль','Лидс':'Лідс','Лилль':'Лілль','Манчестер Сити':'Манчестер Сіті','Манчестер Юнайтед':'Манчестер Юнайтед','Марсель':'Марсель','Милан':'Мілан','Ньюкасл':'Ньюкасл','Ньюкасл Юнайтед':'Ньюкасл Юнайтед','ПСВ':'ПСВ','ПСЖ':'ПСЖ','Порту':'Порту','Реал Бетис':'Реал Бетіс','Реал Мадрид':'Реал Мадрид','Рома':'Рома','Сабах':'Сабах','Сантос':'Сантус','Слован Братислава':'Слован Братислава','Спортинг':'Спортінг','Тоттенхэм':'Тоттенгем','Фейеноорд':'Феєнорд','Челси':'Челсі','Шахтёр':'Шахтар','Штутгарт':'Штутгарт'}
  };
  function playerClubLabel(player){const club=String(player?.realClub||player?.club||'Клуб не указан');const lang=db.language||'ru';if(lang==='ru')return club;return PLAYER_CLUB_LABELS[lang]?.[club]||PLAYER_CLUB_LABELS.en[club]||translateUIText(club);} 
  function playerCountryLabel(code){return playerCountryData(code).name;}
  function effectiveOVRText(player,target,club=null){const value=playerOVRAt(player,target,club);const penalty=positionPenalty(player,target);return `${value} OVR${penalty<0?` · ${penalty}`:''}`;}
  function rarityFor(rating){return [...RARITY].reverse().find(r=>rating>=r.min)||RARITY[0];}
  function rarityColor(rating){return rarityFor(rating).color;}
  // Transfermarkt-style estimated market value in millions of euros.
  function marketValue(rating){return Math.pow(200,Math.max(0,(Number(rating||50)-50)/40));}
  function formatMoney(value){const n=Number(value)||0;return `€${n>=100?Math.round(n):n>=10?n.toFixed(1):n.toFixed(2)} млн`; }
  function saleValue(player,duplicate=false){const base=marketValue(player.rating)*0.05;return Math.max(0.01,base*(duplicate?0.5:1));}
  function avatarLetters(name){return String(name||'ZF').split(/[\s-]+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase();}
  function transliterateName(value){
    let input=String(value||'').normalize('NFC');
    const pairs=[[/sch/gi,'ш'],[/sh/gi,'ш'],[/ch/gi,'ч'],[/th/gi,'т'],[/ph/gi,'ф'],[/ck/gi,'к'],[/qu/gi,'кв'],[/oo/gi,'у'],[/ee/gi,'и'],[/ea/gi,'и'],[/ou/gi,'ау'],[/ow/gi,'ау'],[/ai/gi,'эй'],[/ay/gi,'эй'],[/ey/gi,'эй'],[/igh/gi,'ай'],[/zh/gi,'ж'],[/ts/gi,'ц'],[/dz/gi,'дз'],[/ks/gi,'кс'],[/wr/gi,'р'],[/wh/gi,'в'],[/sz/gi,'ш'],[/cz/gi,'ч'],[/rz/gi,'ж'],[/lj/gi,'ль'],[/nj/gi,'нь']];
    pairs.forEach(([re,out])=>input=input.replace(re,out));
    const map={a:'а',b:'б',c:'к',d:'д',e:'е',f:'ф',g:'г',h:'х',i:'и',j:'дж',k:'к',l:'л',m:'м',n:'н',o:'о',p:'п',q:'к',r:'р',s:'с',t:'т',u:'у',v:'в',w:'в',x:'кс',y:'й',z:'з',á:'а',à:'а',â:'а',ä:'а',ã:'а',å:'о',æ:'э',é:'е',è:'е',ê:'е',ë:'е',í:'и',ì:'и',î:'и',ï:'и',ó:'о',ò:'о',ô:'о',ö:'ё',õ:'о',ú:'у',ù:'у',û:'у',ü:'ю',ñ:'нь',ß:'с',ø:'ё',ł:'л',đ:'д',ð:'д',þ:'т',ć:'ч',č:'ч',ç:'с',ď:'д',ě:'е',ę:'е',ğ:'г',ģ:'г',ħ:'х',ı:'ы',ķ:'к',ĺ:'л',ļ:'л',ń:'нь',ň:'н',ņ:'н',ő:'ё',ŕ:'р',ř:'р',ś:'ш',ş:'ш',š:'ш',ť:'т',ț:'ц',ţ:'ц',ů:'у',ű:'ю',ý:'и',ÿ:'и',ź:'з',ż:'ж',ž:'ж'};
    const chars=Object.keys(map).join('');
    const output=input.replace(new RegExp(`[A-Za-z${chars}]`,'g'),ch=>{const out=map[ch.toLowerCase()]||ch;return ch===ch.toUpperCase()?out.charAt(0).toUpperCase()+out.slice(1):out;});
    return output.replace(/(^|[\s-])([а-яё])/g,(_,sep,ch)=>sep+ch.toUpperCase());
  }
  function createPlayer(position,rating,name,country,extra={}){
    if(!extra.realPlayer && /[A-Za-z]/.test(String(name||''))) name=transliterateName(name);
    const pace=clamp(rating+rand(-11,10)+(position.includes('W')||position==='ST'?4:0),30,99);
    const shooting=clamp(rating+rand(-10,11)+(position==='ST'||position==='CF'?9:0),25,99);
    const passing=clamp(rating+rand(-8,10)+(position==='CM'||position==='CAM'?7:0),25,99);
    const dribbling=clamp(rating+rand(-10,11)+(position.includes('W')||position==='CAM'?8:0),25,99);
    const defense=clamp(rating+rand(-10,10)+(position==='CB'||position==='LB'||position==='RB'||position==='CDM'?8:0),25,99);
    const physical=clamp(rating+rand(-8,10),25,99);
    const goalkeeping=position==='GK'?clamp(rating+rand(0,10),25,99):clamp(18+rand(0,10),10,35);
    return {id:'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),name,position,positions:extra.positions||[position],rating,pace,shooting,passing,dribbling,defense,physical,goalkeeping,country,contractUntil:Date.now()+30*24*60*60*1000,injuryMatches:0,stamina:100,...extra};
  }
  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
  function createStarterSquad(countryCode){
    const positions=['GK','LB','CB','CB','RB','CM','CM','CAM','LW','ST','RW','GK','CB','CM','ST','RW'];
    const ratings=[55,54,55,54,54,56,55,56,54,56,55,53,53,54,53,52];
    const usedNames=shuffle([...countryData(countryCode).names]);
    return positions.map((pos,i)=>createPlayer(pos,ratings[i],usedNames[i%usedNames.length],countryCode));
  }
  function makeClub(name,country,logoSymbol,logoColor,kitPrimary,kitSecondary,pattern){
    const players=createStarterSquad(country);
    const firstEleven=players.slice(0,11).map(p=>p.id);
    const club={
      id:'club-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),name:name.trim(),country,
      logo:{symbol:sanitizeCrestText(logoSymbol||'★'),color:logoColor||'#c8ff44',shape:createDraft.shape||'shield',layers:JSON.parse(JSON.stringify(createDraft.layers||[{id:'base',kind:'symbol',value:logoSymbol||'★',x:50,y:48,size:34,color:'#10140c'}]))},
      kit:{primary:kitPrimary||'#c8ff44',secondary:kitSecondary||'#172318',pattern:pattern||'plain'},
      coins:0.5,economyVersion:2,energy:5,energyAt:Date.now(),sponsors:[],sponsorContract:null,sponsorSlots:{kit:null,title:null,extra:null},players,lineup:firstEleven,formation:'4-3-3',style:'balanced',trophyUnlocks:{},
      stats:{matches:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,packsOpened:0},history:[],createdAt:Date.now(),
      starterPack:{opened:true,country}
    };
    return club;
  }
  function positionPenalty(p,target){
    const positions=(p?.positions||[p?.position]).filter(Boolean);
    if(positions.includes(target))return 0;
    if(target==='GK'||positions.includes('GK'))return -35;
    if(positions.some(x=>compatible(x,target)))return -8;
    return -18;
  }
  function playerOVRAt(p,target,club=null){
    if(!p)return 0;
    const captain=club?.captainId===p.id?1:0;
    const condition=(p.injuryMatches>0?5:0)+Math.round((100-(p.stamina??100))*.05);
    return clamp(Math.round((Number(p.rating)||0)+positionPenalty(p,target)-condition+captain),1,99);
  }
  function teamRating(club){
    if(!club||!club.lineup?.length)return 0;
    const formation=FORMATIONS[club.formation]||FORMATIONS['4-3-3'];
    const ratings=club.lineup.map((id,index)=>{const p=club.players.find(x=>x.id===id);return p?playerOVRAt(p,formation[index]?.role||p.position,club):null;}).filter(Number.isFinite);
    return ratings.length?Math.round(ratings.reduce((a,b)=>a+b,0)/ratings.length):0;
  }
  function rosterTeamRating(players,formationId='4-3-3'){
    const formation=FORMATIONS[formationId]||FORMATIONS['4-3-3'];
    const ratings=(players||[]).map((p,i)=>playerOVRAt(p,p.assignedPosition||formation[i]?.role||p.position,null));
    return ratings.length?Math.round(ratings.reduce((a,b)=>a+b,0)/ratings.length):0;
  }
  function activePlayers(club){return (club?.lineup||[]).map(id=>club.players.find(p=>p.id===id)).filter(Boolean);}
  function matchCountLabel(value){const n=Math.max(0,Number(value)||0),last=n%10,lastTwo=n%100;const word=last===1&&lastTwo!==11?'матч':last>=2&&last<=4&&!(lastTwo>=12&&lastTwo<=14)?'матча':'матчей';return `${n} ${word}`;}
  function unavailableReason(p){
    if(!p)return 'Игрок не найден';
    if((p.injuryMatches||0)>0)return `Травма: ещё ${matchCountLabel(p.injuryMatches)}`;
    if((p.redCardMatches||0)>0)return `Красная карточка: пропуск ${matchCountLabel(p.redCardMatches)}`;
    if((p.yellowBanMatches||0)>0)return `Перебор жёлтых: пропуск ${matchCountLabel(p.yellowBanMatches)}`;
    return '';
  }
  function playerIsUnavailable(p){return !!unavailableReason(p);}
  function benchPlayers(club){return (club?.players||[]).filter(p=>!club.lineup.includes(p.id)).sort((a,b)=>b.rating-a.rating);}
  function contractDays(p){return Math.max(0,Math.ceil((p.contractUntil-Date.now())/(24*60*60*1000)));}
  function recordTrophies(club){
    const messages=[];
    for(const trophy of TROPHIES){if(trophy.test(club)&&!club.trophyUnlocks[trophy.id]){club.trophyUnlocks[trophy.id]=new Date().toISOString();messages.push(trophy.name);}}
    if(messages.length){saveDB();setTimeout(()=>messages.forEach((m,i)=>setTimeout(()=>toast(`Получен трофей: ${m}`,'success'),i*250)),100);}
  }
  function toast(message,type='success'){
    const root=$('#toast-root');if(!root)return;
    const node=document.createElement('div');node.className='toast'+(type==='error'?' error':'');
    node.innerHTML=`<span class="toast-icon">${type==='error'?'!':'✓'}</span><span>${esc(typeof translateUIText==='function'?translateUIText(message):message)}</span>`;
    root.appendChild(node);setTimeout(()=>{node.style.opacity='0';node.style.transform='translateY(8px)';setTimeout(()=>node.remove(),220);},3100);
  }
  function sanitizeCrestText(value){const raw=String(value||'').trim();if(SAFE_CREST_GLYPHS.has(raw))return raw;const clean=raw.replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u200D]/gu,'').replace(/[^\p{L}\p{N}\p{P}\p{S} ]/gu,'').trim();return clean||'★';}
  function crestSymbolSvg(value){
    const v=String(value||'★');let shape='';
    if(['★','☆','✦','✧','✶','✷','✸','✹'].includes(v)){shape=v==='☆'?'<polygon points="50,5 61,36 95,36 68,56 78,91 50,70 22,91 32,56 5,36 39,36" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/>':'<polygon points="50,3 61,36 96,36 68,57 79,93 50,72 21,93 32,57 4,36 39,36" fill="currentColor"/>';}
    else if(['◆','◇','♦','♢','◈','◊'].includes(v)){shape=v==='◇'||v==='♢'?'<polygon points="50,4 94,50 50,96 6,50" fill="none" stroke="currentColor" stroke-width="7"/>':'<polygon points="50,4 94,50 50,96 6,50" fill="currentColor"/>';}
    else if(['●','○','◉','◎','◐','◑','◌'].includes(v)){shape='<circle cx="50" cy="50" r="39" fill="'+(['○','◎','◌'].includes(v)?'none':'currentColor')+'" stroke="currentColor" stroke-width="'+(['○','◎','◌'].includes(v)?'7':'0')+'"/>'+(v==='◎'?'<circle cx="50" cy="50" r="22" fill="none" stroke="currentColor" stroke-width="7"/>':'')+(v==='◉'?'<circle cx="50" cy="50" r="16" fill="#ffffff" fill-opacity=".7"/>':'');}
    else if(['▲','△','▼','▽'].includes(v)){const pts=v==='▼'||v==='▽'?'50,94 5,10 95,10':'50,6 95,90 5,90';shape=`<polygon points="${pts}" fill="${v==='△'||v==='▽'?'none':'currentColor'}" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/>`;}
    else if(['■','□','▣','▢','▪','▫'].includes(v)){shape='<rect x="11" y="11" width="78" height="78" rx="'+(['▪','▫'].includes(v)?'6':'12')+'" fill="'+(['□','▢','▫'].includes(v)?'none':'currentColor')+'" stroke="currentColor" stroke-width="'+(['□','▢','▫'].includes(v)?'7':'0')+'"/>'+(v==='▣'?'<rect x="29" y="29" width="42" height="42" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="6"/>':'');}
    else if(['+','✚','✛','⊕','⊗','⊙','⌖'].includes(v)){shape='<path d="M39 5h22v34h34v22H61v34H39V61H5V39h34z" fill="currentColor"/>'+(v==='⊕'||v==='⊙'?'<circle cx="50" cy="50" r="43" fill="none" stroke="currentColor" stroke-width="6"/>':'');if(v==='⊗')shape+='<path d="M18 18l64 64M82 18L18 82" stroke="#fff" stroke-width="7"/>';}
    else if(['×','✕','✖','⊗'].includes(v)){shape='<path d="M19 7L50 38 81 7l12 12-31 31 31 31-12 12-31-31-31 31L7 81l31-31L7 19z" fill="currentColor"/>';}
    else if(['☼','☀','✺','✹'].includes(v)){shape='<circle cx="50" cy="50" r="20" fill="currentColor"/><g stroke="currentColor" stroke-width="8" stroke-linecap="round"><path d="M50 4v19M50 77v19M4 50h19M77 50h19M17 17l14 14M69 69l14 14M83 17L69 31M31 69L17 83"/></g>';}
    else if(['☾','☽'].includes(v)){shape='<path d="M70 8A43 43 0 1 0 91 77 37 37 0 0 1 70 8Z" fill="currentColor"/>'+(v==='☽'?'<path d="M30 12A43 43 0 0 0 90 78 40 40 0 0 1 30 12Z" fill="currentColor"/>':'');}
    else if(v==='∞'){shape='<path d="M14 50C14 20 48 20 64 50s36 30 36 0-34-30-50 0-36 30-36 0" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>'}
    else if(v==='⚑'){shape='<path d="M24 92V8" stroke="currentColor" stroke-width="8"/><path d="M28 12h58l-12 18 12 18H28z" fill="currentColor"/>'}
    else return '';
    return `<svg class="crest-glyph-svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${shape}</svg>`;
  }
  function crestLayerMarkup(l,scale=1){
    const size=Math.max(9,Math.min(96,Number(l.size||24)*scale)),raw=String(l.value||''),isEmoji=l.kind==='emoji'&&SAFE_CREST_EMOJIS.has(raw),value=isEmoji?raw:sanitizeCrestText(raw),symbol=(l.kind==='text'||isEmoji)?'':crestSymbolSvg(SAFE_CREST_GLYPHS.has(raw)?raw:value);
    const content=isEmoji?esc(value):symbol||esc(value);
    return `<span class="crest-layer ${isEmoji?'crest-layer-emoji':''}" data-layer-id="${esc(l.id||'')}" data-layer-kind="${esc(l.kind||'symbol')}" style="left:${Number(l.x??50)}%;top:${Number(l.y??50)}%;font-size:${size}px;color:${esc(l.color||'#10140c')}">${content}</span>`;
  }
  function crestContent(logo,scale=1){const layers=Array.isArray(logo?.layers)&&logo.layers.length?logo.layers:[{kind:'symbol',value:logo?.symbol||'★',x:50,y:50,size:30,color:'#10140c'}];return layers.map(l=>crestLayerMarkup(l,scale)).join('');}
  function crestShape(logo){return `shape-${esc(logo?.shape||'shield')}`;}
  function clubVars(club){return `--crest-color:${club.logo.color};--kit-primary:${club.kit.primary};--kit-secondary:${club.kit.secondary};`}
  const UI_TRANSLATIONS = window.ZF_DATA.UI_TRANSLATIONS;
  const EXTRA_TRANSLATIONS = window.ZF_DATA.EXTRA_TRANSLATIONS;
  Object.keys(EXTRA_TRANSLATIONS).forEach(lang=>Object.assign(UI_TRANSLATIONS[lang],EXTRA_TRANSLATIONS[lang]));
  const EXTENDED_TRANSLATIONS = window.ZF_DATA.EXTENDED_TRANSLATIONS;
  Object.keys(EXTENDED_TRANSLATIONS).forEach(lang=>Object.assign(UI_TRANSLATIONS[lang],EXTENDED_TRANSLATIONS[lang]));
  const COUNTRY_UI_TRANSLATIONS = window.ZF_DATA.COUNTRY_UI_TRANSLATIONS;
  Object.keys(COUNTRY_UI_TRANSLATIONS).forEach(lang=>Object.assign(UI_TRANSLATIONS[lang],COUNTRY_UI_TRANSLATIONS[lang]));
  const MATCH_UI_TRANSLATIONS = window.ZF_DATA.MATCH_UI_TRANSLATIONS;
  Object.keys(MATCH_UI_TRANSLATIONS).forEach(lang=>Object.assign(UI_TRANSLATIONS[lang],MATCH_UI_TRANSLATIONS[lang]));
  const EVENT_SCENE_TRANSLATIONS = window.ZF_DATA.EVENT_SCENE_TRANSLATIONS;
  Object.keys(EVENT_SCENE_TRANSLATIONS).forEach(lang=>Object.assign(UI_TRANSLATIONS[lang],EVENT_SCENE_TRANSLATIONS[lang]));
  const TROPHY_UI_TRANSLATIONS = window.ZF_DATA.TROPHY_UI_TRANSLATIONS;
  Object.keys(TROPHY_UI_TRANSLATIONS).forEach(lang=>Object.assign(UI_TRANSLATIONS[lang],TROPHY_UI_TRANSLATIONS[lang]));
  const V40_TRANSLATIONS={
    en:{'Бронза':'Bronze','Серебро':'Silver','Золото':'Gold','Элита':'Elite','Икона':'Icon','ПАКИ ДЛЯ КОМАНДЫ':'PACKS FOR YOUR TEAM','ТОЛЬКО НАБОРЫ КАРТОЧЕК':'PACKS ONLY','Магазин паков':'Pack shop','Паки и ежедневный бонус':'Packs and daily bonus','Выбирай наборы карточек и усиливай состав через открытие паков.':'Choose card packs and strengthen your squad by opening them.','Футболисты попадают в клуб через открытие выбранного пака.':'Players join your club by opening the selected pack.','Выбывший игрок':'Player out','Лучшие варианты замены':'Best replacement options','Продолжить →':'Continue →','Красная карточка — удаление':'Red card — sent off','Травма — игрок не может продолжать':'Injury — unable to continue','Игрок покидает поле.':'The player leaves the pitch.','Нужна замена на позицию':'A replacement is needed at'},
    uk:{'Бронза':'Бронза','Серебро':'Срібло','Золото':'Золото','Элита':'Еліта','Икона':'Ікона','ПАКИ ДЛЯ КОМАНДЫ':'ПАКИ ДЛЯ КОМАНДИ','ТОЛЬКО НАБОРЫ КАРТОЧЕК':'ЛИШЕ НАБОРИ КАРТОК','Магазин паков':'Магазин паків','Паки и ежедневный бонус':'Паки та щоденний бонус','Выбирай наборы карточек и усиливай состав через открытие паков.':'Обирай набори карток і посилюй склад через відкриття паків.','Футболисты попадают в клуб через открытие выбранного пака.':'Футболісти потрапляють до клубу через відкриття обраного паку.','Выбывший игрок':'Гравець вибув','Лучшие варианты замены':'Найкращі варіанти заміни','Продолжить →':'Продовжити →','Красная карточка — удаление':'Червона картка — вилучення','Травма — игрок не может продолжать':'Травма — гравець не може продовжувати','Игрок покидает поле.':'Гравець залишає поле.','Нужна замена на позицию':'Потрібна заміна на позицію'},
    de:{'Бронза':'Bronze','Серебро':'Silber','Золото':'Gold','Элита':'Elite','Икона':'Ikone','ПАКИ ДЛЯ КОМАНДЫ':'PAKETE FÜR DEIN TEAM','ТОЛЬКО НАБОРЫ КАРТОЧЕК':'NUR SPIELERPAKETE','Магазин паков':'Paket-Shop','Паки и ежедневный бонус':'Pakete und täglicher Bonus','Выбирай наборы карточек и усиливай состав через открытие паков.':'Wähle Spielerpakete und verstärke deinen Kader durch das Öffnen.','Футболисты попадают в клуб через открытие выбранного пака.':'Spieler kommen durch das Öffnen eines Pakets in deinen Verein.','Выбывший игрок':'Ausgeschiedener Spieler','Лучшие варианты замены':'Beste Ersatzoptionen','Продолжить →':'Weiter →','Красная карточка — удаление':'Rote Karte — Platzverweis','Травма — игрок не может продолжать':'Verletzung — kann nicht weiterspielen','Игрок покидает поле.':'Der Spieler verlässt den Platz.','Нужна замена на позицию':'Ersatz wird benötigt auf'},
    fr:{'Бронза':'Bronze','Серебро':'Argent','Золото':'Or','Элита':'Élite','Икона':'Icône','ПАКИ ДЛЯ КОМАНДЫ':'PACKS POUR TON ÉQUIPE','ТОЛЬКО НАБОРЫ КАРТОЧЕК':'PACKS UNIQUEMENT','Магазин паков':'Boutique de packs','Паки и ежедневный бонус':'Packs et bonus quotidien','Выбирай наборы карточек и усиливай состав через открытие паков.':'Choisis des packs pour renforcer ton équipe en les ouvrant.','Футболисты попадают в клуб через открытие выбранного пака.':'Les joueurs rejoignent ton club en ouvrant le pack choisi.','Выбывший игрок':'Joueur sorti','Лучшие варианты замены':'Meilleurs remplaçants','Продолжить →':'Continuer →','Красная карточка — удаление':'Carton rouge — expulsé','Травма — игрок не может продолжать':'Blessure — ne peut pas continuer','Игрок покидает поле.':'Le joueur quitte le terrain.','Нужна замена на позицию':'Un remplaçant est nécessaire au poste'},
    es:{'Бронза':'Bronce','Серебро':'Plata','Золото':'Oro','Элита':'Élite','Икона':'Icono','ПАКИ ДЛЯ КОМАНДЫ':'PACKS PARA TU EQUIPO','ТОЛЬКО НАБОРЫ КАРТОЧЕК':'SOLO PAQUETES','Магазин паков':'Tienda de paquetes','Паки и ежедневный бонус':'Packs y bonificación diaria','Выбирай наборы карточек и усиливай состав через открытие паков.':'Elige paquetes y refuerza tu equipo al abrirlos.','Футболисты попадают в клуб через открытие выбранного пака.':'Los jugadores llegan a tu club al abrir el paquete elegido.','Выбывший игрок':'Jugador sustituido','Лучшие варианты замены':'Mejores opciones de sustitución','Продолжить →':'Continuar →','Красная карточка — удаление':'Tarjeta roja — expulsión','Травма — игрок не может продолжать':'Lesión — no puede continuar','Игрок покидает поле.':'El jugador abandona el campo.','Нужна замена на позицию':'Se necesita un reemplazo en'},
    ja:{'Бронза':'ブロンズ','Серебро':'シルバー','Золото':'ゴールド','Элита':'エリート','Икона':'アイコン','ПАКИ ДЛЯ КОМАНДЫ':'チームパック','ТОЛЬКО НАБОРЫ КАРТОЧЕК':'パックのみ','Магазин паков':'パックショップ','Паки и ежедневный бонус':'パックとデイリーボーナス','Выбирай наборы карточек и усиливай состав через открытие паков.':'パックを選んで開封し、チームを強化しましょう。','Футболисты попадают в клуб через открытие выбранного пака.':'選んだパックを開封すると選手がクラブに加わります。','Выбывший игрок':'交代する選手','Лучшие варианты замены':'おすすめの交代選手','Продолжить →':'続ける →','Красная карточка — удаление':'レッドカード — 退場','Травма — игрок не может продолжать':'負傷 — 続行できません','Игрок покидает поле.':'選手がピッチを離れます。','Нужна замена на позицию':'交代が必要なポジション'},
    zh:{'Бронза':'青铜','Серебро':'白银','Золото':'黄金','Элита':'精英','Икона':'传奇','ПАКИ ДЛЯ КОМАНДЫ':'球队卡包','ТОЛЬКО НАБОРЫ КАРТОЧЕК':'仅限卡包','Магазин паков':'卡包商店','Паки и ежедневный бонус':'卡包和每日奖励','Выбирай наборы карточек и усиливай состав через открытие паков.':'选择卡包并通过开启卡包强化阵容。','Футболисты попадают в клуб через открытие выбранного пака.':'通过开启所选卡包获得球员。','Выбывший игрок':'离场球员','Лучшие варианты замены':'最佳替补选择','Продолжить →':'继续 →','Красная карточка — удаление':'红牌 — 被罚下','Травма — игрок не может продолжать':'受伤 — 无法继续比赛','Игрок покидает поле.':'球员离开球场。','Нужна замена на позицию':'需要替补的位置'},
    kk:{'Бронза':'Қола','Серебро':'Күміс','Золото':'Алтын','Элита':'Элита','Икона':'Икона','ПАКИ ДЛЯ КОМАНДЫ':'КОМАНДАҒА АРНАЛҒАН ПАКТЕР','ТОЛЬКО НАБОРЫ КАРТОЧЕК':'ТЕК КАРТОЧКА ЖИНАҚТАРЫ','Магазин паков':'Пак дүкені','Паки и ежедневный бонус':'Пакеттер және күнделікті бонус','Выбирай наборы карточек и усиливай состав через открытие паков.':'Карточка пакеттерін таңдап, ашу арқылы құрамды күшейт.','Футболисты попадают в клуб через открытие выбранного пака.':'Ойыншылар таңдалған пакті ашу арқылы клубқа қосылады.','Выбывший игрок':'Алаңнан шыққан ойыншы','Лучшие варианты замены':'Ауыстырудың үздік нұсқалары','Продолжить →':'Жалғастыру →','Красная карточка — удаление':'Қызыл қағаз — алаңнан қуылды','Травма — игрок не может продолжать':'Жарақат — ойыншы жалғастыра алмайды','Игрок покидает поле.':'Ойыншы алаңнан кетеді.','Нужна замена на позицию':'Осы орынға ауыстырушы қажет'},
    pl:{'Бронза':'Brąz','Серебро':'Srebro','Золото':'Złoto','Элита':'Elita','Икона':'Ikona','ПАКИ ДЛЯ КОМАНДЫ':'PAKI DLA TWOJEJ DRUŻYNY','ТОЛЬКО НАБОРЫ КАРТОЧЕК':'TYLKO PAKIETY','Магазин паков':'Sklep z pakietami','Паки и ежедневный бонус':'Pakiety i codzienny bonus','Выбирай наборы карточек и усиливай состав через открытие паков.':'Wybieraj pakiety i wzmacniaj skład przez ich otwieranie.','Футболисты попадают в клуб через открытие выбранного пака.':'Piłkarze dołączają do klubu po otwarciu wybranego pakietu.','Выбывший игрок':'Zawodnik schodzący','Лучшие варианты замены':'Najlepsze opcje zmiany','Продолжить →':'Kontynuuj →','Красная карточка — удаление':'Czerwona kartka — wykluczenie','Травма — игрок не может продолжать':'Kontuzja — nie może kontynuować','Игрок покидает поле.':'Zawodnik opuszcza boisko.','Нужна замена на позицию':'Potrzebny jest zmiennik na pozycji'}
  };
  const PLAYER_UI_TRANSLATIONS={
    en:{'Профильная позиция':'Natural position','Штраф позиции':'Position penalty','Штраф за позицию':'Position penalty','Совместимая позиция':'Compatible position','Подбор по соответствию позиции и текущему рейтингу, только среди доступных запасных.':'Ranked by positional fit and current rating among available substitutes.','Или выбрать другого запасного':'Or choose another substitute','Выбери футболиста':'Choose a player','Подтвердить замену':'Confirm substitution','Продолжить без замены':'Continue without a substitution','Игрок не найден':'Player not found','Игрок недоступен':'Player unavailable','Позиция:':'Position:'},
    uk:{'Профильная позиция':'Основна позиція','Штраф позиции':'Штраф за позицію','Штраф за позицию':'Штраф за позицію','Совместимая позиция':'Сумісна позиція','Подбор по соответствию позиции и текущему рейтингу, только среди доступных запасных.':'Підібрано за відповідністю позиції та поточним рейтингом серед доступних запасних.','Или выбрать другого запасного':'Або вибрати іншого запасного','Выбери футболиста':'Вибери футболіста','Подтвердить замену':'Підтвердити заміну','Продолжить без замены':'Продовжити без заміни','Игрок не найден':'Гравця не знайдено','Игрок недоступен':'Гравець недоступний','Позиция:':'Позиція:'},
    de:{'Профильная позиция':'Stammposition','Штраф позиции':'Positionsabzug','Штраф за позицию':'Positionsabzug','Совместимая позиция':'Alternative Position','Подбор по соответствию позиции и текущему рейтингу, только среди доступных запасных.':'Sortiert nach Positionspassung und aktueller Bewertung unter verfügbaren Ersatzspielern.','Или выбрать другого запасного':'Oder einen anderen Ersatzspieler wählen','Выбери футболиста':'Spieler auswählen','Подтвердить замену':'Wechsel bestätigen','Продолжить без замены':'Ohne Wechsel fortfahren','Игрок не найден':'Spieler nicht gefunden','Игрок недоступен':'Spieler nicht verfügbar','Позиция:':'Position:'},
    fr:{'Профильная позиция':'Poste naturel','Штраф позиции':'Pénalité de poste','Штраф за позицию':'Pénalité de poste','Совместимая позиция':'Poste compatible','Подбор по соответствию позиции и текущему рейтингу, только среди доступных запасных.':'Classement selon l’adéquation au poste et la note actuelle parmi les remplaçants disponibles.','Или выбрать другого запасного':'Ou choisir un autre remplaçant','Выбери футболиста':'Choisir un joueur','Подтвердить замену':'Confirmer le remplacement','Продолжить без замены':'Continuer sans remplacement','Игрок не найден':'Joueur introuvable','Игрок недоступен':'Joueur indisponible','Позиция:':'Poste :'},
    es:{'Профильная позиция':'Posición natural','Штраф позиции':'Penalización por posición','Штраф за позицию':'Penalización por posición','Совместимая позиция':'Posición compatible','Подбор по соответствию позиции и текущему рейтингу, только среди доступных запасных.':'Ordenados por ajuste de posición y valoración actual entre los suplentes disponibles.','Или выбрать другого запасного':'O elegir otro suplente','Выбери футболиста':'Elige un jugador','Подтвердить замену':'Confirmar sustitución','Продолжить без замены':'Continuar sin sustitución','Игрок не найден':'Jugador no encontrado','Игрок недоступен':'Jugador no disponible','Позиция:':'Posición:'},
    ja:{'Профильная позиция':'本来のポジション','Штраф позиции':'ポジション補正','Штраф за позицию':'ポジション補正','Совместимая позиция':'対応可能なポジション','Подбор по соответствию позиции и текущему рейтингу, только среди доступных запасных.':'出場可能な控え選手をポジション適性と現在の評価で順位付けしています。','Или выбрать другого запасного':'別の控え選手を選択','Выбери футболиста':'選手を選択','Подтвердить замену':'交代を確定','Продолжить без замены':'交代せずに続行','Игрок не найден':'選手が見つかりません','Игрок недоступен':'出場できない選手','Позиция:':'ポジション:'},
    zh:{'Профильная позиция':'最佳位置','Штраф позиции':'位置扣分','Штраф за позицию':'位置扣分','Совместимая позиция':'适配位置','Подбор по соответствию позиции и текущему рейтингу, только среди доступных запасных.':'根据位置适配度和当前评分排列可用替补。','Или выбрать другого запасного':'或选择其他替补','Выбери футболиста':'选择球员','Подтвердить замену':'确认换人','Продолжить без замены':'不换人继续','Игрок не найден':'未找到球员','Игрок недоступен':'球员无法上场','Позиция:':'位置：'},
    kk:{'Профильная позиция':'Негізгі орны','Штраф позиции':'Орын үшін айып','Штраф за позицию':'Орын үшін айып','Совместимая позиция':'Үйлесімді орын','Подбор по соответствию позиции и текущему рейтингу, только среди доступных запасных.':'Қолжетімді қосалқы ойыншылар орын сәйкестігі мен ағымдағы рейтингі бойынша реттелген.','Или выбрать другого запасного':'Немесе басқа қосалқы ойыншыны таңда','Выбери футболиста':'Ойыншыны таңда','Подтвердить замену':'Ауыстыруды растау','Продолжить без замены':'Ауыстырусыз жалғастыру','Игрок не найден':'Ойыншы табылмады','Игрок недоступен':'Ойыншы қолжетімсіз','Позиция:':'Орын:'},
    pl:{'Профильная позиция':'Naturalna pozycja','Штраф позиции':'Kara za pozycję','Штраф за позицию':'Kara za pozycję','Совместимая позиция':'Pozycja zgodna','Подбор по соответствию позиции и текущему рейтингу, только среди доступных запасных.':'Ranking według dopasowania pozycji i aktualnej oceny dostępnych rezerwowych.','Или выбрать другого запасного':'Lub wybierz innego rezerwowego','Выбери футболиста':'Wybierz zawodnika','Подтвердить замену':'Potwierdź zmianę','Продолжить без замены':'Kontynuuj bez zmiany','Игрок не найден':'Nie znaleziono zawodnika','Игрок недоступен':'Zawodnik niedostępny','Позиция:':'Pozycja:'}
  };
  Object.entries(V40_TRANSLATIONS).forEach(([lang,dict])=>Object.assign(UI_TRANSLATIONS[lang]||(UI_TRANSLATIONS[lang]={}),dict));
  Object.entries(PLAYER_UI_TRANSLATIONS).forEach(([lang,dict])=>Object.assign(UI_TRANSLATIONS[lang]||(UI_TRANSLATIONS[lang]={}),dict));

  const V41_TRANSLATIONS = {"en":{"Язык интерфейса":"Interface language","Создание клуба":"Create a club","Твои клубы":"Your clubs","Укажи логин и пароль, настрой эмблему и форму. После создания сразу откроется управление клубом.":"Enter a login and password, customise your crest and kit. Club management opens after creation.","Выбери клуб для входа или создай новый. У каждого клуба отдельный логин и пароль.":"Choose a club to sign in or create a new one. Each club has its own login and password.","Клубы ещё не созданы":"No clubs created yet","Создай первый клуб и сохрани данные для входа.":"Create your first club and save its sign-in details.","Всего клубов:":"Total clubs:","Игровой центр":"Game centre","Управление":"Management","Выбери язык интерфейса.":"Choose the interface language.","ФОНОВАЯ МУЗЫКА":"BACKGROUND MUSIC","Включить фоновую музыку":"Enable background music","Громкость музыки":"Music volume","Стиль музыки":"Music style","Трек":"Track","Прослушать / включить":"Preview / play","Остановить музыку":"Stop music","Выключает все звуки игры, включая музыку и эффекты.":"Mutes all game audio, including music and effects.","Выбери один из пяти музыкальных стилей и пять тем в каждом стиле.":"Choose one of five music styles and five tracks in each style."},"uk":{"Язык интерфейса":"Мова інтерфейсу","Создание клуба":"Створення клубу","Твои клубы":"Твої клуби","Укажи логин и пароль, настрой эмблему и форму. После создания сразу откроется управление клубом.":"Вкажи логін і пароль, налаштуй емблему та форму. Після створення одразу відкриється керування клубом.","Выбери клуб для входа или создай новый. У каждого клуба отдельный логин и пароль.":"Обери клуб для входу або створи новий. Кожен клуб має окремий логін і пароль.","Клубы ещё не созданы":"Клуби ще не створені","Создай первый клуб и сохрани данные для входа.":"Створи перший клуб і збережи дані для входу.","Всего клубов:":"Усього клубів:","Игровой центр":"Ігровий центр","Управление":"Керування","Выбери язык интерфейса.":"Обери мову інтерфейсу.","ФОНОВАЯ МУЗЫКА":"ФОНОВА МУЗИКА","Включить фоновую музыку":"Увімкнути фонову музику","Громкость музыки":"Гучність музики","Стиль музыки":"Стиль музики","Трек":"Трек","Прослушать / включить":"Прослухати / увімкнути","Остановить музыку":"Зупинити музику","Выключает все звуки игры, включая музыку и эффекты.":"Вимикає всі звуки гри, зокрема музику та ефекти.","Выбери один из пяти музыкальных стилей и пять тем в каждом стиле.":"Обери один із п’яти музичних стилів і п’ять тем у кожному стилі."},"de":{"Язык интерфейса":"Sprache der Benutzeroberfläche","Создание клуба":"Club erstellen","Твои клубы":"Deine Clubs","Укажи логин и пароль, настрой эмблему и форму. После создания сразу откроется управление клубом.":"Gib Login und Passwort ein und passe Wappen und Trikot an. Nach der Erstellung öffnet sich die Clubverwaltung.","Выбери клуб для входа или создай новый. У каждого клуба отдельный логин и пароль.":"Wähle einen Club zum Anmelden oder erstelle einen neuen. Jeder Club hat eigene Zugangsdaten.","Клубы ещё не созданы":"Noch keine Clubs erstellt","Создай первый клуб и сохрани данные для входа.":"Erstelle deinen ersten Club und speichere die Zugangsdaten.","Всего клубов:":"Clubs insgesamt:","Игровой центр":"Spielzentrum","Управление":"Verwaltung","Выбери язык интерфейса.":"Wähle die Sprache der Benutzeroberfläche.","ФОНОВАЯ МУЗЫКА":"HINTERGRUNDMUSIK","Включить фоновую музыку":"Hintergrundmusik einschalten","Громкость музыки":"Musiklautstärke","Стиль музыки":"Musikstil","Трек":"Titel","Прослушать / включить":"Vorschau / abspielen","Остановить музыку":"Musik stoppen","Выключает все звуки игры, включая музыку и эффекты.":"Schaltet alle Spielgeräusche einschließlich Musik und Effekte stumm.","Выбери один из пяти музыкальных стилей и пять тем в каждом стиле.":"Wähle einen von fünf Musikstilen mit jeweils fünf Titeln."},"fr":{"Язык интерфейса":"Langue de l’interface","Создание клуба":"Créer un club","Твои клубы":"Tes clubs","Укажи логин и пароль, настрой эмблему и форму. После создания сразу откроется управление клубом.":"Saisis un identifiant et un mot de passe, puis personnalise l’écusson et le maillot. La gestion du club s’ouvrira après sa création.","Выбери клуб для входа или создай новый. У каждого клуба отдельный логин и пароль.":"Choisis un club ou crée-en un nouveau. Chaque club possède ses propres identifiants.","Клубы ещё не созданы":"Aucun club créé","Создай первый клуб и сохрани данные для входа.":"Crée ton premier club et enregistre tes identifiants.","Всего клубов:":"Nombre de clubs :","Игровой центр":"Centre de jeu","Управление":"Gestion","Выбери язык интерфейса.":"Choisis la langue de l’interface.","ФОНОВАЯ МУЗЫКА":"MUSIQUE DE FOND","Включить фоновую музыку":"Activer la musique de fond","Громкость музыки":"Volume de la musique","Стиль музыки":"Style musical","Трек":"Piste","Прослушать / включить":"Écouter / activer","Остановить музыку":"Arrêter la musique","Выключает все звуки игры, включая музыку и эффекты.":"Coupe tous les sons du jeu, musique et effets compris.","Выбери один из пяти музыкальных стилей и пять тем в каждом стиле.":"Choisis un des cinq styles musicaux et cinq morceaux par style."},"es":{"Язык интерфейса":"Idioma de la interfaz","Создание клуба":"Crear un club","Твои клубы":"Tus clubes","Укажи логин и пароль, настрой эмблему и форму. После создания сразу откроется управление клубом.":"Introduce un usuario y contraseña y personaliza el escudo y la equipación. La gestión del club se abrirá al crearlo.","Выбери клуб для входа или создай новый. У каждого клуба отдельный логин и пароль.":"Elige un club para entrar o crea uno nuevo. Cada club tiene su propio usuario y contraseña.","Клубы ещё не созданы":"Todavía no hay clubes","Создай первый клуб и сохрани данные для входа.":"Crea tu primer club y guarda tus datos de acceso.","Всего клубов:":"Clubes en total:","Игровой центр":"Centro de juego","Управление":"Gestión","Выбери язык интерфейса.":"Elige el idioma de la interfaz.","ФОНОВАЯ МУЗЫКА":"MÚSICA DE FONDO","Включить фоновую музыку":"Activar música de fondo","Громкость музыки":"Volumen de música","Стиль музыки":"Estilo musical","Трек":"Pista","Прослушать / включить":"Escuchar / reproducir","Остановить музыку":"Detener música","Выключает все звуки игры, включая музыку и эффекты.":"Silencia todos los sonidos del juego, incluida la música y los efectos.","Выбери один из пяти музыкальных стилей и пять тем в каждом стиле.":"Elige uno de cinco estilos musicales con cinco temas cada uno."},"ja":{"Язык интерфейса":"インターフェース言語","Создание клуба":"クラブを作成","Твои клубы":"あなたのクラブ","Укажи логин и пароль, настрой эмблему и форму. После создания сразу откроется управление клубом.":"ログインとパスワードを入力し、エンブレムとユニフォームを設定します。作成後、クラブ管理が開きます。","Выбери клуб для входа или создай новый. У каждого клуба отдельный логин и пароль.":"ログインするクラブを選ぶか、新しいクラブを作成してください。クラブごとにログイン情報があります。","Клубы ещё не созданы":"クラブはまだありません","Создай первый клуб и сохрани данные для входа.":"最初のクラブを作成してログイン情報を保存しましょう。","Всего клубов:":"クラブ数：","Игровой центр":"ゲームセンター","Управление":"管理","Выбери язык интерфейса.":"インターフェース言語を選択してください。","ФОНОВАЯ МУЗЫКА":"BGM","Включить фоновую музыку":"BGMを有効にする","Громкость музыки":"音量","Стиль музыки":"音楽スタイル","Трек":"トラック","Прослушать / включить":"試聴 / 再生","Остановить музыку":"音楽を停止","Выключает все звуки игры, включая музыку и эффекты.":"音楽と効果音を含むすべてのゲーム音声をミュートします。","Выбери один из пяти музыкальных стилей и пять тем в каждом стиле.":"5つの音楽スタイルから選択でき、それぞれに5曲あります。"},"zh":{"Язык интерфейса":"界面语言","Создание клуба":"创建俱乐部","Твои клубы":"你的俱乐部","Укажи логин и пароль, настрой эмблему и форму. После создания сразу откроется управление клубом.":"输入账号和密码，设置队徽与球衣。创建后将直接进入俱乐部管理。","Выбери клуб для входа или создай новый. У каждого клуба отдельный логин и пароль.":"选择一个俱乐部登录，或创建新俱乐部。每个俱乐部都有独立的账号和密码。","Клубы ещё не созданы":"尚未创建俱乐部","Создай первый клуб и сохрани данные для входа.":"创建你的第一个俱乐部并保存登录信息。","Всего клубов:":"俱乐部总数：","Игровой центр":"游戏中心","Управление":"管理","Выбери язык интерфейса.":"选择界面语言。","ФОНОВАЯ МУЗЫКА":"背景音乐","Включить фоновую музыку":"开启背景音乐","Громкость музыки":"音乐音量","Стиль музыки":"音乐风格","Трек":"曲目","Прослушать / включить":"试听 / 播放","Остановить музыку":"停止音乐","Выключает все звуки игры, включая музыку и эффекты.":"关闭游戏中的所有声音，包括音乐和音效。","Выбери один из пяти музыкальных стилей и пять тем в каждом стиле.":"可选择五种音乐风格，每种风格有五首曲目。"},"kk":{"Язык интерфейса":"Интерфейс тілі","Создание клуба":"Клуб құру","Твои клубы":"Сенің клубтарың","Укажи логин и пароль, настрой эмблему и форму. После создания сразу откроется управление клубом.":"Логин мен құпиясөзді енгізіп, эмблема мен форманы бапта. Құрылғаннан кейін клубты басқару ашылады.","Выбери клуб для входа или создай новый. У каждого клуба отдельный логин и пароль.":"Кіру үшін клубты таңда немесе жаңасын құр. Әр клубтың жеке логині мен құпиясөзі бар.","Клубы ещё не созданы":"Әзірге клубтар жоқ","Создай первый клуб и сохрани данные для входа.":"Алғашқы клубыңды құрып, кіру деректерін сақта.","Всего клубов:":"Клубтар саны:","Игровой центр":"Ойын орталығы","Управление":"Басқару","Выбери язык интерфейса.":"Интерфейс тілін таңда.","ФОНОВАЯ МУЗЫКА":"ФОНДЫҚ МУЗЫКА","Включить фоновую музыку":"Фондық музыканы қосу","Громкость музыки":"Музыка дыбысы","Стиль музыки":"Музыка стилі","Трек":"Трек","Прослушать / включить":"Тыңдау / қосу","Остановить музыку":"Музыканы тоқтату","Выключает все звуки игры, включая музыку и эффекты.":"Музыка мен әсерлерді қоса алғанда, ойынның барлық дыбысын өшіреді.","Выбери один из пяти музыкальных стилей и пять тем в каждом стиле.":"Бес музыкалық стильдің бірін және әр стильдегі бес әуеннің бірін таңда."},"pl":{"Язык интерфейса":"Język interfejsu","Создание клуба":"Utwórz klub","Твои клубы":"Twoje kluby","Укажи логин и пароль, настрой эмблему и форму. После создания сразу откроется управление клубом.":"Wpisz login i hasło, a następnie dostosuj herb i strój. Po utworzeniu otworzy się zarządzanie klubem.","Выбери клуб для входа или создай новый. У каждого клуба отдельный логин и пароль.":"Wybierz klub lub utwórz nowy. Każdy klub ma osobny login i hasło.","Клубы ещё не созданы":"Nie utworzono jeszcze klubów","Создай первый клуб и сохрани данные для входа.":"Utwórz pierwszy klub i zapisz dane logowania.","Всего клубов:":"Liczba klubów:","Игровой центр":"Centrum gry","Управление":"Zarządzanie","Выбери язык интерфейса.":"Wybierz język interfejsu.","ФОНОВАЯ МУЗЫКА":"MUZYKA W TLE","Включить фоновую музыку":"Włącz muzykę w tle","Громкость музыки":"Głośność muzyki","Стиль музыки":"Styl muzyczny","Трек":"Utwór","Прослушать / включить":"Odsłuchaj / odtwórz","Остановить музыку":"Zatrzymaj muzykę","Выключает все звуки игры, включая музыку и эффекты.":"Wycisza wszystkie dźwięki gry, w tym muzykę i efekty.","Выбери один из пяти музыкальных стилей и пять тем в каждом стиле.":"Wybierz jeden z pięciu stylów muzycznych i jeden z pięciu utworów w każdym stylu."}};
  Object.entries(V41_TRANSLATIONS).forEach(([lang,dict])=>Object.assign(UI_TRANSLATIONS[lang]||(UI_TRANSLATIONS[lang]={}),dict));
  const V42_START_TRANSLATIONS = {
    en:{'Собери состав мечты, открывай паки и докажи, что именно твой клуб достоин вершины.':'Build your dream squad, open packs and prove your club deserves the top.','Создать новый клуб':'Create a new club','Удалить клуб':'Delete club','матчей':'matches','защищённый профиль':'protected profile','Вход в клуб':'Club sign-in','Логин клуба':'Club login','Пароль':'Password','Войти в клуб':'Sign in to club','Отмена':'Cancel','Слишком много попыток. Попробуй снова через':'Too many attempts. Try again in','Слишком много попыток. Повтори через':'Too many attempts. Try again in','Неверный логин или пароль.':'Incorrect login or password.','YOUR CLUB. YOUR LEGACY.':'YOUR CLUB. YOUR LEGACY.','ZERO FOOTBALL / CLUB HUB':'ZERO FOOTBALL / CLUB HUB'},
    uk:{'Собери состав мечты, открывай паки и докажи, что именно твой клуб достоин вершины.':'Збери команду мрії, відкривай паки та доведи, що саме твій клуб гідний вершини.','Создать новый клуб':'Створити новий клуб','Удалить клуб':'Видалити клуб','матчей':'матчів','защищённый профиль':'захищений профіль','Вход в клуб':'Вхід до клубу','Логин клуба':'Логін клубу','Пароль':'Пароль','Войти в клуб':'Увійти до клубу','Отмена':'Скасувати','Неверный логин или пароль.':'Неправильний логін або пароль.'},
    de:{'Собери состав мечты, открывай паки и докажи, что именно твой клуб достоин вершины.':'Stelle dein Traumteam zusammen, öffne Packs und beweise, dass dein Club an die Spitze gehört.','Создать новый клуб':'Neuen Club erstellen','Удалить клуб':'Club löschen','матчей':'Spiele','защищённый профиль':'geschütztes Profil','Вход в клуб':'Club-Anmeldung','Логин клуба':'Club-Login','Пароль':'Passwort','Войти в клуб':'Beim Club anmelden','Отмена':'Abbrechen','Неверный логин или пароль.':'Falscher Login oder Passwort.'},
    fr:{'Собери состав мечты, открывай паки и докажи, что именно твой клуб достоин вершины.':'Compose ton équipe de rêve, ouvre des packs et prouve que ton club mérite le sommet.','Создать новый клуб':'Créer un nouveau club','Удалить клуб':'Supprimer le club','матчей':'matchs','защищённый профиль':'profil sécurisé','Вход в клуб':'Connexion au club','Логин клуба':'Identifiant du club','Пароль':'Mot de passe','Войти в клуб':'Se connecter au club','Отмена':'Annuler','Неверный логин или пароль.':'Identifiant ou mot de passe incorrect.'},
    es:{'Собери состав мечты, открывай паки и докажи, что именно твой клуб достоин вершины.':'Forma tu equipo soñado, abre sobres y demuestra que tu club merece llegar a lo más alto.','Создать новый клуб':'Crear un club nuevo','Удалить клуб':'Eliminar club','матчей':'partidos','защищённый профиль':'perfil protegido','Вход в клуб':'Acceso al club','Логин клуба':'Usuario del club','Пароль':'Contraseña','Войти в клуб':'Entrar al club','Отмена':'Cancelar','Неверный логин или пароль.':'Usuario o contraseña incorrectos.'},
    ja:{'Собери состав мечты, открывай паки и докажи, что именно твой клуб достоин вершины.':'夢のチームを編成し、パックを開封して、クラブが頂点にふさわしいことを証明しよう。','Создать новый клуб':'新しいクラブを作成','Удалить клуб':'クラブを削除','матчей':'試合','защищённый профиль':'保護されたプロフィール','Вход в клуб':'クラブにログイン','Логин клуба':'クラブのログイン名','Пароль':'パスワード','Войти в клуб':'クラブにログイン','Отмена':'キャンセル','Неверный логин или пароль.':'ログイン名またはパスワードが違います。'},
    zh:{'Собери состав мечты, открывай паки и докажи, что именно твой клуб достоин вершины.':'组建梦想阵容，开启球员包，证明你的俱乐部配得上巅峰。','Создать новый клуб':'创建新俱乐部','Удалить клуб':'删除俱乐部','матчей':'场比赛','защищённый профиль':'受保护的个人资料','Вход в клуб':'俱乐部登录','Логин клуба':'俱乐部账号','Пароль':'密码','Войти в клуб':'登录俱乐部','Отмена':'取消','Неверный логин или пароль.':'账号或密码错误。'},
    kk:{'Собери состав мечты, открывай паки и докажи, что именно твой клуб достоин вершины.':'Армандаған құрамаңды жина, пактарды аш және клубыңның үздік болуға лайық екенін дәлелде.','Создать новый клуб':'Жаңа клуб құру','Удалить клуб':'Клубты жою','матчей':'матч','защищённый профиль':'қорғалған профиль','Вход в клуб':'Клубқа кіру','Логин клуба':'Клуб логині','Пароль':'Құпиясөз','Войти в клуб':'Клубқа кіру','Отмена':'Бас тарту','Неверный логин или пароль.':'Логин немесе құпиясөз қате.'},
    pl:{'Собери состав мечты, открывай паки и докажи, что именно твой клуб достоин вершины.':'Zbuduj wymarzony skład, otwieraj paczki i udowodnij, że twój klub zasługuje na szczyt.','Создать новый клуб':'Utwórz nowy klub','Удалить клуб':'Usuń klub','матчей':'meczów','защищённый профиль':'chroniony profil','Вход в клуб':'Logowanie do klubu','Логин клуба':'Login klubu','Пароль':'Hasło','Войти в клуб':'Zaloguj się do klubu','Отмена':'Anuluj','Неверный логин или пароль.':'Nieprawidłowy login lub hasło.'}
  };
  Object.entries(V42_START_TRANSLATIONS).forEach(([lang,dict])=>Object.assign(UI_TRANSLATIONS[lang]||(UI_TRANSLATIONS[lang]={}),dict));
  const V42_MENU_SLOGANS = {
    en:{'YOUR CLUB. YOUR LEGACY.':'YOUR CLUB. YOUR LEGACY.','BUILD.':'BUILD.','PLAY.':'PLAY.','CONQUER.':'CONQUER.','MATCHDAY':'MATCHDAY','PLAYER PACKS':'PLAYER PACKS','YOUR LEGACY':'YOUR LEGACY'},
    uk:{'YOUR CLUB. YOUR LEGACY.':'ТВІЙ КЛУБ. ТВОЯ СПАДЩИНА.','BUILD.':'СТВОРЮЙ.','PLAY.':'ГРАЙ.','CONQUER.':'ПЕРЕМАГАЙ.','MATCHDAY':'ДЕНЬ МАТЧУ','PLAYER PACKS':'ПАКИ ГРАВЦІВ','YOUR LEGACY':'ТВОЯ СПАДЩИНА'},
    de:{'YOUR CLUB. YOUR LEGACY.':'DEIN CLUB. DEIN VERMÄCHTNIS.','BUILD.':'ERSCHAFFE.','PLAY.':'SPIELE.','CONQUER.':'SIEGE.','MATCHDAY':'SPIELTAG','PLAYER PACKS':'SPIELER-PACKS','YOUR LEGACY':'DEIN VERMÄCHTNIS'},
    fr:{'YOUR CLUB. YOUR LEGACY.':'TON CLUB. TON HÉRITAGE.','BUILD.':'CONSTRUIS.','PLAY.':'JOUE.','CONQUER.':'TRIOMPHE.','MATCHDAY':'JOUR DE MATCH','PLAYER PACKS':'PACKS DE JOUEURS','YOUR LEGACY':'TON HÉRITAGE'},
    es:{'YOUR CLUB. YOUR LEGACY.':'TU CLUB. TU LEGADO.','BUILD.':'CONSTRUYE.','PLAY.':'JUEGA.','CONQUER.':'CONQUISTA.','MATCHDAY':'DÍA DE PARTIDO','PLAYER PACKS':'SOBRES DE JUGADORES','YOUR LEGACY':'TU LEGADO'},
    ja:{'YOUR CLUB. YOUR LEGACY.':'君のクラブ。君の伝説。','BUILD.':'築こう。','PLAY.':'プレイ。','CONQUER.':'制覇しよう。','MATCHDAY':'試合の日','PLAYER PACKS':'選手パック','YOUR LEGACY':'君の伝説'},
    zh:{'YOUR CLUB. YOUR LEGACY.':'你的俱乐部，你的传奇。','BUILD.':'建设。','PLAY.':'比赛。','CONQUER.':'征服。','MATCHDAY':'比赛日','PLAYER PACKS':'球员包','YOUR LEGACY':'你的传奇'},
    kk:{'YOUR CLUB. YOUR LEGACY.':'СЕНІҢ КЛУБЫҢ. СЕНІҢ МҰРАҢ.','BUILD.':'ҚҰР.','PLAY.':'ОЙНА.','CONQUER.':'ЖЕҢІСКЕ ЖЕТ.','MATCHDAY':'МАТЧ КҮНІ','PLAYER PACKS':'ОЙЫНШЫ ПАКТАРЫ','YOUR LEGACY':'СЕНІҢ МҰРАҢ'},
    pl:{'YOUR CLUB. YOUR LEGACY.':'TWÓJ KLUB. TWOJE DZIEDZICTWO.','BUILD.':'BUDUJ.','PLAY.':'GRAJ.','CONQUER.':'ZWYCIĘŻAJ.','MATCHDAY':'DZIEŃ MECZOWY','PLAYER PACKS':'PACZKI ZAWODNIKÓW','YOUR LEGACY':'TWOJE DZIEDZICTWO'}
  };
  Object.entries(V42_MENU_SLOGANS).forEach(([lang,dict])=>Object.assign(UI_TRANSLATIONS[lang]||(UI_TRANSLATIONS[lang]={}),dict));


  function translateUIText(value){const lang=db.language||'ru';if(lang==='ru'||!UI_TRANSLATIONS[lang]||typeof value!=='string')return value;const dict=UI_TRANSLATIONS[lang],entries=Object.entries(dict).sort((a,b)=>b[0].length-a[0].length);const trimmed=value.trim();if(dict[trimmed])return value.replace(trimmed,dict[trimmed]);let out=value;for(const [source,target] of entries){if(source.length<3)continue;const escaped=source.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const re=new RegExp(escaped,'gi');out=out.replace(re,match=>{if(match===match.toLocaleUpperCase())return target.toLocaleUpperCase(lang);if(match[0]===match[0].toLocaleUpperCase()&&match.slice(1)===match.slice(1).toLocaleLowerCase())return target[0].toLocaleUpperCase(lang)+target.slice(1);return target;});}return out;}
  function applyLanguage(){const lang=Object.hasOwn(UI_TRANSLATIONS,db.language)?db.language:'ru';document.documentElement.lang=lang;const root=$('#app');if(!root||lang==='ru')return;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(n=>{if(n.parentElement?.closest('[data-no-translate]'))return;n.nodeValue=translateUIText(n.nodeValue);});root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el=>{if(el.closest('[data-no-translate]'))return;['placeholder','title','aria-label'].forEach(a=>{const value=el.getAttribute(a);if(value)el.setAttribute(a,translateUIText(value));});});}
  function setInterfaceLanguage(value){const allowed=['ru','uk','en','de','fr','es','ja','zh','kk','pl'];const next=allowed.includes(String(value))?String(value):'ru';if(db.language===next){document.documentElement.lang=next;return;}db.language=next;document.documentElement.lang=next;saveDB();render();}
  document.addEventListener('change',e=>{const select=e.target?.closest?.('[data-setting="language"]');if(!select)return;e.stopPropagation();setInterfaceLanguage(select.value);},true);
  function render(){
    const club=currentClub();
    if(!club){$('#app').innerHTML=renderStart();applyLanguage();return;}
    $('#app').innerHTML=renderLayout(club);
    if(reveal)$('#app').insertAdjacentHTML('beforeend',renderReveal());
    if(editSlotIndex!==null)$('#app').insertAdjacentHTML('beforeend',renderAssignModal(club,editSlotIndex));
    if(playerModalRef)$('#app').insertAdjacentHTML('beforeend',renderPlayerModal(club));
    resolvePlayerImages();
    applyLanguage();
    syncMatchCountdownUI();
  }
  function syncMatchCountdownUI(){
    if(matchCountdownInterval){clearInterval(matchCountdownInterval);matchCountdownInterval=null;}
    const tick=()=>{
      const nodes=$$('#app [data-countdown-deadline]');
      nodes.forEach(node=>{const ms=Math.max(0,Number(node.dataset.countdownDeadline)-Date.now());node.textContent=`${Math.ceil(ms/1000)} сек.`;});
      if(!nodes.length&&matchCountdownInterval){clearInterval(matchCountdownInterval);matchCountdownInterval=null;}
    };
    tick();
    if($$('#app [data-countdown-deadline]').length)matchCountdownInterval=setInterval(tick,250);
  }
  function clearMatchTimers(){
    ['timer','agreementTimer','actionTimer'].forEach(key=>{if(matchState?.[key])clearTimeout(matchState[key]);});
    if(matchCountdownInterval){clearInterval(matchCountdownInterval);matchCountdownInterval=null;}
  }
  function renderClubLoginModal(club){
    if(!club)return '';
    const state=AUTH_FAILURES.get(String(club.id))||{count:0,until:0};
    const locked=state.until>Date.now();
    return `<div class="modal-backdrop login-modal-backdrop"><form id="clubLoginForm" class="modal login-modal"><div class="modal-head"><div><div class="eyebrow">SECURE CLUB ACCESS</div><h2>ВХОД В КЛУБ</h2><p class="muted small">${esc(countryData(club.country).flag)} ${esc(club.name)}</p></div><button type="button" class="icon-btn" data-action="cancel-club-login" aria-label="Закрыть">✕</button></div><div class="field"><label for="clubLoginInput">Логин клуба</label><input id="clubLoginInput" name="clubLogin" type="text" minlength="3" maxlength="24" autocomplete="username" autocapitalize="none" spellcheck="false" required /></div><div class="field"><label for="clubPasswordInput">Пароль</label><input id="clubPasswordInput" name="clubPassword" type="password" maxlength="64" autocomplete="current-password" required /></div>${locked?`<p class="form-error">Слишком много попыток. Попробуй снова через ${Math.ceil((state.until-Date.now())/1000)} сек.</p>`:''}<div class="settings-actions"><button class="btn btn-primary btn-full" type="submit" ${locked?'disabled':''}>Войти в клуб →</button><button class="btn btn-quiet btn-full" type="button" data-action="cancel-club-login">Отмена</button></div></form></div>`;
  }
  function renderStart(){
    const clubs=accountClubs();
    const clubTiles=clubs.length?`<div class="saved-clubs">${clubs.map(c=>`<div class="saved-club-row"><button class="saved-club" data-action="select-club" data-club-id="${esc(c.id)}"><span class="club-crest ${crestShape(c.logo)}" style="--crest-color:${esc(c.logo.color)}">${crestContent(c.logo,.55)}</span><span class="saved-club-copy"><strong>${esc(countryData(c.country).flag)} ${esc(c.name)}</strong><small>${teamRating(c)} OVR · ${c.stats.matches||0} матчей · ${formatMoney(c.coins)} · защищённый профиль</small></span><span class="club-arrow">›</span></button><button class="btn btn-danger btn-sm" data-action="delete-club" data-club-id="${esc(c.id)}" title="Удалить клуб">✕</button></div>`).join('')}</div>`:`<div class="empty-state" style="padding:21px 12px;margin-bottom:14px"><div class="empty-icon">🏟️</div><strong>Клубы ещё не созданы</strong><span class="small">Создай первый клуб и сохрани данные для входа.</span></div>`;
    const chooser=startMode==='create'?renderCreateForm():`${clubTiles}<button class="btn btn-primary btn-full" data-action="start-create">＋ Создать новый клуб</button>`;
    return `<div class="start-screen"><div class="start-wrap"><div class="start-brand"><div class="brand-mark">ZF</div><div class="brand-name">ZERO <span>FOOTBALL</span></div></div><div class="start-layout"><section class="start-hero"><div><div class="eyebrow">YOUR CLUB. YOUR LEGACY.</div><h1>BUILD.<br><span>PLAY.</span><br>CONQUER.</h1></div><div class="hero-bottom"><p>Собери состав мечты, открывай паки и докажи, что именно твой клуб достоин вершины.</p><div class="feature-row"><span>⚽ MATCHDAY</span><span>🎴 PLAYER PACKS</span><span>🏆 YOUR LEGACY</span></div></div><div class="hero-orb"></div></section><section class="start-panel"><div class="start-language"><label for="startLanguage">🌐 Язык интерфейса</label><select id="startLanguage" class="select-compact" data-setting="language"><option value="ru" ${db.language==="ru"?"selected":""}>🇷🇺 Русский</option><option value="uk" ${db.language==="uk"?"selected":""}>🇺🇦 Українська</option><option value="en" ${db.language==="en"?"selected":""}>🇬🇧 English</option><option value="de" ${db.language==="de"?"selected":""}>🇩🇪 Deutsch</option><option value="fr" ${db.language==="fr"?"selected":""}>🇫🇷 Français</option><option value="es" ${db.language==="es"?"selected":""}>🇪🇸 Español</option><option value="ja" ${db.language==="ja"?"selected":""}>🇯🇵 日本語</option><option value="zh" ${db.language==="zh"?"selected":""}>🇨🇳 中文</option><option value="kk" ${db.language==="kk"?"selected":""}>🇰🇿 Қазақша</option><option value="pl" ${db.language==="pl"?"selected":""}>🇵🇱 Polski</option></select></div><div class="eyebrow">ZERO FOOTBALL / CLUB HUB</div><h2>${startMode==='create'?'Создание клуба':'Твои клубы'}</h2><p>${startMode==='create'?'Укажи логин и пароль, настрой эмблему и форму. После создания сразу откроется управление клубом.':'Выбери клуб для входа или создай новый. У каждого клуба отдельный логин и пароль.'}</p>${chooser}<div class="divider"></div><div class="small muted">Всего клубов: ${clubs.length}</div></section></div></div></div>${loginClubId?renderClubLoginModal(clubs.find(c=>c.id===loginClubId)):''}`;
  }
  function renderCrestLayerRows(layers,mode){
    return (layers||[]).map((l)=>`<div class="logo-layer-row" data-layer-row="${esc(l.id)}"><span class="layer-value">${esc(l.value)}</span><input class="layer-color-input" type="color" value="${esc(l.color||'#10140c')}" aria-label="Цвет элемента ${esc(l.value)}" data-crest-layer-color="1" data-mode="${mode}" data-layer-id="${esc(l.id)}"/><small class="layer-size">${Math.round(l.size||24)}px</small><button type="button" class="btn btn-quiet btn-sm" title="Уменьшить объект" data-action="crest-layer-size-down" data-mode="${mode}" data-layer-id="${esc(l.id)}">−</button><button type="button" class="btn btn-quiet btn-sm" title="Увеличить объект" data-action="crest-layer-size-up" data-mode="${mode}" data-layer-id="${esc(l.id)}">＋</button><button type="button" class="btn btn-quiet btn-sm" title="На передний план" data-action="crest-layer-up" data-mode="${mode}" data-layer-id="${esc(l.id)}">↑</button><button type="button" class="btn btn-quiet btn-sm" title="На задний план" data-action="crest-layer-down" data-mode="${mode}" data-layer-id="${esc(l.id)}">↓</button><button type="button" class="btn btn-quiet btn-sm" title="Удалить элемент" data-action="crest-layer-delete" data-mode="${mode}" data-layer-id="${esc(l.id)}">✕</button></div>`).join('');
  }
  function renderCrestPickers(mode){
    return `<details class="crest-picker"><summary>＋ Геральдические символы и фигуры <span class="muted small">${SYMBOLS.length}</span></summary><div class="symbol-picks">${SYMBOLS.map(sym=>`<button type="button" class="symbol-pick" data-action="crest-add-symbol" data-mode="${mode}" data-symbol="${esc(sym)}" aria-label="Добавить символ ${esc(sym)}" title="Добавить ${esc(sym)}">${crestSymbolSvg(sym)||esc(sym)}</button>`).join('')}</div></details><details class="crest-picker"><summary>😀 Эмодзи для эмблемы <span class="muted small">30</span></summary><div class="emoji-picks">${EMBLEM_EMOJIS.map(emoji=>`<button type="button" class="emoji-pick" data-action="crest-add-emoji" data-mode="${mode}" data-emoji="${esc(emoji)}" aria-label="Добавить эмодзи ${esc(emoji)}" title="Добавить ${esc(emoji)}">${esc(emoji)}</button>`).join('')}</div></details>`;
  }
  function renderCrestLayerTools(mode,layers){
    return `${renderCrestPickers(mode)}<div class="field"><label for="${mode}LogoText">Добавить текст</label><div class="field-row"><input id="${mode}LogoText" maxlength="5" placeholder="ZF"/><button type="button" class="btn btn-secondary btn-sm" data-action="crest-add-text" data-mode="${mode}">＋ Текст</button></div></div><div class="field"><label>Элементы эмблемы и их цвета</label><div id="${mode}LogoLayerList" class="logo-layer-list">${renderCrestLayerRows(layers,mode)}</div><small class="muted small">Выбери цвет у каждого слоя отдельно. Перетаскивай элементы прямо на эмблеме, чтобы менять их положение.</small></div>`;
  }
  function renderCrestBuilder(){
    const layers=createDraft.layers||[];
    return `<div class="crest-builder"><div id="createCrest" class="crest-big crest-builder-preview shape-${esc(createDraft.shape||'shield')}" style="--crest-color:${esc(createDraft.logoColor)}">${layers.map(l=>crestLayerMarkup(l)).join('')}</div><div class="crest-tools"><div class="field"><label>Форма эмблемы</label><select id="createLogoShape"><option value="shield" ${createDraft.shape==='shield'?'selected':''}>Щит</option><option value="round" ${createDraft.shape==='round'?'selected':''}>Круг</option><option value="square" ${createDraft.shape==='square'?'selected':''}>Квадрат</option><option value="diamond" ${createDraft.shape==='diamond'?'selected':''}>Ромб</option><option value="classic" ${createDraft.shape==='classic'?'selected':''}>Классическая</option><option value="hexagon" ${createDraft.shape==='hexagon'?'selected':''}>Шестиугольник</option><option value="rounded" ${createDraft.shape==='rounded'?'selected':''}>Скруглённая</option><option value="banner" ${createDraft.shape==='banner'?'selected':''}>Знамя</option><option value="circle-crest" ${createDraft.shape==='circle-crest'?'selected':''}>Круглая с каймой</option></select></div><div class="field"><label>Цвет основы</label><input id="createLogoColor" class="color-input" type="color" value="${esc(createDraft.logoColor)}" data-preview="create-color" /></div>${renderCrestLayerTools('create',layers)}</div></div>`;
  }
  function renderEditCrestBuilder(logo){
    const layers=Array.isArray(logo.layers)&&logo.layers.length?logo.layers:[{id:'base',kind:'symbol',value:logo.symbol||'★',x:50,y:48,size:34,color:'#10140c'}];
    return `<div class="crest-builder"><div id="editCrest" class="crest-big crest-builder-preview ${crestShape(logo)}" style="--crest-color:${esc(logo.color||'#c8ff44')}">${layers.map(l=>crestLayerMarkup(l)).join('')}</div><div class="crest-tools"><div class="field"><label for="editLogoShape">Форма эмблемы</label><select id="editLogoShape"><option value="shield" ${logo.shape==='shield'?'selected':''}>Щит</option><option value="round" ${logo.shape==='round'?'selected':''}>Круг</option><option value="square" ${logo.shape==='square'?'selected':''}>Квадрат</option><option value="diamond" ${logo.shape==='diamond'?'selected':''}>Ромб</option><option value="classic" ${logo.shape==='classic'?'selected':''}>Классическая</option><option value="hexagon" ${logo.shape==='hexagon'?'selected':''}>Шестиугольник</option><option value="rounded" ${logo.shape==='rounded'?'selected':''}>Скруглённая</option><option value="banner" ${logo.shape==='banner'?'selected':''}>Знамя</option><option value="circle-crest" ${logo.shape==='circle-crest'?'selected':''}>Круглая с каймой</option></select></div><div class="field"><label for="editLogoColor">Цвет основы</label><input id="editLogoColor" class="color-input" type="color" value="${esc(logo.color||'#c8ff44')}" data-preview="edit-logo-color" /></div>${renderCrestLayerTools('edit',layers)}</div></div>`;
  }
  function renderCreateForm(){
    return `<form id="createClubForm" class="create-club-form"><div class="field"><label for="newClubName">Название клуба</label><input id="newClubName" name="clubName" maxlength="26" required placeholder="Например, Zero United" autocomplete="off" /></div><div class="field"><label for="newClubLogin">Логин клуба</label><input id="newClubLogin" name="clubLogin" type="text" minlength="3" maxlength="24" pattern="[A-Za-z0-9_]+" required autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Например, zero_united" /><small class="muted small">Формат: 3–24 символа; только латинские буквы A–Z, цифры 0–9 и знак _.</small></div><div class="field"><label for="newClubPassword">Пароль</label><input id="newClubPassword" name="clubPassword" type="password" minlength="8" maxlength="64" required autocomplete="new-password" placeholder="Минимум 8 символов" /><small class="muted small">Формат: 8–64 символа. Можно использовать латиницу, цифры и специальные знаки. Регистр учитывается.</small></div><div class="field"><label>Конструктор эмблемы</label>${renderCrestBuilder()}</div><div class="field"><label for="newCountry">Страна клуба</label><select name="country" id="newCountry" required>${Object.entries(COUNTRY).map(([code,c])=>`<option value="${code}" ${code==='ua'?'selected':''}>${c.flag} ${c.name}</option>`).join('')}</select><small id="starterBonus" class="muted small">🇺🇦 Стартовый пак: 16 игроков · Бонус страны: ${COUNTRY.ua.bonus}</small></div><div class="field-row"><div class="field"><label for="newKitPrimary">Цвет формы</label><input id="newKitPrimary" name="kitPrimary" class="color-input" type="color" value="#c8ff44" /></div><div class="field"><label for="newKitSecondary">Доп. цвет</label><input id="newKitSecondary" name="kitSecondary" class="color-input" type="color" value="#172318" /></div></div><div class="field"><label for="newKitPattern">Узор формы</label><select id="newKitPattern" name="kitPattern">${KIT_PATTERNS.map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></div><button class="btn btn-primary btn-full" type="button" data-action="create-club-submit">Создать клуб и перейти к управлению →</button><button class="btn btn-quiet btn-full" type="button" data-action="start-back">Назад</button></form>`;
  }
  const NAV_ITEMS = window.ZF_DATA.NAV_ITEMS;
  function navButtons(mobile=false){const items=mobile?NAV_ITEMS:NAV_ITEMS;return items.map(([id,icon,label])=>`<button class="nav-item ${view===id?'active':''}" data-action="nav" data-view="${id}"><span class="nav-icon">${icon}</span><span>${label}</span></button>`).join('');}
  function renderLayout(club){
    const style=clubVars(club);
    return `<div class="game-layout" data-theme="${esc(db.theme||'classic')}" style="${style}"><aside class="sidebar"><div class="sidebar-brand"><div class="brand-mark">ZF</div><div class="brand-name">ZERO <span>FOOTBALL</span></div></div><div class="nav-label">Игровой центр</div><nav class="nav-menu">${navButtons()}</nav><div class="nav-label" style="margin-top:12px">Управление</div><nav class="nav-menu"><button class="nav-item" data-action="nav" data-view="settings"><span class="nav-icon">⚙</span><span>Настройки</span></button><button class="nav-item" data-action="switch-club"><span class="nav-icon">⇄</span><span>Сменить клуб</span></button></nav><div class="nav-spacer"></div><div class="sidebar-club"><div class="sidebar-club-head"><span class="club-crest ${crestShape(club.logo)}" style="--crest-color:${esc(club.logo.color)}">${crestContent(club.logo,.55)}</span><div><strong>${esc(countryData(club.country).flag)} ${esc(club.name)}</strong><small>${teamRating(club)} OVR · ${STYLES[club.style]?.name||'Баланс'}</small></div></div><div class="balance"><span>Баланс</span><b style="color:var(--lime)">${formatMoney(club.coins)}</b></div></div><div class="sidebar-bottom"><button class="btn btn-secondary" data-action="nav" data-view="settings">⚙ Настройки</button><button class="btn btn-quiet" data-action="switch-club">Выйти</button></div></aside><main class="main-area"><header class="topbar"><div class="crumb"><span>ZERO FOOTBALL</span><span>／</span><b>${esc(({home:'Главная',team:'Команда',packs:'Паки',collection:'Коллекция',sponsors:'Спонсоры',match:'Матч',trophies:'Трофеи',editor:'Редактор клуба'})[view]||'Главная')}</b></div><button class="icon-btn mobile-menu" data-action="nav" data-view="settings" aria-label="Настройки">☷</button><div class="top-actions"><div class="coin-chip"><span>${formatMoney(club.coins)}</span></div><div class="profile-circle">${esc(avatarLetters(club.name))}</div></div></header>${renderPage(club)}</main><nav class="mobile-nav">${navButtons(true)}</nav></div>`;
  }
  const THEME_OPTIONS = window.ZF_DATA.THEME_OPTIONS;
  function renderSettings(club){
    const active=db.theme||'classic';
    const themeGroups=[...new Set(THEME_OPTIONS.map(x=>x[4]||'Другие'))].map(category=>[category,THEME_OPTIONS.filter(x=>(x[4]||'Другие')===category)]);
    const themeButtons=arr=>arr.map(([id,icon,name,kind])=>`<button class="theme-option ${active===id?'active':''}" data-action="set-theme" data-theme="${id}"><span>${icon}</span><strong>${name}</strong><small>${kind}</small></button>`).join('');
    return `<div class="section-heading"><div><div class="eyebrow">Game preferences</div><h1 class="h1">НАСТРОЙКИ</h1><p class="page-subtitle">Оформление и игровые параметры.</p></div></div>
    <section class="card" style="margin-bottom:16px"><div class="card-header"><div><div class="eyebrow">Appearance</div><h2 class="h2">ОФОРМЛЕНИЕ</h2><p>Открой панель и выбери тему интерфейса.</p></div><button class="btn btn-secondary" data-action="toggle-theme-panel">${themePanelOpen?'Скрыть темы':'🎨 Выбрать тему'}</button></div>${themePanelOpen?themeGroups.map(([category,items])=>`<div class="theme-group-title">${esc(category.toUpperCase())}</div><div class="theme-grid">${themeButtons(items)}</div>`).join(''):`<span class="pill">Активная тема: ${THEME_OPTIONS.find(x=>x[0]===active)?.[2]||'Classic'}</span>`}</section>
    <section class="card" style="margin-bottom:16px"><div class="card-header"><div><div class="eyebrow">Feedback</div><h2 class="h2">ОТКЛИКИ</h2></div></div><label class="setting-toggle"><span><b>Вибрация</b><small>Можно отключить в любой момент.</small></span><input type="checkbox" data-setting="vibration" ${db.vibration!==false?'checked':''}></label><label class="setting-toggle"><span><b>Звуковые эффекты</b><small>Звуки интерфейса.</small></span><input type="checkbox" data-setting="sound" ${db.sound!==false?'checked':''}></label></section>
    <section class="card music-settings-card" style="margin-bottom:16px"><div class="card-header"><div><div class="eyebrow">Audio studio</div><h2 class="h2">ФОНОВАЯ МУЗЫКА</h2><p>Пять стилей и пять оригинальных тем в каждом — всего 25 композиций, созданных синтезатором в браузере.</p></div><span class="pill pill-lime">25 тем</span></div><label class="setting-toggle"><span><b>Включить фоновую музыку</b><small>Фоновая композиция продолжает играть при переходе между экранами.</small></span><input type="checkbox" data-setting="musicEnabled" ${db.musicEnabled!==false?'checked':''}></label><div class="music-controls-grid"><div class="field"><label for="musicStyle">Стиль музыки</label><select id="musicStyle" class="select-compact" data-setting="musicStyle">${Object.entries(MUSIC_STYLES).map(([id,style])=>`<option value="${id}" ${db.musicStyle===id?'selected':''}>${style.icon} ${style.name}</option>`).join('')}</select></div><div class="field"><label for="musicTrack">Трек</label><select id="musicTrack" class="select-compact" data-setting="musicTrack">${renderMusicTrackOptions(db.musicStyle||'ambient')}</select></div></div><div class="field music-volume-field"><label for="musicVolume">Громкость музыки <b id="musicVolumeValue">${Math.round(db.musicVolume)}%</b></label><input id="musicVolume" type="range" min="0" max="100" step="1" value="${Math.round(db.musicVolume)}" data-setting="musicVolume"/><div class="music-volume-scale"><span>Тихо</span><span>Громко</span></div></div><div class="settings-actions"><button class="btn btn-primary" data-action="music-preview">▶ Прослушать / включить</button><button class="btn btn-secondary" data-action="music-stop">■ Остановить музыку</button></div><p class="muted small">Звуковое разрешение браузера активируется после первого нажатия. Переключатель «Звуковые эффекты» выше отключает и фоновую музыку, и эффекты.</p></section>
    <section class="card pack-settings-card" style="margin-bottom:16px"><div class="card-header"><div><div class="eyebrow">Pack experience</div><h2 class="h2">АНИМАЦИЯ ПАКОВ</h2><p>Настрой вступление, появление карточек и темп открытия.</p></div></div><label class="setting-toggle"><span><b>Кинематографическое открытие</b><small>Вращение упаковки, зарядка, вспышка, выход карточек по одной и эффекты редкости.</small></span><input type="checkbox" data-setting="packAnimations" ${db.packAnimations!==false?'checked':''}></label><label class="setting-toggle"><span><b>Звук открытия паков</b><small>Электронная зарядка, удар и отдельный сигнал при появлении каждой карточки. Работает вместе с общим переключателем звука.</small></span><input type="checkbox" data-setting="packSound" ${db.packSound!==false?'checked':''}></label><label class="setting-toggle"><span><b>Виброотклик паков</b><small>Короткие тактильные импульсы при открытии и выходе карточек, если устройство поддерживает вибрацию.</small></span><input type="checkbox" data-setting="packVibration" ${db.packVibration!==false?'checked':''}></label><div class="field pack-speed-field"><label for="packAnimationSpeed">Скорость анимации</label><select id="packAnimationSpeed" class="select-compact" data-setting="packAnimationSpeed"><option value="cinematic" ${db.packAnimationSpeed==='cinematic'?'selected':''}>🎬 Кинематографичная · медленно</option><option value="normal" ${db.packAnimationSpeed==='normal'?'selected':''}>⚡ Стандартная</option><option value="fast" ${db.packAnimationSpeed==='fast'?'selected':''}>⏩ Быстрая</option></select><small class="muted small">Настройка сохраняется отдельно для этого браузера.</small></div><div class="pack-settings-preview"><span class="pack-preview-orb">✦</span><div><b>${db.packAnimations!==false?'Анимация включена':'Анимация отключена'}</b><small>${db.packAnimations===false?'Карточки будут показаны сразу.':'В любой момент можно пропустить вступление или запустить его повторно.'}</small></div></div></section>
    <section class="card" style="margin-bottom:16px"><div class="card-header"><div><div class="eyebrow">Language</div><h2 class="h2">ЯЗЫК ИГРЫ</h2><p>Выбери язык интерфейса.</p></div></div><select class="select-compact" data-setting="language"><option value="ru" ${db.language==="ru"?"selected":""}>🇷🇺 Русский</option><option value="uk" ${db.language==="uk"?"selected":""}>🇺🇦 Українська</option><option value="en" ${db.language==="en"?"selected":""}>🇬🇧 English</option><option value="de" ${db.language==="de"?"selected":""}>🇩🇪 Deutsch</option><option value="fr" ${db.language==="fr"?"selected":""}>🇫🇷 Français</option><option value="es" ${db.language==="es"?"selected":""}>🇪🇸 Español</option><option value="ja" ${db.language==="ja"?"selected":""}>🇯🇵 日本語</option><option value="zh" ${db.language==="zh"?"selected":""}>🇨🇳 中文</option><option value="kk" ${db.language==="kk"?"selected":""}>🇰🇿 Қазақша</option><option value="pl" ${db.language==="pl"?"selected":""}>🇵🇱 Polski</option></select></section>
    <section class="card"><div class="card-header"><div><div class="eyebrow">Club profile</div><h2 class="h2">ПРОФИЛЬ КЛУБА</h2><p>Отдельный вход для каждого клуба.</p></div></div><div class="statline"><span>Название клуба</span><b>${esc(club.name)}</b></div><div class="statline"><span>Доступ</span><b>Защищён паролем</b></div><div class="settings-actions"><button class="btn btn-secondary" data-action="nav" data-view="editor">Изменить клуб</button><button class="btn btn-secondary" data-action="switch-club">Сменить клуб</button><button class="btn btn-danger" data-action="delete-current-club">Удалить клуб</button></div></section>`;
  }
  function renderCollection(club){
    const owned=collectionMode==='owned';
    const players=owned?club.players.slice().sort((a,b)=>b.rating-a.rating):REAL_PLAYERS.map((p,i)=>({id:p.id,name:p.name,wiki:p.wiki,country:p.country,realClub:p.club,position:p.position,positions:REAL_PLAYER_POSITIONS[p.wiki]||[p.position],rating:p.rating,contractUntil:Date.now()+30*86400000,injuryMatches:0,redCardMatches:0}));
    return `<div class="section-heading"><div><div class="eyebrow">Player gallery</div><h1 class="h1">КОЛЛЕКЦИЯ</h1><p class="page-subtitle">${owned?'Твои подписанные футболисты.':'Полная база доступных футболистов в игре.'}</p></div><span class="pill pill-lime">${players.length} карточек</span></div><div class="collection-toolbar"><div class="collection-switch"><button class="btn ${owned?'btn-primary':'btn-secondary'} btn-sm" data-action="collection-mode" data-mode="owned">Мои карточки (${club.players.length})</button><button class="btn ${!owned?'btn-primary':'btn-secondary'} btn-sm" data-action="collection-mode" data-mode="all">Все карточки игры (${REAL_PLAYERS.length})</button></div><input id="collectionSearch" class="collection-search" placeholder="Поиск футболиста…"><select id="collectionPosition" class="select-compact"><option value="">Все позиции</option>${['GK','CB','LB','RB','CDM','CM','CAM','LW','RW','ST'].map(x=>`<option value="${x}">${esc(positionLabel(x))}</option>`).join('')}</select><select id="collectionRarity" class="select-compact"><option value="">Все рейтинги</option><option value="bronze">Бронза</option><option value="silver">Серебро</option><option value="gold">Золото</option><option value="elite">Элита</option><option value="icon">Икона</option></select><select id="collectionSort" class="select-compact"><option value="rating">По рейтингу</option><option value="name">По имени</option></select></div><div class="collection-contracts"><button class="btn btn-secondary btn-sm" data-action="toggle-contracts-panel">${contractsPanelOpen?'Скрыть контракты':'📄 Контракты игроков'}</button></div>${contractsPanelOpen?`<section class="card contract-list" style="margin:12px 0">${club.players.slice().sort((a,b)=>contractDays(a)-contractDays(b)).map(p=>`<div class="contract-row"><div><b data-no-translate>${esc(playerDisplayName(p))}</b><small>${esc(playerPositionsLabel(p))} · ${p.rating} OVR · ${esc(playerClubLabel(p))}</small></div><span class="contract-days ${contractDays(p)<=7?'danger':''}">${contractDays(p)} дн.</span></div>`).join('')}</section>`:''}<div id="collectionGrid" class="player-grid collection-grid">${players.map(p=>renderPlayerCard(p,owned,false)).join('')}</div>`;
  }
  function applyCollectionFilters(){
    const grid=$('#collectionGrid');if(!grid)return;const club=currentClub();const owned=collectionMode==='owned';let list=owned?club.players.slice():REAL_PLAYERS.map(p=>({id:p.id,name:p.name,wiki:p.wiki,country:p.country,realClub:p.club,position:p.position,positions:REAL_PLAYER_POSITIONS[p.wiki]||[p.position],rating:p.rating,contractUntil:Date.now()+30*86400000}));
    const q=($('#collectionSearch')?.value||'').toLowerCase(),pos=$('#collectionPosition')?.value||'',rar=$('#collectionRarity')?.value||'',sort=$('#collectionSort')?.value||'rating';list=list.filter(p=>(!q||p.name.toLowerCase().includes(q)||playerDisplayName(p).toLowerCase().includes(q)||String(p.realClub||'').toLowerCase().includes(q))&&(!pos||(p.positions||[p.position]).includes(pos))&&(!rar||({bronze:p.rating<65,silver:p.rating>=65&&p.rating<75,gold:p.rating>=75&&p.rating<85,elite:p.rating>=85&&p.rating<90,icon:p.rating>=90})[rar]));list.sort(sort==='name'?(a,b)=>a.name.localeCompare(b.name,'ru'):(a,b)=>b.rating-a.rating);grid.innerHTML=list.map(p=>renderPlayerCard(p,owned,false)).join('');resolvePlayerImages();
  }
  function renderPage(club){switch(view){case'settings':return renderSettings(club);case'team':return renderTeam(club);case'packs':return renderPacks(club);case'collection':return renderCollection(club);case'sponsors':return renderSponsors(club);case'match':return renderMatch(club);case'trophies':return renderTrophies(club);case'editor':return renderEditor(club);default:return renderHome(club);}}
  function renderHome(club){
    const history=(club.history||[]).slice(0,3);
    return `<div class="welcome-banner"><div class="welcome-copy"><div class="eyebrow">WELCOME TO YOUR FOOTBALL ERA</div><h1>WELCOME BACK,<br><span>${esc(club.name)}.</span></h1><p>Твой клуб — твои правила. Усиливай состав, выбирай стиль игры и поднимайся по футбольной лестнице.</p><button class="btn btn-primary" data-action="nav" data-view="match">⚽ Найти соперника <span>→</span></button></div><div class="banner-crest-wrap"><div class="banner-crest ${crestShape(club.logo)}" style="--crest-color:${esc(club.logo.color)}">${crestContent(club.logo,.9)}</div></div></div><div class="stat-grid"><div class="metric-card"><div class="metric-top">Рейтинг команды <span class="metric-symbol">★</span></div><div class="metric-value">${teamRating(club)} <span style="font-size:13px;color:var(--muted)">OVR</span></div><div class="metric-note">Средний рейтинг стартовых 11</div></div><div class="metric-card"><div class="metric-top">Матчи <span class="metric-symbol">⚽</span></div><div class="metric-value">${club.stats.matches}</div><div class="metric-note">${club.stats.wins} побед · ${club.stats.draws} ничьих</div></div><div class="metric-card"><div class="metric-top">Победы <span class="metric-symbol">🏆</span></div><div class="metric-value">${club.stats.wins}</div><div class="metric-note">${club.stats.losses} поражений</div></div><div class="metric-card"><div class="metric-top">Футболисты <span class="metric-symbol">♧</span></div><div class="metric-value">${club.players.length}</div><div class="metric-note">${activePlayers(club).length} в стартовом составе</div></div></div><div class="dashboard-grid"><section class="card"><div class="card-header"><div><div class="eyebrow">Быстрый доступ</div><h2 class="h2">ЧТО ДЕЛАЕМ СЕГОДНЯ?</h2><p>Пара действий — и команда станет сильнее.</p></div></div><div class="quick-actions"><button class="quick-action" data-action="nav" data-view="team"><div class="qa-icon">🧩</div><strong>Настроить команду</strong><small>Состав, схема и игровой стиль</small></button><button class="quick-action" data-action="nav" data-view="packs"><div class="qa-icon">🎴</div><strong>Магазин паков</strong><small>Паки и ежедневный бонус</small></button><button class="quick-action" data-action="nav" data-view="trophies"><div class="qa-icon">🏆</div><strong>Трофеи</strong><small>${Object.keys(club.trophyUnlocks||{}).length} из ${TROPHIES.length} достижений</small></button></div></section><section class="card"><div class="card-header"><div><div class="eyebrow">Последние события</div><h2 class="h2">ИСТОРИЯ КЛУБА</h2></div><button class="btn btn-quiet btn-sm" data-action="nav" data-view="match">Играть →</button></div>${history.length?`<div class="recent-list">${history.map(h=>`<div class="recent-row"><div class="recent-icon">${h.result==='W'?'🏆':h.result==='D'?'🤝':'⚽'}</div><div><strong>${esc(h.opponent)}</strong><small>${esc(h.date||'Недавно')} · ${h.result==='W'?'Победа':h.result==='D'?'Ничья':'Поражение'}</small></div><div class="right ${h.result==='W'?'positive':''}">${h.score}</div></div>`).join('')}</div>`:`<div class="empty-state"><div class="empty-icon">📋</div><strong>Первая глава ещё впереди</strong><span class="small">Сыграй матч, и он появится здесь.</span></div>`}</section></div>`;
  }
  function pitchLineKey(role,formationId){
    if(role==='GK')return 'keeper';
    if(['LB','CB','RB','LWB','RWB'].includes(role))return 'defence';
    if(role==='CAM')return 'advanced';
    if(formationId==='4-2-3-1'&&['LW','RW'].includes(role))return 'advanced';
    if(['LW','RW','ST','CF'].includes(role))return 'front';
    return 'midfield';
  }
  function calculatePitchPositions(formationId,formation){
    const groups={};formation.forEach((slot,index)=>{const key=pitchLineKey(slot.role,formationId);(groups[key]||(groups[key]=[])).push(index);});
    const yByLine={keeper:90,defence:72,midfield:52,advanced:32,front:12};
    const positions=formation.map(slot=>({...slot}));
    Object.entries(groups).forEach(([key,indices])=>{
      const n=indices.length;
      const min=n>=6?5:n===5?7:n===4?9:n===3?16:n===2?34:50;
      const max=100-min;
      const xs=n===1?[50]:Array.from({length:n},(_,i)=>min+(max-min)*i/(n-1));
      indices.forEach((idx,i)=>{positions[idx].x=Math.round(xs[i]*10)/10;positions[idx].y=yByLine[key];});
    });
    return positions;
  }

  function renderTeam(club){
    const formationId=FORMATIONS[club.formation]?club.formation:'4-3-3';
    const formation=FORMATIONS[formationId];
    const pitchFormation=calculatePitchPositions(formationId,formation);
    const slots=formation.map((slot,i)=>{
      const pitchSlot=pitchFormation[i];const p=club.players.find(x=>x.id===club.lineup[i]);const rating=p?playerOVRAt(p,slot.role,club):0;const fit=p?positionPenalty(p,slot.role):0;const art=p?`<img class="slot-portrait squad-photo" data-portrait-key="${esc(p.wiki||p.name)}" ${p.wiki?`data-wiki="${esc(p.wiki)}"`:''} alt="${esc(p.name)}" loading="lazy">`:'';return `<div class="player-slot-wrap" style="left:${pitchSlot.x}%;top:${pitchSlot.y}%"><button class="player-slot" data-portrait-key="${p?esc(p.wiki||p.name):''}" ${p?.wiki?`data-wiki="${esc(p.wiki)}"`:''} data-action="edit-slot" data-slot="${i}" title="${p?'Заменить футболиста':'Добавить футболиста'}"><span class="slot-card" style="--kit-primary:${esc(club.kit.primary)}">${art||'+'}</span><span class="slot-rating-below ${fit<0?'out-of-position':''}" title="${fit<0?`Штраф позиции ${fit}`:'Профильная позиция'}">${p?rating:'+'}</span>${p&&(p.injuryMatches>0||p.redCardMatches>0||p.yellowBanMatches>0||p.yellowCards>0)?`<span class="status-tag ${p.yellowCards>0&&!p.injuryMatches&&!p.redCardMatches&&!p.yellowBanMatches?'yellow':p.injuryMatches>0?'injury':'redcard'}">${p.injuryMatches>0?'🤕 '+p.injuryMatches:p.redCardMatches>0?'🟥 '+p.redCardMatches:p.yellowBanMatches>0?'⛔ '+p.yellowBanMatches:'🟨 '+p.yellowCards+'/5'}</span>`:''}<span class="slot-name">${p?esc(playerDisplayName(p).split(' ').slice(-1)[0]):'Добавить'}</span><span class="slot-role">${esc(positionLabel(slot.role))}</span>${p?`<span class="slot-stamina-compact" title="Выносливость">⚡ ${Math.round(p.stamina??100)}%</span>`:''}</button>${p?`<button type="button" class="captain-toggle ${club.captainId===p.id?'captain-active':''}" data-action="set-captain" data-player-id="${esc(p.id)}" title="Назначить капитаном (+1 OVR)">${club.captainId===p.id?'★':'☆'}</button>`:''}</div>`;}).join('');
    const bench=benchPlayers(club);
    const squad=club.players.slice().sort((a,b)=>b.rating-a.rating);
    return `<div class="section-heading"><div><div class="eyebrow">Club management</div><h1 class="h1">НАСТРОЙКА КОМАНДЫ</h1><p class="page-subtitle">Расставь футболистов, выбери схему и реши, как будет играть твой клуб.</p></div><div class="actions"><span class="pill pill-lime">${teamRating(club)} OVR</span><span class="pill">${club.players.length} игроков</span></div></div><div class="team-layout"><div><section class="card" style="margin-bottom:15px"><div class="card-header"><div><div class="eyebrow">Tactical board</div><h2 class="h2">СТАРТОВЫЙ СОСТАВ</h2><p>Используй отдельные кнопки для замены и назначения футболистов.</p></div><span class="pill">${activePlayers(club).length} / 11</span></div><div class="team-controls"><label class="small muted" for="formationSelect">Схема</label><select class="select-compact" id="formationSelect" data-setting="formation">${Object.keys(FORMATIONS).map(f=>`<option value="${f}" ${club.formation===f?'selected':''}>${f}</option>`).join('')}</select><button class="btn btn-quiet btn-sm" data-action="auto-lineup">✦ Лучший состав</button><label class="small muted captain-select-label" for="captainSelect">Капитан</label><select class="select-compact captain-select" id="captainSelect" data-setting="captain">${club.players.map(p=>`<option value="${esc(p.id)}" ${club.captainId===p.id?'selected':''}>${esc(playerDisplayName(p))}</option>`).join('')}</select></div><div class="pitch"><div class="pitch-midline"></div><div class="pitch-circle"></div><div class="penalty top"></div><div class="penalty bottom"></div>${slots}</div><div class="card-header" style="margin-bottom:10px"><div><h3 class="h3">ЗАПАСНЫЕ</h3><p>Нажми «В основу» у нужного футболиста.</p></div></div><div class="bench-grid">${bench.map(p=>`<div class="bench-card"><span class="bench-avatar" style="--rarity-color:${rarityColor(p.rating+(club.captainId===p.id?1:0))}">${p.rating+(club.captainId===p.id?1:0)}</span><strong data-no-translate>${esc(playerDisplayName(p).split(' ').slice(-1)[0])}</strong><small>${esc(playerPositionsLabel(p))}${p.injuryMatches>0?` · 🤕 ${p.injuryMatches}`:''}${p.redCardMatches>0?` · 🟥 ${p.redCardMatches}`:''}${p.yellowBanMatches>0?` · ⛔ ${p.yellowBanMatches}`:p.yellowCards>0?` · 🟨 ${p.yellowCards}/5`:''}</small><button class="btn btn-secondary btn-sm" data-action="quick-assign" data-player-id="${esc(p.id)}" ${playerIsUnavailable(p)?'disabled title="Игрок недоступен"':''}>В основу</button></div>`).join('')}</div></section><section class="card"><div class="card-header"><div><div class="eyebrow">Play style</div><h2 class="h2">ИГРОВОЙ СТИЛЬ</h2><p>Стиль влияет на риск и баланс атаки с обороной в матче.</p></div></div><div class="style-cards">${Object.entries(STYLES).map(([id,s])=>`<button class="style-option ${club.style===id?'active':''}" data-action="set-style" data-style="${id}"><span class="style-icon">${s.icon}</span><strong>${s.name}</strong><small>${s.desc}</small></button>`).join('')}</div></section></div><div><section class="card" style="margin-bottom:15px"><div class="card-header"><div><div class="eyebrow">Squad list</div><h2 class="h2">ВСЕ ФУТБОЛИСТЫ</h2><p>Игроки основного состава и резерва.</p></div></div><div class="squad-tools" style="margin-bottom:13px"><span class="pill">🟢 ${activePlayers(club).length} в основе</span><span class="pill">🪑 ${benchPlayers(club).length} в резерве</span></div><div class="squad-list">${squad.map(p=>{const idx=club.lineup.indexOf(p.id);const slot=idx>=0?formation[idx]:null;const effective=slot?playerOVRAt(p,slot.role,club):p.rating+(club.captainId===p.id?1:0);const fit=slot?positionPenalty(p,slot.role):0;return `<div class="squad-item" data-portrait-key="${esc(p.wiki||p.name)}" ${p.wiki?`data-wiki="${esc(p.wiki)}"`:``}><div class="mini-player" style="--rarity-color:${rarityColor(effective)}"><span class="mini-rating">${effective}</span><img class="squad-photo" alt="${esc(p.name)}" loading="lazy"></div><div class="squad-info"><strong data-no-translate>${esc(playerDisplayName(p))}</strong><small>${esc(playerPositionsLabel(p))} · ${esc(playerClubLabel(p))}${idx>=0?` · ${positionLabel(slot.role)}${fit<0?` · штраф ${fit}`:''}`:''}${p.injuryMatches>0?` · 🤕 ${p.injuryMatches}`:``}${p.redCardMatches>0?` · 🟥 ${p.redCardMatches}`:``}${p.yellowBanMatches>0?` · ⛔ Жёлтые: бан ${p.yellowBanMatches}`:p.yellowCards>0?` · 🟨 ${p.yellowCards}/5`:``}</small>${idx>=0?`<span class="pill pill-lime">Основа · ${idx+1} · ⚡ ${Math.round(p.stamina??100)}%</span>`:`<button class="btn btn-secondary btn-sm" data-action="quick-assign" data-player-id="${esc(p.id)}">В основу</button>`}<button class="btn ${club.captainId===p.id?'btn-primary':'btn-quiet'} btn-sm squad-captain-button" data-action="set-captain" data-player-id="${esc(p.id)}" aria-label="Назначить ${esc(playerDisplayName(p))} капитаном">${club.captainId===p.id?'★ Капитан':'☆ Капитан'}</button></div></div>`;}).join("")}</div></section><section class="card"><div class="card-header"><div><div class="eyebrow">Team report</div><h2 class="h2">ОЦЕНКА СОСТАВА</h2></div></div><div class="statline"><span>Атака</span><b>${Math.round(activePlayers(club).reduce((s,p)=>s+Math.max(p.shooting,p.dribbling,p.passing),0)/Math.max(1,activePlayers(club).length))}</b></div><div class="progress"><span style="width:${Math.min(100,activePlayers(club).reduce((s,p)=>s+Math.max(p.shooting,p.dribbling,p.passing),0)/Math.max(1,activePlayers(club).length))}%"></span></div><div class="statline"><span>Оборона</span><b>${Math.round(activePlayers(club).reduce((s,p)=>s+p.defense,0)/Math.max(1,activePlayers(club).length))}</b></div><div class="progress"><span style="width:${Math.min(100,activePlayers(club).reduce((s,p)=>s+p.defense,0)/Math.max(1,activePlayers(club).length))}%"></span></div><div class="statline"><span>Сыгранность</span><b>${Math.max(45,Math.min(100,Math.round(100-(new Set(activePlayers(club).map(p=>p.country)).size-1)*4)))}%</b></div><div class="progress"><span style="width:${Math.max(45,Math.min(100,Math.round(100-(new Set(activePlayers(club).map(p=>p.country)).size-1)*4)))}%"></span></div></section></div></div>`;
  }

  function dailyShop(club){
    const now=new Date(),day=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
    if(!club.dailyShop||club.dailyShop.day!==day||Array.isArray(club.dailyShop.offers)){
      club.dailyShop={day};saveDB();
    }
    return club.dailyShop;
  }
  function renderPacks(club){
    const packOptions=[
      {id:'starter',name:'Агентство ★',type:'Агентство · 1 звезда',price:2,count:3,color:'#c8ff44',glow:'rgba(200,255,68,.13)',desc:'3 футболиста. Базовый шанс на сильную карточку.',meta:'3 КАРТОЧКИ'},
      {id:'national',name:'Агентство ★★',type:'Агентство · 2 звезды',price:8,count:4,color:'#79c9ff',glow:'rgba(121,201,255,.16)',desc:'4 футболиста. Более высокий шанс на рейтинг 70+.',meta:'4 КАРТОЧКИ'},
      {id:'pro',name:'Агентство ★★★',type:'Агентство · 3 звезды',price:25,count:5,color:'#c296ff',glow:'rgba(194,150,255,.17)',desc:'5 футболистов. Повышенный шанс на рейтинг 75+.',meta:'5 КАРТОЧЕК'},
      {id:'elite',name:'Агентство ★★★★',type:'Агентство · 4 звезды',price:75,count:5,color:'#ffb45e',glow:'rgba(255,180,94,.17)',desc:'5 футболистов. Высокий шанс на рейтинг 80+.',meta:'5 КАРТОЧЕК'},
      {id:'legend',name:'Агентство ★★★★★',type:'Агентство · 5 звёзд',price:200,count:6,color:'#ff6f9e',glow:'rgba(255,111,158,.17)',desc:'6 футболистов. Лучшие шансы на элитных игроков.',meta:'6 КАРТОЧЕК'}
    ];
    const shop=dailyShop(club);const freeReady=club.freePackDay!==shop.day;
    return `<div class="section-heading"><div><div class="eyebrow">Pack market</div><h1 class="h1">МАГАЗИН ПАКОВ</h1><p class="page-subtitle">Выбирай наборы карточек и усиливай состав через открытие паков.</p></div><div class="actions"><span class="coin-chip">${formatMoney(club.coins)}</span></div></div><section class="card" style="margin-bottom:16px"><div class="card-header"><div><div class="eyebrow">ЕЖЕДНЕВНЫЙ БОНУС</div><h2 class="h2">БЕСПЛАТНЫЙ ПАК</h2><p>Один бесплатный пак каждые сутки.</p></div><button class="btn btn-primary" data-action="open-pack" data-pack="daily" ${freeReady?'':'disabled'}>${freeReady?'Забрать бесплатный пак':'Уже получен сегодня'}</button></div><div class="card-header"><div><div class="eyebrow">ПАКИ ДЛЯ КОМАНДЫ</div><h2 class="h2">ТОЛЬКО НАБОРЫ КАРТОЧЕК</h2><p>Футболисты попадают в клуб через открытие выбранного пака.</p></div><span class="pill">${shop.day}</span></div></section><div class="pack-grid">${packOptions.map(p=>`<article class="pack-card" style="--pack-color:${p.color};--pack-glow:${p.glow}"><div class="pack-art"><div class="pack-box"><span class="pack-art-star">✦</span><span class="pack-art-mark">ZF</span><span class="pack-art-lines"></span></div><span class="pack-orbit orbit-a"></span><span class="pack-orbit orbit-b"></span></div><div class="pack-type">${p.type}</div><h3>${p.name}</h3><p>${p.desc}</p><div class="pack-bottom"><span class="pack-price">${formatMoney(p.price)}</span><button class="btn btn-primary btn-sm" data-action="open-pack" data-pack="${p.id}" ${club.coins<p.price?'disabled':''}>Открыть ↗</button></div><div class="pack-footnote">${p.meta} · Игроки добавятся в твою коллекцию</div></article>`).join('')}</div>`;
  }
  function renderPlayerCard(p,actions=false,clickable=false){
    const activeClub=currentClub();const lineupIndex=p.id&&activeClub?.lineup?activeClub.lineup.indexOf(p.id):-1;const assignedRole=lineupIndex>=0?(FORMATIONS[activeClub.formation]||FORMATIONS['4-3-3'])[lineupIndex]?.role:null;const shownRating=lineupIndex>=0?playerOVRAt(p,assignedRole||p.position,activeClub):(p.id&&activeClub?.captainId===p.id?p.rating+1:p.rating);const r=rarityFor(shownRating);const country=playerCountryData(p.country);const displayName=playerDisplayName(p);const displayPositions=playerPositionsLabel(p);const displayClub=playerClubLabel(p);
    const owned=currentClub()?.players?.some(x=>x.id===p.id);const isStarter=owned&&currentClub().lineup.includes(p.id);
    const action=actions&&owned?`<div class="player-card-actions">${isStarter?'<button class="btn btn-quiet btn-sm" disabled>В стартовом составе</button>':`<button class="btn btn-secondary btn-sm" data-action="sell-player" data-player-id="${esc(p.id)}">Продать · ${formatMoney(saleValue(p,false))}</button>`}</div>`:'';
    return `<article class="player-card" data-portrait-key="${esc(p.wiki||p.name)}" ${p.wiki?`data-wiki="${esc(p.wiki)}"`:''} style="--rarity-color:${r.color};--player-glow:${r.color}22"><div class="player-card-head"><div><div class="player-overall">${shownRating}</div><span class="player-position">${esc(lineupIndex>=0?positionLabel(assignedRole):displayPositions)}</span></div><span class="rarity-badge">${r.name}</span></div><div class="player-portrait"><div class="portrait-circle">${esc(avatarLetters(p.name))}</div><img class="portrait-photo" alt="${esc(p.name)}" loading="lazy" style="display:none"/></div><div class="player-card-body"><strong data-no-translate>${esc(displayName)}</strong><div class="player-meta"><span>${country.flag} ${esc(country.name)}</span><span>${contractDays(p)} дн.</span></div><div class="player-market-value">${formatMoney(marketValue(p.rating))}</div><div class="stamina-line"><span>Выносливость</span><b>${Math.round(p.stamina??100)}%</b><i><u style="width:${Math.max(0,Math.min(100,p.stamina??100))}%"></u></i></div>${p.realClub||p.club?`<div class="player-meta"><span class="real-club" data-no-translate>${esc(displayClub)}</span></div>`:''}<div class="player-status">${p.injuryMatches>0?`<span class="status-tag injury">🤕 ${p.injuryMatches}</span>`:''}${p.redCardMatches>0?`<span class="status-tag redcard">🟥 ${p.redCardMatches}</span>`:''}${p.yellowBanMatches>0?`<span class="status-tag redcard">⛔ ${p.yellowBanMatches}</span>`:p.yellowCards>0?`<span class="status-tag yellow">🟨 ${p.yellowCards}/5</span>`:''}</div>${action}</div></article>`;
  }
  function renderPlayerModal(club){
    if(!playerModalRef)return '';
    const owned=club.players.find(p=>p.id===playerModalRef.id)||club.players.find(p=>(playerModalRef.wiki&&p.wiki===playerModalRef.wiki)||(playerModalRef.name&&p.name===playerModalRef.name));
    const base=owned||REAL_PLAYERS.find(p=>(playerModalRef.wiki&&p.wiki===playerModalRef.wiki)||(playerModalRef.name&&p.name===playerModalRef.name));
    if(!base)return '';
    const card=owned?{...owned}:{...base,id:null,realClub:base.club};
    const country=playerCountryData(card.country);const displayName=playerDisplayName(card);const displayPositions=playerPositionsLabel(card);const lineupIndex=owned?club.lineup.indexOf(owned.id):-1;const assignedRole=lineupIndex>=0?(FORMATIONS[club.formation]||FORMATIONS['4-3-3'])[lineupIndex]?.role:null;
    if(lineupIndex>=0)card.rating=playerOVRAt(card,assignedRole||card.position,club);else if(owned&&club.captainId===owned.id)card.rating=card.rating+1;
    const blocked=!owned;
    const isStarter=!!(owned&&club.lineup.includes(owned.id));const buttonText=!owned?'Не подписан':isStarter?'Игрок стартового состава':'Продать · рыночная цена';
    const statuses=[card.injuryMatches>0?`🤕 Травма: ${card.injuryMatches}`:'',card.redCardMatches>0?`🟥 Дисквалификация: ${card.redCardMatches}`:'',card.yellowBanMatches>0?`⛔ Бан за жёлтые: ${card.yellowBanMatches}`:'',card.yellowCards>0?`🟨 Жёлтые: ${card.yellowCards}/5`:''].filter(Boolean).join(' · ');
    return `<div class="modal-backdrop player-card-modal-backdrop" data-action="close-player-modal-backdrop"><section class="modal player-card-modal" role="dialog" aria-modal="true"><div class="modal-head"><div><div class="eyebrow">Карточка футболиста</div><h2 data-no-translate>${esc(displayName)}</h2><p class="muted small" style="margin:6px 0 0">${country.flag} ${esc(country.name)} · ${esc(lineupIndex>=0?positionLabel(assignedRole):displayPositions)}</p></div><button class="icon-btn" data-action="close-player-modal">✕</button></div><div class="player-modal-summary"><div class="player-modal-rating" style="--rarity-color:${rarityColor(card.rating)}">${card.rating}<small>OVR</small></div><div><strong data-no-translate>${esc(playerClubLabel(card))}</strong><small>${formatMoney(marketValue(card.rating))} · ${rarityFor(card.rating).name}</small>${statuses?`<small class="player-modal-status">${statuses}</small>`:''}</div></div><div class="player-modal-actions">${owned&&!isStarter?`<button class="btn btn-danger" data-action="sell-player" data-player-id="${esc(owned.id)}">${buttonText}</button>`:`<button class="btn btn-secondary" disabled>${buttonText}</button>`}</div></section></div>`;
  }
  function refreshEnergy(club){const now=Date.now();const elapsed=Math.floor((now-(club.energyAt||now))/(30*60*1000));if(elapsed>0){club.energy=Math.min(5,(club.energy||0)+elapsed);club.energyAt=(club.energyAt||now)+elapsed*30*60*1000;saveDB();}}
  const SPONSOR_DEALS = window.ZF_DATA.SPONSOR_DEALS;
  function sponsorLogo(o,small=false){return `<span class="sponsor-emblem ${small?'tiny-emblem':''}" style="--emblem-tone:${o.type==='kit'?'#c8ff44':o.type==='title'?'#65b8ff':'#f4b85d'}">${esc(o.mark)}</span>`;}
  const SPONSOR_TIER_ORDER=['Стартовый','Региональный','Национальный','Международный','Элитный','ИМБА'];
  function sponsorTier(o){const r=Number(o.minRating)||0;return r>=92?'ИМБА':r>=88?'Элитный':r>=80?'Международный':r>=70?'Национальный':r>=60?'Региональный':'Стартовый';}
  function sponsorTierDescription(tier){return ({'Стартовый':'Небольшие бренды для начинающего клуба','Региональный':'Первые серьёзные местные контракты','Национальный':'Крупные бренды и стабильные выплаты','Международный':'Сильные партнёры с большими бонусами','Элитный':'Премиальные контракты для топ-команд','ИМБА':'Максимальные выплаты и престижные партнёры'})[tier]||'';}
  function renderSponsorDeal(o,active,type,club){
    const signed=active?.id===o.id,locked=(active||teamRating(club)<(o.minRating||0)||(club.stats.wins||0)<(o.minWins||0));
    return `<article class="sponsor-card sponsor-card-tier-${SPONSOR_TIER_ORDER.indexOf(sponsorTier(o))}"><div class="sponsor-logo">${sponsorLogo(o)}</div><h3>${esc(o.name)}</h3><p class="muted small">${esc(o.desc)}</p><span class="sponsor-tier">Уровень: ${sponsorTier(o)}</span><div class="statline"><span>За матч</span><b>€${o.match} тыс.</b></div><div class="statline"><span>За победу</span><b>€${o.win} тыс.</b></div><div class="statline"><span>Подписание</span><b>€${o.sign} тыс.</b></div><div class="sponsor-requirement">Требования: ${o.req||'Без требований'}</div>${signed?'<span class="pill pill-lime">Активен</span>':`<button class="btn btn-secondary btn-full" data-action="sign-sponsor" data-sponsor="${o.id}" data-sponsor-type="${type}" ${locked?'disabled':''}>${active?'Место занято':locked?'Пока недоступен':'Подписать на 30 дней'}</button>`}</article>`;
  }
  function renderSponsorTiers(type,active,club){
    const deals=SPONSOR_DEALS.filter(o=>o.type===type).slice().sort((a,b)=>(a.minRating||0)-(b.minRating||0)||(a.minWins||0)-(b.minWins||0)||a.sign-b.sign);
    return SPONSOR_TIER_ORDER.map(tier=>{const items=deals.filter(o=>sponsorTier(o)===tier);if(!items.length)return '';const min=items.reduce((v,o)=>Math.min(v,o.minRating||0),99);const max=items.reduce((v,o)=>Math.max(v,o.minRating||0),0);return `<section class="sponsor-tier-section sponsor-tier-level-${SPONSOR_TIER_ORDER.indexOf(tier)}"><div class="sponsor-tier-heading"><div><span class="sponsor-tier-kicker">УРОВЕНЬ ${SPONSOR_TIER_ORDER.indexOf(tier)+1}</span><h3>${tier==='ИМБА'?'🔥 '+tier:tier}</h3><p>${sponsorTierDescription(tier)}</p></div><span class="pill">${items.length} контрактов</span></div><div class="sponsor-grid">${items.map(o=>renderSponsorDeal(o,active,type,club)).join('')}</div></section>`;}).join('');}

  function renderSponsors(club){
    club.sponsorSlots=club.sponsorSlots||{kit:null,title:null,extra:null};
    // Migrate the old single sponsor contract into the matching slot.
    if(club.sponsorContract&&!Object.values(club.sponsorSlots).some(Boolean)){const old=club.sponsorContract;club.sponsorSlots[old.type||'title']=old;}
    const now=Date.now(), groups=[['kit','👕','СПОНСОР ФОРМЫ'],['title','🏷️','ТИТУЛЬНЫЙ СПОНСОР'],['extra','✦','ДОПОЛНИТЕЛЬНЫЙ СПОНСОР']];
    const activeFor=type=>{const a=club.sponsorSlots[type];return a&&a.until>now?a:null;};
    return `<div class="section-heading"><div><div class="eyebrow">Partner deals</div><h1 class="h1">СПОНСОРЫ</h1><p class="page-subtitle">Можно заключить три независимых контракта: на форму, титульный и дополнительный.</p></div><span class="pill pill-lime">3 рекламных места</span></div>
    ${groups.map(([type,icon,label])=>{const active=activeFor(type),deal=active&&SPONSOR_DEALS.find(x=>x.id===active.id);return `<section class="card" style="margin-bottom:18px"><div class="card-header"><div><div class="eyebrow">${icon} ${label}</div><h2 class="h2">${active?esc(deal?.name||active.id):'МЕСТО СВОБОДНО'}</h2><p>${active?`Активен ещё ${Math.max(0,Math.ceil((active.until-now)/86400000))} дн. · За матч €${active.matchBonus||0} тыс. · Победа +€${active.winBonus||0} тыс.`:'Выбери партнёра из списка ниже.'}</p></div><span class="pill ${active?'pill-lime':''}">${active?'ЗАКЛЮЧЁН':'СВОБОДНО'}</span></div>${renderSponsorTiers(type,active,club)}</section>`;}).join('')}`;
  }

  function renderEditor(club){
    const c=countryData(club.country);
    return `<div class="section-heading"><div><div class="eyebrow">Club identity</div><h1 class="h1">РЕДАКТОР КЛУБА</h1><p class="page-subtitle">Создай узнаваемую эмблему, подбери цвета и настрой форму.</p></div><span class="pill pill-lime">${c.flag} ${c.name}</span></div><div class="editor-layout"><section class="card"><div class="card-header"><div><div class="eyebrow">Club profile</div><h2 class="h2">ДАННЫЕ КЛУБА</h2></div></div><form id="editClubForm" class="form-grid"><div class="field"><label for="editClubName">Название клуба</label><input id="editClubName" name="clubName" value="${esc(club.name)}" maxlength="26" required /></div><div class="field"><label for="editCountry">Страна и флаг</label><select id="editCountry" name="country">${Object.entries(COUNTRY).map(([code,v])=>`<option value="${code}" ${club.country===code?'selected':''}>${v.flag} ${v.name}</option>`).join('')}</select><small id="editCountryBonus" class="muted small">Бонус страны: ${c.bonus}</small></div><div class="field"><label>Конструктор эмблемы</label>${renderEditCrestBuilder(club.logo)}</div><div class="divider"></div><div class="field-row"><div class="field"><label for="editKitPrimary">Основной цвет</label><input id="editKitPrimary" name="kitPrimary" class="color-input" type="color" value="${esc(club.kit.primary)}" data-preview="kit-primary" /></div><div class="field"><label for="editKitSecondary">Дополнительный цвет</label><input id="editKitSecondary" name="kitSecondary" class="color-input" type="color" value="${esc(club.kit.secondary)}" data-preview="kit-secondary" /></div></div><div class="field"><label>Узор формы</label><div class="pattern-options">${KIT_PATTERNS.map(([id,label])=>`<button type="button" class="pattern-option ${club.kit.pattern===id?'active':''}" data-action="set-pattern" data-pattern="${id}">${label}</button>`).join('')}</div><input type="hidden" id="editKitPattern" name="kitPattern" value="${esc(club.kit.pattern)}"/></div><button class="btn btn-primary btn-full" type="submit">Сохранить изменения ✓</button></form></section><div><section class="card" style="margin-bottom:15px"><div class="card-header"><div><div class="eyebrow">Live preview</div><h2 class="h2">ВНЕШНИЙ ВИД</h2><p>Так клуб будет выглядеть в меню и матчах.</p></div></div><div class="club-identity-preview"><span class="club-crest ${crestShape(club.logo)}" id="editorPreviewCrest" style="--crest-color:${esc(club.logo.color)}">${crestContent(club.logo,.55)}</span><div class="identity-text"><strong id="editorPreviewName">${esc(c.flag)} ${esc(club.name)}</strong><small id="editorPreviewCountry">${c.name} · ${teamRating(club)} OVR</small></div></div><div class="kit-preview-wrap"><div class="kit-shirt pattern-${esc(club.kit.pattern)}" id="kitShirt" style="--kit-primary:${esc(club.kit.primary)};--kit-secondary:${esc(club.kit.secondary)}">${(club.sponsorSlots?.kit&&club.sponsorSlots.kit.until>Date.now())?`<span class="kit-sponsor-mark">${esc((SPONSOR_DEALS.find(x=>x.id===club.sponsorSlots.kit.id)||{}).mark||'')}</span>`:''}</div></div></section><section class="card"><div class="card-header"><div><div class="eyebrow">Club snapshot</div><h2 class="h2">ПАСПОРТ КЛУБА</h2></div></div><div class="recent-list"><div class="recent-row"><div class="recent-icon">⚽</div><div><strong>Домашняя форма</strong><small>Основной цвет и узор</small></div><div class="right">${kitPatternName(club.kit.pattern)}</div></div><div class="recent-row"><div class="recent-icon">🌍</div><div><strong>Страна</strong><small>Стартовый пак</small></div><div class="right">${c.flag} ${c.name}</div></div></div></section></div></div>`;
  }
  function renderTrophies(club){
    const unlocked=Object.keys(club.trophyUnlocks||{}).length;
    return `<div class="section-heading"><div><div class="eyebrow">Club hall of fame</div><h1 class="h1">ЗАЛ ТРОФЕЕВ</h1><p class="page-subtitle">Каждый матч — новая возможность вписать имя клуба в историю.</p></div><span class="pill pill-lime">🏆 ${unlocked} / ${TROPHIES.length}</span></div><div class="card" style="margin-bottom:17px;background:linear-gradient(100deg,rgba(247,200,90,.08),transparent 70%),var(--panel)"><div class="card-header" style="margin-bottom:0"><div><div class="eyebrow">Hall of fame</div><h2 class="h2">ТВОЯ КОЛЛЕКЦИЯ ДОСТИЖЕНИЙ</h2><p>Продолжай играть, собирать игроков и улучшать клуб, чтобы разблокировать новые награды.</p></div><div style="font:900 33px 'Barlow Condensed',sans-serif;color:var(--gold)">${Math.round(unlocked/TROPHIES.length*100)}%</div></div><div class="progress" style="height:8px;margin-top:17px"><span style="width:${unlocked/TROPHIES.length*100}%;background:var(--gold)"></span></div></div><div class="trophy-grid">${TROPHIES.map(t=>{const earned=!!club.trophyUnlocks[t.id];return `<article class="trophy-card ${earned?'':'locked'}"><div class="trophy-medal">${earned?t.icon:'🔒'}</div><h3>${t.name}</h3><p>${t.desc}</p><div class="trophy-status">${earned?'✓ Получен':`Цель: ${t.goal}`}</div>${earned?`<div class="tiny muted" style="margin-top:8px">${new Date(club.trophyUnlocks[t.id]).toLocaleDateString('ru-RU')}</div>`:''}</article>`;}).join('')}</div>`;
  }
  function energyWidget(club){refreshEnergy(club);return `<div class="energy-panel"><div><strong>⚡ Энергия команды</strong><div class="energy-pips">${Array.from({length:5},(_,i)=>`<span class="energy-pip ${i<(club.energy||0)?'on':''}"></span>`).join('')}</div></div><div class="energy-copy"><b>${club.energy||0}/5 матчей</b><br>+1 энергия каждые 30 минут</div><button class="btn btn-secondary btn-sm" data-action="refill-energy" ${(club.energy||0)>=5?'disabled':''}>Восстановить</button></div>`;}
  function renderMatch(club){
    if(!matchState||matchState.stage==='idle')return `<div class="section-heading"><div><div class="eyebrow">Match center</div><h1 class="h1">МАТЧДЕЙ</h1><p class="page-subtitle">Играй матчи и получай небольшую выплату в миллионах евро.</p></div><span class="pill">⚽ Быстрый матч · лимит 5</span></div>${energyWidget(club)}<div class="match-shell"><div class="match-scoreboard"><div class="match-team"><div class="club-crest ${crestShape(club.logo)}" style="--crest-color:${esc(club.logo.color)}">${crestContent(club.logo,.9)}</div><strong>${esc(club.name)}</strong><span class="pill pill-lime" style="margin-top:7px">${teamRating(club)} OVR</span></div><div class="match-center"><div class="match-minute">READY</div><div class="match-score">— : —</div><div class="match-status">ОЖИДАНИЕ МАТЧА</div></div><div class="match-team"><div class="club-crest" style="--crest-color:#d1d9d0">?</div><strong>Соперник</strong><span class="pill" style="margin-top:7px">Не найден</span></div></div><div class="card" style="text-align:center;padding:28px"><div class="eyebrow">Quick match</div><h2 class="h2" style="font-size:34px;margin:9px 0">ГОТОВ ВЫЙТИ НА ПОЛЕ?</h2><p class="muted small" style="line-height:1.8;max-width:490px;margin:0 auto">Поиск соперника, несколько игровых эпизодов с выбором тактики и итоговый результат. В этой версии соперника контролирует бот — онлайн-режим подключим отдельно.</p><div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:18px 0"><span class="pill">⏱ 10 эпизодов</span><span class="pill">⚡ ${club.energy||0}/5 матчей</span><span class="pill">🎮 Выбор тактики</span><span class="pill">🪙 Награда за матч</span></div><button class="btn btn-primary" style="min-width:220px" data-action="match-search">🔎 Найти соперника</button></div><div class="dashboard-grid" style="margin-top:15px"><section class="card"><div class="eyebrow">Match rules</div><h2 class="h2" style="margin-top:6px">КАК ИГРАТЬ</h2><div class="recent-list"><div class="recent-row"><div class="recent-icon">🎯</div><div><strong>Атакуй с умом</strong><small>Выбирай между пасом, дриблингом и ударом.</small></div></div><div class="recent-row"><div class="recent-icon">🧱</div><div><strong>Защищайся</strong><small>Прессинг, отбор или низкий блок — риск разный.</small></div></div><div class="recent-row"><div class="recent-icon">🎲</div><div><strong>Случайность решает</strong><small>Аутсайдер тоже способен удивить фаворита.</small></div></div></div></section><section class="card"><div class="eyebrow">Your record</div><h2 class="h2" style="margin-top:6px">СТАТИСТИКА</h2><div class="statline"><span>Победы</span><b>${club.stats.wins}</b></div><div class="statline"><span>Ничьи</span><b>${club.stats.draws}</b></div><div class="statline"><span>Поражения</span><b>${club.stats.losses}</b></div><div class="statline"><span>Забито голов</span><b>${club.stats.goalsFor}</b></div></section></div></div>`;
    if(matchState.stage==='searching')return renderSearching(club);
    if(matchState.stage==='found')return renderFound(club);
    if(matchState.stage==='live')return renderLiveMatch(club);
    if(matchState.stage==='result')return renderMatchResult(club);
    return '';
  }
  function renderSearching(club){return `<div class="section-heading"><div><div class="eyebrow">Matchmaking</div><h1 class="h1">ПОИСК СОПЕРНИКА</h1><p class="page-subtitle">Подбираем клуб с подходящим рейтингом…</p></div><span class="pill pill-lime">Поиск</span></div><div class="match-shell"><div class="card" style="text-align:center;padding:30px"><div class="search-visual"><span class="search-ring"></span><span class="search-ring"></span><span class="search-ring"></span><span class="search-ball">⚽</span></div><h2 class="h2" style="font-size:34px">ИЩЕМ ТВОЕГО СОПЕРНИКА</h2><p class="muted small">Сравниваем силу составов и готовим матч. Сейчас поиск работает против ботов.</p><div class="progress" style="max-width:300px;margin:20px auto"><span style="width:75%;animation:searchProgress 1.6s linear infinite"></span></div><button class="btn btn-quiet btn-sm" data-action="cancel-search">Отменить поиск</button></div></div><style>@keyframes searchProgress{0%{width:4%}100%{width:100%}}
/* v12: horizontal player portraits in squad list, with wrapped names. */
.squad-item{align-items:center;min-height:72px}
.squad-item .mini-player{width:58px;height:66px;flex:0 0 58px;clip-path:none;border-radius:7px;background:#17231c;position:relative;overflow:hidden;display:block}
.squad-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 25%;display:block}
.mini-rating{position:absolute;z-index:2;left:3px;top:3px;padding:2px 4px;border-radius:4px;background:#101610d9;color:#fff;font:900 11px 'Barlow Condensed',sans-serif}
.squad-info{min-width:0;flex:1}
.squad-info strong{white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;word-break:normal;line-height:1.15}
.squad-info small{white-space:normal;line-height:1.3}
.slot-portrait{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 22%;border-radius:7px}
.slot-card .rating{z-index:3;background:#101610c9;color:#fff;border-radius:4px;padding:1px 3px}
@media(max-width:420px){.squad-item{gap:8px;padding:8px}.squad-item .mini-player{width:52px;height:60px;flex-basis:52px}.squad-info strong{font-size:10px}}

  </style>`;}
  function renderFound(club){
    const opp=matchState.opponent;
    const stars=(opp.players||[]).map(p=>({...p,id:null,rating:playerOVRAt(p,p.assignedPosition||p.position,null),realClub:p.realClub||p.club,positions:p.positions||[p.position],contractUntil:Date.now()+30*86400000,stamina:100})).sort((a,b)=>b.rating-a.rating).slice(0,3);
    return `<div class="section-heading"><div><div class="eyebrow">Opponent found</div><h1 class="h1">СОПЕРНИК НАЙДЕН</h1><p class="page-subtitle">Разминка закончена. Пора выходить на поле.</p></div><span class="pill pill-lime">✓ Найден</span></div><div class="match-shell"><div class="card" style="text-align:center;padding:25px"><span class="pill pill-lime">СОПОСТАВЛЕНИЕ ЗАВЕРШЕНО</span><div class="found-vs"><div class="found-side"><div class="club-crest ${crestShape(club.logo)}" style="--crest-color:${esc(club.logo.color)}">${crestContent(club.logo,.9)}</div><strong>${esc(club.name)}</strong><small>${teamRating(club)} OVR · Твой клуб</small></div><div class="vs-word">VS</div><div class="found-side"><div class="club-crest" style="--crest-color:${esc(opp.color)}">${esc(opp.symbol)}</div><strong>${esc(opp.name)}</strong><small>${opp.rating} OVR · Бот</small></div></div><div class="opponent-stars"><div class="eyebrow">⭐ ТРИ ЛУЧШИЕ КАРТОЧКИ СОПЕРНИКА</div><div class="player-grid opponent-best-grid">${stars.map(p=>renderPlayerCard(p,false,false)).join('')}</div></div><div class="divider"></div><div class="stat-grid" style="margin-bottom:18px"><div class="metric-card"><div class="metric-top">Твой состав</div><div class="metric-value">${teamRating(club)}</div><div class="metric-note">Общий рейтинг</div></div><div class="metric-card"><div class="metric-top">Соперник</div><div class="metric-value">${opp.rating}</div><div class="metric-note">Общий рейтинг</div></div><div class="metric-card"><div class="metric-top">Формат</div><div class="metric-value">10</div><div class="metric-note">Эпизодов</div></div><div class="metric-card"><div class="metric-top">Награда</div><div class="metric-value">€0.35 млн</div><div class="metric-note">Минимальная выплата</div></div></div><div class="match-agreement-timer">⏱ Осталось принять матч: <strong data-countdown-deadline="${matchState.agreementDeadline||Date.now()}">60 сек.</strong></div><button class="btn btn-primary" data-action="start-match" style="min-width:230px">Принять матч →</button><div style="margin-top:12px"><button class="btn btn-quiet btn-sm" data-action="cancel-search">Отменить</button></div></div></div>`;
  }
  function matchBoard(club){const opp=matchState.opponent;return `<div class="match-scoreboard"><div class="match-team"><div class="club-crest ${crestShape(club.logo)}" style="--crest-color:${esc(club.logo.color)}">${crestContent(club.logo,.9)}</div><strong>${esc(club.name)}</strong><span class="pill" style="margin-top:7px">${teamRating(club)} OVR</span></div><div class="match-center"><div class="match-minute">${matchState.minute||0}′</div><div class="match-score">${matchState.score[0]} : ${matchState.score[1]}</div><div class="match-status">${matchState.stage==='result'?'МАТЧ ОКОНЧЕН':'ZERO LEAGUE · MATCH'}</div></div><div class="match-team"><div class="club-crest" style="--crest-color:${esc(opp.color)}">${esc(opp.symbol)}</div><strong>${esc(opp.name)}</strong><span class="pill" style="margin-top:7px">${opp.rating} OVR</span></div></div>`;}
  // Match action photography supplied for Zero Football. All thumbnails use one shared 16:9 crop.
  const MATCH_ACTION_IMAGES={
    'Короткий пас':'https://a.espncdn.com/photo/2025/0604/r1502287_1296x729_16-9.jpg',
    'Перевод фланга':'https://dimages2.gazzettaobjects.it/files/image_528_298/uploads/2026/08/01/6a6e20db0c7d3.jpeg',
    'Пас за спину':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRfvAo4f153EM5ydBPOhCbsQu-gdwghvQDYJTPXxrWPAdmvrgzvpgDhaOkq&s=10',
    'Продвинуться с мячом':'https://www.tsukuba.ac.jp/en/research-news/images/p20250703140000.jpg',
    'Навес':'https://s.yimg.com/lo/mysterio/api/7896d559cca8c5ff520f7b82dcbadfe264239c8c4d6fdbe917e6d6ad82aec225/lightyear_networkapi/resizefill_w960%3Bquality_80%3Bformat_webp/https%3A%2F%2Fmedia.zenfs.com%2Fen%2Ffourfourtwo_376%2Fc8edbbd61c1bc0846ccc2ae819a10e6e',
    'Прострел назад':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT0twvt6xt9G337FHt_CUkKhVcOs_hTJQ5t0O3oHrIRu5nJbrDrVA_YH1pZ&s=10',
    'Обводка':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTvprUgI63B37xHoHTd3ovlnXJP_3Mi-nirzMqkWiI62g&s=10',
    'Сменить фланг':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSbi_m9in0bCIS2yH4bvUy693jSqj_i1n5HtB9FmiXcEpanZkoz5Av80Uk&s=10',
    'Быстрая контратака':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ3kEmpos3qmqwt6AwQBDN95nVX5lz11BGlI3Cbp83tHA&s=10',
    'Притормозить':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS5ek2au9L7mxsgGCDATDE_2RLA5vovMQmf5K6kXQjFyOvCpAtcHC3ki1H8&s=10',
    'Вертикальный пас':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTIWIQEdcvNshheQg0isHVz42CBlsI7lB39Qlqq9Ta44fN2lECe0Y-YZrkp&s=10',
    'Удар издали':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRFRK3mVMm8URNgaKL4hawB58nM9mApn-0TRh9AtOSJMblX8PgQx7iKWW0n&s=10',
    'Сесть в блок':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcShOKhNq8jOO0ten_AN4wNpaPZF1FCcuDmIeZArevVds3qjWR0eosu175Un&s=10',
    'Перекрыть пас':'https://d3rqy6w6tyyf68.cloudfront.net/AcuCustom/Sitename/DAM/033/BlockPasses.png',
    'Вступить в отбор':'https://i.guim.co.uk/img/media/91e807277573c99254eff14a171093a4bda8f6a9/114_90_1151_690/master/1151.jpg?width=700&quality=85&auto=format&fit=max&s=6976b9153dc2b62e725d791f431ce21d',
    'Удвоить опеку':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQEbVqwcsc1e2237r4av7Rtxw6WZOeB2QJn3NUQtWcKG-B4k8g66CytGWGt&s=10',
    'Закрыть ближнюю зону':'https://ajo.prod.reuters.tv/api/v2/img/69667336e4b070ec3d260f7a',
    'Выбить мяч':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRKhw2aYy2dH6wQlAxrvVEu2e9nWs5gpAVeNiE4xP1zJ-IhPtcMA_90oDM&s=10',
    'Подкат в момент':'https://s.yimg.com/lo/mysterio/api/fc3266070ade9276dbd083c8251d6a151d5c6cd809f6d2da55cd04eadd93e3ee/lightyear_networkapi/resizefill_w976%3Bquality_80%3Bformat_webp/https%3A%2F%2Fmedia.zenfs.com%2Fen%2Fusa_today_sports_articles_558%2Fd4114f014622669ae82800c5d2fbe98c',
    'Удар по воротам':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRizAhnWeAMeEC5aXGmqYz5vyyPvKSVkOz99FVywAcC0psJR5bqu2f9fe1w&s=10',
    'Завершение после прострела':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTuY5zhUZTf9XgBwgz5vB6Phn1xIv_2FgIEfiR2nvlC2Q&s=10',
    'Удар головой':'https://blog.playo.co/wp-content/uploads/2018/09/aptopix_spain_soccer_la_liga_78591_c0-150-3583-2238_s561x327.jpg',
    'Выход один на один':'https://ichef.bbci.co.uk/ace/standard/1024/cpsprodpb/b075/live/84c160f0-98be-11f1-9a0b-ef36d15fc6b3.jpg',
    'Удар после передачи':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS2JR0Wg1faxqB6hP87BhnrS_5BxilnGq0XZZrrioCmTU679XTMJPUnS7dE&s=10',
    'Попытка обыграть вратаря':'https://d3rqy6w6tyyf68.cloudfront.net/AcuCustom/Sitename/DAM/003/1v1Keeper.png',
    'Угловой':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcReUWxv1tUVwGNHIIHLtOzo1KarTtQeshdHzTK9VswhkA2y0q7OoQsnPyI&s=10',
    'Штрафной':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQqRzhXW9pnj8wKHs3hpycGQzgY4cNN11doZVh1mKM2a0PxX6PlUzfQ6xe7&s=10',
    'Пенальти':'https://img.olympics.com/images/image/private/t_s_pog_staticContent_hero_xl_2x/f_auto/primary/vpjzvzrxi2j3o1u44i1r',
    'Вбрасывание аута':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQAi_yMYNTEuBV_v8Ev3opG4GQmR1mxBrDU6OpCUkbyrziJ-sKYaay81WA&s=10',
    'Замена':'https://i.guim.co.uk/img/media/b9b996614ebccc01bdbacd9af4e9a8a2c4479ec8/0_96_3086_1852/master/3086.jpg?width=1200&quality=85&auto=format&fit=max&s=3f1aaa1d06dbd6e6a5046bf995c1f297',
    'Травма':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQr83p64a92ktXjaI1ZjVehPS_y_FTFjLbi4Rtm-4wuAQ&s=10',
    'Жёлтая':'https://mmo.aiircdn.com/370/69f085d38503d.jpg',
    'Красная':'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRc-95KdzZeMoMkBKBo-Mj6KU-Nr5x89b96716aFY8Pow&s=10'
  };
  const MATCH_ACTION_ALIASES={
    'Перевод фланга':'Перевод фланга','Перевод на другой фланг':'Сменить фланг','Атака через фланг':'Навес','Дриблинг 1 в 1':'Обводка','Дальний удар':'Удар издали','Удар по воротам':'Удар по воротам','Разрезающий пас':'Пас за спину','Низкий блок':'Сесть в блок','Идти в отбор':'Вступить в отбор','Перехват передачи':'Перекрыть пас','Вынос из штрафной':'Выбить мяч','Угловой:':'Угловой','Штрафной у':'Штрафной','Пенальти!':'Пенальти','Жёлтая карточка':'Жёлтая','Красная карточка':'Красная','Травма:':'Травма','Сделать замену':'Замена'
  };
  function matchActionImage(label){const key=MATCH_ACTION_IMAGES[label]?label:(MATCH_ACTION_ALIASES[label]||'');return key?MATCH_ACTION_IMAGES[key]:'';}
  function renderLiveMatch(club){
    const ev=matchState.currentEvent;
    if(matchState.pendingForcedSub){
      const out=club.players.find(p=>p.id===matchState.pendingForcedSub);const slotIndex=Number.isInteger(matchState.pendingForcedSlot)?matchState.pendingForcedSlot:club.lineup.indexOf(matchState.pendingForcedSub);const target=(FORMATIONS[club.formation]||FORMATIONS['4-3-3'])[slotIndex]?.role||out?.position||'CM';const reason=translateUIText(matchState.pendingForcedType==='red'?'Красная карточка — удаление':'Травма — игрок не может продолжать');
      const options=benchPlayers(club).filter(p=>!playerIsUnavailable(p)).map(p=>({p,ovr:playerOVRAt(p,target,club),penalty:positionPenalty(p,target)})).sort((a,b)=>b.ovr-a.ovr||b.p.rating-a.p.rating);
      const recommended=options.slice(0,3);
      return `<div class="section-heading"><div><div class="eyebrow">Обязательная замена · ${esc(positionLabel(target))}</div><h1 class="h1">ИГРОК ВЫБЫЛ</h1><p class="page-subtitle">${esc(out?playerDisplayName(out):'Игрок')} покидает поле. ${reason}. Нужна замена на позицию ${esc(positionLabel(target))}.</p></div><span class="pill pill-red">Требуется действие</span></div><section class="card forced-sub-card"><div class="forced-sub-out"><div><div class="eyebrow">ВЫБЫВШИЙ ИГРОК</div><strong data-no-translate>${esc(out?playerDisplayName(out):'Игрок')}</strong><small>${esc(out?playerPositionsLabel(out):'')} · ${out?playerOVRAt(out,target,club)+' OVR · ':''}${reason}</small></div><span class="pill pill-red">${esc(positionLabel(target))}</span></div><h3 class="h3">ЛУЧШИЕ ВАРИАНТЫ ЗАМЕНЫ</h3><p class="muted small">Подбор по соответствию позиции и текущему рейтингу, только среди доступных запасных.</p>${recommended.length?`<div class="forced-sub-recommendations">${recommended.map(({p,ovr,penalty})=>`<button class="forced-sub-option" data-portrait-key="${esc(p.wiki||p.name)}" ${p.wiki?`data-wiki="${esc(p.wiki)}"`:''} data-action="forced-sub-pick" data-out="${esc(matchState.pendingForcedSub)}" data-player-id="${esc(p.id)}" data-player-rating="${ovr}"><span class="forced-sub-avatar"><img class="squad-photo" alt="${esc(p.name)}" loading="lazy"><b>${ovr}</b></span><span class="forced-sub-copy"><strong data-no-translate>${esc(playerDisplayName(p))}</strong><small>${esc(playerPositionsLabel(p))} · ${penalty===0?'Профильная позиция':penalty<0?`Штраф позиции ${penalty}`:'Совместимая позиция'}</small></span><span class="forced-sub-pick-label">Выбрать</span></button>`).join('')}</div>`:`<p class="muted small">Нет доступных запасных игроков.</p>`}<div class="field"><label for="forcedSubPlayer">Или выбрать другого запасного</label><select id="forcedSubPlayer"><option value="">Выбери футболиста</option>${options.map(({p,ovr,penalty})=>`<option value="${esc(p.id)}">${esc(playerDisplayName(p))} · ${ovr} OVR${penalty<0?` · ${penalty} за позицию`:''}</option>`).join('')}</select></div>${options.length?`<button class="btn btn-primary" data-action="forced-sub" data-out="${esc(matchState.pendingForcedSub)}">Подтвердить замену</button>`:`<button class="btn btn-primary" data-action="forced-sub-skip" data-out="${esc(matchState.pendingForcedSub)}">Продолжить без замены</button>`}</section>`;
    }
    const actions=ev.kind==='penalty'?[{id:'pen-left',icon:'↙',name:'Левый угол',desc:'Низом в левую сторону.',risk:'Средний'},{id:'pen-center',icon:'⬆',name:'По центру',desc:'Удар в середину ворот.',risk:'Высокий'},{id:'pen-right',icon:'↘',name:'Правый угол',desc:'В дальнюю правую сторону.',risk:'Средний'},{id:'pen-chip',icon:'✦',name:'Паненка',desc:'Мягкая подсечка по центру.',risk:'Высокий'},{id:'pen-power',icon:'💥',name:'Сильный удар',desc:'Мощно пробить под перекладину.',risk:'Средний'},{id:'pen-place',icon:'🎯',name:'Точный удар',desc:'Положить мяч рядом со штангой.',risk:'Низкий'},{id:'pen-wait',icon:'🧠',name:'Выждать вратаря',desc:'Задержать удар и прочитать движение.',risk:'Средний'},{id:'pen-fake',icon:'🎭',name:'Обманный замах',desc:'Попытаться заставить вратаря упасть раньше.',risk:'Высокий'}]:ev.kind==='corner'?[{id:'corner-near',icon:'↗',name:'Ближняя штанга',desc:'Резкая подача на ближнюю.',risk:'Средний'},{id:'corner-far',icon:'⇢',name:'Дальняя штанга',desc:'Навес за спины защитникам.',risk:'Средний'},{id:'corner-short',icon:'↔',name:'Короткий розыгрыш',desc:'Пас партнёру у угла штрафной.',risk:'Низкий'},{id:'corner-shot',icon:'⚽',name:'Закрутить в ворота',desc:'Попытка прямого гола с углового.',risk:'Высокий'},{id:'corner-outswing',icon:'↘',name:'Подача от ворот',desc:'Закрутить мяч от вратаря.',risk:'Средний'},{id:'corner-inswing',icon:'↙',name:'Подача к воротам',desc:'Закрутить мяч прямо во вратарскую.',risk:'Средний'},{id:'corner-edge',icon:'🎯',name:'На линию штрафной',desc:'Оставить мяч игроку под дальний удар.',risk:'Высокий'},{id:'corner-low',icon:'⤵',name:'Низом на ближнюю',desc:'Быстрая низкая передача вдоль ворот.',risk:'Средний'}]:ev.kind==='freekick'?[{id:'wall2',icon:'🧱',name:'Стенка: 2 игрока',desc:'Больше игроков на подборе.',risk:'Высокий'},{id:'wall3',icon:'🧱',name:'Стенка: 3 игрока',desc:'Больше игроков закрывают зоны.',risk:'Средний'},{id:'wall4',icon:'🧱',name:'Стенка: 4 игрока',desc:'Сбалансированная стенка.',risk:'Низкий'},{id:'wall5',icon:'🧱',name:'Стенка: 5 игроков',desc:'Плотная стенка перед воротами.',risk:'Низкий'},{id:'keeper-left',icon:'🧤',name:'Вратарь ждёт слева',desc:'Закрыть левый угол.',risk:'Средний'},{id:'keeper-right',icon:'🧤',name:'Вратарь ждёт справа',desc:'Закрыть правый угол.',risk:'Средний'},{id:'wall-jump',icon:'⬆',name:'Команда выпрыгивает',desc:'Закрыть удар над стенкой.',risk:'Средний'},{id:'charge',icon:'🏃',name:'Выбежать на удар',desc:'Сократить дистанцию до бьющего.',risk:'Высокий'}]:ev.side==='user'?
      [{id:'through',icon:'↗',name:'Разрезающий пас',desc:'Передача за спину защитникам.',risk:'Средний'},{id:'wing',icon:'⇢',name:'Атака через фланг',desc:'Прострел или навес в штрафную.',risk:'Низкий'},{id:'dribble',icon:'✦',name:'Дриблинг 1 в 1',desc:'Обойти опекуна на скорости.',risk:'Высокий'},{id:'shot',icon:'⚽',name:'Удар по воротам',desc:'Завершить атаку из текущей позиции.',risk:'Высокий'},{id:'switch',icon:'↔',name:'Перевод на другой фланг',desc:'Сменить направление и растянуть оборону.',risk:'Низкий'},{id:'hold',icon:'⏱️',name:'Удержать мяч',desc:'Сохранить владение и дождаться поддержки.',risk:'Низкий'},{id:'one-two',icon:'🔁',name:'Стенка в штрафную',desc:'Быстрый пас и открывание под ответную передачу.',risk:'Средний'},{id:'longshot',icon:'🎯',name:'Дальний удар',desc:'Попытаться застать вратаря врасплох.',risk:'Высокий'}]:
      [{id:'press',icon:'↯',name:'Высокий прессинг',desc:'Накрыть соперника сразу после приёма.',risk:'Высокий'},{id:'block',icon:'▥',name:'Низкий блок',desc:'Закрыть пространство перед штрафной.',risk:'Низкий'},{id:'tackle',icon:'✕',name:'Идти в отбор',desc:'Вступить в силовую борьбу за мяч.',risk:'Средний'},{id:'intercept',icon:'⇠',name:'Перехват передачи',desc:'Прочитать направление следующего паса.',risk:'Средний'},{id:'double',icon:'👥',name:'Удвоить опеку',desc:'Два игрока закрывают главную угрозу.',risk:'Средний'},{id:'offside',icon:'🚩',name:'Искусственный офсайд',desc:'Поднять линию и поймать нападающего.',risk:'Высокий'},{id:'clear',icon:'🥾',name:'Вынос из штрафной',desc:'Убрать мяч подальше от ворот.',risk:'Низкий'},{id:'counterpress',icon:'⚡',name:'Контрпрессинг',desc:'Мгновенно вернуть мяч после потери.',risk:'Высокий'}];

    const scenarioSets={
      buildup:[['safe-pass','🧩','Короткий пас','Сохранить владение.'],['switch-play','↔','Перевод фланга','Растянуть оборону.'],['through','↗','Пас за спину','Искать рывок нападающего.'],['carry','🏃','Продвинуться с мячом','Пройти в свободную зону.']],
      wing:[['cross','⚑','Навес','Подать в штрафную.'],['cutback','↙','Прострел назад','Найти игрока на линии удара.'],['dribble','✦','Обводка','Попытаться пройти защитника.'],['switch','↔','Сменить фланг','Перевести атаку.']],
      counter:[['fast-break','⚡','Быстрая контратака','Использовать свободное пространство.'],['hold','⏱','Притормозить','Дождаться поддержки.'],['through','↗','Вертикальный пас','Запустить форварда.'],['longshot','🎯','Удар издали','Завершить быстро.']],
      defend:[['press','↯','Встречать прессингом','Давить на игрока с мячом.'],['block','▥','Сесть в блок','Закрыть пространство.'],['intercept','⇠','Перекрыть пас','Прочитать передачу.'],['tackle','✕','Вступить в отбор','Попробовать отобрать мяч.']],
      box:[['double','👥','Удвоить опеку','Закрыть главного форварда.'],['block','🧱','Закрыть ближнюю зону','Не дать прострелить.'],['clear','🥾','Выбить мяч','Снять давление.'],['tackle','✕','Подкат в момент','Рискованный отбор в штрафной.']],
      press:[['one-touch','⚡','Игра в одно касание','Выйти из давления.'],['long-pass','↗','Длинная передача','Перевести мяч за прессинг.'],['dribble','✦','Выход через дриблинг','Обойти первого соперника.'],['back-pass','↩','Сброс назад','Перестроить атаку.']],
      dribble:[['feint','🎭','Финт','Обмануть защитника.'],['speed','💨','Рывок','Уйти на скорости.'],['body','💪','Корпус','Прикрыть мяч и продавить.'],['pass','↗','Отдать пас','Сыграть на партнёра.']],
    };
    const scenario=ev.scenario|| (ev.side==='user'?'buildup':'defend');
    if(!matchState.actionDeadline){
      const deadline=Date.now()+60000,eventIndex=matchState.eventIndex,eventRef=matchState.currentEvent;
      matchState.actionDeadline=deadline;
      matchState.availableChoices=actions.map(a=>a.id);
      matchState.actionTimer=setTimeout(()=>{
        if(matchState.stage==='live'&&matchState.eventIndex===eventIndex&&matchState.currentEvent===eventRef&&matchState.actionDeadline===deadline){
          const fallback=pick(actions);if(fallback){toast('Время вышло — действие выбрано автоматически.');resolveChoice(fallback.id,true);}
        }
      },60000);
    }
    if(ev.kind==='penalty'||ev.kind==='corner'||ev.kind==='freekick')actions.splice(4);
    if(ev.kind!=='penalty'&&ev.kind!=='corner'&&ev.kind!=='freekick')actions.splice(0,actions.length,...(scenarioSets[scenario]||scenarioSets[ev.side==='user'?'buildup':'defend']).map(([id,icon,name,desc])=>({id,icon,name,desc,risk:['dribble','feint','speed','tackle','foul'].includes(id)?'Высокий':'Средний'})));
    matchState.availableChoices=actions.map(a=>a.id);
    return `<div class="section-heading"><div><div class="eyebrow">Live match</div><h1 class="h1">МАТЧ ИДЁТ</h1><p class="page-subtitle">Принимай решение в каждом эпизоде. Один удачный момент может изменить всё.</p></div><span class="pill pill-lime">Эпизод ${matchState.eventIndex+1} / 10</span></div><div class="match-shell">${energyWidget(club)}${matchBoard(club)}<section class="match-event"><div class="event-top"><span class="pill ${ev.side==='user'?'pill-lime':'pill-red'}">${ev.side==='user'?'⚡ ТВОЯ АТАКА':'🧱 ОБОРОНА'}</span><span class="muted small">${ev.minute}′ · ${ev.zone}</span></div><div class="eyebrow">Ключевой эпизод</div><h2 class="event-title">${esc(ev.title)}</h2><div class="event-visual match-action-hero" aria-label="Иллюстрация игрового эпизода">${(()=>{const title=String(ev.title||'');const key=Object.keys(MATCH_ACTION_IMAGES).find(k=>title.toLowerCase().includes(k.toLowerCase()))|| (ev.kind==='penalty'?'Пенальти':ev.kind==='corner'?'Угловой':ev.kind==='freekick'?'Штрафной':ev.kind==='injury'?'Травма':'');const src=key?MATCH_ACTION_IMAGES[key]:MATCH_ACTION_IMAGES['Удар по воротам'];return `<img src="${src}" alt="${esc(key||'Футбольный эпизод')}" loading="eager" referrerpolicy="no-referrer"><span class="match-action-hero-label">${esc(key||'Игровой эпизод')}</span>`;})()}</div><p class="event-description">${esc(ev.description)}</p><p class="muted small">${esc('Твоя команда: '+activePlayers(club).slice(0,3).map(playerDisplayName).join(', ')+' · '+matchState.opponent.name+': '+(matchState.opponent.players||['Игрок соперника 9','Игрок соперника 10','Игрок соперника 11']).slice(0,3).map(p=>typeof p==='string'?p:playerDisplayName(p)).join(', '))}</p><div class="divider"></div><details class="card" style="margin:12px 0;padding:12px"><summary><strong>🔄 Сделать замену</strong></summary><p class="muted small">Выбери игрока основы и замену со скамейки.</p>${activePlayers(club).map(p=>`<div class="statline"><span>${esc(p.name)} · ${p.rating}</span><select class="select-compact" data-sub-out="${esc(p.id)}"><option value="">Заменить на…</option>${benchPlayers(club).map(q=>`<option value="${esc(q.id)}" ${playerIsUnavailable(q)?'disabled':''}>${esc(q.name)} (${q.rating})${playerIsUnavailable(q)?' · '+esc(unavailableReason(q)):''}</option>`).join('')}</select><button class="btn btn-secondary btn-sm" data-action="manual-sub" data-out="${esc(p.id)}">Ок</button></div>`).join('')}</details><div class="event-top"><div class="eyebrow">Выбери действие</div><span class="pill pill-lime">⏱ Осталось: <b data-countdown-deadline="${matchState.actionDeadline}">60 сек.</b></span></div><div class="choice-grid">${actions.map((a,i)=>{const image=matchActionImage(a.name);return `<button class="match-choice match-choice-with-image" data-action="match-choice" data-choice="${a.id}">${image?`<span class="match-choice-image"><img src="${image}" alt="" loading="lazy" referrerpolicy="no-referrer"></span>`:''}<span class="choice-num">${i+1}</span><span class="match-choice-copy"><strong>${a.icon} ${a.name}</strong><small>${a.desc}<br><span style="color:${a.risk==='Высокий'?'#ff9d8f':a.risk==='Низкий'?'var(--lime)':'#e1c576'}">Риск: ${a.risk}</span></small></span></button>`;}).join('')}</div></section><section class="card"><div class="card-header"><div><div class="eyebrow">Match commentary</div><h2 class="h2">ХРОНИКА МАТЧА</h2></div></div><div class="match-log">${matchState.log.slice(-5).reverse().map(l=>{const t=String(l.text||'');const key=t.includes('Красн')?'Красная':t.includes('Жёлт')?'Жёлтая':t.includes('Травм')?'Травма':t.includes('замен')?'Замена':'';const src=key?MATCH_ACTION_IMAGES[key]:'';return `<div class="log-row match-log-row"><span class="log-minute">${l.minute}′</span>${src?`<img class="match-log-thumb" src="${src}" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}<span>${esc(t)}</span></div>`;}).join('')}</div></section></div>`;
  }
  function renderMatchResult(club){
    const m=matchState;const won=m.score[0]>m.score[1],draw=m.score[0]===m.score[1];const title=won?'ПОБЕДА!':draw?'БОЕВАЯ НИЧЬЯ':'В ЭТОТ РАЗ НЕ ПОВЕЗЛО';const result=won?'W':draw?'D':'L';
    return `<div class="section-heading"><div><div class="eyebrow">Full time</div><h1 class="h1">ФИНАЛЬНЫЙ СВИСТОК</h1><p class="page-subtitle">Матч закончен. Результат записан в историю клуба.</p></div><span class="pill ${won?'pill-lime':''}">${won?'🏆 Победа':draw?'🤝 Ничья':'Матч завершён'}</span></div><div class="match-shell">${matchBoard(club)}<section class="card" style="text-align:center;padding:29px"><div class="eyebrow">Full-time report</div><h2 class="h1" style="font-size:44px;margin-top:9px">${title}</h2><div class="result-stamp">${m.score[0]} : ${m.score[1]}</div><p class="muted small" style="max-width:470px;margin:0 auto">${won?'Отличная работа! Твои решения помогли забрать три очка.':draw?'Равная игра — ни одна команда не смогла дожать соперника.':'Поражение — повод разобрать решения и вернуться сильнее.'}</p><div class="result-details"><div class="result-metric"><span>Награда</span><strong style="color:var(--gold)">+${formatMoney(m.reward)}</strong></div></div><div class="divider"></div><div class="match-log" style="text-align:left;margin-bottom:20px">${m.log.map(l=>`<div class="log-row"><span class="log-minute">${l.minute}′</span><span>${esc(l.text)}</span></div>`).join('')}</div><div style="display:flex;justify-content:center;gap:9px;flex-wrap:wrap"><button class="btn btn-primary" data-action="match-again">Играть ещё раз ↗</button><button class="btn btn-secondary" data-action="nav" data-view="home">В главное меню</button></div></section></div>`;
  }
  function renderReveal(){
    if(!reveal)return '';
    const packMeta={
      starter:{label:'АГЕНТСТВО ★',color:'#c8ff44',accent:'#eeffb4',glow:'rgba(200,255,68,.38)'},
      national:{label:'АГЕНТСТВО ★★',color:'#79c9ff',accent:'#d8f3ff',glow:'rgba(121,201,255,.42)'},
      pro:{label:'АГЕНТСТВО ★★★',color:'#c296ff',accent:'#eee0ff',glow:'rgba(194,150,255,.45)'},
      elite:{label:'АГЕНТСТВО ★★★★',color:'#ffb45e',accent:'#ffe5c2',glow:'rgba(255,180,94,.45)'},
      legend:{label:'АГЕНТСТВО ★★★★★',color:'#ff6f9e',accent:'#ffd8e5',glow:'rgba(255,111,158,.48)'},
      daily:{label:'ЕЖЕДНЕВНЫЙ ПАК',color:'#f6ce58',accent:'#fff0b6',glow:'rgba(246,206,88,.4)'}
    };
    const meta=packMeta[reveal.type]||packMeta.starter;
    const speed=db.packAnimationSpeed||'normal';
    const timings={cinematic:{intro:1.2,start:1.75,stagger:.55,card:.92},normal:{intro:.86,start:1.18,stagger:.34,card:.72},fast:{intro:.48,start:.58,stagger:.16,card:.46}}[speed];
    const animationEnabled=db.packAnimations!==false;
    const skipped=!!reveal.skipAnimation||!animationEnabled;
    const cards=reveal.players.filter(p=>!p.duplicate||(reveal.duplicateRewards||[]).some(d=>d.id===p.id));
    const cardMarkup=cards.map((p,i)=>{
      const rating=Number(p.rating)||50;
      const rarity=rarityFor(rating);
      const rarityKey=rating>=90?'icon':rating>=85?'elite':rating>=75?'gold':rating>=65?'silver':'bronze';
      return `<div class="revealed-card rarity-reveal-${rarityKey}" data-reveal-card="${i}" style="--card-index:${i};--card-delay:${(timings.start+i*timings.stagger).toFixed(2)}s;--rarity-color:${rarity.color};--rarity-glow:${rarity.color}88"><div class="reveal-card-sheen"></div>${renderPlayerCard(p)}</div>`;
    }).join('');
    return `<div class="pack-opening ${skipped?'is-skipped':''} ${animationEnabled?'':'is-no-animation'}" data-pack-speed="${speed}" data-animation-serial="${reveal.animationSerial||0}" style="--pack-color:${meta.color};--pack-accent:${meta.accent};--pack-glow:${meta.glow};--pack-intro-duration:${timings.intro}s;--pack-card-start:${timings.start}s;--pack-card-stagger:${timings.stagger}s;--pack-card-duration:${timings.card}s">
      <div class="pack-opening-backdrop-grid"></div><div class="opening-box">
        <div class="opening-topline"><span class="opening-live-dot"></span><span>ZERO FOOTBALL · PLAYER ACQUISITION</span><span class="opening-pack-count">${cards.length} ${cards.length===1?'КАРТОЧКА':'КАРТОЧЕК'}</span></div>
        <div class="opening-pack-scene" aria-hidden="true"><div class="opening-scene-ring ring-one"></div><div class="opening-scene-ring ring-two"></div><div class="opening-pack-glow"></div><div class="opening-pack-box"><span class="opening-pack-star">✦</span><span>ZF</span><i></i></div><div class="opening-scene-particles"><b>✦</b><b>·</b><b>✧</b><b>·</b><b>✦</b><b>·</b><b>✧</b></div></div>
        <div class="opening-intro-copy"><div class="eyebrow" style="margin-top:8px">PACK OPENING · ${meta.label}</div><div class="opening-flash">НОВЫЕ <span>ПОДПИСАНИЯ</span></div><div class="opening-progress-track"><span></span></div><div class="opening-status">${skipped?'КАРТОЧКИ ГОТОВЫ':'СКАНИРОВАНИЕ КОНТРАКТОВ · ПОДГОТОВКА КАРТОЧЕК'}</div></div>
        <p class="muted small opening-description">Контракт каждой новой карточки — 30 дней. Повторки можно обменять на монеты или продлить контракт.</p>
        ${(reveal.duplicateRewards||[]).length?`<div class="card duplicate-rewards-panel" style="margin:12px 0"><strong>Повторные карточки: ${(reveal.duplicateRewards||[]).length}</strong>${reveal.duplicateRewards.map(p=>`<div class="statline"><span>${esc(playerDisplayName(p))} · OVR ${p.rating}</span><span><button class="btn btn-secondary btn-sm" data-action="duplicate-money" data-player-id="${esc(p.id)}">${formatMoney(saleValue(p,true))}</button> <button class="btn btn-secondary btn-sm" data-action="duplicate-contract" data-player-id="${esc(p.id)}">+5 дней</button></span></div>`).join('')}</div>`:''}
        <div class="revealed-cards ${skipped?'cards-ready':''}">${cardMarkup}</div>
        <div class="opening-actions">
          ${animationEnabled&&!skipped?'<button class="btn btn-secondary" data-action="skip-pack-animation">Пропустить анимацию ⏭</button>':''}
          ${animationEnabled&&skipped?'<button class="btn btn-secondary" data-action="replay-pack-animation">↻ Повторить открытие</button>':''}
          <button class="btn btn-primary" data-action="close-opening">Продолжить →</button>
        </div>
      </div></div>`;
  }
  function renderAssignModal(club,index){
    const oldId=club.lineup[index];const old=club.players.find(p=>p.id===oldId);const target=(FORMATIONS[club.formation]||FORMATIONS['4-3-3'])[index].role;
    const players=club.players.slice().map(p=>({p,ovr:playerOVRAt(p,target,club),penalty:positionPenalty(p,target)})).sort((a,b)=>b.ovr-a.ovr||b.p.rating-a.p.rating);
    return `<div class="modal-backdrop" data-action="close-modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><div class="modal-head"><div><div class="eyebrow">Squad management</div><h2>ЗАМЕНИТЬ ИГРОКА</h2><p class="muted small" style="margin:6px 0 0">Позиция: ${esc(positionLabel(target))} · Сейчас: ${esc(old?playerDisplayName(old):'Пусто')}</p></div><button class="icon-btn" data-action="close-modal">✕</button></div><div class="modal-player-list">${players.map(({p,ovr,penalty})=>{const starter=club.lineup.includes(p.id),unavailable=playerIsUnavailable(p);return `<button class="modal-player ${unavailable?'player-unavailable':''}" data-portrait-key="${esc(p.wiki||p.name)}" ${p.wiki?`data-wiki="${esc(p.wiki)}"`:''} data-action="assign-player" data-slot="${index}" data-player-id="${esc(p.id)}" ${unavailable?'disabled':''}><div class="mini-player" style="--rarity-color:${rarityColor(ovr)}"><img class="squad-photo" alt="${esc(p.name)}" loading="lazy"><span class="mini-rating">${ovr}</span></div><div class="modal-player-copy"><strong data-no-translate>${esc(playerDisplayName(p))}</strong><small>${esc(playerPositionsLabel(p))} · ${penalty===0?'Профильная позиция':penalty<0?`Штраф за позицию ${penalty}`:'Совместимая позиция'}${p.injuryMatches>0?` · 🤕 Травма (${p.injuryMatches})`:''}${p.redCardMatches>0?` · 🟥 Удалён (${p.redCardMatches})`:''}${p.yellowBanMatches>0?` · ⛔ Бан за жёлтые (${p.yellowBanMatches})`:''}${p.yellowCards>0?` · 🟨 ${p.yellowCards}/5`:''}${contractDays(p)===0?' · Контракт истёк':''}</small></div><span class="rating-badge">${starter?'В основе':`OVR ${ovr}`}</span></button>`;}).join('')}</div></section></div>`;
  }

  // ----- User actions -----
  function go(viewName){view=viewName;editSlotIndex=null;reveal=null;render();window.scrollTo({top:0,behavior:'smooth'});}
  function chooseClub(id){const c=db.clubs.find(x=>x.id===id);if(!c)return;db.activeClubId=id;view='home';matchState={stage:'idle'};saveDB();render();toast(`Добро пожаловать в ${c.name}!`);}
  async function createClubFromForm(form){
    if(form.dataset.submitting==='1')return false;
    form.dataset.submitting='1';
    const submit=form.querySelector('[data-action="create-club-submit"]');
    if(submit){submit.disabled=true;submit.textContent='Создаём клуб…';}
    let committed=false;
    try{
      const fd=new FormData(form);const name=String(fd.get('clubName')||'').trim();const country=String(fd.get('country')||'ua');const login=String(fd.get('clubLogin')||'').trim();const password=String(fd.get('clubPassword')||'');
      if(name.length<2)throw new Error('Название клуба должно содержать минимум 2 символа.');
      if(!/^[A-Za-z0-9_]{3,24}$/.test(login))throw new Error('Логин: 3–24 символа, только латиница, цифры и _.');
      if(password.length<8)throw new Error('Пароль должен содержать минимум 8 символов.');
      if(!COUNTRY[country])throw new Error('Выбери существующую страну клуба.');
      if(accountClubs().some(c=>c.login?.toLowerCase()===login.toLowerCase()))throw new Error('Этот логин уже занят другим клубом.');
      const credentials=await hashPassword(password);
      createDraft.symbol=(createDraft.layers||[]).find(l=>l.kind==='symbol')?.value||'★';
      const pattern=KIT_PATTERNS.some(x=>x[0]===fd.get('kitPattern'))?String(fd.get('kitPattern')):'plain';
      const club=makeClub(name,country,createDraft.symbol,createDraft.logoColor,String(fd.get('kitPrimary')||'#c8ff44'),String(fd.get('kitSecondary')||'#172318'),pattern);
      club.login=login;club.passwordHash=credentials.hash;club.passwordSalt=credentials.salt;club.passwordAlgorithm=credentials.algorithm;club.passwordIterations=credentials.iterations;
      club.lineup=club.players.slice(0,11).map(p=>p.id);
      const nextDb={...db,clubs:[...(db.clubs||[]),club],activeClubId:club.id};
      // Keep the previous snapshot so a failed verification can never leave a phantom club behind.
      const previousRaw=localStorage.getItem(STORE_KEY);
      const serialized=JSON.stringify(nextDb);
      try{
        localStorage.setItem(STORE_KEY,serialized);
        const saved=JSON.parse(localStorage.getItem(STORE_KEY)||'{}');
        if(!(saved.clubs||[]).some(c=>c.id===club.id&&c.passwordHash===credentials.hash))throw new Error('Браузер не подтвердил сохранение клуба. Проверь доступное место в хранилище.');
      }catch(storageError){try{if(previousRaw===null)localStorage.removeItem(STORE_KEY);else localStorage.setItem(STORE_KEY,previousRaw);}catch(rollbackError){console.error('Could not roll back a failed club save:',rollbackError);}throw storageError;}
      db=nextDb;committed=true;view='home';startMode='choose';matchState={stage:'idle'};playerModalRef=null;editSlotIndex=null;reveal=null;
      try{
        recordTrophies(club);
        saveDB();
        render();
        toast(`${countryData(country).flag} Клуб создан! Стартовый состав из 16 игроков готов.`);
      }catch(postCommitError){
        console.error('Post-commit UI recovery:',postCommitError);
        const root=$('#app');
        if(root)root.innerHTML=`<div class="start-screen"><div class="start-panel"><h2>Клуб сохранён</h2><p>Профиль «${esc(club.name)}» уже создан. Нажми, чтобы открыть его.</p><button class="btn btn-primary" id="recoverCreatedClub">Открыть клуб</button><button class="btn btn-quiet" id="recoverReload">Перезагрузить интерфейс</button></div></div>`;
        $('#recoverCreatedClub')?.addEventListener('click',()=>{try{view='home';render();}catch(e){console.error(e);toast('Не удалось открыть клуб. Перезагрузи страницу.','error');}});
        $('#recoverReload')?.addEventListener('click',()=>window.location.reload());
        toast('Клуб создан и сохранён. Ошибка возникла только при обновлении интерфейса.','error');
      }
      return true;
    }catch(err){
      if(committed){console.error('Post-commit club error:',err);return true;}
      throw err;
    }finally{
      form.dataset.submitting='0';
      if(submit&&submit.isConnected){submit.disabled=false;submit.textContent='Создать клуб и перейти к управлению →';}
    }
  }
  function openPack(type){
    const club=currentClub();if(!club)return;
    const packs={starter:{price:2,count:3,min:50,max:88,weights:[55,28,12,4,1]},national:{price:8,count:4,min:55,max:91,weights:[35,32,20,10,3]},pro:{price:25,count:5,min:60,max:94,weights:[20,30,27,17,6]},elite:{price:75,count:5,min:65,max:96,weights:[10,22,30,25,13]},legend:{price:200,count:6,min:70,max:99,weights:[4,14,27,32,23]},daily:{price:0,count:2,min:50,max:90,weights:[42,30,18,8,2]}};const pack=packs[type];if(!pack)return;
    const today=dailyShop(club).day;if(type==='daily'){if(club.freePackDay===today){toast('Бесплатный пак уже получен сегодня.','error');return;}club.freePackDay=today;}else if(club.coins<pack.price){toast('Недостаточно монет для этого пака. Сыграй матч и получи награду.','error');return;}
    club.coins-=pack.price;
    const newPlayers=[];
    for(let i=0;i<pack.count;i++){
      const pool=REAL_PLAYERS;
      const candidates=pool.filter(p=>p.rating>=pack.min&&p.rating<=pack.max);const roll=Math.random()*100;let cumulative=0;const band=pack.weights.findIndex(w=>(cumulative+=w)>=roll);const ranges=[[50,64],[65,74],[75,84],[85,89],[90,99]];const [lo,hi]=ranges[Math.max(0,band)];const bandPool=candidates.filter(p=>p.rating>=lo&&p.rating<=hi);let base=pick(bandPool.length?bandPool:(candidates.length?candidates:pool));const rating=base.rating;base={...base,rating};
      const position=base.position;
      const localizedBase=REAL_PLAYERS.find(p=>p.wiki===base.wiki)||base;const created=createPlayer(position,localizedBase.rating,localizedBase.name,localizedBase.country, {id:'card-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),wiki:base.wiki,realClub:base.club,realPlayer:true,displayPosition:({'GK':'ВР','LB':'ЛЗ','CB':'ЦЗ','RB':'ПЗ','CDM':'ОП','CM':'ЦП','CAM':'АП','LW':'ЛВ','RW':'ПВ','ST':'ЦН'})[position]||position});
      created.positions=({'Nico Paz':['CAM','CM','RW'],'Jude Bellingham':['CAM','CM'],'Federico Valverde':['CM','CDM','RM'],'Joško Gvardiol':['CB','LB'],'Achraf Hakimi':['RB','RWB'],'Nuno Mendes':['LB','LWB'],'Pedri':['CM','CAM'],'Kai Havertz':['ST','CAM'],'Lamine Yamal':['RW','LW'],'Raphinha':['RW','LW'],'Harry Kane':['ST','CF'],'Julián Álvarez':['ST','CF','CAM'],'Cristiano Ronaldo':['ST','LW'],'Andriy Yarmolenko':['RW','CAM'],'Neymar':['LW','CAM']})[base.wiki]||REAL_PLAYER_POSITIONS[base.wiki]||[base.position];created.name=localizedBase.name;created.rating=localizedBase.rating;created.country=localizedBase.country;created.realClub=base.club;created.wiki=base.wiki;created.realPlayer=true;created.displayPosition=({GK:'ВР',LB:'ЛЗ',CB:'ЦЗ',RB:'ПЗ',CDM:'ОП',CM:'ЦП',CAM:'АП',LW:'ЛВ',RW:'ПВ',ST:'ЦН'})[base.position]||base.position;
      const duplicate=club.players.find(p=>p.name===created.name)||newPlayers.find(p=>p.name===created.name);if(duplicate){created.duplicateOf=duplicate.id;created.duplicate=true;}created.contractUntil=Date.now()+30*86400000;newPlayers.push(created);
    }
    const actualPlayers=[];let duplicateRewards=[];newPlayers.forEach(p=>{if(p.duplicate){duplicateRewards.push(p); }else actualPlayers.push(p);});club.players.push(...actualPlayers);club.stats.packsOpened=(club.stats.packsOpened||0)+1;recordTrophies(club);saveDB();reveal={type,players:newPlayers,duplicateRewards,skipAnimation:db.packAnimations===false,animationSerial:++packAnimationSerial};render();
    if(db.packAnimations!==false){if(db.packVibration!==false)vibrate([28,35,48,45,90]);playPackSoundSequence(newPlayers);}
  }
  function positionScore(p,target){const penalty=positionPenalty(p,target);return penalty===0?20:penalty===-8?8:penalty===-35?-35:-18;}
  function assignPlayer(slotIndex,playerId){
    const club=currentClub();if(!club)return;
    const newPlayer=club.players.find(p=>p.id===playerId);if(!newPlayer)return;if(playerIsUnavailable(newPlayer)){toast(`Игрок недоступен: ${unavailableReason(newPlayer)}.`,'error');return;}const target=(FORMATIONS[club.formation]||FORMATIONS['4-3-3'])[slotIndex].role;const penalty=positionPenalty(newPlayer,target);
    const previousId=club.lineup[slotIndex];const otherIndex=club.lineup.indexOf(playerId);
    if(otherIndex>=0){club.lineup[otherIndex]=previousId||null;}club.lineup[slotIndex]=playerId;
    editSlotIndex=null;saveDB();render();toast(`${newPlayer.name}: ${playerOVRAt(newPlayer,target,club)} OVR на позиции ${target}${penalty<0?` (штраф ${penalty})`:''}.`);
  }
  function autoLineup(){
    const club=currentClub();if(!club)return;
    const slots=(FORMATIONS[club.formation]||FORMATIONS['4-3-3']);
    const remaining=club.players.filter(p=>!playerIsUnavailable(p)).sort((a,b)=>b.rating-a.rating);const result=[];if(remaining.length<slots.length){toast(`Недостаточно доступных футболистов: нужно ${slots.length}, сейчас ${remaining.length}.`,'error');return;}
    for(const slot of slots){
      let bestIndex=0;let bestScore=-Infinity;
      remaining.forEach((p,i)=>{let score=playerOVRAt(p,slot.role,club);if(positionScore(p,slot.role)<=-30)score-=28;if(contractDays(p)===0)score-=8;if(score>bestScore){bestScore=score;bestIndex=i;}});
      result.push(remaining.splice(bestIndex,1)[0].id);
    }
    club.lineup=result;saveDB();render();toast('Состав автоматически собран по рейтингу и позициям.');
  }
  function compatible(a,b){if(a===b)return true;const groups=[['LB','RB','LWB','RWB'],['CM','CAM','CDM','LM','RM'],['LW','RW','ST','CF'],['CB','CDM']];return groups.some(g=>g.includes(a)&&g.includes(b));}
  function setPattern(pattern){const club=currentClub();if(!club)return;if(!KIT_PATTERNS.some(x=>x[0]===pattern))pattern='plain';club.kit.pattern=pattern;const hidden=$('#editKitPattern');if(hidden)hidden.value=pattern;$$('[data-action="set-pattern"]').forEach(b=>b.classList.toggle('active',b.dataset.pattern===pattern));const shirt=$('#kitShirt');if(shirt)shirt.className=`kit-shirt pattern-${pattern}`;saveDB();}
  function makeBotRoster(targetRating){
    const roles=(FORMATIONS['4-3-3']||[]).map(x=>x.role);const used=new Set();const roster=[];
    for(const role of roles){
      const candidates=REAL_PLAYERS.filter(p=>!used.has(p.wiki)).map(p=>{const positions=REAL_PLAYER_POSITIONS[p.wiki]||[p.position];const copy={...p,realClub:p.club,positions,assignedPosition:role,stamina:100,injuryMatches:0};const fit=positionScore(copy,role);const effective=playerOVRAt(copy,role,null);const score=Math.abs(effective-targetRating)+(fit<0?Math.abs(fit)*.45:0)+rand(0,2.2);return {p:copy,score};}).sort((a,b)=>a.score-b.score);
      const chosen=candidates[0]?.p;if(chosen){used.add(chosen.wiki);roster.push(chosen);}
    }
    return roster;
  }
  function startSearch(){
    const club=currentClub();if(!club)return;
    clearMatchTimers();
    const starters=activePlayers(club);
    if(starters.length!==11){toast('Сначала собери полный стартовый состав из 11 игроков.','error');view='team';render();return;}
    const unavailable=starters.filter(playerIsUnavailable);
    if(unavailable.length){toast(`Поиск матча недоступен: ${unavailable.map(p=>`${p.name} — ${unavailableReason(p)}`).join('; ')}.`,'error');view='team';render();return;}
    refreshEnergy(club);if(club.energy<1){toast('Энергия команды закончилась. Подожди восстановления или используй пополнение.','error');view='match';render();return;}matchState={stage:'searching'};render();
    matchState.timer=setTimeout(()=>{
      const base=BOT_CLUBS[rand(0,BOT_CLUBS.length-1)];
      const userR=teamRating(club),targetBotRating=clamp(userR+rand(-8,8),50,95);const botPlayers=makeBotRoster(targetBotRating);const opponentRating=rosterTeamRating(botPlayers,'4-3-3');
      const token='match-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
      matchState={stage:'found',matchToken:token,agreementDeadline:Date.now()+60000,opponent:{name:base.name,symbol:base.symbol,country:base.country,color:pick(['#f18b65','#76b8ff','#d3d5d0','#e6adff','#f6cf56']),rating:opponentRating,players:botPlayers},score:[0,0],log:[]};
      matchState.agreementTimer=setTimeout(()=>{
        if(matchState.stage==='found'&&matchState.matchToken===token){clearMatchTimers();matchState={stage:'idle'};render();toast('Время на принятие матча истекло.','error');}
      },60000);
      render();
    },1800);
  }
  function beginMatch(){
    const club=currentClub();if(!club)return;
    if(matchState.agreementTimer)clearTimeout(matchState.agreementTimer);matchState.agreementTimer=null;
    if(matchState.timer)clearTimeout(matchState.timer);matchState.timer=null;refreshEnergy(club);if(club.energy<1){toast('Нет энергии для матча.','error');return;}
    if(matchState.stage!=='found'||!matchState.opponent){toast('Матч больше не ожидает подтверждения.','error');return;}
    if(matchState.agreementDeadline&&Date.now()>matchState.agreementDeadline){clearMatchTimers();matchState={stage:'idle'};render();toast('Время на принятие матча истекло.','error');return;}
    if(!club.lineup||club.lineup.length<11){toast('Сначала настрой стартовый состав.','error');return;}const unavailable=activePlayers(club).filter(playerIsUnavailable);if(unavailable.length){toast(`В стартовом составе есть недоступные игроки: ${unavailable.map(p=>p.name).join(', ')}. Замени их.`,'error');view='team';render();return;}club.energy--;saveDB();
    const opp=matchState.opponent||{name:'Northside United',symbol:'❄️',country:'🇳🇴',color:'#a5c7ed',rating:68};
    matchState={stage:'live',opponent:opp,score:[0,0],eventIndex:0,minute:8,currentEvent:null,completedEvents:0,turnOrder:['home','away'],multiplayerTurnModel:{roles:['attacker','defender'],alternate:true,diceSides:20},log:[{minute:0,text:'Матч начался! Обе команды готовы бороться за победу.'}],goodChoices:0,totalChoices:0,preMatchStatuses:Object.fromEntries(club.players.map(p=>[p.id,{injury:p.injuryMatches||0,red:p.redCardMatches||0,yellowBan:p.yellowBanMatches||0}]))};
    makeCurrentEvent();render();
  }
  function makeCurrentEvent(){
    const club=currentClub();const m=matchState;const userStrength=teamRating(club);const diff=userStrength-m.opponent.rating;const mins=[8,17,26,35,45,54,63,72,81,89];const minute=mins[m.eventIndex]||88;m.minute=minute;
    const setPieceRoll=Math.random();
    if(setPieceRoll<.045){m.currentEvent={side:'user',attacker:'user',defender:'opponent',turnIndex:m.eventIndex||0,kind:'penalty',minute,zone:'11 МЕТРОВ',title:'ПЕНАЛЬТИ!',description:'Выбери угол удара. Вратарь соперника попытается угадать направление.'};return;}
    if(setPieceRoll<.10){m.currentEvent={side:'user',attacker:'user',defender:'opponent',turnIndex:m.eventIndex||0,kind:'corner',minute,zone:'УГЛОВОЙ ФЛАГ',title:'УГЛОВОЙ',description:'Выбери подачу на ближнюю или дальнюю штангу либо короткий розыгрыш.'};return;}
    if(setPieceRoll<.15){m.currentEvent={side:'opponent',attacker:'opponent',defender:'user',turnIndex:m.eventIndex||0,kind:'freekick',minute,zone:'ШТРАФНОЙ',title:'ШТРАФНОЙ СОПЕРНИКА',description:'Выбери число игроков в стенке и реши, какой угол будет закрывать вратарь.'};return;}
    const userAttacks=Math.random()<clamp(.5+diff*.009,.32,.68);
    if(userAttacks){
      const eventTemplates=[
        {zone:'ЦЕНТРАЛЬНАЯ ЗОНА',title:'Комбинация у штрафной',description:'Полузащитник нашёл пространство между линиями. Защита соперника начинает сжиматься — нужно выбрать продолжение атаки.'},
        {zone:'ПРАВЫЙ ФЛАНГ',title:'Свободная зона на фланге',description:'Твой вингер выиграл метр пространства. Можно обыграть защитника, прострелить или попробовать завершить атаку дальним ударом.'},
        {zone:'ПЕРЕД ШТРАФНОЙ',title:'Момент для решающего паса',description:'Нападающий открывается за спины защитникам. Точный пас создаст опасность, но ошибка может привести к контратаке.'},
        {zone:'КРАЙ ШТРАФНОЙ',title:'Защитник вышел навстречу',description:'Мяч у атакующего игрока. Защитник не даёт развернуться — быстрый выбор может открыть шанс для удара.'}
      ];const e=pick(eventTemplates);m.currentEvent={side:'user',attacker:'user',defender:'opponent',turnIndex:m.eventIndex||0,minute,zone:e.zone,title:e.title,description:e.description,scenario:pick(['buildup','wing','counter','press','dribble'])};
    }else{
      const eventTemplates=[
        {zone:'ЦЕНТР ПОЛЯ',title:'Соперник разгоняет атаку',description:'Противник движется вперёд через центр. Реши, насколько высоко встречать его и какую зону закрыть.'},
        {zone:'ТВОЯ ШТРАФНАЯ',title:'Опасный прострел',description:'Соперник добрался до фланга и ищет передачу в штрафную. Нужно читать эпизод и не оставить свободного игрока.'},
        {zone:'ЗОНА ПОЛУЗАЩИТЫ',title:'Потеря мяча под прессингом',description:'Соперник перехватил передачу и пытается воспользоваться свободным пространством. Выбери способ остановить атаку.'},
        {zone:'ПЕРЕД ШТРАФНОЙ',title:'Соперник готовит удар',description:'Атакующий нашёл позицию перед штрафной. Можно попытаться накрыть удар или компактно закрыть пространство.'}
      ];const e=pick(eventTemplates);m.currentEvent={side:'opponent',attacker:'opponent',defender:'user',turnIndex:m.eventIndex||0,minute,zone:e.zone,title:e.title,description:e.description,scenario:pick(['defend','box','press','counter'])};
    }
  }
  function resolveChoice(choice,timedOut=false){
    const club=currentClub();const m=matchState;if(!club||m.stage!=='live'||m.finalized||m.eventIndex>9||m.resolvingEvent===m.eventIndex)return;
    if(m.actionDeadline&&Date.now()>m.actionDeadline&&!timedOut){
      const validChoices=(m.availableChoices||[]).filter(Boolean);const fallback=validChoices.length?pick(validChoices):null;
      if(fallback){toast('Время вышло — действие выбрано автоматически.');return resolveChoice(fallback,true);}
      m.actionDeadline=null;m.actionTimer=null;makeCurrentEvent();render();return;
    }
    m.resolvingEvent=m.eventIndex;
    if(m.actionTimer)clearTimeout(m.actionTimer);m.actionTimer=null;m.actionDeadline=null;const ev=m.currentEvent;const style=STYLES[club.style]||STYLES.balanced;
    activePlayers(club).forEach(p=>{p.stamina=Math.max(0,(p.stamina??100)-(choice==='press'||choice==='counterpress'?8:choice==='dribble'||choice==='speed'?7:4));});
    const attackAliases={'safe-pass':'hold','switch-play':'switch','carry':'dribble','cross':'wing','cutback':'wing','fast-break':'through','long-pass':'through','one-touch':'one-two','back-pass':'hold','feint':'dribble','speed':'dribble','body':'hold','pass':'through','recover':'block','foul':'tackle','track':'double'};choice=attackAliases[choice]||choice;const diff=teamRating(club)-m.opponent.rating;
    let text='';let success=false;
    const dice=rand(1,20), teamMod=Math.round(diff/10), tacticalMod=club.style==='attacking'?(ev.side==='user'?2:-1):club.style==='defensive'?(ev.side==='user'?-1:2):0;
    const chosenPlayer=pick(activePlayers(club));const playerMod=Math.round(((ev.side==='user'?chosenPlayer.shooting:chosenPlayer.defense)-70)/10);const diceTotal=dice+teamMod+tacticalMod+playerMod;
    if(ev.kind==='penalty'){const keeper=pick(['левый','центр','правый']);const target=choice==='pen-left'?'левый':choice==='pen-right'?'правый':choice==='pen-center'?'центр':choice==='pen-place'?'левый':choice==='pen-power'?'правый':'центр';success=target!==keeper||Math.random()<.25;success=success&&diceTotal>=6;if(success){m.score[0]++;text=`⚽ Пенальти реализован ударом в ${target} угол! Вратарь прыгнул ${keeper==='центр'?'по центру':keeper+' угол'}.`;}else{text=`🧤 Вратарь угадал направление (${keeper} угол) и отразил пенальти.`;}
    }else if(ev.kind==='corner'){success=Math.random()<(choice==='corner-shot'?.09:choice==='corner-short'?.16:choice==='corner-edge'?.13:choice==='corner-low'?.18:.23)+(diceTotal-10)*.008;if(success){m.score[0]++;text=`⚽ Гол после углового! Выбран вариант: ${choice==='corner-near'?'ближняя штанга':choice==='corner-far'?'дальняя штанга':choice==='corner-short'?'короткий розыгрыш':'прямой удар'}.`;}else{text=`Угловой разыгран (${choice==='corner-near'?'ближняя штанга':choice==='corner-far'?'дальняя штанга':choice==='corner-short'?'короткий пас':'удар с закруткой'}), но защита вынесла мяч.`;}
    }else if(ev.kind==='freekick'){const wall=choice==='wall2'?2:choice==='wall3'?3:choice==='wall5'?5:4;const keeperBonus=(choice==='keeper-left'||choice==='keeper-right')?.05:0;const saved=Math.random()<(wall===5?.68:wall===4?.58:wall===3?.48:.38)+keeperBonus+(diceTotal-10)*.008;success=saved;if(saved){text=`🧤 Стенка из ${wall} игроков помогла закрыть удар; вратарь контролировал ${choice==='keeper-left'?'левый угол':'опасную зону'}.`;}else{m.score[1]++;text=`⚽ Гол соперника со штрафного! Стенка из ${wall} игроков не перекрыла траекторию.`;}
    }else if(ev.side==='user'){
      const base={through:.245,wing:.205,dribble:.225,shot:.135,switch:.20,hold:.28,'one-two':.235,longshot:.11}[choice]??.19;
      const styleBoost=style.attack;
      const chance=clamp(base+diff*.006+styleBoost+(diceTotal-10)*.012,.045,.62);
      success=Math.random()<chance;
      const names={through:'разрезающий пас',wing:'атака через фланг',dribble:'дриблинг',shot:'удар по воротам',switch:'перевод фланга',hold:'удержание мяча','one-two':'стенка в штрафную',longshot:'дальний удар'};
      if(success){m.score[0]++;text=`ГОЛ! ${club.name} — ${names[choice]||choice}. Точное исполнение и отличный момент!`;m.goodChoices++;}
      else if(Math.random()<.22){text=`${club.name}: ${names[choice]||choice} не прошёл. Соперник перехватил мяч и готовит ответную атаку.`;if(Math.random()<clamp(.12+(m.opponent.rating-teamRating(club))*.006,.05,.24)){m.score[1]++;text+=' Контратака заканчивается голом соперника!';}}
      else{text=`${club.name}: ${names[choice]||choice} не принёс гола. Вратарь справился или защита заблокировала попытку.`;if(Math.random()<.015){const injured=pick(activePlayers(club));injured.injuryMatches=Math.max(injured.injuryMatches,rand(1,2));text+=` ${injured.name} получает повреждение и может пропустить следующий матч.`;}}
    }else{
      const base={press:.155,block:.082,tackle:.125,intercept:.105,double:.10,offside:.12,clear:.07,counterpress:.145}[choice]??.12;
      const styleBoost=style.defense;const chance=clamp(base+(m.opponent.rating-teamRating(club))*.006-styleBoost-(diceTotal-10)*.012,.025,.48);
      const names={press:'высокий прессинг',block:'низкий блок',tackle:'отбор',intercept:'перехват передачи',double:'удвоенная опека',offside:'искусственный офсайд',clear:'вынос из штрафной',counterpress:'контрпрессинг'};
      if(Math.random()<chance){m.score[1]++;text=`Гол соперника. ${names[choice]||choice} не сработал, и противник наказал за свободное пространство.`;}
      else{success=true;m.goodChoices++;text=`Хорошая оборона! ${names[choice]||choice} сработал — атака соперника остановлена.`;if(Math.random()<.085){text+=' Команда быстро вышла в контратаку, и…';if(Math.random()<.24+Math.max(-.1,Math.min(.1,diff*.004))){m.score[0]++;text+=' ГОЛ! Идеальный переход из обороны в атаку!';}else{text+=' момент закончился без удара.';}}}
    }
    m.totalChoices++;
    const incidentRoll=Math.random();
    if(!ev.kind&&incidentRoll<.03){const p=pick(activePlayers(club));p.injuryMatches=Math.max(p.injuryMatches||0,1);m.pendingForcedSub=p.id;m.pendingForcedSlot=club.lineup.indexOf(p.id);m.pendingForcedType='injury';text+=` 🤕 Травма: ${playerDisplayName(p)} не может продолжать матч — обязательная замена.`;}
    else if(!ev.kind&&incidentRoll<.055){const p=pick(activePlayers(club));p.redCardMatches=Math.max(p.redCardMatches||0,1);m.pendingForcedSub=p.id;m.pendingForcedSlot=club.lineup.indexOf(p.id);m.pendingForcedType='red';text+=` 🟥 Красная карточка! ${playerDisplayName(p)} удалён — обязательная замена.`;}
    else if(!ev.kind&&incidentRoll<.16){
      const p=pick(activePlayers(club));p.yellowCards=(p.yellowCards||0)+1;p.yellowCardTotal=(p.yellowCardTotal||0)+1;
      if(p.yellowCards>=5){p.yellowCards=0;p.yellowBanMatches=Math.max(p.yellowBanMatches||0,1);text+=` 🟨 Пятая жёлтая карточка у ${p.name}! Он пропустит следующий матч.`;}
      else{text+=` 🟨 Жёлтая карточка игроку ${p.name} (${p.yellowCards}/5).`;}
    }
    else if(!ev.kind&&incidentRoll<.29){text+=` 🚩 Угловой: ${pick(activePlayers(club)).name} подаёт в штрафную.`;if(Math.random()<.18){m.score[0]++;text+=' ГОЛ после углового!';}}
    else if(!ev.kind&&incidentRoll<.39){text+=` 🎯 Штрафной у ${pick(activePlayers(club)).name}.`;if(Math.random()<.12){m.score[0]++;text+=' Прямой удар — ГОЛ!';}}
    else if(!ev.kind&&incidentRoll<.46){text+=` ⚽ Пенальти! ${pick(activePlayers(club)).name} у точки.`;if(Math.random()<.72){m.score[0]++;text+=' Пенальти реализован!';}else text+=' Вратарь отбил удар!';}
    if(!m.pendingForcedSub&&m.eventIndex===4&&!m.substitutionsDone&&benchPlayers(club).length){m.substitutionsDone=true;const formation=FORMATIONS[club.formation]||FORMATIONS['4-3-3'];const outEntry=club.lineup.map((id,i)=>({p:club.players.find(x=>x.id===id),i,role:formation[i]?.role})).filter(x=>x.p).sort((a,b)=>playerOVRAt(a.p,a.role,club)-playerOVRAt(b.p,b.role,club))[0];if(outEntry){const sub=benchPlayers(club).filter(p=>!playerIsUnavailable(p)).map(p=>({p,ovr:playerOVRAt(p,outEntry.role,club)})).sort((a,b)=>b.ovr-a.ovr)[0]?.p;if(sub){club.lineup[outEntry.i]=sub.id;text+=` 🔄 Замена: ${playerDisplayName(outEntry.p)} (${positionLabel(outEntry.role)}) → ${playerDisplayName(sub)} (${playerOVRAt(sub,outEntry.role,club)} OVR).`;}}}
    m.availableChoices=[];
    m.log.push({minute:ev.minute,text:`🎲 Кубик ${dice} · модификаторы команды ${teamMod>=0?'+':''}${teamMod}, тактики ${tacticalMod>=0?'+':''}${tacticalMod}, игрока ${playerMod>=0?'+':''}${playerMod} = ${diceTotal}. ${text}`});
    m.completedEvents=(m.completedEvents||0)+1;
    if(m.eventIndex===9){
      // The tenth decision is the final whistle. Incidents in this last episode
      // remain recorded on the player for the next match, but must not trap the user
      // on the mandatory-substitution screen after the match has already ended.
      m.eventIndex=10;m.completedEvents=Math.max(10,Number(m.completedEvents)||0);m.pendingForcedSub=null;m.pendingForcedSlot=null;m.pendingForcedType=null;m.resolvingEvent=null;
      finishMatch(true);return;
    }
    m.eventIndex++;m.resolvingEvent=null;makeCurrentEvent();render();
  }
  function finishMatch(fromFinalDecision=false){
    const club=currentClub();const m=matchState;
    if(!club||!m||m.finalized)return false;
    const completed=Math.max(Number(m.completedEvents)||0,Number(m.eventIndex)||0);
    if(!fromFinalDecision&&completed<10)return false;
    if(fromFinalDecision&&m.stage!=='live')return false;
    // Normalize older or partially migrated club saves before applying match statistics.
    const statDefaults={matches:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,packsOpened:0};
    club.stats={...statDefaults,...(club.stats&&typeof club.stats==='object'?club.stats:{})};
    Object.keys(statDefaults).forEach(key=>{const n=Number(club.stats[key]);club.stats[key]=Number.isFinite(n)?Math.max(0,n):0;});
    m.score=Array.isArray(m.score)?[Math.max(0,Number(m.score[0])||0),Math.max(0,Number(m.score[1])||0)]:[0,0];
    m.log=Array.isArray(m.log)?m.log:[];m.opponent=m.opponent||{name:'Соперник'};
    m.finalized=true;m.eventIndex=10;m.completedEvents=10;clearMatchTimers();m.actionTimer=null;m.actionDeadline=null;m.stage='result';m.minute=90;
    const won=m.score[0]>m.score[1],draw=m.score[0]===m.score[1];m.reward=won?0.8:draw?0.55:0.35;
    club.coins=(Number(club.coins)||0)+m.reward;club.stats.matches++;club.sponsorSlots=club.sponsorSlots||{kit:null,title:null,extra:null};m.sponsorBonus=0;
    Object.keys(club.sponsorSlots).forEach(type=>{const contract=club.sponsorSlots[type];if(contract&&contract.until>Date.now()){const deal=SPONSOR_DEALS.find(x=>x.id===contract.id);if(deal){const bonus=deal.match+(won?deal.win:0);club.coins+=bonus/1000;m.sponsorBonus+=bonus/1000;}}else if(contract)club.sponsorSlots[type]=null;});
    if(won)club.stats.wins++;else if(draw)club.stats.draws++;else club.stats.losses++;
    club.stats.goalsFor+=m.score[0];club.stats.goalsAgainst+=m.score[1];
    // Only bans/injuries that existed before this match count down; new incidents remain active.
    (club.players||[]).forEach(p=>{p.stamina=Math.min(100,(p.stamina??100)+35);const prior=m.preMatchStatuses?.[p.id];if(prior?.injury>0)p.injuryMatches=Math.max(0,(p.injuryMatches||0)-1);if(prior?.red>0)p.redCardMatches=Math.max(0,(p.redCardMatches||0)-1);if(prior?.yellowBan>0)p.yellowBanMatches=Math.max(0,(p.yellowBanMatches||0)-1);});
    const result=won?'W':draw?'D':'L';club.history=Array.isArray(club.history)?club.history:[];club.history.unshift({opponent:m.opponent.name||'Соперник',score:`${m.score[0]} : ${m.score[1]}`,result,date:new Date().toLocaleDateString('ru-RU')});club.history=club.history.slice(0,12);
    if(!m.log.some(entry=>entry.minute===90&&String(entry.text||'').startsWith('Финальный свисток.')))m.log.push({minute:90,text:`Финальный свисток. ${won?'Победа твоего клуба!':draw?'Ничья — команды разделили очки.':'Поражение. В следующем матче можно отыграться.'} Награда: ${formatMoney(m.reward)}.${m.sponsorBonus?` Спонсорский бонус: +${m.sponsorBonus}.`:''}`});
    view='match';
    try{recordTrophies(club);}catch(trophyError){console.warn('Could not record match trophies:',trophyError);}
    const saved=saveDB();
    try{render();}catch(renderError){console.error('Could not render match result:',renderError);const root=$('#app');if(root){root.innerHTML=`<main class="main-area"><section class="card" style="text-align:center"><h1 class="h1">ФИНАЛЬНЫЙ СВИСТОК</h1><div class="result-stamp">${m.score[0]} : ${m.score[1]}</div><p>Матч завершён. Результат сохранён в истории клуба.</p><button class="btn btn-primary" data-action="nav" data-view="match">Открыть матч</button></section></main>`;}}
    if(!saved)toast('Матч завершён, но браузер не смог сохранить результат. Освободи место в хранилище.','error');return true;
  }

  const MUSIC_STYLES = {
    ambient:{name:'Атмосферная',icon:'🌌',bpm:78,wave:'sine',pad:'triangle',cutoff:1500,scale:[0,2,4,7,9],chords:[[0,4,7],[5,9,12],[3,7,10],[4,7,11]],drums:false},
    electronic:{name:'Электронная',icon:'⚡',bpm:116,wave:'sawtooth',pad:'triangle',cutoff:2600,scale:[0,2,3,7,9],chords:[[0,3,7],[5,8,12],[3,7,10],[7,10,14]],drums:'electronic'},
    stadium:{name:'Стадионная',icon:'🏟️',bpm:108,wave:'square',pad:'sawtooth',cutoff:1900,scale:[0,2,4,5,7,9,10],chords:[[0,4,7],[7,11,14],[5,9,12],[3,7,10]],drums:'stadium'},
    lofi:{name:'Lo-fi',icon:'☕',bpm:86,wave:'triangle',pad:'sine',cutoff:950,scale:[0,2,3,7,9],chords:[[0,3,7],[8,12,15],[5,8,12],[3,7,10]],drums:false},
    rock:{name:'Рок',icon:'🎸',bpm:124,wave:'sawtooth',pad:'square',cutoff:3300,scale:[0,2,4,7,9,10],chords:[[0,7,12],[5,12,17],[3,10,15],[7,14,19]],drums:'rock'}
  };
  const MUSIC_TRACKS = {
    ambient:['Тихий стадион','После матча','Ночные огни','Дальний горизонт','Последний свет'],
    electronic:['Pulse Start','Neon Run','Fast Break','Digital Tactics','Overdrive'],
    stadium:['Перед выходом','Трибуны','Большой матч','Вперёд, команда','Финальный свисток'],
    lofi:['Кофе перед игрой','Спокойный день','Городской дождь','Поздняя тренировка','После победы'],
    rock:['Kickoff','No Surrender','Rising Eleven','Full Pressure','Champions']
  };
  const MUSIC_MELODIES = [
    [0,2,4,2,1,3,4,3,0,2,4,6,4,3,2,1],
    [4,2,0,2,5,4,2,1,4,6,5,4,2,1,0,2],
    [0,0,3,4,2,2,5,4,0,3,4,6,5,3,2,1],
    [2,4,5,4,2,0,1,2,4,5,6,5,3,2,1,0],
    [0,3,5,3,1,4,6,4,2,5,7,5,3,4,2,0]
  ];
  function currentMusicTrack(){const style=db.musicStyle||'ambient',n=clamp(Number(db.musicTrack)||0,0,4);return {style,n,name:MUSIC_TRACKS[style][n],seed:n+1};}
  function ensureAudioContext(){
    const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)return null;
    try{
      if(!packAudioContext)packAudioContext=new AudioCtx();
      if(packAudioContext.state==='suspended')packAudioContext.resume().catch(()=>{});
      if(!musicBus){musicBus=packAudioContext.createGain();musicBus.gain.value=0;musicBus.connect(packAudioContext.destination);}
      return packAudioContext;
    }catch(_){return null;}
  }
  function setMusicVolume(){
    const ctx=ensureAudioContext();if(!ctx||!musicBus)return;
    const active=db.sound!==false&&db.musicEnabled!==false;
    const target=active?(clamp(Number(db.musicVolume)||0,0,100)/100)*.34:0;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(target,ctx.currentTime,.18);
  }
  function scheduleMusicNote(ctx,midi,time,duration,wave,volume,cutoff=2200,detune=0){
    if(!musicBus)return;
    const osc=ctx.createOscillator(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    osc.type=wave;osc.frequency.setValueAtTime(440*Math.pow(2,(midi-69)/12),time);osc.detune.setValueAtTime(detune,time);
    filter.type='lowpass';filter.frequency.setValueAtTime(cutoff,time);filter.Q.setValueAtTime(.55,time);
    gain.gain.setValueAtTime(.0001,time);gain.gain.linearRampToValueAtTime(Math.max(.0002,volume),time+.035);gain.gain.setTargetAtTime(Math.max(.0001,volume*.56),time+.05,.22);gain.gain.setTargetAtTime(.0001,time+duration*.7,.22);
    osc.connect(filter);filter.connect(gain);gain.connect(musicBus);osc.start(time);osc.stop(time+duration+.12);
  }
  function scheduleMusicKick(ctx,time,soft=false){
    if(!musicBus)return;const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(soft?100:145,time);osc.frequency.exponentialRampToValueAtTime(soft?48:52,time+.13);gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(soft?.055:.095,time+.008);gain.gain.exponentialRampToValueAtTime(.0001,time+.18);osc.connect(gain);gain.connect(musicBus);osc.start(time);osc.stop(time+.2);
  }
  function scheduleMusicClick(ctx,time,level=.025){
    if(!musicBus)return;const osc=ctx.createOscillator(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();osc.type='triangle';osc.frequency.setValueAtTime(1700,time);filter.type='highpass';filter.frequency.setValueAtTime(1100,time);gain.gain.setValueAtTime(level,time);gain.gain.exponentialRampToValueAtTime(.0001,time+.045);osc.connect(filter);filter.connect(gain);gain.connect(musicBus);osc.start(time);osc.stop(time+.06);
  }
  function scheduleMusicStep(ctx,generation){
    if(generation!==musicGeneration||db.musicEnabled===false||db.sound===false)return;
    const track=currentMusicTrack(),profile=MUSIC_STYLES[track.style],step=musicStep%16,bar=Math.floor(step/4),beat=step%4;
    const start=ctx.currentTime+.055;
    const melody=MUSIC_MELODIES[(track.n+({ambient:0,electronic:1,stadium:2,lofi:3,rock:4}[track.style]))%5];
    const base=track.style==='ambient'?60:track.style==='lofi'?60:track.style==='stadium'?58:track.style==='rock'?55:57;
    const chord=profile.chords[(bar+track.n)%profile.chords.length];
    if(beat===0){
      chord.forEach((interval,i)=>scheduleMusicNote(ctx,base+12+interval,start,1.72,profile.pad,track.style==='ambient'?.018:track.style==='lofi'?.014:.012,profile.cutoff,(i-1)*5));
      scheduleMusicNote(ctx,base-12+chord[0],start,1.1,profile.wave,track.style==='rock'?.045:.032,profile.cutoff-250,0);
      if(profile.drums==='electronic'||profile.drums==='stadium'||profile.drums==='rock')scheduleMusicKick(ctx,start,profile.drums==='stadium');
    }
    if((beat===2)&&profile.drums==='rock')scheduleMusicClick(ctx,start,.035);
    if(profile.drums==='stadium'&&beat===2)scheduleMusicKick(ctx,start,true);
    if(profile.drums==='electronic'&&beat===2)scheduleMusicClick(ctx,start,.016);
    if(profile.drums==='rock'&&beat===2)scheduleMusicClick(ctx,start,.045);
    const stepNote=melody[step];
    if(stepNote!==null&&stepNote!==undefined){
      const scale=profile.scale;const degree=(stepNote+track.n*2+bar)%scale.length;const octave=(stepNote>5?1:0);
      const midi=base+12+scale[degree]+octave*12;
      scheduleMusicNote(ctx,midi,start,.48,profile.wave,track.style==='rock'?.035:track.style==='stadium'?.023:.019,profile.cutoff,track.style==='rock'?7:0);
      if(track.style==='electronic'&&beat%2===0)scheduleMusicNote(ctx,midi-12,start,.24,'triangle',.026,900,0);
    }
    musicStep=(musicStep+1)%16;
    const delay=60000/profile.bpm;
    musicLoopTimer=setTimeout(()=>scheduleMusicStep(ctx,generation),delay);
  }
  function stopBackgroundMusic(){
    musicGeneration++;if(musicLoopTimer){clearTimeout(musicLoopTimer);musicLoopTimer=null;}
    musicStep=0;if(musicBus&&packAudioContext){try{musicBus.gain.cancelScheduledValues(packAudioContext.currentTime);musicBus.gain.setTargetAtTime(0,packAudioContext.currentTime,.12);}catch(_){}}
  }
  function startBackgroundMusic(){
    if(db.sound===false||db.musicEnabled===false){stopBackgroundMusic();return false;}
    const ctx=ensureAudioContext();if(!ctx)return false;
    if(musicLoopTimer){clearTimeout(musicLoopTimer);musicLoopTimer=null;}
    musicGeneration++;musicStep=0;const generation=musicGeneration;setMusicVolume();scheduleMusicStep(ctx,generation);return true;
  }
  function unlockAndStartMusic(){
    musicUnlocked=true;const ctx=ensureAudioContext();if(ctx&&db.musicEnabled!==false&&db.sound!==false&&!musicLoopTimer)startBackgroundMusic();
  }
  function renderMusicTrackOptions(style){
    const names=MUSIC_TRACKS[style]||MUSIC_TRACKS.ambient;
    return names.map((name,i)=>`<option value="${i}" ${Number(db.musicTrack)===i?'selected':''}>${i+1}. ${name}</option>`).join('');
  }

  function getPackAudioContext(){
    if(db.sound===false)return null;
    const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)return null;
    try{if(!packAudioContext)packAudioContext=new AudioCtx();if(packAudioContext.state==='suspended')packAudioContext.resume();return packAudioContext;}catch(_){return null;}
  }
  function playUiTone(frequency=520,duration=.09,volume=.035,wave='sine',delay=0){
    if(db.sound===false)return;const ctx=getPackAudioContext();if(!ctx)return;
    try{const start=ctx.currentTime+delay,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=wave;osc.frequency.setValueAtTime(frequency,start);gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),start+.012);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);osc.connect(gain);gain.connect(ctx.destination);osc.start(start);osc.stop(start+duration+.025);}catch(_){}
  }
  function playPackSoundSequence(players=[]){
    if(!db.sound||db.packSound===false)return;const ctx=getPackAudioContext();if(!ctx)return;
    const speed=db.packAnimationSpeed==='fast'?.62:db.packAnimationSpeed==='cinematic'?1.22:1;
    // A short original synthesized sequence: rising electronic charge, impact, then rarity chimes.
    playUiTone(110,.48,.045,'sawtooth',0);playUiTone(220,.5,.026,'triangle',.08);playUiTone(330,.42,.02,'sine',.24);
    playUiTone(660,.16,.035,'triangle',.72*speed);playUiTone(990,.24,.026,'sine',.82*speed);playUiTone(1320,.32,.022,'sine',.96*speed);
    players.forEach((p,i)=>{const rating=Number(p.rating)||50;const base=rating>=90?1046:rating>=85?880:rating>=75?740:rating>=65?587:440;playUiTone(base,.18,rating>=90?.05:.026,'sine',(1.28+i*.34)*speed);if(rating>=90)playUiTone(base*1.5,.24,.025,'triangle',(1.42+i*.34)*speed);});
  }
  function vibrate(pattern=18){if(db.vibration!==false&&navigator.vibrate){try{navigator.vibrate(pattern);}catch(_){}}}
  function getCrestLayers(mode){if(mode==='edit'){const club=currentClub();if(!club)return [];if(!Array.isArray(club.logo.layers)||!club.logo.layers.length)club.logo.layers=[{id:'base',kind:'symbol',value:club.logo.symbol||'★',x:50,y:48,size:34,color:'#10140c'}];return club.logo.layers;}return createDraft.layers;}
  function refreshCrestBuilder(mode='create'){
    const layers=getCrestLayers(mode)||[],preview=$(mode==='edit'?'#editCrest':'#createCrest'),list=$(mode==='edit'?'#editLogoLayerList':'#createLogoLayerList');
    if(preview)preview.innerHTML=layers.map(l=>crestLayerMarkup(l)).join('');
    if(list)list.innerHTML=renderCrestLayerRows(layers,mode);
    if(mode==='edit'){const small=$('#editorPreviewCrest');if(small)small.innerHTML=layers.map(l=>crestLayerMarkup(l,.55)).join('');}
  }
  function updateCrestShape(mode,shape){const ids=mode==='edit'?['#editCrest','#editorPreviewCrest']:['#createCrest'];const known=['shield','round','square','diamond','classic','hexagon','rounded','banner','circle-crest'];ids.forEach(sel=>{const el=$(sel);if(!el)return;el.classList.remove(...known.map(x=>'shape-'+x));el.classList.add('shape-'+shape);});}

  let logoDrag=null;
  $('#app').addEventListener('pointerdown',e=>{if(e.button!==0)return;const layer=e.target.closest('.crest-layer');if(!layer)return;const preview=layer.closest('#createCrest,#editCrest');if(!preview)return;const mode=preview.id==='editCrest'?'edit':'create';const item=(getCrestLayers(mode)||[]).find(x=>x.id===layer.dataset.layerId);if(!item)return;logoDrag={id:item.id,preview,mode};layer.setPointerCapture?.(e.pointerId);e.preventDefault();});
  $('#app').addEventListener('pointermove',e=>{if(!logoDrag)return;const r=logoDrag.preview.getBoundingClientRect();const item=(getCrestLayers(logoDrag.mode)||[]).find(x=>x.id===logoDrag.id);if(!item)return;item.x=Math.max(5,Math.min(95,(e.clientX-r.left)/r.width*100));item.y=Math.max(5,Math.min(95,(e.clientY-r.top)/r.height*100));const el=logoDrag.preview.querySelector(`[data-layer-id="${logoDrag.id}"]`);if(el){el.style.left=item.x+'%';el.style.top=item.y+'%';}if(logoDrag.mode==='edit'){const small=$(`#editorPreviewCrest [data-layer-id="${logoDrag.id}"]`);if(small){small.style.left=item.x+'%';small.style.top=item.y+'%';}}});
  $('#app').addEventListener('pointerup',()=>{logoDrag=null;});
  // Disable context menus inside the game. Buttons and form controls remain usable.
  $('#app').addEventListener('contextmenu',e=>e.preventDefault());
  // ----- Event binding (delegated so it continues to work after re-rendering) -----
  $('#app').addEventListener('click',async e=>{
    const btn=e.target.closest('[data-action]');if(!btn)return;
    const action=btn.dataset.action; if(['match-choice','open-pack','assign-player','quick-assign','set-theme'].includes(action))vibrate(action==='match-choice'?[25,20,35]:18);
    if(action==='create-club-submit'){const form=$('#createClubForm');if(!form)return;if(!form.reportValidity())return;try{await createClubFromForm(form);}catch(err){console.error('Club creation failed before save:',err);toast(err?.message||'Клуб не сохранён. Проверь данные и доступное место в браузере.','error');}return;}
    if(action==='start-create'){startMode='create';createDraft={symbol:'★',logoColor:'#c8ff44',shape:'shield',layers:[{id:'base',kind:'symbol',value:'★',x:50,y:48,size:34,color:'#10140c'}]};render();return;}
    if(action==='start-back'){startMode='choose';render();return;}
    if(action==='select-club'){const c=db.clubs.find(x=>x.id===btn.dataset.clubId);if(!c)return;loginClubId=c.id;render();$('#clubLoginInput')?.focus();return;}
    if(action==='cancel-club-login'){loginClubId=null;render();return;}
    if(action==='switch-account-settings'){clearMatchTimers();db.activeClubId=null;view='home';startMode='choose';matchState={stage:'idle'};saveDB();render();return;}
    if(action==='set-theme'){db.theme=btn.dataset.theme||'classic';themePanelOpen=true;saveDB();render();toast('Тема оформления изменена.');return;}
    if(action==='toggle-theme-panel'){themePanelOpen=!themePanelOpen;render();return;}
    if(action==='toggle-contracts-panel'){contractsPanelOpen=!contractsPanelOpen;render();return;}
    if(action==='delete-current-club'){const c=currentClub();if(!c)return;clearMatchTimers();if(!confirm(`Удалить клуб «${c.name}» вместе со всем составом и историей?`))return;db.clubs=db.clubs.filter(x=>x.id!==c.id);db.activeClubId=null;view='home';startMode='choose';matchState={stage:'idle'};saveDB();render();toast('Клуб удалён.');return;}
    if(action==='logout-account'){clearMatchTimers();db.activeClubId=null;view='home';startMode='choose';matchState={stage:'idle'};saveDB();render();return;}
    if(action==='delete-club'){clearMatchTimers();const id=btn.dataset.clubId;const c=db.clubs.find(x=>x.id===id);if(!c)return;if(!confirm(`Удалить клуб «${c.name}» вместе с составом и историей?`))return;db.clubs=db.clubs.filter(x=>x.id!==id);if(db.activeClubId===id)db.activeClubId=null;saveDB();startMode='choose';view='home';render();toast('Клуб удалён.');return;}
    if(action==='nav'){go(btn.dataset.view);return;}
    if(action==='sell-player'){const c=currentClub();const p=c?.players.find(x=>x.id===btn.dataset.playerId);if(!p)return;if(c.lineup.includes(p.id)){toast('Игроки стартового состава не продаются. Сначала замени его.','error');return;}if(!confirm(`Продать ${p.name} за ${formatMoney(saleValue(p,false)*1.35)}?`))return;const base=saleValue(p,false)*1.35;const price=Math.round((base*.8+Math.random()*(base*1.35-base*.8))*100)/100;c.players=c.players.filter(x=>x.id!==p.id);c.coins+=price;playerModalRef=null;saveDB();render();toast(`${p.name} продан за ${formatMoney(price)}.`);return;}
    if(action==='music-preview'){if(db.sound===false){toast('Сначала включи общий звук в настройках.','error');return;}db.musicEnabled=true;saveDB();startBackgroundMusic();render();toast('Фоновая музыка включена.');return;}
    if(action==='music-stop'){stopBackgroundMusic();db.musicEnabled=false;saveDB();render();toast('Фоновая музыка остановлена.');return;}
    if(action==='sign-sponsor'){const c=currentClub();const deal=SPONSOR_DEALS.find(x=>x.id===btn.dataset.sponsor);if(!deal)return;if(teamRating(c)<(deal.minRating||0)||(c.stats.wins||0)<(deal.minWins||0)){toast(`Требования спонсора: ${deal.req||'не выполнены'}.`,'error');return;}c.sponsorSlots=c.sponsorSlots||{kit:null,title:null,extra:null};const type=btn.dataset.sponsorType||deal.type;if(c.sponsorSlots[type]&&c.sponsorSlots[type].until>Date.now()){toast('Это рекламное место уже занято.','error');return;}if(c.coins<deal.sign/1000){toast('Недостаточно монет для подписания.','error');return;}c.coins-=deal.sign/1000;c.sponsorSlots[type]={id:deal.id,type,until:Date.now()+30*86400000,matchBonus:deal.match,winBonus:deal.win};saveDB();render();toast(`${deal.name}: контракт подписан на 30 дней.`);return;}
    if(action==='claim-sponsor'){const c=currentClub();const id=btn.dataset.sponsor;const goals={local:3,sports:2,energy:5,bank:8,kit:4,phone:6,car:5,food:5,tech:7,water:4,travel:10,insurance:6,game:3,media:5,global:6};const wins=['sports','water','global'].includes(id);const progress=id==='car'?c.stats.goalsFor:id==='game'?c.stats.packsOpened:wins?c.stats.wins:c.stats.matches;c.sponsorClaims=c.sponsorClaims||{};if(progress<(goals[id]||999)||c.sponsorClaims[id])return;const reward={local:220,sports:300,energy:450,bank:650,kit:360,phone:480,car:330,food:400,tech:560,water:350,travel:800,insurance:520,game:310,media:430,global:1000}[id]||200;c.coins+=reward/1000;c.sponsorClaims[id]=true;saveDB();render();toast(`Спонсор выплатил ${formatMoney(reward/1000)}.`);return;}
    if(action==='refill-energy'||action==='watch-ad'){const c=currentClub();refreshEnergy(c);if(c.energy>=5){toast('Энергия уже полная.');return;}if(action==='refill-energy'){if(c.coins<0.12){toast('Недостаточно монет.','error');return;}c.coins-=0.12;}c.energy=Math.min(5,c.energy+3);c.energyAt=Date.now();saveDB();render();toast('Энергия восстановлена на 3.');return;}
    if(action==='switch-club'){clearMatchTimers();db.activeClubId=null;view='home';matchState={stage:'idle'};editSlotIndex=null;reveal=null;saveDB();startMode='choose';render();return;}
    if(action==='edit-create-symbol'){createDraft.symbol=btn.dataset.symbol;return;}
    if(action==='crest-add-symbol'||action==='crest-add-emoji'||action==='crest-add-text'){
      const mode=btn.dataset.mode||'create',layers=getCrestLayers(mode);let value='',kind='symbol';
      if(action==='crest-add-symbol'){value=sanitizeCrestText(btn.dataset.symbol);kind='symbol';}
      else if(action==='crest-add-emoji'){value=String(btn.dataset.emoji||'');kind='emoji';if(!SAFE_CREST_EMOJIS.has(value))return;}
      else{value=sanitizeCrestText((mode==='edit'?$('#editLogoText'):$('#createLogoText'))?.value||'');kind='text';}
      if(!value)return;layers.push({id:'layer-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),kind,value,x:50,y:50,size:kind==='text'?18:26,color:'#10140c'});refreshCrestBuilder(mode);return;
    }
    if(action.startsWith('crest-layer-')){
      const mode=btn.dataset.mode||'create',layers=getCrestLayers(mode),layer=layers.find(x=>x.id===btn.dataset.layerId);if(!layer)return;
      if(action==='crest-layer-size-up'||action==='crest-layer-size-down'){layer.size=clamp((Number(layer.size)||18)+(action==='crest-layer-size-up'?4:-4),10,72);}
      else if(action==='crest-layer-delete'){if(layers.length<=1){toast('На эмблеме должен остаться хотя бы один элемент.','error');return;}const index=layers.indexOf(layer);layers.splice(index,1);}
      else if(action==='crest-layer-up'||action==='crest-layer-down'){const i=layers.indexOf(layer),j=action==='crest-layer-up'?Math.max(0,i-1):Math.min(layers.length-1,i+1);[layers[i],layers[j]]=[layers[j],layers[i]];}
      refreshCrestBuilder(mode);return;
    }
    if(action==='edit-logo-symbol'){const input=$('#editLogoSymbol');if(input)input.value=btn.dataset.symbol;$$('[data-action="edit-logo-symbol"]').forEach(x=>x.classList.toggle('active',x===btn));const crest=$('#editCrest');if(crest)crest.innerHTML=`<span class="crest-layer" style="left:50%;top:50%;font-size:34px;color:#10140c">${crestSymbolSvg(btn.dataset.symbol)||esc(btn.dataset.symbol)}</span>`;const preview=$('#editorPreviewCrest');if(preview)preview.innerHTML=crest.innerHTML;return;}
    if(action==='set-captain'){const c=currentClub();const candidate=c?.players.find(p=>p.id===btn.dataset.playerId);if(!candidate){toast('Игрок для назначения капитаном не найден.','error');return;}c.captainId=candidate.id;saveDB();render();toast(`Капитан назначен: ${playerDisplayName(candidate)} · +1 OVR.`);return;}if(action==='edit-slot'){editSlotIndex=Number(btn.dataset.slot);render();return;}
    if(action==='close-modal'){editSlotIndex=null;render();return;}
    if(action==='close-modal-backdrop'&&e.target===btn){editSlotIndex=null;render();return;}
    if(action==='assign-player'){assignPlayer(Number(btn.dataset.slot),btn.dataset.playerId);return;}
    if(action==='quick-assign'){const club=currentClub();const playerId=btn.dataset.playerId;const candidate=club.players.find(p=>p.id===playerId);if(playerIsUnavailable(candidate)){toast(`Игрок недоступен: ${unavailableReason(candidate)}.`,'error');return;}const idx=club.lineup.indexOf(playerId);if(idx>=0){editSlotIndex=idx;}else{const formation=FORMATIONS[club.formation]||FORMATIONS['4-3-3'];const emptySlot=club.lineup.findIndex(id=>!id);const weaker=club.lineup.map((id,i)=>({p:club.players.find(x=>x.id===id),i,role:formation[i]?.role})).filter(x=>x.p).sort((a,b)=>playerOVRAt(a.p,a.role,club)-playerOVRAt(b.p,b.role,club))[0];editSlotIndex=emptySlot>=0?emptySlot:(weaker?weaker.i:0);}render();return;}
    if(action==='auto-lineup'){autoLineup();return;}
    if(action==='set-style'){const c=currentClub();c.style=btn.dataset.style;saveDB();render();toast(`Игровой стиль: ${STYLES[c.style].name}`);return;}
    if(action==='forced-sub-skip'){const c=currentClub(),out=btn.dataset.out;if(!c||!matchState.pendingForcedSub)return;const outIndex=c.lineup.indexOf(out);if(outIndex>=0)c.lineup[outIndex]=null;matchState.pendingForcedSub=null;matchState.pendingForcedSlot=null;matchState.pendingForcedType=null;saveDB();if(matchState.eventIndex>=10){finishMatch();return;}render();toast('Команда продолжает матч в меньшинстве.','error');return;}
    if(action==='open-pack'){openPack(btn.dataset.pack);return;}if(action==='forced-sub'||action==='forced-sub-pick'){const c=currentClub(),out=btn.dataset.out,inn=action==='forced-sub-pick'?btn.dataset.playerId:$('#forcedSubPlayer')?.value;if(!inn){toast('Выбери игрока для обязательной замены.','error');return;}const idx=c.lineup.indexOf(out);if(idx>=0){if(c.lineup.includes(inn))return;c.lineup[idx]=inn;}else{toast('Игрок уже покинул поле после автоматической замены.','error');return;}matchState.pendingForcedSub=null;matchState.pendingForcedSlot=null;matchState.pendingForcedType=null;saveDB();if(matchState.eventIndex>=10){finishMatch();return;}render();toast('Обязательная замена выполнена.');return;}
    if(action==='collection-mode'){collectionMode=btn.dataset.mode;$$('[data-action="collection-mode"]').forEach(b=>b.className='btn '+(b.dataset.mode===collectionMode?'btn-primary':'btn-secondary')+' btn-sm');applyCollectionFilters();return;}
    if(action==='skip-pack-animation'){if(!reveal)return;reveal.skipAnimation=true;render();return;}
    if(action==='replay-pack-animation'){if(!reveal||db.packAnimations===false)return;reveal.skipAnimation=false;reveal.animationSerial=++packAnimationSerial;render();if(db.packVibration!==false)vibrate([22,28,44,35,75]);playPackSoundSequence(reveal.players||[]);return;}
    if(action==='close-opening'){if(reveal?.duplicateRewards?.length){toast('Сначала реши судьбу каждой повторной карточки.','error');return;}reveal=null;view='packs';render();toast('Новые футболисты в коллекции.');return;}
    if(action==='duplicate-money'||action==='duplicate-contract'){if(!reveal)return;reveal.skipAnimation=true;const p=reveal.duplicateRewards?.find(x=>x.id===btn.dataset.playerId);if(!p)return;const c=currentClub();if(action==='duplicate-money'){const amount=saleValue(p,true);c.coins+=amount;}else{const owned=c.players.find(x=>x.id===p.duplicateOf);if(!owned){toast('Оригинальная карточка не найдена.','error');return;}owned.contractUntil=Math.max(Date.now(),owned.contractUntil||Date.now())+5*86400000;}reveal.duplicateRewards=reveal.duplicateRewards.filter(x=>x.id!==p.id);reveal.players=reveal.players.filter(x=>x.id!==p.id);saveDB();render();toast(action==='duplicate-money'?'Повторка обменена на монеты.':'Контракт продлён на 5 дней.');return;}
    if(action==='set-pattern'){setPattern(btn.dataset.pattern);return;}
    if(action==='match-search'){startSearch();return;}
    if(action==='cancel-search'){clearMatchTimers();matchState={stage:'idle'};render();return;}
    if(action==='start-match'){beginMatch();return;}
    if(action==='manual-sub'){const c=currentClub(),out=btn.dataset.out,sel=btn.parentElement.querySelector('select'),inn=sel?.value;if(!inn){toast('Выбери игрока на замену.','error');return;}const incoming=c.players.find(p=>p.id===inn);if(playerIsUnavailable(incoming)){toast(`Игрок недоступен: ${unavailableReason(incoming)}.`,'error');return;}const i=c.lineup.indexOf(out);if(i<0||c.lineup.includes(inn))return;c.lineup[i]=inn;saveDB();render();toast('Замена выполнена.');return;}if(action==='match-choice'){resolveChoice(btn.dataset.choice);return;}
    if(action==='match-again'){clearMatchTimers();matchState={stage:'idle'};startSearch();return;}
  });
  $('#app').addEventListener('submit',async e=>{
    if(e.target.id==='clubLoginForm'){
      e.preventDefault();const form=e.target;if(form.dataset.submitting==='1')return;form.dataset.submitting='1';
      const button=form.querySelector('button[type="submit"]');if(button){button.disabled=true;button.textContent='Проверяем…';}
      const club=db.clubs.find(c=>c.id===loginClubId);if(!club){loginClubId=null;render();return;}
      const authKey=String(club.id),authState=AUTH_FAILURES.get(authKey)||{count:0,until:0};
      if(authState.until>Date.now()){toast(`Слишком много попыток. Повтори через ${Math.ceil((authState.until-Date.now())/1000)} сек.`,'error');form.dataset.submitting='0';if(button)button.disabled=false;return;}
      const fd=new FormData(form),login=String(fd.get('clubLogin')||'').trim(),password=String(fd.get('clubPassword')||'');
      try{
        const valid=login.toLowerCase()===String(club.login||'').toLowerCase()&&await verifyClubPassword(club,password);
        if(!valid){authState.count++;if(authState.count>=AUTH_MAX_FAILURES){authState.count=0;authState.until=Date.now()+AUTH_LOCK_MS;}AUTH_FAILURES.set(authKey,authState);toast('Неверный логин или пароль.','error');form.dataset.submitting='0';if(button)button.disabled=false;return;}
        AUTH_FAILURES.delete(authKey);loginClubId=null;saveDB();chooseClub(club.id);
      }catch(err){console.error('Password verification failed:',err);toast(err?.message||'Не удалось проверить пароль в этом браузере.','error');form.dataset.submitting='0';if(button)button.disabled=false;}
      return;
    }
    if(e.target.id==='createClubForm'){e.preventDefault();try{await createClubFromForm(e.target);}catch(err){console.error(err);toast(err?.message||'Не удалось создать клуб.','error');}}
    if(e.target.id==='editClubForm'){
      e.preventDefault();const club=currentClub();if(!club)return;const fd=new FormData(e.target);const name=String(fd.get('clubName')||'').trim();
      if(name.length<2){toast('Название должно содержать минимум 2 символа.','error');return;}
      if(accountClubs().some(c=>c.id!==club.id&&c.name.toLowerCase()===name.toLowerCase())){toast('Такое название уже занято другим твоим клубом.','error');return;}
      club.name=name;club.country=String(fd.get('country')||club.country);club.logo.layers=Array.isArray(club.logo.layers)?club.logo.layers:[];club.logo.symbol=sanitizeCrestText(club.logo.layers.find(layer=>layer.kind==='symbol')?.value||club.logo.symbol||'★');club.logo.color=String($('#editLogoColor')?.value||club.logo.color);club.logo.shape=String($('#editLogoShape')?.value||club.logo.shape||'shield');club.kit.primary=String(fd.get('kitPrimary')||club.kit.primary);club.kit.secondary=String(fd.get('kitSecondary')||club.kit.secondary);club.kit.pattern=String(fd.get('kitPattern')||club.kit.pattern);saveDB();render();toast('Изменения клуба сохранены.');
    }
  });
  $('#app').addEventListener('change',e=>{
    const t=e.target;
    if(t.dataset.setting==='musicEnabled'){db.musicEnabled=t.checked;saveDB();if(t.checked&&db.sound!==false){startBackgroundMusic();}else{stopBackgroundMusic();}toast(t.checked?'Фоновая музыка включена.':'Фоновая музыка выключена.');return;}
    if(t.dataset.setting==='musicStyle'){db.musicStyle=Object.hasOwn(MUSIC_STYLES,t.value)?t.value:'ambient';db.musicTrack=0;saveDB();render();if(musicUnlocked&&db.musicEnabled!==false&&db.sound!==false)startBackgroundMusic();return;}
    if(t.dataset.setting==='musicTrack'){db.musicTrack=clamp(Number(t.value)||0,0,4);saveDB();if(musicUnlocked&&db.musicEnabled!==false&&db.sound!==false)startBackgroundMusic();return;}
    if(t.dataset.setting==='musicVolume'){db.musicVolume=clamp(Number(t.value)||0,0,100);saveDB();const label=$('#musicVolumeValue');if(label)label.textContent=`${db.musicVolume}%`;setMusicVolume();return;}
    if(t.dataset.setting==='vibration'){db.vibration=t.checked;saveDB();toast(t.checked?'Вибрация включена.':'Вибрация отключена.');return;}if(t.dataset.setting==='sound'){db.sound=t.checked;saveDB();if(t.checked){playUiTone(660,.08,.035);if(db.musicEnabled!==false&&musicUnlocked)startBackgroundMusic();}else{stopBackgroundMusic();}return;}if(t.dataset.setting==='packAnimations'){db.packAnimations=t.checked;saveDB();render();toast(t.checked?'Анимация паков включена.':'Паки будут открываться без анимации.');return;}if(t.dataset.setting==='packAnimationSpeed'){db.packAnimationSpeed=['cinematic','normal','fast'].includes(t.value)?t.value:'normal';saveDB();toast('Скорость открытия паков сохранена.');return;}if(t.dataset.setting==='packSound'){db.packSound=t.checked;saveDB();toast(t.checked?'Звук открытия паков включён.':'Звук открытия паков отключён.');return;}if(t.dataset.setting==='packVibration'){db.packVibration=t.checked;saveDB();toast(t.checked?'Виброотклик паков включён.':'Виброотклик паков отключён.');return;}if(['collectionPosition','collectionRarity','collectionSort'].includes(t.id))applyCollectionFilters();
    if(t.dataset.setting==='formation'){const club=currentClub();if(club){club.formation=t.value;saveDB();render();}}
    if(t.dataset.setting==='captain'){const club=currentClub();const player=club?.players.find(p=>p.id===t.value);if(club&&player){club.captainId=player.id;saveDB();render();toast(`Капитан назначен: ${playerDisplayName(player)}.`);}}
    if(t.dataset.setting==='language'&&db.language!==t.value)setInterfaceLanguage(t.value);
    if(t.id==='createLogoShape'){createDraft.shape=t.value;updateCrestShape('create',t.value);}if(t.id==='editLogoShape'){const c=currentClub();if(c){c.logo.shape=t.value;updateCrestShape('edit',t.value);}}
    if(t.id==='newCountry'){const c=countryData(t.value);const bonus=$('#starterBonus');if(bonus)bonus.textContent=`${c.flag} Стартовый пак: 16 игроков · Бонус страны: ${c.bonus}`;}
    if(t.id==='editCountry'){const c=countryData(t.value);const bonus=$('#editCountryBonus');if(bonus)bonus.textContent=`Бонус страны: ${c.bonus}`;const cn=$('#editorPreviewCountry');if(cn)cn.textContent=`${c.name} · ${teamRating(currentClub())} OVR`;const name=$('#editClubName')?.value||currentClub()?.name||'';const n=$('#editorPreviewName');if(n)n.textContent=`${c.flag} ${name}`;}
  });
  $('#app').addEventListener('input',e=>{
    const t=e.target;if(t.id==='collectionSearch')applyCollectionFilters();if(t.dataset.setting==='musicVolume'){db.musicVolume=clamp(Number(t.value)||0,0,100);const label=$('#musicVolumeValue');if(label)label.textContent=`${db.musicVolume}%`;setMusicVolume();}const club=currentClub();
    if(t.dataset.preview==='create-color'){createDraft.logoColor=t.value;const crest=$('#createCrest');if(crest)crest.style.setProperty('--crest-color',t.value);}
    if(t.dataset.crestLayerColor){const mode=t.dataset.mode||'create',layer=(getCrestLayers(mode)||[]).find(x=>x.id===t.dataset.layerId);if(layer){layer.color=t.value;const selector=mode==='edit'?'#editCrest':'#createCrest';const item=$(`${selector} [data-layer-id="${CSS.escape(layer.id)}"]`);if(item)item.style.color=t.value;if(mode==='edit'){const small=$(`#editorPreviewCrest [data-layer-id="${CSS.escape(layer.id)}"]`);if(small)small.style.color=t.value;}}}
    if(!club)return;
    if(t.dataset.preview==='edit-logo-color'){
      club.logo.color=t.value;const cr=$('#editCrest');if(cr)cr.style.setProperty('--crest-color',t.value);const pv=$('#editorPreviewCrest');if(pv)pv.style.setProperty('--crest-color',t.value);const h=$('#editLogoColorHidden');if(h)h.value=t.value;
    }
    if(t.dataset.preview==='kit-primary'){const shirt=$('#kitShirt');if(shirt)shirt.style.setProperty('--kit-primary',t.value);}
    if(t.dataset.preview==='kit-secondary'){const shirt=$('#kitShirt');if(shirt)shirt.style.setProperty('--kit-secondary',t.value);}
    if(t.id==='editClubName'){const pv=$('#editorPreviewName');if(pv)pv.textContent=`${countryData($('#editCountry')?.value||club.country).flag} ${t.value}`;}
  });

  document.addEventListener('pointerdown',()=>{unlockAndStartMusic();},{once:true,passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopBackgroundMusic();else if(musicUnlocked&&db.sound!==false&&db.musicEnabled!==false)startBackgroundMusic();});
  window.addEventListener('pagehide',stopBackgroundMusic);

  // Provide small, helpful keyboard affordances for choice-based match episodes.
  document.addEventListener('keydown',e=>{
    if(matchState.stage==='live'&&!e.altKey&&!e.ctrlKey&&!e.metaKey){const i=Number(e.key);if(i>=1&&i<=4){const choices=$$('.match-choice');if(choices[i-1])choices[i-1].click();}}
    if(e.key==='Escape'&&editSlotIndex!==null){editSlotIndex=null;render();}
  });

  // If the stored data came from a partial or older save, keep the first screen usable.
  for(const club of db.clubs){
    if(!club.logo)club.logo={symbol:'⚡',color:'#c8ff44'};
    if(!club.kit)club.kit={primary:'#c8ff44',secondary:'#172318',pattern:'plain'};
    if(!club.stats)club.stats={matches:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,packsOpened:0};
    if(!club.trophyUnlocks)club.trophyUnlocks={};delete club.trophyUnlocks.rich_1000;delete club.trophyUnlocks.rich_5000;
    if(!club.history)club.history=[];
    if(!club.style)club.style='balanced';
    if(!STYLES[club.style])club.style='balanced';
    if(!club.formation)club.formation='4-3-3';
    if(!Array.isArray(club.players))club.players=[];
    club.players.forEach(p=>{
      p.yellowCards=Math.max(0,Number(p.yellowCards)||0);p.yellowCardTotal=Math.max(p.yellowCards,Number(p.yellowCardTotal)||0);p.yellowBanMatches=Math.max(0,Number(p.yellowBanMatches)||0);
      if(p.realPlayer&&p.wiki){const canonical=REAL_PLAYERS.find(x=>x.wiki===p.wiki);if(canonical){p.rating=canonical.rating;p.country=canonical.country;p.realClub=canonical.club;p.position=canonical.position;p.positions=REAL_PLAYER_POSITIONS[p.wiki]||[canonical.position];}}
    });
  }
  document.documentElement.lang=db.language||'ru';
  saveDB();
  try { render(); }
  catch(error) {
    console.error('Zero Football startup error:', error);
    const app = document.querySelector('#app');
    if (app) app.innerHTML = `<div style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#101410;color:#f3f5ef;font-family:system-ui,sans-serif"><div style="max-width:560px;background:#191e19;border:1px solid #394238;border-radius:18px;padding:26px"><h1 style="color:#c8ff44;margin-top:0">Zero Football не смогла загрузиться</h1><p>Сохранение могло быть создано старой версией игры. Попробуй перезагрузить страницу. Если ошибка повторится, отправь разработчику этот текст:</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere;color:#ffaaa5">${String(error && error.message || error).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</pre><button onclick="location.reload()" style="padding:11px 16px;border:0;border-radius:9px;background:#c8ff44;font-weight:800;cursor:pointer">Перезагрузить игру</button></div></div>`;
  }
})();
