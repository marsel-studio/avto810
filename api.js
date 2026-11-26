/* Слой данных. Если рядом работает server.js, говорим с ним. Иначе включается демо-режим на localStorage. */
(function () {
  'use strict';
  const A = { mode: 'demo' };
  const STATUS_RU = { new: 'Новая', accepted: 'Принята', done: 'Выполнена', canceled: 'Отменена' };
  A.STATUS_RU = STATUS_RU;

  async function call(method, url, body) {
    let r;
    try {
      r = await fetch(url, { method, headers: body !== undefined ? { 'Content-Type': 'application/json' } : {}, body: body !== undefined ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
    } catch (e) { throw new Error('Нет связи с сервером'); }
    let j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok) { const err = new Error(j.error || 'Ошибка ' + r.status); err.status = r.status; err.mustChange = j.mustChange; throw err; }
    return j;
  }

  /* ----- демо-хранилище ----- */
  let mem = null;
  const KEY = 'avtoservis810-demo-v1';
  function load() {
    if (mem) return mem;
    try { mem = JSON.parse(localStorage.getItem(KEY)); } catch (e) { mem = null; }
    if (!mem) mem = { content: JSON.parse(JSON.stringify(A.defaults)), notify: emptyNotify(), leads: [], seq: 0, staffPass: { value: '810zayavki2026', mustChange: true }, ownerPass: { value: '810owner2026', mustChange: true } };
    if (!mem.staffPass || !mem.ownerPass || mem.pw) {
      mem.staffPass = mem.staffPass || { value: mem.pw || '810zayavki2026', mustChange: mem.pw ? false : true };
      mem.ownerPass = mem.ownerPass || { value: '810owner2026', mustChange: true };
      delete mem.pw; persist();
    }
    return mem;
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) {} }
  function emptyNotify() {
    return {
      telegram: { enabled: false, token: '', chatIds: '' },
      email: { enabled: false, host: '', port: 465, mode: 'ssl', user: '', pass: '', from: '', to: '' },
      vk: { enabled: false, token: '', peerIds: '' },
      sheets: { enabled: false, url: '' }
    };
  }
  let demoAuth = null;
  try { demoAuth = JSON.parse(sessionStorage.getItem('a810auth')); if (!demoAuth || !['staff','owner'].includes(demoAuth.role)) demoAuth = null; } catch (e) {}
  const need = () => { if (!demoAuth) { const e = new Error('Нужен вход'); e.status = 401; throw e; } };

  const owner = (passwordChange = false) => {
    need();
    if (demoAuth.role !== 'owner') { const e = new Error('Доступно только владельцу'); e.status = 403; throw e; }
    if (!passwordChange && load().ownerPass.mustChange) { const e = new Error('Сначала смените пароль по умолчанию'); e.status = 403; e.mustChange = true; throw e; }
  };
  const demo = {
    async leads(b) {
      const d = load();
      const phone = String(b.phone || '').replace(/\D/g, '');
      if (!String(b.name || '').trim()) throw new Error('Укажите имя');
      if (phone.length < 10 || phone.length > 12) throw new Error('Проверьте номер телефона');
      if (!b.consent) throw new Error('Нужно согласие на обработку данных');
      const lead = { id: ++d.seq, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: 'new', name: String(b.name).trim().slice(0, 80), phone: String(b.phone).trim().slice(0, 30), car: String(b.car || '').slice(0, 80), service: String(b.service || '').slice(0, 120), date: b.date || '', time: b.time || '', comment: String(b.comment || '').slice(0, 600), note: '', delivery: {} };
      Object.keys(d.notify).forEach(ch => { if (d.notify[ch].enabled) lead.delivery[ch] = { ok: false, at: lead.createdAt, error: 'Демо-режим: отправка работает только на сервере' }; });
      d.leads.unshift(lead); persist(); return { ok: true, id: lead.id };
    },
    async login(pw) { const d = load(); const role = pw === d.ownerPass.value ? 'owner' : pw === d.staffPass.value ? 'staff' : null; if (!role) throw new Error('Неверный пароль'); demoAuth = { role, token: Date.now().toString(36) }; try { sessionStorage.setItem('a810auth', JSON.stringify(demoAuth)); } catch(e) {} return { ok: true, ...demoAuth, mustChange: !!d[role + 'Pass'].mustChange }; },
    async logout() { demoAuth = null; try { sessionStorage.removeItem('a810auth'); } catch(e) {} return { ok: true }; },
    async state() { need(); const d = load(), role = demoAuth.role; return { content: d.content, notify: role === 'owner' ? d.notify : {}, leads: d.leads, role, mustChange: !!d[role + 'Pass'].mustChange, passwordMustChange: { staff: !!d.staffPass.mustChange, owner: !!d.ownerPass.mustChange }, mode: 'demo' }; },
    async saveContent(c) { owner(); load().content = c; persist(); return { ok: true }; },
    async saveNotify(n) { owner(); load().notify = n; persist(); return { ok: true, notify: n }; },
    async testNotify() { owner(); return { ok: false, error: 'Демо-режим: отправка работает только на сервере' }; },
    async changePassword(cur, next, role = 'owner') { owner(true); const d = load(); if (!['owner','staff'].includes(role)) throw new Error('Неверная роль'); if (cur !== d.ownerPass.value) throw new Error('Текущий пароль неверный'); if (String(next).length < 8) throw new Error('Новый пароль короче 8 символов'); if (['admin810','810zayavki2026','810owner2026',d.staffPass.value,d.ownerPass.value].includes(next)) throw new Error('Придумайте другой пароль'); d[role + 'Pass'] = { value: next, mustChange: false }; persist(); return { ok: true }; },
    async patchLead(id, patch) { need(); if (Object.keys(patch).some(k => k !== 'status')) owner(); if (patch.status != null && !Object.hasOwn(STATUS_RU, patch.status)) throw new Error('Неверный статус'); const l = load().leads.find(x => x.id === id); if (!l) throw new Error('Заявка не найдена'); Object.assign(l, patch, { updatedAt: new Date().toISOString() }); persist(); return { ok: true, lead: l }; },
    async deleteLead(id) { owner(); const d = load(); d.leads = d.leads.filter(x => x.id !== id); persist(); return { ok: true }; },
    async resend() { owner(); throw new Error('Демо-режим: отправка работает только на сервере'); },
    async exportAll() { owner(); const d = load(); return { content: d.content, notify: d.notify, leads: d.leads }; },
    async importAll(b) { owner(); const d = load(); if (b.content) d.content = b.content; if (Array.isArray(b.leads)) { d.leads = b.leads; d.seq = b.leads.reduce((a, l) => Math.max(a, l.id || 0), d.seq); } persist(); return { ok: true }; }
  };

  A.init = async function () {
    try {
      const r = await fetch('/api/public', { headers: { accept: 'application/json' } });
      if (r.ok && /json/.test(r.headers.get('content-type') || '')) { A.mode = 'server'; return await r.json(); }
    } catch (e) {}
    A.mode = 'demo';
    if (window.__DEFAULTS__) A.defaults = window.__DEFAULTS__;
    else { try { A.defaults = await (await fetch('defaults.json')).json(); } catch (e) { throw new Error('Не удалось загрузить данные сайта'); } }
    return load().content;
  };

  const S = (srv, dm) => (...a) => (A.mode === 'server' ? srv(...a) : dm(...a));
  A.submitLead = S(b => call('POST', '/api/leads', b), demo.leads);
  A.login = S(pw => call('POST', '/api/login', { password: pw }), demo.login);
  A.logout = S(() => call('POST', '/api/logout', {}), demo.logout);
  A.state = S(() => call('GET', '/api/admin/state'), demo.state);
  A.saveContent = S(c => call('PUT', '/api/admin/content', c), demo.saveContent);
  A.saveNotify = S(n => call('PUT', '/api/admin/notify', n), demo.saveNotify);
  A.testNotify = S((ch, cfg) => call('POST', '/api/admin/notify/test', { channel: ch, config: cfg }), demo.testNotify);
  A.changePassword = S((c, n, role) => call('POST', '/api/admin/password', { current: c, next: n, role }), demo.changePassword);
  A.patchLead = S((id, p) => call('PATCH', '/api/admin/leads/' + id, p), demo.patchLead);
  A.deleteLead = S(id => call('DELETE', '/api/admin/leads/' + id, {}), demo.deleteLead);
  A.resend = S((id, ch) => call('POST', '/api/admin/leads/' + id + '/resend', { channel: ch || null }), demo.resend);
  A.exportAll = S(() => call('GET', '/api/admin/export'), demo.exportAll);
  A.importAll = S(b => call('POST', '/api/admin/import', b), demo.importAll);
  window.A810 = A;
})();
