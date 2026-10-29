import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApi, useAction, useCatalog } from "../api/hooks";
import { useAuth } from "../api/auth";
import {
  PageTitle,
  Panel,
  QueryState,
  Empty,
  Button,
  Notice,
  Field,
  ErrorNotice,
  Chip,
  Command,
  Pager,
  Avatar,
  FileUpload,
  ProtectedMedia,
} from "../components/ui";
import { JobLocation } from "../components/JobLocation";
import {
  displayName,
  money,
  bututs,
  dateTime,
  gmdInput,
  localInput,
  pricing,
} from "../utils/format";
import { homeFor } from "../utils/policy";
import { StartChat } from "./messaging";

export function ProposalCreate() {
  const [search] = useSearchParams(),
    replacement = search.get("replace");
  const previous = useApi(
    replacement ? "/direct-proposals/" + replacement : null,
  );
  const id = search.get("worker") || previous.data?.proposal.worker;
  const worker = useApi(id ? "/workers/" + id : null);
  if (replacement && !previous.data) return <QueryState query={previous} />;
  if (!id)
    return (
      <Empty
        title="Choose a professional"
        action={<Button to="/professionals">Find a professional</Button>}
      />
    );
  return (
    <>
      <PageTitle
        eyebrow="A PLAN YOU MAKE TOGETHER"
        title={
          replacement
            ? "Agree on revised terms."
            : "Tell them what you have in mind."
        }
        description="Describe the work, request a quote or use a fixed listed price. Formal acceptance creates your booking."
      />
      <QueryState query={worker}>
        {({ worker: w }) => (
          <div className="proposal-layout">
            <Panel title="Your service proposal">
              {!w.verificationSummary.identityVerified ? (
                <Notice>
                  This professional is still completing SkillLink verification
                  and cannot accept marketplace work yet.
                </Notice>
              ) : (
                <ProposalForm
                  key={replacement || id}
                  worker={w}
                  workerId={id}
                  previous={previous.data?.proposal}
                />
              )}
            </Panel>
            <Panel title="Your professional" className="proposal-professional">
              <Avatar person={w} src={w.profileImage?.url} size="large" />
              <h3>{displayName(w)}</h3>
              <p>{w.professionTitle}</p>
              <h4>Areas served</h4>
              <div className="tags">
                {w.serviceAreas.map((a, i) => (
                  <span key={i}>{a.name}</span>
                ))}
              </div>
              <Notice>
                Messages help you discuss the work. Only formal acceptance records
                the agreed price and creates a booking.
              </Notice>
            </Panel>
          </div>
        )}
      </QueryState>
    </>
  );
}

