export function setupUI({ onEnter, controls }) {
  const overlay = document.getElementById('overlay');
  const enterBtn = document.getElementById('enter-btn');
  const loadingText = document.getElementById('loading-text');

  enterBtn.disabled = true;

  function setLoading(text, ready = false) {
    loadingText.textContent = text;
    loadingText.classList.toggle('ready', ready);
  }

  function setReady(photoCount) {
    enterBtn.disabled = false;
    const countText =
      typeof photoCount === 'number'
        ? `Загружено фото: ${photoCount}. Нажмите кнопку, чтобы войти.`
        : 'Готово. Нажмите кнопку, чтобы войти.';
    setLoading(countText, true);
  }

  enterBtn.addEventListener('click', () => {
    onEnter();
  });

  controls.addEventListener('lock', () => {
    overlay.classList.add('hidden');
  });

  controls.addEventListener('unlock', () => {
    overlay.classList.remove('hidden');
    setLoading('Курсор отпущен. Нажмите «Войти в галерею», чтобы продолжить.', true);
    enterBtn.disabled = false;
  });

  return { setLoading, setReady, overlay, enterBtn };
}
