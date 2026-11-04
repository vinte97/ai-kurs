const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { execFileSync } = require('child_process');
const course = JSON.parse(fs.readFileSync('content/course.json', 'utf8'));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('aikurs-open-day', '4'));
});

test('preparation keeps its stage after sidebar navigation and reload', async ({ page }) => {
  await page.goto('/prepare.html');
  await page.getByRole('button', { name: 'Начать подготовку', exact: true }).click();
  await page.getByRole('button', { name: 'Windows', exact: true }).click();
  await expect(page.locator('#wizard .official a')).toHaveText('Скачать WorkAI');
  await expect(page.locator('#wizard .official a')).toHaveAttribute('href', 'https://workai.su/download');
  await page.getByRole('button', { name: 'Далее', exact: true }).click();
  await page.locator('#site-nav').getByRole('link', { name: 'Подготовка', exact: true }).click();
  await expect(page.locator('#wizard h1')).toContainText('Регистрация');
  await page.reload();
  await expect(page.locator('#wizard h1')).toContainText('Регистрация');
  await page.getByText('Компьютер: Windows', { exact: true }).click();
  await page.getByRole('button', { name: 'Сменить компьютер', exact: true }).click();
  await page.getByRole('button', { name: 'Mac', exact: true }).click();
  await expect(page.locator('#wizard')).toContainText('инструкция для Mac');
});

test('task is complete on one page and next is independent of clipboard', async ({ page }) => {
  await page.goto('/day1.html#task-letter');
  const app = page.locator('#lesson-app');
  await expect(app.locator('.prompt-text')).toHaveText(course.prompts.find(p => p.id === 'd1-letter').promptText);
  await expect(app.getByRole('heading', { name: 'Проверьте результат', exact: true })).toBeVisible();
  await expect(app.getByText('Я скопировал текст вручную')).toHaveCount(0);
  await app.getByRole('button', { name: 'Завершить и продолжить', exact: true }).click();
  await expect(page).toHaveURL(/#task-refine$/);
  await page.reload();
  await expect(app.getByRole('heading', { level: 1 })).toHaveText('Составьте собственный запрос');
  await app.getByRole('button', { name: 'Задание 1: Подготовьте письмо коллегам', exact: true }).click();
  await expect(page).toHaveURL(/#task-letter$/);
  await expect(app.locator('.task-tab[aria-current="step"]')).toContainText('✓');
});

test('copy failure leaves next available and explains manual copy', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } });
    document.execCommand = () => false;
  });
  await page.goto('/day1.html#task-letter');
  const app = page.locator('#lesson-app');
  await app.getByRole('button', { name: 'Скопировать запрос', exact: true }).click();
  await expect(app.getByRole('status')).toContainText('скопируйте вручную');
  await expect(app.getByRole('button', { name: 'Завершить и продолжить', exact: true })).toBeEnabled();
});

test('builder edits and review marks survive reload', async ({ page }) => {
  await page.goto('/day1.html#task-refine');
  const app = page.locator('#lesson-app');
  await app.getByLabel('Какой ответ нужен?', { exact: true }).fill('Три коротких абзаца');
  await app.getByRole('checkbox').first().check();
  await page.reload();
  await expect(app.locator('.prompt-text')).toContainText('Три коротких абзаца');
  await expect(app.getByRole('checkbox').first()).toBeChecked();
});

test('safety quiz requires answers and stores feedback', async ({ page }) => {
  await page.goto('/day1.html#task-safety');
  const app = page.locator('#lesson-app');
  const next = app.getByRole('button', { name: 'Завершить и продолжить', exact: true });
  await expect(next).toBeDisabled();
  const choices = ['Можно использовать', 'Нельзя отправлять', 'Нельзя отправлять', 'Нужно сначала проверить'];
  for (let i = 0; i < choices.length; i++) await app.locator('.quiz-question').nth(i).getByRole('button', { name: choices[i], exact: true }).click();
  await expect(app.locator('.quiz-feedback')).toHaveCount(4);
  await page.reload();
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page).toHaveURL(/#task-facts$/);
});

test('presentation materials are available and contain the agreed scenario', async ({ page, request }) => {
  await page.goto('/day1.html#task-facts');
  await expect(page.locator('#lesson-app a[download]')).toHaveAttribute('href', 'files/den1-zapiski.txt');
  const notes = await request.get('/files/den1-zapiski.txt');
  expect(notes.ok()).toBeTruthy();
  expect(await notes.text()).toContain('Повестку присылают накануне');
  await page.goto('/day1.html#task-document');
  await expect(page.locator('#lesson-app a[download]')).toHaveAttribute('href', 'files/ofis.md');
  expect((await request.get('/files/ofis.md')).ok()).toBeTruthy();
});

test('phone navigation and enlarged text fit the screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/day1.html#task-letter');
  const menu = page.getByRole('button', { name: 'Меню', exact: true });
  await menu.click();
  await page.getByText('Вид и размер текста', { exact: true }).click();
  await page.getByRole('button', { name: 'Очень крупный', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => document.querySelector('#lesson-app').getBoundingClientRect().width <= innerWidth)).toBe(true);
  await expect(page.locator('#lesson-app .task-navigation')).toBeVisible();
});

test('precourse build omits locked prompts and includes fonts', () => {
  const out = '/tmp/aikurs-precourse-pw';
  execFileSync('python3', ['tools/build_site.py', '--phase', 'precourse', '--out', out]);
  const text = fs.readFileSync(out + '/js/course.js', 'utf8');
  expect(text).not.toContain(course.prompts[0].promptText);
  expect(fs.existsSync(out + '/fonts/inter-cyrillic-400-normal.woff2')).toBe(true);
});
