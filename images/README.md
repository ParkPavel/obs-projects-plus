# Application screenshots / Скриншоты приложения

Supplied by the maintainer on **14 November 2026**, in the context of the Projects Plus **3.7.2** release. `pc/` contains seven desktop captures; `mobile/` contains seven captures from a physical iPhone. Exact Obsidian/OS versions and the binary commit of these captures were not separately reported. These are product screenshots, not browser mockups. The content was supplied by the maintainer for public project documentation; it is not live user data loaded by the website.

Предоставлены автором **14.11.2026** для оформления проекта после выпуска **3.7.2**: семь снимков ПК и семь с настоящего iPhone. Точные версии Obsidian/ОС и hash сборки отдельно не сообщались. Оригиналы сохранены без изменений. Сайт показывает статические изображения, а не обращается к хранилищу автора.

The bilingual captions and ordering live in `scripts/site/showcase.mjs`. Run `node scripts/build-docs-site.mjs` after changing that list: it copies originals into public `docs/media/`. Carousels support manual scrolling; JavaScript adds arrows, a counter and a native image dialog. There is no autoplay. GitHub READMEs use linked Markdown image galleries because GitHub does not execute carousel scripts.
