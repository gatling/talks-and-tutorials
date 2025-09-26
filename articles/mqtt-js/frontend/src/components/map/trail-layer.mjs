import L from 'leaflet';

export function createTrailPolyline(positions = []) {
  return L.polyline(positions, {
    color: '#38bdf8',
    weight: 2,
    opacity: 0.8,
    lineJoin: 'round'
  });
}

export function trimTrail(trail, maxLength) {
  if (!Array.isArray(trail) || trail.length <= maxLength) {
    return trail;
  }
  return trail.slice(trail.length - maxLength);
}
