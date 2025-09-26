const REGION_PRESETS = {
  paris: { name: 'Paris', lat: 48.8566, lng: 2.3522, radiusKm: 20 },
  london: { name: 'London', lat: 51.5072, lng: -0.1276, radiusKm: 22 },
  newyork: { name: 'New York', lat: 40.7128, lng: -74.006, radiusKm: 28 },
  singapore: { name: 'Singapore', lat: 1.3521, lng: 103.8198, radiusKm: 18 },
  tokyo: { name: 'Tokyo', lat: 35.6762, lng: 139.6503, radiusKm: 24 },
  sydney: { name: 'Sydney', lat: -33.8688, lng: 151.2093, radiusKm: 26 }
};

function resolveRegion(input, logger) {
  const slug = String(input || '').toLowerCase();
  if (REGION_PRESETS[slug]) {
    return { slug, ...REGION_PRESETS[slug] };
  }

  logger?.warn({ region: input }, 'Unknown region supplied, falling back to paris');
  return { slug: 'paris', ...REGION_PRESETS.paris };
}

module.exports = {
  REGION_PRESETS,
  resolveRegion
};
