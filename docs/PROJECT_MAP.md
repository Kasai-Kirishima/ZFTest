# Карта проекта Zero Football v42

- `index.html` — точка входа и подключение модулей.
- `css/01..13` — базовые стили, сетки, карточки, поле, анимации, 47 палитр тем, звуковая студия и финальный адаптивный слой поля/модальных окон. Файл `11-theme-and-squad-fixes.css` обязателен для полной раскраски интерфейса и отображения выносливости на тактическом поле.
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


## v34 additions
- Pack animation lifecycle: `runPackOpeningAnimations()` in `js/app.js`; conflicting legacy CSS keyframes disabled in `css/06-visual-refinements.css`.
- Opponent top three: `renderFound()` reuses `renderPlayerCard()` for identical visual treatment.
- Final match decision: `resolveChoice()` completes the tenth episode directly; `finishMatch(true)` is the final-decision path with a fallback result screen.


## v35 additions
- Pack reveal CSS-only animation pipeline: `css/06-visual-refinements.css`.
- The `runPackOpeningAnimations()` Web Animations API helper and its render hook were removed from `js/app.js`; the modal's CSS animations start automatically on DOM insertion.
- v34 versions of the app and visual refinements are preserved in `backup/v34-app.js` and `backup/v34-06-visual-refinements.css`.


## v42 tactical layout
- `calculatePitchPositions()` in `js/app.js` creates five compact tactical rows across all 15 formations.
- `renderTeam()` shows stamina below each on-pitch card and a captain selector for the full roster.
- `css/13-v42-final-layout.css` is intentionally loaded last to override legacy pitch and mobile card rules; do not remove it from `index.html`.
- `setInterfaceLanguage()` plus the document-level change handler controls language switching from the start screen and settings.

## v43 match gallery
- `MATCH_ACTION_IMAGES` in `js/app.js` contains 33 supplied action/event photographs; all are displayed through the shared 16:9 crop rules in `css/14-match-action-gallery.css`.

## v44 additions
- `energyWidget()`, `energyCountdownText()` and `syncMatchCountdownUI()` in `js/app.js` show and update the next +1 energy timer (30-minute regeneration cadence).
- `renderAdSlot()` in `js/app.js` renders internal sponsor placements on the dashboard and match lobby. It reads active `club.sponsorSlots` contracts.
- Rewarded video integration is intentionally provider-neutral: expose `window.ZF_AD_PROVIDER.showRewardedAd({placement, reward})` and resolve `{completed:true}` only after the ad SDK confirms a completed view. The app never fabricates a completed view.
- `css/14-match-action-gallery.css` also contains the energy-actions and responsive ad-placement styles.
- The existing soundtrack remains in `js/app.js`: 5 styles × 5 original synthesized themes, user-controlled from Settings.
