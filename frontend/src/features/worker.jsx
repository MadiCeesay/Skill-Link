import { JobLocation } from '../components/JobLocation';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ShieldCheck,
  Plus,
  X,
  ArrowUpRight,
  ImagePlus,
  Star,
  Wallet,
  Clock3,
  CheckCircle2,
} from 'lucide-react';
import { useApi, useCatalog, useAction } from '../api/hooks';
import { useAuth } from '../api/auth';
import {
  PageTitle,
  Panel,
  Button,
  Field,
  QueryState,
  ErrorNotice,
  Notice,
  Empty,
  Chip,
  FileUpload,
  ProtectedMedia,
  MediaLink,
  Command,
  ActionForm,
  Stat,
  Pager,
  toast,
  Skeleton,
} from '../components/ui';
import {
  bututs,
  gmdInput,
  money,
  date,
  title,
  localInput,
  toUTC,
} from '../utils/format';
import { Account } from './dashboard';
export function ProfessionalWorkspace() {
  const { tab = 'details' } = useParams(),
    { user } = useAuth(),
    query = useApi('/workers/me/profile');
  const tabs = [
    ['details', 'Profile & services'],
    ['portfolio', 'Portfolio'],
    ['verification', 'Verification'],
    ['reviews', 'Reviews'],
    ['account', 'Account'],
  ];
  return (
    <>
      <PageTitle
        eyebrow="YOUR PROFESSIONAL HOME"
        title="Let your work speak for you."
        description="Build a profile that helps the right customers find you."
      >
        {query.data?.profile.profileVisibility === 'PUBLIC' && (
          <Button variant="outline" to={'/professionals/' + user.id}>
            View public profile
            <ArrowUpRight size={17} />
          </Button>
        )}
      </PageTitle>
      <nav className="tabs" aria-label="Professional profile sections">
        {tabs.map(([key, label]) => (
          <Link
            className={tab === key ? 'active' : ''}
            key={key}
            to={'/work/profile/' + key}
          >
            {label}
          </Link>
        ))}
      </nav>
      {tab === 'account' ? (
        <Account />
      ) : tab === 'verification' ? (
        <Verification />
      ) : query.isPending ? (
        <Skeleton />
      ) : query.error && query.error.status !== 404 ? (
        <ErrorNotice error={query.error} />
      ) : tab === 'portfolio' ? (
        query.data ? (
          <Portfolio profile={query.data.profile} />
        ) : (
          <Notice>
            Save your professional profile before adding portfolio work.
          </Notice>
        )
      ) : tab === 'reviews' ? (
        query.data ? (
          <Reputation profile={query.data.profile} />
        ) : (
          <Notice>Complete your profile first.</Notice>
        )
      ) : (
        <ProfileForm
          profile={query.data?.profile}
          key={query.data?.profile.id || 'new'}
        />
      )}
    </>
  );
}
function ProfileForm({ profile: p }) {
  const catalog = useCatalog(),
    action = useAction(),
    [services, setServices] = useState(p?.services || []),
    [areas, setAreas] = useState(
      p?.serviceAreas || [{ name: '', region: '', country: 'GM' }],
    ),
    [rates, setRates] = useState(p?.pricing || []),
    [baseLocation, setBaseLocation] = useState(p?.primaryLocation || null),
    [image, setImage] = useState(p?.profileImage),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(null);
  function rate(id, patch) {
    setRates((old) =>
      old.some((r) => r.service === id)
        ? old.map((r) => (r.service === id ? { ...r, ...patch } : r))
        : [...old, { service: id, type: 'QUOTE_REQUIRED', ...patch }],
    );
  }
  async function save(e) {
    e.preventDefault();
    setError(null);
    const v = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const areaKeys = areas.map(a => a.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en'));
      if (new Set(areaKeys).size !== areaKeys.length) throw Error('Each service area should appear once. Remove the duplicate town before saving.');
      const body = {
        professionTitle: v.professionTitle,
        bio: v.bio,
        yearsOfExperience: Number(v.yearsOfExperience),
        skills: v.skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        services,
        serviceAreas: areas.map((a) => ({
          name: a.name.trim(),
          region: a.region || undefined,
          country: 'GM',
        })),
        serviceRadiusKm: Number(v.radius),
        profileVisibility: v.visibility,
        pricing: services
          .map(
            (service) =>
              rates.find((r) => r.service === service) || {
                service,
                type: 'QUOTE_REQUIRED',
              },
          )
          .map((r) => ({
            service: r.service,
            type: r.type,
            ...(r.type !== 'QUOTE_REQUIRED'
              ? {
                  amountBututs:
                    r.gmd !== undefined ? bututs(r.gmd) : r.amountBututs,
                }
              : {}),
            currency: 'GMD',
          })),
      };
      body.profileImage = image || null;
      body.primaryLocation = baseLocation;
      await action.mutateAsync({
        path: '/workers/me/profile',
        method: p ? 'PATCH' : 'POST',
        body,
      });
      toast('Your professional profile is saved.');
    } catch (err) {
      setError(err);
    }
  }
  return (
    <form className="form-stack" onSubmit={save}>
      {!p && (
        <Notice>
          Welcome to your professional home. Start with your skills and service
          areas, then add portfolio work, availability and verification.
        </Notice>
      )}
      {p && (
        <div className="profile-progress">
          <div>
            <strong>{p.profileCompletion}% complete</strong>
            <span>Keep building your professional story</span>
          </div>
          <progress value={p.profileCompletion} max="100" />
        </div>
      )}
      <div className="two-grid">
        <div className="stack">
          <Panel title="The professional behind the work">
            <div className="row">
              {image && (
                <ProtectedMedia
                  path={'/media/' + image + '/access'}
                  alt="Your profile photo"
                  className="profile-upload-preview"
                />
              )}
              <FileUpload
                purpose="PROFILE_IMAGE"
                label="Choose a profile photo"
                onChange={setImage}
                onBusyChange={setUploading}
              />
            </div>
            <Field
              label="Professional headline"
              name="professionTitle"
              required
              maxLength={120}
              defaultValue={p?.professionTitle}
              placeholder="e.g. Electrician & solar installer"
            />
            <Field
              label="About your work"
              name="bio"
              as="textarea"
              rows={6}
              required
              minLength={20}
              maxLength={2000}
              defaultValue={p?.bio}
            />
            <Field
              label="Years of experience"
              name="yearsOfExperience"
              type="number"
              min="0"
              max="80"
              step="1"
              required
              defaultValue={p?.yearsOfExperience || 0}
            />
            <Field
              label="Skills"
              name="skills"
              defaultValue={p?.skills.join(', ')}
              maxLength={3000}
              hint="Separate skills with commas. Up to 30 skills."
            />
            <Field
              label="Profile visibility"
              name="visibility"
              as="select"
              defaultValue={p?.profileVisibility || 'DRAFT'}
            >
              <option value="DRAFT">Draft · only you can see it</option>
              <option value="PUBLIC">Public · visible when eligible</option>
            </Field>
          </Panel>
          <Panel title="What you do & how you price it">
            {catalog.error && <ErrorNotice error={catalog.error} />}
            <div className="service-checkboxes">
              {catalog.services.map((s) => (
                <label key={s.id}>
                  <input
                    type="checkbox"
                    checked={services.includes(s.id)}
                    onChange={(e) =>
                      setServices((old) =>
                        e.target.checked
                          ? [...old, s.id]
                          : old.filter((id) => id !== s.id),
                      )
                    }
                  />
                  {s.name}
                </label>
              ))}
            </div>
            {services.map((id) => {
              const r = rates.find((r) => r.service === id) || {
                type: 'QUOTE_REQUIRED',
              };
              return (
                <div className="pricing-editor" key={id}>
                  <strong>
                    {catalog.services.find((s) => s.id === id)?.name ||
                      'Existing service'}
                  </strong>
                  <Field
                    label="Pricing model"
                    as="select"
                    value={r.type}
                    onChange={(e) => rate(id, { type: e.target.value })}
                  >
                    {['QUOTE_REQUIRED', 'FIXED', 'HOURLY', 'STARTING_FROM'].map(
                      (t) => (
                        <option value={t} key={t}>
                          {title(t)}
                        </option>
                      ),
                    )}
                  </Field>
                  {r.type !== 'QUOTE_REQUIRED' && (
                    <Field
                      label="Amount · GMD"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={
                        r.gmd ??
                        (r.amountBututs !== undefined
                          ? gmdInput(r.amountBututs)
                          : '')
                      }
                      onChange={(e) => rate(id, { gmd: e.target.value })}
                    />
                  )}
                </div>
              );
            })}
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Where you work">
            {areas.map((a, i) => (
              <div className="area-editor" key={i}>
                <Field
                  label={'Service area ' + (i + 1)}
                  value={a.name}
                  required
                  maxLength={100}
                  onChange={(e) =>
                    setAreas((old) =>
                      old.map((x, n) =>
                        n === i ? { ...x, name: e.target.value } : x,
                      ),
                    )
                  }
                />
                <Field
                  label="Region (optional)"
                  value={a.region || ''}
                  maxLength={100}
                  onChange={(e) =>
                    setAreas((old) =>
                      old.map((x, n) =>
                        n === i ? { ...x, region: e.target.value } : x,
                      ),
                    )
                  }
                />
                {areas.length > 1 && (
                  <button
                    type="button"
                    className="text-button danger-text"
                    onClick={() =>
                      setAreas((old) => old.filter((_, n) => n !== i))
                    }
                  >
                    Remove area
                  </button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={areas.length >= 30}
              onClick={() =>
                setAreas((old) => [...old, { name: '', country: 'GM' }])
              }
            >
              <Plus size={16} />
              Add service area
            </Button>
            <JobLocation mode="base" value={baseLocation} onChange={setBaseLocation} />
            <Field
              label="Service radius · km"
              name="radius"
              type="number"
              min="1"
              max="2000"
              required
              defaultValue={p?.serviceRadiusKm || 25}
            />
          </Panel>
          <Panel title="Your next steps">
            <div className="onboarding-step">
              <ImagePlus />
              <div>
                <strong>Show your work</strong>
                <p>Add portfolio photos with helpful descriptions.</p>
              </div>
            </div>
            <div className="onboarding-step">
              <Clock3 />
              <div>
                <strong>Make room for good work</strong>
                <p>Set your weekly hours and time off.</p>
                <Link to="/work/availability">Manage availability →</Link>
              </div>
            </div>
            <div className="onboarding-step">
              <ShieldCheck />
              <div>
                <strong>Build trust</strong>
                <p>Submit private evidence for identity verification.</p>
                <Link to="/work/profile/verification">
                  Start verification →
                </Link>
              </div>
            </div>
          </Panel>
        </div>
      </div>
      {error && <ErrorNotice error={error} />}
      <Button type="submit" disabled={action.isPending || uploading}>
        {action.isPending
          ? 'Saving profile…'
          : p
            ? 'Save professional profile'
            : 'Create professional profile'}
        <ArrowUpRight size={17} />
      </Button>
    </form>
  );
}
function Portfolio({ profile }) {
  const catalog = useCatalog();
  const [media, setMedia] = useState(null);
  return (
    <div className="stack">
      <Panel
        title="The work you’re proud of"
        description="Public portfolio content is separate from private booking and verification evidence."
      >
        {profile.portfolio.length ? (
          <div className="portfolio-grid">
            {profile.portfolio.map((p) => (
              <article className="portfolio-item" key={p.id}>
                <ProtectedMedia
                  path={'/media/' + p.media + '/access'}
                  alt={p.title}
                />
                <h3>{p.title}</h3>
                <p>{p.description}</p>
                <div className="actions">
                  <Command
                    label="Edit details"
                    variant="outline"
                    path={'/workers/me/portfolio/' + p.id}
                    method="PATCH"
                    fields={[
                      {
                        name: 'title',
                        label: 'Title',
                        required: true,
                        maxLength: 120,
                      },
                      {
                        name: 'description',
                        label: 'Description',
                        as: 'textarea',
                        maxLength: 1000,
                      },
                    ]}
                    initial={p}
                    build={(v) => v}
                  />
                  <Command
                    label="Remove"
                    path={'/workers/me/portfolio/' + p.id}
                    method="DELETE"
                    variant="outline"
                    description="Remove this item from your public portfolio?"
                  />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title="Show customers what you can do"
            description="Add a photo of your previous work and tell its story."
          />
        )}
      </Panel>
      <Panel title="Add a project">
        <FileUpload
          purpose="PORTFOLIO"
          label="Upload a work photo"
          onChange={setMedia}
        />
        {media && (
          <ActionForm
            path="/workers/me/portfolio"
            fields={[
              {
                name: 'title',
                label: 'Project title',
                required: true,
                maxLength: 120,
              },
              {
                name: 'description',
                label: 'What did you do?',
                as: 'textarea',
                maxLength: 1000,
              },
              {
                name: 'service',
                label: 'Related service (optional)',
                options: [
                  { value: '', label: 'No specific service' },
                  ...profile.services.map((id) => ({
                    value: id,
                    label:
                      catalog.services.find((s) => s.id === id)?.name ||
                      'Selected service',
                  })),
                ],
              },
            ]}
            build={(v) => ({
              media,
              title: v.title,
              description: v.description,
              ...(v.service ? { service: v.service } : {}),
            })}
            submit="Add to portfolio"
            onSuccess={() => setMedia(null)}
          />
        )}
      </Panel>
    </div>
  );
}
function Verification() {
  const query = useApi('/verifications/me'),
    [identity, setIdentity] = useState(null),
    [certificates, setCertificates] = useState([]),
    [work, setWork] = useState([]);
  return (
    <QueryState query={query}>
      {({ verification: v }) => (
        <div className="two-grid">
          <Panel
            title="Trust starts with a real person"
            action={<Chip status={v.status} />}
          >
            <p className="prose">
              Identity approval helps customers know who they’re working with.
              Your identity files are private and are never included in your
              public profile.
            </p>
            {v.verificationSummary.badges.map((b) => (
              <p className="verified" key={b}>
                <ShieldCheck size={16} />
                {b}
              </p>
            ))}
            {v.rejectionReason && (
              <Notice>
                Your application needs attention: {v.rejectionReason}
              </Notice>
            )}
            {v.identityDocument && (
              <MediaLink
                path={'/media/' + v.identityDocument + '/access'}
                label="View your private identity file"
              />
            )}
            {v.status === 'PENDING' && (
              <Notice>
                Your application is being reviewed. You cannot change a pending
                application.
              </Notice>
            )}
            {v.status === 'APPROVED' && (
              <Notice>
                Identity approved. Work-evidence badges only appear when
                supporting evidence has actually been reviewed.
              </Notice>
            )}
          </Panel>
          {['NOT_SUBMITTED', 'REJECTED'].includes(v.status) && (
            <Panel
              title={
                v.status === 'REJECTED'
                  ? 'Submit an updated application'
                  : 'Your verification application'
              }
            >
              <FileUpload
                purpose="IDENTITY_DOCUMENT"
                onChange={setIdentity}
                label="Upload identity document"
                accept="image/jpeg,image/png,application/pdf"
              />
              <FileUpload
                purpose="SKILL_CERTIFICATE"
                multiple
                onChange={setCertificates}
                label="Skill certificates (optional)"
                accept="image/jpeg,image/png,application/pdf"
              />
              <FileUpload
                purpose="WORK_EVIDENCE"
                multiple
                max={10}
                onChange={setWork}
                label="Work evidence (optional)"
                accept="image/jpeg,image/png,application/pdf"
              />
              {identity ? (
                <ActionForm
                  path="/verifications"
                  build={() => ({
                    identityDocument: identity,
                    skillCertificates: certificates,
                    workEvidence: work,
                  })}
                  submit="Submit for review"
                />
              ) : (
                <p className="small muted">
                  Add your identity document to continue.
                </p>
              )}
              <Notice>
                Save your professional profile before submitting. Only
                authorized administrators can review your private evidence.
              </Notice>
            </Panel>
          )}
        </div>
      )}
    </QueryState>
  );
}
function Reputation({ profile }) {
  const { user } = useAuth(),
    [page, setPage] = useState(1),
    reviews = useApi('/workers/' + user.id + '/reviews', { page, limit: 10 });
  return (
    <>
      <div className="stats-grid three">
        <Stat
          label="Average rating"
          value={
            profile.reviewCount
              ? profile.averageRating.toFixed(1)
              : 'New professional'
          }
          icon={Star}
        />
        <Stat
          label="Genuine reviews"
          value={profile.reviewCount}
          icon={ShieldCheck}
        />
        <Stat
          label="Completed jobs"
          value={profile.completedJobsCount}
          icon={CheckCircle2}
        />
      </div>
      <Panel title="Your reputation, one project at a time">
        <QueryState query={reviews}>
          {(data) => (
            <>
              {data.reviews.length ? (
                data.reviews.map((r) => (
                  <article className="review" key={r.id}>
                    <strong className="rating">
                      <Star size={15} fill="currentColor" />
                      {r.rating} / 5
                    </strong>
                    <p>{r.comment}</p>
                    <small className="muted">
                      Verified booking · {date(r.createdAt)}
                    </small>
                  </article>
                ))
              ) : (
                <Empty
                  title="Good work builds a good name"
                  description="Your customers can review you after completing a SkillLink booking."
                />
              )}
              <Pager
                pagination={data.pagination}
                page={page}
                onChange={setPage}
              />
            </>
          )}
        </QueryState>
      </Panel>
    </>
  );
}
export function Availability() {
  const query = useApi('/availability/me'),
    profile = useApi('/workers/me/profile');
  return (
    <>
      <PageTitle
        eyebrow="MAKE YOUR WORKDAY YOURS"
        title="A schedule that works for you."
        description="Set your weekly hours and time off in Gambian local time."
      />
      {profile.data && (
        <Panel title="Available now">
          <ActionForm
            path="/availability/available-now"
            method="PATCH"
            fields={[
              {
                name: 'availableNow',
                label: 'Marketplace indicator',
                options: [
                  { value: 'true', label: 'Available now' },
                  { value: 'false', label: 'Not available now' },
                ],
              },
            ]}
            initial={{
              availableNow: String(profile.data.profile.availableNow),
            }}
            build={(v) => ({ availableNow: v.availableNow === 'true' })}
            submit="Update indicator"
          />
          <p className="muted small">
            This does not override blocked dates, time off or existing bookings.
          </p>
        </Panel>
      )}
      <QueryState query={query}>
        {({ availability }) => (
          <ScheduleEditor
            initial={availability}
            key={JSON.stringify(availability)}
          />
        )}
      </QueryState>
    </>
  );
}
function ScheduleEditor({ initial }) {
  const [weekly, setWeekly] = useState(initial.weekly),
    [blocked, setBlocked] = useState(initial.blockedDates),
    [off, setOff] = useState(initial.timeOff),
    action = useAction(),
    [error, setError] = useState(null);
  const days = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  async function save(e) {
    e.preventDefault();
    setError(null);
    try {
      await action.mutateAsync({
        path: '/availability/me',
        method: 'PATCH',
        body: {
          weekly,
          blockedDates: blocked,
          timeOff: off.map((t) => ({
            start: t.start.includes('Z') ? t.start : toUTC(t.start),
            end: t.end.includes('Z') ? t.end : toUTC(t.end),
          })),
        },
      });
      toast('Your working hours have been saved.');
    } catch (err) {
      setError(err);
    }
  }
  return (
    <form className="form-stack" onSubmit={save}>
      <div className="two-grid">
        <Panel
          title="Your weekly rhythm"
          description="Add more than one interval for breaks. Adjacent intervals are allowed."
        >
          {days.map((day, n) => (
            <div className="day-row" key={day}>
              <strong>{day}</strong>
              <div>
                {weekly.map((w, i) =>
                  w.day === n ? (
                    <div className="time-range" key={i}>
                      <Field
                        label="Start"
                        type="time"
                        required
                        value={w.start}
                        onChange={(e) =>
                          setWeekly((a) =>
                            a.map((x, k) =>
                              k === i ? { ...x, start: e.target.value } : x,
                            ),
                          )
                        }
                      />
                      <span>to</span>
                      <Field
                        label="End"
                        type="time"
                        required
                        value={w.end}
                        onChange={(e) =>
                          setWeekly((a) =>
                            a.map((x, k) =>
                              k === i ? { ...x, end: e.target.value } : x,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={'Remove ' + day + ' interval'}
                        onClick={() =>
                          setWeekly((a) => a.filter((_, k) => k !== i))
                        }
                      >
                        <X size={17} />
                      </button>
                    </div>
                  ) : null,
                )}
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setWeekly((a) => [
                      ...a,
                      { day: n, start: '09:00', end: '17:00' },
                    ])
                  }
                >
                  <Plus size={15} />
                  Add hours
                </button>
              </div>
            </div>
          ))}
        </Panel>
        <div className="stack">
          <Panel title="Days for yourself">
            {blocked.map((d, i) => (
              <div className="row" key={i}>
                <Field
                  label="Blocked date"
                  type="date"
                  required
                  value={d}
                  onChange={(e) =>
                    setBlocked((a) =>
                      a.map((v, k) => (i === k ? e.target.value : v)),
                    )
                  }
                />
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => setBlocked((a) => a.filter((_, k) => i !== k))}
                  aria-label="Remove blocked date"
                >
                  <X size={17} />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => setBlocked((a) => [...a, ''])}
            >
              <Plus size={16} />
              Block a date
            </Button>
          </Panel>
          <Panel title="Time off">
            {off.map((t, i) => (
              <div className="timeoff" key={i}>
                <Field
                  label="Away from"
                  type="datetime-local"
                  required
                  value={t.start.includes('Z') ? localInput(t.start) : t.start}
                  onChange={(e) =>
                    setOff((a) =>
                      a.map((v, k) =>
                        i === k ? { ...v, start: e.target.value } : v,
                      ),
                    )
                  }
                />
                <Field
                  label="Back at"
                  type="datetime-local"
                  required
                  value={t.end.includes('Z') ? localInput(t.end) : t.end}
                  onChange={(e) =>
                    setOff((a) =>
                      a.map((v, k) =>
                        i === k ? { ...v, end: e.target.value } : v,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="text-button danger-text"
                  onClick={() => setOff((a) => a.filter((_, k) => i !== k))}
                >
                  Remove time off
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => setOff((a) => [...a, { start: '', end: '' }])}
            >
              <Plus size={16} />
              Add time off
            </Button>
          </Panel>
          <Notice>
            Existing active bookings and unexpired reservations must stay inside
            your availability. Resolve those plans before removing their working
            hours.
          </Notice>
        </div>
      </div>
      {error && <ErrorNotice error={error} />}
      <Button type="submit" disabled={action.isPending}>
        {action.isPending ? 'Saving…' : 'Save availability'}
        <ArrowUpRight size={17} />
      </Button>
    </form>
  );
}
export function Earnings() {
  const query = useApi('/finances/me'),
    [page, setPage] = useState(1),
    bookings = useApi('/bookings/me', { page, limit: 12 });
  return (
    <>
      <PageTitle
        eyebrow="A CLEAR VIEW OF YOUR PROGRESS"
        title="Your work, accounted for."
        description="Simulated earnings only. No actual balance or withdrawal is available."
      />
      <QueryState query={query}>
        {(data) => (
          <div className="stats-grid two">
            <Stat
              label="Pending · simulated"
              value={money(data.pendingEarningsBututs)}
              icon={Clock3}
            />
            <Stat
              label="Released · simulated"
              value={money(data.releasedEarningsBututs)}
              icon={Wallet}
            />
          </div>
        )}
      </QueryState>
      <Notice>
        These are demonstration amounts, not money held in a bank or wallet.
        There is no real withdrawal action.
      </Notice>
      <Panel
        title="Your booking finances"
        description="Open a booking’s payment view for its fee breakdown and simulated ledger."
      >
        <QueryState query={bookings}>
          {(data) => (
            <>
              {data.bookings.length ? (
                data.bookings.map((b) => (
                  <div className="list-row" key={b.id}>
                    <div>
                      <strong>{b.description.slice(0, 80)}</strong>
                      <p className="small muted">{date(b.scheduledStart)}</p>
                    </div>
                    <Chip status={b.status} />
                    <Button
                      variant="outline"
                      to={'/work/bookings/' + b.id + '/payment'}
                    >
                      Payment details
                      <ArrowUpRight size={15} />
                    </Button>
                  </div>
                ))
              ) : (
                <Empty
                  title="Your next milestone starts with a job"
                  description="Your booking payment history will appear here."
                />
              )}
              <Pager
                pagination={data.pagination}
                page={page}
                onChange={setPage}
              />
            </>
          )}
        </QueryState>
      </Panel>
    </>
  );
}
