const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { execFileSync } = require('child_process');
const course = JSON.parse(fs.readFileSync('content/course.json', 'utf8'));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('aikurs-open-day', '4'));
});

test('preparation resumes after reload and resets through the sidebar', async ({ page }) => {
  await page.goto('/prepare.html');
  await page.getByRole('button', { name: 'Начать подготовку', exact: true }).click();
  await page.getByRole('button', { name: 'Windows', exact: true }).click();
  await expect(page.locator('#wizard .official a')).toHaveText('Скачать WorkAI');
  await expect(page.locator('#wizard .official a')).toHaveAttribute('href', 'https://workai.su/download');
  await page.getByRole('button', { name: 'Далее', exact: true }).click();
  await page.reload();
  await expect(page.locator('#wizard h1')).toContainText('Регистрация');
  await page.locator('#site-nav').getByRole('link', { name: 'Подготовка', exact: true }).click();
  await expect(page.locator('#prep-intro h1')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('aikurs-progress-v1')).done)).toEqual({});
  await page.getByRole('button', { name: 'Начать подготовку', exact: true }).click();
  await page.getByRole('button', { name: 'Windows', exact: true }).click();
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
  await expect(app.getByRole('heading', { level: 1 })).toHaveText('Практика 1. Новый порядок совещания');
  await app.getByRole('button', { name: 'Задание 2: Пример. Соберём запрос вместе', exact: true }).click();
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

test('independent practice keeps the draft and hides the example until requested', async ({ page }) => {
  await page.goto('/day1.html#task-refine');
  const app = page.locator('#lesson-app');
  await expect(app.locator('.prompt-text')).toBeHidden();
  await app.getByLabel('Ваш запрос по РКФОП', { exact: true }).fill('Мой запрос: три коротких абзаца');
  await app.getByRole('checkbox').first().check();
  await page.reload();
  await expect(app.getByLabel('Ваш запрос по РКФОП', { exact: true })).toHaveValue('Мой запрос: три коротких абзаца');
  await app.getByText('Показать готовый пример запроса', { exact: true }).click();
  await expect(app.locator('.prompt-text')).toBeVisible();
  await expect(app.getByRole('checkbox').first()).toBeChecked();
});

test('safety quiz starts neutral, marks mistakes, and requires all correct answers', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('aikurs-lesson-v1')) localStorage.setItem('aikurs-lesson-v1', JSON.stringify({version: 1, mode: 'steps', days: {'1': {safety: {0: 'allow'}, done: {safety: true}}}}));
  });
  await page.goto('/day1.html#task-safety');
  const app = page.locator('#lesson-app');
  const next = app.getByRole('button', { name: 'Завершить и продолжить', exact: true });
  await expect(next).toBeDisabled();
  await expect(app.locator('.choice-list [aria-pressed="true"]')).toHaveCount(0);
  await app.locator('.quiz-question').first().getByRole('button', { name: 'Передавать нельзя', exact: true }).click();
  await expect(app.locator('.quiz-incorrect')).toHaveText('Передавать нельзя');
  await expect(app.locator('.quiz-feedback')).toContainText('Неверно');
  await expect(next).toBeDisabled();
  const day = course.days[0];
  const choices = day.safetyCases.map(card => day.safetyAnswers[card[1]]);
  for (let i = 0; i < choices.length; i++) await app.locator('.quiz-question').nth(i).getByRole('button', { name: choices[i], exact: true }).click();
  await expect(app.locator('.quiz-feedback')).toHaveCount(6);
  await expect(app.locator('.quiz-correct')).toHaveCount(6);
  await expect(app.locator('.quiz-incorrect')).toHaveCount(0);
  await page.reload();
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page).toHaveURL(/#task-letter$/);
});

