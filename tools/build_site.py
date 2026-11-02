#!/usr/bin/env python3
import argparse
import html
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHASES = ["precourse", "day-1", "day-2", "day-3", "day-4"]
NAV = [
    ("index.html", "Главная"),
    ("prepare.html", "Подготовка"),
    ("day1.html", "День 1"),
    ("day2.html", "День 2"),
    ("day3.html", "День 3"),
    ("day4.html", "День 4"),
    ("extra.html", "Дополнительно"),
]
SUB = [
    ("overview", "Обзор"),
    ("theory", "Теория"),
    ("tasks", "Задания"),
    ("prompts", "Промпты"),
    ("materials", "Материалы"),
    ("check", "Проверка результатов"),
]


def esc(value):
    return html.escape(str(value), quote=True)


def open_day(phase, number):
    if phase == "precourse":
        return False
    return number <= int(phase.split("-")[1])


def load():
    course = json.loads((ROOT / "content" / "course.json").read_text(encoding="utf-8"))
    config = json.loads((ROOT / "site.config.json").read_text(encoding="utf-8"))
    return course, config


def shell(title, current, body, phase_note=""):
    links = []
    for href, label in NAV:
        current_attr = ' aria-current="page"' if href == current else ""
        links.append('<a href="%s"%s>%s</a>' % (href, current_attr, esc(label)))
        if current.startswith("day") and href == current:
            links.append('<div class="subnav">%s</div>' % "".join(
                '<a href="%s#%s">%s</a>' % (current, item, esc(name)) for item, name in SUB
            ))
    return """<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%s</title>
<link rel="stylesheet" href="css/tokens.css">
<link rel="stylesheet" href="css/site.css">
</head>
<body>
<a class="skip" href="#content">К содержанию</a>
<button class="menu-button" type="button" aria-expanded="false" aria-controls="site-nav">Меню</button>
<nav id="site-nav" class="nav" aria-label="Разделы">
  <p class="brand">ИИ для руководителей</p>
  %s
</nav>
<main id="content">
%s
</main>
<script src="js/config.js"></script>
<script src="js/steps.js"></script>
<script src="js/portal.js"></script>
%s
</body>
</html>
""" % (esc(title), "\n  ".join(links), body, phase_note)


def prompt_card(course, prompt):
    materials = course["materials"]
    lines = []
    for key in prompt["requiredMaterials"]:
        item = materials[key]
        lines.append('<li><a href="%s" download>%s</a></li>' % (esc(item["file"]), esc(item["title"])))
    material_html = "<ul>%s</ul>" % "".join(lines) if lines else "<p>Отдельный файл не нужен.</p>"
    steps = "".join("<li>%s</li>" % esc(step) for step in prompt["instructions"])
    checks = "".join("<li>%s</li>" % esc(step) for step in prompt["acceptanceCriteria"])
    hints = "".join("<p>%s</p>" % esc(step) for step in prompt["hints"])
    text_id = "text-" + prompt["id"]
    short = ""
    if prompt.get("shortText"):
        short_id = text_id + "-short"
        short = """
<pre id="%s" class="prompt-text" hidden>%s</pre>
<p><button class="btn secondary copy-prompt" type="button" data-copy-for="%s">Скопировать короткую версию</button></p>
<p id="%s-status" class="copy-status" role="status"></p>
""" % (short_id, esc(prompt["shortText"]), short_id, short_id)
    file_buttons = ""
    for key in prompt["requiredMaterials"]:
        item = materials[key]
        file_buttons += '<a class="btn secondary" href="%s" download>Скачать материал</a>' % esc(item["file"])
        file_buttons += '<a class="btn secondary" href="%s">Открыть учебный документ</a>' % esc(item["file"])
    return """
<article class="prompt-card" id="prompt-%s">
  <h3>%s</h3>
  <p>%s</p>
  <pre id="%s" class="prompt-text">%s</pre>
  <p><button class="btn copy-prompt" type="button" data-copy-for="%s">Скопировать запрос</button>
  <button class="btn secondary toggle-prompt" type="button" data-toggle-for="%s">Скрыть</button></p>
  <p id="%s-status" class="copy-status" role="status"></p>
  %s
  <h4>Какие файлы нужны</h4>
  %s
  <details>
    <summary>Как использовать</summary>
    <ol>%s</ol>
  </details>
  <p><strong>Ожидаемый результат.</strong> %s</p>
  <p><strong>Как проверить.</strong></p>
  <ul>%s</ul>
  <div class="hint"><strong>Подсказка.</strong> %s</div>
  %s
</article>
""" % (
        esc(prompt["id"]),
        esc(prompt["title"]),
        esc(prompt["description"]),
        text_id,
        esc(prompt["promptText"]),
        text_id,
        text_id,
        text_id,
        short,
        material_html,
        steps,
        esc(prompt["expectedResult"]),
        checks,
        hints,
        file_buttons,
    )


