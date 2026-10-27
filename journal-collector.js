/* Сбор занятий из журнала записи YClients.
   Работает только на чтение. Основной способ — «в фоне»: нужный день журнала открывается в невидимом встроенном окне
   по ссылке с датой (#main_date=…), карточки читаются оттуда; ваш экран не меняется.
   Запасной способ — листать журнал на экране стрелками «‹ ›», как это делает человек.
   Ничего не нажимает внутри занятий, ничего не создаёт, не меняет и не удаляет. Имена и телефоны клиентов не собираются.
   Этот файл встраивается в закладку приложением index.html (адрес приложения подставляется вместо __APP_URL__). */
(() => {
 try {
  if (window.__ycx && window.__ycx.panel) {
    const old = window.__ycx.panel;
    if (!document.documentElement.contains(old)) document.body.appendChild(old);
    old.style.display = "block"; return;
  }
  const APP = window.__ycxApp || "__APP_URL__";   /* адрес приложения: задаёт короткая закладка или подставляет приложение */
  const APP_ORIGIN = new URL(APP).origin;
  const VERSION = "4";
  const TR = /(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/;
  const GRP = /^\(\s*(\d+)\s*\/\s*(\d+)\s*\)\s*(.*)$/;
  const PHONE = /^\+?\d[\d\s()\-]{8,}$/;
  const NAME = /^[А-ЯЁA-Z][а-яёa-z'-]+(\s+[А-ЯЁA-Z][а-яёa-z'-]+){1,2}$/;
  const MON = ["январ", "феврал", "март", "апрел", "ма", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"];
  const DATE_RE = /(\d{1,2})\s+(январ|феврал|март|апрел|ма|июн|июл|август|сентябр|октябр|ноябр|декабр)[а-яё]*,?\s*(понедельник|вторник|сред|четверг|пятниц|суббот|воскресень)/i;
  const pad = n => String(n).padStart(2, "0");
  const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const dkey = d => d ? iso(d) : "";
  const ru = d => d.toLocaleDateString("ru-RU");
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const st = {stop: false, busy: false, payload: null};
  const companyId = (location.pathname.match(/timetable\/(\d+)/) || [])[1] || "";

  /* ---------- панель ---------- */
  const panel = document.createElement("div");
  panel.id = "ycx-panel";
  panel.setAttribute("style", "position:fixed;top:12px;right:12px;z-index:2147483647;box-sizing:border-box;width:330px;max-width:calc(100vw - 24px);background:#fff;color:#1d1b19;border:1px solid #e7e2dc;border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.18);padding:14px;font:14px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif");
  const btn = (a, label, main) => `<button data-a="${a}" style="${main ? "border:0;background:" + main + ";color:#fff;font-weight:600" : "border:1px solid #e7e2dc;background:#fff;color:#1d1b19"};border-radius:10px;padding:8px;cursor:pointer;font:inherit">${label}</button>`;
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="font-size:15px">Сбор занятий из журнала</b>
      <button data-a="close" style="border:0;background:none;font-size:20px;cursor:pointer;color:#6f6962">×</button></div>
    <div style="color:#6f6962;font-size:12px;margin-bottom:10px">Только чтение: в журнале ничего не меняется. Дни открываются в фоне, ваш экран остаётся как есть. Не сворачивайте вкладку, пока идёт сбор.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <label style="font-size:12px;color:#6f6962">С<input data-f="from" type="date" style="display:block;box-sizing:border-box;width:100%;padding:6px;border:1px solid #e7e2dc;border-radius:8px;font:inherit"></label>
      <label style="font-size:12px;color:#6f6962">По<input data-f="to" type="date" style="display:block;box-sizing:border-box;width:100%;padding:6px;border:1px solid #e7e2dc;border-radius:8px;font:inherit"></label>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0">
      ${[["lw", "Прошлая неделя"], ["w", "Эта неделя"], ["lm", "Прошлый месяц"], ["m", "Этот месяц"]].map(([k, t]) => `<button data-p="${k}" style="border:1px solid #e7e2dc;background:#faf8f5;border-radius:99px;padding:3px 9px;font:12px inherit;cursor:pointer">${t}</button>`).join("")}
    </div>
    <div style="display:flex;gap:8px">
      <button data-a="go" style="flex:1;border:0;background:#d9573b;color:#fff;border-radius:10px;padding:9px;font-weight:600;cursor:pointer">Собрать</button>
      <button data-a="stop" style="display:none;flex:1;border:1px solid #e7e2dc;background:#fff;border-radius:10px;padding:9px;cursor:pointer">Остановить</button>
    </div>
    <div data-f="msg" style="margin-top:10px;font-size:13px;white-space:pre-line"></div>
    <div data-f="out" style="display:none;margin-top:10px;gap:6px;flex-direction:column">
      ${btn("open", "Открыть в приложении", "#2f7d4f")}${btn("file", "Скачать файл (.json)")}${btn("copy", "Скопировать данные")}
    </div>
    <div style="margin-top:10px;text-align:right"><button data-a="diag" style="border:0;background:none;color:#6f6962;font-size:12px;text-decoration:underline;cursor:pointer">Отчёт для разработчика</button></div>`;
  document.body.appendChild(panel);
  const $ = s => panel.querySelector(s);
  const say = t => { $('[data-f="msg"]').textContent = t; };
  const inPanel = el => !!el && panel.contains(el);

  const preset = k => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const add = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    const mon = d => add(d, -((d.getDay() + 6) % 7));
    let a, b;
    if (k === "w") { a = mon(t); b = add(a, 6); }
    if (k === "lw") { a = add(mon(t), -7); b = add(a, 6); }
    if (k === "m") { a = new Date(t.getFullYear(), t.getMonth(), 1); b = new Date(t.getFullYear(), t.getMonth() + 1, 0); }
    if (k === "lm") { a = new Date(t.getFullYear(), t.getMonth() - 1, 1); b = new Date(t.getFullYear(), t.getMonth(), 0); }
    $('[data-f="from"]').value = iso(a); $('[data-f="to"]').value = iso(b);
  };
  preset("lw");
  panel.querySelectorAll("[data-p]").forEach(b => b.onclick = () => preset(b.dataset.p));

  /* ---------- чтение страницы (doc — сама страница или встроенное окно) ---------- */
  function hashDate(h) { const m = (h || "").match(/main_date=(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function screenDate(doc, hint) {
    for (const el of doc.querySelectorAll("body *")) {
      if (el.children.length > 5 || inPanel(el)) continue;
      const tc = el.textContent || "";
      if (tc.length > 60 || !/\d/.test(tc)) continue;
      const m = (el.innerText || tc).replace(/\s+/g, " ").match(DATE_RE);
      if (!m) continue;
      const mi = MON.findIndex(x => m[2].toLowerCase().startsWith(x));
      const base = hint || new Date();
      let d = new Date(base.getFullYear(), mi, +m[1]);
      if (Math.abs(d - base) > 180 * 864e5) d = new Date(base.getFullYear() + (d < base ? 1 : -1), mi, +m[1]);
      return d;
    }
    return null;
  }
  function companyTitle() {
    const bad = /^(сотрудники|клиенты|финансы|расчет зарплат|расчёт зарплат|лояльность|продвижение|интеграции|сервисы|личный кабинет|центр помощи|новое|vip|сегодня|журнал записи)$/i;
    for (const el of document.querySelectorAll("body *")) {
      if (el.children.length || inPanel(el)) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || r.left > 320 || r.top > 300) continue;
      const t = (el.textContent || "").trim();
      if (t.length >= 5 && t.length <= 80 && /[A-Za-zА-Яа-яЁё]{3}/.test(t) && !bad.test(t) && !MON.some(m => t.toLowerCase().startsWith(m)) && !/\d{4}/.test(t)) return t;
    }
    return "";
  }
  function cards(doc) {
    const heads = [];
    const w = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const n = w.currentNode, p = n.parentElement;
      if (!p || inPanel(p) || !TR.test(n.nodeValue)) continue;
      const r = p.getBoundingClientRect();
      if (r.width && r.height) heads.push(p);
    }
    const count = el => heads.reduce((c, h) => c + (el.contains(h) ? 1 : 0), 0);
    const out = new Set();
    for (const h of heads) {
      let el = h;
      while (el.parentElement && el.parentElement !== doc.body && count(el.parentElement) === 1) el = el.parentElement;
      out.add(el);
    }
    return [...out];
  }
  const sig = doc => cards(doc).map(c => c.innerText.replace(/\s+/g, " ").slice(0, 80)).join("¦");
  function parse(card, date) {
    const lines = card.innerText.split("\n").map(s => s.trim()).filter(Boolean);
    const ti = lines.findIndex(l => TR.test(l));
    if (ti < 0) return null;
    const tm = lines[ti].match(TR);
    const rest = lines.slice(ti + 1).filter(l => !TR.test(l) && !/^до\s+\d/i.test(l));
    const r = card.getBoundingClientRect();
    const ev = {date, start: pad(tm[1]) + ":" + tm[2], end: pad(tm[3]) + ":" + tm[4], col: Math.round((r.left + r.width / 2) / 20)};
    const gi = rest.findIndex(l => GRP.test(l));
    if (gi >= 0) {
      const g = rest[gi].match(GRP);
      let title = g[3].trim(), next = gi + 1;
      if (!title && rest[next]) title = rest[next++];
      return {...ev, kind: "group", signed: +g[1], capacity: +g[2], title: title || "Без названия",
        master: rest.slice(next).find(l => NAME.test(l)) || ""};
    }
    const pi = rest.findIndex(l => PHONE.test(l));
    const after = pi >= 0 ? rest.slice(pi + 1) : rest.slice(1);
    const service = after.find(l => !NAME.test(l) && !PHONE.test(l)) || "Индивидуальная запись";
    const master = after.slice(after.indexOf(service) + 1).find(l => NAME.test(l)) || "";
    return {...ev, kind: "single", title: service, master};   /* клиент и телефон не сохраняются */
  }

  /* ---------- сбор результатов ---------- */
  let events = [], seen = new Set(), empty = [], problems = [];
  function collect(doc, date) {
    let n = 0;
    for (const c of cards(doc)) {
      const e = parse(c, iso(date));
      if (!e) continue;
      n++;
      const key = [e.date, e.start, e.title, e.master, e.master ? "" : e.col].join("|");   /* колонка — только для карточек без мастера */
      if (!seen.has(key)) { seen.add(key); events.push(e); }
    }
    if (!n) empty.push(ru(date).slice(0, 5));
    return n;
  }

  /* ---------- способ 1: в фоне, через встроенное окно ---------- */
  function frameLoaded(fr, ms) {
    return new Promise(res => {
      const t = setTimeout(() => res(false), ms);
      fr.addEventListener("load", () => { clearTimeout(t); res(true); }, {once: true});
    });
  }
  async function openInFrame(fr, date) {
    const h = new URLSearchParams(location.hash.replace(/^#/, ""));
    h.set("main_date", iso(date));
    let p = frameLoaded(fr, 3000); fr.src = "about:blank"; await p;          /* полная перезагрузка, а не только смена #… */
    p = frameLoaded(fr, 40000); fr.src = location.pathname + location.search + "#" + h.toString();
    return p;
  }
  async function waitFrameDay(fr, date) {
    const t0 = Date.now();
    let last = null, stableSince = Date.now(), res = -1, resSince = Date.now(), dateOk = false;
    while (Date.now() - t0 < 30000 && !st.stop) {
      await sleep(300);
      let doc;
      try { doc = fr.contentDocument; } catch (e) { return {ok: false, why: "нет доступа к встроенному окну"}; }
      if (!doc || !doc.body) continue;
      const sd = screenDate(doc, date);
      dateOk = !!sd && dkey(sd) === iso(date);
      if (sd && !dateOk && Date.now() - t0 > 10000) return {ok: false, why: "во встроенном окне не открылась нужная дата"};
      const cur = sig(doc);
      if (cur !== last) { last = cur; stableSince = Date.now(); }
      let rc = 0;
      try { rc = fr.contentWindow.performance.getEntriesByType("resource").length; } catch (e) {}
      if (rc !== res) { res = rc; resSince = Date.now(); }
      const quiet = Date.now() - resSince > 1200;
      const settled = Date.now() - stableSince > (cur ? 1200 : 3000);
      if (dateOk && quiet && settled && Date.now() - t0 > 2000) return {ok: true, doc};
    }
    return {ok: false, why: dateOk ? "день не догрузился" : "во встроенном окне не открылась нужная дата"};
  }
  async function frameMode(dates) {
    const fr = document.createElement("iframe");
    fr.setAttribute("aria-hidden", "true");
    fr.setAttribute("style", `position:fixed;left:0;top:0;width:${Math.max(innerWidth, 1280)}px;height:${Math.max(innerHeight, 900)}px;opacity:0;pointer-events:none;z-index:-1;border:0`);
    document.body.appendChild(fr);
    try {
      for (let i = 0; i < dates.length && !st.stop; i++) {
        const d = dates[i];
        say(`В фоне: день ${i + 1} из ${dates.length} — ${ru(d)}…\nСобрано занятий: ${events.length}`);
        const loaded = await openInFrame(fr, d);
        if (!loaded) { if (i < 2) return {ok: false, why: "журнал не открывается во встроенном окне"}; problems.push("не загрузился " + ru(d)); continue; }
        const r = await waitFrameDay(fr, d);
        if (!r.ok) { if (i < 2) return {ok: false, why: r.why}; problems.push(r.why + " — " + ru(d)); continue; }
        collect(r.doc, d);
      }
      return {ok: true};
    } finally { fr.remove(); }
  }

  /* ---------- способ 2: листать журнал на экране стрелками ---------- */
  const net = window.__ycxNet || (window.__ycxNet = {pending: 0, last: Date.now()});
  if (!net.hooked) {   /* только считаем незавершённые запросы страницы, сами запросы не меняются */
    net.hooked = true;
    const of = window.fetch;
    if (of) window.fetch = function () {
      net.pending++; net.last = Date.now();
      return of.apply(this, arguments).finally(() => { net.pending = Math.max(0, net.pending - 1); net.last = Date.now(); });
    };
    const os = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function () {
      net.pending++; net.last = Date.now();
      this.addEventListener("loadend", () => { net.pending = Math.max(0, net.pending - 1); net.last = Date.now(); }, {once: true});
      return os.apply(this, arguments);
    };
  }
  const curDate = () => screenDate(document, hashDate(location.hash) || new Date()) || hashDate(location.hash);
  function findToday() {
    const els = [...document.querySelectorAll("body *")].filter(el => !inPanel(el) && /^\s*сегодня\s*$/i.test(el.textContent || ""));
    const leaves = els.filter(el => ![...el.children].some(c => /^\s*сегодня\s*$/i.test(c.textContent || "")))
      .filter(el => { const r = el.getBoundingClientRect(); return r.width && r.height; });
    if (!leaves.length) return null;
    return leaves[0].closest("button, a, [role=button]") || leaves[0];
  }
  /* стрелки ищем по расположению: первые два небольших элемента справа (или слева) от «Сегодня» на той же высоте */
  function navButtons() {
    const today = findToday();
    if (!today) return null;
    const tr = today.getBoundingClientRect(), y = tr.top + tr.height / 2;
    const prevPE = panel.style.pointerEvents; panel.style.pointerEvents = "none";
    const scan = (from, to, step) => {
      let boxes = [];
      for (let x = from; step > 0 ? x < to : x > to; x += step) {
        const hit = document.elementFromPoint(x, y);
        if (!hit || inPanel(hit) || hit.contains(today) || today.contains(hit)) continue;
        /* кнопка = ближайший button/a/role=button, иначе сам элемент под точкой */
        const el = hit.closest("button, a, [role=button]") || hit;
        if (el.contains(today)) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 80 || r.height > 80 || r.width < 6 || (el.textContent || "").trim().length > 3) {
          if (boxes.length) break;          /* дошли до чего-то крупного (например, даты) — дальше не ищем */
          continue;
        }
        /* части одной кнопки (иконка внутри кнопки) объединяем, предпочитая меньший элемент */
        const i = boxes.findIndex(bx => bx.contains(el) || el.contains(bx));
        if (i >= 0) { if (boxes[i].contains(el)) boxes[i] = el; continue; }
        boxes.push(el);
        if (boxes.length === 3) break;
      }
      return boxes.slice(0, 2);
    };
    try {
      let b = scan(tr.right + 1, tr.right + 260, 3);
      if (b.length < 2) { const l = scan(tr.left - 1, tr.left - 260, -3); if (l.length === 2) b = [l[1], l[0]]; }
      return b.length === 2 ? {prev: b[0], next: b[1], today} : {today};
    } finally { panel.style.pointerEvents = prevPE; }
  }
  function pressHard(el) {
    for (const t of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      const C = t.startsWith("pointer") && window.PointerEvent ? PointerEvent : MouseEvent;
      el.dispatchEvent(new C(t, {bubbles: true, cancelable: true, view: window}));
    }
  }
  async function pressNav(el) {   /* нажать стрелку и дождаться, что на экране сменился день */
    const before = dkey(curDate());
    for (const press of [x => x.click(), pressHard]) {
      press(el);
      for (let i = 0; i < 40; i++) { await sleep(150); const c = curDate(); if (c && dkey(c) !== before) return c; }
    }
    return null;
  }
  async function waitDay(prevSig) {   /* ждём: нет активных запросов, карточки перестали меняться и сменили прошлый день */
    const t0 = Date.now();
    let last = null, stableSince = Date.now();
    while (Date.now() - t0 < 20000 && !st.stop) {
      await sleep(250);
      const cur = sig(document), el = Date.now() - t0;
      if (cur !== last) { last = cur; stableSince = Date.now(); }
      const quiet = net.pending === 0 && Date.now() - net.last > 700;
      const stable = Date.now() - stableSince > 1000;
      const changed = prevSig === null || cur !== prevSig || el > 7000;
      const loaded = cur.length > 0 || el > 5000;
      if (el > 1500 && quiet && stable && changed && loaded) return;
    }
  }
  async function arrowMode(dates) {
    const nb = navButtons();
    if (!nb || !nb.next) return {ok: false, why: nb ? "не нашёл стрелки рядом с «Сегодня»" : "не нашёл кнопку «Сегодня»"};
    if (!curDate()) return {ok: false, why: "не вижу дату журнала на экране"};
    const from = dates[0], to = dates[dates.length - 1];
    let steps = 0, swapped = false;
    while (dkey(curDate()) !== iso(from) && !st.stop) {
      if (++steps > 400) return {ok: false, why: "не удалось дойти до начала периода"};
      const c = curDate(), forward = c < from, b = forward ? nb.next : nb.prev;
      say(`Листаю к началу периода: ${ru(c)}…`);
      const n = await pressNav(b);
      if (!n) return {ok: false, why: "журнал не переключает день по стрелке"};
      if (!swapped && (forward ? n < c : n > c)) { swapped = true; [nb.prev, nb.next] = [nb.next, nb.prev]; }
    }
    let prevSig = null;
    for (let i = 0; i < dates.length && !st.stop; i++) {
      if (i > 0) {
        const n = await pressNav(nb.next);
        if (!n) { problems.push("не открылся " + ru(dates[i])); break; }
        if (n > to) break;
      }
      const shown = curDate() || dates[i];
      say(`На экране: день ${i + 1} из ${dates.length} — ${ru(shown)}…\nСобрано занятий: ${events.length}`);
      await waitDay(prevSig);
      prevSig = sig(document);
      collect(document, shown);
    }
    return {ok: true};
  }

  /* ---------- запуск ---------- */
  async function run() {
    const from = new Date($('[data-f="from"]').value + "T00:00"), to = new Date($('[data-f="to"]').value + "T00:00");
    if (isNaN(from) || isNaN(to) || from > to) return say("Проверьте даты периода.");
    const n = Math.round((to - from) / 864e5) + 1;
    if (n > 93) return say("Не больше 3 месяцев за раз.");
    const dates = [...Array(n)].map((_, i) => { const d = new Date(from); d.setDate(d.getDate() + i); return d; });
    st.stop = false; st.busy = true; events = []; seen = new Set(); empty = []; problems = [];
    $('[data-a="go"]').style.display = "none"; $('[data-a="stop"]').style.display = "block"; $('[data-f="out"]').style.display = "none";
    const notes = [];
    try {
      say("Открываю журнал в фоне…");
      let r = await frameMode(dates);
      if (!r.ok && !st.stop) {
        notes.push("В фоне не получилось (" + r.why + "), листал журнал на экране.");
        events = []; seen = new Set(); empty = []; problems = [];
        r = await arrowMode(dates);
        if (!r.ok) problems.push(r.why);
      }
    } catch (err) {
      problems.push("ошибка: " + (err && err.message ? err.message : err));
    } finally {
      st.busy = false; $('[data-a="go"]').style.display = "block"; $('[data-a="stop"]').style.display = "none";
    }
    const groups = events.filter(e => e.kind === "group").length;
    st.payload = {source: "yclients-journal", v: 1, company: {id: companyId, title: companyTitle() || ("Филиал " + companyId)},
      from: iso(from), to: iso(to), collectedAt: new Date().toISOString(), events};
    say(`${st.stop ? "Остановлено. " : "Готово. "}Занятий: ${events.length} (групповых: ${groups}).` +
        (notes.length ? "\n" + notes.join("\n") : "") +
        (problems.length ? `\nПроблемы: ${problems.join("; ")}` : "") +
        (empty.length && events.length ? `\nДни без занятий: ${empty.join(", ")}` : "") +
        (!events.length ? "\nЗанятия не найдены. Нажмите «Отчёт для разработчика» и пришлите текст." : ""));
    st.appLink = null;
    if (events.length) {
      try { st.appLink = APP + "?v=" + Date.now() + "#jd=" + await packPayload(st.payload); } catch (e) { st.appLink = null; }   /* ?v= — всегда свежая версия приложения, не из кэша */
      $('[data-f="out"]').style.display = "flex";
    }
  }

  /* ---------- отчёт для разработчика: служебная разметка панели с датой и стрелками (без данных клиентов) ---------- */
  function diag() {
    const clean = html => html.replace(/\+?\d[\d\s()\-]{9,}/g, "[тел]").replace(/\s(style|d|class)="[^"]{120,}"/g, "").slice(0, 3500);
    const today = findToday();
    /* поднимаемся от «Сегодня» только пока это панель кнопок: без карточек занятий и длинных текстов */
    let bar = today;
    for (let i = 0; bar && i < 4 && bar.parentElement; i++) {
      const p = bar.parentElement, t = p.innerText || "";
      if (t.length > 300 || TR.test(t) || p === document.body) break;
      bar = p;
    }
    if (bar) {   /* копия без персональных данных: телефоны и имена заменяются */
      bar = bar.cloneNode(true);
      const w = document.createTreeWalker(bar, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) { const n = w.currentNode; n.nodeValue = n.nodeValue.replace(/\+?\d[\d\s()\-]{6,}\d/g, "[тел]").replace(/[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+/g, "[имя]"); }
    }
    const nb = navButtons();
    const c = cards(document)[0];
    const info = [
      "ycx v" + VERSION, location.pathname + location.hash, "UA: " + navigator.userAgent,
      "today: " + (today ? today.tagName + "." + today.className : "нет"),
      "arrows: " + (nb && nb.next ? nb.prev.tagName + " / " + nb.next.tagName : "нет"),
      "screenDate: " + dkey(screenDate(document, new Date())), "cards: " + cards(document).length,
      "frame: " + (window.top === window ? "top" : "in-frame"),
      "--- toolbar ---", bar ? clean(bar.outerHTML) : "",
      "--- first card text ---", c ? c.innerText.split("\n").map(l => PHONE.test(l.trim()) ? "[тел]" : (NAME.test(l.trim()) ? "[имя]" : l)).join(" | ").slice(0, 300) : "",
    ].join("\n");
    navigator.clipboard.writeText(info).then(() => say("Отчёт скопирован — вставьте его в чат с разработчиком."), () => { prompt("Скопируйте отчёт:", info); });
  }

  /* ---------- передача в приложение ---------- */
  /* Данные кладутся в ссылку на приложение после «#» (эта часть ссылки не отправляется ни на какой сервер), сжатыми gzip. */
  async function packPayload(p) {
    let bytes = new TextEncoder().encode(JSON.stringify(p)), tag = "j";
    if (window.CompressionStream) {
      try { bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer()); tag = "z"; } catch (e) {}
    }
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return tag + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function openApp() {
    if (st.appLink && st.appLink.length < 1500000) {
      const tab = window.open(st.appLink, "_blank");
      if (!tab) return say("Браузер заблокировал новую вкладку. Разрешите всплывающие окна для этого сайта или нажмите «Скачать файл».");
      return say("Приложение открыто в новой вкладке. Если данных там нет — нажмите «Скачать файл» и выберите его в приложении.");
    }
    const w = window.open(APP + "#journal", "_blank");
    if (!w) return say("Браузер заблокировал новое окно. Разрешите всплывающие окна для этого сайта или скачайте файл.");
    let sent = false;
    const onMsg = e => {
      if (e.origin !== APP_ORIGIN || !e.data || e.data.type !== "ycx-ready") return;
      w.postMessage({type: "ycx-journal", payload: st.payload}, APP_ORIGIN);
      if (e.data.got) { sent = true; window.removeEventListener("message", onMsg); say("Данные переданы в приложение."); }
    };
    window.addEventListener("message", onMsg);
    setTimeout(() => { if (!sent) say("Не получилось передать данные в окно приложения. Нажмите «Скачать файл» и выберите его в приложении."); }, 15000);
  }
  function saveFile() {
    const blob = new Blob([JSON.stringify(st.payload)], {type: "application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `yclients-zhurnal-${companyId}-${st.payload.from}_${st.payload.to}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    say("Файл сохранён. Откройте приложение → «Из журнала» → «Выбрать файл сборщика».");
  }
  async function copy() {
    try { await navigator.clipboard.writeText(JSON.stringify(st.payload)); say("Скопировано. В приложении нажмите «Вставить из буфера»."); }
    catch (e) { say("Не удалось скопировать — используйте «Скачать файл»."); }
  }
  panel.addEventListener("click", e => {
    const a = e.target.closest("[data-a]"); if (!a) return;
    const act = a.dataset.a;
    if (act === "close") { if (st.busy) st.stop = true; panel.style.display = "none"; }
    if (act === "go" && !st.busy) run();
    if (act === "stop") st.stop = true;
    if (act === "open") openApp();
    if (act === "file") saveFile();
    if (act === "copy") copy();
    if (act === "diag") diag();
  });
  /* для программы «Автосбор»: запустить сбор за период и получить результат */
  window.__ycx = {panel, status: () => $('[data-f="msg"]').textContent,
    collect: async (f, t) => { $('[data-f="from"]').value = f; $('[data-f="to"]').value = t; if (!st.busy) await run(); return st.payload; }};
  /* если страница перерисуется и уберёт окно сборщика — вернуть его */
  setInterval(() => { if (panel.style.display !== "none" && !document.documentElement.contains(panel)) document.body.appendChild(panel); }, 1000);
 } catch (err) {
  alert("Сборщик YClients: ошибка — " + (err && err.message ? err.message : err) + "\nПришлите этот текст разработчику.");
 }
})();
