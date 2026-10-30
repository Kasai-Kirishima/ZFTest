/* Zero Football data module. Keep data-only edits in this file. */
window.ZF_DATA = window.ZF_DATA || {};
Object.assign(window.ZF_DATA, {
  SYMBOLS: ['★','✦','✧','◆','◇','⬟','⬢','◈','◉','◎','●','○','▲','△','▼','▽','✚','✜','✣','✥','⚑','⚒','⚔','♜','♞','♟','♛','♚','☼','☾','⌘','∞','⟁','⬡','⬠','✪','✫','✬','✭','✮','✯','✰'],
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
    {id:'squad_70',icon:'⭐',name:'Крепкий состав',desc:'Достичь среднего рейтинга состава 70.',goal:'Рейтинг 70+',test:c=>teamRating(c)>=70},
    {id:'matches_3',icon:'⚽',name:'Регулярный игрок',desc:'Сыграть 3 матча.',goal:'3 матча',test:c=>(c.stats?.matches||0)>=3},{id:'matches_5',icon:'📅',name:'Постоянство',desc:'Сыграть 5 матчей.',goal:'5 матчей',test:c=>(c.stats?.matches||0)>=5},{id:'matches_20',icon:'🗓️',name:'Марафонец',desc:'Сыграть 20 матчей.',goal:'20 матчей',test:c=>(c.stats?.matches||0)>=20},{id:'wins_5',icon:'🏅',name:'Пять побед',desc:'Выиграть 5 матчей.',goal:'5 побед',test:c=>(c.stats?.wins||0)>=5},{id:'wins_10',icon:'🥇',name:'Десять побед',desc:'Выиграть 10 матчей.',goal:'10 побед',test:c=>(c.stats?.wins||0)>=10},{id:'wins_25',icon:'🏆',name:'Чемпионский характер',desc:'Выиграть 25 матчей.',goal:'25 побед',test:c=>(c.stats?.wins||0)>=25},{id:'goals_10',icon:'🥅',name:'Голеадор',desc:'Забить 10 голов.',goal:'10 голов',test:c=>(c.stats?.goalsFor||0)>=10},{id:'goals_25',icon:'⚽',name:'Бомбардир',desc:'Забить 25 голов.',goal:'25 голов',test:c=>(c.stats?.goalsFor||0)>=25},{id:'goals_50',icon:'🔥',name:'Машина голов',desc:'Забить 50 голов.',goal:'50 голов',test:c=>(c.stats?.goalsFor||0)>=50},{id:'packs_3',icon:'🎁',name:'Охотник за картами',desc:'Открыть 3 пака.',goal:'3 пака',test:c=>(c.stats?.packsOpened||0)>=3},{id:'packs_10',icon:'🎴',name:'Пак-мания',desc:'Открыть 10 паков.',goal:'10 паков',test:c=>(c.stats?.packsOpened||0)>=10},{id:'players_20',icon:'👥',name:'Широкая скамейка',desc:'Собрать 20 футболистов.',goal:'20 игроков',test:c=>(c.players||[]).length>=20},{id:'players_30',icon:'🧑‍🤝‍🧑',name:'Коллекция растёт',desc:'Собрать 30 футболистов.',goal:'30 игроков',test:c=>(c.players||[]).length>=30},{id:'rating_75',icon:'💎',name:'Сильная команда',desc:'Средний рейтинг состава 75.',goal:'Рейтинг 75+',test:c=>teamRating(c)>=75},{id:'rating_80',icon:'👑',name:'Элитный состав',desc:'Средний рейтинг состава 80.',goal:'Рейтинг 80+',test:c=>teamRating(c)>=80},{id:'captain',icon:'©️',name:'Капитан команды',desc:'Назначить капитана.',goal:'Капитан',test:c=>!!c.captainId},{id:'sponsor_1',icon:'🤝',name:'Партнёрство',desc:'Получить выплату спонсора.',goal:'1 выплата',test:c=>Object.keys(c.sponsorClaims||{}).length>=1},{id:'sponsor_5',icon:'💼',name:'Лицо бренда',desc:'Получить 5 выплат спонсоров.',goal:'5 выплат',test:c=>Object.keys(c.sponsorClaims||{}).length>=5},{id:'rich_1000',icon:'🪙',name:'Первая тысяча',desc:'Накопить 1000 монет.',goal:'1000 монет',test:c=>(c.coins||0)>=1000},{id:'rich_5000',icon:'💰',name:'Клубный бюджет',desc:'Накопить 5000 монет.',goal:'5000 монет',test:c=>(c.coins||0)>=5000},{id:'draw_3',icon:'🤝',name:'Мирный исход',desc:'Сыграть 3 матча вничью.',goal:'3 ничьи',test:c=>(c.stats?.draws||0)>=3},{id:'comeback',icon:'💪',name:'Не сдавайся',desc:'Сыграть 5 матчей.',goal:'5 матчей',test:c=>(c.stats?.matches||0)>=5},{id:'international',icon:'🌍',name:'Международный состав',desc:'Собрать игроков из 5 стран.',goal:'5 стран',test:c=>new Set((c.players||[]).map(p=>p.country)).size>=5}
  ]
});
