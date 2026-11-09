#!/usr/bin/env python3
import argparse
import html
import json
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHASES = ["pre-course", "precourse", "day-1", "day-2", "day-3", "day-4"]
NAV = [
    ("index.html", "Главная", "home"),
    ("prepare.html", "Подготовка", "prep"),
    ("day1.html", "День 1", "day"),
    ("day2.html", "День 2", "day"),
    ("day3.html", "День 3", "day"),
    ("day4.html", "День 4", "day"),
    ("extra.html", "Дополнительно", "more"),
]
SUB = [
    ("overview", "Обзор"),
    ("tasks", "Задания"),
    ("materials", "Материалы"),
    ("prompts", "Промпты"),
    ("check", "Проверка"),
]


def esc(value):
    return html.escape(str(value), quote=True)


def crumb(current, middle=None):
    parts = ['<a href="index.html">Главная</a>']
    if middle:
        parts.append('<span class="sep" aria-hidden="true"></span><span>%s</span>' % esc(middle))
    parts.append('<span class="sep" aria-hidden="true"></span><span aria-current="page">%s</span>' % esc(current))
    return '<nav class="crumb" aria-label="Путь по сайту">%s</nav>' % "".join(parts)


def normalize(phase):
    if phase in ("pre-course", "precourse", "", None):
        return "pre-course"
    return phase


def open_day(phase, number):
    phase = normalize(phase)
    if phase == "pre-course":
        return False
    return number <= int(phase.split("-")[1])


def icon(kind, day=0):
    paths = {
        "home": "M4 11 12 4l8 7v9H4z",
        "prep": "M6 4h12v4H6zm0 6h12v10H6z",
        "more": "M5 7h14M5 12h14M5 17h14",
        1: "M8 6.5h8a2 2 0 0 1 2 2v4.5a2 2 0 0 1-2 2h-2.5L10 18v-3H8a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2z",
        2: "M8 4.5h5.2L18 9.2V19.5H8zM13.2 4.8V9.2H18",
        3: "M8.2 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6zM15.8 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6zM11 12h2",
        4: "M12 7.2a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2zM7.4 18.2c.9-2.3 2.5-3.4 4.6-3.4s3.7 1.1 4.6 3.4",
    }
    path = paths[day] if kind == "day" else paths[kind]
    return '<svg class="nav-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="%s"></path></svg>' % path


def load():
    course = json.loads((ROOT / "content" / "course.json").read_text(encoding="utf-8"))
    config = json.loads((ROOT / "site.config.json").read_text(encoding="utf-8"))
    return course, config


