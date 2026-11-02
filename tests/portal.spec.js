const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const course = JSON.parse(fs.readFileSync("content/course.json", "utf8"));
const letter = course.prompts.find((item) => item.id === "d1-letter").promptText;

test("home opens with the course welcome", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Добро пожаловать");
  await expect(page.getByRole("link", { name: "Продолжить обучение" })).toBeVisible();
});

test("seven navigation items open", async ({ page }) => {
  await page.goto("/");
  const names = ["Главная", "Подготовка", "День 1", "День 2", "День 3", "День 4", "Дополнительно"];
  for (const name of names) {
    await page.goto("/");
    await page.getByRole("navigation").getByRole("link", { name, exact: true }).click();
    await expect(page.getByRole("navigation").getByRole("link", { name, exact: true })).toHaveAttribute("aria-current", "page");
  }
});

test("day 1 shows the letter exercise", async ({ page }) => {
  await page.goto("/day1.html");
  await expect(page.locator("#task-letter")).toContainText("Напишем письмо");
  await expect(page.locator("#text-d1-letter")).toHaveText(letter);
});

test("copy puts the full prompt on the clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/day1.html#task-letter");
  await page.locator("#prompt-d1-letter").getByRole("button", { name: "Скопировать запрос" }).click();
  await expect(page.locator("#prompt-d1-letter").getByRole("button", { name: "Скопировано!" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(letter);
});

test("copy failure explains how to copy by hand", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("denied")) }
    });
    document.execCommand = () => false;
  });
  await page.goto("/day1.html");
  await page.locator("#prompt-d1-letter").getByRole("button", { name: "Скопировать запрос" }).click();
  await expect(page.locator("#text-d1-letter-status")).toContainText("Автокопирование не сработало");
  await expect(page.locator("#prompt-d1-letter").getByRole("button", { name: "Скопировано!" })).toHaveCount(0);
});

test("material links point at real files", async ({ page, request }) => {
  await page.goto("/day1.html");
  const hrefs = await page.locator("#materials a").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    const response = await request.get(href);
    expect(response.status(), href).toBe(200);
  }
});

test("phone menu opens and closes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Меню" });
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
});

test("precourse build leaves closed prompts out", () => {
  const out = path.join("/tmp", "aikurs-precourse-pw");
  execFileSync("python3", ["tools/build_site.py", "--phase", "precourse", "--out", out]);
  const text = fs.readFileSync(path.join(out, "day1.html"), "utf8") + fs.readFileSync(path.join(out, "extra.html"), "utf8");
  expect(text).not.toContain("еженедельное совещание");
  expect(text).toContain("ещё не открыты");
});

test("exercise link survives reload", async ({ page }) => {
  await page.goto("/day1.html#task-letter");
  await page.reload();
  await expect(page.locator("#task-letter")).toBeVisible();
  expect(page.url()).toContain("#task-letter");
});

test("page does not grow a horizontal scrollbar when enlarged", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/day1.html");
  const overflow = await page.evaluate(() => {
    document.body.style.zoom = "1.5";
    return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
  });
  expect(overflow).toBe(true);
});

test("old section addresses still exist", async ({ request }) => {
  for (const href of ["/", "/prepare.html", "/day1.html", "/day2.html", "/day3.html", "/day4.html", "/extra.html"]) {
    const response = await request.get(href);
    expect(response.status(), href).toBe(200);
  }
});
