// Каталог: фільтри застосовуються одразу після вибору (кнопка лишається для роботи без JS).
(function () {
  var form = document.querySelector('form[data-autosubmit]');
  if (!form) return;
  form.addEventListener('change', function (e) {
    if (e.target.tagName === 'SELECT') form.requestSubmit ? form.requestSubmit() : form.submit();
  });
})();