def shell(course, title, current, body, phase):
    links = []
    for href, label, kind in NAV:
        day_number = int(href[3]) if href.startswith("day") else 0
        mark = icon(kind, day_number)
        current_attr = ' aria-current="page"' if href == current else ""
        if day_number:
            if day_number == 4:
                label += " · " + course["days"][day_number - 1]["menu"]
            shown = open_day(phase, day_number)
            if shown:
                links.append('<a data-day="%d" href="%s"%s>%s<span>%s</span></a>' % (day_number, href, current_attr, mark, esc(label)))
            links.append('<p class="nav-soon" data-day-soon="%d">%s<span>%s</span><small>Позже</small></p>' % (day_number, mark, esc(label)))
            if shown and current == href:
                links.append('<div class="subnav" data-day="%d">%s</div>' % (day_number, "".join(
                    '<a href="%s#%s">%s</a>' % (current, item, esc(name)) for item, name in (([("guide", "Материал дня")] + SUB) if current in ("day1.html", "day2.html", "day3.html", "day4.html") else SUB)
                )))
            continue
        target = "prepare.html#start" if href == "prepare.html" else href
        links.append('<a href="%s"%s>%s<span>%s</span></a>' % (target, current_attr, mark, esc(label)))
    page_attr = ' data-page="%s"' % current[3] if current.startswith("day") else ""
    boot = """<script>
try {
  var n = parseInt(localStorage.getItem("aikurs-open-day") || "0", 10);
  if (!(n >= 1 && n <= 4)) n = 0;
  document.documentElement.setAttribute("data-open", String(n));
  var theme = localStorage.getItem("aikurs-theme-v1") || "light";
  if (theme !== "dark" && theme !== "system") theme = "light";
  document.documentElement.setAttribute("data-theme", theme);
} catch (e) {
  document.documentElement.setAttribute("data-open", "0");
  document.documentElement.setAttribute("data-theme", "light");
}
</script>"""
    partners = """
<div class="partners">
  <a href="https://omsk.top-academy.ru/" target="_blank" rel="noopener"><img src="images/partners/top-academy.svg" alt=""><span>Компьютерная Академия ТОП</span></a>
  <a href="https://topitcollege.ru/omsk" target="_blank" rel="noopener"><img src="images/partners/top-college.png" alt=""><span>ТОП IT Колледж</span></a>
  <a href="https://itclastersib.ru/" target="_blank" rel="noopener"><img src="images/partners/it-cluster.png" alt=""><span>ИТ-Кластер <small>Сибири</small></span></a>
</div>"""
    code_box = """
<div class="nav-code">
  <button class="nav-code-open" id="code-open" type="button" aria-expanded="false" aria-controls="code-form">Введите код</button>
  <form id="code-form" hidden>
    <input id="code-input" aria-label="Код" inputmode="numeric" autocomplete="off" maxlength="8">
    <button class="btn" type="submit">Открыть</button>
  </form>
  <p id="code-status" role="status"></p>
</div>"""
    return """<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
%s
<title>%s</title>
<link rel="stylesheet" href="css/tokens.css">
<link rel="stylesheet" href="css/site.css">
</head>
<body%s>
<a class="skip" href="#content">К содержанию</a>
<button class="menu-button" type="button" aria-expanded="false" aria-controls="site-nav">Меню</button>
<div class="nav-backdrop" hidden></div>
<nav id="site-nav" class="nav" aria-label="Разделы">
  <button class="nav-close" type="button">Закрыть</button>
  %s
  <p class="brand">ИИ для руководителей v2</p>
  <div class="theme-switch" role="group" aria-label="Тема оформления">
    <button type="button" data-theme-choice="light">Светлая</button>
    <button type="button" data-theme-choice="dark">Тёмная</button>
    <button type="button" data-theme-choice="system">Система</button>
  </div>
  %s
  %s
</nav>
<main id="content">
%s
</main>
<script src="js/config.js"></script>
<script src="js/prompts.js"></script>
<script src="js/course.js"></script>
<script src="js/steps.js"></script>
<script src="js/portal.js"></script>
<script src="js/lesson.js"></script>
</body>
</html>
""" % (boot, esc(title), page_attr, partners, "\n  ".join(links), code_box, body)


def prompt_card(course, prompt):
    checks = "".join("<li>%s</li>" % esc(step) for step in prompt["acceptanceCriteria"])
    hint = esc(prompt["hints"][0]) if prompt["hints"] else ""
    structure = ""
    if prompt.get("promptParts"):
        structure = '<details><summary>Структура РКФОП — пояснение, не копируется</summary><dl>' + "".join('<dt>%s</dt><dd>%s</dd>' % (esc(p["label"]), esc(p["text"])) for p in prompt["promptParts"]) + '</dl></details>'
    text_id = "text-" + prompt["id"]
    return """
<article class="prompt-card" id="prompt-%s" data-topic="%s">
  <h3>%s</h3>
  <p>%s</p>
  %s<pre id="%s" class="prompt-text">%s</pre>
  <p><button class="btn copy-prompt" type="button" data-prompt-id="%s">Скопировать запрос</button></p>
  <p id="status-%s" class="copy-status" role="status"></p>
  <p>%s</p>
  <p><strong>Ожидаемый результат.</strong> %s</p>
  <p><strong>Как проверить.</strong></p>
  <ul>%s</ul>
  <p class="hint"><strong>Подсказка.</strong> %s</p>
</article>
""" % (
        esc(prompt["id"]),
        esc(prompt.get("topic", "")),
        esc(prompt["title"]),
        esc(prompt["description"]),
        structure,
        text_id,
        esc(prompt["promptText"]),
        esc(prompt["id"]),
        esc(prompt["id"]),
        ("Скопируйте структуру в свой текстовый файл и заполните самостоятельно." if prompt.get("manual") else "Перейдите в WorkAI, вставьте запрос в поле сообщения и отправьте его."),
        esc(prompt["expectedResult"]),
        checks,
        hint,
    )


