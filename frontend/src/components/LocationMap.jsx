import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const valid = value => value?.type === 'Point' && Array.isArray(value.coordinates) && value.coordinates.length === 2 && value.coordinates.every(Number.isFinite) && Math.abs(value.coordinates[0]) <= 180 && Math.abs(value.coordinates[1]) <= 90;
const toLatLng = value => [value.coordinates[1], value.coordinates[0]];
const defaultView = [13.43, -16.68];

export default function LocationMap({ value, onChange, readOnly = false }) {
  const root = useRef(null), map = useRef(null), marker = useRef(null), change = useRef(onChange), initial = useRef(value);
  const [tileError, setTileError] = useState(false);
  useEffect(() => { change.current = onChange; }, [onChange]);
  useEffect(() => {
    const canvas = root.current;
    const instance = L.map(canvas, { scrollWheelZoom: false, worldCopyJump: true, maxZoom: 19 });
    map.current = instance;
    instance.setView(valid(initial.current) ? toLatLng(initial.current) : defaultView, valid(initial.current) ? 16 : 10);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      referrerPolicy: 'strict-origin-when-cross-origin',
    }).addTo(instance);
    tiles.on('tileerror', () => setTileError(true));
    tiles.on('tileload', () => setTileError(false));
    const choose = latlng => {
      // Leaflet displays repeated worlds; normalize only points outside GeoJSON bounds.
      const point = latlng.lng < -180 || latlng.lng > 180 ? latlng.wrap() : latlng;
      if (Math.abs(point.lat) > 90) return;
      change.current?.({ type: 'Point', coordinates: [point.lng, point.lat] });
    };
    instance.chooseLocation = choose;
    const click = event => choose(event.latlng);
    const key = event => {
      if (event.target !== canvas || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault(); choose(instance.getCenter());
    };
    if (!readOnly) { instance.on('click', click); canvas.addEventListener('keydown', key); }
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => instance.invalidateSize({ pan: false })) : null;
    observer?.observe(canvas);
    return () => {
      observer?.disconnect(); canvas.removeEventListener('keydown', key);
      tiles.off(); instance.remove(); map.current = null; marker.current = null;
    };
  }, [readOnly]);
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    if (!valid(value)) { marker.current?.remove(); marker.current = null; return; }
    const point = toLatLng(value);
    if (!marker.current) {
      marker.current = L.marker(point, {
        draggable: !readOnly, keyboard: true, title: 'Job location pin', alt: 'Job location pin',
        icon: L.divIcon({ className: 'location-pin', html: '<span></span>', iconSize: [28, 36], iconAnchor: [14, 36] }),
      }).addTo(instance);
      if (!readOnly) marker.current.on('dragend', () => instance.chooseLocation(marker.current.getLatLng()));
    } else marker.current.setLatLng(point);
    instance.setView(point, Math.max(instance.getZoom(), 16), { animate: false });
  }, [value, readOnly]);
  return <div className="location-map-wrap">
    <div ref={root} className="location-map" role="region" aria-label={readOnly ? 'Exact job location map' : 'Choose job location on map'} />
    {tileError && <p className="small muted" role="status">Map tiles could not load. {readOnly ? 'You can open the map using the link below.' : 'You can still place a pin or use your current location.'}</p>}
  </div>;
}
