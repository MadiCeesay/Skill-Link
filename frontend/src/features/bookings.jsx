import { useState } from 'react';
import {
  Link,
  useParams,
  useNavigate,
} from 'react-router-dom';
import {
  CalendarDays,
  ArrowUpRight,
  ShieldCheck,
  Wallet,
  CheckCircle2,
  Clock3,
  MapPin,
} from 'lucide-react';
import { useApi, useAction } from '../api/hooks';
import { useAuth } from '../api/auth';
import {
  PageTitle,
  Panel,
  Button,
  QueryState,
  Empty,
  Chip,
  Pager,
  ActionForm,
  Command,
  Notice,
  FileUpload,
  ProtectedMedia,
  ErrorNotice,
  Field,
  toast,
} from '../components/ui';
import { money, dateTime } from '../utils/format';
import { bookingActions, homeFor } from '../utils/policy';
import { StartChat } from './messaging';
import { JobLocationLink } from '../components/JobLocation';
export function Bookings() {
  const { user } = useAuth(),
    base = homeFor(user.role),
    [page, setPage] = useState(1),
    query = useApi('/bookings/me', { page, limit: 15 });
  return (
    <>
      <PageTitle
        eyebrow="YOUR PLANS, ALL TOGETHER"
        title="Good work on the calendar."
        description="Manage schedules, conversations and the next step for every booking."
      >
        <Button to={base + '/proposals'} variant="outline">
          Direct proposals
          <ArrowUpRight size={17} />
        </Button>
      </PageTitle>
      <QueryState query={query}>
        {(data) => (
          <>
            {data.bookings.length ? (
              <Panel title="Your bookings">
                <div className="booking-list">
                  {data.bookings.map((b) => (
                    <Link
                      to={base + '/bookings/' + b.id}
                      key={b.id}
                      className="booking-row"
                    >
                      <span className="booking-date">
                        <strong>
                          {new Date(b.scheduledStart).getUTCDate()}
                        </strong>
                        <small>
                          {new Date(b.scheduledStart).toLocaleDateString(
                            'en-GB',
                            { month: 'short', timeZone: 'Africa/Banjul' },
                          )}
                        </small>
                      </span>
                      <div className="booking-row-main">
                        <h3>{b.description.slice(0, 80)}</h3>
                        <p className="muted small">
                          {b.serviceArea?.name} · {dateTime(b.scheduledStart)}
                        </p>
                      </div>
                      <Chip status={b.status} />
                      <strong>{money(b.agreedAmountBututs)}</strong>
                      <ArrowUpRight size={18} />
                    </Link>
                  ))}
                </div>
              </Panel>
            ) : (
              <Empty
                icon={CalendarDays}
                title="Make room for something good"
                description="Your bookings appear once a direct proposal is accepted or an accepted quote is scheduled."
                action={
                  <Button
                    to={
                      user.role === 'WORKER'
                        ? '/work/opportunities'
                        : '/professionals'
                    }
                  >
                    {user.role === 'WORKER'
                      ? 'Find opportunities'
                      : 'Find a professional'}
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
        )}
      </QueryState>
    </>
  );
}
export function BookingDetails() {
  const { id } = useParams(),
    { user } = useAuth(),
    query = useApi('/bookings/' + id, undefined, { staleTime: 0, refetchInterval: 15000 }),
    payment = useApi('/payments/bookings/' + id),
    [evidence, setEvidence] = useState([]),
    [reviewed, setReviewed] = useState(false);
  const b = query.data?.booking,
    actions = bookingActions(b, user.role);
  return (
    <>
      <Link to={homeFor(user.role) + '/bookings'} className="back-link">
        ← All bookings
      </Link>
      <QueryState query={query}>
        {({ booking: b }) => (
          <>
            <PageTitle
              eyebrow="YOUR BOOKING"
              title="The plan, from start to finish."
              description={dateTime(b.scheduledStart)}
            >
              <Chip status={b.status} />
              <StartChat type="BOOKING" id={id} />
            </PageTitle>
            <div className="booking-detail-grid">
              <div className="stack">
                <Panel title="Your service">
                  <p className="prose">{b.description}</p>
                  <dl className="details">
                    <div>
                      <dt>Scheduled start</dt>
                      <dd>{dateTime(b.scheduledStart)}</dd>
                    </div>
                    <div>
                      <dt>Scheduled end</dt>
                      <dd>{dateTime(b.scheduledEnd)}</dd>
                    </div>
                    <div>
                      <dt>General area</dt>
                      <dd>{b.serviceArea?.name}</dd>
                    </div>
                    {b.privateAddress && (
                      <div>
                        <dt>Private booking address</dt>
                        <dd>{b.privateAddress}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Agreed amount</dt>
                      <dd>{money(b.agreedAmountBututs)}</dd>
                    </div>
                  </dl>
                  <JobLocationLink location={b.location} />
                  {user.role === 'WORKER' && b.status === 'AWAITING_PAYMENT' && <Notice>Exact job location becomes available after the booking is confirmed.</Notice>}
                  <Button variant="outline" to={'/professionals/' + b.worker}>View professional profile</Button>
                </Panel>
                <Panel title="Progress">
                  <ol className="timeline">
                    {[
                      ['AWAITING_PAYMENT', 'Booking arranged', null],
                      [
                        'CONFIRMED',
                        'Payment simulated',
                        payment.data?.payment.paidAt,
                      ],
                      ['IN_PROGRESS', 'Work started', b.startedAt],
                      [
                        'WORKER_MARKED_COMPLETED',
                        'Professional marked complete',
                        b.workerCompletedAt,
                      ],
                      ['COMPLETED', 'Customer confirmed', b.completedAt],
                    ].map(([s, t, d]) => (
                      <li className={d || b.status === s ? 'done' : ''} key={s}>
                        <span />
                        <div>
                          <strong>{t}</strong>
                          <small>
                            {d
                              ? dateTime(d)
                              : b.status === s
                                ? 'Current step'
                                : 'Not reached yet'}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ol>
                  {b.status === 'DISPUTED' && (
                    <Notice>
                      This booking is under dispute review. Simulated funds stay
                      held until an administrator resolves the case.
                    </Notice>
                  )}
                </Panel>
                {(b.completionNotes || b.completionEvidence?.length > 0) && (
                  <Panel title="Work shared by your professional">
                    <p>{b.completionNotes}</p>
                    <div className="portfolio-grid">
                      {b.completionEvidence?.map((mid) => (
                        <ProtectedMedia
                          key={mid}
                          path={
                            '/bookings/' + id + '/evidence/' + mid + '/access'
                          }
                          alt="Private completion evidence"
                        />
                      ))}
                    </div>
                  </Panel>
                )}
              </div>
              <div className="stack">
                <Panel title="Your next step">
                  {actions.includes('pay') && (
                    <>
                      <Notice>
                        Simulation only. No real money will be charged.
                      </Notice>
                      <p className="muted">
                        Your slot is held until{' '}
                        {dateTime(b.reservationExpiresAt)}. Expired reservations
                        cannot be paid.
                      </p>
                      <Button
                        to={homeFor(user.role) + '/bookings/' + id + '/payment'}
                      >
                        Open simulated checkout
                        <ArrowUpRight size={17} />
                      </Button>
                    </>
                  )}
                  {actions.includes('cancel') && (
                    <Command
                      label="Cancel reservation"
                      path={'/bookings/' + id + '/cancel'}
                      variant="outline"
                      fields={[
                        {
                          name: 'reason',
                          label: 'Reason for cancellation',
                          required: true,
                          maxLength: 500,
                        },
                      ]}
                      build={(v) => ({ reason: v.reason })}
                      description="Cancel this unpaid reservation and release the slot?"
                    />
                  )}
                  {actions.includes('start') && (
                    <Command
                      label="Start work"
                      path={'/bookings/' + id + '/start'}
                      description="Confirm you’re ready to start this scheduled service."
                    />
                  )}
                  {user.role === 'WORKER' &&
                    b.status === 'CONFIRMED' &&
                    !actions.includes('start') && (
                      <Notice>
                        You can start work at or after the scheduled start time.
                      </Notice>
                    )}
                  {actions.includes('complete') && (
                    <>
                      <FileUpload
                        purpose="COMPLETION_EVIDENCE"
                        multiple
                        onChange={setEvidence}
                        label="Add completion photos (optional)"
                      />
                      <ActionForm
                        path={'/bookings/' + id + '/complete'}
                        fields={[
                          {
                            name: 'notes',
                            label: 'Completion notes',
                            as: 'textarea',
                            maxLength: 2000,
                          },
                        ]}
                        build={(v) => ({ notes: v.notes, evidence })}
                        submit="Mark work complete"
                      />
                    </>
                  )}
                  {actions.includes('confirm') && (
                    <Command
                      label="Confirm completion"
                      path={'/bookings/' + id + '/confirm-completion'}
                      description="Confirm that the work is complete? This releases the simulated payment to the professional."
                    />
                  )}
                  {actions.includes('dispute') && (
                    <Button
                      to={homeFor(user.role) + '/bookings/' + id + '/problem'}
                      variant="outline"
                    >
                      Report a problem
                    </Button>
                  )}
                  {actions.includes('review') && query.data?.reviewEligibility?.canReview && !reviewed && (
                    <Command
                      label="Share a review"
                      path={'/bookings/' + id + '/reviews'}
                      fields={[
                        {
                          name: 'rating',
                          label: 'Your rating',
                          required: true,
                          options: [
                            { value: 5, label: '5 · Excellent' },
                            { value: 4, label: '4 · Good' },
                            { value: 3, label: '3 · Okay' },
                            { value: 2, label: '2 · Disappointing' },
                            { value: 1, label: '1 · Poor' },
                          ],
                        },
                        {
                          name: 'comment',
                          label: 'Your experience',
                          as: 'textarea',
                          maxLength: 2000,
                        },
                      ]}
                      build={(v) => ({
                        rating: Number(v.rating),
                        comment: v.comment,
                      })}
                      description="Share your experience of this completed booking. One genuine review is allowed."
                      onSuccess={() => setReviewed(true)}
                    />
                  )}{' '}
                  {!actions.length && (
                    <p className="muted">
                      {b.status === 'COMPLETED'
                        ? 'This project is complete. Thank you for making good work happen.'
                        : b.status === 'CANCELLED'
                          ? 'This booking is closed. Find a professional or create a new request when you’re ready.'
                          : 'There is no action needed from you right now.'}
                    </p>
                  )}
                </Panel>
                <Panel title="Simulated payment">
                  {payment.data ? (
                    <>
                      <Chip status={payment.data.payment.status} />
                      <dl className="details">
                        <div>
                          <dt>Total</dt>
                          <dd>{money(payment.data.payment.amountBututs)}</dd>
                        </div>
                        <div>
                          <dt>Platform fee</dt>
                          <dd>
                            {money(payment.data.payment.platformFeeBututs)}
                          </dd>
                        </div>
                        <div>
                          <dt>Professional amount</dt>
                          <dd>
                            {money(payment.data.payment.workerAmountBututs)}
                          </dd>
                        </div>
                      </dl>
                      <Button
                        variant="text"
                        to={homeFor(user.role) + '/bookings/' + id + '/payment'}
                      >
                        Payment & ledger
                        <ArrowUpRight size={15} />
                      </Button>
                    </>
                  ) : payment.error?.status === 404 ? (
                    <p className="muted">No checkout attempt yet.</p>
                  ) : payment.error ? (
                    <ErrorNotice error={payment.error} />
                  ) : (
                    <p className="muted">Loading payment…</p>
                  )}
                </Panel>
              </div>
            </div>
          </>
        )}
      </QueryState>
    </>
  );
}
export function PaymentRedirect() {
  const { id } = useParams(),
    { user } = useAuth(),
    navigate = useNavigate(),
    query = useApi('/payments/' + id);
  return <QueryState query={query}>{(data) => (
    <Panel title="Payment update">
      <p>View the payment attached to this booking.</p>
      <Button onClick={() => navigate(homeFor(user.role) + '/bookings/' + data.payment.booking + '/payment', { replace: true })}>
        View booking payment
      </Button>
    </Panel>
  )}</QueryState>;
}
export function Payment() {
  const { id } = useParams(),
    { user } = useAuth(),
    booking = useApi('/bookings/' + id),
    query = useApi('/payments/bookings/' + id),
    [key, setKey] = useState(() => crypto.randomUUID()),
    [error, setError] = useState(null),
    [outcome, setOutcome] = useState('SUCCESS'),
    action = useAction();
  const p = query.data?.payment,
    ledger = useApi(p ? '/payments/' + p.id + '/ledger' : null);
  async function pay(e) {
    e.preventDefault();
    setError(null);
    try {
      await action.mutateAsync({
        path: '/payments/bookings/' + id + '/checkout',
        body: { outcome, idempotencyKey: key },
      });
      toast('Simulation result recorded.');
    } catch (e) {
      setError(e);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="SIMULATION ONLY · NO REAL MONEY"
        title="A clear picture of your payment."
        description="This demonstration never asks for card, bank or wallet details."
      />
      <QueryState query={booking}>
        {({ booking: b }) => (
          <div className="two-grid">
            <Panel title="Booking summary">
              <p className="prose">{b.description}</p>
              <strong className="checkout-total">
                {money(b.agreedAmountBututs)}
              </strong>
              <Chip status={b.status} />
              <p className="muted">{dateTime(b.scheduledStart)}</p>
              <Button
                variant="outline"
                to={homeFor(user.role) + '/bookings/' + id}
              >
                Back to booking
              </Button>
            </Panel>
            <Panel title="Mock checkout">
              <Notice>
                All payment outcomes are simulated. No actual funds are
                collected, held or released.
              </Notice>
              {query.isPending && <p role="status">Loading payment details…</p>}
              {query.error && query.error.status !== 404 && (
                <ErrorNotice error={query.error} retry={() => query.refetch()} />
              )}
              {query.error?.status === 404 && (
                <Notice>No payment simulation has been recorded for this booking.</Notice>
              )}
              {p && (
                <>
                  <Chip status={p.status} />
                  <dl className="details">
                    <div>
                      <dt>Platform fee</dt>
                      <dd>{money(p.platformFeeBututs)}</dd>
                    </div>
                    <div>
                      <dt>Professional earnings</dt>
                      <dd>{money(p.workerAmountBututs)}</dd>
                    </div>
                  </dl>
                </>
              )}
              {user.role === 'CUSTOMER' && b.status === 'AWAITING_PAYMENT' && (
                <form className="form-stack" onSubmit={pay}>
                  <Field
                    label="Simulation outcome"
                    as="select"
                    value={outcome}
                    onChange={(e) => {
                      setOutcome(e.target.value);
                      setKey(crypto.randomUUID());
                    }}
                  >
                    <option value="SUCCESS">Successful payment</option>
                    <option value="FAILURE">Failed payment</option>
                    <option value="PENDING">Pending payment</option>
                  </Field>
                  <Button type="submit" disabled={action.isPending}>
                    {action.isPending
                      ? 'Running simulation…'
                      : 'Run payment simulation'}
                  </Button>
                  {p && ['PENDING', 'FAILED'].includes(p.status) && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setKey(crypto.randomUUID());
                        toast('Ready for a new simulation attempt.');
                      }}
                    >
                      Start a new attempt
                    </button>
                  )}
                </form>
              )}
              {error && <ErrorNotice error={error} />}
            </Panel>
          </div>
        )}
      </QueryState>
      {p && (
        <Panel title="Simulated payment activity">
          <QueryState query={ledger}>
            {(data) => (
              <div>
                {data.entries.map((e) => (
                  <div className="list-row" key={e.id}>
                    <div>
                      <strong>
                        {e.type.toLowerCase().replaceAll('_', ' ')}
                      </strong>
                      <p className="small muted">{dateTime(e.createdAt)}</p>
                    </div>
                    <strong>{money(e.amountBututs)}</strong>
                  </div>
                ))}
              </div>
            )}
          </QueryState>
        </Panel>
      )}
    </>
  );
}
export function ReportProblem() {
  const { id } = useParams(),
    query = useApi('/bookings/' + id, undefined, { staleTime: 0, refetchInterval: 15000 }),
    [evidence, setEvidence] = useState([]),
    navigate = useNavigate();
  return (
    <>
      <PageTitle
        eyebrow="LET’S TAKE A CLOSER LOOK"
        title="Something not quite right?"
        description="Tell us about the issue. Simulated funds remain held while the dispute is reviewed."
      />
      <QueryState query={query}>
        {({ booking: b }) =>
          ['CONFIRMED', 'IN_PROGRESS', 'WORKER_MARKED_COMPLETED'].includes(
            b.status,
          ) ? (
            <Panel title="Report a booking problem">
              <FileUpload
                purpose="DISPUTE_EVIDENCE"
                multiple
                onChange={setEvidence}
                label="Add evidence photos (optional)"
              />
              <ActionForm
                path={'/bookings/' + id + '/dispute'}
                fields={[
                  {
                    name: 'reason',
                    label: 'Short reason',
                    required: true,
                    maxLength: 120,
                  },
                  {
                    name: 'description',
                    label: 'What happened?',
                    as: 'textarea',
                    required: true,
                    minLength: 20,
                    maxLength: 3000,
                    rows: 6,
                  },
                ]}
                build={(v) => ({ ...v, evidence })}
                submit="Submit problem report"
                onSuccess={(d) => navigate('/app/disputes/' + d.dispute.id)}
              />
            </Panel>
          ) : (
            <Notice>
              This booking cannot receive a new dispute in its current state.
            </Notice>
          )
        }
      </QueryState>
    </>
  );
}
export function Dispute() {
  const { id } = useParams(),
    { user } = useAuth(),
    query = useApi('/disputes/' + id);
  return (
    <>
      <PageTitle
        title="Your problem report."
        description="A clear record of the issue and its resolution."
      />
      <QueryState query={query}>
        {({ dispute: d }) => (
          <Panel title={d.reason} action={<Chip status={d.status} />}>
            <p className="prose">{d.description}</p>
            <div className="portfolio-grid">
              {d.evidence.map((mid) => (
                <ProtectedMedia
                  key={mid}
                  path={
                    '/bookings/' + d.booking + '/evidence/' + mid + '/access'
                  }
                  alt="Dispute evidence"
                />
              ))}
            </div>
            {d.adminDecision && (
              <Notice>
                {d.adminDecision === 'REFUND_CUSTOMER'
                  ? 'Simulated payment refunded to customer.'
                  : 'Simulated payment released to professional.'}{' '}
                {d.decisionReason}
              </Notice>
            )}
            <Button
              variant="outline"
              to={homeFor(user.role) + '/bookings/' + d.booking}
            >
              View booking
            </Button>
          </Panel>
        )}
      </QueryState>
    </>
  );
}
