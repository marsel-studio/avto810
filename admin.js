/* Админка: заявки, календарь, редактор контента, уведомления, настройки. */
(function () {
  'use strict';
  const A = window.A810;
  const CH = { telegram: 'Telegram', email: 'Почта', vk: 'ВКонтакте', sheets: 'Таблица' };
  const ST = { new: 'Новая', accepted: 'Принята', done: 'Выполнена', canceled: 'Отменена' };
  const clone = o => JSON.parse(JSON.stringify(o));

  function h(tag, attrs) {
    const el = document.createElement(tag); let pending;
    if (attrs) for (const k in attrs) {
      const v = attrs[k]; if (v == null || v === false) continue;
      if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'value') pending = v; else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) { const c = arguments[i]; [].concat(c).forEach(x => { if (x == null || x === false) return; el.append(x.nodeType ? x : document.createTextNode(String(x))); }); }
    if (pending !== undefined) el.value = pending;
    return el;
  }

  let root, S, tab = 'leads', filter = 'all', view = 'list', cal = new Date(), calDay = null;
  let draft, nDraft, dirtyC = false, dirtyN = false, body, tabsEl, bar, timer;

  function toast(msg, bad) {
    const t = h('div', { class: 'adm-toast' + (bad ? ' bad' : ''), role: 'status' }, msg); root.append(t);
    setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3100);
  }
  const fmt = iso => { try { return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; } };
  async function guard(fn) { try { return await fn(); } catch (e) { if (e.status === 401) { loginView(); } else if (e.mustChange) { tab = 'settings'; S.mustChange = true; render(); toast(e.message, true); } else toast(e.message, true); } }

  window.mountAdmin = function (r) { root = r; start(); };

  async function start() {
    root.replaceChildren(h('div', { class: 'adm-boot' }, 'Загрузка…'));
    try {
      S = await A.state(); draft = clone(S.content); nDraft = clone(S.notify); dirtyC = dirtyN = false;
      if (S.mustChange) tab = 'settings';
      render(); clearInterval(timer);
      timer = setInterval(poll, 30000);
    } catch (e) { if (e.status === 401) loginView(); else root.replaceChildren(h('div', { class: 'adm-boot' }, e.message)); }
  }
  async function poll() {
    if (!root || root.hidden || tab !== 'leads') return;
    const a = document.activeElement; if (a && root.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
    try { const s = await A.state(); S.leads = s.leads; renderBody(); renderTabs(); } catch (e) {}
  }

  /* ---------- вход ---------- */
  function loginView() {
    clearInterval(timer);
    const err = h('p', { class: 'adm-err', role: 'alert' });
    const pw = h('input', { id: 'adm-pw', type: 'password', autocomplete: 'current-password', placeholder: 'Пароль', required: true });
    const form = h('form', { class: 'adm-login', onsubmit: async e => {
      e.preventDefault(); err.textContent = '';
      try { const r = await A.login(pw.value); if (r.mustChange) tab = 'settings'; await start(); } catch (x) { err.textContent = x.message; }
    } },
    h('h1', null, 'Вход в админку'), h('label', { for: 'adm-pw' }, 'Пароль'), pw, err,
    h('button', { class: 'adm-btn primary', type: 'submit' }, 'Войти'),
    A.mode === 'demo' ? h('p', { class: 'adm-hint' }, 'Демо-режим: пароль admin810. Данные хранятся только в этом браузере, уведомления не отправляются.') : null,
    h('a', { class: 'adm-hint', href: window.Site ? Site.homeHref() : '/' }, '← На сайт'));
    root.replaceChildren(h('div', { class: 'adm-center' }, form)); pw.focus();
  }

  /* ---------- каркас ---------- */
  function render() {
    tabsEl = h('nav', { class: 'adm-tabs', role: 'tablist' }); body = h('div', { class: 'adm-body' }); bar = h('div', { class: 'adm-bar' });
    root.replaceChildren(
      h('header', { class: 'adm-top' }, h('div', { class: 'adm-wrap' },
        h('strong', null, 'Админка'), h('span', { class: 'adm-sub' }, S.content.brand.name), h('span', { class: 'sp' }),
        h('a', { class: 'adm-link', href: window.Site ? Site.homeHref() : '/' }, 'Сайт'),
        h('button', { class: 'adm-link', type: 'button', onclick: async () => { await A.logout(); loginView(); } }, 'Выйти'))),
      h('div', { class: 'adm-wrap' }, tabsEl, body), bar);
    renderTabs(); renderBody();
  }
  function renderTabs() {
    const n = S.leads.filter(l => l.status === 'new').length;
    const defs = [['leads', 'Заявки', n], ['content', 'Контент'], ['notify', 'Уведомления'], ['settings', 'Настройки']];
    tabsEl.replaceChildren(...defs.map(([id, name, badge]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(tab === id), class: 'adm-tab' + (tab === id ? ' on' : ''), disabled: S.mustChange && id !== 'settings', onclick: () => { tab = id; renderTabs(); renderBody(); } }, name, badge ? h('i', null, badge) : null)));
  }
  function renderBody() {
    bar.replaceChildren(); bar.hidden = true;
    const v = { leads: leadsView, content: contentView, notify: notifyView, settings: settingsView }[tab]();
    body.replaceChildren(v);
  }

  /* ---------- заявки ---------- */
  function leadsView() {
    const counts = { all: S.leads.length }; Object.keys(ST).forEach(k => { counts[k] = S.leads.filter(l => l.status === k).length; });
    const filters = h('div', { class: 'adm-filters' }, [['all', 'Все']].concat(Object.entries(ST)).map(([k, n]) => h('button', { type: 'button', class: 'adm-chip' + (filter === k ? ' on' : ''), onclick: () => { filter = k; renderBody(); } }, n + ' ', h('i', null, counts[k]))));
    const toggle = h('div', { class: 'adm-seg' }, [['list', 'Список'], ['cal', 'Календарь']].map(([k, n]) => h('button', { type: 'button', class: view === k ? 'on' : '', onclick: () => { view = k; renderBody(); } }, n)));
    const list = S.leads.filter(l => filter === 'all' || l.status === filter);
    const wrap = h('div', null, h('div', { class: 'adm-row' }, filters, toggle));
    if (view === 'cal') wrap.append(calendar(list));
    else wrap.append(list.length ? h('div', { class: 'adm-cards' }, list.map(leadCard)) : h('p', { class: 'adm-empty' }, S.leads.length ? 'В этом статусе заявок нет.' : 'Заявок пока нет. Когда клиент заполнит форму на сайте, она появится здесь и уйдёт во все включённые каналы.'));
    return wrap;
  }
  function leadCard(l) {
    const set = st => guard(async () => { const r = await A.patchLead(l.id, { status: st }); Object.assign(l, r.lead || { status: st }); renderTabs(); renderBody(); });
    const delivery = Object.keys(l.delivery || {});
    const act = (st, label, cls) => l.status !== st ? h('button', { type: 'button', class: 'adm-btn sm ' + (cls || ''), onclick: () => set(st) }, label) : null;
    let del;
    del = h('button', { type: 'button', class: 'adm-btn sm ghost', onclick: () => {
      if (del.dataset.arm) { guard(async () => { await A.deleteLead(l.id); S.leads = S.leads.filter(x => x !== l); renderTabs(); renderBody(); }); return; }
      del.dataset.arm = '1'; del.textContent = 'Точно удалить?'; setTimeout(() => { del.textContent = 'Удалить'; delete del.dataset.arm; }, 3000);
    } }, 'Удалить');
    return h('article', { class: 'adm-lead s-' + l.status },
      h('div', { class: 'adm-lead-h' }, h('b', null, '№' + l.id + ' · ' + l.name), h('span', { class: 'adm-pill s-' + l.status }, ST[l.status] || l.status)),
      h('p', { class: 'adm-meta' }, 'Поступила ' + fmt(l.createdAt)),
      h('dl', { class: 'adm-dl' },
        h('div', null, h('dt', null, 'Телефон'), h('dd', null, h('a', { href: 'tel:+' + String(l.phone).replace(/\D/g, '').replace(/^8/, '7') }, l.phone))),
        l.car ? h('div', null, h('dt', null, 'Авто'), h('dd', null, l.car)) : null,
        l.service ? h('div', null, h('dt', null, 'Услуга'), h('dd', null, l.service)) : null,
        l.date || l.time ? h('div', null, h('dt', null, 'Когда'), h('dd', null, [l.date, l.time].filter(Boolean).join(' '))) : null,
        l.comment ? h('div', { class: 'wide' }, h('dt', null, 'Комментарий'), h('dd', null, l.comment)) : null),
      h('div', { class: 'adm-acts' }, act('accepted', 'Принять', 'primary'), act('done', 'Выполнена'), act('canceled', 'Отменить', 'ghost'), l.status !== 'new' ? act('new', 'Вернуть в новые', 'ghost') : null, del),
      h('textarea', { class: 'adm-note', rows: '2', placeholder: 'Заметка для себя', 'aria-label': 'Заметка к заявке ' + l.id, value: l.note || '', onchange: e => guard(async () => { await A.patchLead(l.id, { note: e.target.value }); l.note = e.target.value; toast('Заметка сохранена'); }) }),
      h('div', { class: 'adm-deliv' }, delivery.length ? delivery.map(ch => { const d = l.delivery[ch]; return h('span', { class: 'adm-dchip ' + (d.ok ? 'ok' : 'bad'), title: d.ok ? 'Доставлено ' + fmt(d.at) : d.error }, CH[ch] + (d.ok ? ' ✓' : ' ✕'), d.ok ? null : h('button', { type: 'button', 'aria-label': 'Отправить в ' + CH[ch] + ' ещё раз', onclick: () => guard(async () => { const r = await A.resend(l.id, ch); Object.assign(l, r.lead || {}); renderBody(); toast('Отправлено повторно'); }) }, '↻')); }) : h('span', { class: 'adm-meta' }, 'Каналы уведомлений не включены')));
  }
  function calendar(list) {
    const y = cal.getFullYear(), m = cal.getMonth(), days = new Date(y, m + 1, 0).getDate(), pad = (new Date(y, m, 1).getDay() + 6) % 7;
    const key = d => y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    const by = {}; list.forEach(l => { if (l.date) (by[l.date] = by[l.date] || []).push(l); });
    const todayKey = (() => { const t = new Date(); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); })();
    const cells = [];
    for (let i = 0; i < pad; i++) cells.push(h('span', { class: 'adm-day empty' }));
    for (let d = 1; d <= days; d++) {
      const k = key(d), ls = by[k] || [];
      cells.push(h('button', { type: 'button', class: 'adm-day' + (ls.length ? ' has' : '') + (k === todayKey ? ' today' : '') + (calDay === k ? ' sel' : ''), onclick: () => { calDay = calDay === k ? null : k; renderBody(); } },
        h('span', null, d), ls.length ? h('span', { class: 'dots' }, ls.slice(0, 4).map(l => h('i', { class: 's-' + l.status })), ls.length > 4 ? '+' : '') : null));
    }
    const nodate = list.filter(l => !l.date);
    const shown = calDay === '__none' ? nodate : calDay ? (by[calDay] || []) : null;
    const month = new Date(y, m, 1).toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
    return h('div', { class: 'adm-cal' },
      h('div', { class: 'adm-calh' },
        h('button', { type: 'button', class: 'adm-btn sm ghost', 'aria-label': 'Предыдущий месяц', onclick: () => { cal = new Date(y, m - 1, 1); renderBody(); } }, '←'),
        h('strong', null, month),
        h('button', { type: 'button', class: 'adm-btn sm ghost', 'aria-label': 'Следующий месяц', onclick: () => { cal = new Date(y, m + 1, 1); renderBody(); } }, '→')),
      h('div', { class: 'adm-grid' }, ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => h('span', { class: 'adm-dow' }, d)), cells),
      h('div', { class: 'adm-row', style: 'margin-top:16px' }, h('button', { type: 'button', class: 'adm-chip' + (calDay === '__none' ? ' on' : ''), onclick: () => { calDay = calDay === '__none' ? null : '__none'; renderBody(); } }, 'Без даты ', h('i', null, nodate.length))),
      shown ? (shown.length ? h('div', { class: 'adm-cards' }, shown.map(leadCard)) : h('p', { class: 'adm-empty' }, 'На этот день заявок нет.')) : h('p', { class: 'adm-meta', style: 'margin-top:14px' }, 'Выберите день, чтобы увидеть заявки.'));
  }

  /* ---------- контент ---------- */
  const T = (p, l, t) => [p, l, t || 'text'];
  const SCHEMA = [
    ['Бренд и поиск', [T('brand.name', 'Название'), T('brand.short', 'Знак в шапке (например, 810)'), T('brand.city', 'Город'), T('brand.region', 'Регион'), T('seo.title', 'Заголовок вкладки браузера'), T('seo.description', 'Описание для поисковиков', 'area')]],
    ['Главный экран', [T('hero.eyebrow', 'Надстрочник'), T('hero.title', 'Заголовок'), T('hero.lead', 'Вступление', 'area'), T('hero.cta', 'Главная кнопка'), T('hero.cta2', 'Вторая кнопка'), T('rating.value', 'Рейтинг'), T('rating.count', 'Количество оценок'), T('rating.award', 'Награда'), T('rating.source', 'Источник рейтинга'), T('rating.url', 'Ссылка на отзывы')]],
    ['Услуги и цены', [T('services.title', 'Заголовок'), T('services.lead', 'Подзаголовок', 'area'),
      ['services.items', 'Услуги с ценами', 'list', [['name', 'Название'], ['text', 'Описание', 'area'], ['price', 'Цена, ₽ (число или текст)']]],
      T('services.directionsTitle', 'Заголовок списка направлений'), T('services.directions', 'Направления, по одному в строке', 'lines')]],
    ['3D-стенд', [T('stand.eyebrow', 'Надстрочник'), T('stand.title', 'Заголовок'), T('stand.text', 'Текст', 'area'), T('stand.note', 'Примечание', 'area')]],
    ['Преимущества и оценки', [['why', 'Преимущества', 'list', [['title', 'Заголовок'], ['text', 'Текст', 'area']]], T('satisfaction.title', 'Заголовок оценок'), T('satisfaction.source', 'Источник оценок'),
      ['satisfaction.items', 'Показатели', 'list', [['label', 'Название'], ['value', 'Процент (0–100)', 'num'], ['mentions', 'Упоминаний', 'num']]]]],
    ['Марки автомобилей', [T('brands.title', 'Заголовок'), ['brands.groups', 'Группы марок', 'list', [['group', 'Группа'], ['list', 'Марки через запятую', 'area']]]]],
    ['Отзывы', [T('reviews.title', 'Заголовок'), ['reviews.items', 'Отзывы', 'list', [['author', 'Автор'], ['date', 'Дата'], ['text', 'Текст', 'area']]]]],
    ['Запись и контакты', [T('booking.eyebrow', 'Надстрочник'), T('booking.title', 'Заголовок формы'), T('booking.text', 'Подпись', 'area'), T('booking.consent', 'Текст согласия', 'area'), T('booking.success', 'Сообщение после отправки', 'area'),
      T('contacts.phone', 'Телефон'), T('contacts.address', 'Адрес'), T('contacts.coords', 'Координаты'), T('contacts.hours', 'Часы работы'), T('contacts.vk', 'Ссылка ВКонтакте'), T('contacts.mapUrl', 'Ссылка на Яндекс Карты'), T('contacts.amenities', 'Удобства, по одному в строке', 'lines')]],
    ['Оформление и 3D', [T('theme.accent', 'Акцентный цвет сайта', 'color'), T('theme.caliper', 'Цвет суппорта на 3D-модели', 'color'), T('theme.spin', 'Скорость вращения диска', 'range'), T('theme.enable3d', 'Показывать 3D-сцены', 'bool'), T('footer.legal', 'Текст в подвале', 'area')]]
  ];
  function ref(obj, path) { const k = path.split('.'); let o = obj; for (let i = 0; i < k.length - 1; i++) { if (o[k[i]] == null) o[k[i]] = {}; o = o[k[i]]; } return [o, k[k.length - 1]]; }
  function markC() { if (!dirtyC) { dirtyC = true; } updateBar(); }
  function control(o, k, type, id) {
    const on = fn => e => { fn(e); markC(); };
    if (type === 'area') return h('textarea', { id, rows: '3', value: o[k] == null ? '' : o[k], oninput: on(e => { o[k] = e.target.value; }) });
    if (type === 'lines') return h('textarea', { id, rows: '6', value: (o[k] || []).join('\n'), oninput: on(e => { o[k] = e.target.value.split('\n').map(s => s.trim()).filter(Boolean); }) });
    if (type === 'color') return h('input', { id, type: 'color', value: o[k] || '#d4202c', oninput: on(e => { o[k] = e.target.value; }) });
    if (type === 'bool') return h('input', { id, type: 'checkbox', class: 'adm-sw', checked: o[k] !== false, onchange: on(e => { o[k] = e.target.checked; }) });
    if (type === 'range') { const out = h('output', null, String(o[k])); return h('span', { class: 'adm-range' }, h('input', { id, type: 'range', min: '0', max: '1.5', step: '0.05', value: o[k] == null ? 0.25 : o[k], oninput: on(e => { o[k] = Number(e.target.value); out.textContent = e.target.value; }) }), out); }
    if (type === 'num') return h('input', { id, type: 'number', inputmode: 'decimal', value: o[k] == null ? '' : o[k], oninput: on(e => { o[k] = e.target.value === '' ? '' : Number(e.target.value); }) });
    return h('input', { id, type: 'text', value: o[k] == null ? '' : o[k], oninput: on(e => { o[k] = e.target.value; }) });
  }
  let uid = 0;
  function field(o, k, label, type) { const id = 'adm-f' + (++uid); return h('div', { class: 'adm-f' + (type === 'bool' || type === 'color' || type === 'range' ? ' inline' : '') }, h('label', { for: id }, label), control(o, k, type, id)); }
  function listEditor(arr, label, sub) {
    const box = h('div', { class: 'adm-list' });
    const draw = () => {
      box.replaceChildren(h('div', { class: 'adm-lh' }, label, h('i', null, arr.length)),
        ...arr.map((it, i) => h('div', { class: 'adm-item' },
          h('div', { class: 'adm-ih' }, h('b', null, '#' + (i + 1)), h('span', { class: 'sp' }),
            h('button', { type: 'button', 'aria-label': 'Выше', disabled: i === 0, onclick: () => { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); markC(); draw(); } }, '↑'),
            h('button', { type: 'button', 'aria-label': 'Ниже', disabled: i === arr.length - 1, onclick: () => { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); markC(); draw(); } }, '↓'),
            h('button', { type: 'button', class: 'x', 'aria-label': 'Удалить', onclick: () => { arr.splice(i, 1); markC(); draw(); } }, '✕')),
          sub.map(([k, l, t]) => field(it, k, l, t)))),
        h('button', { type: 'button', class: 'adm-btn sm ghost', onclick: () => { const n = {}; sub.forEach(([k]) => { n[k] = ''; }); arr.push(n); markC(); draw(); } }, '+ Добавить'));
    };
    draw(); return box;
  }
  function contentView() {
    const wrap = h('div', { class: 'adm-sections' });
    SCHEMA.forEach(([title, fields], i) => {
      const d = h('details', { class: 'adm-sec', open: i === 0 }, h('summary', null, title));
      fields.forEach(([p, l, t, sub]) => { const [o, k] = ref(draft, p); if (t === 'list') { if (!Array.isArray(o[k])) o[k] = []; d.append(listEditor(o[k], l, sub)); } else d.append(field(o, k, l, t)); });
      wrap.append(d);
    });
    wrap.append(h('p', { class: 'adm-meta' }, 'Изменения появятся на сайте после нажатия «Сохранить».'));
    updateBar(); return wrap;
  }

  /* ---------- уведомления ---------- */
  const SCRIPT = "function doPost(e) {\n  var d = JSON.parse(e.postData.contents);\n  SpreadsheetApp.getActiveSheet().appendRow([d.id, d.createdAt, d.name, d.phone, d.car, d.service, d.when, d.comment, d.status]);\n  return ContentService.createTextOutput('ok');\n}";
  function nField(ch, k, label, opts) {
    opts = opts || {}; const id = 'adm-n-' + ch + '-' + k; const o = nDraft[ch];
    const on = e => { o[k] = opts.num ? Number(e.target.value) : e.target.value; dirtyN = true; updateBar(); };
    const el = opts.select ? h('select', { id, value: o[k], onchange: on }, opts.select.map(([v, n]) => h('option', { value: v }, n))) : h('input', { id, type: opts.secret ? 'password' : opts.num ? 'number' : 'text', autocomplete: 'off', placeholder: opts.ph || '', value: o[k] == null ? '' : o[k], oninput: on });
    return h('div', { class: 'adm-f' }, h('label', { for: id }, label), el);
  }
  function channelCard(ch, title, desc, fields, help) {
    const res = h('span', { class: 'adm-meta', role: 'status' });
    const sw = h('input', { type: 'checkbox', class: 'adm-sw', id: 'adm-sw-' + ch, checked: nDraft[ch].enabled, onchange: e => { nDraft[ch].enabled = e.target.checked; dirtyN = true; card.classList.toggle('on', e.target.checked); updateCount(); updateBar(); } });
    const card = h('section', { class: 'adm-ch' + (nDraft[ch].enabled ? ' on' : '') },
      h('div', { class: 'adm-chh' }, h('div', null, h('h3', null, h('label', { for: 'adm-sw-' + ch }, title)), h('p', null, desc)), sw),
      h('div', { class: 'adm-fields' }, fields),
      h('div', { class: 'adm-acts' }, h('button', { type: 'button', class: 'adm-btn sm ghost', onclick: async e => {
        const b = e.currentTarget; b.disabled = true; res.className = 'adm-meta'; res.textContent = 'Отправляю…';
        try { const r = await A.testNotify(ch, nDraft[ch]); res.className = 'adm-meta ' + (r.ok ? 'okc' : 'errc'); res.textContent = r.ok ? 'Тестовое сообщение отправлено' : r.error; } catch (x) { res.className = 'adm-meta errc'; res.textContent = x.message; }
        b.disabled = false;
      } }, 'Отправить тест'), res),
      help ? h('details', { class: 'adm-help' }, h('summary', null, 'Как подключить'), help) : null);
    return card;
  }
  let countEl;
  function updateCount() { if (countEl) { const n = Object.keys(CH).filter(c => nDraft[c].enabled).length + 1; countEl.textContent = 'Каждая новая заявка уйдёт в ' + n + ' ' + (n === 1 ? 'место' : n < 5 ? 'места' : 'мест') + ' одновременно.'; } }
  function notifyView() {
    countEl = h('p', { class: 'adm-banner' });
    const ol = items => h('ol', { class: 'adm-steps' }, items.map(t => h('li', null, t)));
    const wrap = h('div', { class: 'adm-chs' }, countEl,
      h('section', { class: 'adm-ch on fixed' }, h('div', { class: 'adm-chh' }, h('div', null, h('h3', null, 'Админка на сайте'), h('p', null, 'Список заявок, статусы «новая / принята / выполнена», календарь. Работает всегда, открывается с телефона.')), h('input', { type: 'checkbox', class: 'adm-sw', checked: true, disabled: true, 'aria-label': 'Всегда включено' }))),
      channelCard('telegram', 'Telegram-бот', 'Заявка приходит сообщением с кнопками «Принять», «Выполнена», «Отменить». Статус меняется и на сайте.', [nField('telegram', 'token', 'Токен бота', { secret: true, ph: '123456:ABC…' }), nField('telegram', 'chatIds', 'Chat ID получателей через запятую', { ph: '123456789' })],
        ol(['Откройте @BotFather, команда /newbot, скопируйте токен.', 'Напишите своему боту /start с аккаунта владельца.', 'Свой chat ID покажет бот @userinfobot. Для группы добавьте бота в чат и укажите ID группы (с минусом).', 'Нажмите «Отправить тест».'])),
      channelCard('email', 'Почта', 'Копия заявки письмом на почту владельца.', [nField('email', 'host', 'SMTP-сервер', { ph: 'smtp.yandex.ru' }), nField('email', 'port', 'Порт', { num: true }), nField('email', 'mode', 'Защита', { select: [['ssl', 'SSL (порт 465)'], ['starttls', 'STARTTLS (порт 587)'], ['none', 'Без защиты (порт 25)']] }), nField('email', 'user', 'Логин'), nField('email', 'pass', 'Пароль (для почты Яндекса и Gmail нужен пароль приложения)', { secret: true }), nField('email', 'from', 'От кого', { ph: 'Автосервис 810 <info@example.ru>' }), nField('email', 'to', 'Кому, через запятую', { ph: 'owner@example.ru' })],
        ol(['Яндекс: smtp.yandex.ru, порт 465, SSL. Mail.ru: smtp.mail.ru, 465. Gmail: smtp.gmail.com, 465.', 'В настройках почты создайте пароль для внешних приложений и вставьте его сюда.', 'Адрес «От кого» должен совпадать с логином.'])),
      channelCard('vk', 'Сообщения сообщества ВКонтакте', 'Заявка приходит личным сообщением от сообщества тому, кто за него отвечает.', [nField('vk', 'token', 'Ключ доступа сообщества', { secret: true }), nField('vk', 'peerIds', 'ID получателей через запятую', { ph: '12345678' })],
        ol(['Сообщество → Управление → Работа с API → Создать ключ с правом «Сообщения сообщества».', 'Включите сообщения сообщества в разделе «Сообщения».', 'Получатель должен один раз написать в сообщество, иначе ВКонтакте не даст отправить ему сообщение.', 'Числовой ID получателя можно узнать в настройках его страницы.'])),
      channelCard('sheets', 'Таблица (Google или Яндекс)', 'Заявка добавляется строкой в таблицу. Нужна ссылка вебхука.', [nField('sheets', 'url', 'Ссылка вебхука', { secret: true, ph: 'https://script.google.com/macros/s/…/exec' })],
        h('div', null, ol(['Google Таблицы: Расширения → Apps Script, вставьте код ниже.', 'Развернуть → Новое развертывание → Веб-приложение, доступ «Все».', 'Скопируйте ссылку и вставьте выше.', 'Для Яндекс Таблиц подойдёт любой вебхук (Яндекс Cloud Functions, Make, n8n), который принимает JSON.']),
          h('pre', { class: 'adm-code' }, SCRIPT), h('button', { type: 'button', class: 'adm-btn sm ghost', onclick: () => { try { navigator.clipboard.writeText(SCRIPT).then(() => toast('Код скопирован'), () => toast('Выделите код и скопируйте вручную', true)); } catch (e) { toast('Выделите код и скопируйте вручную', true); } } }, 'Скопировать код'))));
    updateCount(); updateBar(); return wrap;
  }

  /* ---------- настройки ---------- */
  function settingsView() {
    const cur = h('input', { id: 'pw0', type: 'password', autocomplete: 'current-password' }), n1 = h('input', { id: 'pw1', type: 'password', autocomplete: 'new-password' }), n2 = h('input', { id: 'pw2', type: 'password', autocomplete: 'new-password' });
    const msg = h('p', { class: 'adm-meta', role: 'status' });
    const form = h('form', { class: 'adm-card', onsubmit: async e => {
      e.preventDefault(); msg.className = 'adm-meta errc';
      if (n1.value.length < 8) { msg.textContent = 'Новый пароль короче 8 символов'; return; }
      if (n1.value !== n2.value) { msg.textContent = 'Пароли не совпадают'; return; }
      if (n1.value === 'admin810') { msg.textContent = 'Придумайте другой пароль'; return; }
      try { await A.changePassword(cur.value, n1.value); S.mustChange = false; cur.value = n1.value = n2.value = ''; msg.className = 'adm-meta okc'; msg.textContent = 'Пароль изменён. Другие устройства выйдут из админки.'; renderTabs(); toast('Пароль изменён'); } catch (x) { msg.textContent = x.message; }
    } }, h('h3', null, 'Смена пароля'),
    S.mustChange ? h('p', { class: 'adm-banner warn' }, 'Сейчас стоит пароль по умолчанию. Задайте свой, иначе остальные разделы закрыты.') : null,
    h('div', { class: 'adm-f' }, h('label', { for: 'pw0' }, 'Текущий пароль'), cur), h('div', { class: 'adm-f' }, h('label', { for: 'pw1' }, 'Новый пароль, от 8 символов'), n1), h('div', { class: 'adm-f' }, h('label', { for: 'pw2' }, 'Повторите новый пароль'), n2),
    h('div', { class: 'adm-acts' }, h('button', { class: 'adm-btn primary', type: 'submit' }, 'Сменить пароль'), msg));

    const area = h('textarea', { rows: '5', placeholder: 'Вставьте сюда JSON резервной копии или выберите файл', 'aria-label': 'Резервная копия' });
    const file = h('input', { type: 'file', accept: 'application/json,.json', 'aria-label': 'Файл резервной копии', onchange: async e => { const f = e.target.files[0]; if (f) area.value = await f.text(); } });
    const data = h('div', { class: 'adm-card' }, h('h3', null, 'Резервная копия'), h('p', { class: 'adm-meta' }, 'Контент сайта и все заявки одним файлом.'),
      h('div', { class: 'adm-acts' },
        h('button', { type: 'button', class: 'adm-btn sm', onclick: () => guard(async () => { const d = await A.exportAll(); const txt = JSON.stringify(d, null, 1); area.value = txt; try { const a = h('a', { href: URL.createObjectURL(new Blob([txt], { type: 'application/json' })), download: 'avtoservis810-backup.json' }); document.body.append(a); a.click(); a.remove(); } catch (e) {} toast('Копия готова'); }) }, 'Скачать копию'),
        h('button', { type: 'button', class: 'adm-btn sm ghost', onclick: () => { try { navigator.clipboard.writeText(area.value).then(() => toast('Скопировано'), () => toast('Скопируйте вручную', true)); } catch (e) { toast('Скопируйте вручную', true); } } }, 'Копировать')),
      file, area,
      h('div', { class: 'adm-acts' }, h('button', { type: 'button', class: 'adm-btn sm ghost', onclick: () => guard(async () => { let j; try { j = JSON.parse(area.value); } catch (e) { toast('Это не похоже на JSON', true); return; } await A.importAll(j); await start(); toast('Данные восстановлены'); }) }, 'Восстановить из копии')));
    const info = h('div', { class: 'adm-card' }, h('h3', null, 'Режим'), h('p', { class: 'adm-meta' }, A.mode === 'server' ? 'Рабочий режим: данные хранятся на сервере, уведомления отправляются.' : 'Демо-режим: данные хранятся только в этом браузере, уведомления не отправляются. Для рабочего режима запустите сайт через server.js.'));
    return h('div', { class: 'adm-settings' }, form, data, info);
  }

  /* ---------- панель сохранения ---------- */
  function updateBar() {
    if (!bar) return;
    const isC = tab === 'content', isN = tab === 'notify';
    bar.hidden = !(isC || isN); if (bar.hidden) return;
    const dirty = isC ? dirtyC : dirtyN;
    bar.replaceChildren(...[h('span', { class: 'adm-meta' }, dirty ? 'Есть несохранённые изменения' : 'Всё сохранено'),
      h('span', { class: 'sp' }),
      isC ? h('button', { type: 'button', class: 'adm-btn sm ghost', onclick: resetDefaults }, 'Исходный текст') : null,
      h('button', { type: 'button', class: 'adm-btn primary sm', disabled: !dirty, onclick: isC ? saveContent : saveNotify }, 'Сохранить')].filter(Boolean));
  }
  async function resetDefaults() {
    if (!bar.dataset.arm) { bar.dataset.arm = '1'; toast('Нажмите ещё раз, чтобы вернуть исходные тексты (до сохранения ничего не изменится)'); setTimeout(() => delete bar.dataset.arm, 4000); return; }
    delete bar.dataset.arm;
    try { const d = A.mode === 'server' ? await (await fetch('/defaults.json')).json() : A.defaults; draft = clone(d); dirtyC = true; renderBody(); } catch (e) { toast('Не удалось загрузить исходный текст', true); }
  }
  function saveContent() { guard(async () => { await A.saveContent(draft); S.content = clone(draft); dirtyC = false; if (window.Site) Site.setContent(S.content); updateBar(); toast('Сохранено. Сайт обновлён'); }); }
  function saveNotify() { guard(async () => { const r = await A.saveNotify(nDraft); S.notify = clone(r.notify || nDraft); nDraft = clone(S.notify); dirtyN = false; renderBody(); toast('Настройки уведомлений сохранены'); }); }
})();
