import { test, expect } from '@playwright/test';
const password = 'Test-password123';
async function login(page, email) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}
async function navigate(page, path) {
  await page.evaluate((p) => {
    history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}
async function apiLogin(request, email) {
  const r = await request.post('http://127.0.0.1:5001/api/auth/login', {
    data: { email, password },
  });
  expect(r.ok()).toBeTruthy();
  return (await r.json()).data;
}
test('public discovery, real catalog and profile retain the original design direction', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /Find trusted/ }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('link', { name: 'Find a professional', exact: true })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Post a job', exact: true }).first(),
  ).toBeVisible();
  await page.getByRole('heading', { name: 'Lamin Jallow' }).click();
  await expect(
    page.getByRole('heading', { name: 'Lamin Jallow' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Services & pricing' }),
  ).toBeVisible();
  await expect(page.getByText('GMD 400.00')).toBeVisible();
  await page.screenshot({
    path: 'test-results/public-profile-desktop.png',
    fullPage: true,
  });
  const workerId = new URL(page.url()).pathname.split('/').at(-1);
  await page
    .getByRole('link', { name: 'Request a service', exact: true })
    .click();
  await page.getByLabel('Email address').fill('customer@example.test');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp('/app/proposals/new\\?worker=' + workerId + '$'),
  );
  await expect(page.getByLabel('What needs doing?')).toBeVisible();
});
test('registration creates a real customer account and routes to its workspace', async ({
  page,
}) => {
  await page.goto('/register/customer');
  await page.getByLabel('First name').fill('Browser');
  await page.getByLabel('Last name').fill('Customer');
  await page
    .getByLabel('Email address')
    .fill('browser-' + Date.now() + '@example.test');
  await page
    .getByLabel('Phone number')
    .fill('+220788' + String(Date.now()).slice(-4));
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Hello, Browser.' }),
  ).toBeVisible();
});
test('customer and professional complete the quote, booking, messaging, mock payment and review journey', async ({
  browser,
  request,
}) => {
  test.setTimeout(180000);
  const customer = await browser.newContext(),
    professional = await browser.newContext(),
    c = await customer.newPage(),
    w = await professional.newPage();
  const errors = [];
  c.on('pageerror', (e) => errors.push(e.message));
  w.on('pageerror', (e) => errors.push(e.message));
  await login(c, 'customer@example.test');
  await c
    .getByRole('link', { name: 'Post a job', exact: true })
    .first()
    .click();
  await c
    .getByLabel('Service', { exact: true })
    .selectOption({ label: 'Electrician' });
  await c.getByLabel('Job title').fill('Repair the kitchen socket');
  await c
    .getByLabel('Describe your project')
    .fill(
      'Please inspect and repair the damaged electrical socket in the kitchen.',
    );
  await c.getByLabel('General service area').fill('Brikama');
  await c.getByRole('button', { name: 'Publish job' }).click();
  await expect(
    c.getByRole('heading', { name: 'Repair the kitchen socket' }),
  ).toBeVisible();
  const jobURL = c.url();
  await login(w, 'professional@example.test');
  await w.getByRole('link', { name: 'Opportunities', exact: true }).click();
  await w.getByRole('heading', { name: 'Repair the kitchen socket' }).click();
  await w.getByLabel('Your quote · GMD').fill('450');
  await w
    .getByLabel('A note for the customer')
    .fill('I can test and repair the socket safely.');
  await w.getByLabel('Estimated duration · minutes (optional)').fill('60');
  await w.getByRole('button', { name: 'Submit your quote' }).click();
  await expect(w.getByText('Changes saved successfully.')).toBeVisible();
  await navigate(c, new URL(jobURL).pathname);
  await c.getByRole('button', { name: 'Accept quote', exact: true }).click();
  await c
    .getByRole('dialog')
    .getByRole('button', { name: 'Accept quote', exact: true })
    .click();
  await expect(c.getByText('Quote accepted. Choose a schedule')).toBeVisible();
  const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  await c.getByLabel('Start time').fill(date + 'T10:00');
  await c.getByLabel('Finish time').fill(date + 'T11:00');
  await c.getByRole('button', { name: 'Create booking', exact: true }).click();
  await expect(c).toHaveURL(/\/app\/bookings\/[a-f0-9]{24}$/, {
    timeout: 60000,
  });
  const bookingId = c.url().split('/').at(-1);
  await c.getByRole('button', { name: 'Message', exact: true }).click();
  await expect(c).toHaveURL(/\/messages\//);
  await c
    .getByLabel('Your message')
    .fill('Please bring your electrical testing tools.');
  await c.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(
    c
      .locator('.message-history')
      .getByText('Please bring your electrical testing tools.', {
        exact: true,
      }),
  ).toBeVisible();
  await c.getByLabel('Your message').fill('Call +220 7100001');
  await c.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(c.getByRole('alert')).toContainText(
    'keep communication within SkillLink',
  );
  await c.getByLabel('Your message').fill('');
  await navigate(c, '/app/bookings/' + bookingId + '/payment');
  await c.getByRole('button', { name: 'Run payment simulation' }).click();
  await expect(c.getByText('Held · simulated', { exact: true })).toBeVisible();
  await request.post('http://127.0.0.1:5001/_test/start-now/' + bookingId, {
    headers: { 'x-test-fixture': 'local-e2e-only' },
  });
  await navigate(w, '/work/bookings/' + bookingId);
  await w.getByRole('button', { name: 'Start work', exact: true }).click();
  await w
    .getByRole('dialog')
    .getByRole('button', { name: 'Start work', exact: true })
    .click();
  await w.getByLabel('Completion notes').fill('Socket repaired and tested.');
  await w
    .getByRole('button', { name: 'Mark work complete', exact: true })
    .click();
  await navigate(c, '/app/bookings/' + bookingId);
  await c
    .getByRole('button', { name: 'Confirm completion', exact: true })
    .click();
  await c
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirm completion', exact: true })
    .click();
  await c.getByRole('button', { name: 'Share a review', exact: true }).click();
  await c
    .getByRole('dialog')
    .getByLabel('Your experience')
    .fill('Careful, reliable work.');
  await c
    .getByRole('dialog')
    .getByRole('button', { name: 'Share a review', exact: true })
    .click();
  await expect(c.getByText('Released', { exact: true })).toBeVisible();
  await navigate(c, '/app/bookings');
  await expect(
    c.getByRole('heading', { name: 'Good work on the calendar.' }),
  ).toBeVisible();
  await navigate(c, '/app/bookings/' + bookingId);
  await expect(c.getByText('Released', { exact: true })).toBeVisible();
  await expect(
    c.getByRole('button', { name: 'Share a review', exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
  await c.screenshot({
    path: 'test-results/completed-booking-desktop.png',
    fullPage: true,
  });
  await customer.close();
  await professional.close();
});
test('fixed listed proposals require professional acceptance and share the booking engine', async ({
  page,
  request,
}) => {
  const _customer = await apiLogin(request, 'customer@example.test'),
    discovery = await request.get('http://127.0.0.1:5001/api/workers');
  const worker = (await discovery.json()).data.workers[0],
    date = new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10);
  const professional = await apiLogin(request, 'professional@example.test');
  const setPrice = await request.patch('http://127.0.0.1:5001/api/workers/me/profile', {
    headers: { Authorization: 'Bearer ' + professional.accessToken },
    data: { pricing: [{ service: worker.services.find(s => s.name === 'Electrician').id, type: 'FIXED', amountBututs: 40000 }] },
  });
  expect(setPrice.ok()).toBeTruthy();
  await login(page, 'customer@example.test');
  await navigate(page, '/app/proposals/new?worker=' + worker.workerId);
  await page
    .getByLabel('Service', { exact: true })
    .selectOption({ label: 'Electrician' });
  await page
    .getByLabel('What needs doing?')
    .fill('Please inspect the electrical fixtures in my living room.');
  await page
    .getByLabel('Town / service area', { exact: true })
    .fill('Brikama');
  await page.getByLabel('Preferred start').fill(date + 'T12:00');
  await page.getByLabel('Expected finish').fill(date + 'T13:00');
  await page.getByRole('radio', { name: /Use listed price/ }).check();
  await page.getByRole('button', { name: 'Send service proposal' }).click();
  await expect(
    page.getByRole('heading', { name: 'Your service proposals.' }),
  ).toBeVisible();
  await login(page, 'professional@example.test');
  await navigate(page, '/work/proposals');
  await page
    .getByRole('button', { name: 'Accept proposal', exact: true })
    .first()
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Accept proposal', exact: true })
    .click();
  await expect(page).toHaveURL(/\/work\/bookings\/[a-f0-9]{24}$/);
  await expect(page.getByText('Payment required').first()).toBeVisible();
});
test('professional profile, verification, availability and earnings use actual contracts', async ({
  page,
}) => {
  await login(page, 'professional@example.test');
  await page
    .getByRole('link', { name: 'Professional profile', exact: true })
    .click();
  await expect(page.getByLabel('Professional headline')).toHaveValue(
    'Electrician & solar installer',
  );
  await page
    .getByLabel('Skills', { exact: true })
    .fill('Residential wiring, Solar installation, Fault diagnosis');
  await page.getByRole('button', { name: 'Save professional profile' }).click();
  await expect(
    page.getByText('Your professional profile is saved.'),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Verification', exact: true }).click();
  await expect(
    page.getByText('Identity approved.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Availability', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Your weekly rhythm' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save availability' }).click();
  await expect(
    page.getByText('Your working hours have been saved.'),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Earnings', exact: true }).click();
  await expect(
    page.getByText('Pending · simulated', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /withdraw/i })).toHaveCount(0);
});
test('admin pages enforce role boundaries and operate on the real catalog', async ({
  page,
}) => {
  await login(page, 'customer@example.test');
  await navigate(page, '/admin');
  await expect(page).toHaveURL(/\/app$/);
  await login(page, 'ops@example.test');
  await expect(
    page.getByRole('heading', { name: 'The marketplace at a glance.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Catalog', exact: true }).click();
  await page.getByRole('button', { name: 'Add category', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Name', { exact: true })
    .fill('Browser test category');
  await page
    .getByRole('dialog')
    .getByLabel('Description', { exact: true })
    .fill('A category created through the browser.');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Add category', exact: true })
    .click();
  await expect(
    page.getByText('Browser test category', { exact: true }),
  ).toBeVisible();
  for (const [link, heading] of [
    ['People', 'Accounts & professionals.'],
    ['Verification', 'Build trust. One profile at a time.'],
    ['Bookings', 'Every booking. A clear picture.'],
    ['Disputes', 'Give every issue a considered review.'],
    ['Reviews', 'Genuine feedback. Thoughtful moderation.'],
  ]) {
    await page.getByRole('link', { name: link, exact: true }).click();
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }
  await page.screenshot({
    path: 'test-results/admin-desktop.png',
    fullPage: true,
  });
});
test('worker onboarding, protected evidence submission and admin identity approval are integrated', async ({
  page,
}) => {
  const email = 'professional-' + Date.now() + '@example.test';
  await page.goto('/register/worker');
  await page.getByLabel('First name').fill('Fatou');
  await page.getByLabel('Last name').fill('Bah');
  await page.getByLabel('Email address').fill(email);
  await page
    .getByLabel('Phone number')
    .fill('+220799' + String(Date.now()).slice(-4));
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(page.getByLabel('Professional headline')).toBeVisible();
  await page
    .getByLabel('Professional headline')
    .fill('Residential electrician');
  await page
    .getByLabel('About your work')
    .fill(
      'Careful wiring, fault diagnosis and electrical repairs around Brikama.',
    );
  await page.getByLabel('Years of experience').fill('4');
  await page.getByLabel('Electrician', { exact: true }).check();
  await page.getByLabel('Service area 1').fill('Brikama');
  await page.getByRole('button', { name: 'Add service area', exact: true }).click();
  await page.getByLabel('Service area 2', { exact: true }).fill('Yundum');
  await page.getByLabel('Profile visibility').selectOption('PUBLIC');
  await page
    .getByLabel('Choose a profile photo', { exact: true })
    .setInputFiles('public/images/professional-at-work.jpg');
  await expect(page.locator('.upload-control .row').first()).toBeVisible();
  const profileCreated = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/workers/me/profile') &&
      response.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Create professional profile' })
    .click();
  const createdProfile = (await (await profileCreated).json()).data.profile;
  expect(createdProfile.profileImage).toMatch(/^[a-f0-9]{24}$/);
  expect(createdProfile.pricing).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: 'QUOTE_REQUIRED', currency: 'GMD' }),
    ]),
  );
  await expect(
    page.getByText('Your professional profile is saved.'),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Verification', exact: true }).click();
  await page
    .getByLabel('Upload identity document', { exact: true })
    .setInputFiles('public/images/professional-at-work.jpg');
  await page.getByLabel('Skill certificates (optional)', { exact: true }).setInputFiles('public/images/professional-at-work.jpg');
  await page.getByLabel('Work evidence (optional)', { exact: true }).setInputFiles('public/images/professional-at-work.jpg');
  await expect(page.locator('.upload-control .row')).toHaveCount(3);
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await expect(
    page.getByText('Your application is being reviewed.', { exact: false }),
  ).toBeVisible();
  await login(page, 'ops@example.test');
  await navigate(page, '/admin/verifications');
  await page
    .getByRole('link', { name: 'Review evidence', exact: true })
    .first()
    .click();
  await page
    .getByRole('button', { name: 'Open identity document', exact: true })
    .click();
  await expect(
    page.getByRole('link', { name: 'Open identity document', exact: true }),
  ).toHaveAttribute('href', /signature=/);
  await expect(page.getByRole('button', { name: 'Skill certificate 1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Work evidence 1', exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'Approve identity', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByLabel('Private notes (optional)')
    .fill('Identity reviewed in the isolated browser fixture.');
  await page.getByRole('dialog').getByLabel('Work evidence reviewed').selectOption('true');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Approve identity', exact: true })
    .click();
  await expect(
    page.getByText('Approved', { exact: true }).first(),
  ).toBeVisible();
  await login(page, email);
  await navigate(page, '/work/profile/verification');
  await expect(
    page.getByText('Identity approved.', { exact: false }),
  ).toBeVisible();
  await expect(page.locator('.header-user .avatar img')).toBeVisible();
  await navigate(page, '/professionals/' + createdProfile.user);
  await expect
    .poll(() =>
      page
        .locator('.profile-hero .avatar img')
        .evaluate((img) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.setViewportSize({ width: 375, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('private media, live delivery and record-preview-send work between participants', async ({
  browser,
  request,
}) => {
  const customer = await apiLogin(request, 'customer@example.test');
  const worker = await apiLogin(request, 'professional@example.test');
  const services = await request.get('http://127.0.0.1:5001/api/services');
  const service = (await services.json()).data.services.find(
    (s) => s.name === 'Electrician',
  );
  const jobResponse = await request.post(
    'http://127.0.0.1:5001/api/job-requests',
    {
      headers: { Authorization: 'Bearer ' + customer.accessToken },
      data: {
        service: service.id,
        title: 'Media conversation project',
        description: 'Inspect the damaged fixture and recommend a safe repair.',
        serviceArea: { name: 'Brikama', country: 'GM' },
        budget: { type: 'OPEN_TO_QUOTES' },
      },
    },
  );
  expect(jobResponse.ok()).toBeTruthy();
  const job = (await jobResponse.json()).data.jobRequest;
  const quoteResponse = await request.post(
    'http://127.0.0.1:5001/api/job-requests/' + job.id + '/quotes',
    {
      headers: { Authorization: 'Bearer ' + worker.accessToken },
      data: { proposedAmountBututs: 30000 },
    },
  );
  expect(quoteResponse.ok()).toBeTruthy();
  const quote = (await quoteResponse.json()).data.quote;
  const conversationResponse = await request.post(
    'http://127.0.0.1:5001/api/conversations',
    {
      headers: { Authorization: 'Bearer ' + customer.accessToken },
      data: { contextType: 'QUOTE', contextId: quote.id },
    },
  );
  expect(conversationResponse.ok()).toBeTruthy();
  const conversation = (await conversationResponse.json()).data.conversation;
  const cc = await browser.newContext({ permissions: ['microphone'] });
  const wc = await browser.newContext();
  const c = await cc.newPage(),
    w = await wc.newPage();
  await login(c, 'customer@example.test');
  await login(w, 'professional@example.test');
  await navigate(c, '/app/messages/' + conversation.id);
  await navigate(w, '/work/messages/' + conversation.id);
  await expect(c.getByText('Connected', { exact: true })).toBeVisible();
  await expect(w.getByText('Connected', { exact: true })).toBeVisible();
  let releaseSend;
  const sendResponse = new Promise((resolve) => {
    releaseSend = resolve;
  });
  await c.route(
    '**/api/conversations/' + conversation.id + '/messages',
    async (route) => {
      if (
        route.request().method() === 'POST' &&
        route.request().postDataJSON().text ===
          'A live update about the fixture.'
      ) {
        const response = await route.fetch();
        await sendResponse;
        await route.fulfill({ response });
      } else await route.continue();
    },
  );
  await c.getByLabel('Your message').fill('A live update about the fixture.');
  await c.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(
    w
      .locator('.message-history')
      .getByText('A live update about the fixture.', { exact: true }),
  ).toBeVisible({ timeout: 7000 });
  await c
    .getByLabel('Your message')
    .fill('This next draft must survive the previous send.');
  releaseSend();
  await expect(
    c.getByRole('button', { name: 'Send message', exact: true }),
  ).toBeEnabled();
  await expect(c.getByLabel('Your message')).toHaveValue(
    'This next draft must survive the previous send.',
  );
  await c.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(
    w
      .locator('.message-history')
      .getByText('This next draft must survive the previous send.', {
        exact: true,
      }),
  ).toBeVisible();
  await c
    .getByLabel('Attach an image', { exact: true })
    .setInputFiles('public/images/professional-at-work.jpg');
  await expect(w.getByAltText('Shared project photo')).toBeVisible({
    timeout: 15000,
  });
  await expect(w.getByAltText('Shared project photo')).toHaveJSProperty(
    'naturalWidth',
    1100,
  );
  await c.getByRole('button', { name: 'Record a voice note' }).click();
  await expect(c.getByText('Recording 0:00')).toBeVisible();
  await c.getByRole('button', { name: 'Cancel recording' }).click();
  await expect(c.getByRole('button', { name: 'Send voice note' })).toHaveCount(
    0,
  );
  await c.getByRole('button', { name: 'Record a voice note' }).click();
  await expect(c.getByText('Recording 0:02')).toBeVisible();
  await c.getByRole('button', { name: 'Stop & preview' }).click();
  await expect(c.locator('.recording-bar audio')).toBeVisible();
  await c.getByRole('button', { name: 'Send voice note' }).click();
  await expect(w.locator('.message-bubble audio')).toBeVisible({
    timeout: 15000,
  });
  await expect
    .poll(() =>
      w.locator('.message-bubble audio').evaluate((a) => a.readyState),
    )
    .toBeGreaterThanOrEqual(2);
  await wc.grantPermissions(['microphone']);
  await w.getByRole('button', { name: 'Record a voice note' }).click();
  await expect(w.getByText('Recording 0:02')).toBeVisible();
  await w.getByRole('button', { name: 'Stop & preview' }).click();
  await w.getByRole('button', { name: 'Send voice note' }).click();
  await expect(c.locator('.message-bubble audio')).toHaveCount(2);
  await c.reload();
  await login(c, 'customer@example.test');
  await navigate(c, '/app/messages/' + conversation.id);
  await expect(c.locator('.message-bubble audio')).toHaveCount(2);
  await expect.poll(() => c.locator('.message-bubble audio').last().evaluate(a => a.readyState)).toBeGreaterThanOrEqual(2);
  await w.setViewportSize({ width: 375, height: 900 });
  expect(
    await w.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await w.evaluate(() => window.scrollTo(0, 0));
  await w.screenshot({ path: 'test-results/messages-375.png', fullPage: true });
  await cc.close();
  await wc.close();
});

test('customer problem reports and reasoned admin refunds update the simulated agreement', async ({
  page,
  request,
}) => {
  const customer = await apiLogin(request, 'customer@example.test'),
    worker = await apiLogin(request, 'professional@example.test');
  const services = await request.get('http://127.0.0.1:5001/api/services');
  const service = (await services.json()).data.services.find(
    (s) => s.name === 'Electrician',
  );
  const date = new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10);
  const proposalResponse = await request.post(
    'http://127.0.0.1:5001/api/direct-proposals',
    {
      headers: { Authorization: 'Bearer ' + customer.accessToken },
      data: {
        worker: worker.user.id,
        service: service.id,
        description: 'Inspect and repair the faulty socket in the living room.',
        serviceArea: { name: 'Brikama', country: 'GM' },
        scheduledStart: date + 'T14:00:00Z',
        scheduledEnd: date + 'T15:00:00Z',
        agreedAmountBututs: 35000,
      },
    },
  );
  expect(proposalResponse.ok()).toBeTruthy();
  const proposal = (await proposalResponse.json()).data.proposal;
  const accepted = await request.post(
    'http://127.0.0.1:5001/api/direct-proposals/' + proposal.id + '/accept',
    { headers: { Authorization: 'Bearer ' + worker.accessToken }, data: {} },
  );
  expect(accepted.ok()).toBeTruthy();
  const booking = { id: (await accepted.json()).data.proposal.booking };
  const paid = await request.post(
    'http://127.0.0.1:5001/api/payments/bookings/' + booking.id + '/checkout',
    {
      headers: { Authorization: 'Bearer ' + customer.accessToken },
      data: { idempotencyKey: crypto.randomUUID(), outcome: 'SUCCESS' },
    },
  );
  expect(paid.ok()).toBeTruthy();
  await login(page, 'customer@example.test');
  await navigate(page, '/app/bookings/' + booking.id + '/problem');
  await page
    .getByLabel('Short reason')
    .fill('The proposed repair needs review');
  await page
    .getByLabel('What happened?')
    .fill(
      'Please review the repair agreement and refund this simulated payment.',
    );
  await page
    .getByLabel('Add evidence photos (optional)')
    .setInputFiles('public/images/team-at-work.jpg');
  await expect(page.locator('.upload-control .row')).toBeVisible();
  await page.getByRole('button', { name: 'Submit problem report' }).click();
  await expect(page).toHaveURL(/\/app\/disputes\//);
  const disputeId = page.url().split('/').at(-1);
  await login(page, 'ops@example.test');
  await navigate(page, '/admin/disputes/' + disputeId);
  await expect(page.getByAltText('Private dispute evidence')).toBeVisible();
  await page
    .getByRole('button', { name: 'Refund customer', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByLabel('Decision reason')
    .fill('Reviewed the issue and approved a full simulated refund.');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Refund customer', exact: true })
    .click();
  await expect(
    page.getByText('Resolved', { exact: true }).first(),
  ).toBeVisible();
  await login(page, 'customer@example.test');
  await navigate(page, '/app/disputes/' + disputeId);
  await expect(
    page.getByText('Simulated payment refunded to customer.', { exact: false }),
  ).toBeVisible();
  await navigate(page, '/app/notifications');
  await page
    .getByRole('button', { name: 'Mark all read', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Mark notification read' }),
  ).toHaveCount(0);
});

test('real multi-professional discovery filters, pagination and three-card homepage', async ({
  page,
  request,
}) => {
  test.setTimeout(180000);
  const base = 'http://127.0.0.1:5001/api';
  const catalog = (await (await request.get(base + '/services')).json()).data;
  const service = catalog.services.find((s) => s.name === 'Electrician');
  const suffix = Date.now();
  for (let i = 0; i < 13; i++) {
    const email = `discovery-${suffix}-${i}@example.test`;
    const registered = await request.post(base + '/auth/register/worker', {
      data: {
        firstName: 'Discovery',
        lastName: 'Fixture' + i,
        email,
        password,
        phoneNumber:
          '+2208' + String(suffix).slice(-5) + String(i).padStart(2, '0'),
      },
    });
    expect(registered.ok()).toBe(true);
    const worker = await apiLogin(request, email);
    const saved = await request.post(base + '/workers/me/profile', {
      headers: { Authorization: 'Bearer ' + worker.accessToken },
      data: {
        professionTitle: 'Paginationfixture electrician',
        bio: 'Isolated browser fixture for marketplace pagination and filters.',
        services: [service.id],
        serviceAreas: [{ name: 'Brikama', country: 'GM' }],
        profileVisibility: 'PUBLIC',
      },
    });
    expect(saved.ok()).toBe(true);
  }
  await page.goto(
    '/professionals?q=Paginationfixture&service=' +
      service.id +
      '&category=' +
      service.category +
      '&area=Brikama',
  );
  await expect(page.locator('.discovery-grid .worker-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.locator('.discovery-grid .worker-card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();
  await page.getByRole('button', { name: 'Previous page' }).click();
  await expect(page.locator('.discovery-grid .worker-card')).toHaveCount(12);
  await page.getByLabel('Verification', { exact: true }).selectOption('true');
  await page.getByRole('button', { name: /Apply filters/ }).click();
  await expect(
    page.getByRole('heading', { name: 'No professionals found' }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Clear filters', exact: true })
    .last()
    .click();
  await expect(page.locator('.discovery-grid .worker-card')).toHaveCount(12);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.home-worker-grid .worker-card')).toHaveCount(3);
  const tops = await page
    .locator('.home-worker-grid .worker-card')
    .evaluateAll((cards) => cards.map((c) => c.getBoundingClientRect().top));
  expect(new Set(tops).size).toBe(1);
  await page.screenshot({
    path: 'test-results/home-three-professionals.png',
    fullPage: true,
  });
});

for (const width of [375, 768, 1024, 1440])
  test(
    'responsive public and customer workspace at ' + width + 'px',
    async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expect(
        page.getByRole('heading', { name: /Find trusted/ }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.locator('.recruit-photo img').scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          page
            .locator('.recruit-photo img')
            .evaluate((img) => img.naturalWidth),
        )
        .toBeGreaterThan(0);
      await page.evaluate(() => window.scrollTo(0, 0));
      const caption = await page.locator('.photo-caption').boundingBox();
      const stamp = await page.locator('.hero-stamp').boundingBox();
      expect(caption.y + caption.height).toBeLessThan(stamp.y);
      await page.screenshot({
        path: 'test-results/home-' + width + '.png',
        fullPage: true,
      });
      await login(page, 'customer@example.test');
      await expect(
        page.getByRole('heading', { name: 'Hello, Awa.' }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: 'test-results/customer-' + width + '.png',
        fullPage: true,
      });
      await navigate(page, '/professionals');
      await expect(page.locator('.skeleton-stack')).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await login(page, 'professional@example.test');
      await expect(
        page.getByRole('heading', { name: 'Hello, Lamin.' }),
      ).toBeVisible();
      await expect(page.locator('.skeleton-stack')).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: 'test-results/worker-overview-' + width + '.png',
        fullPage: true,
      });
      await page
        .getByRole('textbox', { name: 'Search professionals or skills' })
        .fill('electrician');
      await page
        .getByRole('button', { name: 'Search professionals', exact: true })
        .click();
      await expect(page).toHaveURL(/\/professionals\?q=electrician$/);
      for (const route of [
        '/work/profile',
        '/work/availability',
        '/work/messages',
      ]) {
        await navigate(page, route);
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('.skeleton-stack')).toHaveCount(0);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
      await login(page, 'ops@example.test');
      await expect(page.locator('.overview-kpis .stat')).toHaveCount(4);
      await expect(page.locator('.skeleton-stack')).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: 'test-results/admin-overview-' + width + '.png',
        fullPage: true,
      });
      await expect(page.locator('.workspace-search')).toHaveCount(0);
      if (width === 375) {
        await page.getByRole('button', { name: 'Open navigation' }).click();
        await expect(
          page.getByRole('navigation', { name: 'Workspace navigation' }),
        ).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(
          page.getByRole('navigation', { name: 'Workspace navigation' }),
        ).not.toBeVisible();
        await page.getByRole('button', { name: 'Open navigation' }).click();
        await page.getByRole('link', { name: 'Catalog', exact: true }).click();
        await expect(page).toHaveURL(/\/admin\/catalog$/);
      }
      for (const route of [
        '/admin',
        '/admin/users',
        '/admin/verifications',
        '/admin/catalog',
        '/admin/bookings',
        '/admin/payments',
        '/admin/ledger',
        '/admin/disputes',
        '/admin/reviews',
      ]) {
        await navigate(page, route);
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('.skeleton-stack')).toHaveCount(0);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
      await page.screenshot({
        path: 'test-results/admin-' + width + '.png',
        fullPage: true,
      });
    },
  );
