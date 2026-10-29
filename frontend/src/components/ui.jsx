import { useState, useRef, useEffect, useId, Component } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowRight,
  X,
  AlertCircle,
  RefreshCw,
  Check,
  Inbox,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Star,
  MapPin,
  Upload,
  FileText,
} from 'lucide-react';
import { useAction, useApi } from '../api/hooks';
import { upload, api } from '../api/client';
import { displayName, pricing, statusLabel, shortId } from '../utils/format';
export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="SkillLink home">
      <img
        className="brand-logo"
        src="/favicon.svg"
        alt=""
        aria-hidden="true"
      />
      <span className="brand-name">
        Skill<span>Link</span>
      </span>
    </Link>
  );
}
export function Button({
  to,
  children,
  variant = '',
  className = '',
  ...props
}) {
  const classes = 'button ' + variant + ' ' + className;
  return to ? (
    <Link className={classes} to={to} {...props}>
      {children}
    </Link>
  ) : (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
export function ArrowButton({ to, children, ...props }) {
  return (
    <Button to={to} {...props}>
      {children}
      <span className="button-arrow">
        <ArrowUpRight size={17} />
      </span>
    </Button>
  );
}
export function PageTitle({ eyebrow, title, description, children }) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}
export function Panel({
  title,
  description,
  children,
  className = '',
  action,
}) {
  return (
    <section className={'panel ' + className}>
      {(title || action) && (
        <header className="panel-head">
          <div>
            <h2>{title}</h2>
            {description && <p className="muted">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
export function Chip({ status, children }) {
  return (
    <span className={'chip ' + String(status || '').toLowerCase()}>
      {children || statusLabel(status)}
    </span>
  );
}
export function Badge({ children = 'Identity verified' }) {
  return (
    <span className="verified">
      <ShieldCheck size={14} />
      {children}
    </span>
  );
}
export function Avatar({ person, size = 'medium', src }) {
  return (
    <span className={'avatar ' + size}>
      {src ? (
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        (displayName(person) || 'SkillLink')
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
      )}
    </span>
  );
}
export function AccountAvatar({ person, size = 'medium' }) {
  const profile = useApi(
      person?.role === 'WORKER' ? '/workers/me/profile' : null,
    ),
    image = profile.data?.profile.profileImage,
    media = useApi(image ? '/media/' + image + '/access' : null, undefined, {
      staleTime: 40000,
    });
  return <Avatar person={person} size={size} src={media.data?.url} />;
}
export function Empty({
  title = 'Nothing here yet',
  description,
  action,
  icon: Icon = Inbox,
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={27} />
      </span>
      <h3>{title}</h3>
      <p>
        {description || 'New activity will appear here when it is available.'}
      </p>
      {action}
    </div>
  );
}
export function ErrorNotice({ error, retry }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!error?.retryAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [error?.retryAt]);
  const remaining = Math.max(0, Math.ceil(((error?.retryAt || 0) - now) / 1000));
  return (
    <div role="alert" className="error-notice">
      <AlertCircle size={20} />
      <div>
        <strong>
          {error?.status === 429
            ? 'Please give SkillLink a moment'
            : error?.status === 403
            ? 'This workspace is not available'
            : error?.status === 404
              ? 'We couldn’t find that item'
              : 'Something needs your attention'}
        </strong>
        <p>{error?.message || String(error || 'Please try again.')}</p>
        {remaining > 0 && <p>Try again in {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}. Refreshing repeatedly will not shorten the wait.</p>}
        {error?.details?.map((d, i) => (
          <p key={i}>
            {d.field?.replaceAll('.', ' ')}: {d.message}
          </p>
        ))}
      </div>
      {retry && (
          <button type="button" onClick={retry} className="icon-button" aria-label="Try again" disabled={remaining > 0}>
          <RefreshCw size={17} />
        </button>
      )}
    </div>
  );
}
export function Skeleton({ rows = 3 }) {
  return (
    <div className="skeleton-stack" aria-label="Loading content" role="status">
      {Array.from({ length: rows }, (_, i) => (
        <div className="skeleton" key={i}>
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}
export function QueryState({ query, children }) {
  if (query.isPending) return <Skeleton />;
  if (query.error && (query.data === undefined || [401, 403, 404].includes(query.error.status)))
    return <ErrorNotice error={query.error} retry={() => query.refetch()} />;
  return <>{query.error && <div><p className="small muted">Showing your last loaded information.</p><ErrorNotice error={query.error} retry={() => query.refetch()} /></div>}{typeof children === 'function' ? children(query.data) : children}</>;
}
export function Pager({ pagination, page, onChange, count, limit = 20 }) {
  const total = pagination?.total,
    totalPages = pagination?.totalPages;
  const next = totalPages !== undefined ? page < totalPages : count >= limit;
  return (
    <nav className="pager" aria-label="Results pages">
      <span>
        {total !== undefined ? total + ' results · ' : ''}Page {page}
        {totalPages > 0 ? ' of ' + totalPages : ''}
      </span>
      <div>
        <button
          className="icon-button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={19} />
        </button>
        <button
          className="icon-button"
          disabled={!next}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={19} />
        </button>
      </div>
    </nav>
  );
}
export function Field({
  label,
  hint,
  error,
  as = 'input',
  children,
  options: _options,
  ...props
}) {
  const id = useId(),
    Tag = as;
  return (
    <div
      className={'field ' + (props.type === 'checkbox' ? 'check-field' : '')}
    >
      <label htmlFor={id}>{label}</label>
      <Tag
        id={id}
        aria-describedby={hint || error ? id + '-hint' : undefined}
        aria-invalid={!!error}
        {...props}
      >
        {children}
      </Tag>
      {(hint || error) && (
        <small id={id + '-hint'} className={error ? 'field-error' : ''}>
          {error || hint}
        </small>
      )}
    </div>
  );
}
export function Notice({ children, tone = '' }) {
  return (
    <div className={'notice ' + tone}>
      <ShieldCheck size={18} />
      <div>{children}</div>
    </div>
  );
}
export function Toasts() {
  const [items, set] = useState([]);
  useEffect(() => {
    const timers = new Set();
    const on = (e) => {
      const id = crypto.randomUUID();
      set((p) => [...p, { id, text: e.detail }]);
      const timer = setTimeout(() => {
        set((p) => p.filter((t) => t.id !== id));
        timers.delete(timer);
      }, 4500);
      timers.add(timer);
    };
    window.addEventListener('skilllink:toast', on);
    return () => {
      window.removeEventListener('skilllink:toast', on);
      timers.forEach(clearTimeout);
    };
  }, []);
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id}>
          <Check size={18} />
          {t.text}
        </div>
      ))}
    </div>
  );
}
export const toast = (text) =>
  window.dispatchEvent(new CustomEvent('skilllink:toast', { detail: text }));
export function Dialog({ title, open, onClose, children }) {
  const ref = useRef();
  useEffect(() => {
    if (open && !ref.current.open) ref.current.showModal();
    else if (!open && ref.current.open) ref.current.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-head">
        <h2 id="dialog-title">{title}</h2>
        <button
          onClick={onClose}
          className="icon-button"
          aria-label="Close dialog"
        >
          <X />
        </button>
      </div>
      {open && children}
    </dialog>
  );
}
export function ActionForm({
  path,
  method = 'POST',
  fields = [],
  build,
  initial = {},
  submit = 'Save changes',
  onSuccess,
  children,
}) {
  const action = useAction();
  const [error, setError] = useState(null);
  async function send(e) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget),
      values = Object.fromEntries(form.entries());
    try {
      const body = build ? build(values, form) : values;
      const data = await action.mutateAsync({ path, method, body });
      toast('Changes saved successfully.');
      onSuccess?.(data);
    } catch (err) {
      setError(err);
    }
  }
  return (
    <form onSubmit={send} className="form-stack">
      {fields.map((f) => (
        <Field
          key={f.name}
          {...f}
          defaultValue={initial[f.name] ?? f.defaultValue}
          error={error?.details?.find((d) => d.field === f.name)?.message}
          as={f.options ? 'select' : f.as || 'input'}
        >
          {f.options?.map((o) => (
            <option
              key={typeof o === 'string' ? o : o.value}
              value={typeof o === 'string' ? o : o.value}
            >
              {typeof o === 'string' ? o : o.label}
            </option>
          ))}
        </Field>
      ))}
      {children}
      {error && <ErrorNotice error={error} />}
      <Button type="submit" disabled={action.isPending}>
        {action.isPending ? 'Saving…' : submit}
        <ArrowRight size={17} />
      </Button>
    </form>
  );
}
export function Command({
  label,
  title = label,
  path,
  method = 'POST',
  fields = [],
  build,
  body = {},
  initial,
  onSuccess,
  variant = 'secondary',
  description,
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title}>
        {description && <p className="muted">{description}</p>}
        <ActionForm
          path={path}
          method={method}
          fields={fields}
          initial={initial}
          build={build || (() => body)}
          submit={label}
          onSuccess={(data) => {
            setOpen(false);
            onSuccess?.(data);
          }}
        />
      </Dialog>
    </>
  );
}
export function WorkerCard({ worker }) {
  const w = worker,
    person = displayName(w),
    id = w.workerId || w.id;
  return (
    <article className="worker-card">
      <div className="worker-card-top">
        <Avatar person={w} src={w.profileImage?.url} size="large" />
        <span className="worker-category">{w.professionTitle}</span>
        {w.availableNow && (
          <span className="available-dot" title="Available now" />
        )}
      </div>
      <div className="worker-card-body">
        <div className="row between">
          <h3>
            <Link to={'/professionals/' + id}>{person}</Link>
          </h3>
          {w.verificationSummary?.identityVerified && (
            <ShieldCheck
              size={19}
              className="success-text"
              aria-label="Identity verified"
            />
          )}
        </div>
        <p className="muted small">
          <MapPin size={14} />
          {w.serviceAreas
            ?.slice(0, 2)
            .map((a) => a.name)
            .join(' · ') || 'Service area on profile'}
        </p>
        <p className="rating">
          <Star size={15} fill="currentColor" />
          {w.reviewCount
            ? Number(w.averageRating).toFixed(1) +
              ' (' +
              w.reviewCount +
              ' reviews)'
            : 'New professional'}
          {w.approximateDistanceKm && (
            <span>Within ~{w.approximateDistanceKm} km</span>
          )}
        </p>
        <div className="tags">
          {w.services?.slice(0, 2).map((s) => (
            <span key={s.id}>{s.name}</span>
          ))}
        </div>
        <div className="worker-card-bottom">
          <strong>{pricing(w.pricing?.[0])}</strong>
          <Link
            to={'/professionals/' + id}
            className="icon-button primary-icon"
            aria-label={'View ' + person}
          >
            <ArrowUpRight size={18} />
          </Link>
        </div>
      </div>
    </article>
  );
}
export function ProtectedMedia({
  path,
  kind = 'image',
  alt = 'Work image',
  className = '',
}) {
  const [failed, setFailed] = useState(false);
  const query = useApi(path, undefined, {
    staleTime: 40000,
    enabled: !!path,
  });
  if (query.isPending)
    return <div className="media-placeholder">Loading media…</div>;
  if ((query.error && (!query.data || [401, 403, 404].includes(query.error.status))) || failed)
    return (
      <button onClick={async () => { await query.refetch(); setFailed(false); }} className="media-placeholder" disabled={!!query.error?.retryAt && query.error.retryAt > Date.now()}>
        Media unavailable · retry
      </button>
    );
  const url = query.data?.url;
  if (!url || !/^https?:\/\//.test(url)) return <span>Media unavailable</span>;
  return kind === 'audio' ? (
    <ProtectedAudio url={url} renew={query.refetch} className={className} />
  ) : (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={'protected-image ' + className}
      referrerPolicy="no-referrer"
    />
  );
}
export function ProtectedAudio({ url, renew, className }) {
  // Keep buffered playback stable when background queries renew the signed URL.
  // If a delayed play/seek meets an expired URL, request authorized access again.
  const [source, setSource] = useState(url);
  const position = useRef(0),
    restorePosition = useRef(null),
    playing = useRef(false),
    resume = useRef(false),
    recovering = useRef(false);
  async function recover() {
    if (recovering.current) return;
    recovering.current = true;
    try {
      const result = await renew();
      if (
        /^https?:\/\//.test(result.data?.url || '') &&
        result.data.url !== source
      ) {
        resume.current = playing.current;
        restorePosition.current = position.current;
        setSource(result.data.url);
      }
    } catch {
      // The owning media query presents its recoverable access error.
    } finally {
      recovering.current = false;
    }
  }
  return (
    <audio
      controls
      preload="metadata"
      src={source}
      className={className}
      onTimeUpdate={(e) => {
        position.current = e.currentTarget.currentTime;
      }}
      onPlay={() => {
        playing.current = true;
      }}
      onPause={() => {
        playing.current = false;
      }}
      onError={recover}
      onLoadedMetadata={(e) => {
        if (restorePosition.current !== null) {
          try {
            e.currentTarget.currentTime = restorePosition.current;
          } catch {
            /* Some streams cannot seek. */
          }
          restorePosition.current = null;
        }
        if (resume.current) {
          resume.current = false;
          e.currentTarget.play().catch(() => {});
        }
      }}
    />
  );
}
export function MediaLink({ path, label = 'Open private document' }) {
  const [error, set] = useState(null),
    [url, setURL] = useState(null);
  return (
    <div>
      {url ? (
        <a
          className="button secondary"
          href={url}
          target="_blank"
          rel="noreferrer"
        >
          {label}
          <FileText size={16} />
        </a>
      ) : (
        <button
          className="button secondary"
          onClick={async () => {
            try {
              const data = await api(path);
              if (!/^https?:\/\//.test(data.url))
                throw Error('Document unavailable');
              setURL(data.url);
              setTimeout(() => setURL(null), 50000);
            } catch (e) {
              set(e);
            }
          }}
        >
          <FileText size={16} />
          {label}
        </button>
      )}
      {error && <ErrorNotice error={error} />}
    </div>
  );
}
export function FileUpload({
  purpose,
  onChange,
  onBusyChange,
  multiple = false,
  max = 5,
  label = 'Upload images',
  accept = 'image/jpeg,image/png',
  preview = false,
}) {
  const [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [files, setFiles] = useState([]);
  async function choose(e) {
    const list = Array.from(e.target.files || []);
    e.target.value = '';
    if (
      (multiple ? list.length + files.length : list.length) >
      (multiple ? max : 1)
    ) {
      setError(Error('Choose at most ' + (multiple ? max : 1) + ' files.'));
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    setError(null);
    try {
      const added = [];
      for (const file of list) {
        const asset = await upload(file, purpose, setProgress);
        added.push({ ...asset, name: file.name });
        const next = multiple ? [...files, ...added] : added;
        setFiles(next);
        onChange(multiple ? next.map((f) => f.id) : next[0]?.id);
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <div className="upload-control">
      <label className="upload-box">
        <Upload size={22} />
        <strong>{busy ? 'Uploading ' + progress + '%' : label}</strong>
        <span>Up to 5 MB per file</span>
        <input
          type="file"
          aria-label={label}
          accept={accept}
          multiple={multiple}
          disabled={busy}
          onChange={choose}
        />
      </label>
      {busy && (
        <progress max="100" value={progress} aria-label="Upload progress" />
      )}
      {files.map((f) => (
        <div key={f.id} className="row between small">
          {preview && <ProtectedMedia path={'/media/' + f.id + '/access'} label="Selected job photo" />}
          <span>
            <FileText size={14} /> {f.name}
          </span>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              const next = files.filter((x) => x.id !== f.id);
              setFiles(next);
              onChange(multiple ? next.map((x) => x.id) : next[0]?.id);
            }}
          >
            Remove
          </button>
        </div>
      ))}
      {error && <ErrorNotice error={error} />}
    </div>
  );
}
export function Stat({ label, value, icon: Icon, caption }) {
  return (
    <div className="stat">
      <span className="stat-icon">{Icon && <Icon size={21} />}</span>
      <div>
        <span>{label}</span>
        <strong>{value ?? '—'}</strong>
        {caption && <small>{caption}</small>}
      </div>
    </div>
  );
}
export function DataTable({ columns, rows, rowKey = 'id' }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.label} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r[rowKey] || i}>
              {columns.map((c) => (
                <td key={c.label}>{c.render ? c.render(r) : r[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Reference({ label, id, to }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      {to ? (
        <Link to={to}>
          {shortId(id)} <ArrowUpRight size={14} />
        </Link>
      ) : (
        <strong>{shortId(id) || 'Not available'}</strong>
      )}
    </div>
  );
}
export class Boundary extends Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error)
      return (
        <main className="container section">
          <Empty
            title="This page needs a fresh start"
            description="Your work is safe on SkillLink. Reload the page to try again."
            action={
              <Button onClick={() => window.location.reload()}>
                Reload page
              </Button>
            }
          />
        </main>
      );
    return this.props.children;
  }
}