def exercise_block(course, exercise_id):
    exercise = course["exercises"][exercise_id]
    prompt = next(item for item in course["prompts"] if item["id"] == exercise["promptId"])
    needs = "".join("<li>%s</li>" % esc(item) for item in exercise["needs"])
    steps = "".join("<li>%s</li>" % esc(item) for item in exercise["steps"])
    return """
<article class="exercise" id="task-%s">
  <h3>%s</h3>
  <p><strong>Что будем делать.</strong> %s</p>
  <p><strong>Что понадобится.</strong></p>
  <ul>%s</ul>
  <ol>%s</ol>
  %s
  <details>
    <summary>Не получилось?</summary>
    <p>%s</p>
  </details>
</article>
""" % (
        esc(exercise_id),
        esc(exercise["title"]),
        esc(exercise["goal"]),
        needs,
        steps,
        prompt_card(course, prompt),
        esc(exercise["fail"]),
    )


def day_page(course, phase, day):
    if not open_day(phase, day["number"]):
        body = """
<h1>День %d. %s</h1>
<p class="lead">Материалы этого дня ещё не открыты.</p>
<p>Сейчас здесь нет заданий, запросов и файлов.</p>
<p><a class="btn" href="prepare.html">Подготовить компьютер</a></p>
""" % (day["number"], esc(day["title"]))
        return shell("День %d" % day["number"], "day%d.html" % day["number"], body)
    outcomes = "".join("<li>%s</li>" % esc(item) for item in day["outcomes"])
    theory = "".join("<p>%s</p>" % esc(item) for item in day["theory"])
    files = []
    for key in day["materials"]:
        item = course["materials"][key]
        files.append("""
<article class="file-card">
  <h3>%s</h3>
  <p>%s</p>
  <p>Тип: %s</p>
  <a class="btn" href="%s" download>Скачать</a>
</article>
""" % (esc(item["title"]), esc(item["why"]), esc(item["type"]), esc(item["file"])))
    exercises = [exercise_block(course, key) for key in day["exerciseIds"]]
    prompt_links = []
    for key in day["exerciseIds"]:
        prompt_id = course["exercises"][key]["promptId"]
        prompt = next(item for item in course["prompts"] if item["id"] == prompt_id)
        prompt_links.append('<li><a href="#prompt-%s">%s</a></li>' % (esc(prompt_id), esc(prompt["title"])))
    checks = "".join("<li>%s</li>" % esc(item) for item in day["checks"])
    body = """
<p class="note">День %d</p>
<h1>День %d. %s</h1>
<p class="lead">%s</p>
<section id="overview"><h2>Чему научимся</h2><ul>%s</ul></section>
<section id="theory"><h2>Теория</h2>%s</section>
<section id="materials"><h2>Материалы дня</h2>%s</section>
<section id="tasks"><h2>Задания</h2>%s</section>
<section id="prompts"><h2>Готовые запросы</h2><p>Полный текст запроса стоит внутри задания. Ниже ссылки на те же карточки.</p><ul>%s</ul></section>
<section id="check"><h2>Проверка</h2><ul>%s</ul></section>
<section id="extra"><h2>Дополнительная практика</h2><p>%s</p></section>
""" % (
        day["number"],
        day["number"],
        esc(day["title"]),
        esc(day["lead"]),
        outcomes,
        theory,
        "".join(files),
        "".join(exercises),
        "".join(prompt_links),
        checks,
        esc(day["extra"]),
    )
    return shell("День %d" % day["number"], "day%d.html" % day["number"], body)


def home(course, phase):
    if phase == "precourse":
        label, href = "Подготовить компьютер", "prepare.html"
    elif phase == "day-1":
        label, href = "Перейти к первому занятию", "day1.html"
    else:
        label, href = "Продолжить обучение", "day%d.html" % int(phase.split("-")[1])
    cards = []
    for day in course["days"]:
        state = "Можно открыть" if open_day(phase, day["number"]) else "Пока закрыт"
        cards.append("""
<a class="day-card" href="day%d.html"><h2>День %d. %s</h2><p>%s</p><p class="note">%s</p></a>
""" % (day["number"], day["number"], esc(day["title"]), esc(day["lead"]), state))
    body = """
<h1>Добро пожаловать на курс „ИИ для руководителей“.</h1>
<p class="lead">Здесь находятся все инструкции, задания и материалы для наших занятий.</p>
<p><a class="btn" href="%s">%s</a></p>
<div class="day-map">%s</div>
""" % (href, esc(label), "".join(cards))
    return shell("ИИ для руководителей", "index.html", body)


