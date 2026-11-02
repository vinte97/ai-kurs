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
    ".zip",
]


def main():
    errors = []
    text = "\n".join((ROOT / name).read_text(encoding="utf-8") for name in PUBLIC)
    text += (ROOT / "js" / "steps.js").read_text(encoding="utf-8")
    for word in BANNED:
        if word in text:
            errors.append("public text contains " + word)
    if "Подготовить компьютер" not in (ROOT / "index.html").read_text(encoding="utf-8"):
        errors.append("home button missing")
    if 'href="/ai-kurs/' in text or "<base " in text:
        errors.append("absolute site base would block a future domain")
    for name in PUBLIC:
        for href in re.findall(r'href="([^"]+)"', (ROOT / name).read_text(encoding="utf-8")):
            if href.startswith(("http://", "https://", "#")):
                continue
            if not (ROOT / href).exists():
                errors.append(name + " missing " + href)
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
    for (const key of ["do", "where", "see", "check", "help"]) {
      if (!step[key] || (key === "help" && !step.help.length)) throw new Error(step.id + " missing " + key);
    }
  });
}
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
