export function createToastManager({ container, durationMs = 4000 } = {}) {
  function show(message, variant = 'info') {
    if (!container) {
      return;
    }
    const toast = document.createElement('div');
    toast.className = `toast toast--${variant}`;
    toast.textContent = message;
    container.appendChild(toast);

    const hideTimer = setTimeout(() => {
      toast.classList.add('toast--hide');
      const removeTimer = setTimeout(() => {
        toast.remove();
      }, 250);
      if (typeof removeTimer.unref === 'function') {
        removeTimer.unref();
      }
    }, durationMs);

    if (typeof hideTimer.unref === 'function') {
      hideTimer.unref();
    }
  }

  return {
    show
  };
}
