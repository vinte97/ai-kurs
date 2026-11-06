#!/usr/bin/env python3
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
PUBLIC = ["index.html", "prepare.html", "day1.html", "day2.html", "day3.html", "day4.html", "extra.html"]
BANNED = [
    "Паспорт_задачи",
    "10_Материалы",
    "Разберись, почему встала линия",
    "token=",
    "127.0.0.1",
]


def main():
    errors = []
    text = "\n".join((ROOT / name).read_text(encoding="utf-8") for name in PUBLIC)
    text += (ROOT / "js" / "steps.js").read_text(encoding="utf-8")
    text += (ROOT / "js" / "lesson.js").read_text(encoding="utf-8")
    course_js = ROOT / "js" / "course.js"
    if course_js.exists():
        text += course_js.read_text(encoding="utf-8")
    for word in BANNED:
        if word in text:
            errors.append("public text contains " + word)
    home = (ROOT / "index.html").read_text(encoding="utf-8")
    if "ИИ для руководителей" not in home or "Подготовить компьютер" not in home:
        errors.append("home start missing")
    if "Введите код" not in home or 'id="code-form"' not in home:
        errors.append("code field missing")
    config = (ROOT / "js" / "config.js").read_text(encoding="utf-8")
    for number in ("4817", "2639", "7054", "9182"):
        if number not in config:
            errors.append("code missing from config")
        if number in home:
            errors.append("code is visible on the home page")
    if 'href="/ai-kurs/' in text or "<base " in text:
        errors.append("absolute site base would block a future domain")
    for path in re.findall(r"images/[A-Za-z0-9._-]+", (ROOT / "js" / "steps.js").read_text(encoding="utf-8")):
        if not (ROOT / path).is_file():
            errors.append("missing screenshot " + path)
    for name in PUBLIC:
        for href in re.findall(r'href="([^"]+)"', (ROOT / name).read_text(encoding="utf-8")):
            if href.startswith(("http://", "https://", "#")) or "#" in href:
                continue
            if not (ROOT / href).exists():
                errors.append(name + " missing " + href)
    check = subprocess.run(["node", "--check", str(ROOT / "js" / "lesson.js")], capture_output=True, text=True)
    if check.returncode != 0:
        errors.append(check.stderr)
    check = subprocess.run(["node", "--check", str(ROOT / "js" / "portal.js")], capture_output=True, text=True)
    if check.returncode != 0:
        errors.append(check.stderr)
    check = subprocess.run(["node", "--check", str(ROOT / "js" / "steps.js")], capture_output=True, text=True)
    if check.returncode != 0:
        errors.append(check.stderr)
    probe = r"""
const fs = require("fs");
const vm = require("vm");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("js/steps.js", "utf8").replace("window.", "this.window."), sandbox);
const tracks = sandbox.window.TRACKS;
for (const name of Object.keys(tracks)) {
  tracks[name].forEach((step) => {
    if (!step.where && !(Array.isArray(step.instructions) && step.instructions.length && step.instructions.every(line => typeof line === "string" && line.trim()))) throw new Error(step.id + " missing instructions");
    for (const key of ["do", "see", "check", "help"]) {
      if (!step[key] || (key === "help" && !step.help.length)) throw new Error(step.id + " missing " + key);
    }
  });
}
for (const track of Object.values(tracks)) {
  const groups = [...new Set(track.map(step => step.group))];
  if (groups.join(',') !== 'workai,launch,git,python,files,billing,ready') throw new Error('preparation stages are not separated');
}
for (const track of Object.values(tracks)) {
  const billing = track.filter(step => step.group === 'billing');
  if (billing.length !== 2 || !billing.every(step => step.image)) throw new Error('billing instructions need two screenshots');
  if (billing[0].action.href !== 'https://workai.su/dashboard/billing' || !billing[1].skip) throw new Error('billing link or wait-for-code path missing');
}
if (sandbox.window.SEVERPROM_PROMPT) throw new Error('company download belongs to day 2');
if (!sandbox.window.UNKNOWN_STEPS.length) throw new Error("no unknown steps");
"""
    probe_run = subprocess.run(["node", "-e", probe], cwd=ROOT, capture_output=True, text=True)
    if probe_run.returncode != 0:
        errors.append(probe_run.stderr or probe_run.stdout)
    if errors:
        print("\n".join(errors))
        return 1
    print("ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
