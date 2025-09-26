import {
  escapeHtml,
  formatEngineStatus,
  formatFuelLevel,
  formatSpeed,
  normaliseFiniteNumber,
  normaliseStatus
} from './utils/formatting.mjs';
import { createMapController } from './components/map/map-container.mjs';
import {
  createVehicleMarker,
  updateMarkerAppearance
} from './components/map/vehicle-marker.mjs';
import { createTrailPolyline, trimTrail } from './components/map/trail-layer.mjs';
import { createToastManager } from './components/ui/toast.mjs';
import { createFiltersPanel } from './components/sidebar/filters-panel.mjs';
import { createMetricsPanel } from './components/sidebar/metrics-panel.mjs';
import { createWebSocketClient, MESSAGE_TYPES } from './services/websocket-client.mjs';
import { createStatsClient } from './services/stats-client.mjs';
import { createFrameThrottler } from './utils/throttle.js';
import markerRetinaAsset from 'leaflet/dist/images/marker-icon-2x.png';
import markerAsset from 'leaflet/dist/images/marker-icon.png';
import markerShadowAsset from 'leaflet/dist/images/marker-shadow.png';
import './styles.css';

const config = window.APP_CONFIG || {};
const HTTP_BASE = trimTrailingSlash(config.httpBase || 'http://localhost:8080');
const WS_URL = config.wsUrl || `${HTTP_BASE.replace(/^http/i, 'ws')}/stream`;
const STATS_REFRESH_MS = config.statsRefreshMs ?? 5000;
const RENDER_THROTTLE_MS = config.renderThrottleMs ?? 250;
const TRAIL_LENGTH = config.trailLength ?? 20;
const CLUSTER_THRESHOLD = config.clusterThreshold ?? 200;
const MAX_LATENCY_SAMPLES = config.maxLatencySamples ?? 200;
const RENDER_BATCH_SIZE = Math.max(1, config.renderBatchSize ?? 200);
const TILE_URL = config.tileUrl || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const WS_PAYLOAD_VERSION = 1;
const DEBUG_RENDER = Boolean(config.debugRenderTimings);

const elements = {
  connection: document.getElementById('connection-status'),
  active: document.getElementById('metric-active'),
  rate: document.getElementById('metric-rate'),
  latency: document.getElementById('metric-latency'),
  statsUpdated: document.getElementById('stats-updated'),
  reconnectBtn: document.getElementById('reconnect-btn'),
  toastContainer: document.getElementById('toast-container'),
  filterFuel: document.getElementById('filter-fuel'),
  filterFuelValue: document.getElementById('filter-fuel-value'),
  filterStatusButtons: Array.from(document.querySelectorAll('.js-status-filter-btn'))
};

const toast = createToastManager({ container: elements.toastContainer });

const mapController = createMapController({
  tileUrl: TILE_URL,
  clusterThreshold: CLUSTER_THRESHOLD,
  markerAssets: {
    retina: markerRetinaAsset,
    standard: markerAsset,
    shadow: markerShadowAsset
  }
});

const metricsPanel = createMetricsPanel({
  activeElement: elements.active,
  rateElement: elements.rate,
  latencyElement: elements.latency,
  updatedElement: elements.statsUpdated
});

const filtersPanel = createFiltersPanel({
  fuelInput: elements.filterFuel,
  fuelValueElement: elements.filterFuelValue,
  statusButtons: elements.filterStatusButtons,
  toast: (message, variant) => toast.show(message, variant)
});

const frameThrottler = createFrameThrottler();

const vehicles = new Map();
const latencySamples = [];
const updateQueue = [];
let lastFlushTimestamp = 0;
let statsFailureNotified = false;

const statsClient = createStatsClient({
  baseUrl: HTTP_BASE,
  intervalMs: STATS_REFRESH_MS,
  onData: handleStatsUpdate,
  onError: handleStatsError,
  logger: console
});

const websocketClient = createWebSocketClient({
  url: WS_URL,
  version: WS_PAYLOAD_VERSION,
  onUpdate: payload => enqueueUpdate({ data: payload, receivedAt: Date.now() }),
  onRemove: handleRemovalMessage,
  onError: () => toast.show('WebSocket error occurred. Attempting to reconnect…', 'error'),
  onStatusChange: setConnectionStatus,
  logger: console
});

filtersPanel.onChange(() => {
  applyFilters();
  refreshMetrics();
});

if (elements.reconnectBtn) {
  elements.reconnectBtn.addEventListener('click', () => {
    toast.show('Reconnecting WebSocket…', 'info');
    websocketClient.reconnect();
  });
}

websocketClient.connect();
statsClient.start();
refreshMetrics();

function enqueueUpdate(entry) {
  updateQueue.push(entry);
  scheduleFlush();
}

function scheduleFlush() {
  if (updateQueue.length === 0) {
    return;
  }
  frameThrottler.schedule(flushUpdates, RENDER_THROTTLE_MS);
}

