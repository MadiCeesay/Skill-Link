import { expect as baseExpect } from '@playwright/test';
const expect = baseExpect.configure({ timeout: 20000 });
export async function liveJourney({ c, w, a, api, customer, worker, admin, service, image, navigate, confirm, record, resume }) {
  let jobId, quoteId, bookingId, start;
  if (resume) {
    ({ jobId, quoteId, bookingId } = resume);
    start = new Date(resume.scheduledStart);
    await navigate(c, '/app/bookings/' + bookingId);
    await record('Resuming existing agreement without database changes', resume);
  } else {
  await api('/availability/me', worker, { weekly: Array.from({ length: 7 }, (_, day) => ({ day, start: '00:00', end: '23:59' })), blockedDates: [], timeOff: [] }, 'PATCH');
  await navigate(w, '/work/availability');
  await w.getByRole('button', { name: 'Save availability', exact: true }).click();
  await expect(w.getByText('Your working hours have been saved.')).toBeVisible();
  const discovery = await api('/workers?service=' + service.id);
  const card = discovery.workers.find(item => item.workerId === worker.user.id);
  if (!card || JSON.stringify(card).match(/"(?:email|phoneNumber|coordinates|identityDocument|adminNotes)"/)) throw Error('Discovery eligibility/privacy check failed');
  await record('Availability management and public discovery privacy passed');
  await navigate(c, '/app/jobs/new');
  await c.getByLabel('Service', { exact: true }).selectOption(service.id);
  const jobTitle = 'Integration socket inspection ' + Date.now();
  await c.getByLabel('Job title').fill(jobTitle);
  await c.getByLabel('Describe your project').fill('LOCAL DEMO: inspect a damaged electrical fixture and recommend a safe repair. No physical service is being requested.');
  await c.getByLabel('General service area', { exact: true }).fill('Brikama');
  await c.getByLabel('Add project photos', { exact: true }).setInputFiles(image);
  await expect(c.locator('.upload-control .row').first()).toBeVisible();
  await c.getByRole('button', { name: 'Publish job', exact: true }).click();
  await expect(c.getByRole('heading', { name: jobTitle })).toBeVisible();
  const jobPath = new URL(c.url()).pathname;
  jobId = jobPath.split('/').at(-1);
  await api('/job-requests/' + jobId, customer, { location: { type: 'Point', coordinates: [-16.65, 13.28] }, privateAddress: 'LOCAL DEMO private address' }, 'PATCH');
  await navigate(w, '/work/opportunities');
  await w.getByRole('heading', { name: jobTitle }).click();
  const opportunity = await api('/job-requests/' + jobId + '/opportunity', worker);
  if (JSON.stringify(opportunity).match(/"(?:coordinates|privateAddress|email|phoneNumber)"/)) throw Error('Opportunity private location/contact leakage');
  await w.getByLabel(/Your quote/).fill('450');
  await w.getByLabel('A note for the customer').fill('LOCAL DEMO: I can inspect the fixture and explain the repair.');
  await w.getByLabel(/Estimated duration/).fill('30');
  await w.getByRole('button', { name: 'Submit your quote', exact: true }).click();
  await expect(w).toHaveURL(/\/work\/quotes\/[a-f0-9]{24}$/);
  quoteId = new URL(w.url()).pathname.split('/').at(-1);
  await navigate(c, jobPath);
  await confirm(c, 'Accept quote');
  await expect(c.getByText('Quote accepted. Choose a schedule')).toBeVisible();
  start = new Date(Math.ceil((Date.now() + 180000) / 60000) * 60000);
  // Keep this short demo inside one Banjul civil day, as the booking engine requires.
  if (start.getUTCHours() === 23 && start.getUTCMinutes() >= 54) {
    start.setUTCDate(start.getUTCDate() + 1);
    start.setUTCHours(0, 1, 0, 0);
  }
  const end = new Date(start.getTime() + 300000);
  await c.getByLabel(/Start time/).fill(start.toISOString().slice(0, 16));
  await c.getByLabel(/Finish time/).fill(end.toISOString().slice(0, 16));
  const bookingResponse = c.waitForResponse(response => response.url().endsWith('/api/bookings/from-quote') && response.request().method() === 'POST');
  await c.getByRole('button', { name: 'Create booking', exact: true }).click();
  const created = await bookingResponse;
  if (!created.ok()) throw Error('Live booking rejected: ' + (await created.json()).error?.code);
  await expect(c).toHaveURL(/\/app\/bookings\/[a-f0-9]{24}$/, { timeout: 60000 });
  bookingId = new URL(c.url()).pathname.split('/').at(-1);
  await record('Job attachment, deterministic opportunity match, quote and booking creation passed', { jobId, quoteId, bookingId, scheduledStart: start.toISOString() });
  }
  const paymentState = (await api('/bookings/' + bookingId, customer)).booking;
  if (paymentState.status !== 'COMPLETED') {
  await navigate(c, '/app/bookings/' + bookingId + '/payment');
  if (!['AWAITING_PAYMENT', 'CONFIRMED'].includes(paymentState.status))
    throw Error('Demo booking cannot continue from ' + paymentState.status + '; run without --continue for a new agreement.');
  if (paymentState.status === 'AWAITING_PAYMENT') {
    await c.getByRole('button', { name: 'Run payment simulation', exact: true }).click();
  }
  await expect(c.getByText(/Held .*simulated/, { exact: true })).toBeVisible();
  const settled = await api('/payments/bookings/' + bookingId, customer);
  if (settled.payment.status !== 'HELD')
    throw Error('Payment simulation did not reach HELD: ' + settled.payment.status);
  await record('Mock checkout and held ledger state passed (no real money)');
  await navigate(c, '/app/bookings/' + bookingId);
  await c.getByRole('button', { name: 'Message', exact: true }).click();
  await expect(c).toHaveURL(/\/messages\//);
  const conversationId = new URL(c.url()).pathname.split('/').at(-1);
  await navigate(w, '/work/messages/' + conversationId);
  await expect(c.getByText('Connected', { exact: true })).toBeVisible();
  await expect(w.getByText('Connected', { exact: true })).toBeVisible();
  await c.getByLabel('Your message').fill('A live integration update about the fixture.');
  await c.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(w.locator('.message-history').getByText('A live integration update about the fixture.', { exact: true }).last()).toBeVisible({ timeout: 10000 });
  await w.getByLabel('Your message').fill('Received. The integration connection is working.');
  await w.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(c.locator('.message-history').getByText('Received. The integration connection is working.', { exact: true }).last()).toBeVisible({ timeout: 10000 });
  await c.getByLabel('Attach an image', { exact: true }).setInputFiles(image);
  await expect(w.getByAltText('Shared project photo').last()).toBeVisible();
  await c.getByRole('button', { name: 'Record a voice note', exact: true }).click();
  await new Promise(resolve => setTimeout(resolve, 2000));
  await c.getByRole('button', { name: 'Stop & preview', exact: true }).click();
  const voiceUpload = c.waitForResponse(response => response.url().endsWith('/media/VOICE_NOTE') && response.request().method() === 'POST');
  await c.getByRole('button', { name: 'Send voice note', exact: true }).click();
  const uploaded = await voiceUpload;
  if (!uploaded.ok()) throw Error('Live voice upload rejected: ' + uploaded.status() + ' ' + (await uploaded.json()).error?.code);
  await expect(w.locator('.message-history audio').last()).toBeVisible();
  await record('Two-user Socket.IO delivery, real Cloudinary chat image and voice note passed');
  while (Date.now() < start.getTime() + 1000) {
    await record('Waiting for actual scheduled start; no database time changes', { secondsRemaining: Math.ceil((start.getTime() - Date.now()) / 1000) });
    await new Promise(resolve => setTimeout(resolve, Math.min(45000, start.getTime() + 1000 - Date.now())));
  }
  await navigate(w, '/work/bookings/' + bookingId);
  await confirm(w, 'Start work');
  await w.getByLabel('Completion notes').fill('LOCAL DEMO: lifecycle integration completed; no physical work or real payment.');
  await w.getByRole('button', { name: 'Mark work complete', exact: true }).click();
  await navigate(c, '/app/bookings/' + bookingId);
  await confirm(c, 'Confirm completion');
  await c.getByRole('button', { name: 'Share a review', exact: true }).click();
  await c.getByRole('dialog').getByLabel('Your experience').fill('LOCAL DEMO review of the integration workflow, not a real service endorsement.');
  await c.getByRole('dialog').getByRole('button', { name: 'Share a review', exact: true }).click();
  await expect(c.getByText('Released', { exact: true })).toBeVisible();
  await navigate(c, '/app/bookings');
  await expect(c.getByRole('heading', { name: 'Good work on the calendar.' })).toBeVisible();
  await navigate(c, '/app/bookings/' + bookingId);
  await expect(c.getByText('Released', { exact: true })).toBeVisible();
  await expect(c.getByRole('button', { name: 'Share a review', exact: true })).toHaveCount(0);
  }
  const booking = await api('/bookings/' + bookingId, customer), payment = await api('/payments/bookings/' + bookingId, customer);
  if (booking.booking.status !== 'COMPLETED' || payment.payment.status !== 'RELEASED' || booking.reviewEligibility.canReview) throw Error('Final lifecycle/review state incorrect');
  const ledger = await api('/payments/' + payment.payment.id + '/ledger', customer);
  await record('Actual-time start, completion, settlement and persistent single-review eligibility passed', { bookingId, paymentId: payment.payment.id, ledgerEntries: (ledger.entries || ledger.ledger || []).length });
  const directStart = new Date(start.getTime() + 86400000), directEnd = new Date(directStart.getTime() + 300000);
  let directBookingId;
  const existingProposals = (await api('/direct-proposals/me?limit=50', customer)).proposals;
  for (const proposal of existingProposals) {
    if (proposal.worker !== worker.user.id || proposal.status !== 'ACCEPTED' ||
        proposal.description !== 'LOCAL DEMO: inspect the electrical fixture for the direct-hire and refund integration flow.' || !proposal.booking) continue;
    const existing = (await api('/bookings/' + proposal.booking, customer)).booking;
    if (existing.status === 'AWAITING_PAYMENT' && new Date(existing.reservationExpiresAt).getTime() > Date.now() + 60000) {
      directBookingId = existing.id;
      await record('Resuming existing unpaid direct-hire reservation', { directBookingId });
      break;
    }
  }
  if (!directBookingId) {
  await navigate(c, '/app/proposals/new?worker=' + worker.user.id);
  await c.getByLabel('Service', { exact: true }).selectOption(service.id);
  await c.getByLabel('What needs doing?').fill('LOCAL DEMO: inspect the electrical fixture for the direct-hire and refund integration flow.');
  await c.getByLabel('Town / service area', { exact: true }).fill('Brikama');
  await c.getByRole('button', { name: 'Use my current location', exact: true }).click();
  await expect(c.getByText('Precise job location added.')).toBeVisible();
  await c.getByLabel(/Preferred start/).fill(directStart.toISOString().slice(0, 16));
  await c.getByLabel(/Expected finish/).fill(directEnd.toISOString().slice(0, 16));
  await c.getByLabel(/Proposed amount/).fill('500');
  await c.getByRole('button', { name: 'Send service proposal', exact: true }).click();
  await expect(c.getByRole('heading', { name: 'Your service proposals.' })).toBeVisible();
  await c.getByRole('link', { name: 'Revise proposal', exact: true }).first().click();
  await c.getByLabel(/Proposed amount/).fill('650');
  await c.getByRole('button', { name: 'Cancel old & send revised proposal', exact: true }).click();
  await expect(c.getByRole('heading', { name: 'Your service proposals.' })).toBeVisible();
  await record('Live opt-in job location and formal revised proposal price passed');
  await navigate(w, '/work/proposals');
  await w.getByRole('button', { name: 'Accept proposal', exact: true }).first().click();
  await w.getByRole('dialog').getByRole('button', { name: 'Accept proposal', exact: true }).click();
  await expect(w).toHaveURL(/\/work\/bookings\/[a-f0-9]{24}$/);
  directBookingId = new URL(w.url()).pathname.split('/').at(-1);
  const unpaid = (await api('/bookings/' + directBookingId, worker)).booking;
  if (unpaid.location || unpaid.privateAddress || unpaid.agreedAmountBututs !== 65000) throw Error('Unpaid booking privacy or revised amount incorrect');
  await record('Direct-hire reservation created through professional acceptance', { directBookingId });
  }
  // Contact sharing is blocked before confirmation, not after a successful payment.
  await navigate(c, '/app/bookings/' + directBookingId);
  await c.getByRole('button', { name: 'Message', exact: true }).click();
  await expect(c).toHaveURL(/\/messages\//);
  for (const text of ['Call +220 7100001', 'Write to demo-contact@example.test', 'Contact https://wa.me/2207100001']) {
    await c.getByLabel('Your message').fill(text);
    const blockedResponse = c.waitForResponse(response => response.url().includes('/messages') && response.request().method() === 'POST');
    await c.getByRole('button', { name: 'Send message', exact: true }).click();
    const blocked = await blockedResponse;
    if (blocked.status() !== 400 || (await blocked.json()).error?.code !== 'CONTACT_SHARING_BLOCKED') throw Error('Pre-confirmation contact policy response was not the expected rejection');
    await expect(c.getByRole('alert')).toContainText('keep communication within SkillLink');
  }
  await record('Pre-confirmation phone, email and WhatsApp contact protection passed');
  await navigate(c, '/app/bookings/' + directBookingId + '/payment');
  await c.getByRole('button', { name: 'Run payment simulation', exact: true }).click();
  await expect(c.getByText(/Held .*simulated/, { exact: true })).toBeVisible();
  const confirmedLocation = (await api('/bookings/' + directBookingId, worker)).booking;
  if (!confirmedLocation.location) throw Error('Authorized confirmed booking location missing');
  await navigate(w, '/work/bookings/' + directBookingId);
  await expect(w.getByRole('link', { name: 'View job location', exact: true })).toBeVisible();
  await record('Confirmed booking location access and revised GMD 650 payment passed');
  await navigate(c, '/app/bookings/' + directBookingId + '/problem');
  await c.getByLabel('Short reason').fill('Local integration refund demonstration');
  await c.getByLabel('What happened?').fill('LOCAL DEMO: exercise the issue report and administrator refund workflow. No physical service or real payment occurred.');
  await c.getByLabel('Add evidence photos (optional)').setInputFiles(image);
  await expect(c.locator('.upload-control .row')).toBeVisible();
  await c.getByRole('button', { name: 'Submit problem report', exact: true }).click();
  await expect(c).toHaveURL(/\/app\/disputes\//);
  const disputeId = new URL(c.url()).pathname.split('/').at(-1);
  await navigate(a, '/admin/disputes/' + disputeId);
  await expect(a.getByAltText('Private dispute evidence')).toBeVisible();
  await a.getByRole('button', { name: 'Refund customer', exact: true }).click();
  await a.getByRole('dialog').getByLabel('Decision reason').fill('LOCAL DEMO: reviewed the demonstration evidence and approved the simulated refund.');
  await a.getByRole('dialog').getByRole('button', { name: 'Refund customer', exact: true }).click();
  await expect(a.getByText('Resolved', { exact: true }).first()).toBeVisible();
  const refunded = await api('/payments/bookings/' + directBookingId, customer);
  const resolved = await api('/disputes/' + disputeId, customer);
  if (refunded.payment.status !== 'REFUNDED' || resolved.dispute.status !== 'RESOLVED' || resolved.dispute.adminDecision !== 'REFUND_CUSTOMER') throw Error('Direct-hire refund or dispute state did not persist');
  await record('Direct proposal, centralized booking, protected dispute evidence and administrator mock refund passed', { directBookingId, disputeId });
  await navigate(c, '/app/notifications');
  await c.getByRole('button', { name: 'Mark all read', exact: true }).click();
  await expect(c.getByRole('button', { name: 'Mark notification read' })).toHaveCount(0);
  await navigate(a, '/admin/bookings/' + bookingId);
  await expect(a.getByText('Completed', { exact: true }).first()).toBeVisible();
  await record('Customer notification reads and administrator booking inspection passed');
  return { jobId, quoteId, bookingId, paymentId: payment.payment.id, directBookingId, disputeId, workerId: worker.user.id, customerId: customer.user.id, adminId: admin.user.id };
}
