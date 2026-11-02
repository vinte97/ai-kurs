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
    return { os: "", chip: "", mode: "detailed", done: {}, unknown: false };
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

  function field(title, text) {
    var wrap = el("div");
    wrap.appendChild(el("dt", "", title));
    wrap.appendChild(el("dd", "", text));
    return wrap;
  }

  function stageName(step) {
    return step.group === "chip" ? "workai" : step.group;
  }

  function stageList() {
    var seen = [];
    steps().forEach(function (item) {
      var name = stageName(item);
      if (seen.indexOf(name) < 0) seen.push(name);
    });
    return seen;
  }

  function actionLink(step) {
    if (!step.action) return null;
    var link = el("a", "btn", step.action.label);
    link.href = step.action.href;
    link.target = "_blank";
    link.rel = "noopener";
    return link;
  }

  function helpBox(step) {
    var box = el("div", "help");
    box.appendChild(el("p", "", "Что сделать, если не получилось"));
    var list = document.createElement("ol");
    step.help.forEach(function (line) {
      list.appendChild(el("li", "", line));
    });
    box.appendChild(list);
    return box;
  }

  function markDone(step) {
    state.done[step.id] = true;
    save();
    draw();
  }

  function renderStep(step, position, total, compact) {
    var card = el("article", "card");
    var stage = stageList().indexOf(stageName(step)) + 1;
    card.appendChild(el("h2", "", "Шаг " + stage + " из " + stageList().length + ". " + step.title));
    if (step.why) card.appendChild(el("p", "", step.why));
    var list = document.createElement("dl");
    list.appendChild(field("Что сделать", step.do));
    list.appendChild(field("Где нажать", step.where));
    list.appendChild(field("Что вы увидите", step.see));
    list.appendChild(field("Как проверить", step.check));
    card.appendChild(list);
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
      card.appendChild(back);
      var yes = el("button", "btn", "Получилось, дальше");
      yes.type = "button";
      if (!step.choice) {
        yes.addEventListener("click", function () { markDone(step); });
        card.appendChild(yes);
      }
      var no = el("button", "btn secondary", "Нужна помощь");
      no.type = "button";
      var opened = false;
      no.addEventListener("click", function () {
        if (opened) return;
        opened = true;
        card.appendChild(helpBox(step));
      });
      card.appendChild(no);
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
        card.appendChild(skip);
      }
    } else {
      var details = document.createElement("details");
      details.appendChild(el("summary", "", "Если не получилось"));
      details.appendChild(helpBox(step));
      card.appendChild(details);
    }
    return card;
  }

  function modeSwitch() {
    var bar = el("p");
    var detailed = el("button", state.mode === "detailed" ? "btn" : "btn secondary", "По шагам");
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
      save();
      draw();
    });
    bar.appendChild(detailed);
    bar.appendChild(brief);
    bar.appendChild(change);
    return bar;
  }

  function osScreen() {
    root.appendChild(el("h1", "", "Какой у вас компьютер?"));
    root.appendChild(el("p", "lead", "После выбора останется только ваша инструкция."));
    var windows = el("button", "btn", "Windows — например, Lenovo, ASUS, HP или Acer");
    var mac = el("button", "btn", "Mac — компьютер Apple");
    var unknown = el("button", "btn secondary", "Не знаю — помогите определить");
    [windows, mac, unknown].forEach(function (button) { button.type = "button"; });
    windows.addEventListener("click", function () { state.os = "windows"; state.unknown = false; save(); draw(); });
    mac.addEventListener("click", function () { state.os = "mac"; state.unknown = false; save(); draw(); });
    unknown.addEventListener("click", function () { state.unknown = true; save(); draw(); });
    root.appendChild(windows);
    root.appendChild(mac);
    root.appendChild(unknown);
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
    windows.addEventListener("click", function () { state.os = "windows"; state.unknown = false; save(); draw(); });
    mac.addEventListener("click", function () { state.os = "mac"; state.unknown = false; save(); draw(); });
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
    var again = el("button", "btn secondary", "Пройти подготовку ещё раз");
    again.type = "button";
    again.addEventListener("click", function () {
      var mode = state.mode;
      state = fresh();
      state.mode = mode;
      save();
      draw();
    });
    root.appendChild(again);
  }

  function drawBrief(list) {
    root.appendChild(el("h1", "", "Все действия на одной странице"));
    root.appendChild(el("p", "", "Здесь те же действия, что и в режиме «По шагам». После каждого спросите себя: у вас получилось?"));
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

  function draw() {
    root.textContent = "";
    if (state.unknown && !state.os) {
      unknownScreen();
      return;
    }
    if (!state.os) {
      osScreen();
      return;
    }
    var list = steps();
    var step = current();
    root.appendChild(modeSwitch());
    if (!step) {
      doneScreen();
      return;
    }
    if (state.mode === "brief") {
      drawBrief(list);
      return;
    }
    var position = indexOf(step.id) + 1;
    var previous = list[position - 2];
    if (previous && previous.praise && state.done[previous.id] === true) {
      root.appendChild(el("p", "ok", previous.praise));
    }
    root.appendChild(renderStep(step, position, list.length, false));
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
    }
    var current = parseInt(document.documentElement.getAttribute("data-open") || "0", 10);
    if (current >= 1 && current <= 4) {
      var link = document.getElementById("continue-link");
      if (link) link.setAttribute("href", "day" + current + ".html");
    }
    opener.addEventListener("click", function () {
      form.hidden = false;
      opener.setAttribute("aria-expanded", "true");
      input.focus();
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
