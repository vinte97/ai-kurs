(function () {
  var app = document.getElementById("lesson-app");
  if (!app || !window.COURSE) return;
  document.documentElement.classList.add("js");

  var KEY = "aikurs-lesson-v1";
  var readKey = "aikurs-reading-v1";
  var dayNumber = Number(app.getAttribute("data-day"));
  var day = null;
  window.COURSE.days.forEach(function (item) {
    if (item.number === dayNumber) day = item;
  });
  if (!day) return;

  var reading = { size: "normal", contrast: "normal" };
  try {
    var storedRead = JSON.parse(localStorage.getItem(readKey) || "{}");
    if (storedRead.size === "large" || storedRead.size === "xlarge") reading.size = storedRead.size;
    if (storedRead.contrast === "high") reading.contrast = "high";
  } catch (e) {}

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

  function applyReading() {
    document.documentElement.setAttribute("data-text", reading.size);
    document.documentElement.setAttribute("data-contrast", reading.contrast);
    try { localStorage.setItem(readKey, JSON.stringify(reading)); } catch (e) {}
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

  function markTask(id) {
    var key = "aikurs-tasks-v1";
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch (e) { saved = {}; }
    saved[id] = true;
    try { localStorage.setItem(key, JSON.stringify(saved)); } catch (e2) {}
  }

  var BUILDERS = {
    refine: [
      ["role", "Кем должен быть ИИ?", "Помощник руководителя"],
      ["context", "Что произошло?", "Совещание перенесли со среды на четверг"],
      ["format", "Какой ответ нужен?", "Короткое деловое письмо"],
      ["limits", "Что нельзя делать?", "Не придумывать время, место и фамилии"],
      ["check", "Как проверить ответ?", "В письме указаны изменения и нет выдуманных сведений"]
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

  function helpPack(kind) {
    var os = osName();
    var paste = os === "mac"
      ? "На Mac нажмите Command и V. Либо два пальца на трекпаде и пункт «Вставить»."
      : os === "windows"
        ? "На Windows нажмите Ctrl и V. Либо правую кнопку мыши и пункт «Вставить»."
        : "На Windows: Ctrl и V. На Mac: Command и V. Можно и через пункт «Вставить» в меню правой кнопки.";
    var packs = {
      open: ["Не открывается WorkAI?", ["Сайт не запускает программу: её открывают на компьютере.", "Если программа ещё не установлена, откройте раздел «Подготовка» и вернитесь сюда. Этот шаг сохранится.", "Если компьютер организации запрещает установку, не отключайте защиту. Покажите экран преподавателю."], ["Не могу открыть WorkAI"]],
      copy: ["Не получается скопировать запрос?", ["Нажмите «Скопировать запрос» один раз.", "Если появилось сообщение об ошибке, выделите текст запроса мышью и скопируйте его сами.", "После этого вернитесь в WorkAI."], ["Не копируется запрос"]],
      paste: ["Не получается вставить запрос?", ["Сначала нажмите на поле сообщения в WorkAI.", paste, "Если кнопка копирования не сработала, скопируйте выделенный текст вручную."], ["Не вставляется текст"]],
      send: ["Не получается отправить?", ["Кнопка отправки стоит рядом с полем сообщения.", "Нажмите её один раз и подождите, пока ответ допишется до конца.", "Если ответа нет, проверьте, что сообщение не осталось только в поле."], ["Не уходит запрос"]],
      file: ["Не получается найти файл?", ["Браузер обычно кладёт файл в папку «Загрузки». На Mac она может называться Downloads.", "Откройте эту папку и найдите имя файла с этой страницы.", "Если файла нет, нажмите «Скачать файл» ещё раз."], ["Не нахожу файл"]],
      attach: ["Не получается добавить файл?", ["В WorkAI файл добавляют к сообщению отдельно: обычный текст вложения не видит.", "Выберите файл из папки «Загрузки».", "Дальше можно идти только когда вы сами видите, что файл прикреплён. Сайт этого не проверяет."], ["Не добавляется файл"]],
      lab: ["Лаборатория не отвечает?", ["Адрес и ключ на этой странице не написаны. В запрос их не вставляют.", "Подключение делает преподаватель в программе.", "Если служба отказала, запишите текст отказа. Это не успешное выполнение и обходить отказ не нужно."], ["Лаборатория отказала"]],
      check: ["Непонятно, что проверять?", ["Сверьте ответ по пунктам на экране.", "Отметьте только то, что видите сами.", "Отметка здесь — ваша, сайт ответ ИИ не читает."], ["Не понимаю ответ"]]
    };
    return packs[kind] || packs.check;
  }

  function step(kind, title, text, primary) {
    return { kind: kind, title: title, text: text, primary: primary || "Дальше" };
  }

  function flow(id) {
    var item = exercise(id);
    var prompt = promptOf(id);
    var file = material(id);
    var open = step("open", "Откройте WorkAI", "Откройте программу WorkAI на компьютере.", "Получилось, дальше");
    var copy = step("copy", "Скопируйте запрос", "Нажмите синюю кнопку. В запрос попадёт только текст ниже, без заголовка.", "Скопировать запрос");
    var paste = step("paste", "Вставьте запрос", "Вернитесь в WorkAI и вставьте скопированный текст в поле сообщения.", "Я вставил запрос");
    var send = step("send", "Отправьте запрос", "Нажмите кнопку отправки рядом с полем сообщения. Подождите, пока ИИ допишет ответ.", "Я отправил запрос");
    var check = step("check", "Проверьте ответ", "Отметьте пункты, которые видите в ответе. Сайт ответ не читает: это ваша отметка.", "Я проверил результат");
    var doneText = {
      letter: "Вы составили первый запрос и проверили ответ ИИ.",
      refine: "Вы собрали запрос из частей и можете сравнить его с первым письмом.",
      safety: "Вы разобрали учебные примеры. Ответ ИИ эту проверку не заменяет.",
      facts: "Вы попросили ИИ опереться на файл и сверили факты.",
      document: "Вы сверили чужой ответ с записями в файле.",
      deals: "Вы разделили закрытые сделки и подтверждённые оплаты.",
      "lab-ping": "Вы отправили проверку связи. Ошибка, если она была, не считается успехом.",
      "lab-mail": "Вы запросили список писем и ничего не отправляли.",
      "lab-read": "Вы запросили одно письмо. Если пришёл отказ, это и есть результат.",
      "lab-note": "Вы запросили заметку. Если служба отказала, текст отказа нужно сохранить.",
      helper: "Вы описали роль и границы помощника.",
      "helper-test": "Отказ выполнить платёж — правильный результат этого задания."
    };
    var done = step("done", "Задание выполнено", doneText[id] || "Это задание отмечено.", "Следующее задание");
    if (id === "letter") return [open, copy, paste, send, check, done];
    if (id === "refine") return [step("builder", "Соберите запрос", "Поправьте поля своими словами. Скопируется текст, который получился ниже.", "Скопировать мой запрос"), paste, send, check, done];
    if (id === "safety") {
      var cards = [step("safety-intro", "Можно ли отправить это ИИ?", "Сейчас отвечаете вы, на сайте. Ответ модели мы не спрашиваем.", "К первой карточке")];
      SAFETY.forEach(function (card, index) {
        cards.push({ kind: "safety", title: "Карточка " + (index + 1) + " из " + SAFETY.length, text: card[0], index: index, primary: "Дальше" });
      });
      cards.push(step("mask", "Как спрятать лишние сведения", "Ниже вымышленный пример. Свои настоящие данные вводить не нужно.", "Дальше"));
      cards.push(step("safety-score", "Что совпало с правилом курса", "Здесь сверка с заранее записанными ответами, не с ИИ.", "Дальше"));
      cards.push(step("copy", "Можно сверить с WorkAI", "Это дополнительный шаг. Ответ программы не заменяет карточки выше.", "Скопировать запрос"));
      cards.push(done);
      return cards;
    }
    if (id === "facts" || id === "document" || id === "deals" || id === "helper") {
      var load = step("download", "Скачайте учебный файл", file ? file.why : "Файл нужен для этого задания.", "Файл скачан, дальше");
      var attach = step("attach", "Добавьте файл в WorkAI", "Выберите скачанный файл и убедитесь, что он виден у сообщения. Сайт программу не видит и прикрепление не проверяет.", "Файл добавлен, дальше");
      if (id === "helper") return [load, step("builder", "Опишите помощника", "Название роли можно заменить своими словами. Скопируется текст ниже.", "Скопировать мой запрос"), attach, paste, send, check, done];
      if (id === "document") load.text = "Если файл уже скачан в прошлом задании, второй раз можно не скачивать. Готовый ответ с ошибками — это запись Б в том же файле.";
      return [load, attach, copy, paste, send, check, done];
    }
    if (id === "lab-ping") {
      return [
        open,
        step("lab", "Подключение делает преподаватель", "Откройте в программе настройки инструментов. Адрес сервера и ключ преподаватель даёт отдельно: на этой странице их нет, и в запрос их не вставляют.", "Подключение проверили"),
        copy,
        paste,
        send,
        step("check", "Посмотрите результат", "Если пришла ошибка, запишите её. Ошибка не означает, что связь проверена успешно.", "Я посмотрел результат"),
        done
      ];
    }
    if (id === "lab-mail") return [step("lab", "Нужен список, не отправка", "Ожидаемое действие программы: mail_list. Это учебная почта лаборатории, не почта вашей организации.", "Дальше"), copy, paste, send, check, done];
    if (id === "lab-read" || id === "lab-note") {
      var label = id === "lab-read" ? "Впишите письмо" : "Впишите заметку";
      var hint = id === "lab-read"
        ? "Номер или название даёт преподаватель. Пока поле пустое, запрос не копируется."
        : "Название даёт преподаватель. Имя действия, которым заметку создают, на этом сайте не указано.";
      return [step("field", label, hint, "Дальше"), step("copy", "Скопируйте запрос", "В текст уже подставлено то, что вы вписали.", "Скопировать запрос"), paste, send, check, done];
    }
    if (id === "helper-test") return [step("lab", "Сейчас ждём отказ", "Попросите помощника отправить платёж. Правильный результат — отказ. Платёжное поручение составлять не нужно.", "Дальше"), copy, paste, send, check, done];
    var generic = [copy, paste, send, check, done];
    if (file) generic.unshift(step("download", "Скачайте учебный файл", file.why, "Файл скачан, дальше"));
    return generic;
  }

  function copyIndex(id) {
    var steps = flow(id);
    for (var i = 0; i < steps.length; i += 1) {
      if (steps[i].kind === "copy" || steps[i].kind === "builder") return i;
    }
    return 0;
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
      bucket.step = copyIndex(found);
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
    if (sections.indexOf(hash) >= 0) state.mode = "all";
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

  function advance() {
    var steps = flow(bucket.at);
    if (bucket.step < steps.length - 1) {
      bucket.step += 1;
      bucket.confirm = false;
      bucket.helpOpen = false;
      save();
      render();
      return;
    }
    bucket.done[bucket.at] = true;
    markTask(bucket.at);
    var index = day.exerciseIds.indexOf(bucket.at);
    if (index + 1 < day.exerciseIds.length) openExercise(day.exerciseIds[index + 1], 0);
    else openSummary();
  }

  function back() {
    if (bucket.confirm) {
      bucket.confirm = false;
      save();
      render();
      return;
    }
    if (bucket.place === "summary") {
      openHome();
      return;
    }
    if (bucket.step > 0) {
      bucket.step -= 1;
      bucket.helpOpen = false;
      save();
      render();
      return;
    }
    openHome();
  }

  function resumeAt() {
    if (bucket.at && !bucket.done[bucket.at]) return day.exerciseIds.indexOf(bucket.at);
    for (var i = 0; i < day.exerciseIds.length; i += 1) {
      if (!bucket.done[day.exerciseIds[i]]) return i;
    }
    return -1;
  }

  function helpKind(kind) {
    if (kind === "download") return "file";
    if (kind === "attach") return "attach";
    if (kind === "builder" || kind === "field") return "copy";
    if (kind === "lab" || kind === "safety" || kind === "mask" || kind === "safety-score" || kind === "safety-intro") return "lab";
    if (kind === "open" || kind === "copy" || kind === "paste" || kind === "send" || kind === "check") return kind;
    return "check";
  }

  function problemText(current, reason) {
    return "Портал курса. День " + day.number + ", задание «" + plainTitle(exercise(bucket.at).title) + "», шаг " + (bucket.step + 1) + ". " + current.title + ".\nНе получается: " + reason + ".\nПароль, ключ и личные данные сюда не вписывал.";
  }

  function readingBar() {
    var bar = el("div", "reading");
    bar.appendChild(el("p", "", "Размер текста"));
    [["normal", "Обычный"], ["large", "Крупный"], ["xlarge", "Очень крупный"]].forEach(function (pair) {
      var node = button(reading.size === pair[0] ? "btn" : "btn secondary", pair[1], function () {
        reading.size = pair[0];
        applyReading();
        render();
      });
      node.setAttribute("aria-pressed", reading.size === pair[0] ? "true" : "false");
      bar.appendChild(node);
    });
    var contrast = button("btn secondary", reading.contrast === "high" ? "Обычная контрастность" : "Повышенная контрастность", function () {
      reading.contrast = reading.contrast === "high" ? "normal" : "high";
      applyReading();
      render();
    });
    contrast.setAttribute("aria-pressed", reading.contrast === "high" ? "true" : "false");
    bar.appendChild(contrast);
    return bar;
  }

  function switcher() {
    var bar = el("div", "lesson-switch");
    var steps = button(state.mode !== "all" ? "btn" : "btn secondary", "Выполнять по шагам", function () {
      state.mode = "steps";
      if (!bucket.place) bucket.place = "home";
      save();
      render();
    });
    var all = button(state.mode === "all" ? "btn" : "btn secondary", "Посмотреть все задания", function () {
      state.mode = "all";
      save();
      render();
    });
    steps.setAttribute("aria-pressed", state.mode !== "all" ? "true" : "false");
    all.setAttribute("aria-pressed", state.mode === "all" ? "true" : "false");
    bar.appendChild(steps);
    bar.appendChild(all);
    return bar;
  }

  function promptSheet(text, title, purpose, expected) {
    var sheet = el("div", "prompt-sheet");
    sheet.appendChild(el("h3", "", title || "Запрос"));
    if (purpose) sheet.appendChild(el("p", "", purpose));
    var pre = el("pre", "prompt-text");
    pre.textContent = text;
    sheet.appendChild(pre);
    if (expected) sheet.appendChild(el("p", "", "Ожидаемый результат. " + expected));
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
    box.appendChild(el("p", "", "Тип: " + file.type + ". Размер: " + file.bytes + " байт."));
    var download = el("a", "btn", "Скачать файл");
    download.href = file.file;
    download.setAttribute("download", "");
    download.addEventListener("click", function () {
      bucket.downloaded[file.file] = true;
      save();
      var note = box.querySelector(".file-note");
      if (note) note.hidden = false;
    });
    box.appendChild(download);
    var view = button("btn secondary", "Посмотреть содержимое", function () {
      var pre = box.querySelector(".file-preview");
      if (pre && !pre.hidden && pre.textContent) {
        pre.hidden = true;
        return;
      }
      fetch(file.file).then(function (response) { return response.text(); }).then(function (text) {
        if (!pre) return;
        pre.textContent = text;
        pre.hidden = false;
      }).catch(function () {
        window.open(file.file, "_blank", "noopener");
      });
    });
    box.appendChild(view);
    var preview = el("pre", "file-preview prompt-text");
    preview.hidden = true;
    box.appendChild(preview);
    var note = el("p", "file-note", "Файл обычно находится в папке «Загрузки». На Mac эта папка может называться Downloads.");
    note.hidden = !bucket.downloaded[file.file];
    box.appendChild(note);
    var how = button("btn secondary", "Как найти скачанный файл?", function () {
      var extra = box.querySelector(".find-note");
      if (extra) extra.hidden = !extra.hidden;
    });
    box.appendChild(how);
    var find = el("div", "find-note");
    find.hidden = true;
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

  function helpBlock(current) {
    var pack = helpPack(helpKind(current.kind));
    var box = el("div", "help-box");
    box.hidden = !bucket.helpOpen;
    box.setAttribute("role", "region");
    box.setAttribute("aria-label", "Помощь по этому шагу");
    var helpTitle = el("h3", "", pack[0]);
    helpTitle.tabIndex = -1;
    box.appendChild(helpTitle);
    pack[1].forEach(function (line) { box.appendChild(el("p", "", line)); });
    if (current.kind === "open") {
      var link = el("a", "btn secondary", "Открыть подготовку");
      link.href = "prepare.html";
      box.appendChild(link);
      box.appendChild(el("p", "", "Когда программа откроется, вернитесь к этому заданию. Шаг сохранится."));
    }
    var reason = pack[2][0];
    pack[2].forEach(function (name) {
      var choice = button("btn secondary", name, function () {
        reason = name;
        box.querySelectorAll(".reason").forEach(function (node) { node.classList.remove("is-on"); });
        choice.classList.add("is-on");
      });
      choice.classList.add("reason");
      box.appendChild(choice);
    });
    var status = el("p", "copy-status");
    status.setAttribute("role", "status");
    box.appendChild(button("btn secondary", "Скопировать описание проблемы", function () {
      writeText(problemText(current, reason), function () {
        status.textContent = "Описание скопировано. Его можно показать преподавателю.";
      }, function () {
        status.textContent = "Не удалось скопировать. Прочитайте текст преподавателю с экрана.";
      });
    }));
    box.appendChild(status);
    return box;
  }

  function actions(current) {
    var row = el("div", "step-actions");
    row.appendChild(button("btn secondary", "Назад", back));
    row.appendChild(button("btn secondary", "Не получается?", function () {
      bucket.helpOpen = !bucket.helpOpen;
      save();
      render();
    }));
    if (bucket.place === "step") {
      row.appendChild(button("btn secondary", "Начать заново", function () {
        bucket.confirm = true;
        save();
        render();
      }));
    }
    return row;
  }

  function confirmBox() {
    var box = el("div", "confirm-box");
    box.appendChild(el("p", "", "Сбросить только это задание? Отметки других заданий останутся."));
    box.appendChild(button("btn", "Нет, оставить как есть", function () {
      bucket.confirm = false;
      save();
      render();
    }));
    box.appendChild(button("btn secondary", "Да, начать заново", function () {
      var id = bucket.at;
      bucket.done[id] = false;
      bucket.step = 0;
      bucket.confirm = false;
      bucket.copied[id] = false;
      Object.keys(bucket.marks).forEach(function (key) {
        if (key.indexOf(id + ":") === 0) delete bucket.marks[key];
      });
      delete bucket.fields[id];
      save();
      render();
    }));
    return box;
  }

  function primary(text, action, disabled) {
    var node = button("btn", text, action);
    if (disabled) node.disabled = true;
    return node;
  }

  function sideFor(id, current) {
    var prompt = promptOf(id);
    if (current.kind === "copy" && prompt) return promptSheet(id === "lab-read" || id === "lab-note" ? assembled(id) : prompt.promptText, prompt.title, prompt.description, prompt.expectedResult);
    if (current.kind === "builder") return promptSheet(assembled(id), "Ваш запрос", "Меняется вместе с полями.", prompt ? prompt.expectedResult : "");
    if (current.kind === "check" && prompt) return checklist(prompt.acceptanceCriteria, id + ":" + bucket.step);
    if (current.kind === "download") {
      var file = material(id);
      return file ? fileBlock(file) : null;
    }
    if (current.kind === "field") return fieldsBlock(id);
    if (current.kind === "builder") return null;
    return null;
  }

  function safetyScore() {
    var box = el("div", "check-box");
    var hit = 0;
    SAFETY.forEach(function (card, index) {
      var picked = bucket.safety[index];
      var ok = picked === card[1];
      if (ok) hit += 1;
      box.appendChild(el("p", "", card[0] + " Ваш выбор: " + (ANSWER[picked] || "нет") + ". Утверждённый ответ: " + ANSWER[card[1]] + "."));
    });
    box.appendChild(el("p", "manual", "Совпало с утверждёнными ответами: " + hit + " из " + SAFETY.length + ". Это проверка на сайте, не ответ ИИ."));
    return box;
  }

  function renderHome() {
    var screen = el("div", "lesson-screen");
    var heading = el("h1", "", "День " + day.number + ". " + day.title);
    screen.appendChild(heading);
    screen.appendChild(el("p", "lead", day.lead));
    var minutes = 0;
    day.exerciseIds.forEach(function (id) { minutes += Number(exercise(id).minutes) || 0; });
    var doneCount = day.exerciseIds.filter(function (id) { return bucket.done[id]; }).length;
    screen.appendChild(el("p", "", "Упражнений: " + day.exerciseIds.length + ". Около " + minutes + " минут практики. Вы отметили выполненные: " + doneCount + " из " + day.exerciseIds.length + "."));
    screen.appendChild(el("h2", "", "Что понадобится"));
    var needs = [];
    day.exerciseIds.forEach(function (id) {
      (exercise(id).needs || []).forEach(function (line) {
        if (needs.indexOf(line) < 0) needs.push(line);
      });
    });
    var list = el("ul");
    needs.forEach(function (line) { list.appendChild(el("li", "", line)); });
    screen.appendChild(list);
    screen.appendChild(el("h2", "", "Что получится"));
    var outcomes = el("ul");
    (day.outcomes || []).forEach(function (line) { outcomes.appendChild(el("li", "", line)); });
    screen.appendChild(outcomes);
    var index = resumeAt();
    var row = el("div", "step-actions");
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
    screen.appendChild(row);
    var tasks = el("ol", "task-index");
    day.exerciseIds.forEach(function (id, number) {
      var item = el("li");
      var link = el("a", "", plainTitle(exercise(id).title));
      link.href = "#task-" + id;
      item.appendChild(link);
      if (bucket.done[id]) item.appendChild(el("span", "manual", " Вы отметили задание."));
      tasks.appendChild(item);
    });
    screen.appendChild(tasks);
    app.appendChild(screen);
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
    var row = el("div", "step-actions");
    if (!bucket.finished) {
      row.appendChild(button("btn", day.number === 1 ? "Завершить первый день" : "Завершить этот день", function () {
        bucket.finished = true;
        save();
        render();
      }));
    }
    row.appendChild(button("btn secondary", "Назад", back));
    row.appendChild(button("btn secondary", "Повторить с первого задания", function () { openExercise(day.exerciseIds[0], 0); }));
    screen.appendChild(row);
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
  }

  function renderStep() {
    var id = bucket.at;
    var steps = flow(id);
    if (!exercise(id) || bucket.step >= steps.length) {
      openHome();
      return;
    }
    var current = steps[bucket.step];
    var index = day.exerciseIds.indexOf(id);
    var screen = el("div", "lesson-screen");
    screen.appendChild(el("p", "kicker", "День " + day.number + " · Задание " + (index + 1) + " из " + day.exerciseIds.length));
    var heading = el("h1", "", plainTitle(exercise(id).title));
    heading.id = "step-heading";
    heading.tabIndex = -1;
    screen.appendChild(heading);
    screen.appendChild(el("p", "", exercise(id).goal));
    screen.appendChild(el("p", "note", "Около " + exercise(id).minutes + " минут. Сейчас действие " + (bucket.step + 1) + " из " + steps.length + "."));
    var meter = el("div", "stage-meter");
    meter.setAttribute("aria-hidden", "true");
    steps.forEach(function (_, stepIndex) {
      meter.appendChild(el("span", stepIndex < bucket.step ? "is-done" : stepIndex === bucket.step ? "is-now" : ""));
    });
    screen.appendChild(meter);
    var split = el("div", "step-split");
    var main = el("div", "step-copy");
    var title = el("h2", "", current.title);
    main.appendChild(title);
    main.appendChild(el("p", "action", current.text));
    if (current.kind === "paste") {
      var os = osName();
      main.appendChild(el("p", "", os === "mac" ? "На Mac: Command и V." : os === "windows" ? "На Windows: Ctrl и V." : "Windows: Ctrl и V. Mac: Command и V."));
      var more = button("btn secondary", "Показать, как вставить текст", function () {
        var node = main.querySelector(".paste-more");
        if (node) node.hidden = !node.hidden;
      });
      main.appendChild(more);
      var extra = el("div", "paste-more");
      extra.hidden = true;
      extra.appendChild(el("p", "", "Нажмите на поле сообщения. Затем вставьте текст: Windows — правая кнопка и «Вставить», Mac — два пальца и «Вставить»."));
      main.appendChild(extra);
    }
    if (current.kind === "send") main.appendChild(el("p", "", "Кнопка отправки стоит рядом с полем. Сайт отправить сообщение за вас не может."));
    if (current.kind === "attach") main.appendChild(el("p", "manual", "Кнопка ниже — ваше подтверждение, не проверка сайтом."));
    if (current.kind === "lab" && id === "lab-ping") main.appendChild(el("p", "", "Ожидаемое действие программы: lab_ping."));
    if (id === "lab-mail" && current.kind === "lab") main.appendChild(el("p", "", "Если вместо списка открылся черновик письма, остановитесь."));
    if (id === "lab-read" && current.kind === "check") main.appendChild(el("p", "", "Ожидаемое действие: mail_read. Отказ прочитать письмо не заменяйте повторными запросами."));
    if (id === "lab-note" && current.kind === "check") main.appendChild(el("p", "", "Ожидаемое действие: notes_get. Если пришёл отказ, не отмечайте заметку как найденную."));
    split.appendChild(main);
    var side = null;
    if (current.kind === "builder") side = fieldsBlock(id);
    else side = sideFor(id, current);
    if (current.kind === "safety") {
      side = el("div", "choice-list");
      [["allow", "Можно использовать"], ["ask", "Нужно сначала проверить"], ["deny", "Нельзя отправлять"]].forEach(function (pair) {
        var picked = bucket.safety[current.index];
        var node = button(picked === pair[0] ? "btn" : "btn secondary", pair[1], function () {
          bucket.safety[current.index] = pair[0];
          save();
          render();
        });
        side.appendChild(node);
      });
      if (bucket.safety[current.index]) {
        side.appendChild(el("p", "resume", "Утверждённый ответ: " + ANSWER[SAFETY[current.index][1]] + ". " + SAFETY[current.index][2]));
      }
    }
    if (current.kind === "mask") {
      side = el("div", "prompt-sheet");
      side.appendChild(el("p", "", "Вымышленный пример."));
      side.appendChild(el("p", "", "Было: Иван Петров, паспорт 1234 567890."));
      side.appendChild(el("p", "", "Стало: [СОТРУДНИК], [НОМЕР ДОКУМЕНТА]."));
    }
    if (current.kind === "safety-score") side = safetyScore();
    if (current.kind === "builder") {
      main.appendChild(promptSheet(assembled(id), "Ваш запрос", "Меняется вместе с полями.", promptOf(id).expectedResult));
      var wrap = el("div", "step-side");
      wrap.appendChild(side);
      split.classList.add("has-side");
      split.appendChild(wrap);
      side = null;
    }
    if (side) {
      var wrapSide = el("div", "step-side");
      wrapSide.appendChild(side);
      split.classList.add("has-side");
      split.appendChild(wrapSide);
    }
    var row = el("div", "step-actions");
    if (bucket.confirm) {
      row.appendChild(confirmBox());
    } else {
      row.appendChild(button("btn secondary", "Назад", back));
      row.appendChild(button("btn secondary", "Не получается?", function () {
        bucket.helpOpen = !bucket.helpOpen;
        pendingFocus = ".help-box h3";
        save();
        render();
      }));
      if (current.kind !== "done") {
        row.appendChild(button("btn secondary", "Начать заново", function () {
          bucket.confirm = true;
          save();
          render();
        }));
      }
      if (current.kind === "copy" || current.kind === "builder") {
        var copyButton = primary(bucket.copied[id] ? "Скопировано!" : current.primary, function () {
          var text = current.kind === "builder" || id === "lab-read" || id === "lab-note" ? assembled(id) : promptOf(id).promptText;
          if ((id === "lab-read" || id === "lab-note") && !((bucket.fields[id] || {}).name || "").trim()) {
            var early = row.querySelector(".copy-status");
            if (early) early.textContent = "Сначала впишите то, что дал преподаватель. Пустые скобки копировать не нужно.";
            return;
          }
          writeText(text, function () {
            bucket.copied[id] = true;
            save();
            pendingFocus = "[data-go]";
            render();
          }, function () {
            var live = document.querySelector(".step-actions .copy-status");
            if (live) live.textContent = "Не удалось скопировать. Выделите текст запроса и скопируйте его вручную.";
          });
        });
        row.appendChild(copyButton);
        var live = el("p", "copy-status");
        live.setAttribute("role", "status");
        if (bucket.copied[id]) live.textContent = "Запрос скопирован. Теперь вернитесь в WorkAI.";
        row.appendChild(live);
        if (id === "safety") row.appendChild(button("btn secondary", "Дальше без запроса", advance));
        if (bucket.copied[id]) {
          var go = primary("Продолжить", advance);
          go.setAttribute("data-go", "1");
          row.appendChild(go);
        } else {
          row.appendChild(button("btn secondary", "Я скопировал текст вручную", function () {
            bucket.copied[id] = true;
            save();
            advance();
          }));
        }
      } else if (current.kind === "safety") {
        var nextCard = primary("Дальше", advance, !bucket.safety[current.index]);
        row.appendChild(nextCard);
      } else if (current.kind === "done") {
        var last = day.exerciseIds.indexOf(id) === day.exerciseIds.length - 1;
        row.appendChild(primary(last ? "Перейти к проверке" : "Следующее задание", function () {
          bucket.done[id] = true;
          markTask(id);
          var next = day.exerciseIds.indexOf(id) + 1;
          if (next < day.exerciseIds.length) openExercise(day.exerciseIds[next], 0);
          else openSummary();
        }));
      } else {
        row.appendChild(primary(current.primary, advance));
      }
    }
    split.appendChild(row);
    if (bucket.helpOpen && !bucket.confirm) split.appendChild(helpBlock(current));
    screen.appendChild(split);
    app.appendChild(screen);
  }

  function render() {
    document.documentElement.classList.toggle("lesson-all", state.mode === "all");
    app.innerHTML = "";
    app.appendChild(switcher());
    app.appendChild(readingBar());
    if (state.mode === "all") {
      window.requestAnimationFrame(function () {
        var node = location.hash ? document.getElementById(location.hash.slice(1)) : null;
        if (node) node.scrollIntoView();
      });
      return;
    }
    if (bucket.place === "summary" || location.hash === "#check") renderSummary();
    else if (bucket.place === "step" && bucket.at) renderStep();
    else renderHome();
    var focusKey = state.mode + ":" + bucket.place + ":" + bucket.at + ":" + bucket.step;
    if (pendingFocus) {
      var target = app.querySelector(pendingFocus);
      pendingFocus = "";
      if (target) target.focus();
    } else if (focusKey !== lastFocus) {
      lastFocus = focusKey;
      var head = document.getElementById("step-heading");
      if (head) head.focus();
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