function ProposalForm({ worker, workerId, previous }) {
  const [serviceId, setServiceId] = useState(previous?.service || ''),
    [mode, setMode] = useState('REQUEST_QUOTE'),
    [hasBudget, setHasBudget] = useState(Boolean(previous?.budget)),
    [attachments, setAttachments] = useState([]),
    [existingPhotos, setExistingPhotos] = useState(previous?.attachments || []),
    [uploading, setUploading] = useState(false);
  const listed = worker.pricing?.find(p => p.service === serviceId || p.service?.id === serviceId),
    canUseListed = listed?.type === 'FIXED' && listed.amountBututs > 0,
    pricingMode = mode === 'LISTED_PRICE' && canUseListed ? mode : 'REQUEST_QUOTE';
  const [location, setLocation] = useState(previous?.location || null),
    [error, setError] = useState(null),
    [cancelled, setCancelled] = useState(false);
  const action = useAction(),
    navigate = useNavigate();
  async function save(event) {
    event.preventDefault();
    setError(null);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const start = new Date(values.start + ":00Z"),
        end = new Date(values.end + ":00Z");
      if (!(start > new Date()) || !(end > start) || end - start > 86400000)
        throw Error(
          "Choose a future start and a later end, up to 24 hours apart.",
        );
      const body = {
        worker: workerId,
        service: values.service,
        description: values.description.trim(),
        serviceArea: {
          name: values.area.trim(),
          country: "GM",
          ...(values.region.trim() ? { region: values.region.trim() } : {}),
        },
        ...(values.privateAddress.trim()
          ? { privateAddress: values.privateAddress.trim() }
          : {}),
        ...(location ? { location } : {}),
        scheduledStart: start.toISOString(),
        scheduledEnd: end.toISOString(),
        pricingMode,
        attachments: [...existingPhotos, ...attachments],
        ...(pricingMode === 'LISTED_PRICE' ? { listedAmountBututs: listed.amountBututs } : {}),
        ...(pricingMode === 'REQUEST_QUOTE' && hasBudget ? { budget: {
          minAmountBututs: bututs(values.budgetMin), maxAmountBututs: bututs(values.budgetMax),
        } } : {}),
      };
      if (body.budget && (body.budget.minAmountBututs <= 0 || body.budget.maxAmountBututs < body.budget.minAmountBututs))
        throw Error('Enter a positive budget minimum and a maximum at least as large.');
      if (previous && !cancelled && ['PENDING', 'QUOTED'].includes(previous.status)) {
        await action.mutateAsync({
          path: "/direct-proposals/" + previous.id + "/cancel",
        });
        setCancelled(true);
      }
      await action.mutateAsync({ path: "/direct-proposals", body });
      navigate("/app/proposals");
    } catch (e) {
      setError(e);
    }
  }
  return (
    <form className="form-stack proposal-form" onSubmit={save}>
      {previous && (
        <Notice>
          Sending revised terms cancels your pending invitation first. The
          professional must accept the new price and schedule. If sending fails
          after cancellation, the old invitation stays cancelled and you can
          retry here.
        </Notice>
      )}
      <fieldset>
        <legend>1. What do you need?</legend>
        <Field
          label="Service"
          name="service"
          as="select"
          required
          value={serviceId}
          onChange={e => { setServiceId(e.target.value); setMode('REQUEST_QUOTE'); }}
        >
          <option value="">Choose a service</option>
          {worker.services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Field>
        <small>
          Services offered by this professional. For other work, choose another
          professional.
        </small>
        <Field
          label="What needs doing?"
          name="description"
          as="textarea"
          rows={5}
          minLength={20}
          maxLength={3000}
          required
          defaultValue={previous?.description}
          hint="Describe what needs to be repaired, installed, built or completed."
        />
        {existingPhotos.map(id => <div key={id}><ProtectedMedia path={'/media/' + id + '/access'} label="Existing job photo" />
          <Button variant="text" onClick={() => setExistingPhotos(ids => ids.filter(x => x !== id))}>Remove photo</Button></div>)}
        <FileUpload purpose="JOB_ATTACHMENT" multiple max={5 - existingPhotos.length} onChange={setAttachments}
          onBusyChange={setUploading} label="Add photos (optional)" preview />
        <small>Photos can help the professional understand the work and provide a more accurate quote. Up to five photos.</small>
      </fieldset>
      <fieldset>
        <legend>2. Where is the job?</legend>
        <Field
          label="Town / service area"
          name="area"
          required
          maxLength={100}
          defaultValue={previous?.serviceArea.name}
          placeholder="For example, Yundum"
        />
        <Field
          label="Region (optional)"
          name="region"
          maxLength={100}
          defaultValue={previous?.serviceArea.region || ""}
        />
        <Field
          label="Address or directions (optional)"
          name="privateAddress"
          maxLength={500}
          defaultValue={previous?.privateAddress || ""}
          hint="Shared with the professional only after booking confirmation."
        />
        <JobLocation value={location} onChange={setLocation} />
      </fieldset>
      <fieldset>
        <legend>3. When do you need it?</legend>
        <p className="muted">
          Choose a start and finish in Gambian local time. Your professional's
          working hours must cover the visit. This is a preferred schedule;
          availability is checked again when the booking is created.
        </p>
        <div className="two-grid">
          <Field
            label="Preferred start"
            name="start"
            type="datetime-local"
            required
            defaultValue={localInput(previous?.scheduledStart)}
          />
          <Field
            label="Expected finish"
            name="end"
            type="datetime-local"
            required
            defaultValue={localInput(previous?.scheduledEnd)}
          />
        </div>
      </fieldset>
      <fieldset>
        <legend>4. Budget & pricing</legend>
        {listed && <Notice>{pricing(listed)}
          {listed.type === 'STARTING_FROM' && <p>Final price depends on the scope of work.</p>}
          {listed.type === 'HOURLY' && <p>This is an hourly rate. Agree a total with the professional before booking. Hours are not automatically tracked or billed.</p>}
        </Notice>}
        <label className="pricing-choice"><input type="radio" name="pricingChoice" checked={pricingMode === 'REQUEST_QUOTE'} onChange={() => setMode('REQUEST_QUOTE')} />
          <span><strong>Request a quote</strong><small>Let the professional review your job and suggest a price.</small></span></label>
        {canUseListed && <label className="pricing-choice"><input type="radio" name="pricingChoice" checked={pricingMode === 'LISTED_PRICE'} onChange={() => setMode('LISTED_PRICE')} />
          <span><strong>Use listed price · {money(listed.amountBututs)} fixed</strong><small>The professional confirms the work and schedule before a booking is created.</small></span></label>}
        {pricingMode === 'REQUEST_QUOTE' && <>
          <label className="row"><input type="checkbox" checked={hasBudget} onChange={e => setHasBudget(e.target.checked)} />I have a budget (optional)</label>
          {hasBudget && <><div className="two-grid">
            <Field label="Minimum · GMD" name="budgetMin" type="number" min="0.01" step="0.01" required defaultValue={previous?.budget ? gmdInput(previous.budget.minAmountBututs) : ''} />
            <Field label="Maximum · GMD" name="budgetMax" type="number" min="0.01" step="0.01" required defaultValue={previous?.budget ? gmdInput(previous.budget.maxAmountBututs) : ''} />
          </div><small>This is a budget guide, not the professional’s final quote.</small></>}
        </>}
      </fieldset>
      {error && <ErrorNotice error={error} />}
      <Button type="submit" disabled={action.isPending || uploading}>
        {action.isPending
          ? "Sending…"
          : previous
            ? "Cancel old & send revised proposal"
            : "Send service proposal"}
      </Button>
    </form>
  );
}

