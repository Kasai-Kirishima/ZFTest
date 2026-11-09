/* Zero Football data module. Keep data-only edits in this file. */
window.ZF_DATA = window.ZF_DATA || {};
// Keep trophy tests self-contained: data modules cannot access app.js local functions.
const getTrophyTeamRating = club => {
  if(!club || !Array.isArray(club.lineup) || !club.lineup.length) return 0;
  const formation=window.ZF_DATA?.FORMATIONS?.[club.formation]||window.ZF_DATA?.FORMATIONS?.['4-3-3']||[];
  const groups=[['LB','RB','LWB','RWB'],['CM','CAM','CDM','LM','RM'],['LW','RW','ST','CF'],['CB','CDM']];
  const ratings=club.lineup.map((id,index)=>{
    const p=(club.players||[]).find(x=>x.id===id);if(!p)return null;
    const target=formation[index]?.role||p.position;const positions=p.positions||[p.position];
    const penalty=positions.includes(target)?0:(target==='GK'||positions.includes('GK'))?-35:positions.some(x=>groups.some(g=>g.includes(x)&&g.includes(target)))?-8:-18;
    const condition=p.injuryMatches>0?5:0;
    return Math.max(1,Math.min(99,Math.round((Number(p.rating)||0)+penalty-condition+(club.captainId===p.id&&club.lineup?.includes(p.id)?1:0))));
  }).filter(Number.isFinite);
  return ratings.length?Math.round(ratings.reduce((a,b)=>a+b,0)/ratings.length):0;
};
Object.assign(window.ZF_DATA, {
  SYMBOLS: ['★','☆','✦','✧','✶','✷','✸','◆','◇','♦','♢','◈','◊','●','○','◉','◎','◐','◑','◌','▲','△','▼','▽','■','□','▣','▢','▪','▫','+','✚','✛','×','✕','✖','⊕','⊗','⊙','⌖','☼','☀','☾','☽','∞','⚑','♠','♣','♥','♤','♧','♛','♜','♞','♟','♙','♕','♖','♘','⚜','✪','✫','✬','✭','✮','✯','✰','✱','✲','✳','✴','✵','✺','✻','✼','✽','✾','✿','❖','❂','❉','❊','❋','☯','☸','⚒','⚓','⚔','⚕','⚖','⚙','⚛','⚝','⚡','⚽','⚾','⛨','⛭','⛯','⬟','⬢','⬡','⬠','⬣','⬤','◢','◣','◤','◥','◧','◨','◩','◪','⬖','⬗','⬘','⬙','⬚','⬛','⬜','◒','◓','◔','◕','◖','◗','◘','◙','◚','◛','◜','◝','◞','◟','◠','◡'],
  RARITY: [
    {name:'Бронза',min:50,max:64,color:'#c58a60'},
    {name:'Серебро',min:65,max:74,color:'#cbd5d8'},
    {name:'Золото',min:75,max:84,color:'#f6ce58'},
    {name:'Элитная',min:85,max:89,color:'#c296ff'},
    {name:'Икона',min:90,max:99,color:'#77e7ff'}
  ],
  POSITIONS: ['GK','LB','CB','CB','RB','CM','CM','CAM','LW','ST','RW','GK','CB','CM','ST','RW','LB','CDM','LW','CB','RM','LM','CF'],
  POS_NAMES: {GK:'Вратарь',LB:'Левый защитник',CB:'Центральный защитник',RB:'Правый защитник',LWB:'Левый латераль',RWB:'Правый латераль',CDM:'Опорник',CM:'Центр. полузащитник',CAM:'Атак. полузащитник',LM:'Левый хавбек',RM:'Правый хавбек',LW:'Левый вингер',RW:'Правый вингер',ST:'Нападающий',CF:'Форвард'},
  FORMATIONS: {
    '4-3-3':[
      {role:'GK',x:50,y:86},{role:'LB',x:18,y:69},{role:'CB',x:39,y:73},{role:'CB',x:61,y:73},{role:'RB',x:82,y:69},
      {role:'CM',x:34,y:53},{role:'CM',x:66,y:53},{role:'CAM',x:50,y:43},{role:'LW',x:19,y:27},{role:'ST',x:50,y:22},{role:'RW',x:81,y:27}],
    '4-4-2':[
      {role:'GK',x:50,y:86},{role:'LB',x:18,y:69},{role:'CB',x:39,y:73},{role:'CB',x:61,y:73},{role:'RB',x:82,y:69},
      {role:'LM',x:18,y:49},{role:'CM',x:39,y:54},{role:'CM',x:61,y:54},{role:'RM',x:82,y:49},{role:'ST',x:38,y:27},{role:'ST',x:62,y:27}],
    '3-5-2':[
      {role:'GK',x:50,y:86},{role:'CB',x:27,y:73},{role:'CB',x:50,y:75},{role:'CB',x:73,y:73},{role:'LWB',x:13,y:50},
      {role:'CM',x:32,y:54},{role:'CM',x:50,y:48},{role:'CAM',x:68,y:54},{role:'RWB',x:87,y:50},{role:'ST',x:38,y:27},{role:'ST',x:62,y:27}],
    '4-2-3-1':[
      {role:'GK',x:50,y:86},{role:'LB',x:18,y:69},{role:'CB',x:39,y:73},{role:'CB',x:61,y:73},{role:'RB',x:82,y:69},
      {role:'CDM',x:39,y:57},{role:'CDM',x:61,y:57},{role:'LW',x:20,y:35},{role:'CAM',x:50,y:39},{role:'RW',x:80,y:35},{role:'ST',x:50,y:23}]
  },
  EXTRA_FORMATIONS: {
    '4-1-4-1':['GK','LB','CB','CB','RB','CDM','LM','CM','CM','RM','ST'],
    '4-3-2-1':['GK','LB','CB','CB','RB','CM','CDM','CM','CAM','CAM','ST'],
    '4-3-1-2':['GK','LB','CB','CB','RB','CM','CDM','CM','CAM','ST','ST'],
    '4-5-1':['GK','LB','CB','CB','RB','LM','CM','CDM','CM','RM','ST'],
    '3-4-3':['GK','CB','CB','CB','LM','CM','CM','RM','LW','ST','RW'],
    '3-4-1-2':['GK','CB','CB','CB','LM','CM','CM','RM','CAM','ST','ST'],
    '3-4-2-1':['GK','CB','CB','CB','LM','CM','CM','RM','CAM','CAM','ST'],
    '3-5-1-1':['GK','CB','CB','CB','LWB','CM','CDM','CM','RWB','CAM','ST'],
    '5-3-2':['GK','LWB','CB','CB','CB','RWB','CM','CM','CM','ST','ST'],
    '5-4-1':['GK','LWB','CB','CB','CB','RWB','LM','CM','CM','RM','ST'],
    '5-2-3':['GK','LWB','CB','CB','CB','RWB','CDM','CM','LW','ST','RW']
  },
  FORMATION_COORDS: {GK:[50,87],LB:[15,70],LWB:[10,63],CB:[50,73],RB:[85,70],RWB:[90,63],CDM:[50,59],CM:[50,51],LM:[17,48],RM:[83,48],CAM:[50,39],LW:[18,27],ST:[50,22],RW:[82,27]},
  STYLES: {
    balanced:{name:'Баланс',icon:'⚖️',desc:'Без явных перекосов',attack:0,defense:0},
    attacking:{name:'Атака',icon:'🔥',desc:'Больше моментов, выше риск',attack:.055,defense:-.035},
    defensive:{name:'Оборона',icon:'🧱',desc:'Надёжность и компактность',attack:-.025,defense:.055},
    possession:{name:'Контроль мяча',icon:'🎯',desc:'Короткий пас и контроль темпа',attack:.035,defense:.018},
    counter:{name:'Контратаки',icon:'⚡',desc:'Быстрый выход после отбора',attack:.05,defense:.025},
    pressing:{name:'Высокий прессинг',icon:'🫷',desc:'Давление на чужой половине',attack:.02,defense:.065},
    wings:{name:'Игра через фланги',icon:'🏃',desc:'Ширина, прострелы и навесы',attack:.045,defense:-.008},
    direct:{name:'Длинные передачи',icon:'🚀',desc:'Вертикальная и прямая игра',attack:.04,defense:-.012}
  },
  BOT_CLUBS: [
    {name:'Green Falcons',symbol:'🦅',country:'🇸🇦'},{name:'Northside United',symbol:'❄️',country:'🇳🇴'},
    {name:'Racing Aurora',symbol:'🌌',country:'🇫🇮'},{name:'Red Harbour FC',symbol:'⚓',country:'🏴'},
    {name:'Dynamo Nova',symbol:'⚡',country:'🇺🇦'},{name:'Kingsbridge Athletic',symbol:'👑',country:'🏴'},
    {name:'Blue Comets',symbol:'☄️',country:'🇯🇵'},{name:'Iron Wolves',symbol:'🐺',country:'🇩🇪'},
    {name:'Riverside 04',symbol:'🌊',country:'🇳🇱'},{name:'Atlético Sol',symbol:'☀️',country:'🇪🇸'},
    {name:'Storm City',symbol:'🌩️',country:'🇺🇦'},{name:'Royal Borough',symbol:'👑',country:'🇬🇧'},{name:'Cobalt FC',symbol:'🔷',country:'🇫🇷'},{name:'Desert Rovers',symbol:'🏜️',country:'🇸🇦'},
    {name:'Blackbridge',symbol:'🖤',country:'🇩🇪'},{name:'Emerald Athletic',symbol:'💚',country:'🇮🇪'},{name:'Polar Stars',symbol:'❄️',country:'🇸🇪'},{name:'Sunset Eleven',symbol:'🌅',country:'🇪🇸'},
    {name:'Crimson Tide',symbol:'🌊',country:'🇵🇹'},{name:'Metro 1908',symbol:'🚇',country:'🇮🇹'},{name:'Thunderbirds',symbol:'⚡',country:'🇧🇷'},{name:'Silver Foxes',symbol:'🦊',country:'🇳🇱'},
    {name:'Mountain FC',symbol:'⛰️',country:'🇨🇭'},{name:'Neon Athletic',symbol:'💠',country:'🇯🇵'},{name:'Harbour Kings',symbol:'⚓',country:'🇵🇱'},{name:'Westvale',symbol:'🌳',country:'🇬🇧'},
    {name:'Red Comets',symbol:'☄️',country:'🇨🇿'},{name:'Blue Forge',symbol:'🔨',country:'🇩🇪'},{name:'Lunar FC',symbol:'🌙',country:'🇹🇷'},{name:'Wildcats United',symbol:'🐈',country:'🇺🇸'},
    {name:'Golden Borough',symbol:'🌟',country:'🇧🇪'},{name:'River Plateaux',symbol:'🏞️',country:'🇫🇷'},{name:'Oakfield Town',symbol:'🌲',country:'🇮🇪'},{name:'Vortex FC',symbol:'🌀',country:'🇳🇴'},
    {name:'Phoenix Athletic',symbol:'🔥',country:'🇬🇷'},{name:'Steel City',symbol:'⚙️',country:'🇺🇦'},{name:'Cosmos 11',symbol:'🪐',country:'🇯🇵'},{name:'Union Meridian',symbol:'🧭',country:'🇩🇪'}
  ],
  BOT_PLAYER_NAMES: ['Алекс Стоун','Марко Силва','Лео Картер','Иван Петров','Ноа Кинг','Сэм Уокер','Даниэль Круз','Милан Новак','Итан Брукс','Лука Моретти','Адам Фишер'],
  TROPHIES: [
    {id:'first_match',icon:'🎟️',name:'Дебютант',desc:'Сыграть свой первый матч.',goal:'1 матч',test:c=>(c.stats?.matches||0)>=1},
    {id:'first_win',icon:'🥇',name:'Первая победа',desc:'Выиграть первый официальный матч.',goal:'1 победа',test:c=>(c.stats?.wins||0)>=1},
    {id:'three_wins',icon:'🏆',name:'Победная серия',desc:'Одержать три победы.',goal:'3 победы',test:c=>(c.stats?.wins||0)>=3},
    {id:'pack_opened',icon:'🎁',name:'Коллекционер',desc:'Открыть свой первый пак.',goal:'1 пак',test:c=>(c.stats?.packsOpened||0)>=1},
    {id:'ten_matches',icon:'🧤',name:'Ветеран поля',desc:'Сыграть десять матчей.',goal:'10 матчей',test:c=>(c.stats?.matches||0)>=10},
    {id:'squad_70',icon:'⭐',name:'Крепкий состав',desc:'Достичь среднего рейтинга состава 70.',goal:'Рейтинг 70+',test:c=>getTrophyTeamRating(c)>=70},
    {id:'matches_3',icon:'⚽',name:'Регулярный игрок',desc:'Сыграть 3 матча.',goal:'3 матча',test:c=>(c.stats?.matches||0)>=3},{id:'matches_5',icon:'📅',name:'Постоянство',desc:'Сыграть 5 матчей.',goal:'5 матчей',test:c=>(c.stats?.matches||0)>=5},{id:'matches_20',icon:'🗓️',name:'Марафонец',desc:'Сыграть 20 матчей.',goal:'20 матчей',test:c=>(c.stats?.matches||0)>=20},{id:'wins_5',icon:'🏅',name:'Пять побед',desc:'Выиграть 5 матчей.',goal:'5 побед',test:c=>(c.stats?.wins||0)>=5},{id:'wins_10',icon:'🥇',name:'Десять побед',desc:'Выиграть 10 матчей.',goal:'10 побед',test:c=>(c.stats?.wins||0)>=10},{id:'wins_25',icon:'🏆',name:'Чемпионский характер',desc:'Выиграть 25 матчей.',goal:'25 побед',test:c=>(c.stats?.wins||0)>=25},{id:'goals_10',icon:'🥅',name:'Голеадор',desc:'Забить 10 голов.',goal:'10 голов',test:c=>(c.stats?.goalsFor||0)>=10},{id:'goals_25',icon:'⚽',name:'Бомбардир',desc:'Забить 25 голов.',goal:'25 голов',test:c=>(c.stats?.goalsFor||0)>=25},{id:'goals_50',icon:'🔥',name:'Машина голов',desc:'Забить 50 голов.',goal:'50 голов',test:c=>(c.stats?.goalsFor||0)>=50},{id:'packs_3',icon:'🎁',name:'Охотник за картами',desc:'Открыть 3 пака.',goal:'3 пака',test:c=>(c.stats?.packsOpened||0)>=3},{id:'packs_10',icon:'🎴',name:'Пак-мания',desc:'Открыть 10 паков.',goal:'10 паков',test:c=>(c.stats?.packsOpened||0)>=10},{id:'players_30',icon:'👥',name:'Большая скамейка',desc:'Собрать в клубе 30 футболистов.',goal:'30 игроков',reward:.2,test:c=>(c.players||[]).length>=30},
    {id:'players_40',icon:'🧑‍🤝‍🧑',name:'Широкая ротация',desc:'Собрать в клубе 40 футболистов.',goal:'40 игроков',reward:.25,test:c=>(c.players||[]).length>=40},
    {id:'players_50',icon:'👥',name:'Сильная глубина состава',desc:'Собрать в клубе 50 футболистов.',goal:'50 игроков',reward:.3,test:c=>(c.players||[]).length>=50},
    {id:'players_60',icon:'🧑‍🤝‍🧑',name:'Два полноценных состава',desc:'Собрать в клубе 60 футболистов.',goal:'60 игроков',reward:.35,test:c=>(c.players||[]).length>=60},
    {id:'players_70',icon:'👥',name:'Большая академия',desc:'Собрать в клубе 70 футболистов.',goal:'70 игроков',reward:.4,test:c=>(c.players||[]).length>=70},
    {id:'players_80',icon:'🧑‍🤝‍🧑',name:'Глубина на сезон',desc:'Собрать в клубе 80 футболистов.',goal:'80 игроков',reward:.45,test:c=>(c.players||[]).length>=80},
    {id:'players_90',icon:'👥',name:'Крупная коллекция',desc:'Собрать в клубе 90 футболистов.',goal:'90 игроков',reward:.5,test:c=>(c.players||[]).length>=90},
    {id:'players_100',icon:'🏟️',name:'Столетняя коллекция',desc:'Собрать в клубе 100 футболистов.',goal:'100 игроков',reward:.6,test:c=>(c.players||[]).length>=100},{id:'rating_75',icon:'💎',name:'Сильная команда',desc:'Средний рейтинг состава 75.',goal:'Рейтинг 75+',test:c=>getTrophyTeamRating(c)>=75},{id:'rating_80',icon:'👑',name:'Элитный состав',desc:'Средний рейтинг состава 80.',goal:'Рейтинг 80+',test:c=>getTrophyTeamRating(c)>=80},{id:'captain',icon:'©️',name:'Капитан команды',desc:'Назначить капитана.',goal:'Капитан',test:c=>!!c.captainId},{id:'sponsor_1',icon:'🤝',name:'Партнёрство',desc:'Получить выплату спонсора.',goal:'1 выплата',test:c=>Object.keys(c.sponsorClaims||{}).length>=1},{id:'sponsor_5',icon:'💼',name:'Лицо бренда',desc:'Получить 5 выплат спонсоров.',goal:'5 выплат',test:c=>Object.keys(c.sponsorClaims||{}).length>=5},{id:'draw_3',icon:'🤝',name:'Мирный исход',desc:'Сыграть 3 матча вничью.',goal:'3 ничьи',test:c=>(c.stats?.draws||0)>=3},{id:'comeback',icon:'💪',name:'Не сдавайся',desc:'Сыграть 5 матчей.',goal:'5 матчей',test:c=>(c.stats?.matches||0)>=5},{id:'international',icon:'🌍',name:'Международный состав',desc:'Собрать игроков из 5 стран.',goal:'5 стран',test:c=>new Set((c.players||[]).map(p=>p.country)).size>=5},
    {id:'draws_10',icon:'🤝',name:'Мастер ничьих',desc:'Сыграть десять матчей вничью.',goal:'10 ничьих',reward:.22,test:c=>(c.stats?.draws||0)>=10},
    {id:'matches_50',icon:'🎖️',name:'Полсотни матчей',desc:'Сыграть 50 матчей.',goal:'50 матчей',reward:.3,test:c=>(c.stats?.matches||0)>=50},
    {id:'matches_100',icon:'🏟️',name:'Сотня выходов',desc:'Сыграть 100 матчей.',goal:'100 матчей',reward:.5,test:c=>(c.stats?.matches||0)>=100},
    {id:'wins_50',icon:'🥇',name:'Пятьдесят побед',desc:'Выиграть 50 матчей.',goal:'50 побед',reward:.45,test:c=>(c.stats?.wins||0)>=50},
    {id:'wins_100',icon:'👑',name:'Сто побед',desc:'Выиграть 100 матчей.',goal:'100 побед',reward:.7,test:c=>(c.stats?.wins||0)>=100},
    {id:'goals_100',icon:'⚽',name:'Сотня голов',desc:'Забить 100 голов.',goal:'100 голов',reward:.4,test:c=>(c.stats?.goalsFor||0)>=100},
    {id:'goals_250',icon:'🔥',name:'Голевая машина',desc:'Забить 250 голов.',goal:'250 голов',reward:.65,test:c=>(c.stats?.goalsFor||0)>=250},
    {id:'packs_25',icon:'🎁',name:'Агентство работает',desc:'Открыть 25 паков.',goal:'25 паков',reward:.22,test:c=>(c.stats?.packsOpened||0)>=25},
    {id:'packs_50',icon:'🎴',name:'Большой коллекционер',desc:'Открыть 50 паков.',goal:'50 паков',reward:.4,test:c=>(c.stats?.packsOpened||0)>=50},
    {id:'rating_85',icon:'💎',name:'Очень сильный состав',desc:'Достичь среднего рейтинга 85.',goal:'85 OVR',reward:.35,test:c=>getTrophyTeamRating(c)>=85},
    {id:'rating_90',icon:'🌟',name:'Команда звёзд',desc:'Достичь среднего рейтинга 90.',goal:'90 OVR',reward:.6,test:c=>getTrophyTeamRating(c)>=90},
    {id:'clean_5',icon:'🧤',name:'Сухая серия',desc:'Провести пять матчей на ноль.',goal:'5 сухих матчей',reward:.22,test:c=>(c.stats?.cleanSheets||0)>=5},
    {id:'clean_15',icon:'🧱',name:'Неприступная крепость',desc:'Провести 15 матчей на ноль.',goal:'15 сухих матчей',reward:.4,test:c=>(c.stats?.cleanSheets||0)>=15},
    {id:'captain_10',icon:'©️',name:'Лидер раздевалки',desc:'Провести десять матчей с капитаном.',goal:'10 матчей',reward:.22,test:c=>(c.stats?.captainMatches||0)>=10},
    {id:'captain_30',icon:'🫡',name:'Настоящий капитан',desc:'Провести 30 матчей с капитаном.',goal:'30 матчей',reward:.4,test:c=>(c.stats?.captainMatches||0)>=30},
    {id:'sponsors_3',icon:'🤝',name:'Пул партнёров',desc:'Иметь три действующих спонсорских контракта.',goal:'3 контракта',reward:.25,test:c=>['kit','title','extra'].filter(k=>c.sponsorSlots?.[k]?.until>Date.now()).length>=3},
    {id:'sponsor_10',icon:'💼',name:'Долгие отношения',desc:'Получить десять разных выплат спонсоров.',goal:'10 выплат',reward:.3,test:c=>Object.keys(c.sponsorClaims||{}).length>=10},
    {id:'countries_10',icon:'🌍',name:'Мировой футбол',desc:'Собрать игроков из десяти стран.',goal:'10 стран',reward:.3,test:c=>new Set((c.players||[]).map(p=>p.country)).size>=10},
    {id:'club_level_10',icon:'📈',name:'Клуб растёт',desc:'Достичь 10 уровня клуба.',goal:'10 уровень',reward:.3,test:c=>(c.progression?.level||0)>=10},
    {id:'club_level_20',icon:'🚀',name:'Большие амбиции',desc:'Достичь 20 уровня клуба.',goal:'20 уровень',reward:.5,test:c=>(c.progression?.level||0)>=20},
    {id:'club_level_30',icon:'🏆',name:'Легенда лиги',desc:'Достичь максимального 30 уровня клуба.',goal:'30 уровень',reward:.7,test:c=>(c.progression?.level||0)>=30}
  ]
});
