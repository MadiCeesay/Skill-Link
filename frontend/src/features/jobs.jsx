import { JobLocation } from '../components/JobLocation';
import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  BriefcaseBusiness,
  MapPin,
  CalendarDays,
  ShieldCheck,
} from 'lucide-react';
import { useApi, useCatalog, useAction } from '../api/hooks';
import { useAuth } from '../api/auth';
import {
  PageTitle,
  Panel,
  Button,
  QueryState,
  Empty,
  Chip,
  Pager,
  Field,
  ActionForm,
  Command,
  ErrorNotice,
  FileUpload,
  Notice,
  ProtectedMedia,
  Avatar,
  Reference,
  toast,
} from '../components/ui';
import {
  money,
  bututs,
  gmdInput,
  budget,
  date,
  dateTime,
  displayName,
  toUTC,
  shortId,
} from '../utils/format';
import { canEditJob, canChangeQuote } from '../utils/policy';
import { StartChat } from './messaging';
export const scheduleFields = [
  {
    name: 'scheduledStart',
    label: 'Start time',
    type: 'datetime-local',
    required: true,
    step: 60,
  },
  {
    name: 'scheduledEnd',
    label: 'Finish time',
    type: 'datetime-local',
    required: true,
    step: 60,
  },
];
export const scheduleBody = (v) => {
  const start = toUTC(v.scheduledStart),
    end = toUTC(v.scheduledEnd);
  if (new Date(start) <= new Date() || new Date(end) <= new Date(start))
    throw Error('Choose a future start and an end after the start.');
  return { scheduledStart: start, scheduledEnd: end };
};
export function Jobs() {
  const { user } = useAuth(),
    worker = user.role === 'WORKER',
    [page, setPage] = useState(1),
    [status, setStatus] = useState('');
  const query = useApi(
    worker ? '/job-requests/opportunities' : '/job-requests/me',
    { page, limit: 12, ...(!worker && status ? { status } : {}) },
  );
  return (
    <>
      <PageTitle
        eyebrow={worker ? 'YOUR SKILLS. THE RIGHT PROJECT.' : 'YOUR PROJECTS'}
        title={
          worker ? 'Find your next opportunity.' : 'Good things in the works.'
        }
        description={
          worker
            ? 'Open requests matched to your services, area and verification.'
            : 'Track your requests, compare quotes and choose your professional.'
        }
      >
        {!worker && (
          <Button to="/app/jobs/new">
            Post a job
            <ArrowUpRight size={17} />
          </Button>
        )}
      </PageTitle>
      {worker ? (
        <Notice>
          Matching requires a public professional profile and approved identity
          verification.{' '}
          <Link to="/work/profile/verification">Check your verification.</Link>
        </Notice>
      ) : (
        <div className="tabs">
          {[
            ['', 'All jobs'],
            ['OPEN', 'Open'],
            ['QUOTE_ACCEPTED', 'Quote accepted'],
            ['CANCELLED', 'Cancelled'],
            ['EXPIRED', 'Expired'],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => {
                setStatus(value);
                setPage(1);
              }}
              className={status === value ? 'active' : ''}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <QueryState query={query}>
        {(data) => {
          const rows = worker ? data.opportunities : data.jobRequests;
          return (
            <>
              {rows.length ? (
                <div className="job-grid">
                  {rows.map((j) => (
                    <JobCard job={j} key={j.id} worker={worker} />
                  ))}
                </div>
              ) : (
                <Empty
                  icon={BriefcaseBusiness}
                  title={
                    worker
                      ? 'The right job will find its way here'
                      : 'Your first project starts with a few details'
                  }
                  description={
                    worker
                      ? 'There are no relevant open requests right now. Keep your services and service areas up to date.'
                      : 'Post a job and eligible professionals can respond with quotes.'
                  }
                  action={
                    <Button to={worker ? '/work/profile' : '/app/jobs/new'}>
                      {worker ? 'Review your profile' : 'Post a job'}
                    </Button>
                  }
                />
              )}
              <Pager
                pagination={data.pagination}
                page={page}
                onChange={setPage}
              />
            </>
          );
        }}
      </QueryState>
    </>
  );
}
function JobCard({ job: j, worker }) {
  return (
    <Link
      className="job-card"
      to={(worker ? '/work/opportunities/' : '/app/jobs/') + j.id}
    >
      <div className="row between">
        <span className="activity-icon">
          <BriefcaseBusiness size={21} />
        </span>
        <Chip status={j.status} />
      </div>
      <h2>{j.title}</h2>
      <p className="muted clamp">{j.description}</p>
      <p className="small muted">
        <MapPin size={14} />
        {j.serviceArea.name}{' '}
        {j.match?.approximateDistanceKm
          ? '· within ~' + j.match.approximateDistanceKm + ' km'
          : ''}
      </p>
      <div className="row between job-bottom">
        <strong>{budget(j.budget)}</strong>
        <span className="small">
          {j.quoteCount} quotes
          <ArrowUpRight size={16} />
        </span>
      </div>
    </Link>
  );
}
export function JobEditor() {
  const { id } = useParams(),
    query = useApi(id ? '/job-requests/' + id : null);
  return (
    <>
      <PageTitle
        eyebrow="TELL US WHAT YOU HAVE IN MIND"
        title={
          id ? 'A little change of plans.' : 'Let’s get your project moving.'
        }
        description="Describe the work. Relevant professionals can respond with quotes."
      />
      {id ? (
        <QueryState query={query}>
          {(data) =>
            canEditJob(data.jobRequest) ? (
              <JobForm existing={data.jobRequest} />
            ) : (
              <Notice>
                This job’s terms are locked because it is closed or has already
                received a quote.
              </Notice>
            )
          }
        </QueryState>
      ) : (
        <JobForm />
      )}
    </>
  );
}
function JobForm({ existing: j }) {
  const catalog = useCatalog(),
    [location, setLocation] = useState(j?.location || null),
    [type, setType] = useState(j?.budget?.type || 'OPEN_TO_QUOTES'),
    [retainedAttachments, setRetainedAttachments] = useState(j?.attachments || []),
    [newAttachments, setNewAttachments] = useState([]),
    [error, setError] = useState(null),
    action = useAction(),
    navigate = useNavigate();
  async function save(e) {
    e.preventDefault();
    setError(null);
    const v = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const body = {
        service: v.service,
        title: v.title,
        description: v.description,
        serviceArea: {
          name: v.area,
          country: 'GM',
          ...(v.region ? { region: v.region } : {}),
        },
        privateAddress: v.privateAddress,
        attachments: [...retainedAttachments, ...newAttachments],
        budget: { type },
      };
      if (type === 'FIXED') body.budget.amountBututs = bututs(v.amount);
      if (type === 'RANGE') {
        body.budget.minAmountBututs = bututs(v.min);
        body.budget.maxAmountBututs = bututs(v.max);
        if (body.budget.minAmountBututs > body.budget.maxAmountBututs)
          throw Error('The minimum budget cannot exceed the maximum.');
      }
      body.location = location;
      if (v.preferredDate) body.preferredDate = v.preferredDate;
      if (v.preferredTimeNote) body.preferredTimeNote = v.preferredTimeNote;
      if (v.expiresAt) body.expiresAt = toUTC(v.expiresAt);
      const data = await action.mutateAsync({
        path: j ? '/job-requests/' + j.id : '/job-requests',
        method: j ? 'PATCH' : 'POST',
        body,
      });
      toast(
        j
          ? 'Your job has been updated.'
          : 'Your job is ready for relevant professionals.',
      );
      navigate('/app/jobs/' + data.jobRequest.id);
    } catch (err) {
      setError(err);
    }
  }
  return (
    <form onSubmit={save} className="form-stack">
      <div className="two-grid">
        <div className="stack">
          <Panel
            title="01 / The work"
            description="A clear description helps the right people respond."
          >
            <Field
              label="Service"
              as="select"
              name="service"
              required
              defaultValue={j?.service || ''}
            >
              <option value="">Choose a service</option>
              {catalog.services.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </Field>
            {catalog.error && <ErrorNotice error={catalog.error} />}
            <Field
              label="Job title"
              name="title"
              required
              minLength={5}
              maxLength={120}
              defaultValue={j?.title}
              placeholder="e.g. Repair a leaking kitchen tap"
            />
            <Field
              label="Describe your project"
              as="textarea"
              rows={6}
              name="description"
              required
              minLength={20}
              maxLength={3000}
              defaultValue={j?.description}
              placeholder="Tell the professional what needs doing, and anything useful to know."
            />
            <FileUpload
              purpose="JOB_ATTACHMENT"
              label="Add project photos"
              multiple
              onChange={setNewAttachments}
              max={5 - retainedAttachments.length}
            />
            {retainedAttachments.map((mediaId) => (
              <div className="row between small" key={mediaId}>
                <span>Existing project photo</span>
                <button type="button" className="text-button"
                  onClick={() => setRetainedAttachments((ids) => ids.filter((id) => id !== mediaId))}>
                  Remove existing photo
                </button>
              </div>
            ))}
          </Panel>
          <Panel title="02 / A budget that works for you">
            <Field
              label="Budget approach"
              as="select"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="OPEN_TO_QUOTES">I’m open to quotes</option>
              <option value="FIXED">A fixed budget</option>
              <option value="RANGE">A budget range</option>
            </Field>
            {type === 'FIXED' && (
              <Field
                label="Budget · GMD"
                name="amount"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={
                  j?.budget.amountBututs !== undefined
                    ? gmdInput(j.budget.amountBututs)
                    : undefined
                }
              />
            )}{' '}
            {type === 'RANGE' && (
              <div className="two-grid">
                <Field
                  label="Minimum · GMD"
                  name="min"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  defaultValue={gmdInput(j?.budget.minAmountBututs)}
                />
                <Field
                  label="Maximum · GMD"
                  name="max"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  defaultValue={gmdInput(j?.budget.maxAmountBututs)}
                />
              </div>
            )}
          </Panel>
        </div>
        <div className="stack">
          <Panel title="03 / Where & when">
            <Field
              label="General service area"
              name="area"
              required
              maxLength={100}
              defaultValue={j?.serviceArea.name}
              placeholder="e.g. Brikama"
            />
            <Field
              label="Region (optional)"
              name="region"
              maxLength={100}
              defaultValue={j?.serviceArea.region}
            />
            <Field
              label="Private address (optional)"
              name="privateAddress"
              maxLength={500}
              defaultValue={j?.privateAddress}
              hint="Not shown in worker opportunity listings."
            />
            <JobLocation value={location} onChange={setLocation} />
            <Field
              label="Preferred date (optional)"
              name="preferredDate"
              type="date"
              defaultValue={j?.preferredDate}
            />
            <Field
              label="Timing notes (optional)"
              name="preferredTimeNote"
              maxLength={200}
              defaultValue={j?.preferredTimeNote}
              placeholder="e.g. Morning preferred"
            />
            <Field
              label="Request expiry (optional)"
              name="expiresAt"
              type="datetime-local"
              hint="Defaults to 7 days; maximum 30 days."
            />
          </Panel>
          <Notice>
            Your brief can be edited until the first quote arrives. After that,
            its terms stay fixed so offers can be compared fairly.
          </Notice>
        </div>
      </div>
      {error && <ErrorNotice error={error} />}
      <div className="form-footer">
        <Button to="/app/jobs" variant="outline">
          Back to jobs
        </Button>
        <Button type="submit" disabled={action.isPending}>
          {action.isPending
            ? 'Publishing…'
            : j
              ? 'Save changes'
              : 'Publish job'}
          <ArrowUpRight size={17} />
        </Button>
      </div>
    </form>
  );
}
export function JobDetails() {
  const { id } = useParams(),
    { user } = useAuth(),
    worker = user.role === 'WORKER',
    query = useApi('/job-requests/' + id + (worker ? '/opportunity' : '')),
    navigate = useNavigate();
  return (
    <>
      <Link
        className="back-link"
        to={worker ? '/work/opportunities' : '/app/jobs'}
      >
        ← Back to {worker ? 'opportunities' : 'your jobs'}
      </Link>
      <QueryState query={query}>
        {(data) => {
          const j = worker ? data.opportunity : data.jobRequest;
          return (
            <>
              <PageTitle
                eyebrow={'PROJECT ' + shortId(j.id)}
                title={j.title}
                description={
                  j.serviceArea.name + ' · Posted ' + date(j.createdAt)
                }
              >
                <Chip status={j.status} />
                {!worker && canEditJob(j) && (
                  <Button to={'/app/jobs/' + id + '/edit'} variant="secondary">
                    Edit brief
                  </Button>
                )}
                {!worker && j.status === 'OPEN' && (
                  <Command
                    label="Cancel job"
                    path={'/job-requests/' + id + '/cancel'}
                    description="This closes the request and all pending quotes."
                    variant="outline"
                  />
                )}
              </PageTitle>
              <div className="two-grid">
                <Panel title="The project">
                  <p className="prose">{j.description}</p>
                  <dl className="details">
                    <div>
                      <dt>Budget</dt>
                      <dd>{budget(j.budget)}</dd>
                    </div>
                    <div>
                      <dt>Preferred date</dt>
                      <dd>{date(j.preferredDate)}</dd>
                    </div>
                    <div>
                      <dt>Timing notes</dt>
                      <dd>{j.preferredTimeNote || 'Flexible'}</dd>
                    </div>
                    <div>
                      <dt>Open until</dt>
                      <dd>{dateTime(j.expiresAt)}</dd>
                    </div>
                  </dl>
                  {j.match && (
                    <div className="tags">
                      {j.match.reasons.map((r) => (
                        <span key={r}>
                          {r === 'IDENTITY_APPROVED'
                            ? 'Identity verified'
                            : r === 'SERVES_AREA'
                              ? 'Your service area'
                              : r === 'OFFERS_SERVICE'
                                ? 'Your service'
                                : 'Within your radius'}
                        </span>
                      ))}
                    </div>
                  )}
                  {!!j.attachments.length && (
                    <div className="portfolio-grid">
                      {j.attachments.map((mid) => (
                        <ProtectedMedia
                          key={mid}
                          path={
                            '/job-requests/' +
                            id +
                            '/attachments/' +
                            mid +
                            '/access'
                          }
                          alt="Customer project attachment"
                        />
                      ))}
                    </div>
                  )}
                </Panel>
                <Panel title={worker ? 'Your quote' : 'What happens next'}>
                  {worker ? (
                    <QuoteForm jobId={id} />
                  ) : j.status === 'QUOTE_ACCEPTED' ? (
                    <>
                      <Notice>
                        Quote accepted. Choose a schedule to create your
                        booking. No booking has been created automatically.
                      </Notice>
                      <ActionForm
                        path="/bookings/from-quote"
                        fields={scheduleFields}
                        build={(v) => ({
                          quote: j.acceptedQuote,
                          ...scheduleBody(v),
                        })}
                        submit="Create booking"
                        onSuccess={(d) =>
                          navigate('/app/bookings/' + d.booking.id)
                        }
                      />
                    </>
                  ) : (
                    <>
                      <BriefcaseBusiness className="accent-text" size={32} />
                      <p className="prose">
                        Eligible professionals can respond with quotes. Compare
                        their profiles and offers, ask questions, and choose the
                        right fit for your project.
                      </p>
                      <p className="muted">{j.quoteCount} quotes received</p>
                    </>
                  )}
                </Panel>
              </div>
              {!worker && <ReceivedQuotes job={j} />}
            </>
          );
        }}
      </QueryState>
    </>
  );
}
const quoteFields = [
  {
    name: 'amount',
    label: 'Your quote · GMD',
    type: 'number',
    step: '0.01',
    min: 0,
    required: true,
  },
  {
    name: 'message',
    label: 'A note for the customer',
    as: 'textarea',
    maxLength: 1500,
    rows: 4,
  },
  {
    name: 'duration',
    label: 'Estimated duration · minutes (optional)',
    type: 'number',
    min: 15,
    max: 43200,
  },
  { name: 'date', label: 'Proposed date (optional)', type: 'date' },
  { name: 'note', label: 'Scheduling note (optional)', maxLength: 300 },
];
function quoteBody(v) {
  return {
    proposedAmountBututs: bututs(v.amount),
    message: v.message,
    ...(v.duration ? { estimatedDurationMinutes: Number(v.duration) } : {}),
    ...(v.date ? { proposedSchedule: { date: v.date, note: v.note } } : {}),
  };
}
function QuoteForm({ jobId, quote }) {
  const navigate = useNavigate();
  return (
    <>
      <Notice>
        Your quote is an offer. The customer chooses whether to accept it. Keep
        contact details inside SkillLink.
      </Notice>
      <ActionForm
        path={
          quote ? '/quotes/' + quote.id : '/job-requests/' + jobId + '/quotes'
        }
        method={quote ? 'PATCH' : 'POST'}
        fields={quoteFields}
        initial={
          quote
            ? {
                amount: gmdInput(quote.proposedAmountBututs),
                message: quote.message,
                duration: quote.estimatedDurationMinutes,
                date: quote.proposedSchedule?.date,
                note: quote.proposedSchedule?.note,
              }
            : {}
        }
        build={quoteBody}
        submit={quote ? 'Update quote' : 'Submit your quote'}
        onSuccess={(data) => {
          if (!quote) navigate('/work/quotes/' + data.quote.id);
        }}
      />
    </>
  );
}
function ReceivedQuotes({ job }) {
  const [page, setPage] = useState(1),
    query = useApi(
      '/job-requests/' + job.id + '/quotes',
      { page, limit: 10 },
      { refetchInterval: 15000 },
    );
  return (
    <Panel
      title="Find your right fit"
      description="Compare offers, explore profiles and keep the conversation in SkillLink."
    >
      <QueryState query={query}>
        {(data) => (
          <>
            {data.quotes.length ? (
              <div className="quote-grid">
                {data.quotes.map((q) => (
                  <article className="quote-card" key={q.id}>
                    <div className="row between">
                      <div className="row">
                        <Avatar
                          person={q.workerProfile}
                          src={q.workerProfile?.profileImage?.url}
                        />
                        <div>
                          <h3>
                            {q.workerProfile
                              ? displayName(q.workerProfile)
                              : 'Professional ' + shortId(q.worker)}
                          </h3>
                          <span className="small muted">
                            {q.workerProfile?.professionTitle}
                          </span>
                        </div>
                      </div>
                      <Chip status={q.status} />
                    </div>
                    {q.workerProfile?.verificationSummary.identityVerified && (
                      <span className="verified">
                        <ShieldCheck size={14} />
                        Identity verified
                      </span>
                    )}
                    <strong className="quote-price">
                      {money(q.proposedAmountBututs)}
                    </strong>
                    <p>
                      {q.message || 'A professional offer for your project.'}
                    </p>
                    <p className="small muted">
                      {q.estimatedDurationMinutes
                        ? q.estimatedDurationMinutes + ' minutes estimated'
                        : 'Duration to discuss'}
                      {q.proposedSchedule?.date
                        ? ' · ' + date(q.proposedSchedule.date)
                        : ''}
                    </p>
                    <div className="actions">
                      <Button
                        variant="outline"
                        to={'/professionals/' + q.worker}
                      >
                        View profile
                      </Button>
                      <StartChat type="QUOTE" id={q.id} />
                      {job.status === 'OPEN' && canChangeQuote(q) && (
                        <Command
                          label="Accept quote"
                          path={'/quotes/' + q.id + '/accept'}
                          description={
                            'Accept this offer for ' +
                            money(q.proposedAmountBututs) +
                            '? Competing pending quotes will close. Choose your booking schedule afterward.'
                          }
                        />
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                title="Your request is out there"
                description="Quotes from relevant professionals will appear here."
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
  );
}
export function Quotes() {
  const [page, setPage] = useState(1),
    query = useApi('/quotes/me', { page, limit: 12 });
  return (
    <>
      <PageTitle
        eyebrow="YOUR OFFERS"
        title="A good offer opens a door."
        description="Manage the quotes you’ve sent to customers."
      />
      <QueryState query={query}>
        {(data) => (
          <>
            {data.quotes.length ? (
              <div className="job-grid">
                {data.quotes.map((q) => (
                  <Panel
                    key={q.id}
                    title={money(q.proposedAmountBututs)}
                    action={<Chip status={q.status} />}
                  >
                    <p className="prose">{q.message || 'Your service offer'}</p>
                    <p className="muted small">
                      Sent {date(q.createdAt)} ·{' '}
                      {q.estimatedDurationMinutes || '—'} minutes estimated
                    </p>
                    <div className="actions">
                      <Button to={'/work/quotes/' + q.id} variant="secondary">
                        View offer
                        <ArrowUpRight size={16} />
                      </Button>
                      <StartChat type="QUOTE" id={q.id} />
                    </div>
                  </Panel>
                ))}
              </div>
            ) : (
              <Empty
                title="Put your skills forward"
                description="Find a relevant opportunity and send your first quote."
                action={
                  <Button to="/work/opportunities">Find opportunities</Button>
                }
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
    </>
  );
}
export function QuoteDetails() {
  const { id } = useParams(),
    query = useApi('/quotes/' + id);
  return (
    <>
      <PageTitle
        title="Your service offer."
        description="Pending quotes can be updated or withdrawn. Accepted terms remain fixed."
      />
      <QueryState query={query}>
        {({ quote: q }) => (
          <div className="two-grid">
            <Panel
              title={money(q.proposedAmountBututs)}
              action={<Chip status={q.status} />}
            >
              <p>{q.message}</p>
              <p className="muted">Offer expires {dateTime(q.expiresAt)}</p>
              <StartChat type="QUOTE" id={q.id} />
              {canChangeQuote(q) && (
                <Command
                  label="Withdraw quote"
                  path={'/quotes/' + id + '/withdraw'}
                  description="Withdraw your offer? You cannot submit a replacement quote for this job."
                  variant="outline"
                />
              )}
            </Panel>
            {canChangeQuote(q) && (
              <Panel title="Refine your offer">
                <QuoteForm quote={q} />
              </Panel>
            )}
          </div>
        )}
      </QueryState>
    </>
  );
}