def exercise_block(course, exercise_id, next_step):
    exercise = course["exercises"][exercise_id]
    prompt = next(item for item in course["prompts"] if item["id"] == exercise["promptId"])
    needs = "".join("<li>%s</li>" % esc(item) for item in exercise["needs"])
    steps = "".join("<li>%s</li>" % esc(item) for item in exercise["steps"])
    files = []
    for key in prompt["requiredMaterials"]:
        item = course["materials"][key]
        files.append('<a class="btn secondary" href="%s" download>Скачать</a> <a class="btn secondary" href="%s">Открыть</a>' % (esc(item["file"]), esc(item["file"])))
    file_html = "<p>%s</p>" % " ".join(files) if files else "<p>Отдельный файл для этого задания не нужен.</p>"
    prompt_html = prompt_card(course, prompt)
    if exercise.get("exampleHidden"):
        prompt_html = '<details><summary>Показать готовый пример запроса</summary>%s</details>' % prompt_html
    for pid in exercise.get("extraPromptIds", []):
        extra = next(item for item in course["prompts"] if item["id"] == pid)
        for key in extra["requiredMaterials"]:
            material = course["materials"][key]
            prompt_html += '<p><a href="%s" download>Скачать: %s</a></p>' % (esc(material["file"]), esc(material["title"]))
        prompt_html += prompt_card(course, extra)
    timing = '<p class="note">Около %d минут</p>' % exercise["minutes"] if exercise["minutes"] else ""
    return """
<article class="exercise" id="task-%s">
%s
  <h3>%s</h3>
  <p><strong>Что делаем.</strong> %s</p>
  <p><strong>Что понадобится.</strong></p>
  <ul>%s</ul>
  <p><strong>Материалы.</strong></p>
  %s
  <p><strong>Последовательность.</strong></p>
  <ol>%s</ol>
  %s
  <p><button class="btn secondary task-done" type="button" data-task-id="%s">Готово</button>
  <span class="task-state" role="status"></span></p>
  <p><a class="btn" href="%s">%s</a></p>
</article>
""" % (
        esc(exercise_id),
        timing,
        esc(exercise["title"]),
        esc(exercise["goal"]),
        needs,
        file_html,
        steps,
        prompt_html.strip(),
        esc(exercise_id),
        esc(next_step[0]),
        esc(next_step[1]),
    )


def reference_sections(day):
    blocks = []
    for section in day.get("sections", []):
        body = "".join("<p>%s</p>" % esc(text) for text in section["paragraphs"])
        if section["points"]:
            body += "<ul>%s</ul>" % "".join("<li>%s</li>" % esc(text) for text in section["points"])
        if section.get("table"):
            table = section["table"]
            body += '<div class="reference-table"><table><thead><tr>%s</tr></thead><tbody>%s</tbody></table></div>' % (
                "".join('<th scope="col">%s</th>' % esc(text) for text in table["headers"]),
                "".join("<tr>%s</tr>" % "".join("<td>%s</td>" % esc(text) for text in row) for row in table["rows"]))
        for question in section.get("questions", []):
            body += '<p>%s</p><details><summary>Показать разбор</summary><p>%s. %s</p></details>' % (esc(question["text"]), esc(question["options"][question["correct"]]), esc(question["explanation"]))
        for example in section["examples"]:
            body += "<h3>%s</h3><pre class=\"prompt-text\">%s</pre>" % (esc(example["title"]), esc(example["text"]))
        body += "".join('<p><a href="%s">%s</a></p>' % (esc(item["url"]), esc(item["label"])) for item in section["links"])
        body += "".join('<p><a href="#task-%s">К практике</a></p>' % esc(key) for key in section["tasks"])
        blocks.append('<section id="learn-%s"><h2>%s</h2>%s</section>' % (esc(section["id"]), esc(section["title"]), body))
    return "".join(blocks)


