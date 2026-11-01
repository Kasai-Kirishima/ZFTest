# Бесплатная музыка для Zero Football

В v52 подключены шестнадцать композиций, опубликованных на OpenGameArt под **CC0 1.0 / Public Domain dedication**. Для CC0 не требуется платить, запрашивать разрешение или указывать автора; авторство всё равно сохранено в документации и интерфейсе как благодарность.

## Треки, подключённые в игре

1. **Menu Music** — wipics. Спокойный синтезаторный бит, loop. CC0 / Public Domain.
   - Страница: https://opengameart.org/content/menu-music-1
   - Аудио: https://opengameart.org/sites/default/files/menu_3.ogg
2. **Shine Blitz** — zesona (Chris Murphy). Мелодичная, бодрая композиция с движущейся гармонией. CC0.
   - Страница: https://opengameart.org/content/shine-blitz
   - Аудио: https://opengameart.org/sites/default/files/shineblitz_0.ogg
3. **Empacotatron** — Fupi. Энергичная электронная/techno loop-композиция; у автора также есть отдельные intro/menu-версии. CC0.
   - Страница: https://opengameart.org/content/empacotatron
   - Аудио: https://opengameart.org/sites/default/files/empacotatron_loop.ogg
4. **I Am Not Trash** — Centurion_of_war. Короткая бодрая рок-композиция с power chords. CC0.
   - Страница: https://opengameart.org/content/i-am-not-trash-or-am-i
   - Аудио: https://opengameart.org/sites/default/files/trash1.91_v1ext_0.ogg

## Как загружается музыка

В браузерной сборке аудио запрашивается напрямую с OpenGameArt при первом включении музыки. Поэтому для оригинальных файлов нужен интернет; файлы не дублируются внутри ZIP. Воспроизведение идёт через HTMLAudioElement и не требует CORS-доступа к аудиоданным. Если один из потоков не загрузится (например, из-за недоступности внешнего хоста), игра переключается на встроенную процедурную резервную тему.

Перед публичным релизом стоит повторно открыть каждую страницу-источник и убедиться, что лицензия и адрес файла не изменились. В исходных страницах, проверенных при сборке v50, у каждого ресурса указан CC0.

## Дополнительные библиотеки

- https://opengameart.org/ — игровые ресурсы с отдельной лицензией для каждого файла.
- https://not-jam.itch.io/not-jam-music-pack — музыкальный набор Not Jam под CC0, включает OGG и WAV.
- https://hydrogene.itch.io/high-quality-8-bit-musics — 18 chiptune-треков под CC0.
- https://hydrogene.itch.io/high-quality-16-bit-music — 28 16-bit RPG треков под CC0.

Не считайте слово «free» достаточным подтверждением прав: проверяйте лицензию конкретной композиции, её файла и версию условий перед публикацией игры.

## v52 additions (CC0)
- Eerie Choir — TheFrenchDodo: https://opengameart.org/content/retro-tunes (https://opengameart.org/sites/default/files/eeriechoir.ogg)
- Icy Adventure — TheFrenchDodo: https://opengameart.org/content/retro-tunes (https://opengameart.org/sites/default/files/icyadventure-loopable.ogg)
- Retro Boss Fight — TheFrenchDodo: https://opengameart.org/content/retro-tunes (https://opengameart.org/sites/default/files/retrobossfight-loopable.ogg)
- Romantic Chill — TheFrenchDodo: https://opengameart.org/content/retro-tunes (https://opengameart.org/sites/default/files/romanticchill-loopable.ogg)
- Our Expanse — Bobjt: https://opengameart.org/content/our-expanse (https://opengameart.org/sites/default/files/our_expanse_-_with_tail-version-0.ogg)

The sources declare CC0. Direct OGG files could not be downloaded in the current environment, so tracks are streamed from the listed source URLs.

## Additional v52 CC0 tracks

All entries below are marked CC0 by their authors on OpenGameArt. Individual source pages are kept in the in-game music selector.

- Chiptune Battle — pmiller: https://opengameart.org/content/chiptune-battle-music (CC0).
- Simple Menu Loop — polosik: https://opengameart.org/content/simple-menubackground-music-loop (CC0).
- Invincibility — Zane Little Music: https://opengameart.org/content/invincibility-loop (CC0).
- Jump — ThePixel: https://opengameart.org/content/jump (CC0).
- Sherwood — zesona / Chris Murphy: https://opengameart.org/content/sherwood (CC0).
- Electronic Music Loop — Rami99: https://opengameart.org/content/electronic-music-loop (CC0).
- Sadness — Kistol: https://opengameart.org/content/sadness (CC0).

The current v52 selector contains 16 CC0 tracks. The browser streams these OGG files from OpenGameArt; they are not embedded in this ZIP. If a source is unavailable or playback is blocked, the game uses its built-in synthesised fallback.
