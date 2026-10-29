import fs from 'node:fs/promises';
import { z } from 'zod';
import {
  availabilityWrite,
  availableNowWrite,
} from '../src/modules/availability/availability.validator.js';
import {
  proposalWrite,
  bookingFromQuote,
  cancelBooking,
} from '../src/modules/bookings/booking.validator.js';
import {
  conversationWrite,
  messageWrite,
} from '../src/modules/conversations/conversation.validator.js';
import { checkoutWrite } from '../src/modules/payments/payment.validator.js';
import {
  completionWrite,
  disputeWrite,
  disputeDecision,
  reviewWrite,
  reviewModerate,
} from '../src/modules/bookings/lifecycle.validator.js';
import { accountStatusWrite } from '../src/modules/admin/operations.routes.js';
import { MEDIA_PURPOSES } from '../src/modules/media/media.model.js';
const file = new URL('../docs/openapi.json', import.meta.url),
  doc = JSON.parse(await fs.readFile(file, 'utf8')),
  schemas = doc.components.schemas;
doc.info = {
  title: 'SkillLink V1 Backend API',
  version: '1.0.0',
  description:
    'Modular marketplace backend: authentication, verification, discovery, jobs, quotes, availability, unified booking, private messaging and voice, simulated payments, disputes, genuine reviews, notifications and audited administration. NO REAL MONEY. MongoDB replica set required for transactions.',
};
for (const [name, schema] of Object.entries({
  AvailabilityWrite: availabilityWrite,
  AvailableNowWrite: availableNowWrite,
  DirectProposalWrite: proposalWrite,
  BookingFromQuote: bookingFromQuote,
  BookingCancel: cancelBooking,
  ConversationWrite: conversationWrite,
  MessageWrite: messageWrite,
  MockCheckout: checkoutWrite,
  CompletionWrite: completionWrite,
  DisputeWrite: disputeWrite,
  DisputeDecision: disputeDecision,
  ReviewWrite: reviewWrite,
  ReviewModerate: reviewModerate,
  AccountStatusWrite: accountStatusWrite,
})) {
  const value = z.toJSONSchema(schema, {
    io: 'input',
    target: 'openapi-3.0',
    unrepresentable: 'any',
  });
  delete value.$schema;
  schemas[name] = value;
}
const id = { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
  str = { type: 'string' },
  date = { type: 'string', format: 'date-time' },
  money = { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
  ref = (n) => ({ $ref: '#/components/schemas/' + n }),
  arr = (x) => ({ type: 'array', items: x }),
  obj = (properties, required = []) => ({
    type: 'object',
    additionalProperties: false,
    properties,
    ...(required.length ? { required } : {}),
  }),
  enumStr = (values) => ({ type: 'string', enum: values });
const area = obj({ name: str, region: str, country: enumStr(['GM']) }),
  point = obj({
    type: enumStr(['Point']),
    coordinates: {
      type: 'array',
      items: { type: 'number' },
      minItems: 2,
      maxItems: 2,
    },
  });
schemas.Availability = obj({
  timezone: enumStr(['Africa/Banjul']),
  weekly: schemas.AvailabilityWrite.properties.weekly,
  blockedDates: schemas.AvailabilityWrite.properties.blockedDates,
  timeOff: schemas.AvailabilityWrite.properties.timeOff,
});
schemas.Booking = obj({
  id,
  customer: id,
  worker: id,
  service: id,
  jobRequest: id,
  acceptedQuote: id,
  directProposal: id,
  scheduledStart: date,
  scheduledEnd: date,
  serviceArea: area,
  location: point,
  privateAddress: str,
  description: str,
  agreedAmountBututs: money,
  currency: enumStr(['GMD']),
  status: enumStr([
    'AWAITING_PAYMENT',
    'CONFIRMED',
    'IN_PROGRESS',
    'WORKER_MARKED_COMPLETED',
    'COMPLETED',
    'CANCELLED',
    'DISPUTED',
  ]),
  reservationExpiresAt: date,
  payment: id,
  startedAt: date,
  workerCompletedAt: date,
  completedAt: date,
  completionNotes: str,
  completionEvidence: arr(id),
  createdAt: date,
  updatedAt: date,
});
schemas.Booking.description =
  'Participant/admin view. Exact location/address are returned to the customer; the worker receives them only after payment confirmation. Expired unpaid reservations read as CANCELLED.';
schemas.DirectProposal = obj({
  id,
  customer: id,
  worker: id,
  service: id,
  description: str,
  serviceArea: area,
  location: point,
  privateAddress: str,
  scheduledStart: date,
  scheduledEnd: date,
  agreedAmountBututs: money,
  status: enumStr(['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED']),
  expiresAt: date,
  booking: id,
  createdAt: date,
});
schemas.DirectProposal.description =
  'Only the proposing customer receives precise location/address. Acceptance creates an unpaid Booking through the centralized engine.';
schemas.Conversation = obj({
  id,
  contextType: enumStr(['QUOTE', 'DIRECT_PROPOSAL', 'BOOKING']),
  contextId: id,
  participants: arr(id),
  booking: id,
  createdAt: date,
});
schemas.Message = obj({
  id,
  conversation: id,
  sender: id,
  type: enumStr(['TEXT', 'IMAGE', 'VOICE', 'SYSTEM']),
  text: str,
  media: id,
  readBy: arr(id),
  clientMessageId: str,
  createdAt: date,
});
schemas.Payment = obj({
  id,
  booking: id,
  customer: id,
  worker: id,
  amountBututs: money,
  platformFeeBututs: money,
  workerAmountBututs: money,
  commissionBasisPoints: { type: 'integer', minimum: 0, maximum: 10000 },
  currency: enumStr(['GMD']),
  provider: enumStr(['mock']),
  providerReference: str,
  status: enumStr([
    'PENDING',
    'FAILED',
    'HELD',
    'RELEASED',
    'REFUNDED',
    'DISPUTED',
  ]),
  simulated: { type: 'boolean', enum: [true] },
  paidAt: date,
  heldAt: date,
  releasedAt: date,
  refundedAt: date,
  disputedAt: date,
  createdAt: date,
});
schemas.LedgerEntry = obj({
  id,
  payment: id,
  booking: id,
  type: enumStr([
    'CUSTOMER_PAYMENT',
    'PLATFORM_FEE',
    'WORKER_PENDING_EARNING',
    'WORKER_RELEASE',
    'REFUND',
  ]),
  amountBututs: money,
  currency: enumStr(['GMD']),
  simulated: { type: 'boolean', enum: [true] },
  createdAt: date,
});
schemas.Dispute = obj({
  id,
  booking: id,
  customer: id,
  worker: id,
  reason: str,
  description: str,
  evidence: arr(id),
  status: enumStr(['OPEN', 'RESOLVED']),
  adminDecision: enumStr(['RELEASE_TO_WORKER', 'REFUND_CUSTOMER']),
  decisionReason: str,
  reviewedBy: id,
  reviewedAt: date,
  createdAt: date,
});
schemas.Review = obj({
  id,
  booking: id,
  worker: id,
  rating: { type: 'integer', minimum: 1, maximum: 5 },
  comment: str,
  moderationStatus: enumStr(['VISIBLE', 'HIDDEN']),
  createdAt: date,
  moderationReason: str,
  moderatedAt: date,
});
schemas.Notification = obj({
  id,
  type: str,
  title: str,
  message: str,
  relatedResourceType: str,
  relatedResourceId: id,
  readAt: { ...date, nullable: true },
  createdAt: date,
});
schemas.AdminUser = obj({
  id,
  firstName: str,
  lastName: str,
  role: enumStr(['CUSTOMER', 'WORKER', 'ADMIN']),
  accountStatus: enumStr(['ACTIVE', 'SUSPENDED', 'DISABLED']),
  createdAt: date,
});
const int = { type: 'integer', minimum: 0 },
  decimalString = {
    type: 'string',
    pattern: '^[0-9]+$',
    description:
      'Integer bututs represented as a string to preserve aggregate precision',
  };
schemas.AdminMetrics = obj(
  Object.fromEntries(
    [
      'totalUsers',
      'customers',
      'workers',
      'verifiedWorkers',
      'pendingVerifications',
      'openJobRequests',
      'acceptedJobs',
      'totalBookings',
      'confirmedBookings',
      'completedBookings',
      'cancelledBookings',
      'disputedBookings',
      'reviews',
      'pendingDisputes',
      'expiredReservations',
    ]
      .map((k) => [k, int])
      .concat([
        ['simulated', { type: 'boolean', enum: [true] }],
        ['currency', enumStr(['GMD'])],
        ...[
          'simulatedTransactionVolumeBututs',
          'simulatedPlatformRevenueBututs',
          'simulatedRefundsBututs',
        ].map((k) => [k, decimalString]),
      ]),
  ),
);
const envelope = (data) =>
  obj({ success: { type: 'boolean', enum: [true] }, data }, [
    'success',
    'data',
  ]);
const list = (key, name) =>
  obj({ [key]: arr(ref(name)), pagination: ref('MarketPagination') }, [
    key,
    'pagination',
  ]);
const errors = Object.fromEntries(
  [400, 401, 403, 404, 409, 413, 429, 500, 502, 503].map((n) => [
    n,
    {
      description: {
        400: 'Invalid request or prerequisites',
        401: 'Authentication required, expired or revoked',
        403: 'Role/account denied',
        404: 'Resource unavailable or not owned',
        409: 'Illegal state, duplicate, conflict, expiry or concurrent change',
        413: 'Payload too large',
        429: 'Rate limited',
        500: 'Safe internal error',
        502: 'Provider failure',
        503: 'Unavailable dependency or replica set required',
      }[n],
      content: { 'application/json': { schema: ref('Error') } },
    },
  ]),
);
function endpoint(
  method,
  path,
  tag,
  roles,
  summary,
  response,
  { body, page = false, status = 200, description = '' } = {},
) {
  const parameters = [...path.matchAll(/\{(\w+)\}/g)].map((m) => ({
    name: m[1],
    in: 'path',
    required: true,
    schema: id,
  }));
  if (page)
    parameters.push(
      {
        name: 'page',
        in: 'query',
        schema: { type: 'integer', minimum: 1, maximum: 10000, default: 1 },
      },
      {
        name: 'limit',
        in: 'query',
        schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
      },
    );
  const op = {
    tags: [tag],
    summary,
    description:
      (roles.length ? 'Roles: ' + roles.join(', ') + '. ' : 'Public. ') +
      description,
    security: roles.length ? [{ bearerAuth: [] }] : [],
    parameters,
    responses: {
      [status]: {
        description: 'Success',
        content: { 'application/json': { schema: envelope(response) } },
      },
      ...errors,
    },
  };
  if (body)
    op.requestBody = {
      required: body !== 'Empty',
      content: {
        'application/json': { schema: body === 'Empty' ? obj({}) : ref(body) },
      },
    };
  doc.paths[path] ??= {};
  doc.paths[path][method] = op;
}
const ep = endpoint,
  C = ['CUSTOMER'],
  W = ['WORKER'],
  P = ['CUSTOMER', 'WORKER'],
  A = ['ADMIN'];
ep(
  'get',
  '/ready',
  'Health',
  [],
  'Database readiness',
  obj({ status: enumStr(['ready']) }),
);
ep(
  'get',
  '/availability/me',
  'Availability',
  W,
  'Retrieve own recurring availability',
  obj({ availability: ref('Availability') }),
);
ep(
  'patch',
  '/availability/me',
  'Availability',
  W,
  'Replace own availability',
  obj({ availability: ref('Availability') }),
  {
    body: 'AvailabilityWrite',
    description:
      'Africa/Banjul civil time; day 0 Sunday to 6 Saturday. No overnight or overlapping intervals. Active bookings cannot be excluded.',
  },
);
ep(
  'patch',
  '/availability/available-now',
  'Availability',
  W,
  'Set marketplace availability indicator',
  obj({ availableNow: { type: 'boolean' } }),
  { body: 'AvailableNowWrite' },
);
ep(
  'post',
  '/bookings/from-quote',
  'Bookings',
  C,
  'Create booking from an accepted quote',
  obj({ booking: ref('Booking') }),
  {
    body: 'BookingFromQuote',
    status: 201,
    description:
      'Idempotent per accepted quote. Worker availability, trust, active catalog and conflicts are revalidated. All routes share a transactional worker lock.',
  },
);
ep(
  'get',
  '/bookings/me',
  'Bookings',
  P,
  'List own bookings',
  list('bookings', 'Booking'),
  { page: true },
);
ep(
  'get',
  '/bookings/{id}',
  'Bookings',
  P,
  'Retrieve participant booking',
  obj({ booking: ref('Booking') }),
);
ep(
  'post',
  '/bookings/{id}/cancel',
  'Bookings',
  P,
  'Cancel an unpaid reservation',
  obj({ booking: ref('Booking') }),
  {
    body: 'BookingCancel',
    description:
      'Only AWAITING_PAYMENT. Paid jobs use dispute/refund handling.',
  },
);
ep(
  'post',
  '/direct-proposals',
  'Direct hiring',
  C,
  'Propose work to a verified eligible worker',
  obj({ proposal: ref('DirectProposal') }),
  { body: 'DirectProposalWrite', status: 201 },
);
ep(
  'get',
  '/direct-proposals/me',
  'Direct hiring',
  P,
  'List own proposals',
  list('proposals', 'DirectProposal'),
  { page: true },
);
ep(
  'get',
  '/direct-proposals/{id}',
  'Direct hiring',
  P,
  'Retrieve own proposal',
  obj({ proposal: ref('DirectProposal') }),
);
for (const [action, roles] of [
  ['accept', W],
  ['reject', W],
  ['cancel', C],
])
  ep(
    'post',
    '/direct-proposals/{id}/' + action,
    'Direct hiring',
    roles,
    action + ' a pending proposal',
    obj({ proposal: ref('DirectProposal') }),
    {
      body: 'Empty',
      description:
        'Only unexpired PENDING proposals. Worker acceptance atomically creates the Booking; conflict leaves proposal pending.',
    },
  );
ep(
  'post',
  '/conversations',
  'Messaging',
  P,
  'Open participant context conversation',
  obj({ conversation: ref('Conversation') }),
  { body: 'ConversationWrite', status: 201 },
);
ep(
  'get',
  '/conversations/me',
  'Messaging',
  P,
  'List own conversations',
  list('conversations', 'Conversation'),
  { page: true },
);
ep(
  'get',
  '/conversations/{id}',
  'Messaging',
  P,
  'Retrieve participant conversation',
  obj({ conversation: ref('Conversation') }),
);
ep(
  'get',
  '/conversations/{id}/messages',
  'Messaging',
  P,
  'Read persisted message history',
  list('messages', 'Message'),
  { page: true },
);
ep(
  'post',
  '/conversations/{id}/messages',
  'Messaging',
  P,
  'Persist a participant message',
  obj({ message: ref('Message') }),
  {
    body: 'MessageWrite',
    status: 201,
    description:
      'Unique clientMessageId per sender/conversation. Text contacts blocked before confirmed payment. IMAGE/VOICE use owned purpose-bound media. SYSTEM is server-only.',
  },
);
ep(
  'post',
  '/conversations/{id}/read',
  'Messaging',
  P,
  'Mark conversation messages read',
  obj({ read: { type: 'boolean' } }),
  { body: 'Empty' },
);
ep(
  'get',
  '/conversations/{id}/media/{mediaId}/access',
  'Messaging',
  P,
  'Get protected message-media access',
  ref('MediaAccess'),
);
ep(
  'post',
  '/payments/bookings/{id}/checkout',
  'Simulated payments',
  C,
  'Simulate checkout',
  obj({
    payment: ref('Payment'),
    attempt: obj({ status: str, providerReference: str }),
    idempotent: { type: 'boolean' },
  }),
  {
    body: 'MockCheckout',
    description:
      'NO REAL MONEY. SUCCESS atomically holds funds and confirms an unexpired reservation. FAILURE and PENDING do not confirm. Same key replays without another ledger movement; changed payload conflicts.',
  },
);
ep(
  'get',
  '/payments/bookings/{id}',
  'Simulated payments',
  P,
  'Retrieve booking payment',
  obj({ payment: ref('Payment') }),
);
ep(
  'get',
  '/payments/{id}',
  'Simulated payments',
  P,
  'Retrieve own payment',
  obj({ payment: ref('Payment') }),
);
ep(
  'get',
  '/payments/{id}/ledger',
  'Simulated payments',
  P,
  'Inspect own payment ledger',
  obj({ payment: ref('Payment'), entries: arr(ref('LedgerEntry')) }),
);
ep(
  'get',
  '/finances/me',
  'Simulated payments',
  W,
  'Read simulated worker earnings',
  obj({
    simulated: { type: 'boolean' },
    currency: enumStr(['GMD']),
    pendingEarningsBututs: decimalString,
    releasedEarningsBututs: decimalString,
  }),
);
for (const [action, roles, body, summary] of [
  ['start', W, 'Empty', 'Start a confirmed booking at or after its schedule'],
  [
    'complete',
    W,
    'CompletionWrite',
    'Mark work complete with private evidence',
  ],
  [
    'confirm-completion',
    C,
    'Empty',
    'Confirm completion and release simulated funds',
  ],
])
  ep(
    'post',
    '/bookings/{id}/' + action,
    'Execution',
    roles,
    summary,
    obj({ booking: ref('Booking') }),
    { body },
  );
ep(
  'post',
  '/bookings/{id}/dispute',
  'Disputes',
  C,
  'Report a problem and hold funds',
  obj({ dispute: ref('Dispute') }),
  { body: 'DisputeWrite', status: 201 },
);
ep(
  'get',
  '/disputes/{id}',
  'Disputes',
  P,
  'Retrieve participant dispute',
  obj({ dispute: ref('Dispute') }),
);
ep(
  'get',
  '/bookings/{id}/evidence/{mediaId}/access',
  'Execution',
  [...P, ...A],
  'Access authorized private booking evidence',
  ref('MediaAccess'),
);
ep(
  'post',
  '/bookings/{id}/reviews',
  'Reviews',
  C,
  'Review a completed SkillLink booking',
  obj({ review: ref('Review') }),
  {
    body: 'ReviewWrite',
    status: 201,
    description:
      'One immutable customer rating per completed booking; counters update under the shared worker lock.',
  },
);
ep(
  'get',
  '/workers/{id}/reviews',
  'Reviews',
  [],
  'List visible genuine worker reviews',
  list('reviews', 'Review'),
  { page: true },
);
ep(
  'get',
  '/notifications/me',
  'Notifications',
  [...P, ...A],
  'List own notifications',
  list('notifications', 'Notification'),
  { page: true },
);
ep(
  'get',
  '/notifications/unread-count',
  'Notifications',
  [...P, ...A],
  'Count own unread notifications',
  obj({ unreadCount: int }),
);
ep(
  'post',
  '/notifications/read-all',
  'Notifications',
  [...P, ...A],
  'Mark all own notifications read',
  obj({ read: { type: 'boolean' } }),
  { body: 'Empty' },
);
ep(
  'post',
  '/notifications/{id}/read',
  'Notifications',
  [...P, ...A],
  'Mark own notification read',
  obj({ notification: ref('Notification') }),
  { body: 'Empty' },
);
for (const name of ['metrics', 'health'])
  ep(
    'get',
    '/admin/' + name,
    'Administration',
    A,
    'Retrieve actual marketplace ' + name,
    ref('AdminMetrics'),
  );
for (const [name, schema] of [
  ['users', 'AdminUser'],
  ['bookings', 'Booking'],
  ['payments', 'Payment'],
  ['ledger', 'LedgerEntry'],
  ['disputes', 'Dispute'],
  ['reviews', 'Review'],
])
  ep(
    'get',
    '/admin/' + name,
    'Administration',
    A,
    'List ' + name,
    list('items', schema),
    { page: true },
  );
ep(
  'patch',
  '/admin/users/{id}/status',
  'Administration',
  A,
  'Suspend, disable or reactivate a marketplace account',
  obj({ user: ref('AdminUser') }),
  {
    body: 'AccountStatusWrite',
    description:
      'Audited; revokes all sessions and increments token version. ADMIN accounts protected. Reactivation requires a fresh login.',
  },
);
ep(
  'get',
  '/admin/bookings/{id}',
  'Administration',
  A,
  'Inspect booking',
  obj({ booking: ref('Booking') }),
);
ep(
  'get',
  '/admin/payments/{id}',
  'Administration',
  A,
  'Inspect simulated payment and ledger',
  obj({ payment: ref('Payment'), entries: arr(ref('LedgerEntry')) }),
);
ep(
  'get',
  '/admin/disputes/{id}',
  'Administration',
  A,
  'Inspect dispute',
  obj({ dispute: ref('Dispute') }),
);
ep(
  'post',
  '/admin/disputes/{id}/resolve',
  'Administration',
  A,
  'Resolve dispute atomically with audited financial settlement',
  obj({ dispute: ref('Dispute') }),
  { body: 'DisputeDecision' },
);
ep(
  'patch',
  '/admin/reviews/{id}/moderation',
  'Administration',
  A,
  'Hide or restore review without changing rating',
  obj({ review: ref('Review') }),
  { body: 'ReviewModerate' },
);
const media = doc.paths['/media/{purpose}'].post;
media.parameters[0].schema.enum = MEDIA_PURPOSES;
media.description =
  'Authenticated multipart upload: exactly one file, max 5 MiB. Original profile/portfolio/verification purposes and COMPLETION_EVIDENCE are WORKER-only. JOB_ATTACHMENT is CUSTOMER-only. CHAT_IMAGE, VOICE_NOTE and DISPUTE_EVIDENCE allow CUSTOMER/WORKER. Images: decoded/re-encoded JPEG/PNG with metadata removed. Verification: PDF allowed. VOICE_NOTE: validated PCM WAV or Opus Ogg/WebM. All stored authenticated; purpose-specific relationship endpoints grant other participants short-lived access. No speech recognition.';
schemas.MediaMetadata.properties.purpose.enum = MEDIA_PURPOSES;
for (const op of Object.values(doc.paths['/media/{id}/access'] || {}))
  if (op.description)
    op.description +=
      ' Customers can access only their own JOB_ATTACHMENT, CHAT_IMAGE, VOICE_NOTE and DISPUTE_EVIDENCE assets. Other participants use relationship-specific access endpoints.';
doc['x-socket-io'] = {
  path: '/socket.io',
  authentication:
    'handshake.auth.token: access JWT; live session/account rechecked for every event and recipient delivery',
  events: {
    'conversation:join': {
      request: { conversation: 'ObjectId' },
      ack: 'success/data or safe error',
    },
    'message:send': {
      request: { conversation: 'ObjectId', message: 'MessageWrite' },
      ack: 'Persisted Message before acknowledgement',
    },
    'conversation:read': {
      request: { conversation: 'ObjectId' },
      ack: 'read:true',
    },
    message: {
      direction: 'server to authorized joined participants',
      payload: '{message: Message}',
    },
  },
  limits:
    '16 KiB socket payload; 30 actions/minute/connection; exact configured Origin; reconnect and use REST history for replay',
};
await fs.writeFile(file, JSON.stringify(doc, null, 2) + '\n');
let missing = [];
function check(x) {
  if (!x || typeof x !== 'object') return;
  if (x.$ref?.startsWith('#/')) {
    let y = doc;
    for (const p of x.$ref.slice(2).split('/')) y = y?.[p];
    if (!y) missing.push(x.$ref);
  }
  for (const v of Object.values(x)) check(v);
}
check(doc);
if (missing.length) throw Error('Unresolved refs: ' + missing.join(','));
console.log(
  JSON.stringify({
    paths: Object.keys(doc.paths).length,
    operations: Object.values(doc.paths).reduce(
      (s, p) =>
        s +
        Object.keys(p).filter((k) =>
          ['get', 'post', 'patch', 'delete'].includes(k),
        ).length,
      0,
    ),
    schemas: Object.keys(schemas).length,
    missingReferences: missing,
  }),
);