def day_page(course, phase, day):
    if not open_day(phase, day["number"]):
        body = """
<h1>День %d. %s</h1>
<p class="lead">Материалы этого дня ещё не открыты.</p>
<p>Сейчас здесь нет заданий, запросов и файлов.</p>
<p><a class="btn" href="prepare.html">Подготовить компьютер</a></p>
""" % (day["number"], esc(day["title"]))
        return shell(course, "День %d" % day["number"], "day%d.html" % day["number"], body, phase)
    outcomes = "".join("<li>%s</li>" % esc(item) for item in day["outcomes"])
    theory = "".join("<p>%s</p>" % esc(item) for item in day["theory"]) + ('<div id="guide">' + reference_sections(day) + "</div>" if day.get("sections") else "")
    files = []
    for key in day["materials"]:
        item = course["materials"][key]
        source = ROOT / "content" / item["file"]
        size = source.stat().st_size if source.exists() else 0
        files.append("""
<article class="file-card">
  <h3>%s</h3>
  <p>%s</p>
  <p>Тип: %s. Размер: %d байт.</p>
  <a class="btn" href="%s" download>Скачать</a>
  <a class="btn secondary" href="%s">Открыть</a>
</article>
""" % (esc(item["title"]), esc(item["why"]), esc(item["type"]), size, esc(item["file"]), esc(item["file"])))
    ids = day["exerciseIds"]
    exercises = []
    for index, key in enumerate(ids):
        if index + 1 < len(ids):
            nxt = ("#task-" + ids[index + 1], "Следующее задание")
        else:
            nxt = ("#check", "Перейти к проверке")
        exercises.append(exercise_block(course, key, nxt))
    prompt_links = []
    for key in ids:
        prompt_id = course["exercises"][key]["promptId"]
        prompt = next(item for item in course["prompts"] if item["id"] == prompt_id)
        prompt_links.append('<li><a href="#prompt-%s">%s</a></li>' % (esc(prompt_id), esc(prompt["title"])))
    checks = "".join("<li>%s</li>" % esc(item) for item in day["checks"])
    body = """
<div class="day-lock">
  <h1>День %d ещё закрыт</h1>
  <p>Откройте меню и нажмите «Введите код».</p>
</div>
<div class="lesson">
<div id="lesson-app" data-day="%d"></div>
<div id="lesson-full">
%s
<h1>День %d. %s</h1>
<p class="lead">%s</p>
<section id="overview"><h2>Чему научимся</h2><ul>%s</ul></section>
<section id="theory"><h2>Коротко о дне</h2>%s</section>
<section id="materials"><h2>Материалы</h2>%s</section>
<section id="tasks"><h2>Задания</h2>%s</section>
<section id="prompts"><h2>Промпты</h2><p>Полный текст стоит внутри задания. Здесь только ссылки на те же карточки.</p><ul>%s</ul></section>
<section id="check"><h2>Проверка</h2><ul>%s</ul><p><a class="btn secondary" href="index.html">На главную</a></p></section>
<section id="extra"><h2>Дополнительная практика</h2><p>%s</p></section>
</div>
</div>
""" % (
        day["number"],
        day["number"],
        crumb("Практика", "День %d" % day["number"]),
        day["number"],
        esc(day["title"]),
        esc(day["lead"]),
        outcomes,
        theory,
        "".join(files) or "<p>Отдельных файлов в этот день нет.</p>",
        "".join(exercises),
        "".join(prompt_links),
        checks,
        esc(day["extra"]),
    )
    return shell(course, "День %d" % day["number"], "day%d.html" % day["number"], body, phase)


