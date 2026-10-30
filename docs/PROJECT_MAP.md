# Карта проекта Zero Football v33

- `index.html` — точка входа и подключение модулей.
- `css/01..09` — базовые стили, сетки, карточки, поле, модальные окна и 47 палитр тем.
- `js/app.js` — состояние игры, клубы, коллекция, магазин, матчи, таймеры, спонсоры и обработчики.
- `js/data/players.js` — база игроков, их позиции, клубы и источники фотографий.
- `js/data/gameplay.js` — формации, координаты ролей, игровые стили, боты и трофеи.
- `js/data/economy.js` — спонсорские контракты и требования по развитию клуба.
- `js/data/ui-config.js` — навигация и каталог тем с категориями.
- `js/data/localization.js` — словари переводов и локализации.
- `backup/` — исходная v25 и снимки модулей предыдущих версий.

## Профили клубов

Каждый клуб — отдельный профиль с логином и паролем. Данные хранятся в `db.clubs`; активный клуб указан в `db.activeClubId`. Сохранения работают локально через `zeroFootball.save.v1`. Серверной авторизации и синхронизации между устройствами пока нет.

## Матч

Текущий матч состоит из десяти эпизодов. Состояние хранит `eventIndex`, `completedEvents`, `currentEvent`, `actionDeadline`, `score` и `log`. Для найденного соперника используется `agreementDeadline`. Каждый тайм-аут — 60 секунд. Сейчас соперником выступает бот; реальный сетевой PvP ещё не подключён.

## Экономика и карты дня

`marketValue(rating)` рассчитывает отображаемую рыночную стоимость. Персональная покупка в ежедневном магазине рассчитывается отдельно — 25% от рыночной стоимости, минимум €0,35 млн. Ежедневные предложения хранятся в `club.dailyShop` и пересчитывают старые цены при загрузке.

## Эмблема

`club.logo.shape` задаёт форму эмблемы, а `club.logo.layers` — графические слои с координатами `x/y`, размером и цветом.

## v31 additions
- Crest symbol sanitization and additional silhouettes: `js/app.js`, `js/data/gameplay.js`, `css/06-visual-refinements.css`, `css/09-theme-library.css`.
- Additional starter countries: `js/data/players.js`.
- Player stamina, daily free pack, weighted pack rarity and mandatory in-match substitutions: `js/app.js`.
- Pack-opening animation restored by removing the conflicting override in `css/04-layout-economy.css`.


## v33 additions
- Password KDF / verification: `js/app.js` (`hashPassword`, `verifyClubPassword`).
- Emblem symbols: `crestSymbolSvg`, `crestLayerMarkup` in `js/app.js`; icon list in `js/data/gameplay.js`.
- Kit pattern library: `KIT_PATTERNS` in `js/app.js`, visual recipes in `css/06-visual-refinements.css`.
- Pack open animation and opponent portrait fallback: `renderReveal`, `renderFound`, `resolvePlayerImages` in `js/app.js`.
- Card actions: cards are read-only; selling is a dedicated action button.


## v33.1 additions
- Creation commit and recovery UI: `createClubFromForm` in `js/app.js`.
- Vector rendering and persisted emblem changes: `crestSymbolSvg`, `crestLayerMarkup`, editor submit handler in `js/app.js`.
- Password lockout: `AUTH_FAILURES`, `verifyClubPassword` in `js/app.js`.

- Emblem layer size controls: `logo-layer-size-up/down` actions in `js/app.js`; drag and z-order controls stay in the same builder.
- Secure club login modal: `renderClubLoginModal` and delegated `clubLoginForm` handler in `js/app.js`.
- Legacy stat normalization and idempotent match finalization: `loadDB()` and `finishMatch()` in `js/app.js`.
