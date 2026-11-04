/* Zero Football — browser football club game with Supabase matchmaking and synchronized online matches. */
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
    const cards=$$('.player-card[data-portrait-key],.squad-item[data-portrait-key],.modal-player[data-portrait-key],.opponent-star-card[data-portrait-key],.player-slot[data-portrait-key],.forced-sub-option[data-portrait-key],.daily-player-offer[data-portrait-key]');
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
  const ZF_SUPABASE = (() => {
    const cfg = window.ZF_SUPABASE_CONFIG || {};
    if (!cfg.url || !cfg.anonKey || !window.supabase?.createClient) return null;
    try { return window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }); }
    catch (error) { console.error('Supabase initialization failed:', error); return null; }
  })();
  let zfAuthSession = null;
  let zfAuthUser = null;
  let zfAuthReady = false;
  let authScreenMode = 'signup';
  let authScreenNotice = '';
  let zfOfflineMode = false;
  let zfCloudBusy = false;
  let activeOnlineRoom = null;
  let onlineRoomChannel = null;
  let onlineRoomPoll = null;
  let onlineRoomRenderFingerprint = '';
  let matchmakingPoll = null;
  let matchmakingPollBusy = false;
  let onlineInitBusy = false;
  let onlineActionBusy = false;
  let multiplayerBusy = false;
  let publicRoomsCache = [];
  let zfCloudStatus = ZF_SUPABASE ? 'Подключение к Supabase…' : 'Supabase не настроен';
  async function ensureMySocialProfile(){
    if(!ZF_SUPABASE||!zfAuthSession||!zfAuthUser)return;
    const club=currentClub();
    try{const {data,error}=await ZF_SUPABASE.rpc('zf_social_profile',{p_display_name:club?.name||zfAuthUser.email?.split('@')[0]||'Игрок',p_club_name:club?.name||'Без клуба'});if(error)throw error;communityState.profile=data;}
    catch(error){console.warn('Social profile will be created after migration 004 is applied:',error.message||error);}
  }
  async function refreshCloudAuth() {
    if (!ZF_SUPABASE) { zfCloudStatus = 'Supabase не настроен'; return; }
    try {
      const { data, error } = await ZF_SUPABASE.auth.getSession();
      if (error) throw error;
      zfAuthSession = data.session || null;
      zfAuthUser = data.session?.user || null;
      zfCloudStatus = zfAuthUser ? `Вход выполнен: ${zfAuthUser.email || 'аккаунт'}` : 'Не выполнен вход';
    } catch (error) { zfCloudStatus = 'Ошибка подключения: ' + (error.message || 'неизвестная ошибка'); }
  }
  async function cloudSignIn(mode, form) {
    if (!ZF_SUPABASE) throw new Error('Supabase не инициализирован. Проверь настройки проекта.');
    const fd = new FormData(form), email = String(fd.get('email') || '').trim(), password = String(fd.get('password') || '');
    if (!email || !password) throw new Error('Укажи электронную почту и пароль.');
    if (password.length < 6) throw new Error('Пароль должен содержать минимум 6 символов.');
    const result = mode === 'signup' ? await ZF_SUPABASE.auth.signUp({ email, password }) : await ZF_SUPABASE.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    zfAuthSession = result.data.session || null; zfAuthUser = zfAuthSession?.user || null;
    if (mode === 'signup' && !zfAuthSession) {
      zfOfflineMode = false;
      authScreenMode = 'signin';
      authScreenNotice = 'Аккаунт создан. Проверь почту и подтверди адрес по ссылке из письма, затем войди.';
      zfCloudStatus = 'Ожидается подтверждение почты.';
    } else {
      zfOfflineMode = false;
      authScreenNotice = '';
      zfCloudStatus = `Вход выполнен: ${zfAuthUser?.email || email}`;
    }
    zfAuthReady = true;
    if(zfAuthSession)await ensureMySocialProfile();
    render(); toast(authScreenNotice || zfCloudStatus);
  }
  async function cloudSignOut() {
    if (!ZF_SUPABASE) return;
    const { error } = await ZF_SUPABASE.auth.signOut(); if (error) throw error;
    zfAuthSession = null; zfAuthUser = null; zfCloudStatus = 'Вы вышли из аккаунта'; render(); toast('Выход из облачного аккаунта выполнен.');
  }
  async function authenticatedUser() {
    if (!ZF_SUPABASE) throw new Error('Supabase не настроен.');
    const { data, error } = await ZF_SUPABASE.auth.getUser();
    if (error) throw error;
    if (!data?.user) throw new Error('Сессия не найдена. Войди в аккаунт ещё раз.');
    zfAuthUser = data.user;
    const { data: sessionData, error: sessionError } = await ZF_SUPABASE.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData?.session?.access_token) throw new Error('Сессия истекла. Войди в аккаунт ещё раз.');
    zfAuthSession = sessionData.session;
    return data.user;
  }
  async function cloudSave(mode) {
    if (!ZF_SUPABASE) throw new Error('Supabase не настроен.');
    if (zfCloudBusy) return; zfCloudBusy = true;
    try {
      const user = await authenticatedUser();
      if (mode === 'upload') {
        const payload = JSON.parse(JSON.stringify(db));
        const { error } = await ZF_SUPABASE.from('zf_cloud_saves').upsert({ user_id: user.id, payload, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
        if (error) throw error;
        zfCloudStatus = 'Локальное сохранение загружено в облако'; toast('Сохранение отправлено в облако.');
      } else {
        const { data, error } = await ZF_SUPABASE.from('zf_cloud_saves').select('payload,updated_at').eq('user_id', zfAuthUser.id).maybeSingle();
        if (error) throw error;
        if (!data?.payload) throw new Error('В облаке пока нет сохранения. Сначала нажми «Сохранить в облако».');
        if (!confirm('Заменить текущий локальный прогресс данными из облака? Сначала рекомендуется сохранить локальный прогресс.')) return;
        localStorage.setItem(STORE_KEY, JSON.stringify(data.payload)); db = loadDB();
        zfCloudStatus = `Облако загружено · ${new Date(data.updated_at).toLocaleString()}`; toast('Облачное сохранение загружено.');
      }
      render();
    } finally { zfCloudBusy = false; }
  }
  if (ZF_SUPABASE) {
    refreshCloudAuth().then(async () => { zfAuthReady = true; if(zfAuthSession){await restoreOnlineRoom();await ensureMySocialProfile();} render(); });
    ZF_SUPABASE.auth.onAuthStateChange((event, session) => {
      zfAuthSession = session || null; zfAuthUser = session?.user || null; zfAuthReady = true;
      zfCloudStatus = zfAuthUser ? `Вход выполнен: ${zfAuthUser.email || 'аккаунт'}` : 'Не выполнен вход';
      if (event === 'SIGNED_OUT') { activeOnlineRoom = null; stopOnlineRoomSync(); try{localStorage.removeItem('zfActiveOnlineRoomId');}catch(_){} authScreenMode = 'signin'; zfOfflineMode = false; }
      if (event === 'SIGNED_IN') Promise.all([restoreOnlineRoom(),ensureMySocialProfile()]).then(()=>render());
      else if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') render();
    });
  } else {
    zfAuthReady = true;
    zfCloudStatus = 'Supabase не подключён';
  }

  // Persistent presentation preferences; defaults keep the full experience enabled.
  if(!db.language)db.language='ru';
  if(typeof db.sound!=='boolean')db.sound=true;
  if(typeof db.vibration!=='boolean')db.vibration=true;
  if(typeof db.packAnimations!=='boolean')db.packAnimations=true;
  if(!['cinematic','normal','fast'].includes(db.packAnimationSpeed))db.packAnimationSpeed='normal';
  if(typeof db.packSound!=='boolean')db.packSound=true;
  if(!Number.isFinite(Number(db.soundVolume)))db.soundVolume=32;db.soundVolume=clamp(Number(db.soundVolume),0,100);
  if(!Number.isFinite(Number(db.packSoundVolume)))db.packSoundVolume=12;db.packSoundVolume=clamp(Number(db.packSoundVolume),0,100);
  if(typeof db.packVibration!=='boolean')db.packVibration=true;
  if(typeof db.musicEnabled!=='boolean')db.musicEnabled=true;
  if(!['ambient','electronic','stadium','rock'].includes(db.musicStyle))db.musicStyle='ambient';
  if(!Number.isInteger(Number(db.musicTrack))||Number(db.musicTrack)<0||Number(db.musicTrack)>15)db.musicTrack=0;
  if(!Number.isFinite(Number(db.musicVolume)))db.musicVolume=28;
  db.musicVolume=clamp(Number(db.musicVolume),0,100);
  let packAnimationSerial=0;
  let packAudioContext=null;
  let musicBus=null,musicLoopTimer=null,musicStep=0,musicGeneration=0,musicUnlocked=false,backgroundAudio=null,synthFallbackActive=false;
  let view = 'home';
  let startMode = 'choose';
  let createDraft = {symbol:'★',logoColor:'#c8ff44',shape:'shield',layers:[{id:'base',kind:'symbol',value:'★',x:50,y:48,size:34,color:'#10140c'}]};
  let editSlotIndex = null;
  let reveal = null;
  let matchState = {stage:'idle'};
  let toastTimer = null;
  let collectionMode = 'owned';
  let themePanelOpen = false;
  let playerModalRef = null;
  let matchCountdownInterval = null;
  const communityState = {profile:null,contacts:{contacts:[],incoming:[],outgoing:[]},offers:[],market:[],marketQuery:'',marketExact:false,marketFilters:{position:'all',rating:'',price:'',duplicate:'all'},myMarket:{listings:[],proceeds:[]},clan:null,clanApplications:[],clanSearch:[],clanInvites:[],competitions:[],myCompetitions:{invites:[],competitions:[]},searchResult:null,error:'',loading:false};
  const COMMUNITY_VIEWS = new Set(['friends','market','clan','leagues']);

  function loadDB(){
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {clubs:[],activeClubId:null,stats:{}};
      if (!Array.isArray(parsed.clubs)) parsed.clubs = [];
      let strippedLegacySecrets=false;
      let strippedAuthData=false;
      parsed.clubs = parsed.clubs.filter(c => c && typeof c === 'object' && typeof c.id === 'string').map(c => {
        // Migrate older/partially-written saves instead of letting one incomplete club break startup.
        if (['password','plainPassword','passwordPlain','login','passwordHash','passwordSalt','passwordAlgorithm','passwordIterations'].some(key=>key in c)) strippedAuthData=true;
        delete c.password;delete c.plainPassword;delete c.passwordPlain;
        delete c.login;delete c.passwordHash;delete c.passwordSalt;delete c.passwordAlgorithm;delete c.passwordIterations;
        if (!Array.isArray(c.players)) c.players = [];
        // Requested roster cleanup: remove the Uruguayan Luis Suárez from old local saves too.
        const removedLuisIds=new Set(c.players.filter(p=>p&&((p.wiki||'')==='Luis Suárez'||(p.name||'').trim()==='Луис Суарес'||((p.name||'').trim()==='Luis Suárez'&&p.country==='uy'))).map(p=>p.id));
        c.players=c.players.filter(p=>!p||!((p.wiki||'')==='Luis Suárez'||(p.name||'').trim()==='Луис Суарес'||((p.name||'').trim()==='Luis Suárez'&&p.country==='uy')));
        if(removedLuisIds.size)c.lineup=Array.isArray(c.lineup)?c.lineup.filter(id=>!removedLuisIds.has(id)):[];
        if (!Array.isArray(c.lineup)) c.lineup = c.players.slice(0,11).map(p => p && p.id).filter(Boolean);
        if (!c.logo || typeof c.logo !== 'object') c.logo = {symbol:'⚡',color:'#c8ff44'};
        delete c.kit;
        const statDefaults={matches:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,packsOpened:0,cleanSheets:0,captainMatches:0};
        c.stats={...statDefaults,...(c.stats&&typeof c.stats==='object'?c.stats:{})};
        Object.keys(statDefaults).forEach(key=>{const value=Number(c.stats[key]);c.stats[key]=Number.isFinite(value)?Math.max(0,value):0;});
        if (!c.trophyUnlocks || typeof c.trophyUnlocks !== 'object') c.trophyUnlocks = {};if(!c.progression||typeof c.progression!=='object')c.progression={totalXp:(Number(c.stats?.matches)||0)*45};if(!Number.isFinite(Number(c.progression.totalXp)))c.progression.totalXp=0;delete c.trophyUnlocks.rich_1000;delete c.trophyUnlocks.rich_5000;
        if (!Array.isArray(c.history)) c.history = [];
        if (!c.style) c.style = 'balanced';
        if (!Number.isFinite(c.energy)) c.energy = 5; c.energy=Math.min(5,Math.max(0,c.energy)); if (!Number.isFinite(c.energyAt)) c.energyAt = Date.now(); if (!Array.isArray(c.sponsors)) c.sponsors = [];
        c.players.forEach(p=>{const canonical=REAL_PLAYERS.find(r=>p&&(p.wiki===r.wiki||p.name===r.wiki));if(canonical)p.name=canonical.name;else if(p&&/[A-Za-z]/.test(String(p.name||'')))p.name=transliterateName(p.name);if(!p.contractUntil)p.contractUntil=Date.now()+30*86400000;if(!Array.isArray(p.positions))p.positions=[p.position];if(!p.internationalName)p.internationalName=latinizePlayerName(p.name);if(!Number.isFinite(Number(p.stamina)))p.stamina=100;p.stamina=clamp(Number(p.stamina),0,100);delete p.positionPenalty;}); c.players.forEach(p=>{const rb=REAL_PLAYERS.find(x=>x.wiki===p.wiki||x.name===p.name);if(rb){p.realClub=rb.club;p.rating=rb.rating;p.position=rb.position;p.positions=REAL_PLAYER_POSITIONS[rb.wiki]||p.positions||[rb.position];}if(p.realClub||p.club){p.realClub=canonicalPlayerClubName(p.realClub||p.club);}});
        if (!c.formation) c.formation = '4-3-3';
        if(c.lineup.length<11){const used=new Set(c.lineup);for(const p of c.players){if(c.lineup.length>=11)break;if(p?.id&&!used.has(p.id)){c.lineup.push(p.id);used.add(p.id);}}}
        if(c.captainId&&!c.lineup.includes(c.captainId))c.captainId=null;
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
        if(['login','passwordHash','passwordSalt','passwordAlgorithm','passwordIterations','password','plainPassword','passwordPlain'].some(key=>key in c))strippedAuthData=true;
        delete c.login;delete c.passwordHash;delete c.passwordSalt;delete c.passwordAlgorithm;delete c.passwordIterations;delete c.password;delete c.plainPassword;delete c.passwordPlain;
        delete c.accountId;
        if(!c.sponsorContract)c.sponsorContract=null;if(!c.sponsorSlots||typeof c.sponsorSlots!=='object')c.sponsorSlots={};c.sponsorSlots={kit:c.sponsorSlots.kit||null,title:c.sponsorSlots.title||null,extra:c.sponsorSlots.extra||null};if(c.sponsorContract&&!Object.values(c.sponsorSlots).some(Boolean)){const legacyType=['kit','title','extra'].includes(c.sponsorContract.type)?c.sponsorContract.type:'title';c.sponsorSlots[legacyType]={...c.sponsorContract,type:legacyType};}Object.entries(c.sponsorSlots).forEach(([type,contract])=>{if(contract){contract.type=type;if(!Number.isFinite(Number(contract.until)))contract.until=Date.now()+30*86400000;}});c.sponsorContract=c.sponsorSlots.title||c.sponsorSlots.kit||c.sponsorSlots.extra||null;if(!Array.isArray(c.logo.layers)||!c.logo.layers.length)c.logo.layers=[{id:'base',kind:'symbol',value:c.logo.symbol||'★',x:50,y:48,size:34,color:'#10140c'}];c.logo.layers=c.logo.layers.map(l=>({...l,value:l?.kind==='emoji'&&SAFE_CREST_EMOJIS.has(String(l.value||''))?String(l.value):sanitizeCrestText(l.value)}));c.logo.symbol=sanitizeCrestText(c.logo.symbol);if(!c.logo.shape)c.logo.shape='shield';
      });
      // Keep the active club on this device. Explicit logout/switch clears activeClubId before saving.
      if(parsed.activeClubId && !parsed.clubs.some(c=>c.id===parsed.activeClubId)) parsed.activeClubId=null;
      if(strippedLegacySecrets||strippedAuthData){try{localStorage.setItem(STORE_KEY,JSON.stringify(parsed));}catch(secretCleanupError){console.warn('Could not rewrite a legacy save after removing old credential fields:',secretCleanupError);}}
      return parsed;
    } catch(e) { return {clubs:[],activeClubId:null,stats:{}}; }
  }
  function saveDB(){
    try {
      (db.clubs||[]).forEach(c=>{delete c.password;delete c.plainPassword;delete c.passwordPlain;delete c.login;delete c.passwordHash;delete c.passwordSalt;delete c.passwordAlgorithm;delete c.passwordIterations;});
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
  function playerDisplayName(player){const local=String(player?.name||'');const lang=db.language||'ru';if(lang==='ru')return local;if(lang==='uk'&&['ua','by','kz'].includes(String(player?.country||'')))return local;const canonical=String(player?.wiki||'').trim();if(canonical&&/[A-Za-z]/.test(canonical))return canonical.replaceAll('_',' ');return String(player?.internationalName||latinizePlayerName(local)||local);}
  const PLAYER_CLUB_LABELS={
    en:{'АЕК Афины':'AEK Athens','Аль-Наср':'Al Nassr','Арсенал':'Arsenal','Астон Вилла':'Aston Villa','Атлетико Мадрид':'Atlético Madrid','Бавария':'Bayern Munich','Барселона':'Barcelona','Борнмут':'Bournemouth','Боруссия Дортмунд':'Borussia Dortmund','Брайтон':'Brighton & Hove Albion','Брюгге':'Club Brugge','Будё-Глимт':'Bodø/Glimt','Вест Хэм':'West Ham United','Викинг':'Viking FK','Вильярреал':'Villarreal','Динамо Киев':'Dynamo Kyiv','Интер':'Inter Milan','Интер Майами':'Inter Miami','Комо':'Como 1907','Кристал Пэлас':'Crystal Palace','Кёльн':'1. FC Köln','Ливерпуль':'Liverpool','Лидс':'Leeds United','Лилль':'Lille','Манчестер Сити':'Manchester City','Манчестер Юнайтед':'Manchester United','Марсель':'Marseille','Милан':'AC Milan','Ньюкасл':'Newcastle United','Ньюкасл Юнайтед':'Newcastle United','ПСВ':'PSV Eindhoven','ПСЖ':'Paris Saint-Germain','Порту':'FC Porto','Реал Бетис':'Real Betis','Реал Мадрид':'Real Madrid','Рома':'AS Roma','Сабах':'Sabah FC','Сантос':'Santos FC','Слован Братислава':'ŠK Slovan Bratislava','Спортинг':'Sporting CP','Тоттенхэм':'Tottenham Hotspur','Фейеноорд':'Feyenoord','Челси':'Chelsea','Шахтёр':'Shakhtar Donetsk','Штутгарт':'VfB Stuttgart'},
    uk:{'АЕК Афины':'АЕК Афіни','Аль-Наср':'Аль-Наср','Арсенал':'Арсенал','Астон Вилла':'Астон Вілла','Атлетико Мадрид':'Атлетіко Мадрид','Бавария':'Баварія','Барселона':'Барселона','Борнмут':'Борнмут','Боруссия Дортмунд':'Боруссія Дортмунд','Брайтон':'Брайтон','Брюгге':'Брюгге','Будё-Глимт':'Буде-Глімт','Вест Хэм':'Вест Гем','Викинг':'Вікінг','Вильярреал':'Вільярреал','Динамо Киев':'Динамо Київ','Интер':'Інтер','Интер Майами':'Інтер Маямі','Комо':'Комо','Кристал Пэлас':'Крістал Пелес','Кёльн':'Кельн','Ливерпуль':'Ліверпуль','Лидс':'Лідс','Лилль':'Лілль','Манчестер Сити':'Манчестер Сіті','Манчестер Юнайтед':'Манчестер Юнайтед','Марсель':'Марсель','Милан':'Мілан','Ньюкасл':'Ньюкасл','Ньюкасл Юнайтед':'Ньюкасл Юнайтед','ПСВ':'ПСВ','ПСЖ':'ПСЖ','Порту':'Порту','Реал Бетис':'Реал Бетіс','Реал Мадрид':'Реал Мадрид','Рома':'Рома','Сабах':'Сабах','Сантос':'Сантус','Слован Братислава':'Слован Братислава','Спортинг':'Спортінг','Тоттенхэм':'Тоттенгем','Фейеноорд':'Феєнорд','Челси':'Челсі','Шахтёр':'Шахтар','Штутгарт':'Штутгарт'}
  };
  function canonicalPlayerClubName(value){const club=String(value||'').trim();return ['Ньюкасл','Ньюкасл Юнайтед','Newcastle','Newcastle United'].includes(club)?'Ньюкасл Юнайтед':club;}
  function playerClubLabel(player){const club=canonicalPlayerClubName(player?.realClub||player?.club||'Клуб не указан');const lang=db.language||'ru';if(lang==='ru')return club;return PLAYER_CLUB_LABELS[lang]?.[club]||PLAYER_CLUB_LABELS.en[club]||translateUIText(club);} 
  function playerCountryLabel(code){return playerCountryData(code).name;}
  function effectiveOVRText(player,target,club=null){const value=playerOVRAt(player,target,club);const penalty=positionPenalty(player,target);return `${value} OVR${penalty<0?` · ${penalty}`:''}`;}
  function rarityFor(rating){return [...RARITY].reverse().find(r=>rating>=r.min)||RARITY[0];}
  function rarityColor(rating){return rarityFor(rating).color;}
  // Transfermarkt-style estimated market value in millions of euros.
  function marketValue(rating){return Math.pow(200,Math.max(0,(Number(rating||50)-50)/40));}
  function formatMoney(value){const n=Number(value)||0;return `€${n>=100?Math.round(n):n>=10?n.toFixed(1):n.toFixed(2)} млн`; }
  function saleValue(player,duplicate=false){const base=marketValue(player.rating)*0.05;return Math.max(0.01,base*(duplicate?0.5:1));}
  function saleRange(player,duplicate=false,multiplier=1){
    const base=saleValue(player,duplicate)*multiplier;
    return {min:Math.round(base*.8*100)/100,max:Math.round(base*1.35*100)/100};
  }
  function formatSaleRange(player,duplicate=false,multiplier=1){
    const range=saleRange(player,duplicate,multiplier);
    return `${formatMoney(range.min)}–${formatMoney(range.max)}`;
  }
  function randomSalePrice(player,duplicate=false,multiplier=1){
    const range=saleRange(player,duplicate,multiplier);
    return Math.round((range.min+Math.random()*(range.max-range.min))*100)/100;
  }
  function avatarLetters(name){return String(name||'ZF').split(/[\s-]+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase();}
  function latinizePlayerName(value){
    const map={а:'a',б:'b',в:'v',г:'g',ґ:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',і:'i',ї:'yi',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',є:'ye',ю:'yu',я:'ya'};
    return String(value||'').normalize('NFC').split('').map(ch=>{const low=ch.toLocaleLowerCase('ru');const out=map[low];return out===undefined?ch:(ch===ch.toLocaleUpperCase('ru')?out.charAt(0).toUpperCase()+out.slice(1):out);}).join('').replace(/\s+/g,' ').trim();
  }
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
    const originalName=String(name||'');
    if(!extra.realPlayer && /[A-Za-z]/.test(String(name||''))) name=transliterateName(name);
    const pace=clamp(rating+rand(-11,10)+(position.includes('W')||position==='ST'?4:0),30,99);
    const shooting=clamp(rating+rand(-10,11)+(position==='ST'||position==='CF'?9:0),25,99);
    const passing=clamp(rating+rand(-8,10)+(position==='CM'||position==='CAM'?7:0),25,99);
    const dribbling=clamp(rating+rand(-10,11)+(position.includes('W')||position==='CAM'?8:0),25,99);
    const defense=clamp(rating+rand(-10,10)+(position==='CB'||position==='LB'||position==='RB'||position==='CDM'?8:0),25,99);
    const physical=clamp(rating+rand(-8,10),25,99);
    const goalkeeping=position==='GK'?clamp(rating+rand(0,10),25,99):clamp(18+rand(0,10),10,35);
    return {id:'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),name,position,positions:extra.positions||[position],rating,pace,shooting,passing,dribbling,defense,physical,goalkeeping,country,contractUntil:Date.now()+30*24*60*60*1000,injuryMatches:0,internationalName:extra.internationalName||latinizePlayerName(originalName),...extra};
  }
  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
  function createStarterSquad(countryCode){
    const positions=['GK','LB','CB','CB','RB','CM','CM','CAM','LW','ST','RW','GK','CB','CM','ST','RW'];
    const ratings=[55,54,55,54,54,56,55,56,54,56,55,53,53,54,53,52];
    const usedNames=shuffle([...countryData(countryCode).names]);
    return positions.map((pos,i)=>createPlayer(pos,ratings[i],usedNames[i%usedNames.length],countryCode));
  }
  function makeClub(name,country,logoSymbol,logoColor){
    const players=createStarterSquad(country);
    const firstEleven=players.slice(0,11).map(p=>p.id);
    const club={
      id:'club-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),name:name.trim(),country,
      logo:{symbol:sanitizeCrestText(logoSymbol||'★'),color:logoColor||'#c8ff44',shape:createDraft.shape||'shield',layers:JSON.parse(JSON.stringify(createDraft.layers||[{id:'base',kind:'symbol',value:logoSymbol||'★',x:50,y:48,size:34,color:'#10140c'}]))},
      euros:0.5,economyVersion:2,energy:5,energyAt:Date.now(),consumables:{referee:0,medic:0,energyDrink:0},sponsors:[],sponsorContract:null,sponsorSlots:{kit:null,title:null,extra:null},players,lineup:firstEleven,formation:'4-3-3',style:'balanced',trophyUnlocks:{},
      stats:{matches:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,packsOpened:0,cleanSheets:0,captainMatches:0},progression:{totalXp:0},history:[],createdAt:Date.now(),
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
    const captain=club?.captainId===p.id&&club?.lineup?.includes(p.id)?1:0;
    const condition=p.injuryMatches>0?5:0;
    const fatigue=(Number(p.stamina??100)<30?4:Number(p.stamina??100)<50?3:Number(p.stamina??100)<70?2:Number(p.stamina??100)<85?1:0);
    return clamp(Math.round((Number(p.rating)||0)+positionPenalty(p,target)-condition-fatigue+captain),1,99);
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
    if(p.marketResaleOnly)return 'Повторная карточка: только перепродажа';
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
    club.progression=club.progression&&typeof club.progression==='object'?club.progression:{totalXp:0};
    club.progression.level=progressionState(club).level;
    club.trophyUnlocks=club.trophyUnlocks&&typeof club.trophyUnlocks==='object'?club.trophyUnlocks:{};
    for(const trophy of TROPHIES){if(trophy.test(club)&&!club.trophyUnlocks[trophy.id]){club.trophyUnlocks[trophy.id]=new Date().toISOString();const reward=Number(trophy.reward)||.18;club.coins=(Number(club.coins)||0)+reward;messages.push(`${trophy.name} · награда ${formatMoney(reward)}`);}}
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
    const raw=String(l.value||''),isText=l.kind==='text',requested=Number(l.size||24)*scale,size=Math.max(5*scale,Math.min(96,requested,isText?(84*scale)/(Math.max(1,raw.length)*.62):96)),isEmoji=l.kind==='emoji'&&SAFE_CREST_EMOJIS.has(raw),value=isEmoji?raw:sanitizeCrestText(raw),symbol=(isText||isEmoji)?'':crestSymbolSvg(SAFE_CREST_GLYPHS.has(raw)?raw:value);
    const content=isEmoji?esc(value):symbol||esc(value);
    return `<span class="crest-layer ${isEmoji?'crest-layer-emoji':''}" data-layer-id="${esc(l.id||'')}" data-layer-kind="${esc(l.kind||'symbol')}" style="left:${Number(l.x??50)}%;top:${Number(l.y??50)}%;font-size:${size}px;color:${esc(l.color||'#10140c')}">${content}</span>`;
  }
  function crestContent(logo,scale=1){const layers=Array.isArray(logo?.layers)&&logo.layers.length?logo.layers:[{kind:'symbol',value:logo?.symbol||'★',x:50,y:50,size:30,color:'#10140c'}];return layers.map(l=>crestLayerMarkup(l,scale)).join('');}
  function crestShape(logo){return `shape-${esc(logo?.shape||'shield')}`;}
  function clubVars(club){return `--crest-color:${club.logo.color||'#c8ff44'};`}
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

  const V41_TRANSLATIONS = {"en":{"Язык интерфейса":"Interface language","Создание клуба":"Create a club","Твои клубы":"Your clubs","Настрой эмблему и выбери страну. После создания сразу откроется управление клубом.":"Enter a login and password, customise your crest and kit. Club management opens after creation.","Выбери клуб, чтобы продолжить карьеру, или создай новый.":"Choose a club to sign in or create a new one. Each club has its own login and password.","Клубы ещё не созданы":"No clubs created yet","Создай первый клуб и начни карьеру.":"Create your first club and save its sign-in details.","Всего клубов:":"Total clubs:","Игровой центр":"Game centre","Управление":"Management","Выбери язык интерфейса.":"Choose the interface language.","ФОНОВАЯ МУЗЫКА":"BACKGROUND MUSIC","Включить фоновую музыку":"Enable background music","Громкость музыки":"Music volume","Стиль музыки":"Music style","Трек":"Track","Прослушать / включить":"Preview / play","Остановить музыку":"Stop music","Выключает все звуки игры, включая музыку и эффекты.":"Mutes all game audio, including music and effects.","Девять отдельных композиций разных жанров.":"Choose one of five music styles and five tracks in each style."},"uk":{"Язык интерфейса":"Мова інтерфейсу","Создание клуба":"Створення клубу","Твои клубы":"Твої клуби","Настрой эмблему и выбери страну. После создания сразу откроется управление клубом.":"Вкажи логін і пароль, налаштуй емблему та форму. Після створення одразу відкриється керування клубом.","Выбери клуб, чтобы продолжить карьеру, или создай новый.":"Обери клуб для входу або створи новий. Кожен клуб має окремий логін і пароль.","Клубы ещё не созданы":"Клуби ще не створені","Создай первый клуб и начни карьеру.":"Створи перший клуб і збережи дані для входу.","Всего клубов:":"Усього клубів:","Игровой центр":"Ігровий центр","Управление":"Керування","Выбери язык интерфейса.":"Обери мову інтерфейсу.","ФОНОВАЯ МУЗЫКА":"ФОНОВА МУЗИКА","Включить фоновую музыку":"Увімкнути фонову музику","Громкость музыки":"Гучність музики","Стиль музыки":"Стиль музики","Трек":"Трек","Прослушать / включить":"Прослухати / увімкнути","Остановить музыку":"Зупинити музику","Выключает все звуки игры, включая музыку и эффекты.":"Вимикає всі звуки гри, зокрема музику та ефекти.","Девять отдельных композиций разных жанров.":"Обери один із п’яти музичних стилів і п’ять тем у кожному стилі."},"de":{"Язык интерфейса":"Sprache der Benutzeroberfläche","Создание клуба":"Club erstellen","Твои клубы":"Deine Clubs","Настрой эмблему и выбери страну. После создания сразу откроется управление клубом.":"Gib Login und Passwort ein und passe Wappen und Trikot an. Nach der Erstellung öffnet sich die Clubverwaltung.","Выбери клуб, чтобы продолжить карьеру, или создай новый.":"Wähle einen Club zum Anmelden oder erstelle einen neuen. Jeder Club hat eigene Zugangsdaten.","Клубы ещё не созданы":"Noch keine Clubs erstellt","Создай первый клуб и начни карьеру.":"Erstelle deinen ersten Club und speichere die Zugangsdaten.","Всего клубов:":"Clubs insgesamt:","Игровой центр":"Spielzentrum","Управление":"Verwaltung","Выбери язык интерфейса.":"Wähle die Sprache der Benutzeroberfläche.","ФОНОВАЯ МУЗЫКА":"HINTERGRUNDMUSIK","Включить фоновую музыку":"Hintergrundmusik einschalten","Громкость музыки":"Musiklautstärke","Стиль музыки":"Musikstil","Трек":"Titel","Прослушать / включить":"Vorschau / abspielen","Остановить музыку":"Musik stoppen","Выключает все звуки игры, включая музыку и эффекты.":"Schaltet alle Spielgeräusche einschließlich Musik und Effekte stumm.","Девять отдельных композиций разных жанров.":"Wähle einen von fünf Musikstilen mit jeweils fünf Titeln."},"fr":{"Язык интерфейса":"Langue de l’interface","Создание клуба":"Créer un club","Твои клубы":"Tes clubs","Настрой эмблему и выбери страну. После создания сразу откроется управление клубом.":"Saisis un identifiant et un mot de passe, puis personnalise l’écusson et le maillot. La gestion du club s’ouvrira après sa création.","Выбери клуб, чтобы продолжить карьеру, или создай новый.":"Choisis un club ou crée-en un nouveau. Chaque club possède ses propres identifiants.","Клубы ещё не созданы":"Aucun club créé","Создай первый клуб и начни карьеру.":"Crée ton premier club et enregistre tes identifiants.","Всего клубов:":"Nombre de clubs :","Игровой центр":"Centre de jeu","Управление":"Gestion","Выбери язык интерфейса.":"Choisis la langue de l’interface.","ФОНОВАЯ МУЗЫКА":"MUSIQUE DE FOND","Включить фоновую музыку":"Activer la musique de fond","Громкость музыки":"Volume de la musique","Стиль музыки":"Style musical","Трек":"Piste","Прослушать / включить":"Écouter / activer","Остановить музыку":"Arrêter la musique","Выключает все звуки игры, включая музыку и эффекты.":"Coupe tous les sons du jeu, musique et effets compris.","Девять отдельных композиций разных жанров.":"Choisis un des cinq styles musicaux et cinq morceaux par style."},"es":{"Язык интерфейса":"Idioma de la interfaz","Создание клуба":"Crear un club","Твои клубы":"Tus clubes","Настрой эмблему и выбери страну. После создания сразу откроется управление клубом.":"Introduce un usuario y contraseña y personaliza el escudo y la equipación. La gestión del club se abrirá al crearlo.","Выбери клуб, чтобы продолжить карьеру, или создай новый.":"Elige un club para entrar o crea uno nuevo. Cada club tiene su propio usuario y contraseña.","Клубы ещё не созданы":"Todavía no hay clubes","Создай первый клуб и начни карьеру.":"Crea tu primer club y guarda tus datos de acceso.","Всего клубов:":"Clubes en total:","Игровой центр":"Centro de juego","Управление":"Gestión","Выбери язык интерфейса.":"Elige el idioma de la interfaz.","ФОНОВАЯ МУЗЫКА":"MÚSICA DE FONDO","Включить фоновую музыку":"Activar música de fondo","Громкость музыки":"Volumen de música","Стиль музыки":"Estilo musical","Трек":"Pista","Прослушать / включить":"Escuchar / reproducir","Остановить музыку":"Detener música","Выключает все звуки игры, включая музыку и эффекты.":"Silencia todos los sonidos del juego, incluida la música y los efectos.","Девять отдельных композиций разных жанров.":"Elige uno de cinco estilos musicales con cinco temas cada uno."},"ja":{"Язык интерфейса":"インターフェース言語","Создание клуба":"クラブを作成","Твои клубы":"あなたのクラブ","Настрой эмблему и выбери страну. После создания сразу откроется управление клубом.":"ログインとパスワードを入力し、エンブレムとユニフォームを設定します。作成後、クラブ管理が開きます。","Выбери клуб, чтобы продолжить карьеру, или создай новый.":"ログインするクラブを選ぶか、新しいクラブを作成してください。クラブごとにログイン情報があります。","Клубы ещё не созданы":"クラブはまだありません","Создай первый клуб и начни карьеру.":"最初のクラブを作成してログイン情報を保存しましょう。","Всего клубов:":"クラブ数：","Игровой центр":"ゲームセンター","Управление":"管理","Выбери язык интерфейса.":"インターフェース言語を選択してください。","ФОНОВАЯ МУЗЫКА":"BGM","Включить фоновую музыку":"BGMを有効にする","Громкость музыки":"音量","Стиль музыки":"音楽スタイル","Трек":"トラック","Прослушать / включить":"試聴 / 再生","Остановить музыку":"音楽を停止","Выключает все звуки игры, включая музыку и эффекты.":"音楽と効果音を含むすべてのゲーム音声をミュートします。","Девять отдельных композиций разных жанров.":"5つの音楽スタイルから選択でき、それぞれに5曲あります。"},"zh":{"Язык интерфейса":"界面语言","Создание клуба":"创建俱乐部","Твои клубы":"你的俱乐部","Настрой эмблему и выбери страну. После создания сразу откроется управление клубом.":"输入账号和密码，设置队徽与球衣。创建后将直接进入俱乐部管理。","Выбери клуб, чтобы продолжить карьеру, или создай новый.":"选择一个俱乐部登录，或创建新俱乐部。每个俱乐部都有独立的账号和密码。","Клубы ещё не созданы":"尚未创建俱乐部","Создай первый клуб и начни карьеру.":"创建你的第一个俱乐部并保存登录信息。","Всего клубов:":"俱乐部总数：","Игровой центр":"游戏中心","Управление":"管理","Выбери язык интерфейса.":"选择界面语言。","ФОНОВАЯ МУЗЫКА":"背景音乐","Включить фоновую музыку":"开启背景音乐","Громкость музыки":"音乐音量","Стиль музыки":"音乐风格","Трек":"曲目","Прослушать / включить":"试听 / 播放","Остановить музыку":"停止音乐","Выключает все звуки игры, включая музыку и эффекты.":"关闭游戏中的所有声音，包括音乐和音效。","Девять отдельных композиций разных жанров.":"可选择五种音乐风格，每种风格有五首曲目。"},"kk":{"Язык интерфейса":"Интерфейс тілі","Создание клуба":"Клуб құру","Твои клубы":"Сенің клубтарың","Настрой эмблему и выбери страну. После создания сразу откроется управление клубом.":"Логин мен құпиясөзді енгізіп, эмблема мен форманы бапта. Құрылғаннан кейін клубты басқару ашылады.","Выбери клуб, чтобы продолжить карьеру, или создай новый.":"Кіру үшін клубты таңда немесе жаңасын құр. Әр клубтың жеке логині мен құпиясөзі бар.","Клубы ещё не созданы":"Әзірге клубтар жоқ","Создай первый клуб и начни карьеру.":"Алғашқы клубыңды құрып, кіру деректерін сақта.","Всего клубов:":"Клубтар саны:","Игровой центр":"Ойын орталығы","Управление":"Басқару","Выбери язык интерфейса.":"Интерфейс тілін таңда.","ФОНОВАЯ МУЗЫКА":"ФОНДЫҚ МУЗЫКА","Включить фоновую музыку":"Фондық музыканы қосу","Громкость музыки":"Музыка дыбысы","Стиль музыки":"Музыка стилі","Трек":"Трек","Прослушать / включить":"Тыңдау / қосу","Остановить музыку":"Музыканы тоқтату","Выключает все звуки игры, включая музыку и эффекты.":"Музыка мен әсерлерді қоса алғанда, ойынның барлық дыбысын өшіреді.","Девять отдельных композиций разных жанров.":"Бес музыкалық стильдің бірін және әр стильдегі бес әуеннің бірін таңда."},"pl":{"Язык интерфейса":"Język interfejsu","Создание клуба":"Utwórz klub","Твои клубы":"Twoje kluby","Настрой эмблему и выбери страну. После создания сразу откроется управление клубом.":"Wpisz login i hasło, a następnie dostosuj herb i strój. Po utworzeniu otworzy się zarządzanie klubem.","Выбери клуб, чтобы продолжить карьеру, или создай новый.":"Wybierz klub lub utwórz nowy. Każdy klub ma osobny login i hasło.","Клубы ещё не созданы":"Nie utworzono jeszcze klubów","Создай первый клуб и начни карьеру.":"Utwórz pierwszy klub i zapisz dane logowania.","Всего клубов:":"Liczba klubów:","Игровой центр":"Centrum gry","Управление":"Zarządzanie","Выбери язык интерфейса.":"Wybierz język interfejsu.","ФОНОВАЯ МУЗЫКА":"MUZYKA W TLE","Включить фоновую музыку":"Włącz muzykę w tle","Громкость музыки":"Głośność muzyki","Стиль музыки":"Styl muzyczny","Трек":"Utwór","Прослушать / включить":"Odsłuchaj / odtwórz","Остановить музыку":"Zatrzymaj muzykę","Выключает все звуки игры, включая музыку и эффекты.":"Wycisza wszystkie dźwięki gry, w tym muzykę i efekty.","Девять отдельных композиций разных жанров.":"Wybierz jeden z pięciu stylów muzycznych i jeden z pięciu utworów w każdym stylu."}};
  Object.entries(V41_TRANSLATIONS).forEach(([lang,dict])=>Object.assign(UI_TRANSLATIONS[lang]||(UI_TRANSLATIONS[lang]={}),dict));
  const V42_START_TRANSLATIONS = {
    en:{'Собери состав мечты, открывай паки и докажи, что именно твой клуб достоин вершины.':'Build your dream squad, open packs and prove your club deserves the top.','Создать новый клуб':'Create a new club','Удалить клуб':'Delete club','матчей':'matches','локальное сохранение':'saved locally','Вход в клуб':'Club sign-in','Логин клуба':'Club login','Пароль':'Password','Войти в клуб':'Sign in to club','Отмена':'Cancel','Слишком много попыток. Попробуй снова через':'Too many attempts. Try again in','Слишком много попыток. Повтори через':'Too many attempts. Try again in','Неверный логин или пароль.':'Incorrect login or password.','YOUR CLUB. YOUR LEGACY.':'YOUR CLUB. YOUR LEGACY.','ZERO FOOTBALL / CLUB HUB':'ZERO FOOTBALL / CLUB HUB'},
    uk:{'Собери состав мечты, открывай паки и докажи, что именно твой клуб достоин вершины.':'Збери команду мрії, відкривай паки та доведи, що саме твій клуб гідний вершини.','Создать новый клуб':'Створити новий клуб','Удалить клуб':'Видалити клуб','матчей':'матчів','локальное сохранение':'збережено локально','Вход в клуб':'Вхід до клубу','Логин клуба':'Логін клубу','Пароль':'Пароль','Войти в клуб':'Увійти до клубу','Отмена':'Скасувати','Неверный логин или пароль.':'Неправильний логін або пароль.'},
    de:{'Собери состав мечты, открывай паки и докажи, что именно твой клуб достоин вершины.':'Stelle dein Traumteam zusammen, öffne Packs und beweise, dass dein Club an die Spitze gehört.','Создать новый клуб':'Neuen Club erstellen','Удалить клуб':'Club löschen','матчей':'Spiele','локальное сохранение':'geschütztes Profil','Вход в клуб':'Club-Anmeldung','Логин клуба':'Club-Login','Пароль':'Passwort','Войти в клуб':'Beim Club anmelden','Отмена':'Abbrechen','Неверный логин или пароль.':'Falscher Login oder Passwort.'},
    fr:{'Собери состав мечты, открывай паки и докажи, что именно твой клуб достоин вершины.':'Compose ton équipe de rêve, ouvre des packs et prouve que ton club mérite le sommet.','Создать новый клуб':'Créer un nouveau club','Удалить клуб':'Supprimer le club','матчей':'matchs','локальное сохранение':'profil sécurisé','Вход в клуб':'Connexion au club','Логин клуба':'Identifiant du club','Пароль':'Mot de passe','Войти в клуб':'Se connecter au club','Отмена':'Annuler','Неверный логин или пароль.':'Identifiant ou mot de passe incorrect.'},
    es:{'Собери состав мечты, открывай паки и докажи, что именно твой клуб достоин вершины.':'Forma tu equipo soñado, abre sobres y demuestra que tu club merece llegar a lo más alto.','Создать новый клуб':'Crear un club nuevo','Удалить клуб':'Eliminar club','матчей':'partidos','локальное сохранение':'perfil protegido','Вход в клуб':'Acceso al club','Логин клуба':'Usuario del club','Пароль':'Contraseña','Войти в клуб':'Entrar al club','Отмена':'Cancelar','Неверный логин или пароль.':'Usuario o contraseña incorrectos.'},
    ja:{'Собери состав мечты, открывай паки и докажи, что именно твой клуб достоин вершины.':'夢のチームを編成し、パックを開封して、クラブが頂点にふさわしいことを証明しよう。','Создать новый клуб':'新しいクラブを作成','Удалить клуб':'クラブを削除','матчей':'試合','локальное сохранение':'保護されたプロフィール','Вход в клуб':'クラブにログイン','Логин клуба':'クラブのログイン名','Пароль':'パスワード','Войти в клуб':'クラブにログイン','Отмена':'キャンセル','Неверный логин или пароль.':'ログイン名またはパスワードが違います。'},
    zh:{'Собери состав мечты, открывай паки и докажи, что именно твой клуб достоин вершины.':'组建梦想阵容，开启球员包，证明你的俱乐部配得上巅峰。','Создать новый клуб':'创建新俱乐部','Удалить клуб':'删除俱乐部','матчей':'场比赛','локальное сохранение':'受保护的个人资料','Вход в клуб':'俱乐部登录','Логин клуба':'俱乐部账号','Пароль':'密码','Войти в клуб':'登录俱乐部','Отмена':'取消','Неверный логин или пароль.':'账号或密码错误。'},
    kk:{'Собери состав мечты, открывай паки и докажи, что именно твой клуб достоин вершины.':'Армандаған құрамаңды жина, пактарды аш және клубыңның үздік болуға лайық екенін дәлелде.','Создать новый клуб':'Жаңа клуб құру','Удалить клуб':'Клубты жою','матчей':'матч','локальное сохранение':'қорғалған профиль','Вход в клуб':'Клубқа кіру','Логин клуба':'Клуб логині','Пароль':'Құпиясөз','Войти в клуб':'Клубқа кіру','Отмена':'Бас тарту','Неверный логин или пароль.':'Логин немесе құпиясөз қате.'},
    pl:{'Собери состав мечты, открывай паки и докажи, что именно твой клуб достоин вершины.':'Zbuduj wymarzony skład, otwieraj paczki i udowodnij, że twój klub zasługuje na szczyt.','Создать новый клуб':'Utwórz nowy klub','Удалить клуб':'Usuń klub','матчей':'meczów','локальное сохранение':'zapis lokalny','Вход в клуб':'Logowanie do klubu','Логин клуба':'Login klubu','Пароль':'Hasło','Войти в клуб':'Zaloguj się do klubu','Отмена':'Anuluj','Неверный логин или пароль.':'Nieprawidłowy login lub hasło.'}
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


  const V44_TRANSLATIONS={
    en:{'сек.':'sec.','матчей':'matches','До восстановления матча:':'Next energy in:','Энергия полностью восстановлена':'Energy fully restored','РЕКЛАМА':'ADVERTISEMENT','ПАРТНЁР КЛУБА':'CLUB PARTNER','Рекламное место свободно':'Ad space available','Выбрать спонсора':'Choose a sponsor','Реклама · +1 матч':'Watch ad · +1 match','Рекламная сеть не подключена.':'Ad network is not connected.','Загрузка рекламы…':'Loading ad…','Рекламная сеть временно недоступна.':'Ad network is temporarily unavailable.','Рекламный ролик не был завершён.':'The ad was not completed.','Рекламная награда получена: +1 матч.':'Ad reward received: +3 energy.','Короткий пас':'Short pass','Перевод фланга':'Switch the play','Пас за спину':'Through ball','Продвинуться с мячом':'Carry the ball forward','Навес':'Cross','Прострел назад':'Cutback','Обводка':'Dribble','Сменить фланг':'Switch flank','Быстрая контратака':'Fast counterattack','Притормозить':'Slow the play','Вертикальный пас':'Vertical pass','Удар издали':'Long-range shot','Сесть в блок':'Drop into a low block','Перекрыть пас':'Block the passing lane','Вступить в отбор':'Make a tackle','Удвоить опеку':'Double-mark','Закрыть ближнюю зону':'Cover the near zone','Выбить мяч':'Clear the ball','Подкат в момент':'Timed slide tackle','Удар по воротам':'Shot on goal','Завершение после прострела':'Finish from a cutback','Удар головой':'Header','Выход один на один':'One-on-one','Удар после передачи':'Shot after a pass','Попытка обыграть вратаря':'Round the goalkeeper','Угловой':'Corner','Штрафной':'Free kick','Пенальти':'Penalty','Вбрасывание аута':'Throw-in','Замена':'Substitution','Травма':'Injury','Жёлтая':'Yellow card','Красная':'Red card'},
    uk:{'сек.':'с.','матчей':'матчів','До восстановления матча:':'До наступної енергії:','Энергия полностью восстановлена':'Енергію повністю відновлено','РЕКЛАМА':'РЕКЛАМА','ПАРТНЁР КЛУБА':'ПАРТНЕР КЛУБУ','Рекламное место свободно':'Рекламне місце вільне','Выбрать спонсора':'Обрати спонсора','Реклама · +1 матч':'Переглянути рекламу · +1 матч','Рекламная сеть не подключена.':'Рекламну мережу не підключено.','Загрузка рекламы…':'Завантаження реклами…','Рекламная сеть временно недоступна.':'Рекламна мережа тимчасово недоступна.','Рекламный ролик не был завершён.':'Перегляд реклами не завершено.','Рекламная награда получена: +1 матч.':'Отримано рекламну винагороду: +3 енергії.','Короткий пас':'Короткий пас','Перевод фланга':'Переведення флангу','Продвинуться с мячом':'Просунутися з м’ячем','Навес':'Навіс','Прострел назад':'Простріл назад','Обводка':'Обіграш','Сменить фланг':'Змінити фланг','Быстрая контратака':'Швидка контратака','Притормозить':'Заспокоїти гру','Вертикальный пас':'Вертикальний пас','Удар издали':'Удар здалеку','Сесть в блок':'Сісти в низький блок','Перекрыть пас':'Перекрити передачу','Вступить в отбор':'Вступити у відбір','Удвоить опеку':'Подвоїти опіку','Закрыть ближнюю зону':'Закрити ближню зону','Выбить мяч':'Вибити м’яч','Подкат в момент':'Вчасний підкат','Удар по воротам':'Удар по воротах','Завершение после прострела':'Завершення після прострілу','Удар головой':'Удар головою','Выход один на один':'Вихід сам на сам','Удар после передачи':'Удар після передачі','Попытка обыграть вратаря':'Спроба обіграти воротаря','Угловой':'Кутовий','Штрафной':'Штрафний','Пенальти':'Пенальті','Вбрасывание аута':'Вкидання з-за бокової','Замена':'Заміна','Травма':'Травма','Жёлтая':'Жовта','Красная':'Червона'},
    de:{'Короткий пас':'Kurzpass','Перевод фланга':'Seitenwechsel','Пас за спину':'Steckpass','Продвинуться с мячом':'Mit dem Ball vorrücken','Навес':'Flanke','Прострел назад':'Rückpass','Обводка':'Dribbling','Сменить фланг':'Flügel wechseln','Быстрая контратака':'Schneller Konter','Притормозить':'Tempo herausnehmen','Вертикальный пас':'Vertikalpass','Удар издали':'Fernschuss','Сесть в блок':'Tief stehen','Перекрыть пас':'Passweg zustellen','Вступить в отбор':'Zweikampf suchen','Удвоить опеку':'Doppeln','Закрыть ближнюю зону':'Nahen Raum schließen','Выбить мяч':'Ball klären','Подкат в момент':'Gezielte Grätsche','Удар по воротам':'Torschuss','Завершение после прострела':'Abschluss nach Rückpass','Удар головой':'Kopfball','Выход один на один':'Eins gegen eins','Удар после передачи':'Schuss nach Zuspiel','Попытка обыграть вратаря':'Torwart umspielen','Угловой':'Ecke','Штрафной':'Freistoß','Пенальти':'Elfmeter','Вбрасывание аута':'Einwurf','Замена':'Auswechslung','Травма':'Verletzung','Жёлтая':'Gelb','Красная':'Rot','сек.':'Sek.','матчей':'Spiele','До восстановления матча:':'Nächste Energie in:','Энергия полностью восстановлена':'Energie vollständig wiederhergestellt','РЕКЛАМА':'WERBUNG','ПАРТНЁР КЛУБА':'VEREINSPARTNER','Рекламное место свободно':'Werbeplatz verfügbar','Выбрать спонсора':'Sponsor auswählen','Реклама · +1 матч':'Werbung ansehen · +1 Spiel','Рекламная сеть не подключена.':'Werbenetzwerk ist nicht verbunden.','Загрузка рекламы…':'Werbung wird geladen…','Рекламная сеть временно недоступна.':'Werbenetzwerk ist vorübergehend nicht verfügbar.','Рекламный ролик не был завершён.':'Die Werbung wurde nicht vollständig angesehen.','Рекламная награда получена: +1 матч.':'Werbeprämie erhalten: +3 Energie.'},
    fr:{'Короткий пас':'Passe courte','Перевод фланга':'Renversement du jeu','Пас за спину':'Passe en profondeur','Продвинуться с мячом':'Conduire le ballon','Навес':'Centre','Прострел назад':'Retrait en retrait','Обводка':'Dribble','Сменить фланг':'Changer d’aile','Быстрая контратака':'Contre-attaque rapide','Притормозить':'Ralentir le jeu','Вертикальный пас':'Passe verticale','Удар издали':'Tir de loin','Сесть в блок':'Bloc bas','Перекрыть пас':'Fermer la ligne de passe','Вступить в отбор':'Tenter le tacle','Удвоить опеку':'Prise à deux','Закрыть ближнюю зону':'Fermer le premier poteau','Выбить мяч':'Dégager le ballon','Подкат в момент':'Tacle glissé','Удар по воротам':'Tir au but','Завершение после прострела':'Finition sur retrait','Удар головой':'Tête','Выход один на один':'Face-à-face','Удар после передачи':'Tir après une passe','Попытка обыграть вратаря':'Dribbler le gardien','Угловой':'Corner','Штрафной':'Coup franc','Пенальти':'Penalty','Вбрасывание аута':'Touche','Замена':'Remplacement','Травма':'Blessure','Жёлтая':'Jaune','Красная':'Rouge','сек.':'s','матчей':'matchs','До восстановления матча:':'Prochaine énergie dans :','Энергия полностью восстановлена':'Énergie entièrement restaurée','РЕКЛАМА':'PUBLICITÉ','ПАРТНЁР КЛУБА':'PARTENAIRE DU CLUB','Рекламное место свободно':'Espace publicitaire disponible','Выбрать спонсора':'Choisir un sponsor','Реклама · +1 матч':'Voir la publicité · +1 match','Рекламная сеть не подключена.':'Le réseau publicitaire n’est pas connecté.','Загрузка рекламы…':'Chargement de la publicité…','Рекламная сеть временно недоступна.':'Le réseau publicitaire est temporairement indisponible.','Рекламный ролик не был завершён.':'La publicité n’a pas été regardée jusqu’au bout.','Рекламная награда получена: +1 матч.':'Récompense publicitaire reçue : +3 énergie.'},
    es:{'Короткий пас':'Pase corto','Перевод фланга':'Cambio de orientación','Пас за спину':'Pase al espacio','Продвинуться с мячом':'Avanzar con el balón','Навес':'Centro','Прострел назад':'Pase atrás','Обводка':'Regate','Сменить фланг':'Cambiar de banda','Быстрая контратака':'Contraataque rápido','Притормозить':'Bajar el ritmo','Вертикальный пас':'Pase vertical','Удар издали':'Disparo lejano','Сесть в блок':'Replegarse','Перекрыть пас':'Cerrar línea de pase','Вступить в отбор':'Entrar al tackle','Удвоить опеку':'Doble marcaje','Закрыть ближнюю зону':'Cerrar el primer palo','Выбить мяч':'Despejar el balón','Подкат в момент':'Entrada deslizante','Удар по воротам':'Disparo a puerta','Завершение после прострела':'Remate tras pase atrás','Удар головой':'Remate de cabeza','Выход один на один':'Mano a mano','Удар после передачи':'Disparo tras pase','Попытка обыграть вратаря':'Regatear al portero','Угловой':'Córner','Штрафной':'Tiro libre','Пенальти':'Penalti','Вбрасывание аута':'Saque de banda','Замена':'Sustitución','Травма':'Lesión','Жёлтая':'Amarilla','Красная':'Roja','сек.':'s','матчей':'partidos','До восстановления матча:':'Próxima energía en:','Энергия полностью восстановлена':'Energía totalmente recuperada','РЕКЛАМА':'PUBLICIDAD','ПАРТНЁР КЛУБА':'SOCIO DEL CLUB','Рекламное место свободно':'Espacio publicitario disponible','Выбрать спонсора':'Elegir patrocinador','Реклама · +1 матч':'Ver anuncio · +1 partido','Рекламная сеть не подключена.':'La red publicitaria no está conectada.','Загрузка рекламы…':'Cargando anuncio…','Рекламная сеть временно недоступна.':'La red publicitaria no está disponible temporalmente.','Рекламный ролик не был завершён.':'El anuncio no se completó.','Рекламная награда получена: +1 матч.':'Recompensa publicitaria recibida: +3 energía.'},
    ja:{'Короткий пас':'ショートパス','Перевод фланга':'サイドチェンジ','Пас за спину':'スルーパス','Продвинуться с мячом':'ドリブルで前進','Навес':'クロス','Прострел назад':'マイナスの折り返し','Обводка':'ドリブル突破','Сменить фланг':'サイドを変更','Быстрая контратака':'速攻カウンター','Притормозить':'ペースを落とす','Вертикальный пас':'縦パス','Удар издали':'ロングシュート','Сесть в блок':'低いブロック','Перекрыть пас':'パスコースを遮断','Вступить в отбор':'タックルに行く','Удвоить опеку':'ダブルマーク','Закрыть ближнюю зону':'ニアサイドを守る','Выбить мяч':'ボールをクリア','Подкат в момент':'スライディングタックル','Удар по воротам':'シュート','Завершение после прострела':'折り返しからシュート','Удар головой':'ヘディング','Выход один на один':'1対1','Удар после передачи':'パスからシュート','Попытка обыграть вратаря':'GKをかわす','Угловой':'コーナーキック','Штрафной':'フリーキック','Пенальти':'ペナルティ','Вбрасывание аута':'スローイン','Замена':'選手交代','Травма':'負傷','Жёлтая':'イエローカード','Красная':'レッドカード','сек.':'秒','матчей':'試合','До восстановления матча:':'次のエネルギー回復まで：','Энергия полностью восстановлена':'エネルギーは最大です','РЕКЛАМА':'広告','ПАРТНЁР КЛУБА':'クラブパートナー','Рекламное место свободно':'広告枠があります','Выбрать спонсора':'スポンサーを選択','Реклама · +1 матч':'広告を見る · エネルギー+3','Рекламная сеть не подключена.':'広告ネットワークが接続されていません。','Загрузка рекламы…':'広告を読み込み中…','Рекламная сеть временно недоступна.':'広告ネットワークは一時的に利用できません。','Рекламный ролик не был завершён.':'広告を最後まで視聴していません。','Рекламная награда получена: +1 матч.':'広告報酬を獲得：エネルギー+3。'},
    zh:{'Короткий пас':'短传','Перевод фланга':'转移进攻方向','Пас за спину':'身后直塞','Продвинуться с мячом':'带球推进','Навес':'传中','Прострел назад':'倒三角回传','Обводка':'盘带过人','Сменить фланг':'转移边路','Быстрая контратака':'快速反击','Притормозить':'放慢节奏','Вертикальный пас':'直传','Удар издали':'远射','Сесть в блок':'退守低位防线','Перекрыть пас':'封堵传球路线','Вступить в отбор':'上抢','Удвоить опеку':'双人包夹','Закрыть ближнюю зону':'封锁近门柱区域','Выбить мяч':'解围','Подкат в момент':'滑铲','Удар по воротам':'射门','Завершение после прострела':'接倒三角回传射门','Удар головой':'头球','Выход один на один':'单刀球','Удар после передачи':'接球射门','Попытка обыграть вратаря':'尝试过掉门将','Угловой':'角球','Штрафной':'任意球','Пенальти':'点球','Вбрасывание аута':'界外球','Замена':'换人','Травма':'受伤','Жёлтая':'黄牌','Красная':'红牌','сек.':'秒','матчей':'场比赛','До восстановления матча:':'距离下次体力恢复：','Энергия полностью восстановлена':'体力已完全恢复','РЕКЛАМА':'广告','ПАРТНЁР КЛУБА':'俱乐部合作伙伴','Рекламное место свободно':'广告位空闲','Выбрать спонсора':'选择赞助商','Реклама · +1 матч':'观看广告 · +3体力','Рекламная сеть не подключена.':'尚未连接广告网络。','Загрузка рекламы…':'正在加载广告…','Рекламная сеть временно недоступна.':'广告网络暂时不可用。','Рекламный ролик не был завершён.':'广告尚未完整观看。','Рекламная награда получена: +1 матч.':'已获得广告奖励：+3体力。'},
    kk:{'Короткий пас':'Қысқа пас','Перевод фланга':'Қаптал ауыстыру','Пас за спину':'Қорғаныс артына пас','Продвинуться с мячом':'Доппен алға жылжу','Навес':'Қапталдан пас','Прострел назад':'Артқа көлденең пас','Обводка':'Алдап өту','Сменить фланг':'Қапталды өзгерту','Быстрая контратака':'Жылдам қарсы шабуыл','Притормозить':'Ойынды баяулату','Вертикальный пас':'Тік пас','Удар издали':'Алыстан соққы','Сесть в блок':'Төмен қорғанысқа отыру','Перекрыть пас':'Пас жолын жабу','Вступить в отбор':'Допты тартып алуға ұмтылу','Удвоить опеку':'Қосарлы бақылау','Закрыть ближнюю зону':'Жақын аймақты жабу','Выбить мяч':'Допты тебу','Подкат в момент':'Сырғанап доп тартып алу','Удар по воротам':'Қақпаға соққы','Завершение после прострела':'Көлденең пастан кейін соққы','Удар головой':'Баспен соққы','Выход один на один':'Қақпашымен жеке шығу','Удар после передачи':'Пастан кейін соққы','Попытка обыграть вратаря':'Қақпашыны алдап өту','Угловой':'Бұрыштама','Штрафной':'Айып добы','Пенальти':'Пенальти','Вбрасывание аута':'Аут','Замена':'Ауыстыру','Травма':'Жарақат','Жёлтая':'Сары қағаз','Красная':'Қызыл қағаз','сек.':'сек.','матчей':'матч','До восстановления матча:':'Келесі энергияға дейін:','Энергия полностью восстановлена':'Энергия толық қалпына келді','РЕКЛАМА':'ЖАРНАМА','ПАРТНЁР КЛУБА':'КЛУБ СЕРІКТЕСІ','Рекламное место свободно':'Жарнама орны бос','Выбрать спонсора':'Демеушіні таңдау','Реклама · +1 матч':'Жарнаманы көру · +3 энергия','Рекламная сеть не подключена.':'Жарнама желісі қосылмаған.','Загрузка рекламы…':'Жарнама жүктелуде…','Рекламная сеть временно недоступна.':'Жарнама желісі уақытша қолжетімсіз.','Рекламный ролик не был завершён.':'Жарнама толық қаралмады.','Рекламная награда получена: +1 матч.':'Жарнама сыйлығы алынды: +3 энергия.'},
    pl:{'Короткий пас':'Krótkie podanie','Перевод фланга':'Zmiana strony','Пас за спину':'Podanie za linię obrony','Продвинуться с мячом':'Prowadzenie piłki','Навес':'Dośrodkowanie','Прострел назад':'Wycofanie piłki','Обводка':'Drybling','Сменить фланг':'Zmiana skrzydła','Быстрая контратака':'Szybki kontratak','Притормозить':'Uspokoić grę','Вертикальный пас':'Podanie pionowe','Удар издали':'Strzał z dystansu','Сесть в блок':'Niski blok','Перекрыть пас':'Zamknąć linię podania','Вступить в отбор':'Próba odbioru','Удвоить опеку':'Podwojenie krycia','Закрыть ближнюю зону':'Zamknąć bliższy sektor','Выбить мяч':'Wybić piłkę','Подкат в момент':'Wślizg','Удар по воротам':'Strzał na bramkę','Завершение после прострела':'Strzał po wycofaniu','Удар головой':'Strzał głową','Выход один на один':'Sytuacja sam na sam','Удар после передачи':'Strzał po podaniu','Попытка обыграть вратаря':'Minąć bramkarza','Угловой':'Rzut rożny','Штрафной':'Rzut wolny','Пенальти':'Rzut karny','Вбрасывание аута':'Wrzut z autu','Замена':'Zmiana','Травма':'Kontuzja','Жёлтая':'Żółta kartka','Красная':'Czerwona kartka','сек.':'s','матчей':'meczów','До восстановления матча:':'Następna energia za:','Энергия полностью восстановлена':'Energia w pełni odzyskana','РЕКЛАМА':'REKLAMA','ПАРТНЁР КЛУБА':'PARTNER KLUBU','Рекламное место свободно':'Miejsce reklamowe dostępne','Выбрать спонсора':'Wybierz sponsora','Реклама · +1 матч':'Obejrzyj reklamę · +3 energii','Рекламная сеть не подключена.':'Sieć reklamowa nie jest podłączona.','Загрузка рекламы…':'Ładowanie reklamy…','Рекламная сеть временно недоступна.':'Sieć reklamowa jest chwilowo niedostępna.','Рекламный ролик не был завершён.':'Reklama nie została obejrzana do końca.','Рекламная награда получена: +1 матч.':'Otrzymano nagrodę reklamową: +3 energii.'}
  };
  Object.entries(V44_TRANSLATIONS).forEach(([lang,dict])=>Object.assign(UI_TRANSLATIONS[lang]||(UI_TRANSLATIONS[lang]={}),dict));


  const V51_TRANSLATIONS = {"en": {"Галерея игроков": "Player gallery", "Управление клубом": "Club management", "Тактическая доска": "Tactical board", "Игровой стиль": "Play style", "Список состава": "Squad list", "Анализ состава": "Team report", "Профиль клуба": "Club profile", "Предпросмотр клуба": "Club preview", "Карточка клуба": "Club snapshot", "Зал славы клуба": "Club hall of fame", "Зал славы": "Hall of fame", "Звуки и отклики": "Audio & feedback", "Игровые настройки": "Game preferences", "Внешний вид": "Appearance", "Финальный свисток": "Full time", "Отчёт о матче": "Full-time report", "Матч идёт": "Live match", "Центр матчей": "Match center", "Хроника матча": "Match commentary", "Правила матча": "Match rules", "Поиск соперника": "Matchmaking", "Соперник найден": "Opponent found", "Настройки паков": "Pack experience", "Магазин паков": "Pack market", "Спонсорские контракты": "Sponsor contracts", "Быстрый матч": "Quick match", "ЗАЩИЩЁННЫЙ ВХОД В КЛУБ": "SECURE CLUB ACCESS", "Управление составом": "Squad management", "Музыкальная библиотека · CC0": "Music library · CC0", "Язык": "Language", "Твои результаты": "Your record", "ДОБРО ПОЖАЛОВАТЬ В ТВОЮ ФУТБОЛЬНУЮ ЭРУ": "WELCOME TO YOUR FOOTBALL ERA", "ТВОЙ КЛУБ. ТВОЯ ИСТОРИЯ.": "YOUR CLUB. YOUR LEGACY.", "ZERO FOOTBALL / ЦЕНТР КЛУБА": "ZERO FOOTBALL / CLUB HUB", "Удары": "Shots", "В створ": "On target", "Пасы": "Passes", "Оборона": "Defensive actions", "Удары соперника": "Opponent shots", "Твои эпизоды": "Your plays", "Эмблема клуба": "Club crest", "Индивидуальный знак команды": "Your team identity", "Стартовый пак и флаг клуба": "Starter pack and club flag", "Измени название, страну и эмблему своего клуба.": "Edit your club name, country and crest.", "Внешний вид клуба": "Club appearance", "Так эмблема и название будут выглядеть в меню и матчах.": "This is how your crest and club name appear in menus and matches.", "Все наборы находятся в одном каталоге. Один ежедневный бонусный пак доступен раз в сутки.": "All packs are in one catalogue. One daily bonus pack is available every 24 hours."}, "uk": {"Галерея игроков": "Галерея гравців", "Управление клубом": "Керування клубом", "Тактическая доска": "Тактична дошка", "Игровой стиль": "Ігровий стиль", "Список состава": "Список складу", "Анализ состава": "Оцінка складу", "Профиль клуба": "Профіль клубу", "Предпросмотр клуба": "Попередній перегляд клубу", "Карточка клуба": "Картка клубу", "Зал славы клуба": "Зала слави клубу", "Зал славы": "Зала слави", "Звуки и отклики": "Звуки та відгуки", "Игровые настройки": "Ігрові налаштування", "Внешний вид": "Зовнішній вигляд", "Финальный свисток": "Фінальний свисток", "Отчёт о матче": "Звіт про матч", "Матч идёт": "Матч триває", "Центр матчей": "Центр матчів", "Хроника матча": "Хроніка матчу", "Правила матча": "Правила матчу", "Поиск соперника": "Пошук суперника", "Соперник найден": "Суперника знайдено", "Настройки паков": "Налаштування паків", "Магазин паков": "Магазин паків", "Спонсорские контракты": "Спонсорські контракти", "Быстрый матч": "Швидкий матч", "ЗАЩИЩЁННЫЙ ВХОД В КЛУБ": "ЗАХИЩЕНИЙ ВХІД ДО КЛУБУ", "Управление составом": "Керування складом", "Музыкальная библиотека · CC0": "Музична бібліотека · CC0", "Язык": "Мова", "Твои результаты": "Твої результати", "ДОБРО ПОЖАЛОВАТЬ В ТВОЮ ФУТБОЛЬНУЮ ЭРУ": "ЛАСКАВО ПРОСИМО ДО ТВОЄЇ ФУТБОЛЬНОЇ ЕРИ", "ТВОЙ КЛУБ. ТВОЯ ИСТОРИЯ.": "ТВІЙ КЛУБ. ТВОЯ ІСТОРІЯ.", "ZERO FOOTBALL / ЦЕНТР КЛУБА": "ZERO FOOTBALL / ЦЕНТР КЛУБУ", "Удары": "Удари", "В створ": "У площину", "Пасы": "Передачі", "Оборона": "Оборонні дії", "Удары соперника": "Удари суперника", "Твои эпизоды": "Твої епізоди", "Эмблема клуба": "Емблема клубу", "Индивидуальный знак команды": "Унікальний знак команди", "Стартовый пак и флаг клуба": "Стартовий пак і прапор клубу", "Измени название, страну и эмблему своего клуба.": "Зміни назву, країну та емблему свого клубу.", "Внешний вид клуба": "Вигляд клубу", "Так эмблема и название будут выглядеть в меню и матчах.": "Так емблема та назва виглядатимуть у меню й матчах.", "Все наборы находятся в одном каталоге. Один ежедневный бонусный пак доступен раз в сутки.": "Усі набори зібрані в одному каталозі. Один щоденний бонусний пак доступний раз на добу."}, "de": {"Галерея игроков": "Spielergalerie", "Управление клубом": "Vereinsverwaltung", "Тактическая доска": "Taktiktafel", "Игровой стиль": "Spielstil", "Список состава": "Kaderliste", "Анализ состава": "Kaderanalyse", "Профиль клуба": "Vereinsprofil", "Предпросмотр клуба": "Vorschau des Vereins", "Карточка клуба": "Vereinsübersicht", "Зал славы клуба": "Ruhmeshalle des Vereins", "Зал славы": "Ruhmeshalle", "Звуки и отклики": "Audio und Feedback", "Игровые настройки": "Spieleinstellungen", "Внешний вид": "Erscheinungsbild", "Финальный свисток": "Abpfiff", "Отчёт о матче": "Spielbericht", "Матч идёт": "Spiel läuft", "Центр матчей": "Spielzentrum", "Хроника матча": "Spielbericht im Verlauf", "Правила матча": "Spielregeln", "Поиск соперника": "Gegnersuche", "Соперник найден": "Gegner gefunden", "Настройки паков": "Paketoptionen", "Магазин паков": "Paket-Shop", "Спонсорские контракты": "Sponsorenverträge", "Быстрый матч": "Schnelles Spiel", "ЗАЩИЩЁННЫЙ ВХОД В КЛУБ": "GESCHÜTZTER CLUBZUGANG", "Управление составом": "Kaderverwaltung", "Музыкальная библиотека · CC0": "Musikbibliothek · CC0", "Язык": "Sprache", "Твои результаты": "Deine Ergebnisse", "ДОБРО ПОЖАЛОВАТЬ В ТВОЮ ФУТБОЛЬНУЮ ЭРУ": "WILLKOMMEN IN DEINER FUSSBALLÄRA", "ТВОЙ КЛУБ. ТВОЯ ИСТОРИЯ.": "DEIN VEREIN. DEINE GESCHICHTE.", "ZERO FOOTBALL / ЦЕНТР КЛУБА": "ZERO FOOTBALL / VEREINSZENTRUM", "Удары": "Schüsse", "В створ": "Aufs Tor", "Пасы": "Pässe", "Оборона": "Abwehraktionen", "Удары соперника": "Schüsse des Gegners", "Твои эпизоды": "Deine Spielzüge", "Эмблема клуба": "Vereinswappen", "Индивидуальный знак команды": "Das eigene Zeichen deines Teams", "Стартовый пак и флаг клуба": "Startpaket und Vereinsflagge", "Измени название, страну и эмблему своего клуба.": "Ändere Name, Land und Wappen deines Vereins.", "Внешний вид клуба": "Vereinsauftritt", "Так эмблема и название будут выглядеть в меню и матчах.": "So erscheinen Wappen und Vereinsname in Menüs und Spielen.", "Все наборы находятся в одном каталоге. Один ежедневный бонусный пак доступен раз в сутки.": "Alle Pakete befinden sich in einem Katalog. Ein tägliches Bonuspaket ist alle 24 Stunden verfügbar."}, "fr": {"Галерея игроков": "Galerie des joueurs", "Управление клубом": "Gestion du club", "Тактическая доска": "Tableau tactique", "Игровой стиль": "Style de jeu", "Список состава": "Liste de l’équipe", "Анализ состава": "Analyse de l’équipe", "Профиль клуба": "Profil du club", "Предпросмотр клуба": "Aperçu du club", "Карточка клуба": "Fiche du club", "Зал славы клуба": "Panthéon du club", "Зал славы": "Panthéon", "Звуки и отклики": "Audio et retours", "Игровые настройки": "Paramètres du jeu", "Внешний вид": "Apparence", "Финальный свисток": "Coup de sifflet final", "Отчёт о матче": "Rapport du match", "Матч идёт": "Match en cours", "Центр матчей": "Centre des matchs", "Хроника матча": "Chronique du match", "Правила матча": "Règles du match", "Поиск соперника": "Recherche d’adversaire", "Соперник найден": "Adversaire trouvé", "Настройки паков": "Options des packs", "Магазин паков": "Boutique de packs", "Спонсорские контракты": "Contrats de sponsoring", "Быстрый матч": "Match rapide", "ЗАЩИЩЁННЫЙ ВХОД В КЛУБ": "ACCÈS SÉCURISÉ AU CLUB", "Управление составом": "Gestion de l’effectif", "Музыкальная библиотека · CC0": "Bibliothèque musicale · CC0", "Язык": "Langue", "Твои результаты": "Tes résultats", "ДОБРО ПОЖАЛОВАТЬ В ТВОЮ ФУТБОЛЬНУЮ ЭРУ": "BIENVENUE DANS TON ÈRE DU FOOTBALL", "ТВОЙ КЛУБ. ТВОЯ ИСТОРИЯ.": "TON CLUB. TON HISTOIRE.", "ZERO FOOTBALL / ЦЕНТР КЛУБА": "ZERO FOOTBALL / CENTRE DU CLUB", "Удары": "Tirs", "В створ": "Cadrés", "Пасы": "Passes", "Оборона": "Actions défensives", "Удары соперника": "Tirs adverses", "Твои эпизоды": "Tes actions", "Эмблема клуба": "Écusson du club", "Индивидуальный знак команды": "L’identité de ton équipe", "Стартовый пак и флаг клуба": "Pack de départ et drapeau du club", "Измени название, страну и эмблему своего клуба.": "Modifie le nom, le pays et l’écusson de ton club.", "Внешний вид клуба": "Identité visuelle du club", "Так эмблема и название будут выглядеть в меню и матчах.": "Voici comment le nom et l’écusson apparaîtront dans les menus et les matchs.", "Все наборы находятся в одном каталоге. Один ежедневный бонусный пак доступен раз в сутки.": "Tous les packs sont réunis dans un catalogue. Un pack bonus quotidien est disponible toutes les 24 heures."}, "es": {"Галерея игроков": "Galería de jugadores", "Управление клубом": "Gestión del club", "Тактическая доска": "Pizarra táctica", "Игровой стиль": "Estilo de juego", "Список состава": "Lista de plantilla", "Анализ состава": "Análisis de plantilla", "Профиль клуба": "Perfil del club", "Предпросмотр клуба": "Vista previa del club", "Карточка клуба": "Ficha del club", "Зал славы клуба": "Salón de la fama del club", "Зал славы": "Salón de la fama", "Звуки и отклики": "Audio y comentarios", "Игровые настройки": "Ajustes del juego", "Внешний вид": "Apariencia", "Финальный свисток": "Final del partido", "Отчёт о матче": "Informe del partido", "Матч идёт": "Partido en juego", "Центр матчей": "Centro de partidos", "Хроника матча": "Crónica del partido", "Правила матча": "Reglas del partido", "Поиск соперника": "Buscar rival", "Соперник найден": "Rival encontrado", "Настройки паков": "Opciones de paquetes", "Магазин паков": "Tienda de paquetes", "Спонсорские контракты": "Contratos de patrocinio", "Быстрый матч": "Partido rápido", "ЗАЩИЩЁННЫЙ ВХОД В КЛУБ": "ACCESO SEGURO AL CLUB", "Управление составом": "Gestión de plantilla", "Музыкальная библиотека · CC0": "Biblioteca musical · CC0", "Язык": "Idioma", "Твои результаты": "Tus resultados", "ДОБРО ПОЖАЛОВАТЬ В ТВОЮ ФУТБОЛЬНУЮ ЭРУ": "BIENVENIDO A TU ERA DEL FÚTBOL", "ТВОЙ КЛУБ. ТВОЯ ИСТОРИЯ.": "TU CLUB. TU HISTORIA.", "ZERO FOOTBALL / ЦЕНТР КЛУБА": "ZERO FOOTBALL / CENTRO DEL CLUB", "Удары": "Tiros", "В створ": "A puerta", "Пасы": "Pases", "Оборона": "Acciones defensivas", "Удары соперника": "Tiros del rival", "Твои эпизоды": "Tus jugadas", "Эмблема клуба": "Escudo del club", "Индивидуальный знак команды": "La identidad de tu equipo", "Стартовый пак и флаг клуба": "Paquete inicial y bandera del club", "Измени название, страну и эмблему своего клуба.": "Cambia el nombre, el país y el escudo de tu club.", "Внешний вид клуба": "Identidad del club", "Так эмблема и название будут выглядеть в меню и матчах.": "Así aparecerán el escudo y el nombre del club en los menús y partidos.", "Все наборы находятся в одном каталоге. Один ежедневный бонусный пак доступен раз в сутки.": "Todos los paquetes están en un solo catálogo. Hay un paquete diario de bonificación cada 24 horas."}, "ja": {"Галерея игроков": "選手ギャラリー", "Управление клубом": "クラブ管理", "Тактическая доска": "戦術ボード", "Игровой стиль": "プレースタイル", "Список состава": "選手一覧", "Анализ состава": "チーム分析", "Профиль клуба": "クラブプロフィール", "Предпросмотр клуба": "クラブプレビュー", "Карточка клуба": "クラブ概要", "Зал славы клуба": "クラブの殿堂", "Зал славы": "殿堂", "Звуки и отклики": "サウンドとフィードバック", "Игровые настройки": "ゲーム設定", "Внешний вид": "外観", "Финальный свисток": "試合終了", "Отчёт о матче": "試合レポート", "Матч идёт": "試合中", "Центр матчей": "試合センター", "Хроника матча": "試合経過", "Правила матча": "試合ルール", "Поиск соперника": "対戦相手を検索", "Соперник найден": "対戦相手が見つかりました", "Настройки паков": "パック設定", "Магазин паков": "パックショップ", "Спонсорские контракты": "スポンサー契約", "Быстрый матч": "クイックマッチ", "ЗАЩИЩЁННЫЙ ВХОД В КЛУБ": "クラブの安全なログイン", "Управление составом": "チーム管理", "Музыкальная библиотека · CC0": "音楽ライブラリ · CC0", "Язык": "言語", "Твои результаты": "成績", "ДОБРО ПОЖАЛОВАТЬ В ТВОЮ ФУТБОЛЬНУЮ ЭРУ": "サッカーの新時代へようこそ", "ТВОЙ КЛУБ. ТВОЯ ИСТОРИЯ.": "あなたのクラブ。あなたの歴史。", "ZERO FOOTBALL / ЦЕНТР КЛУБА": "ZERO FOOTBALL / クラブセンター", "Удары": "シュート", "В створ": "枠内シュート", "Пасы": "パス", "Оборона": "守備アクション", "Удары соперника": "相手のシュート", "Твои эпизоды": "あなたのプレー", "Эмблема клуба": "クラブエンブレム", "Индивидуальный знак команды": "チーム独自のシンボル", "Стартовый пак и флаг клуба": "スターターパックとクラブ旗", "Измени название, страну и эмблему своего клуба.": "クラブ名、国、エンブレムを変更できます。", "Внешний вид клуба": "クラブの外観", "Так эмблема и название будут выглядеть в меню и матчах.": "メニューや試合で表示されるエンブレムとクラブ名です。", "Все наборы находятся в одном каталоге. Один ежедневный бонусный пак доступен раз в сутки.": "すべてのパックを1つのカタログにまとめました。デイリーボーナスパックは24時間ごとに1回利用できます。"}, "zh": {"Галерея игроков": "球员图库", "Управление клубом": "俱乐部管理", "Тактическая доска": "战术板", "Игровой стиль": "比赛风格", "Список состава": "阵容列表", "Анализ состава": "阵容分析", "Профиль клуба": "俱乐部资料", "Предпросмотр клуба": "俱乐部预览", "Карточка клуба": "俱乐部概览", "Зал славы клуба": "俱乐部名人堂", "Зал славы": "名人堂", "Звуки и отклики": "音频与反馈", "Игровые настройки": "游戏设置", "Внешний вид": "外观", "Финальный свисток": "终场哨响", "Отчёт о матче": "比赛报告", "Матч идёт": "比赛进行中", "Центр матчей": "比赛中心", "Хроника матча": "比赛记录", "Правила матча": "比赛规则", "Поиск соперника": "寻找对手", "Соперник найден": "已找到对手", "Настройки паков": "卡包设置", "Магазин паков": "卡包商店", "Спонсорские контракты": "赞助合同", "Быстрый матч": "快速比赛", "ЗАЩИЩЁННЫЙ ВХОД В КЛУБ": "安全俱乐部登录", "Управление составом": "阵容管理", "Музыкальная библиотека · CC0": "音乐库 · CC0", "Язык": "语言", "Твои результаты": "你的战绩", "ДОБРО ПОЖАЛОВАТЬ В ТВОЮ ФУТБОЛЬНУЮ ЭРУ": "欢迎进入你的足球时代", "ТВОЙ КЛУБ. ТВОЯ ИСТОРИЯ.": "你的俱乐部，你的历史。", "ZERO FOOTBALL / ЦЕНТР КЛУБА": "ZERO FOOTBALL / 俱乐部中心", "Удары": "射门", "В створ": "射正", "Пасы": "传球", "Оборона": "防守动作", "Удары соперника": "对手射门", "Твои эпизоды": "你的回合", "Эмблема клуба": "俱乐部徽章", "Индивидуальный знак команды": "球队专属标志", "Стартовый пак и флаг клуба": "初始卡包与俱乐部旗帜", "Измени название, страну и эмблему своего клуба.": "修改俱乐部名称、国家和徽章。", "Внешний вид клуба": "俱乐部外观", "Так эмблема и название будут выглядеть в меню и матчах.": "徽章和俱乐部名称将在菜单及比赛中如此显示。", "Все наборы находятся в одном каталоге. Один ежедневный бонусный пак доступен раз в сутки.": "所有卡包都在同一目录中。每日奖励卡包每24小时可领取一次。"}, "kk": {"Галерея игроков": "Ойыншылар галереясы", "Управление клубом": "Клубты басқару", "Тактическая доска": "Тактикалық тақта", "Игровой стиль": "Ойын стилі", "Список состава": "Құрам тізімі", "Анализ состава": "Құрамды талдау", "Профиль клуба": "Клуб профилі", "Предпросмотр клуба": "Клубты алдын ала қарау", "Карточка клуба": "Клуб туралы мәлімет", "Зал славы клуба": "Клуб даңқ залы", "Зал славы": "Даңқ залы", "Звуки и отклики": "Дыбыс және кері байланыс", "Игровые настройки": "Ойын баптаулары", "Внешний вид": "Сыртқы көрініс", "Финальный свисток": "Қорытынды ысқырық", "Отчёт о матче": "Матч есебі", "Матч идёт": "Матч жүріп жатыр", "Центр матчей": "Матч орталығы", "Хроника матча": "Матч барысы", "Правила матча": "Матч ережелері", "Поиск соперника": "Қарсылас іздеу", "Соперник найден": "Қарсылас табылды", "Настройки паков": "Пак баптаулары", "Магазин паков": "Пак дүкені", "Спонсорские контракты": "Демеушілік келісімдер", "Быстрый матч": "Жылдам матч", "ЗАЩИЩЁННЫЙ ВХОД В КЛУБ": "КЛУБҚА ҚАУІПСІЗ КІРУ", "Управление составом": "Құрамды басқару", "Музыкальная библиотека · CC0": "Музыка кітапханасы · CC0", "Язык": "Тіл", "Твои результаты": "Нәтижелерің", "ДОБРО ПОЖАЛОВАТЬ В ТВОЮ ФУТБОЛЬНУЮ ЭРУ": "ФУТБОЛ ДӘУІРІҢЕ ҚОШ КЕЛДІҢ", "ТВОЙ КЛУБ. ТВОЯ ИСТОРИЯ.": "СЕНІҢ КЛУБЫҢ. СЕНІҢ ТАРИХЫҢ.", "ZERO FOOTBALL / ЦЕНТР КЛУБА": "ZERO FOOTBALL / КЛУБ ОРТАЛЫҒЫ", "Удары": "Соққылар", "В створ": "Қақпаға дәл", "Пасы": "Пастар", "Оборона": "Қорғаныс әрекеттері", "Удары соперника": "Қарсылас соққылары", "Твои эпизоды": "Сенің эпизодтарың", "Эмблема клуба": "Клуб эмблемасы", "Индивидуальный знак команды": "Команданың жеке белгісі", "Стартовый пак и флаг клуба": "Бастапқы пак пен клуб туы", "Измени название, страну и эмблему своего клуба.": "Клубтың атауын, елін және эмблемасын өзгерт.", "Внешний вид клуба": "Клубтың сыртқы көрінісі", "Так эмблема и название будут выглядеть в меню и матчах.": "Мәзір мен матчтарда эмблема мен клуб атауы осылай көрінеді.", "Все наборы находятся в одном каталоге. Один ежедневный бонусный пак доступен раз в сутки.": "Барлық пак бір каталогта. Күнделікті бонус пак әр 24 сағат сайын қолжетімді."}, "pl": {"Галерея игроков": "Galeria zawodników", "Управление клубом": "Zarządzanie klubem", "Тактическая доска": "Tablica taktyczna", "Игровой стиль": "Styl gry", "Список состава": "Lista składu", "Анализ состава": "Analiza drużyny", "Профиль клуба": "Profil klubu", "Предпросмотр клуба": "Podgląd klubu", "Карточка клуба": "Informacje o klubie", "Зал славы клуба": "Galeria sław klubu", "Зал славы": "Galeria sław", "Звуки и отклики": "Dźwięk i informacje zwrotne", "Игровые настройки": "Ustawienia gry", "Внешний вид": "Wygląd", "Финальный свисток": "Koniec meczu", "Отчёт о матче": "Raport z meczu", "Матч идёт": "Mecz trwa", "Центр матчей": "Centrum meczowe", "Хроника матча": "Przebieg meczu", "Правила матча": "Zasady meczu", "Поиск соперника": "Wyszukiwanie rywala", "Соперник найден": "Znaleziono rywala", "Настройки паков": "Ustawienia paczek", "Магазин паков": "Sklep z paczkami", "Спонсорские контракты": "Umowy sponsorskie", "Быстрый матч": "Szybki mecz", "ЗАЩИЩЁННЫЙ ВХОД В КЛУБ": "BEZPIECZNE LOGOWANIE DO KLUBU", "Управление составом": "Zarządzanie składem", "Музыкальная библиотека · CC0": "Biblioteka muzyczna · CC0", "Язык": "Język", "Твои результаты": "Twoje wyniki", "ДОБРО ПОЖАЛОВАТЬ В ТВОЮ ФУТБОЛЬНУЮ ЭРУ": "WITAJ W SWOJEJ PIŁKARSKIEJ ERZE", "ТВОЙ КЛУБ. ТВОЯ ИСТОРИЯ.": "TWÓJ KLUB. TWOJA HISTORIA.", "ZERO FOOTBALL / ЦЕНТР КЛУБА": "ZERO FOOTBALL / CENTRUM KLUBU", "Удары": "Strzały", "В створ": "Celne", "Пасы": "Podania", "Оборона": "Działania obronne", "Удары соперника": "Strzały rywala", "Твои эпизоды": "Twoje akcje", "Эмблема клуба": "Herb klubu", "Индивидуальный знак команды": "Unikalny znak drużyny", "Стартовый пак и флаг клуба": "Pakiet startowy i flaga klubu", "Измени название, страну и эмблему своего клуба.": "Zmień nazwę, kraj i herb swojego klubu.", "Внешний вид клуба": "Wygląd klubu", "Так эмблема и название будут выглядеть в меню и матчах.": "Tak herb i nazwa klubu będą wyglądać w menu i podczas meczów.", "Все наборы находятся в одном каталоге. Один ежедневный бонусный пак доступен раз в сутки.": "Wszystkie pakiety są w jednym katalogu. Jeden dzienny pakiet bonusowy jest dostępny co 24 godziny."}};
  Object.entries(V51_TRANSLATIONS).forEach(([lang,dict])=>Object.assign(UI_TRANSLATIONS[lang]||(UI_TRANSLATIONS[lang]={}),dict));
  Object.entries(window.ZF_DATA.V51_EXTRA_TRANSLATIONS||{}).forEach(([lang,dict])=>Object.assign(UI_TRANSLATIONS[lang]||(UI_TRANSLATIONS[lang]={}),dict));

  const V52_TRANSLATIONS={"en":{"СПОНСОР ФОРМЫ":"KIT SPONSOR","ОСНОВНОЙ СПОНСОР":"MAIN SPONSOR","ДОПОЛНИТЕЛЬНЫЙ СПОНСОР":"ADDITIONAL SPONSOR","СПОНСОР НЕ ВЫБРАН":"NO SPONSOR SELECTED","Уровень":"Level","За матч":"Per match","За победу":"Per win","Подписание":"Signing fee","Требования":"Requirements","Без требований":"No requirements","Активен":"Active","СВОБОДНО":"AVAILABLE","ЗАКЛЮЧЁН":"SIGNED","Пока недоступен":"Not available yet","Подписать на 30 дней":"Sign for 30 days","Контракт действует до окончания":"Contract active until expiry","Осталось":"Remaining","Победа":"Win","Контракт истёк":"Contract expired","Выбери партнёра для этого рекламного места.":"Choose a partner for this sponsorship slot.","Молодой бренд экипировки":"Young sportswear brand","Спортивная одежда":"Sportswear","Футбольная экипировка":"Football equipment","Бутсы и аксессуары":"Boots and accessories","Профессиональная форма":"Professional kits","Титульный партнёр клуба":"Club title partner","Энергетические напитки":"Energy drinks","Финансовый партнёр":"Financial partner","Технологический партнёр":"Technology partner","Главный партнёр сезона":"Main season partner","Напитки для болельщиков":"Drinks for supporters","Игровая студия":"Game studio","Питание команды":"Team catering","Цифровые сервисы":"Digital services","Звук и медиа":"Audio and media","Аналитика и тренировочные технологии":"Analytics and training technology","Международный партнёр клуба":"International club partner","Экипировка для молодых клубов":"Kits for young clubs","Региональный производитель формы":"Regional kit manufacturer","Технологичная экипировка":"Technical sportswear","Международный экипировочный партнёр":"International kit partner","Премиальная форма для топ-клубов":"Premium kits for elite clubs","Первый титульный партнёр":"First title partner","Финансовая компания региона":"Regional finance company","Энергетический партнёр":"Energy partner","Международный титульный партнёр":"International title partner","Партнёр клубов мирового уровня":"Partner to world-class clubs","Питание и напитки для болельщиков":"Food and drinks for fans","Региональное спортивное радио":"Regional sports radio","Партнёр трансляций и контента":"Broadcast and content partner","Логистика и поездки команды":"Team travel and logistics","Аналитические решения для элитных клубов":"Analytics solutions for elite clubs","Ежедневные задания":"Daily missions","Ежемесячные задания":"Monthly missions","ЗАДАНИЯ НА СЕГОДНЯ":"TODAY’S MISSIONS","ЗАДАНИЯ НА МЕСЯЦ":"MONTHLY MISSIONS","Долгосрочные цели":"Long-term goals","30 ЗАДАНИЙ КЛУБА":"30 CLUB MISSIONS","Выполняй цели и забирай награды за прогресс клуба.":"Complete objectives and collect club progression rewards.","Опыт за сыгранные матчи, победы и удачные решения.":"Earn experience from matches, wins and good decisions.","УРОВЕНЬ КЛУБА":"CLUB LEVEL","До уровня":"Next level","Максимальный уровень":"Maximum level","Задания и уровни":"Missions & levels","Получено":"Claimed","Забрать":"Claim","Сыграй 1 матч.":"Play 1 match.","Одержи 1 победу.":"Win 1 match.","Забей 3 гола.":"Score 3 goals.","Открой 1 пак.":"Open 1 pack.","Сыграй 2 матча.":"Play 2 matches.","Сыграй 12 матчей за месяц.":"Play 12 matches this month.","Одержи 6 побед за месяц.":"Win 6 matches this month.","Забей 30 голов за месяц.":"Score 30 goals this month.","Открой 8 паков за месяц.":"Open 8 packs this month.","Сыграй 8 матчей за месяц.":"Play 8 matches this month.","Сыграй":"Play","Забей":"Score","Одержать":"Win","Собрать":"Collect","Достичь":"Reach","матчей":"matches","побед":"wins","голов":"goals","паков":"packs","игроков":"players","Контракты и продление доступны только в настройке команды.":"Contracts and renewals are available only in Team Settings.","КОНТРАКТЫ ИГРОКОВ":"PLAYER CONTRACTS","Продлить":"Extend","Восстановить":"Restore","Контракт":"Contract","Продлить контракт":"Extend contract","Контракт этого типа ещё действует. Его нельзя заменить до окончания срока.":"This sponsorship contract is still active. It cannot be replaced before it expires."},"uk":{"СПОНСОР ФОРМЫ":"СПОНСОР ФОРМИ","ОСНОВНОЙ СПОНСОР":"ГОЛОВНИЙ СПОНСОР","ДОПОЛНИТЕЛЬНЫЙ СПОНСОР":"ДОДАТКОВИЙ СПОНСОР","СПОНСОР НЕ ВЫБРАН":"СПОНСОРА НЕ ОБРАНО","Уровень":"Рівень","За матч":"За матч","За победу":"За перемогу","Подписание":"Підписання","Требования":"Вимоги","Без требований":"Без вимог","Активен":"Активний","СВОБОДНО":"ВІЛЬНО","ЗАКЛЮЧЁН":"ПІДПИСАНО","Пока недоступен":"Поки недоступний","Подписать на 30 дней":"Підписати на 30 днів","Контракт действует до окончания":"Контракт діє до завершення","Осталось":"Залишилося","Победа":"Перемога","Контракт истёк":"Контракт завершився","Выбери партнёра для этого рекламного места.":"Обери партнера для цього рекламного місця.","Молодой бренд экипировки":"Молодий бренд екіпірування","Спортивная одежда":"Спортивний одяг","Футбольная экипировка":"Футбольне екіпірування","Бутсы и аксессуары":"Бутси й аксесуари","Профессиональная форма":"Професійна форма","Титульный партнёр клуба":"Головний партнер клубу","Энергетические напитки":"Енергетичні напої","Финансовый партнёр":"Фінансовий партнер","Технологический партнёр":"Технологічний партнер","Главный партнёр сезона":"Головний партнер сезону","Напитки для болельщиков":"Напої для вболівальників","Игровая студия":"Ігрова студія","Питание команды":"Харчування команди","Цифровые сервисы":"Цифрові сервіси","Звук и медиа":"Звук і медіа","Аналитика и тренировочные технологии":"Аналітика й тренувальні технології","Международный партнёр клуба":"Міжнародний партнер клубу","Экипировка для молодых клубов":"Kits for young clubs","Региональный производитель формы":"Regional kit manufacturer","Технологичная экипировка":"Technical sportswear","Международный экипировочный партнёр":"International kit partner","Премиальная форма для топ-клубов":"Premium kits for elite clubs","Первый титульный партнёр":"First title partner","Финансовая компания региона":"Regional finance company","Энергетический партнёр":"Energy partner","Международный титульный партнёр":"International title partner","Партнёр клубов мирового уровня":"Partner to world-class clubs","Питание и напитки для болельщиков":"Food and drinks for fans","Региональное спортивное радио":"Regional sports radio","Партнёр трансляций и контента":"Broadcast and content partner","Логистика и поездки команды":"Team travel and logistics","Аналитические решения для элитных клубов":"Analytics solutions for elite clubs","Ежедневные задания":"Щоденні завдання","Ежемесячные задания":"Щомісячні завдання","ЗАДАНИЯ НА СЕГОДНЯ":"ЗАВДАННЯ НА СЬОГОДНІ","ЗАДАНИЯ НА МЕСЯЦ":"ЗАВДАННЯ НА МІСЯЦЬ","Долгосрочные цели":"Довгострокові цілі","30 ЗАДАНИЙ КЛУБА":"30 ЗАВДАНЬ КЛУБУ","Выполняй цели и забирай награды за прогресс клуба.":"Виконуй цілі та отримуй нагороди за розвиток клубу.","Опыт за сыгранные матчи, победы и удачные решения.":"Досвід за зіграні матчі, перемоги та вдалі рішення.","УРОВЕНЬ КЛУБА":"РІВЕНЬ КЛУБУ","До уровня":"До рівня","Максимальный уровень":"Максимальний рівень","Задания и уровни":"Завдання та рівні","Получено":"Отримано","Забрать":"Забрати","Сыграй 1 матч.":"Play 1 match.","Одержи 1 победу.":"Win 1 match.","Забей 3 гола.":"Score 3 goals.","Открой 1 пак.":"Open 1 pack.","Сыграй 2 матча.":"Play 2 matches.","Сыграй 12 матчей за месяц.":"Play 12 matches this month.","Одержи 6 побед за месяц.":"Win 6 matches this month.","Забей 30 голов за месяц.":"Score 30 goals this month.","Открой 8 паков за месяц.":"Open 8 packs this month.","Сыграй 8 матчей за месяц.":"Play 8 matches this month.","Сыграй":"Play","Забей":"Score","Одержать":"Win","Собрать":"Collect","Достичь":"Reach","матчей":"matches","побед":"wins","голов":"goals","паков":"packs","игроков":"players","Контракты и продление доступны только в настройке команды.":"Контракти та продовження доступні лише в налаштуванні команди.","КОНТРАКТЫ ИГРОКОВ":"КОНТРАКТИ ГРАВЦІВ","Продлить":"Продовжити","Восстановить":"Відновити","Контракт":"Contract","Продлить контракт":"Extend contract","Контракт этого типа ещё действует. Его нельзя заменить до окончания срока.":"Цей спонсорський контракт ще діє. Його не можна замінити до завершення строку."},"de":{"СПОНСОР ФОРМЫ":"TRIKOTSPONSOR","ОСНОВНОЙ СПОНСОР":"HAUPTSPONSOR","ДОПОЛНИТЕЛЬНЫЙ СПОНСОР":"ZUSATZSPONSOR","СПОНСОР НЕ ВЫБРАН":"KEIN SPONSOR GEWÄHLT","Уровень":"Stufe","За матч":"Pro Spiel","За победу":"Pro Sieg","Подписание":"Abschlussgebühr","Требования":"Anforderungen","Без требований":"Keine Anforderungen","Активен":"Aktiv","СВОБОДНО":"FREI","ЗАКЛЮЧЁН":"UNTERZEICHNET","Пока недоступен":"Noch nicht verfügbar","Подписать на 30 дней":"Für 30 Tage abschließen","Контракт действует до окончания":"Vertrag läuft bis zum Ende","Осталось":"Remaining","Победа":"Win","Контракт истёк":"Contract expired","Выбери партнёра для этого рекламного места.":"Choose a partner for this sponsorship slot.","Молодой бренд экипировки":"Young sportswear brand","Спортивная одежда":"Sportswear","Футбольная экипировка":"Football equipment","Бутсы и аксессуары":"Boots and accessories","Профессиональная форма":"Professional kits","Титульный партнёр клуба":"Club title partner","Энергетические напитки":"Energy drinks","Финансовый партнёр":"Financial partner","Технологический партнёр":"Technology partner","Главный партнёр сезона":"Main season partner","Напитки для болельщиков":"Drinks for supporters","Игровая студия":"Game studio","Питание команды":"Team catering","Цифровые сервисы":"Digital services","Звук и медиа":"Audio and media","Аналитика и тренировочные технологии":"Analytics and training technology","Международный партнёр клуба":"International club partner","Экипировка для молодых клубов":"Kits for young clubs","Региональный производитель формы":"Regional kit manufacturer","Технологичная экипировка":"Technical sportswear","Международный экипировочный партнёр":"International kit partner","Премиальная форма для топ-клубов":"Premium kits for elite clubs","Первый титульный партнёр":"First title partner","Финансовая компания региона":"Regional finance company","Энергетический партнёр":"Energy partner","Международный титульный партнёр":"International title partner","Партнёр клубов мирового уровня":"Partner to world-class clubs","Питание и напитки для болельщиков":"Food and drinks for fans","Региональное спортивное радио":"Regional sports radio","Партнёр трансляций и контента":"Broadcast and content partner","Логистика и поездки команды":"Team travel and logistics","Аналитические решения для элитных клубов":"Analytics solutions for elite clubs","Ежедневные задания":"Tägliche Aufgaben","Ежемесячные задания":"Monatliche Aufgaben","ЗАДАНИЯ НА СЕГОДНЯ":"AUFGABEN FÜR HEUTE","ЗАДАНИЯ НА МЕСЯЦ":"MONATSAUFGABEN","Долгосрочные цели":"Langzeitziele","30 ЗАДАНИЙ КЛУБА":"30 CLUBAUFGABEN","Выполняй цели и забирай награды за прогресс клуба.":"Complete objectives and collect club progression rewards.","Опыт за сыгранные матчи, победы и удачные решения.":"Earn experience from matches, wins and good decisions.","УРОВЕНЬ КЛУБА":"CLUBLEVEL","До уровня":"Next level","Максимальный уровень":"Maximum level","Задания и уровни":"Aufgaben & Level","Получено":"Abgeholt","Забрать":"Abholen","Сыграй 1 матч.":"Play 1 match.","Одержи 1 победу.":"Win 1 match.","Забей 3 гола.":"Score 3 goals.","Открой 1 пак.":"Open 1 pack.","Сыграй 2 матча.":"Play 2 matches.","Сыграй 12 матчей за месяц.":"Play 12 matches this month.","Одержи 6 побед за месяц.":"Win 6 matches this month.","Забей 30 голов за месяц.":"Score 30 goals this month.","Открой 8 паков за месяц.":"Open 8 packs this month.","Сыграй 8 матчей за месяц.":"Play 8 matches this month.","Сыграй":"Play","Забей":"Score","Одержать":"Win","Собрать":"Collect","Достичь":"Reach","матчей":"matches","побед":"wins","голов":"goals","паков":"packs","игроков":"players","Контракты и продление доступны только в настройке команды.":"Verträge und Verlängerungen sind nur in den Teameinstellungen verfügbar.","КОНТРАКТЫ ИГРОКОВ":"SPIELERVERTRÄGE","Продлить":"Verlängern","Восстановить":"Wiederherstellen","Контракт":"Contract","Продлить контракт":"Extend contract","Контракт этого типа ещё действует. Его нельзя заменить до окончания срока.":"Dieser Sponsorenvertrag ist noch aktiv und kann erst nach Ablauf ersetzt werden."},"fr":{"СПОНСОР ФОРМЫ":"SPONSOR DU MAILLOT","ОСНОВНОЙ СПОНСОР":"SPONSOR PRINCIPAL","ДОПОЛНИТЕЛЬНЫЙ СПОНСОР":"SPONSOR SECONDAIRE","СПОНСОР НЕ ВЫБРАН":"AUCUN SPONSOR CHOISI","Уровень":"Niveau","За матч":"Par match","За победу":"Par victoire","Подписание":"Frais de signature","Требования":"Conditions","Без требований":"Aucune condition","Активен":"Actif","СВОБОДНО":"LIBRE","ЗАКЛЮЧЁН":"SIGNÉ","Пока недоступен":"Pas encore disponible","Подписать на 30 дней":"Signer pour 30 jours","Контракт действует до окончания":"Contrat actif jusqu’à expiration","Осталось":"Remaining","Победа":"Win","Контракт истёк":"Contract expired","Выбери партнёра для этого рекламного места.":"Choose a partner for this sponsorship slot.","Молодой бренд экипировки":"Young sportswear brand","Спортивная одежда":"Sportswear","Футбольная экипировка":"Football equipment","Бутсы и аксессуары":"Boots and accessories","Профессиональная форма":"Professional kits","Титульный партнёр клуба":"Club title partner","Энергетические напитки":"Energy drinks","Финансовый партнёр":"Financial partner","Технологический партнёр":"Technology partner","Главный партнёр сезона":"Main season partner","Напитки для болельщиков":"Drinks for supporters","Игровая студия":"Game studio","Питание команды":"Team catering","Цифровые сервисы":"Digital services","Звук и медиа":"Audio and media","Аналитика и тренировочные технологии":"Analytics and training technology","Международный партнёр клуба":"International club partner","Экипировка для молодых клубов":"Kits for young clubs","Региональный производитель формы":"Regional kit manufacturer","Технологичная экипировка":"Technical sportswear","Международный экипировочный партнёр":"International kit partner","Премиальная форма для топ-клубов":"Premium kits for elite clubs","Первый титульный партнёр":"First title partner","Финансовая компания региона":"Regional finance company","Энергетический партнёр":"Energy partner","Международный титульный партнёр":"International title partner","Партнёр клубов мирового уровня":"Partner to world-class clubs","Питание и напитки для болельщиков":"Food and drinks for fans","Региональное спортивное радио":"Regional sports radio","Партнёр трансляций и контента":"Broadcast and content partner","Логистика и поездки команды":"Team travel and logistics","Аналитические решения для элитных клубов":"Analytics solutions for elite clubs","Ежедневные задания":"Missions quotidiennes","Ежемесячные задания":"Missions mensuelles","ЗАДАНИЯ НА СЕГОДНЯ":"MISSIONS DU JOUR","ЗАДАНИЯ НА МЕСЯЦ":"MISSIONS DU MOIS","Долгосрочные цели":"Objectifs à long terme","30 ЗАДАНИЙ КЛУБА":"30 MISSIONS DU CLUB","Выполняй цели и забирай награды за прогресс клуба.":"Complete objectives and collect club progression rewards.","Опыт за сыгранные матчи, победы и удачные решения.":"Earn experience from matches, wins and good decisions.","УРОВЕНЬ КЛУБА":"NIVEAU DU CLUB","До уровня":"Next level","Максимальный уровень":"Maximum level","Задания и уровни":"Missions et niveaux","Получено":"Récupéré","Забрать":"Récupérer","Сыграй 1 матч.":"Play 1 match.","Одержи 1 победу.":"Win 1 match.","Забей 3 гола.":"Score 3 goals.","Открой 1 пак.":"Open 1 pack.","Сыграй 2 матча.":"Play 2 matches.","Сыграй 12 матчей за месяц.":"Play 12 matches this month.","Одержи 6 побед за месяц.":"Win 6 matches this month.","Забей 30 голов за месяц.":"Score 30 goals this month.","Открой 8 паков за месяц.":"Open 8 packs this month.","Сыграй 8 матчей за месяц.":"Play 8 matches this month.","Сыграй":"Play","Забей":"Score","Одержать":"Win","Собрать":"Collect","Достичь":"Reach","матчей":"matches","побед":"wins","голов":"goals","паков":"packs","игроков":"players","Контракты и продление доступны только в настройке команды.":"Contracts and renewals are available only in Team Settings.","КОНТРАКТЫ ИГРОКОВ":"CONTRATS DES JOUEURS","Продлить":"Prolonger","Восстановить":"Restaurer","Контракт":"Contract","Продлить контракт":"Extend contract","Контракт этого типа ещё действует. Его нельзя заменить до окончания срока.":"Ce contrat de sponsoring est toujours actif et ne peut pas être remplacé avant son expiration."},"es":{"СПОНСОР ФОРМЫ":"PATROCINADOR DE LA EQUIPACIÓN","ОСНОВНОЙ СПОНСОР":"PATROCINADOR PRINCIPAL","ДОПОЛНИТЕЛЬНЫЙ СПОНСОР":"PATROCINADOR ADICIONAL","СПОНСОР НЕ ВЫБРАН":"SIN PATROCINADOR","Уровень":"Nivel","За матч":"Por partido","За победу":"Por victoria","Подписание":"Firma","Требования":"Requisitos","Без требований":"Sin requisitos","Активен":"Activo","СВОБОДНО":"LIBRE","ЗАКЛЮЧЁН":"FIRMADO","Пока недоступен":"Aún no disponible","Подписать на 30 дней":"Firmar por 30 días","Контракт действует до окончания":"Contrato activo hasta su vencimiento","Осталось":"Remaining","Победа":"Win","Контракт истёк":"Contract expired","Выбери партнёра для этого рекламного места.":"Choose a partner for this sponsorship slot.","Молодой бренд экипировки":"Young sportswear brand","Спортивная одежда":"Sportswear","Футбольная экипировка":"Football equipment","Бутсы и аксессуары":"Boots and accessories","Профессиональная форма":"Professional kits","Титульный партнёр клуба":"Club title partner","Энергетические напитки":"Energy drinks","Финансовый партнёр":"Financial partner","Технологический партнёр":"Technology partner","Главный партнёр сезона":"Main season partner","Напитки для болельщиков":"Drinks for supporters","Игровая студия":"Game studio","Питание команды":"Team catering","Цифровые сервисы":"Digital services","Звук и медиа":"Audio and media","Аналитика и тренировочные технологии":"Analytics and training technology","Международный партнёр клуба":"International club partner","Экипировка для молодых клубов":"Kits for young clubs","Региональный производитель формы":"Regional kit manufacturer","Технологичная экипировка":"Technical sportswear","Международный экипировочный партнёр":"International kit partner","Премиальная форма для топ-клубов":"Premium kits for elite clubs","Первый титульный партнёр":"First title partner","Финансовая компания региона":"Regional finance company","Энергетический партнёр":"Energy partner","Международный титульный партнёр":"International title partner","Партнёр клубов мирового уровня":"Partner to world-class clubs","Питание и напитки для болельщиков":"Food and drinks for fans","Региональное спортивное радио":"Regional sports radio","Партнёр трансляций и контента":"Broadcast and content partner","Логистика и поездки команды":"Team travel and logistics","Аналитические решения для элитных клубов":"Analytics solutions for elite clubs","Ежедневные задания":"Misiones diarias","Ежемесячные задания":"Misiones mensuales","ЗАДАНИЯ НА СЕГОДНЯ":"MISIONES DE HOY","ЗАДАНИЯ НА МЕСЯЦ":"MISIONES DEL MES","Долгосрочные цели":"Objetivos a largo plazo","30 ЗАДАНИЙ КЛУБА":"30 MISIONES DEL CLUB","Выполняй цели и забирай награды за прогресс клуба.":"Complete objectives and collect club progression rewards.","Опыт за сыгранные матчи, победы и удачные решения.":"Earn experience from matches, wins and good decisions.","УРОВЕНЬ КЛУБА":"NIVEL DEL CLUB","До уровня":"Next level","Максимальный уровень":"Maximum level","Задания и уровни":"Misiones y niveles","Получено":"Reclamado","Забрать":"Reclamar","Сыграй 1 матч.":"Play 1 match.","Одержи 1 победу.":"Win 1 match.","Забей 3 гола.":"Score 3 goals.","Открой 1 пак.":"Open 1 pack.","Сыграй 2 матча.":"Play 2 matches.","Сыграй 12 матчей за месяц.":"Play 12 matches this month.","Одержи 6 побед за месяц.":"Win 6 matches this month.","Забей 30 голов за месяц.":"Score 30 goals this month.","Открой 8 паков за месяц.":"Open 8 packs this month.","Сыграй 8 матчей за месяц.":"Play 8 matches this month.","Сыграй":"Play","Забей":"Score","Одержать":"Win","Собрать":"Collect","Достичь":"Reach","матчей":"matches","побед":"wins","голов":"goals","паков":"packs","игроков":"players","Контракты и продление доступны только в настройке команды.":"Contracts and renewals are available only in Team Settings.","КОНТРАКТЫ ИГРОКОВ":"CONTRATOS DE JUGADORES","Продлить":"Ampliar","Восстановить":"Restaurar","Контракт":"Contract","Продлить контракт":"Extend contract","Контракт этого типа ещё действует. Его нельзя заменить до окончания срока.":"Este contrato de patrocinio sigue activo y no puede sustituirse antes de que venza."},"ja":{"СПОНСОР ФОРМЫ":"ユニフォームスポンサー","ОСНОВНОЙ СПОНСОР":"メインスポンサー","ДОПОЛНИТЕЛЬНЫЙ СПОНСОР":"追加スポンサー","СПОНСОР НЕ ВЫБРАН":"スポンサー未選択","Уровень":"ランク","За матч":"試合ごと","За победу":"勝利ごと","Подписание":"契約料","Требования":"条件","Без требований":"条件なし","Активен":"契約中","СВОБОДНО":"空き","ЗАКЛЮЧЁН":"契約済み","Пока недоступен":"まだ利用できません","Подписать на 30 дней":"30日契約","Контракт действует до окончания":"契約終了まで変更不可","Осталось":"Remaining","Победа":"Win","Контракт истёк":"Contract expired","Выбери партнёра для этого рекламного места.":"Choose a partner for this sponsorship slot.","Молодой бренд экипировки":"Young sportswear brand","Спортивная одежда":"Sportswear","Футбольная экипировка":"Football equipment","Бутсы и аксессуары":"Boots and accessories","Профессиональная форма":"Professional kits","Титульный партнёр клуба":"Club title partner","Энергетические напитки":"Energy drinks","Финансовый партнёр":"Financial partner","Технологический партнёр":"Technology partner","Главный партнёр сезона":"Main season partner","Напитки для болельщиков":"Drinks for supporters","Игровая студия":"Game studio","Питание команды":"Team catering","Цифровые сервисы":"Digital services","Звук и медиа":"Audio and media","Аналитика и тренировочные технологии":"Analytics and training technology","Международный партнёр клуба":"International club partner","Экипировка для молодых клубов":"Kits for young clubs","Региональный производитель формы":"Regional kit manufacturer","Технологичная экипировка":"Technical sportswear","Международный экипировочный партнёр":"International kit partner","Премиальная форма для топ-клубов":"Premium kits for elite clubs","Первый титульный партнёр":"First title partner","Финансовая компания региона":"Regional finance company","Энергетический партнёр":"Energy partner","Международный титульный партнёр":"International title partner","Партнёр клубов мирового уровня":"Partner to world-class clubs","Питание и напитки для болельщиков":"Food and drinks for fans","Региональное спортивное радио":"Regional sports radio","Партнёр трансляций и контента":"Broadcast and content partner","Логистика и поездки команды":"Team travel and logistics","Аналитические решения для элитных клубов":"Analytics solutions for elite clubs","Ежедневные задания":"デイリーミッション","Ежемесячные задания":"月間ミッション","ЗАДАНИЯ НА СЕГОДНЯ":"今日のミッション","ЗАДАНИЯ НА МЕСЯЦ":"今月のミッション","Долгосрочные цели":"長期目標","30 ЗАДАНИЙ КЛУБА":"クラブミッション30","Выполняй цели и забирай награды за прогресс клуба.":"Complete objectives and collect club progression rewards.","Опыт за сыгранные матчи, победы и удачные решения.":"Earn experience from matches, wins and good decisions.","УРОВЕНЬ КЛУБА":"クラブレベル","До уровня":"Next level","Максимальный уровень":"Maximum level","Задания и уровни":"ミッションとレベル","Получено":"受取済み","Забрать":"受け取る","Сыграй 1 матч.":"Play 1 match.","Одержи 1 победу.":"Win 1 match.","Забей 3 гола.":"Score 3 goals.","Открой 1 пак.":"Open 1 pack.","Сыграй 2 матча.":"Play 2 matches.","Сыграй 12 матчей за месяц.":"Play 12 matches this month.","Одержи 6 побед за месяц.":"Win 6 matches this month.","Забей 30 голов за месяц.":"Score 30 goals this month.","Открой 8 паков за месяц.":"Open 8 packs this month.","Сыграй 8 матчей за месяц.":"Play 8 matches this month.","Сыграй":"Play","Забей":"Score","Одержать":"Win","Собрать":"Collect","Достичь":"Reach","матчей":"matches","побед":"wins","голов":"goals","паков":"packs","игроков":"players","Контракты и продление доступны только в настройке команды.":"Contracts and renewals are available only in Team Settings.","КОНТРАКТЫ ИГРОКОВ":"選手契約","Продлить":"延長","Восстановить":"再契約","Контракт":"Contract","Продлить контракт":"Extend contract","Контракт этого типа ещё действует. Его нельзя заменить до окончания срока.":"このスポンサー契約は有効期間中のため、期限前に変更できません。"},"zh":{"СПОНСОР ФОРМЫ":"球衣赞助商","ОСНОВНОЙ СПОНСОР":"主要赞助商","ДОПОЛНИТЕЛЬНЫЙ СПОНСОР":"附加赞助商","СПОНСОР НЕ ВЫБРАН":"未选择赞助商","Уровень":"等级","За матч":"每场","За победу":"每场胜利","Подписание":"签约费用","Требования":"要求","Без требований":"无要求","Активен":"生效中","СВОБОДНО":"空闲","ЗАКЛЮЧЁН":"已签约","Пока недоступен":"暂不可用","Подписать на 30 дней":"签约30天","Контракт действует до окончания":"合同到期前不可更换","Осталось":"Remaining","Победа":"Win","Контракт истёк":"Contract expired","Выбери партнёра для этого рекламного места.":"Choose a partner for this sponsorship slot.","Молодой бренд экипировки":"Young sportswear brand","Спортивная одежда":"Sportswear","Футбольная экипировка":"Football equipment","Бутсы и аксессуары":"Boots and accessories","Профессиональная форма":"Professional kits","Титульный партнёр клуба":"Club title partner","Энергетические напитки":"Energy drinks","Финансовый партнёр":"Financial partner","Технологический партнёр":"Technology partner","Главный партнёр сезона":"Main season partner","Напитки для болельщиков":"Drinks for supporters","Игровая студия":"Game studio","Питание команды":"Team catering","Цифровые сервисы":"Digital services","Звук и медиа":"Audio and media","Аналитика и тренировочные технологии":"Analytics and training technology","Международный партнёр клуба":"International club partner","Экипировка для молодых клубов":"Kits for young clubs","Региональный производитель формы":"Regional kit manufacturer","Технологичная экипировка":"Technical sportswear","Международный экипировочный партнёр":"International kit partner","Премиальная форма для топ-клубов":"Premium kits for elite clubs","Первый титульный партнёр":"First title partner","Финансовая компания региона":"Regional finance company","Энергетический партнёр":"Energy partner","Международный титульный партнёр":"International title partner","Партнёр клубов мирового уровня":"Partner to world-class clubs","Питание и напитки для болельщиков":"Food and drinks for fans","Региональное спортивное радио":"Regional sports radio","Партнёр трансляций и контента":"Broadcast and content partner","Логистика и поездки команды":"Team travel and logistics","Аналитические решения для элитных клубов":"Analytics solutions for elite clubs","Ежедневные задания":"每日任务","Ежемесячные задания":"每月任务","ЗАДАНИЯ НА СЕГОДНЯ":"今日任务","ЗАДАНИЯ НА МЕСЯЦ":"本月任务","Долгосрочные цели":"长期目标","30 ЗАДАНИЙ КЛУБА":"俱乐部30项任务","Выполняй цели и забирай награды за прогресс клуба.":"Complete objectives and collect club progression rewards.","Опыт за сыгранные матчи, победы и удачные решения.":"Earn experience from matches, wins and good decisions.","УРОВЕНЬ КЛУБА":"俱乐部等级","До уровня":"Next level","Максимальный уровень":"Maximum level","Задания и уровни":"任务与等级","Получено":"已领取","Забрать":"领取","Сыграй 1 матч.":"Play 1 match.","Одержи 1 победу.":"Win 1 match.","Забей 3 гола.":"Score 3 goals.","Открой 1 пак.":"Open 1 pack.","Сыграй 2 матча.":"Play 2 matches.","Сыграй 12 матчей за месяц.":"Play 12 matches this month.","Одержи 6 побед за месяц.":"Win 6 matches this month.","Забей 30 голов за месяц.":"Score 30 goals this month.","Открой 8 паков за месяц.":"Open 8 packs this month.","Сыграй 8 матчей за месяц.":"Play 8 matches this month.","Сыграй":"Play","Забей":"Score","Одержать":"Win","Собрать":"Collect","Достичь":"Reach","матчей":"matches","побед":"wins","голов":"goals","паков":"packs","игроков":"players","Контракты и продление доступны только в настройке команды.":"Contracts and renewals are available only in Team Settings.","КОНТРАКТЫ ИГРОКОВ":"球员合同","Продлить":"续约","Восстановить":"恢复","Контракт":"Contract","Продлить контракт":"Extend contract","Контракт этого типа ещё действует. Его нельзя заменить до окончания срока.":"该赞助合同仍在有效期内，过期前不能更换。"},"kk":{"СПОНСОР ФОРМЫ":"ФОРМА ДЕМЕУШІСІ","ОСНОВНОЙ СПОНСОР":"БАС ДЕМЕУШІ","ДОПОЛНИТЕЛЬНЫЙ СПОНСОР":"ҚОСЫМША ДЕМЕУШІ","СПОНСОР НЕ ВЫБРАН":"ДЕМЕУШІ ТАҢДАЛМАҒАН","Уровень":"Деңгей","За матч":"Әр матч үшін","За победу":"Әр жеңіс үшін","Подписание":"Келісім ақысы","Требования":"Талаптар","Без требований":"Талап жоқ","Активен":"Белсенді","СВОБОДНО":"БОС","ЗАКЛЮЧЁН":"ЖАСАЛДЫ","Пока недоступен":"Әзірше қолжетімсіз","Подписать на 30 дней":"30 күнге келісім жасау","Контракт действует до окончания":"Келісім аяқталғанша өзгертпеу","Осталось":"Remaining","Победа":"Win","Контракт истёк":"Contract expired","Выбери партнёра для этого рекламного места.":"Choose a partner for this sponsorship slot.","Молодой бренд экипировки":"Young sportswear brand","Спортивная одежда":"Sportswear","Футбольная экипировка":"Football equipment","Бутсы и аксессуары":"Boots and accessories","Профессиональная форма":"Professional kits","Титульный партнёр клуба":"Club title partner","Энергетические напитки":"Energy drinks","Финансовый партнёр":"Financial partner","Технологический партнёр":"Technology partner","Главный партнёр сезона":"Main season partner","Напитки для болельщиков":"Drinks for supporters","Игровая студия":"Game studio","Питание команды":"Team catering","Цифровые сервисы":"Digital services","Звук и медиа":"Audio and media","Аналитика и тренировочные технологии":"Analytics and training technology","Международный партнёр клуба":"International club partner","Экипировка для молодых клубов":"Kits for young clubs","Региональный производитель формы":"Regional kit manufacturer","Технологичная экипировка":"Technical sportswear","Международный экипировочный партнёр":"International kit partner","Премиальная форма для топ-клубов":"Premium kits for elite clubs","Первый титульный партнёр":"First title partner","Финансовая компания региона":"Regional finance company","Энергетический партнёр":"Energy partner","Международный титульный партнёр":"International title partner","Партнёр клубов мирового уровня":"Partner to world-class clubs","Питание и напитки для болельщиков":"Food and drinks for fans","Региональное спортивное радио":"Regional sports radio","Партнёр трансляций и контента":"Broadcast and content partner","Логистика и поездки команды":"Team travel and logistics","Аналитические решения для элитных клубов":"Analytics solutions for elite clubs","Ежедневные задания":"Күнделікті тапсырмалар","Ежемесячные задания":"Ай сайынғы тапсырмалар","ЗАДАНИЯ НА СЕГОДНЯ":"БҮГІНГІ ТАПСЫРМАЛАР","ЗАДАНИЯ НА МЕСЯЦ":"АЙЛЫҚ ТАПСЫРМАЛАР","Долгосрочные цели":"Ұзақ мерзімді мақсаттар","30 ЗАДАНИЙ КЛУБА":"КЛУБТЫҢ 30 ТАПСЫРМАСЫ","Выполняй цели и забирай награды за прогресс клуба.":"Complete objectives and collect club progression rewards.","Опыт за сыгранные матчи, победы и удачные решения.":"Earn experience from matches, wins and good decisions.","УРОВЕНЬ КЛУБА":"КЛУБ ДЕҢГЕЙІ","До уровня":"Next level","Максимальный уровень":"Maximum level","Задания и уровни":"Тапсырмалар мен деңгейлер","Получено":"Алынды","Забрать":"Алу","Сыграй 1 матч.":"Play 1 match.","Одержи 1 победу.":"Win 1 match.","Забей 3 гола.":"Score 3 goals.","Открой 1 пак.":"Open 1 pack.","Сыграй 2 матча.":"Play 2 matches.","Сыграй 12 матчей за месяц.":"Play 12 matches this month.","Одержи 6 побед за месяц.":"Win 6 matches this month.","Забей 30 голов за месяц.":"Score 30 goals this month.","Открой 8 паков за месяц.":"Open 8 packs this month.","Сыграй 8 матчей за месяц.":"Play 8 matches this month.","Сыграй":"Play","Забей":"Score","Одержать":"Win","Собрать":"Collect","Достичь":"Reach","матчей":"matches","побед":"wins","голов":"goals","паков":"packs","игроков":"players","Контракты и продление доступны только в настройке команды.":"Contracts and renewals are available only in Team Settings.","КОНТРАКТЫ ИГРОКОВ":"ОЙЫНШЫ КЕЛІСІМШАРТТАРЫ","Продлить":"Ұзарту","Восстановить":"Қалпына келтіру","Контракт":"Contract","Продлить контракт":"Extend contract","Контракт этого типа ещё действует. Его нельзя заменить до окончания срока.":"Бұл демеушілік келісім әлі күшінде, мерзімі біткенше оны ауыстыруға болмайды."},"pl":{"СПОНСОР ФОРМЫ":"SPONSOR KOSZULEK","ОСНОВНОЙ СПОНСОР":"SPONSOR GŁÓWNY","ДОПОЛНИТЕЛЬНЫЙ СПОНСОР":"SPONSOR DODATKOWY","СПОНСОР НЕ ВЫБРАН":"NIE WYBRANO SPONSORA","Уровень":"Poziom","За матч":"Za mecz","За победу":"Za zwycięstwo","Подписание":"Opłata za podpisanie","Требования":"Wymagania","Без требований":"Brak wymagań","Активен":"Aktywny","СВОБОДНО":"WOLNE","ЗАКЛЮЧЁН":"PODPISANO","Пока недоступен":"Jeszcze niedostępny","Подписать на 30 дней":"Podpisz na 30 dni","Контракт действует до окончания":"Umowa aktywna do wygaśnięcia","Осталось":"Remaining","Победа":"Win","Контракт истёк":"Contract expired","Выбери партнёра для этого рекламного места.":"Choose a partner for this sponsorship slot.","Молодой бренд экипировки":"Young sportswear brand","Спортивная одежда":"Sportswear","Футбольная экипировка":"Football equipment","Бутсы и аксессуары":"Boots and accessories","Профессиональная форма":"Professional kits","Титульный партнёр клуба":"Club title partner","Энергетические напитки":"Energy drinks","Финансовый партнёр":"Financial partner","Технологический партнёр":"Technology partner","Главный партнёр сезона":"Main season partner","Напитки для болельщиков":"Drinks for supporters","Игровая студия":"Game studio","Питание команды":"Team catering","Цифровые сервисы":"Digital services","Звук и медиа":"Audio and media","Аналитика и тренировочные технологии":"Analytics and training technology","Международный партнёр клуба":"International club partner","Экипировка для молодых клубов":"Kits for young clubs","Региональный производитель формы":"Regional kit manufacturer","Технологичная экипировка":"Technical sportswear","Международный экипировочный партнёр":"International kit partner","Премиальная форма для топ-клубов":"Premium kits for elite clubs","Первый титульный партнёр":"First title partner","Финансовая компания региона":"Regional finance company","Энергетический партнёр":"Energy partner","Международный титульный партнёр":"International title partner","Партнёр клубов мирового уровня":"Partner to world-class clubs","Питание и напитки для болельщиков":"Food and drinks for fans","Региональное спортивное радио":"Regional sports radio","Партнёр трансляций и контента":"Broadcast and content partner","Логистика и поездки команды":"Team travel and logistics","Аналитические решения для элитных клубов":"Analytics solutions for elite clubs","Ежедневные задания":"Codzienne zadania","Ежемесячные задания":"Miesięczne zadania","ЗАДАНИЯ НА СЕГОДНЯ":"ZADANIA NA DZIŚ","ЗАДАНИЯ НА МЕСЯЦ":"ZADANIA MIESIĘCZNE","Долгосрочные цели":"Cele długoterminowe","30 ЗАДАНИЙ КЛУБА":"30 ZADAŃ KLUBU","Выполняй цели и забирай награды за прогресс клуба.":"Complete objectives and collect club progression rewards.","Опыт за сыгранные матчи, победы и удачные решения.":"Earn experience from matches, wins and good decisions.","УРОВЕНЬ КЛУБА":"POZIOM KLUBU","До уровня":"Next level","Максимальный уровень":"Maximum level","Задания и уровни":"Zadania i poziomy","Получено":"Odebrano","Забрать":"Odbierz","Сыграй 1 матч.":"Play 1 match.","Одержи 1 победу.":"Win 1 match.","Забей 3 гола.":"Score 3 goals.","Открой 1 пак.":"Open 1 pack.","Сыграй 2 матча.":"Play 2 matches.","Сыграй 12 матчей за месяц.":"Play 12 matches this month.","Одержи 6 побед за месяц.":"Win 6 matches this month.","Забей 30 голов за месяц.":"Score 30 goals this month.","Открой 8 паков за месяц.":"Open 8 packs this month.","Сыграй 8 матчей за месяц.":"Play 8 matches this month.","Сыграй":"Play","Забей":"Score","Одержать":"Win","Собрать":"Collect","Достичь":"Reach","матчей":"matches","побед":"wins","голов":"goals","паков":"packs","игроков":"players","Контракты и продление доступны только в настройке команды.":"Contracts and renewals are available only in Team Settings.","КОНТРАКТЫ ИГРОКОВ":"KONTRAKTY ZAWODNIKÓW","Продлить":"Przedłuż","Восстановить":"Przywróć","Контракт":"Contract","Продлить контракт":"Extend contract","Контракт этого типа ещё действует. Его нельзя заменить до окончания срока.":"Ta umowa sponsorska jest nadal aktywna i nie można jej zmienić przed wygaśnięciem."}};
  Object.entries(V52_TRANSLATIONS).forEach(([lang,dict])=>Object.assign(UI_TRANSLATIONS[lang]||(UI_TRANSLATIONS[lang]={}),dict));
  function translateUIText(value){const lang=db.language||'ru';if(lang==='ru'||!UI_TRANSLATIONS[lang]||typeof value!=='string')return value;const dict=UI_TRANSLATIONS[lang],entries=Object.entries(dict).sort((a,b)=>b[0].length-a[0].length);const trimmed=value.trim();if(dict[trimmed])return value.replace(trimmed,dict[trimmed]);let out=value;for(const [source,target] of entries){if(source.length<3)continue;const escaped=source.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const re=new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,'giu');out=out.replace(re,match=>{if(match===match.toLocaleUpperCase())return target.toLocaleUpperCase(lang);if(match[0]===match[0].toLocaleUpperCase()&&match.slice(1)===match.slice(1).toLocaleLowerCase())return target[0].toLocaleUpperCase(lang)+target.slice(1);return target;});}return out;}
  function applyLanguage(){const lang=Object.hasOwn(UI_TRANSLATIONS,db.language)?db.language:'ru';document.documentElement.lang=lang;const root=$('#app');if(!root||lang==='ru')return;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(n=>{if(n.parentElement?.closest('[data-no-translate]'))return;n.nodeValue=translateUIText(n.nodeValue);});root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el=>{if(el.closest('[data-no-translate]'))return;['placeholder','title','aria-label'].forEach(a=>{const value=el.getAttribute(a);if(value)el.setAttribute(a,translateUIText(value));});});}
  function setInterfaceLanguage(value){const allowed=['ru','uk','en','de','fr','es','ja','zh','kk','pl'];const next=allowed.includes(String(value))?String(value):'ru';if(db.language===next){document.documentElement.lang=next;return;}db.language=next;document.documentElement.lang=next;saveDB();render();}
  document.addEventListener('change',e=>{const select=e.target?.closest?.('[data-setting="language"]');if(!select)return;e.stopPropagation();setInterfaceLanguage(select.value);},true);
  function render(){
    if(!zfAuthReady){$('#app').innerHTML=renderAuthLoading();return;}
    if((!zfAuthSession||!zfAuthUser)&&!zfOfflineMode){$('#app').innerHTML=renderAuthGate();applyLanguage();return;}
    const club=currentClub();
    if(!club){$('#app').innerHTML=renderStart();applyLanguage();return;}
    try {
      $('#app').innerHTML=renderLayout(club);
      if(reveal)$('#app').insertAdjacentHTML('beforeend',renderReveal());
      if(editSlotIndex!==null)$('#app').insertAdjacentHTML('beforeend',renderAssignModal(club,editSlotIndex));
      if(playerModalRef)$('#app').insertAdjacentHTML('beforeend',renderPlayerModal(club));
      resolvePlayerImages();applyLanguage();syncMatchCountdownUI();
    } catch(error) {
      console.error('Club screen render failed; opening compatibility dashboard:',error);
      const root=$('#app');
      if(root) {
        const players=Array.isArray(club.players)?club.players.filter(Boolean):[];
        const lineup=Array.isArray(club.lineup)?club.lineup:[];
        const safeName=esc(club.name||'Мой клуб');
        const safeEuros=formatMoney(Number.isFinite(Number(club.coins))?Number(club.coins):0);
        const rosterPreview=players.slice(0,8).map(p=>`<div class="list-row" style="display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--line)"><span>${esc(p.name||'Игрок')}</span><b>${Math.max(1,Math.min(99,Number(p.rating)||1))} OVR</b></div>`).join('');
        const emergencyNav=[['home','Главная'],['multiplayer','Мультиплеер'],['team','Команда'],['packs','Паки'],['collection','Коллекция'],['sponsors','Спонсоры'],['match','Матч'],['trophies','Трофеи'],['settings','Настройки']];
        root.innerHTML=`<div class="game-layout" data-theme="${esc(db.theme||'classic')}" style="--crest-color:${esc(club.logo?.color||'#c8ff44')}"><aside class="sidebar"><div class="sidebar-brand"><div class="brand-mark">ZF</div><div class="brand-name">ZERO <span>FOOTBALL</span></div></div><div class="nav-label">Игровой центр</div><nav class="nav-menu">${emergencyNav.map(([id,label])=>`<button class="nav-item ${view===id?'active':''}" data-action="nav" data-view="${id}">${label}</button>`).join('')}</nav><div class="nav-label" style="margin-top:12px">Управление</div><nav class="nav-menu"><button class="nav-item" data-action="switch-club">⇄ Сменить клуб</button></nav></aside><main class="main-area"><header class="topbar"><div class="crumb"><span>ZERO FOOTBALL</span><span>／</span><b>${safeName}</b></div><div class="top-actions"><div class="coin-chip">${safeEuros}</div></div></header><section class="section-heading"><div><div class="eyebrow">КЛУБ ОТКРЫТ</div><h1 class="h1">${safeName}</h1><p class="page-subtitle">Совместимый режим отображения. Данные клуба не затронуты.</p></div></section><section class="stat-grid"><div class="metric-card"><div class="metric-top">Состав</div><div class="metric-value">${players.length}</div><div class="metric-note">игроков</div></div><div class="metric-card"><div class="metric-top">Стартовый состав</div><div class="metric-value">${lineup.length}</div><div class="metric-note">слотов</div></div><div class="metric-card"><div class="metric-top">Рейтинг клуба</div><div class="metric-value">${teamRating(club)}</div><div class="metric-note">OVR</div></div></section><section class="card" style="margin-top:18px"><h2 class="h2">Игроки клуба</h2>${rosterPreview||'<p class="muted">Состав пока пуст.</p>'}<div class="settings-actions" style="margin-top:16px"><button class="btn btn-primary" data-action="nav" data-view="team">Открыть команду</button><button class="btn btn-secondary" data-action="nav" data-view="match">Перейти к матчу</button><button class="btn btn-quiet" data-action="retry-club-render">Повторить обычный экран</button></div></section></main><nav class="mobile-nav">${emergencyNav.map(([id,label])=>`<button class="nav-item ${view===id?'active':''}" data-action="nav" data-view="${id}">${label}</button>`).join('')}</nav></div>`;
        try{applyLanguage();}catch(languageError){console.warn('Compatibility dashboard language pass skipped:',languageError);}
      }
    }
  }
  function energyCountdownText(club){
    if(!club||(club.energy||0)>=5)return translateUIText('Энергия полностью восстановлена');
    const next=(Number(club.energyAt)||Date.now())+30*60*1000,seconds=Math.max(0,Math.ceil((next-Date.now())/1000));
    const mm=String(Math.floor(seconds/60)).padStart(2,'0'),ss=String(seconds%60).padStart(2,'0');
    return `${translateUIText('До восстановления матча:')} ${mm}:${ss}`;
  }
  function syncMatchCountdownUI(){
    if(matchCountdownInterval){clearInterval(matchCountdownInterval);matchCountdownInterval=null;}
    const tick=()=>{
      const now=Date.now();
      const nodes=$$('#app [data-countdown-deadline]');
      nodes.forEach(node=>{const ms=Math.max(0,Number(node.dataset.countdownDeadline)-now);node.textContent=`${Math.ceil(ms/1000)} ${translateUIText('сек.')}`;});
      const energyNodes=$$('#app [data-energy-recovery]');
      if(energyNodes.length){const club=currentClub();if(club){const before=club.energy||0;refreshEnergy(club);if((club.energy||0)!==before){const pips=$$('#app .energy-pip');pips.forEach((pip,i)=>pip.classList.toggle('on',i<(club.energy||0)));const count=$('#energy-count-label');if(count)count.textContent=`${club.energy||0}/5 ${translateUIText('матчей')}`;const ad=$('[data-action="watch-ad"]');if(ad)ad.disabled=(club.energy||0)>=5;}
        energyNodes.forEach(node=>{node.textContent=energyCountdownText(club);});}}
      if(!nodes.length&&!energyNodes.length&&matchCountdownInterval){clearInterval(matchCountdownInterval);matchCountdownInterval=null;}
    };
    tick();
    if($$('#app [data-countdown-deadline]').length||$$('#app [data-energy-recovery]').length)matchCountdownInterval=setInterval(tick,1000);
  }
  function clearMatchTimers(){
    ['timer','agreementTimer','actionTimer'].forEach(key=>{if(matchState?.[key])clearTimeout(matchState[key]);});
    if(matchmakingPoll){clearInterval(matchmakingPoll);matchmakingPoll=null;}
    if(matchCountdownInterval){clearInterval(matchCountdownInterval);matchCountdownInterval=null;}
  }
  function renderAuthLoading(){
    return `<div class="start-screen"><div class="start-wrap"><div class="start-brand"><div class="brand-mark">ZF</div><div class="brand-name">ZERO <span>FOOTBALL</span></div></div><div class="auth-gate-card"><div class="search-visual"><span class="search-ring"></span><span class="search-ring"></span><span class="search-ring"></span><span class="search-ball">⚽</span></div><h1>ПОДКЛЮЧАЕМ АККАУНТ</h1><p>Проверяем защищённую сессию Zero Football…</p></div></div></div>`;
  }
  function renderAuthGate(){
    const signup=authScreenMode==='signup';
    const cloudUnavailable=!ZF_SUPABASE;
    return `<div class="start-screen"><div class="start-wrap"><div class="start-brand"><div class="brand-mark">ZF</div><div class="brand-name">ZERO <span>FOOTBALL</span></div></div><div class="start-layout auth-start-layout"><section class="start-hero"><div><div class="eyebrow">YOUR CLUB. YOUR LEGACY.</div><h1>BUILD.<br><span>PLAY.</span><br>CONQUER.</h1></div><div class="hero-bottom"><p>Создай аккаунт, собери свой клуб и выходи на поле против игроков со всего мира.</p><div class="feature-row"><span>⚽ ONLINE MATCHES</span><span>🎴 PLAYER CARDS</span><span>🏆 YOUR LEGACY</span></div></div><div class="hero-orb"></div></section><section class="start-panel auth-start-panel"><div class="start-language"><label for="startLanguage">🌐 Язык интерфейса</label><select id="startLanguage" class="select-compact" data-setting="language"><option value="ru" ${db.language==="ru"?"selected":""}>🇷🇺 Русский</option><option value="uk" ${db.language==="uk"?"selected":""}>🇺🇦 Українська</option><option value="en" ${db.language==="en"?"selected":""}>🇬🇧 English</option><option value="de" ${db.language==="de"?"selected":""}>🇩🇪 Deutsch</option><option value="fr" ${db.language==="fr"?"selected":""}>🇫🇷 Français</option><option value="es" ${db.language==="es"?"selected":""}>🇪🇸 Español</option><option value="ja" ${db.language==="ja"?"selected":""}>🇯🇵 日本語</option><option value="zh" ${db.language==="zh"?"selected":""}>🇨🇳 中文</option><option value="kk" ${db.language==="kk"?"selected":""}>🇰🇿 Қазақша</option><option value="pl" ${db.language==="pl"?"selected":""}>🇵🇱 Polski</option></select></div><div class="eyebrow">ЗАЩИЩЁННЫЙ ВХОД</div><h2>${signup?'СОЗДАТЬ АККАУНТ':'С ВОЗВРАЩЕНИЕМ'}</h2><p>${signup?'Зарегистрируйся по электронной почте. Один аккаунт — один клуб.':'Войди, чтобы открыть свой клуб и онлайн-режим.'}</p>${authScreenNotice?`<div class="auth-notice">${esc(authScreenNotice)}</div>`:''}${cloudUnavailable?'<div class="auth-error">Supabase не подключён. Проверь js/supabase-config.js.</div>':''}<form id="zfStartAuthForm" class="zf-cloud-auth-form auth-start-form"><div class="field"><label for="zfStartEmail">Электронная почта</label><input id="zfStartEmail" name="email" type="email" autocomplete="email" required placeholder="name@example.com"></div><div class="field"><label for="zfStartPassword">Пароль</label><input id="zfStartPassword" name="password" type="password" autocomplete=${signup?'new-password':'current-password'} minlength="6" required placeholder="Минимум 6 символов"></div><button class="btn btn-primary btn-full" type="submit" data-auth-mode=${signup?'signup':'signin'} ${cloudUnavailable?'disabled':''}>${signup?'Создать аккаунт →':'Войти →'}</button></form><div class="auth-mode-switch">${signup?'Уже есть аккаунт?':'Впервые в Zero Football?'} <button type="button" class="text-button" data-action="auth-mode" data-mode=${signup?'signin':'signup'}>${signup?'Войти':'Зарегистрироваться'}</button></div><button type="button" class="btn btn-quiet btn-full auth-offline-btn" data-action="offline-continue">Продолжить без входа · только одиночный режим</button><p class="muted small auth-footnote">Пароль хранится и проверяется Supabase Auth. Игра не получает доступ к секретным ключам проекта.</p></section></div></div></div>`;
  }
  function renderStart(){
    const clubs=accountClubs();
    const clubTiles=clubs.length?`<div class="saved-clubs">${clubs.map(c=>`<div class="saved-club-row"><button class="saved-club" data-action="select-club" data-club-id="${esc(c.id)}"><span class="club-crest ${crestShape(c.logo)}" style="--crest-color:${esc(c.logo.color)}">${crestContent(c.logo,.55)}</span><span class="saved-club-copy"><strong>${esc(countryData(c.country).flag)} ${esc(c.name)}</strong><small>${teamRating(c)} OVR · ${c.stats.matches||0} матчей · ${formatMoney(c.coins)} · локальное сохранение</small></span><span class="club-arrow">›</span></button><button class="btn btn-danger btn-sm" data-action="delete-club" data-club-id="${esc(c.id)}" title="Удалить клуб">✕</button></div>`).join('')}</div>`:`<div class="empty-state" style="padding:21px 12px;margin-bottom:14px"><div class="empty-icon">🏟️</div><strong>Клубы ещё не созданы</strong><span class="small">Создай первый клуб и начни карьеру.</span></div>`;
    const chooser=startMode==='create'?renderCreateForm():`${clubTiles}<button class="btn btn-primary btn-full" data-action="start-create">＋ Создать новый клуб</button>`;
    return `<div class="start-screen"><div class="start-wrap"><div class="start-brand"><div class="brand-mark">ZF</div><div class="brand-name">ZERO <span>FOOTBALL</span></div></div><div class="start-layout"><section class="start-hero"><div><div class="eyebrow">ТВОЙ КЛУБ. ТВОЯ ИСТОРИЯ.</div><h1>BUILD.<br><span>PLAY.</span><br>CONQUER.</h1></div><div class="hero-bottom"><p>Собери состав мечты, открывай паки и докажи, что именно твой клуб достоин вершины.</p><div class="feature-row"><span>⚽ MATCHDAY</span><span>🎴 PLAYER PACKS</span><span>🏆 YOUR LEGACY</span></div></div><div class="hero-orb"></div></section><section class="start-panel"><div class="start-language"><label for="startLanguage">🌐 Язык интерфейса</label><select id="startLanguage" class="select-compact" data-setting="language"><option value="ru" ${db.language==="ru"?"selected":""}>🇷🇺 Русский</option><option value="uk" ${db.language==="uk"?"selected":""}>🇺🇦 Українська</option><option value="en" ${db.language==="en"?"selected":""}>🇬🇧 English</option><option value="de" ${db.language==="de"?"selected":""}>🇩🇪 Deutsch</option><option value="fr" ${db.language==="fr"?"selected":""}>🇫🇷 Français</option><option value="es" ${db.language==="es"?"selected":""}>🇪🇸 Español</option><option value="ja" ${db.language==="ja"?"selected":""}>🇯🇵 日本語</option><option value="zh" ${db.language==="zh"?"selected":""}>🇨🇳 中文</option><option value="kk" ${db.language==="kk"?"selected":""}>🇰🇿 Қазақша</option><option value="pl" ${db.language==="pl"?"selected":""}>🇵🇱 Polski</option></select></div><div class="eyebrow">ZERO FOOTBALL / ЦЕНТР КЛУБА</div><h2>${startMode==='create'?'Создание клуба':'Твои клубы'}</h2><p>${startMode==='create'?'Настрой эмблему и выбери страну. После создания сразу откроется управление клубом.':'Выбери клуб, чтобы продолжить карьеру, или создай новый.'}</p>${chooser}<div class="divider"></div><div class="small muted">Всего клубов: ${clubs.length}</div></section></div></div></div>`;
  }
  function renderCrestLayerRows(layers,mode){
    return (layers||[]).map((l)=>`<div class="logo-layer-row" data-layer-row="${esc(l.id)}"><span class="layer-value">${esc(l.value)}</span><input class="layer-color-input" type="color" value="${esc(l.color||'#10140c')}" aria-label="Цвет элемента ${esc(l.value)}" data-crest-layer-color="1" data-mode="${mode}" data-layer-id="${esc(l.id)}"/><small class="layer-size">${Math.round(l.size||24)}px</small><button type="button" class="btn btn-quiet btn-sm" title="Уменьшить объект" data-action="crest-layer-size-down" data-mode="${mode}" data-layer-id="${esc(l.id)}">−</button><button type="button" class="btn btn-quiet btn-sm" title="Увеличить объект" data-action="crest-layer-size-up" data-mode="${mode}" data-layer-id="${esc(l.id)}">＋</button><button type="button" class="btn btn-quiet btn-sm" title="На передний план" data-action="crest-layer-up" data-mode="${mode}" data-layer-id="${esc(l.id)}">↑</button><button type="button" class="btn btn-quiet btn-sm" title="На задний план" data-action="crest-layer-down" data-mode="${mode}" data-layer-id="${esc(l.id)}">↓</button><button type="button" class="btn btn-quiet btn-sm" title="Удалить элемент" data-action="crest-layer-delete" data-mode="${mode}" data-layer-id="${esc(l.id)}">✕</button></div>`).join('');
  }
  function renderCrestPickers(mode){
    return `<details class="crest-picker"><summary>＋ Геральдические символы и фигуры <span class="muted small">${SYMBOLS.length}</span></summary><div class="symbol-picks">${SYMBOLS.map(sym=>`<button type="button" class="symbol-pick" data-action="crest-add-symbol" data-mode="${mode}" data-symbol="${esc(sym)}" aria-label="Добавить символ ${esc(sym)}" title="Добавить ${esc(sym)}">${crestSymbolSvg(sym)||esc(sym)}</button>`).join('')}</div></details><details class="crest-picker"><summary>😀 Эмодзи для эмблемы <span class="muted small">30</span></summary><div class="emoji-picks">${EMBLEM_EMOJIS.map(emoji=>`<button type="button" class="emoji-pick" data-action="crest-add-emoji" data-mode="${mode}" data-emoji="${esc(emoji)}" aria-label="Добавить эмодзи ${esc(emoji)}" title="Добавить ${esc(emoji)}">${esc(emoji)}</button>`).join('')}</div></details>`;
  }
  function renderCrestLayerTools(mode,layers){
    return `${renderCrestPickers(mode)}<div class="field"><label for="${mode}LogoText">Добавить текст</label><div class="field-row"><input id="${mode}LogoText" maxlength="18" placeholder="ZERO UNITED"/><button type="button" class="btn btn-secondary btn-sm" data-action="crest-add-text" data-mode="${mode}">＋ Текст</button></div></div><div class="field"><label>Элементы эмблемы и их цвета</label><div id="${mode}LogoLayerList" class="logo-layer-list">${renderCrestLayerRows(layers,mode)}</div><small class="muted small">Выбери цвет у каждого слоя отдельно. Перетаскивай элементы прямо на эмблеме, чтобы менять их положение.</small></div>`;
  }
  function renderCrestBuilder(){
    const layers=createDraft.layers||[];
    return `<div class="crest-builder"><div id="createCrest" class="crest-big crest-builder-preview shape-${esc(createDraft.shape||'shield')}" style="--crest-color:${esc(createDraft.logoColor)}">${layers.map(l=>crestLayerMarkup(l,1.85)).join('')}</div><div class="crest-tools"><div class="field"><label>Форма эмблемы</label><select id="createLogoShape"><option value="shield" ${createDraft.shape==='shield'?'selected':''}>Щит</option><option value="round" ${createDraft.shape==='round'?'selected':''}>Круг</option><option value="square" ${createDraft.shape==='square'?'selected':''}>Квадрат</option><option value="diamond" ${createDraft.shape==='diamond'?'selected':''}>Ромб</option><option value="classic" ${createDraft.shape==='classic'?'selected':''}>Классическая</option><option value="hexagon" ${createDraft.shape==='hexagon'?'selected':''}>Шестиугольник</option><option value="rounded" ${createDraft.shape==='rounded'?'selected':''}>Скруглённая</option><option value="banner" ${createDraft.shape==='banner'?'selected':''}>Знамя</option><option value="circle-crest" ${createDraft.shape==='circle-crest'?'selected':''}>Круглая с каймой</option></select></div><div class="field"><label>Цвет основы</label><input id="createLogoColor" class="color-input" type="color" value="${esc(createDraft.logoColor)}" data-preview="create-color" /></div>${renderCrestLayerTools('create',layers)}</div></div>`;
  }
  function renderEditCrestBuilder(logo){
    const layers=Array.isArray(logo.layers)&&logo.layers.length?logo.layers:[{id:'base',kind:'symbol',value:logo.symbol||'★',x:50,y:48,size:34,color:'#10140c'}];
    return `<div class="crest-builder"><div id="editCrest" class="crest-big crest-builder-preview ${crestShape(logo)}" style="--crest-color:${esc(logo.color||'#c8ff44')}">${layers.map(l=>crestLayerMarkup(l,1.85)).join('')}</div><div class="crest-tools"><div class="field"><label for="editLogoShape">Форма эмблемы</label><select id="editLogoShape"><option value="shield" ${logo.shape==='shield'?'selected':''}>Щит</option><option value="round" ${logo.shape==='round'?'selected':''}>Круг</option><option value="square" ${logo.shape==='square'?'selected':''}>Квадрат</option><option value="diamond" ${logo.shape==='diamond'?'selected':''}>Ромб</option><option value="classic" ${logo.shape==='classic'?'selected':''}>Классическая</option><option value="hexagon" ${logo.shape==='hexagon'?'selected':''}>Шестиугольник</option><option value="rounded" ${logo.shape==='rounded'?'selected':''}>Скруглённая</option><option value="banner" ${logo.shape==='banner'?'selected':''}>Знамя</option><option value="circle-crest" ${logo.shape==='circle-crest'?'selected':''}>Круглая с каймой</option></select></div><div class="field"><label for="editLogoColor">Цвет основы</label><input id="editLogoColor" class="color-input" type="color" value="${esc(logo.color||'#c8ff44')}" data-preview="edit-logo-color" /></div>${renderCrestLayerTools('edit',layers)}</div></div>`;
  }
  function renderCreateForm(){
    return `<form id="createClubForm" class="create-club-form"><div class="field"><label for="newClubName">Название клуба</label><input id="newClubName" name="clubName" maxlength="26" required placeholder="Например, Zero United" autocomplete="off" /></div><div class="field"><label>Конструктор эмблемы</label>${renderCrestBuilder()}</div><div class="field"><label for="newCountry">Страна клуба</label><select name="country" id="newCountry" required>${Object.entries(COUNTRY).map(([code,c])=>`<option value="${code}" ${code==='ua'?'selected':''}>${c.flag} ${c.name}</option>`).join('')}</select><small id="starterBonus" class="muted small">🇺🇦 Стартовый пак: 16 игроков · Бонус страны: ${COUNTRY.ua.bonus}</small></div><button class="btn btn-primary btn-full" type="button" data-action="create-club-submit">Создать клуб и перейти к управлению →</button><button class="btn btn-quiet btn-full" type="button" data-action="start-back">Назад</button></form>`;
  }

    const NAV_ITEMS = window.ZF_DATA.NAV_ITEMS;
  function navButtons(mobile=false){const items=mobile?NAV_ITEMS:NAV_ITEMS;return items.map(([id,icon,label])=>`<button class="nav-item ${view===id?'active':''}" data-action="nav" data-view="${id}"><span class="nav-icon">${icon}</span><span>${label}</span></button>`).join('');}
  function renderLayout(club){
    const style=clubVars(club);
    return `<div class="game-layout" data-theme="${esc(db.theme||'classic')}" style="${style}"><aside class="sidebar"><div class="sidebar-brand"><div class="brand-mark">ZF</div><div class="brand-name">ZERO <span>FOOTBALL</span></div></div><div class="nav-label">Игровой центр</div><nav class="nav-menu">${navButtons()}</nav><div class="nav-label" style="margin-top:12px">Управление</div><nav class="nav-menu"><button class="nav-item" data-action="nav" data-view="settings"><span class="nav-icon">⚙</span><span>Настройки</span></button><button class="nav-item" data-action="switch-club"><span class="nav-icon">⇄</span><span>Сменить клуб</span></button></nav><div class="nav-spacer"></div><div class="sidebar-club"><div class="sidebar-club-head"><span class="club-crest ${crestShape(club.logo)}" style="--crest-color:${esc(club.logo.color)}">${crestContent(club.logo,.55)}</span><div><strong>${esc(countryData(club.country).flag)} ${esc(club.name)}</strong><small>${teamRating(club)} OVR · ${STYLES[club.style]?.name||'Баланс'}</small></div></div><div class="balance"><span>Баланс</span><b style="color:var(--lime)">${formatMoney(club.coins)}</b></div></div><div class="sidebar-bottom"><button class="btn btn-secondary" data-action="nav" data-view="settings">⚙ Настройки</button><button class="btn btn-quiet" data-action="switch-club">Выйти</button></div></aside><main class="main-area"><header class="topbar"><div class="crumb"><span>ZERO FOOTBALL</span><span>／</span><b>${esc(({home:'Главная',multiplayer:'Мультиплеер',team:'Команда',teamshop:'Магазин команды',packs:'Паки',collection:'Коллекция',sponsors:'Спонсоры',match:'Матч',trophies:'Трофеи',editor:'Редактор клуба',friends:'Друзья и знакомые',market:'Трансферный рынок',leagues:'Лиги и турниры',clan:'Клан',support:'Поддержать проект'})[view]||'Главная')}</b></div><button class="icon-btn mobile-menu" data-action="nav" data-view="settings" aria-label="Настройки">☷</button><div class="top-actions"><button class="icon-btn zf-music-quick ${db.musicEnabled!==false&&db.sound!==false?'is-playing':''}" data-action="music-toggle" title="${db.musicEnabled!==false&&db.sound!==false?'Отключить музыку':'Включить музыку'}" aria-label="Музыка">${db.musicEnabled!==false&&db.sound!==false?'♫':'♪'}</button><div class="coin-chip"><span>${formatMoney(club.coins)}</span></div><div class="profile-circle">${esc(avatarLetters(club.name))}</div></div></header>${renderPage(club)}</main><nav class="mobile-nav">${navButtons(true)}</nav></div>`;
  }
  const THEME_OPTIONS = window.ZF_DATA.THEME_OPTIONS;
  function renderSettings(club){
    const active=db.theme||'classic';
    const themeGroups=[...new Set(THEME_OPTIONS.map(x=>x[4]||'Другие'))].map(category=>[category,THEME_OPTIONS.filter(x=>(x[4]||'Другие')===category)]);
    const themeButtons=arr=>arr.map(([id,icon,name,kind])=>`<button class="theme-option ${active===id?'active':''}" data-action="set-theme" data-theme="${id}"><span>${icon}</span><strong>${name}</strong><small>${kind}</small></button>`).join('');
    return `<div class="section-heading"><div><div class="eyebrow">Игровые настройки</div><h1 class="h1">НАСТРОЙКИ</h1><p class="page-subtitle">Оформление и игровые параметры.</p></div></div>
    <section class="card settings-support-entry" style="margin-bottom:16px"><div class="settings-support-copy"><div class="eyebrow">ZERO FOOTBALL · COMMUNITY</div><h2 class="h2">ПОДДЕРЖАТЬ РАЗРАБОТКУ</h2><p class="muted small">Privat24 для Украины, DonationAlerts для России и Donatello для остального мира.</p></div><button class="btn btn-primary" data-action="nav" data-view="support">Открыть поддержку →</button></section>
    <section class="card zf-cloud-card" style="margin-bottom:16px"><div class="card-header"><div><div class="eyebrow">Облачный профиль</div><h2 class="h2">АККАУНТ ZERO FOOTBALL</h2><p>Регистрация нужна для переноса клуба между устройствами. Одиночный режим продолжает работать без интернета.</p></div><span class="pill ${zfAuthUser?'pill-lime':''}">${zfAuthUser?'В сети':'Локально'}</span></div><p class="muted small" id="zfCloudStatus">${esc(zfCloudStatus)}</p>${zfAuthUser?`<div class="statline"><span>Аккаунт</span><b>${esc(zfAuthUser.email||'Подключён')}</b></div><div class="settings-actions"><button class="btn btn-primary" data-action="cloud-upload" ${zfCloudBusy?'disabled':''}>☁ Сохранить в облако</button><button class="btn btn-secondary" data-action="cloud-download" ${zfCloudBusy?'disabled':''}>↓ Загрузить из облака</button><button class="btn btn-quiet" data-action="cloud-logout">Выйти</button></div>`:`<form id="zfCloudAuthForm" class="zf-cloud-auth-form"><div class="field"><label for="zfCloudEmail">Электронная почта</label><input id="zfCloudEmail" name="email" type="email" autocomplete="email" required placeholder="name@example.com"></div><div class="field"><label for="zfCloudPassword">Пароль</label><input id="zfCloudPassword" name="password" type="password" autocomplete="current-password" minlength="6" required placeholder="Минимум 6 символов"></div><div class="settings-actions"><button class="btn btn-primary" type="submit" data-auth-mode="signin">Войти</button><button class="btn btn-secondary" type="submit" data-auth-mode="signup">Создать аккаунт</button></div></form>`}<p class="muted small">Важно: «Сохранить в облако» заменяет облачную копию текущим локальным прогрессом. «Загрузить из облака» заменяет локальный прогресс облачной копией. Перед переносом сделай резервную копию.</p></section>
    <section class="card" style="margin-bottom:16px"><div class="card-header"><div><div class="eyebrow">Внешний вид</div><h2 class="h2">ОФОРМЛЕНИЕ</h2><p>Открой панель и выбери тему интерфейса.</p></div><button class="btn btn-secondary" data-action="toggle-theme-panel">${themePanelOpen?'Скрыть темы':'🎨 Выбрать тему'}</button></div>${themePanelOpen?themeGroups.map(([category,items])=>`<div class="theme-group-title">${esc(category.toUpperCase())}</div><div class="theme-grid">${themeButtons(items)}</div>`).join(''):`<span class="pill">Активная тема: ${THEME_OPTIONS.find(x=>x[0]===active)?.[2]||'Classic'}</span>`}</section>
    <section class="card" style="margin-bottom:16px"><div class="card-header"><div><div class="eyebrow">Звуки и отклики</div><h2 class="h2">ОТКЛИКИ</h2></div></div><label class="setting-toggle"><span><b>Вибрация</b><small>Можно отключить в любой момент.</small></span><input type="checkbox" data-setting="vibration" ${db.vibration!==false?'checked':''}></label><label class="setting-toggle"><span><b>Звуковые эффекты</b><small>Звуки интерфейса.</small></span><input type="checkbox" data-setting="sound" ${db.sound!==false?'checked':''}></label><div class="field music-volume-field"><label>Громкость эффектов <b id="soundVolumeValue">${Math.round(db.soundVolume)}%</b></label><input type="range" min="0" max="100" value="${Math.round(db.soundVolume)}" data-setting="soundVolume"></div></section>
    <section class="card music-settings-card" style="margin-bottom:16px"><div class="card-header"><div><div class="eyebrow">Музыкальная библиотека · CC0</div><h2 class="h2">ФОНОВАЯ МУЗЫКА</h2><p>Шестнадцать композиций разных жанров: chill, rock, электроника, ретро и атмосферная музыка.</p></div><span class="pill pill-lime">${MUSIC_LIBRARY.length} треков</span></div><label class="setting-toggle"><span><b>Включить фоновую музыку</b><small>Композиция продолжает играть при переходе между экранами.</small></span><input type="checkbox" data-setting="musicEnabled" ${db.musicEnabled!==false?'checked':''}></label><div class="music-controls-grid"><div class="field" style="grid-column:1/-1"><label for="musicTrack">Композиция</label><select id="musicTrack" class="select-compact" data-setting="musicTrack">${renderMusicTrackOptions()}</select><small class="muted">${esc(currentMusicTrack().genre)} · ${esc(currentMusicTrack().artist)} · CC0 · <a href="${esc(currentMusicTrack().source)}" target="_blank" rel="noopener noreferrer">страница трека</a></small></div></div><div class="field music-volume-field"><label for="musicVolume">Громкость музыки <b id="musicVolumeValue">${Math.round(db.musicVolume)}%</b></label><input id="musicVolume" type="range" min="0" max="100" step="1" value="${Math.round(db.musicVolume)}" data-setting="musicVolume"/><div class="music-volume-scale"><span>Тихо</span><span>Громко</span></div></div><div class="settings-actions"><button class="btn btn-primary" data-action="music-preview">▶ Прослушать / включить</button><button class="btn btn-secondary" data-action="music-prev">⏮ Предыдущий трек</button><button class="btn btn-secondary" data-action="music-next">Следующий трек ⏭</button><button class="btn btn-quiet" data-action="music-stop">■ Остановить музыку</button></div><p class="muted small">Треки воспроизводятся с OpenGameArt по CC0. Для запуска требуется интернет и первое нажатие в игре; при недоступности источника включится резервная музыка. Громкость музыки и эффектов регулируется отдельно.</p></section>
    <section class="card pack-settings-card" style="margin-bottom:16px"><div class="card-header"><div><div class="eyebrow">Настройки паков</div><h2 class="h2">АНИМАЦИЯ ПАКОВ</h2><p>Настрой вступление, появление карточек и темп открытия.</p></div></div><label class="setting-toggle"><span><b>Кинематографическое открытие</b><small>Вращение упаковки, зарядка, вспышка, выход карточек по одной и эффекты редкости.</small></span><input type="checkbox" data-setting="packAnimations" ${db.packAnimations!==false?'checked':''}></label><label class="setting-toggle"><span><b>Звук открытия паков</b><small>Короткий негромкий сигнал при открытии. Громкость регулируется ниже отдельно.</small></span><input type="checkbox" data-setting="packSound" ${db.packSound!==false?'checked':''}></label><div class="field music-volume-field"><label>Громкость открытия паков <b id="packSoundVolumeValue">${Math.round(db.packSoundVolume)}%</b></label><input type="range" min="0" max="100" value="${Math.round(db.packSoundVolume)}" data-setting="packSoundVolume"></div><label class="setting-toggle"><span><b>Виброотклик паков</b><small>Короткие тактильные импульсы при открытии и выходе карточек, если устройство поддерживает вибрацию.</small></span><input type="checkbox" data-setting="packVibration" ${db.packVibration!==false?'checked':''}></label><div class="field pack-speed-field"><label for="packAnimationSpeed">Скорость анимации</label><select id="packAnimationSpeed" class="select-compact" data-setting="packAnimationSpeed"><option value="cinematic" ${db.packAnimationSpeed==='cinematic'?'selected':''}>🎬 Кинематографичная · медленно</option><option value="normal" ${db.packAnimationSpeed==='normal'?'selected':''}>⚡ Стандартная</option><option value="fast" ${db.packAnimationSpeed==='fast'?'selected':''}>⏩ Быстрая</option></select><small class="muted small">Настройка сохраняется отдельно для этого браузера.</small></div><div class="pack-settings-preview"><span class="pack-preview-orb">✦</span><div><b>${db.packAnimations!==false?'Анимация включена':'Анимация отключена'}</b><small>${db.packAnimations===false?'Карточки будут показаны сразу.':'В любой момент можно пропустить вступление или запустить его повторно.'}</small></div></div></section>
    <section class="card" style="margin-bottom:16px"><div class="card-header"><div><div class="eyebrow">Язык</div><h2 class="h2">ЯЗЫК ИГРЫ</h2><p>Выбери язык интерфейса.</p></div></div><select class="select-compact" data-setting="language"><option value="ru" ${db.language==="ru"?"selected":""}>🇷🇺 Русский</option><option value="uk" ${db.language==="uk"?"selected":""}>🇺🇦 Українська</option><option value="en" ${db.language==="en"?"selected":""}>🇬🇧 English</option><option value="de" ${db.language==="de"?"selected":""}>🇩🇪 Deutsch</option><option value="fr" ${db.language==="fr"?"selected":""}>🇫🇷 Français</option><option value="es" ${db.language==="es"?"selected":""}>🇪🇸 Español</option><option value="ja" ${db.language==="ja"?"selected":""}>🇯🇵 日本語</option><option value="zh" ${db.language==="zh"?"selected":""}>🇨🇳 中文</option><option value="kk" ${db.language==="kk"?"selected":""}>🇰🇿 Қазақша</option><option value="pl" ${db.language==="pl"?"selected":""}>🇵🇱 Polski</option></select></section>
    <section class="card"><div class="card-header"><div><div class="eyebrow">Профиль клуба</div><h2 class="h2">ПРОФИЛЬ КЛУБА</h2><p>Клуб открывается без логина и пароля. Пока сохранение хранится в этом браузере.</p></div></div><div class="statline"><span>Название клуба</span><b>${esc(club.name)}</b></div><div class="statline"><span>Доступ</span><b>Без пароля</b></div><div class="settings-actions"><button class="btn btn-secondary" data-action="nav" data-view="editor">Изменить клуб</button><button class="btn btn-secondary" data-action="switch-club">Сменить клуб</button><button class="btn btn-danger" data-action="delete-current-club">Удалить клуб</button></div></section>`;
  }
  function allPlayerClubNames(club){
    const names=new Set();
    (REAL_PLAYERS||[]).forEach(p=>{const name=canonicalPlayerClubName(p.club||p.realClub||'');if(name)names.add(name);});
    (db.clubs||[]).forEach(c=>(c.players||[]).forEach(p=>{const name=canonicalPlayerClubName(p.realClub||p.club||'');if(name)names.add(name);}));
    (club?.players||[]).forEach(p=>{const name=canonicalPlayerClubName(p.realClub||p.club||'');if(name)names.add(name);});
    return [...names].sort((a,b)=>a.localeCompare(b,db.language||'ru'));
  }
  function renderCollection(club){
    const owned=collectionMode==='owned';
    const players=owned?club.players.slice().sort((a,b)=>b.rating-a.rating):REAL_PLAYERS.map((p,i)=>({id:p.id,name:p.name,wiki:p.wiki,country:p.country,realClub:p.club,position:p.position,positions:REAL_PLAYER_POSITIONS[p.wiki]||[p.position],rating:p.rating,contractUntil:Date.now()+30*86400000,injuryMatches:0,redCardMatches:0}));
    return `<div class="section-heading"><div><div class="eyebrow">Галерея игроков</div><h1 class="h1">КОЛЛЕКЦИЯ</h1><p class="page-subtitle">${owned?'Твои подписанные футболисты.':'Полная база доступных футболистов в игре.'}</p></div><span class="pill pill-lime">${players.length} карточек</span></div><div class="collection-toolbar"><div class="collection-switch"><button class="btn ${owned?'btn-primary':'btn-secondary'} btn-sm" data-action="collection-mode" data-mode="owned">Мои карточки (${club.players.length})</button><button class="btn ${!owned?'btn-primary':'btn-secondary'} btn-sm" data-action="collection-mode" data-mode="all">Все карточки игры (${REAL_PLAYERS.length})</button></div><input id="collectionSearch" class="collection-search" placeholder="Поиск футболиста…"><select id="collectionPosition" class="select-compact"><option value="">Все позиции</option>${['GK','CB','LB','RB','CDM','CM','CAM','LW','RW','ST'].map(x=>`<option value="${x}">${esc(positionLabel(x))}</option>`).join('')}</select><select id="collectionRarity" class="select-compact"><option value="">Все рейтинги</option><option value="bronze">Бронза</option><option value="silver">Серебро</option><option value="gold">Золото</option><option value="elite">Элита</option><option value="icon">Икона</option></select><select id="collectionCountry" class="select-compact"><option value="">Все страны</option>${Object.entries(PLAYER_COUNTRIES).sort((a,b)=>a[1].name.localeCompare(b[1].name,'ru')).map(([id,c])=>`<option value="${id}">${c.flag} ${esc(c.name)}</option>`).join('')}</select><select id="collectionClub" class="select-compact"><option value="">Все клубы</option>${allPlayerClubNames(club).map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select><div class="collection-price-filter"><label for="collectionPriceMin">Цена, € млн</label><input id="collectionPriceMin" type="number" min="0" step="0.01" placeholder="От"><input id="collectionPriceMax" type="number" min="0" step="0.01" placeholder="До"></div><select id="collectionSort" class="select-compact"><option value="rating">По рейтингу</option><option value="price-high">Дороже</option><option value="price-low">Дешевле</option><option value="name">По имени</option></select></div><div id="collectionGrid" class="player-grid collection-grid">${players.map(p=>renderPlayerCard(p,owned,false)).join('')}</div>`;
  }
  function applyCollectionFilters(){
    const grid=$('#collectionGrid');if(!grid)return;const club=currentClub();const owned=collectionMode==='owned';let list=owned?club.players.slice():REAL_PLAYERS.map(p=>({id:p.id,name:p.name,wiki:p.wiki,country:p.country,realClub:p.club,position:p.position,positions:REAL_PLAYER_POSITIONS[p.wiki]||[p.position],rating:p.rating,contractUntil:Date.now()+30*86400000}));
    const q=($('#collectionSearch')?.value||'').toLowerCase(),pos=$('#collectionPosition')?.value||'',rar=$('#collectionRarity')?.value||'',country=$('#collectionCountry')?.value||'',clubName=$('#collectionClub')?.value||'',minRaw=$('#collectionPriceMin')?.value||'',maxRaw=$('#collectionPriceMax')?.value||'',minPrice=minRaw===''?0:Math.max(0,Number(minRaw)),maxPrice=maxRaw===''?Infinity:Math.max(0,Number(maxRaw)),sort=$('#collectionSort')?.value||'rating';list=list.filter(p=>{const value=marketValue(p.rating),pClub=canonicalPlayerClubName(p.realClub||p.club||'');return (!q||p.name.toLowerCase().includes(q)||playerDisplayName(p).toLowerCase().includes(q)||String(pClub).toLowerCase().includes(q))&&(!pos||(p.positions||[p.position]).includes(pos))&&(!rar||({bronze:p.rating<65,silver:p.rating>=65&&p.rating<75,gold:p.rating>=75&&p.rating<85,elite:p.rating>=85&&p.rating<90,icon:p.rating>=90})[rar])&&(!country||p.country===country)&&(!clubName||pClub.localeCompare(clubName,undefined,{sensitivity:'accent'})===0)&&value>=minPrice&&value<=maxPrice;});list.sort(sort==='name'?(a,b)=>a.name.localeCompare(b.name,'ru'):sort==='price-high'?(a,b)=>marketValue(b.rating)-marketValue(a.rating):sort==='price-low'?(a,b)=>marketValue(a.rating)-marketValue(b.rating):(a,b)=>b.rating-a.rating);grid.innerHTML=list.map(p=>renderPlayerCard(p,owned,false)).join('');applyLanguage();resolvePlayerImages();
  }
  function onlineClubSnapshot(club){
    if(!club)return null;
    const players=(club.lineup||[]).map(id=>(club.players||[]).find(p=>p.id===id)).filter(Boolean).slice(0,11).map(p=>({name:String(p.name||'Игрок').slice(0,42),rating:Math.max(1,Math.min(99,Number(p.rating)||1)),position:p.assignedPosition||p.position||'CM'}));
    return {name:String(club.name||'Клуб').slice(0,28),country:club.country||'ua',rating:teamRating(club),logo:{symbol:club.logo?.symbol||'★',color:club.logo?.color||'#c8ff44'},players};
  }
  async function loadPublicRooms(){
    if(!ZF_SUPABASE||!zfAuthUser)return;
    const {data,error}=await ZF_SUPABASE.from('zf_multiplayer_rooms').select('id,room_code,host_club,created_at').eq('status','waiting').eq('is_public',true).order('created_at',{ascending:false}).limit(20);
    if(error)throw error;
    publicRoomsCache=data||[];
  }
  function stopOnlineRoomSync(){
    if(onlineRoomPoll){clearInterval(onlineRoomPoll);onlineRoomPoll=null;}
    if(onlineRoomChannel&&ZF_SUPABASE){try{ZF_SUPABASE.removeChannel(onlineRoomChannel);}catch(_){}}
    onlineRoomChannel=null;
  }
  async function refreshOnlineRoom(){
    if(!ZF_SUPABASE||!activeOnlineRoom?.id)return;
    const {data,error}=await ZF_SUPABASE.from('zf_multiplayer_rooms').select('*').eq('id',activeOnlineRoom.id).single();
    if(error)throw error;
    const fingerprint=JSON.stringify({status:data.status,state:data.game_state,host:data.host_user_id,guest:data.guest_user_id});
    const changed=fingerprint!==onlineRoomRenderFingerprint;activeOnlineRoom=data;
    if(data.game_state?.mode==='quick_match'){
      await prepareQuickMatchRoom(data);
      if(changed&&view==='match')render();
    }else if(changed&&view==='multiplayer')render();
    onlineRoomRenderFingerprint=fingerprint;
  }
  async function prepareQuickMatchRoom(room){
    if(!room?.id||room.game_state?.mode!=='quick_match')return;
    activeOnlineRoom=room;
    const startedKey='zfOnlineStarted:'+room.id;
    if(!localStorage.getItem(startedKey)){
      const club=currentClub();
      if(club){refreshEnergy(club);if(club.energy>0)club.energy--;saveDB();}
      try{localStorage.setItem(startedKey,'1');}catch(_){}
    }
    if(room.status==='finished'){
      const appliedKey='zfOnlineResultApplied:'+room.id;
      if(!localStorage.getItem(appliedKey)){
        const club=currentClub(),score=room.game_state?.score||{host:0,guest:0},isHost=zfAuthUser?.id===room.host_user_id;
        if(club){const own=Number(isHost?score.host:score.guest)||0,against=Number(isHost?score.guest:score.host)||0;club.stats=club.stats||{};club.stats.matches=(Number(club.stats.matches)||0)+1;club.stats.goalsFor=(Number(club.stats.goalsFor)||0)+own;club.stats.goalsAgainst=(Number(club.stats.goalsAgainst)||0)+against;if(own>against)club.stats.wins=(Number(club.stats.wins)||0)+1;else if(own===against)club.stats.draws=(Number(club.stats.draws)||0)+1;else club.stats.losses=(Number(club.stats.losses)||0)+1;club.coins=(Number(club.coins)||0)+0.35;saveDB();}if(ZF_SUPABASE){ZF_SUPABASE.rpc('zf_clan_record_match',{p_win:own>against}).then(({error})=>{if(error)console.warn('Clan match progress was not recorded:',error);}).catch(()=>{});}const otherUserId=isHost?room.guest_user_id:room.host_user_id;if(otherUserId&&ZF_SUPABASE)ZF_SUPABASE.rpc('zf_social_record_recent_opponent',{p_other:otherUserId}).then(({error})=>{if(error)console.warn('Recent opponent not recorded:',error);}).catch(()=>{});
        try{localStorage.setItem(appliedKey,'1');}catch(_){}
      }
    }
    const events=room.game_state?.events;
    if(room.status==='playing'&&(!Array.isArray(events)||events.length===0)&&zfAuthUser?.id===room.host_user_id&&!onlineInitBusy){
      onlineInitBusy=true;
      try{
        const {data,error}=await ZF_SUPABASE.rpc('zf_initialize_live_match',{p_room_id:room.id,p_events:createOnlineMatchEvents()});
        if(error)throw error;
        const updated=Array.isArray(data)?data[0]:data;if(updated?.id)activeOnlineRoom=updated;
      }catch(error){console.warn('Could not initialize live match:',error);}
      finally{onlineInitBusy=false;}
    }
  }
  async function restoreOnlineRoom(){
    const id=localStorage.getItem('zfActiveOnlineRoomId');
    if(!id||!zfAuthUser||!ZF_SUPABASE)return;
    try{
      const {data,error}=await ZF_SUPABASE.from('zf_multiplayer_rooms').select('*').eq('id',id).maybeSingle();
      if(error)throw error;
      if(data&&(data.host_user_id===zfAuthUser.id||data.guest_user_id===zfAuthUser.id))startOnlineRoomSync(data);
      else localStorage.removeItem('zfActiveOnlineRoomId');
    }catch(error){console.warn('Could not restore online room:',error);}
  }
  function startOnlineRoomSync(room){
    stopOnlineRoomSync();
    if(!room?.id||!ZF_SUPABASE)return;
    activeOnlineRoom=room;
    try{localStorage.setItem('zfActiveOnlineRoomId',room.id);}catch(_){}
    const channel=ZF_SUPABASE.channel('zf-room-'+room.id)
      .on('postgres_changes',{event:'*',schema:'public',table:'zf_multiplayer_rooms',filter:'id=eq.'+room.id},payload=>{
        if(payload.new){const fp=JSON.stringify({status:payload.new.status,state:payload.new.game_state,host:payload.new.host_user_id,guest:payload.new.guest_user_id});if(fp===onlineRoomRenderFingerprint)return;onlineRoomRenderFingerprint=fp;activeOnlineRoom=payload.new;if(payload.new.game_state?.mode==='quick_match'){prepareQuickMatchRoom(payload.new).then(()=>{if(view==='match')render();}).catch(err=>console.warn(err));}else if(view==='multiplayer')render();}
      })
      .on('postgres_changes',{event:'DELETE',schema:'public',table:'zf_multiplayer_rooms',filter:'id=eq.'+room.id},()=>{activeOnlineRoom=null;try{localStorage.removeItem('zfActiveOnlineRoomId');}catch(_){}stopOnlineRoomSync();if(view==='multiplayer'||view==='match'){render();toast('Комната закрыта создателем.','error');}});
    onlineRoomChannel=channel.subscribe();
    onlineRoomPoll=setInterval(()=>{if(activeOnlineRoom?.id&&(view==='match'||view==='multiplayer'))refreshOnlineRoom().catch(error=>console.warn('Online room refresh failed:',error));},3000);
  }
  async function multiplayerCreateRoom(){
    const user=await authenticatedUser(),club=currentClub();
    if(!club)throw new Error('Сначала создай клуб.');
    if(multiplayerBusy)return;multiplayerBusy=true;
    try{
      const code=Array.from({length:6},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');
      const isPublic=$('#mpPublicRoom')?.checked===true;
      const {data,error}=await ZF_SUPABASE.from('zf_multiplayer_rooms').insert({room_code:code,host_user_id:user.id,host_club:onlineClubSnapshot(club),is_public:isPublic,status:'waiting',game_state:{}}).select('*').single();
      if(error)throw error;
      view='multiplayer';startOnlineRoomSync(data);await loadPublicRooms().catch(()=>{});render();toast(`Комната создана. Код: ${code}`);
    }finally{multiplayerBusy=false;}
  }
  async function multiplayerJoinRoom(rawCode){
    const user=await authenticatedUser(),club=currentClub();
    if(!club)throw new Error('Сначала создай клуб.');
    const code=String(rawCode||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(code.length!==6)throw new Error('Код комнаты должен состоять из 6 символов.');
    if(multiplayerBusy)return;multiplayerBusy=true;
    try{
      const {data,error}=await ZF_SUPABASE.rpc('zf_join_room',{p_room_code:code,p_guest_club:onlineClubSnapshot(club)});
      if(error)throw error;
      const room=Array.isArray(data)?data[0]:data;
      if(!room?.id)throw new Error('Комната не найдена или уже занята.');
      view='multiplayer';startOnlineRoomSync(room);await loadPublicRooms().catch(()=>{});render();toast('Ты подключился к комнате.');
    }finally{multiplayerBusy=false;}
  }
  async function multiplayerStartMatch(){
    const user=await authenticatedUser(),room=activeOnlineRoom;
    if(!room||room.host_user_id!==user.id)throw new Error('Начать матч может создатель комнаты.');
    if(!room.guest_user_id||room.status!=='ready')throw new Error('Ждём подключения второго игрока.');
    const {data,error}=await ZF_SUPABASE.rpc('zf_start_room',{p_room_id:room.id});
    if(error)throw error;
    activeOnlineRoom=Array.isArray(data)?data[0]:data;render();
  }
  async function multiplayerLeaveRoom(){
    if(!activeOnlineRoom?.id)return;
    const roomId=activeOnlineRoom.id;
    const {error}=await ZF_SUPABASE.rpc('zf_leave_room',{p_room_id:roomId});
    if(error)throw error;
    stopOnlineRoomSync();activeOnlineRoom=null;try{localStorage.removeItem('zfActiveOnlineRoomId');}catch(_){}view='multiplayer';
    await loadPublicRooms().catch(()=>{});render();toast('Ты покинул онлайн-комнату.');
  }
  async function multiplayerSubmitAction(choice){
    if(!['left','center','right'].includes(choice))throw new Error('Неверный вариант удара.');
    const room=activeOnlineRoom;if(!room?.id)throw new Error('Комната не найдена.');
    const user=await authenticatedUser();
    const {data,error}=await ZF_SUPABASE.rpc('zf_submit_penalty_action',{p_room_id:room.id,p_expected_round:Number(room.game_state?.round)||1,p_expected_phase:room.game_state?.phase||'shoot',p_choice:choice});
    if(error)throw error;
    const updated=Array.isArray(data)?data[0]:data;
    if(updated?.id)activeOnlineRoom=updated;else await refreshOnlineRoom();
    render();
  }
  function renderMultiplayer(club){
    if(!zfAuthSession||!zfAuthUser)return `<div class="section-heading"><div><div class="eyebrow">ZERO FOOTBALL · ONLINE</div><h1 class="h1">МУЛЬТИПЛЕЕР</h1><p class="page-subtitle">Для онлайн-игр нужен аккаунт.</p></div></div><section class="card"><h2 class="h2">ВОЙДИ В ZERO FOOTBALL</h2><p class="muted small">Ты сейчас в офлайн-режиме. Создай аккаунт или войди, чтобы открывать комнаты и играть с другими пользователями.</p><button class="btn btn-primary" data-action="nav" data-view="settings">Открыть настройки аккаунта →</button></section>`;
    const room=activeOnlineRoom;
    if(room){
      const host=room.host_club||{},guest=room.guest_club||{};
      const isHost=zfAuthUser?.id===room.host_user_id;
      const ownName=isHost?host.name:guest.name;
      const phase=room.game_state?.phase||'shoot',round=Number(room.game_state?.round)||1;
      const shooterRole=round%2===1?'host':'guest';
      const shooterId=shooterRole==='host'?room.host_user_id:room.guest_user_id;
      const expectedId=phase==='shoot'?shooterId:(shooterRole==='host'?room.guest_user_id:room.host_user_id);
      const myTurn=zfAuthUser?.id===expectedId;
      const shooterName=shooterRole==='host'?(host.name||'Хозяева'):(guest.name||'Гости');
      const roleText=phase==='shoot'?(myTurn?'Твой удар':'Соперник выбирает направление удара'):(myTurn?'Твоя задача — угадать направление':'Соперник выбирает направление для сейва');
      const score=room.game_state?.score||{host:0,guest:0};
      const log=Array.isArray(room.game_state?.log)?room.game_state.log:[];
      const laneLabel={left:'ЛЕВО',center:'ЦЕНТР',right:'ПРАВО'};
      const controls=room.status==='playing'&&myTurn?`<div class=\"mp-lanes\">${['left','center','right'].map(x=>`<button class=\"mp-lane\" data-action=\"mp-penalty-choice\" data-choice=\"${x}\"><span>${x==='left'?'↙':x==='center'?'↑':'↘'}</span><b>${laneLabel[x]}</b></button>`).join('')}</div>`:room.status==='playing'?`<div class=\"auth-notice\">${esc(roleText)}. Ход обновится автоматически.</div>`:'';
      return `<div class=\"section-heading\"><div><div class=\"eyebrow\">ОНЛАЙН · КОМНАТА ${esc(room.room_code)}</div><h1 class=\"h1\">${room.status==='playing'?'СЕРИЯ ПЕНАЛЬТИ':'ОНЛАЙН-КОМНАТА'}</h1><p class=\"page-subtitle\">${room.status==='waiting'?'Ожидание второго игрока. Поделись кодом комнаты.':room.status==='ready'?'Соперник подключился. Можно начинать матч.':room.status==='finished'?'Серия завершена.':'Пять ударов каждому — кто точнее, тот победил.'}</p></div><span class=\"pill pill-lime\">${room.status==='waiting'?'Ожидание':room.status==='ready'?'2 игрока':'В сети'}</span></div><section class=\"card mp-room-card\"><div class=\"mp-room-code\"><span>КОД ПРИГЛАШЕНИЯ</span><strong>${esc(room.room_code)}</strong><button class=\"btn btn-secondary btn-sm\" data-action=\"copy-room-code\">Скопировать код</button></div><div class=\"mp-versus\"><div><div class=\"club-crest\" style=\"--crest-color:${esc(host.logo?.color||'#c8ff44')}\">${esc(host.logo?.symbol||'★')}</div><strong>${esc(host.name||'Хозяин')}</strong><small>${Number(host.rating)||0} OVR</small></div><b>VS</b><div><div class=\"club-crest\" style=\"--crest-color:${esc(guest.logo?.color||'#89938a')}\">${esc(guest.logo?.symbol||'?')}</div><strong>${esc(guest.name||'Ожидаем игрока')}</strong><small>${guest.rating?`${Number(guest.rating)} OVR`:'Не подключён'}</small></div></div>${room.status==='waiting'?`<div class=\"auth-notice\">${isHost?'Комната создана. Отправь код другу и дождись подключения.':'Подключение завершено.'}</div>`:''}${room.status==='ready'?`<div class=\"settings-actions\">${isHost?'<button class=\"btn btn-primary\" data-action=\"mp-start\">Начать онлайн-матч →</button>':'<div class=\"auth-notice\">Ожидаем, пока создатель начнёт матч.</div>'}</div>`:''}${room.status==='playing'?`<div class=\"mp-score\"><div class=\"eyebrow\">СЧЁТ СЕРИИ · ${Math.min(5,Math.ceil(round/2))}/5</div><strong>${Number(score.host)||0} : ${Number(score.guest)||0}</strong><small>${esc(host.name||'Хозяин')} — ${esc(guest.name||'Гость')}</small></div><div class=\"mp-turn-info\"><span class=\"pill\">${phase==='shoot'?'⚽ УДАР':'🧤 СЕЙВ'}</span><b>${esc(roleText)}</b><small>${phase==='shoot'?`${esc(shooterName)} бьёт`:`${esc(shooterName)} бьёт · второй игрок защищается`}</small></div>${controls}`:''}${room.status==='finished'?`<div class=\"mp-score\"><div class=\"eyebrow\">ФИНАЛЬНЫЙ СЧЁТ</div><strong>${Number(score.host)||0} : ${Number(score.guest)||0}</strong><small>${score.host===score.guest?'Ничья':score.host>score.guest?`${esc(host.name||'Хозяева')} победили`:`${esc(guest.name||'Гости')} победили`}</small></div>`:''}${log.length?`<div class=\"mp-log\"><div class=\"eyebrow\">ХРОНИКА СЕРИИ</div>${log.map((entry,i)=>`<div class=\"statline\"><span>${i+1}. ${esc(entry.shooter_name||'Игрок')} · ${esc(laneLabel[entry.shot]||entry.shot||'—')}</span><b>${entry.goal?'ГОЛ':'СЕЙВ'}</b></div>`).join('')}</div>`:''}<div class=\"settings-actions\"><button class=\"btn btn-secondary\" data-action=\"mp-refresh\">↻ Обновить</button><button class=\"btn btn-quiet\" data-action=\"mp-leave-room\">Покинуть комнату</button></div></section>`;
    }
    const rooms=publicRoomsCache.map(r=>`<div class=\"mp-public-room\"><div><strong>${esc(r.host_club?.name||'Клуб')}</strong><small>${Number(r.host_club?.rating)||0} OVR · Код ${esc(r.room_code)}</small></div><button class=\"btn btn-secondary btn-sm\" data-action=\"mp-join-room\" data-room-code=\"${esc(r.room_code)}\">Подключиться</button></div>`).join('');
    return `<div class=\"section-heading\"><div><div class=\"eyebrow\">ZERO FOOTBALL · ONLINE</div><h1 class=\"h1\">МУЛЬТИПЛЕЕР</h1><p class=\"page-subtitle\">Создавай комнаты, приглашай друзей или подключайся к открытому матчу.</p></div><span class=\"pill pill-lime\">🌐 Supabase</span></div><div class=\"dashboard-grid mp-dashboard\"><section class=\"card\"><div class=\"eyebrow\">СОЗДАТЬ ИГРУ</div><h2 class=\"h2\">НОВАЯ КОМНАТА</h2><p class=\"muted small\">Создай приватную комнату по коду или открытую, чтобы другой игрок нашёл её в списке.</p><label class=\"setting-toggle\"><span><b>Открытая комната</b><small>Показывать комнату в общем поиске.</small></span><input type=\"checkbox\" id=\"mpPublicRoom\"></label><button class=\"btn btn-primary btn-full\" data-action=\"mp-create\" ${multiplayerBusy?'disabled':''}>＋ Создать комнату</button></section><section class=\"card\"><div class=\"eyebrow\">ПРИСОЕДИНИТЬСЯ</div><h2 class=\"h2\">ЕСТЬ КОД?</h2><p class=\"muted small\">Введи шестизначный код приглашения от другого игрока.</p><form id=\"mpJoinCodeForm\" class=\"mp-join-form\"><input name=\"roomCode\" maxlength=\"6\" minlength=\"6\" required placeholder=\"ABC123\" autocomplete=\"off\"><button class=\"btn btn-secondary\" type=\"submit\">Подключиться →</button></form></section></div><section class=\"card mp-public-list\"><div class=\"card-header\"><div><div class=\"eyebrow\">ОТКРЫТЫЕ КОМНАТЫ</div><h2 class=\"h2\">ПОИСК ИГРОКОВ</h2></div><button class=\"btn btn-quiet btn-sm\" data-action=\"mp-refresh\">↻ Обновить</button></div>${rooms||'<div class=\"empty-state\"><div class=\"empty-icon\">🌐</div><strong>Свободных комнат пока нет</strong><span class=\"small\">Создай свою или подключись по приглашению.</span></div>'}</section><section class=\"card\"><div class=\"eyebrow\">ПЕРВЫЙ ОНЛАЙН-РЕЖИМ</div><h2 class=\"h2\">СЕРИЯ ПЕНАЛЬТИ 1 НА 1</h2><p class=\"muted small\">Пять ударов каждому. Игроки по очереди бьют и становятся вратарями. Ходы и счёт синхронизируются через сервер.</p></section>`;
  }
  async function refreshCommunityPage(target=view){
    if(!COMMUNITY_VIEWS.has(target))return;
    if(!ZF_SUPABASE||!zfAuthSession){communityState.error='Для социальных функций необходимо войти в аккаунт через Supabase.';if(view===target)render();return;}
    communityState.loading=true;communityState.error='';if(view===target)render();
    try{
      await authenticatedUser();
      const club=currentClub();
      await syncCommunityInventory(club);
      const {data:profile,error:profileError}=await ZF_SUPABASE.rpc('zf_social_profile',{p_display_name:club?.name||'Игрок',p_club_name:club?.name||'Без клуба'});
      if(profileError)throw profileError;communityState.profile=profile;
      if(target==='friends'){
        const [contacts,offers]=await Promise.all([ZF_SUPABASE.rpc('zf_social_contacts'),ZF_SUPABASE.rpc('zf_trade_inbox')]);
        if(contacts.error)throw contacts.error;if(offers.error)throw offers.error;
        communityState.contacts=contacts.data||{contacts:[],incoming:[],outgoing:[]};communityState.offers=offers.data||[];
      }else if(target==='market'){
        const [market,mine]=await Promise.all([ZF_SUPABASE.rpc('zf_market_search',{p_search:''}),ZF_SUPABASE.rpc('zf_market_my')]);
        if(market.error)throw market.error;if(mine.error)throw mine.error;communityState.market=market.data||[];communityState.myMarket=mine.data||{listings:[],proceeds:[]};
      }else if(target==='clan'){
        const [mine,search,invites]=await Promise.all([ZF_SUPABASE.rpc('zf_clan_my'),ZF_SUPABASE.rpc('zf_clan_search',{p_query:''}),ZF_SUPABASE.rpc('zf_clan_inbox_invites')]);
        if(mine.error)throw mine.error;if(search.error)throw search.error;if(invites.error)throw invites.error;communityState.clan=mine.data?.clan||null;communityState.clanApplications=mine.data?.applications||[];communityState.clanSearch=search.data||[];communityState.clanInvites=invites.data||[];
      }else if(target==='leagues'){
        const [all,mine]=await Promise.all([ZF_SUPABASE.rpc('zf_competition_list',{p_kind:null}),ZF_SUPABASE.rpc('zf_competition_my')]);
        if(all.error)throw all.error;if(mine.error)throw mine.error;communityState.competitions=all.data||[];communityState.myCompetitions=mine.data||{invites:[],competitions:[]};
      }
    }catch(error){console.error('Community data load failed:',error);communityState.error=error.message||'Не удалось загрузить социальные данные.';}
    finally{communityState.loading=false;if(view===target){render();if(target==='market')applyMarketFilters();}}
  }
  function communityShell(title,subtitle,content){
    const code=communityState.profile?.player_code||'ID появится после подключения';
    return `<div class="section-heading"><div><div class="eyebrow">ZERO FOOTBALL · СООБЩЕСТВО</div><h1 class="h1">${title}</h1><p class="page-subtitle">${subtitle}</p></div><button class="btn btn-secondary" data-action="community-refresh">↻ Обновить</button></div>
      <section class="community-profile card"><div><small class="eyebrow">ТВОЙ ИГРОВОЙ ID</small><strong>${esc(code)}</strong><span>${esc(communityState.profile?.display_name||currentClub()?.name||'Игрок')}</span></div><button class="btn btn-quiet btn-sm" data-action="copy-player-code" ${communityState.profile?.player_code?'':'disabled'}>Копировать ID</button></section>
      ${communityState.loading?'<section class="card muted">Загружаем данные сообщества…</section>':''}
      ${communityState.error?`<section class="card community-error"><strong>Не удалось подключиться</strong><p>${esc(communityState.error)}</p><small>Проверь, что миграции <b>004_social_market_competitions_clans.sql</b> и <b>006_v70_market_filters_and_competition_delete.sql</b> выполнены в Supabase.</small></section>`:''}${content}`;
  }
  function renderFriends(club){
    const contacts=communityState.contacts?.contacts||[],incoming=communityState.contacts?.incoming||[],outgoing=communityState.contacts?.outgoing||[];
    const reserves=(club.players||[]).filter(p=>!(club.lineup||[]).includes(p.id)&&!p.marketEscrow&&!p.marketResaleOnly);
    const contactOptions=contacts.map(p=>`<option value="${esc(p.user_id)}">${esc(p.display_name)} · ${p.status==='friend'?'Друг':'Знакомый'}</option>`).join('');
    const playerOptions=reserves.map(p=>`<option value="${esc(p.id)}">${esc(playerDisplayName(p))} · ${Number(p.rating)||0} OVR</option>`).join('');
    const contactRows=contacts.map(p=>`<div class="community-row"><div><strong>${esc(p.display_name)} <small>[${esc(p.player_code)}]</small></strong><span>${esc(p.club_name)} · ${p.status==='friend'?'Друг':'Знакомый'}</span></div><div class="community-actions"><button class="btn btn-quiet btn-sm" data-action="contact-status" data-user-id="${p.user_id}" data-status="${p.status==='friend'?'acquaintance':'friend'}">${p.status==='friend'?'В знакомые':'В друзья'}</button><button class="btn btn-danger btn-sm" data-action="contact-remove" data-user-id="${p.user_id}">Убрать</button></div></div>`).join('')||'<p class="muted">Пока нет друзей и знакомых.</p>';
    const requestRows=incoming.map(p=>`<div class="community-row"><div><strong>${esc(p.display_name)} <small>[${esc(p.player_code)}]</small></strong><span>${esc(p.club_name)}</span></div><div class="community-actions"><button class="btn btn-primary btn-sm" data-action="contact-accept" data-user-id="${p.user_id}" data-status="friend">В друзья</button><button class="btn btn-secondary btn-sm" data-action="contact-accept" data-user-id="${p.user_id}" data-status="acquaintance">Знакомый</button><button class="btn btn-danger btn-sm" data-action="contact-decline" data-user-id="${p.user_id}">Отклонить</button></div></div>`).join('')||'<p class="muted">Новых заявок нет.</p>';
    const sentRows=outgoing.map(p=>`<div class="community-row"><div><strong>${esc(p.display_name)}</strong><span>Заявка отправлена · ${esc(p.player_code)}</span></div><span class="pill">Ожидание</span></div>`).join('');
    const offerRows=(communityState.offers||[]).map(o=>{
      const incomingOffer=o.to_user_id===zfAuthUser?.id;
      let controls='';
      if(incomingOffer&&o.status==='pending'){
        const counterSelect=o.requested_card_hint?`<select class="community-select" data-trade-counter="${o.id}"><option value="">Выбрать ответную карточку…</option>${reserves.map(p=>`<option value="${esc(p.id)}">${esc(playerDisplayName(p))} · ${p.rating} OVR</option>`).join('')}</select>`:'';
        controls=`${counterSelect}<button class="btn btn-primary btn-sm" data-action="trade-accept" data-offer-id="${o.id}">Принять ${o.requested_card_hint?'обмен':'подарок'}</button><button class="btn btn-danger btn-sm" data-action="trade-decline" data-offer-id="${o.id}">Отказать</button>`;
      }else if(!incomingOffer&&o.status==='pending')controls=`<button class="btn btn-secondary btn-sm" data-action="trade-cancel" data-offer-id="${o.id}">Отменить</button>`;
      const statusLabel={pending:'Ожидает ответа',accepted:'Принято',declined:'Отклонено · карточка вернулась',cancelled:'Отменено · карточка вернулась'}[o.status]||o.status;
      return `<div class="community-row"><div><strong>${incomingOffer?'От '+esc(o.from_name):'Ты → '+esc(o.from_code||'игрок')}</strong><span>${esc(o.offered_card?.name||'Карточка')} · ${Number(o.offered_card?.rating)||0} OVR ${o.requested_card_hint?'↔ '+esc(o.requested_card_hint):'· подарок'} · ${esc(statusLabel)}</span>${o.message?`<small>${esc(o.message)}</small>`:''}</div><div class="community-actions">${controls}</div></div>`;
    }).join('')||'<p class="muted">Предложений пока нет.</p>';
    const content=`<div class="community-grid"><section class="card"><h2 class="h2">Добавить игрока</h2><div class="field"><label>ID игрока</label><input id="friend-code-input" maxlength="8" placeholder="Например, A1B2C3D4"></div><button class="btn btn-primary" data-action="friend-search">Найти игрока</button><div id="friend-search-result" class="community-search-result">${communityState.searchResult?`<strong>${esc(communityState.searchResult.display_name)}</strong> · ${esc(communityState.searchResult.club_name)} <button class="btn btn-secondary btn-sm" data-action="friend-send" data-user-code="${esc(communityState.searchResult.player_code)}">Отправить заявку</button>`:''}</div></section><section class="card"><h2 class="h2">Мои контакты <span class="pill">${contacts.length}</span></h2>${contactRows}</section></div>
      <section class="card"><h2 class="h2">Входящие заявки <span class="pill">${incoming.length}</span></h2>${requestRows}</section>${sentRows?`<section class="card"><h2 class="h2">Исходящие заявки</h2>${sentRows}</section>`:''}
      <section class="card"><h2 class="h2">С кем играл</h2>${(communityState.contacts?.recent||[]).map(p=>`<div class="community-row"><div><strong>${esc(p.display_name)} <small>[${esc(p.player_code)}]</small></strong><span>${esc(p.club_name)} · Матчей вместе: ${p.matches_played}</span></div><button class="btn btn-secondary btn-sm" data-action="friend-send" data-user-code="${esc(p.player_code)}">Добавить в контакты</button></div>`).join('')||'<p class="muted">Соперники появятся здесь после онлайн-матчей.</p>'}</section>
      <section class="card"><h2 class="h2">Обмен карточками и подарки</h2><p class="muted small">Карточки из стартового состава нельзя отправлять. Пустое поле «Что хочешь получить» означает подарок.</p>${contacts.length&&reserves.length?`<div class="community-form-grid"><div class="field"><label>Кому</label><select id="trade-target">${contactOptions}</select></div><div class="field"><label>Что отдаёшь</label><select id="trade-card">${playerOptions}</select></div><div class="field"><label>Что хочешь получить (необязательно)</label><input id="trade-request-hint" maxlength="80" placeholder="Например, центрального защитника"></div><div class="field"><label>Сообщение</label><input id="trade-message" maxlength="180" placeholder="Договоримся об обмене"></div><button class="btn btn-primary" data-action="trade-create">Отправить предложение</button></div>`:'<p class="muted">Для обмена нужен хотя бы один контакт и футболист в запасе.</p>'}</section>
      <section class="card"><h2 class="h2">Уведомления об обменах <span class="pill">${(communityState.offers||[]).filter(o=>o.to_user_id===zfAuthUser?.id&&o.status==='pending').length}</span></h2>${offerRows}</section>`;
    return communityShell('ДРУЗЬЯ И ЗНАКОМЫЕ','Игроки, с которыми ты играл, заявки и обмен карточками.',content);
  }
  function applyMarketFilters(){
    const root=$('.market-catalog-card');if(!root)return;
    const position=$('#market-filter-position')?.value||communityState.marketFilters.position||'all',ratingRaw=$('#market-filter-rating')?.value??communityState.marketFilters.rating,minRating=Number(ratingRaw)||0,maxPriceRaw=$('#market-filter-price')?.value??communityState.marketFilters.price,maxPrice=maxPriceRaw===''||maxPriceRaw==null?Infinity:Number(maxPriceRaw),duplicate=$('#market-filter-duplicate')?.value||communityState.marketFilters.duplicate||'all';communityState.marketFilters={position,rating:ratingRaw,price:maxPriceRaw,duplicate};
    let visible=0;const cards=$$('.market-listing-card',root);
    cards.forEach(card=>{const pos=card.dataset.marketPosition||'',rating=Number(card.dataset.marketRating)||0,price=Number(card.dataset.marketPrice)||0,dup=card.dataset.marketDuplicate||'no';const posOk=position==='all'||(position==='gk'?/(врат|goalkeeper|gk)/i.test(pos):position==='def'?/(защит|def|cb|lb|rb)/i.test(pos):position==='mid'?/(полузащит|mid|cm|cdm|cam|dm)/i.test(pos):/(напада|att|st|cf|wing|forward|lw|rw)/i.test(pos));const ok=posOk&&rating>=minRating&&price<=maxPrice&&(duplicate==='all'||dup===duplicate);card.hidden=!ok;if(ok)visible++;});
    const count=$('#market-results-count');if(count)count.textContent=`Показано карточек: ${visible} из ${cards.length}`;
  }
  function renderMarket(club){
    const reserves=(club.players||[]).filter(p=>!(club.lineup||[]).includes(p.id)&&!p.marketEscrow);
    const marketRows=(communityState.market||[]).map(m=>{const snapshot=m.card_snapshot&&typeof m.card_snapshot==='object'?m.card_snapshot:{};const card={...snapshot,id:undefined,name:m.card_name||snapshot.name,rating:Number(m.card_rating)||snapshot.rating||50};const positions=Array.isArray(card.positions)?card.positions.join(' '):(card.position||'');return `<article class="market-listing-card" data-market-name="${esc(m.card_name).toLowerCase()}" data-market-position="${esc(positions).toLowerCase()}" data-market-rating="${Number(m.card_rating)||0}" data-market-price="${Number(m.price_euros)||0}" data-market-duplicate="${m.is_duplicate?'yes':'no'}"><div class="market-listing-card-face">${renderPlayerCard(card,false,false)}</div><div class="market-listing-card-info"><strong>${esc(m.card_name)} ${m.is_duplicate?'<small class="pill">Повторная</small>':''}</strong><span>Продавец: ${esc(m.seller_name)} · ID ${esc(m.seller_code)}</span><b class="market-price">${formatMoney(m.price_euros)}</b><button class="btn btn-primary btn-full" data-action="market-buy" data-listing-id="${m.id}" data-price="${m.price_euros}">Купить карточку</button></div></article>`;}).join('')||'<p class="muted market-empty">По этому запросу карточек нет.</p>';
    const myRows=(communityState.myMarket?.listings||[]).map(m=>`<div class="community-row"><div><strong>${esc(m.card_name)} · ${m.card_rating} OVR</strong><span>${formatMoney(m.price_euros)} · ${m.status==='active'?'На продаже':m.status==='sold'?'Продан':'Снят'}</span></div>${m.status==='active'?`<button class="btn btn-secondary btn-sm" data-action="market-withdraw" data-listing-id="${m.id}">Забрать</button>`:''}</div>`).join('')||'<p class="muted">Ты ещё ничего не выставлял.</p>';
    const proceeds=(communityState.myMarket?.proceeds||[]).reduce((a,p)=>a+Number(p.amount||0),0);
    const sellCards=reserves.map(p=>{const suggested=Math.max(.01,Number(marketValue(p.rating))||.01);return `<article class="market-sell-card" data-market-card-id="${esc(p.id)}"><div class="market-sell-player"><span class="market-ovr">${Number(p.rating)||0}</span><div><strong>${esc(playerDisplayName(p))}</strong><span>${esc(p.position||p.positions||'Футболист')} · ${Number(p.rating)||0} OVR ${p.marketResaleOnly?'<small class="pill">Повторная</small>':''}</span><small>Оценка: ${formatMoney(suggested)}</small></div></div><div class="market-transfer-controls"><label class="market-mode-field"><span>Вариант трансфера</span><select class="market-transfer-mode"><option value="quick">Быстрый · 80%</option><option value="standard" selected>Стандартный · 100%</option><option value="premium">Максимальная цена · 125%</option><option value="custom">Своя цена</option></select></label><label class="market-price-field"><span>Цена, млн €</span><input class="market-transfer-price" type="number" min="0.01" step="0.01" value="${suggested.toFixed(2)}" inputmode="decimal"></label><button class="btn btn-primary market-sell-submit" data-action="market-list">Выставить</button></div></article>`;}).join('');
    const content=`<section class="card market-catalog-card"><h2 class="h2">Каталог трансферного рынка</h2><p class="muted small">Каждое предложение — отдельная карточка футболиста. Ищи по имени или точному названию, затем уточняй выдачу фильтрами.</p><div class="market-search-form"><div class="field"><label>Имя футболиста</label><input id="market-search-input" value="${esc(communityState.marketQuery||'')}" placeholder="Например, Erling Haaland"></div><label class="market-exact-filter"><input id="market-exact-search" type="checkbox" ${communityState.marketExact?'checked':''}> Точное совпадение</label><button class="btn btn-secondary" data-action="market-search">Найти</button></div><div class="market-filters"><label><span>Позиция</span><select id="market-filter-position"><option value="all" ${communityState.marketFilters.position==='all'?'selected':''}>Любая</option><option value="gk" ${communityState.marketFilters.position==='gk'?'selected':''}>Вратарь</option><option value="def" ${communityState.marketFilters.position==='def'?'selected':''}>Защитник</option><option value="mid" ${communityState.marketFilters.position==='mid'?'selected':''}>Полузащитник</option><option value="att" ${communityState.marketFilters.position==='att'?'selected':''}>Нападающий</option></select></label><label><span>Минимальный OVR</span><input id="market-filter-rating" type="number" min="1" max="99" value="${esc(communityState.marketFilters.rating)}" placeholder="Любой"></label><label><span>Максимальная цена, млн €</span><input id="market-filter-price" type="number" min="0" step="0.01" value="${esc(communityState.marketFilters.price)}" placeholder="Любая"></label><label><span>Тип карточки</span><select id="market-filter-duplicate"><option value="all" ${communityState.marketFilters.duplicate==='all'?'selected':''}>Все карточки</option><option value="no" ${communityState.marketFilters.duplicate==='no'?'selected':''}>Обычные</option><option value="yes" ${communityState.marketFilters.duplicate==='yes'?'selected':''}>Повторные</option></select></label><button class="btn btn-quiet btn-sm" data-action="market-filter-reset">Сбросить фильтры</button></div><div class="market-results-count" id="market-results-count"></div><div class="market-list market-card-grid">${marketRows}</div></section>
      <section class="card market-sell-section"><div class="market-section-heading"><div><h2 class="h2">Твои футболисты</h2><p class="muted small">Каждый игрок — отдельная карточка с настройкой условий трансфера. Стартовый состав защищён от продажи.</p></div><span class="pill">${reserves.length} доступно</span></div>${sellCards?`<div class="market-sell-grid">${sellCards}</div>`:'<p class="muted">Нет игроков в запасе, которых можно выставить.</p>'}</section>
      <section class="card"><h2 class="h2">Мои объявления</h2><div class="market-my-list">${myRows}</div><div class="community-actions" style="margin-top:12px"><strong>Невостребованная выручка: ${formatMoney(proceeds)}</strong>${proceeds>0?'<button class="btn btn-primary btn-sm" data-action="market-claim">Забрать деньги</button>':''}</div></section>`;
    return communityShell('ТРАНСФЕРНЫЙ РЫНОК','Открой карточку футболиста и посмотри предложения других клубов.',content);
  }
  function renderClan(club){
    const clan=communityState.clan;
    if(clan){
      const members=clan.members||[],apps=clan.applications||[],missions=clan.missions||[];
      const memberRows=members.map(m=>`<div class="community-row"><div><strong>${esc(m.display_name)} <small>[${esc(m.player_code)}]</small></strong><span>${m.role==='owner'?'Владелец':m.role==='officer'?'Заместитель':'Участник'}</span></div>${clan.owner_user_id===zfAuthUser?.id&&m.role!=='owner'?`<button class="btn btn-danger btn-sm" data-action="clan-kick" data-user-id="${m.user_id}">Исключить</button>`:''}</div>`).join('');
      const appRows=apps.map(a=>`<div class="community-row"><div><strong>${esc(a.display_name)} · ${esc(a.player_code)}</strong><span>${esc(a.message||'Заявка без сообщения')}</span></div><div class="community-actions"><button class="btn btn-primary btn-sm" data-action="clan-review" data-application-id="${a.id}" data-accept="true">Принять</button><button class="btn btn-danger btn-sm" data-action="clan-review" data-application-id="${a.id}" data-accept="false">Отклонить</button></div></div>`).join('')||'<p class="muted">Новых заявок нет.</p>';
      const missionRows=missions.map(m=>`<div class="clan-mission"><strong>${esc(m.title)}</strong><span>${esc(m.description)}</span><div class="progress"><span style="width:${Math.min(100,100*m.progress/m.target)}%"></span></div><small>${m.progress}/${m.target} · +${m.reward_xp} XP клану ${m.completed?'· Выполнено':''}</small></div>`).join('');
      const content=`<section class="card clan-banner"><div><div class="eyebrow">КЛАН · УРОВЕНЬ ${clan.level}</div><h2>[${esc(clan.tag)}] ${esc(clan.name)}</h2><p>${esc(clan.description||'Без описания')}</p><small>${members.length} участников · ${clan.xp} XP</small></div></section>${clan.owner_user_id===zfAuthUser?.id||members.some(m=>m.user_id===zfAuthUser?.id&&m.role==='officer')?`<section class="card"><h2 class="h2">Пригласить игрока</h2><div class="community-form-grid"><div class="field"><label>ID игрока</label><input id="clan-invite-code" maxlength="8" placeholder="A1B2C3D4"></div><button class="btn btn-primary" data-action="clan-invite">Отправить приглашение</button>${clan.owner_user_id===zfAuthUser?.id?'<button class="btn btn-danger btn-sm" data-action="clan-disband">Удалить клан</button>':''}</div></section>`:''}<section class="card"><h2 class="h2">Участники клана</h2>${memberRows}<div class="community-actions" style="margin-top:14px">${clan.owner_user_id!==zfAuthUser?.id?'<button class="btn btn-danger btn-sm" data-action="clan-leave">Покинуть клан</button>':''}</div></section><section class="card"><h2 class="h2">Заявки на вступление</h2>${clan.owner_user_id===zfAuthUser?.id||members.some(m=>m.user_id===zfAuthUser?.id&&m.role==='officer')?appRows:'<p class="muted">Заявки доступны владельцу и заместителям.</p>'}</section><section class="card"><h2 class="h2">Задания клана</h2>${missionRows||'<p class="muted">Задания появятся позже.</p>'}</section>`;
      return communityShell('КЛАН','Развивайте клан, принимайте участников и выполняйте общие задания.',content);
    }
    const apps=(communityState.clanApplications||[]).map(a=>`<div class="community-row"><div><strong>[${esc(a.clan_tag)}] ${esc(a.clan_name)}</strong><span>Заявка: ${esc(a.status)}</span></div></div>`).join('');
    const search=(communityState.clanSearch||[]).map(c=>`<div class="community-row"><div><strong>[${esc(c.tag)}] ${esc(c.name)} · Ур. ${c.level}</strong><span>${esc(c.description||'Без описания')} · ${c.members} участников · владелец ${esc(c.owner_name)}</span></div><button class="btn btn-primary btn-sm" data-action="clan-apply" data-clan-id="${c.id}">Подать заявку</button></div>`).join('')||'<p class="muted">Подходящих открытых кланов пока нет.</p>';
    const inviteRows=(communityState.clanInvites||[]).map(i=>`<div class="community-row"><div><strong>[${esc(i.clan_tag)}] ${esc(i.clan_name)}</strong><span>Приглашение от ${esc(i.invited_by)}</span></div><div class="community-actions"><button class="btn btn-primary btn-sm" data-action="clan-invite-reply" data-invite-id="${i.id}" data-accept="true">Принять</button><button class="btn btn-danger btn-sm" data-action="clan-invite-reply" data-invite-id="${i.id}" data-accept="false">Отклонить</button></div></div>`).join('');
    const content=`${inviteRows?`<section class="card"><h2 class="h2">Приглашения в кланы</h2>${inviteRows}</section>`:''}<section class="card"><h2 class="h2">Создать клан</h2><p class="muted">Создание стоит €50 млн. У клана будет собственный тег [TAG], уровень, участники и задания. Списание пока идёт из локального баланса клуба.</p><div class="community-form-grid"><div class="field"><label>Название</label><input id="clan-name-input" maxlength="24" placeholder="Zero United"></div><div class="field"><label>Тег (2–5 символов)</label><input id="clan-tag-input" maxlength="5" placeholder="ZERO"></div><div class="field"><label>Описание</label><input id="clan-description-input" maxlength="180" placeholder="Коротко о клане"></div><button class="btn btn-primary" data-action="clan-create">Создать за €50 млн</button></div></section><section class="card"><h2 class="h2">Найти клан</h2>${search}</section>${apps?`<section class="card"><h2 class="h2">Мои заявки</h2>${apps}</section>`:''}`;
    return communityShell('КЛАНЫ','Создавай собственный клубный союз или подавай заявки в другие кланы.',content);
  }
  function renderCompetitionStandings(competition){
    if(competition.kind!=='league')return '';
    const rows=(competition.members||[]).map(member=>({id:member.user_id,name:member.display_name,played:0,w:0,d:0,l:0,gf:0,ga:0,pts:0}));
    const byId=new Map(rows.map(row=>[row.id,row]));
    for(const match of competition.matches||[]){
      if(match.status!=='finished'||!match.home_user_id||!match.away_user_id||match.home_score==null||match.away_score==null)continue;
      const home=byId.get(match.home_user_id),away=byId.get(match.away_user_id);if(!home||!away)continue;
      const hs=Number(match.home_score)||0,as=Number(match.away_score)||0;
      home.played++;away.played++;home.gf+=hs;home.ga+=as;away.gf+=as;away.ga+=hs;
      if(hs>as){home.w++;home.pts+=3;away.l++;}else if(hs<as){away.w++;away.pts+=3;home.l++;}else{home.d++;away.d++;home.pts++;away.pts++;}
    }
    rows.sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||a.name.localeCompare(b.name,'ru'));
    return `<section class="league-standings"><h4>Турнирная таблица</h4>${rows.map((r,i)=>`<div class="league-standing-row"><b>${i+1}</b><strong>${esc(r.name)}</strong><span>${r.played} М</span><span>${r.w} В</span><span>${r.d} Н</span><span>${r.l} П</span><span>${r.gf}:${r.ga}</span><b>${r.pts}</b></div>`).join('')}</section>`;
  }
  function renderCompetitions(club){
    const my=communityState.myCompetitions||{invites:[],competitions:[]};
    const invites=(my.invites||[]).map(i=>`<div class="community-row"><div><strong>${esc(i.title)}</strong><span>${i.kind==='league'?'Лига':'Турнир'} · приглашение от ${esc(i.invited_by)}</span></div><div class="community-actions"><button class="btn btn-primary btn-sm" data-action="competition-invite-reply" data-invite-id="${i.id}" data-accept="true">Принять</button><button class="btn btn-danger btn-sm" data-action="competition-invite-reply" data-invite-id="${i.id}" data-accept="false">Отклонить</button></div></div>`).join('');
    const all=(communityState.competitions||[]).map(c=>`<article class="competition-card"><div class="competition-head"><div><span class="eyebrow">${c.kind==='league'?'ЛИГА':'ТУРНИР НА ВЫБЫВАНИЕ'} · ${c.status==='open'?'НАБОР':c.status==='locked'?'СОСТАВ ЗАКРЫТ':'ЗАВЕРШЕНО'}</span><h3>${esc(c.title)}</h3><small>Создатель: ${esc(c.owner_name)} · ${c.member_count}/${c.max_players} · жеребьёвка: ${c.draw_mode==='random'?'случайная':'ручная'}</small></div><span class="pill">${c.reward?.type==='none'?'Без награды':`Награда: ${esc(c.reward?.type||'')}`}</span></div><div class="community-actions">${c.status==='open'&&!c.is_member?`<button class="btn btn-primary btn-sm" data-action="competition-join" data-competition-id="${c.id}">Вступить</button>`:''}${c.owner_user_id===zfAuthUser?.id&&c.status==='open'?`<input class="code-input" data-invite-code="${c.id}" maxlength="8" placeholder="ID игрока"><button class="btn btn-secondary btn-sm" data-action="competition-invite" data-competition-id="${c.id}">Пригласить</button>`:''}</div></article>`).join('')||'<p class="muted">Пока нет созданных лиг и турниров.</p>';
    const myRows=(my.competitions||[]).map(c=>`<section class="card"><div class="competition-head"><div><span class="eyebrow">${c.kind==='league'?'ЛИГА':'ТУРНИР'} · ${esc(c.status)}</span><h3>${esc(c.title)}</h3></div><span class="pill">${c.members?.length||0} участников</span></div><div class="competition-members">${(c.members||[]).map(m=>`<div class="community-row"><div><strong>${esc(m.display_name)}</strong><span>${m.seed?`Посев №${m.seed}`:'Участник'}</span></div>${c.owner_user_id===zfAuthUser?.id&&c.status==='open'&&(communityState.competitions||[]).find(entry=>entry.id===c.competition_id)?.draw_mode==='manual'?`<label class="manual-seed-control">Позиция <select class="select-compact" data-manual-seed="${c.competition_id}" data-user-id="${m.user_id}">${Array.from({length:c.members.length},(_,i)=>i+1).map(n=>`<option value="${n}" ${n===(Number(m.seed)||c.members.indexOf(m)+1)?'selected':''}>${n}</option>`).join('')}</select></label>`:''}${c.owner_user_id===zfAuthUser?.id&&m.user_id!==zfAuthUser?.id&&c.status==='open'?`<button class="btn btn-danger btn-sm" data-action="competition-kick" data-competition-id="${c.competition_id}" data-user-id="${m.user_id}">Исключить</button>`:''}</div>`).join('')}</div>${c.owner_user_id===zfAuthUser?.id&&c.status==='open'?`<div class="community-actions"><button class="btn btn-primary btn-sm" data-action="competition-lock" data-competition-id="${c.competition_id}">Подтвердить состав и провести жеребьёвку</button></div>`:''}${c.owner_user_id===zfAuthUser?.id?`<div class="community-actions competition-delete-row"><button class="btn btn-danger btn-sm" data-action="competition-delete" data-competition-id="${c.competition_id}" data-competition-title="${esc(c.title)}">Удалить ${c.kind==='league'?'лигу':'турнир'}</button></div>`:''}${renderCompetitionStandings(c)}${(c.matches||[]).length?`<div class="fixture-list"><strong>Расписание / сетка</strong>${c.matches.map(m=>`<div class="fixture-row">${m.status==='bye'?'Проход дальше':`${c.kind==='league'?`Матч ${m.match_no}`:`Раунд ${m.round_no}`}: ${esc((c.members||[]).find(x=>x.user_id===m.home_user_id)?.display_name||'Участник')} — ${esc((c.members||[]).find(x=>x.user_id===m.away_user_id)?.display_name||'Участник')} ${m.status==='finished'?`· ${m.home_score}:${m.away_score}`:m.status==='reported'?(m.reported_by===zfAuthUser?.id?`· ${m.home_score}:${m.away_score} · ожидается подтверждение соперника`:`<input class="fixture-score" type="number" min="0" max="99" value="${m.home_score}" data-fixture-score="${m.id}" data-side="home"><span>:</span><input class="fixture-score" type="number" min="0" max="99" value="${m.away_score}" data-fixture-score="${m.id}" data-side="away"><button class="btn btn-primary btn-sm" data-action="competition-report-result" data-match-id="${m.id}">Подтвердить счёт</button>`):((m.home_user_id===zfAuthUser?.id||m.away_user_id===zfAuthUser?.id)?`<input class="fixture-score" type="number" min="0" max="99" value="0" data-fixture-score="${m.id}" data-side="home"><span>:</span><input class="fixture-score" type="number" min="0" max="99" value="0" data-fixture-score="${m.id}" data-side="away"><button class="btn btn-secondary btn-sm" data-action="competition-report-result" data-match-id="${m.id}">Отправить счёт</button>`:' · Ожидается матч')}`}</div>`).join('')}</div>`:''}</section>`).join('');
    const content=`${invites?`<section class="card"><h2 class="h2">Приглашения</h2>${invites}</section>`:''}<section class="card"><h2 class="h2">Создать лигу или турнир</h2><div class="community-form-grid"><div class="field"><label>Название</label><input id="competition-title-input" maxlength="40" placeholder="Zero Cup"></div><div class="field"><label>Тип</label><select id="competition-kind-input"><option value="league">Лига (каждый с каждым)</option><option value="tournament">Турнир на выбывание</option></select></div><div class="field"><label>Максимум участников</label><input id="competition-max-input" type="number" min="2" max="64" value="16"></div><div class="field"><label>Жеребьёвка</label><select id="competition-draw-input"><option value="random">Случайная</option><option value="manual">Ручная</option></select></div><div class="field"><label>Награда</label><select id="competition-reward-input"><option value="none">Без награды</option><option value="participants">Скидываются участники</option><option value="creator">Оплачивает создатель</option><option value="selected">Оплачивает выбранный игрок</option></select></div><div class="field"><label>Сумма, млн € (если денежный приз)</label><input id="competition-prize-input" type="number" min="0" step="0.1" value="0"></div><div class="field"><label>Дополнительный пак (необязательно)</label><input id="competition-pack-input" maxlength="40" placeholder="Название пака"></div><div class="field"><label>ID плательщика (для выбранного игрока)</label><input id="competition-payer-input" maxlength="8" placeholder="ID игрока"></div><button class="btn btn-primary" data-action="competition-create">Создать</button></div><p class="muted small">После подтверждения состава вступление и приглашения закрываются. Создатель сможет исключать участников. Награда сохраняется в правилах соревнования.</p></section><section class="card"><h2 class="h2">Открытые соревнования</h2>${all}</section>${myRows?`<section><h2 class="h2">Мои лиги и турниры</h2>${myRows}</section>`:''}`;
    return communityShell('ЛИГИ И ТУРНИРЫ','Создавай неограниченное количество соревнований и приглашай игроков по ID.',content);
  }
  function renderSupport(){
    return `<div class="section-heading"><div><div class="eyebrow">ZERO FOOTBALL · COMMUNITY</div><h1 class="h1">ПОДДЕРЖАТЬ ПРОЕКТ</h1><p class="page-subtitle">Поддержка помогает развивать Zero Football, выпускать обновления и улучшать игру. Выбери подходящий способ оплаты.</p></div><span class="pill pill-lime">Добровольно</span></div>
    <section class="support-intro-card"><div class="support-intro-mark">ZF</div><div><div class="eyebrow">YOUR CLUB. YOUR LEGACY.</div><h2>ИГРА РАСТЁТ ВМЕСТЕ С СООБЩЕСТВОМ</h2><p>Любая поддержка добровольна. Она не выдаёт игровую валюту, карточки или преимущества и не влияет на баланс клуба.</p></div></section>
    <div class="support-method-grid">
      <article class="support-method-card support-ua"><div class="support-method-top"><span class="support-method-flag">🇺🇦</span><span class="pill">Украина</span></div><div class="eyebrow">PRIVATBANK · PRIVAT24</div><h2>ПОДДЕРЖАТЬ ИЗ УКРАИНЫ</h2><p>Перевод через Privat24.</p><a class="btn btn-primary btn-full" href="https://www.privat24.ua/send/kp3pj" target="_blank" rel="noopener noreferrer">Открыть Privat24 ↗</a></article>
      <article class="support-method-card support-ru"><div class="support-method-top"><span class="support-method-flag">🇷🇺</span><span class="pill">Россия</span></div><div class="eyebrow">DONATIONALERTS</div><h2>ПОДДЕРЖАТЬ ИЗ РОССИИ</h2><p>Перевод через DonationAlerts.</p><a class="btn btn-secondary btn-full" href="https://www.donationalerts.com/r/mr_zero_808" target="_blank" rel="noopener noreferrer">Открыть DonationAlerts ↗</a></article>
      <article class="support-method-card support-world"><div class="support-method-top"><span class="support-method-flag">🌍</span><span class="pill">Остальной мир</span></div><div class="eyebrow">DONATELLO</div><h2>SUPPORT ZERO FOOTBALL</h2><p>Международная страница поддержки на Donatello.</p><a class="btn btn-secondary btn-full" href="https://donatello.to/Mr.Zero" target="_blank" rel="noopener noreferrer">Открыть Donatello ↗</a></article>
    </div><p class="muted small support-disclaimer">Платёжные страницы открываются на сайтах соответствующих сервисов. Не вводи платёжные данные внутри игры.</p>`;
  }
  function renderPage(club){switch(view){case'multiplayer':return renderMultiplayer(club);case'friends':return renderFriends(club);case'market':return renderMarket(club);case'clan':return renderClan(club);case'support':return renderSupport();case'leagues':return renderCompetitions(club);case'teamshop':return renderTeamShop(club);case'settings':return renderSettings(club);case'team':return renderTeam(club);case'packs':return renderPacks(club);case'collection':return renderCollection(club);case'sponsors':return renderSponsors(club);case'match':return renderMatch(club);case'trophies':return renderTrophies(club);case'editor':return renderEditor(club);default:return renderHome(club);}}
  function renderAdSlot(club,placement='home'){
    if(db.adsEnabled===false)return '';
    const now=Date.now();const active=club.sponsorSlots?.title&&club.sponsorSlots.title.until>now?club.sponsorSlots.title:null;
    const deal=active?SPONSOR_DEALS.find(x=>x.id===active.id):null;
    const title=deal?.name||translateUIText('Рекламное место свободно');
    const copy=deal?translateUIText(deal.desc):translateUIText('Выбрать спонсора');
    return `<aside class="zf-ad-slot zf-ad-${placement}" aria-label="Рекламный блок"><div class="zf-ad-tag">${translateUIText('РЕКЛАМА')} · ${translateUIText('ПАРТНЁР КЛУБА')}</div><div class="zf-ad-copy"><strong>${esc(title)}</strong><span>${esc(copy)}</span></div><button class="btn btn-secondary btn-sm" data-action="nav" data-view="sponsors">${translateUIText(deal?'Подробнее о партнёре':'Выбрать спонсора')}</button></aside>`;
  }
  function renderHomeProgress(club){const p=progressionState(club);return `<section class="card home-progression"><div><span class="eyebrow">${translateUIText('УРОВЕНЬ КЛУБА')}</span><strong>${translateUIText('Уровень')} ${p.level}/30</strong><small>${p.level>=30?translateUIText('Максимальный уровень'):`${p.xp} / ${p.need} XP`}</small></div><div class="progression-bar"><span style="width:${p.percent}%"></span></div><button class="btn btn-secondary btn-sm" data-action="nav" data-view="trophies">${translateUIText('Задания и уровни')}</button></section>`;}
  function renderHome(club){
    const history=(club.history||[]).slice(0,3);
    return `<div class="welcome-banner"><div class="welcome-copy"><div class="eyebrow">ДОБРО ПОЖАЛОВАТЬ В ТВОЮ ФУТБОЛЬНУЮ ЭРУ</div><h1>WELCOME BACK,<br><span>${esc(club.name)}.</span></h1><p>Твой клуб — твои правила. Усиливай состав, выбирай стиль игры и поднимайся по футбольной лестнице.</p><button class="btn btn-primary" data-action="nav" data-view="match">⚽ Найти соперника <span>→</span></button></div><div class="banner-crest-wrap"><div class="banner-crest ${crestShape(club.logo)}" style="--crest-color:${esc(club.logo.color)}">${crestContent(club.logo,.9)}</div></div></div>${renderAdSlot(club,'home')}${renderHomeProgress(club)}<div class="stat-grid"><div class="metric-card"><div class="metric-top">Рейтинг команды <span class="metric-symbol">★</span></div><div class="metric-value">${teamRating(club)} <span style="font-size:13px;color:var(--muted)">OVR</span></div><div class="metric-note">Средний рейтинг стартовых 11</div></div><div class="metric-card"><div class="metric-top">Матчи <span class="metric-symbol">⚽</span></div><div class="metric-value">${club.stats.matches}</div><div class="metric-note">${club.stats.wins} побед · ${club.stats.draws} ничьих</div></div><div class="metric-card"><div class="metric-top">Победы <span class="metric-symbol">🏆</span></div><div class="metric-value">${club.stats.wins}</div><div class="metric-note">${club.stats.losses} поражений</div></div><div class="metric-card"><div class="metric-top">Футболисты <span class="metric-symbol">♧</span></div><div class="metric-value">${club.players.length}</div><div class="metric-note">${activePlayers(club).length} в стартовом составе</div></div></div><div class="dashboard-grid"><section class="card"><div class="card-header"><div><div class="eyebrow">Быстрый доступ</div><h2 class="h2">ЧТО ДЕЛАЕМ СЕГОДНЯ?</h2><p>Пара действий — и команда станет сильнее.</p></div></div><div class="quick-actions"><button class="quick-action" data-action="nav" data-view="team"><div class="qa-icon">🧩</div><strong>Настроить команду</strong><small>Состав, схема и игровой стиль</small></button><button class="quick-action" data-action="nav" data-view="packs"><div class="qa-icon">🎴</div><strong>Магазин паков</strong><small>Паки и ежедневный бонус</small></button><button class="quick-action" data-action="nav" data-view="trophies"><div class="qa-icon">🏆</div><strong>Трофеи</strong><small>${Object.keys(club.trophyUnlocks||{}).length} из ${TROPHIES.length} достижений</small></button></div></section><section class="card"><div class="card-header"><div><div class="eyebrow">Последние события</div><h2 class="h2">ИСТОРИЯ КЛУБА</h2></div><button class="btn btn-quiet btn-sm" data-action="nav" data-view="match">Играть →</button></div>${history.length?`<div class="recent-list">${history.map(h=>`<div class="recent-row"><div class="recent-icon">${h.result==='W'?'🏆':h.result==='D'?'🤝':'⚽'}</div><div><strong>${esc(h.opponent)}</strong><small>${esc(h.date||'Недавно')} · ${h.result==='W'?'Победа':h.result==='D'?'Ничья':'Поражение'}</small></div><div class="right ${h.result==='W'?'positive':''}">${h.score}</div></div>`).join('')}</div>`:`<div class="empty-state"><div class="empty-icon">📋</div><strong>Первая глава ещё впереди</strong><span class="small">Сыграй матч, и он появится здесь.</span></div>`}</section></div>`;
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

  function contractRenewalCost(player){return Math.max(.02,Math.round(marketValue(player.rating)*.004*100)/100);}
  function renderTeamContracts(club){
    const players=club.players.slice().sort((a,b)=>contractDays(a)-contractDays(b));
    return `<section class="card team-contracts" style="margin-top:16px"><div class="card-header"><div><div class="eyebrow">${translateUIText('КОНТРАКТЫ ИГРОКОВ')}</div><h2 class="h2">КОНТРАКТЫ ИГРОКОВ</h2><p>${translateUIText('Контракты и продление доступны только в настройке команды.')}</p></div><span class="pill">${players.length} игроков</span></div><div class="contract-list">${players.map(p=>{const days=contractDays(p),price=contractRenewalCost(p);return `<div class="contract-row"><div><b data-no-translate>${esc(playerDisplayName(p))}</b><small>${esc(playerPositionsLabel(p))} · ${p.rating} OVR · ${esc(playerClubLabel(p))}</small></div><span class="contract-days ${days<=7?'danger':''}">${days} дн.</span><button class="btn btn-secondary btn-sm" data-action="renew-player-contract" data-player-id="${esc(p.id)}" data-contract-price="${price}" ${club.coins<price?'disabled':''}>${days>0?'Продлить':'Восстановить'} · ${formatMoney(price)}</button></div>`;}).join('')}</div></section>`;
  }
  const ZF_INJURY_TYPES=[
    {name:'Ушиб голеностопа',min:1,max:2,detail:'Болезненность и отёк после столкновения.'},
    {name:'Растяжение приводящей мышцы',min:2,max:4,detail:'Повреждение мышц паховой области при резком движении.'},
    {name:'Мышечное перенапряжение',min:1,max:3,detail:'Перегрузка мышцы после интенсивного рывка.'},
    {name:'Надрыв задней поверхности бедра',min:3,max:5,detail:'Повреждение мышц бедра во время ускорения.'},
    {name:'Растяжение икроножной мышцы',min:2,max:4,detail:'Боль в голени после резкого старта или прыжка.'},
    {name:'Ушиб колена',min:1,max:3,detail:'Ушиб мягких тканей после игрового столкновения.'},
    {name:'Растяжение связок голеностопа',min:3,max:5,detail:'Подворачивание стопы при приземлении или смене направления.'},
    {name:'Повреждение плечевого сустава',min:2,max:4,detail:'Повреждение после падения или контакта с соперником.'},
    {name:'Повреждение боковых связок колена',min:4,max:7,detail:'Травма связок после неудачного поворота колена.'},
    {name:'Небольшое повреждение мениска',min:5,max:8,detail:'Повреждение коленного сустава при вращательной нагрузке.'}
  ];
  function renderTeamMedical(club){
    const injured=club.players.filter(p=>(Number(p.injuryMatches)||0)>0).sort((a,b)=>(b.injuryMatches||0)-(a.injuryMatches||0));
    const booked=club.players.filter(p=>(p.redCardMatches||0)>0||(p.yellowBanMatches||0)>0||(p.yellowCards||0)>0).sort((a,b)=>(b.redCardMatches||0)-(a.redCardMatches||0)||(b.yellowCards||0)-(a.yellowCards||0));
    const injuryCards=injured.map(p=>`<article class="medical-player-card"><div class="medical-player-face">${renderPlayerCard(p,false,false)}</div><div class="medical-player-details"><strong>${esc(playerDisplayName(p))}</strong><span class="status-tag injury">🤕 ${esc(p.injuryType||'Травма')}</span><b>Пропустит ещё ${p.injuryMatches} ${matchCountLabel(p.injuryMatches)}</b><small>${esc(p.injuryDescription||'Игрок проходит восстановление под наблюдением медицинского штаба.')}</small></div></article>`).join('');
    const disciplineCards=booked.map(p=>`<article class="medical-discipline-row"><div class="medical-discipline-player"><b>${esc(playerDisplayName(p))}</b><small>${esc(playerPositionsLabel(p))} · ${p.rating} OVR</small></div><div class="medical-discipline-status">${p.redCardMatches>0?`<span class="status-tag redcard">🟥 Удаление · ${p.redCardMatches} матч.</span>`:''}${p.yellowBanMatches>0?`<span class="status-tag redcard">⛔ Бан за жёлтые · ${p.yellowBanMatches} матч.</span>`:''}${p.yellowCards>0?`<span class="status-tag yellow">🟨 ${p.yellowCards}/5 жёлтых</span>`:''}</div></article>`).join('');
    return `<section class="card team-medical-card"><div class="card-header"><div><div class="eyebrow">МЕДИЦИНСКИЙ ШТАБ И ДИСЦИПЛИНА</div><h2 class="h2">ЛАЗАРЕТ И КАРТОЧКИ</h2><p>Следи за травмами, сроками восстановления и дисциплинарными наказаниями игроков.</p></div><div class="actions"><span class="pill">🤕 ${injured.length} в лазарете</span><span class="pill">🟨 ${booked.length} с карточками</span></div></div><div class="medical-section"><div class="medical-section-heading"><h3 class="h3">🤕 ТРАВМИРОВАННЫЕ</h3><span class="muted small">${injured.length} игроков</span></div>${injuryCards?`<div class="medical-player-grid">${injuryCards}</div>`:'<p class="medical-empty">🟢 В лазарете никого нет. Весь состав доступен.</p>'}</div><div class="medical-section"><div class="medical-section-heading"><h3 class="h3">🟨 ДИСЦИПЛИНАРНЫЕ КАРТОЧКИ</h3><span class="muted small">${booked.length} игроков</span></div>${disciplineCards?`<div class="medical-discipline-list">${disciplineCards}</div>`:'<p class="medical-empty">Ни у одного игрока нет карточек или дисквалификаций.</p>'}</div></section>`;
  }
  function renderTeam(club){
    const formationId=FORMATIONS[club.formation]?club.formation:'4-3-3';
    const formation=FORMATIONS[formationId];
    const pitchFormation=calculatePitchPositions(formationId,formation);
    const slots=formation.map((slot,i)=>{
      const pitchSlot=pitchFormation[i];const p=club.players.find(x=>x.id===club.lineup[i]);const rating=p?playerOVRAt(p,slot.role,club):0;const fit=p?positionPenalty(p,slot.role):0;const art=p?`<img class="slot-portrait squad-photo" data-portrait-key="${esc(p.wiki||p.name)}" ${p.wiki?`data-wiki="${esc(p.wiki)}"`:''} alt="${esc(p.name)}" loading="eager">`:'';return `<div class="player-slot-wrap" style="left:${pitchSlot.x}%;top:${pitchSlot.y}%"><button class="player-slot" data-portrait-key="${p?esc(p.wiki||p.name):''}" ${p?.wiki?`data-wiki="${esc(p.wiki)}"`:''} data-action="edit-slot" data-slot="${i}" title="${p?'Заменить футболиста':'Добавить футболиста'}"><span class="slot-card" style="--crest-color:${esc(club.logo.color||'#c8ff44')}">${art||'+'}</span><span class="slot-rating-below ${fit<0?'out-of-position':''}" title="${fit<0?`Штраф позиции ${fit}`:'Профильная позиция'}">${p?rating:'+'}</span>${p&&(p.injuryMatches>0||p.redCardMatches>0||p.yellowBanMatches>0||p.yellowCards>0)?`<span class="status-tag ${p.yellowCards>0&&!p.injuryMatches&&!p.redCardMatches&&!p.yellowBanMatches?'yellow':p.injuryMatches>0?'injury':'redcard'}">${p.injuryMatches>0?'🤕 '+p.injuryMatches:p.redCardMatches>0?'🟥 '+p.redCardMatches:p.yellowBanMatches>0?'⛔ '+p.yellowBanMatches:'🟨 '+p.yellowCards+'/5'}</span>`:''}<span class="slot-name">${p?esc(playerDisplayName(p).split(' ').slice(-1)[0]):'Добавить'}</span><span class="slot-role">${esc(positionLabel(slot.role))}</span>${p?`<span class="slot-stamina-compact" title="Выносливость">⚡ ${Math.round(p.stamina??100)}%</span>`:''}</button></div>`;}).join('');
    const bench=benchPlayers(club);
    const squad=club.players.slice().sort((a,b)=>b.rating-a.rating);
    return `<div class="section-heading"><div><div class="eyebrow">Управление клубом</div><h1 class="h1">НАСТРОЙКА КОМАНДЫ</h1><p class="page-subtitle">Расставь футболистов, выбери схему и реши, как будет играть твой клуб.</p></div><div class="actions"><span class="pill pill-lime">${teamRating(club)} OVR</span><span class="pill">${club.players.length} игроков</span></div></div><div class="team-layout"><div><section class="card" style="margin-bottom:15px"><div class="card-header"><div><div class="eyebrow">Тактическая доска</div><h2 class="h2">СТАРТОВЫЙ СОСТАВ</h2><p>Используй отдельные кнопки для замены и назначения футболистов.</p></div><span class="pill">${activePlayers(club).length} / 11</span></div><div class="team-controls"><label class="small muted" for="formationSelect">Схема</label><select class="select-compact" id="formationSelect" data-setting="formation">${Object.keys(FORMATIONS).map(f=>`<option value="${f}" ${club.formation===f?'selected':''}>${f}</option>`).join('')}</select><button class="btn btn-quiet btn-sm" data-action="auto-lineup">✦ Лучший состав</button><label class="small muted captain-select-label" for="captainSelect">Капитан</label><select class="select-compact captain-select" id="captainSelect" data-setting="captain">${activePlayers(club).map(p=>`<option value="${esc(p.id)}" ${club.captainId===p.id?'selected':''}>${esc(playerDisplayName(p))}</option>`).join('')}</select></div><div class="pitch"><div class="pitch-midline"></div><div class="pitch-circle"></div><div class="penalty top"></div><div class="penalty bottom"></div>${slots}</div><div class="card-header" style="margin-bottom:10px"><div><h3 class="h3">ЗАПАСНЫЕ</h3><p>Нажми «В основу» у нужного футболиста.</p></div></div><div class="bench-grid">${bench.map(p=>`<div class="bench-card"><span class="bench-avatar" style="--rarity-color:${rarityColor(p.rating+(club.captainId===p.id&&club.lineup.includes(p.id)?1:0))}">${p.rating}</span><strong data-no-translate>${esc(playerDisplayName(p).split(' ').slice(-1)[0])}</strong><small>${esc(playerPositionsLabel(p))}${p.injuryMatches>0?` · 🤕 ${p.injuryMatches}`:''}${p.redCardMatches>0?` · 🟥 ${p.redCardMatches}`:''}${p.yellowBanMatches>0?` · ⛔ ${p.yellowBanMatches}`:p.yellowCards>0?` · 🟨 ${p.yellowCards}/5`:''}</small><button class="btn btn-secondary btn-sm" data-action="quick-assign" data-player-id="${esc(p.id)}" ${playerIsUnavailable(p)?'disabled title="Игрок недоступен"':''}>В основу</button></div>`).join('')}</div></section><section class="card"><div class="card-header"><div><div class="eyebrow">Игровой стиль</div><h2 class="h2">ИГРОВОЙ СТИЛЬ</h2><p>Стиль влияет на риск и баланс атаки с обороной в матче.</p></div></div><div class="style-cards">${Object.entries(STYLES).map(([id,s])=>`<button class="style-option ${club.style===id?'active':''}" data-action="set-style" data-style="${id}"><span class="style-icon">${s.icon}</span><strong>${s.name}</strong><small>${s.desc}</small></button>`).join('')}</div></section></div><div><section class="card" style="margin-bottom:15px"><div class="card-header"><div><div class="eyebrow">Список состава</div><h2 class="h2">ВСЕ ФУТБОЛИСТЫ</h2><p>Игроки основного состава и резерва.</p></div></div><div class="squad-tools" style="margin-bottom:13px"><span class="pill">🟢 ${activePlayers(club).length} в основе</span><span class="pill">🪑 ${benchPlayers(club).length} в резерве</span></div><div class="squad-list">${squad.map(p=>{const idx=club.lineup.indexOf(p.id);const slot=idx>=0?formation[idx]:null;const effective=slot?playerOVRAt(p,slot.role,club):p.rating;const fit=slot?positionPenalty(p,slot.role):0;return `<div class="squad-item" data-portrait-key="${esc(p.wiki||p.name)}" ${p.wiki?`data-wiki="${esc(p.wiki)}"`:``}><div class="mini-player" style="--rarity-color:${rarityColor(effective)}"><span class="mini-rating">${effective}</span><img class="squad-photo" alt="${esc(p.name)}" loading="lazy"></div><div class="squad-info"><strong data-no-translate>${esc(playerDisplayName(p))}</strong><small>${esc(playerPositionsLabel(p))} · ${esc(playerClubLabel(p))}${idx>=0?` · ${positionLabel(slot.role)}${fit<0?` · штраф ${fit}`:''}`:''}${p.injuryMatches>0?` · 🤕 ${p.injuryMatches}`:``}${p.redCardMatches>0?` · 🟥 ${p.redCardMatches}`:``}${p.yellowBanMatches>0?` · ⛔ Жёлтые: бан ${p.yellowBanMatches}`:p.yellowCards>0?` · 🟨 ${p.yellowCards}/5`:``}</small>${idx>=0?`<span class="pill pill-lime">Основа · ${idx+1} · ⚡ ${Math.round(p.stamina??100)}%</span><button class="btn ${club.captainId===p.id?'btn-primary':'btn-quiet'} btn-sm squad-captain-button" data-action="set-captain" data-player-id="${esc(p.id)}" aria-label="Назначить ${esc(playerDisplayName(p))} капитаном">${club.captainId===p.id?'★ Капитан':'☆ Капитан'}</button>`:`<button class="btn btn-secondary btn-sm" data-action="quick-assign" data-player-id="${esc(p.id)}">В основу</button>`}</div></div>`;}).join("")}</div></section><section class="card"><div class="card-header"><div><div class="eyebrow">Анализ состава</div><h2 class="h2">ОЦЕНКА СОСТАВА</h2></div></div><div class="statline"><span>Атака</span><b>${Math.round(activePlayers(club).reduce((s,p)=>s+Math.max(p.shooting,p.dribbling,p.passing),0)/Math.max(1,activePlayers(club).length))}</b></div><div class="progress"><span style="width:${Math.min(100,activePlayers(club).reduce((s,p)=>s+Math.max(p.shooting,p.dribbling,p.passing),0)/Math.max(1,activePlayers(club).length))}%"></span></div><div class="statline"><span>Оборона</span><b>${Math.round(activePlayers(club).reduce((s,p)=>s+p.defense,0)/Math.max(1,activePlayers(club).length))}</b></div><div class="progress"><span style="width:${Math.min(100,activePlayers(club).reduce((s,p)=>s+p.defense,0)/Math.max(1,activePlayers(club).length))}%"></span></div><div class="statline"><span>Сыгранность</span><b>${Math.max(45,Math.min(100,Math.round(100-(new Set(activePlayers(club).map(p=>p.country)).size-1)*4)))}%</b></div><div class="progress"><span style="width:${Math.max(45,Math.min(100,Math.round(100-(new Set(activePlayers(club).map(p=>p.country)).size-1)*4)))}%"></span></div></section></div></div>${renderTeamMedical(club)}${renderPlayerCareerStats(club)}${renderTeamContracts(club)}`;
  }

  function currentDayKey(){
    const now=new Date();return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  }
  function renderPromoPanel(club){
    const redeemed=Array.isArray(club.redeemedPromoCodes)&&club.redeemedPromoCodes.includes('reliz');
    return `<section class="card promo-code-panel" style="margin-bottom:16px"><div class="card-header"><div><div class="eyebrow">БОНУСЫ ZERO FOOTBALL</div><h2 class="h2">АКТИВАЦИЯ КОДА</h2></div><span class="pill">🎁 Бонус</span></div><form id="promoCodeForm" class="promo-code-controls"><input id="promoCodeInput" name="promoCode" class="collection-search" type="text" maxlength="40" autocomplete="off" placeholder="Введите код" aria-label="Промокод" ${redeemed?'disabled':''} required><button class="btn btn-primary" type="submit" ${redeemed?'disabled':''}>${redeemed?'Код использован':'Активировать'}</button></form></section>`;
  }
  function redeemPromoCode(){
    const club=currentClub();if(!club)return;
    const input=$('#promoCodeInput');const code=String(input?.value||'').trim().toLowerCase();
    if(!code){toast('Введи промокод.','error');input?.focus();return;}
    club.redeemedPromoCodes=Array.isArray(club.redeemedPromoCodes)?club.redeemedPromoCodes:[];
    if(code==='reliz'){
      if(club.redeemedPromoCodes.includes('reliz')){toast('Этот код уже использован.','error');render();return;}
      const inventory=ensurePackInventory(club);
      inventory.pro=(Number(inventory.pro)||0)+2;
      club.coins=(Number(club.coins)||0)+50;
      club.redeemedPromoCodes.push('reliz');
      saveDB();render();toast('Код активирован.');return;
    }
    toast('Неверный код.','error');
  }

  function dailyShop(club){
    const now=new Date(),day=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
    if(!club.dailyShop||club.dailyShop.day!==day||!Array.isArray(club.dailyShop.offers)){
      club.dailyShop={day,offers:[],claimed:[]};
    }
    if(!Array.isArray(club.dailyShop.claimed))club.dailyShop.claimed=[];
    // Never advertise a player for purchase if the club already owns that player.
    const ownedWikis=new Set((club.players||[]).map(p=>p.wiki).filter(Boolean));
    const valid=club.dailyShop.offers.filter(wiki=>!ownedWikis.has(wiki)&&!club.dailyShop.claimed.includes(wiki));
    const pool=REAL_PLAYERS.filter(p=>!ownedWikis.has(p.wiki)&&!club.dailyShop.claimed.includes(p.wiki)&&!valid.includes(p.wiki));
    while(valid.length<3&&pool.length)valid.push(pool.splice(rand(0,pool.length-1),1)[0].wiki);
    club.dailyShop.offers=valid;saveDB();
    return club.dailyShop;
  }
  const ZF_PACK_OPTIONS=[
    {id:'starter',image:'assets/packs/starter.webp',name:'Агентство ★',type:'Агентство · 1 звезда',price:2,count:3,color:'#c8ff44',glow:'rgba(200,255,68,.13)',desc:'3 футболиста. Базовый шанс на сильную карточку.',meta:'3 КАРТОЧКИ'},
    {id:'national',image:'assets/packs/national.webp',name:'Агентство ★★',type:'Агентство · 2 звезды',price:8,count:4,color:'#79c9ff',glow:'rgba(121,201,255,.16)',desc:'4 футболиста. Более высокий шанс на рейтинг 70+.',meta:'4 КАРТОЧКИ'},
    {id:'pro',image:'assets/packs/pro.webp',name:'Агентство ★★★',type:'Агентство · 3 звезды',price:25,count:5,color:'#c296ff',glow:'rgba(194,150,255,.17)',desc:'5 футболистов. Повышенный шанс на рейтинг 75+.',meta:'5 КАРТОЧЕК'},
    {id:'elite',image:'assets/packs/elite.webp',name:'Агентство ★★★★',type:'Агентство · 4 звезды',price:75,count:5,color:'#ffb45e',glow:'rgba(255,180,94,.17)',desc:'5 футболистов. Высокий шанс на рейтинг 80+.',meta:'5 КАРТОЧЕК'},
    {id:'legend',image:'assets/packs/legend.webp',name:'Агентство ★★★★★',type:'Агентство · 5 звёзд',price:200,count:6,color:'#ff6f9e',glow:'rgba(255,111,158,.17)',desc:'6 футболистов. Лучшие шансы на элитных игроков.',meta:'6 КАРТОЧЕК'},
    {id:'daily',image:'assets/packs/daily.webp',name:'Ежедневный бесплатный пак',type:'Ежедневный бонус',price:0,count:2,color:'#f6ce58',glow:'rgba(246,206,88,.17)',desc:'2 футболиста. Один бесплатный набор каждые сутки.',meta:'БЕСПЛАТНО · 1 РАЗ В ДЕНЬ'}
  ];
  function ensurePackInventory(club){if(!club.packInventory||typeof club.packInventory!=='object')club.packInventory={};for(const p of ZF_PACK_OPTIONS)club.packInventory[p.id]=Math.max(0,Math.floor(Number(club.packInventory[p.id])||0));return club.packInventory;}
  function renderPacks(club){
    const inventory=ensurePackInventory(club),shop=dailyShop(club),freeReady=club.freePackDay!==shop.day;
    const dailyCards=shop.offers.map(wiki=>{const player=REAL_PLAYERS.find(x=>x.wiki===wiki);if(!player)return '';const claimed=shop.claimed.includes(wiki);const owned=club.players.some(x=>x.wiki===wiki);const price=Math.max(.08,Math.round(marketValue(player.rating)*.06*100)/100);const unavailable=claimed||owned;return `<article class="daily-market-card">${renderPlayerCard({...player,id:null,realClub:player.club},false,false)}<button class="btn ${unavailable?'btn-quiet':'btn-primary'} btn-sm daily-market-buy" data-action="claim-daily-card" data-player-wiki="${esc(wiki)}" ${unavailable||club.coins<price?'disabled':''}>${claimed?'Куплено':owned?'Уже в клубе':`Купить · ${formatMoney(price)}`}</button></article>`;}).join('');
    const inventoryMarkup=ZF_PACK_OPTIONS.filter(p=>inventory[p.id]>0).map(p=>`<article class="pack-inventory-item"><img class="pack-inventory-image" src="${p.image}" alt="${esc(p.name)}" loading="lazy"><div class="pack-inventory-copy"><strong>${p.name}</strong><small>${p.type}</small></div><span class="pill pill-lime">×${inventory[p.id]}</span><div class="inventory-open-controls"><label class="small">Открыть <select class="select-compact" data-inventory-open-qty="${p.id}">${Array.from({length:inventory[p.id]},(_,i)=>i+1).map(n=>`<option value="${n}" ${n===Math.min(5,inventory[p.id])?'selected':''}>${n}</option>`).join('')}</select></label><button class="btn btn-primary btn-sm" data-action="open-inventory-pack" data-pack="${p.id}">Открыть</button></div></article>`).join('');
    return `<div class="section-heading"><div><div class="eyebrow">Pack market</div><h1 class="h1">МАГАЗИН ПАКОВ</h1><p class="page-subtitle">Покупай наборы заранее. Все приобретённые паки хранятся в инвентаре.</p></div><div class="actions"><span class="coin-chip">${formatMoney(club.coins)}</span></div></div>${renderPromoPanel(club)}<section class="card daily-player-shop" style="margin-bottom:16px"><div class="card-header"><div><div class="eyebrow">ЕЖЕДНЕВНЫЙ МАГАЗИН</div><h2 class="h2">КАРТОЧКИ ДЛЯ ПОКУПКИ</h2><p>Каждую из трёх карточек можно купить один раз. Весь ассортимент обновляется ежедневно в 00:00.</p></div><span class="pill pill-lime">Обновление · 00:00</span></div><div class="daily-player-cards player-grid">${dailyCards||'<p class="muted">Все доступные футболисты уже в твоём клубе.</p>'}</div></section><section class="card pack-inventory" style="margin-bottom:16px"><div class="card-header"><div><div class="eyebrow">ТВОИ ПОКУПКИ</div><h2 class="h2">ИНВЕНТАРЬ ПАКОВ</h2><p>Открывай наборы в любое удобное время.</p></div><span class="pill">${Object.values(inventory).reduce((a,b)=>a+b,0)} паков</span></div><div class="pack-inventory-list">${inventoryMarkup||'<p class="muted small">Инвентарь пока пуст. Купленные паки появятся здесь.</p>'}</div></section><section class="card" style="margin-bottom:16px"><div class="card-header"><div><div class="eyebrow">ПАКИ ДЛЯ КОМАНДЫ</div><h2 class="h2">НАБОРЫ КАРТОЧЕК</h2><p>Выбери количество и добавь наборы в инвентарь. Открытие не происходит автоматически.</p></div></div></section><div class="pack-grid">${ZF_PACK_OPTIONS.map(p=>`<article class="pack-card" style="--pack-color:${p.color};--pack-glow:${p.glow}"><div class="pack-art pack-art-image"><img src="${p.image}" alt="${esc(p.name)}" loading="lazy"></div><div class="pack-type">${p.type}</div><h3>${p.name}</h3><p>${p.desc}</p><div class="pack-bottom"><span class="pack-price">${p.id==='daily'?'БЕСПЛАТНО':formatMoney(p.price)}</span><label class="pack-quantity-label">Количество <select class="select-compact pack-quantity" data-pack-quantity="${p.id}" ${p.id==='daily'?'disabled':''}>${[1,2,3,5,10].map(n=>`<option value="${n}">${n}</option>`).join('')}</select></label><button class="btn btn-primary btn-sm pack-purchase-button" type="button" data-action="buy-pack" data-pack="${p.id}" aria-label="${p.id==='daily'?'Получить бесплатный пак':`Купить ${p.name} за ${formatMoney(p.price)}`}" ${p.id==='daily'&&!freeReady?'disabled':(p.id!=='daily'&&club.coins<p.price)?'disabled':''}>${p.id==='daily'?(freeReady?'Забрать бесплатно':'Получен сегодня'):`Купить за ${formatMoney(p.price)}`}</button></div><div class="pack-footnote">${p.meta} · В инвентарь</div></article>`).join('')}</div>`;
  }
  function renderPlayerCard(p,actions=false,clickable=false){
    const activeClub=currentClub();const lineupIndex=p.id&&activeClub?.lineup?activeClub.lineup.indexOf(p.id):-1;const assignedRole=lineupIndex>=0?(FORMATIONS[activeClub.formation]||FORMATIONS['4-3-3'])[lineupIndex]?.role:null;const shownRating=lineupIndex>=0?playerOVRAt(p,assignedRole||p.position,activeClub):(p.id&&activeClub?.captainId===p.id&&activeClub?.lineup?.includes(p.id)?p.rating+1:p.rating);const r=rarityFor(shownRating);const country=playerCountryData(p.country);const displayName=playerDisplayName(p);const displayPositions=playerPositionsLabel(p);const displayClub=playerClubLabel(p);
    const owned=currentClub()?.players?.some(x=>x.id===p.id);const isStarter=owned&&currentClub().lineup.includes(p.id);
    const action=actions&&owned?`<div class="player-card-actions">${isStarter?'<button class="btn btn-quiet btn-sm" disabled>В стартовом составе</button>':`<button class="btn btn-secondary btn-sm" data-action="sell-player" data-player-id="${esc(p.id)}">Продать · ${formatSaleRange(p,false,1.5)}</button>`}</div>`:'';
    return `<article class="player-card" data-portrait-key="${esc(p.wiki||p.name)}" ${p.wiki?`data-wiki="${esc(p.wiki)}"`:''} style="--rarity-color:${r.color};--player-glow:${r.color}22"><div class="player-card-head"><div><div class="player-overall">${shownRating}</div><span class="player-position">${esc(lineupIndex>=0?positionLabel(assignedRole):displayPositions)}</span></div><span class="rarity-badge">${r.name}</span></div><div class="player-portrait"><div class="portrait-circle">${esc(avatarLetters(displayName))}</div><img class="portrait-photo" alt="${esc(displayName)}" loading="lazy" style="display:none"/></div><div class="player-card-body"><strong data-no-translate>${esc(displayName)}</strong><div class="player-meta"><span>${country.flag} ${esc(country.name)}</span></div><div class="player-market-value">${formatMoney(marketValue(p.rating))}</div>${p.realClub||p.club?`<div class="player-meta"><span class="real-club" data-no-translate>${esc(displayClub)}</span></div>`:''}<div class="player-status">${p.injuryMatches>0?`<span class="status-tag injury">🤕 ${p.injuryMatches}</span>`:''}${p.redCardMatches>0?`<span class="status-tag redcard">🟥 ${p.redCardMatches}</span>`:''}${p.yellowBanMatches>0?`<span class="status-tag redcard">⛔ ${p.yellowBanMatches}</span>`:p.yellowCards>0?`<span class="status-tag yellow">🟨 ${p.yellowCards}/5</span>`:''}</div>${action}</div></article>`;
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
    const statuses=[card.injuryMatches>0?`🤕 ${card.injuryType||'Травма'}: ${card.injuryMatches} матч.`:'',card.redCardMatches>0?`🟥 Дисквалификация: ${card.redCardMatches}`:'',card.yellowBanMatches>0?`⛔ Бан за жёлтые: ${card.yellowBanMatches}`:'',card.yellowCards>0?`🟨 Жёлтые: ${card.yellowCards}/5`:''].filter(Boolean).join(' · ');
    return `<div class="modal-backdrop player-card-modal-backdrop" data-action="close-player-modal-backdrop"><section class="modal player-card-modal" role="dialog" aria-modal="true"><div class="modal-head"><div><div class="eyebrow">Карточка футболиста</div><h2 data-no-translate>${esc(displayName)}</h2><p class="muted small" style="margin:6px 0 0">${country.flag} ${esc(country.name)} · ${esc(lineupIndex>=0?positionLabel(assignedRole):displayPositions)}</p></div><button class="icon-btn" data-action="close-player-modal">✕</button></div><div class="player-modal-summary"><div class="player-modal-rating" style="--rarity-color:${rarityColor(card.rating)}">${card.rating}<small>OVR</small></div><div><strong data-no-translate>${esc(playerClubLabel(card))}</strong><small>${formatMoney(marketValue(card.rating))} · ${rarityFor(card.rating).name}</small>${statuses?`<small class="player-modal-status">${statuses}</small>`:''}</div></div><div class="player-modal-actions">${owned&&!isStarter?`<button class="btn btn-danger" data-action="sell-player" data-player-id="${esc(owned.id)}">${buttonText}</button>`:`<button class="btn btn-secondary" disabled>${buttonText}</button>`}</div></section></div>`;
  }
  function refreshEnergy(club){const now=Date.now();const elapsed=Math.floor((now-(club.energyAt||now))/(30*60*1000));if(elapsed>0){club.energy=Math.min(5,(club.energy||0)+elapsed);club.energyAt=(club.energyAt||now)+elapsed*30*60*1000;saveDB();}}
  const SPONSOR_DEALS = window.ZF_DATA.SPONSOR_DEALS;
  function sponsorLogo(o,small=false){return `<span class="sponsor-emblem ${small?'tiny-emblem':''}" style="--emblem-tone:${o.type==='kit'?'#c8ff44':o.type==='title'?'#65b8ff':'#f4b85d'}">${esc(o.mark)}</span>`;}
  const SPONSOR_TIER_ORDER=['Стартовый','Региональный','Национальный','Международный','Элитный','ИМБА'];
  function sponsorTier(o){const r=Number(o.minRating)||0;return r>=92?'ИМБА':r>=88?'Элитный':r>=80?'Международный':r>=70?'Национальный':r>=60?'Региональный':'Стартовый';}
  function sponsorTierDescription(tier){return ({'Стартовый':'Небольшие бренды для начинающего клуба','Региональный':'Первые серьёзные местные контракты','Национальный':'Крупные бренды и стабильные выплаты','Международный':'Сильные партнёры с большими бонусами','Элитный':'Премиальные контракты для топ-команд','ИМБА':'Максимальные выплаты и престижные партнёры'})[tier]||'';}

  const SPONSOR_COPY_I18N={
    'en':{'Стартовый':'Starter','Региональный':'Regional','Национальный':'National','Международный':'International','Элитный':'Elite','ИМБА':'Elite+','Небольшие бренды для начинающего клуба':'Small brands for a developing club','Первые серьёзные местные контракты':'First major local deals','Крупные бренды и стабильные выплаты':'Major brands and reliable payments','Сильные партнёры с большими бонусами':'Strong partners with bigger bonuses','Премиальные контракты для топ-команд':'Premium deals for top teams','Максимальные выплаты и престижные партнёры':'Maximum payouts and prestigious partners','Спонсорские контракты':'Sponsorship contracts','дн.':'days','контрактов':'deals'},
    'uk':{'Стартовый':'Початковий','Региональный':'Регіональний','Национальный':'Національний','Международный':'Міжнародний','Элитный':'Елітний','ИМБА':'Найвищий','Небольшие бренды для начинающего клуба':'Невеликі бренди для клубу-початківця','Первые серьёзные местные контракты':'Перші серйозні місцеві контракти','Крупные бренды и стабильные выплаты':'Великі бренди та стабільні виплати','Сильные партнёры с большими бонусами':'Сильні партнери з більшими бонусами','Премиальные контракты для топ-команд':'Преміальні контракти для топклубів','Максимальные выплаты и престижные партнёры':'Найбільші виплати та престижні партнери','Спонсорские контракты':'Спонсорські контракти','дн.':'дн.','контрактов':'контрактів'},
    'de':{'Стартовый':'Einsteiger','Региональный':'Regional','Национальный':'National','Международный':'International','Элитный':'Elite','ИМБА':'Spitzenklasse','Небольшие бренды для начинающего клуба':'Kleine Marken für aufstrebende Vereine','Первые серьёзные местные контракты':'Erste große regionale Verträge','Крупные бренды и стабильные выплаты':'Große Marken und sichere Zahlungen','Сильные партнёры с большими бонусами':'Starke Partner mit hohen Boni','Премиальные контракты для топ-команд':'Premiumverträge für Spitzenmannschaften','Максимальные выплаты и престижные партнёры':'Maximale Zahlungen und prestigeträchtige Partner','Спонсорские контракты':'Sponsoringverträge','дн.':'Tage','контрактов':'Verträge'},
    'fr':{'Стартовый':'Débutant','Региональный':'Régional','Национальный':'National','Международный':'International','Элитный':'Élite','ИМБА':'Prestige','Небольшие бренды для начинающего клуба':'Petites marques pour un club en développement','Первые серьёзные местные контракты':'Premiers grands contrats régionaux','Крупные бренды и стабильные выплаты':'Grandes marques et paiements réguliers','Сильные партнёры с большими бонусами':'Partenaires solides et bonus élevés','Премиальные контракты для топ-команд':'Contrats premium pour les meilleurs clubs','Максимальные выплаты и престижные партнёры':'Paiements maximum et partenaires prestigieux','Спонсорские контракты':'Contrats de sponsoring','дн.':'jours','контрактов':'contrats'},
    'es':{'Стартовый':'Inicial','Региональный':'Regional','Национальный':'Nacional','Международный':'Internacional','Элитный':'Élite','ИМБА':'Premium','Небольшие бренды для начинающего клуба':'Marcas pequeñas para clubes en desarrollo','Первые серьёзные местные контракты':'Primeros grandes acuerdos locales','Крупные бренды и стабильные выплаты':'Grandes marcas y pagos estables','Сильные партнёры с большими бонусами':'Socios fuertes con mejores bonificaciones','Премиальные контракты для топ-команд':'Acuerdos prémium para clubes de élite','Максимальные выплаты и престижные партнёры':'Pagos máximos y socios prestigiosos','Спонсорские контракты':'Contratos de patrocinio','дн.':'días','контрактов':'contratos'},
    'ja':{'Стартовый':'ビギナー','Региональный':'地域','Национальный':'国内','Международный':'国際','Элитный':'エリート','ИМБА':'最高峰','Небольшие бренды для начинающего клуба':'成長中のクラブ向けの小規模ブランド','Первые серьёзные местные контракты':'最初の本格的な地域契約','Крупные бренды и стабильные выплаты':'大手ブランドと安定した報酬','Сильные партнёры с большими бонусами':'高額ボーナスを提供する有力パートナー','Премиальные контракты для топ-команд':'強豪クラブ向けプレミアム契約','Максимальные выплаты и престижные партнёры':'最高額の報酬と一流パートナー','Спонсорские контракты':'スポンサー契約','дн.':'日','контрактов':'件'},
    'zh':{'Стартовый':'入门','Региональный':'地区','Национальный':'全国','Международный':'国际','Элитный':'精英','ИМБА':'顶级','Небольшие бренды для начинающего клуба':'适合发展中俱乐部的小型品牌','Первые серьёзные местные контракты':'首批重要地区合同','Крупные бренды и стабильные выплаты':'大型品牌与稳定收入','Сильные партнёры с большими бонусами':'提供高额奖励的强力合作伙伴','Премиальные контракты для топ-команд':'顶级球队的高级合同','Максимальные выплаты и престижные партнёры':'最高收益与知名合作伙伴','Спонсорские контракты':'赞助合同','дн.':'天','контрактов':'份'},
    'kk':{'Стартовый':'Бастапқы','Региональный':'Аймақтық','Национальный':'Ұлттық','Международный':'Халықаралық','Элитный':'Элиталық','ИМБА':'Жоғары деңгей','Небольшие бренды для начинающего клуба':'Жаңадан дамып келе жатқан клубқа арналған шағын брендтер','Первые серьёзные местные контракты':'Алғашқы ірі жергілікті келісімдер','Крупные бренды и стабильные выплаты':'Ірі брендтер мен тұрақты төлемдер','Сильные партнёры с большими бонусами':'Үлкен бонус ұсынатын мықты серіктестер','Премиальные контракты для топ-команд':'Үздік клубтарға арналған премиум келісімдер','Максимальные выплаты и престижные партнёры':'Ең жоғары төлемдер мен беделді серіктестер','Спонсорские контракты':'Демеушілік келісімдер','дн.':'күн','контрактов':'келісім'},
    'pl':{'Стартовый':'Początkowy','Региональный':'Regionalny','Национальный':'Krajowy','Международный':'Międzynarodowy','Элитный':'Elitarny','ИМБА':'Najwyższy','Небольшие бренды для начинающего клуба':'Małe marki dla rozwijającego się klubu','Первые серьёзные местные контракты':'Pierwsze poważne umowy lokalne','Крупные бренды и стабильные выплаты':'Duże marki i stabilne wypłaty','Сильные партнёры с большими бонусами':'Silni partnerzy z wysokimi premiami','Премиальные контракты для топ-команд':'Umowy premium dla najlepszych klubów','Максимальные выплаты и престижные партнёры':'Maksymalne wypłaty i prestiżowi partnerzy','Спонсорские контракты':'Umowy sponsorskie','дн.':'dni','контрактов':'umów'}
  };
  const SPONSOR_DESCRIPTION_TRANSLATIONS = {
    en:{
      'Молодой бренд экипировки':'Young sportswear brand',
      'Спортивная одежда':'Sportswear',
      'Футбольная экипировка':'Football equipment',
      'Бутсы и аксессуары':'Boots and accessories',
      'Профессиональная форма':'Professional kits',
      'Титульный партнёр клуба':'Club title sponsor',
      'Энергетические напитки':'Energy drinks',
      'Финансовый партнёр':'Financial partner',
      'Технологический партнёр':'Technology partner',
      'Главный партнёр сезона':'Season main partner',
      'Напитки для болельщиков':'Drinks for supporters',
      'Игровая студия':'Game studio',
      'Питание команды':'Team catering',
      'Цифровые сервисы':'Digital services',
      'Звук и медиа':'Audio and media',
      'Аналитика и тренировочные технологии':'Analytics and training technology',
      'Международный партнёр клуба':'International club partner',
      'Экипировка для молодых клубов':'Equipment for young clubs',
      'Региональный производитель формы':'Regional kit manufacturer',
      'Технологичная экипировка':'Advanced sports equipment',
      'Международный экипировочный партнёр':'International kit partner',
      'Премиальная форма для топ-клубов':'Premium kits for top clubs',
      'Первый титульный партнёр':'First title sponsor',
      'Финансовая компания региона':'Regional finance company',
      'Энергетический партнёр':'Energy partner',
      'Международный титульный партнёр':'International title sponsor',
      'Партнёр клубов мирового уровня':'Partner of world-class clubs',
      'Питание и напитки для болельщиков':'Food and drinks for supporters',
      'Региональное спортивное радио':'Regional sports radio',
      'Партнёр трансляций и контента':'Broadcast and content partner',
      'Логистика и поездки команды':'Team logistics and travel',
      'Аналитические решения для элитных клубов':'Analytics solutions for elite clubs'
    },
    uk:{
      'Молодой бренд экипировки':'Молодий бренд екіпірування',
      'Спортивная одежда':'Спортивний одяг',
      'Футбольная экипировка':'Футбольне екіпірування',
      'Бутсы и аксессуары':'Бутси та аксесуари',
      'Профессиональная форма':'Професійна форма',
      'Титульный партнёр клуба':'Титульний партнер клубу',
      'Энергетические напитки':'Енергетичні напої',
      'Финансовый партнёр':'Фінансовий партнер',
      'Технологический партнёр':'Технологічний партнер',
      'Главный партнёр сезона':'Головний партнер сезону',
      'Напитки для болельщиков':'Напої для вболівальників',
      'Игровая студия':'Ігрова студія',
      'Питание команды':'Харчування команди',
      'Цифровые сервисы':'Цифрові сервіси',
      'Звук и медиа':'Звук і медіа',
      'Аналитика и тренировочные технологии':'Аналітика та тренувальні технології',
      'Международный партнёр клуба':'Міжнародний партнер клубу',
      'Экипировка для молодых клубов':'Екіпірування для молодих клубів',
      'Региональный производитель формы':'Регіональний виробник форми',
      'Технологичная экипировка':'Технологічне екіпірування',
      'Международный экипировочный партнёр':'Міжнародний партнер з екіпірування',
      'Премиальная форма для топ-клубов':'Преміальна форма для топклубів',
      'Первый титульный партнёр':'Перший титульний партнер',
      'Финансовая компания региона':'Фінансова компанія регіону',
      'Энергетический партнёр':'Енергетичний партнер',
      'Международный титульный партнёр':'Міжнародний титульний партнер',
      'Партнёр клубов мирового уровня':'Партнер клубів світового рівня',
      'Питание и напитки для болельщиков':'Харчування та напої для вболівальників',
      'Региональное спортивное радио':'Регіональне спортивне радіо',
      'Партнёр трансляций и контента':'Партнер трансляцій і контенту',
      'Логистика и поездки команды':'Логістика та поїздки команди',
      'Аналитические решения для элитных клубов':'Аналітичні рішення для елітних клубів'
    },
    de:{
      'Молодой бренд экипировки':'Junge Sportbekleidungsmarke',
      'Спортивная одежда':'Sportbekleidung',
      'Футбольная экипировка':'Fußballausrüstung',
      'Бутсы и аксессуары':'Fußballschuhe und Zubehör',
      'Профессиональная форма':'Professionelle Trikots',
      'Титульный партнёр клуба':'Hauptsponsor des Vereins',
      'Энергетические напитки':'Energy-Drinks',
      'Финансовый партнёр':'Finanzpartner',
      'Технологический партнёр':'Technologiepartner',
      'Главный партнёр сезона':'Hauptpartner der Saison',
      'Напитки для болельщиков':'Getränke für Fans',
      'Игровая студия':'Gaming-Studio',
      'Питание команды':'Verpflegung des Teams',
      'Цифровые сервисы':'Digitale Dienste',
      'Звук и медиа':'Audio und Medien',
      'Аналитика и тренировочные технологии':'Analyse- und Trainingstechnologie',
      'Международный партнёр клуба':'Internationaler Vereinspartner',
      'Экипировка для молодых клубов':'Ausrüstung für junge Vereine',
      'Региональный производитель формы':'Regionaler Trikothersteller',
      'Технологичная экипировка':'Moderne Sportausrüstung',
      'Международный экипировочный партнёр':'Internationaler Ausrüstungspartner',
      'Премиальная форма для топ-клубов':'Premiumtrikots für Spitzenvereine',
      'Первый титульный партнёр':'Erster Hauptsponsor',
      'Финансовая компания региона':'Regionales Finanzunternehmen',
      'Энергетический партнёр':'Energiepartner',
      'Международный титульный партнёр':'Internationaler Hauptsponsor',
      'Партнёр клубов мирового уровня':'Partner von Weltklassevereinen',
      'Питание и напитки для болельщиков':'Essen und Getränke für Fans',
      'Региональное спортивное радио':'Regionales Sportradio',
      'Партнёр трансляций и контента':'Übertragungs- und Contentpartner',
      'Логистика и поездки команды':'Teamlogistik und Reisen',
      'Аналитические решения для элитных клубов':'Analyselösungen für Elitevereine'
    },
    fr:{
      'Молодой бренд экипировки':'Jeune marque d’équipement sportif',
      'Спортивная одежда':'Vêtements de sport',
      'Футбольная экипировка':'Équipement de football',
      'Бутсы и аксессуары':'Chaussures et accessoires',
      'Профессиональная форма':'Tenues professionnelles',
      'Титульный партнёр клуба':'Sponsor principal du club',
      'Энергетические напитки':'Boissons énergisantes',
      'Финансовый партнёр':'Partenaire financier',
      'Технологический партнёр':'Partenaire technologique',
      'Главный партнёр сезона':'Partenaire principal de la saison',
      'Напитки для болельщиков':'Boissons pour les supporters',
      'Игровая студия':'Studio de jeux vidéo',
      'Питание команды':'Restauration de l’équipe',
      'Цифровые сервисы':'Services numériques',
      'Звук и медиа':'Audio et médias',
      'Аналитика и тренировочные технологии':'Analyse et technologie d’entraînement',
      'Международный партнёр клуба':'Partenaire international du club',
      'Экипировка для молодых клубов':'Équipement pour jeunes clubs',
      'Региональный производитель формы':'Fabricant régional de tenues',
      'Технологичная экипировка':'Équipement sportif innovant',
      'Международный экипировочный партнёр':'Partenaire international équipementier',
      'Премиальная форма для топ-клубов':'Tenues premium pour les grands clubs',
      'Первый титульный партнёр':'Premier sponsor principal',
      'Финансовая компания региона':'Société financière régionale',
      'Энергетический партнёр':'Partenaire énergétique',
      'Международный титульный партнёр':'Sponsor principal international',
      'Партнёр клубов мирового уровня':'Partenaire des clubs de classe mondiale',
      'Питание и напитки для болельщиков':'Repas et boissons pour les supporters',
      'Региональное спортивное радио':'Radio sportive régionale',
      'Партнёр трансляций и контента':'Partenaire de diffusion et de contenu',
      'Логистика и поездки команды':'Logistique et déplacements de l’équipe',
      'Аналитические решения для элитных клубов':'Solutions analytiques pour clubs d’élite'
    },
    es:{
      'Молодой бренд экипировки':'Marca joven de equipamiento',
      'Спортивная одежда':'Ropa deportiva',
      'Футбольная экипировка':'Equipamiento de fútbol',
      'Бутсы и аксессуары':'Botas y accesorios',
      'Профессиональная форма':'Equipaciones profesionales',
      'Титульный партнёр клуба':'Patrocinador principal del club',
      'Энергетические напитки':'Bebidas energéticas',
      'Финансовый партнёр':'Socio financiero',
      'Технологический партнёр':'Socio tecnológico',
      'Главный партнёр сезона':'Socio principal de la temporada',
      'Напитки для болельщиков':'Bebidas para aficionados',
      'Игровая студия':'Estudio de videojuegos',
      'Питание команды':'Alimentación del equipo',
      'Цифровые сервисы':'Servicios digitales',
      'Звук и медиа':'Audio y medios',
      'Аналитика и тренировочные технологии':'Analítica y tecnología de entrenamiento',
      'Международный партнёр клуба':'Socio internacional del club',
      'Экипировка для молодых клубов':'Equipamiento para clubes jóvenes',
      'Региональный производитель формы':'Fabricante regional de equipaciones',
      'Технологичная экипировка':'Equipamiento deportivo avanzado',
      'Международный экипировочный партнёр':'Socio internacional de equipamiento',
      'Премиальная форма для топ-клубов':'Equipaciones prémium para clubes grandes',
      'Первый титульный партнёр':'Primer patrocinador principal',
      'Финансовая компания региона':'Empresa financiera regional',
      'Энергетический партнёр':'Socio energético',
      'Международный титульный партнёр':'Patrocinador principal internacional',
      'Партнёр клубов мирового уровня':'Socio de clubes de talla mundial',
      'Питание и напитки для болельщиков':'Comida y bebida para aficionados',
      'Региональное спортивное радио':'Radio deportiva regional',
      'Партнёр трансляций и контента':'Socio de retransmisiones y contenido',
      'Логистика и поездки команды':'Logística y viajes del equipo',
      'Аналитические решения для элитных клубов':'Soluciones analíticas para clubes de élite'
    },
    pl:{
      'Молодой бренд экипировки':'Młoda marka sprzętu sportowego',
      'Спортивная одежда':'Odzież sportowa',
      'Футбольная экипировка':'Sprzęt piłkarski',
      'Бутсы и аксессуары':'Buty i akcesoria',
      'Профессиональная форма':'Profesjonalne stroje',
      'Титульный партнёр клуба':'Główny sponsor klubu',
      'Энергетические напитки':'Napoje energetyczne',
      'Финансовый партнёр':'Partner finansowy',
      'Технологический партнёр':'Partner technologiczny',
      'Главный партнёр сезона':'Główny partner sezonu',
      'Напитки для болельщиков':'Napoje dla kibiców',
      'Игровая студия':'Studio gier',
      'Питание команды':'Wyżywienie drużyny',
      'Цифровые сервисы':'Usługi cyfrowe',
      'Звук и медиа':'Dźwięk i media',
      'Аналитика и тренировочные технологии':'Analityka i technologie treningowe',
      'Международный партнёр клуба':'Międzynarodowy partner klubu',
      'Экипировка для молодых клубов':'Sprzęt dla młodych klubów',
      'Региональный производитель формы':'Regionalny producent strojów',
      'Технологичная экипировка':'Zaawansowany sprzęt sportowy',
      'Международный экипировочный партнёр':'Międzynarodowy partner sprzętowy',
      'Премиальная форма для топ-клубов':'Stroje premium dla czołowych klubów',
      'Первый титульный партнёр':'Pierwszy sponsor główny',
      'Финансовая компания региона':'Regionalna firma finansowa',
      'Энергетический партнёр':'Partner energetyczny',
      'Международный титульный партнёр':'Międzynarodowy sponsor główny',
      'Партнёр клубов мирового уровня':'Partner klubów światowej klasy',
      'Питание и напитки для болельщиков':'Jedzenie i napoje dla kibiców',
      'Региональное спортивное радио':'Regionalne radio sportowe',
      'Партнёр трансляций и контента':'Partner transmisji i treści',
      'Логистика и поездки команды':'Logistyka i podróże drużyny',
      'Аналитические решения для элитных клубов':'Rozwiązania analityczne dla elitarnych klubów'
    },
    kk:{
      'Молодой бренд экипировки':'Жас спорттық жабдық бренді',
      'Спортивная одежда':'Спорттық киім',
      'Футбольная экипировка':'Футбол жабдықтары',
      'Бутсы и аксессуары':'Бутсы мен аксессуарлар',
      'Профессиональная форма':'Кәсіби форма',
      'Титульный партнёр клуба':'Клубтың титулдық демеушісі',
      'Энергетические напитки':'Энергетикалық сусындар',
      'Финансовый партнёр':'Қаржылық серіктес',
      'Технологический партнёр':'Технологиялық серіктес',
      'Главный партнёр сезона':'Маусымның басты серіктесі',
      'Напитки для болельщиков':'Жанкүйерлерге арналған сусындар',
      'Игровая студия':'Ойын студиясы',
      'Питание команды':'Команданы тамақтандыру',
      'Цифровые сервисы':'Цифрлық қызметтер',
      'Звук и медиа':'Дыбыс және медиа',
      'Аналитика и тренировочные технологии':'Талдау және жаттығу технологиялары',
      'Международный партнёр клуба':'Клубтың халықаралық серіктесі',
      'Экипировка для молодых клубов':'Жас клубтарға арналған жабдық',
      'Региональный производитель формы':'Аймақтық форма өндірушісі',
      'Технологичная экипировка':'Заманауи спорт жабдықтары',
      'Международный экипировочный партнёр':'Халықаралық жабдық серіктесі',
      'Премиальная форма для топ-клубов':'Үздік клубтарға арналған премиум форма',
      'Первый титульный партнёр':'Алғашқы титулдық демеуші',
      'Финансовая компания региона':'Аймақтық қаржы компаниясы',
      'Энергетический партнёр':'Энергетикалық серіктес',
      'Международный титульный партнёр':'Халықаралық титулдық демеуші',
      'Партнёр клубов мирового уровня':'Әлемдік деңгейдегі клубтардың серіктесі',
      'Питание и напитки для болельщиков':'Жанкүйерлерге арналған тағам мен сусындар',
      'Региональное спортивное радио':'Аймақтық спорт радиосы',
      'Партнёр трансляций и контента':'Трансляция және контент серіктесі',
      'Логистика и поездки команды':'Команданың логистикасы мен сапарлары',
      'Аналитические решения для элитных клубов':'Элиталық клубтарға арналған аналитика'
    },
    ja:{
      'Молодой бренд экипировки':'新興スポーツ用品ブランド',
      'Спортивная одежда':'スポーツウェア',
      'Футбольная экипировка':'サッカー用品',
      'Бутсы и аксессуары':'スパイクとアクセサリー',
      'Профессиональная форма':'プロ仕様のユニフォーム',
      'Титульный партнёр клуба':'クラブのタイトルスポンサー',
      'Энергетические напитки':'エナジードリンク',
      'Финансовый партнёр':'金融パートナー',
      'Технологический партнёр':'テクノロジーパートナー',
      'Главный партнёр сезона':'シーズンのメインパートナー',
      'Напитки для болельщиков':'サポーター向けドリンク',
      'Игровая студия':'ゲームスタジオ',
      'Питание команды':'チームの食事サービス',
      'Цифровые сервисы':'デジタルサービス',
      'Звук и медиа':'音響とメディア',
      'Аналитика и тренировочные технологии':'分析・トレーニング技術',
      'Международный партнёр клуба':'クラブの国際パートナー',
      'Экипировка для молодых клубов':'若いクラブ向け用品',
      'Региональный производитель формы':'地域ユニフォームメーカー',
      'Технологичная экипировка':'高機能スポーツ用品',
      'Международный экипировочный партнёр':'国際用具パートナー',
      'Премиальная форма для топ-клубов':'強豪クラブ向けプレミアムユニフォーム',
      'Первый титульный партнёр':'最初のタイトルスポンサー',
      'Финансовая компания региона':'地域金融会社',
      'Энергетический партнёр':'エネルギーパートナー',
      'Международный титульный партнёр':'国際タイトルスポンサー',
      'Партнёр клубов мирового уровня':'世界トップクラスのクラブのパートナー',
      'Питание и напитки для болельщиков':'サポーター向け食事と飲み物',
      'Региональное спортивное радио':'地域スポーツラジオ',
      'Партнёр трансляций и контента':'放送・コンテンツパートナー',
      'Логистика и поездки команды':'チームの物流と遠征',
      'Аналитические решения для элитных клубов':'エリートクラブ向け分析ソリューション'
    },
    zh:{
      'Молодой бренд экипировки':'新兴运动装备品牌',
      'Спортивная одежда':'运动服饰',
      'Футбольная экипировка':'足球装备',
      'Бутсы и аксессуары':'球鞋和配件',
      'Профессиональная форма':'专业球衣',
      'Титульный партнёр клуба':'俱乐部冠名赞助商',
      'Энергетические напитки':'能量饮料',
      'Финансовый партнёр':'金融合作伙伴',
      'Технологический партнёр':'技术合作伙伴',
      'Главный партнёр сезона':'赛季主要合作伙伴',
      'Напитки для болельщиков':'球迷饮料',
      'Игровая студия':'游戏工作室',
      'Питание команды':'球队餐饮',
      'Цифровые сервисы':'数字服务',
      'Звук и медиа':'音频与媒体',
      'Аналитика и тренировочные технологии':'数据分析与训练技术',
      'Международный партнёр клуба':'俱乐部国际合作伙伴',
      'Экипировка для молодых клубов':'年轻俱乐部装备',
      'Региональный производитель формы':'地区球衣制造商',
      'Технологичная экипировка':'先进运动装备',
      'Международный экипировочный партнёр':'国际装备合作伙伴',
      'Премиальная форма для топ-клубов':'顶级俱乐部高级球衣',
      'Первый титульный партнёр':'首位冠名赞助商',
      'Финансовая компания региона':'地区金融公司',
      'Энергетический партнёр':'能源合作伙伴',
      'Международный титульный партнёр':'国际冠名赞助商',
      'Партнёр клубов мирового уровня':'世界级俱乐部合作伙伴',
      'Питание и напитки для болельщиков':'球迷食品与饮料',
      'Региональное спортивное радио':'地区体育广播',
      'Партнёр трансляций и контента':'转播与内容合作伙伴',
      'Логистика и поездки команды':'球队物流与出行',
      'Аналитические решения для элитных клубов':'精英俱乐部分析方案'
    },
  };
  Object.entries(SPONSOR_DESCRIPTION_TRANSLATIONS).forEach(([lang,dict])=>Object.assign(UI_TRANSLATIONS[lang]||(UI_TRANSLATIONS[lang]={}),dict));

  const SPONSOR_UI_TRANSLATIONS = {
    en:{
      'СПОНСОР ФОРМЫ':'KIT SPONSOR',
      'ОСНОВНОЙ СПОНСОР':'MAIN SPONSOR',
      'ДОПОЛНИТЕЛЬНЫЙ СПОНСОР':'ADDITIONAL SPONSOR',
      'Спонсорские контракты':'Sponsorship deals',
      'СПОНСОРЫ':'SPONSORS',
      'Можно одновременно заключить три независимых контракта на 30 реальных дней.':'You can hold three separate sponsorship deals for 30 real days.',
      '3 рекламных места':'3 sponsorship slots',
      'СПОНСОР НЕ ВЫБРАН':'NO SPONSOR SELECTED',
      'Выбери партнёра для этого рекламного места.':'Choose a partner for this slot.',
      'Контракт действует до окончания':'Contract cannot be changed until it expires',
      'Контракт истёк':'Contract expired',
      'ЗАКЛЮЧЁН':'SIGNED',
      'СВОБОДНО':'AVAILABLE',
      'Контракты и продление доступны только в настройке команды.':'Player contracts and renewals are available only in Team Settings.'
    },
    uk:{
      'СПОНСОР ФОРМЫ':'СПОНСОР ФОРМИ',
      'ОСНОВНОЙ СПОНСОР':'ГОЛОВНИЙ СПОНСОР',
      'ДОПОЛНИТЕЛЬНЫЙ СПОНСОР':'ДОДАТКОВИЙ СПОНСОР',
      'Спонсорские контракты':'Спонсорські контракти',
      'СПОНСОРЫ':'СПОНСОРИ',
      'Можно одновременно заключить три независимых контракта на 30 реальных дней.':'Можна одночасно укласти три окремі контракти на 30 реальних днів.',
      '3 рекламных места':'3 спонсорські місця',
      'СПОНСОР НЕ ВЫБРАН':'СПОНСОРА НЕ ОБРАНО',
      'Выбери партнёра для этого рекламного места.':'Обери партнера для цього місця.',
      'Контракт действует до окончания':'Контракт не можна змінити до завершення строку',
      'Контракт истёк':'Контракт завершився',
      'ЗАКЛЮЧЁН':'УКЛАДЕНО',
      'СВОБОДНО':'ВІЛЬНО',
      'Контракты и продление доступны только в настройке команды.':'Контракти гравців і продовження доступні лише в налаштуваннях команди.'
    },
    de:{
      'СПОНСОР ФОРМЫ':'TRIKOTSPONSOR',
      'ОСНОВНОЙ СПОНСОР':'HAUPTSPONSOR',
      'ДОПОЛНИТЕЛЬНЫЙ СПОНСОР':'ZUSATZSPONSOR',
      'Спонсорские контракты':'Sponsoringverträge',
      'СПОНСОРЫ':'SPONSOREN',
      'Можно одновременно заключить три независимых контракта на 30 реальных дней.':'Drei unabhängige Sponsorenverträge für jeweils 30 echte Tage sind möglich.',
      '3 рекламных места':'3 Sponsorenplätze',
      'СПОНСОР НЕ ВЫБРАН':'KEIN SPONSOR AUSGEWÄHLT',
      'Выбери партнёра для этого рекламного места.':'Wähle einen Partner für diesen Platz.',
      'Контракт действует до окончания':'Vertrag kann erst nach Ablauf geändert werden',
      'Контракт истёк':'Vertrag abgelaufen',
      'ЗАКЛЮЧЁН':'UNTERZEICHNET',
      'СВОБОДНО':'FREI',
      'Контракты и продление доступны только в настройке команды.':'Spielerverträge und Verlängerungen sind nur in den Teameinstellungen verfügbar.'
    },
    fr:{
      'СПОНСОР ФОРМЫ':'SPONSOR MAILLOT',
      'ОСНОВНОЙ СПОНСОР':'SPONSOR PRINCIPAL',
      'ДОПОЛНИТЕЛЬНЫЙ СПОНСОР':'SPONSOR SECONDAIRE',
      'Спонсорские контракты':'Contrats de sponsoring',
      'СПОНСОРЫ':'SPONSORS',
      'Можно одновременно заключить три независимых контракта на 30 реальных дней.':'Trois contrats indépendants de 30 jours réels peuvent être actifs en même temps.',
      '3 рекламных места':'3 emplacements sponsors',
      'СПОНСОР НЕ ВЫБРАН':'AUCUN SPONSOR CHOISI',
      'Выбери партнёра для этого рекламного места.':'Choisis un partenaire pour cet emplacement.',
      'Контракт действует до окончания':'Le contrat ne peut pas être modifié avant son expiration',
      'Контракт истёк':'Contrat expiré',
      'ЗАКЛЮЧЁН':'SIGNÉ',
      'СВОБОДНО':'LIBRE',
      'Контракты и продление доступны только в настройке команды.':'Les contrats des joueurs et leur renouvellement sont disponibles uniquement dans les paramètres de l’équipe.'
    },
    es:{
      'СПОНСОР ФОРМЫ':'PATROCINADOR DE EQUIPACIÓN',
      'ОСНОВНОЙ СПОНСОР':'PATROCINADOR PRINCIPAL',
      'ДОПОЛНИТЕЛЬНЫЙ СПОНСОР':'PATROCINADOR ADICIONAL',
      'Спонсорские контракты':'Contratos de patrocinio',
      'СПОНСОРЫ':'PATROCINADORES',
      'Можно одновременно заключить три независимых контракта на 30 реальных дней.':'Puedes tener tres acuerdos independientes de patrocinio durante 30 días reales.',
      '3 рекламных места':'3 espacios de patrocinio',
      'СПОНСОР НЕ ВЫБРАН':'NINGÚN PATROCINADOR',
      'Выбери партнёра для этого рекламного места.':'Elige un socio para este espacio.',
      'Контракт действует до окончания':'No se puede cambiar el contrato antes de que venza',
      'Контракт истёк':'Contrato vencido',
      'ЗАКЛЮЧЁН':'FIRMADO',
      'СВОБОДНО':'DISPONIBLE',
      'Контракты и продление доступны только в настройке команды.':'Los contratos de jugadores y sus renovaciones solo están disponibles en Ajustes del equipo.'
    },
    pl:{
      'СПОНСОР ФОРМЫ':'SPONSOR STROJÓW',
      'ОСНОВНОЙ СПОНСОР':'GŁÓWNY SPONSOR',
      'ДОПОЛНИТЕЛЬНЫЙ СПОНСОР':'DODATKOWY SPONSOR',
      'Спонсорские контракты':'Umowy sponsorskie',
      'СПОНСОРЫ':'SPONSORZY',
      'Можно одновременно заключить три независимых контракта на 30 реальных дней.':'Możesz mieć trzy niezależne umowy sponsorskie na 30 rzeczywistych dni.',
      '3 рекламных места':'3 miejsca sponsorskie',
      'СПОНСОР НЕ ВЫБРАН':'NIE WYBRANO SPONSORA',
      'Выбери партнёра для этого рекламного места.':'Wybierz partnera dla tego miejsca.',
      'Контракт действует до окончания':'Umowy nie można zmienić przed wygaśnięciem',
      'Контракт истёк':'Umowa wygasła',
      'ЗАКЛЮЧЁН':'PODPISANO',
      'СВОБОДНО':'WOLNE',
      'Контракты и продление доступны только в настройке команды.':'Kontrakty zawodników i ich przedłużanie są dostępne tylko w ustawieniach drużyny.'
    },
    kk:{
      'СПОНСОР ФОРМЫ':'ФОРМА ДЕМЕУШІСІ',
      'ОСНОВНОЙ СПОНСОР':'БАСТЫ ДЕМЕУШІ',
      'ДОПОЛНИТЕЛЬНЫЙ СПОНСОР':'ҚОСЫМША ДЕМЕУШІ',
      'Спонсорские контракты':'Демеушілік келісімдер',
      'СПОНСОРЫ':'ДЕМЕУШІЛЕР',
      'Можно одновременно заключить три независимых контракта на 30 реальных дней.':'30 нақты күнге үш тәуелсіз демеушілік келісім жасауға болады.',
      '3 рекламных места':'3 демеушілік орны',
      'СПОНСОР НЕ ВЫБРАН':'ДЕМЕУШІ ТАҢДАЛМАҒАН',
      'Выбери партнёра для этого рекламного места.':'Осы орынға серіктес таңдаңыз.',
      'Контракт действует до окончания':'Келісім мерзімі біткенше оны өзгертуге болмайды',
      'Контракт истёк':'Келісім мерзімі аяқталды',
      'ЗАКЛЮЧЁН':'ЖАСАЛДЫ',
      'СВОБОДНО':'БОС',
      'Контракты и продление доступны только в настройке команды.':'Ойыншылар келісімдері мен ұзарту тек команда баптауларында қолжетімді.'
    },
    ja:{
      'СПОНСОР ФОРМЫ':'ユニフォームスポンサー',
      'ОСНОВНОЙ СПОНСОР':'メインスポンサー',
      'ДОПОЛНИТЕЛЬНЫЙ СПОНСОР':'追加スポンサー',
      'Спонсорские контракты':'スポンサー契約',
      'СПОНСОРЫ':'スポンサー',
      'Можно одновременно заключить три независимых контракта на 30 реальных дней.':'30日間の独立したスポンサー契約を3件同時に結べます。',
      '3 рекламных места':'スポンサー枠 3件',
      'СПОНСОР НЕ ВЫБРАН':'スポンサー未選択',
      'Выбери партнёра для этого рекламного места.':'この枠のパートナーを選択してください。',
      'Контракт действует до окончания':'契約終了前は変更できません',
      'Контракт истёк':'契約終了',
      'ЗАКЛЮЧЁН':'契約中',
      'СВОБОДНО':'空き',
      'Контракты и продление доступны только в настройке команды.':'選手契約と更新はチーム設定でのみ利用できます。'
    },
    zh:{
      'СПОНСОР ФОРМЫ':'球衣赞助商',
      'ОСНОВНОЙ СПОНСОР':'主要赞助商',
      'ДОПОЛНИТЕЛЬНЫЙ СПОНСОР':'附加赞助商',
      'Спонсорские контракты':'赞助合同',
      'СПОНСОРЫ':'赞助商',
      'Можно одновременно заключить три независимых контракта на 30 реальных дней.':'可同时签订三份独立赞助合同，每份有效期为30个真实天。',
      '3 рекламных места':'3个赞助席位',
      'СПОНСОР НЕ ВЫБРАН':'未选择赞助商',
      'Выбери партнёра для этого рекламного места.':'为此席位选择合作伙伴。',
      'Контракт действует до окончания':'合同到期前不可更换',
      'Контракт истёк':'合同已到期',
      'ЗАКЛЮЧЁН':'已签约',
      'СВОБОДНО':'空闲',
      'Контракты и продление доступны только в настройке команды.':'球员合同及续约仅可在球队设置中管理。'
    },
  };
  Object.entries(SPONSOR_UI_TRANSLATIONS).forEach(([lang,dict])=>Object.assign(UI_TRANSLATIONS[lang]||(UI_TRANSLATIONS[lang]={}),dict));
  function sponsorCopy(value){const lang=db.language||'ru';return SPONSOR_COPY_I18N[lang]?.[value]||translateUIText(value);}
  function sponsorRequirement(o){const lang=db.language||'ru',rating=Number(o.minRating)||0,wins=Number(o.minWins)||0;if(!rating&&!wins)return translateUIText('Без требований');const labels={en:['Team','OVR','and','wins'],uk:['Команда','OVR','і','перемог'],de:['Team','OVR','und','Siege'],fr:['Équipe','GEN','et','victoires'],es:['Equipo','GRL','y','victorias'],ja:['チーム','OVR','勝利','勝'],zh:['球队','OVR','和','胜'],kk:['Команда','OVR','және','жеңіс'],pl:['Zespół','OVR','i','zwycięstw']};const a=labels[lang]||labels.en;if(lang==='ja'||lang==='zh')return `${a[0]} ${rating?`${rating}+ ${a[1]}`:''}${wins?` ${a[2]} ${wins}${a[3]}`:''}`.trim();return `${a[0]}${rating?` ${rating}+ ${a[1]}`:''}${wins?` ${rating?` ${a[2]}`:''} ${wins} ${a[3]}`:''}`.trim();}

  function renderSponsorDeal(o,active,type,club){
    const signed=active?.id===o.id,locked=(teamRating(club)<(o.minRating||0)||(club.stats.wins||0)<(o.minWins||0)),occupied=!!active&&!signed;
    return `<article class="sponsor-card sponsor-card-tier-${SPONSOR_TIER_ORDER.indexOf(sponsorTier(o))}"><div class="sponsor-logo">${sponsorLogo(o)}</div><h3>${esc(o.name)}</h3><p class="muted small">${esc(translateUIText(o.desc))}</p><span class="sponsor-tier">${translateUIText('Уровень')}: ${sponsorCopy(sponsorTier(o))}</span><div class="statline"><span>${translateUIText('За матч')}</span><b>€${o.match} тыс.</b></div><div class="statline"><span>${translateUIText('За победу')}</span><b>€${o.win} тыс.</b></div><div class="statline"><span>${translateUIText('Подписание')}</span><b>€${o.sign} тыс.</b></div><div class="sponsor-requirement">${translateUIText('Требования')}: ${sponsorRequirement(o)}</div>${signed?`<span class="pill pill-lime">${translateUIText('Активен')}</span>`:`<button class="btn btn-secondary btn-full" data-action="sign-sponsor" data-sponsor="${o.id}" data-sponsor-type="${type}" ${(locked||occupied)?'disabled':''}>${occupied?translateUIText('Контракт действует до окончания'):locked?translateUIText('Пока недоступен'):translateUIText('Подписать на 30 дней')}</button>`}</article>`;
  }
  function renderSponsorTiers(type,active,club){
    const deals=SPONSOR_DEALS.filter(o=>o.type===type).slice().sort((a,b)=>((a.match+a.win+a.sign)-(b.match+b.win+b.sign))||((a.minRating||0)-(b.minRating||0))||a.name.localeCompare(b.name));
    return SPONSOR_TIER_ORDER.map(tier=>{const items=deals.filter(o=>sponsorTier(o)===tier);if(!items.length)return '';const min=items.reduce((v,o)=>Math.min(v,o.minRating||0),99);const max=items.reduce((v,o)=>Math.max(v,o.minRating||0),0);return `<section class="sponsor-tier-section sponsor-tier-level-${SPONSOR_TIER_ORDER.indexOf(tier)}"><div class="sponsor-tier-heading"><div><span class="sponsor-tier-kicker">${translateUIText('УРОВЕНЬ')} ${SPONSOR_TIER_ORDER.indexOf(tier)+1}</span><h3>${tier==='ИМБА'?'🔥 ':''}${sponsorCopy(tier)}</h3><p>${sponsorCopy(sponsorTierDescription(tier))}</p></div><span class="pill">${items.length} ${sponsorCopy('контрактов')}</span></div><div class="sponsor-grid">${items.map(o=>renderSponsorDeal(o,active,type,club)).join('')}</div></section>`;}).join('');}

const MILESTONE_MISSIONS = [
  ...[1,3,5,10,20].map(n=>({id:`matches_${n}`,icon:'⚽',name:`Сыграть ${n} матчей`,desc:`Проведи ${n} матчей за клуб.`,metric:'matches',target:n,reward:.4+n*.05})),
  ...[1,3,5,10,20].map(n=>({id:`wins_${n}`,icon:'🏆',name:`Одержать ${n} побед`,desc:`Выиграй ${n} официальных матчей.`,metric:'wins',target:n,reward:.5+n*.06})),
  ...[5,10,25,50,100].map(n=>({id:`goals_${n}`,icon:'🥅',name:`Забить ${n} голов`,desc:`Забей ${n} голов в матчах.`,metric:'goalsFor',target:n,reward:.4+n*.015})),
  ...[1,3,5,10,20].map(n=>({id:`packs_${n}`,icon:'🎴',name:`Открыть ${n} паков`,desc:`Открой ${n} паков в агентстве.`,metric:'packsOpened',target:n,reward:.4+n*.04})),
  ...[16,20,24,28,32].map(n=>({id:`players_${n}`,icon:'👥',name:`Собрать ${n} игроков`,desc:`Добавь в коллекцию ${n} футболистов.`,metric:'players',target:n,reward:.4+n*.02})),
  ...[60,65,70,75,80].map(n=>({id:`rating_${n}`,icon:'📈',name:`Достичь рейтинга ${n}`,desc:`Подними средний рейтинг основы до ${n}.`,metric:'teamRating',target:n,reward:.5+(n-60)*.04}))
];
const DAILY_QUEST_POOL=[
  {id:'daily_match',name:'Матч дня',desc:'Сыграй 1 матч.',metric:'matches',target:1,reward:.6},
  {id:'daily_win',name:'Победа дня',desc:'Одержи 1 победу.',metric:'wins',target:1,reward:.8},
  {id:'daily_goals',name:'Голевая серия',desc:'Забей 3 гола.',metric:'goalsFor',target:3,reward:.7},
  {id:'daily_pack',name:'Открой агентство',desc:'Открой 1 пак.',metric:'packsOpened',target:1,reward:.6},
  {id:'daily_two',name:'Двойной матчдей',desc:'Сыграй 2 матча.',metric:'matches',target:2,reward:.9}
];
const MONTHLY_QUEST_POOL=[
  {id:'monthly_matches',name:'Календарь клуба',desc:'Сыграй 12 матчей за месяц.',metric:'matches',target:12,reward:3.5},
  {id:'monthly_wins',name:'Месяц побед',desc:'Одержи 6 побед за месяц.',metric:'wins',target:6,reward:4},
  {id:'monthly_goals',name:'Атакующая мощь',desc:'Забей 30 голов за месяц.',metric:'goalsFor',target:30,reward:3.8},
  {id:'monthly_packs',name:'Селекция месяца',desc:'Открой 8 паков за месяц.',metric:'packsOpened',target:8,reward:3.2},
  {id:'monthly_form',name:'Уверенный ход',desc:'Сыграй 8 матчей за месяц.',metric:'matches',target:8,reward:2.8}
];
function missionMetric(club,metric){if(metric==='players')return (club.players||[]).length;if(metric==='teamRating')return teamRating(club);return Math.max(0,Number(club.stats?.[metric])||0);}
function missionSeed(str){let h=2166136261;for(const ch of String(str))h=Math.imul(h^ch.charCodeAt(0),16777619);return h>>>0;}
function chooseCycleMissions(club,pool,key){let seed=missionSeed(`${club.id}:${key}`),arr=pool.slice();for(let i=arr.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[arr[i],arr[j]]=[arr[j],arr[i]];}return arr.slice(0,2).map(q=>({...q,baseline:missionMetric(club,q.metric),claimed:false}));}
function sponsorMissionProfile(club){
  const slots=club?.sponsorSlots||{};const active=['kit','title','extra'].map(type=>{const slot=slots[type];return slot&&slot.until>Date.now()?SPONSOR_DEALS.find(d=>d.id===slot.id):null;}).filter(Boolean);
  const ids=active.map(d=>d.id).sort();const types=new Set(active.map(d=>d.type));
  const dailyIds=new Set(),monthlyIds=new Set();
  if(types.has('kit')){['daily_match','daily_win','daily_two'].forEach(x=>dailyIds.add(x));['monthly_matches','monthly_wins','monthly_form'].forEach(x=>monthlyIds.add(x));}
  if(types.has('title')){['daily_win','daily_goals','daily_match'].forEach(x=>dailyIds.add(x));['monthly_wins','monthly_goals','monthly_form'].forEach(x=>monthlyIds.add(x));}
  if(types.has('extra')){['daily_pack','daily_two','daily_goals'].forEach(x=>dailyIds.add(x));['monthly_packs','monthly_matches','monthly_goals'].forEach(x=>monthlyIds.add(x));}
  return {key:ids.join('|')||'no-sponsor',daily:active.length?DAILY_QUEST_POOL.filter(q=>dailyIds.has(q.id)):DAILY_QUEST_POOL,monthly:active.length?MONTHLY_QUEST_POOL.filter(q=>monthlyIds.has(q.id)):MONTHLY_QUEST_POOL};
}
function ensureMissionCycles(club){
  const now=new Date(),day=currentDayKey(),month=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  let changed=false;const profile=sponsorMissionProfile(club);
  if(!club.missionClaims||typeof club.missionClaims!=='object'){club.missionClaims={};changed=true;}
  if(club.missionSponsorKey!==profile.key){club.missionSponsorKey=profile.key;club.dailyMissionKey='';club.monthlyMissionKey='';changed=true;}
  if(club.dailyMissionKey!==day||!Array.isArray(club.dailyMissions)||club.dailyMissions.length!==2){club.dailyMissionKey=day;club.dailyMissions=chooseCycleMissions(club,profile.daily,`${day}:${profile.key}`);changed=true;}
  if(club.monthlyMissionKey!==month||!Array.isArray(club.monthlyMissions)||club.monthlyMissions.length!==2){club.monthlyMissionKey=month;club.monthlyMissions=chooseCycleMissions(club,profile.monthly,`${month}:${profile.key}`);changed=true;}
  if(changed)saveDB();
  return {daily:club.dailyMissions,monthly:club.monthlyMissions};
}
function levelRequirement(level){return 100+(level-1)*35;}
function progressionState(club){
  const total=Math.max(0,Number(club.progression?.totalXp)||0);let remaining=total,level=1;
  while(level<30&&remaining>=levelRequirement(level)){remaining-=levelRequirement(level);level++;}
  const need=level>=30?0:levelRequirement(level);
  return {level,total,xp:level>=30?need:remaining,need,percent:need?Math.min(100,remaining/need*100):100};
}
function addMatchProgression(club,m,won,draw){
  club.progression=club.progression&&typeof club.progression==='object'?club.progression:{totalXp:0};
  const before=progressionState(club).level;
  const xp=55+(won?45:draw?22:0)+(Number(m.score?.[0])||0)*12+(Number(m.goodChoices)||0)*4;
  club.progression.totalXp=(Number(club.progression.totalXp)||0)+xp;
  const after=progressionState(club).level,ups=Math.max(0,after.level-before);
  m.xpEarned=xp;m.levelUps=ups;
  if(ups)club.coins=(Number(club.coins)||0)+ups*.04;
}
function renderMissionCard(club,mission,type){
  const progress=type==='milestone'?missionMetric(club,mission.metric):Math.max(0,missionMetric(club,mission.metric)-Number(mission.baseline||0));
  const done=progress>=mission.target,claimed=type==='milestone'?!!club.missionClaims[mission.id]:!!mission.claimed;
  const target=mission.target,percent=Math.max(0,Math.min(100,progress/target*100));
  const icon=mission.icon||({daily_match:'⚽',daily_win:'🏆',daily_goals:'🥅',daily_pack:'🎴',daily_two:'⚽⚽',monthly_matches:'📅',monthly_wins:'🏆',monthly_goals:'🥅',monthly_packs:'🎴',monthly_form:'📈'}[mission.id])||'🎯';
  return `<article class="mission-card ${claimed?'mission-claimed':done?'mission-done':''}"><div class="mission-icon">${icon}</div><div class="mission-copy"><strong>${translateUIText(mission.name||'Задание клуба')}</strong><small>${translateUIText(mission.desc||'Выполни условие задания.')}</small><div class="mission-progress"><span style="width:${percent}%"></span></div><small class="muted">${Math.min(progress,target)} / ${target} · ${formatMoney(Number(mission.reward)||0)}</small></div>${claimed?`<span class="pill">${translateUIText('Получено')}</span>`:done?`<button class="btn btn-primary btn-sm" data-action="claim-mission" data-mission-type="${type}" data-mission-id="${mission.id}">${translateUIText('Забрать')}</button>`:`<span class="mission-percent">${Math.floor(percent)}%</span>`}</article>`;
}
function renderProgressionAndMissions(club){
  const p=progressionState(club);
  return `<section class="card progression-card"><div class="progression-top"><div><div class="eyebrow">${translateUIText('УРОВЕНЬ КЛУБА')}</div><h2 class="h2">${translateUIText('Уровень')} ${p.level} / 30</h2><p>${translateUIText('Опыт за сыгранные матчи, победы и удачные решения.')}</p></div><div class="progression-level">${p.level}<small>LVL</small></div></div><div class="progression-bar"><span style="width:${p.percent}%"></span></div><div class="progression-footer"><span>${p.level>=30?translateUIText('Максимальный уровень'):`${p.xp} / ${p.need} XP`}</span><span>${p.total} XP · ${translateUIText('До уровня')} ${Math.min(30,p.level+1)}</span></div></section>
  <section class="card milestone-section"><div class="card-header"><div><div class="eyebrow">${translateUIText('Долгосрочные цели')}</div><h2 class="h2">${translateUIText('30 ЗАДАНИЙ КЛУБА')}</h2><p>${translateUIText('Выполняй цели и забирай награды за прогресс клуба.')}</p></div><span class="pill pill-lime">30</span></div><div class="mission-grid">${MILESTONE_MISSIONS.map(q=>renderMissionCard(club,q,'milestone')).join('')}</div></section>`;
}

  function sponsorRewardMultiplier(club){
    const slots=club?.sponsorSlots||{};
    const activeDeals=['kit','title','extra'].map(type=>{const slot=slots[type];return slot&&slot.until>Date.now()?SPONSOR_DEALS.find(d=>d.id===slot.id):null;}).filter(Boolean);
    return activeDeals.length?1+Math.min(.9,activeDeals.reduce((sum,d)=>sum+(Number(d.minRating)||0)/180+(Number(d.minWins)||0)/160,0)):1;
  }
  function renderSponsors(club){
    const slots=club.sponsorSlots||{kit:null,title:null,extra:null};
    const labels={kit:'СПОНСОР ФОРМЫ',title:'ОСНОВНОЙ СПОНСОР',extra:'ДОПОЛНИТЕЛЬНЫЙ СПОНСОР'};
    const types=['kit','title','extra'];
    const cycles=ensureMissionCycles(club);
    const activeDeals=types.map(type=>{const slot=slots[type];return slot&&slot.until>Date.now()?SPONSOR_DEALS.find(d=>d.id===slot.id):null;}).filter(Boolean);
    const sponsorMultiplier=sponsorRewardMultiplier(club);
    const sponsorTasks=activeDeals.length?`<section class="card sponsor-missions" style="margin-bottom:18px"><div class="card-header"><div><div class="eyebrow">ЗАДАНИЯ И НАГРАДЫ</div><h2 class="h2">ЗАДАНИЯ СПОНСОРОВ</h2><p>Список заданий доступен при активном контракте. Уровень и условия подписанных партнёров повышают выплаты.</p></div><span class="pill pill-lime">×${sponsorMultiplier.toFixed(2)}</span></div><p class="muted small">Партнёры: ${activeDeals.map(d=>esc(d.name)).join(' · ')}</p><div class="mission-section-grid"><section><div class="eyebrow">${translateUIText('Ежедневные задания')}</div><div class="mission-list">${cycles.daily.map(q=>renderMissionCard(club,{...q,reward:Math.round(q.reward*sponsorMultiplier*100)/100},'daily')).join('')}</div></section><section><div class="eyebrow">${translateUIText('Ежемесячные задания')}</div><div class="mission-list">${cycles.monthly.map(q=>renderMissionCard(club,{...q,reward:Math.round(q.reward*sponsorMultiplier*100)/100},'monthly')).join('')}</div></section></div></section>`:`<section class="card sponsor-missions" style="margin-bottom:18px"><div class="card-header"><div><div class="eyebrow">ЗАДАНИЯ И НАГРАДЫ</div><h2 class="h2">ЗАДАНИЯ СПОНСОРОВ</h2><p>Сначала подпиши хотя бы одного партнёра. Задания и выплаты будут зависеть от выбранного бренда и его уровня.</p></div><span class="pill">Нет контракта</span></div></section>`;
    const sections=types.map(type=>{
      const active=slots[type]&&slots[type].until>Date.now()?slots[type]:null;
      const deal=active?SPONSOR_DEALS.find(x=>x.id===active.id):null;
      const title=deal?deal.name:translateUIText('СПОНСОР НЕ ВЫБРАН');
      const detail=deal?`${translateUIText('Осталось')} ${Math.max(0,Math.ceil((active.until-Date.now())/86400000))} ${translateUIText('дн.')} · ${translateUIText('За матч')} €${deal.match} тыс. · ${translateUIText('Победа')} +€${deal.win} тыс.`:translateUIText('Выбери партнёра для этого рекламного места.');
      const expired=slots[type]&&!active;
      return `<section class="card sponsor-slot-section" style="margin-bottom:18px"><div class="card-header"><div><div class="eyebrow">${translateUIText(labels[type])}</div><h2 class="h2">${esc(title)}</h2><p>${detail}${expired?' · '+translateUIText('Контракт истёк'):''}</p></div><span class="pill ${deal?'pill-lime':''}">${deal?translateUIText('ЗАКЛЮЧЁН'):translateUIText('СВОБОДНО')}</span></div>${renderSponsorTiers(type,active,club)}</section>`;
    }).join('');
    return `<div class="section-heading"><div><div class="eyebrow">${translateUIText('Спонсорские контракты')}</div><h1 class="h1">${translateUIText('СПОНСОРЫ')}</h1><p class="page-subtitle">${translateUIText('Можно одновременно заключить три независимых контракта на 30 реальных дней.')}</p></div><span class="pill pill-lime">${translateUIText('3 рекламных места')}</span></div>${sponsorTasks}${sections}`;
  }

  function renderEditor(club){
    const c=countryData(club.country);
    return `<div class="section-heading"><div><div class="eyebrow">Профиль клуба</div><h1 class="h1">РЕДАКТОР КЛУБА</h1><p class="page-subtitle">Измени название, страну и эмблему своего клуба.</p></div><span class="pill pill-lime">${c.flag} ${c.name}</span></div><div class="editor-layout"><section class="card"><div class="card-header"><div><div class="eyebrow">Профиль клуба</div><h2 class="h2">ДАННЫЕ КЛУБА</h2></div></div><form id="editClubForm" class="form-grid"><div class="field"><label for="editClubName">Название клуба</label><input id="editClubName" name="clubName" value="${esc(club.name)}" maxlength="26" required /></div><div class="field"><label for="editCountry">Страна и флаг</label><select id="editCountry" name="country">${Object.entries(COUNTRY).map(([code,v])=>`<option value="${code}" ${club.country===code?'selected':''}>${v.flag} ${v.name}</option>`).join('')}</select><small id="editCountryBonus" class="muted small">Бонус страны: ${c.bonus}</small></div><div class="field"><label>Конструктор эмблемы</label>${renderEditCrestBuilder(club.logo)}</div><button class="btn btn-primary btn-full" type="submit">Сохранить изменения ✓</button></form></section><div><section class="card" style="margin-bottom:15px"><div class="card-header"><div><div class="eyebrow">Предпросмотр клуба</div><h2 class="h2">ВНЕШНИЙ ВИД КЛУБА</h2><p>Так эмблема и название будут выглядеть в меню и матчах.</p></div></div><div class="club-identity-preview"><span class="club-crest ${crestShape(club.logo)}" id="editorPreviewCrest" style="--crest-color:${esc(club.logo.color)}">${crestContent(club.logo,.7)}</span><div class="identity-text"><strong id="editorPreviewName">${esc(c.flag)} ${esc(club.name)}</strong><small id="editorPreviewCountry">${esc(c.name)} · ${teamRating(club)} OVR</small></div></div></section><section class="card"><div class="card-header"><div><div class="eyebrow">Карточка клуба</div><h2 class="h2">ПАСПОРТ КЛУБА</h2></div></div><div class="recent-list"><div class="recent-row"><div class="recent-icon">🏅</div><div><strong>Эмблема клуба</strong><small>Индивидуальный знак команды</small></div><div class="right">${esc(club.logo.symbol||'★')}</div></div><div class="recent-row"><div class="recent-icon">🌍</div><div><strong>Страна</strong><small>Стартовый пак и флаг клуба</small></div><div class="right">${c.flag} ${esc(c.name)}</div></div></div></section></div></div>`;
  }

  function renderTrophies(club){
    const unlocked=Object.keys(club.trophyUnlocks||{}).length;
    return `<div class="section-heading"><div><div class="eyebrow">Зал славы клуба</div><h1 class="h1">ЗАЛ ТРОФЕЕВ</h1><p class="page-subtitle">Каждый матч — новая возможность вписать имя клуба в историю.</p></div><span class="pill pill-lime">🏆 ${unlocked} / ${TROPHIES.length}</span></div><div class="card" style="margin-bottom:17px;background:linear-gradient(100deg,rgba(247,200,90,.08),transparent 70%),var(--panel)"><div class="card-header" style="margin-bottom:0"><div><div class="eyebrow">Зал славы</div><h2 class="h2">ТВОЯ КОЛЛЕКЦИЯ ДОСТИЖЕНИЙ</h2><p>Продолжай играть, собирать игроков и улучшать клуб, чтобы разблокировать новые награды.</p></div><div style="font:900 33px 'Barlow Condensed',sans-serif;color:var(--gold)">${Math.round(unlocked/TROPHIES.length*100)}%</div></div><div class="progress" style="height:8px;margin-top:17px"><span style="width:${unlocked/TROPHIES.length*100}%;background:var(--gold)"></span></div></div>${renderProgressionAndMissions(club)}<div class="trophy-grid">${TROPHIES.map(t=>{const earned=!!club.trophyUnlocks[t.id];return `<article class="trophy-card ${earned?'':'locked'}"><div class="trophy-medal">${earned?t.icon:'🔒'}</div><h3>${t.name}</h3><p>${t.desc}</p><div class="trophy-status">${earned?`✓ Получен · +${formatMoney(Number(t.reward)||.18)}`:`Цель: ${t.goal} · награда ${formatMoney(Number(t.reward)||.18)}`}</div>${earned?`<div class="tiny muted" style="margin-top:8px">${new Date(club.trophyUnlocks[t.id]).toLocaleDateString(({ru:'ru-RU',uk:'uk-UA',en:'en-GB',de:'de-DE',fr:'fr-FR',es:'es-ES',ja:'ja-JP',zh:'zh-CN',kk:'kk-KZ',pl:'pl-PL'})[db.language||'ru']||'ru-RU')}</div>`:''}</article>`;}).join('')}</div>`;
  }
  function energyWidget(club){refreshEnergy(club);return `<div class="energy-panel"><div><strong>⚡ Матчи команды</strong><div class="energy-pips">${Array.from({length:5},(_,i)=>`<span class="energy-pip ${i<(club.energy||0)?'on':''}"></span>`).join('')}</div></div><div class="energy-copy"><b id="energy-count-label">${club.energy||0}/5 матчей</b><br>+1 матч каждые 30 минут<br><span class="energy-recovery-countdown" data-energy-recovery>${energyCountdownText(club)}</span></div><div class="energy-actions"><button class="btn btn-secondary btn-sm" data-action="refill-energy" ${(club.energy||0)>=5?'disabled':''}>Купить +1 матч · €0.10M</button><button class="btn btn-quiet btn-sm" data-action="watch-ad" ${(club.energy||0)>=5?'disabled':''}>▶ Реклама · +1 матч</button></div></div>`;}
  const ONLINE_PENALTY_ZONES=[
    {id:'left-high',label:'Верхний левый',glyph:'↖'},{id:'left-low',label:'Нижний левый',glyph:'↙'},
    {id:'center-high',label:'Верх по центру',glyph:'↑'},{id:'center-low',label:'Низ по центру',glyph:'↓'},
    {id:'right-high',label:'Верхний правый',glyph:'↗'},{id:'right-low',label:'Нижний правый',glyph:'↘'}
  ];
  function createOnlineMatchEvents(){
    const standard=[
      {minute:8,zone:'ЦЕНТРАЛЬНАЯ ЗОНА',title:'Комбинация у штрафной',description:'Полузащитник нашёл пространство между линиями. Атакующий выбирает продолжение, защитник — способ остановить атаку.',attackChoices:[['safe-pass','Короткий пас'],['through','Пас за спину'],['dribble','Дриблинг'],['shot','Удар']],defenseChoices:[['press','Прессинг'],['block','Низкий блок'],['intercept','Перехват'],['tackle','Отбор']]},
      {minute:17,zone:'ПРАВЫЙ ФЛАНГ',title:'Свободная зона на фланге',description:'Вингер получил пространство у боковой линии. Решение атакующего и ответ защитника определят развитие эпизода.',attackChoices:[['cross','Навес'],['cutback','Прострел'],['dribble','Обводка'],['switch-play','Перевод фланга']],defenseChoices:[['double','Удвоить опеку'],['block','Закрыть зону'],['tackle','Отбор'],['intercept','Перехват']]},
      {minute:26,zone:'ПОСЛЕ ПЕРЕХВАТА',title:'Контратака',description:'Мяч перехвачен, впереди свободное пространство. Одна команда начинает атаку, другая пытается сорвать быстрый выход.',attackChoices:[['fast-break','Быстрый выход'],['through','Вертикальный пас'],['dribble','Продвижение с мячом'],['longshot','Дальний удар']],defenseChoices:[['press','Контрпрессинг'],['tackle','Тактический фол'],['offside','Офсайдная ловушка'],['block','Сдержать атаку']]},
      {minute:35,zone:'КРАЙ ШТРАФНОЙ',title:'Момент для решающего паса',description:'Нападающий открывается между защитниками. Выбери способ завершения или правильное оборонительное действие.',attackChoices:[['shot','Удар'],['cutback','Прострел назад'],['through','Пас вразрез'],['hold','Подержать мяч']],defenseChoices:[['block','Блокировать удар'],['double','Удвоить опеку'],['intercept','Перекрыть пас'],['tackle','Вступить в отбор']]},
      {minute:45,kind:'penalty',zone:'11 МЕТРОВ',title:'ПЕНАЛЬТИ!',description:'Бьющий выбирает один из шести участков ворот. Вратарь одновременно выбирает, куда прыгнуть.'},
      {minute:54,zone:'ЛЕВЫЙ ФЛАНГ',title:'Подача в штрафную',description:'Игрок готовит доставку мяча в штрафную. Защита должна решить, какую зону закрыть.',attackChoices:[['cross','Навес'],['cutback','Прострел'],['dribble','Обводка'],['switch-play','Перевод фланга']],defenseChoices:[['double','Удвоить опеку'],['block','Закрыть ближнюю зону'],['clear','Выбить мяч'],['intercept','Перехват']]},
      {minute:63,zone:'ВТОРОЙ ТЕМП',title:'Подбор у дуги штрафной',description:'Защита отбила первую волну, но атакующая команда сохранила мяч. Важно не дать сопернику пробить.',attackChoices:[['shot','Удар с подбора'],['safe-pass','Розыгрыш'],['dribble','Обострить дриблинг'],['through','Вертикальная передача']],defenseChoices:[['block','Закрыть удар'],['press','Выйти в прессинг'],['tackle','Отбор'],['clear','Вынос']]},
      {minute:72,zone:'ПОЛУФЛАНГ',title:'Перегруз центра',description:'Несколько игроков стягивают оборону к мячу. Можно рискнуть передачей или сохранить владение.',attackChoices:[['through','Пас вразрез'],['one-two','Стенка'],['dribble','Обводка'],['shot','Удар']],defenseChoices:[['intercept','Перехват'],['double','Удвоить опеку'],['block','Компактный блок'],['tackle','Отбор']]},
      {minute:81,zone:'ПЕРЕД ШТРАФНОЙ',title:'Опасный стандарт',description:'Игрок готовится исполнить стандарт. Атака выбирает подачу или прямой удар, защита организует стенку и опеку.',attackChoices:[['shot','Прямой удар'],['cross','Навес'],['cutback','Розыгрыш низом'],['hold','Разыграть коротко']],defenseChoices:[['block','Плотная стенка'],['double','Персональная опека'],['clear','Игра на вынос'],['intercept','Перекрыть передачу']]},
      {minute:89,zone:'ПОСЛЕДНЯЯ АТАКА',title:'Последний шанс',description:'Финальный эпизод матча. Одна точная комбинация или грамотная защита решит исход встречи.',attackChoices:[['shot','Решающий удар'],['through','Пас за спину'],['fast-break','Рывок вперёд'],['safe-pass','Подготовить атаку']],defenseChoices:[['block','Защитить ворота'],['tackle','Отобрать мяч'],['intercept','Перехватить пас'],['clear','Выбить мяч']]}
    ];
    return standard.map(event=>event.kind==='penalty'?{...event,attackChoices:ONLINE_PENALTY_ZONES.map(z=>z.id),defenseChoices:ONLINE_PENALTY_ZONES.map(z=>z.id)}:{...event,kind:'open_play',attackChoices:event.attackChoices.map(x=>Array.isArray(x)?x[0]:x),defenseChoices:event.defenseChoices.map(x=>Array.isArray(x)?x[0]:x)});
  }
  function onlineChoiceLabel(id){
    const common={shot:'Удар',longshot:'Дальний удар',dribble:'Дриблинг',through:'Пас за спину','fast-break':'Быстрая атака',cross:'Навес',cutback:'Прострел',hold:'Сохранить мяч','safe-pass':'Короткий пас','switch-play':'Перевод фланга','one-two':'Стенка',press:'Прессинг',block:'Низкий блок',intercept:'Перехват',tackle:'Отбор',double:'Удвоить опеку',offside:'Офсайдная ловушка',clear:'Вынос'};
    const zone=ONLINE_PENALTY_ZONES.find(z=>z.id===id);return zone?`${zone.glyph} ${zone.label}`:(common[id]||id);
  }
  function onlineRoomIsQuick(room=activeOnlineRoom){return room?.game_state?.mode==='quick_match';}
  async function openQuickMatchRoom(roomId){
    const {data,error}=await ZF_SUPABASE.from('zf_multiplayer_rooms').select('*').eq('id',roomId).single();
    if(error)throw error;
    clearMatchTimers();view='match';matchState={stage:'online',online:true};startOnlineRoomSync(data);
    await prepareQuickMatchRoom(data);render();toast('Соперник найден! Матч начинается.');
  }
  function launchBotFallback(){
    if(matchmakingPoll){clearInterval(matchmakingPoll);matchmakingPoll=null;}
    if(matchState?.timer)clearTimeout(matchState.timer);
    const club=currentClub();if(!club)return;
    const base=BOT_CLUBS[rand(0,BOT_CLUBS.length-1)];
    const userR=teamRating(club),targetBotRating=clamp(userR+rand(-8,8),50,95);
    const botPlayers=makeBotRoster(targetBotRating),opponentRating=rosterTeamRating(botPlayers,'4-3-3');
    const token='match-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
    matchState={stage:'found',matchToken:token,agreementDeadline:Date.now()+60000,opponent:{name:base.name,symbol:base.symbol,country:base.country,color:pick(['#f18b65','#76b8ff','#d3d5d0','#e6adff','#f6cf56']),rating:opponentRating,players:botPlayers},score:[0,0],log:[]};
    matchState.agreementTimer=setTimeout(()=>{if(matchState.stage==='found'&&matchState.matchToken===token){clearMatchTimers();matchState={stage:'idle'};render();toast('Время на принятие матча истекло.','error');}},60000);
    render();toast('Соперник не найден за 30 секунд. Подобран бот.');
  }
  async function pollQuickMatch(){
    if(matchState.stage!=='searching'||!ZF_SUPABASE||matchmakingPollBusy)return;
    matchmakingPollBusy=true;
    try{
      const {data,error}=await ZF_SUPABASE.rpc('zf_matchmaking_status');if(error)throw error;
      if(matchState.stage==='searching'&&data?.status==='matched'&&data.room_id){if(matchmakingPoll){clearInterval(matchmakingPoll);matchmakingPoll=null;}if(matchState.timer)clearTimeout(matchState.timer);await openQuickMatchRoom(data.room_id);}
    }catch(error){console.warn('Matchmaking poll error:',error);}
    finally{matchmakingPollBusy=false;}
  }
  async function submitOnlineMatchChoice(choice){
    const room=activeOnlineRoom;if(!room?.id||!onlineRoomIsQuick(room)||onlineActionBusy)return;
    const idx=Number(room.game_state?.event_index)||0,events=room.game_state?.events||[],event=events[idx];if(!event)return;
    const host=zfAuthUser?.id===room.host_user_id,attackerRole=idx%2===0?'host':'guest';
    const role=((attackerRole==='host'&&host)||(attackerRole==='guest'&&!host))?'attack':'defend';
    if(role==='attack'&&!event.attackChoices.includes(choice))throw new Error('Недопустимый выбор атаки.');
    if(role==='defend'&&!event.defenseChoices.includes(choice))throw new Error('Недопустимый выбор защиты.');
    onlineActionBusy=true;
    try{
      const {data,error}=await ZF_SUPABASE.rpc('zf_submit_live_match_action',{p_room_id:room.id,p_expected_event:idx,p_role:role,p_choice:choice});
      if(error)throw error;
      const updated=Array.isArray(data)?data[0]:data;if(updated?.id)activeOnlineRoom=updated;
      await prepareQuickMatchRoom(activeOnlineRoom);render();
    }finally{onlineActionBusy=false;}
  }
  async function leaveQuickMatchAndSearch(){
    const room=activeOnlineRoom;
    if(room?.id&&onlineRoomIsQuick(room)){try{await ZF_SUPABASE.rpc('zf_leave_room',{p_room_id:room.id});}catch(error){console.warn('Could not leave previous quick match:',error);}}
    stopOnlineRoomSync();activeOnlineRoom=null;try{localStorage.removeItem('zfActiveOnlineRoomId');}catch(_){}
    matchState={stage:'idle'};startSearch();
  }
  function renderOnlineMatch(club){
    const room=activeOnlineRoom,state=room?.game_state||{},events=state.events||[],idx=Number(state.event_index)||0;
    const host=room?.host_user_id===zfAuthUser?.id,isHost=host;
    const own=host?(room.host_club||{}):(room.guest_club||{}),opponent=host?(room.guest_club||{}):(room.host_club||{});
    const score=state.score||{host:0,guest:0},ownScore=Number(host?score.host:score.guest)||0,oppScore=Number(host?score.guest:score.host)||0;
    const ownName=own.name||'Твой клуб',oppName=opponent.name||'Соперник';
    const scoreMarkup=`<div class="match-scoreboard"><div class="match-team"><div class="club-crest" style="--crest-color:${esc(own.logo?.color||'#c8ff44')}">${esc(own.logo?.symbol||'★')}</div><strong>${esc(ownName)}</strong><span class="pill" style="margin-top:7px">${Number(own.rating)||0} OVR · Ты</span></div><div class="match-center"><div class="match-minute">${Math.min(10,idx)}/10</div><div class="match-score">${ownScore} : ${oppScore}</div><div class="match-status">${room.status==='finished'?'ФИНАЛЬНЫЙ СВИСТОК':'ОНЛАЙН · LIVE'}</div></div><div class="match-team"><div class="club-crest" style="--crest-color:${esc(opponent.logo?.color||'#87918a')}">${esc(opponent.logo?.symbol||'★')}</div><strong>${esc(oppName)}</strong><span class="pill" style="margin-top:7px">${Number(opponent.rating)||0} OVR</span></div></div>`;
    if(room.status==='finished'||idx>=events.length){
      const log=(state.log||[]).map(entry=>`<div class="log-row"><span class="log-minute">${esc(entry.minute||'—')}′</span><span>${esc(entry.title||'Эпизод')} · ${entry.goal?'⚽ ГОЛ':'Без гола'} · ${esc(entry.attack_choice||'')} / ${esc(entry.defense_choice||'')}</span></div>`).join('');
      return `<div class="section-heading"><div><div class="eyebrow">Онлайн-матч · 10 эпизодов</div><h1 class="h1">ФИНАЛЬНЫЙ СВИСТОК</h1><p class="page-subtitle">Все решения и итоговый счёт синхронизированы между игроками.</p></div><span class="pill pill-lime">Завершён</span></div><div class="match-shell">${scoreMarkup}<section class="card" style="padding:25px;text-align:center"><h2 class="h2">${ownScore>oppScore?'ПОБЕДА!':ownScore===oppScore?'НИЧЬЯ':'ПОРАЖЕНИЕ'}</h2><div class="result-stamp">${ownScore} : ${oppScore}</div><p class="muted small">События матча: ${events.length}. Все десять эпизодов завершены.</p><div class="match-log" style="text-align:left">${log}</div><div class="settings-actions" style="justify-content:center;margin-top:18px"><button class="btn btn-primary" data-action="online-match-again">🔎 Найти нового соперника</button><button class="btn btn-secondary" data-action="online-match-menu">В меню</button></div></section></div>`;
    }
    if(!events.length)return `<div class="section-heading"><div><div class="eyebrow">Онлайн-матч</div><h1 class="h1">ГОТОВИМ ПОЛЕ</h1><p class="page-subtitle">Соперник найден. Загружаем общие игровые события…</p></div><span class="pill pill-lime">Синхронизация</span></div><div class="match-shell">${scoreMarkup}<section class="card" style="padding:28px;text-align:center"><div class="search-visual"><span class="search-ball">⚽</span></div><h2 class="h2">ОЖИДАЕМ ЗАПУСКА МАТЧА</h2><p class="muted small">Первый подключившийся игрок подготавливает десять общих эпизодов.</p></section></div>`;
    const event=events[idx],attackerRole=idx%2===0?'host':'guest',role=((attackerRole==='host'&&isHost)||(attackerRole==='guest'&&!isHost))?'attack':'defend';
    const choices=state.choices||{},submitted=!!choices[role],otherSubmitted=!!choices[role==='attack'?'defend':'attack'];
    const labels=role==='attack'?event.attackChoices:event.defenseChoices;
    const penalty=event.kind==='penalty';
    const buttons=labels.map((id,i)=>{
      const zone=penalty?ONLINE_PENALTY_ZONES.find(z=>z.id===id):null;
      return `<button class="zf-online-choice ${penalty?'zf-penalty-choice':''}" data-action="online-match-choice" data-choice="${esc(id)}" ${submitted||onlineActionBusy?'disabled':''}><span class="zf-online-choice-icon">${zone?zone.glyph:['⚽','↗','✦','🛡️'][i%4]}</span><strong>${esc(zone?zone.label:onlineChoiceLabel(id))}</strong></button>`;
    }).join('');
    const result=state.last_result&&state.last_result.event===idx-1?`<div class="zf-online-last-result">${state.last_result.goal?'⚽ ГОЛ!':'🧤 Атака остановлена'}</div>`:'';
    const log=(state.log||[]).slice(-5).map(entry=>`<div class="log-row"><span class="log-minute">${esc(entry.minute||'—')}′</span><span>${esc(entry.title||'Эпизод')} · ${entry.goal?'⚽':'—'} · ${entry.attacker_role==='host'?esc(room.host_club?.name||'Хозяева'):esc(room.guest_club?.name||'Гости')}</span></div>`).join('');
    return `<div class="section-heading"><div><div class="eyebrow">Онлайн-матч · Эпизод ${idx+1} из 10</div><h1 class="h1">МАТЧ ИДЁТ</h1><p class="page-subtitle">Одно событие отображается у обоих игроков. Атакующий выбирает действие, соперник отвечает защитой.</p></div><span class="pill pill-lime">${role==='attack'?'ТВОЯ АТАКА':'ТВОЯ ОБОРОНА'}</span></div><div class="match-shell">${scoreMarkup}<section class="card zf-online-event-card"><div class="eyebrow">${esc(event.zone||'КЛЮЧЕВОЙ ЭПИЗОД')} · ${esc(event.minute||'—')}′</div><h2 class="h2">${esc(event.title||'Игровой эпизод')}</h2><p class="muted small">${esc(event.description||'')}</p><div class="zf-online-role ${role==='attack'?'is-attack':'is-defend'}"><strong>${role==='attack'?'⚽ ТЫ АТАКУЕШЬ':'🛡️ ТЫ ЗАЩИЩАЕШЬСЯ'}</strong><span>${role==='attack'?`Твой соперник: ${esc(oppName)} — выбирает защиту.`:`Атакует ${esc(oppName)} — выбери способ защиты.`}</span></div><div class="zf-online-choice-grid ${penalty?'zf-penalty-grid':''}">${buttons}</div><div class="zf-online-wait">${submitted?'✓ Решение принято. Ждём ход соперника…':otherSubmitted?'Соперник уже выбрал. Твой ход!':'Выбери один вариант — решение сразу отправится сопернику.'}</div>${result}</section><section class="card"><div class="eyebrow">ХРОНИКА МАТЧА</div><div class="match-log">${log||'<p class="muted small">Матч только начался.</p>'}</div></section><div class="settings-actions"><button class="btn btn-quiet btn-sm" data-action="online-match-menu">Выйти в меню</button></div></div>`;
  }
  function renderMatch(club){
    if(onlineRoomIsQuick()&&(matchState?.stage==='online'||matchState?.stage==='searching'||matchState?.stage==='idle'))return renderOnlineMatch(club);
    if(!matchState||matchState.stage==='idle')return `<div class="section-heading"><div><div class="eyebrow">Центр матчей</div><h1 class="h1">МАТЧДЕЙ</h1><p class="page-subtitle">Играй матчи и получай небольшую выплату в миллионах евро.</p></div><span class="pill">⚽ Быстрый матч · лимит 5</span></div>${energyWidget(club)}${renderAdSlot(club,'match')}<div class="match-shell"><div class="match-scoreboard"><div class="match-team"><div class="club-crest ${crestShape(club.logo)}" style="--crest-color:${esc(club.logo.color)}">${crestContent(club.logo,.9)}</div><strong>${esc(club.name)}</strong><span class="pill pill-lime" style="margin-top:7px">${teamRating(club)} OVR</span></div><div class="match-center"><div class="match-minute">READY</div><div class="match-score">— : —</div><div class="match-status">ОЖИДАНИЕ МАТЧА</div></div><div class="match-team"><div class="club-crest" style="--crest-color:#d1d9d0">?</div><strong>Соперник</strong><span class="pill" style="margin-top:7px">Не найден</span></div></div><div class="card" style="text-align:center;padding:28px"><div class="eyebrow">Быстрый матч</div><h2 class="h2" style="font-size:34px;margin:9px 0">ГОТОВ ВЫЙТИ НА ПОЛЕ?</h2><p class="muted small" style="line-height:1.8;max-width:490px;margin:0 auto">Поиск реального соперника до 30 секунд. Если игрок не найдётся, матч автоматически продолжится против бота.</p><div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:18px 0"><span class="pill">⏱ 10 эпизодов</span><span class="pill">🔎 Поиск 30 секунд</span><span class="pill">⚡ ${club.energy||0}/5 матчей</span><span class="pill">🪙 Награда за матч</span></div><button class="btn btn-primary" style="min-width:220px" data-action="match-search">🔎 Найти соперника</button></div><div class="dashboard-grid" style="margin-top:15px"><section class="card"><div class="eyebrow">Правила матча</div><h2 class="h2" style="margin-top:6px">КАК ИГРАТЬ</h2><div class="recent-list"><div class="recent-row"><div class="recent-icon">🎯</div><div><strong>Атакуй с умом</strong><small>Выбирай между пасом, дриблингом и ударом.</small></div></div><div class="recent-row"><div class="recent-icon">🧱</div><div><strong>Защищайся</strong><small>Прессинг, отбор или низкий блок — риск разный.</small></div></div><div class="recent-row"><div class="recent-icon">🎲</div><div><strong>Случайность решает</strong><small>Аутсайдер тоже способен удивить фаворита.</small></div></div></div></section><section class="card"><div class="eyebrow">Твои результаты</div><h2 class="h2" style="margin-top:6px">СТАТИСТИКА</h2><div class="statline"><span>Победы</span><b>${club.stats.wins}</b></div><div class="statline"><span>Ничьи</span><b>${club.stats.draws}</b></div><div class="statline"><span>Поражения</span><b>${club.stats.losses}</b></div><div class="statline"><span>Забито голов</span><b>${club.stats.goalsFor}</b></div></section></div></div>`;
    if(matchState.stage==='searching')return renderSearching(club);
    if(matchState.stage==='found')return renderFound(club);
    if(matchState.stage==='live')return renderLiveMatch(club);
    if(matchState.stage==='result')return renderMatchResult(club);
    return '';
  }
  function renderSearching(club){const deadline=matchState.searchDeadline||Date.now()+30000;return `<div class="section-heading"><div><div class="eyebrow">Поиск соперника</div><h1 class="h1">ПОИСК СОПЕРНИКА</h1><p class="page-subtitle">Ищем реального игрока. После 30 секунд автоматически подберём бота.</p></div><span class="pill pill-lime">Онлайн-поиск</span></div><div class="match-shell"><div class="card" style="text-align:center;padding:30px"><div class="search-visual"><span class="search-ring"></span><span class="search-ring"></span><span class="search-ring"></span><span class="search-ball">⚽</span></div><h2 class="h2" style="font-size:34px">ИЩЕМ ТВОЕГО СОПЕРНИКА</h2><p class="muted small">Ожидаем подключение другого клуба. Осталось: <strong data-countdown-deadline="${deadline}">30 сек.</strong></p><div class="progress" style="max-width:300px;margin:20px auto"><span style="width:100%;animation:searchProgress 30s linear forwards"></span></div><button class="btn btn-quiet btn-sm" data-action="cancel-search">Отменить поиск</button></div></div><style>@keyframes searchProgress{0%{width:0}100%{width:100%}}</style>`;}
  function renderFound(club){
    const opp=matchState.opponent;
    const stars=(opp.players||[]).map(p=>({...p,id:null,rating:playerOVRAt(p,p.assignedPosition||p.position,null),realClub:p.realClub||p.club,positions:p.positions||[p.position],contractUntil:Date.now()+30*86400000})).sort((a,b)=>b.rating-a.rating).slice(0,3);
    return `<div class="section-heading"><div><div class="eyebrow">Соперник найден</div><h1 class="h1">СОПЕРНИК НАЙДЕН</h1><p class="page-subtitle">Разминка закончена. Пора выходить на поле.</p></div><span class="pill pill-lime">✓ Найден</span></div><div class="match-shell"><div class="card" style="text-align:center;padding:25px"><span class="pill pill-lime">СОПОСТАВЛЕНИЕ ЗАВЕРШЕНО</span><div class="found-vs"><div class="found-side"><div class="club-crest ${crestShape(club.logo)}" style="--crest-color:${esc(club.logo.color)}">${crestContent(club.logo,.9)}</div><strong>${esc(club.name)}</strong><small>${teamRating(club)} OVR · Твой клуб</small></div><div class="vs-word">VS</div><div class="found-side"><div class="club-crest" style="--crest-color:${esc(opp.color)}">${esc(opp.symbol)}</div><strong>${esc(opp.name)}</strong><small>${opp.rating} OVR · Бот</small></div></div><div class="opponent-stars"><div class="eyebrow">⭐ ТРИ ЛУЧШИЕ КАРТОЧКИ СОПЕРНИКА</div><div class="player-grid opponent-best-grid">${stars.map(p=>renderPlayerCard(p,false,false)).join('')}</div></div><div class="divider"></div><div class="stat-grid" style="margin-bottom:18px"><div class="metric-card"><div class="metric-top">Твой состав</div><div class="metric-value">${teamRating(club)}</div><div class="metric-note">Общий рейтинг</div></div><div class="metric-card"><div class="metric-top">Соперник</div><div class="metric-value">${opp.rating}</div><div class="metric-note">Общий рейтинг</div></div><div class="metric-card"><div class="metric-top">Формат</div><div class="metric-value">10</div><div class="metric-note">Эпизодов</div></div><div class="metric-card"><div class="metric-top">Награда</div><div class="metric-value">€0.35 млн</div><div class="metric-note">Минимальная выплата</div></div></div><div class="match-agreement-timer">⏱ Осталось принять матч: <strong data-countdown-deadline="${matchState.agreementDeadline||Date.now()}">60 сек.</strong></div><button class="btn btn-primary" data-action="start-match" style="min-width:230px">Принять матч →</button><div style="margin-top:12px"><button class="btn btn-quiet btn-sm" data-action="cancel-search">Отменить</button></div></div></div>`;
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

  const MATCH_ACTION_FALLBACKS={"Короткий пас":"assets/match-actions/action-01.svg","Перевод фланга":"assets/match-actions/action-02.svg","Пас за спину":"assets/match-actions/action-03.svg","Продвинуться с мячом":"assets/match-actions/action-04.svg","Навес":"assets/match-actions/action-05.svg","Прострел назад":"assets/match-actions/action-06.svg","Обводка":"assets/match-actions/action-07.svg","Сменить фланг":"assets/match-actions/action-08.svg","Быстрая контратака":"assets/match-actions/action-09.svg","Притормозить":"assets/match-actions/action-10.svg","Вертикальный пас":"assets/match-actions/action-11.svg","Удар издали":"assets/match-actions/action-12.svg","Сесть в блок":"assets/match-actions/action-13.svg","Перекрыть пас":"assets/match-actions/action-14.svg","Вступить в отбор":"assets/match-actions/action-15.svg","Удвоить опеку":"assets/match-actions/action-16.svg","Закрыть ближнюю зону":"assets/match-actions/action-17.svg","Выбить мяч":"assets/match-actions/action-18.svg","Подкат в момент":"assets/match-actions/action-19.svg","Удар по воротам":"assets/match-actions/action-20.svg","Завершение после прострела":"assets/match-actions/action-21.svg","Удар головой":"assets/match-actions/action-22.svg","Выход один на один":"assets/match-actions/action-23.svg","Удар после передачи":"assets/match-actions/action-24.svg","Попытка обыграть вратаря":"assets/match-actions/action-25.svg","Угловой":"assets/match-actions/action-26.svg","Штрафной":"assets/match-actions/action-27.svg","Пенальти":"assets/match-actions/action-28.svg","Вбрасывание аута":"assets/match-actions/action-29.svg","Замена":"assets/match-actions/action-30.svg","Травма":"assets/match-actions/action-31.svg","Жёлтая":"assets/match-actions/action-32.svg","Красная":"assets/match-actions/action-33.svg"};
  const MATCH_ACTION_ALIASES={
    'Перевод фланга':'Перевод фланга','Перевод на другой фланг':'Сменить фланг','Атака через фланг':'Навес','Дриблинг 1 в 1':'Обводка','Дальний удар':'Удар издали','Удар по воротам':'Удар по воротам','Разрезающий пас':'Пас за спину','Низкий блок':'Сесть в блок','Идти в отбор':'Вступить в отбор','Перехват передачи':'Перекрыть пас','Вынос из штрафной':'Выбить мяч','Угловой:':'Угловой','Штрафной у':'Штрафной','Пенальти!':'Пенальти','ПЕНАЛЬТИ!':'Пенальти','ШТРАФНОЙ':'Штрафной','ШТРАФНОЙ СОПЕРНИКА':'Штрафной','УГЛОВОЙ':'Угловой','Жёлтая карточка':'Жёлтая','Красная карточка':'Красная','Травма:':'Травма','Сделать замену':'Замена','Комбинация у штрафной':'Короткий пас','Свободная зона на фланге':'Навес','Момент для решающего паса':'Пас за спину','Защитник вышел навстречу':'Обводка','Двойка на левом фланге':'Перевод фланга','Контратака после перехвата':'Быстрая контратака','Прострел под удар':'Прострел назад','Второй темп атаки':'Удар издали','Соперник разгоняет атаку':'Быстрая контратака','Опасный прострел':'Прострел назад','Потеря мяча под прессингом':'Перекрыть пас','Соперник готовит удар':'Удар по воротам','Перегруз на фланге':'Удвоить опеку','Передача между линиями':'Перекрыть пас','Навес на дальнюю штангу':'Навес','Соперник ищет свободный удар':'Вступить в отбор','Перегруз центра':'Вертикальный пас','Рывок за спину защитнику':'Пас за спину','Подбор после рикошета':'Удар издали','Один в один у лицевой':'Обводка','Соперник переводит игру':'Сменить фланг','Рывок нападающего к мячу':'Удар головой','Ошибка при выходе из обороны':'Перекрыть пас','Соперник смещается под удар':'Подкат в момент'
  };
  function matchActionKey(label){const raw=String(label||'');if(MATCH_ACTION_IMAGES[raw])return raw;if(MATCH_ACTION_ALIASES[raw])return MATCH_ACTION_ALIASES[raw];const translated=Object.keys(MATCH_ACTION_IMAGES).find(k=>translateUIText(k)===raw);return translated||'';}
  function matchActionImage(label){const key=matchActionKey(label)||'Удар по воротам';return MATCH_ACTION_IMAGES[key]||MATCH_ACTION_FALLBACKS[key]||MATCH_ACTION_FALLBACKS['Удар по воротам'];}
  function matchActionFallback(label){const key=matchActionKey(label)||'Удар по воротам';return MATCH_ACTION_FALLBACKS[key]||'assets/match-actions/action-19.svg';}
  function matchActionImgAttrs(label){return `onerror=\"this.onerror=null;this.src=new URL('${matchActionFallback(label)}',document.baseURI).href\"`;}
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
    return `<div class="section-heading"><div><div class="eyebrow">Матч идёт</div><h1 class="h1">МАТЧ ИДЁТ</h1><p class="page-subtitle">Принимай решение в каждом эпизоде. Один удачный момент может изменить всё.</p></div><span class="pill pill-lime">Эпизод ${matchState.eventIndex+1} / 10</span></div><div class="match-shell">${energyWidget(club)}${matchBoard(club)}<section class="match-event"><div class="event-top"><span class="pill ${ev.side==='user'?'pill-lime':'pill-red'}">${ev.side==='user'?'⚡ ТВОЯ АТАКА':'🧱 ОБОРОНА'}</span><span class="muted small">${ev.minute}′ · ${ev.zone}</span></div><div class="eyebrow">Ключевой эпизод</div><h2 class="event-title">${esc(ev.title)}</h2><div class="event-visual match-action-hero" aria-label="Иллюстрация игрового эпизода">${(()=>{const title=String(ev.title||'');const key=matchActionKey(ev.imageKey||title)|| (ev.kind==='corner'?'Угловой':ev.kind==='freekick'?'Штрафной':ev.kind==='penalty'?'Пенальти':ev.kind==='injury'?'Травма':'Удар по воротам');const src=matchActionImage(key);return `<img src="${src}" ${matchActionImgAttrs(key)} alt="${esc(key||'Футбольный эпизод')}" loading="eager"><span class="match-action-hero-label">${esc(key||'Игровой эпизод')}</span>`;})()}</div><p class="event-description">${esc(ev.description)}</p><p class="muted small">${esc('Твоя команда: '+activePlayers(club).slice(0,3).map(playerDisplayName).join(', ')+' · '+matchState.opponent.name+': '+(matchState.opponent.players||['Игрок соперника 9','Игрок соперника 10','Игрок соперника 11']).slice(0,3).map(p=>typeof p==='string'?p:playerDisplayName(p)).join(', '))}</p><div class="divider"></div><details class="card" style="margin:12px 0;padding:12px"><summary><strong>🔄 Сделать замену</strong></summary><p class="muted small">Выбери игрока основы и замену со скамейки.</p>${activePlayers(club).map(p=>`<div class="statline"><span>${esc(p.name)} · ${p.rating}</span><select class="select-compact" data-sub-out="${esc(p.id)}"><option value="">Заменить на…</option>${benchPlayers(club).map(q=>`<option value="${esc(q.id)}" ${playerIsUnavailable(q)?'disabled':''}>${esc(q.name)} (${q.rating})${playerIsUnavailable(q)?' · '+esc(unavailableReason(q)):''}</option>`).join('')}</select><button class="btn btn-secondary btn-sm" data-action="manual-sub" data-out="${esc(p.id)}">Ок</button></div>`).join('')}</details><div class="event-top"><div class="eyebrow">Выбери действие</div><span class="pill pill-lime">⏱ Осталось: <b data-countdown-deadline="${matchState.actionDeadline}">60 сек.</b></span></div><div class="choice-grid">${actions.map((a,i)=>{return `<button class="match-choice" data-action="match-choice" data-choice="${a.id}"><span class="choice-num">${i+1}</span><span class="match-choice-copy"><strong>${a.icon} ${a.name}</strong><small>${a.desc}<br><span style="color:${a.risk==='Высокий'?'#ff9d8f':a.risk==='Низкий'?'var(--lime)':'#e1c576'}">Риск: ${a.risk}</span></small></span></button>`;}).join('')}</div></section><section class="card"><div class="card-header"><div><div class="eyebrow">Хроника матча</div><h2 class="h2">ХРОНИКА МАТЧА</h2></div></div><div class="match-log">${matchState.log.slice(-5).reverse().map(l=>{const t=String(l.text||'');const key=l.imageKey||(t.includes('Красн')?'Красная':t.includes('Жёлт')?'Жёлтая':t.includes('Травм')?'Травма':t.includes('замен')?'Замена':'');const src=key?matchActionImage(key):'';return `<div class="log-row match-log-row"><span class="log-minute">${l.minute}′</span>${src?`<img class="match-log-thumb" src="${src}" ${matchActionImgAttrs(key)} alt="${esc(key)}" loading="lazy">`:''}<span>${esc(t)}</span></div>`;}).join('')}</div></section></div>`;
  }
  function renderMatchResult(club){
    const m=matchState;const won=m.score[0]>m.score[1],draw=m.score[0]===m.score[1];const title=won?'ПОБЕДА!':draw?'БОЕВАЯ НИЧЬЯ':'В ЭТОТ РАЗ НЕ ПОВЕЗЛО';const result=won?'W':draw?'D':'L';
    return `<div class="section-heading"><div><div class="eyebrow">Финальный свисток</div><h1 class="h1">ФИНАЛЬНЫЙ СВИСТОК</h1><p class="page-subtitle">Матч закончен. Результат записан в историю клуба.</p></div><span class="pill ${won?'pill-lime':''}">${won?'🏆 Победа':draw?'🤝 Ничья':'Матч завершён'}</span></div><div class="match-shell">${matchBoard(club)}<section class="card" style="text-align:center;padding:29px"><div class="eyebrow">Отчёт о матче</div><h2 class="h1" style="font-size:44px;margin-top:9px">${title}</h2><div class="result-stamp">${m.score[0]} : ${m.score[1]}</div><p class="muted small" style="max-width:470px;margin:0 auto">${won?'Отличная работа! Твои решения помогли забрать три очка.':draw?'Равная игра — ни одна команда не смогла дожать соперника.':'Поражение — повод разобрать решения и вернуться сильнее.'}</p><div class="scorers-box"><strong>⚽ Автор(ы) голов</strong><div>${(m.scorers||[]).length?(m.scorers||[]).map(g=>`<span>${g.minute}′ · ${g.side==='user'?esc(g.playerName):`${esc(g.playerName)} · ${esc(m.opponent.name||'Соперник')}`}</span>`).join(''):'<span>Голов в матче не было</span>'}</div></div><div class="result-details"><div class="result-metric"><span>Награда</span><strong style="color:var(--gold)">+${formatMoney(m.reward)}</strong></div></div><div class="match-stat-grid"><div><b>${m.stats.user.shots}</b><span>Удары</span></div><div><b>${m.stats.user.onTarget}</b><span>В створ</span></div><div><b>${m.stats.user.passes}</b><span>Пасы</span></div><div><b>${m.stats.user.defensiveActions}</b><span>Оборона</span></div><div><b>${m.stats.opponent.shots}</b><span>Удары соперника</span></div><div><b>${m.stats.user.attacks}</b><span>Твои эпизоды</span></div></div><div class="divider"></div><div class="match-log" style="text-align:left;margin-bottom:20px">${m.log.map(l=>`<div class="log-row"><span class="log-minute">${l.minute}′</span><span>${esc(l.text)}</span></div>`).join('')}</div><div style="display:flex;justify-content:center;gap:9px;flex-wrap:wrap"><button class="btn btn-primary" data-action="match-return-search">🔎 Вернуться к поиску матча</button><button class="btn btn-secondary" data-action="nav" data-view="home">В главное меню</button></div></section></div>`;
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
    const packArt=ZF_PACK_OPTIONS.find(p=>p.id===reveal.type)?.image||'assets/packs/starter.webp';
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
    const openingClub=currentClub(),openingInventory=openingClub?ensurePackInventory(openingClub):{};
    const availableNextPacks=ZF_PACK_OPTIONS.filter(p=>(Number(openingInventory[p.id])||0)>0);
    const nextPackControls=availableNextPacks.length?`<div class="opening-next-pack"><div><strong>Есть ещё паки в инвентаре</strong><small>Можно сразу перейти к следующему набору.</small></div><div class="opening-next-pack-controls"><select id="opening-next-pack" class="select-compact">${availableNextPacks.map(p=>`<option value="${p.id}">${p.name} · ×${openingInventory[p.id]}</option>`).join('')}</select><button class="btn btn-secondary btn-sm" data-action="open-next-pack" ${reveal.duplicateRewards?.length?'disabled title="Сначала разберите повторные карточки"':''}>Открыть следующий</button></div></div>`:'';
    return `<div class="pack-opening ${skipped?'is-skipped':''} ${animationEnabled?'':'is-no-animation'}" data-pack-speed="${speed}" data-animation-serial="${reveal.animationSerial||0}" style="--pack-color:${meta.color};--pack-accent:${meta.accent};--pack-glow:${meta.glow};--pack-intro-duration:${timings.intro}s;--pack-card-start:${timings.start}s;--pack-card-stagger:${timings.stagger}s;--pack-card-duration:${timings.card}s">
      <div class="pack-opening-backdrop-grid"></div><div class="opening-box">
        <div class="opening-topline"><span class="opening-live-dot"></span><span>ZERO FOOTBALL · PLAYER ACQUISITION</span><span class="opening-pack-count">${cards.length} ${cards.length===1?'КАРТОЧКА':'КАРТОЧЕК'}</span></div>
        <div class="opening-pack-scene" aria-hidden="true"><div class="opening-scene-ring ring-one"></div><div class="opening-scene-ring ring-two"></div><div class="opening-pack-glow"></div><div class="opening-pack-box"><img class="opening-pack-image" src="${packArt}" alt="${esc(meta.label)}"><span class="opening-pack-star">✦</span><span>ZF</span><i></i></div><div class="opening-scene-particles"><b>✦</b><b>·</b><b>✧</b><b>·</b><b>✦</b><b>·</b><b>✧</b></div></div>
        <div class="opening-intro-copy"><div class="eyebrow" style="margin-top:8px">PACK OPENING · ${meta.label}</div><div class="opening-flash">НОВЫЕ <span>ПОДПИСАНИЯ</span></div><div class="opening-progress-track"><span></span></div><div class="opening-status">${skipped?'КАРТОЧКИ ГОТОВЫ':'СКАНИРОВАНИЕ КОНТРАКТОВ · ПОДГОТОВКА КАРТОЧЕК'}</div></div>
        <p class="muted small opening-description">Контракт каждой новой карточки — 30 дней. Повторная карточка продлевает контракт такого же футболиста на 5 дней.</p>
        ${(reveal.duplicateRewards||[]).length?`<div class="card duplicate-rewards-panel" style="margin:12px 0"><strong>Повторные карточки: ${(reveal.duplicateRewards||[]).length}</strong>${reveal.duplicateRewards.map(p=>`<div class="duplicate-choice-row"><span>${esc(playerDisplayName(p))} · ${p.rating} OVR</span><div class="duplicate-choice-actions"><button class="btn btn-secondary btn-sm" data-action="duplicate-sell" data-player-id="${esc(p.id)}">Продать · ${formatMoney(saleValue(p,true)*.8)}–${formatMoney(saleValue(p,true)*1.35)}</button><button class="btn btn-primary btn-sm" data-action="duplicate-renew" data-player-id="${esc(p.id)}">Продлить +5 дней</button></div></div>`).join('')}</div>`:''}
        ${nextPackControls}
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
    return `<div class="modal-backdrop" data-action="close-modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><div class="modal-head"><div><div class="eyebrow">Управление составом</div><h2>ЗАМЕНИТЬ ИГРОКА</h2><p class="muted small" style="margin:6px 0 0">Позиция: ${esc(positionLabel(target))} · Сейчас: ${esc(old?playerDisplayName(old):'Пусто')}</p></div><button class="icon-btn" data-action="close-modal">✕</button></div><div class="modal-player-list">${players.map(({p,ovr,penalty})=>{const starter=club.lineup.includes(p.id),unavailable=playerIsUnavailable(p);return `<button class="modal-player ${unavailable?'player-unavailable':''}" data-portrait-key="${esc(p.wiki||p.name)}" ${p.wiki?`data-wiki="${esc(p.wiki)}"`:''} data-action="assign-player" data-slot="${index}" data-player-id="${esc(p.id)}" ${unavailable?'disabled':''}><div class="mini-player" style="--rarity-color:${rarityColor(ovr)}"><img class="squad-photo" alt="${esc(p.name)}" loading="lazy"><span class="mini-rating">${ovr}</span></div><div class="modal-player-copy"><strong data-no-translate>${esc(playerDisplayName(p))}</strong><small>${esc(playerPositionsLabel(p))} · ${penalty===0?'Профильная позиция':penalty<0?`Штраф за позицию ${penalty}`:'Совместимая позиция'}${p.injuryMatches>0?` · 🤕 Травма (${p.injuryMatches})`:''}${p.redCardMatches>0?` · 🟥 Удалён (${p.redCardMatches})`:''}${p.yellowBanMatches>0?` · ⛔ Бан за жёлтые (${p.yellowBanMatches})`:''}${p.yellowCards>0?` · 🟨 ${p.yellowCards}/5`:''}</small></div><span class="rating-badge">${starter?'В основе':`OVR ${ovr}`}</span></button>`;}).join('')}</div></section></div>`;
  }

  async function syncCommunityInventory(club=currentClub()){
    if(!ZF_SUPABASE||!zfAuthSession||!club)return false;
    const cards=Array.isArray(club.players)?club.players:[];
    const starters=Array.isArray(club.lineup)?club.lineup:[];
    const synced=await ZF_SUPABASE.rpc('zf_card_inventory_sync',{p_cards:cards,p_starters:starters});
    if(synced.error)throw synced.error;
    const listed=await ZF_SUPABASE.rpc('zf_card_inventory_list');
    if(listed.error)throw listed.error;
    const rows=Array.isArray(listed.data)?listed.data:[];
    const owned=rows.filter(x=>x.status==='owned'&&x.card_snapshot&&typeof x.card_snapshot==='object');
    const byId=new Map(cards.map(p=>[String(p.id),p]));
    const next=owned.map(row=>{
      const card=byId.get(String(row.card_id))||row.card_snapshot;
      const identity=card?.wiki||card?.name?.trim()?.toLocaleLowerCase('ru');
      const duplicate=cards.some(other=>String(other.id)!==String(row.card_id)&&identity&&(other.wiki||other.name?.trim()?.toLocaleLowerCase('ru'))===identity);
      return duplicate&&!card.marketResaleOnly?{...card,marketResaleOnly:true}:card;
    });
    const nextIds=new Set(next.map(p=>String(p.id)));
    const changed=next.length!==cards.length||next.some((p,i)=>String(p.id)!==String(cards[i]?.id)||!!p.marketResaleOnly!==!!cards[i]?.marketResaleOnly);
    if(changed){club.players=next;club.lineup=(club.lineup||[]).filter(id=>nextIds.has(String(id)));if(club.captainId&&!nextIds.has(String(club.captainId)))club.captainId=null;saveDB();await syncCommunitySaveToCloud();}
    return true;
  }
  async function syncCommunitySaveToCloud(){
    if(!ZF_SUPABASE||!zfAuthSession)return;
    try{const user=await authenticatedUser();const payload=JSON.parse(JSON.stringify(db));const {error}=await ZF_SUPABASE.from('zf_cloud_saves').upsert({user_id:user.id,payload,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error;}
    catch(error){console.warn('Community card transfer saved locally, cloud sync failed:',error);toast('Действие выполнено локально, но облачное сохранение не обновилось. Нажми «Сохранить в облако» в настройках.','error');}
  }
  function addReceivedCommunityCard(club,raw,resaleOnly=false){
    if(!club||!raw)return false;const card=JSON.parse(JSON.stringify(raw));
    card.id='zf-card-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
    card.marketEscrow=false;card.marketResaleOnly=!!resaleOnly;card.stamina=Number.isFinite(Number(card.stamina))?Number(card.stamina):100;
    card.contractUntil=Math.max(Number(card.contractUntil)||0,Date.now()+30*86400000);
    club.players=Array.isArray(club.players)?club.players:[];club.players.push(card);return true;
  }
  async function handleCommunityAction(action,btn){
    const club=currentClub();if(!club)throw new Error('Клуб не найден.');
    if(!ZF_SUPABASE)throw new Error('Supabase не подключён.');
    const rpc=async(name,args={})=>{const result=await ZF_SUPABASE.rpc(name,args);if(result.error)throw result.error;return result.data;};
    if(action==='community-refresh'){await refreshCommunityPage(view);toast('Данные обновлены.');return true;}
    if(action==='copy-player-code'){const code=communityState.profile?.player_code;if(!code)return true;await navigator.clipboard?.writeText(code).catch(()=>{});toast(`Твой ID: ${code}`);return true;}
    if(action==='friend-search'){
      const code=$('#friend-code-input')?.value?.trim();if(!code)throw new Error('Введи ID игрока.');
      communityState.searchResult=await rpc('zf_social_search_player',{p_code:code.toUpperCase()});render();return true;
    }
    if(action==='friend-send'){await rpc('zf_social_send_request',{p_code:btn.dataset.userCode});communityState.searchResult=null;await refreshCommunityPage('friends');toast('Заявка отправлена.');return true;}
    if(action==='contact-accept'){await rpc('zf_social_decide_request',{p_other:btn.dataset.userId,p_accept:true,p_status:btn.dataset.status||'friend'});await refreshCommunityPage('friends');toast('Контакт добавлен.');return true;}
    if(action==='contact-decline'){await rpc('zf_social_decide_request',{p_other:btn.dataset.userId,p_accept:false,p_status:'friend'});await refreshCommunityPage('friends');toast('Заявка отклонена.');return true;}
    if(action==='contact-status'){await rpc('zf_social_set_contact',{p_other:btn.dataset.userId,p_status:btn.dataset.status});await refreshCommunityPage('friends');toast('Статус контакта изменён.');return true;}
    if(action==='contact-remove'){if(!confirm('Убрать игрока из знакомых и друзей?'))return true;await rpc('zf_social_remove_contact',{p_other:btn.dataset.userId});await refreshCommunityPage('friends');toast('Контакт удалён.');return true;}
    if(action==='trade-create'){
      const target=$('#trade-target')?.value,playerId=$('#trade-card')?.value,p=club.players.find(x=>x.id===playerId),hint=$('#trade-request-hint')?.value?.trim()||'',message=$('#trade-message')?.value?.trim()||'';
      if(!target||!p)throw new Error('Выбери игрока и карточку.');if(club.lineup.includes(p.id))throw new Error('Карточка из основы недоступна для обмена.');
      await syncCommunityInventory(club);await rpc('zf_trade_create',{p_to:target,p_card_id:String(p.id),p_requested_hint:hint,p_message:message});club.players=club.players.filter(x=>x.id!==p.id);saveDB();await syncCommunitySaveToCloud();await refreshCommunityPage('friends');toast(hint?'Предложение обмена отправлено.':'Подарок отправлен.');return true;
    }
    if(action==='trade-accept'||action==='trade-decline'){
      const offer=(communityState.offers||[]).find(o=>o.id===btn.dataset.offerId);if(!offer)throw new Error('Предложение не найдено.');
      let counter=null;
      if(action==='trade-accept'&&offer.requested_card_hint){const selected=$(`[data-trade-counter="${offer.id}"]`)?.value;counter=club.players.find(p=>p.id===selected);if(!counter)throw new Error('Для обмена выбери свою карточку.');if(club.lineup.includes(counter.id))throw new Error('Нельзя отдавать футболиста из стартового состава.');}
      await syncCommunityInventory(club);await rpc('zf_trade_decide',{p_offer:offer.id,p_accept:action==='trade-accept',p_counter_card_id:counter?String(counter.id):null});
      await refreshCommunityPage('friends');toast(action==='trade-accept'?(counter?'Обмен подтверждён.':'Подарок принят.'):'Предложение отклонено. Карточка возвращена отправителю.');return true;
    }
    if(action==='trade-cancel'){await rpc('zf_trade_cancel',{p_offer:btn.dataset.offerId});await refreshCommunityPage('friends');toast('Предложение отменено, карточка возвращена в резерв.');return true;}
    if(action==='market-search'){const q=$('#market-search-input')?.value?.trim()||'',exact=!!$('#market-exact-search')?.checked;communityState.marketQuery=q;communityState.marketExact=exact;communityState.market=await rpc('zf_market_search',{p_search:q,p_exact:exact});render();applyMarketFilters();return true;}
    if(action==='market-list'){
      const sellCard=btn.closest('.market-sell-card'),id=sellCard?.dataset.marketCardId,p=club.players.find(x=>String(x.id)===String(id)),mode=sellCard?.querySelector('.market-transfer-mode')?.value||'custom';
      const base=Math.max(.01,Number(marketValue(p?.rating))||.01),factor=mode==='quick'?.8:mode==='premium'?1.25:1;
      const price=Number(sellCard?.querySelector('.market-transfer-price')?.value);
      if(!p)throw new Error('Карточка футболиста не найдена.');if(club.lineup.includes(p.id))throw new Error('Футболиста из основы нельзя выставить на рынок.');if(!Number.isFinite(price)||price<=0)throw new Error('Укажи цену больше нуля.');
      if(mode!=='custom'&&Math.abs(price-base*factor)>Math.max(.02,base*.015))throw new Error('Цена не совпадает с выбранным вариантом трансфера. Измени вариант или выбери «Своя цена».');
      await syncCommunityInventory(club);await rpc('zf_market_list',{p_card_id:String(p.id),p_price:Math.round(price*100)/100,p_duplicate:!!p.marketResaleOnly});club.players=club.players.filter(x=>x.id!==p.id);saveDB();await syncCommunitySaveToCloud();await refreshCommunityPage('market');toast(`${playerDisplayName(p)} выставлен на трансферный рынок.`);return true;
    }
    if(action==='market-buy'){
      const price=Number(btn.dataset.price)||0;if(club.coins<price)throw new Error('Недостаточно средств.');
      const result=await rpc('zf_market_buy',{p_listing:btn.dataset.listingId});club.coins-=price;saveDB();await syncCommunitySaveToCloud();await refreshCommunityPage('market');toast(result.listing?.is_duplicate?'Повторная карточка куплена. Её можно только перепродать.':'Карточка куплена и добавлена в команду.');return true;
    }
    if(action==='market-withdraw'){
      await rpc('zf_market_withdraw',{p_listing:btn.dataset.listingId});saveDB();await refreshCommunityPage('market');await syncCommunitySaveToCloud();toast('Карточка возвращена в команду.');return true;
    }
    if(action==='market-claim'){
      const result=await rpc('zf_market_claim_proceeds');const amount=Number(result?.amount)||0;if(amount>0){club.coins+=amount;saveDB();await syncCommunitySaveToCloud();}await refreshCommunityPage('market');toast(amount>0?`Получено ${formatMoney(amount)} за продажу карточек.`:'Нет денег для получения.');return true;
    }
    if(action==='clan-create'){
      if(club.coins<50)throw new Error('Для создания клана нужно €50 млн.');
      const name=$('#clan-name-input')?.value?.trim(),tag=$('#clan-tag-input')?.value?.trim(),description=$('#clan-description-input')?.value?.trim()||'';
      await rpc('zf_clan_create',{p_name:name,p_tag:tag,p_description:description});club.coins-=50;saveDB();await syncCommunitySaveToCloud();await refreshCommunityPage('clan');toast('Клан создан.');return true;
    }
    if(action==='clan-apply'){await rpc('zf_clan_apply',{p_clan:btn.dataset.clanId,p_message:'Хочу вступить в клан.'});toast('Заявка отправлена владельцу клана.');await refreshCommunityPage('clan');return true;}
    if(action==='clan-review'){await rpc('zf_clan_review_application',{p_application:btn.dataset.applicationId,p_accept:btn.dataset.accept==='true'});await refreshCommunityPage('clan');toast(btn.dataset.accept==='true'?'Игрок принят в клан.':'Заявка отклонена.');return true;}
    if(action==='clan-invite'){const code=$('#clan-invite-code')?.value?.trim();if(!code)throw new Error('Введи ID игрока.');await rpc('zf_clan_invite',{p_player_code:code});toast('Приглашение отправлено.');return true;}
    if(action==='clan-invite-reply'){await rpc('zf_clan_invite_reply',{p_invite:btn.dataset.inviteId,p_accept:btn.dataset.accept==='true'});await refreshCommunityPage('clan');toast(btn.dataset.accept==='true'?'Ты вступил в клан.':'Приглашение отклонено.');return true;}
    if(action==='clan-disband'){if(!confirm('Удалить свой клан? Все участники, заявки и задания будут удалены. Это действие нельзя отменить.'))return true;await rpc('zf_clan_disband');await refreshCommunityPage('clan');toast('Клан удалён.');return true;}
    if(action==='clan-kick'){if(!confirm('Исключить участника из клана?'))return true;await rpc('zf_clan_kick',{p_user:btn.dataset.userId});await refreshCommunityPage('clan');toast('Участник исключён.');return true;}
    if(action==='clan-leave'){if(!confirm('Покинуть клан?'))return true;await rpc('zf_clan_leave');await refreshCommunityPage('clan');toast('Ты покинул клан.');return true;}
    if(action==='competition-create'){
      const title=$('#competition-title-input')?.value?.trim(),kind=$('#competition-kind-input')?.value||'league',max=Math.max(2,Math.min(64,Number($('#competition-max-input')?.value)||16)),draw=$('#competition-draw-input')?.value||'random',type=$('#competition-reward-input')?.value||'none',amount=Math.max(0,Number($('#competition-prize-input')?.value)||0),pack=$('#competition-pack-input')?.value?.trim()||'',payer=$('#competition-payer-input')?.value?.trim()||'';
      if(!title)throw new Error('Укажи название соревнования.');
      const reward={type,amount,pack,payerCode:payer};
      await rpc('zf_competition_create',{p_title:title,p_kind:kind,p_max:max,p_draw:draw,p_reward:reward});await refreshCommunityPage('leagues');toast(kind==='league'?'Лига создана.':'Турнир создан.');return true;
    }
    if(action==='competition-delete'){const title=btn.dataset.competitionTitle||'соревнование';if(!confirm(`Удалить «${title}»? Будут удалены участники, приглашения и результаты. Это действие нельзя отменить.`))return true;await rpc('zf_competition_delete',{p_competition:btn.dataset.competitionId});await refreshCommunityPage('leagues');toast('Соревнование удалено.');return true;}
    if(action==='competition-join'){await rpc('zf_competition_join',{p_competition:btn.dataset.competitionId});await refreshCommunityPage('leagues');toast('Ты вступил в соревнование.');return true;}
    if(action==='competition-invite'){const code=$(`[data-invite-code="${btn.dataset.competitionId}"]`)?.value?.trim();if(!code)throw new Error('Введи ID игрока.');await rpc('zf_competition_invite',{p_competition:btn.dataset.competitionId,p_player_code:code});toast('Приглашение отправлено.');return true;}
    if(action==='competition-invite-reply'){await rpc('zf_competition_invite_reply',{p_invite:btn.dataset.inviteId,p_accept:btn.dataset.accept==='true'});await refreshCommunityPage('leagues');toast(btn.dataset.accept==='true'?'Приглашение принято.':'Приглашение отклонено.');return true;}
    if(action==='competition-lock'){
      const mine=(communityState.myCompetitions?.competitions||[]).find(c=>c.competition_id===btn.dataset.competitionId);let order=null;
      const competition=(communityState.competitions||[]).find(c=>c.id===btn.dataset.competitionId);
      if(competition?.draw_mode==='manual'){
        const members=mine?.members||[];
        const controls=$$(`[data-manual-seed="${btn.dataset.competitionId}"]`);
        if(controls.length!==members.length)throw new Error('Не удалось загрузить порядок участников. Обнови список соревнований.');
        const numbered=controls.map(control=>({userId:control.dataset.userId,seed:Number(control.value)}));
        const seeds=numbered.map(x=>x.seed).sort((a,b)=>a-b);
        if(numbered.some(x=>!Number.isInteger(x.seed)||x.seed<1||x.seed>members.length)||new Set(seeds).size!==members.length)throw new Error('Каждому участнику нужно назначить уникальную позицию от 1 до '+members.length+'.');
        order=numbered.sort((a,b)=>a.seed-b.seed).map(x=>x.userId);
      }
      await rpc('zf_competition_lock',{p_competition:btn.dataset.competitionId,p_manual_order:order});await refreshCommunityPage('leagues');toast('Состав подтверждён, жеребьёвка проведена.');return true;
    }
    if(action==='competition-report-result'){const home=Number($(`[data-fixture-score="${btn.dataset.matchId}"][data-side="home"]`)?.value),away=Number($(`[data-fixture-score="${btn.dataset.matchId}"][data-side="away"]`)?.value);if(!Number.isInteger(home)||!Number.isInteger(away))throw new Error('Введи счёт матча.');const result=await rpc('zf_competition_report_result',{p_match:btn.dataset.matchId,p_home_score:home,p_away_score:away});await refreshCommunityPage('leagues');toast(result?.pending_confirmation?'Результат отправлен. Ждём подтверждения соперника.':'Результат подтверждён.');return true;}
    if(action==='competition-kick'){if(!confirm('Исключить игрока из соревнования?'))return true;await rpc('zf_competition_kick',{p_competition:btn.dataset.competitionId,p_user:btn.dataset.userId});await refreshCommunityPage('leagues');toast('Участник исключён.');return true;}
    return false;
  }
  // ----- User actions -----
  function go(viewName){view=viewName;editSlotIndex=null;reveal=null;render();if(COMMUNITY_VIEWS.has(viewName))refreshCommunityPage(viewName);if(viewName==='multiplayer')loadPublicRooms().then(()=>{if(view==='multiplayer'&&!activeOnlineRoom)render();}).catch(error=>{console.warn('Could not load public rooms:',error);toast('Не удалось загрузить список комнат. Проверь SQL-настройку мультиплеера.','error');});window.scrollTo({top:0,behavior:'smooth'});}
  function chooseClub(id){const c=db.clubs.find(x=>x.id===id);if(!c)return;db.activeClubId=id;view='home';matchState={stage:'idle'};saveDB();render();toast(`Добро пожаловать в ${c.name}!`);}
  async function createClubFromForm(form){
    if(form.dataset.submitting==='1')return false;
    form.dataset.submitting='1';
    const submit=form.querySelector('[data-action="create-club-submit"]');
    if(submit){submit.disabled=true;submit.textContent='Создаём клуб…';}
    let committed=false;
    try{
      const fd=new FormData(form);const name=String(fd.get('clubName')||'').trim();const country=String(fd.get('country')||'ua');
      if(name.length<2)throw new Error('Название клуба должно содержать минимум 2 символа.');
      if(!COUNTRY[country])throw new Error('Выбери существующую страну клуба.');
      createDraft.symbol=(createDraft.layers||[]).find(l=>l.kind==='symbol')?.value||'★';
      const club=makeClub(name,country,createDraft.symbol,createDraft.logoColor);
      club.lineup=club.players.slice(0,11).map(p=>p.id);
      const nextDb={...db,clubs:[...(db.clubs||[]),club],activeClubId:club.id};
      // Keep the previous snapshot so a failed verification can never leave a phantom club behind.
      const previousRaw=localStorage.getItem(STORE_KEY);
      const serialized=JSON.stringify(nextDb);
      try{
        localStorage.setItem(STORE_KEY,serialized);
        const saved=JSON.parse(localStorage.getItem(STORE_KEY)||'{}');
        if(!(saved.clubs||[]).some(c=>c.id===club.id))throw new Error('Браузер не подтвердил сохранение клуба. Проверь доступное место в хранилище.');
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
  function openPack(type,fromInventory=false,requestedQuantity=1){
    const club=currentClub();if(!club)return;
    const packs={starter:{price:2,count:3,min:50,max:88,weights:[55,28,12,4,1]},national:{price:8,count:4,min:55,max:91,weights:[35,32,20,10,3]},pro:{price:25,count:5,min:60,max:94,weights:[20,30,27,17,6]},elite:{price:75,count:5,min:65,max:96,weights:[10,22,30,25,13]},legend:{price:200,count:6,min:70,max:99,weights:[4,14,27,32,23]},daily:{price:0,count:2,min:50,max:90,weights:[42,30,18,8,2]}};const pack=packs[type];if(!pack)return;
    const today=currentDayKey();if(!fromInventory){toast('Сначала купи пак — он появится в инвентаре.','error');return;}const inventory=ensurePackInventory(club);const quantity=Math.max(1,Math.min(Number(inventory[type])||0,Math.floor(Number(requestedQuantity)||1)));if(quantity<1){toast('Такого пака нет в инвентаре.','error');return;}inventory[type]-=quantity;saveDB();
    const newPlayers=[];
    for(let packIndex=0;packIndex<quantity;packIndex++)for(let i=0;i<pack.count;i++){
      const pool=REAL_PLAYERS;
      const candidates=pool.filter(p=>p.rating>=pack.min&&p.rating<=pack.max);const roll=Math.random()*100;let cumulative=0;const band=pack.weights.findIndex(w=>(cumulative+=w)>=roll);const ranges=[[50,64],[65,74],[75,84],[85,89],[90,99]];const [lo,hi]=ranges[Math.max(0,band)];const bandPool=candidates.filter(p=>p.rating>=lo&&p.rating<=hi);let base=pick(bandPool.length?bandPool:(candidates.length?candidates:pool));const rating=base.rating;base={...base,rating};
      const position=base.position;
      const localizedBase=REAL_PLAYERS.find(p=>p.wiki===base.wiki)||base;const created=createPlayer(position,localizedBase.rating,localizedBase.name,localizedBase.country, {id:'card-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),wiki:base.wiki,realClub:base.club,realPlayer:true,displayPosition:({'GK':'ВР','LB':'ЛЗ','CB':'ЦЗ','RB':'ПЗ','CDM':'ОП','CM':'ЦП','CAM':'АП','LW':'ЛВ','RW':'ПВ','ST':'ЦН'})[position]||position});
      created.positions=({'Nico Paz':['CAM','CM','RW'],'Jude Bellingham':['CAM','CM'],'Federico Valverde':['CM','CDM','RM'],'Joško Gvardiol':['CB','LB'],'Achraf Hakimi':['RB','RWB'],'Nuno Mendes':['LB','LWB'],'Pedri':['CM','CAM'],'Kai Havertz':['ST','CAM'],'Lamine Yamal':['RW','LW'],'Raphinha':['RW','LW'],'Harry Kane':['ST','CF'],'Julián Álvarez':['ST','CF','CAM'],'Cristiano Ronaldo':['ST','LW'],'Andriy Yarmolenko':['RW','CAM'],'Neymar':['LW','CAM']})[base.wiki]||REAL_PLAYER_POSITIONS[base.wiki]||[base.position];created.name=localizedBase.name;created.rating=localizedBase.rating;created.country=localizedBase.country;created.realClub=base.club;created.wiki=base.wiki;created.realPlayer=true;created.displayPosition=({GK:'ВР',LB:'ЛЗ',CB:'ЦЗ',RB:'ПЗ',CDM:'ОП',CM:'ЦП',CAM:'АП',LW:'ЛВ',RW:'ПВ',ST:'ЦН'})[base.position]||base.position;
      const duplicate=club.players.find(p=>p.name===created.name)||newPlayers.find(p=>p.name===created.name);if(duplicate){created.duplicateOf=duplicate.id;created.duplicate=true;}created.contractUntil=Date.now()+30*86400000;newPlayers.push(created);
    }
    const actualPlayers=[];let duplicateRewards=[];newPlayers.forEach(p=>{if(p.duplicate){duplicateRewards.push(p); }else actualPlayers.push(p);});club.players.push(...actualPlayers);club.stats.packsOpened=(club.stats.packsOpened||0)+quantity;recordTrophies(club);saveDB();reveal={type,packCount:quantity,players:newPlayers,duplicateRewards,skipAnimation:db.packAnimations===false,animationSerial:++packAnimationSerial};render();
    if(db.packAnimations!==false){if(db.packVibration!==false)vibrate([28,35,48,45,90]);playPackSoundSequence(newPlayers);}
  }
  function positionScore(p,target){const penalty=positionPenalty(p,target);return penalty===0?20:penalty===-8?8:penalty===-35?-35:-18;}
  function assignPlayer(slotIndex,playerId){
    const club=currentClub();if(!club)return;
    const newPlayer=club.players.find(p=>p.id===playerId);if(!newPlayer)return;if(playerIsUnavailable(newPlayer)){toast(`Игрок недоступен: ${unavailableReason(newPlayer)}.`,'error');return;}const target=(FORMATIONS[club.formation]||FORMATIONS['4-3-3'])[slotIndex].role;const penalty=positionPenalty(newPlayer,target);
    const previousId=club.lineup[slotIndex];const otherIndex=club.lineup.indexOf(playerId);
    if(otherIndex>=0){club.lineup[otherIndex]=previousId||null;}club.lineup[slotIndex]=playerId;if(club.captainId===previousId||!club.lineup.includes(club.captainId))club.captainId=playerId;
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
    club.lineup=result;if(!club.lineup.includes(club.captainId))club.captainId=club.lineup[0]||null;saveDB();render();toast('Состав автоматически собран по рейтингу и позициям.');
  }
  function compatible(a,b){if(a===b)return true;const groups=[['LB','RB','LWB','RWB'],['CM','CAM','CDM','LM','RM'],['LW','RW','ST','CF'],['CB','CDM']];return groups.some(g=>g.includes(a)&&g.includes(b));}
  function makeBotRoster(targetRating){
    const roles=(FORMATIONS['4-3-3']||[]).map(x=>x.role);const used=new Set();const roster=[];
    for(const role of roles){
      const candidates=REAL_PLAYERS.filter(p=>!used.has(p.wiki)).map(p=>{const positions=REAL_PLAYER_POSITIONS[p.wiki]||[p.position];const copy={...p,realClub:p.club,positions,assignedPosition:role,injuryMatches:0};const fit=positionScore(copy,role);const effective=playerOVRAt(copy,role,null);const score=Math.abs(effective-targetRating)+(fit<0?Math.abs(fit)*.45:0)+rand(0,2.2);return {p:copy,score};}).sort((a,b)=>a.score-b.score);
      const chosen=candidates[0]?.p;if(chosen){used.add(chosen.wiki);roster.push(chosen);}
    }
    return roster;
  }
  async function startSearch(){
    const club=currentClub();if(!club)return;
    clearMatchTimers();
    const starters=activePlayers(club);
    if(starters.length!==11){toast('Сначала собери полный стартовый состав из 11 игроков.','error');view='team';render();return;}
    const unavailable=starters.filter(playerIsUnavailable);
    if(unavailable.length){toast(`Поиск матча недоступен: ${unavailable.map(p=>`${p.name} — ${unavailableReason(p)}`).join('; ')}.`,'error');view='team';render();return;}
    const exhausted=starters.filter(p=>(Number(p.stamina)||0)<=0);
    if(exhausted.length){toast(`Матч недоступен: у ${exhausted.map(p=>playerDisplayName(p)).join(', ')} закончилась выносливость. Замени или восстанови игрока.`,'error');view='team';render();return;}
    refreshEnergy(club);if(club.energy<1){toast('Энергия команды закончилась. Подожди восстановления или используй пополнение.','error');view='match';render();return;}
    stopOnlineRoomSync();activeOnlineRoom=null;try{localStorage.removeItem('zfActiveOnlineRoomId');}catch(_){}
    const deadline=Date.now()+30000;matchState={stage:'searching',searchDeadline:deadline};view='match';render();
    if(!ZF_SUPABASE||zfOfflineMode){matchState.timer=setTimeout(launchBotFallback,900);return;}
    try{
      const user=await authenticatedUser();
      const {data,error}=await ZF_SUPABASE.rpc('zf_join_matchmaking',{p_club:onlineClubSnapshot(club)});
      if(error)throw error;
      if(data?.status==='matched'&&data.room_id){await openQuickMatchRoom(data.room_id);return;}
      if(matchState.stage!=='searching')return;
      matchmakingPoll=setInterval(()=>{if(matchState.stage==='searching')pollQuickMatch();},1000);
      matchState.timer=setTimeout(async()=>{
        if(matchState.stage!=='searching')return;
        if(matchmakingPoll){clearInterval(matchmakingPoll);matchmakingPoll=null;}
        try{await ZF_SUPABASE.rpc('zf_cancel_matchmaking');}catch(_){}
        launchBotFallback();
      },30000);
      await pollQuickMatch();
    }catch(error){
      console.warn('Quick matchmaking unavailable:',error);
      clearMatchTimers();matchState={stage:'searching',searchDeadline:Date.now()+1500};render();
      matchState.timer=setTimeout(()=>{if(matchState.stage==='searching'){launchBotFallback();toast('Онлайн-поиск недоступен. Запускаем матч с ботом.','error');}},1500);
    }
  }
  function beginMatch(){
    const club=currentClub();if(!club)return;
    if(matchState.agreementTimer)clearTimeout(matchState.agreementTimer);matchState.agreementTimer=null;
    if(matchState.timer)clearTimeout(matchState.timer);matchState.timer=null;refreshEnergy(club);if(club.energy<1){toast('Нет энергии для матча.','error');return;}
    if(matchState.stage!=='found'||!matchState.opponent){toast('Матч больше не ожидает подтверждения.','error');return;}
    if(matchState.agreementDeadline&&Date.now()>matchState.agreementDeadline){clearMatchTimers();matchState={stage:'idle'};render();toast('Время на принятие матча истекло.','error');return;}
    if(!club.lineup||club.lineup.length<11){toast('Сначала настрой стартовый состав.','error');return;}const unavailable=activePlayers(club).filter(playerIsUnavailable);if(unavailable.length){toast(`В стартовом составе есть недоступные игроки: ${unavailable.map(p=>p.name).join(', ')}. Замени их.`,'error');view='team';render();return;}const exhausted=activePlayers(club).filter(p=>(Number(p.stamina)||0)<=0);if(exhausted.length){toast(`Нельзя начать матч: у ${exhausted.map(playerDisplayName).join(', ')} нулевая выносливость.`,'error');view='team';render();return;}club.energy--;saveDB();
    const opp=matchState.opponent||{name:'Northside United',symbol:'❄️',country:'🇳🇴',color:'#a5c7ed',rating:68};
    matchState={stage:'live',opponent:opp,score:[0,0],eventIndex:0,minute:8,currentEvent:null,completedEvents:0,turnOrder:['home','away'],multiplayerTurnModel:{roles:['attacker','defender'],alternate:true,diceSides:20},log:[{minute:0,text:'Матч начался! Обе команды готовы бороться за победу.'}],goodChoices:0,totalChoices:0,preMatchStatuses:Object.fromEntries(club.players.map(p=>[p.id,{injury:p.injuryMatches||0,red:p.redCardMatches||0,yellowBan:p.yellowBanMatches||0}])),stats:{user:{attacks:0,shots:0,onTarget:0,passes:0,defensiveActions:0},opponent:{attacks:0,shots:0,onTarget:0,passes:0,defensiveActions:0}},scorers:[],lineupAtStart:[...club.lineup],captainIdAtStart:club.captainId,goalkeeperIdAtStart:club.lineup[(FORMATIONS[club.formation]||FORMATIONS['4-3-3']).findIndex(slot=>slot.role==='GK')]||null};
    makeCurrentEvent();render();
  }
  function makeCurrentEvent(){
    const club=currentClub(),m=matchState,userStrength=teamRating(club),diff=userStrength-m.opponent.rating;
    const mins=[8,17,26,35,45,54,63,72,81,89],minute=mins[m.eventIndex]||88;m.minute=minute;
    m.recentEventTitles=Array.isArray(m.recentEventTitles)?m.recentEventTitles:[];
    m.recentSetPieces=Array.isArray(m.recentSetPieces)?m.recentSetPieces:[];
    const setPieceRoll=Math.random();
    if(setPieceRoll<.065){
      const kinds=['penalty','corner','freekick'].filter(k=>!m.recentSetPieces.slice(-2).includes(k));
      const kind=pick(kinds.length?kinds:['corner']);
      const side=Math.random()<.5?'user':'opponent',attackName=side==='user'?club.name:(m.opponent.name||'Соперник');
      const templates={
        penalty:{zone:'11 МЕТРОВ',title:'ПЕНАЛЬТИ!',description:side==='user'?'Выбери угол удара. Вратарь соперника попытается угадать направление.':'Соперник готовится пробить с точки. Выбери направление для вратаря и попытайся отразить удар.'},
        corner:{zone:'УГЛОВОЙ ФЛАГ',title:'УГЛОВОЙ',description:side==='user'?'Выбери подачу на ближнюю или дальнюю штангу либо короткий розыгрыш.':'Соперник готовит подачу. Выбери, как закрыть ближнюю и дальнюю зоны.'},
        freekick:{zone:'ШТРАФНОЙ',title:side==='user'?'ШТРАФНОЙ':'ШТРАФНОЙ СОПЕРНИКА',description:side==='user'?'Выбери исполнителя и траекторию удара.':'Реши, сколько игроков поставить в стенку и какой угол закрыть вратарю.'}
      };
      const t=templates[kind];m.recentSetPieces.push(kind);m.recentSetPieces=m.recentSetPieces.slice(-3);
      m.currentEvent={side,attacker:side,defender:side==='user'?'opponent':'user',turnIndex:m.eventIndex||0,kind,minute,zone:t.zone,title:t.title,description:t.description,scenario:side==='user'?'setpiece':'defend'};
      return;
    }
    const userAttacks=Math.random()<clamp(.5+diff*.009,.32,.68);
    const userTemplates=[
      {zone:'ЦЕНТРАЛЬНАЯ ЗОНА',title:'Комбинация у штрафной',description:'Полузащитник нашёл пространство между линиями. Защита соперника сжимается — выбери продолжение атаки.',image:'Короткий пас',scenarios:['buildup','one-two']},
      {zone:'ПРАВЫЙ ФЛАНГ',title:'Свободная зона на фланге',description:'Вингер выиграл метр пространства. Можно обыграть защитника, прострелить или перевести мяч.',image:'Навес',scenarios:['wing','dribble']},
      {zone:'ПЕРЕД ШТРАФНОЙ',title:'Момент для решающего паса',description:'Нападающий открывается за спины защитникам. Точный пас создаст опасность, ошибка приведёт к контратаке.',image:'Пас за спину',scenarios:['counter','buildup']},
      {zone:'КРАЙ ШТРАФНОЙ',title:'Защитник вышел навстречу',description:'Защитник не даёт развернуться. Можно сыграть в стенку, обыграть соперника или пробить.',image:'Обводка',scenarios:['dribble','press']},
      {zone:'ЛЕВЫЙ ФЛАНГ',title:'Двойка на левом фланге',description:'Крайний защитник подключился к вингеру. Реши, продолжить ли розыгрыш или сразу доставить мяч в штрафную.',image:'Перевод фланга',scenarios:['wing','one-two']},
      {zone:'ЦЕНТР ПОЛЯ',title:'Контратака после перехвата',description:'Соперник потерял мяч, впереди свободное пространство. Выбери скорость перехода в атаку.',image:'Быстрая контратака',scenarios:['counter','through']},
      {zone:'ПРАВЫЙ КРАЙ ШТРАФНОЙ',title:'Прострел под удар',description:'Мяч доставлен вдоль штрафной. Одно касание может вывести партнёра на ударную позицию.',image:'Прострел назад',scenarios:['wing','one-two']},
      {zone:'ДАЛЬНЯЯ ДУГА',title:'Второй темп атаки',description:'Защита отбила первую подачу, но подбор остался за твоей командой. Выбери следующий ход.',image:'Удар издали',scenarios:['buildup','counter']},
      {zone:'ПОЛУФЛАНГ',title:'Перегруз центра',description:'Три игрока стягивают соперника в одну зону. Найди свободного партнёра или рискни вертикальной передачей.',image:'Вертикальный пас',scenarios:['buildup','through']},
      {zone:'ПРАВАЯ БРОВКА',title:'Рывок за спину защитнику',description:'Крайний нападающий начинает рывок в свободный коридор. Важен момент передачи.',image:'Пас за спину',scenarios:['through','wing']},
      {zone:'ЦЕНТР ШТРАФНОЙ',title:'Подбор после рикошета',description:'Мяч отскочил к твоему полузащитнику у линии штрафной. Можно пробить сразу или подготовить удар.',image:'Удар издали',scenarios:['shot','buildup']},
      {zone:'ЛЕВЫЙ КРАЙ ШТРАФНОЙ',title:'Один в один у лицевой',description:'Вингер получил мяч почти у лицевой линии. Реши, идти в обводку или отдать пас назад.',image:'Обводка',scenarios:['dribble','wing']}
    ];
    const opponentTemplates=[
      {zone:'ЦЕНТР ПОЛЯ',title:'Соперник разгоняет атаку',description:'Противник движется вперёд через центр. Реши, насколько высоко встречать его и какую зону закрыть.',image:'Быстрая контратака',scenarios:['defend','press']},
      {zone:'ТВОЯ ШТРАФНАЯ',title:'Опасный прострел',description:'Соперник добрался до фланга и ищет передачу в штрафную. Не оставляй свободного игрока.',image:'Прострел назад',scenarios:['box','defend']},
      {zone:'ЗОНА ПОЛУЗАЩИТЫ',title:'Потеря мяча под прессингом',description:'Соперник перехватил передачу и пытается использовать свободное пространство. Выбери способ остановить атаку.',image:'Перекрыть пас',scenarios:['press','counter']},
      {zone:'ПЕРЕД ШТРАФНОЙ',title:'Соперник готовит удар',description:'Атакующий нашёл позицию перед штрафной. Можно накрыть удар или компактно закрыть пространство.',image:'Удар по воротам',scenarios:['defend','box']},
      {zone:'ЛЕВЫЙ ФЛАНГ',title:'Перегруз на фланге',description:'Два соперника разыгрывают мяч у боковой линии. Выбери, кого встречать и как перекрыть передачу.',image:'Удвоить опеку',scenarios:['press','defend']},
      {zone:'ЦЕНТРАЛЬНЫЙ КОРИДОР',title:'Передача между линиями',description:'Пас прошёл в свободную зону между защитой и полузащитой. Нужно быстро закрыть принимающего игрока.',image:'Перекрыть пас',scenarios:['box','defend']},
      {zone:'ПРАВЫЙ ФЛАНГ',title:'Навес на дальнюю штангу',description:'Соперник готовит подачу на дальнюю штангу. Расставь защитников и выбери способ помешать удару.',image:'Навес',scenarios:['box','defend']},
      {zone:'У ВХОДА В ШТРАФНУЮ',title:'Соперник ищет свободный удар',description:'Нападающий готов принять мяч перед штрафной. Реши, выйти на него или удержать линию.',image:'Вступить в отбор',scenarios:['defend','press']},
      {zone:'ПРАВЫЙ ПОЛУФЛАНГ',title:'Соперник переводит игру',description:'Противник быстро меняет направление атаки. Нужно успеть сместить линию и закрыть дальний фланг.',image:'Сменить фланг',scenarios:['defend','press']},
      {zone:'ПЕРЕД ВРАТАРСКОЙ',title:'Рывок нападающего к мячу',description:'Форвард соперника открывается между центральными защитниками. Выбери, кто будет страховать рывок.',image:'Удар головой',scenarios:['box','defend']},
      {zone:'ЦЕНТР ОБОРОНЫ',title:'Ошибка при выходе из обороны',description:'Соперник накрывает первую передачу после отбора. Реши, сыграть проще или рискнуть пасом вперёд.',image:'Перекрыть пас',scenarios:['press','clear']},
      {zone:'ЛЕВАЯ ШТРАФНАЯ',title:'Соперник смещается под удар',description:'Атакующий уходит с фланга в центр и готовит удар рабочей ногой. Закрой траекторию и не дай пробить.',image:'Подкат в момент',scenarios:['defend','box']}
    ];
    const pool=userAttacks?userTemplates:opponentTemplates;
    const recent=new Set(m.recentEventTitles.slice(-6));
    const candidates=pool.filter(x=>!recent.has(x.title));
    const e=pick(candidates.length?candidates:pool);
    m.recentEventTitles.push(e.title);m.recentEventTitles=m.recentEventTitles.slice(-6);
    m.currentEvent={side:userAttacks?'user':'opponent',attacker:userAttacks?'user':'opponent',defender:userAttacks?'opponent':'user',turnIndex:m.eventIndex||0,minute,zone:e.zone,title:e.title,description:e.description,imageKey:e.image,scenario:pick(e.scenarios)};
  }
  function pickGoalScorer(club){
    const starters=activePlayers(club).filter(p=>!playerIsUnavailable(p));
    const ordered=starters.slice().sort((a,b)=>{
      const score=p=>Number(p.shooting||p.rating||60)+(p.position==='ST'||p.position==='CF'?18:0)+(p.position==='LW'||p.position==='RW'?10:0)+(p.position==='CAM'?6:0);
      return score(b)-score(a);
    });
    return ordered[0]||starters[0]||null;
  }
  function recordMatchGoal(side,scorer=null){
    const m=matchState,club=currentClub();if(!m||!Array.isArray(m.score))return null;
    const own=side==='user';const player=own?(scorer||pickGoalScorer(club)):null;
    m.score[own?0:1]++;
    const opponentNames=Array.isArray(m.opponent?.players)?m.opponent.players.map(x=>typeof x==='string'?x:(x?.name||'')).filter(Boolean):[];
    const opponentScorer=own?'':(opponentNames.length?pick(opponentNames):'Нападающий соперника');
    const item={side,playerId:player?.id||null,playerName:own?(player?playerDisplayName(player):'Игрок команды'):opponentScorer,minute:Number(m.minute)||0};
    m.scorers=Array.isArray(m.scorers)?m.scorers:[];m.scorers.push(item);
    return item;
  }
  function playerCareer(p){
    if(!p.careerStats||typeof p.careerStats!=='object')p.careerStats={matches:0,goals:0,cleanSheets:0,captainMatches:0};
    for(const k of ['matches','goals','cleanSheets','captainMatches'])p.careerStats[k]=Math.max(0,Number(p.careerStats[k])||0);
    return p.careerStats;
  }
  function renderPlayerCareerStats(club){
    const rows=(club.players||[]).map(p=>({p,s:playerCareer(p)})).sort((a,b)=>b.s.goals-a.s.goals||b.s.matches-a.s.matches);
    return `<section class="card player-career-card" style="margin:16px 0"><div class="card-header"><div><div class="eyebrow">Статистика футболистов</div><h2 class="h2">КАРЬЕРА В КЛУБЕ</h2><p>Статистика учитывается с матчей этой версии и сохраняется в клубе.</p></div></div><div class="player-career-list"><div class="player-career-row player-career-head"><span>Футболист</span><b>М</b><b>Г</b><b>СИ</b><b>К</b></div>${rows.map(({p,s})=>`<div class="player-career-row"><span class="player-career-name">${esc(playerDisplayName(p))}</span><b>${s.matches}</b><b>${s.goals}</b><b>${s.cleanSheets}</b><b>${s.captainMatches}</b></div>`).join('')}</div><p class="muted tiny" style="margin:10px 0 0">М — матчи, Г — голы, СИ — матчи без пропущенных голов, К — матчи с капитанской повязкой.</p></section>`;
  }
  function ensureConsumables(club){
    if(!club.consumables||typeof club.consumables!=='object')club.consumables={};
    for(const id of ['referee','medic','energyDrink'])club.consumables[id]=Math.max(0,Math.floor(Number(club.consumables[id])||0));
    return club.consumables;
  }
  const TEAM_ITEMS=[
    {id:'referee',name:'Судья',icon:'🟨',price:12,desc:'Снимает красную карточку, бан за перебор жёлтых и накопленные жёлтые карточки с одного выбранного игрока.'},
    {id:'medic',name:'Медик',icon:'🩺',price:18,desc:'Полностью лечит одного футболиста и снимает оставшиеся матчи травмы.'},
    {id:'energyDrink',name:'Энергетик',icon:'⚡',price:8,desc:'Восстанавливает выносливость одного игрока до 100%.'}
  ];
  function renderTeamShop(club){
    const inventory=ensureConsumables(club);
    const items=TEAM_ITEMS.map(item=>`<article class="team-item-card"><div class="team-item-icon">${item.icon}</div><h3>${item.name}</h3><p>${item.desc}</p><div class="statline"><span>В инвентаре</span><b>×${inventory[item.id]}</b></div><div class="statline"><span>Цена</span><b>${formatMoney(item.price)}</b></div><button class="btn btn-primary btn-full" data-action="buy-team-item" data-item="${item.id}" ${club.coins<item.price?'disabled':''}>Купить</button>${inventory[item.id]>0?`<label class="team-item-use-label">Применить к футболисту<select class="select-compact" data-team-item-target="${item.id}"><option value="">Выбрать игрока…</option>${club.players.filter(p=>item.id==='referee'?((p.redCardMatches||0)>0||(p.yellowBanMatches||0)>0||(p.yellowCards||0)>0):item.id==='medic'?(p.injuryMatches||0)>0:(Number(p.stamina)||0)<100).map(p=>`<option value="${esc(p.id)}">${esc(playerDisplayName(p))}</option>`).join('')}</select></label><button class="btn btn-secondary btn-full" data-action="use-team-item" data-item="${item.id}">Использовать</button>`:''}</article>`).join('');
    return `<div class="section-heading"><div><div class="eyebrow">Поддержка состава</div><h1 class="h1">МАГАЗИН КОМАНДЫ</h1><p class="page-subtitle">Покупай расходники, сохраняй здоровье и дисциплину игроков.</p></div><span class="pill pill-lime">${formatMoney(club.coins)}</span></div><div class="team-items-grid">${items}</div>`;
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
    const attackAliases={'safe-pass':'hold','switch-play':'switch','carry':'dribble','cross':'wing','cutback':'wing','fast-break':'through','long-pass':'through','one-touch':'one-two','back-pass':'hold','feint':'dribble','speed':'dribble','body':'hold','pass':'through','recover':'block','foul':'tackle','track':'double'};choice=attackAliases[choice]||choice;const diff=teamRating(club)-m.opponent.rating;
    let text='';let success=false;
    const dice=rand(1,20), teamMod=Math.round(diff/10), tacticalMod=club.style==='attacking'?(ev.side==='user'?2:-1):club.style==='defensive'?(ev.side==='user'?-1:2):0;
    const skillKey=ev.kind==='penalty'||ev.kind==='corner'||choice==='shot'||choice==='longshot'?'shooting':(['through','wing','switch','hold','one-two'].includes(choice)?'passing':choice==='dribble'?'dribbling':(['press','block','tackle','intercept','double','offside','clear','counterpress'].includes(choice)?'defense':'physical'));
    const relevant=activePlayers(club).filter(p=>!playerIsUnavailable(p)).slice().sort((a,b)=>(Number(b[skillKey]??b.rating)-Number(a[skillKey]??a.rating)));
    const chosenPool=relevant.slice(0,Math.min(4,relevant.length));const chosenPlayer=pick(chosenPool.length?chosenPool:activePlayers(club));const playerMod=Math.round(((Number(chosenPlayer?.[skillKey])||chosenPlayer?.rating||70)-70)/10);const diceTotal=dice+teamMod+tacticalMod+playerMod;
    m.stats=m.stats||{user:{attacks:0,shots:0,onTarget:0,passes:0,defensiveActions:0},opponent:{attacks:0,shots:0,onTarget:0,passes:0,defensiveActions:0}};
    m.stats.user={attacks:0,shots:0,onTarget:0,passes:0,defensiveActions:0,...(m.stats.user||{})};m.stats.opponent={attacks:0,shots:0,onTarget:0,passes:0,defensiveActions:0,...(m.stats.opponent||{})};
    const sideStats=m.stats[ev.side==='user'?'user':'opponent'];sideStats.attacks++;
    if(ev.side==='user'&&['through','wing','switch','hold','one-two'].includes(choice))sideStats.passes++;
    if(ev.side!=='user'&&['press','block','tackle','intercept','double','offside','clear','counterpress'].includes(choice))m.stats.user.defensiveActions++;
    if(ev.kind==='penalty'||ev.kind==='corner'||ev.kind==='freekick')sideStats.shots++;
    if(ev.side==='user'&&['shot','longshot'].includes(choice))sideStats.shots++;
    
    if(ev.kind==='penalty'){
      const keeper=pick(['левый','центр','правый']);
      const target=choice==='pen-left'?'левый':choice==='pen-right'?'правый':choice==='pen-center'?'центр':choice==='pen-place'?'левый':choice==='pen-power'?'правый':'центр';
      success=(target!==keeper||Math.random()<.25)&&diceTotal>=6;
      if(Math.random()<.82)sideStats.onTarget++;
      if(success){const scorer=recordMatchGoal('user',chosenPlayer);text=`⚽ ${scorer?.playerName||'Игрок'} реализовал пенальти ударом в ${target} угол! Вратарь прыгнул ${keeper==='центр'?'по центру':keeper+' угол'}.`;m.goodChoices++;}
      else{text=`🧤 Вратарь угадал направление (${keeper} угол) и отразил пенальти.`;}
    }else if(ev.kind==='corner'){
      const cornerChance=clamp((choice==='corner-shot'?.10:choice==='corner-short'?.17:choice==='corner-edge'?.14:choice==='corner-low'?.18:.22)+(diceTotal-10)*.008,.04,.38);
      success=Math.random()<cornerChance;
      if(success){const scorer=recordMatchGoal('user',chosenPlayer);sideStats.onTarget++;m.goodChoices++;text=`⚽ ${scorer?.playerName||'Игрок'} забивает после углового! Выбран вариант: ${choice==='corner-near'?'ближняя штанга':choice==='corner-far'?'дальняя штанга':choice==='corner-short'?'короткий розыгрыш':'прямой удар'}.`;}
      else{text=`Угловой разыгран (${choice==='corner-near'?'ближняя штанга':choice==='corner-far'?'дальняя штанга':choice==='corner-short'?'короткий пас':'удар с закруткой'}), но защита вынесла мяч.`;}
    }else if(ev.kind==='freekick'){
      const wall=choice==='wall2'?2:choice==='wall3'?3:choice==='wall5'?5:4;
      const keeperBonus=(choice==='keeper-left'||choice==='keeper-right')?.05:0;
      const saved=Math.random()<(wall===5?.68:wall===4?.58:wall===3?.48:.38)+keeperBonus+(diceTotal-10)*.008;
      success=saved;
      if(Math.random()<.58)sideStats.onTarget++;
      if(saved){m.goodChoices++;text=`🧤 Стенка из ${wall} игроков помогла закрыть удар; вратарь контролировал ${choice==='keeper-left'?'левый угол':'опасную зону'}.`;}
      else{const scorer=recordMatchGoal('opponent');text=`⚽ ${scorer?.playerName||'Соперник'} забивает со штрафного! Стенка из ${wall} игроков не перекрыла траекторию.`;}
    }else if(ev.side==='user'){
      const base={through:.36,wing:.34,dribble:.31,shot:.20,switch:.32,hold:.42,'one-two':.38,longshot:.16}[choice]??.30;
      const styleBoost=style.attack;
      const chance=clamp(base+diff*.006+styleBoost+(diceTotal-10)*.012,.045,.62);
      const directShot=choice==='shot'||choice==='longshot';
      success=directShot||Math.random()<chance;
      const names={through:'разрезающий пас',wing:'атака через фланг',dribble:'дриблинг',shot:'удар по воротам',switch:'перевод фланга',hold:'удержание мяча','one-two':'стенка в штрафную',longshot:'дальний удар'};
      if(success){
        m.goodChoices++;
        const createdShot=directShot||Math.random()<({through:.68,wing:.64,dribble:.43,switch:.28,hold:.13,'one-two':.62}[choice]??.28);
        if(createdShot){
          if(!directShot)sideStats.shots++;
          const shooting=Number(chosenPlayer?.shooting)||chosenPlayer?.rating||70;
          const conversion=clamp((choice==='shot'?.38:choice==='longshot'?.20:.31)+diff*.0015+(shooting-70)*.0025,.07,.48);
          const onTarget=Math.random()<(choice==='longshot'?.48:.68);
          if(onTarget)sideStats.onTarget++;
          if(onTarget&&Math.random()<conversion){recordMatchGoal('user',chosenPlayer);text=`ГОЛ! ${playerDisplayName(chosenPlayer)} завершает эпизод (${names[choice]||choice}). Точная комбинация и хладнокровный удар!`;}
          else{text=`${club.name}: ${names[choice]||choice} сработал и привёл к удару. ${onTarget?'Вратарь соперника спасает команду.':'Мяч проходит мимо ворот.'}`;}
        }else{text=`${club.name}: ${names[choice]||choice} помог сохранить владение и подготовить следующую атаку.`;}
      }else if(Math.random()<.12){
        text=`${club.name}: ${names[choice]||choice} не прошёл. Соперник перехватил мяч и готовит ответную атаку.`;
        if(Math.random()<clamp(.08+(m.opponent.rating-teamRating(club))*.004,.03,.18)){sideStats.shots++;if(Math.random()<.25){const scorer=recordMatchGoal('opponent');text+=` Контратака заканчивается голом ${scorer?.playerName||'соперника'}!`;}else{text+=' Удар соперника — вратарь на месте.';}}
      }else{text=`${club.name}: ${names[choice]||choice} не принёс результата. Защита соперника успела перестроиться.`;}
    }else{
      const base={press:.53,block:.66,tackle:.55,intercept:.59,double:.56,offside:.43,clear:.65,counterpress:.51}[choice]??.54;
      const styleBoost=style.defense;const chance=clamp(base+(m.opponent.rating-teamRating(club))*.004+styleBoost+(diceTotal-10)*.009,.25,.88);
      const names={press:'высокий прессинг',block:'низкий блок',tackle:'отбор',intercept:'перехват передачи',double:'удвоенная опека',offside:'искусственный офсайд',clear:'вынос из штрафной',counterpress:'контрпрессинг'};
      if(Math.random()<chance){
        sideStats.shots++;
        const onTarget=Math.random()<.62;if(onTarget)sideStats.onTarget++;
        const goalChance=clamp(.29+(m.opponent.rating-teamRating(club))*.0015,.16,.42);
        if(onTarget&&Math.random()<goalChance){const scorer=recordMatchGoal('opponent');text=`Гол соперника (${scorer?.playerName||'игрок'}). ${names[choice]||choice} не сработал — противник завершил атаку точным ударом.`;}
        else{text=`Соперник прошёл через ${names[choice]||choice} и пробил. ${onTarget?'Вратарь спасает команду.':'Мяч летит мимо ворот.'}`;}
      }else{
        success=true;m.goodChoices++;text=`Хорошая оборона! ${names[choice]||choice} сработал — атака соперника остановлена.`;
        if(Math.random()<.085){text+=' Команда быстро вышла в контратаку, и…';if(Math.random()<.24+Math.max(-.1,Math.min(.1,diff*.004))){const scorer=recordMatchGoal('user');text+=` ГОЛ! ${scorer?.playerName||'Игрок'} завершает идеальный переход из обороны в атаку!`;}else{text+=' момент закончился без удара.';}}
      }
    }
    m.totalChoices++;
    const incidentRoll=Math.random();
    const userIsDefending=ev.side!=='user';
    const incidentPlayer=userIsDefending?pick(activePlayers(club)):null;
    const incidentTeam=userIsDefending?club.name:(m.opponent.name||'Соперник');
    const incidentScoreIndex=userIsDefending?1:0;
    if(!ev.kind&&incidentRoll<.0035){
      if(incidentPlayer){const p=incidentPlayer;const injury=ZF_INJURY_TYPES[Math.floor(Math.random()*ZF_INJURY_TYPES.length)];const recovery=Math.round(rand(injury.min,injury.max));p.injuryMatches=Math.max(p.injuryMatches||0,recovery);p.injuryType=injury.name;p.injuryDescription=injury.detail;p.injurySeverity=recovery>=5?'Серьёзная':recovery>=3?'Средняя':'Лёгкая';m.pendingForcedSub=p.id;m.pendingForcedSlot=club.lineup.indexOf(p.id);m.pendingForcedType='injury';text+=` 🤕 Травма: ${playerDisplayName(p)} — ${injury.name.toLowerCase()}. ${injury.detail} Игрок пропустит ${recovery} ${matchCountLabel(recovery)} — обязательная замена.`;}
      else text+=` 🤕 Травма у футболиста команды ${incidentTeam}. Медицинская бригада выходит на поле.`;
    }
    else if(!ev.kind&&incidentRoll<.012){
      if(incidentPlayer){const p=incidentPlayer;p.redCardMatches=Math.max(p.redCardMatches||0,1);m.pendingForcedSub=p.id;m.pendingForcedSlot=club.lineup.indexOf(p.id);m.pendingForcedType='red';text+=` 🟥 Красная карточка! ${playerDisplayName(p)} удалён — обязательная замена.`;}
      else text+=` 🟥 Красная карточка футболисту ${incidentTeam}. Соперник остаётся в меньшинстве.`;
    }
    else if(!ev.kind&&incidentRoll<.045){
      if(incidentPlayer){const p=incidentPlayer;p.yellowCards=(p.yellowCards||0)+1;p.yellowCardTotal=(p.yellowCardTotal||0)+1;if(p.yellowCards>=5){p.yellowCards=0;p.yellowBanMatches=Math.max(p.yellowBanMatches||0,1);text+=` 🟨 Пятая жёлтая карточка у ${p.name}! Он пропустит следующий матч.`;}else{text+=` 🟨 Жёлтая карточка игроку ${p.name} (${p.yellowCards}/5).`;}}
      else text+=` 🟨 Судья показывает жёлтую карточку игроку команды ${incidentTeam}.`;
    }
    else if(!ev.kind&&incidentRoll<.075){
      sideStats.shots++;text+=` 🚩 Угловой: команда ${incidentTeam} подаёт в штрафную.`;
      if(Math.random()<.20){m.score[incidentScoreIndex]++;sideStats.onTarget++;text+=` ГОЛ после углового в исполнении ${incidentTeam}!`;}
    }
    else if(!ev.kind&&incidentRoll<.095){
      sideStats.shots++;text+=` 🎯 Штрафной у команды ${incidentTeam}.`;
      if(Math.random()<.14){m.score[incidentScoreIndex]++;sideStats.onTarget++;text+=` Прямой удар — ГОЛ команды ${incidentTeam}!`;}
    }
    else if(!ev.kind&&incidentRoll<.102){
      sideStats.shots++;sideStats.onTarget++;text+=` ⚽ Пенальти! Команда ${incidentTeam} у точки.`;
      if(Math.random()<(userIsDefending?.70:.72)){m.score[incidentScoreIndex]++;text+=' Пенальти реализован!';}else text+=' Вратарь отбил удар!';
    }
    if(!m.pendingForcedSub&&m.eventIndex===4&&!m.substitutionsDone&&benchPlayers(club).length){m.substitutionsDone=true;const formation=FORMATIONS[club.formation]||FORMATIONS['4-3-3'];const outEntry=club.lineup.map((id,i)=>({p:club.players.find(x=>x.id===id),i,role:formation[i]?.role})).filter(x=>x.p).sort((a,b)=>playerOVRAt(a.p,a.role,club)-playerOVRAt(b.p,b.role,club))[0];if(outEntry){const sub=benchPlayers(club).filter(p=>!playerIsUnavailable(p)).map(p=>({p,ovr:playerOVRAt(p,outEntry.role,club)})).sort((a,b)=>b.ovr-a.ovr)[0]?.p;if(sub){club.lineup[outEntry.i]=sub.id;if(club.captainId===outEntry.p.id)club.captainId=sub.id;text+=` 🔄 Замена: ${playerDisplayName(outEntry.p)} (${positionLabel(outEntry.role)}) → ${playerDisplayName(sub)} (${playerOVRAt(sub,outEntry.role,club)} OVR).`;}}}
    m.availableChoices=[];
    m.log.push({minute:ev.minute,imageKey:ev.imageKey||matchActionKey(ev.title)||(ev.kind==='corner'?'Угловой':ev.kind==='freekick'?'Штрафной':ev.kind==='penalty'?'Пенальти':''),text:`🎙️ ${text}`});
    m.completedEvents=(m.completedEvents||0)+1;
    if(m.eventIndex===9){
      // The tenth decision is the final whistle. Incidents in this last episode
      // remain recorded on the player for the next match, but must not trap the user
      // on the mandatory-substitution screen after the match has already ended.
      m.eventIndex=10;m.completedEvents=10;m.actionDeadline=null;m.availableChoices=[];m.pendingForcedSub=null;m.pendingForcedSlot=null;m.pendingForcedType=null;m.resolvingEvent=null;
      let finalized=false;try{finalized=finishMatch(true);}catch(finalError){console.error('Final whistle failed on final decision:',finalError);}if(!finalized){m.finalized=false;m.stage='live';m.eventIndex=10;m.completedEvents=10;try{finishMatch(false);}catch(retryError){console.error('Match finalization retry failed:',retryError);toast('Не удалось закрыть матч. Попробуй нажать «Завершить матч» ещё раз.','error');}}return;
    }
    m.eventIndex++;m.resolvingEvent=null;makeCurrentEvent();render();
  }
  function finishMatch(fromFinalDecision=false){
    const club=currentClub();const m=matchState;
    if(!club||!m||m.finalized)return false;
    if(fromFinalDecision&&m.stage==='result')return true;
    const completed=Math.max(Number(m.completedEvents)||0,Number(m.eventIndex)||0);
    if(!fromFinalDecision&&completed<10)return false;
    if(fromFinalDecision&&m.stage!=='live')return false;
    // Normalize older or partially migrated club saves before applying match statistics.
    const statDefaults={matches:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,packsOpened:0,cleanSheets:0,captainMatches:0};
    club.stats={...statDefaults,...(club.stats&&typeof club.stats==='object'?club.stats:{})};
    Object.keys(statDefaults).forEach(key=>{const n=Number(club.stats[key]);club.stats[key]=Number.isFinite(n)?Math.max(0,n):0;});
    m.score=Array.isArray(m.score)?[Math.max(0,Number(m.score[0])||0),Math.max(0,Number(m.score[1])||0)]:[0,0];
    m.log=Array.isArray(m.log)?m.log:[];m.opponent=m.opponent||{name:'Соперник'};m.stats=m.stats||{user:{},opponent:{}};m.stats.user={attacks:0,shots:0,onTarget:0,passes:0,defensiveActions:0,...(m.stats.user||{})};m.stats.opponent={attacks:0,shots:0,onTarget:0,passes:0,defensiveActions:0,...(m.stats.opponent||{})};
    m.finalized=true;m.eventIndex=10;m.completedEvents=10;clearMatchTimers();m.actionTimer=null;m.actionDeadline=null;m.stage='result';m.minute=90;
    const won=m.score[0]>m.score[1],draw=m.score[0]===m.score[1];m.reward=won?0.8:draw?0.55:0.35;
    club.coins=(Number(club.coins)||0)+m.reward;club.stats.matches++;m.sponsorBonus=0;club.sponsorSlots=club.sponsorSlots||{kit:null,title:null,extra:null};Object.entries(club.sponsorSlots).forEach(([type,contract])=>{if(!contract)return;if(contract.until>Date.now()){const deal=SPONSOR_DEALS.find(x=>x.id===contract.id);if(deal){const bonus=(deal.match+(won?deal.win:0))*sponsorRewardMultiplier(club);club.coins+=bonus/1000;m.sponsorBonus+=bonus/1000;}}else club.sponsorSlots[type]=null;});club.sponsorContract=club.sponsorSlots.title||club.sponsorSlots.kit||club.sponsorSlots.extra||null;
    if(won)club.stats.wins++;else if(draw)club.stats.draws++;else club.stats.losses++;
    try{addMatchProgression(club,m,won,draw);}catch(progressError){console.error('Match XP could not be applied:',progressError);m.xpEarned=0;m.levelUps=0;}
    club.stats.goalsFor+=m.score[0];club.stats.goalsAgainst+=m.score[1];if(m.score[1]===0)club.stats.cleanSheets++;if(m.captainIdAtStart)club.stats.captainMatches++;
    const appeared=new Set([...(m.lineupAtStart||[]),...(club.lineup||[])]);
    appeared.forEach(id=>{const player=club.players.find(p=>p.id===id);if(!player)return;const cs=playerCareer(player);cs.matches++;if(m.score[1]===0)cs.cleanSheets++;if(m.captainIdAtStart===id)cs.captainMatches++;});
    (m.scorers||[]).filter(g=>g.side==='user'&&g.playerId).forEach(g=>{const player=club.players.find(p=>p.id===g.playerId);if(player)playerCareer(player).goals++;});
    // Only bans/injuries that existed before this match count down; new incidents remain active.
    (club.players||[]).forEach(p=>{const wasStarter=(club.lineup||[]).includes(p.id);p.stamina=clamp((Number(p.stamina)||0)+(wasStarter?-rand(7,12):rand(8,14)),0,100);const prior=m.preMatchStatuses?.[p.id];if(prior?.injury>0){p.injuryMatches=Math.max(0,(p.injuryMatches||0)-1);if(!p.injuryMatches){delete p.injuryType;delete p.injuryDescription;delete p.injurySeverity;}}if(prior?.red>0)p.redCardMatches=Math.max(0,(p.redCardMatches||0)-1);if(prior?.yellowBan>0)p.yellowBanMatches=Math.max(0,(p.yellowBanMatches||0)-1);});
    const result=won?'W':draw?'D':'L';club.history=Array.isArray(club.history)?club.history:[];club.history.unshift({opponent:m.opponent.name||'Соперник',score:`${m.score[0]} : ${m.score[1]}`,result,date:new Date().toLocaleDateString('ru-RU')});club.history=club.history.slice(0,12);
    if(!m.log.some(entry=>entry.minute===90&&String(entry.text||'').startsWith('Финальный свисток.')))m.log.push({minute:90,text:`Финальный свисток. ${won?'Победа твоего клуба!':draw?'Ничья — команды разделили очки.':'Поражение. В следующем матче можно отыграться.'} Награда: ${formatMoney(m.reward)}. Опыт: +${m.xpEarned||0} XP.${m.levelUps?` Новый уровень: ${progressionState(club).level}. Бонус +${formatMoney(m.levelUps*.04)}.`:''}${m.sponsorBonus?` Спонсорский бонус: +${m.sponsorBonus}.`:''}`});
    view='match';
    try{recordTrophies(club);}catch(trophyError){console.warn('Could not record match trophies:',trophyError);}
    const saved=saveDB();
    if(ZF_SUPABASE&&zfAuthSession)ZF_SUPABASE.rpc('zf_clan_record_match',{p_win:won}).then(({error})=>{if(error)console.warn('Clan match progress was not recorded:',error);}).catch(error=>console.warn('Clan match progress was not recorded:',error));
    try{render();}catch(renderError){console.error('Could not render match result:',renderError);const root=$('#app');if(root){root.innerHTML=`<main class="main-area"><section class="card" style="text-align:center"><h1 class="h1">ФИНАЛЬНЫЙ СВИСТОК</h1><div class="result-stamp">${m.score[0]} : ${m.score[1]}</div><p>Матч завершён. Результат сохранён в истории клуба.</p><button class="btn btn-primary" data-action="nav" data-view="match">Открыть матч</button></section></main>`;}}
    if(!saved)toast('Матч завершён, но браузер не смог сохранить результат. Освободи место в хранилище.','error');return true;
  }

  const MUSIC_STYLES = {
    ambient:{name:'Спокойная',icon:'🌙',bpm:78,wave:'sine',pad:'triangle',cutoff:1500,scale:[0,2,4,7,9],chords:[[0,4,7],[5,9,12],[3,7,10],[4,7,11]],drums:false},
    electronic:{name:'Электронная',icon:'⚡',bpm:116,wave:'sawtooth',pad:'triangle',cutoff:2600,scale:[0,2,3,7,9],chords:[[0,3,7],[5,8,12],[3,7,10],[7,10,14]],drums:'electronic'},
    stadium:{name:'Драйвовая',icon:'🏟️',bpm:108,wave:'square',pad:'sawtooth',cutoff:1900,scale:[0,2,4,5,7,9,10],chords:[[0,4,7],[7,11,14],[5,9,12],[3,7,10]],drums:'stadium'},
    rock:{name:'Рок',icon:'🎸',bpm:124,wave:'sawtooth',pad:'square',cutoff:3300,scale:[0,2,4,7,9,10],chords:[[0,7,12],[5,12,17],[3,10,15],[7,14,19]],drums:'rock'}
  };
  // CC0 tracks are streamed from the creators' OpenGameArt file pages.
  // HTMLAudioElement can play cross-origin media without granting canvas/audio-buffer access.
  const MUSIC_LIBRARY = [
    {id:'menu-beat',name:'Menu Music',genre:'Спокойный электронный бит',artist:'wipics',style:'ambient',icon:'🌙',url:'https://opengameart.org/sites/default/files/menu_3.ogg',source:'https://opengameart.org/content/menu-music-1'},
    {id:'shine-blitz',name:'Shine Blitz',genre:'Мелодичный upbeat',artist:'zesona (Chris Murphy)',style:'stadium',icon:'✨',url:'https://opengameart.org/sites/default/files/shineblitz_0.ogg',source:'https://opengameart.org/content/shine-blitz'},
    {id:'empacotatron',name:'Empacotatron',genre:'Энергичная электроника / techno',artist:'Fupi',style:'electronic',icon:'⚡',url:'https://opengameart.org/sites/default/files/empacotatron_loop.ogg',source:'https://opengameart.org/content/empacotatron'},
    {id:'trash-rock',name:'I Am Not Trash',genre:'Бодрый рок / power chords',artist:'Centurion_of_war',style:'rock',icon:'🎸',url:'https://opengameart.org/sites/default/files/trash1.91_v1ext_0.ogg',source:'https://opengameart.org/content/i-am-not-trash-or-am-i'},
    {id:'eerie-choir',name:'Eerie Choir',genre:'Мрачный хор / атмосферная музыка',artist:'TheFrenchDodo',style:'ambient',icon:'🌫️',url:'https://opengameart.org/sites/default/files/eeriechoir.ogg',source:'https://opengameart.org/content/retro-tunes'},
    {id:'icy-adventure',name:'Icy Adventure',genre:'Приключенческая электронная тема',artist:'TheFrenchDodo',style:'stadium',icon:'❄️',url:'https://opengameart.org/sites/default/files/icyadventure-loopable.ogg',source:'https://opengameart.org/content/retro-tunes'},
    {id:'retro-bossfight',name:'Retro Boss Fight',genre:'Ретро-бит / музыка битвы',artist:'TheFrenchDodo',style:'electronic',icon:'👾',url:'https://opengameart.org/sites/default/files/retrobossfight-loopable.ogg',source:'https://opengameart.org/content/retro-tunes'},
    {id:'romantic-chill',name:'Romantic Chill',genre:'Мягкая мелодичная тема',artist:'TheFrenchDodo',style:'ambient',icon:'🌆',url:'https://opengameart.org/sites/default/files/romanticchill-loopable.ogg',source:'https://opengameart.org/content/retro-tunes'},
    {id:'our-expanse',name:'Our Expanse',genre:'Кинематографическая электронная музыка',artist:'Bobjt',style:'electronic',icon:'🚀',url:'https://opengameart.org/sites/default/files/our_expanse_-_with_tail-version-0.ogg',source:'https://opengameart.org/content/our-expanse'},
    {id:'chiptune-battle',name:'Chiptune Battle',genre:'Ретро-экшен / 8-bit',artist:'pmiller',style:'electronic',icon:'🕹️',url:'https://opengameart.org/sites/default/files/battle_music_01-loop.ogg',source:'https://opengameart.org/content/chiptune-battle-music'},
    {id:'simple-menu-loop',name:'Simple Menu Loop',genre:'Спокойный фон / меню',artist:'polosik',style:'ambient',icon:'🌿',url:'https://opengameart.org/sites/default/files/simple_loop.ogg',source:'https://opengameart.org/content/simple-menubackground-music-loop'},
    {id:'invincibility',name:'Invincibility',genre:'Энергичный 8-bit / arcade',artist:'Zane Little Music',style:'stadium',icon:'⭐',url:'https://opengameart.org/sites/default/files/invincible.ogg',source:'https://opengameart.org/content/invincibility-loop'},
    {id:'jump',name:'Jump',genre:'Весёлый аркадный chiptune',artist:'ThePixel',style:'electronic',icon:'🎮',url:'https://opengameart.org/sites/default/files/jump.ogg',source:'https://opengameart.org/content/jump'},
    {id:'sherwood',name:'Sherwood',genre:'Мягкий chill / 110 BPM',artist:'zesona (Chris Murphy)',style:'ambient',icon:'🌲',url:'https://opengameart.org/sites/default/files/sherwood.ogg',source:'https://opengameart.org/content/sherwood'},
    {id:'electronic-loop',name:'Electronic Music Loop',genre:'Электроника с ударными',artist:'Rami99',style:'electronic',icon:'🔊',url:'https://opengameart.org/sites/default/files/game.ogg',source:'https://opengameart.org/content/electronic-music-loop'},
    {id:'sadness',name:'Sadness',genre:'Пиано / спокойная драматичная тема',artist:'Kistol',style:'ambient',icon:'🎹',url:'https://opengameart.org/sites/default/files/Sadness.ogg',source:'https://opengameart.org/content/sadness'}
  ];
  function currentMusicTrack(){
    const n=Math.max(0,Math.min(MUSIC_LIBRARY.length-1,Number(db.musicTrack)||0));
    return {...MUSIC_LIBRARY[n],n};
  }
  const MUSIC_MELODIES = [
    [0,2,4,7,4,2,1,2,0,2,5,7,5,4,2,0],
    [0,0,3,0,5,3,7,5,0,0,3,7,8,7,5,3],
    [0,2,4,2,0,4,5,7,9,7,5,4,2,4,7,9],
    [0,0,7,0,5,0,7,0,3,0,8,0,5,0,7,0]
  ];
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
    const active=db.sound!==false&&db.musicEnabled!==false;
    const target=active?(clamp(Number(db.musicVolume??42),0,100)/100)*.72:0;
    if(backgroundAudio)backgroundAudio.volume=clamp(target,0,1);
    const ctx=packAudioContext;
    if(ctx&&musicBus){musicBus.gain.cancelScheduledValues(ctx.currentTime);musicBus.gain.setTargetAtTime(synthFallbackActive?target:0,ctx.currentTime,.18);}
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
    const melody=MUSIC_MELODIES[({ambient:0,electronic:1,stadium:2,rock:3}[track.style])??0];
    const base=track.style==='ambient'?60:track.style==='stadium'?58:track.style==='rock'?55:57;
    const chord=profile.chords[(bar+track.n)%profile.chords.length];
    if(beat===0){
      chord.forEach((interval,i)=>scheduleMusicNote(ctx,base+12+interval,start,1.72,profile.pad,track.style==='ambient'?.034:.028,profile.cutoff,(i-1)*5));
      scheduleMusicNote(ctx,base-12+chord[0],start,1.1,profile.wave,track.style==='rock'?.07:.055,profile.cutoff-250,0);
      if(profile.drums==='electronic'||profile.drums==='stadium'||profile.drums==='rock')scheduleMusicKick(ctx,start,profile.drums==='stadium');
    }
    if((beat===2)&&profile.drums==='rock')scheduleMusicClick(ctx,start,.035);
    if(profile.drums==='stadium'&&beat===2)scheduleMusicKick(ctx,start,true);
    if(profile.drums==='electronic'&&beat===2)scheduleMusicClick(ctx,start,.016);if(profile.drums==='electronic'&&beat===3&&track.n%2)scheduleMusicKick(ctx,start,true);if(profile.drums==='rock'&&beat===1)scheduleMusicKick(ctx,start,true);if(profile.drums==='stadium'&&beat===3&&track.n%2===0)scheduleMusicClick(ctx,start,.02);
    if(profile.drums==='rock'&&beat===2)scheduleMusicClick(ctx,start,.045);
    const stepNote=(track.style==='ambient'&&step%4===3)?null:melody[step%16];
    if(stepNote!==null&&stepNote!==undefined){
      const scale=profile.scale;const degree=(stepNote+bar)%scale.length;const octave=(stepNote>5?1:0);
      const midi=base+12+scale[degree]+octave*12+(track.style==='electronic'?12:0);
      scheduleMusicNote(ctx,midi,start,.48,profile.wave,track.style==='rock'?.06:track.style==='stadium'?.045:.038,profile.cutoff,track.style==='rock'?7:0);
      if(track.style==='electronic'&&beat%2===0)scheduleMusicNote(ctx,midi-12,start,.24,'triangle',.045,900,0);
    }
    musicStep=(musicStep+1)%16;
    const delay=60000/profile.bpm;
    musicLoopTimer=setTimeout(()=>scheduleMusicStep(ctx,generation),delay);
  }
  function startSynthMusicFallback(track=currentMusicTrack()){
    if(db.sound===false||db.musicEnabled===false)return false;
    if(backgroundAudio){backgroundAudio.pause();}
    synthFallbackActive=true;
    const ctx=ensureAudioContext();if(!ctx)return false;
    if(musicLoopTimer){clearTimeout(musicLoopTimer);musicLoopTimer=null;}
    musicGeneration++;musicStep=0;const generation=musicGeneration;setMusicVolume();scheduleMusicStep(ctx,generation);return true;
  }
  function stopBackgroundMusic(){
    synthFallbackActive=false;musicGeneration++;if(musicLoopTimer){clearTimeout(musicLoopTimer);musicLoopTimer=null;}
    musicStep=0;
    if(backgroundAudio){try{backgroundAudio.pause();backgroundAudio.currentTime=0;}catch(_){}}
    if(musicBus&&packAudioContext){try{musicBus.gain.cancelScheduledValues(packAudioContext.currentTime);musicBus.gain.setTargetAtTime(0,packAudioContext.currentTime,.12);}catch(_){}}
  }
  function startBackgroundMusic(){
    if(db.sound===false||db.musicEnabled===false){stopBackgroundMusic();return false;}
    const track=currentMusicTrack();
    synthFallbackActive=false;
    if(musicLoopTimer){clearTimeout(musicLoopTimer);musicLoopTimer=null;}
    musicGeneration++;
    if(!backgroundAudio){
      backgroundAudio=new Audio();backgroundAudio.preload='none';backgroundAudio.loop=true;
      backgroundAudio.addEventListener('error',()=>{
        const failedId=backgroundAudio?.dataset?.trackId;
        if(failedId===currentMusicTrack().id&&db.musicEnabled!==false&&db.sound!==false){
          console.warn('CC0 music stream unavailable; using built-in fallback.');
          startSynthMusicFallback(currentMusicTrack());
        }
      });
    }
    if(backgroundAudio.dataset.trackId!==track.id){
      backgroundAudio.pause();backgroundAudio.dataset.trackId=track.id;backgroundAudio.src=track.url;backgroundAudio.load();
    }
    backgroundAudio.loop=true;setMusicVolume();
    const playResult=backgroundAudio.play();
    if(playResult&&typeof playResult.catch==='function')playResult.catch(error=>{
      if(error?.name!=='NotAllowedError'&&db.musicEnabled!==false&&db.sound!==false)startSynthMusicFallback(track);
    });
    return true;
  }
  function unlockAndStartMusic(){
    musicUnlocked=true;const ctx=ensureAudioContext();
    if(ctx?.state==='suspended')ctx.resume().catch(()=>{});
    if(db.musicEnabled===false||db.sound===false)return;
    if((backgroundAudio&&!backgroundAudio.paused)||musicLoopTimer)return;
    startBackgroundMusic();
  }
  function renderMusicTrackOptions(){
    return MUSIC_LIBRARY.map((track,i)=>`<option value="${i}" ${Number(db.musicTrack)===i?'selected':''}>${track.icon} ${track.name} — ${track.genre}</option>`).join('');
  }

  function getPackAudioContext(){
    if(db.sound===false)return null;
    const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)return null;
    try{if(!packAudioContext)packAudioContext=new AudioCtx();if(packAudioContext.state==='suspended')packAudioContext.resume();return packAudioContext;}catch(_){return null;}
  }
  function playUiTone(frequency=520,duration=.09,volume=.035,wave='sine',delay=0){
    if(db.sound===false)return;volume*=clamp(Number(db.soundVolume??32),0,100)/100;if(volume<=0)return;const ctx=getPackAudioContext();if(!ctx)return;
    try{const start=ctx.currentTime+delay,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=wave;osc.frequency.setValueAtTime(frequency,start);gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),start+.012);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);osc.connect(gain);gain.connect(ctx.destination);osc.start(start);osc.stop(start+duration+.025);}catch(_){}
  }
  function playPackSoundSequence(players=[]){
    if(!db.sound||db.packSound===false)return;const volume=clamp(Number(db.packSoundVolume??12),0,100)/100*.06;if(volume<=0)return;const rating=Number(players[0]?.rating)||60;const base=rating>=90?880:rating>=80?740:rating>=70?587:494;
    playUiTone(base,.13,volume,'sine',0);if(rating>=90)playUiTone(base*1.25,.16,volume*.55,'triangle',.08);
  }
  function vibrate(pattern=18){if(db.vibration!==false&&navigator.vibrate){try{navigator.vibrate(pattern);}catch(_){}}}
  function getCrestLayers(mode){if(mode==='edit'){const club=currentClub();if(!club)return [];if(!Array.isArray(club.logo.layers)||!club.logo.layers.length)club.logo.layers=[{id:'base',kind:'symbol',value:club.logo.symbol||'★',x:50,y:48,size:34,color:'#10140c'}];return club.logo.layers;}return createDraft.layers;}
  function refreshCrestBuilder(mode='create'){
    const layers=getCrestLayers(mode)||[],preview=$(mode==='edit'?'#editCrest':'#createCrest'),list=$(mode==='edit'?'#editLogoLayerList':'#createLogoLayerList');
    if(preview)preview.innerHTML=layers.map(l=>crestLayerMarkup(l,1.85)).join('');
    if(list)list.innerHTML=renderCrestLayerRows(layers,mode);
    if(mode==='edit'){const small=$('#editorPreviewCrest');if(small)small.innerHTML=layers.map(l=>crestLayerMarkup(l,.55)).join('');}
  }
  function updateCrestShape(mode,shape){const ids=mode==='edit'?['#editCrest','#editorPreviewCrest']:['#createCrest'];const known=['shield','round','square','diamond','classic','hexagon','rounded','banner','circle-crest'];ids.forEach(sel=>{const el=$(sel);if(!el)return;el.classList.remove(...known.map(x=>'shape-'+x));el.classList.add('shape-'+shape);});}

  let logoDrag=null;
  $('#app').addEventListener('input',e=>{const price=e.target.closest('.market-transfer-price');if(!price)return;const card=price.closest('.market-sell-card');const mode=card?.querySelector('.market-transfer-mode');if(mode&&mode.value!=='custom')mode.value='custom';});
  $('#app').addEventListener('input',e=>{if(e.target.matches('#market-filter-rating,#market-filter-price'))applyMarketFilters();});
  $('#app').addEventListener('change',e=>{if(e.target.matches('#market-filter-position,#market-filter-duplicate'))applyMarketFilters();});
  $('#app').addEventListener('change',e=>{const mode=e.target.closest('.market-transfer-mode');if(!mode)return;const card=mode.closest('.market-sell-card');if(!card)return;const price=card.querySelector('.market-transfer-price');if(!price)return;const rating=Number(card.querySelector('.market-ovr')?.textContent)||0;const player=currentClub()?.players?.find(p=>String(p.id)===String(card.dataset.marketCardId));if(mode.value==='custom'){price.focus();return;}const factor=mode.value==='quick'?.8:mode.value==='premium'?1.25:1;price.value=(Math.max(.01,Number(marketValue(player?.rating??rating))||.01)*factor).toFixed(2);});
  $('#app').addEventListener('pointerdown',e=>{if(e.button!==0)return;const layer=e.target.closest('.crest-layer');if(!layer)return;const preview=layer.closest('#createCrest,#editCrest');if(!preview)return;const mode=preview.id==='editCrest'?'edit':'create';const item=(getCrestLayers(mode)||[]).find(x=>x.id===layer.dataset.layerId);if(!item)return;logoDrag={id:item.id,preview,mode};layer.setPointerCapture?.(e.pointerId);e.preventDefault();});
  $('#app').addEventListener('pointermove',e=>{if(!logoDrag)return;const r=logoDrag.preview.getBoundingClientRect();const item=(getCrestLayers(logoDrag.mode)||[]).find(x=>x.id===logoDrag.id);if(!item)return;item.x=Math.max(5,Math.min(95,(e.clientX-r.left)/r.width*100));item.y=Math.max(5,Math.min(95,(e.clientY-r.top)/r.height*100));const el=logoDrag.preview.querySelector(`[data-layer-id="${logoDrag.id}"]`);if(el){el.style.left=item.x+'%';el.style.top=item.y+'%';}if(logoDrag.mode==='edit'){const small=$(`#editorPreviewCrest [data-layer-id="${logoDrag.id}"]`);if(small){small.style.left=item.x+'%';small.style.top=item.y+'%';}}});
  $('#app').addEventListener('pointerup',()=>{logoDrag=null;});
  // Disable context menus inside the game. Buttons and form controls remain usable.
  $('#app').addEventListener('contextmenu',e=>e.preventDefault());
  // ----- Event binding (delegated so it continues to work after re-rendering) -----
  $('#app').addEventListener('click',async e=>{
    const btn=e.target.closest('[data-action]');if(!btn)return;
    const action=btn.dataset.action; if(['match-choice','open-pack','assign-player','quick-assign','set-theme'].includes(action))vibrate(action==='match-choice'?[25,20,35]:18);
    if(action==='market-filter-reset'){communityState.marketFilters={position:'all',rating:'',price:'',duplicate:'all'};render();applyMarketFilters();return;}
    if(['community-refresh','copy-player-code','friend-search','friend-send','contact-accept','contact-decline','contact-status','contact-remove','trade-create','trade-accept','trade-decline','trade-cancel','market-search','market-list','market-buy','market-withdraw','market-claim','clan-create','clan-apply','clan-review','clan-invite','clan-invite-reply','clan-disband','clan-kick','clan-leave','competition-create','competition-delete','competition-join','competition-invite','competition-invite-reply','competition-lock','competition-report-result','competition-kick'].includes(action)){try{await handleCommunityAction(action,btn);}catch(error){console.error('Community action failed:',error);toast(error.message||'Действие не выполнено.','error');}return;}
    if(action==='create-club-submit'){const form=$('#createClubForm');if(!form)return;if(!form.reportValidity())return;try{await createClubFromForm(form);}catch(err){console.error('Club creation failed before save:',err);toast(err?.message||'Клуб не сохранён. Проверь данные и доступное место в браузере.','error');}return;}
    if(action==='auth-mode'){authScreenMode=btn.dataset.mode==='signin'?'signin':'signup';authScreenNotice='';render();return;}
    if(action==='offline-continue'){zfOfflineMode=true;view='home';render();toast('Открыт одиночный режим. Для мультиплеера войди в аккаунт.');return;}
    if(action==='cloud-upload'){try{await cloudSave('upload');}catch(err){console.error(err);toast(err.message||'Не удалось сохранить в облако.','error');}return;}
    if(action==='cloud-download'){try{await cloudSave('download');}catch(err){console.error(err);toast(err.message||'Не удалось загрузить облачное сохранение.','error');}return;}
    if(action==='cloud-logout'){try{await cloudSignOut();}catch(err){toast(err.message||'Не удалось выйти.','error');}return;}
    if(action==='retry-club-render'){render();return;}if(action==='start-create'){startMode='create';createDraft={symbol:'★',logoColor:'#c8ff44',shape:'shield',layers:[{id:'base',kind:'symbol',value:'★',x:50,y:48,size:34,color:'#10140c'}]};render();return;}
    if(action==='start-back'){startMode='choose';render();return;}
    if(action==='select-club'){chooseClub(btn.dataset.clubId);return;}
    if(action==='switch-account-settings'){clearMatchTimers();db.activeClubId=null;view='home';startMode='choose';matchState={stage:'idle'};saveDB();render();return;}
    if(action==='set-theme'){db.theme=btn.dataset.theme||'classic';themePanelOpen=true;saveDB();render();toast('Тема оформления изменена.');return;}
    if(action==='toggle-theme-panel'){themePanelOpen=!themePanelOpen;render();return;}
    if(action==='delete-current-club'){const c=currentClub();if(!c)return;clearMatchTimers();if(!confirm(`Удалить клуб «${c.name}» вместе со всем составом и историей?`))return;db.clubs=db.clubs.filter(x=>x.id!==c.id);db.activeClubId=null;view='home';startMode='choose';matchState={stage:'idle'};saveDB();render();toast('Клуб удалён.');return;}
    if(action==='logout-account'){clearMatchTimers();db.activeClubId=null;view='home';startMode='choose';matchState={stage:'idle'};saveDB();render();return;}
    if(action==='delete-club'){clearMatchTimers();const id=btn.dataset.clubId;const c=db.clubs.find(x=>x.id===id);if(!c)return;if(!confirm(`Удалить клуб «${c.name}» вместе с составом и историей?`))return;db.clubs=db.clubs.filter(x=>x.id!==id);if(db.activeClubId===id)db.activeClubId=null;saveDB();startMode='choose';view='home';render();toast('Клуб удалён.');return;}
    if(action==='nav'){go(btn.dataset.view);return;}
    if(action==='buy-team-item'){const c=currentClub(),item=TEAM_ITEMS.find(x=>x.id===btn.dataset.item);if(!c||!item)return;ensureConsumables(c);if(c.coins<item.price){toast('Недостаточно средств.','error');return;}c.coins-=item.price;c.consumables[item.id]++;saveDB();render();toast(`${item.name} добавлен в инвентарь.`);return;}
    if(action==='use-team-item'){const c=currentClub(),id=btn.dataset.item,targetId=$(`[data-team-item-target="${id}"]`)?.value,p=c?.players.find(x=>x.id===targetId);if(!c||!p)return toast('Сначала выбери футболиста.','error');ensureConsumables(c);if(!c.consumables[id])return toast('Предмет закончился.','error');if(id==='referee'){if(!(p.redCardMatches>0||p.yellowBanMatches>0||p.yellowCards>0))return toast('У игрока нет дисциплинарного наказания.','error');p.redCardMatches=0;p.yellowBanMatches=0;p.yellowCards=0;p.yellowCardTotal=0;}else if(id==='medic'){if(!(p.injuryMatches>0))return toast('Игрок не травмирован.','error');p.injuryMatches=0;}else if(id==='energyDrink'){if((Number(p.stamina)||0)>=100)return toast('Выносливость уже полная.','error');p.stamina=100;}c.consumables[id]--;saveDB();render();toast(`${TEAM_ITEMS.find(x=>x.id===id)?.name||'Предмет'} использован: ${playerDisplayName(p)} восстановлен.`);return;}
    if(action==='sell-player'){const c=currentClub();const p=c?.players.find(x=>x.id===btn.dataset.playerId);if(!p)return;if(c.lineup.includes(p.id)){toast('Игроки стартового состава не продаются. Сначала замени его.','error');return;}if(!confirm(`Продать ${p.name} за случайную сумму в диапазоне ${formatSaleRange(p,false,1.5)}?`))return;const price=randomSalePrice(p,false,1.5);c.players=c.players.filter(x=>x.id!==p.id);c.coins+=price;playerModalRef=null;saveDB();render();toast(`${p.name} продан за ${formatMoney(price)}.`);return;}
    if(action==='music-toggle'){if(db.sound===false)db.sound=true;db.musicEnabled=!(db.musicEnabled!==false&&((backgroundAudio&&!backgroundAudio.paused)||musicLoopTimer));saveDB();if(db.musicEnabled){musicUnlocked=true;startBackgroundMusic();toast('Музыка включена.');}else{stopBackgroundMusic();toast('Музыка выключена.');}render();return;}if(action==='music-preview'){if(db.sound===false){toast('Сначала включи общий звук в настройках.','error');return;}db.musicEnabled=true;saveDB();startBackgroundMusic();render();toast('Фоновая музыка включена.');return;}
    if(action==='music-stop'){stopBackgroundMusic();db.musicEnabled=false;saveDB();render();toast('Фоновая музыка остановлена.');return;}if(action==='music-next'||action==='music-prev'){const idx=Math.max(0,Math.min(MUSIC_LIBRARY.length-1,Number(db.musicTrack)||0));db.musicTrack=(idx+(action==='music-next'?1:MUSIC_LIBRARY.length-1))%MUSIC_LIBRARY.length;db.musicStyle=currentMusicTrack().style;saveDB();if(db.musicEnabled!==false&&db.sound!==false)startBackgroundMusic();render();toast(`Трек: ${currentMusicTrack().name}`);return;}
    if(action==='sign-sponsor'){const c=currentClub();const deal=SPONSOR_DEALS.find(x=>x.id===btn.dataset.sponsor);if(!deal)return;const type=btn.dataset.sponsorType||deal.type;if(type!==deal.type||!['kit','title','extra'].includes(type))return;if(teamRating(c)<(deal.minRating||0)||(c.stats.wins||0)<(deal.minWins||0)){toast(`${translateUIText('Требования спонсора')}: ${sponsorRequirement(deal)}.`,'error');return;}if(c.coins<deal.sign/1000){toast('Недостаточно средств.','error');return;}c.sponsorSlots=c.sponsorSlots||{kit:null,title:null,extra:null};const current=c.sponsorSlots[type];if(current&&current.until>Date.now()){toast('Контракт этого типа ещё действует. Его нельзя заменить до окончания срока.','error');return;}c.coins-=deal.sign/1000;c.sponsorSlots[type]={id:deal.id,type,until:Date.now()+30*86400000,matchBonus:deal.match,winBonus:deal.win};c.sponsorContract=c.sponsorSlots.title||c.sponsorSlots.kit||c.sponsorSlots.extra;saveDB();render();toast(`${deal.name}: контракт ${type==='kit'?'на форму':type==='title'?'основной':'дополнительный'} подписан на 30 дней.`);return;}
    if(action==='claim-sponsor'){const c=currentClub();const id=btn.dataset.sponsor;const goals={local:3,sports:2,energy:5,bank:8,kit:4,phone:6,car:5,food:5,tech:7,water:4,travel:10,insurance:6,game:3,media:5,global:6};const wins=['sports','water','global'].includes(id);const progress=id==='car'?c.stats.goalsFor:id==='game'?c.stats.packsOpened:wins?c.stats.wins:c.stats.matches;c.sponsorClaims=c.sponsorClaims||{};if(progress<(goals[id]||999)||c.sponsorClaims[id])return;const reward={local:220,sports:300,energy:450,bank:650,kit:360,phone:480,car:330,food:400,tech:560,water:350,travel:800,insurance:520,game:310,media:430,global:1000}[id]||200;c.coins+=reward/1000;c.sponsorClaims[id]=true;saveDB();render();toast(`Спонсор выплатил ${formatMoney(reward/1000)}.`);return;}
    if(action==='refill-energy'){const c=currentClub();refreshEnergy(c);if(c.energy>=5){toast('Энергия уже полная.');return;}if(c.coins<0.10){toast('Недостаточно средств. Нужно €0.10M.','error');return;}c.coins-=0.10;c.energy=Math.min(5,c.energy+1);if(c.energy===1)c.energyAt=Date.now();saveDB();render();toast('Восстановлен 1 матч.');return;}
    if(action==='watch-ad'){
      const c=currentClub();refreshEnergy(c);if(!c||c.energy>=5){toast('Энергия уже полная.');return;}
      const provider=window.ZF_AD_PROVIDER;
      if(!provider||typeof provider.showRewardedAd!=='function'){toast('Рекламная сеть не подключена.','error');return;}
      btn.disabled=true;btn.textContent=translateUIText('Загрузка рекламы…');
      try{const result=await provider.showRewardedAd({placement:'energy_refill',reward:{energy:1}});if(result?.completed){c.energy=Math.min(5,c.energy+1);if(c.energy===1)c.energyAt=Date.now();saveDB();render();toast('Рекламная награда получена: +1 матч.');}else{btn.disabled=false;btn.textContent='▶ '+translateUIText('Реклама · +1 матч');toast('Рекламный ролик не был завершён.','error');}}
      catch(err){console.warn('Rewarded ad failed:',err);btn.disabled=false;btn.textContent='▶ '+translateUIText('Реклама · +1 матч');toast('Рекламная сеть временно недоступна.','error');}return;
    }
    if(action==='switch-club'){clearMatchTimers();db.activeClubId=null;view='home';matchState={stage:'idle'};editSlotIndex=null;reveal=null;saveDB();startMode='choose';render();return;}
    if(action==='edit-create-symbol'){createDraft.symbol=btn.dataset.symbol;return;}
    if(action==='crest-add-symbol'||action==='crest-add-emoji'||action==='crest-add-text'){
      const mode=btn.dataset.mode||'create',layers=getCrestLayers(mode);let value='',kind='symbol';
      if(action==='crest-add-symbol'){value=sanitizeCrestText(btn.dataset.symbol);kind='symbol';}
      else if(action==='crest-add-emoji'){value=String(btn.dataset.emoji||'');kind='emoji';if(!SAFE_CREST_EMOJIS.has(value))return;}
      else{value=sanitizeCrestText((mode==='edit'?$('#editLogoText'):$('#createLogoText'))?.value||'').slice(0,18);kind='text';}
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
    if(action==='set-captain'){const c=currentClub();const candidate=c?.players.find(p=>p.id===btn.dataset.playerId);if(!candidate||!c.lineup.includes(candidate.id)){toast('Капитана можно выбрать только из стартового состава.','error');return;}c.captainId=candidate.id;saveDB();render();toast(`Капитан назначен: ${playerDisplayName(candidate)} · +1 OVR.`);return;}if(action==='edit-slot'){editSlotIndex=Number(btn.dataset.slot);render();return;}
    if(action==='close-modal'){editSlotIndex=null;render();return;}
    if(action==='close-modal-backdrop'&&e.target===btn){editSlotIndex=null;render();return;}
    if(action==='assign-player'){assignPlayer(Number(btn.dataset.slot),btn.dataset.playerId);return;}
    if(action==='quick-assign'){const club=currentClub();const playerId=btn.dataset.playerId;const candidate=club.players.find(p=>p.id===playerId);if(playerIsUnavailable(candidate)){toast(`Игрок недоступен: ${unavailableReason(candidate)}.`,'error');return;}const idx=club.lineup.indexOf(playerId);if(idx>=0){editSlotIndex=idx;}else{const formation=FORMATIONS[club.formation]||FORMATIONS['4-3-3'];const emptySlot=club.lineup.findIndex(id=>!id);const weaker=club.lineup.map((id,i)=>({p:club.players.find(x=>x.id===id),i,role:formation[i]?.role})).filter(x=>x.p).sort((a,b)=>playerOVRAt(a.p,a.role,club)-playerOVRAt(b.p,b.role,club))[0];editSlotIndex=emptySlot>=0?emptySlot:(weaker?weaker.i:0);}render();return;}
    if(action==='auto-lineup'){autoLineup();return;}
    if(action==='set-style'){const c=currentClub();c.style=btn.dataset.style;saveDB();render();toast(`Игровой стиль: ${STYLES[c.style].name}`);return;}
    if(action==='forced-sub-skip'){const c=currentClub(),out=btn.dataset.out;if(!c||!matchState.pendingForcedSub)return;const outIndex=c.lineup.indexOf(out);if(outIndex>=0)c.lineup[outIndex]=null;if(c.captainId===out)c.captainId=c.lineup.find(Boolean)||null;matchState.pendingForcedSub=null;matchState.pendingForcedSlot=null;matchState.pendingForcedType=null;saveDB();if(matchState.eventIndex>=10){finishMatch();return;}render();toast('Команда продолжает матч в меньшинстве.','error');return;}
    if(action==='claim-mission'){const c=currentClub();if(!c)return;const type=btn.dataset.missionType,id=btn.dataset.missionId,cycles=ensureMissionCycles(c);let mission=null;if(type==='milestone'){mission=MILESTONE_MISSIONS.find(q=>q.id===id);if(!mission||c.missionClaims[id])return;if(missionMetric(c,mission.metric)<mission.target){toast('Задание ещё не выполнено.','error');return;}c.missionClaims[id]=Date.now();}else{const list=type==='daily'?cycles.daily:type==='monthly'?cycles.monthly:null;mission=list?.find(q=>q.id===id);if(!mission||mission.claimed)return;const amount=Math.max(0,missionMetric(c,mission.metric)-Number(mission.baseline||0));if(amount<mission.target){toast('Задание ещё не выполнено.','error');return;}mission.claimed=true;}const reward=Number((mission.reward*(type==='milestone'?1:sponsorRewardMultiplier(c))).toFixed(2));c.coins=(Number(c.coins)||0)+reward;saveDB();render();toast(`Задание выполнено: +${formatMoney(reward)}.`);return;}
    if(action==='renew-player-contract'){const c=currentClub();const player=c?.players.find(p=>p.id===btn.dataset.playerId);if(!c||!player)return;const cost=contractRenewalCost(player);if(c.coins<cost){toast('Недостаточно средств для продления контракта.','error');return;}c.coins-=cost;player.contractUntil=Math.max(Date.now(),Number(player.contractUntil)||0)+30*86400000;saveDB();render();toast(`Контракт ${playerDisplayName(player)} продлён на 30 дней.`);return;}
    if(action==='redeem-promo'){redeemPromoCode();return;}
    if(action==='claim-daily-card'){const c=currentClub();if(!c)return;const shop=dailyShop(c),wiki=btn.dataset.playerWiki;if(!shop.offers.includes(wiki)||shop.claimed.includes(wiki))return;const base=REAL_PLAYERS.find(x=>x.wiki===wiki);if(!base)return;if(c.players.some(p=>p.wiki===wiki)){toast('Этот футболист уже есть в твоём клубе.','error');render();return;}const price=Math.max(.08,Math.round(marketValue(base.rating)*.06*100)/100);if(c.coins<price){toast(`Недостаточно средств. Нужно ${formatMoney(price)}.`,'error');return;}c.coins-=price;const created=createPlayer(base.position,base.rating,base.name,base.country,{id:'daily-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),wiki:base.wiki,realClub:base.club,realPlayer:true});created.positions=REAL_PLAYER_POSITIONS[base.wiki]||[base.position];created.name=base.name;created.rating=base.rating;created.country=base.country;created.realClub=base.club;created.wiki=base.wiki;created.realPlayer=true;created.contractUntil=Date.now()+30*86400000;c.players.push(created);shop.claimed.push(wiki);saveDB();render();toast(`${base.name} куплен за ${formatMoney(price)}.`);return;}
        if(action==='buy-pack'){const c=currentClub();if(!c)return;const type=btn.dataset.pack,pack=ZF_PACK_OPTIONS.find(x=>x.id===type);if(!pack)return;const qty=type==='daily'?1:Math.max(1,Math.min(10,Number($(`[data-pack-quantity="${type}"]`)?.value)||1));const inv=ensurePackInventory(c);if(type==='daily'){if(c.freePackDay===currentDayKey()){toast('Бесплатный пак уже получен сегодня.','error');return;}c.freePackDay=currentDayKey();inv.daily=(inv.daily||0)+1;}else{const total=pack.price*qty;if(c.coins<total){toast('Недостаточно средств для выбранного количества паков.','error');return;}c.coins-=total;inv[type]=(inv[type]||0)+qty;}saveDB();render();toast(`${qty} ${qty===1?'пак добавлен': 'паков добавлено'} в инвентарь.`);return;}if(action==='open-inventory-pack'){const qty=Number($(`[data-inventory-open-qty="${btn.dataset.pack}"]`)?.value)||1;openPack(btn.dataset.pack,true,qty);return;}if(action==='open-pack'){openPack(btn.dataset.pack);return;}if(action==='forced-sub'||action==='forced-sub-pick'){const c=currentClub(),out=btn.dataset.out,inn=action==='forced-sub-pick'?btn.dataset.playerId:$('#forcedSubPlayer')?.value;if(!inn){toast('Выбери игрока для обязательной замены.','error');return;}const idx=c.lineup.indexOf(out);if(idx>=0){if(c.lineup.includes(inn))return;c.lineup[idx]=inn;if(c.captainId===out)c.captainId=inn;}else{toast('Игрок уже покинул поле после автоматической замены.','error');return;}matchState.pendingForcedSub=null;matchState.pendingForcedSlot=null;matchState.pendingForcedType=null;saveDB();if(matchState.eventIndex>=10){finishMatch();return;}render();toast('Обязательная замена выполнена.');return;}
    if(action==='collection-mode'){collectionMode=btn.dataset.mode;$$('[data-action="collection-mode"]').forEach(b=>b.className='btn '+(b.dataset.mode===collectionMode?'btn-primary':'btn-secondary')+' btn-sm');applyCollectionFilters();return;}
    if(action==='skip-pack-animation'){if(!reveal)return;reveal.skipAnimation=true;render();return;}
    if(action==='replay-pack-animation'){if(!reveal||db.packAnimations===false)return;reveal.skipAnimation=false;reveal.animationSerial=++packAnimationSerial;render();if(db.packVibration!==false)vibrate([22,28,44,35,75]);playPackSoundSequence(reveal.players||[]);return;}
    if(action==='open-next-pack'){if(reveal?.duplicateRewards?.length){toast('Сначала реши судьбу каждой повторной карточки.','error');return;}const nextType=$('#opening-next-pack')?.value;if(!nextType)return;reveal=null;openPack(nextType,true,1);return;}
    if(action==='close-opening'){if(reveal?.duplicateRewards?.length){toast('Сначала реши судьбу каждой повторной карточки.','error');return;}reveal=null;view='packs';render();toast('Новые футболисты в коллекции.');return;}
    if(action==='duplicate-money'||action==='duplicate-renew'||action==='duplicate-sell'){if(!reveal)return;reveal.skipAnimation=true;const p=reveal.duplicateRewards?.find(x=>x.id===btn.dataset.playerId);if(!p)return;const c=currentClub();if(!c)return;const original=c.players.find(x=>x.id===p.duplicateOf)||c.players.find(x=>x.wiki&&x.wiki===p.wiki)||c.players.find(x=>x.name===p.name);if(action==='duplicate-sell'||action==='duplicate-money'){const reward=randomSalePrice(p,true,1);c.coins=(Number(c.coins)||0)+reward;reveal.duplicateRewards=reveal.duplicateRewards.filter(x=>x.id!==p.id);reveal.players=reveal.players.filter(x=>x.id!==p.id);saveDB();render();toast(`${playerDisplayName(p)} продан как повторная карточка за ${formatMoney(reward)}.`);return;}if(!original){toast('Не удалось найти исходную карточку для продления.','error');return;}original.contractUntil=Math.max(Date.now(),Number(original.contractUntil)||0)+5*86400000;reveal.duplicateRewards=reveal.duplicateRewards.filter(x=>x.id!==p.id);reveal.players=reveal.players.filter(x=>x.id!==p.id);saveDB();render();toast(`Контракт ${playerDisplayName(original)} продлён на 5 дней.`);return;}
    
    if(action==='copy-room-code'){if(activeOnlineRoom?.room_code){const code=activeOnlineRoom.room_code;if(navigator.clipboard?.writeText){navigator.clipboard.writeText(code).then(()=>toast('Код комнаты скопирован.')).catch(()=>toast('Код комнаты: '+code));}else toast('Код комнаты: '+code);}return;}
    if(action==='mp-create'){try{await multiplayerCreateRoom();}catch(err){console.error(err);toast(err.message||'Не удалось создать комнату.','error');}return;}
    if(action==='mp-refresh'){try{if(activeOnlineRoom)await refreshOnlineRoom();else{await loadPublicRooms();render();}}catch(err){toast(err.message||'Не удалось обновить комнаты.','error');}return;}
    if(action==='mp-join-room'){try{await multiplayerJoinRoom(btn.dataset.roomCode||'');}catch(err){console.error(err);toast(err.message||'Не удалось подключиться к комнате.','error');}return;}
    if(action==='mp-leave-room'){try{await multiplayerLeaveRoom();}catch(err){toast(err.message||'Не удалось покинуть комнату.','error');}return;}
    if(action==='mp-start'){try{await multiplayerStartMatch();}catch(err){console.error(err);toast(err.message||'Не удалось начать онлайн-матч.','error');}return;}
    if(action==='mp-penalty-choice'){try{await multiplayerSubmitAction(btn.dataset.choice||'');}catch(err){console.error(err);toast(err.message||'Ход не принят.','error');}return;}
    if(action==='online-match-choice'){try{await submitOnlineMatchChoice(btn.dataset.choice||'');}catch(err){console.error(err);toast(err.message||'Ход не принят.','error');}return;}
    if(action==='online-match-again'){await leaveQuickMatchAndSearch();return;}
    if(action==='online-match-menu'){try{if(activeOnlineRoom?.id&&onlineRoomIsQuick())await ZF_SUPABASE.rpc('zf_leave_room',{p_room_id:activeOnlineRoom.id});}catch(err){console.warn(err);}stopOnlineRoomSync();activeOnlineRoom=null;try{localStorage.removeItem('zfActiveOnlineRoomId');}catch(_){}matchState={stage:'idle'};view='home';render();return;}
    if(action==='match-search'){startSearch();return;}
    if(action==='cancel-search'){if(matchState?.stage==='searching'&&ZF_SUPABASE)ZF_SUPABASE.rpc('zf_cancel_matchmaking').catch(()=>{});clearMatchTimers();matchState={stage:'idle'};render();return;}
    if(action==='start-match'){beginMatch();return;}
    if(action==='manual-sub'){const c=currentClub(),out=btn.dataset.out,sel=btn.parentElement.querySelector('select'),inn=sel?.value;if(!inn){toast('Выбери игрока на замену.','error');return;}const incoming=c.players.find(p=>p.id===inn);if(playerIsUnavailable(incoming)){toast(`Игрок недоступен: ${unavailableReason(incoming)}.`,'error');return;}const i=c.lineup.indexOf(out);if(i<0||c.lineup.includes(inn))return;c.lineup[i]=inn;if(c.captainId===out)c.captainId=inn;saveDB();render();toast('Замена выполнена.');return;}if(action==='match-choice'){resolveChoice(btn.dataset.choice);return;}
    if(action==='match-return-search'||action==='match-again'){clearMatchTimers();matchState={stage:'idle'};view='match';render();return;}
  });
  $('#app').addEventListener('submit',async e=>{
    if(e.target.id==='promoCodeForm'){e.preventDefault();redeemPromoCode();return;}
    if(e.target.id==='zfCloudAuthForm'||e.target.id==='zfStartAuthForm'){e.preventDefault();const mode=e.submitter?.dataset.authMode||authScreenMode||'signin';try{await cloudSignIn(mode,e.target);}catch(err){console.error('Supabase auth error:',err);toast(err.message||'Ошибка авторизации.','error');}return;}
    if(e.target.id==='mpJoinCodeForm'){e.preventDefault();const fd=new FormData(e.target);try{await multiplayerJoinRoom(String(fd.get('roomCode')||''));}catch(err){console.error(err);toast(err.message||'Не удалось подключиться.','error');}return;}
    if(e.target.id==='createClubForm'){e.preventDefault();try{await createClubFromForm(e.target);}catch(err){console.error(err);toast(err?.message||'Не удалось создать клуб.','error');}}
    if(e.target.id==='editClubForm'){
      e.preventDefault();const club=currentClub();if(!club)return;const fd=new FormData(e.target);const name=String(fd.get('clubName')||'').trim();
      if(name.length<2){toast('Название должно содержать минимум 2 символа.','error');return;}
      if(accountClubs().some(c=>c.id!==club.id&&c.name.toLowerCase()===name.toLowerCase())){toast('Такое название уже занято другим твоим клубом.','error');return;}
      club.name=name;club.country=String(fd.get('country')||club.country);club.logo.layers=Array.isArray(club.logo.layers)?club.logo.layers:[];club.logo.symbol=sanitizeCrestText(club.logo.layers.find(layer=>layer.kind==='symbol')?.value||club.logo.symbol||'★');club.logo.color=String($('#editLogoColor')?.value||club.logo.color);club.logo.shape=String($('#editLogoShape')?.value||club.logo.shape||'shield');saveDB();render();toast('Изменения клуба сохранены.');
    }
  });
  $('#app').addEventListener('change',e=>{
    const t=e.target;
    if(t.dataset.setting==='musicEnabled'){db.musicEnabled=t.checked;saveDB();if(t.checked&&db.sound!==false){startBackgroundMusic();}else{stopBackgroundMusic();}toast(t.checked?'Фоновая музыка включена.':'Фоновая музыка выключена.');return;}
    if(t.dataset.setting==='musicTrack'){db.musicTrack=Math.max(0,Math.min(MUSIC_LIBRARY.length-1,Number(t.value)||0));db.musicStyle=currentMusicTrack().style;saveDB();if(musicUnlocked&&db.musicEnabled!==false&&db.sound!==false)startBackgroundMusic();render();return;}
    if(t.dataset.setting==='musicVolume'){db.musicVolume=clamp(Number(t.value)||0,0,100);saveDB();const label=$('#musicVolumeValue');if(label)label.textContent=`${db.musicVolume}%`;setMusicVolume();return;}if(t.dataset.setting==='soundVolume'){db.soundVolume=clamp(Number(t.value)||0,0,100);saveDB();const label=$('#soundVolumeValue');if(label)label.textContent=`${db.soundVolume}%`;return;}if(t.dataset.setting==='packSoundVolume'){db.packSoundVolume=clamp(Number(t.value)||0,0,100);saveDB();const label=$('#packSoundVolumeValue');if(label)label.textContent=`${db.packSoundVolume}%`;return;}
    if(t.dataset.setting==='vibration'){db.vibration=t.checked;saveDB();toast(t.checked?'Вибрация включена.':'Вибрация отключена.');return;}if(t.dataset.setting==='sound'){db.sound=t.checked;saveDB();if(t.checked){playUiTone(660,.08,.035);if(db.musicEnabled!==false&&musicUnlocked)startBackgroundMusic();}else{stopBackgroundMusic();}return;}if(t.dataset.setting==='packAnimations'){db.packAnimations=t.checked;saveDB();render();toast(t.checked?'Анимация паков включена.':'Паки будут открываться без анимации.');return;}if(t.dataset.setting==='packAnimationSpeed'){db.packAnimationSpeed=['cinematic','normal','fast'].includes(t.value)?t.value:'normal';saveDB();toast('Скорость открытия паков сохранена.');return;}if(t.dataset.setting==='packSound'){db.packSound=t.checked;saveDB();toast(t.checked?'Звук открытия паков включён.':'Звук открытия паков отключён.');return;}if(t.dataset.setting==='packVibration'){db.packVibration=t.checked;saveDB();toast(t.checked?'Виброотклик паков включён.':'Виброотклик паков отключён.');return;}if(['collectionPosition','collectionRarity','collectionSort','collectionCountry','collectionClub','collectionPriceMin','collectionPriceMax'].includes(t.id))applyCollectionFilters();
    if(t.dataset.setting==='formation'){const club=currentClub();if(club){club.formation=t.value;saveDB();render();}}
    if(t.dataset.setting==='captain'){const club=currentClub();const player=club?.players.find(p=>p.id===t.value);if(club&&player&&club.lineup.includes(player.id)){club.captainId=player.id;saveDB();render();toast(`Капитан назначен: ${playerDisplayName(player)}.`);}}
    if(t.dataset.setting==='language'&&db.language!==t.value)setInterfaceLanguage(t.value);
    if(t.id==='createLogoShape'){createDraft.shape=t.value;updateCrestShape('create',t.value);}if(t.id==='editLogoShape'){const c=currentClub();if(c){c.logo.shape=t.value;updateCrestShape('edit',t.value);}}
    if(t.id==='newCountry'){const c=countryData(t.value);const bonus=$('#starterBonus');if(bonus)bonus.textContent=`${c.flag} Стартовый пак: 16 игроков · Бонус страны: ${c.bonus}`;}
    if(t.id==='editCountry'){const c=countryData(t.value);const bonus=$('#editCountryBonus');if(bonus)bonus.textContent=`Бонус страны: ${c.bonus}`;const cn=$('#editorPreviewCountry');if(cn)cn.textContent=`${c.name} · ${teamRating(currentClub())} OVR`;const name=$('#editClubName')?.value||currentClub()?.name||'';const n=$('#editorPreviewName');if(n)n.textContent=`${c.flag} ${name}`;}
  });
  $('#app').addEventListener('input',e=>{
    const t=e.target;if(['collectionSearch','collectionPriceMin','collectionPriceMax'].includes(t.id))applyCollectionFilters();if(t.dataset.setting==='musicVolume'){db.musicVolume=clamp(Number(t.value)||0,0,100);const label=$('#musicVolumeValue');if(label)label.textContent=`${db.musicVolume}%`;setMusicVolume();}if(t.dataset.setting==='soundVolume'){db.soundVolume=clamp(Number(t.value)||0,0,100);const label=$('#soundVolumeValue');if(label)label.textContent=`${db.soundVolume}%`;}if(t.dataset.setting==='packSoundVolume'){db.packSoundVolume=clamp(Number(t.value)||0,0,100);const label=$('#packSoundVolumeValue');if(label)label.textContent=`${db.packSoundVolume}%`;}const club=currentClub();
    if(t.dataset.preview==='create-color'){createDraft.logoColor=t.value;const crest=$('#createCrest');if(crest)crest.style.setProperty('--crest-color',t.value);}
    if(t.dataset.crestLayerColor){const mode=t.dataset.mode||'create',layer=(getCrestLayers(mode)||[]).find(x=>x.id===t.dataset.layerId);if(layer){layer.color=t.value;const selector=mode==='edit'?'#editCrest':'#createCrest';const item=$(`${selector} [data-layer-id="${CSS.escape(layer.id)}"]`);if(item)item.style.color=t.value;if(mode==='edit'){const small=$(`#editorPreviewCrest [data-layer-id="${CSS.escape(layer.id)}"]`);if(small)small.style.color=t.value;}}}
    if(!club)return;
    if(t.dataset.preview==='edit-logo-color'){
      club.logo.color=t.value;const cr=$('#editCrest');if(cr)cr.style.setProperty('--crest-color',t.value);const pv=$('#editorPreviewCrest');if(pv)pv.style.setProperty('--crest-color',t.value);const h=$('#editLogoColorHidden');if(h)h.value=t.value;
    }
        if(t.id==='editClubName'){const pv=$('#editorPreviewName');if(pv)pv.textContent=`${countryData($('#editCountry')?.value||club.country).flag} ${t.value}`;}
  });

  document.addEventListener('pointerdown',()=>{unlockAndStartMusic();},{passive:true});
  document.addEventListener('keydown',()=>{if(!musicUnlocked)unlockAndStartMusic();},{passive:true});
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
    delete club.kit;
    if(!club.stats)club.stats={matches:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,packsOpened:0};
    ensureConsumables(club);
    if(!club.trophyUnlocks)club.trophyUnlocks={};delete club.trophyUnlocks.rich_1000;delete club.trophyUnlocks.rich_5000;
    if(!club.history)club.history=[];
    if(!club.style)club.style='balanced';
    if(!STYLES[club.style])club.style='balanced';
    if(!club.formation)club.formation='4-3-3';
    if(!Array.isArray(club.players))club.players=[];
    club.players.forEach(p=>{
      playerCareer(p);
      p.yellowCards=Math.max(0,Number(p.yellowCards)||0);p.yellowCardTotal=Math.max(p.yellowCards,Number(p.yellowCardTotal)||0);p.yellowBanMatches=Math.max(0,Number(p.yellowBanMatches)||0);p.stamina=clamp(Number.isFinite(Number(p.stamina))?Number(p.stamina):100,0,100);
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
