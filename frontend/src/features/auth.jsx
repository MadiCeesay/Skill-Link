import { useState } from 'react';
import {
  Link,
  useNavigate,
  useLocation,
  useParams,
  Navigate,
} from 'react-router-dom';
import {
  ArrowUpRight,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import {
  Brand,
  Button,
  Field,
  ErrorNotice,
  Panel,
  PageTitle,
} from '../components/ui';
import { useAuth } from '../api/auth';
import { api } from '../api/client';
import { homeFor } from '../utils/policy';
export function AuthPage() {
  const { kind } = useParams(),
    register = !!kind,
    { user, login } = useAuth(),
    navigate = useNavigate(),
    location = useLocation();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [show, setShow] = useState(false),
    [created, setCreated] = useState(false);
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  if (register && !['customer', 'worker'].includes(kind))
    return <Navigate to="/register/customer" replace />;
  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (register) {
        if (new TextEncoder().encode(values.password).length > 72)
          throw Error('Your password must be no more than 72 UTF-8 bytes.');
        await api('/auth/register/' + kind, { method: 'POST', body: values });
        setCreated(true);
      }
      const person = await login({
        email: values.email,
        password: values.password,
      });
      const from = location.state?.from;
      const target =
        from?.startsWith('/') &&
        !from.startsWith('//') &&
        !from.startsWith('/login')
          ? from
          : person.role === 'WORKER' && register
            ? '/work/profile'
            : homeFor(person.role);
      navigate(target, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div>
          <p className="eyebrow">GOOD WORK STARTS WITH A CONNECTION</p>
          <h1>
            {register && kind === 'worker' ? (
              <>
                Find work.
                <br />
                Manage your bookings.
              </>
            ) : (
              <>
                Find a worker.
                <br />Get the work done.
              </>
            )}
          </h1>
          <p>
            Find local workers, agree a price and keep track of your bookings.
          </p>
          <div className="auth-story-points">
            <span>
              <ShieldCheck />
              Worker identity checks
            </span>
            <span>
              <CheckCircle2 />
              Reviews from completed jobs
            </span>
          </div>
        </div>
        <small>SkillLink · Services in The Gambia</small>
      </section>
      <main className="auth-main" id="main">
        <Link to="/" className="back-link">
          <ArrowLeft size={16} /> Back to SkillLink
        </Link>
        <div className="auth-card">
          <p className="eyebrow">
            {register ? 'LET’S GET YOU STARTED' : 'WELCOME BACK'}
          </p>
          <h1>
            {register
              ? kind === 'worker'
                ? 'Create a worker account'
                : 'Create a customer account'
              : 'Sign in'}
          </h1>
          <p className="muted">
            {register
              ? 'Create your ' +
                (kind === 'worker' ? 'professional' : 'customer') +
                ' account.'
              : 'Enter your email and password.'}
          </p>
          {register && (
            <div className="segmented">
              <Link
                to="/register/customer"
                className={kind === 'customer' ? 'active' : ''}
              >
                I need a professional
              </Link>
              <Link
                to="/register/worker"
                className={kind === 'worker' ? 'active' : ''}
              >
                I’m a professional
              </Link>
            </div>
          )}
          <form onSubmit={submit} className="form-stack" key={kind || 'login'}>
            {register && (
              <div className="two-grid">
                <Field
                  label="First name"
                  name="firstName"
                  autoComplete="given-name"
                  required
                  maxLength={80}
                />
                <Field
                  label="Last name"
                  name="lastName"
                  autoComplete="family-name"
                  required
                  maxLength={80}
                />
              </div>
            )}
            <Field
              label="Email address"
              type="email"
              name="email"
              autoComplete="email"
              required
              maxLength={254}
            />
            {register && (
              <Field
                label="Phone number"
                name="phoneNumber"
                type="tel"
                autoComplete="tel"
                required
                placeholder="+220 700 0000"
                hint="Use your international phone number."
              />
            )}
            <div className="password-field">
              <Field
                label="Password"
                name="password"
                type={show ? 'text' : 'password'}
                autoComplete={register ? 'new-password' : 'current-password'}
                required
                minLength={register ? 8 : 1}
                maxLength={72}
                pattern={
                  register
                    ? '(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,}'
                    : undefined
                }
                hint={
                  register
                    ? 'At least 8 characters, including uppercase, lowercase and a number.'
                    : undefined
                }
              />
              <button
                type="button"
                className="icon-button"
                aria-label={show ? 'Hide password' : 'Show password'}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {error && <ErrorNotice error={error} />}
            <Button type="submit" disabled={busy}>
              {busy
                ? created
                  ? 'Signing you in…'
                  : 'Please wait…'
                : register
                  ? 'Create account'
                  : 'Sign in'}
              <ArrowUpRight size={18} />
            </Button>
          </form>
          <p className="small muted">
            {register ? (
              <>
                Already with us? <Link to="/login">Sign in</Link>
              </>
            ) : (
              <>
                New to SkillLink?{' '}
                <Link to="/register/customer">Create an account</Link>
              </>
            )}
          </p>
          {register && (
            <p className="small muted">
              <Link to="/terms">Terms of use</Link>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
export function AccountGap() {
  const path = window.location.pathname;
  return (
    <div className="container section narrow">
      <PageTitle
        title={
          path.includes('password')
            ? 'Forgot password?'
            : 'Account verification'
        }
      />
      <Panel
        title={
          path.includes('password')
            ? 'Sign in to your account'
            : 'Email and phone verification'
        }
      >
        <p className="prose">
          Use your current email and password to sign in.
        </p>
        <Button to="/login">Back to sign in</Button>
      </Panel>
    </div>
  );
}