export function Proposals() {
  const { user } = useAuth(),
    [page, setPage] = useState(1),
    base = homeFor(user.role);
  const query = useApi(
    "/direct-proposals/me",
    { page, limit: 12 },
    { refetchInterval: 30000 },
  );
  return (
    <>
      <PageTitle
        eyebrow="MAKE A PLAN TOGETHER"
        title={
          user.role === "WORKER"
            ? "Your direct invitations."
            : "Your service proposals."
        }
        description="Messages help you discuss. Formal proposal actions confirm your agreement."
      />
      <QueryState query={query}>
        {(data) => (
          <>
            {data.proposals.length ? (
              <div className="job-grid">
                {data.proposals.map((p) => (
                  <ProposalCard key={p.id} proposal={p} />
                ))}
              </div>
            ) : (
              <Empty
                title="A new connection starts with an invitation"
                action={
                  <Button
                    to={
                      user.role === "WORKER"
                        ? "/work/profile"
                        : "/professionals"
                    }
                  >
                    {user.role === "WORKER"
                      ? "Manage your profile"
                      : "Find a professional"}
                  </Button>
                }
              />
            )}
            <Pager
              pagination={data.pagination}
              page={page}
              onChange={setPage}
            />
            <Button to={base + "/bookings"} variant="outline">
              View all bookings
            </Button>
          </>
        )}
      </QueryState>
    </>
  );
}

