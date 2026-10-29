import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MessageSquare,
  ShieldCheck,
  Users,
  Wallet,
  Scale,
  Star,
  Layers,
} from 'lucide-react';
import { useAuth } from '../api/auth';
import { useApi } from '../api/hooks';
import {
  Panel,
  PageTitle,
  QueryState,
  Empty,
  Stat,
  Button,
  Chip,
  Avatar,
  AccountAvatar,
  Notice,
  Command,
} from '../components/ui';
import { date, money, shortId } from '../utils/format';
import { homeFor } from '../utils/policy';

const colors = ['#ff7900', '#ffba7a', '#ffe0bf', '#3e423e', '#c6c9bd'];
export function Distribution({ segments, label, center }) {
  const total = segments.reduce((sum, s) => sum + BigInt(s.value || 0), 0n);
  let stop = 0;
  const arcs = segments.map((s, i) => {
    const start = stop;
    stop += total ? Number((BigInt(s.value || 0) * 10000n) / total) / 100 : 0;
    return `${colors[i % colors.length]} ${start}% ${stop}%`;
  });
  return (
    <div className="overview-distribution">
      <div
        className="overview-donut"
        role="img"
        aria-label={label}
        style={{
          background: total ? `conic-gradient(${arcs.join(',')})` : '#f1eae2',
        }}
      >
        <div>
          <strong>{center ?? String(total)}</strong>
          <span>{total ? 'Current total' : 'No activity yet'}</span>
        </div>
      </div>
      <ul className="overview-legend">
        {segments.map((s, i) => (
          <li key={s.label}>
            <i style={{ background: colors[i % colors.length] }} />
            <span>{s.label}</span>
            <b>{s.display ?? s.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
function SeeAll({ to, children = 'See all' }) {
  return (
    <Link className="text-link overview-see-all" to={to}>
      {children}
      <ArrowUpRight size={14} />
    </Link>
  );
}
export function BookingTimeline({ query, base, recent = false }) {
  return (
    <QueryState query={query}>
      {(data) => {
        const rows = data.items || data.bookings;
        const selected = recent
          ? rows.slice(0, 3)
          : rows
              .filter(
                (b) =>
                  ['CONFIRMED', 'AWAITING_PAYMENT'].includes(b.status) &&
                  new Date(b.scheduledStart) >= new Date(),
              )
              .sort(
                (a, b) =>
                  new Date(a.scheduledStart) - new Date(b.scheduledStart),
              )
              .slice(0, 3);
        return selected.length ? (
          <div className="overview-timeline">
            {selected.map((b) => (
              <Link
                to={base + '/bookings/' + b.id}
                className="overview-appointment"
                key={b.id}
              >
                <time dateTime={b.scheduledStart}>
                  <strong>{date(b.scheduledStart, { year: undefined })}</strong>
                  <small>
                    {date(b.scheduledStart, {
                      year: undefined,
                      month: undefined,
                      day: undefined,
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </small>
                </time>
                <span className="overview-timeline-dot" />
                <span className="overview-row-icon">
                  <CalendarDays size={19} />
                </span>
                <div>
                  <strong>{b.description}</strong>
                  <small>{b.serviceArea?.name}</small>
                  <Chip status={b.status} />
                </div>
                <ArrowUpRight size={14} />
              </Link>
            ))}
          </div>
        ) : (
          <Empty
            icon={CalendarDays}
            title={
              recent
                ? 'No bookings yet'
                : data.pagination?.total > 50
                  ? 'No upcoming bookings in recent activity'
                  : 'No upcoming bookings yet'
            }
            description="Your next service appointment will appear here."
            action={<SeeAll to={base + '/bookings'}>View bookings</SeeAll>}
          />
        );
      }}
    </QueryState>
  );
}
function SimulatedFinance({ query, admin = false }) {
  return (
    <QueryState query={query}>
      {(data) => (
        <>
          <div className="overview-finance-hero">
            <span className="overview-wallet">
              <Wallet size={27} />
            </span>
            <span>
              {admin
                ? 'Gross simulated collection'
                : 'Released earnings · simulated'}
            </span>
            <strong>
              {money(
                admin
                  ? data.simulatedTransactionVolumeBututs
                  : data.releasedEarningsBututs,
              )}
            </strong>
          </div>
          <dl className="overview-finance-lines">
            {(admin
              ? [
                  ['Platform fees', data.simulatedPlatformRevenueBututs],
                  ['Refunds', data.simulatedRefundsBututs],
                ]
              : [
                  ['Pending earnings', data.pendingEarningsBututs],
                  ['Released earnings', data.releasedEarningsBututs],
                ]
            ).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{money(value)}</dd>
              </div>
            ))}
          </dl>
          <p className="overview-demo-note">
            <ShieldCheck size={13} />
            Simulated payments. No real money moves.
          </p>
          <Button
            to={admin ? '/admin/payments' : '/work/earnings'}
            variant="dark"
          >
            {admin ? 'View payments & ledger' : 'View earnings'}
            <ArrowUpRight size={16} />
          </Button>
        </>
      )}
    </QueryState>
  );
}
export function RoleDashboard() {
  const { user } = useAuth(),
    worker = user.role === 'WORKER',
    base = homeFor(user.role);
  const profile = useApi(worker ? '/workers/me/profile' : null),
    professional = profile.data?.profile,
    draftProfile = worker && professional?.profileVisibility === 'DRAFT',
    canBrowseJobs = !worker || (professional?.profileVisibility === 'PUBLIC' && professional?.verificationSummary.status === 'APPROVED');
  const bookings = useApi('/bookings/me', { page: 1, limit: 50 }),
    jobs = useApi(worker ? '/job-requests/opportunities' : '/job-requests/me', {
      page: 1,
      limit: 4,
    }, { enabled: canBrowseJobs }),
    proposals = useApi('/direct-proposals/me', { page: 1, limit: 12 }, { refetchInterval: 30000 }),
    financial = useApi(worker ? '/finances/me' : null),
    conversations = useApi(!worker ? '/conversations/me' : null, {
      page: 1,
      limit: 1,
    });
  return (
    <div className="dashboard-overview">
      <PageTitle
        eyebrow={
          worker ? 'YOUR PROFESSIONAL WORKSPACE' : 'YOUR PROJECTS, ALL TOGETHER'
        }
        title={'Hello, ' + user.firstName + '.'}
        description={
          worker
            ? 'Your workday, at a glance. Let’s make it a good one.'
            : 'Find the right people. Keep every project moving.'
        }
      >
        <Button to={worker ? canBrowseJobs ? '/work/opportunities' : '/work/profile' : '/app/jobs/new'}>
          {worker ? canBrowseJobs ? 'Find opportunities' : 'Complete your profile' : 'Post a job'}
          <ArrowUpRight size={16} />
        </Button>
      </PageTitle>
      <div className="stats-grid overview-kpis">
        <Stat
          icon={worker ? CheckCircle2 : CalendarDays}
          label={worker ? 'Jobs completed' : 'Your bookings'}
          value={
            worker
              ? profile.data?.profile.completedJobsCount
              : bookings.data?.pagination.total
          }
          caption={worker ? 'All time' : 'All bookings'}
        />
        <Stat
          icon={BriefcaseBusiness}
          label={worker ? 'Opportunities' : 'Job requests'}
          value={jobs.data?.pagination.total}
          caption={worker ? draftProfile ? 'Publish your profile to browse' : 'Matched to your profile' : 'Your posted requests'}
        />
        <Stat
          icon={Users}
          label="Direct proposals"
          value={proposals.data?.pagination.total}
          caption="All proposals"
        />
        <Stat
          icon={worker ? Star : MessageSquare}
          label={worker ? 'Reviews' : 'Conversations'}
          value={
            worker
              ? profile.data?.profile.reviewCount
              : conversations.data?.pagination.total
          }
          caption={worker ? 'From completed work' : 'Keep in touch'}
        />
      </div>
      <div className="overview-operational-grid overview-priority">
        <Panel title={worker ? 'Your professional identity' : 'Your project desk'}>
          <div className="row"><AccountAvatar person={user} size="large" /><div><h3>{user.firstName} {user.lastName}</h3><p className="muted">{worker ? 'Build trust. Keep your calendar up to date.' : 'Keep invitations, messages and bookings together.'}</p></div></div>
          {worker && professional && <div className="actions"><span className="small muted">Identity verification</span><Chip status={professional.verificationSummary.status} /><Chip status={professional.profileVisibility} /><Button to="/work/availability" variant="outline">Manage availability</Button></div>}
          {draftProfile && <Notice><p><strong>Your professional profile is still a draft.</strong> Identity approval does not publish it. Publish your profile to appear in professional search and access matched opportunities.</p>
            <div className="actions"><Command label="Publish profile" path="/workers/me/profile" method="PATCH" body={{ profileVisibility: 'PUBLIC' }}
              description="Make your professional profile visible to customers? Your profession, bio, services and service areas must be complete. Identity approval is still required for marketplace work." />
              <Button to="/work/profile" variant="outline">Edit professional profile</Button></div></Notice>}
          <div className="actions"><Button to={base + '/messages'} variant="outline">Messages</Button><Button to={base + '/notifications'} variant="outline">Notifications</Button></div>
        </Panel>
        <Panel title={worker ? 'Incoming proposals' : 'Your service proposals'} action={<SeeAll to={base + '/proposals'}>View proposals</SeeAll>}>
          <QueryState query={proposals}>{data => {
            const pending = data.proposals.filter(p => ['PENDING', 'QUOTED'].includes(p.status));
            return pending.length ? <div className="overview-action-list">{pending.slice(0, 3).map(p => <Link key={p.id} to={base + '/proposals'}><div><strong>{p.pricingMode === 'REQUEST_QUOTE' ? p.quotes?.length ? 'Quote received · ' + money(p.quotes.at(-1).amountBututs) : 'Quote requested' : money(p.agreedAmountBututs)} · {p.serviceArea?.name}</strong><small>{p.description.slice(0, 90)}</small><Chip status={p.status} /></div><ArrowUpRight size={16} /></Link>)}</div> : <p className="muted">No pending proposals in your recent invitations.</p>;
          }}</QueryState>
          <p className="small muted">Discuss changes in messages, then formally accept or send revised terms.</p>
        </Panel>
      </div>
      {worker && profile.error?.status === 404 && (
        <Notice>
          Welcome!{' '}
          <Link to="/work/profile">Create your professional profile</Link> to
          start connecting with customers.
        </Notice>
      )}
      <div className="overview-operational-grid">
        <Panel
          className="overview-requests"
          title={worker ? 'New job opportunities' : 'Your recent requests'}
          action={<SeeAll to={worker ? canBrowseJobs ? '/work/opportunities' : '/work/profile' : '/app/jobs'} />}
        >
          {worker && !canBrowseJobs ? (
            profile.isPending ? <QueryState query={profile} /> :
            <Notice>{draftProfile ? 'Publish your draft profile using the action above to see job opportunities.'
              : 'A public professional profile and approved identity verification are required to see job opportunities.'}
              <div className="actions"><Button to="/work/profile" variant="outline">Manage professional profile</Button>
                {!draftProfile && <Button to="/work/profile/verification" variant="outline">Identity verification</Button>}</div></Notice>
          ) : <QueryState query={jobs}>
            {(data) => {
              const rows = worker ? data.opportunities : data.jobRequests;
              return rows.length ? (
                <div className="overview-request-list">
                  {rows.slice(0, 3).map((j) => (
                    <article className="overview-request" key={j.id}>
                      <span className="overview-row-icon">
                        <BriefcaseBusiness size={22} />
                      </span>
                      <div>
                        <h3>{j.title}</h3>
                        <p>
                          {j.serviceArea.name} <span>·</span> {j.quoteCount}{' '}
                          quotes
                        </p>
                        <div className="overview-request-meta">
                          <Clock3 size={12} />
                          {j.preferredDate
                            ? date(j.preferredDate)
                            : 'Flexible timing'}
                          <Chip status={j.status} />
                        </div>
                      </div>
                      <Button
                        to={
                          base + (worker ? '/opportunities/' : '/jobs/') + j.id
                        }
                      >
                        View
                        <ArrowUpRight size={15} />
                      </Button>
                    </article>
                  ))}
                </div>
              ) : (
                <Empty
                  icon={BriefcaseBusiness}
                  title={
                    worker
                      ? 'Your next opportunity starts here'
                      : 'What’s your next project?'
                  }
                  description={
                    worker
                      ? 'Relevant jobs appear when your profile is public, verified and matches a customer’s request.'
                      : 'Describe what you need and compare quotes from local professionals.'
                  }
                  action={
                    <Button
                      to={worker ? '/work/profile' : '/app/jobs/new'}
                      variant="outline"
                    >
                      {worker
                        ? profile.data
                          ? 'Review your profile'
                          : 'Complete your profile'
                        : 'Post your first job'}
                      <ArrowUpRight size={15} />
                    </Button>
                  }
                />
              );
            }}
          </QueryState>}
        </Panel>
        <Panel
          title="Upcoming bookings"
          action={<SeeAll to={base + '/bookings'}>View calendar</SeeAll>}
        >
          {bookings.data?.pagination.total > 50 && (
            <p className="overview-scope">From your 50 most recent bookings.</p>
          )}
          <BookingTimeline query={bookings} base={base} />
        </Panel>
      </div>
      <div className="overview-lower-grid">
        <Panel
          title={worker ? 'Work & reputation' : 'Booking activity'}
          action={
            <SeeAll to={worker ? '/work/profile/reviews' : '/app/bookings'}>
              Details
            </SeeAll>
          }
        >
          {worker ? (
            profile.error?.status === 404 ? (
              <Empty
                icon={ShieldCheck}
                title="Build your professional story"
                description="Create your profile to track completion, verification and reviews."
                action={<SeeAll to="/work/profile">Create profile</SeeAll>}
              />
            ) : (
              <QueryState query={profile}>
                {({ profile: p }) => (
                  <>
                    <div className="overview-reputation">
                      <span>
                        <Star size={20} />
                        <strong>
                          {p.reviewCount
                            ? Number(p.averageRating).toFixed(1)
                            : 'New'}
                        </strong>
                      </span>
                      <p>
                        {p.reviewCount}{' '}
                        {p.reviewCount === 1 ? 'review' : 'reviews'} from
                        completed bookings
                      </p>
                    </div>
                    <div className="overview-profile-progress">
                      <div>
                        <span>Profile completion</span>
                        <b>{p.profileCompletion}%</b>
                      </div>
                      <progress max="100" value={p.profileCompletion} />
                    </div>
                    <div className="overview-profile-status">
                      <Chip status={p.profileVisibility} />
                      <Chip status={p.verificationSummary.status} />
                    </div>
                    <SeeAll to="/work/profile">
                      Manage profile & services
                    </SeeAll>
                  </>
                )}
              </QueryState>
            )
          ) : (
            <QueryState query={bookings}>
              {(data) => (
                <>
                  <Distribution
                    label="Status of recent bookings"
                    segments={[
                      'CONFIRMED',
                      'COMPLETED',
                      'CANCELLED',
                      'AWAITING_PAYMENT',
                    ]
                      .map((status) => ({
                        label: status.toLowerCase().replaceAll('_', ' '),
                        value: data.bookings.filter((b) => b.status === status)
                          .length,
                      }))
                      .concat([
                        {
                          label: 'Other statuses',
                          value: data.bookings.filter(
                            (b) =>
                              ![
                                'CONFIRMED',
                                'COMPLETED',
                                'CANCELLED',
                                'AWAITING_PAYMENT',
                              ].includes(b.status),
                          ).length,
                        },
                      ])}
                  />
                  <p className="overview-scope">
                    Your {data.bookings.length} most recent bookings.
                  </p>
                </>
              )}
            </QueryState>
          )}
        </Panel>
        <Panel title={worker ? 'Earnings balance' : 'Your next steps'}>
          {worker ? (
            <QueryState query={financial}>
              {(data) => (
                <Distribution
                  label="Current simulated pending and released earnings"
                  center="GMD"
                  segments={[
                    {
                      label: 'Pending',
                      value: data.pendingEarningsBututs,
                      display: money(data.pendingEarningsBututs),
                    },
                    {
                      label: 'Released',
                      value: data.releasedEarningsBututs,
                      display: money(data.releasedEarningsBututs),
                    },
                  ]}
                />
              )}
            </QueryState>
          ) : (
            <div className="overview-action-list">
              <QueryState query={bookings}>
                {(data) =>
                  data.bookings
                    .filter((b) =>
                      ['AWAITING_PAYMENT', 'WORKER_MARKED_COMPLETED'].includes(
                        b.status,
                      ),
                    )
                    .slice(0, 2)
                    .map((b) => (
                      <Link
                        key={b.id}
                        to={
                          '/app/bookings/' +
                          b.id +
                          (b.status === 'AWAITING_PAYMENT' ? '/payment' : '')
                        }
                      >
                        <span className="overview-row-icon">
                          <Clock3 size={20} />
                        </span>
                        <div>
                          <strong>
                            {b.status === 'AWAITING_PAYMENT'
                              ? 'Payment awaiting simulation'
                              : 'Work ready for your confirmation'}
                          </strong>
                          <small>{b.description.slice(0, 65)}</small>
                        </div>
                        <ArrowUpRight size={16} />
                      </Link>
                    ))
                }
              </QueryState>
              <Link to="/app/bookings">
                <span className="overview-row-icon">
                  <CalendarDays size={20} />
                </span>
                <div>
                  <strong>Manage your bookings</strong>
                  <small>Payments, completion & reviews</small>
                </div>
                <ArrowUpRight size={16} />
              </Link>
              <Link to="/app/proposals">
                <span className="overview-row-icon">
                  <Users size={20} />
                </span>
                <div>
                  <strong>Direct service proposals</strong>
                  <small>Track your invitations</small>
                </div>
                <ArrowUpRight size={16} />
              </Link>
              <Link to="/app/notifications">
                <span className="overview-row-icon">
                  <Clock3 size={20} />
                </span>
                <div>
                  <strong>Stay up to date</strong>
                  <small>Quotes and project updates</small>
                </div>
                <ArrowUpRight size={16} />
              </Link>
            </div>
          )}
          {worker && (
            <p className="overview-demo-note">
              Current simulated balance, not a historical trend.
            </p>
          )}
        </Panel>
        <Panel
          className="overview-finance"
          title={worker ? 'Earnings summary' : 'Find your next helping hand'}
        >
          {worker ? (
            <SimulatedFinance query={financial} />
          ) : (
            <>
              <div className="overview-discovery-icon">
                <Users size={34} />
              </div>
              <h3>Two ways to get it done.</h3>
              <p className="muted">
                Explore professional profiles, or post your job and compare real
                quotes.
              </p>
              <Button to="/professionals">
                Find a professional
                <ArrowUpRight size={16} />
              </Button>
              <SeeAll to="/app/jobs/new">Post a job instead</SeeAll>
              <p className="overview-demo-note">
                Payments in SkillLink are simulated.
              </p>
            </>
          )}
        </Panel>
      </div>
      <div className="overview-footer-note">
        <ShieldCheck size={18} />
        <span>
          {worker
            ? 'Your skills. Your schedule. Your next opportunity.'
            : 'Your project, your choice. Every agreement stays in SkillLink.'}
        </span>
        <SeeAll to={worker ? '/work/availability' : '/app/messages'}>
          {worker ? 'Set availability' : 'Open messages'}
        </SeeAll>
      </div>
    </div>
  );
}
export function AdminOverview() {
  const metrics = useApi('/admin/metrics'),
    bookings = useApi('/admin/bookings', { page: 1, limit: 3 }),
    users = useApi('/admin/users', { page: 1, limit: 3 }),
    verifications = useApi('/admin/verifications', { page: 1, limit: 3 }),
    disputes = useApi('/admin/disputes', { page: 1, limit: 5 });
  return (
    <div className="dashboard-overview">
      <PageTitle
        eyebrow="SKILLLINK OPERATIONS"
        title="The marketplace at a glance."
        description="A clear view of the people, work and decisions that matter."
      >
        <Button to="/admin/verifications">
          Review applications
          <ArrowUpRight size={16} />
        </Button>
      </PageTitle>
      <QueryState query={metrics}>
        {(m) => (
          <div className="stats-grid overview-kpis">
            <Stat
              label="People on SkillLink"
              value={m.totalUsers}
              icon={Users}
              caption="All accounts"
            />
            <Stat
              label="Approved professionals"
              value={m.verifiedWorkers}
              icon={ShieldCheck}
              caption="Identity approved"
            />
            <Stat
              label="Completed bookings"
              value={m.completedBookings}
              icon={CheckCircle2}
              caption="All time"
            />
            <Stat
              label="Open disputes"
              value={m.pendingDisputes}
              icon={Scale}
              caption="Awaiting resolution"
            />
          </div>
        )}
      </QueryState>
      <div className="overview-operational-grid">
        <Panel
          title="Your review desk"
          action={<SeeAll to="/admin/verifications" />}
        >
          <div className="overview-queue-heading">
            <ShieldCheck size={16} />
            <strong>Verification applications</strong>
            {metrics.data && (
              <span>{metrics.data.pendingVerifications} pending</span>
            )}
          </div>
          <QueryState query={verifications}>
            {(data) =>
              data.verifications.length ? (
                data.verifications.map((v) => (
                  <Link
                    className="overview-queue-row"
                    key={v.id}
                    to={'/admin/verifications/' + v.id}
                  >
                    <span className="overview-row-icon">
                      <ShieldCheck size={20} />
                    </span>
                    <div>
                      <strong>Professional application</strong>
                      <small>
                        Submitted {date(v.submittedAt)} · {shortId(v.worker)}
                      </small>
                    </div>
                    <span className="overview-view">
                      Review
                      <ArrowUpRight size={14} />
                    </span>
                  </Link>
                ))
              ) : (
                <div className="overview-clear">
                  <CheckCircle2 size={19} />
                  <div>
                    <strong>You’re all caught up</strong>
                    <small>No pending verification applications.</small>
                  </div>
                </div>
              )
            }
          </QueryState>
          <div className="overview-queue-heading">
            <Scale size={16} />
            <strong>Open disputes</strong>
            {metrics.data && <span>{metrics.data.pendingDisputes} open</span>}
          </div>
          <QueryState query={disputes}>
            {(data) =>
              data.items.some((d) => d.status === 'OPEN') ? (
                data.items
                  .filter((d) => d.status === 'OPEN')
                  .slice(0, 2)
                  .map((d) => (
                    <Link
                      className="overview-queue-row"
                      key={d.id}
                      to={'/admin/disputes/' + d.id}
                    >
                      <span className="overview-row-icon">
                        <Scale size={20} />
                      </span>
                      <div>
                        <strong>{d.reason}</strong>
                        <small>{date(d.createdAt)}</small>
                      </div>
                      <ArrowUpRight size={16} />
                    </Link>
                  ))
              ) : (
                <Link className="overview-clear" to="/admin/disputes">
                  <Scale size={19} />
                  <div>
                    <strong>Review dispute cases</strong>
                    <small>
                      {metrics.data?.pendingDisputes === 0
                        ? 'No open cases need your attention.'
                        : 'Open the full queue to see all pending cases.'}
                    </small>
                  </div>
                  <ArrowUpRight size={14} />
                </Link>
              )
            }
          </QueryState>
        </Panel>
        <Panel title="Recent bookings" action={<SeeAll to="/admin/bookings" />}>
          <BookingTimeline query={bookings} base="/admin" recent />
        </Panel>
      </div>
      <div className="overview-lower-grid">
        <Panel
          title="Marketplace activity"
          action={<SeeAll to="/admin/bookings">Details</SeeAll>}
        >
          <QueryState query={metrics}>
            {(m) => (
              <>
                <Distribution
                  label="Current marketplace booking status totals"
                  center={m.totalBookings}
                  segments={[
                    { label: 'Completed', value: m.completedBookings },
                    { label: 'Confirmed', value: m.confirmedBookings },
                    { label: 'Cancelled', value: m.cancelledBookings },
                    { label: 'Disputed', value: m.disputedBookings },
                    {
                      label: 'Other statuses',
                      value: Math.max(
                        0,
                        m.totalBookings -
                          m.completedBookings -
                          m.confirmedBookings -
                          m.cancelledBookings -
                          m.disputedBookings,
                      ),
                    },
                  ]}
                />
                <div className="overview-mini-metrics">
                  <span>
                    <b>{m.openJobRequests}</b>Open requests
                  </span>
                  <span>
                    <b>{m.reviews}</b>Reviews
                  </span>
                  <span>
                    <b>{m.workers}</b>Professionals
                  </span>
                </div>
              </>
            )}
          </QueryState>
        </Panel>
        <Panel title="Recently joined" action={<SeeAll to="/admin/users" />}>
          <QueryState query={users}>
            {(data) =>
              data.items.length ? (
                <div className="overview-people">
                  {data.items.map((u) => (
                    <Link
                      to={
                        u.role === 'WORKER'
                          ? '/admin/workers/' + u.id
                          : '/admin/users'
                      }
                      key={u.id}
                    >
                      <Avatar person={u} />
                      <div>
                        <strong>
                          {u.firstName} {u.lastName}
                        </strong>
                        <small>
                          {u.role === 'WORKER'
                            ? 'Professional'
                            : u.role === 'ADMIN'
                              ? 'Administrator'
                              : 'Customer'}{' '}
                          · {date(u.createdAt)}
                        </small>
                      </div>
                      <Chip status={u.accountStatus} />
                    </Link>
                  ))}
                </div>
              ) : (
                <Empty
                  icon={Users}
                  title="A growing community"
                  description="New accounts will appear here."
                />
              )
            }
          </QueryState>
          <div className="overview-catalog-link">
            <Layers size={18} />
            <SeeAll to="/admin/catalog">Manage the service catalog</SeeAll>
          </div>
        </Panel>
        <Panel className="overview-finance" title="Simulated financial summary">
          <SimulatedFinance query={metrics} admin />
        </Panel>
      </div>
      <div className="overview-footer-note">
        <ShieldCheck size={18} />
        <span>Thoughtful reviews build a marketplace people can trust.</span>
        <SeeAll to="/admin/reviews">Review feedback</SeeAll>
      </div>
    </div>
  );
}
