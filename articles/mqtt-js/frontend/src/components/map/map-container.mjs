import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

function resolveBundledAsset(asset) {
  if (!asset) {
    return asset;
  }
  if (/^(?:https?:|data:|blob:)/i.test(asset) || asset.startsWith('/')) {
    return asset;
  }
  try {
    return new URL(asset, import.meta.url).toString();
  } catch (_err) {
    return asset;
  }
}

export function createMapController({
  mapContainerId = 'map',
  tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  clusterThreshold = 200,
  markerAssets = {},
  initialView = { lat: 48.8566, lng: 2.3522, zoom: 5 }
} = {}) {
  configureDefaultIcons(markerAssets);

  const map = L.map(mapContainerId, { preferCanvas: true });
  map.setView([initialView.lat, initialView.lng], initialView.zoom);

  L.tileLayer(tileUrl, {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);

  const clusterGroup = L.markerClusterGroup({
    chunkedLoading: true,
    chunkInterval: 200,
    disableClusteringAtZoom: 16,
    maxClusterRadius: 0
  });

  const trailLayer = L.layerGroup();

  map.addLayer(clusterGroup);
  map.addLayer(trailLayer);

  let currentThreshold = clusterThreshold;
  let initialViewportSettled = false;

  function updateClusterMode(visibleCount) {
    const shouldCluster = visibleCount > currentThreshold;
    const desiredRadius = shouldCluster ? 80 : 0;
    if (clusterGroup.options.maxClusterRadius !== desiredRadius) {
      clusterGroup.options.maxClusterRadius = desiredRadius;
      clusterGroup.refreshClusters();
    }
  }

  function setClusterThreshold(value) {
    if (typeof value === 'number' && value >= 0) {
      currentThreshold = value;
    }
  }

  function resetViewport() {
    initialViewportSettled = false;
  }

  function applyInitialViewport(latLngs) {
    if (initialViewportSettled || !Array.isArray(latLngs) || latLngs.length === 0) {
      return;
    }
    if (latLngs.length === 1) {
      map.setView(latLngs[0], 12);
      return;
    }
    const bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds.pad(0.25));
    initialViewportSettled = true;
  }

  return {
    map,
    clusterGroup,
    trailLayer,
    updateClusterMode,
    setClusterThreshold,
    applyInitialViewport,
    resetViewport
  };
}

function configureDefaultIcons({ retina, standard, shadow } = {}) {
  const markerRetinaUrl = resolveBundledAsset(retina);
  const markerUrl = resolveBundledAsset(standard);
  const markerShadowUrl = resolveBundledAsset(shadow);

  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerRetinaUrl,
    iconUrl: markerUrl,
    shadowUrl: markerShadowUrl
  });
}
