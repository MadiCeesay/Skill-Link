import { JobLocation } from '../components/JobLocation';
import { servicePresentation } from '../utils/service-presentation';
import { useState } from 'react';
import {
  Link,
  useNavigate,
  useSearchParams,
  useParams,
} from 'react-router-dom';
import {
  Search,
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  MessageCircle,
  Check,
  Star,
  MapPin,
  Wrench,
  PlugZap,
  Paintbrush,
  Brush,
  Scissors,
  Hammer,
  Car,
  SlidersHorizontal,
  Users,
  CalendarCheck,
  CheckCircle2,
  BriefcaseBusiness,
} from 'lucide-react';
import { useApi, useCatalog } from '../api/hooks';
import { useAuth } from '../api/auth';
import {
  PageTitle,
  Button,
  ArrowButton,
  Panel,
  QueryState,
  Skeleton,
  Empty,
  ErrorNotice,
  WorkerCard,
  Field,
  Badge,
  Avatar,
  Notice,
  Pager,
  Stat,
} from '../components/ui';
import { displayName, pricing, date } from '../utils/format';
const heroPhoto = '/images/skilllink-professional-hero.webp';
const recruitPhoto = '/images/workers.jpg';
export function Home() {
  const catalog = useCatalog(),
    services = catalog.services,
    workers = useApi('/workers', { limit: 3, sort: 'trust' }),
    navigate = useNavigate();
  const reviewed = workers.data?.workers?.find((w) => w.reviewCount > 0);
  const reviews = useApi(
    reviewed ? '/workers/' + reviewed.workerId + '/reviews' : null,
    { limit: 3 },
  );
  return (
    <>
      <section className="hero reference-hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">
              <ShieldCheck size={25} />
              YOUR LOCAL SERVICES MARKETPLACE
            </p>
            <h1>
              Find trusted
              <br />
              <span>professionals</span> near you.
            </h1>
            <p className="hero-description">
              Find skilled local professionals for repairs, maintenance,
              installations and everyday projects — all in one place.
            </p>
            <form
              className="hero-search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(
                  '/professionals?q=' +
                    encodeURIComponent(new FormData(e.currentTarget).get('q')),
                );
              }}
            >
              <Search size={22} />
              <label className="sr-only" htmlFor="hero-search">
                What service do you need?
              </label>
              <input
                id="hero-search"
                name="q"
                maxLength={80}
                placeholder="Enter the service you need"
              />
              <button type="submit" aria-label="Find a professional">
                Discover{' '}
                <span>
                  <ArrowUpRight size={23} />
                </span>
              </button>
            </form>
            <div className="hero-actions">
              <ArrowButton to="/professionals">Find a professional</ArrowButton>
              <Button to="/app/jobs/new" variant="outline">
                Post a job
                <ArrowUpRight size={18} />
              </Button>
            </div>
            <div className="hero-trust">
              <span>
                <ShieldCheck size={17} />
                Identity-verified profiles
              </span>
              <span>
                <MessageCircle size={17} />
                In-platform conversations
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-photo-frame">
              <img
                src={heroPhoto}
                alt="Illustrative professional wearing work overalls and a safety helmet"
                fetchPriority="high"
                referrerPolicy="no-referrer"
              />
              <div className="photo-caption">
                <Star size={26} fill="currentColor" />
                <span>LOCAL SKILLS</span>
                <strong>
                  Here to lend
                  <br />a helping hand.
                </strong>
              </div>
            </div>
            <div className="hero-stamp">
              <ShieldCheck size={25} />
              <div>
                <strong>A connection you can trust</strong>
                <span>Profiles. Portfolios. Genuine reviews.</span>
              </div>
            </div>
            <div className="hero-corner">
              <ArrowUpRight size={36} />
            </div>
          </div>
        </div>
        <div className="hero-bottom container">
          <p>
            Built for the way we work.
            <br />
            <strong>Made for The Gambia.</strong>
          </p>
          <div>
            <span>Explore your possibilities</span>
            <ArrowRight size={20} />
          </div>
        </div>
      </section>
      <section className="category-band">
        <div className="container category-list">
          {catalog.isPending && (
            <span role="status">Loading local services…</span>
          )}
          {catalog.error && (
            <div className="catalog-feedback"><ErrorNotice error={catalog.error} retry={catalog.refetch} /></div>
          )}
          {services.slice(0, 6).map((c) => {
            const { Icon, key } = servicePresentation(c);
            return (
              <Link to={'/professionals?service=' + c.id} key={c.id} data-service-kind={key}>
                <span>
                  <Icon size={25} />
                </span>
                <strong>{c.name}</strong>
                <ArrowUpRight size={16} />
              </Link>
            );
          })}
          {!catalog.isPending && !catalog.error && !services.length && (
            <Link to="/services">
              <span>
                <Wrench size={25} />
              </span>
              <strong>Explore local services</strong>
              <ArrowUpRight size={18} />
            </Link>
          )}
        </div>
      </section>
      <section className="container section home-professionals">
        <div className="section-heading centered">
          <div>
            <p className="eyebrow">MEET YOUR NEXT HELPING HAND</p>
            <h2>Meet your local professionals</h2>
            <p>
              Discover skilled people across The Gambia. Explore their work,
              services and genuine customer reviews.
            </p>
          </div>
          <Button to="/professionals" variant="outline">
            Explore professionals
            <ArrowUpRight size={18} />
          </Button>
        </div>
        <QueryState query={workers}>
          {(data) =>
            data.workers.length ? (
              <div className="worker-grid home-worker-grid">
                {data.workers.map((w) => (
                  <WorkerCard worker={w} key={w.workerId} />
                ))}
              </div>
            ) : (
              <Empty
                title="A growing community of local talent"
                description="Professional profiles will appear here as people join. Have a skill to share? Be part of the beginning."
                action={
                  <Button to="/register/worker" variant="secondary">
                    Join as a professional
                    <ArrowUpRight size={17} />
                  </Button>
                }
              />
            )
          }
        </QueryState>
      </section>
      <HowSection />
      <section className="container section recruit">
        <div className="recruit-photo">
          <img
            src={recruitPhoto}
            alt="Team of skilled workers wearing safety helmets and holding trade tools"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          <span className="recruit-label">YOUR SKILLS DESERVE TO BE SEEN.</span>
        </div>
        <div>
          <p className="eyebrow">MAKE YOUR NEXT MOVE</p>
          <h2>
            Become a trusted <span className="accent-word">professional</span>
          </h2>
          <p className="muted">
            Build a professional home for your work. Connect with customers,
            showcase your craft and make every good job count.
          </p>
          <ul className="benefits">
            {[
              'Find relevant opportunities in your area',
              'Set your availability. Choose your projects.',
              'Build your reputation with genuine reviews',
              'Keep quotes, conversations and bookings together',
            ].map((t) => (
              <li key={t}>
                <CheckCircle2 size={19} />
                {t}
              </li>
            ))}
          </ul>
          <ArrowButton to="/register/worker">
            Become a SkillLink professional
          </ArrowButton>
          <small className="recruit-footnote">
            Your next chapter starts with your profile.
          </small>
        </div>
      </section>
      <section className="trust-section">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">GOOD WORK STARTS WITH TRUST</p>
              <h2>
                A little more confidence,
                <br />
                every step of the way.
              </h2>
            </div>
            <p>
              Know who you’re hiring.
              <br />
              Keep the important details in one place.
            </p>
          </div>
          <div className="three-grid">
            {[
              [
                ShieldCheck,
                'Know your professional',
                'Identity checks and clear verification badges help you make an informed choice.',
              ],
              [
                Star,
                'Reviews from real work',
                'Reviews come from customers with completed SkillLink bookings.',
              ],
              [
                MessageCircle,
                'Keep the conversation together',
                'Discuss your project with text, images and voice notes inside SkillLink.',
              ],
            ].map(([Icon, t, d]) => (
              <article key={t}>
                <Icon size={28} />
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="container section testimonials">
        <div>
          <p className="eyebrow">THE WORD ON GOOD WORK</p>
          <h2>
            Real experiences.
            <br />
            Shared by real customers.
          </h2>
          <p className="muted">
            A reputation built one completed project at a time.
          </p>
          <Button to="/professionals" variant="text">
            Meet the professionals
            <ArrowRight size={17} />
          </Button>
        </div>
        <div>
          {reviewed && reviews.isPending ? (
            <Skeleton />
          ) : reviews.error ? (
            <ErrorNotice
              error={reviews.error}
              retry={() => reviews.refetch()}
            />
          ) : reviews.data?.reviews?.length ? (
            reviews.data.reviews.map((r) => (
              <blockquote key={r.id}>
                <div className="rating">
                  <Star fill="currentColor" size={16} />
                  {r.rating} / 5
                </div>
                <p>“{r.comment || 'A completed SkillLink service.'}”</p>
                <footer>Verified booking review · {date(r.createdAt)}</footer>
              </blockquote>
            ))
          ) : (
            <div className="new-community">
              <MessageCircle size={32} />
              <h3>Every great community starts somewhere.</h3>
              <p>
                As customers complete their first bookings, their genuine
                experiences will be shared here.
              </p>
              <Link to="/app/jobs/new">
                Start your first project
                <ArrowUpRight size={17} />
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
export function HowSection() {
  return (
    <section className="how-section" id="how-it-works">
      <div className="container">
        <div className="section-heading centered">
          <p className="eyebrow">FROM “WHO CAN HELP?” TO “JOB DONE.”</p>
          <h2>How SkillLink works</h2>
          <p>Two ways to start. One place to make it happen.</p>
        </div>
        <div className="steps">
          {[
            [
              '01',
              'Tell us what you need',
              'Find a professional or post your job for relevant workers to see.',
            ],
            [
              '02',
              'Find your right fit',
              'Explore profiles, portfolios and quotes. Ask questions in your conversation.',
            ],
            [
              '03',
              'Make a plan together',
              'Agree on the work, choose a time and manage your booking.',
            ],
            [
              '04',
              'Get it done. Share your experience.',
              'Confirm completed work and leave a genuine booking review.',
            ],
          ].map(([n, t, d]) => (
            <div key={n}>
              <span>{n}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
export function Services() {
  const catalog = useCatalog(),
    [q, setQ] = useState('');
  const selected = catalog.services.filter((s) =>
    s.name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="container section">
      <PageTitle
        eyebrow="A SKILL FOR EVERY PROJECT"
        title="What can we help you with?"
        description="Find local professionals for the things on your to-do list."
      />
      <Field
        label="Search services"
        placeholder="Try plumbing, tailoring or electrical…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {catalog.isPending && <Skeleton />}
      {catalog.error && (
        <ErrorNotice error={catalog.error} retry={catalog.refetch} />
      )}
      <div className="service-grid">
        {!catalog.isPending &&
          !catalog.error &&
          selected.map((s) => {
            const { Icon, key } = servicePresentation(s);
            return (
              <Link
                className="service-card"
                to={'/professionals?service=' + s.id}
                key={s.id}
                data-service-kind={key}
              >
                <span>
                  <Icon size={27} />
                </span>
                <h3>{s.name}</h3>
                <p>
                  {s.description ||
                    'Find a skilled professional for your next project.'}
                </p>
                <span className="service-link">
                  Find professionals
                  <ArrowUpRight size={18} />
                </span>
              </Link>
            );
          })}
      </div>
      {!catalog.isPending && !catalog.error && !selected.length && (
        <Empty
          title="No services found"
          description="Try another search. The service catalog is managed by SkillLink."
        />
      )}
    </div>
  );
}
export function Discovery() {
  const [search, setSearch] = useSearchParams(),
    catalog = useCatalog(),
    [expanded, setExpanded] = useState(false),
    [searchLocation, setSearchLocation] = useState(null);
  const params = Object.fromEntries(search),
    page = Number(params.page) || 1;
  const query = useApi('/workers', { ...params, page, limit: 12 });
  function apply(e) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    setSearch(
      Object.fromEntries(
        Object.entries({ ...values, ...(searchLocation ? { longitude: searchLocation.coordinates[0], latitude: searchLocation.coordinates[1] } : {}), page: 1 }).filter(([, v]) => v !== ''),
      ),
    );
  }
  return (
    <div className="container section">
      <PageTitle
        eyebrow="GOOD PEOPLE. SKILLED HANDS."
        title="Find your right fit."
        description="Discover local professionals for your next project. Compare skills, pricing and genuine reviews."
      />
      <div className="discovery-layout">
        <aside className={'filter-panel ' + (expanded ? 'expanded' : '')}>
          <button
            className="filter-toggle"
            onClick={() => setExpanded(!expanded)}
          >
            <SlidersHorizontal size={18} />
            Refine your search
          </button>
          <form onSubmit={apply} key={search.toString()}>
            <h2>Find a professional</h2>
            <Field
              label="Search"
              name="q"
              defaultValue={params.q}
              maxLength={80}
              placeholder="Profession or skill"
            />
            {catalog.error && (
              <ErrorNotice error={catalog.error} retry={catalog.refetch} />
            )}
            <DiscoveryCatalogFields catalog={catalog} params={params} />
            <Field
              label="Service area"
              name="area"
              defaultValue={params.area}
              placeholder="e.g. Brikama"
              maxLength={100}
            />
            <Field
              label="Verification"
              name="verified"
              as="select"
              defaultValue={params.verified || ''}
            >
              <option value="">Any verification status</option>
              <option value="true">Identity verified</option>
            </Field>
            <Field
              label="Availability indicator"
              name="availableNow"
              as="select"
              defaultValue={params.availableNow || ''}
            >
              <option value="">Any</option>
              <option value="true">Available now</option>
            </Field>
            <Field
              label="Minimum rating"
              name="minRating"
              as="select"
              defaultValue={params.minRating || ''}
            >
              <option value="">Any rating</option>
              {[3, 4, 4.5].map((n) => (
                <option key={n} value={n}>
                  {n}+ stars
                </option>
              ))}
            </Field>
            <Field
              label="Pricing"
              name="pricingType"
              as="select"
              defaultValue={params.pricingType || ''}
            >
              <option value="">Any pricing</option>
              {['FIXED', 'HOURLY', 'STARTING_FROM', 'QUOTE_REQUIRED'].map(
                (p) => (
                  <option key={p} value={p}>
                    {p.toLowerCase().replaceAll('_', ' ')}
                  </option>
                ),
              )}
            </Field>
            <Field
              label="Sort by"
              name="sort"
              as="select"
              defaultValue={params.sort || 'relevance'}
            >
              <option value="relevance">Relevance</option>
              <option value="trust">Verification</option>
              <option value="rating">Rating</option>
              <option value="distance">Distance (coordinates required)</option>
              <option value="price">Price (choose service & pricing)</option>
            </Field>
            <details>
              <summary>Search by proximity</summary>
              <JobLocation mode="search" value={searchLocation} onChange={setSearchLocation} />
              <Field
                label="Radius (km)"
                name="radiusKm"
                type="number"
                min="1"
                max="200"
                defaultValue={params.radiusKm}
              />
            </details>
            <Button
              type="submit"
              disabled={catalog.isPending || !!catalog.error}
            >
              Apply filters
              <ArrowRight size={17} />
            </Button>
            <button
              type="button"
              className="text-button"
              onClick={() => { setSearchLocation(null); setSearch({}); }}
            >
              Clear filters
            </button>
          </form>
        </aside>
        <div>
          <div className="results-heading">
            <span>
              {query.data?.pagination?.total ?? 'Discover'} professionals
            </span>
            <span className="muted small">The Gambia</span>
          </div>
          <QueryState query={query}>
            {(data) => (
              <>
                {data.workers.length ? (
                  <div className="worker-grid discovery-grid">
                    {data.workers.map((w) => (
                      <WorkerCard key={w.workerId} worker={w} />
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="No professionals found"
                    description="No professionals match these filters yet. Try another service or area, or post your job."
                    action={
                      <div className="actions">
                        <Button variant="outline" onClick={() => setSearch({})}>
                          Clear filters
                        </Button>
                        <Button to="/app/jobs/new">
                          Post a job
                          <ArrowUpRight size={17} />
                        </Button>
                      </div>
                    }
                  />
                )}
                <Pager
                  pagination={data.pagination}
                  page={page}
                  onChange={(p) => setSearch({ ...params, page: p })}
                />
              </>
            )}
          </QueryState>
        </div>
      </div>
    </div>
  );
}
function DiscoveryCatalogFields({ catalog, params }) {
  const [category, setCategory] = useState(params.category || ''),
    [service, setService] = useState(params.service || '');
  return (
    <>
      <Field
        label="Category"
        name="category"
        as="select"
        value={category}
        disabled={catalog.isPending || !!catalog.error}
        onChange={(e) => {
          const next = e.target.value;
          setCategory(next);
          if (
            next &&
            !catalog.services.some(
              (s) => s.id === service && s.category === next,
            )
          )
            setService('');
        }}
      >
        <option value="">All categories</option>
        {catalog.categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Field>
      <Field
        label="Service"
        name="service"
        as="select"
        value={service}
        disabled={catalog.isPending || !!catalog.error}
        onChange={(e) => setService(e.target.value)}
      >
        <option value="">All services</option>
        {catalog.services
          .filter((s) => !category || s.category === category)
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
      </Field>
    </>
  );
}
export function WorkerProfile() {
  const { id } = useParams(),
    query = useApi('/workers/' + id),
    [page, setPage] = useState(1),
    reviews = useApi('/workers/' + id + '/reviews', { page, limit: 10 }),
    { user } = useAuth();
  return (
    <div className="container section">
      <Link to="/professionals" className="back-link">
        ← All professionals
      </Link>
      <QueryState query={query}>
        {({ worker: w }) => (
          <>
            <div className="profile-hero">
              <Avatar person={w} src={w.profileImage?.url} size="huge" />
              <div>
                <p className="eyebrow">YOUR LOCAL PROFESSIONAL</p>
                <h1>{displayName(w)}</h1>
                <p className="profile-profession">{w.professionTitle}</p>
                <div className="row wrap">
                  {w.verificationSummary.badges.map((b) => (
                    <Badge key={b}>{b}</Badge>
                  ))}
                  {w.availableNow && (
                    <span className="chip approved">Available now</span>
                  )}
                </div>
              </div>
              <div className="profile-cta">
                <ArrowButton
                  state={
                    !user
                      ? { from: '/app/proposals/new?worker=' + id }
                      : undefined
                  }
                  to={
                    user?.role === 'CUSTOMER'
                      ? '/app/proposals/new?worker=' + id
                      : '/login'
                  }
                >
                  Request a service
                </ArrowButton>
                <small>
                  Send a proposal. Your professional accepts before booking.
                </small>
              </div>
            </div>
            <div className="stats-grid three">
              <Stat
                icon={Star}
                label="Customer rating"
                value={
                  w.reviewCount
                    ? Number(w.averageRating).toFixed(1)
                    : 'New professional'
                }
              />
              <Stat
                icon={Users}
                label="Verified reviews"
                value={w.reviewCount}
              />
              <Stat
                icon={CalendarCheck}
                label="Completed jobs"
                value={w.completedJobsCount}
              />
            </div>
            <div className="two-grid profile-details">
              <div className="stack">
                <Panel title="A little about my work">
                  <p className="prose">{w.bio}</p>
                  <p className="muted">
                    {w.yearsOfExperience} years of experience
                  </p>
                  <div className="tags">
                    {w.skills.map((s) => (
                      <span key={s}>{s}</span>
                    ))}
                  </div>
                </Panel>
                <Panel title="Services & pricing">
                  {w.services.map((s) => (
                    <div className="list-row" key={s.id}>
                      <div>
                        <strong>{s.name}</strong>
                        <p className="muted small">{s.description}</p>
                      </div>
                      <span>
                        {pricing(w.pricing.find((p) => p.service === s.id))}
                      </span>
                    </div>
                  ))}
                </Panel>
                <Panel title="A look at my work">
                  {w.portfolio.length ? (
                    <div className="portfolio-grid">
                      {w.portfolio.map((p) => (
                        <figure key={p.id}>
                          {p.media?.url && (
                            <img
                              src={p.media.url}
                              alt={p.title}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          <figcaption>
                            <strong>{p.title}</strong>
                            <p className="muted small">{p.description}</p>
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title="More work to share soon"
                      description="This professional has not added portfolio photos yet."
                    />
                  )}
                </Panel>
              </div>
              <div className="stack">
                <Panel title="Where I work">
                  <div className="area-list">
                    {w.serviceAreas.map((a, i) => (
                      <p key={i}>
                        <MapPin size={17} />
                        {a.name}
                        {a.region ? ', ' + a.region : ''}
                      </p>
                    ))}
                  </div>
                  <Notice>
                    Exact location stays private. Send your preferred time in a
                    service proposal; the professional confirms availability.
                  </Notice>
                </Panel>
                <Panel title="Reviews from completed jobs">
                  <QueryState query={reviews}>
                    {(data) => (
                      <>
                        {data.reviews.length ? (
                          data.reviews.map((r) => (
                            <article className="review" key={r.id}>
                              <span className="rating">
                                <Star size={15} fill="currentColor" />
                                {r.rating} / 5
                              </span>
                              <p>
                                {r.comment || 'Completed SkillLink service'}
                              </p>
                              <small className="muted">
                                Verified booking · {date(r.createdAt)}
                              </small>
                            </article>
                          ))
                        ) : (
                          <Empty
                            title="Their story is just beginning"
                            description="Genuine reviews appear after completed bookings."
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
              </div>
            </div>
          </>
        )}
      </QueryState>
    </div>
  );
}
export function HowItWorks() {
  return (
    <>
      <div className="container section compact">
        <PageTitle
          eyebrow="LET’S MAKE IT HAPPEN"
          title="Your project. Your way."
          description="Find a professional yourself, or post a job and compare quotes from relevant professionals."
        />
      </div>
      <HowSection />
      <div className="container section two-grid">
        <Panel title="Find a professional">
          <Search size={30} />
          <p className="prose">
            Explore services, view profiles and send a direct service proposal
            with your preferred schedule and budget. Your professional accepts
            before a booking is created.
          </p>
          <ArrowButton to="/professionals">Explore professionals</ArrowButton>
        </Panel>
        <Panel title="Let the quotes come to you">
          <BriefcaseBusiness size={30} />
          <p className="prose">
            Describe your job and service area. Eligible professionals can
            submit quotes. Compare offers, accept your choice, then arrange the
            booking.
          </p>
          <ArrowButton to="/app/jobs/new">Post your job</ArrowButton>
        </Panel>
      </div>
    </>
  );
}
export function Information() {
  const location = window.location.pathname;
  return (
    <div className="container section narrow">
      <PageTitle
        eyebrow="THE SKILLLINK GUIDE"
        title={
          location === '/privacy'
            ? 'Your privacy matters.'
            : location === '/terms'
              ? 'A clear understanding.'
              : 'A helping hand, when you need it.'
        }
      />
      <Panel
        title={
          location === '/privacy'
            ? 'Keep the important things private'
            : location === '/terms'
              ? 'About this V1 demonstration'
              : 'Getting the most out of SkillLink'
        }
      >
        <p className="prose">
          SkillLink connects customers and local professionals in The Gambia.
          Use profiles, evidence-backed verification and completed-booking
          reviews to make your own informed choice.
        </p>
        <h3>Communication & privacy</h3>
        <p className="prose">
          Keep conversations in SkillLink. Identity documents are private.
          Precise customer booking locations are shared only at the appropriate
          confirmed booking stage.
        </p>
        <h3>Payments in this demonstration</h3>
        <p className="prose">
          All checkout and earnings are simulated. No real money is collected,
          held, released or withdrawn. No payment card or bank details are
          needed.
        </p>
        <h3>When something needs attention</h3>
        <p className="prose">
          Open the paid active booking and use “Report a problem” to submit a
          dispute. Administrators can review it and simulate a release or
          refund. Do not confirm completion until you are satisfied with the
          work.
        </p>
        <Notice>
          This page explains the current demonstration. Formal operating terms,
          privacy notices, retention policies and support contact information
          must be supplied by the platform operator before a public launch.
        </Notice>
        <Button to="/how-it-works" variant="secondary">
          See how it works
          <ArrowRight size={17} />
        </Button>
      </Panel>
    </div>
  );
}