test('day 1 handouts are available and old company links lead to the own-file practice', async ({ page, request }) => {
  await page.goto('/day1.html#task-facts');
  await expect(page).toHaveURL(/#task-workday$/);
  await expect(page.locator('#lesson-app')).toContainText('Мой рабочий день.txt');
  for (const key of course.days[0].materials) expect((await request.get('/' + course.materials[key].file)).ok()).toBeTruthy();
  await page.goto('/day1.html#materials');
  await expect(page.locator('#lesson-app')).not.toContainText('СеверПром');
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

 test('preparation actions stay grouped and Python has explicit download instructions', async ({ page }) => {
  await page.goto('/prepare.html#start');
  await page.getByRole('button', { name: 'Начать подготовку', exact: true }).click();
  await page.getByRole('button', { name: 'Windows', exact: true }).click();
  await expect(page.locator('.step-navigation button')).toHaveText(['Назад', 'Далее']);
  await expect(page.locator('.step-assistance .help-action')).toHaveText('Не получается?');
  await page.getByRole('button', { name: 'Далее', exact: true }).click();
  await page.getByRole('button', { name: 'Далее', exact: true }).click();
  await expect(page.locator('.official a')).toHaveText('Скачать Git');
  await page.getByRole('button', { name: 'Далее', exact: true }).click();
  await expect(page.locator('.setup-instructions')).toContainText('Stable Releases');
  await expect(page.locator('.setup-instructions')).toContainText('Windows installer (64-bit)');
  await expect(page.locator('.setup-instructions')).toContainText('Add python.exe to PATH');
  await page.getByRole('button', { name: 'Пропустить этот блок', exact: true }).click();
  await expect(page.locator('.setup-instructions')).toContainText('ИИ-курс');
  await expect(page.locator('.setup-instructions')).toContainText('Open Folder');
});

test('preparation stages open independently and revisiting preserves marks', async ({ page }) => {
  await page.goto('/prepare.html#start');
  await page.getByRole('button', { name: 'Начать подготовку', exact: true }).click();
  await page.getByRole('button', { name: 'Windows', exact: true }).click();
  const stages = page.getByRole('navigation', { name: 'Этапы подготовки', exact: true });
  await expect(stages.getByRole('button')).toHaveCount(6);
  await page.getByRole('button', { name: 'Далее', exact: true }).click();
  await stages.getByRole('button', { name: '3. Git', exact: true }).click();
  await expect(page.locator('#wizard .official a')).toHaveAttribute('href', 'https://git-scm.com/install/windows');
  await stages.getByRole('button', { name: '4. Python', exact: true }).click();
  await expect(page.locator('#wizard article')).toContainText('Stable Releases');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('aikurs-progress-v1')).done['w-workai'])).toBe(true);
});

test('day 2 copies safe company instructions from the open learning folder', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/day2.html#task-d2-company');
  await page.getByRole('button', { name: 'Получить СеверПром', exact: true }).click();
  await expect(page.locator('#lesson-app .copy-status')).toContainText('Запрос скопирован');
  const prompt = await page.evaluate(() => navigator.clipboard.readText());
  expect(prompt).toContain('https://github.com/cursorstudent-course/company.git');
  expect(prompt).toContain('company уже существует');
  expect(prompt).toContain('results рядом');
  expect(prompt).toContain('Git и Python');
});

test('day 2 has staged practices and independent PDF instructions', async ({ page }) => {
  await page.goto('/day2.html#task-d2-meeting');
  await expect(page.locator('#lesson-app .prompt-sheet')).toHaveCount(3);
  await expect(page.locator('#lesson-app')).toContainText('Результат этапа:');
  await page.goto('/day2.html#task-d2-pdf');
  await expect(page.locator('#lesson-app')).toContainText('не используй DOCX как источник');
  await page.goto('/day2.html#task-d2-report');
  await expect(page.locator('#lesson-app')).toContainText('Доклад/index.html');
  await expect(page.locator('#lesson-app')).toContainText('двойным щелчком');
});

test('all presentation topics are available without the deck', async ({ page }) => {
  await page.goto('/day1.html#guide');
  await expect(page.locator('#lesson-app .reference-section')).toHaveCount(course.days[0].sections.length);
  await expect(page.locator('#lesson-app')).toContainText('РКФОП');
  await page.locator('#lesson-app .reference-contents').getByRole('link', { name: 'Практика 4: план с ограничениями и улучшением', exact: true }).click();
  await expect(page).toHaveURL(/#learn-trip$/);
  await page.reload();
  await expect(page.locator('#lesson-app #learn-trip')).toContainText('80 000');
});
