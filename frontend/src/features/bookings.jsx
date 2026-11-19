import { useEffect, useRef, useState } from 'react';
import {
  Link,
  useParams,
  useNavigate,
  useSearchParams,
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
  Avatar,
  PaymentDemoLabel,
} from '../components/ui';
import { money, dateTime, displayName, paymentEventLabel } from '../utils/format';
import { bookingActions, homeFor, paymentOpen } from '../utils/policy';
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

        title="Bookings"
        description="Manage schedules, conversations and the next step for every booking."
      >
        <Button to={base + '/proposals'} variant="outline">
          Offers
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
                        <div className="row booking-person">
                          <Avatar person={b.counterpart} src={b.counterpart?.profileImage?.url} size="small" />
                          <strong>{displayName(b.counterpart) || (user.role === 'WORKER' ? 'Customer unavailable' : 'Professional unavailable')}</strong>
                        </div>
                        <p><strong>{b.serviceSummary?.name || 'Service unavailable'}</strong></p>
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
                title="No bookings yet"
                description="Accepted offers become bookings once a time is agreed."
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

              title="Booking details"
              description={dateTime(b.scheduledStart)}
            >
              <Chip status={b.status} />
              <StartChat type="BOOKING" id={id} />
            </PageTitle>
            <div className="booking-detail-grid">
              <div className="stack">
                <Panel title="Your service">
                  <div className="row booking-person">
                    <Avatar person={b.counterpart} src={b.counterpart?.profileImage?.url} size="large" />
                    <div><p className="muted small">{user.role === 'WORKER' ? 'Your customer' : 'Your professional'}</p>
                      <h2>{displayName(b.counterpart) || (user.role === 'WORKER' ? 'Customer unavailable' : 'Professional unavailable')}</h2>
                      <p>{b.serviceSummary?.name || 'Service unavailable'}</p>
                    </div>
                  </div>
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
                  {(user.role === 'CUSTOMER' || ['CONFIRMED', 'IN_PROGRESS', 'WORKER_MARKED_COMPLETED', 'COMPLETED', 'DISPUTED'].includes(b.status)) && <JobLocationLink location={b.location} />}
                  {user.role === 'WORKER' && b.status === 'AWAITING_PAYMENT' && <Notice>Exact job location becomes available after the booking is confirmed.</Notice>}
                  {user.role === 'CUSTOMER' && <Button variant="outline" to={'/professionals/' + b.worker}>View professional profile</Button>}
                </Panel>
                <Panel title="Progress">
                  <ol className="timeline">
                    {[
                      ['AWAITING_PAYMENT', 'Booking arranged', b.createdAt],
                      [
                        'CONFIRMED',
                        'Payment recorded',
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
                      This booking is under dispute review. Payment stays
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
                      <p className="muted">
                        Your slot is held until{' '}
                        {dateTime(b.reservationExpiresAt)}. Expired reservations
                        cannot be paid.
                      </p>
                      <Button
                        to={homeFor(user.role) + '/bookings/' + id + '/payment'}
                      >
                        Pay for booking
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
                      description="Confirm that the work is complete? This releases the payment to the professional."
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
                        ? 'This booking is complete.'
                        : b.status === 'CANCELLED'
                          ? 'This booking is closed. Find a professional or create a new request when you’re ready.'
                          : 'There is no action needed from you right now.'}
                    </p>
                  )}
                </Panel>
                <Panel title="Payment">
                  <PaymentDemoLabel />
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
                        Payment history
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
function timeLeft(until, now) {
  const total = Math.max(0, Math.floor((new Date(until) - now) / 1000));
  const m = Math.floor(total / 60), sec = total % 60;
  return m + ':' + String(sec).padStart(2, '0');
}
export function Payment() {
  const { id } = useParams(),
    { user } = useAuth(),
    booking = useApi('/bookings/' + id),
    query = useApi('/payments/bookings/' + id),
    [key, setKey] = useState(() => crypto.randomUUID()),
    [error, setError] = useState(null),
    [outcome, setOutcome] = useState('SUCCESS'),
    [search, setSearch] = useSearchParams(),
    providerQuery = useApi('/payments/provider'),
    action = useAction(),
    verify = useAction(),
    verified = useRef(false),
    [now, setNow] = useState(() => new Date());
  // Ticks every second so the countdown is live and the Pay button disappears the moment
  // the hold runs out, instead of waiting for the server to refuse the payment.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const p = query.data?.payment,
    ledger = useApi(p ? '/payments/' + p.id + '/ledger' : null),
    live = providerQuery.data?.redirects === true,
    returned = search.get('modempay');
  // Back from Modem Pay: ask the server to confirm the result with Modem Pay.
  useEffect(() => {
    if (returned !== 'return' || verified.current) return;
    verified.current = true;
    verify.mutateAsync({ path: '/payments/bookings/' + id + '/verify' })
      .then((r) => {
        const status = r?.payment?.status;
        toast(status === 'HELD' ? 'Payment received. Your booking is confirmed.'
          : status === 'FAILED' ? 'The payment did not go through.'
          : 'Payment is still processing. Check again in a moment.');
      })
      .catch(setError)
      .finally(() => { query.refetch(); booking.refetch(); setSearch({}, { replace: true }); });
  }, [returned]); // eslint-disable-line react-hooks/exhaustive-deps
  async function pay(e) {
    e.preventDefault();
    setError(null);
    try {
      const result = await action.mutateAsync({
        path: '/payments/bookings/' + id + '/checkout',
        body: live ? { idempotencyKey: key } : { outcome, idempotencyKey: key },
      });
      if (live && result?.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }
      toast('Payment result recorded.');
    } catch (e) {
      setError(e);
      // The booking changed on the server (hold ran out, cancelled or already paid): reload it.
      if (['RESERVATION_EXPIRED', 'BOOKING_CLOSED', 'BOOKING_ALREADY_PAID', 'BOOKING_NOT_PAYABLE'].includes(e.code)) {
        booking.refetch();
        query.refetch();
      }
    }
  }
  async function checkAgain() {
    setError(null);
    try {
      await verify.mutateAsync({ path: '/payments/bookings/' + id + '/verify' });
    } catch (e) { setError(e); }
    query.refetch(); booking.refetch();
  }
  return (
    <>
      <PageTitle
        title="Payment"
        description="Check the amount and payment status."
      />
      {live ? (
        <p className="small muted payment-demo-label">Modem Pay test mode · use test wallets or cards, no real money moves.</p>
      ) : <PaymentDemoLabel />}
      {returned === 'cancelled' && <Notice>Payment was cancelled. You can try again when ready.</Notice>}
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
            <Panel title="Payment details">
              {query.isPending && <p role="status">Loading payment details…</p>}
              {query.error && query.error.status !== 404 && (
                <ErrorNotice error={query.error} retry={() => query.refetch()} />
              )}
              {query.error?.status === 404 && (
                <Notice>No payment has been recorded for this booking.</Notice>
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
              {user.role === 'CUSTOMER' && b.status === 'AWAITING_PAYMENT' && !paymentOpen(b, now) && (
                <Notice>
                  The time to pay for this booking has run out, so the slot was released. Create a new
                  request to book this professional again.
                </Notice>
              )}
              {user.role === 'CUSTOMER' && paymentOpen(b, now) && (
                <p className="small muted" role="timer">
                  Time left to pay: <strong>{timeLeft(b.reservationExpiresAt, now)}</strong>
                </p>
              )}
              {user.role === 'CUSTOMER' && paymentOpen(b, now) && (
                <form className="form-stack" onSubmit={pay}>
                  {live ? (
                    <>
                      <p className="small muted">You will be sent to Modem Pay to pay with Wave, Afrimoney, QMoney, APS or a card, then brought back here.</p>
                      <Button type="submit" disabled={action.isPending || verify.isPending}>
                        {action.isPending ? 'Opening Modem Pay…' : 'Pay ' + money(b.agreedAmountBututs) + ' with Modem Pay'}
                      </Button>
                      {p?.status === 'PENDING' && (
                        <button type="button" className="text-button" onClick={checkAgain} disabled={verify.isPending}>
                          {verify.isPending ? 'Checking…' : 'I already paid, check again'}
                        </button>
                      )}
                    </>
                  ) : (<>
                  <Field
                    label="Payment result"
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
                      ? 'Recording payment…'
                      : 'Record payment'}
                  </Button>
                  {p && ['PENDING', 'FAILED'].includes(p.status) && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setKey(crypto.randomUUID());
                        toast('Ready for another payment attempt.');
                      }}
                    >
                      Start a new attempt
                    </button>
                  )}
                  </>)}
                </form>
              )}
              {error && <ErrorNotice error={error} />}
            </Panel>
          </div>
        )}
      </QueryState>
      {p && (
        <Panel title="Payment history">
          <QueryState query={ledger}>
            {(data) => (
              <div>
                {data.entries.map((e) => (
                  <div className="list-row" key={e.id}>
                    <div>
                      <strong>
                        {paymentEventLabel(e.type)}
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

        title="Report a problem"
        description="Tell us about the issue. Payment remains held while the dispute is reviewed."
      />
      <PaymentDemoLabel />
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
        title="Problem report"
        description="Check the report and decision."
      />
      <PaymentDemoLabel />
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
                  ? 'Payment refunded to customer.'
                  : 'Payment released to professional.'}{' '}
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
