import { test, expect } from "@playwright/test";
const base = "http://127.0.0.1:5001/api";
async function auth(request, email) {
  const r = await request.post(base + "/auth/login", {
    data: { email, password: "Test-password123" },
  });
  expect(r.ok()).toBeTruthy();
  return (await r.json()).data;
}
async function login(page, email) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Test-password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}
async function navigate(page, path) {
  await page.evaluate((p) => {
    history.pushState({}, "", p);
    dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}
async function prepare(request) {
  const worker = await auth(request, "professional@example.test");
  const r = await request.patch(base + "/workers/me/profile", {
    headers: { Authorization: "Bearer " + worker.accessToken },
    data: {
      serviceAreas: ["Brikama", "Farato", "Yundum", "Faraba"].map((name) => ({
        name,
        country: "GM",
      })),
    },
  });
  expect(r.ok()).toBeTruthy();
  return worker;
}
async function fillProposal(page, worker, days, amount = "500") {
  await navigate(page, "/app/proposals/new?worker=" + worker.user.id);
  await page
    .getByLabel("Service", { exact: true })
    .selectOption({ label: "Electrician" });
  await page
    .getByLabel("What needs doing?")
    .fill("DEMO: inspect a fixture and agree the repair before starting work.");
  await page.getByLabel("Town / service area", { exact: true }).fill("Yundum");
  const date = new Date(Date.now() + days * 86400000)
    .toISOString()
    .slice(0, 10);
  await page
    .getByLabel("Preferred start", { exact: true })
    .fill(date + "T12:00");
  await page
    .getByLabel("Expected finish", { exact: true })
    .fill(date + "T13:00");
  await page.getByRole('checkbox', { name: 'I have a budget (optional)' }).check();
  await page.getByLabel('Minimum · GMD').fill(amount);
  await page.getByLabel('Maximum · GMD').fill(amount);
}

test("precise location is opt-in; revised formal terms create one private, payable booking", async ({
  page,
  context,
  request,
}) => {
  const worker = await prepare(request),
    customer = await auth(request, "customer@example.test");
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ longitude: -16.65, latitude: 13.27 });
  await context.addInitScript(() => {
    window.locationRequests = 0;
    const original = navigator.geolocation.getCurrentPosition.bind(
      navigator.geolocation,
    );
    navigator.geolocation.getCurrentPosition = (...args) => {
      window.locationRequests++;
      original(...args);
    };
  });
  await login(page, "customer@example.test");
  await fillProposal(page, worker, 8);
  expect(await page.evaluate(() => window.locationRequests)).toBe(0);
  await expect(page.getByLabel(/latitude|longitude/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Use my current location" }).click();
  await expect(page.getByText("Precise job location added.")).toBeVisible();
  const sent = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/direct-proposals") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Send service proposal" }).click();
  const first = (await (await sent).json()).data.proposal;
  expect(first.location.coordinates).toEqual([-16.65, 13.27]);
  const workerHeaders = { Authorization: "Bearer " + worker.accessToken };
  const pending = (
    await (
      await request.get(base + "/direct-proposals/" + first.id, {
        headers: workerHeaders,
      })
    ).json()
  ).data.proposal;
  expect(pending).not.toHaveProperty("location");
  expect(pending).not.toHaveProperty("privateAddress");
  await page
    .getByRole("button", { name: "Message", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Your message")
    .fill("Could we agree on a revised price?");
  await page.getByRole("button", { name: "Send message" }).click();
  const unchanged = (
    await (
      await request.get(base + "/direct-proposals/" + first.id, {
        headers: { Authorization: "Bearer " + customer.accessToken },
      })
    ).json()
  ).data.proposal;
  expect(unchanged.agreedAmountBututs).toBeUndefined();
  expect(unchanged.budget.minAmountBututs).toBe(50000);
  await navigate(
    page,
    "/app/proposals/new?worker=" + worker.user.id + "&replace=" + first.id,
  );
  await page.getByLabel('Minimum · GMD').fill('650');
  await page.getByLabel('Maximum · GMD').fill('650');
  const revised = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/direct-proposals") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Cancel old & send revised proposal" })
    .click();
  const replacement = (await (await revised).json()).data.proposal;
  expect(replacement.agreedAmountBututs).toBeUndefined();
  expect(replacement.budget.maxAmountBututs).toBe(65000);
  const cancelled = (
    await (
      await request.get(base + "/direct-proposals/" + first.id, {
        headers: workerHeaders,
      })
    ).json()
  ).data.proposal;
  expect(cancelled.status).toBe("CANCELLED");
  await login(page, "professional@example.test");
  await navigate(page, "/work/proposals");
  await page
    .getByRole("button", { name: "Send quote", exact: true })
    .first()
    .click();
  await page.getByLabel('Quote amount · GMD').fill('650');
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Send quote", exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await login(page, 'customer@example.test');
  await navigate(page, '/app/proposals');
  await page.getByRole('button', { name: 'Accept quote', exact: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Accept quote', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/bookings\/[a-f0-9]{24}$/);
  const bookingId = page.url().split("/").at(-1);
  await login(page, 'professional@example.test');
  await navigate(page, '/work/bookings/' + bookingId);
  await expect(
    page.getByRole("link", { name: "View job location" }),
  ).toHaveCount(0);
  const pay = await request.post(
    base + "/payments/bookings/" + bookingId + "/checkout",
    {
      headers: { Authorization: "Bearer " + customer.accessToken },
      data: { outcome: "SUCCESS", idempotencyKey: "polish-" + Date.now() },
    },
  );
  expect(pay.ok()).toBeTruthy();
  await navigate(page, "/work/bookings");
  await navigate(page, "/work/bookings/" + bookingId);
  await expect(
    page.getByRole("link", { name: "View job location" }),
  ).toBeVisible();
  await expect(page.getByText("GMD 650.00").first()).toBeVisible();
  const duplicate = await request.post(
    base + "/direct-proposals/" + replacement.id + "/accept",
    { headers: workerHeaders, data: {} },
  );
  expect(duplicate.status()).toBe(409);
});

for (const mode of ["denied", "unavailable", "removed"])
  test(
    "location " + mode + " never blocks a town-only proposal",
    async ({ page, context, request }) => {
      const worker = await prepare(request);
      await context.addInitScript((mode) => {
        Object.defineProperty(navigator, "geolocation", {
          configurable: true,
          value:
            mode === "unavailable"
              ? undefined
              : {
                  getCurrentPosition: (success, failure) =>
                    mode === "denied"
                      ? failure({ code: 1 })
                      : success({
                          coords: { longitude: -16.65, latitude: 13.27 },
                        }),
                },
        });
      }, mode);
      await login(page, "customer@example.test");
      await fillProposal(page, worker, 9);
      await page
        .getByRole("button", { name: "Use my current location" })
        .click();
      if (mode === "removed")
        await page.getByRole("button", { name: "Remove location" }).click();
      const sent = page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/direct-proposals") &&
          r.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Send service proposal" }).click();
      const response = await sent;
      expect(response.ok()).toBeTruthy();
      expect((await response.json()).data.proposal).not.toHaveProperty(
        "location",
      );
    },
  );

test("multiple service areas can be managed without accidental duplicates", async ({
  page,
  request,
}) => {
  await prepare(request);
  await login(page, "professional@example.test");
  await navigate(page, "/work/profile");
  for (const [i, name] of ["Brikama", "Farato", "Yundum", "Faraba"].entries())
    await expect(
      page.getByLabel("Service area " + (i + 1), { exact: true }),
    ).toHaveValue(name);
  await page
    .getByRole("button", { name: "Add service area", exact: true })
    .click();
  await page.getByLabel("Service area 5", { exact: true }).fill(" brikama ");
  await page.getByRole("button", { name: "Save professional profile" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Each service area should appear once",
  );
  await page
    .getByRole("button", { name: "Remove area", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Save professional profile" }).click();
  await expect(
    page.getByText("Your professional profile is saved."),
  ).toBeVisible();
});

test("proposal form, location controls and proposal navigation fit phone through desktop", async ({
  page,
  request,
}) => {
  const worker = await prepare(request);
  await login(page, "customer@example.test");
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await navigate(page, "/app/proposals/new?worker=" + worker.user.id);
    await expect(
      page.getByRole("button", { name: "Use my current location" }),
    ).toBeVisible();
    await expect(page.getByLabel(/latitude|longitude/i)).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/proposal-form-${width}.png`,
      fullPage: true,
    });
    await navigate(page, "/app/proposals");
    await expect(
      page.getByRole("heading", { name: "Your service proposals." }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