def home(course, phase):
    cards = []
    titles = {
        1: "Знакомство и первые задания",
        2: "Документы и анализ",
        3: "Агенты и инструменты",
    }
    for day in course["days"]:
        title = "День %d. %s" % (day["number"], titles.get(day["number"], day["title"]))
        number = day["number"]
        description = "<p>%s</p>" % esc(day["lead"]) if number == 4 else ""
        if open_day(phase, number):
            cards.append('<a class="day-card" data-day="%d" href="day%d.html"><h2>%s</h2>%s<p>Можно открыть</p></a>' % (number, number, esc(title), description))
        cards.append('<article class="day-card" data-day-soon="%d"><h2>%s</h2>%s<p>Обзор программы. Задания откроются в день занятия.</p></article>' % (number, esc(title), description))
    body = """
<h1>ИИ для руководителей v2</h1>
<p class="lead">Практический курс: научитесь работать с ИИ, документами, данными и собственными помощниками.</p>
<p>Все инструкции, файлы и задания находятся здесь. Начните с подготовки компьютера.</p>
<p><a class="btn only-locked" href="prepare.html">Подготовить компьютер</a>
<a class="btn only-open" id="continue-link" href="day1.html">Продолжить обучение</a></p>
<div class="day-map">%s</div>
""" % "".join(cards)
    return shell(course, "ИИ для руководителей v2", "index.html", body, phase)


def prepare(course, phase):
    body = """
%s
<div id="prep-intro">
<h1>Подготовим ваш компьютер к занятиям</h1>
<p class="lead">Установите WorkAI и войдите в аккаунт. Инструкция подстроится под Windows или Mac; прогресс сохранится на этом устройстве.</p>
</div>
<div id="wizard" aria-live="polite"></div>
<noscript>
  <p>Для пошаговой подготовки включите скрипты в браузере.</p>
  <p><a href="https://workai.su/download">Страница загрузки WorkAI</a></p>
</noscript>
""" % crumb("Подготовка")
    return shell(course, "Подготовка", "prepare.html", body, phase)


def extra(course, phase):
    prompts = [item for item in course["prompts"] if open_day(phase, item["day"])]
    groups = []
    for number in (1, 2, 3, 4):
        chunk = [item for item in prompts if item["day"] == number]
        if not chunk:
            continue
        groups.append('<div data-day="%d"><h3>День %d</h3>%s</div>' % (number, number, "".join(prompt_card(course, item) for item in chunk)))
    library = "".join(groups) or "<p>Готовые запросы откроются вместе с занятием.</p>"
    filters = ""
    if prompts:
        filters = """
<p class="filters" role="group" aria-label="Тема">
<button class="btn secondary filter" type="button" data-filter="">Все</button>
<button class="btn secondary filter" type="button" data-filter="Письма">Письма</button>
<button class="btn secondary filter" type="button" data-filter="Документы">Документы</button>
<button class="btn secondary filter" type="button" data-filter="Анализ">Анализ</button>
<button class="btn secondary filter" type="button" data-filter="Управление">Управление</button>
<button class="btn secondary filter" type="button" data-filter="Агенты">Агенты</button>
</p>
"""
    glossary = "".join("<dt>%s</dt><dd>%s</dd>" % (esc(item["term"]), esc(item["text"])) for item in course["glossary"])
    faq = "".join("<details><summary>%s</summary><p>%s</p></details>" % (esc(item["q"]), esc(item["a"])) for item in course["faq"])
    links = "".join('<li><a href="%s">%s</a></li>' % (esc(item["href"]), esc(item["title"])) for item in course["links"])
    body = """
%s
<h1>Дополнительно</h1>
<section id="library"><h2>Готовые запросы</h2><p>Те же тексты, что внутри открытых дней. Здесь они собраны вместе.</p>%s%s</section>
<section id="glossary"><h2>Словарь</h2><dl>%s</dl></section>
<section id="faq"><h2>Частые вопросы</h2>%s</section>
<section id="links"><h2>Полезные ссылки</h2><ul>%s</ul></section>
<section id="memo"><h2>Памятка по файлам</h2>
<p>Скачанный файл обычно лежит в папке «Загрузки». На Mac английское название этой папки — Downloads.</p>
<p>Откройте файл двойным нажатием: два быстрых нажатия подряд.</p>
<p><a class="btn" href="qr/home.svg">Код главной страницы</a> <a class="btn secondary" href="qr/prepare.svg">Код подготовки</a></p>
</section>
""" % (crumb("Дополнительно"), filters, library, glossary, faq, links)
    return shell(course, "Дополнительно", "extra.html", body, phase)


