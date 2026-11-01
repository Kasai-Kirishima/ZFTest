# Бесплатная музыка для Zero Football

В v50 подключены четыре композиции, опубликованные на OpenGameArt под **CC0 1.0 / Public Domain dedication**. Для CC0 не требуется платить, запрашивать разрешение или указывать автора; авторство всё равно сохранено в документации и интерфейсе как благодарность.

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

В браузерной сборке аудио запрашивается напрямую с OpenGameArt при первом включении музыки. Поэтому для этих четырёх оригинальных файлов нужен интернет; файлы не дублируются внутри ZIP. Воспроизведение идёт через HTMLAudioElement и не требует CORS-доступа к аудиоданным. Если один из потоков не загрузится (например, из-за недоступности внешнего хоста), игра переключается на встроенную процедурную резервную тему.

Перед публичным релизом стоит повторно открыть каждую страницу-источник и убедиться, что лицензия и адрес файла не изменились. В исходных страницах, проверенных при сборке v50, у каждого ресурса указан CC0.

## Дополнительные библиотеки

- https://opengameart.org/ — игровые ресурсы с отдельной лицензией для каждого файла.
- https://not-jam.itch.io/not-jam-music-pack — музыкальный набор Not Jam под CC0, включает OGG и WAV.
- https://hydrogene.itch.io/high-quality-8-bit-musics — 18 chiptune-треков под CC0.
- https://hydrogene.itch.io/high-quality-16-bit-music — 28 16-bit RPG треков под CC0.

Не считайте слово «free» достаточным подтверждением прав: проверяйте лицензию конкретной композиции, её файла и версию условий перед публикацией игры.