function flushUpdates(frameTime = getNow()) {
  if (frameTime - lastFlushTimestamp < RENDER_THROTTLE_MS) {
    scheduleFlush();
    return;
  }
  lastFlushTimestamp = frameTime;

  const batch = takeNextBatch(RENDER_BATCH_SIZE);
  if (batch.length === 0) {
    if (updateQueue.length > 0) {
      scheduleFlush();
    }
    return;
  }

  const aggregated = new Map();
  for (const entry of batch) {
    const vehicleId = entry?.data?.vehicleId;
    if (typeof vehicleId !== 'string') {
      continue;
    }
    let bucket = aggregated.get(vehicleId);
    if (!bucket) {
      bucket = [];
      aggregated.set(vehicleId, bucket);
    }
    bucket.push(entry);
  }

  let processedVehicles = 0;
  const frameStart = DEBUG_RENDER ? getNow() : 0;
  for (const entries of aggregated.values()) {
    if (applyAggregatedUpdates(entries)) {
      processedVehicles += 1;
    }
  }

  if (processedVehicles > 0) {
    refreshMetrics();
    mapController.updateClusterMode(countVisibleVehicles());
    mapController.clusterGroup.refreshClusters();
    if (DEBUG_RENDER) {
      const frameDuration = getNow() - frameStart;
      console.debug(
        `[frontend] processed ${processedVehicles} vehicles in ${frameDuration.toFixed(2)}ms (batch size: ${batch.length})`
      );
    }
  }

  if (updateQueue.length > 0) {
    scheduleFlush();
  }
}

function takeNextBatch(limit) {
  if (limit <= 0 || updateQueue.length === 0) {
    return [];
  }
  const count = Math.min(limit, updateQueue.length);
  return updateQueue.splice(0, count);
}

function applyAggregatedUpdates(entries) {
  const normalised = [];
  for (const entry of entries) {
    const result = normaliseUpdate(entry);
    if (result) {
      normalised.push(result);
    }
  }
  if (normalised.length === 0) {
    return false;
  }

  const latest = normalised[normalised.length - 1];
  let record = vehicles.get(latest.vehicleId);
  if (!record) {
    record = createVehicle(latest.vehicleId, latest.position);
  }

  for (const update of normalised) {
    record.trail.push(update.position);
    record.trail = trimTrail(record.trail, TRAIL_LENGTH);
    if (update.timestamp) {
      record.lastTimestamp = update.timestamp;
    }
    if (update.speed !== null) {
      record.lastSpeed = update.speed;
    }
    if (update.fuelLevel !== null) {
      record.lastFuelLevel = update.fuelLevel;
    }
    if (update.engineStatus !== null) {
      record.lastEngineStatus = update.engineStatus;
    }
    if (update.latencyMs !== null) {
      addLatencySample(update.latencyMs);
    }
  }

  record.marker.setLatLng(latest.position);
  record.polyline.setLatLngs(record.trail);
  updateMarkerAppearance(record.marker, {
    fuelLevel: record.lastFuelLevel,
    engineStatus: record.lastEngineStatus
  });
  record.marker.setPopupContent(renderPopup(record));
  record.marker.setTooltipContent(renderTooltip(record));

  updateEntryVisibility(record);
  return true;
}

function normaliseUpdate(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const { data, receivedAt } = entry;
  if (!data || typeof data !== 'object') {
    return null;
  }

  const { vehicleId, position, telemetry = {}, filters = {} } = data;
  if (typeof vehicleId !== 'string') {
    return null;
  }

  const latNum = Number(position?.lat);
  const lngNum = Number(position?.lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return null;
  }

  const timestampIso = telemetry.timestamp ?? null;
  const timestamp = timestampIso ? new Date(timestampIso) : null;
  const latencyMs = timestamp && !Number.isNaN(timestamp.valueOf())
    ? Math.max(0, receivedAt - timestamp.getTime())
    : null;

  return {
    vehicleId,
    position: [latNum, lngNum],
    timestamp,
    latencyMs,
    speed: normaliseFiniteNumber(telemetry.speed),
    fuelLevel: normaliseFiniteNumber(telemetry.fuelLevel),
    engineStatus: normaliseStatus(filters.engineStatus ?? telemetry.engineStatus),
    raw: data
  };
}

function createVehicle(vehicleId, initialPosition) {
  const marker = createVehicleMarker(initialPosition);
  const polyline = createTrailPolyline([]);
  marker.bindPopup('', { closeButton: true });
  marker.bindTooltip('', { direction: 'top', offset: [0, -32], permanent: false });

  const record = {
    vehicleId,
    marker,
    polyline,
    trail: Array.isArray(initialPosition) ? [initialPosition] : [],
    lastTimestamp: null,
    lastSpeed: null,
    lastFuelLevel: null,
    lastEngineStatus: null,
    visible: false
  };

  vehicles.set(vehicleId, record);
  return record;
}

