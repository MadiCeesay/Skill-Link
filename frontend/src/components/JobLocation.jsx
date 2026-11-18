import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "./ui";
const LocationMap = lazy(() => import('./LocationMap'));

export function JobLocation({ value, onChange, mode = "job" }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  function locate() {
    const attempt = ++request.current;
    setMessage("");
    if (!navigator.geolocation) {
      setMessage(
        "Location sharing is unavailable. You can continue using your town or address.",
      );
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (request.current !== attempt) return;
        setBusy(false);
        onChange({
          type: "Point",
          coordinates: [coords.longitude, coords.latitude],
        });
      },
      () => {
        if (request.current !== attempt) return;
        setBusy(false);
        setMessage(
          "We couldn't access your location. You can continue using your town or address.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }
  function movePin(point) {
    request.current++;
    setBusy(false);
    setMessage('');
    onChange(point);
  }
  return (
    <div className="job-location">
      <p className="muted">
        {mode === "job"
          ? "Optional: tap the map to place a pin at the job site, or drag the pin to the right place."
          : mode === "base"
            ? "Optionally use your current position as your private work base to improve nearby matching."
            : "Optionally use your current position to find nearby professionals."}
      </p>
      {mode === 'job' && <>
        <Suspense fallback={<p className="muted" role="status">Loading map…</p>}><LocationMap value={value} onChange={movePin} /></Suspense>
        <small>Use the arrow keys to move the map, then press Enter to place the pin. Use your current location only when you are at the job site.</small>
      </>}
      {value && (
        <p className="success-text" role="status">
          {mode === "job" ? "Precise job location added." : "Location added."}
        </p>
      )}
      <div className="actions">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={locate}
        >
          <MapPin size={16} />
          {busy
            ? "Finding your location…"
            : value && mode !== 'job'
              ? "Change location"
              : "Use my current location"}
        </Button>
        {(value || busy) && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              request.current++;
              setBusy(false);
              setMessage("");
              onChange(null);
            }}
          >
            Remove location
          </Button>
        )}
      </div>
      {message && <p role="status">{message}</p>}
      <small>
        {mode === "job"
          ? "Exact job location becomes available to the professional after the booking is confirmed."
          : mode === "base"
            ? "Your exact work base remains private. Customers see your general service areas."
            : "Search results show approximate distance; professional base locations remain private."}
      </small>
    </div>
  );
}

export function JobLocationLink({ location }) {
  if (!location?.coordinates) return null;
  const [longitude, latitude] = location.coordinates;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return (
    <div className="booking-location-map">
    <Suspense fallback={<p className="muted" role="status">Loading map…</p>}><LocationMap value={location} readOnly /></Suspense>
    <a
      className="button outline"
      href={
        'https://www.openstreetmap.org/?mlat=' + latitude + '&mlon=' + longitude + '#map=16/' + latitude + '/' + longitude
      }
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
    >
      <MapPin size={16} />
      View job location
    </a>
    </div>
  );
}
