import { AdminOverview } from './dashboard-overview';
import { useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import {
  Users,
  ShieldCheck,
  CalendarDays,
  Wallet,
  BriefcaseBusiness,
  Scale,
  ArrowUpRight,
  Star,
  FileClock,
  CheckCircle2,
} from 'lucide-react';
import { useApi } from '../api/hooks';
import {
  PageTitle,
  Panel,
  Button,
  QueryState,
  Empty,
  Chip,
  Pager,
  Stat,
  DataTable,
  Command,
  Notice,
  MediaLink,
  ProtectedMedia,
  Reference,
  Avatar,
} from '../components/ui';
import { money, dateTime, date, shortId, title, displayName } from '../utils/format';
function FinancialCustomer({ record }) {
  return <div><strong>{displayName(record.customerSummary) || 'Customer unavailable'}</strong>
    <div className="small muted"><Link to={'/admin/bookings/' + record.booking}>Booking · {shortId(record.booking)}</Link></div>
  </div>;
}
export function AdminDashboard() {
  return <AdminOverview />;
}
export function AdminUsers() {
  const [page, setPage] = useState(1),
    query = useApi('/admin/users', { page, limit: 15 });
  return (
    <>
      <PageTitle
        eyebrow="THE PEOPLE BEHIND THE MARKETPLACE"
        title="Accounts & professionals."
        description="Inspect account status. Sensitive changes are confirmed, audited and revoke existing sessions."
      />
      <Panel>
        <QueryState query={query}>
          {(data) => (
            <>
              {data.items.length ? (
                <DataTable
                  rows={data.items}
                  columns={[
                    {
                      label: 'Person',
                      render: (u) => (
                        <div className="row">
                          <Avatar person={u} />
                          <div>
                            <strong>
                              {u.firstName} {u.lastName}
                            </strong>
                            <p className="muted small">
                              Joined {date(u.createdAt)}
                            </p>
                          </div>
                        </div>
                      ),
                    },
                    {
                      label: 'Account',
                      render: (u) => (
                        <Chip status={u.role}>
                          {u.role === 'WORKER' ? 'Professional' : title(u.role)}
                        </Chip>
                      ),
                    },
                    {
                      label: 'Status',
                      render: (u) => <Chip status={u.accountStatus} />,
                    },
                    {
                      label: 'Actions',
                      render: (u) => (
                        <div className="actions">
                          {u.role === 'WORKER' && (
                            <Button
                              to={'/admin/workers/' + u.id}
                              variant="outline"
                            >
                              Inspect
                            </Button>
                          )}
                          {u.role !== 'ADMIN' && (
                            <Command
                              label={
                                u.accountStatus === 'ACTIVE'
                                  ? 'Suspend'
                                  : 'Reactivate'
                              }
                              variant="outline"
                              path={'/admin/users/' + u.id + '/status'}
                              method="PATCH"
                              fields={[
                                {
                                  name: 'reason',
                                  label: 'Reason for this action',
                                  required: true,
                                  maxLength: 1000,
                                },
                              ]}
                              build={(v) => ({
                                status:
                                  u.accountStatus === 'ACTIVE'
                                    ? 'SUSPENDED'
                                    : 'ACTIVE',
                                reason: v.reason,
                              })}
                              description="This action is audited and revokes existing sessions. Reactivated users must sign in again."
                            />
                          )}
                        </div>
                      ),
                    },
                  ]}
                />
              ) : (
                <Empty title="No accounts to display" />
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
export function AdminWorker() {
  const { id } = useParams(),
    query = useApi('/admin/workers/' + id);
  return (
    <>
      <PageTitle title="Professional account review." />
      <QueryState query={query}>
        {({ account, profile: p }) => (
          <div className="two-grid">
            <Panel
              title={account.firstName + ' ' + account.lastName}
              action={<Chip status={account.accountStatus} />}
            >
              <Reference label="Account reference" id={id} />
              {p ? (
                <>
                  <h3>{p.professionTitle}</h3>
                  <p>{p.bio}</p>
                  <div className="tags">
                    {p.skills.map((s) => (
                      <span key={s}>{s}</span>
                    ))}
                  </div>
                  <p className="muted">
                    {p.serviceAreas.map((a) => a.name).join(', ')}
                  </p>
                  <p>
                    {p.profileCompletion}% complete ·{' '}
                    {title(p.profileVisibility)}
                  </p>
                  <Chip status={p.verificationSummary.status} />
                </>
              ) : (
                <Empty title="Professional onboarding not completed" />
              )}
            </Panel>
            <Panel title="Verification & account actions">
              <p className="prose">
                Review pending applications in the verification queue. Account
                suspension and reactivation are managed in People.
              </p>
              <div className="actions">
                <Button to="/admin/verifications">Verification queue</Button>
                <Button to="/admin/users" variant="outline">
                  Account management
                </Button>
              </div>
            </Panel>
          </div>
        )}
      </QueryState>
    </>
  );
}
export function AdminVerifications() {
  const [page, setPage] = useState(1),
    query = useApi('/admin/verifications', { page, limit: 15 });
  return (
    <>
      <PageTitle
        eyebrow="EVIDENCE, REVIEWED WITH CARE"
        title="Build trust. One profile at a time."
        description="Only pending applications can be approved or rejected."
      />
      <Panel title="Verification queue">
        <QueryState query={query}>
          {(data) => (
            <>
              {data.verifications.length ? (
                <DataTable
                  rows={data.verifications}
                  columns={[
                    {
                      label: 'Professional',
                      render: (v) => (
                        <Link to={'/admin/workers/' + v.worker}>
                          Professional {shortId(v.worker)}
                        </Link>
                      ),
                    },
                    {
                      label: 'Submitted',
                      render: (v) => dateTime(v.submittedAt),
                    },
                    {
                      label: 'Status',
                      render: (v) => <Chip status={v.status} />,
                    },
                    {
                      label: 'Review',
                      render: (v) => (
                        <Button
                          variant="outline"
                          to={'/admin/verifications/' + v.id}
                        >
                          Review evidence
                          <ArrowUpRight size={16} />
                        </Button>
                      ),
                    },
                  ]}
                />
              ) : (
                <Empty
                  icon={ShieldCheck}
                  title="The queue is clear"
                  description="New professional verification applications will appear here."
                />
              )}
              <Pager
                page={page}
                count={data.verifications.length}
                limit={15}
                onChange={setPage}
              />
            </>
          )}
        </QueryState>
      </Panel>
    </>
  );
}
export function VerificationReview() {
  const { id } = useParams(),
    query = useApi('/admin/verifications/' + id);
  return (
    <>
      <PageTitle
        eyebrow="PRIVATE VERIFICATION WORKSPACE"
        title="A considered review builds real trust."
        description="Identity documents and private notes belong only in this authorized workspace."
      />
      <QueryState query={query}>
        {({ verification: v }) => (
          <div className="two-grid">
            <Panel
              title="Submitted evidence"
              action={<Chip status={v.status} />}
            >
              <Reference
                label="Professional"
                id={v.worker}
                to={'/admin/workers/' + v.worker}
              />
              <MediaLink
                path={'/media/' + v.identityDocument + '/access'}
                label="Open identity document"
              />
              {v.skillCertificates.map((mid, i) => (
                <MediaLink
                  key={mid}
                  path={'/media/' + mid + '/access'}
                  label={'Skill certificate ' + (i + 1)}
                />
              ))}
              {v.workEvidence.map((mid, i) => (
                <MediaLink
                  key={mid}
                  path={'/media/' + mid + '/access'}
                  label={'Work evidence ' + (i + 1)}
                />
              ))}
              {v.reference && (
                <dl className="details">
                  <div>
                    <dt>Reference</dt>
                    <dd>{v.reference.name}</dd>
                  </div>
                  <div>
                    <dt>Relationship</dt>
                    <dd>{v.reference.relationship}</dd>
                  </div>
                  <div>
                    <dt>Private reference contact</dt>
                    <dd>{v.reference.contact}</dd>
                  </div>
                </dl>
              )}
              {v.adminNotes && (
                <Notice>Private review notes: {v.adminNotes}</Notice>
              )}
            </Panel>
            <Panel title="Your review decision">
              {v.status === 'PENDING' ? (
                <>
                  <Notice>
                    Approve only what the submitted evidence supports.
                    Work-evidence badges do not claim a professional licence.
                  </Notice>
                  <div className="stack">
                    <Command
                      label="Approve identity"
                      path={'/admin/verifications/' + id}
                      method="PATCH"
                      fields={[
                        {
                          name: 'adminNotes',
                          label: 'Private notes (optional)',
                          as: 'textarea',
                          maxLength: 2000,
                        },
                        {
                          name: 'work',
                          label: 'Work evidence reviewed',
                          options: [
                            {
                              value: 'false',
                              label: 'No · identity approval only',
                            },
                            ...(v.workEvidence.length
                              ? [
                                  {
                                    value: 'true',
                                    label:
                                      'Yes · submitted evidence was reviewed',
                                  },
                                ]
                              : []),
                          ],
                        },
                      ]}
                      build={(x) => ({
                        decision: 'APPROVED',
                        adminNotes: x.adminNotes,
                        workEvidenceReviewed: x.work === 'true',
                      })}
                      description="Confirm the evidence supports this identity approval."
                    />
                    <Command
                      label="Reject application"
                      variant="outline"
                      path={'/admin/verifications/' + id}
                      method="PATCH"
                      fields={[
                        {
                          name: 'rejectionReason',
                          label: 'Reason for the professional',
                          as: 'textarea',
                          required: true,
                          minLength: 10,
                          maxLength: 1000,
                        },
                        {
                          name: 'adminNotes',
                          label: 'Private notes (optional)',
                          as: 'textarea',
                          maxLength: 2000,
                        },
                      ]}
                      build={(x) => ({ decision: 'REJECTED', ...x })}
                      description="Explain what the professional needs to correct before resubmitting."
                    />
                  </div>
                </>
              ) : (
                <>
                  <Chip status={v.status} />
                  <p>Reviewed {dateTime(v.reviewedAt)}</p>
                  {v.rejectionReason && <p>{v.rejectionReason}</p>}
                </>
              )}
            </Panel>
          </div>
        )}
      </QueryState>
    </>
  );
}
export function AdminCatalog() {
  const [kind, setKind] = useState('categories'),
    [page, setPage] = useState(1),
    query = useApi('/admin/catalog/' + kind, { page, limit: 15 }),
    categories = useApi('/admin/catalog/categories', { page: 1, limit: 100 });
  const service = kind === 'services',
    fields = [
      { name: 'name', label: 'Name', required: true, maxLength: 100 },
      {
        name: 'description',
        label: 'Description',
        as: 'textarea',
        maxLength: 1000,
      },
      ...(service
        ? [
            {
              name: 'category',
              label: 'Category',
              required: true,
              options: [
                { value: '', label: 'Choose an active category' },
                ...(categories.data?.categories || [])
                  .filter((c) => c.isActive)
                  .map((c) => ({ value: c.id, label: c.name })),
              ],
            },
          ]
        : []),
    ];
  return (
    <>
      <PageTitle
        eyebrow="THE MARKETPLACE CATALOG"
        title="The services that bring us together."
        description="Manage catalog entries without deleting references from existing work."
      >
        <Command
          label={'Add ' + (service ? 'service' : 'category')}
          path={'/' + kind}
          fields={fields}
          build={(v) => v}
        />
      </PageTitle>
      <div className="tabs">
        {['categories', 'services'].map((k) => (
          <button
            key={k}
            className={kind === k ? 'active' : ''}
            onClick={() => {
              setKind(k);
              setPage(1);
            }}
          >
            {title(k)}
          </button>
        ))}
      </div>
      <Panel>
        <QueryState query={query}>
          {(data) => {
            const rows = data[kind];
            return (
              <>
                {rows.length ? (
                  <DataTable
                    rows={rows}
                    columns={[
                      {
                        label: 'Name',
                        render: (r) => <strong>{r.name}</strong>,
                      },
                      {
                        label: 'Description',
                        render: (r) => (
                          <span className="muted">{r.description || '—'}</span>
                        ),
                      },
                      {
                        label: 'Status',
                        render: (r) => (
                          <Chip status={r.isActive ? 'ACTIVE' : 'DISABLED'} />
                        ),
                      },
                      {
                        label: 'Manage',
                        render: (r) => (
                          <div className="actions">
                            <Command
                              label="Edit"
                              variant="outline"
                              path={'/' + kind + '/' + r.id}
                              method="PATCH"
                              fields={fields.filter(
                                (f) => f.name !== 'category',
                              )}
                              initial={r}
                              build={(v) => v}
                            />
                            <Command
                              label={r.isActive ? 'Deactivate' : 'Activate'}
                              variant="outline"
                              path={'/' + kind + '/' + r.id}
                              method="PATCH"
                              body={{ isActive: !r.isActive }}
                              description={
                                r.isActive
                                  ? 'Deactivate this catalog entry? Existing references are retained, but it will no longer be advertised.'
                                  : 'Activate this entry under an active category?'
                              }
                            />
                          </div>
                        ),
                      },
                    ]}
                  />
                ) : (
                  <Empty
                    title="Build the catalog"
                    description="Add the first category or service to help people find the right skills."
                  />
                )}
                <Pager
                  page={page}
                  count={rows.length}
                  limit={15}
                  onChange={setPage}
                />
              </>
            );
          }}
        </QueryState>
      </Panel>
    </>
  );
}
export function AdminRecords() {
  const location = useLocation(),
    kind = location.pathname.split('/')[2] || 'bookings',
    [page, setPage] = useState(1),
    query = useApi('/admin/' + kind, { page, limit: 15 });
  const headings = {
    bookings: [
      'Every booking. A clear picture.',
      'Schedules, status and commercial references.',
    ],
    payments: [
      'Simulated payments, clearly accounted for.',
      'Read-only inspection. No actual money is held or transferred.',
    ],
    ledger: [
      'A traceable record of simulated funds.',
      'Financial events are immutable through the application.',
    ],
    disputes: [
      'Give every issue a considered review.',
      'Inspect the work, the context and the held simulated payment.',
    ],
    reviews: [
      'Genuine feedback. Thoughtful moderation.',
      'Hide or restore content without changing a customer’s rating.',
    ],
  };
  return (
    <>
      <PageTitle
        eyebrow="SKILLLINK OPERATIONS"
        title={headings[kind]?.[0]}
        description={headings[kind]?.[1]}
      >
        {kind === 'payments' && (
          <Button to="/admin/ledger" variant="outline">
            View ledger
            <ArrowUpRight size={16} />
          </Button>
        )}
      </PageTitle>
      {['payments', 'ledger'].includes(kind) && (
        <Notice>
          All values are simulated. This is not a bank balance, real payment
          gateway or regulated escrow.
        </Notice>
      )}
      <Panel>
        <QueryState query={query}>
          {(data) => {
            const columns =
              kind === 'bookings'
                ? [
                    {
                      label: 'Work',
                      render: (b) => (
                        <div>
                          <strong>{b.description.slice(0, 80)}</strong>
                          <p className="muted small">
                            {dateTime(b.scheduledStart)}
                          </p>
                        </div>
                      ),
                    },
                    {
                      label: 'Status',
                      render: (b) => <Chip status={b.status} />,
                    },
                    {
                      label: 'Amount',
                      render: (b) => money(b.agreedAmountBututs),
                    },
                    {
                      label: 'Inspect',
                      render: (b) => (
                        <Button
                          to={'/admin/bookings/' + b.id}
                          variant="outline"
                        >
                          View
                        </Button>
                      ),
                    },
                  ]
                : kind === 'payments'
                  ? [
                      { label: 'Customer / booking', render: (p) => <FinancialCustomer record={p} /> },
                      { label: 'Professional', render: (p) => displayName(p.workerSummary) || 'Professional unavailable' },
                      { label: 'Amount', render: (p) => money(p.amountBututs) },
                      {
                        label: 'Platform fee',
                        render: (p) => money(p.platformFeeBututs),
                      },
                      {
                        label: 'Status',
                        render: (p) => <Chip status={p.status} />,
                      },
                      {
                        label: 'Inspect',
                        render: (p) => (
                          <Button
                            to={'/admin/payments/' + p.id}
                            variant="outline"
                          >
                            View ledger
                          </Button>
                        ),
                      },
                    ]
                  : kind === 'ledger'
                    ? [
                        { label: 'Event', render: (e) => title(e.type) },
                        {
                          label: 'Customer / booking',
                          render: (e) => <FinancialCustomer record={e} />,
                        },
                        { label: 'Professional', render: (e) => displayName(e.workerSummary) || 'Professional unavailable' },
                        {
                          label: 'Amount',
                          render: (e) => money(e.amountBututs),
                        },
                        {
                          label: 'Recorded',
                          render: (e) => dateTime(e.createdAt),
                        },
                      ]
                    : kind === 'disputes'
                      ? [
                          {
                            label: 'Reason',
                            render: (d) => <strong>{d.reason}</strong>,
                          },
                          {
                            label: 'Status',
                            render: (d) => <Chip status={d.status} />,
                          },
                          {
                            label: 'Submitted',
                            render: (d) => dateTime(d.createdAt),
                          },
                          {
                            label: 'Review',
                            render: (d) => (
                              <Button
                                to={'/admin/disputes/' + d.id}
                                variant="outline"
                              >
                                Open case
                              </Button>
                            ),
                          },
                        ]
                      : [
                          {
                            label: 'Rating',
                            render: (r) => (
                              <span className="rating">
                                <Star size={15} fill="currentColor" />
                                {r.rating} / 5
                              </span>
                            ),
                          },
                          {
                            label: 'Customer’s words',
                            render: (r) => (
                              <p>{r.comment || 'No written comment'}</p>
                            ),
                          },
                          {
                            label: 'Visibility',
                            render: (r) => <Chip status={r.moderationStatus} />,
                          },
                          {
                            label: 'Moderate',
                            render: (r) => (
                              <Command
                                label={
                                  r.moderationStatus === 'VISIBLE'
                                    ? 'Hide review'
                                    : 'Restore review'
                                }
                                variant="outline"
                                path={'/admin/reviews/' + r.id + '/moderation'}
                                method="PATCH"
                                fields={[
                                  {
                                    name: 'reason',
                                    label: 'Moderation reason',
                                    required: true,
                                    maxLength: 1000,
                                  },
                                ]}
                                build={(v) => ({
                                  status:
                                    r.moderationStatus === 'VISIBLE'
                                      ? 'HIDDEN'
                                      : 'VISIBLE',
                                  reason: v.reason,
                                })}
                                description="Change visibility? The customer’s rating is retained and reputation counters are recalculated."
                              />
                            ),
                          },
                        ];
            return (
              <>
                {data.items.length ? (
                  <DataTable rows={data.items} columns={columns} />
                ) : (
                  <Empty
                    title={'No ' + kind + ' to display'}
                    description="New marketplace activity will appear here."
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
      </Panel>
    </>
  );
}
export function AdminRecord() {
  const { id } = useParams(),
    location = useLocation(),
    kind = location.pathname.split('/')[2],
    query = useApi('/admin/' + kind + '/' + id);
  return (
    <>
      <PageTitle
        eyebrow="AUTHORIZED OPERATIONS WORKSPACE"
        title={
          kind === 'disputes'
            ? 'A fair resolution starts with context.'
            : kind === 'payments'
              ? 'Follow the simulated funds.'
              : 'The booking, in detail.'
        }
      />
      <QueryState query={query}>
        {(data) =>
          kind === 'payments' ? (
            <div className="two-grid">
              <Panel
                title="Simulated payment"
                action={<Chip status={data.payment.status} />}
              >
                <dl className="details">
                  <div><dt>Customer</dt><dd>{displayName(data.payment.customerSummary) || 'Customer unavailable'}</dd></div>
                  <div><dt>Professional</dt><dd>{displayName(data.payment.workerSummary) || 'Professional unavailable'}</dd></div>
                  <div>
                    <dt>Collected amount</dt>
                    <dd>{money(data.payment.amountBututs)}</dd>
                  </div>
                  <div>
                    <dt>Platform fee</dt>
                    <dd>{money(data.payment.platformFeeBututs)}</dd>
                  </div>
                  <div>
                    <dt>Professional amount</dt>
                    <dd>{money(data.payment.workerAmountBututs)}</dd>
                  </div>
                </dl>
                <Reference
                  label="Booking"
                  id={data.payment.booking}
                  to={'/admin/bookings/' + data.payment.booking}
                />
                <Notice>No actual funds were moved.</Notice>
              </Panel>
              <Panel title="Ledger events">
                {data.entries.map((e) => (
                  <div className="list-row" key={e.id}>
                    <div>
                      <strong>{title(e.type)}</strong>
                      <p className="small muted">{dateTime(e.createdAt)}</p>
                    </div>
                    <strong>{money(e.amountBututs)}</strong>
                  </div>
                ))}
              </Panel>
            </div>
          ) : kind === 'disputes' ? (
            <AdminDispute dispute={data.dispute} />
          ) : (
            <AdminBooking booking={data.booking} />
          )
        }
      </QueryState>
    </>
  );
}
function AdminBooking({ booking: b }) {
  return (
    <Panel title={b.description} action={<Chip status={b.status} />}>
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
          <dt>Agreed amount</dt>
          <dd>{money(b.agreedAmountBututs)}</dd>
        </div>
        <div>
          <dt>Service area</dt>
          <dd>{b.serviceArea?.name}</dd>
        </div>
        {b.privateAddress && (
          <div>
            <dt>Authorized private address</dt>
            <dd>{b.privateAddress}</dd>
          </div>
        )}
      </dl>
      <Reference
        label="Professional"
        id={b.worker}
        to={'/admin/workers/' + b.worker}
      />
      <Reference label="Customer" id={b.customer} />
      {b.jobRequest && <Reference label="Job request" id={b.jobRequest} />}{' '}
      {b.payment && (
        <Button to={'/admin/payments/' + b.payment} variant="outline">
          Inspect payment & ledger
        </Button>
      )}
      {b.completionNotes && <p>{b.completionNotes}</p>}
      <div className="portfolio-grid">
        {b.completionEvidence?.map((mid) => (
          <ProtectedMedia
            key={mid}
            path={'/bookings/' + b.id + '/evidence/' + mid + '/access'}
            alt="Authorized completion evidence"
          />
        ))}
      </div>
    </Panel>
  );
}
function AdminDispute({ dispute: d }) {
  return (
    <div className="two-grid">
      <Panel title={d.reason} action={<Chip status={d.status} />}>
        <p className="prose">{d.description}</p>
        <Reference
          label="Booking"
          id={d.booking}
          to={'/admin/bookings/' + d.booking}
        />
        <div className="portfolio-grid">
          {d.evidence.map((mid) => (
            <ProtectedMedia
              key={mid}
              path={'/bookings/' + d.booking + '/evidence/' + mid + '/access'}
              alt="Private dispute evidence"
            />
          ))}
        </div>
      </Panel>
      <Panel title="A consistent resolution">
        {d.status === 'OPEN' ? (
          <>
            <Notice>
              Your decision updates the booking, simulated payment, ledger and
              audit record in one transaction.
            </Notice>
            {[
              ['RELEASE_TO_WORKER', 'Release to professional'],
              ['REFUND_CUSTOMER', 'Refund customer'],
            ].map(([value, label]) => (
              <Command
                key={value}
                label={label}
                variant={value === 'REFUND_CUSTOMER' ? 'outline' : 'secondary'}
                path={'/admin/disputes/' + d.id + '/resolve'}
                fields={[
                  {
                    name: 'reason',
                    label: 'Decision reason',
                    as: 'textarea',
                    required: true,
                    maxLength: 2000,
                  },
                ]}
                build={(v) => ({ decision: value, reason: v.reason })}
                description={
                  'Confirm this resolution: ' +
                  label.toLowerCase() +
                  '. This closes the dispute and settles the simulated funds.'
                }
              />
            ))}
          </>
        ) : (
          <>
            <Chip status={d.status} />
            <p>{title(d.adminDecision)}</p>
            <p>{d.decisionReason}</p>
            <p className="muted small">
              Reviewed {dateTime(d.reviewedAt)} · Administrator{' '}
              {shortId(d.reviewedBy)}
            </p>
          </>
        )}
      </Panel>
    </div>
  );
}
export function AdminGap() {
  const audit = useLocation().pathname.endsWith('/audit'),
    metrics = useApi('/admin/metrics');
  return (
    <>
      <PageTitle
        eyebrow="AN HONEST VIEW OF THE PLATFORM"
        title={
          audit
            ? 'A record behind every decision.'
            : 'Job activity, in context.'
        }
        description={
          audit
            ? 'Sensitive administrative changes are recorded on the server.'
            : 'The current API exposes job counts and booking relationships.'
        }
      />
      <Panel title={audit ? 'Audit information' : 'Job request overview'}>
        <Notice>
          {audit
            ? 'An audit-event listing endpoint is not available. This workspace does not fabricate an audit log.'
            : 'An administrator-wide JobRequest listing endpoint is not available. We won’t request customer-only job views as an administrator.'}
        </Notice>
        {!audit && (
          <QueryState query={metrics}>
            {(m) => (
              <div className="stats-grid two">
                <Stat
                  label="Open requests"
                  value={m.openJobRequests}
                  icon={BriefcaseBusiness}
                />
                <Stat
                  label="Accepted requests"
                  value={m.acceptedJobs}
                  icon={CheckCircle2}
                />
              </div>
            )}
          </QueryState>
        )}
        <p className="prose">
          {audit
            ? 'Verification decisions, dispute resolutions, account status changes, catalog edits and review moderation are audited. Review context, reasons and timestamps are displayed on their supported resource pages. A future audit-list API can connect here without weakening access controls.'
            : 'Inspect bookings for their JobRequest and accepted-quote references. A future administrator job-list endpoint can provide a full operations queue here.'}
        </p>
        <div className="actions">
          <Button to={audit ? '/admin/disputes' : '/admin/bookings'}>
            {' '}
            {audit ? 'Review dispute decisions' : 'Inspect bookings'}
            <ArrowUpRight size={17} />
          </Button>
          {audit && (
            <Button to="/admin/verifications" variant="outline">
              Verification queue
            </Button>
          )}
        </div>
      </Panel>
    </>
  );
}