def prepare():
    body = """
<h1>Подготовка</h1>
<div id="wizard"></div>
<noscript>
  <p>Для пошаговой подготовки включите скрипты в браузере.</p>
  <p><a href="https://workai.su/download">Страница загрузки WorkAI</a></p>
</noscript>
"""
    return shell("Подготовка", "prepare.html", body)


def extra(course, phase):
    prompts = [item for item in course["prompts"] if open_day(phase, item["day"])]
    library = "".join(prompt_card(course, item) for item in prompts) or "<p>Запросы откроются вместе с занятием.</p>"
    glossary = "".join("<dt>%s</dt><dd>%s</dd>" % (esc(item["term"]), esc(item["text"])) for item in course["glossary"])
    faq = "".join("<details><summary>%s</summary><p>%s</p></details>" % (esc(item["q"]), esc(item["a"])) for item in course["faq"])
    links = "".join('<li><a href="%s">%s</a></li>' % (esc(item["href"]), esc(item["title"])) for item in course["links"])
    body = """
<h1>Дополнительно</h1>
<section id="library"><h2>Библиотека запросов</h2><p>Те же тексты, что внутри открытых дней.</p>%s</section>
<section id="glossary"><h2>Словарь</h2><dl>%s</dl></section>
<section id="faq"><h2>Частые вопросы</h2>%s</section>
<section id="links"><h2>Полезные ссылки</h2><ul>%s</ul></section>
<section id="memo"><h2>Памятка по файлам</h2>
<p>Скачанный файл обычно лежит в папке «Загрузки». На Mac английское название этой папки — Downloads.</p>
<p>Откройте файл двойным нажатием: два быстрых нажатия подряд.</p>
<p><a class="btn" href="qr/home.svg">Код главной страницы</a> <a class="btn secondary" href="qr/prepare.svg">Код подготовки</a></p>
</section>
<section id="more"><h2>Дополнительные задания</h2><p>Они стоят в конце открытого дня, в блоке «Дополнительная практика».</p></section>
""" % (library, glossary, faq, links)
    return shell("Дополнительно", "extra.html", body)


def config_js(config, phase):
    data = {
        "siteUrl": config["siteUrl"],
        "prepareUrl": config["prepareUrl"],
        "futureDomain": config.get("futureDomain", ""),
        "phase": phase,
        "contacts": config.get("contacts", ""),
    }
    return "window.SITE = %s;\n" % json.dumps(data, ensure_ascii=False, indent=2)


def build(phase, out):
    course, config = load()
    if phase not in PHASES:
        raise SystemExit("unknown phase")
    out.mkdir(parents=True, exist_ok=True)
    pages = {
        "index.html": home(course, phase),
        "prepare.html": prepare(),
        "extra.html": extra(course, phase),
    }
    for day in course["days"]:
        pages["day%d.html" % day["number"]] = day_page(course, phase, day)
    for name, text in pages.items():
        (out / name).write_text(text, encoding="utf-8")
    (out / "js").mkdir(exist_ok=True)
    (out / "js" / "config.js").write_text(config_js(config, phase), encoding="utf-8")
    for folder in ("css", "qr"):
        target = out / folder
        if target.resolve() != (ROOT / folder).resolve():
            if target.exists():
                shutil.rmtree(target)
            shutil.copytree(ROOT / folder, target)
    for name in ("steps.js", "portal.js"):
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
    if phase != "precourse":
        allowed.add("kak-vstavit")
    for key in allowed:
        source = ROOT / "content" / course["materials"][key]["file"]
        dest = out / course["materials"][key]["file"]
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(source, dest)
    marker = out / ".nojekyll"
    marker.write_text("", encoding="utf-8")
    print("built", phase, "->", out)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--phase")
    parser.add_argument("--out", default=".")
    args = parser.parse_args()
    _, config = load()
    phase = args.phase or config.get("phase") or "precourse"
    build(phase, (ROOT / args.out).resolve() if not Path(args.out).is_absolute() else Path(args.out))


if __name__ == "__main__":
    main()
