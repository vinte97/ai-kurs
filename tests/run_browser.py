#!/usr/bin/env python3
import json
import os
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
course = json.loads((ROOT / "content" / "course.json").read_text(encoding="utf-8"))
codes = json.loads((ROOT / "site.config.json").read_text(encoding="utf-8"))["codes"]
letter = next(item["promptText"] for item in course["prompts"] if item["id"] == "d1-letter")
BASE = "http://127.0.0.1:4181"
failures = []


def check(name, ok, detail=""):
    print(("ok" if ok else "FAIL"), name, detail)
    if not ok:
        failures.append(name)


def serve(port, folder):
    return subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port)],
        cwd=folder,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def main():
    day = Path("/tmp/aikurs-day1-pw")
    subprocess.check_call([sys.executable, "tools/build_site.py", "--phase", "day-1", "--out", str(day)], cwd=ROOT)
    server = serve(4181, ROOT)
    day_server = serve(4182, day)
    day_base = "http://127.0.0.1:4182"
    try:
        with sync_playwright() as playwright:
            launch = {}
            if os.environ.get("PW_CHROME"):
                launch["executable_path"] = os.environ["PW_CHROME"]
            browser = playwright.chromium.launch(**launch)
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            page.goto(BASE + "/")
            check("A home", page.locator("h1").inner_text() == "ИИ для руководителей v2")
            page.get_by_role("link", name="Подготовить компьютер").click()
            page.get_by_role("button", name="Начать подготовку").click()
            page.get_by_role("button", name="Windows — например, Lenovo, ASUS, HP или Acer").click()
            check("A windows", "Это инструкция для Windows." in page.locator("#wizard").inner_text())
            page.get_by_role("button", name="Сменить компьютер").click()
            page.get_by_role("button", name="Mac — компьютер Apple").click()
            check("A mac", "Это инструкция для Mac." in page.locator("#wizard").inner_text() and "Это инструкция для Windows." not in page.locator("#wizard").inner_text())
            page.get_by_role("button", name="Получилось, дальше").click()
            page.reload()
            check("A progress", "Это инструкция для Mac." not in page.locator("#wizard").inner_text())
            page.goto(BASE + "/")
            check("D hidden", page.locator("nav a[href='day1.html']").is_hidden())
            page.get_by_role("button", name="Введите код").click()
            page.get_by_label("Код").fill("0000")
            page.locator("#code-form").get_by_role("button", name="Открыть").click()
            check("D bad", "не подошёл" in page.locator("#code-status").inner_text())
            page.get_by_label("Код").fill(codes["2"])
            page.locator("#code-form").get_by_role("button", name="Открыть").click()
            check("D days", page.locator("nav a[href='day1.html']").is_visible() and page.locator("nav a[href='day2.html']").is_visible() and page.locator("nav a[href='day3.html']").is_hidden())
            check("D note", "1–2" in page.locator("#code-status").inner_text())
            check("D field", page.locator("#code-form").is_hidden())
            page.goto(BASE + "/day3.html")
            check("D later", page.locator(".lesson").is_hidden() and page.locator(".day-lock").is_visible())
            page.reload()
            check("D keep", page.locator(".day-lock").is_visible())
            phone = browser.new_page(viewport={"width": 375, "height": 800})
            phone.goto(BASE + "/")
            menu = phone.get_by_role("button", name="Меню")
            menu.click()
            phone.keyboard.press("Escape")
            focused = phone.evaluate("() => document.activeElement && document.activeElement.className")
            check("E menu", menu.get_attribute("aria-expanded") == "false" and focused == "menu-button")
            fits = phone.evaluate("() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1")
            check("E scroll", fits is True)
            wide = browser.new_page(viewport={"width": 1280, "height": 800})
            wide.goto(BASE + "/")
            zoom = wide.evaluate(
                """() => { document.body.style.zoom = '2'; return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1; }"""
            )
            check("E zoom", zoom is True)
            context = browser.new_context()
            context.grant_permissions(["clipboard-read", "clipboard-write"])
            copied_page = context.new_page()
            copied_page.add_init_script("localStorage.setItem('aikurs-open-day','1')")
            copied_page.goto(day_base + "/day1.html")
            copied_page.get_by_role("button", name="Начать первое задание").click()
            check("L start", "Откройте программу WorkAI" in copied_page.locator("#lesson-app").inner_text())
            copied_page.get_by_role("button", name="Назад").click()
            check("L back", "Продолжить с задания 1" in copied_page.locator("#lesson-app").inner_text())
            copied_page.goto(day_base + "/day1.html#task-letter")
            app = copied_page.locator("#lesson-app")
            app.get_by_role("button", name="Получилось, дальше").click()
            app.get_by_role("button", name="Скопировать запрос").click()
            app.get_by_role("button", name="Скопировано!").wait_for()
            copied = copied_page.evaluate("navigator.clipboard.readText()")
            check("B clipboard", copied == letter)
            copied_page.goto(day_base + "/day1.html#task-refine")
            field = app.get_by_label("Что произошло?")
            field.fill("Совещание перенесли на пятницу")
            app.get_by_role("button", name="Скопировать мой запрос").click()
            app.get_by_role("button", name="Скопировано!").wait_for()
            changed = copied_page.evaluate("navigator.clipboard.readText()")
            check("L builder", "пятницу" in changed and "[напишите" not in changed)
            app.get_by_role("button", name="Скопировано!").focus()
            copied_page.keyboard.press("Enter")
            check("E keyboard copy", "пятницу" in copied_page.evaluate("navigator.clipboard.readText()"))
            copied_page.get_by_role("button", name="Продолжить").click()
            copied_page.reload()
            check("L keep", "Вставьте запрос" in copied_page.locator("#lesson-app").inner_text())
            copied_page.goto(day_base + "/day1.html#task-facts")
            link = copied_page.locator("#lesson-app a[download]")
            href = link.get_attribute("href")
            file_response = copied_page.request.get(day_base + "/" + href)
            copied_page.locator("#lesson-app").get_by_role("button", name="Как найти скачанный файл?").click()
            check("L download", file_response.status == 200 and len(file_response.body()) > 0 and "Загрузки" in copied_page.locator("#lesson-app").inner_text())
            phone_day = browser.new_page(viewport={"width": 375, "height": 800})
            phone_day.add_init_script("localStorage.setItem('aikurs-open-day','1')")
            phone_day.goto(day_base + "/day1.html#task-letter")
            phone_fit = phone_day.evaluate("() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1")
            check("L phone", phone_fit is True and phone_day.get_by_role("button", name="Получилось, дальше").is_visible())
            secret = (day / "day3.html").read_text(encoding="utf-8") + (day / "js" / "course.js").read_text(encoding="utf-8")
            check("L secret", "127.0.0.1" not in secret and "token=" not in secret and "d2-deals" not in (day / "js" / "course.js").read_text(encoding="utf-8"))
            context.close()
            fail_page = browser.new_page()
            fail_page.add_init_script(
                """Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } });
                document.execCommand = () => false;"""
            )
            fail_page.add_init_script("localStorage.setItem('aikurs-open-day','1')")
            fail_page.goto(day_base + "/day1.html#task-letter")
            fail_page.locator("#lesson-app").get_by_role("button", name="Получилось, дальше").click()
            fail_page.locator("#lesson-app").get_by_role("button", name="Скопировать запрос").click()
            status = fail_page.locator("#lesson-app .copy-status").inner_text()
            check("B fail", "Не удалось скопировать" in status and fail_page.locator("#lesson-app").get_by_role("button", name="Скопировать запрос").is_visible())
            files_ok = True
            names = []
            for path in (day / "files").iterdir():
                names.append(path.name)
                response = fail_page.request.get(day_base + "/files/" + path.name)
                if response.status != 200 or len(response.body()) == 0:
                    files_ok = False
            day_html = (day / "day1.html").read_text(encoding="utf-8")
            check("C files", files_ok and "kak-vstavit.txt" in names and "den2-sdelki.txt" not in names and "files/kak-vstavit.txt" in day_html)
            day_js = (day / "js" / "prompts.js").read_text(encoding="utf-8")
            public_js = (ROOT / "js" / "prompts.js").read_text(encoding="utf-8")
            check("D split", "d1-letter" in day_js and "d2-deals" not in day_js and "d4-helper" in public_js)
            browser.close()
    finally:
        server.terminate()
        day_server.terminate()
    if failures:
        print("failed:", ", ".join(failures))
        return 1
    print("browser checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
