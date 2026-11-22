// Вибір міста й відділення/поштомату Нової Пошти зі списку (без ручного вводу адреси).
(function () {
  var root = document.querySelector('[data-np]');
  if (!root) return;
  var form = root.closest('form');
  var cityIn = root.querySelector('#np-city'), cityRef = root.querySelector('[name=np_city_ref]');
  var whIn = root.querySelector('#np-wh'), whRef = root.querySelector('[name=np_warehouse_ref]');
  var kindBox = root.querySelector('.np-kind'), hint = root.querySelector('.np-hint');

  var wh;
  function kind() { var r = root.querySelector('[name=np_kind]:checked'); return r ? r.value : 'branch'; }
  function debounce(fn, ms) { var t; return function () { var a = arguments; clearTimeout(t); t = setTimeout(function () { fn.apply(null, a); }, ms); }; }

  function combo(input, list, load, render, onPick) {
    var items = [], active = -1, seq = 0;
    function open(v) { list.hidden = !v; input.setAttribute('aria-expanded', v ? 'true' : 'false'); }
    function setActive(i) {
      var opts = list.querySelectorAll('[role=option]');
      opts.forEach(function (o, k) { o.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
      active = i;
      if (opts[i]) { opts[i].scrollIntoView({ block: 'nearest' }); input.setAttribute('aria-activedescendant', opts[i].id); }
    }
    function show(msg) { list.innerHTML = '<li class="combo-msg">' + msg + '</li>'; open(true); }
    function fill(data) {
      items = data; active = -1; list.innerHTML = '';
      if (!data.length) return show('Нічого не знайдено. Перевірте написання.');
      data.forEach(function (d, i) {
        var li = document.createElement('li');
        li.id = list.id + '-' + i; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', 'false');
        render(li, d);
        li.addEventListener('mousedown', function (e) { e.preventDefault(); pick(i); });
        list.appendChild(li);
      });
      open(true);
    }
    function pick(i) { var d = items[i]; if (!d) return; open(false); onPick(d); }
    var run = debounce(function () {
      var my = ++seq;
      show('Шукаємо…');
      load(input.value.trim()).then(function (d) { if (my === seq) fill(d); })
        .catch(function (e) { if (my === seq) show(e.message || 'Помилка. Спробуйте ще раз.'); });
    }, 250);
    input.addEventListener('input', run);
    input.addEventListener('focus', function () { if (!input.disabled) run(); });
    input.addEventListener('blur', function () { setTimeout(function () { open(false); }, 120); });
    input.addEventListener('keydown', function (e) {
      if (list.hidden && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { run(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(active + 1, items.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(active - 1, 0)); }
      else if (e.key === 'Enter' && !list.hidden) { e.preventDefault(); pick(active < 0 ? 0 : active); }
      else if (e.key === 'Escape') open(false);
    });
    return { run: run };
  }

  function get(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (r) {
      return r.json().then(function (j) { if (!r.ok) throw new Error(j.error); return j; });
    });
  }
  function el(tag, cls, text) { var e = document.createElement(tag); e.className = cls; e.textContent = text; return e; }

  function resetWh(enabled) {
    whIn.value = ''; whRef.value = '';
    whIn.disabled = !enabled; kindBox.disabled = !enabled;
    whIn.placeholder = enabled ? (kind() === 'postomat' ? 'Номер поштомату або вулиця' : 'Номер відділення або вулиця') : 'Спершу оберіть місто';
  }

  combo(cityIn, root.querySelector('#np-city-list'),
    function (q) { return q.length < 2 ? Promise.resolve([]) : get('/np/cities?q=' + encodeURIComponent(q)); },
    function (li, c) { li.appendChild(el('span', 'combo-main', c.name)); li.appendChild(el('span', 'combo-sub', [c.type, c.area].filter(Boolean).join(', '))); },
    function (c) {
      cityIn.value = c.name; cityRef.value = c.ref; resetWh(true);
      hint.textContent = '';
      whIn.focus(); wh.run(); // одразу показуємо список відділень
    });
  cityIn.addEventListener('input', function () { if (cityRef.value) { cityRef.value = ''; resetWh(false); } });

  wh = combo(whIn, root.querySelector('#np-wh-list'),
    function (q) { return get('/np/warehouses?city=' + encodeURIComponent(cityRef.value) + '&kind=' + kind() + '&q=' + encodeURIComponent(q)); },
    function (li, w) {
      li.appendChild(el('span', 'combo-main', (w.kind === 'postomat' ? 'Поштомат №' : 'Відділення №') + w.number));
      li.appendChild(el('span', 'combo-sub', w.name.replace(/^[^:]*:\s*/, '')));
    },
    function (w) { whIn.value = w.name; whRef.value = w.ref; hint.textContent = ''; });
  whIn.addEventListener('input', function () { whRef.value = ''; });
  root.querySelectorAll('[name=np_kind]').forEach(function (r) {
    r.addEventListener('change', function () { resetWh(true); whIn.focus(); wh.run(); });
  });

  form.addEventListener('submit', function (e) {
    if (e.submitter && e.submitter.name === 'apply_promo') return;
    if (!cityRef.value) { e.preventDefault(); hint.textContent = 'Оберіть місто зі списку.'; cityIn.focus(); }
    else if (!whRef.value) { e.preventDefault(); hint.textContent = 'Оберіть відділення або поштомат зі списку.'; whIn.focus(); }
  });
})();
