// Демо-версія JMkukirin без сервера: кошик у localStorage, пошук і сортування в браузері,
// Нова Пошта — напряму з API (довідники міст і відділень відкриті).
(function () {
  var ROOT = document.documentElement.dataset.root || './';
  var LS = { get: function (k, d) { try { return JSON.parse(localStorage.getItem('jm_' + k)) || d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('jm_' + k, JSON.stringify(v)); } catch (e) {} } };
  var money = function (k) { return (k / 100).toLocaleString('uk-UA', { minimumFractionDigits: k % 100 ? 2 : 0, maximumFractionDigits: 2 }).replace(/\s/g, ' ') + ' ₴'; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var productsP = null;
  function products() { return productsP || (productsP = fetch(ROOT + 'js/products.json').then(function (r) { return r.json(); })); }

  // ---------- Нова Пошта без сервера: підміняємо /np/... для np-picker.js ----------
  var NP = 'https://api.novaposhta.ua/v2.0/json/', whCache = {};
  function np(method, props) {
    return fetch(NP, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ apiKey: '', modelName: 'AddressGeneral', calledMethod: method, methodProperties: props }) })
      .then(function (r) { return r.json(); }).then(function (j) { if (!j.success) throw new Error('Нова Пошта не відповідає. Спробуйте ще раз.'); return j; });
  }
  var norm = function (s) { return String(s || '').toLowerCase().replace(/[’'`ʼ]/g, '').replace(/\s+/g, ' ').trim(); };
  function cities(q) {
    if (q.length < 2) return Promise.resolve([]);
    return np('getCities', { FindByString: q, Limit: '20' }).then(function (j) {
      var key = norm(q);
      return j.data.map(function (c) { return { ref: c.Ref, name: c.Description, area: c.AreaDescription ? c.AreaDescription + ' обл.' : '', type: c.SettlementTypeDescription || '' }; })
        .sort(function (a, b) { return (norm(b.name) === key) - (norm(a.name) === key) || (a.type === 'місто' ? -1 : 0) - (b.type === 'місто' ? -1 : 0); });
    });
  }
  function warehouses(city) {
    if (whCache[city]) return whCache[city];
    return (whCache[city] = np('getWarehouses', { CityRef: city, Limit: '500', Page: '1' }).then(function (j) {
      return j.data.filter(function (w) { return !w.WarehouseStatus || w.WarehouseStatus === 'Working'; }).map(function (w) {
        return { ref: w.Ref, kind: w.CategoryOfWarehouse === 'Postomat' ? 'postomat' : 'branch', number: Number(w.Number) || 0, name: w.Description };
      }).sort(function (a, b) { return a.number - b.number; });
    }));
  }
  var realFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    var u = typeof url === 'string' ? url : '';
    var json = function (p) { return p.then(function (d) { return new Response(JSON.stringify(d), { headers: { 'content-type': 'application/json' } }); },
      function (e) { return new Response(JSON.stringify({ error: e.message }), { status: 502, headers: { 'content-type': 'application/json' } }); }); };
    if (u.indexOf('/np/cities') === 0) return json(cities(new URL(u, location.href).searchParams.get('q') || ''));
    if (u.indexOf('/np/warehouses') === 0) {
      var sp = new URL(u, location.href).searchParams, kind = sp.get('kind'), s = norm(sp.get('q')).replace(/^№\s*/, '');
      return json(warehouses(sp.get('city')).then(function (list) {
        list = list.filter(function (w) { return !kind || w.kind === kind; });
        if (!s) return list.slice(0, 50);
        var num = /^\d+$/.test(s);
        return list.filter(function (w) { return num ? String(w.number).indexOf(s) === 0 : norm(w.name).indexOf(s) >= 0; }).slice(0, 50);
      }));
    }
    return realFetch(url, opts);
  };

  // ---------- кошик ----------
  var cart = function () { return LS.get('cart', {}); };
  function setCart(c) { LS.set('cart', c); badge(); }
  function badge() {
    var n = 0, c = cart(); for (var k in c) n += c[k];
    var btn = document.querySelector('.cart-btn'); if (!btn) return;
    var el = btn.querySelector('.cart-count');
    if (!n) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('span'); el.className = 'cart-count'; btn.appendChild(el); }
    el.textContent = n; btn.setAttribute('aria-label', 'Кошик, товарів: ' + n);
  }
  function flash(type, text) {
    var main = document.querySelector('main'), old = main.querySelector(':scope > .flash.demo');
    if (old) old.remove();
    var d = document.createElement('div'); d.className = 'flash demo ' + type; d.textContent = text;
    main.insertBefore(d, main.firstChild); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  var DEMO_MSG = 'Це демо-версія: вхід, кабінет і оплата працюють на повній версії сайту.';

  function renderCart() {
    var main = document.querySelector('main');
    products().then(function (list) {
      var c = cart(), items = list.filter(function (p) { return c[p.id]; }).map(function (p) { return Object.assign({ qty: Math.min(c[p.id], p.stock) }, p); });
      if (!items.length) return;
      var total = items.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
      main.innerHTML = '<h1>Кошик</h1><div class="cart">' + items.map(function (i) {
        var href = ROOT + 'product/' + i.slug + '/', img = i.image_url ? ROOT + i.image_url.replace(/^\//, '') : ROOT + 'img/part.svg';
        return '<div class="cart-item"><a class="cart-img" href="' + href + '"><img src="' + esc(img) + '" alt="" width="72" height="72"></a><div class="cart-main">' +
          '<a class="cart-name" href="' + href + '">' + esc(i.name) + '</a><span class="muted">' + money(i.price) + ' за шт.</span>' +
          '<div class="cart-ctrl"><div class="stepper"><button aria-label="Менше" data-qty="' + i.id + ':' + (i.qty - 1) + '">−</button><span aria-live="polite">' + i.qty + '</span>' +
          '<button aria-label="Більше" data-qty="' + i.id + ':' + Math.min(i.qty + 1, i.stock) + '"' + (i.qty >= i.stock ? ' disabled' : '') + '>+</button></div>' +
          '<b class="cart-sum">' + money(i.price * i.qty) + '</b></div><button class="link-btn" data-qty="' + i.id + ':0">Видалити</button></div></div>';
      }).join('') + '</div><div class="cart-total"><span>Разом</span><b>' + money(total) + '</b></div><a class="btn wide" href="' + ROOT + 'checkout/">Оформити замовлення</a>';
    });
  }
  function bindCart() {
    document.querySelector('main').addEventListener('click', function (e) {
      var b = e.target.closest('[data-qty]'); if (!b) return;
      var parts = b.dataset.qty.split(':'), c = cart();
      if (Number(parts[1]) <= 0) delete c[parts[0]]; else c[parts[0]] = Number(parts[1]);
      setCart(c);
      if (!Object.keys(c).length) location.reload(); else renderCart();
    });
  }

  function renderCheckout() {
    var aside = document.querySelector('.summary');
    products().then(function (list) {
      var c = cart(), items = list.filter(function (p) { return c[p.id]; }).map(function (p) { return Object.assign({ qty: Math.min(c[p.id], p.stock) }, p); });
      if (!items.length) { location.replace(ROOT + 'cart/'); return; }
      var total = items.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
      aside.innerHTML = '<h3>Ваше замовлення</h3>' + items.map(function (i) { return '<div class="row"><span>' + esc(i.name) + ' × ' + i.qty + '</span><b>' + money(i.price * i.qty) + '</b></div>'; }).join('') +
        '<div class="row big"><span>До сплати</span><b>' + money(total) + '</b></div><p class="muted">Доставка — за тарифами Нової Пошти.</p>';
    });
  }

  // ---------- каталог: пошук і сортування в браузері ----------
  function catalog() {
    var sp = new URLSearchParams(location.search), q = (sp.get('q') || '').trim(), sort = sp.get('sort') || '';
    var grid = document.querySelector('.catalog .grid'); if (!grid) return;
    var sel = document.querySelector('.filters select[name=sort]'); if (sel) sel.value = sort;
    if (q) {
      var h = document.querySelector('main h1'); h.textContent = h.textContent + ' · «' + q + '»';
      document.querySelectorAll('.search input[name=q]').forEach(function (i) { i.value = q; });
    }
    if (!q && !sort) return;
    products().then(function (list) {
      var by = {}; list.forEach(function (p) { by[p.slug] = p; });
      var cards = [].slice.call(grid.children).map(function (a) { return { el: a, p: by[a.getAttribute('href').split('/').filter(Boolean).pop()] }; }).filter(function (x) { return x.p; });
      var qq = norm(q), shown = 0;
      cards.forEach(function (x) { var ok = !qq || norm(x.p.name + ' ' + x.p.sku).indexOf(qq) >= 0; x.el.hidden = !ok; if (ok) shown++; });
      if (sort === 'price_asc' || sort === 'price_desc') cards.sort(function (a, b) { return sort === 'price_asc' ? a.p.price - b.p.price : b.p.price - a.p.price; }).forEach(function (x) { grid.appendChild(x.el); });
      if (!shown && !grid.parentNode.querySelector('.empty')) { var e = document.createElement('p'); e.className = 'empty'; e.textContent = 'Нічого не знайдено. Спробуйте інший запит.'; grid.parentNode.insertBefore(e, grid); }
    });
  }

  // «Підходить до вашого …» — як на живому сайті після вибору моделі
  function productFit() {
    var my = LS.get('model', null), box = document.querySelector('.compat-box'); if (!my || !box || document.querySelector('.fit')) return;
    var tag = [].slice.call(box.querySelectorAll('.tags a')).find(function (a) { var mt = /m--([a-z0-9-]+)\/?$/.exec(a.getAttribute('href')); return mt && mt[1] === my.slug; });
    var d = document.createElement('div');
    d.className = 'fit ' + (tag ? 'ok' : 'no');
    d.innerHTML = tag ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg><b>Підходить до вашого ' + esc(my.name) + '</b>'
      : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg><span><b>Для ' + esc(my.name) + ' сумісність не вказана.</b> Перевірте список нижче або запитайте нас.</span>';
    box.parentNode.insertBefore(d, box);
  }
  function rememberModel(slug, name) { if (slug) LS.set('model', { slug: slug, name: name }); }

  // ---------- форми ----------
  document.addEventListener('submit', function (e) {
    var f = e.target, act = f.dataset.action;
    if (!act || e.defaultPrevented) return;
    e.preventDefault();
    var fd = new FormData(f);
    if (act === '/catalog') {
      var cat = fd.get('cat') || '', model = fd.get('model') || '', q = fd.get('q') || new URLSearchParams(location.search).get('q') || '', sort = fd.get('sort') || '';
      if (model) { var opt = f.querySelector('[name=model] option:checked') || f.querySelector('[name=model]:checked + span'); rememberModel(model, opt ? opt.textContent.trim() : model); }
      var seg = cat && model ? cat + '--' + model : cat || (model ? 'm--' + model : '');
      var qs = new URLSearchParams(); if (q) qs.set('q', q); if (sort) qs.set('sort', sort);
      location.href = ROOT + 'catalog/' + (seg ? seg + '/' : '') + (qs.toString() ? '?' + qs : '');
    } else if (act === '/cart/add') {
      products().then(function (list) {
        var id = String(fd.get('id')), p = list.find(function (x) { return String(x.id) === id; }); if (!p) return;
        var c = cart(), want = (c[id] || 0) + Math.max(1, parseInt(fd.get('qty'), 10) || 1), max = Math.min(99, p.stock);
        c[id] = Math.min(want, max); setCart(c);
        flash('ok', want > max ? 'Додано в кошик. У наявності лише ' + max + ' шт.' : 'Додано в кошик');
      });
    } else if (act === '/checkout') {
      if (e.submitter && e.submitter.name === 'apply_promo') {
        var row = f.querySelector('.promo-row'), m = f.querySelector('.promo-msg') || document.createElement('p');
        m.className = 'promo-msg err'; m.textContent = 'У демо промокоди не перевіряються. На повній версії тут одразу видно знижку.';
        row.parentNode.after(m); return;
      }
      var main = document.querySelector('main');
      main.innerHTML = '<div class="center-box"><h1>Дякуємо!</h1><p>Так виглядає завершення замовлення. Це демо, тому замовлення не створено і нікуди не надіслано.</p>' +
        '<p>На повній версії номер замовлення одразу приходить у Telegram-бот магазину, а коли посилку відправлять, там же з\'являється ТТН.</p><a class="btn" href="' + ROOT + 'catalog/">До каталогу</a></div>';
      setCart({}); window.scrollTo(0, 0);
    } else flash('err', DEMO_MSG);
  });
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href="#demo"]'); if (!a) return;
    e.preventDefault(); flash('err', DEMO_MSG);
  });
  document.addEventListener('change', function (e) {
    if (e.target.name === 'model' && e.target.type === 'radio') rememberModel(e.target.value, e.target.nextElementSibling ? e.target.nextElementSibling.textContent.trim() : e.target.value);
  });

  document.addEventListener('DOMContentLoaded', function () {
    badge();
    var p = location.pathname;
    // зайшли на сторінку моделі — запам'ятовуємо її, як сайт
    var mm = /\/catalog\/(?:[a-z0-9-]+--|m--)([a-z0-9-]+)\/?$/.exec(p);
    if (mm) { var o = document.querySelector('.filters [name=model] option:checked'); rememberModel(mm[1], o ? o.textContent.trim() : mm[1]); }
    if (/\/cart\/?$/.test(p)) { bindCart(); renderCart(); }
    else if (/\/checkout\/?$/.test(p)) renderCheckout();
    else if (/\/catalog\//.test(p)) catalog();
    else if (/\/product\//.test(p)) productFit();
  });
})();
