# Учебный сайт «ИИ для руководителей»

Проект: `/Users/yt/Desktop/WORK/Course/ai-kurs`.
Адрес: https://vinte97.github.io/ai-kurs/
Репозиторий: git@github.com:vinte97/ai-kurs.git.

## Локальный запуск

```sh
python3 tools/build_site.py
python3 -m http.server 4183
```

Откройте http://localhost:4183/. Дни открываются кодом занятия.
Фаза сборки задаётся в `site.config.json`; сейчас `day-4`.
Для пересоздания QR нужен локально установленный segno: `PYTHONPATH=.pydeps python3 tools/build_site.py`.

## Материалы

`content/course.json` — тексты, задания, запросы, материалы. `tools/build_site.py`
создаёт HTML, данные JS, TXT запросов, Markdown-тетрадь и ZIP-комплект дня 2.
Не редактируйте созданные `day2.html`, `js/course.js`, `js/prompts.js` и `files/*`
вместо источников. В `js/steps.js` — подготовка Windows/macOS, включая промокод.

В открытой учебной папке участника находятся соседние «СеверПром» и «Результаты».
Технический URL репозитория пока содержит `company.git`; локальная папка называется
«СеверПром». Обязательного абсолютного пути или облачного сбора ответов нет.
Тетрадь — личный Markdown-файл. Отметки выполнения сайта сохраняются только
в браузере; они не заменяют файлы и проверку участника.

## Проверки

```sh
python3 tests/check_site.py
python3 tests/check_day1_alignment.py
python3 tests/check_day2_alignment.py
node --check tests/portal.spec.js
```

Пути нужно проверить также в свежей копии **опубликованной** компании:

```sh
git clone https://github.com/cursorstudent-course/company.git /tmp/severprom-site-check
python3 tests/check_day2_alignment.py /tmp/severprom-site-check
```

Если файлы отсутствуют, нельзя объявлять комплект опубликованным и готовым.
Карта путей и статус — `content/day2-alignment.json`; отчёт —
`docs/DAY2_ALIGNMENT.md`; отличия для показа — `docs/DAY2_PRESENTATION_HANDOFF.md`.
Контрольные ответы и реестр учебных дефектов в сайт и ZIP не включаются.

## Публикация

Только по отдельному разрешению: обычный коммит и push в main, без force-push.
GitHub Actions собирает и публикует Pages. Локальная сборка сама ничего не публикует.
