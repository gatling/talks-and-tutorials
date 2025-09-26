const STATUS_OPTIONS = ['running', 'idle', 'off'];

function normaliseStatusKey(value) {
  if (typeof value !== 'string') {
    return 'unknown';
  }
  const trimmed = value.trim().toLowerCase();
  return STATUS_OPTIONS.includes(trimmed) ? trimmed : 'unknown';
}

export function createFiltersPanel({
  fuelInput,
  fuelValueElement,
  statusButtons = [],
  toast = () => {}
} = {}) {
  const state = {
    minFuel: 0,
    statuses: new Set(STATUS_OPTIONS)
  };

  const subscribers = new Set();

  if (fuelInput) {
    const initialValue = Number(fuelInput.value);
    if (Number.isFinite(initialValue)) {
      state.minFuel = initialValue;
    }
    fuelInput.addEventListener('input', event => {
      const value = Number(event.target.value);
      state.minFuel = Number.isFinite(value) ? value : 0;
      updateFuelLabel();
      notify();
    });
  }

  updateFuelLabel();
  wireStatusButtons();

  function wireStatusButtons() {
    if (!Array.isArray(statusButtons) || statusButtons.length === 0) {
      return;
    }
    statusButtons.forEach(button => {
      button.addEventListener('click', () => {
        handleStatusToggle(button);
      });
    });
    updateStatusButtons();
  }

  function handleStatusToggle(button) {
    if (!button) {
      return;
    }
    const status = button.dataset?.status;
    if (!status) {
      return;
    }
    if (status === 'all') {
      if (state.statuses.size !== STATUS_OPTIONS.length) {
        state.statuses = new Set(STATUS_OPTIONS);
        updateStatusButtons();
        notify();
      }
      return;
    }

    const statusKey = normaliseStatusKey(status);
    if (statusKey === 'unknown') {
      return;
    }

    const isActive = state.statuses.has(statusKey);
    if (isActive && state.statuses.size === 1) {
      toast('At least one engine status must remain selected.', 'warn');
      return;
    }

    if (isActive) {
      state.statuses.delete(statusKey);
    } else {
      state.statuses.add(statusKey);
    }

    updateStatusButtons();
    notify();
  }

  function updateFuelLabel() {
    if (fuelValueElement) {
      fuelValueElement.textContent = `${state.minFuel}%`;
    }
    if (fuelInput) {
      fuelInput.value = String(state.minFuel);
    }
  }

  function updateStatusButtons() {
    if (!Array.isArray(statusButtons) || statusButtons.length === 0) {
      return;
    }

    const allActive = state.statuses.size === STATUS_OPTIONS.length;
    statusButtons.forEach(button => {
      const status = button.dataset?.status;
      if (status === 'all') {
        setStatusButtonState(button, allActive);
        return;
      }
      const key = normaliseStatusKey(status);
      const isActive = key !== 'unknown' && state.statuses.has(key);
      setStatusButtonState(button, isActive);
    });
  }

  function setStatusButtonState(button, isActive) {
    if (!button) {
      return;
    }
    button.classList.toggle('is-active', Boolean(isActive));
    button.setAttribute('aria-pressed', String(Boolean(isActive)));
  }

  function matches({ fuelLevel, engineStatus }) {
    const meetsFuel = fuelLevel === null || fuelLevel >= state.minFuel;
    const statusKey = engineStatus ? normaliseStatusKey(engineStatus) : null;
    return meetsFuel && (!statusKey || state.statuses.has(statusKey));
  }

  function onChange(handler) {
    if (typeof handler === 'function') {
      subscribers.add(handler);
      return () => subscribers.delete(handler);
    }
    return () => {};
  }

  function notify() {
    for (const handler of subscribers) {
      handler({ ...state });
    }
  }

  return {
    state,
    matches,
    onChange,
    updateStatusButtons,
    updateFuelLabel
  };
}