function ProposalCard({ proposal: p }) {
  const quote = p.quotes?.at(-1),
    quoteRequest = p.pricingMode === 'REQUEST_QUOTE',
    open = ['PENDING', 'QUOTED'].includes(p.status),
    quoteValid = quote && new Date(quote.expiresAt) > new Date();
  const { user } = useAuth(),
    worker = user.role === "WORKER",
    base = homeFor(user.role),
    navigate = useNavigate();
  const professional = useApi(!worker ? "/workers/" + p.worker : null),
    { services } = useCatalog();
  const person = professional.data?.worker,
    service = services.find((s) => s.id === p.service);
  return (
    <Panel
      title={service?.name || "Service invitation"}
      action={<Chip status={p.status} />}
    >
      <div className="row">
        <Avatar
          person={person || p.customerSummary}
          src={person?.profileImage?.url}
        />
        <strong>
          {worker
            ? displayName(p.customerSummary) || "Your customer"
            : displayName(person) || "Your professional"}
        </strong>
      </div>
      <p className="prose">{p.description}</p>
      <p>{p.serviceArea?.name}</p>
      <p className="small muted">
        {dateTime(p.scheduledStart)} – {dateTime(p.scheduledEnd)}
      </p>
      <strong className="quote-price">{p.status === 'ACCEPTED' ? money(p.agreedAmountBututs)
        : quoteRequest ? quote ? money(quote.amountBututs) : 'Quote requested' : money(p.agreedAmountBututs)}</strong>
      {quoteRequest && <p className="small muted">{p.status === 'ACCEPTED' ? 'Agreed booking price' : quote ? 'Professional quote' : 'Waiting for professional quote'}</p>}
      {p.budget && <Notice>Customer budget: {money(p.budget.minAmountBututs)} – {money(p.budget.maxAmountBututs)}. This is a guide, not an agreed price.</Notice>}
      {quote && <><p className="prose">{quote.note}</p><p className="small muted">Quote valid until {dateTime(quote.expiresAt)}{!quoteValid && open ? ' · Expired — request a revised quote' : ''}</p></>}
      {p.attachments?.length > 0 && <div className="media-grid">{p.attachments.map(id => <ProtectedMedia key={id}
        path={'/direct-proposals/' + p.id + '/attachments/' + id + '/access'} alt="Job photo" />)}</div>}
      {p.quotes?.length > 1 && <details><summary>Previous quotes</summary>{p.quotes.slice(0, -1).map(q => <p key={q.revision}>{money(q.amountBututs)} · {q.note} · Superseded</p>)}</details>}
      {!p.booking && (
        <p className="small muted">
          Exact job location becomes available after the booking is confirmed.
        </p>
      )}
      {open && (
        <Notice>
          {quoteRequest ? worker ? 'Review the work and send a formal quote. Chat messages do not set the booking price.'
            : quote ? 'Review the formal quote and accept it to create your booking. Chat messages do not accept a price.'
              : 'Waiting for the professional to assess the work and send a quote.' : worker
            ? "Accept these terms to create a booking. To suggest a different price, message the customer and ask them to send revised terms."
            : "Awaiting the professional’s formal acceptance. A chat agreement does not change this price."}
        </Notice>
      )}
      <div className="actions">
        <StartChat type="DIRECT_PROPOSAL" id={p.id} />
        {p.booking && (
          <Button to={base + "/bookings/" + p.booking}>View booking</Button>
        )}
        {open && quoteRequest && worker && <Command
          label={quote ? 'Revise quote' : 'Send quote'} path={'/direct-proposals/' + p.id + '/quote'}
          initial={quote ? { amount: gmdInput(quote.amountBututs), note: quote.note } : undefined}
          fields={[{ name: 'amount', label: 'Quote amount · GMD', type: 'number', min: '0.01', step: '0.01', required: true },
            { name: 'note', label: 'What is included? (optional)', as: 'textarea', maxLength: 2000 }]}
          build={v => ({ amountBututs: bututs(v.amount), note: v.note || '', revision: p.quoteRevision })}
          description="State the total for this work. Explain whether labour, materials and transport are included. A revised quote replaces the previous offer until the customer accepts."
        />}
        {open && quoteRequest && !worker && p.status === 'QUOTED' && <>
          {quoteValid && <Command label="Accept quote" path={'/direct-proposals/' + p.id + '/accept-quote'}
            body={{ revision: quote.revision }} description={'Accept ' + money(quote.amountBututs) + ' and create your booking? Availability is checked now.'}
            onSuccess={data => navigate(base + '/bookings/' + data.proposal.booking)} />}
          <Command label="Decline quote" path={'/direct-proposals/' + p.id + '/decline-quote'} description="Decline this quote and close the request?" variant="outline" />
        </>}
        {open &&
          (worker ? (
            <>
              {!quoteRequest && <Command
                label="Accept proposal"
                path={"/direct-proposals/" + p.id + "/accept"}
                description={
                  "Accept " +
                  money(p.agreedAmountBututs) +
                  " and create a booking? Availability is checked before acceptance."
                }
                onSuccess={(data) => {
                  if (data.proposal.booking)
                    navigate(base + "/bookings/" + data.proposal.booking);
                }}
              />}
              <Command
                label="Decline"
                path={"/direct-proposals/" + p.id + "/reject"}
                variant="outline"
                description="Decline this invitation?"
              />
            </>
          ) : (
            <>
              <Button
                variant="outline"
                to={
                  "/app/proposals/new?worker=" + p.worker + "&replace=" + p.id
                }
              >
                Revise proposal
              </Button>
              <Command
                label="Cancel proposal"
                path={"/direct-proposals/" + p.id + "/cancel"}
                variant="outline"
                description="Cancel this pending invitation?"
              />
            </>
          ))}
      </div>
    </Panel>
  );
}
