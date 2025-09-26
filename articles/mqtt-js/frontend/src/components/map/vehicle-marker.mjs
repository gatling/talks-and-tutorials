import L from 'leaflet';

const ICON_SIZE = [42, 42];

export const STATUS_OPTIONS = ['running', 'idle', 'off'];

const STATUS_STYLES = {
  running: { accent: '#38bdf8', label: 'Running' },
  idle: { accent: '#facc15', label: 'Idle' },
  off: { accent: '#94a3b8', label: 'Off' },
  unknown: { accent: '#64748b', label: 'Unknown' }
};

const FUEL_BANDS = {
  high: { min: 60, color: '#22c55e', label: '60%+' },
  medium: { min: 30, color: '#f97316', label: '30-59%' },
  low: { min: 0, color: '#ef4444', label: '<30%' },
  unknown: { min: -Infinity, color: '#94a3b8', label: 'Unknown' }
};

const iconCache = new Map();

export function getFuelBandKey(value) {
  if (!Number.isFinite(value)) {
    return 'unknown';
  }
  if (value >= FUEL_BANDS.high.min) {
    return 'high';
  }
  if (value >= FUEL_BANDS.medium.min) {
    return 'medium';
  }
  if (value >= FUEL_BANDS.low.min) {
    return 'low';
  }
  return 'unknown';
}

export function getStatusKey(value) {
  if (typeof value !== 'string') {
    return 'unknown';
  }
  const normalised = value.trim().toLowerCase();
  if (!normalised || !STATUS_STYLES[normalised]) {
    return 'unknown';
  }
  return normalised;
}

export function createTruckIcon(fuelBandKey, statusKey) {
  const cacheKey = `${fuelBandKey}:${statusKey}`;
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey);
  }

  const band = FUEL_BANDS[fuelBandKey] || FUEL_BANDS.unknown;
  const status = STATUS_STYLES[statusKey] || STATUS_STYLES.unknown;
  const html = `
    <div class="vehicle-marker__wrapper" style="--fuel-color:${band.color}; --status-color:${status.accent};">
      <svg class="vehicle-marker__svg" viewBox="0 0 64 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <path d="M6 14c0-3.314 2.686-6 6-6h22c3.314 0 6 2.686 6 6v16H6V14z" fill="var(--fuel-color)" opacity="0.88" />
        <path d="M34 14h16c2.21 0 4 1.79 4 4v12H34V14z" fill="var(--fuel-color)" />
        <path d="M48 14h6c1.657 0 3 1.343 3 3v9h-9V14z" fill="var(--fuel-color)" opacity="0.85" />
        <path d="M6 30h51l3 4H6v-4z" fill="rgba(15, 23, 42, 0.15)" />
        <circle cx="18" cy="36" r="6" fill="#0f172a" stroke="#ffffff" stroke-width="2.5" />
        <circle cx="44" cy="36" r="6" fill="#0f172a" stroke="#ffffff" stroke-width="2.5" />
        <circle cx="49" cy="18" r="4" fill="var(--status-color)" stroke="#0f172a" stroke-width="2" />
        <rect x="12" y="22" width="22" height="3" rx="1.5" fill="rgba(15, 23, 42, 0.35)" />
      </svg>
    </div>
  `;
  const icon = L.divIcon({
    className: 'vehicle-marker leaflet-div-icon',
    html: html.trim(),
    iconSize: ICON_SIZE,
    iconAnchor: [ICON_SIZE[0] / 2, ICON_SIZE[1] - 10],
    popupAnchor: [0, -ICON_SIZE[1] + 10],
    tooltipAnchor: [0, -ICON_SIZE[1] + 8]
  });
  iconCache.set(cacheKey, icon);
  return icon;
}

export function updateMarkerAppearance(marker, { fuelLevel, engineStatus }) {
  if (!marker) {
    return null;
  }
  const fuelBandKey = getFuelBandKey(fuelLevel);
  const statusKey = getStatusKey(engineStatus);
  const icon = createTruckIcon(fuelBandKey, statusKey);
  marker.setIcon(icon);
  return `${fuelBandKey}:${statusKey}`;
}

export function createVehicleMarker(position, options = {}) {
  const marker = L.marker(position, {
    icon: createTruckIcon('unknown', 'unknown'),
    ...options
  });
  return marker;
}
