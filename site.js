/* Публичный сайт: рендер из контента, формы, 3D. */
(function () {
  'use strict';
  const A = window.A810;
  const $ = (s, r) => (r || document).querySelector(s);
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = v => { const s = String(v == null ? '' : v).trim(); return /^\d+$/.test(s) ? s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽' : s; };
  const telHref = p => 'tel:+' + String(p).replace(/\D/g, '').replace(/^8/, '7');
  const safeUrl = u => (/^https?:\/\//i.test(u) ? u : '#');

  let C = null, rendered = false, dirty = true, disc = null, align = null;
  const Site = { setContent(c) { C = c; dirty = true; }, get content() { return C; } };
  window.Site = Site;

  const isAdminRoute = () => /\/admin\/?$/.test(location.pathname) || location.hash === '#admin';
  const adminHref = () => (A.mode === 'server' ? '/admin' : '#admin');
  const homeHref = () => (A.mode === 'server' ? '/' : '#');
  Site.homeHref = homeHref;

  function applyTheme() {
    const t = C.theme || {};
    if (t.accent) document.documentElement.style.setProperty('--accent', t.accent);
  }
  function setMeta() {
    document.title = C.seo.title || C.brand.name;
    let m = $('meta[name=description]'); if (!m) { m = document.createElement('meta'); m.name = 'description'; document.head.appendChild(m); }
    m.content = C.seo.description || '';
  }

  function html() {
    const b = C.brand, h = C.hero, r = C.rating, k = C.contacts, s = C.services, st = C.stand, bk = C.booking;
    const title = E(h.title).replace(/(\d+)/, '<span class="num">$1</span>');
    return `
<a class="skip-link" href="#services">Перейти к содержимому</a><header class="top"><div class="wrap">
  <a class="logo" href="#top" aria-label="${E(b.name)}"><b>${E(b.short)}</b><span>АВТОСЕРВИС<br><em>${E(b.city)} · Югра</em></span></a>
  <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="siteNav" aria-label="Открыть меню"><span></span><span></span></button><nav id="siteNav" class="nav" aria-label="Разделы"><a href="#services">Услуги</a><a href="#stand">3D-стенд</a><a href="#why">Почему мы</a><a href="#reviews">Отзывы</a><a href="#booking">Контакты</a></nav>
  <a class="tel" href="${telHref(k.phone)}">${E(k.phone)}</a>
  <a class="btn primary sm" href="#booking">Записаться</a>
</div></header>
<main id="top">
<section class="hero-shell">
  <img class="hero-image" src="assets/hero-car.jpg" alt="Серебристый спортивный автомобиль на дороге" fetchpriority="high" width="2000" height="1333">
  <div class="hero-shade"></div>
  <div class="hero wrap">
    <div class="hero-copy">
      <p class="eyebrow">${E(h.eyebrow)} · Ремонт и обслуживание</p>
      <h1>${h.title === 'Автосервис 810' ? 'Уверенность<br>в каждом<br><span class="accent-word">километре.</span>' : title}</h1>
      <p class="lead">${E(h.lead)}</p>
      <div class="cta"><a class="btn primary" href="#booking">${E(h.cta)}</a><a class="btn ghost" href="#services">${E(h.cta2)}</a></div>
      <a class="hero-rating" href="${E(safeUrl(r.url))}" target="_blank" rel="noopener"><strong>${E(r.value)}</strong><span><span class="stars" aria-label="5 звёзд">★★★★★</span><br>${E(r.count)} оценок · ${E(r.source)}</span><span class="rating-award">${E(r.award)}</span></a>
    </div>
    <div class="hero-caption"><span>810 / АВТОСЕРВИС</span><span>Точность в деталях.<br>Спокойствие за рулём.</span></div>
  </div>
  <div class="hero-bottom wrap"><span>${E(k.address)}</span><span>${E(k.hours)}</span><a href="#services">Узнать о сервисе</a></div>
</section>
<div class="trust-strip"><div class="wrap"><span>Стоимость согласуем заранее</span><span>Гарантия на работы и запчасти</span><span>Легковые и коммерческие авто</span></div></div>

<section id="services" class="sec wrap">
  <div class="sec-head"><p class="eyebrow">Услуги</p><h2>${E(s.title)}</h2><p>${E(s.lead)}</p></div>
  <ul class="rows">${s.items.map(i => `
    <li class="row"><div><h3>${E(i.name)}</h3><p>${E(i.text)}</p></div><span class="price">${E(money(i.price))}</span><a class="btn ghost sm" href="#booking" data-service="${E(i.name)}">Записаться</a></li>`).join('')}
  </ul>
  <p class="sub">${E(s.directionsTitle)}</p>
  <ul class="chips">${s.directions.map(d => `<li>${E(d)}</li>`).join('')}</ul>
</section>

<section id="wheel" class="sec wrap">
  <div class="sec-head"><p class="eyebrow">Точность в деталях</p><h2>Надёжность начинается<br>с деталей.</h2><p>Колесо и тормозная система — рассмотрите устройство со всех сторон.</p></div>
  <figure class="stage" id="stageDisc" aria-label="Интерактивная 3D-модель колеса и тормозной системы"><canvas aria-hidden="true"></canvas><div class="fallback">Колесо и тормозная система</div><div class="tag l" data-tag="disc"><span>Тормозной диск</span></div><div class="tag" data-tag="caliper"><span>Суппорт</span></div><figcaption>Потяните, чтобы повернуть колесо</figcaption></figure>
</section>

<section id="stand" class="sec wrap">
  <div class="stand">
    <div>
      <p class="eyebrow">${E(st.eyebrow)}</p>
      <h2 class="stand-title">${E(st.title)}</h2>
      <p class="lead stand-intro">${E(st.text)}</p>
      <div class="ctl">
        <label for="camber"><span class="val"><span>Развал</span><output id="camberOut">0.0°</output></span><input id="camber" type="range" min="-4" max="4" step="0.1" value="0"></label>
        <label for="toe"><span class="val"><span>Схождение</span><output id="toeOut">0.00°</output></span><input id="toe" type="range" min="-2" max="2" step="0.05" value="0"></label>
        <div class="state ok" id="alignState" role="status"><i></i><span></span></div>
        <div class="btns">
          <button class="btn ghost sm" type="button" data-preset="-3,0">Перекос развала</button>
          <button class="btn ghost sm" type="button" data-preset="0,1.2">Перекос схождения</button>
          <button class="btn primary sm" type="button" data-preset="0,0">Выставить по стенду</button>
        </div>
      </div>
      <p class="note">${E(st.note)}</p>
    </div>
    <figure class="stage" id="stageAlign" aria-label="Интерактивная 3D-модель передней оси">
      <canvas aria-hidden="true"></canvas><div class="fallback"><strong>Развал и схождение</strong><p>Развал — наклон колеса. Схождение — направление колёс относительно друг друга.</p><p>Меняйте углы ползунками: пояснение слева покажет результат.</p></div>
      <figcaption>Красные линии — текущие углы, серые — эталон</figcaption>
    </figure>
  </div>
</section>

<section id="why" class="sec wrap">
  <div class="sec-head"><p class="eyebrow">Подход к работе</p><h2>Ваш автомобиль.<br>Наша ответственность.</h2><p>Понятная стоимость, согласованные сроки и внимание к деталям — от первого звонка до выдачи автомобиля.</p></div><div class="why">
    <ul class="why-list">${C.why.map(w => `<li><h3>${E(w.title)}</h3><p>${E(w.text)}</p></li>`).join('')}</ul>
    <div class="bars">
      <h3>${E(C.satisfaction.title)}</h3>
      <p class="src">${E(C.satisfaction.source)}</p>
      ${C.satisfaction.items.map(i => `<div class="bar"><span>${E(i.label)}<small>${E(i.mentions)} упоминаний</small></span><span class="track"><span class="fill" style="width:${Math.max(0, Math.min(100, Number(i.value) || 0))}%"></span></span><b>${E(i.value)}%</b></div>`).join('')}
    </div>
  </div>
</section>

<section id="photos" class="sec wrap" aria-labelledby="photosTitle"><div class="sec-head"><p class="eyebrow">Наш сервис</p><h2 id="photosTitle">Фотографии сервиса</h2></div><div class="photo-grid" aria-live="polite"></div><p class="photo-status">Загружаем фотографии…</p></section>

<section id="brands" class="sec wrap">
  <div class="sec-head"><p class="eyebrow">Марки</p><h2>${E(C.brands.title)}</h2></div>
  <dl class="brands">${C.brands.groups.map(g => `<div><dt>${E(g.group)}</dt><dd>${E(g.list)}</dd></div>`).join('')}</dl>
</section>

<section id="reviews" class="sec wrap">
  <div class="sec-head"><p class="eyebrow">${E(r.source)}</p><h2>${E(C.reviews.title)}</h2></div>
  <div class="reviews">${C.reviews.items.map(v => `<figure class="review"><span class="stars" aria-label="5 звёзд">★★★★★</span><blockquote>${E(v.text)}</blockquote><figcaption><b>${E(v.author)}</b><span>${E(v.date)}</span></figcaption></figure>`).join('')}</div>
  <a class="more" href="${E(safeUrl(r.url))}" target="_blank" rel="noopener">Все отзывы на ${E(r.source)}</a>
</section>

<section id="questions" class="sec wrap">
  <div class="sec-head"><p class="eyebrow">Перед визитом</p><h2>Понятно ещё<br>до записи.</h2><p>Выберите услугу или опишите проблему своими словами. Детали уточним при звонке.</p></div>
  <div class="questions">
    <details><summary>Не знаю, какая услуга нужна. Как записаться?</summary><p>Выберите «Диагностика» или «Другое» и расскажите в поле «Что случилось», что беспокоит: шум, ошибка на панели или поведение автомобиля.</p></details>
    <details><summary>Выбранные дата и время — это уже запись?</summary><p>Это ваши пожелания. ${E(bk.text)} Дождитесь подтверждения перед визитом.</p></details>
    <details><summary>Что указать в заявке?</summary><p>Достаточно имени и телефона для обратного звонка. Марка, модель и описание проблемы помогут быстрее разобраться в задаче.</p></details>
    <details><summary>Как найти автосервис?</summary><p>${E(k.address)}. Часы работы: ${E(k.hours)}.</p><a class="more" href="${E(safeUrl(k.mapUrl))}" target="_blank" rel="noopener">Показать на Яндекс Картах</a></details>
  </div>
</section>

<section id="booking" class="sec wrap">
  <div class="sec-head"><p class="eyebrow">${E(bk.eyebrow)}</p><h2>${E(bk.title)}</h2><p>${E(bk.text)}</p></div>
  <div class="book">
    <form class="lead" id="leadForm">
      <div class="fld"><label for="f-name">Имя</label><input id="f-name" name="name" autocomplete="name" maxlength="80" placeholder="Как к вам обращаться" required></div>
      <div class="fld"><label for="f-phone">Телефон</label><input id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 (___) ___-__-__" maxlength="18" aria-describedby="phoneHint" required><small id="phoneHint">Российский номер, 10 цифр после +7</small></div>
      <div class="fld"><label for="f-car">Автомобиль</label><input id="f-car" name="car" maxlength="80" placeholder="Марка, модель, год"></div>
      <div class="fld"><label for="f-service">Услуга</label><select id="f-service" name="service"><option value="">Выберите услугу</option>${s.items.map(i => `<option>${E(i.name)}</option>`).join('')}<option>Диагностика</option><option>Другое</option></select></div>
      <div class="fld"><label for="f-date">Удобная дата</label><input id="f-date" name="date" type="date"></div>
      <div class="fld"><label for="f-time">Удобное время</label><input id="f-time" name="time" type="time"></div>
      <div class="fld full"><label for="f-comment">Что случилось</label><textarea id="f-comment" name="comment" maxlength="600" placeholder="Стук, горит ошибка, нужна замена масла"></textarea></div>
      <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <label class="consent"><input type="checkbox" name="consent" id="f-consent" required><span>${E(bk.consent)}</span></label>
      <p class="booking-note full">Дата и время предварительные. Запись подтвердим по телефону.</p>
      <div class="submit"><button class="btn primary" type="submit">Отправить заявку</button><span class="msg" id="formMsg" role="status" aria-live="polite"></span></div>
    </form>
    <dl class="contacts">
      <div><dt>Телефон</dt><dd class="big"><a href="${telHref(k.phone)}">${E(k.phone)}</a>${k.phone2 ? `<br><a href="${telHref(k.phone2)}">${E(k.phone2)}</a>` : ''}</dd></div>
      <div><dt>Адрес</dt><dd>${E(k.address)}<div class="coords">${E(k.coords)}</div><div style="margin-top:10px"><a class="more" style="margin:0" href="${E(safeUrl(k.mapUrl))}" target="_blank" rel="noopener">Открыть на Яндекс Картах</a></div></dd></div>
      <div><dt>Часы работы</dt><dd>${E(k.hours)}</dd></div>
      <div><dt>ВКонтакте</dt><dd><a href="${E(safeUrl(k.vk))}" target="_blank" rel="noopener">${E(String(k.vk).replace(/^https?:\/\//, ''))}</a></dd></div>
      <div><dt>Удобства</dt><dd><ul class="amen">${k.amenities.map(a => `<li>${E(a)}</li>`).join('')}</ul></dd></div>
    </dl>
  </div>
</section>
</main>
<div class="mobile-dock"><a href="${telHref(k.phone)}">Позвонить</a><a href="#booking">Записаться на сервис</a></div><footer><div class="wrap"><a class="footer-logo" href="#top">${E(b.short)}<span>АВТОСЕРВИС · ${E(b.city)}</span></a><span>${E(C.footer.legal)}</span><span><a href="${adminHref()}">Вход для сотрудников</a></span></div></footer>`;
  }

  async function mountPhotos(root) {
    const grid = root.querySelector('.photo-grid'), status = root.querySelector('.photo-status');
    try {
      const response = await fetch('photos/photos.json');
      if (!response.ok) throw new Error('photos');
      const photos = await response.json();
      photos.sort((a,b) => Number(b.file.includes('team-01')) - Number(a.file.includes('team-01')));
      if (!grid.isConnected) return;
      grid.innerHTML = photos.map((p,i) => `<button type="button" class="photo-tile" data-photo="${i}" aria-label="Открыть: ${E(p.caption)}"><img src="photos/${E(p.file.replace(/^photos\//,''))}" alt="${E(p.caption)}" loading="lazy"><span>${E(p.caption)}</span></button>`).join('');
      status.hidden = true;
      const dialog = document.createElement('dialog'); dialog.className = 'photo-lightbox';
      dialog.setAttribute('aria-label','Просмотр фотографий сервиса');
      dialog.innerHTML = '<button class="photo-close" aria-label="Закрыть">×</button><button class="photo-prev" aria-label="Предыдущее фото">‹</button><figure><img alt=""><figcaption></figcaption></figure><button class="photo-next" aria-label="Следующее фото">›</button>';
      root.append(dialog);
      let index = 0, opener = null;
      const show = i => { index = (i + photos.length) % photos.length; const p = photos[index]; dialog.querySelector('img').src = 'photos/' + p.file.replace(/^photos\//,''); dialog.querySelector('img').alt = p.caption; dialog.querySelector('figcaption').textContent = p.caption + ' · ' + (index+1) + ' / ' + photos.length; };
      const close = () => dialog.close();
      grid.addEventListener('click', e => { const tile = e.target.closest('[data-photo]'); if (!tile) return; opener = tile; show(Number(tile.dataset.photo)); dialog.showModal(); document.body.classList.add('photo-open'); });
      dialog.querySelector('.photo-close').onclick = close;
      dialog.querySelector('.photo-prev').onclick = () => show(index-1);
      dialog.querySelector('.photo-next').onclick = () => show(index+1);
      dialog.addEventListener('click', e => { if (e.target === dialog) close(); });
      dialog.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); show(index + (e.key === 'ArrowRight' ? 1 : -1)); } });
      dialog.addEventListener('close', () => { document.body.classList.remove('photo-open'); if (opener && opener.isConnected) opener.focus({preventScroll:true}); });
    } catch (e) { status.textContent = 'Не удалось загрузить фотографии. Попробуйте обновить страницу.'; }
  }

  function maskPhone(v) {
    let d = v.replace(/\D/g, ''); if (d[0] === '7' || d[0] === '8') d = d.slice(1); d = d.slice(0, 10);
    let o = ''; if (d.length) o = '+7 (' + d.slice(0, 3); if (d.length >= 3) o += ')'; if (d.length > 3) o += ' ' + d.slice(3, 6); if (d.length > 6) o += '-' + d.slice(6, 8); if (d.length > 8) o += '-' + d.slice(8, 10);
    return o;
  }

  function wire(root) {
    const toggle = $('.menu-toggle'), nav = $('#siteNav');
    toggle.addEventListener('click', () => { const open = toggle.getAttribute('aria-expanded') !== 'true'; toggle.setAttribute('aria-expanded', String(open)); nav.classList.toggle('open', open); });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { toggle.setAttribute('aria-expanded', 'false'); nav.classList.remove('open'); }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { toggle.setAttribute('aria-expanded', 'false'); nav.classList.remove('open'); } });
    root.querySelectorAll('[data-service]').forEach(a => a.addEventListener('click', () => {
      const sel = $('#f-service'); const v = a.dataset.service;
      if (!sel) return;
      if (![...sel.options].some(o => o.value === v || o.text === v)) { const o = document.createElement('option'); o.text = v; sel.add(o, 1); }
      sel.value = v;
    }));
    const phone = $('#f-phone');
    const validatePhone = () => phone.setCustomValidity(phone.value.replace(/\D/g, '').length === 11 ? '' : 'Введите полный номер телефона: 10 цифр после +7');
    phone.addEventListener('input', () => { phone.value = maskPhone(phone.value); validatePhone(); });
    phone.addEventListener('blur', validatePhone);
    const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); $('#f-date').min = d.toISOString().slice(0, 10);

    const form = $('#leadForm'), msg = $('#formMsg');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (form.getAttribute('aria-busy') === 'true') return;
      validatePhone(); if (!form.reportValidity()) return;
      msg.className = 'msg'; msg.textContent = 'Отправляем заявку…';
      const fd = new FormData(form); const body = Object.fromEntries(fd.entries()); body.consent = $('#f-consent').checked;
      const btn = form.querySelector('button[type=submit]'); btn.disabled = true; form.setAttribute('aria-busy', 'true');
      try {
        await A.submitLead(body);
        form.outerHTML = `<div class="done" role="status" tabindex="-1"><h3>Спасибо, ${E(body.name)}</h3><p>${A.mode === 'demo' ? 'Это демонстрация: заявка сохранена только в этом браузере и не отправлена в автосервис.' : E(C.booking.success)}</p><p>Если нужно уточнить детали, позвоните: <a href="${telHref(C.contacts.phone)}">${E(C.contacts.phone)}</a>.</p></div>`;
        $('.done', root).focus();
      } catch (err) { msg.className = 'msg err'; msg.textContent = err.message; btn.disabled = false; form.removeAttribute('aria-busy'); }
    });

    /* 3D-стенд */
    const cam = $('#camber'), toe = $('#toe'), st = $('#alignState');
    const read = () => {
      const c = Number(cam.value), t = Number(toe.value);
      $('#camberOut').textContent = (c > 0 ? '+' : '') + c.toFixed(1) + '°'; $('#toeOut').textContent = (t > 0 ? '+' : '') + t.toFixed(2) + '°';
      let text, cls;
      if (Math.abs(c) <= 0.3 && Math.abs(t) <= 0.1) { text = 'Углы в допуске: колёса стоят ровно'; cls = 'ok'; }
      else { cls = 'bad'; const p = []; if (c < -0.3) p.push('износ внутреннего края шин'); if (c > 0.3) p.push('износ внешнего края шин'); if (Math.abs(t) > 0.1) p.push('быстрый износ протектора, руль может уводить'); text = 'Нужна регулировка: ' + p.join(', '); }
      st.className = 'state ' + cls; st.lastElementChild.textContent = text;
      if (align) align.set(c, t);
    };
    cam.addEventListener('input', read); toe.addEventListener('input', read);
    let anim = 0;
    root.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
      const [tc, tt] = b.dataset.preset.split(',').map(Number); const c0 = Number(cam.value), t0 = Number(toe.value); const t1 = performance.now(); cancelAnimationFrame(anim);
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { cam.value = tc; toe.value = tt; read(); return; }
      const step = now => { const k = Math.min(1, (now - t1) / 700), e = 1 - Math.pow(1 - k, 3); cam.value = c0 + (tc - c0) * e; toe.value = t0 + (tt - t0) * e; read(); if (k < 1) anim = requestAnimationFrame(step); };
      anim = requestAnimationFrame(step);
    }));
    read();
  }

  function mount3d() {
    const t = C.theme || {};
    const a = $('#stageDisc'), b = $('#stageAlign');
    if (t.enable3d === false || typeof THREE === 'undefined' || !window.Scenes) { if (a) a.classList.add('no3d'); b.classList.add('no3d'); return; }
    try { if (a) disc = Scenes.disc(a, { caliper: t.caliper, spin: Number(t.spin) }); } catch (e) { if (a) a.classList.add('no3d'); disc = null; }
    try { align = Scenes.align(b, { accent: t.accent }); align.set(Number($('#camber').value), Number($('#toe').value)); } catch (e) { b.classList.add('no3d'); align = null; }
  }

  function renderSite() {
    if (disc) { disc.destroy(); disc = null; } if (align) { align.destroy(); align = null; }
    applyTheme(); setMeta();
    const app = $('#app'); app.innerHTML = html(); wire(app); mount3d(); mountPhotos(app);
    rendered = true; dirty = false;
  }

  function applyRoute() {
    const adm = isAdminRoute();
    $('#app').hidden = adm; $('#admin').hidden = !adm;
    if (adm) {
      document.title = 'Админка — ' + C.brand.name;
      if (window.mountAdmin) window.mountAdmin($('#admin'));
      window.scrollTo(0, 0);
    } else if (!rendered || dirty) { renderSite(); }
    else { setMeta(); }
  }

  (async function boot() {
    try { C = await A.init(); } catch (e) { $('#app').innerHTML = '<div class="boot">' + E(e.message) + '</div>'; return; }
    applyTheme();
    applyRoute();
    addEventListener('hashchange', applyRoute);
  })();
})();
