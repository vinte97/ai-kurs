(function () {
  var app = document.getElementById("lesson-app");
  if (!app || !window.COURSE) return;
  document.documentElement.classList.add("js");

  var KEY = "aikurs-lesson-v1";
  var dayNumber = Number(app.getAttribute("data-day"));
  var day = null;
  window.COURSE.days.forEach(function (item) {
    if (item.number === dayNumber) day = item;
  });
  if (!day) return;

  var state = load();
  var bucket = dayState();
  var lastFocus = "";
  var pendingFocus = "";

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(KEY) || "{}");
      if (!saved || saved.version !== 1) return { version: 1, mode: "steps", days: {} };
      saved.days = saved.days || {};
      saved.mode = saved.mode === "all" ? "all" : "steps";
      return saved;
    } catch (e2) {
      return { version: 1, mode: "steps", days: {} };
    }
  }

  function dayState() {
    var current = state.days[String(day.number)];
    if (!current) {
      current = { at: "", step: 0, done: {}, marks: {}, safety: {}, fields: {}, summary: {}, downloaded: {}, copied: {}, finished: false };
      state.days[String(day.number)] = current;
    }
    current.done = current.done || {};
    current.marks = current.marks || {};
    current.safety = current.safety || {};
    if (day.number === 1 && current.safetyVersion !== 2) {
      current.safety = {};
      current.safetyVersion = 2;
      delete current.done.safety;
      markTask("safety", false);
    }
    current.fields = current.fields || {};
    current.summary = current.summary || {};
    current.downloaded = current.downloaded || {};
    current.copied = current.copied || {};
    current.helpOpen = false;
    current.confirm = false;
    return current;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function button(className, text, action) {
    var node = el("button", className, text);
    node.type = "button";
    node.addEventListener("click", action);
    return node;
  }

  function exercise(id) {
    return window.COURSE.exercises[id] || null;
  }

  function promptOf(id) {
    var item = exercise(id);
    if (!item) return null;
    var found = null;
    window.COURSE.prompts.forEach(function (prompt) {
      if (prompt.id === item.promptId) found = prompt;
    });
    return found;
  }

  function exerciseByPrompt(promptId) {
    var found = "";
    day.exerciseIds.forEach(function (id) {
      var item = exercise(id);
      if (item && item.promptId === promptId) found = id;
    });
    return found;
  }

  function plainTitle(title) {
    return String(title || "").replace(/^Задание\s+\d+\.\s*/, "");
  }

  function osName() {
    try {
      var saved = JSON.parse(localStorage.getItem("aikurs-progress-v1") || "{}");
      if (saved.os === "mac" || saved.os === "windows") return saved.os;
    } catch (e) {}
    return "";
  }

  function writeText(text, ok, fail) {
    function fallback() {
      var area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      var copied = false;
      try { copied = document.execCommand("copy"); } catch (e) { copied = false; }
      area.remove();
      if (copied) ok();
      else fail();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback);
    else fallback();
  }

  function markTask(id, done) {
    var key = "aikurs-tasks-v1";
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch (e) { saved = {}; }
    saved[id] = done !== false;
    try { localStorage.setItem(key, JSON.stringify(saved)); } catch (e2) {}
  }

  var BUILDERS = {
    refine: [
      ["role", "Кем должен быть ИИ?", "Помощник руководителя"],
      ["context", "Что произошло?", "Вместо свободного обсуждения сначала отчёт по поручениям, затем не больше трёх вопросов"],
      ["format", "Какой ответ нужен?", "Короткое деловое письмо"],
      ["limits", "Что нельзя делать?", "Не придумывать время, место и фамилии"],
      ["check", "Как проверить ответ?", "Описан новый порядок, есть просьба подтвердить понимание, новых правил нет"]
    ],
    helper: [
      ["role", "Как назвать роль?", "Помощник к совещанию"],
      ["prepares", "Что он готовит?", "Короткую сводку к совещанию по файлам, которые дал человек"],
      ["sees", "Какие файлы можно видеть?", "Только файлы, которые человек приложил к запросу"],
      ["refuses", "Чего он не делает?", "Не подписывает письма, не отправляет платёж, не принимает кадровое решение"]
    ]
  };

  var SAFETY = [
    ["Дата общего совещания.", "allow", "Обычно дату общего совещания можно использовать в учебной задаче, если она не раскрывает конфиденциальную информацию."],
    ["Паспортные данные сотрудника. Пример вымышленный: 1234 567890.", "deny", "Не отправляйте такие данные в учебные запросы. Используйте вымышленные данные или согласованный безопасный пример."],
    ["Телефон коллеги, который он просил не пересылать.", "deny", "Чужой телефон, который просили не пересылать, в запрос класть нельзя."],
    ["Сумма договора с поставщиком.", "ask", "Это зависит от разрешений и правил организации. Сначала уточните, можно ли использовать эту сумму в учебной задаче."]
  ];

  var ANSWER = { allow: "Можно использовать", ask: "Нужно сначала проверить", deny: "Нельзя отправлять" };

  var SUMMARY = {
    1: [
      "Я умею открыть WorkAI.",
      "Я умею скопировать и отправить запрос.",
      "Я понимаю основные части РКФОП.",
      "Я знаю, какие данные нельзя передавать без разрешения.",
      "Я умею приложить учебный документ.",
      "Я умею проверить ответ по источнику.",
      "Я могу назвать подтверждённые и неподтверждённые факты в учебной задаче."
    ],
    2: [
      "Я скачал учебный файл и нашёл его.",
      "В ответе есть 42, 31, 6 и 5.",
      "42 не названы полученными деньгами.",
      "Я назвал вопрос, которого файл не закрывает."
    ],
    3: [
      "Я не вставлял адрес и ключ в запрос.",
      "Я отличаю ответ лаборатории от ошибки.",
      "Список писем не превратился в отправку.",
      "Отказ я записал и не пытался обойти."
    ],
    4: [
      "Название роли написано мной.",
      "Платёж и кадровое решение остаются человеку.",
      "Проверочный запрос не закончился отправкой платежа."
    ]
  };

  function fieldValues(id) {
    var saved = bucket.fields[id] || {};
    var values = {};
    (BUILDERS[id] || []).forEach(function (row) {
      values[row[0]] = Object.prototype.hasOwnProperty.call(saved, row[0]) ? saved[row[0]] : row[2];
    });
    return values;
  }

  function assembled(id) {
    var values = fieldValues(id);
    if (id === "refine") {
      return "Роль: ты — " + values.role + ".\nКонтекст: " + values.context + ".\nФормат: " + values.format + ".\nОграничения: " + values.limits + ".\nПроверка: " + values.check + ".";
    }
    if (id === "helper") {
      return "По приложенной карточке собери правило помощника.\nРоль: " + values.role + ".\nЧто готовит: " + values.prepares + ".\nКакие файлы может видеть: " + values.sees + ".\nЧего не делает: " + values.refuses + ".\nПодпись, платёж и кадровое решение оставь человеку.\nПрограмму для этого писать не нужно.";
    }
    if (id === "lab-read") {
      var mail = (bucket.fields["lab-read"] || {}).name || "";
      return "Прочитай одно письмо учебной лаборатории.\nИспользуй инструмент mail_read.\nПисьмо: " + mail.trim() + ".\nНе пиши ответ отправителю и не отправляй ничего.";
    }
    if (id === "lab-note") {
      var note = (bucket.fields["lab-note"] || {}).name || "";
      return "Найди учебную заметку.\nИспользуй инструмент notes_get.\nНазвание: " + note.trim() + ".\nЕсли служба отказала, приведи текст отказа и не повторяй запрос.";
    }
    var prompt = promptOf(id);
    return prompt ? prompt.promptText : "";
  }

  function material(id) {
    var prompt = promptOf(id);
    if (!prompt || !prompt.requiredMaterials.length) return null;
    return window.COURSE.materials[prompt.requiredMaterials[0]] || null;
  }

  function setHash(hash) {
    var next = hash || (location.pathname + location.search);
    var now = location.pathname + location.search + location.hash;
    if (now === next || location.hash === hash) return;
    history.replaceState(null, "", next);
  }

  function applyEntry(initial) {
    var hash = location.hash;
    var sections = ["#overview", "#theory", "#materials", "#prompts", "#extra", "#tasks"];
    if (hash.indexOf("#task-") === 0) {
      var id = decodeURIComponent(hash.slice(6));
      if (!exercise(id) || day.exerciseIds.indexOf(id) < 0) {
        bucket.place = "home";
        return;
      }
      if (bucket.at !== id) bucket.step = 0;
      bucket.at = id;
      if (initial || state.mode !== "all") {
        state.mode = "steps";
        bucket.place = "step";
      }
      return;
    }
    if (hash.indexOf("#prompt-") === 0) {
      var found = exerciseByPrompt(decodeURIComponent(hash.slice(8)));
      if (!found) {
        bucket.place = "home";
        return;
      }
      bucket.at = found;
      bucket.step = 0;
      if (initial || state.mode !== "all") {
        state.mode = "steps";
        bucket.place = "step";
      }
      return;
    }
    if (hash === "#check") {
      if (initial || state.mode !== "all") {
        state.mode = "steps";
        bucket.place = "summary";
      }
      return;
    }
    if (hash === "#overview" || hash === "#tasks") { bucket.place = "home"; state.mode = "steps"; }
    else if (sections.indexOf(hash) >= 0) state.mode = "all";
    else if (initial) bucket.place = bucket.place || "home";
  }

  function openExercise(id, step) {
    bucket.helpOpen = false;
    bucket.at = id;
    bucket.step = step || 0;
    bucket.place = "step";
    bucket.confirm = false;
    state.mode = "steps";
    save();
    setHash("#task-" + id);
    render();
  }

  function openHome() {
    bucket.place = "home";
    state.mode = "steps";
    save();
    setHash("");
    render();
  }

  function openSummary() {
    bucket.place = "summary";
    state.mode = "steps";
    save();
    setHash("#check");
    render();
  }

  function resumeAt() {
    if (bucket.at && !bucket.done[bucket.at]) return day.exerciseIds.indexOf(bucket.at);
    for (var i = 0; i < day.exerciseIds.length; i += 1) {
      if (!bucket.done[day.exerciseIds[i]]) return i;
    }
    return -1;
  }

  function promptSheet(text, title, purpose, expected) {
    var sheet = el("div", "prompt-sheet");
    sheet.appendChild(el("h3", "", title || "Запрос"));
    if (purpose) sheet.appendChild(el("p", "", purpose));
    var pre = el("pre", "prompt-text");
    pre.textContent = text;
    sheet.appendChild(pre);
    if (expected) sheet.appendChild(el("p", "prompt-expect", "Ожидаемый результат. " + expected));
    return sheet;
  }

  function checklist(items, prefix, manual) {
    var box = el("div", "check-box");
    box.appendChild(el("p", "manual", manual || "Отметьте сами. Это не автоматическая проверка."));
    items.forEach(function (item, index) {
      var key = prefix + ":" + index;
      var label = el("label", "check-row");
      var input = document.createElement("input");
      input.type = "checkbox";
      input.checked = Boolean(bucket.marks[key]);
      input.addEventListener("change", function () {
        bucket.marks[key] = input.checked;
        save();
      });
      label.appendChild(input);
      label.appendChild(document.createTextNode(item));
      box.appendChild(label);
    });
    return box;
  }

  function fileBlock(file) {
    var box = el("div", "file-card");
    box.appendChild(el("h3", "", file.title));
    box.appendChild(el("p", "", file.why));
    var actions = el("div", "file-actions");
    var download = el("a", "btn", "Скачать файл");
    download.href = file.file;
    download.setAttribute("download", "");
    download.addEventListener("click", function () {
      bucket.downloaded[file.file] = true;
      save();
      var note = box.querySelector(".file-note");
      if (note) note.hidden = false;
    });
    actions.appendChild(download);
    var view = button("btn secondary", "Посмотреть содержимое", function () {
      var pre = box.querySelector(".file-preview");
      if (pre && !pre.hidden && pre.textContent) {
        pre.hidden = true;
        return;
      }
      fetch(file.file).then(function (response) { if (!response.ok) throw new Error("File unavailable"); return response.text(); }).then(function (text) {
        if (!pre) return;
        pre.textContent = text;
        pre.hidden = false;
      }).catch(function () {
        window.open(file.file, "_blank", "noopener");
      });
    });
    actions.appendChild(view);
    box.appendChild(actions);
    var preview = el("pre", "file-preview prompt-text");
    preview.hidden = true;
    box.appendChild(preview);
    var note = el("p", "file-note", "Файл обычно находится в папке «Загрузки». На Mac эта папка может называться Downloads.");
    note.hidden = !bucket.downloaded[file.file];
    box.appendChild(note);
    var find = el("details", "find-note");
    find.appendChild(el("summary", "", "Где найти скачанный файл"));
    var os = osName();
    find.appendChild(el("p", "", os === "mac"
      ? "Откройте Finder и папку Downloads. Имя файла указано выше."
      : "Откройте проводник и папку «Загрузки». Имя файла указано выше."));
    find.appendChild(el("p", "", "Два быстрых нажатия по файлу открывают его. В WorkAI этот файл ещё нужно добавить отдельно."));
    box.appendChild(find);
    return box;
  }

  function fieldsBlock(id) {
    var box = el("div", "builder");
    (BUILDERS[id] || []).forEach(function (row) {
      var label = el("label", "field");
      label.appendChild(el("span", "", row[1]));
      var input = document.createElement("input");
      input.type = "text";
      input.value = fieldValues(id)[row[0]];
      input.addEventListener("input", function () {
        bucket.fields[id] = fieldValues(id);
        bucket.fields[id][row[0]] = input.value;
        var pre = app.querySelector(".prompt-sheet pre");
        if (pre) pre.textContent = assembled(id);
        save();
      });
      label.appendChild(input);
      box.appendChild(label);
    });
    if (id === "lab-read" || id === "lab-note") {
      var label = el("label", "field");
      label.appendChild(el("span", "", id === "lab-read" ? "Номер или название письма" : "Название заметки"));
      var input = document.createElement("input");
      input.type = "text";
      input.value = (bucket.fields[id] || {}).name || "";
      input.placeholder = "Как сказал преподаватель";
      input.addEventListener("input", function () {
        bucket.fields[id] = { name: input.value };
        var pre = app.querySelector(".prompt-sheet pre");
        if (pre) pre.textContent = assembled(id);
        save();
      });
      label.appendChild(input);
      box.appendChild(label);
    }
    var restore = button("btn secondary", "Восстановить исходный пример", function () {
      bucket.fields[id] = {};
      save();
      render();
    });
    box.appendChild(restore);
    return box;
  }

  function primary(text, action, disabled) {
    var node = button("btn", text, action);
    if (disabled) node.disabled = true;
    return node;
  }

  function renderHome() {
    var screen = el("div", "lesson-screen");
    var heading = el("h1", "", "День " + day.number + ". " + day.title);
    screen.appendChild(heading);
    screen.appendChild(el("p", "lead", day.lead));
    var doneCount = day.exerciseIds.filter(function (id) { return bucket.done[id]; }).length;
    var grid = el("div", "home-grid");
    var needCol = el("section");
    needCol.appendChild(el("h2", "", "Что понадобится"));
    var needs = [];
    var seenWork = false;
    day.exerciseIds.forEach(function (id) {
      (exercise(id).needs || []).forEach(function (line) {
        if (line.indexOf("WorkAI") >= 0) {
          if (seenWork) return;
          seenWork = true;
          needs.push("Программа WorkAI.");
          return;
        }
        if (needs.indexOf(line) < 0) needs.push(line);
      });
    });
    var list = el("ul");
    needs.forEach(function (line) { list.appendChild(el("li", "", line)); });
    needCol.appendChild(list);
    var outCol = el("section");
    outCol.appendChild(el("h2", "", "Что получится"));
    var outcomes = el("ul");
    (day.outcomes || []).forEach(function (line) { outcomes.appendChild(el("li", "", line)); });
    outCol.appendChild(outcomes);
    grid.appendChild(needCol);
    grid.appendChild(outCol);
    screen.appendChild(grid);
    var index = resumeAt();
    var row = el("div", "player-bar");
    if (index >= 0 && (doneCount > 0 || bucket.at)) {
      row.appendChild(button("btn", "Продолжить с задания " + (index + 1), function () {
        var id = day.exerciseIds[index];
        openExercise(id, bucket.at === id ? bucket.step : 0);
      }));
      row.appendChild(button("btn secondary", "Посмотреть задания с начала", function () { openExercise(day.exerciseIds[0], 0); }));
    } else if (index >= 0) {
      row.appendChild(button("btn", "Начать первое задание", function () { openExercise(day.exerciseIds[0], 0); }));
    } else {
      row.appendChild(button("btn", "Проверим, что получилось", openSummary));
      row.appendChild(button("btn secondary", "Посмотреть задания с начала", function () { openExercise(day.exerciseIds[0], 0); }));
    }
    var tasks = el("ol", "task-index");
    day.exerciseIds.forEach(function (id) {
      var item = el("li");
      var link = el("a");
      link.href = "#task-" + id;
      link.appendChild(el("span", "task-name", plainTitle(exercise(id).title)));
      link.appendChild(el("span", "task-time", bucket.done[id] ? "Выполнено" : "Открыть"));
      item.appendChild(link);
      tasks.appendChild(item);
    });
    screen.appendChild(tasks);
    app.appendChild(screen);
    app.appendChild(row);
  }

  function renderSummary() {
    var screen = el("div", "lesson-screen");
    var heading = el("h1", "", "Проверим, что получилось");
    heading.id = "step-heading";
    heading.tabIndex = -1;
    screen.appendChild(heading);
    screen.appendChild(el("p", "manual", "Пункты ниже отмечаете вы. Это не автоматическая проверка и не открывает следующий день."));
    (SUMMARY[day.number] || day.checks || []).forEach(function (line, index) {
      var label = el("label", "check-row");
      var input = document.createElement("input");
      input.type = "checkbox";
      input.checked = Boolean(bucket.summary[index]);
      input.addEventListener("change", function () {
        bucket.summary[index] = input.checked;
        save();
      });
      label.appendChild(input);
      label.appendChild(document.createTextNode(line));
      screen.appendChild(label);
    });
    var pending = day.exerciseIds.filter(function (id) { return !bucket.done[id]; });
    if (pending.length) {
      screen.appendChild(el("h2", "", "Ещё не отмечены"));
      pending.forEach(function (id) {
        screen.appendChild(button("btn secondary", plainTitle(exercise(id).title), function () { openExercise(id, 0); }));
      });
    }
    if (day.number === 1 && Object.keys(bucket.safety).length) {
      var hit = 0;
      SAFETY.forEach(function (card, index) { if (bucket.safety[index] === card[1]) hit += 1; });
      screen.appendChild(el("p", "", "Карточки безопасности: совпало " + hit + " из " + SAFETY.length + " с утверждённым ответом."));
    }
    var row = el("div", "player-bar");
    if (!bucket.finished) {
      row.appendChild(button("btn", day.number === 1 ? "Завершить первый день" : "Завершить этот день", function () {
        bucket.finished = true;
        save();
        render();
      }));
    }
    row.appendChild(button("btn secondary", "К обзору дня", openHome));
    row.appendChild(button("btn secondary", "Повторить с первого задания", function () { openExercise(day.exerciseIds[0], 0); }));
    if (bucket.finished) {
      var result = el("div", "resume");
      result.appendChild(el("h2", "", "День отмечен вами"));
      result.appendChild(el("p", "", "Отмечено заданий: " + day.exerciseIds.filter(function (id) { return bucket.done[id]; }).length + " из " + day.exerciseIds.length + "."));
      if (day.next) result.appendChild(el("p", "", day.next));
      result.appendChild(el("p", "manual", "Следующий день эта отметка не открывает. Его открывает преподаватель."));
      screen.appendChild(result);
    }
    var share = el("details");
    share.appendChild(el("summary", "", "Ссылка и QR для преподавателя"));
    day.exerciseIds.forEach(function (id) {
      var href = "day" + day.number + ".html#task-" + id;
      var line = el("p");
      var link = el("a", "", plainTitle(exercise(id).title));
      link.href = href;
      line.appendChild(link);
      share.appendChild(line);
      var image = document.createElement("img");
      image.src = "qr/task-" + id + ".svg";
      image.alt = "QR-код задания «" + plainTitle(exercise(id).title) + "»";
      image.width = 120;
      image.height = 120;
      share.appendChild(image);
    });
    screen.appendChild(share);
    app.appendChild(screen);
    app.appendChild(row);
  }

  function renderStep() {
    var screen = el("article", "lesson-screen");
    var heading = el("h1", "", "Какие сведения можно передавать ИИ");
    heading.id = "step-heading";
    heading.tabIndex = -1;
    screen.appendChild(heading);
    screen.appendChild(el("p", "lead", "Выберите решение для каждой ситуации. Красный ответ нужно исправить, зелёный — верный. Все примеры вымышленные."));
    SAFETY.forEach(function (card, index) {
      var group = el("section", "quiz-question");
      var title = el("h2", "", (index + 1) + ". " + card[0]);
      title.id = "question-" + index;
      title.tabIndex = -1;
      group.appendChild(title);
      var choices = el("div", "choice-list");
      choices.setAttribute("role", "group");
      choices.setAttribute("aria-labelledby", title.id);
      Object.keys(ANSWER).forEach(function (value) {
        var selected = bucket.safety[index] === value;
        var color = selected ? (value === card[1] ? " quiz-correct" : " quiz-incorrect") : "";
        var choice = button("btn secondary" + color, ANSWER[value], function () {
          bucket.safety[index] = value;
          if (value !== card[1]) {
            delete bucket.done.safety;
            markTask("safety", false);
          }
          pendingFocus = "#question-" + index;
          save();
          render();
        });
        choice.setAttribute("aria-pressed", bucket.safety[index] === value ? "true" : "false");
        choices.appendChild(choice);
      });
      group.appendChild(choices);
      if (bucket.safety[index]) {
        var feedback = el("p", "quiz-feedback", (bucket.safety[index] === card[1] ? "Верно. " : "Неверно — попробуйте другой ответ. ") + card[2]);
        feedback.setAttribute("role", "status");
        group.appendChild(feedback);
      }
      screen.appendChild(group);
    });
    app.appendChild(screen);
    var row = el("div", "player-bar");
    row.appendChild(button("btn secondary", "Предыдущее задание", function () { openExercise("refine", 0); }));
    var answered = SAFETY.every(function (card, index) { return bucket.safety[index] === card[1]; });
    row.appendChild(primary("Завершить и продолжить", function () {
      bucket.done.safety = true;
      markTask("safety");
      save();
      openExercise("facts", 0);
    }, !answered));
    app.appendChild(row);
  }

  function taskNavigation() {
    var bar = el("nav", "task-navigation");
    bar.setAttribute("aria-label", "Навигация по заданиям");
    var home = button("task-tab", "Обзор дня", openHome);
    if (bucket.place === "home") home.setAttribute("aria-current", "page");
    bar.appendChild(home);
    day.exerciseIds.forEach(function (id, index) {
      var tab = button("task-tab", String(index + 1) + (bucket.done[id] ? " ✓" : ""), function () { openExercise(id, 0); });
      tab.setAttribute("aria-label", "Задание " + (index + 1) + ": " + plainTitle(exercise(id).title));
      tab.title = plainTitle(exercise(id).title);
      if (bucket.place === "step" && bucket.at === id) tab.setAttribute("aria-current", "step");
      bar.appendChild(tab);
    });
    bar.appendChild(button("task-tab", "Итоги", openSummary));
    return bar;
  }

  function renderExercise() {
    var id = bucket.at;
    var item = exercise(id);
    var prompt = promptOf(id);
    var index = day.exerciseIds.indexOf(id);
    var screen = el("article", "lesson-screen exercise-page");
    screen.appendChild(el("p", "kicker", "День " + day.number + " / Практика " + (index + 1)));
    var heading = el("h1", "", plainTitle(item.title));
    heading.id = "step-heading";
    heading.tabIndex = -1;
    screen.appendChild(heading);
    screen.appendChild(el("p", "lead", item.goal));
    var file = material(id);
    if (file) screen.appendChild(fileBlock(file));
    screen.appendChild(el("h2", "", "Задание"));
    var instructions = el("ol", "exercise-instructions");
    (item.steps || []).forEach(function (text) { instructions.appendChild(el("li", "", text)); });
    screen.appendChild(instructions);
    if (BUILDERS[id] || id === "lab-read" || id === "lab-note") screen.appendChild(fieldsBlock(id));
    var text = function () { return BUILDERS[id] || id === "lab-read" || id === "lab-note" ? assembled(id) : prompt.promptText; };
    screen.appendChild(promptSheet(text(), "Запрос для WorkAI", prompt.description, ""));
    var status = el("p", "copy-status");
    status.setAttribute("role", "status");
    screen.appendChild(button("btn secondary", "Скопировать запрос", function () {
      if ((id === "lab-read" || id === "lab-note") && !((bucket.fields[id] || {}).name || "").trim()) {
        status.textContent = "Укажите номер или название, которое дал преподаватель.";
        return;
      }
      writeText(text(), function () { status.textContent = "Запрос скопирован."; }, function () { status.textContent = "Выделите запрос и скопируйте вручную: Ctrl+C или ⌘C."; });
    }));
    screen.appendChild(status);
    screen.appendChild(el("h2", "", "Проверьте результат"));
    screen.appendChild(el("p", "", prompt.expectedResult));
    screen.appendChild(checklist(prompt.acceptanceCriteria, id + ":result", "Сверьте ответ с критериями. Отметки сохраняются на этом устройстве."));
    var help = el("details", "exercise-help");
    help.appendChild(el("summary", "", "Подсказка"));
    (prompt.hints || []).forEach(function (hint) { help.appendChild(el("p", "", hint)); });
    screen.appendChild(help);
    app.appendChild(screen);
    var row = el("div", "player-bar");
    row.appendChild(button("btn secondary", index ? "Предыдущее задание" : "К обзору дня", function () { if (index) openExercise(day.exerciseIds[index - 1], 0); else openHome(); }));
    row.appendChild(button("btn", index + 1 < day.exerciseIds.length ? "Завершить и продолжить" : "Завершить и перейти к итогам", function () {
      bucket.done[id] = true;
      markTask(id);
      save();
      if (index + 1 < day.exerciseIds.length) openExercise(day.exerciseIds[index + 1], 0);
      else openSummary();
    }));
    app.appendChild(row);
  }

  function render() {
    document.documentElement.classList.toggle("lesson-all", state.mode === "all");
    app.innerHTML = "";
    app.appendChild(taskNavigation());
    if (state.mode === "all") {
      window.requestAnimationFrame(function () {
        var node = location.hash ? document.getElementById(location.hash.slice(1)) : null;
        if (node) node.scrollIntoView();
      });
      return;
    }
    if (bucket.place === "summary" || location.hash === "#check") renderSummary();
    else if (bucket.place === "step" && bucket.at) {
      if (bucket.at === "safety") renderStep();
      else renderExercise();
    }
    else renderHome();
    var focusKey = state.mode + ":" + bucket.place + ":" + bucket.at + ":" + bucket.step;
    if (pendingFocus) {
      var target = app.querySelector(pendingFocus);
      pendingFocus = "";
      if (target) target.focus();
    } else if (focusKey !== lastFocus) {
      lastFocus = focusKey;
      var heading = app.querySelector("h1");
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
      app.scrollIntoView({ block: "start" });
    }
  }

  applyEntry(true);
  save();
  render();
  window.addEventListener("hashchange", function () {
    bucket.helpOpen = false;
    applyEntry(false);
    save();
    render();
  });
})();
