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
  let PLAYER_IMAGE_OBSERVER=null;
  function resolvePlayerImages(){
    const cards=$$('.player-card[data-portrait-key],.squad-item[data-portrait-key],.modal-player[data-portrait-key]');
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
    img.onerror=null;img.onload=()=>{img.closest('.player-portrait')?.classList.add('has-photo');};img.src=url;img.style.display='block';
    const card=img.closest('.player-card');card?.querySelector('.portrait-circle')?.classList.add('photo-hidden');
    img.onerror=()=>{img.onerror=null;const fallback=makeFallbackPortrait(key||img.alt||'player');img.onload=()=>{img.closest('.player-portrait')?.classList.add('has-photo');};img.src=fallback;img.style.display='block';};
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
    if(!card.dataset.wiki){const fallback=makeFallbackPortrait(key);showPortrait(img,fallback,key);return;}
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
      $$('.player-card[data-wiki]').forEach(c=>{if(c.dataset.wiki===key)showPortrait(c.querySelector('.portrait-photo'),fallback,key);});
    });
  }

  const SYMBOLS = window.ZF_DATA.SYMBOLS;
  const RARITY = window.ZF_DATA.RARITY;
  const POSITIONS = window.ZF_DATA.POSITIONS;
  const POS_NAMES = window.ZF_DATA.POS_NAMES;
  const FORMATIONS = window.ZF_DATA.FORMATIONS;

  // Дополнительные схемы: все варианты сохраняют 11 позиций и совместимы с текущей расстановкой.
  const EXTRA_FORMATIONS = window.ZF_DATA.EXTRA_FORMATIONS;
  const FORMATION_COORDS = window.ZF_DATA.FORMATION_COORDS;
  Object.entries(EXTRA_FORMATIONS).forEach(([name,roles])=>{
    const counts={}; FORMATIONS[name]=roles.map(role=>{const n=counts[role]||0;counts[role]=n+1;const base=FORMATION_COORDS[role]||[50,50];let x=base[0];if(role==='CB')x=[30,50,70][n]||50;if(role==='CM'||role==='CDM')x=[30,50,70][n]||50;if(role==='CAM')x=[36,64][n]||50;if(role==='ST')x=[38,62][n]||50;if(role==='LM'||role==='LW')x=role==='LM'?18:18;if(role==='RM'||role==='RW')x=role==='RM'?82:82;return {role,x,y:base[1]};});
  });
  const STYLES = window.ZF_DATA.STYLES;
  const BOT_CLUBS = window.ZF_DATA.BOT_CLUBS;
  const BOT_PLAYER_NAMES = window.ZF_DATA.BOT_PLAYER_NAMES;
  const TROPHIES = window.ZF_DATA.TROPHIES;
  let db = loadDB();
  let view = 'home';
  let startMode = 'choose';
  let createDraft = {symbol:'⚡',logoColor:'#c8ff44',shape:'shield',layers:[{id:'base',kind:'symbol',value:'⚡',x:50,y:48,size:34,color:'#10140c'}]};
  let editSlotIndex = null;
  let reveal = null;
  let matchState = {stage:'idle'};
  let toastTimer = null;
  let collectionMode = 'owned';
  let themePanelOpen = false;
  let contractsPanelOpen = false;
  let playerModalRef = null;

  function loadDB(){
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {clubs:[],activeClubId:null,stats:{}};
      if (!Array.isArray(parsed.clubs)) parsed.clubs = [];
      parsed.clubs = parsed.clubs.filter(c => c && typeof c === 'object' && typeof c.id === 'string').map(c => {
        // Migrate older/partially-written saves instead of letting one incomplete club break startup.
        if (!Array.isArray(c.players)) c.players = [];
        if (!Array.isArray(c.lineup)) c.lineup = c.players.slice(0,11).map(p => p && p.id).filter(Boolean);
        if (!c.logo || typeof c.logo !== 'object') c.logo = {symbol:'⚡',color:'#c8ff44'};
        if (!c.kit || typeof c.kit !== 'object') c.kit = {primary:'#c8ff44',secondary:'#172318',pattern:'plain'};
        if (!c.stats || typeof c.stats !== 'object') c.stats = {matches:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,packsOpened:0};
        if (!c.trophyUnlocks || typeof c.trophyUnlocks !== 'object') c.trophyUnlocks = {};
        if (!Array.isArray(c.history)) c.history = [];
        if (!c.style) c.style = 'balanced';
        if (!Number.isFinite(c.energy)) c.energy = 5; c.players?.forEach(p=>{if(p.name==='Луис Суарес'||p.wiki==='Luis_Suárez')p.realClub='Интер Майами';}); c.energy=Math.min(5,Math.max(0,c.energy)); if (!Number.isFinite(c.energyAt)) c.energyAt = Date.now(); if (!Array.isArray(c.sponsors)) c.sponsors = [];
        c.players.forEach(p=>{if(!p.contractUntil)p.contractUntil=Date.now()+30*86400000;if(!Array.isArray(p.positions))p.positions=[p.position];}); c.players.forEach(p=>{const rb=REAL_PLAYERS.find(x=>x.wiki===p.wiki||x.name===p.name);if(rb){p.realClub=rb.club;p.rating=rb.rating;p.position=rb.position;p.positions=REAL_PLAYER_POSITIONS[rb.wiki]||p.positions||[rb.position];}});
        if (!c.formation) c.formation = '4-3-3';
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
        if(!c.sponsorContract)c.sponsorContract=null;if(!c.sponsorSlots)c.sponsorSlots={kit:null,title:null,extra:null};if(c.sponsorContract&&!Object.values(c.sponsorSlots).some(Boolean)){c.sponsorSlots[c.sponsorContract.type||'title']=c.sponsorContract;}if(!c.logo.layers)c.logo.layers=[{id:'base',kind:'symbol',value:c.logo.symbol||'⚡',x:50,y:48,size:34,color:'#10140c'}];if(!c.logo.shape)c.logo.shape='shield';
      });
      // Require credentials again after a page reload; do not persist an authenticated session.
      parsed.activeClubId=null;
      return parsed;
    } catch(e) { return {clubs:[],activeClubId:null,stats:{}}; }
  }
  function saveDB(){
    try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }
    catch(e) { console.warn('Local save unavailable',e); }
  }
  function esc(value){return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function rand(min,max){return Math.floor(Math.random()*(max-min+1))+min;}
  function pick(arr){return arr[Math.floor(Math.random()*arr.length)];}
  function shuffle(arr){const out=[...arr];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
  function accountClubs(){return db.clubs||[];}
  function currentClub(){return db.clubs.find(c=>c.id===db.activeClubId)||null;}
  async function hashPassword(value){const bytes=new TextEncoder().encode(String(value));if(globalThis.crypto?.subtle){const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');}let h=2166136261;for(let round=0;round<12000;round++){for(const b of bytes){h^=(b+round)&255;h=Math.imul(h,16777619)>>>0;}h=Math.imul(h^(round+1),2246822519)>>>0;}return 'fallback-'+h.toString(16);}
  function countryData(code){return COUNTRY[code]||COUNTRY.ua;}
  function displayClubName(c){return `${countryData(c.country).flag} ${c.name}`;}
  function rarityFor(rating){return [...RARITY].reverse().find(r=>rating>=r.min)||RARITY[0];}
  function rarityColor(rating){return rarityFor(rating).color;}
  // Transfermarkt-style estimated market value in millions of euros.
  function marketValue(rating){return Math.pow(200,Math.max(0,(Number(rating||50)-50)/40));}
  function formatMoney(value){const n=Number(value)||0;return `€${n>=100?Math.round(n):n>=10?n.toFixed(1):n.toFixed(2)} млн`; }
  function saleValue(player,duplicate=false){const base=marketValue(player.rating)*0.05;return Math.max(0.01,base*(duplicate?0.5:1));}
  function avatarLetters(name){return String(name||'ZF').split(/[\s-]+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase();}
  function transliterateName(value){const map={'a':'а','b':'б','c':'к','d':'д','e':'е','f':'ф','g':'г','h':'х','i':'и','j':'дж','k':'к','l':'л','m':'м','n':'н','o':'о','p':'п','q':'к','r':'р','s':'с','t':'т','u':'у','v':'в','w':'в','x':'кс','y':'й','z':'з','á':'а','é':'е','í':'и','ó':'о','ú':'у','ñ':'нь','ä':'а','ö':'ё','ü':'ю','ß':'с'};return String(value||'').replace(/[A-Za-záéíóúñäöüß]/g,ch=>{const out=map[ch.toLowerCase()]||ch;return ch===ch.toUpperCase()?out.charAt(0).toUpperCase()+out.slice(1):out;});}
  function createPlayer(position,rating,name,country,extra={}){
    if(!extra.realPlayer && /[A-Za-z]/.test(String(name||''))) name=transliterateName(name);
    const pace=clamp(rating+rand(-11,10)+(position.includes('W')||position==='ST'?4:0),30,99);
    const shooting=clamp(rating+rand(-10,11)+(position==='ST'||position==='CF'?9:0),25,99);
    const passing=clamp(rating+rand(-8,10)+(position==='CM'||position==='CAM'?7:0),25,99);
    const dribbling=clamp(rating+rand(-10,11)+(position.includes('W')||position==='CAM'?8:0),25,99);
    const defense=clamp(rating+rand(-10,10)+(position==='CB'||position==='LB'||position==='RB'||position==='CDM'?8:0),25,99);
    const physical=clamp(rating+rand(-8,10),25,99);
    const goalkeeping=position==='GK'?clamp(rating+rand(0,10),25,99):clamp(18+rand(0,10),10,35);
    return {id:'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),name,position,positions:extra.positions||[position],rating,pace,shooting,passing,dribbling,defense,physical,goalkeeping,country,contractUntil:Date.now()+30*24*60*60*1000,injuryMatches:0,...extra};
  }
  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
  function createStarterSquad(countryCode){
    const positions=['GK','LB','CB','CB','RB','CM','CM','CAM','LW','ST','RW','GK','CB','CM','ST','RW'];
    const ratings=[70,64,67,66,64,68,66,68,67,70,67,61,62,63,62,61];
    const usedNames=shuffle([...countryData(countryCode).names]);
    return positions.map((pos,i)=>createPlayer(pos,ratings[i]+rand(-1,1),usedNames[i%usedNames.length],countryCode));
  }
  function makeClub(name,country,logoSymbol,logoColor,kitPrimary,kitSecondary,pattern){
    const players=createStarterSquad(country);
    const firstEleven=players.slice(0,11).map(p=>p.id);
    const club={
      id:'club-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),name:name.trim(),country,
      logo:{symbol:logoSymbol||'⚡',color:logoColor||'#c8ff44',shape:createDraft.shape||'shield',layers:JSON.parse(JSON.stringify(createDraft.layers||[{id:'base',kind:'symbol',value:logoSymbol||'⚡',x:50,y:48,size:34,color:'#10140c'}]))},
      kit:{primary:kitPrimary||'#c8ff44',secondary:kitSecondary||'#172318',pattern:pattern||'plain'},
      coins:0.5,economyVersion:2,energy:5,energyAt:Date.now(),sponsors:[],players,lineup:firstEleven,formation:'4-3-3',style:'balanced',trophyUnlocks:{},
      stats:{matches:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,packsOpened:0},history:[],createdAt:Date.now(),
      starterPack:{opened:true,country}
    };
    db.clubs.push(club);db.activeClubId=club.id;saveDB();return club;
  }
  function teamRating(club){
    if(!club||!club.lineup?.length)return 0;
    const players=club.lineup.map(id=>club.players.find(p=>p.id===id)).filter(Boolean);
    if(!players.length)return 0;
    return Math.round(players.reduce((sum,p)=>sum+p.rating-(p.injuryMatches>0?5:0)-(p.positionPenalty||0)+(club.captainId===p.id?1:0),0)/players.length);
  }
  function activePlayers(club){return (club?.lineup||[]).map(id=>club.players.find(p=>p.id===id)).filter(Boolean);}
  function unavailableReason(p){
    if(!p)return 'Игрок не найден';
    if((p.injuryMatches||0)>0)return `Травма: ещё ${p.injuryMatches} матч(а)`;
    if((p.redCardMatches||0)>0)return `Красная карточка: пропуск ${p.redCardMatches} матч(а)`;
    if((p.yellowBanMatches||0)>0)return `Перебор жёлтых: пропуск ${p.yellowBanMatches} матч(а)`;
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
  function crestContent(logo,scale=1){const layers=Array.isArray(logo?.layers)&&logo.layers.length?logo.layers:[{value:logo?.symbol||'⚡',x:50,y:50,size:30,color:'#10140c'}];return layers.map(l=>`<span class="crest-layer" style="left:${Number(l.x??50)}%;top:${Number(l.y??50)}%;font-size:${Math.max(9,Number(l.size||24)*scale)}px;color:${esc(l.color||'#10140c')}">${esc(l.value||'')}</span>`).join('');}
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

  function translateUIText(value){const lang=db.language||'ru';if(lang==='ru'||!UI_TRANSLATIONS[lang])return value;const dict=UI_TRANSLATIONS[lang],entries=Object.entries(dict).sort((a,b)=>b[0].length-a[0].length);const trimmed=value.trim();if(dict[trimmed])return value.replace(trimmed,dict[trimmed]);let out=value;for(const [source,target] of entries){if(source.length>=3&&out.includes(source))out=out.split(source).join(target);}return out;}
  function applyLanguage(){if((db.language||'ru')==='ru')return;const walker=document.createTreeWalker($('#app'),NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(n=>{n.nodeValue=translateUIText(n.nodeValue);});$('#app').querySelectorAll('[placeholder],[title],[aria-label]').forEach(el=>{['placeholder','title','aria-label'].forEach(a=>{const value=el.getAttribute(a);if(value)el.setAttribute(a,translateUIText(value));});});}
  function render(){
    const club=currentClub();
    if(!club){$('#app').innerHTML=renderStart();applyLanguage();return;}
    $('#app').innerHTML=renderLayout(club);
    if(reveal)$('#app').insertAdjacentHTML('beforeend',renderReveal());
    if(editSlotIndex!==null)$('#app').insertAdjacentHTML('beforeend',renderAssignModal(club,editSlotIndex));
    if(playerModalRef)$('#app').insertAdjacentHTML('beforeend',renderPlayerModal(club));
    resolvePlayerImages();
    applyLanguage();
  }
  function renderStart(){
    const clubs=accountClubs();
    const clubTiles=clubs.length?`<div class="saved-clubs">${clubs.map(c=>`<div class="saved-club-row"><button class="saved-club" data-action="select-club" data-club-id="${esc(c.id)}"><span class="club-crest ${crestShape(c.logo)}" style="--crest-color:${esc(c.logo.color)}">${crestContent(c.logo,.55)}</span><span class="saved-club-copy"><strong>${esc(countryData(c.country).flag)} ${esc(c.name)}</strong><small>${teamRating(c)} OVR · ${c.stats.matches||0} матчей · ${formatMoney(c.coins)} · ${esc(c.login||'без логина')}</small></span><span class="club-arrow">›</span></button><button class="btn btn-danger btn-sm" data-action="delete-club" data-club-id="${esc(c.id)}" title="Удалить клуб">✕</button></div>`).join('')}</div>`:`<div class="empty-state" style="padding:21px 12px;margin-bottom:14px"><div class="empty-icon">🏟️</div><strong>Клубы ещё не созданы</strong><span class="small">Создай первый клуб и сохрани данные для входа.</span></div>`;
    const chooser=startMode==='create'?renderCreateForm():`${clubTiles}<button class="btn btn-primary btn-full" data-action="start-create">＋ Создать новый клуб</button>`;
    return `<div class="start-screen"><div class="start-wrap"><div class="start-brand"><div class="brand-mark">ZF</div><div class="brand-name">ZERO <span>FOOTBALL</span></div></div><div class="start-layout"><section class="start-hero"><div><div class="eyebrow">YOUR CLUB. YOUR LEGACY.</div><h1>BUILD.<br><span>PLAY.</span><br>CONQUER.</h1></div><div class="hero-bottom"><p>Собери состав мечты, открывай паки и докажи, что именно твой клуб достоин вершины.</p><div class="feature-row"><span>⚽ MATCHDAY</span><span>🎴 PLAYER PACKS</span><span>🏆 YOUR LEGACY</span></div></div><div class="hero-orb"></div></section><section class="start-panel"><div class="eyebrow">ZERO FOOTBALL / CLUB HUB</div><h2>${startMode==='create'?'Создание клуба':'Твои клубы'}</h2><p>${startMode==='create'?'Укажи логин и пароль, настрой эмблему и форму. После создания сразу откроется управление клубом.':'Выбери клуб для входа или создай новый. У каждого клуба отдельный логин и пароль.'}</p>${chooser}<div class="divider"></div><div class="small muted">Всего клубов: ${clubs.length}</div></section></div></div></div>`;
  }
  function renderCrestBuilder(){
    const layers=createDraft.layers||[];
    const layerHtml=layers.map((l,i)=>`<span class="crest-layer" data-layer-id="${esc(l.id)}" style="left:${l.x}%;top:${l.y}%;font-size:${l.size}px;color:${esc(l.color)}">${esc(l.value)}</span>`).join('');
    return `<div class="crest-builder"><div id="createCrest" class="crest-big crest-builder-preview shape-${esc(createDraft.shape||'shield')}" style="--crest-color:${esc(createDraft.logoColor)}">${layerHtml}</div><div class="crest-tools"><div class="field"><label>Форма эмблемы</label><select id="createLogoShape"><option value="shield" ${createDraft.shape==='shield'?'selected':''}>Щит</option><option value="round" ${createDraft.shape==='round'?'selected':''}>Круг</option><option value="square" ${createDraft.shape==='square'?'selected':''}>Квадрат</option><option value="diamond" ${createDraft.shape==='diamond'?'selected':''}>Ромб</option><option value="classic" ${createDraft.shape==='classic'?'selected':''}>Классическая</option></select></div><div class="field"><label>Цвет основы</label><input id="createLogoColor" class="color-input" type="color" value="${esc(createDraft.logoColor)}" data-preview="create-color" /></div><div class="symbol-picks">${SYMBOLS.map(sym=>`<button type="button" class="symbol-pick" data-action="logo-add-symbol" data-symbol="${esc(sym)}">${esc(sym)}</button>`).join('')}</div><div class="field"><label for="createLogoText">Добавить текст</label><div class="field-row"><input id="createLogoText" maxlength="5" placeholder="ZF"/><button type="button" class="btn btn-secondary btn-sm" data-action="logo-add-text">＋ Текст</button></div></div><div class="field"><label>Слои эмблемы</label><div id="logoLayerList" class="logo-layer-list">${layers.map((l,i)=>`<div class="logo-layer-row"><span>${esc(l.value)}</span><button type="button" class="btn btn-quiet btn-sm" data-action="logo-layer-up" data-layer-id="${esc(l.id)}">↑</button><button type="button" class="btn btn-quiet btn-sm" data-action="logo-layer-down" data-layer-id="${esc(l.id)}">↓</button><button type="button" class="btn btn-quiet btn-sm" data-action="logo-layer-delete" data-layer-id="${esc(l.id)}">✕</button></div>`).join('')}</div><small class="muted small">Перетаскивай элементы прямо на эмблеме, чтобы менять их положение.</small></div></div></div>`;
  }
  function renderCreateForm(){
    return `<form id="createClubForm" class="create-club-form"><div class="field"><label for="newClubName">Название клуба</label><input id="newClubName" name="clubName" maxlength="26" required placeholder="Например, Zero United" autocomplete="off" /></div><div class="field"><label for="newClubLogin">Логин клуба</label><input id="newClubLogin" name="clubLogin" minlength="3" maxlength="24" pattern="[A-Za-z0-9_]+" required autocomplete="username" placeholder="Например, zero_united" /></div><div class="field"><label for="newClubPassword">Пароль</label><input id="newClubPassword" name="clubPassword" type="password" minlength="6" maxlength="64" required autocomplete="new-password" placeholder="Минимум 6 символов" /></div><div class="field"><label>Конструктор эмблемы</label>${renderCrestBuilder()}</div><div class="field"><label for="newCountry">Страна клуба</label><select name="country" id="newCountry" required>${Object.entries(COUNTRY).map(([code,c])=>`<option value="${code}" ${code==='ua'?'selected':''}>${c.flag} ${c.name}</option>`).join('')}</select><small id="starterBonus" class="muted small">🇺🇦 Стартовый пак: 16 игроков · Бонус страны: ${COUNTRY.ua.bonus}</small></div><div class="field-row"><div class="field"><label for="newKitPrimary">Цвет формы</label><input id="newKitPrimary" name="kitPrimary" class="color-input" type="color" value="#c8ff44" /></div><div class="field"><label for="newKitSecondary">Доп. цвет</label><input id="newKitSecondary" name="kitSecondary" class="color-input" type="color" value="#172318" /></div></div><div class="field"><label for="newKitPattern">Узор формы</label><select id="newKitPattern" name="kitPattern"><option value="plain">Однотонная</option><option value="stripes">Полосы</option><option value="halves">Две половины</option><option value="hoops">Поперечные полосы</option><option value="diagonal">Диагональ</option></select></div><button class="btn btn-primary btn-full" type="button" data-action="create-club-submit">Создать клуб и перейти к управлению →</button><button class="btn btn-quiet btn-full" type="button" data-action="start-back">Назад</button></form>`;
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
    const dark=THEME_OPTIONS.filter(x=>x[3]==='Тёмная'),light=THEME_OPTIONS.filter(x=>x[3]==='Светлая');
    const themeButtons=arr=>arr.map(([id,icon,name,kind])=>`<button class="theme-option ${active===id?'active':''}" data-action="set-theme" data-theme="${id}"><span>${icon}</span><strong>${name}</strong><small>${kind}</small></button>`).join('');
    return `<div class="section-heading"><div><div class="eyebrow">Game preferences</div><h1 class="h1">НАСТРОЙКИ</h1><p class="page-subtitle">Оформление и игровые параметры.</p></div></div>
    <section class="card" style="margin-bottom:16px"><div class="card-header"><div><div class="eyebrow">Appearance</div><h2 class="h2">ОФОРМЛЕНИЕ</h2><p>Открой панель и выбери тему интерфейса.</p></div><button class="btn btn-secondary" data-action="toggle-theme-panel">${themePanelOpen?'Скрыть темы':'🎨 Выбрать тему'}</button></div>${themePanelOpen?`<div class="theme-group-title">ТЁМНЫЕ ТЕМЫ</div><div class="theme-grid">${themeButtons(dark)}</div><div class="theme-group-title">СВЕТЛЫЕ ТЕМЫ</div><div class="theme-grid">${themeButtons(light)}</div>`:`<span class="pill">Активная тема: ${THEME_OPTIONS.find(x=>x[0]===active)?.[2]||'Classic'}</span>`}</section>
    <section class="card" style="margin-bottom:16px"><div class="card-header"><div><div class="eyebrow">Feedback</div><h2 class="h2">ОТКЛИКИ</h2></div></div><label class="setting-toggle"><span><b>Вибрация</b><small>Можно отключить в любой момент.</small></span><input type="checkbox" data-setting="vibration" ${db.vibration!==false?'checked':''}></label><label class="setting-toggle"><span><b>Звуковые эффекты</b><small>Звуки интерфейса.</small></span><input type="checkbox" data-setting="sound" ${db.sound!==false?'checked':''}></label></section>
    <section class="card" style="margin-bottom:16px"><div class="card-header"><div><div class="eyebrow">Language</div><h2 class="h2">ЯЗЫК ИГРЫ</h2><p>Выбери язык интерфейса.</p></div></div><select class="select-compact" data-setting="language"><option value="ru" ${db.language==="ru"?"selected":""}>🇷🇺 Русский</option><option value="uk" ${db.language==="uk"?"selected":""}>🇺🇦 Українська</option><option value="en" ${db.language==="en"?"selected":""}>🇬🇧 English</option><option value="de" ${db.language==="de"?"selected":""}>🇩🇪 Deutsch</option><option value="fr" ${db.language==="fr"?"selected":""}>🇫🇷 Français</option><option value="es" ${db.language==="es"?"selected":""}>🇪🇸 Español</option><option value="ja" ${db.language==="ja"?"selected":""}>🇯🇵 日本語</option><option value="zh" ${db.language==="zh"?"selected":""}>🇨🇳 中文</option><option value="kk" ${db.language==="kk"?"selected":""}>🇰🇿 Қазақша</option><option value="pl" ${db.language==="pl"?"selected":""}>🇵🇱 Polski</option></select></section>
    <section class="card"><div class="card-header"><div><div class="eyebrow">Club profile</div><h2 class="h2">ПРОФИЛЬ КЛУБА</h2><p>Отдельный вход для каждого клуба.</p></div></div><div class="statline"><span>Название клуба</span><b>${esc(club.name)}</b></div><div class="statline"><span>Логин</span><b>${esc(club.login||"—")}</b></div><div class="settings-actions"><button class="btn btn-secondary" data-action="nav" data-view="editor">Изменить клуб</button><button class="btn btn-secondary" data-action="switch-club">Сменить клуб</button><button class="btn btn-danger" data-action="delete-current-club">Удалить клуб</button></div></section>`;
  }
  function renderCollection(club){
    const owned=collectionMode==='owned';
    const players=owned?club.players.slice().sort((a,b)=>b.rating-a.rating):REAL_PLAYERS.map((p,i)=>({id:p.id,name:p.name,wiki:p.wiki,country:p.country,realClub:p.club,position:p.position,positions:REAL_PLAYER_POSITIONS[p.wiki]||[p.position],rating:p.rating,contractUntil:Date.now()+30*86400000,injuryMatches:0,redCardMatches:0}));
    return `<div class="section-heading"><div><div class="eyebrow">Player gallery</div><h1 class="h1">КОЛЛЕКЦИЯ</h1><p class="page-subtitle">${owned?'Твои подписанные футболисты.':'Полная база доступных футболистов в игре.'}</p></div><span class="pill pill-lime">${players.length} карточек</span></div><div class="collection-toolbar"><div class="collection-switch"><button class="btn ${owned?'btn-primary':'btn-secondary'} btn-sm" data-action="collection-mode" data-mode="owned">Мои карточки (${club.players.length})</button><button class="btn ${!owned?'btn-primary':'btn-secondary'} btn-sm" data-action="collection-mode" data-mode="all">Все карточки игры (${REAL_PLAYERS.length})</button></div><input id="collectionSearch" class="collection-search" placeholder="Поиск футболиста…"><select id="collectionPosition" class="select-compact"><option value="">Все позиции</option>${['GK','CB','LB','RB','CDM','CM','CAM','LW','RW','ST'].map(x=>`<option value="${x}">${x}</option>`).join('')}</select><select id="collectionRarity" class="select-compact"><option value="">Все рейтинги</option><option value="bronze">50–64</option><option value="silver">65–74</option><option value="gold">75–84</option><option value="elite">85–89</option><option value="icon">90+</option></select><select id="collectionSort" class="select-compact"><option value="rating">По рейтингу</option><option value="name">По имени</option></select></div><div class="collection-contracts"><button class="btn btn-secondary btn-sm" data-action="toggle-contracts-panel">${contractsPanelOpen?'Скрыть контракты':'📄 Контракты игроков'}</button></div>${contractsPanelOpen?`<section class="card contract-list" style="margin:12px 0">${club.players.slice().sort((a,b)=>contractDays(a)-contractDays(b)).map(p=>`<div class="contract-row"><div><b>${esc(p.name)}</b><small>${esc((p.positions||[p.position]).join(' / '))} · ${p.rating} OVR</small></div><span class="contract-days ${contractDays(p)<=7?'danger':''}">${contractDays(p)} дн.</span></div>`).join('')}</section>`:''}<div id="collectionGrid" class="player-grid collection-grid">${players.map(p=>renderPlayerCard(p,false,true)).join('')}</div>`;
  }
  function applyCollectionFilters(){
    const grid=$('#collectionGrid');if(!grid)return;const club=currentClub();const owned=collectionMode==='owned';let list=owned?club.players.slice():REAL_PLAYERS.map(p=>({id:p.id,name:p.name,wiki:p.wiki,country:p.country,realClub:p.club,position:p.position,positions:REAL_PLAYER_POSITIONS[p.wiki]||[p.position],rating:p.rating,contractUntil:Date.now()+30*86400000}));
    const q=($('#collectionSearch')?.value||'').toLowerCase(),pos=$('#collectionPosition')?.value||'',rar=$('#collectionRarity')?.value||'',sort=$('#collectionSort')?.value||'rating';list=list.filter(p=>(!q||p.name.toLowerCase().includes(q)||String(p.realClub||'').toLowerCase().includes(q))&&(!pos||(p.positions||[p.position]).includes(pos))&&(!rar||({bronze:p.rating<65,silver:p.rating>=65&&p.rating<75,gold:p.rating>=75&&p.rating<85,elite:p.rating>=85&&p.rating<90,icon:p.rating>=90})[rar]));list.sort(sort==='name'?(a,b)=>a.name.localeCompare(b.name,'ru'):(a,b)=>b.rating-a.rating);grid.innerHTML=list.map(p=>renderPlayerCard(p,false,true)).join('');resolvePlayerImages();
  }
  function renderPage(club){switch(view){case'settings':return renderSettings(club);case'team':return renderTeam(club);case'packs':return renderPacks(club);case'collection':return renderCollection(club);case'sponsors':return renderSponsors(club);case'match':return renderMatch(club);case'trophies':return renderTrophies(club);case'editor':return renderEditor(club);default:return renderHome(club);}}
  function renderHome(club){
    const history=(club.history||[]).slice(0,3);
    return `<div class="welcome-banner"><div class="welcome-copy"><div class="eyebrow">WELCOME TO YOUR FOOTBALL ERA</div><h1>WELCOME BACK,<br><span>${esc(club.name)}.</span></h1><p>Твой клуб — твои правила. Усиливай состав, выбирай стиль игры и поднимайся по футбольной лестнице.</p><button class="btn btn-primary" data-action="nav" data-view="match">⚽ Найти соперника <span>→</span></button></div><div class="banner-crest-wrap"><div class="banner-crest ${crestShape(club.logo)}" style="--crest-color:${esc(club.logo.color)}">${crestContent(club.logo,.9)}</div></div></div><div class="stat-grid"><div class="metric-card"><div class="metric-top">Рейтинг команды <span class="metric-symbol">★</span></div><div class="metric-value">${teamRating(club)} <span style="font-size:13px;color:var(--muted)">OVR</span></div><div class="metric-note">Средний рейтинг стартовых 11</div></div><div class="metric-card"><div class="metric-top">Матчи <span class="metric-symbol">⚽</span></div><div class="metric-value">${club.stats.matches}</div><div class="metric-note">${club.stats.wins} побед · ${club.stats.draws} ничьих</div></div><div class="metric-card"><div class="metric-top">Победы <span class="metric-symbol">🏆</span></div><div class="metric-value">${club.stats.wins}</div><div class="metric-note">${club.stats.losses} поражений</div></div><div class="metric-card"><div class="metric-top">Футболисты <span class="metric-symbol">♧</span></div><div class="metric-value">${club.players.length}</div><div class="metric-note">${activePlayers(club).length} в стартовом составе</div></div></div><div class="dashboard-grid"><section class="card"><div class="card-header"><div><div class="eyebrow">Быстрый доступ</div><h2 class="h2">ЧТО ДЕЛАЕМ СЕГОДНЯ?</h2><p>Пара действий — и команда станет сильнее.</p></div></div><div class="quick-actions"><button class="quick-action" data-action="nav" data-view="team"><div class="qa-icon">🧩</div><strong>Настроить команду</strong><small>Состав, схема и игровой стиль</small></button><button class="quick-action" data-action="nav" data-view="packs"><div class="qa-icon">🎴</div><strong>Магазин игроков</strong><small>Паки и ежедневные карточки</small></button><button class="quick-action" data-action="nav" data-view="trophies"><div class="qa-icon">🏆</div><strong>Трофеи</strong><small>${Object.keys(club.trophyUnlocks||{}).length} из ${TROPHIES.length} достижений</small></button></div></section><section class="card"><div class="card-header"><div><div class="eyebrow">Последние события</div><h2 class="h2">ИСТОРИЯ КЛУБА</h2></div><button class="btn btn-quiet btn-sm" data-action="nav" data-view="match">Играть →</button></div>${history.length?`<div class="recent-list">${history.map(h=>`<div class="recent-row"><div class="recent-icon">${h.result==='W'?'🏆':h.result==='D'?'🤝':'⚽'}</div><div><strong>${esc(h.opponent)}</strong><small>${esc(h.date||'Недавно')} · ${h.result==='W'?'Победа':h.result==='D'?'Ничья':'Поражение'}</small></div><div class="right ${h.result==='W'?'positive':''}">${h.score}</div></div>`).join('')}</div>`:`<div class="empty-state"><div class="empty-icon">📋</div><strong>Первая глава ещё впереди</strong><span class="small">Сыграй матч, и он появится здесь.</span></div>`}</section></div>`;
  }
  function renderTeam(club){
    const formation=FORMATIONS[club.formation]||FORMATIONS['4-3-3'];
    const slots=formation.map((slot,i)=>{const p=club.players.find(x=>x.id===club.lineup[i]);const rating=p?p.rating+(club.captainId===p.id?1:0):0;const slotPhoto=p?(PLAYER_PHOTOS[p.wiki]||makeFallbackPortrait(p.wiki||p.name)):'';const art=p?`<img class="slot-portrait" alt="${esc(p.name)}" src="${esc(slotPhoto)}" loading="lazy">`:'';return `<div class="player-slot-wrap" style="left:${slot.x}%;top:${slot.y}%"><button class="player-slot" data-action="${p?'open-player-card':'edit-slot'}" ${p?`data-player-id="${esc(p.id)}" data-player-wiki="${esc(p.wiki||'')}" data-player-name="${esc(p.name)}"`:`data-slot="${i}"`} title="${p?'Открыть действия игрока':'Добавить футболиста'}"><span class="slot-card" style="--kit-primary:${esc(club.kit.primary)}">${art||'+'}</span><span class="slot-rating-below">${p?rating:'+'}</span>${p&&(p.injuryMatches>0||p.redCardMatches>0||p.yellowBanMatches>0||p.yellowCards>0)?`<span class="status-tag ${p.yellowCards>0&&!p.injuryMatches&&!p.redCardMatches&&!p.yellowBanMatches?'yellow':p.injuryMatches>0?'injury':'redcard'}">${p.injuryMatches>0?'🤕 '+p.injuryMatches:p.redCardMatches>0?'🟥 '+p.redCardMatches:p.yellowBanMatches>0?'⛔ '+p.yellowBanMatches:'🟨 '+p.yellowCards+'/5'}</span>`:''}<span class="slot-name">${p?esc(p.name.split(' ').slice(-1)[0]):'Добавить'}</span><span class="slot-role">${slot.role}</span></button>${p?`<button class="captain-toggle ${club.captainId===p.id?'captain-active':''}" data-action="set-captain" data-player-id="${esc(p.id)}" title="Назначить капитаном (+1 OVR)">${club.captainId===p.id?'★':'☆'}</button>`:''}</div>`;}).join('');
    const bench=benchPlayers(club);
    const squad=club.players.slice().sort((a,b)=>b.rating-a.rating);
    return `<div class="section-heading"><div><div class="eyebrow">Club management</div><h1 class="h1">НАСТРОЙКА КОМАНДЫ</h1><p class="page-subtitle">Расставь футболистов, выбери схему и реши, как будет играть твой клуб.</p></div><div class="actions"><span class="pill pill-lime">${teamRating(club)} OVR</span><span class="pill">${club.players.length} игроков</span></div></div><div class="team-layout"><div><section class="card" style="margin-bottom:15px"><div class="card-header"><div><div class="eyebrow">Tactical board</div><h2 class="h2">СТАРТОВЫЙ СОСТАВ</h2><p>Нажми на карточку игрока, чтобы открыть действия.</p></div><span class="pill">${activePlayers(club).length} / 11</span></div><div class="team-controls"><label class="small muted" for="formationSelect">Схема</label><select class="select-compact" id="formationSelect" data-setting="formation">${Object.keys(FORMATIONS).map(f=>`<option value="${f}" ${club.formation===f?'selected':''}>${f}</option>`).join('')}</select><button class="btn btn-quiet btn-sm" data-action="auto-lineup">✦ Лучший состав</button></div><div class="pitch"><div class="pitch-midline"></div><div class="pitch-circle"></div><div class="penalty top"></div><div class="penalty bottom"></div>${slots}</div><div class="card-header" style="margin-bottom:10px"><div><h3 class="h3">ЗАПАСНЫЕ</h3><p>Нажми на игрока, чтобы поставить его в стартовый состав.</p></div></div><div class="bench-grid">${bench.map(p=>`<button class="bench-card" data-action="quick-assign" data-player-id="${esc(p.id)}" ${playerIsUnavailable(p)?'disabled title="Игрок недоступен"':''}><span class="bench-avatar" style="--rarity-color:${rarityColor(p.rating+(club.captainId===p.id?1:0))}">${p.rating+(club.captainId===p.id?1:0)}</span><strong>${esc(p.name.split(' ').slice(-1)[0])}</strong><small>${esc((p.positions||[p.position]).join(' / '))}${p.injuryMatches>0?` · 🤕 ${p.injuryMatches}`:''}${p.redCardMatches>0?` · 🟥 ${p.redCardMatches}`:''}${p.yellowBanMatches>0?` · ⛔ ${p.yellowBanMatches}`:p.yellowCards>0?` · 🟨 ${p.yellowCards}/5`:''}</small></button>`).join('')}</div></section><section class="card"><div class="card-header"><div><div class="eyebrow">Play style</div><h2 class="h2">ИГРОВОЙ СТИЛЬ</h2><p>Стиль влияет на риск и баланс атаки с обороной в матче.</p></div></div><div class="style-cards">${Object.entries(STYLES).map(([id,s])=>`<button class="style-option ${club.style===id?'active':''}" data-action="set-style" data-style="${id}"><span class="style-icon">${s.icon}</span><strong>${s.name}</strong><small>${s.desc}</small></button>`).join('')}</div></section></div><div><section class="card" style="margin-bottom:15px"><div class="card-header"><div><div class="eyebrow">Squad list</div><h2 class="h2">ВСЕ ФУТБОЛИСТЫ</h2><p>Игроки основного состава и резерва.</p></div></div><div class="squad-tools" style="margin-bottom:13px"><span class="pill">🟢 ${activePlayers(club).length} в основе</span><span class="pill">🪑 ${benchPlayers(club).length} в резерве</span></div><div class="squad-list">${squad.map(p=>{const idx=club.lineup.indexOf(p.id);return `<div class="squad-item" data-action="open-player-card" data-player-id="${esc(p.id)}" data-player-wiki="${esc(p.wiki||'')}" data-player-name="${esc(p.name)}" data-portrait-key="${esc(p.wiki||p.name)}" ${p.wiki?`data-wiki="${esc(p.wiki)}"`:``}><div class="mini-player" style="--rarity-color:${rarityColor(p.rating)}"><span class="mini-rating">${p.rating+(club.captainId===p.id?1:0)}</span><img class="squad-photo" alt="${esc(p.name)}" loading="lazy"></div><div class="squad-info"><strong>${esc(p.name)}</strong><small>${esc((p.positions||[p.position]).join(" / "))} · ${esc(p.realClub||"Клуб не указан")}${p.injuryMatches>0?` · 🤕 ${p.injuryMatches}`:``}${p.redCardMatches>0?` · 🟥 ${p.redCardMatches}`:``}${p.yellowBanMatches>0?` · ⛔ Жёлтые: бан ${p.yellowBanMatches}`:p.yellowCards>0?` · 🟨 ${p.yellowCards}/5`:``}</small>${idx>=0?`<span class="pill pill-lime">Основа · ${idx+1}</span>`:`<button class="btn btn-secondary btn-sm" data-action="quick-assign" data-player-id="${esc(p.id)}">В основу</button>`}</div></div>`;}).join("")}</div></section><section class="card"><div class="card-header"><div><div class="eyebrow">Team report</div><h2 class="h2">ОЦЕНКА СОСТАВА</h2></div></div><div class="statline"><span>Атака</span><b>${Math.round(activePlayers(club).reduce((s,p)=>s+Math.max(p.shooting,p.dribbling,p.passing),0)/Math.max(1,activePlayers(club).length))}</b></div><div class="progress"><span style="width:${Math.min(100,activePlayers(club).reduce((s,p)=>s+Math.max(p.shooting,p.dribbling,p.passing),0)/Math.max(1,activePlayers(club).length))}%"></span></div><div class="statline"><span>Оборона</span><b>${Math.round(activePlayers(club).reduce((s,p)=>s+p.defense,0)/Math.max(1,activePlayers(club).length))}</b></div><div class="progress"><span style="width:${Math.min(100,activePlayers(club).reduce((s,p)=>s+p.defense,0)/Math.max(1,activePlayers(club).length))}%"></span></div><div class="statline"><span>Сыгранность</span><b>${Math.max(45,Math.min(100,Math.round(100-(new Set(activePlayers(club).map(p=>p.country)).size-1)*4)))}%</b></div><div class="progress"><span style="width:${Math.max(45,Math.min(100,Math.round(100-(new Set(activePlayers(club).map(p=>p.country)).size-1)*4)))}%"></span></div></section></div></div>`;
  }

  function dailyShop(club){const now=new Date();const day=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');if(!club.dailyShop||club.dailyShop.day!==day){const pool=shuffle(REAL_PLAYERS.filter(p=>!club.players.some(x=>x.wiki===p.wiki))).slice(0,3);club.dailyShop={day,offers:pool.map(p=>({wiki:p.wiki,price:Math.max(.08,Math.round(marketValue(p.rating)*.025*100)/100)})),freeClaimed:false};saveDB();}return club.dailyShop;}
  function renderPacks(club){
    const packOptions=[
      {id:'starter',name:'Агентство ★',type:'Агентство · 1 звезда',price:2,count:3,color:'#c8ff44',glow:'rgba(200,255,68,.13)',desc:'3 футболиста. Базовый шанс на сильную карточку.',meta:'3 КАРТОЧКИ'},
      {id:'national',name:'Агентство ★★',type:'Агентство · 2 звезды',price:8,count:4,color:'#79c9ff',glow:'rgba(121,201,255,.16)',desc:'4 футболиста. Более высокий шанс на рейтинг 70+.',meta:'4 КАРТОЧКИ'},
      {id:'pro',name:'Агентство ★★★',type:'Агентство · 3 звезды',price:25,count:5,color:'#c296ff',glow:'rgba(194,150,255,.17)',desc:'5 футболистов. Повышенный шанс на рейтинг 75+.',meta:'5 КАРТОЧЕК'},
      {id:'elite',name:'Агентство ★★★★',type:'Агентство · 4 звезды',price:75,count:5,color:'#ffb45e',glow:'rgba(255,180,94,.17)',desc:'5 футболистов. Высокий шанс на рейтинг 80+.',meta:'5 КАРТОЧЕК'},
      {id:'legend',name:'Агентство ★★★★★',type:'Агентство · 5 звёзд',price:200,count:6,color:'#ff6f9e',glow:'rgba(255,111,158,.17)',desc:'6 футболистов. Лучшие шансы на элитных игроков.',meta:'6 КАРТОЧЕК'}
    ];
    const shop=dailyShop(club);const dailyOffers=shop.offers.map(o=>{const p=REAL_PLAYERS.find(x=>x.wiki===o.wiki);return p?`<article class="pack-card"><div class="pack-type">КАРТА ДНЯ</div><h3>${esc(p.name)}</h3><p>${esc(p.club)} · ${p.rating} OVR</p><div class="pack-bottom"><span class="pack-price">${formatMoney(o.price)}</span><button class="btn btn-primary btn-sm" data-action="buy-daily-player" data-wiki="${esc(p.wiki)}" ${club.coins<o.price||club.players.some(x=>x.wiki===p.wiki)?'disabled':''}>${club.players.some(x=>x.wiki===p.wiki)?'Уже в клубе':'Купить'}</button></div></article>`:''}).join('');
    return `<div class="section-heading"><div><div class="eyebrow">Pack market</div><h1 class="h1">МАГАЗИН ПАКОВ</h1><p class="page-subtitle">Покупай паки за миллионы евро. Сильные игроки стоят значительно дороже обычных.</p></div><div class="actions"><span class="coin-chip">${formatMoney(club.coins)}</span></div></div><section class="card" style="margin-bottom:16px"><div class="card-header"><div><div class="eyebrow">ЕЖЕДНЕВНЫЙ МАГАЗИН</div><h2 class="h2">3 КАРТЫ ДНЯ</h2><p>Предложения обновляются каждый день.</p></div><span class="pill">${shop.day}</span></div><div class="pack-grid">${dailyOffers}</div><div style="margin-top:12px"><button class="btn btn-secondary" data-action="free-daily-pack" ${shop.freeClaimed?'disabled':''}>${shop.freeClaimed?'Бесплатная карта уже получена':'🎁 Забрать бесплатную карту дня'}</button></div></section><div class="pack-grid">${packOptions.map(p=>`<article class="pack-card" style="--pack-color:${p.color};--pack-glow:${p.glow}"><div class="pack-art"><div class="pack-box"><span class="pack-art-star">✦</span><span class="pack-art-mark">ZF</span><span class="pack-art-lines"></span></div><span class="pack-orbit orbit-a"></span><span class="pack-orbit orbit-b"></span></div><div class="pack-type">${p.type}</div><h3>${p.name}</h3><p>${p.desc}</p><div class="pack-bottom"><span class="pack-price">${formatMoney(p.price)}</span><button class="btn btn-primary btn-sm" data-action="open-pack" data-pack="${p.id}" ${club.coins<p.price?'disabled':''}>Открыть ↗</button></div><div class="pack-footnote">${p.meta} · Игроки добавятся в твою коллекцию</div></article>`).join('')}</div>`;
  }
  function renderPlayerCard(p,actions=false,clickable=false){const shownRating=p.id&&currentClub()?.captainId===p.id?p.rating+1:p.rating;const r=rarityFor(shownRating);const country=PLAYER_COUNTRIES[p.country]||{name:countryData(p.country).name,flag:countryData(p.country).flag};return `<article class="player-card" ${clickable?`data-action="open-player-card" data-player-id="${esc(p.id)}" data-player-wiki="${esc(p.wiki||'')}" data-player-name="${esc(p.name)}"`:''} data-portrait-key="${esc(p.wiki||p.name)}" ${p.wiki?`data-wiki="${esc(p.wiki)}"`:''} style="--rarity-color:${r.color};--player-glow:${r.color}22"><div class="player-card-head"><div><div class="player-overall">${shownRating}</div><span class="player-position">${esc((p.positions||[p.position]).join(' / '))}</span></div><span class="rarity-badge">${r.name}</span></div><div class="player-portrait"><div class="portrait-circle">${esc(avatarLetters(p.name))}</div><img class="portrait-photo" alt="${esc(p.name)}" loading="lazy" style="display:none"/></div><div class="player-card-body"><strong>${esc(p.name)}</strong><div class="player-meta"><span>${country.flag} ${esc(country.name)}</span><span>${contractDays(p)} дн.</span></div><div class="player-market-value">${formatMoney(marketValue(p.rating))}</div>${(p.name==='Луис Суарес'||p.wiki==='Luis_Suárez')?`<div class="player-meta"><span class="real-club">Интер Майами</span></div>`:p.realClub?`<div class="player-meta"><span class="real-club">${esc(p.realClub)}</span></div>`:''}<div class="player-status">${p.injuryMatches>0?`<span class="status-tag injury">🤕 ${p.injuryMatches}</span>`:''}${p.redCardMatches>0?`<span class="status-tag redcard">🟥 ${p.redCardMatches}</span>`:''}${p.yellowBanMatches>0?`<span class="status-tag redcard">⛔ ${p.yellowBanMatches}</span>`:p.yellowCards>0?`<span class="status-tag yellow">🟨 ${p.yellowCards}/5</span>`:''}</div></div></article>`;}
  function renderPlayerModal(club){
    if(!playerModalRef)return '';
    const owned=club.players.find(p=>p.id===playerModalRef.id)||club.players.find(p=>(playerModalRef.wiki&&p.wiki===playerModalRef.wiki)||(playerModalRef.name&&p.name===playerModalRef.name));
    const base=owned||REAL_PLAYERS.find(p=>(playerModalRef.wiki&&p.wiki===playerModalRef.wiki)||(playerModalRef.name&&p.name===playerModalRef.name));
    if(!base)return '';
    const card=owned?{...owned}:{...base,id:null,realClub:base.club};
    const country=PLAYER_COUNTRIES[card.country]||{name:countryData(card.country).name,flag:countryData(card.country).flag};
    if(owned&&club.captainId===owned.id)card.rating=card.rating+1;
    const blocked=!owned;
    const isStarter=!!(owned&&club.lineup.includes(owned.id));const buttonText=!owned?'Не подписан':isStarter?'Игрок стартового состава':'Продать · рыночная цена';
    const statuses=[card.injuryMatches>0?`🤕 Травма: ${card.injuryMatches}`:'',card.redCardMatches>0?`🟥 Дисквалификация: ${card.redCardMatches}`:'',card.yellowBanMatches>0?`⛔ Бан за жёлтые: ${card.yellowBanMatches}`:'',card.yellowCards>0?`🟨 Жёлтые: ${card.yellowCards}/5`:''].filter(Boolean).join(' · ');
    return `<div class="modal-backdrop player-card-modal-backdrop" data-action="close-player-modal-backdrop"><section class="modal player-card-modal" role="dialog" aria-modal="true"><div class="modal-head"><div><div class="eyebrow">Карточка футболиста</div><h2>${esc(card.name)}</h2><p class="muted small" style="margin:6px 0 0">${country.flag} ${esc(country.name)} · ${esc((card.positions||REAL_PLAYER_POSITIONS[card.wiki]||[card.position]).join(' / '))}</p></div><button class="icon-btn" data-action="close-player-modal">✕</button></div><div class="player-modal-summary"><div class="player-modal-rating" style="--rarity-color:${rarityColor(card.rating)}">${card.rating}<small>OVR</small></div><div><strong>${esc(card.realClub||card.club||'Клуб не указан')}</strong><small>${formatMoney(marketValue(card.rating))} · ${rarityFor(card.rating).name}</small>${statuses?`<small class="player-modal-status">${statuses}</small>`:''}</div></div><div class="player-modal-actions">${owned&&!isStarter?`<button class="btn btn-danger" data-action="sell-player" data-player-id="${esc(owned.id)}">${buttonText}</button>`:`<button class="btn btn-secondary" disabled>${buttonText}</button>`}</div></section></div>`;
  }
  function refreshEnergy(club){const now=Date.now();const elapsed=Math.floor((now-(club.energyAt||now))/(30*60*1000));if(elapsed>0){club.energy=Math.min(5,(club.energy||0)+elapsed);club.energyAt=(club.energyAt||now)+elapsed*30*60*1000;saveDB();}}
  const SPONSOR_DEALS = window.ZF_DATA.SPONSOR_DEALS;
  function sponsorLogo(o,small=false){return `<span class="sponsor-emblem ${small?'tiny-emblem':''}" style="--emblem-tone:${o.type==='kit'?'#c8ff44':o.type==='title'?'#65b8ff':'#f4b85d'}">${esc(o.mark)}</span>`;}
  function renderSponsors(club){
    club.sponsorSlots=club.sponsorSlots||{kit:null,title:null,extra:null};
    // Migrate the old single sponsor contract into the matching slot.
    if(club.sponsorContract&&!Object.values(club.sponsorSlots).some(Boolean)){const old=club.sponsorContract;club.sponsorSlots[old.type||'title']=old;}
    const now=Date.now(), groups=[['kit','👕','СПОНСОР ФОРМЫ'],['title','🏷️','ТИТУЛЬНЫЙ СПОНСОР'],['extra','✦','ДОПОЛНИТЕЛЬНЫЙ СПОНСОР']];
    const activeFor=type=>{const a=club.sponsorSlots[type];return a&&a.until>now?a:null;};
    return `<div class="section-heading"><div><div class="eyebrow">Partner deals</div><h1 class="h1">СПОНСОРЫ</h1><p class="page-subtitle">Можно заключить три независимых контракта: на форму, титульный и дополнительный.</p></div><span class="pill pill-lime">3 рекламных места</span></div>
    ${groups.map(([type,icon,label])=>{const active=activeFor(type),deal=active&&SPONSOR_DEALS.find(x=>x.id===active.id);return `<section class="card" style="margin-bottom:18px"><div class="card-header"><div><div class="eyebrow">${icon} ${label}</div><h2 class="h2">${active?esc(deal?.name||active.id):'МЕСТО СВОБОДНО'}</h2><p>${active?`Активен ещё ${Math.max(0,Math.ceil((active.until-now)/86400000))} дн. · За матч €${active.matchBonus||0} тыс. · Победа +€${active.winBonus||0} тыс.`:'Выбери партнёра из списка ниже.'}</p></div><span class="pill ${active?'pill-lime':''}">${active?'ЗАКЛЮЧЁН':'СВОБОДНО'}</span></div><div class="sponsor-grid">${SPONSOR_DEALS.filter(o=>o.type===type).map(o=>{const signed=active?.id===o.id;return `<article class="sponsor-card"><div class="sponsor-logo">${sponsorLogo(o)}</div><h3>${esc(o.name)}</h3><p class="muted small">${esc(o.desc)}</p><div class="statline"><span>За матч</span><b>€${o.match} тыс.</b></div><div class="statline"><span>За победу</span><b>€${o.win} тыс.</b></div><div class="statline"><span>Подписание</span><b>€${o.sign} тыс.</b></div> <div class="sponsor-requirement">Требования: ${o.req||'Без требований'}</div>${signed?'<span class="pill pill-lime">Активен</span>':`<button class="btn btn-secondary btn-full" data-action="sign-sponsor" data-sponsor="${o.id}" data-sponsor-type="${type}" ${(active||teamRating(club)<(o.minRating||0)||(club.stats.wins||0)<(o.minWins||0))?'disabled':''}>${active?'Место занято':(teamRating(club)<(o.minRating||0)||(club.stats.wins||0)<(o.minWins||0))?'Пока недоступен':'Подписать на 30 дней'}</button>`}</article>`;}).join('')}</div></section>`;}).join('')}`;
  }

  function renderEditor(club){
    const c=countryData(club.country);
    return `<div class="section-heading"><div><div class="eyebrow">Club identity</div><h1 class="h1">РЕДАКТОР КЛУБА</h1><p class="page-subtitle">Создай узнаваемую эмблему, подбери цвета и настрой форму.</p></div><span class="pill pill-lime">${c.flag} ${c.name}</span></div><div class="editor-layout"><section class="card"><div class="card-header"><div><div class="eyebrow">Club profile</div><h2 class="h2">ДАННЫЕ КЛУБА</h2></div></div><form id="editClubForm" class="form-grid"><div class="field"><label for="editClubName">Название клуба</label><input id="editClubName" name="clubName" value="${esc(club.name)}" maxlength="26" required /></div><div class="field"><label for="editCountry">Страна и флаг</label><select id="editCountry" name="country">${Object.entries(COUNTRY).map(([code,v])=>`<option value="${code}" ${club.country===code?'selected':''}>${v.flag} ${v.name}</option>`).join('')}</select><small id="editCountryBonus" class="muted small">Бонус страны: ${c.bonus}</small></div><div class="field"><label>Символ эмблемы</label><div class="logo-editor"><div id="editCrest" class="crest-big crest-builder-preview ${crestShape(club.logo)}" style="--crest-color:${esc(club.logo.color)}">${crestContent(club.logo,.9)}</div><div class="symbol-picks">${SYMBOLS.map(s=>`<button type="button" class="symbol-pick ${club.logo.symbol===s?'active':''}" data-action="edit-logo-symbol" data-symbol="${esc(s)}">${esc(s)}</button>`).join('')}</div><input type="hidden" id="editLogoSymbol" name="logoSymbol" value="${esc(club.logo.symbol)}"/><input type="hidden" id="editLogoColorHidden" name="logoColor" value="${esc(club.logo.color)}"/></div></div><div class="field"><label for="editLogoColor">Цвет эмблемы</label><input id="editLogoColor" class="color-input" type="color" value="${esc(club.logo.color)}" data-preview="edit-logo-color" /></div><div class="divider"></div><div class="field-row"><div class="field"><label for="editKitPrimary">Основной цвет</label><input id="editKitPrimary" name="kitPrimary" class="color-input" type="color" value="${esc(club.kit.primary)}" data-preview="kit-primary" /></div><div class="field"><label for="editKitSecondary">Дополнительный цвет</label><input id="editKitSecondary" name="kitSecondary" class="color-input" type="color" value="${esc(club.kit.secondary)}" data-preview="kit-secondary" /></div></div><div class="field"><label>Узор формы</label><div class="pattern-options">${[['plain','Чистая'],['stripes','Полосы'],['halves','Две половины'],['hoops','Поперечные'],['diagonal','Диагональ']].map(([id,label])=>`<button type="button" class="pattern-option ${club.kit.pattern===id?'active':''}" data-action="set-pattern" data-pattern="${id}">${label}</button>`).join('')}</div><input type="hidden" id="editKitPattern" name="kitPattern" value="${esc(club.kit.pattern)}"/></div><button class="btn btn-primary btn-full" type="submit">Сохранить изменения ✓</button></form></section><div><section class="card" style="margin-bottom:15px"><div class="card-header"><div><div class="eyebrow">Live preview</div><h2 class="h2">ВНЕШНИЙ ВИД</h2><p>Так клуб будет выглядеть в меню и матчах.</p></div></div><div class="club-identity-preview"><span class="club-crest ${crestShape(club.logo)}" id="editorPreviewCrest" style="--crest-color:${esc(club.logo.color)}">${crestContent(club.logo,.55)}</span><div class="identity-text"><strong id="editorPreviewName">${esc(c.flag)} ${esc(club.name)}</strong><small id="editorPreviewCountry">${c.name} · ${teamRating(club)} OVR</small></div></div><div class="kit-preview-wrap"><div class="kit-shirt pattern-${esc(club.kit.pattern)}" id="kitShirt" style="--kit-primary:${esc(club.kit.primary)};--kit-secondary:${esc(club.kit.secondary)}">${(club.sponsorSlots?.kit&&club.sponsorSlots.kit.until>Date.now())?`<span class="kit-sponsor-mark">${esc((SPONSOR_DEALS.find(x=>x.id===club.sponsorSlots.kit.id)||{}).mark||'')}</span>`:''}</div></div></section><section class="card"><div class="card-header"><div><div class="eyebrow">Club snapshot</div><h2 class="h2">ПАСПОРТ КЛУБА</h2></div></div><div class="recent-list"><div class="recent-row"><div class="recent-icon">⚽</div><div><strong>Домашняя форма</strong><small>Основной цвет и узор</small></div><div class="right">${club.kit.pattern==='plain'?'Однотонная':club.kit.pattern==='stripes'?'Полосы':club.kit.pattern==='halves'?'Две половины':club.kit.pattern==='hoops'?'Поперечная':'Диагональ'}</div></div><div class="recent-row"><div class="recent-icon">🌍</div><div><strong>Страна</strong><small>Стартовый пак</small></div><div class="right">${c.flag} ${c.name}</div></div></div></section></div></div>`;
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
  function renderFound(club){const opp=matchState.opponent;return `<div class="section-heading"><div><div class="eyebrow">Opponent found</div><h1 class="h1">СОПЕРНИК НАЙДЕН</h1><p class="page-subtitle">Разминка закончена. Пора выходить на поле.</p></div><span class="pill pill-lime">✓ Найден</span></div><div class="match-shell"><div class="card" style="text-align:center;padding:25px"><span class="pill pill-lime">СОПОСТАВЛЕНИЕ ЗАВЕРШЕНО</span><div class="found-vs"><div class="found-side"><div class="club-crest ${crestShape(club.logo)}" style="--crest-color:${esc(club.logo.color)}">${crestContent(club.logo,.9)}</div><strong>${esc(club.name)}</strong><small>${teamRating(club)} OVR · Твой клуб</small></div><div class="vs-word">VS</div><div class="found-side"><div class="club-crest" style="--crest-color:${esc(opp.color)}">${esc(opp.symbol)}</div><strong>${esc(opp.name)}</strong><small>${opp.rating} OVR · Бот</small></div></div><div class="opponent-stars"><div class="eyebrow">⭐ ЛУЧШИЕ ИГРОКИ СОПЕРНИКА</div><div class="opponent-star-row">${(opp.players||[]).slice(0,3).map((n,i)=>`<div class="opponent-star-card" style="--delay:${i*180}ms"><span>⭐</span><b>${esc(n)}</b><small>${opp.rating-rand(1,7)} OVR</small></div>`).join('')}</div></div><div class="divider"></div><div class="stat-grid" style="margin-bottom:18px"><div class="metric-card"><div class="metric-top">Твой состав</div><div class="metric-value">${teamRating(club)}</div><div class="metric-note">Общий рейтинг</div></div><div class="metric-card"><div class="metric-top">Соперник</div><div class="metric-value">${opp.rating}</div><div class="metric-note">Общий рейтинг</div></div><div class="metric-card"><div class="metric-top">Формат</div><div class="metric-value">10</div><div class="metric-note">Эпизодов</div></div><div class="metric-card"><div class="metric-top">Награда</div><div class="metric-value">€0.35 млн</div><div class="metric-note">Минимальная выплата</div></div></div><button class="btn btn-primary" data-action="start-match" style="min-width:230px">Начать матч →</button><div style="margin-top:12px"><button class="btn btn-quiet btn-sm" data-action="cancel-search">Отменить</button></div></div></div>`;}
  function matchBoard(club){const opp=matchState.opponent;return `<div class="match-scoreboard"><div class="match-team"><div class="club-crest ${crestShape(club.logo)}" style="--crest-color:${esc(club.logo.color)}">${crestContent(club.logo,.9)}</div><strong>${esc(club.name)}</strong><span class="pill" style="margin-top:7px">${teamRating(club)} OVR</span></div><div class="match-center"><div class="match-minute">${matchState.minute||0}′</div><div class="match-score">${matchState.score[0]} : ${matchState.score[1]}</div><div class="match-status">${matchState.stage==='result'?'МАТЧ ОКОНЧЕН':'ZERO LEAGUE · BOT MATCH'}</div></div><div class="match-team"><div class="club-crest" style="--crest-color:${esc(opp.color)}">${esc(opp.symbol)}</div><strong>${esc(opp.name)}</strong><span class="pill" style="margin-top:7px">${opp.rating} OVR</span></div></div>`;}
  function renderLiveMatch(club){
    const ev=matchState.currentEvent;
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
    if(!matchState.actionDeadline){matchState.actionDeadline=Date.now()+60000;matchState.actionTimer=setTimeout(()=>{if(matchState.stage==='live'&&matchState.actionDeadline&&Date.now()>=matchState.actionDeadline){const fallback=pick(actions);if(fallback)resolveChoice(fallback.id);}},60000);}
    if(ev.kind==='penalty'||ev.kind==='corner'||ev.kind==='freekick')actions.splice(4);
    if(ev.kind!=='penalty'&&ev.kind!=='corner'&&ev.kind!=='freekick')actions.splice(0,actions.length,...(scenarioSets[scenario]||scenarioSets[ev.side==='user'?'buildup':'defend']).map(([id,icon,name,desc])=>({id,icon,name,desc,risk:['dribble','feint','speed','tackle','foul'].includes(id)?'Высокий':'Средний'})));
    return `<div class="section-heading"><div><div class="eyebrow">Live match</div><h1 class="h1">МАТЧ ИДЁТ</h1><p class="page-subtitle">Принимай решение в каждом эпизоде. Один удачный момент может изменить всё.</p></div><span class="pill pill-lime">Эпизод ${matchState.eventIndex+1} / 10</span></div><div class="match-shell">${energyWidget(club)}${matchBoard(club)}<section class="match-event"><div class="event-top"><span class="pill ${ev.side==='user'?'pill-lime':'pill-red'}">${ev.side==='user'?'⚡ ТВОЯ АТАКА':'🧱 ОБОРОНА'}</span><span class="muted small">${ev.minute}′ · ${ev.zone}</span></div><div class="eyebrow">Ключевой эпизод</div><h2 class="event-title">${esc(ev.title)}</h2><div class="event-visual" style="position:relative;background:repeating-linear-gradient(90deg,#1b5935 0 12%,#22683d 12% 24%);border:2px solid #b8d6b5;outline:1px solid #ffffff33"><span style="position:absolute;left:12%;top:20%;font-size:22px">👕</span><span style="position:absolute;left:30%;top:58%;font-size:22px">👕</span><span style="position:absolute;left:49%;top:35%;font-size:26px">⚽</span><span style="position:absolute;right:28%;top:18%;font-size:22px">👕</span><span style="position:absolute;right:12%;bottom:15%;font-size:22px">🧤</span><span style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:#ffffff66"></span><span style="position:absolute;left:calc(50% - 20px);top:calc(50% - 20px);width:40px;height:40px;border:1px solid #ffffff66;border-radius:50%"></span></div><p class="event-description">${esc(ev.description)}</p><p class="muted small">${esc('Твоя команда: '+activePlayers(club).slice(0,3).map(p=>p.name).join(', ')+' · '+matchState.opponent.name+': '+(matchState.opponent.players||['Игрок соперника 9','Игрок соперника 10','Игрок соперника 11']).slice(0,3).join(', '))}</p><div class="divider"></div><details class="card" style="margin:12px 0;padding:12px"><summary><strong>🔄 Сделать замену</strong></summary><p class="muted small">Выбери игрока основы и замену со скамейки.</p>${activePlayers(club).map(p=>`<div class="statline"><span>${esc(p.name)} · ${p.rating}</span><select class="select-compact" data-sub-out="${esc(p.id)}"><option value="">Заменить на…</option>${benchPlayers(club).map(q=>`<option value="${esc(q.id)}" ${playerIsUnavailable(q)?'disabled':''}>${esc(q.name)} (${q.rating})${playerIsUnavailable(q)?' · '+esc(unavailableReason(q)):''}</option>`).join('')}</select><button class="btn btn-secondary btn-sm" data-action="manual-sub" data-out="${esc(p.id)}">Ок</button></div>`).join('')}</details><div class="event-top"><div class="eyebrow">Выбери действие</div><span class="pill pill-lime">⏱ 60 секунд · случайный выбор по таймеру</span></div><div class="choice-grid">${actions.map((a,i)=>`<button class="match-choice" data-action="match-choice" data-choice="${a.id}"><span class="choice-num">${i+1}</span><span><strong>${a.icon} ${a.name}</strong><small>${a.desc}<br><span style="color:${a.risk==='Высокий'?'#ff9d8f':a.risk==='Низкий'?'var(--lime)':'#e1c576'}">Риск: ${a.risk}</span></small></span></button>`).join('')}</div></section><section class="card"><div class="card-header"><div><div class="eyebrow">Match commentary</div><h2 class="h2">ХРОНИКА МАТЧА</h2></div></div><div class="match-log">${matchState.log.slice(-5).reverse().map(l=>`<div class="log-row"><span class="log-minute">${l.minute}′</span><span>${esc(l.text)}</span></div>`).join('')}</div></section></div>`;
  }
  function renderMatchResult(club){
    const m=matchState;const won=m.score[0]>m.score[1],draw=m.score[0]===m.score[1];const title=won?'ПОБЕДА!':draw?'БОЕВАЯ НИЧЬЯ':'В ЭТОТ РАЗ НЕ ПОВЕЗЛО';const result=won?'W':draw?'D':'L';
    return `<div class="section-heading"><div><div class="eyebrow">Full time</div><h1 class="h1">ФИНАЛЬНЫЙ СВИСТОК</h1><p class="page-subtitle">Матч закончен. Результат записан в историю клуба.</p></div><span class="pill ${won?'pill-lime':''}">${won?'🏆 Победа':draw?'🤝 Ничья':'Матч завершён'}</span></div><div class="match-shell">${matchBoard(club)}<section class="card" style="text-align:center;padding:29px"><div class="eyebrow">Full-time report</div><h2 class="h1" style="font-size:44px;margin-top:9px">${title}</h2><div class="result-stamp">${m.score[0]} : ${m.score[1]}</div><p class="muted small" style="max-width:470px;margin:0 auto">${won?'Отличная работа! Твои решения помогли забрать три очка.':draw?'Равная игра — ни одна команда не смогла дожать соперника.':'Поражение — повод разобрать решения и вернуться сильнее.'}</p><div class="result-details"><div class="result-metric"><span>Награда</span><strong style="color:var(--gold)">+${formatMoney(m.reward)}</strong></div></div><div class="divider"></div><div class="match-log" style="text-align:left;margin-bottom:20px">${m.log.map(l=>`<div class="log-row"><span class="log-minute">${l.minute}′</span><span>${esc(l.text)}</span></div>`).join('')}</div><div style="display:flex;justify-content:center;gap:9px;flex-wrap:wrap"><button class="btn btn-primary" data-action="match-again">Играть ещё раз ↗</button><button class="btn btn-secondary" data-action="nav" data-view="home">В главное меню</button></div></section></div>`;
  }
  function renderReveal(){
    if(!reveal)return '';
    const packLabel={starter:'АГЕНТСТВО ★',national:'АГЕНТСТВО ★★',pro:'АГЕНТСТВО ★★★'}[reveal.type]||'АГЕНТСТВО';
    return `<div class="pack-opening"><div class="opening-box"><div class="brand-mark" style="margin:0 auto">ZF</div><div class="eyebrow" style="margin-top:18px">PACK OPENING · ${packLabel}</div><div class="opening-flash">НОВЫЕ <span>ПОДПИСАНИЯ</span></div><p class="muted small">Контракт каждой новой карточки — 30 дней. Повторки можно обменять на монеты или продлить контракт.</p>${(reveal.duplicateRewards||[]).length?`<div class="card" style="margin:12px 0"><strong>Повторные карточки: ${(reveal.duplicateRewards||[]).length}</strong>${reveal.duplicateRewards.map(p=>`<div class="statline"><span>${esc(p.name)} · OVR ${p.rating}</span><span><button class="btn btn-secondary btn-sm" data-action="duplicate-money" data-player-id="${esc(p.id)}">${formatMoney(saleValue(p,true))}</button> <button class="btn btn-secondary btn-sm" data-action="duplicate-contract" data-player-id="${esc(p.id)}">+5 дней</button></span></div>`).join('')}</div>`:''}<div class="revealed-cards">${reveal.players.filter(p=>!p.duplicate||reveal.duplicateRewards.some(d=>d.id===p.id)).map(p=>`<div class="revealed-card">${renderPlayerCard(p)}</div>`).join('')}</div><div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap"><button class="btn btn-primary" data-action="close-opening">Забрать игроков ✓</button><button class="btn btn-secondary" data-action="close-opening">✕ Выйти из пака</button></div></div></div>`;
  }
  function renderAssignModal(club,index){
    const oldId=club.lineup[index];const old=club.players.find(p=>p.id===oldId);const target=(FORMATIONS[club.formation]||FORMATIONS['4-3-3'])[index].role;const players=club.players.slice().sort((a,b)=>(positionScore(b,target)-positionScore(a,target))||(b.rating-a.rating));
    return `<div class="modal-backdrop" data-action="close-modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><div class="modal-head"><div><div class="eyebrow">Squad management</div><h2>ЗАМЕНИТЬ ИГРОКА</h2><p class="muted small" style="margin:6px 0 0">Позиция: ${esc((FORMATIONS[club.formation]||FORMATIONS['4-3-3'])[index].role)} · Сейчас: ${esc(old?.name||'Пусто')}</p></div><button class="icon-btn" data-action="close-modal">✕</button></div><div class="modal-player-list">${players.map(p=>{const starter=club.lineup.includes(p.id),unavailable=playerIsUnavailable(p);return `<button class="modal-player ${unavailable?'player-unavailable':''}" data-portrait-key="${esc(p.wiki||p.name)}" ${p.wiki?`data-wiki="${esc(p.wiki)}"`:''} data-action="assign-player" data-slot="${index}" data-player-id="${esc(p.id)}" ${unavailable?'disabled':''} ><div class="mini-player" style="--rarity-color:${rarityColor(p.rating)}"><img class="squad-photo" alt="${esc(p.name)}" src="${esc(PLAYER_PHOTOS[p.wiki]||makeFallbackPortrait(p.wiki||p.name))}"><span class="mini-rating">${p.rating+(club.captainId===p.id?1:0)}</span></div><div class="modal-player-copy"><strong>${esc(p.name)}</strong><small>${esc((p.positions||[p.position]).join(' / '))} · ${rarityFor(p.rating).name}${p.injuryMatches>0?` · 🤕 Травма (${p.injuryMatches})`:''}${p.redCardMatches>0?` · 🟥 Удалён (${p.redCardMatches})`:''}${p.yellowBanMatches>0?` · ⛔ Бан за жёлтые (${p.yellowBanMatches})`:''}${p.yellowCards>0?` · 🟨 ${p.yellowCards}/5`:''}${contractDays(p)===0?' · Контракт истёк':''}</small></div><span class="rating-badge">${starter?'В основе':`OVR ${p.rating}`} </span></button>`;}).join('')}</div></section></div>`;
  }

  // ----- User actions -----
  function go(viewName){view=viewName;editSlotIndex=null;reveal=null;render();window.scrollTo({top:0,behavior:'smooth'});}
  function chooseClub(id){const c=db.clubs.find(x=>x.id===id);if(!c)return;db.activeClubId=id;view='home';matchState={stage:'idle'};saveDB();render();toast(`Добро пожаловать в ${c.name}!`);}
  async function createClubFromForm(form){
    const fd=new FormData(form);const name=String(fd.get('clubName')||'').trim();const country=String(fd.get('country')||'ua');const login=String(fd.get('clubLogin')||'').trim();const password=String(fd.get('clubPassword')||'');
    if(name.length<2){toast('Название клуба должно содержать минимум 2 символа.','error');return;}
    if(!/^[A-Za-z0-9_]{3,24}$/.test(login)){toast('Логин: 3–24 символа, только латиница, цифры и _.','error');return;}
    if(password.length<6){toast('Пароль должен содержать минимум 6 символов.','error');return;}
    if(accountClubs().some(c=>c.login?.toLowerCase()===login.toLowerCase())){toast('Этот логин уже занят другим клубом.','error');return;}
    createDraft.symbol=(createDraft.layers||[]).find(l=>l.kind==='symbol')?.value||'⚡';
    const club=makeClub(name,country,createDraft.symbol,createDraft.logoColor,String(fd.get('kitPrimary')||'#c8ff44'),String(fd.get('kitSecondary')||'#172318'),String(fd.get('kitPattern')||'plain'));
    club.login=login;club.passwordHash=await hashPassword(password);club.lineup=club.players.slice(0,11).map(p=>p.id);recordTrophies(club);db.activeClubId=club.id;view='home';startMode='choose';matchState={stage:'idle'};saveDB();render();toast(`${countryData(country).flag} Клуб создан! Стартовый пак из 16 игроков получен.`);
  }
  function openPack(type){
    const club=currentClub();if(!club)return;
    const packs={starter:{price:2,count:3,min:50,max:88},national:{price:8,count:4,min:55,max:91},pro:{price:25,count:5,min:60,max:94},elite:{price:75,count:5,min:65,max:96},legend:{price:200,count:6,min:70,max:99}};const pack=packs[type];if(!pack)return;
    if(club.coins<pack.price){toast('Недостаточно монет для этого пака. Сыграй матч и получи награду.','error');return;}
    club.coins-=pack.price;
    const newPlayers=[];
    for(let i=0;i<pack.count;i++){
      const pool=REAL_PLAYERS;
      let base=pick(pool);const rating=base.rating;base={...base,rating};
      const position=base.position;
      const created=createPlayer(position,base.rating,base.name,base.country, {id:'card-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),wiki:base.wiki,realClub:base.club,realPlayer:true,displayPosition:({'GK':'ВР','LB':'ЛЗ','CB':'ЦЗ','RB':'ПЗ','CDM':'ОП','CM':'ЦП','CAM':'АП','LW':'ЛВ','RW':'ПВ','ST':'ЦН'})[position]||position});
      created.positions=({'Nico Paz':['CAM','CM','RW'],'Jude Bellingham':['CAM','CM'],'Federico Valverde':['CM','CDM','RM'],'Joško Gvardiol':['CB','LB'],'Achraf Hakimi':['RB','RWB'],'Nuno Mendes':['LB','LWB'],'Pedri':['CM','CAM'],'Kai Havertz':['ST','CAM'],'Lamine Yamal':['RW','LW'],'Raphinha':['RW','LW'],'Harry Kane':['ST','CF'],'Julián Álvarez':['ST','CF','CAM'],'Cristiano Ronaldo':['ST','LW'],'Andriy Yarmolenko':['RW','CAM'],'Neymar':['LW','CAM']})[base.wiki]||REAL_PLAYER_POSITIONS[base.wiki]||[base.position];created.rating=base.rating;created.country=base.country;created.realClub=base.club;created.wiki=base.wiki;created.realPlayer=true;created.displayPosition=({GK:'ВР',LB:'ЛЗ',CB:'ЦЗ',RB:'ПЗ',CDM:'ОП',CM:'ЦП',CAM:'АП',LW:'ЛВ',RW:'ПВ',ST:'ЦН'})[base.position]||base.position;
      const duplicate=club.players.find(p=>p.name===created.name)||newPlayers.find(p=>p.name===created.name);if(duplicate){created.duplicateOf=duplicate.id;created.duplicate=true;}created.contractUntil=Date.now()+30*86400000;newPlayers.push(created);
    }
    const actualPlayers=[];let duplicateRewards=[];newPlayers.forEach(p=>{if(p.duplicate){duplicateRewards.push(p); }else actualPlayers.push(p);});club.players.push(...actualPlayers);club.stats.packsOpened=(club.stats.packsOpened||0)+1;recordTrophies(club);saveDB();reveal={type,players:newPlayers,duplicateRewards};render();
  }
  function positionScore(p,target){const positions=p.positions||[p.position];if(positions.includes(target))return 20;if(positions.some(x=>compatible(x,target)))return 5;if(target==='GK')return positions.includes('GK')?0:-22;if(positions.includes('GK'))return -30;return -12;}
  function assignPlayer(slotIndex,playerId){
    const club=currentClub();if(!club)return;
    const newPlayer=club.players.find(p=>p.id===playerId);if(!newPlayer)return;if(playerIsUnavailable(newPlayer)){toast(`Игрок недоступен: ${unavailableReason(newPlayer)}.`,'error');return;}const target=(FORMATIONS[club.formation]||FORMATIONS['4-3-3'])[slotIndex].role;newPlayer.positionPenalty=Math.max(0,20-positionScore(newPlayer,target));
    const previousId=club.lineup[slotIndex];const otherIndex=club.lineup.indexOf(playerId);
    if(otherIndex>=0){club.lineup[otherIndex]=previousId||null;}club.lineup[slotIndex]=playerId;
    editSlotIndex=null;saveDB();render();toast(`${newPlayer.name}: рейтинг на позиции ${target} изменён на ${-newPlayer.positionPenalty}.`);
  }
  function autoLineup(){
    const club=currentClub();if(!club)return;
    const slots=(FORMATIONS[club.formation]||FORMATIONS['4-3-3']);
    const remaining=club.players.filter(p=>!playerIsUnavailable(p)).sort((a,b)=>b.rating-a.rating);const result=[];if(remaining.length<slots.length){toast(`Недостаточно доступных футболистов: нужно ${slots.length}, сейчас ${remaining.length}.`,'error');return;}
    for(const slot of slots){
      let bestIndex=0;let bestScore=-Infinity;
      remaining.forEach((p,i)=>{let score=p.rating+positionScore(p,slot.role);if(positionScore(p,slot.role)<=-100)score-=1000;if(p.injuryMatches>0)score-=8;if(contractDays(p)===0)score-=50;if(score>bestScore){bestScore=score;bestIndex=i;}});
      result.push(remaining.splice(bestIndex,1)[0].id);
    }
    club.lineup=result;saveDB();render();toast('Состав автоматически собран по рейтингу и позициям.');
  }
  function compatible(a,b){if(a===b)return true;const groups=[['LB','RB','LWB','RWB'],['CM','CAM','CDM','LM','RM'],['LW','RW','ST','CF'],['CB','CDM']];return groups.some(g=>g.includes(a)&&g.includes(b));}
  function setPattern(pattern){const club=currentClub();if(!club)return;club.kit.pattern=pattern;const hidden=$('#editKitPattern');if(hidden)hidden.value=pattern;$$('[data-action="set-pattern"]').forEach(b=>b.classList.toggle('active',b.dataset.pattern===pattern));const shirt=$('#kitShirt');if(shirt)shirt.className=`kit-shirt pattern-${pattern}`;saveDB();}
  function startSearch(){
    const club=currentClub();if(!club)return;
    const starters=activePlayers(club);
    if(starters.length!==11){toast('Сначала собери полный стартовый состав из 11 игроков.','error');view='team';render();return;}
    const unavailable=starters.filter(playerIsUnavailable);
    if(unavailable.length){toast(`Поиск матча недоступен: ${unavailable.map(p=>`${p.name} — ${unavailableReason(p)}`).join('; ')}.`,'error');view='team';render();return;}
    refreshEnergy(club);if(club.energy<1){toast('Энергия команды закончилась. Подожди восстановления или используй пополнение.','error');view='match';render();return;}matchState={stage:'searching'};render();
    matchState.timer=setTimeout(()=>{
      const base=BOT_CLUBS[rand(0,BOT_CLUBS.length-1)];
      const userR=teamRating(club);const opponentRating=clamp(userR+rand(-12,12),55,84);
      matchState={stage:'found',opponent:{name:base.name,symbol:base.symbol,country:base.country,color:pick(['#f18b65','#76b8ff','#d3d5d0','#e6adff','#f6cf56']),rating:opponentRating,players:BOT_PLAYER_NAMES.slice(0,11)},score:[0,0],log:[]};
      render();
    },1800);
  }
  function beginMatch(){
    const club=currentClub();if(!club)return;refreshEnergy(club);if(club.energy<1){toast('Нет энергии для матча.','error');return;}
    if(!club.lineup||club.lineup.length<11){toast('Сначала настрой стартовый состав.','error');return;}const unavailable=activePlayers(club).filter(playerIsUnavailable);if(unavailable.length){toast(`В стартовом составе есть недоступные игроки: ${unavailable.map(p=>p.name).join(', ')}. Замени их.`,'error');view='team';render();return;}club.energy--;saveDB();
    const opp=matchState.opponent||{name:'Northside United',symbol:'❄️',country:'🇳🇴',color:'#a5c7ed',rating:68};
    matchState={stage:'live',opponent:opp,score:[0,0],eventIndex:0,minute:8,currentEvent:null,turnOrder:['home','away'],multiplayerTurnModel:{roles:['attacker','defender'],alternate:true,diceSides:20},log:[{minute:0,text:'Матч начался! Обе команды готовы бороться за победу.'}],goodChoices:0,totalChoices:0,preMatchStatuses:Object.fromEntries(club.players.map(p=>[p.id,{injury:p.injuryMatches||0,red:p.redCardMatches||0,yellowBan:p.yellowBanMatches||0}]))};
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
  function resolveChoice(choice){
    const club=currentClub();const m=matchState;if(!club||m.stage!=='live')return;
    if(m.actionTimer)clearTimeout(m.actionTimer);m.actionTimer=null;m.actionDeadline=null;const ev=m.currentEvent;const style=STYLES[club.style]||STYLES.balanced;
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
    if(!ev.kind&&incidentRoll<.03){const p=pick(activePlayers(club));p.injuryMatches=Math.max(p.injuryMatches||0,rand(1,3));text+=` 🤕 Травма: ${p.name} пропустит ${p.injuryMatches} матч(а).`;}
    else if(!ev.kind&&incidentRoll<.055){const p=pick(activePlayers(club));p.redCardMatches=Math.max(p.redCardMatches||0,1);text+=` 🟥 Красная карточка! ${p.name} удалён и пропустит следующий матч.`;}
    else if(!ev.kind&&incidentRoll<.16){
      const p=pick(activePlayers(club));p.yellowCards=(p.yellowCards||0)+1;p.yellowCardTotal=(p.yellowCardTotal||0)+1;
      if(p.yellowCards>=5){p.yellowCards=0;p.yellowBanMatches=Math.max(p.yellowBanMatches||0,1);text+=` 🟨 Пятая жёлтая карточка у ${p.name}! Он пропустит следующий матч.`;}
      else{text+=` 🟨 Жёлтая карточка игроку ${p.name} (${p.yellowCards}/5).`;}
    }
    else if(!ev.kind&&incidentRoll<.29){text+=` 🚩 Угловой: ${pick(activePlayers(club)).name} подаёт в штрафную.`;if(Math.random()<.18){m.score[0]++;text+=' ГОЛ после углового!';}}
    else if(!ev.kind&&incidentRoll<.39){text+=` 🎯 Штрафной у ${pick(activePlayers(club)).name}.`;if(Math.random()<.12){m.score[0]++;text+=' Прямой удар — ГОЛ!';}}
    else if(!ev.kind&&incidentRoll<.46){text+=` ⚽ Пенальти! ${pick(activePlayers(club)).name} у точки.`;if(Math.random()<.72){m.score[0]++;text+=' Пенальти реализован!';}else text+=' Вратарь отбил удар!';}
    if(m.eventIndex===4&&!m.substitutionsDone&&benchPlayers(club).length){m.substitutionsDone=true;const sub=benchPlayers(club).filter(p=>!playerIsUnavailable(p)).find(p=>positionScore(p,(FORMATIONS[club.formation]||FORMATIONS['4-3-3'])[8].role)>-100);const out=activePlayers(club).slice().sort((a,b)=>a.rating-b.rating)[0];if(sub&&out){const idx=club.lineup.indexOf(out.id);club.lineup[idx]=sub.id;text+=` 🔄 Замена: ${out.name} → ${sub.name}.`;}}
    m.log.push({minute:ev.minute,text:`🎲 Кубик ${dice} · модификаторы команды ${teamMod>=0?'+':''}${teamMod}, тактики ${tacticalMod>=0?'+':''}${tacticalMod}, игрока ${playerMod>=0?'+':''}${playerMod} = ${diceTotal}. ${text}`});
    if(m.eventIndex>=9){finishMatch();return;}
    m.eventIndex++;makeCurrentEvent();render();
  }
  function finishMatch(){
    const club=currentClub();const m=matchState;
    m.stage='result';m.minute=90;
    const won=m.score[0]>m.score[1],draw=m.score[0]===m.score[1];m.reward=won?0.8:draw?0.55:0.35;
    club.coins+=m.reward;club.stats.matches++;club.sponsorSlots=club.sponsorSlots||{kit:null,title:null,extra:null};m.sponsorBonus=0;Object.keys(club.sponsorSlots).forEach(type=>{const contract=club.sponsorSlots[type];if(contract&&contract.until>Date.now()){const deal=SPONSOR_DEALS.find(x=>x.id===contract.id);if(deal){const bonus=deal.match+(m.score[0]>m.score[1]?deal.win:0);club.coins+=bonus/1000;m.sponsorBonus+=bonus/1000;}}else if(contract)club.sponsorSlots[type]=null;});
    if(won)club.stats.wins++;else if(draw)club.stats.draws++;else club.stats.losses++;
    club.stats.goalsFor+=m.score[0];club.stats.goalsAgainst+=m.score[1];
    // Only bans/injuries that existed before this match count down; new incidents remain active.
    club.players.forEach(p=>{const prior=m.preMatchStatuses?.[p.id];if(prior?.injury>0)p.injuryMatches=Math.max(0,(p.injuryMatches||0)-1);if(prior?.red>0)p.redCardMatches=Math.max(0,(p.redCardMatches||0)-1);if(prior?.yellowBan>0)p.yellowBanMatches=Math.max(0,(p.yellowBanMatches||0)-1);});
    const result=won?'W':draw?'D':'L';club.history.unshift({opponent:m.opponent.name,score:`${m.score[0]} : ${m.score[1]}`,result,date:new Date().toLocaleDateString('ru-RU')});club.history=club.history.slice(0,12);
    m.log.push({minute:90,text:`Финальный свисток. ${won?'Победа твоего клуба!':draw?'Ничья — команды разделили очки.':'Поражение. В следующем матче можно отыграться.'} Награда: ${formatMoney(m.reward)}.${m.sponsorBonus?` Спонсорский бонус: +${m.sponsorBonus}.`:''}`});
    recordTrophies(club);saveDB();render();
  }

  function vibrate(pattern=18){if(db.vibration!==false&&navigator.vibrate){try{navigator.vibrate(pattern);}catch(_){}}}
  function refreshLogoBuilder(){const preview=$('#createCrest');if(!preview)return;preview.innerHTML=(createDraft.layers||[]).map(l=>`<span class="crest-layer" data-layer-id="${esc(l.id)}" style="left:${l.x}%;top:${l.y}%;font-size:${l.size}px;color:${esc(l.color)}">${esc(l.value)}</span>`).join('');const list=$('#logoLayerList');if(list)list.innerHTML=(createDraft.layers||[]).map(l=>`<div class="logo-layer-row"><span>${esc(l.value)}</span><button type="button" class="btn btn-quiet btn-sm" data-action="logo-layer-up" data-layer-id="${esc(l.id)}">↑</button><button type="button" class="btn btn-quiet btn-sm" data-action="logo-layer-down" data-layer-id="${esc(l.id)}">↓</button><button type="button" class="btn btn-quiet btn-sm" data-action="logo-layer-delete" data-layer-id="${esc(l.id)}">✕</button></div>`).join('');}
  let logoDrag=null;
  $('#app').addEventListener('pointerdown',e=>{const layer=e.target.closest('.crest-layer');if(!layer)return;const preview=layer.closest('#createCrest');if(!preview)return;const item=createDraft.layers.find(x=>x.id===layer.dataset.layerId);if(!item)return;logoDrag={id:item.id,preview};layer.setPointerCapture?.(e.pointerId);e.preventDefault();});
  $('#app').addEventListener('pointermove',e=>{if(!logoDrag)return;const r=logoDrag.preview.getBoundingClientRect();const item=createDraft.layers.find(x=>x.id===logoDrag.id);if(!item)return;item.x=Math.max(5,Math.min(95,(e.clientX-r.left)/r.width*100));item.y=Math.max(5,Math.min(95,(e.clientY-r.top)/r.height*100));const el=logoDrag.preview.querySelector(`[data-layer-id="${logoDrag.id}"]`);if(el){el.style.left=item.x+'%';el.style.top=item.y+'%';}});
  $('#app').addEventListener('pointerup',()=>{logoDrag=null;});
  // ----- Event binding (delegated so it continues to work after re-rendering) -----
  $('#app').addEventListener('click',async e=>{
    const btn=e.target.closest('[data-action]');if(!btn)return;
    const action=btn.dataset.action; if(['match-choice','open-pack','assign-player','quick-assign','set-theme'].includes(action))vibrate(action==='match-choice'?[25,20,35]:18);
    if(action==='open-player-card'){const c=currentClub();if(!c)return;const id=btn.dataset.playerId||'';const wiki=btn.dataset.playerWiki||'';const name=btn.dataset.playerName||'';const owned=c.players.find(p=>p.id===id)||c.players.find(p=>(wiki&&p.wiki===wiki)||(name&&p.name===name));playerModalRef={id:owned?.id||id,wiki,name};render();return;}
    if(action==='close-player-modal'){playerModalRef=null;render();return;}
    if(action==='close-player-modal-backdrop'&&e.target===btn){playerModalRef=null;render();return;}
    if(action==='create-club-submit'){const form=$('#createClubForm');if(!form)return;if(!form.reportValidity())return;try{await createClubFromForm(form);}catch(err){console.error('Club creation failed:',err);toast('Не удалось создать клуб. Проверь данные и попробуй ещё раз.','error');}return;}
    if(action==='start-create'){startMode='create';createDraft={symbol:'⚡',logoColor:'#c8ff44',shape:'shield',layers:[{id:'base',kind:'symbol',value:'⚡',x:50,y:48,size:34,color:'#10140c'}]};render();return;}
    if(action==='start-back'){startMode='choose';render();return;}
    if(action==='select-club'){const c=db.clubs.find(x=>x.id===btn.dataset.clubId);if(!c)return;const login=(prompt('Логин клуба:')||'').trim();if(!login)return;const password=prompt('Пароль клуба:')||'';if(!password)return;(async()=>{try{if(login.toLowerCase()!==String(c.login||'').toLowerCase()||(c.passwordHash&&await hashPassword(password)!==c.passwordHash)){toast('Неверный логин или пароль.','error');return;}if(!c.passwordHash){const chosen=await hashPassword(password);c.passwordHash=chosen;c.login=login;saveDB();}chooseClub(c.id);}catch(e){toast('Не удалось проверить пароль в этом браузере.','error');}})();return;}
    if(action==='switch-account-settings'){db.activeClubId=null;view='home';startMode='choose';matchState={stage:'idle'};saveDB();render();return;}
    if(action==='set-theme'){db.theme=btn.dataset.theme||'classic';themePanelOpen=true;saveDB();render();toast('Тема оформления изменена.');return;}
    if(action==='toggle-theme-panel'){themePanelOpen=!themePanelOpen;render();return;}
    if(action==='toggle-contracts-panel'){contractsPanelOpen=!contractsPanelOpen;render();return;}
    if(action==='delete-current-club'){const c=currentClub();if(!c)return;if(!confirm(`Удалить клуб «${c.name}» вместе со всем составом и историей?`))return;db.clubs=db.clubs.filter(x=>x.id!==c.id);db.activeClubId=null;view='home';startMode='choose';matchState={stage:'idle'};saveDB();render();toast('Клуб удалён.');return;}
    if(action==='logout-account'){db.activeClubId=null;view='home';startMode='choose';matchState={stage:'idle'};saveDB();render();return;}
    if(action==='delete-club'){const id=btn.dataset.clubId;const c=db.clubs.find(x=>x.id===id);if(!c)return;if(!confirm(`Удалить клуб «${c.name}» вместе с составом и историей?`))return;db.clubs=db.clubs.filter(x=>x.id!==id);if(db.activeClubId===id)db.activeClubId=null;saveDB();startMode='choose';view='home';render();toast('Клуб удалён.');return;}
    if(action==='nav'){go(btn.dataset.view);return;}
    if(action==='sell-player'){const c=currentClub();const p=c?.players.find(x=>x.id===btn.dataset.playerId);if(!p)return;if(c.lineup.includes(p.id)){toast('Игроки стартового состава не продаются. Сначала замени его.','error');return;}const base=saleValue(p,false)*1.35;const low=base*.8,high=base*1.35;const price=Math.round((low+Math.random()*(high-low))*100)/100;c.players=c.players.filter(x=>x.id!==p.id);c.coins+=price;playerModalRef=null;saveDB();render();toast(`${p.name} продан. Выпало ${formatMoney(price)} (диапазон ${formatMoney(low)}–${formatMoney(high)}).`);return;}
    if(action==='sign-sponsor'){const c=currentClub();const deal=SPONSOR_DEALS.find(x=>x.id===btn.dataset.sponsor);if(!deal)return;if(teamRating(c)<(deal.minRating||0)||(c.stats.wins||0)<(deal.minWins||0)){toast(`Требования спонсора: ${deal.req||'не выполнены'}.`,'error');return;}c.sponsorSlots=c.sponsorSlots||{kit:null,title:null,extra:null};const type=btn.dataset.sponsorType||deal.type;if(c.sponsorSlots[type]&&c.sponsorSlots[type].until>Date.now()){toast('Это рекламное место уже занято.','error');return;}if(c.coins<deal.sign/1000){toast('Недостаточно монет для подписания.','error');return;}c.coins-=deal.sign/1000;c.sponsorSlots[type]={id:deal.id,type,until:Date.now()+30*86400000,matchBonus:deal.match,winBonus:deal.win};saveDB();render();toast(`${deal.name}: контракт подписан на 30 дней.`);return;}
    if(action==='claim-sponsor'){const c=currentClub();const id=btn.dataset.sponsor;const goals={local:3,sports:2,energy:5,bank:8,kit:4,phone:6,car:5,food:5,tech:7,water:4,travel:10,insurance:6,game:3,media:5,global:6};const wins=['sports','water','global'].includes(id);const progress=id==='car'?c.stats.goalsFor:id==='game'?c.stats.packsOpened:wins?c.stats.wins:c.stats.matches;c.sponsorClaims=c.sponsorClaims||{};if(progress<(goals[id]||999)||c.sponsorClaims[id])return;const reward={local:220,sports:300,energy:450,bank:650,kit:360,phone:480,car:330,food:400,tech:560,water:350,travel:800,insurance:520,game:310,media:430,global:1000}[id]||200;c.coins+=reward/1000;c.sponsorClaims[id]=true;saveDB();render();toast(`Спонсор выплатил ${formatMoney(reward/1000)}.`);return;}
    if(action==='refill-energy'||action==='watch-ad'){const c=currentClub();refreshEnergy(c);if(c.energy>=5){toast('Энергия уже полная.');return;}if(action==='refill-energy'){if(c.coins<0.12){toast('Недостаточно монет.','error');return;}c.coins-=0.12;}c.energy=Math.min(5,c.energy+3);c.energyAt=Date.now();saveDB();render();toast('Энергия восстановлена на 3.');return;}
    if(action==='switch-club'){db.activeClubId=null;view='home';matchState={stage:'idle'};editSlotIndex=null;reveal=null;saveDB();startMode='choose';render();return;}
    if(action==='edit-create-symbol'){createDraft.symbol=btn.dataset.symbol;return;}
    if(action==='logo-add-symbol'||action==='logo-add-text'){const value=action==='logo-add-text'?($('#createLogoText')?.value||'').trim():btn.dataset.symbol;if(!value)return;createDraft.layers.push({id:'layer-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,5),kind:action==='logo-add-text'?'text':'symbol',value,x:50,y:50,size:action==='logo-add-text'?18:26,color:'#10140c'});refreshLogoBuilder();return;}
    if(action==='logo-layer-delete'){createDraft.layers=createDraft.layers.filter(x=>x.id!==btn.dataset.layerId);refreshLogoBuilder();return;}
    if(action==='logo-layer-up'||action==='logo-layer-down'){const i=createDraft.layers.findIndex(x=>x.id===btn.dataset.layerId);if(i>=0){const j=action==='logo-layer-up'?Math.max(0,i-1):Math.min(createDraft.layers.length-1,i+1);[createDraft.layers[i],createDraft.layers[j]]=[createDraft.layers[j],createDraft.layers[i]];refreshLogoBuilder();}return;}
    if(action==='edit-logo-symbol'){const input=$('#editLogoSymbol');if(input)input.value=btn.dataset.symbol;$$('[data-action="edit-logo-symbol"]').forEach(x=>x.classList.toggle('active',x===btn));const crest=$('#editCrest');if(crest)crest.textContent=btn.dataset.symbol;const preview=$('#editorPreviewCrest');if(preview)preview.textContent=btn.dataset.symbol;return;}
    if(action==='set-captain'){const c=currentClub();c.captainId=btn.dataset.playerId;saveDB();render();toast('Капитан назначен: +1 к рейтингу.');return;}if(action==='edit-slot'){editSlotIndex=Number(btn.dataset.slot);render();return;}
    if(action==='close-modal'){editSlotIndex=null;render();return;}
    if(action==='close-modal-backdrop'&&e.target===btn){editSlotIndex=null;render();return;}
    if(action==='assign-player'){assignPlayer(Number(btn.dataset.slot),btn.dataset.playerId);return;}
    if(action==='quick-assign'){const club=currentClub();const playerId=btn.dataset.playerId;const candidate=club.players.find(p=>p.id===playerId);if(playerIsUnavailable(candidate)){toast(`Игрок недоступен: ${unavailableReason(candidate)}.`,'error');return;}const idx=club.lineup.indexOf(playerId);if(idx>=0){editSlotIndex=idx;}else{const weaker=club.lineup.map((id,i)=>({p:club.players.find(p=>p.id===id),i})).filter(x=>x.p).sort((a,b)=>a.p.rating-b.p.rating)[0];editSlotIndex=weaker?weaker.i:0;}render();return;}
    if(action==='auto-lineup'){autoLineup();return;}
    if(action==='set-style'){const c=currentClub();c.style=btn.dataset.style;saveDB();render();toast(`Игровой стиль: ${STYLES[c.style].name}`);return;}
    if(action==='open-pack'){openPack(btn.dataset.pack);return;}
    if(action==='buy-daily-player'){const c=currentClub();const shop=dailyShop(c);const offer=shop.offers.find(o=>o.wiki===btn.dataset.wiki);const base=REAL_PLAYERS.find(p=>p.wiki===btn.dataset.wiki);if(!offer||!base)return;if(c.coins<offer.price){toast('Недостаточно монет.','error');return;}if(c.players.some(p=>p.wiki===base.wiki)){toast('Эта карточка уже есть в коллекции.','error');return;}c.coins-=offer.price;const np=createPlayer(base.position,base.rating,base.name,base.country,{id:'daily-'+Date.now().toString(36),wiki:base.wiki,realClub:base.club,realPlayer:true});np.positions=REAL_PLAYER_POSITIONS[base.wiki]||[base.position];np.contractUntil=Date.now()+30*86400000;c.players.push(np);saveDB();render();toast(`${base.name} подписан за ${formatMoney(offer.price)}.`);return;}
    if(action==='free-daily-pack'){const c=currentClub();const shop=dailyShop(c);if(shop.freeClaimed){toast('Бесплатная карта уже получена сегодня.','error');return;}const pool=REAL_PLAYERS.filter(p=>!c.players.some(x=>x.wiki===p.wiki));if(!pool.length){toast('В базе больше нет новых карточек.','error');return;}const base=pick(pool);const np=createPlayer(base.position,base.rating,base.name,base.country,{id:'free-daily-'+Date.now().toString(36),wiki:base.wiki,realClub:base.club,realPlayer:true});np.positions=REAL_PLAYER_POSITIONS[base.wiki]||[base.position];np.contractUntil=Date.now()+30*86400000;c.players.push(np);shop.freeClaimed=true;saveDB();render();toast(`Бесплатная карта: ${base.name}!`);return;}

    if(action==='collection-mode'){collectionMode=btn.dataset.mode;$$('[data-action="collection-mode"]').forEach(b=>b.className='btn '+(b.dataset.mode===collectionMode?'btn-primary':'btn-secondary')+' btn-sm');applyCollectionFilters();return;}
    if(action==='close-opening'){if(reveal?.duplicateRewards?.length){toast('Сначала реши судьбу каждой повторной карточки.','error');return;}reveal=null;view='packs';render();toast('Новые футболисты в коллекции.');return;}
    if(action==='duplicate-money'||action==='duplicate-contract'){if(!reveal)return;const p=reveal.duplicateRewards?.find(x=>x.id===btn.dataset.playerId);if(!p)return;const c=currentClub();if(action==='duplicate-money'){const amount=saleValue(p,true);c.coins+=amount;}else{const owned=c.players.find(x=>x.id===p.duplicateOf);if(!owned){toast('Оригинальная карточка не найдена.','error');return;}owned.contractUntil=Math.max(Date.now(),owned.contractUntil||Date.now())+5*86400000;}reveal.duplicateRewards=reveal.duplicateRewards.filter(x=>x.id!==p.id);reveal.players=reveal.players.filter(x=>x.id!==p.id);saveDB();render();toast(action==='duplicate-money'?'Повторка обменена на монеты.':'Контракт продлён на 5 дней.');return;}
    if(action==='set-pattern'){setPattern(btn.dataset.pattern);return;}
    if(action==='match-search'){startSearch();return;}
    if(action==='cancel-search'){if(matchState.timer)clearTimeout(matchState.timer);matchState={stage:'idle'};render();return;}
    if(action==='start-match'){beginMatch();return;}
    if(action==='manual-sub'){const c=currentClub(),out=btn.dataset.out,sel=btn.parentElement.querySelector('select'),inn=sel?.value;if(!inn){toast('Выбери игрока на замену.','error');return;}const incoming=c.players.find(p=>p.id===inn);if(playerIsUnavailable(incoming)){toast(`Игрок недоступен: ${unavailableReason(incoming)}.`,'error');return;}const i=c.lineup.indexOf(out);if(i<0||c.lineup.includes(inn))return;c.lineup[i]=inn;saveDB();render();toast('Замена выполнена.');return;}if(action==='match-choice'){resolveChoice(btn.dataset.choice);return;}
    if(action==='match-again'){matchState={stage:'idle'};startSearch();return;}
  });
  $('#app').addEventListener('submit',async e=>{
    if(e.target.id==='createClubForm'){e.preventDefault();try{await createClubFromForm(e.target);}catch(err){console.error(err);toast('Не удалось создать клуб.','error');}}
    if(e.target.id==='editClubForm'){
      e.preventDefault();const club=currentClub();if(!club)return;const fd=new FormData(e.target);const name=String(fd.get('clubName')||'').trim();
      if(name.length<2){toast('Название должно содержать минимум 2 символа.','error');return;}
      if(accountClubs().some(c=>c.id!==club.id&&c.name.toLowerCase()===name.toLowerCase())){toast('Такое название уже занято другим твоим клубом.','error');return;}
      club.name=name;club.country=String(fd.get('country')||club.country);club.logo.symbol=String(fd.get('logoSymbol')||club.logo.symbol);club.logo.color=String($('#editLogoColor')?.value||club.logo.color);club.kit.primary=String(fd.get('kitPrimary')||club.kit.primary);club.kit.secondary=String(fd.get('kitSecondary')||club.kit.secondary);club.kit.pattern=String(fd.get('kitPattern')||club.kit.pattern);saveDB();render();toast('Изменения клуба сохранены.');
    }
  });
  $('#app').addEventListener('change',e=>{
    const t=e.target;if(t.dataset.setting==='vibration'){db.vibration=t.checked;saveDB();toast(t.checked?'Вибрация включена.':'Вибрация отключена.');return;}if(t.dataset.setting==='sound'){db.sound=t.checked;saveDB();return;}if(['collectionPosition','collectionRarity','collectionSort'].includes(t.id))applyCollectionFilters();
    if(t.dataset.setting==='formation'){const club=currentClub();if(club){club.formation=t.value;saveDB();render();}}
    if(t.dataset.setting==='language'){db.language=t.value;saveDB();render();}
    if(t.id==='createLogoShape'){createDraft.shape=t.value;$('#createCrest')?.classList.remove('shape-shield','shape-round','shape-square','shape-diamond','shape-classic');$('#createCrest')?.classList.add('shape-'+t.value);}
    if(t.id==='newCountry'){const c=countryData(t.value);const bonus=$('#starterBonus');if(bonus)bonus.textContent=`${c.flag} Стартовый пак: 16 игроков · Бонус страны: ${c.bonus}`;}
    if(t.id==='editCountry'){const c=countryData(t.value);const bonus=$('#editCountryBonus');if(bonus)bonus.textContent=`Бонус страны: ${c.bonus}`;const cn=$('#editorPreviewCountry');if(cn)cn.textContent=`${c.name} · ${teamRating(currentClub())} OVR`;const name=$('#editClubName')?.value||currentClub()?.name||'';const n=$('#editorPreviewName');if(n)n.textContent=`${c.flag} ${name}`;}
  });
  $('#app').addEventListener('input',e=>{
    const t=e.target;if(t.id==='collectionSearch')applyCollectionFilters();const club=currentClub();
    if(t.dataset.preview==='create-color'){createDraft.logoColor=t.value;const crest=$('#createCrest');if(crest)crest.style.setProperty('--crest-color',t.value);}
    if(!club)return;
    if(t.dataset.preview==='edit-logo-color'){
      club.logo.color=t.value;const cr=$('#editCrest');if(cr)cr.style.setProperty('--crest-color',t.value);const pv=$('#editorPreviewCrest');if(pv)pv.style.setProperty('--crest-color',t.value);const h=$('#editLogoColorHidden');if(h)h.value=t.value;
    }
    if(t.dataset.preview==='kit-primary'){const shirt=$('#kitShirt');if(shirt)shirt.style.setProperty('--kit-primary',t.value);}
    if(t.dataset.preview==='kit-secondary'){const shirt=$('#kitShirt');if(shirt)shirt.style.setProperty('--kit-secondary',t.value);}
    if(t.id==='editClubName'){const pv=$('#editorPreviewName');if(pv)pv.textContent=`${countryData($('#editCountry')?.value||club.country).flag} ${t.value}`;}
  });

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
    if(!club.trophyUnlocks)club.trophyUnlocks={};
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
  saveDB();
  try { render(); }
  catch(error) {
    console.error('Zero Football startup error:', error);
    const app = document.querySelector('#app');
    if (app) app.innerHTML = `<div style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#101410;color:#f3f5ef;font-family:system-ui,sans-serif"><div style="max-width:560px;background:#191e19;border:1px solid #394238;border-radius:18px;padding:26px"><h1 style="color:#c8ff44;margin-top:0">Zero Football не смогла загрузиться</h1><p>Сохранение могло быть создано старой версией игры. Попробуй перезагрузить страницу. Если ошибка повторится, отправь разработчику этот текст:</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere;color:#ffaaa5">${String(error && error.message || error).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</pre><button onclick="location.reload()" style="padding:11px 16px;border:0;border-radius:9px;background:#c8ff44;font-weight:800;cursor:pointer">Перезагрузить игру</button></div></div>`;
  }
})();