def config_js(config, phase):
    data = {
        "siteUrl": config["siteUrl"],
        "prepareUrl": config["prepareUrl"],
        "futureDomain": config.get("futureDomain", ""),
        "phase": phase,
        "contacts": config.get("contacts", ""),
        "codes": config.get("codes", {}),
    }
    return "window.SITE = %s;\n" % json.dumps(data, ensure_ascii=False, indent=2)


def course_js(course, phase):
    days = []
    exercise_ids = []
    for day in course["days"]:
        if not open_day(phase, day["number"]):
            continue
        days.append(day)
        exercise_ids.extend(day["exerciseIds"])
    exercises = {key: course["exercises"][key] for key in exercise_ids}
    prompt_ids = {item["promptId"] for item in exercises.values()}
    for item in exercises.values():
        prompt_ids.update(item.get("extraPromptIds", []))
    prompts = [item for item in course["prompts"] if item["id"] in prompt_ids]
    materials = {}
    for day in days:
        for key in day["materials"]:
            item = dict(course["materials"][key])
            source = ROOT / "content" / item["file"]
            item["bytes"] = source.stat().st_size if source.exists() else 0
            materials[key] = item
    payload = {"days": days, "exercises": exercises, "prompts": prompts, "materials": materials}
    return "window.COURSE = %s;\n" % json.dumps(payload, ensure_ascii=False, indent=2)


def prompts_js(course, phase):
    open_prompts = [item for item in course["prompts"] if open_day(phase, item["day"])]
    payload = {item["id"]: {"promptText": item["promptText"]} for item in open_prompts}
    return "window.COURSE_PROMPTS = %s;\n" % json.dumps(payload, ensure_ascii=False, indent=2)


def write_task_codes(course, config):
    try:
        import segno
    except ImportError:
        return
    base = (config.get("siteUrl") or "").rstrip("/")
    if not base:
        return
    folder = ROOT / "qr"
    folder.mkdir(exist_ok=True)
    for day in course["days"]:
        for key in day["exerciseIds"]:
            url = "%s/day%d.html#task-%s" % (base, day["number"], key)
            segno.make(url, error="m").save(str(folder / ("task-%s.svg" % key)), scale=6, border=2)


