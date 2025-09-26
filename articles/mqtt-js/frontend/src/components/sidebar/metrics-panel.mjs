export function createMetricsPanel({
  activeElement,
  rateElement,
  latencyElement,
  updatedElement
} = {}) {
  function updateActive({ visible, total }) {
    if (!activeElement) {
      return;
    }
    if (typeof total === 'number' && total > 0 && visible !== total) {
      activeElement.textContent = `${visible} / ${total}`;
    } else {
      activeElement.textContent = String(visible ?? 0);
    }
  }

  function updateRate(value) {
    if (!rateElement) {
      return;
    }
    if (typeof value === 'number') {
      rateElement.textContent = value.toFixed(2);
    }
  }

  function updateLatency(latencyMs) {
    if (!latencyElement) {
      return;
    }
    if (latencyMs === null || !Number.isFinite(latencyMs)) {
      latencyElement.textContent = '—';
      return;
    }
    latencyElement.textContent = `${Math.round(latencyMs)} ms`;
  }

  function markUpdated(timestamp = new Date()) {
    if (!updatedElement) {
      return;
    }
    const display = timestamp instanceof Date ? timestamp.toLocaleTimeString() : String(timestamp);
    updatedElement.textContent = display;
  }

  return {
    updateActive,
    updateRate,
    updateLatency,
    markUpdated
  };
}
