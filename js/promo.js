// Рекламне вікно: вилітає збоку, тримається кілька секунд і зникає. Раз за сесію.
(function () {
  var pop = document.getElementById('promo-pop');
  if (!pop) return;
  try { if (sessionStorage.getItem('promoSeen')) return; } catch (e) {}
  var timer;
  function hide() {
    pop.classList.remove('show');
    clearTimeout(timer);
    setTimeout(function () { pop.hidden = true; }, 600);
    try { sessionStorage.setItem('promoSeen', '1'); } catch (e) {}
  }
  function arm(ms) { clearTimeout(timer); timer = setTimeout(hide, ms); }
  setTimeout(function () {
    pop.hidden = false;
    requestAnimationFrame(function () { requestAnimationFrame(function () { pop.classList.add('show'); }); });
    arm(12000);
  }, 2500);
  pop.addEventListener('mouseenter', function () { clearTimeout(timer); });
  pop.addEventListener('mouseleave', function () { arm(4000); });
  pop.querySelector('.promo-x').addEventListener('click', hide);
  pop.querySelector('.promo').addEventListener('click', function () { try { sessionStorage.setItem('promoSeen', '1'); } catch (e) {} });
})();
