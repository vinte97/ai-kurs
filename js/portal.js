(function () {
  var navButton = document.querySelector(".menu-button");
  var nav = document.getElementById("site-nav");
  var backdrop = document.querySelector(".nav-backdrop");
  var closer = document.querySelector(".nav-close");
  function setMenu(open) {
    var was = document.body.classList.contains("nav-open");
    document.body.classList.toggle("nav-open", open);
    if (navButton) navButton.setAttribute("aria-expanded", open ? "true" : "false");
    if (backdrop) backdrop.hidden = !open;
    if (open && closer) closer.focus();
    if (!open && was && navButton) navButton.focus();
  }
  if (navButton) {
    navButton.addEventListener("click", function () {
      setMenu(!document.body.classList.contains("nav-open"));
    });
  }
  if (closer) closer.addEventListener("click", function () { setMenu(false); });
  if (backdrop) backdrop.addEventListener("click", function () { setMenu(false); });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setMenu(false);
  });
  if (nav) {
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) setMenu(false);
    });
  }
  var readKey = "aikurs-reading-v1";
  var reading = { size: "normal", contrast: "normal" };
  try {
    var storedRead = JSON.parse(localStorage.getItem(readKey) || "{}");
    if (storedRead && (storedRead.size === "large" || storedRead.size === "xlarge")) reading.size = storedRead.size;
    if (storedRead && storedRead.contrast === "high") reading.contrast = "high";
  } catch (e) {}
  function applyReading() {
    document.documentElement.setAttribute("data-text", reading.size);
    document.documentElement.setAttribute("data-contrast", reading.contrast);
    try { localStorage.setItem(readKey, JSON.stringify(reading)); } catch (e) {}
  }
  applyReading();
  initPrompts();
  initTasks();
  initFilters();
  initCode();

  var root = document.getElementById("wizard");
  if (!root || !window.TRACKS) return;

  var KEY = "aikurs-progress-v1";
  var state = load();

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(KEY) || "{}");
      if (!saved || typeof saved !== "object") return fresh();
      saved.done = saved.done || {};
      saved.mode = saved.mode === "brief" ? "brief" : "detailed";
      return saved;
    } catch (e) {
      return fresh();
    }
  }

  function fresh() {
    return { os: "", chip: "", mode: "detailed", done: {}, unknown: false, asked: false, fast: false };
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  function steps() {
    return state.os ? window.TRACKS[state.os] : [];
  }

  function indexOf(id) {
    var list = steps();
    for (var i = 0; i < list.length; i += 1) if (list[i].id === id) return i;
    return 0;
  }

  function current() {
    var list = steps();
    for (var i = 0; i < list.length; i += 1) {
      if (!state.done[list[i].id]) return list[i];
    }
    return null;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  var STAGE_TITLES = {
    check: "Проверяем компьютер",
    workai: "Устанавливаем WorkAI",
    enter: "Входим в WorkAI",
    extra: "Дополнительные программы",
    files: "Скачиваем учебные файлы",
    ready: "Завершаем подготовку"
  };

  function stageId(step) {
    if (step.group === "chip") return "workai";
    if (step.group === "launch") return "enter";
    if (step.group === "git" || step.group === "python") return "extra";
    return step.group;
  }

  function stageOrder() {
    var seen = [];
    steps().forEach(function (item) {
      var name = stageId(item);
      if (seen.indexOf(name) < 0) seen.push(name);
    });
    return seen;
  }

  function stageMeta(step) {
    if (!step.group) {
      return { plain: true, title: step.title, n: 1, total: 1, action: 1, actions: 1 };
    }
    var id = stageId(step);
    var order = stageOrder();
    var inStage = steps().filter(function (item) { return stageId(item) === id; });
    var action = 1;
    inStage.forEach(function (item, index) {
      if (item.id === step.id) action = index + 1;
    });
    return {
      id: id,
      title: STAGE_TITLES[id] || step.title,
      n: order.indexOf(id) + 1,
      total: order.length,
      action: action,
      actions: inStage.length
    };
  }

  function actionLink(step) {
    if (!step.action) return null;
    var link = el("a", "btn secondary", step.action.label);
    link.href = step.action.href;
    link.target = "_blank";
    link.rel = "noopener";
    return link;
  }

  function systemName() {
    if (state.os === "mac") return "Mac";
    if (state.os === "windows") return "Windows";
    return "не выбрана";
  }

  function helpBox(step) {
    var box = el("div", "help");
    var meta = stageMeta(step);
    box.appendChild(el("p", "", "Что именно произошло?"));
    var list = document.createElement("ul");
    step.help.forEach(function (line) {
      list.appendChild(el("li", "", line));
    });
    box.appendChild(list);
    var copy = el("button", "btn secondary", "Скопировать описание проблемы");
    copy.type = "button";
    copy.addEventListener("click", function () {
      var text = "Не удаётся выполнить этап " + meta.n + ", «" + step.title + "». Система: " + systemName() + ".";
      function done(ok) {
        copy.textContent = ok ? "Описание скопировано" : "Не удалось скопировать. Выделите текст и скопируйте его вручную.";
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      } else {
        done(false);
      }
    });
    box.appendChild(copy);
    box.appendChild(el("p", "", "Если это не помогло, вернитесь на шаг назад или напишите преподавателю. Пароль и коды в сообщение не вставляйте."));
    return box;
  }

  function openShot(src, alt) {
    var dialog = document.getElementById("shot-dialog");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "shot-dialog";
      dialog.innerHTML = '<button class="btn" type="button" id="shot-close">Закрыть</button><img alt=""><p></p>';
      document.body.appendChild(dialog);
      dialog.querySelector("#shot-close").addEventListener("click", function () { dialog.close(); });
      dialog.addEventListener("cancel", function () {});
      dialog.addEventListener("close", function () {
        if (dialog._back) dialog._back.focus();
      });
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && dialog.open) dialog.close();
      });
    }
    dialog.querySelector("img").src = src;
    dialog.querySelector("img").alt = alt;
    dialog.querySelector("p").textContent = alt;
    dialog._back = document.activeElement;
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute("open", "");
    dialog.querySelector("#shot-close").focus();
  }

  function markDone(step) {
    state.done[step.id] = true;
    save();
    draw();
  }

  function renderStep(step, position, total, compact) {
    var card = el("article", "card");
    var meta = stageMeta(step);
    var heading = el(compact ? "h2" : "h1", "", meta.plain ? step.title : "Этап " + meta.n + " из " + meta.total + ". " + meta.title);
    card.appendChild(heading);
    if (!meta.plain) card.appendChild(el("p", "progress", step.title + ". Действие " + meta.action + " из " + meta.actions + " в этом этапе."));
    if (step.why) card.appendChild(el("p", "", step.why));
    var layout = el("div", step.image ? "step-layout has-shot" : "step-layout");
    var copy = el("div");
    copy.appendChild(el("p", "action", step.do));
    copy.appendChild(el("p", "", step.where));
    layout.appendChild(copy);
    if (step.image) {
      var shot = document.createElement("img");
      shot.className = "step-shot";
      shot.src = step.image;
      shot.alt = step.imageAlt || "Снимок страницы";
      shot.loading = compact ? "lazy" : "eager";
      var opener = el("button", "shot-open", "");
      opener.type = "button";
      opener.appendChild(shot);
      opener.setAttribute("aria-label", "Увеличить изображение: " + shot.alt);
      opener.addEventListener("click", function () { openShot(shot.src, shot.alt); });
      var figure = el("figure");
      figure.appendChild(opener);
      figure.appendChild(el("figcaption", "", shot.alt));
      layout.appendChild(figure);
    }
    card.appendChild(layout);
    card.appendChild(el("p", "expect", "Что должно произойти. " + step.see));
    card.appendChild(el("p", "", "Как понять, что получилось. " + step.check));
    var link = actionLink(step);
    if (link) card.appendChild(link);
    if (step.choice && !compact) {
      step.choice.forEach(function (item) {
        var button = el("button", "btn", item.label);
        button.type = "button";
        button.addEventListener("click", function () {
          state.chip = item.id;
          markDone(step);
        });
        card.appendChild(button);
      });
    }
    if (!compact) {
      var actions = el("div", "step-actions");
      var yes = el("button", "btn", "Получилось, дальше");
      yes.type = "button";
      if (!step.choice) {
        yes.addEventListener("click", function () { markDone(step); });
        actions.appendChild(yes);
      }
      var no = el("button", "btn secondary", "Не получается?");
      no.type = "button";
      var opened = false;
      no.addEventListener("click", function () {
        if (opened) return;
        opened = true;
        card.appendChild(helpBox(step));
        no.setAttribute("aria-expanded", "true");
      });
      no.setAttribute("aria-expanded", "false");
      actions.appendChild(no);
      var back = el("button", "btn secondary", "Назад");
      back.type = "button";
      back.addEventListener("click", function () {
        var list = steps();
        var place = indexOf(step.id);
        if (place <= 0) {
          state.os = "";
          save();
          draw();
          return;
        }
        delete state.done[list[place - 1].id];
        save();
        draw();
      });
      actions.appendChild(back);
      if (step.skip) {
        var skip = el("button", "btn secondary", "Пропустить этот блок");
        skip.type = "button";
        skip.addEventListener("click", function () {
          steps().forEach(function (item) {
            if (item.group === step.group) state.done[item.id] = "skipped";
          });
          save();
          draw();
        });
        actions.appendChild(skip);
      }
      card.appendChild(actions);
    } else {
      var details = document.createElement("details");
      details.appendChild(el("summary", "", "Если не получилось"));
      details.appendChild(helpBox(step));
      card.appendChild(details);
    }
    return card;
  }

  function setIntro(show) {
    var intro = document.getElementById("prep-intro");
    if (intro) intro.hidden = !show;
  }

  function restart() {
    var mode = state.mode;
    state = fresh();
    state.mode = mode;
    save();
    draw();
  }

  function chooseOs(os) {
    state.os = os;
    state.unknown = false;
    state.asked = true;
    if (state.fast) {
      steps().forEach(function (item) {
        if (item.group !== "files" && item.group !== "ready") state.done[item.id] = "skipped";
      });
      state.fast = false;
    }
    save();
    draw();
  }

  function readingBar() {
    var bar = el("div", "reading");
    bar.appendChild(el("p", "", "Размер текста"));
    [["normal", "Обычный"], ["large", "Крупный"], ["xlarge", "Очень крупный"]].forEach(function (pair) {
      var button = el("button", reading.size === pair[0] ? "btn" : "btn secondary", pair[1]);
      button.type = "button";
      button.setAttribute("aria-pressed", reading.size === pair[0] ? "true" : "false");
      button.addEventListener("click", function () {
        reading.size = pair[0];
        applyReading();
        draw();
      });
      bar.appendChild(button);
    });
    var contrast = el("button", "btn secondary", reading.contrast === "high" ? "Обычная контрастность" : "Повышенная контрастность");
    contrast.type = "button";
    contrast.setAttribute("aria-pressed", reading.contrast === "high" ? "true" : "false");
    contrast.addEventListener("click", function () {
      reading.contrast = reading.contrast === "high" ? "normal" : "high";
      applyReading();
      draw();
    });
    bar.appendChild(contrast);
    return bar;
  }

  function modeSwitch() {
    var bar = el("div", "wizard-tools");
    var detailed = el("button", state.mode === "detailed" ? "btn" : "btn secondary", "Подробно");
    var brief = el("button", state.mode === "brief" ? "btn" : "btn secondary", "Кратко");
    detailed.type = "button";
    brief.type = "button";
    detailed.addEventListener("click", function () { state.mode = "detailed"; save(); draw(); });
    brief.addEventListener("click", function () { state.mode = "brief"; save(); draw(); });
    var change = el("button", "btn secondary", "Сменить компьютер");
    change.type = "button";
    change.addEventListener("click", function () {
      state.os = "";
      state.unknown = false;
      state.asked = true;
      save();
      draw();
    });
    var again = el("button", "btn secondary", "Начать сначала");
    again.type = "button";
    again.addEventListener("click", restart);
    bar.appendChild(detailed);
    bar.appendChild(brief);
    bar.appendChild(change);
    bar.appendChild(again);
    bar.appendChild(readingBar());
    return bar;
  }

  function welcomeScreen() {
    setIntro(true);
    root.appendChild(el("p", "", "Впереди шесть этапов. Для занятий нужна программа WorkAI. Git и Python — дополнительные: их ставят, только если попросил преподаватель."));
    root.appendChild(el("p", "", "Инструкцию можно читать с телефона, а кнопки нажимать на компьютере. Страницу можно закрыть и вернуться позже: отметки останутся на этом устройстве."));
    root.appendChild(el("p", "", "Если что-то не выйдет, на шаге есть кнопка «Не получается?». Можно также написать преподавателю."));
    var start = el("button", "btn", "Начать подготовку");
    var jump = el("button", "btn secondary", "Я уже всё установил — перейти к проверке");
    start.type = "button";
    jump.type = "button";
    start.addEventListener("click", function () {
      state.asked = true;
      state.fast = false;
      save();
      draw();
    });
    jump.addEventListener("click", function () {
      state.asked = true;
      state.fast = true;
      save();
      draw();
    });
    root.appendChild(start);
    root.appendChild(jump);
    root.appendChild(readingBar());
  }

  function osScreen() {
    setIntro(false);
    root.appendChild(el("h1", "", "На каком компьютере вы будете заниматься?"));
    root.appendChild(el("p", "lead", "Дальше останется инструкция только для вашей системы."));
    var windows = el("button", "btn os-choice", "Windows — например, Lenovo, ASUS, HP или Acer");
    var mac = el("button", "btn os-choice", "Mac — компьютер Apple");
    var unknown = el("button", "btn secondary os-choice", "Не знаю — помогите определить");
    [windows, mac, unknown].forEach(function (button) { button.type = "button"; });
    windows.addEventListener("click", function () { chooseOs("windows"); });
    mac.addEventListener("click", function () { chooseOs("mac"); });
    unknown.addEventListener("click", function () { state.unknown = true; state.asked = true; save(); draw(); });
    root.appendChild(windows);
    root.appendChild(mac);
    root.appendChild(unknown);
    var back = el("button", "btn secondary", "Назад");
    back.type = "button";
    back.addEventListener("click", function () {
      state.asked = false;
      state.fast = false;
      save();
      draw();
    });
    root.appendChild(back);
  }

  function unknownScreen() {
    root.appendChild(el("h1", "", "Давайте определим компьютер"));
    window.UNKNOWN_STEPS.forEach(function (step, index) {
      root.appendChild(renderStep(step, index + 1, window.UNKNOWN_STEPS.length, true));
    });
    var windows = el("button", "btn", "Это Windows");
    var mac = el("button", "btn", "Это Mac");
    windows.type = "button";
    mac.type = "button";
    windows.addEventListener("click", function () { chooseOs("windows"); });
    mac.addEventListener("click", function () { chooseOs("mac"); });
    root.appendChild(windows);
    root.appendChild(mac);
  }

  function doneScreen() {
    var last = steps()[steps().length - 1];
    if (last && last.praise && state.done[last.id] === true) {
      root.appendChild(el("p", "ok", last.praise));
    }
    root.appendChild(el("h1", "", "Компьютер готов к занятиям"));
    root.appendChild(el("p", "ok", "Отметки сохранены на этом устройстве. Регистрация не нужна."));
    root.appendChild(el("p", "", "Отметки ставите вы сами. Они не заменяют проверку. Настоящая проверка такая: окно WorkAI открылось. Для Git и Python проверка — сообщение установщика, что установка закончилась."));
    var list = document.createElement("ul");
    steps().forEach(function (step) {
      if (!state.done[step.id]) return;
      var mark = state.done[step.id] === "skipped" ? "Пропущено: " : "Отмечено: ";
      list.appendChild(el("li", "", mark + step.title));
    });
    root.appendChild(list);
    var again = el("button", "btn secondary", "Начать сначала");
    again.type = "button";
    again.addEventListener("click", restart);
    root.appendChild(again);
  }

  function drawBrief(list) {
    root.appendChild(el("h1", "", "Краткий список"));
    root.appendChild(el("p", "", "Те же действия, короче. Отметьте готовое внизу, когда проверите компьютер сами."));
    list.forEach(function (item, index) {
      var card = renderStep(item, index + 1, list.length, true);
      if (state.done[item.id]) card.appendChild(el("p", "ok", state.done[item.id] === "skipped" ? "Пропущено" : "Отмечено"));
      root.appendChild(card);
    });
    var finish = el("button", "btn", "Отметить шаги и открыть итог");
    finish.type = "button";
    finish.addEventListener("click", function () {
      list.forEach(function (item) {
        if (!state.done[item.id]) state.done[item.id] = true;
      });
      save();
      draw();
    });
    root.appendChild(finish);
  }

  var drawn = false;
  var resumeOnOpen = !!(state.os && Object.keys(state.done).length);

  function focusHeading() {
    if (!drawn) {
      drawn = true;
      return;
    }
    var heading = root.querySelector("h1");
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus();
  }

  function draw() {
    root.textContent = "";
    if (state.unknown && !state.os) {
      setIntro(false);
      unknownScreen();
      focusHeading();
      return;
    }
    if (!state.os && !state.asked) {
      welcomeScreen();
      drawn = true;
      return;
    }
    if (!state.os) {
      osScreen();
      focusHeading();
      return;
    }
    setIntro(false);
    var list = steps();
    var step = current();
    root.appendChild(modeSwitch());
    if (resumeOnOpen && step) {
      root.appendChild(el("p", "resume", "Вы остановились на этапе «" + stageMeta(step).title + "». Можно продолжить или нажать «Начать сначала»."));
      resumeOnOpen = false;
    }
    if (!step) {
      doneScreen();
      focusHeading();
      return;
    }
    if (state.mode === "brief") {
      drawBrief(list);
      focusHeading();
      return;
    }
    var position = indexOf(step.id) + 1;
    var previous = list[position - 2];
    if (previous && previous.praise && state.done[previous.id] === true) {
      root.appendChild(el("p", "ok", previous.praise));
    }
    root.appendChild(renderStep(step, position, list.length, false));
    var meter = el("p", "stage-meter");
    var meta = stageMeta(step);
    for (var mark = 1; mark <= meta.total; mark += 1) {
      meter.appendChild(el("span", mark < meta.n ? "is-done" : (mark === meta.n ? "is-now" : "")));
    }
    meter.setAttribute("aria-hidden", "true");
    root.insertBefore(meter, root.querySelector("article"));
    focusHeading();
  }

  function initCode() {
    var opener = document.getElementById("code-open");
    var form = document.getElementById("code-form");
    var input = document.getElementById("code-input");
    var status = document.getElementById("code-status");
    if (!opener || !form || !input) return;
    var messages = {
      1: "Открыт день 1.",
      2: "Открыты дни 1–2.",
      3: "Открыты дни 1–3.",
      4: "Открыты дни 1–4."
    };
    function apply(found) {
      try { localStorage.setItem("aikurs-open-day", String(found)); } catch (e) {}
      document.documentElement.setAttribute("data-open", String(found));
      var link = document.getElementById("continue-link");
      if (link) link.setAttribute("href", "day" + found + ".html");
      if (status) status.textContent = messages[found];
      input.value = "";
      form.hidden = true;
      opener.setAttribute("aria-expanded", "false");
    }
    var current = parseInt(document.documentElement.getAttribute("data-open") || "0", 10);
    if (current >= 1 && current <= 4) {
      var link = document.getElementById("continue-link");
      if (link) link.setAttribute("href", "day" + current + ".html");
      if (status) status.textContent = messages[current];
      form.hidden = true;
      opener.setAttribute("aria-expanded", "false");
    }
    opener.addEventListener("click", function () {
      form.hidden = !form.hidden;
      opener.setAttribute("aria-expanded", form.hidden ? "false" : "true");
      if (!form.hidden) input.focus();
    });
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var typed = String(input.value || "").replace(/\s/g, "");
      var codes = (window.SITE && window.SITE.codes) || {};
      var found = 0;
      if (/^\d+$/.test(typed)) {
        Object.keys(codes).forEach(function (day) {
          if (String(codes[day]) === typed) found = parseInt(day, 10);
        });
      }
      if (!(found >= 1 && found <= 4)) {
        if (status) status.textContent = "Код не подошёл.";
        return;
      }
      apply(found);
    });
  }

  function initPrompts() {
    document.querySelectorAll(".copy-prompt").forEach(function (button) {
      var original = "Скопировать запрос";
      button.addEventListener("click", function () {
        var id = button.getAttribute("data-prompt-id");
        var record = window.COURSE_PROMPTS && window.COURSE_PROMPTS[id];
        var status = document.getElementById("status-" + id);
        var node = document.getElementById("text-" + id);
        function ok() {
          button.textContent = "Скопировано!";
          button.classList.add("is-copied");
          if (status) status.textContent = "";
          window.setTimeout(function () {
            button.textContent = original;
            button.classList.remove("is-copied");
          }, 2000);
        }
        function fail() {
          if (node) {
            var range = document.createRange();
            range.selectNodeContents(node);
            var selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
          }
          button.textContent = original;
          button.classList.remove("is-copied");
          if (status) status.textContent = "Не удалось скопировать. Выделите текст запроса и скопируйте его вручную.";
        }
        if (!record || typeof record.promptText !== "string") {
          fail();
          return;
        }
        var text = record.promptText;
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
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(ok, fallback);
        } else {
          fallback();
        }
      });
    });
  }

  function initTasks() {
    var key = "aikurs-tasks-v1";
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch (e) { saved = {}; }
    document.querySelectorAll(".task-done").forEach(function (button) {
      var id = button.getAttribute("data-task-id");
      var stateNode = button.parentNode.querySelector(".task-state");
      function paint() {
        if (!saved[id]) return;
        button.textContent = "Отмечено";
        if (stateNode) stateNode.textContent = "Вы отметили задание сами. Это не проверка компьютера.";
      }
      paint();
      button.addEventListener("click", function () {
        saved[id] = true;
        try { localStorage.setItem(key, JSON.stringify(saved)); } catch (e) {}
        paint();
      });
    });
  }

  function initFilters() {
    document.querySelectorAll(".filter").forEach(function (button) {
      button.addEventListener("click", function () {
        var topic = button.getAttribute("data-filter");
        document.querySelectorAll(".prompt-card").forEach(function (card) {
          card.hidden = Boolean(topic) && card.getAttribute("data-topic") !== topic;
        });
      });
    });
  }

  draw();
})();
