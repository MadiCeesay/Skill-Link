import { useState, useEffect } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  Home,
  Search,
  BriefcaseBusiness,
  CalendarDays,
  MessageSquare,
  Bell,
  UserRound,
  Menu,
  X,
  LogOut,
  ArrowUpRight,
  LayoutDashboard,
  Clock3,
  Wallet,
  ShieldCheck,
  Users,
  Layers,
  Scale,
  Star,
  ChevronRight,
  Plus,
  FileClock,
} from 'lucide-react';
import { Brand, Button, AccountAvatar } from '../components/ui';
import { useAuth } from '../api/auth';
import { useApi } from '../api/hooks';
import { homeFor } from '../utils/policy';
import { date } from '../utils/format';
import '../styles/dashboard.css';
export function PublicLayout() {
  const [open, setOpen] = useState(false),
    { user } = useAuth(),
    location = useLocation();
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="public-header">
        <div className="container nav-wrap">
          <Brand />
          <nav
            className={open ? 'public-nav open' : 'public-nav'}
            aria-label="Main navigation"
          >
            <NavLink to="/services">Services</NavLink>
            <NavLink to="/professionals">Find professionals</NavLink>
            <NavLink to="/how-it-works">How it works</NavLink>
            <NavLink to="/register/worker">Become a professional</NavLink>
            <Button to={user ? homeFor(user.role) : '/login'} variant="dark">
              {user ? 'My workspace' : 'Sign in'}
              <ArrowUpRight size={17} />
            </Button>
          </nav>
          <button
            className="icon-button mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Brand />
            <p>
              Good people. Skilled hands.
              <br />A better way to get things done in The Gambia.
            </p>
            <span className="footer-tag">
              Local skills. Lasting connections.
            </span>
          </div>
          <div>
            <h3>Find your professional</h3>
            <Link to="/services">Browse services</Link>
            <Link to="/professionals">Find professionals</Link>
            <Link to="/app/jobs/new">Post a job</Link>
          </div>
          <div>
            <h3>For professionals</h3>
            <Link to="/register/worker">Join SkillLink</Link>
            <Link to="/work/opportunities">Job opportunities</Link>
            <Link to="/how-it-works">How it works</Link>
          </div>
          <div>
            <h3>Here to help</h3>
            <Link to="/help">Help & safety</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms & demo information</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} SkillLink</span>
          <span>Built for better connections.</span>
        </div>
      </div>
    </footer>
  );
}
const customerNav = [
  ['/app', LayoutDashboard, 'Overview'],
  ['/professionals', Search, 'Find professionals'],
  ['/app/jobs', BriefcaseBusiness, 'My jobs'],
  ['/app/proposals', Users, 'Service proposals'],
  ['/app/bookings', CalendarDays, 'Bookings'],
  ['/app/messages', MessageSquare, 'Messages'],
  ['/app/notifications', Bell, 'Notifications'],
  ['/app/profile', UserRound, 'My account'],
];
const workerNav = [
  ['/work', LayoutDashboard, 'Overview'],
  ['/work/opportunities', Search, 'Opportunities'],
  ['/work/quotes', BriefcaseBusiness, 'My quotes'],
  ['/work/proposals', Users, 'Incoming proposals'],
  ['/work/bookings', CalendarDays, 'Bookings'],
  ['/work/messages', MessageSquare, 'Messages'],
  ['/work/availability', Clock3, 'Availability'],
  ['/work/earnings', Wallet, 'Earnings'],
  ['/work/profile', UserRound, 'Professional profile'],
];
const adminNav = [
  ['/admin', LayoutDashboard, 'Overview'],
  ['/admin/users', Users, 'People'],
  ['/admin/verifications', ShieldCheck, 'Verification'],
  ['/admin/catalog', Layers, 'Catalog'],
  ['/admin/jobs', BriefcaseBusiness, 'Jobs'],
  ['/admin/bookings', CalendarDays, 'Bookings'],
  ['/admin/payments', Wallet, 'Payments & ledger'],
  ['/admin/disputes', Scale, 'Disputes'],
  ['/admin/reviews', Star, 'Reviews'],
  ['/admin/audit', FileClock, 'Audit information'],
];
export function WorkspaceLayout() {
  const { user, logout } = useAuth(),
    location = useLocation(),
    navigate = useNavigate(),
    [open, setOpen] = useState(false);
  const base = homeFor(user.role),
    nav =
      user.role === 'ADMIN'
        ? adminNav
        : user.role === 'WORKER'
          ? workerNav
          : customerNav;
  const unread = useApi('/notifications/unread-count', undefined, {
    refetchInterval: 60000,
  });
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const drawer = document.getElementById('workspace-navigation');
    drawer?.querySelector('button')?.focus();
    const keydown = (event) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key === 'Tab') {
        const elements = [...drawer.querySelectorAll('a, button')].filter(
          (el) => el.getClientRects().length && !el.disabled,
        );
        const first = elements[0],
          last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);
  return (
    <div className="workspace">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {open && (
        <button
          className="sidebar-scrim"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside
        id="workspace-navigation"
        className={'sidebar ' + (open ? 'open' : '')}
      >
        <button
          className="drawer-close icon-button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        >
          <X size={18} />
        </button>
        <Brand />
        <div className="workspace-label">
          {user.role === 'ADMIN'
            ? 'Operations'
            : user.role === 'WORKER'
              ? 'Professional workspace'
              : 'Your SkillLink'}
        </div>
        <nav aria-label="Workspace navigation">
          {nav.map(([to, Icon, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === base}
              title={label}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {label === 'Messages' && <ChevronRight size={14} />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <ShieldCheck size={22} />
            <strong>Work with confidence</strong>
            <p>Keep conversations and agreements together.</p>
          </div>
          <Link to="/" className="sidebar-explore">
            <Home size={17} />
            Explore SkillLink
            <ArrowUpRight size={16} />
          </Link>
          <button
            onClick={async () => {
              try {
                await logout();
              } finally {
                navigate('/login');
              }
            }}
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-header">
          <button
            className="icon-button mobile-menu"
            onClick={() => setOpen(!open)}
            aria-label="Open navigation"
            aria-expanded={open}
            aria-controls="workspace-navigation"
          >
            <Menu />
          </button>
          <div className="workspace-welcome">
            <strong>
              {user.role === 'ADMIN'
                ? 'Admin workspace'
                : 'Good to see you, ' + user.firstName + '.'}
            </strong>
            <p className="workspace-breadcrumb">
              Workspace <ChevronRight size={12} />
              <span>
                {nav.find(([to]) => to === location.pathname)?.[2] || 'Details'}
              </span>
            </p>
          </div>
          {user.role !== 'ADMIN' && (
            <form
              className="workspace-search"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                const q = new FormData(e.currentTarget).get('q').trim();
                navigate(
                  '/professionals' + (q ? '?q=' + encodeURIComponent(q) : ''),
                );
              }}
            >
              <Search size={16} />
              <label htmlFor="workspace-search" className="sr-only">
                Search professionals or skills
              </label>
              <input
                id="workspace-search"
                name="q"
                maxLength={80}
                placeholder="Search professionals, skills…"
              />
              <button type="submit" aria-label="Search professionals">
                <ArrowUpRight size={16} />
              </button>
            </form>
          )}
          <div className="header-actions">
            <span className="date-pill">
              <CalendarDays size={16} />
              {date(new Date())}
            </span>
            <Link
              to={base + '/notifications'}
              className="notification-bell"
              aria-label={
                'Notifications' +
                (unread.data?.unreadCount
                  ? ' · ' + unread.data.unreadCount + ' unread'
                  : '')
              }
            >
              <Bell size={20} />
              {!!unread.data?.unreadCount && <i />}
            </Link>
            <Link to={base + '/profile'} className="header-user">
              <AccountAvatar person={user} size="small" />
              <span>
                {user.firstName}
                <small>
                  {user.role === 'WORKER'
                    ? 'Professional'
                    : user.role === 'ADMIN'
                      ? 'Administrator'
                      : 'Customer'}
                </small>
              </span>
            </Link>
          </div>
        </header>
        <main id="main" className="workspace-content">
          <Outlet />
        </main>
        <div className="workspace-footer">
          SkillLink · Made for good work<span>The Gambia · GMD</span>
        </div>
      </div>
      {user.role !== 'ADMIN' && (
        <nav className="bottom-nav" aria-label="Quick navigation">
          {[
            [base, LayoutDashboard, 'Home'],
            [
              base + (user.role === 'WORKER' ? '/opportunities' : '/jobs'),
              user.role === 'WORKER' ? Search : BriefcaseBusiness,
              user.role === 'WORKER' ? 'Jobs' : 'My jobs',
            ],
            [base + '/bookings', CalendarDays, 'Bookings'],
            [base + '/messages', MessageSquare, 'Messages'],
          ].map(([to, Icon, label]) => (
            <NavLink key={to} to={to} end={to === base}>
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
export function WorkspaceLink() {
  const { user } = useAuth();
  return (
    <Button to={user ? homeFor(user.role) : '/login'}>
      Go to your workspace
    </Button>
  );
}
