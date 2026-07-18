export function setupUI({ onEnter, controls }) {
  const overlay = document.getElementById('overlay');
  const enterBtn = document.getElementById('enter-btn');
  const loadingText = document.getElementById('loading-text');
  const doorPrompt = document.getElementById('door-prompt');
  const lockHint = document.getElementById('lock-hint');
  const passwordOverlay = document.getElementById('password-overlay');
  const passwordInput = document.getElementById('secret-password');
  const passwordError = document.getElementById('password-error');
  const passwordSubmit = document.getElementById('password-submit');
  const passwordCancel = document.getElementById('password-cancel');

  enterBtn.disabled = true;
  let passwordDialogOpen = false;
  let onPasswordSubmit = null;

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
    if (!passwordDialogOpen) {
      overlay.classList.add('hidden');
    }
  });

  controls.addEventListener('unlock', () => {
    if (passwordDialogOpen) return;
    overlay.classList.remove('hidden');
    setLoading('Курсор отпущен. Нажмите «Войти в галерею», чтобы продолжить.', true);
    enterBtn.disabled = false;
  });

  function setDoorPromptVisible(visible) {
    doorPrompt.classList.toggle('hidden', !visible);
  }

  function setLockHintVisible(visible) {
    lockHint.classList.toggle('hidden', !visible);
  }

  function openPasswordDialog(submitHandler) {
    onPasswordSubmit = submitHandler;
    passwordDialogOpen = true;
    passwordError.textContent = '';
    passwordInput.value = '';
    passwordOverlay.classList.remove('hidden');
    passwordOverlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('hidden');
    setDoorPromptVisible(false);
    queueMicrotask(() => passwordInput.focus());
  }

  function closePasswordDialog() {
    passwordDialogOpen = false;
    onPasswordSubmit = null;
    passwordOverlay.classList.add('hidden');
    passwordOverlay.setAttribute('aria-hidden', 'true');
    passwordError.textContent = '';
    passwordInput.value = '';
    passwordSubmit.disabled = false;
  }

  function setPasswordError(message) {
    passwordError.textContent = message || '';
  }

  function setPasswordBusy(busy) {
    passwordSubmit.disabled = !!busy;
    passwordInput.disabled = !!busy;
  }

  async function trySubmitPassword() {
    if (!onPasswordSubmit || passwordSubmit.disabled) return;
    const password = passwordInput.value;
    setPasswordError('');
    setPasswordBusy(true);
    try {
      await onPasswordSubmit(password);
    } catch {
      setPasswordError('Неверный пароль');
      passwordInput.select();
    } finally {
      setPasswordBusy(false);
    }
  }

  passwordSubmit.addEventListener('click', () => {
    trySubmitPassword();
  });

  passwordCancel.addEventListener('click', () => {
    closePasswordDialog();
  });

  passwordInput.addEventListener('keydown', (e) => {
    if (e.code === 'Enter') {
      e.preventDefault();
      trySubmitPassword();
    } else if (e.code === 'Escape') {
      e.preventDefault();
      closePasswordDialog();
    }
  });

  return {
    setLoading,
    setReady,
    overlay,
    enterBtn,
    setDoorPromptVisible,
    setLockHintVisible,
    openPasswordDialog,
    closePasswordDialog,
    setPasswordError,
    isPasswordDialogOpen: () => passwordDialogOpen,
  };
}