function updateEntryVisibility(entry) {
  const shouldShow = filtersPanel.matches({
    fuelLevel: entry.lastFuelLevel,
    engineStatus: entry.lastEngineStatus
  });

  if (shouldShow && !entry.visible) {
    mapController.clusterGroup.addLayer(entry.marker);
    mapController.trailLayer.addLayer(entry.polyline);
    entry.visible = true;
    mapController.applyInitialViewport(getVisibleLatLngs());
  } else if (!shouldShow && entry.visible) {
    mapController.clusterGroup.removeLayer(entry.marker);
    mapController.trailLayer.removeLayer(entry.polyline);
    entry.marker.closePopup();
    entry.visible = false;
  }
}

function handleRemovalMessage(payload) {
  if (payload.version !== WS_PAYLOAD_VERSION || payload.type !== MESSAGE_TYPES.REMOVE) {
    return;
  }
  const vehicleId = typeof payload.vehicleId === 'string' ? payload.vehicleId : null;
  if (!vehicleId) {
    return;
  }
  const record = vehicles.get(vehicleId);
  if (!record) {
    return;
  }

  mapController.clusterGroup.removeLayer(record.marker);
  mapController.trailLayer.removeLayer(record.polyline);
  record.marker.remove();
  record.polyline.remove();
  vehicles.delete(vehicleId);

  if (vehicles.size === 0) {
    mapController.resetViewport();
  }

  refreshMetrics();
  mapController.updateClusterMode(countVisibleVehicles());
}

function handleStatsUpdate(stats) {
  if (typeof stats.messageRatePerSecond === 'number') {
    metricsPanel.updateRate(stats.messageRatePerSecond);
  }
  metricsPanel.markUpdated(new Date());
  statsFailureNotified = false;
}

function handleStatsError() {
  if (!statsFailureNotified) {
    toast.show('Unable to fetch /stats from backend.', 'warn');
    statsFailureNotified = true;
  }
}

function refreshMetrics() {
  metricsPanel.updateActive({
    visible: countVisibleVehicles(),
    total: vehicles.size
  });
  metricsPanel.updateLatency(getAverageLatency());
}

function applyFilters() {
  for (const entry of vehicles.values()) {
    updateEntryVisibility(entry);
  }
  mapController.updateClusterMode(countVisibleVehicles());
}

function countVisibleVehicles() {
  let count = 0;
  for (const entry of vehicles.values()) {
    if (entry.visible) {
      count += 1;
    }
  }
  return count;
}

function getVisibleLatLngs() {
  const positions = [];
  for (const entry of vehicles.values()) {
    if (entry.visible) {
      positions.push(entry.marker.getLatLng());
    }
  }
  return positions;
}

function renderPopup(record) {
  const safeId = escapeHtml(record.vehicleId);
  const speedText = formatSpeed(record.lastSpeed ?? Number.NaN);
  const timeText = record.lastTimestamp && !Number.isNaN(record.lastTimestamp.valueOf())
    ? record.lastTimestamp.toLocaleString()
    : 'Unknown time';
  const fuelText = formatFuelLevel(record.lastFuelLevel ?? Number.NaN);
  const engineText = formatEngineStatus(record.lastEngineStatus ?? '');
  return `
    <strong>${safeId}</strong><br>
    <span>Speed: ${speedText}</span><br>
    <span>Fuel: ${fuelText}</span><br>
    <span>Engine: ${engineText}</span><br>
    <span>Updated: ${escapeHtml(timeText)}</span>
  `;
}

function renderTooltip(record) {
  const safeId = escapeHtml(record.vehicleId);
  const fuelText = escapeHtml(String(formatFuelLevel(record.lastFuelLevel ?? Number.NaN)));
  const engineText = escapeHtml(String(formatEngineStatus(record.lastEngineStatus ?? '')));
  const speedText = escapeHtml(String(formatSpeed(record.lastSpeed ?? Number.NaN)));
  return `
    <div class="vehicle-tooltip__content">
      <strong>${safeId}</strong>
      <div>Fuel: ${fuelText}</div>
      <div>Status: ${engineText}</div>
      <div>Speed: ${speedText}</div>
    </div>
  `.trim();
}

function addLatencySample(value) {
  if (!Number.isFinite(value)) {
    return;
  }
  latencySamples.push(value);
  if (latencySamples.length > MAX_LATENCY_SAMPLES) {
    latencySamples.shift();
  }
}

function getAverageLatency() {
  if (latencySamples.length === 0) {
    return null;
  }
  const sum = latencySamples.reduce((acc, value) => acc + value, 0);
  return sum / latencySamples.length;
}

function setConnectionStatus(status) {
  const el = elements.connection;
  if (!el) {
    return;
  }
  el.classList.remove('status--connected', 'status--disconnected', 'status--connecting');
  const labelMap = {
    connected: 'Connected',
    disconnected: 'Disconnected',
    connecting: 'Connecting…'
  };
  el.classList.add(`status--${status}`);
  el.textContent = labelMap[status] || status;
}

function trimTrailingSlash(value) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function getNow() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

window.addEventListener('beforeunload', () => {
  frameThrottler.cancel();
  statsClient.stop();
  websocketClient.destroy();
});