def write_workbook(course, number):
    day = course["days"][number - 1]
    prompts = {p["id"]: p for p in course["prompts"]}
    folder = ROOT / "content" / "files"
    workbook = ["# Моя тетрадь дня %d" % number, "СеверПром — вымышленная организация; данные синтетические. Используйте только учебные материалы. Тетрадь хранится у вас, сайт её не собирает.", "Открытая учебная папка содержит две соседние папки: СеверПром (источники) и Результаты (ваши работы). Полный путь вводить и переименовывать системную Documents не нужно.", "Сохраните этот файл у себя, заполните после каждой практики. Все промпты есть на сайте и в day%d-prompts.txt." % number]
    texts = ["ДЕНЬ %d. ПОРУЧЕНИЯ ПО ПРАКТИКАМ И ЭТАПАМ" % number]
    if number == 3:
        workbook.append("Работы этого дня: Результаты/День_3. Пароль и Authorization храните в персональных настройках. Неотработанные MCP-вызовы и демонстрационные примеры отмечайте явно.")
    for key in day["exerciseIds"]:
        exercise = course["exercises"][key]
        workbook.extend(["## " + exercise["title"], exercise["goal"], "Вся практика: до %s минут, включая проверку." % exercise["minutes"], "### Входные материалы", "\n".join("- " + name for name in exercise["needs"])])
        texts.append("\n" + exercise["title"])
        for pid in [exercise["promptId"]] + exercise.get("extraPromptIds", []):
            prompt = prompts[pid]
            workbook.extend(["### " + prompt["title"], prompt["description"], "Результат в папке «Результаты»: " + prompt["expectedResult"], "Критерии: " + " ".join(prompt["acceptanceCriteria"])])
            texts.append(prompt["title"] + "\n" + prompt["promptText"] + "\nРезультат: " + prompt["expectedResult"] + "\nПриёмка: " + " ".join(prompt["acceptanceCriteria"]))
        for heading in ["Задача", "Мои запросы", "Что получил", "Что проверил", "Что исправил", "Вывод"]:
            workbook.extend(["### " + heading, "_Заполните своими словами._"])
    (folder / ("day%d-workbook.md" % number)).write_text("\n\n".join(workbook) + "\n", encoding="utf-8")
    (folder / ("day%d-prompts.txt" % number)).write_text("\n\n".join(texts) + "\n", encoding="utf-8")
    with zipfile.ZipFile(folder / ("day%d-workbook.zip" % number), "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for key in day["materials"]:
            path = course["materials"][key]["file"]
            if path.endswith(".zip"):
                continue
            source = ROOT / "content" / path
            info = zipfile.ZipInfo(str(Path(path).relative_to("files")), date_time=(2026, 11, 6 if number == 2 else 8, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, source.read_bytes())


def build(phase, out):
    course, config = load()
    write_workbook(course, 2)
    write_workbook(course, 3)
    phase = normalize(phase)
    if phase not in ("pre-course", "day-1", "day-2", "day-3", "day-4"):
        raise SystemExit("unknown phase")
    out.mkdir(parents=True, exist_ok=True)
    pages = {
        "index.html": home(course, phase),
        "prepare.html": prepare(course, phase),
        "extra.html": extra(course, phase),
    }
    for day in course["days"]:
        pages["day%d.html" % day["number"]] = day_page(course, phase, day)
    for name, text in pages.items():
        (out / name).write_text(text, encoding="utf-8")
    (out / "js").mkdir(exist_ok=True)
    (out / "js" / "config.js").write_text(config_js(config, phase), encoding="utf-8")
    (out / "js" / "prompts.js").write_text(prompts_js(course, phase), encoding="utf-8")
    (out / "js" / "course.js").write_text(course_js(course, phase), encoding="utf-8")
    write_task_codes(course, config)
    for folder in ("css", "qr", "images", "fonts"):
        target = out / folder
        if target.resolve() != (ROOT / folder).resolve():
            if target.exists():
                shutil.rmtree(target)
            shutil.copytree(ROOT / folder, target)
    for name in ("steps.js", "portal.js", "lesson.js"):
        if out.resolve() != ROOT.resolve():
            shutil.copy(ROOT / "js" / name, out / "js" / name)
    files_out = out / "files"
    if files_out.exists() and files_out.resolve() != (ROOT / "content" / "files").resolve():
        shutil.rmtree(files_out)
    files_out.mkdir(exist_ok=True)
    allowed = set()
    for day in course["days"]:
        if open_day(phase, day["number"]):
            allowed.update(day["materials"])
    for key in sorted(allowed):
        source = ROOT / "content" / course["materials"][key]["file"]
        dest = out / course["materials"][key]["file"]
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(source, dest)
    (out / ".nojekyll").write_text("", encoding="utf-8")
    print("built", phase, "->", out)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--phase")
    parser.add_argument("--out", default=".")
    args = parser.parse_args()
    _, config = load()
    phase = args.phase or config.get("phase") or "pre-course"
    build(phase, (ROOT / args.out).resolve() if not Path(args.out).is_absolute() else Path(args.out))


if __name__ == "__main__":
    main()
