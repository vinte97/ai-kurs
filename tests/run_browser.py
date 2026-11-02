#!/usr/bin/env python3
import json
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
course = json.loads((ROOT / "content" / "course.json").read_text(encoding="utf-8"))
letter = next(item["promptText"] for item in course["prompts"] if item["id"] == "d1-letter")
BASE = "http://127.0.0.1:4181"
failures = []


def check(name, ok, detail=""):
    print(("ok" if ok else "FAIL"), name, detail)
    if not ok:
        failures.append(name)


def main():
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", "4181"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            page = browser.new_page()
            page.goto(BASE + "/")
            check("home", "Добро пожаловать" in page.locator("h1").inner_text())
            check("continue", page.get_by_role("link", name="Продолжить обучение").is_visible())
            names = ["Главная", "Подготовка", "День 1", "День 2", "День 3", "День 4", "Дополнительно"]
            nav_ok = True
            for name in names:
                page.goto(BASE + "/")
                page.get_by_role("navigation").get_by_role("link", name=name, exact=True).click()
                current = page.get_by_role("navigation").get_by_role("link", name=name, exact=True)
                if current.get_attribute("aria-current") != "page":
                    nav_ok = False
            check("nav", nav_ok)
            page.goto(BASE + "/day1.html")
            check("exercise", "Напишем письмо" in page.locator("#task-letter").inner_text())
            check("prompt text", page.locator("#text-d1-letter").inner_text() == letter)
            context = browser.new_context()
            context.grant_permissions(["clipboard-read", "clipboard-write"])
            copied_page = context.new_page()
            copied_page.goto(BASE + "/day1.html#task-letter")
            copied_page.locator("#prompt-d1-letter").get_by_role("button", name="Скопировать запрос").click()
            copied_page.locator("#prompt-d1-letter").get_by_role("button", name="Скопировано!").wait_for()
            copied = copied_page.evaluate("navigator.clipboard.readText()")
            check("clipboard", copied == letter, repr(copied[:40]) if copied != letter else "")
            context.close()
            fail_page = browser.new_page()
            fail_page.add_init_script(
                """Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } });
                document.execCommand = () => false;"""
            )
            fail_page.goto(BASE + "/day1.html")
            fail_page.locator("#prompt-d1-letter").get_by_role("button", name="Скопировать запрос").click()
            status = fail_page.locator("#text-d1-letter-status").inner_text()
            check("copy help", "Автокопирование не сработало" in status and "Скопировано" not in fail_page.locator("#prompt-d1-letter").inner_text())
            page.goto(BASE + "/day1.html")
            hrefs = page.locator("#materials a").evaluate_all("nodes => nodes.map(node => node.getAttribute('href'))")
            files_ok = True
            for href in hrefs:
                response = page.request.get(href if href.startswith("http") else BASE + "/" + href)
                if response.status != 200:
                    files_ok = False
            check("files", files_ok and len(hrefs) > 0, str(hrefs))
            phone = browser.new_page(viewport={"width": 390, "height": 844})
            phone.goto(BASE + "/")
            menu = phone.get_by_role("button", name="Меню")
            menu.click()
            opened = menu.get_attribute("aria-expanded") == "true"
            menu.click()
            closed = menu.get_attribute("aria-expanded") == "false"
            check("phone menu", opened and closed)
            page.goto(BASE + "/day1.html#task-letter")
            page.reload()
            check("reload", "#task-letter" in page.url and page.locator("#task-letter").is_visible())
            page.set_viewport_size({"width": 1280, "height": 800})
            page.goto(BASE + "/day1.html")
            fits = page.evaluate(
                """() => { document.body.style.zoom = '1.5'; return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1; }"""
            )
            check("zoom", fits is True)
            routes_ok = True
            for href in ["/", "/prepare.html", "/day1.html", "/day2.html", "/day3.html", "/day4.html", "/extra.html"]:
                if page.request.get(BASE + href).status != 200:
                    routes_ok = False
            check("routes", routes_ok)
            browser.close()
        out = Path("/tmp/aikurs-precourse-pw")
        subprocess.check_call([sys.executable, "tools/build_site.py", "--phase", "precourse", "--out", str(out)], cwd=ROOT)
        closed = (out / "day1.html").read_text(encoding="utf-8") + (out / "extra.html").read_text(encoding="utf-8")
        check("precourse", "еженедельное совещание" not in closed and "ещё не открыты" in closed)
    finally:
        server.terminate()
    if failures:
        print("failed:", ", ".join(failures))
        return 1
    print("browser checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
