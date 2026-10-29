import { ArrowUpRight } from 'lucide-react';
import { useAuth } from '../api/auth';
import {
  PageTitle,
  Panel,
  Chip,
  AccountAvatar,
  Notice,
  Button,
} from '../components/ui';
import { title } from '../utils/format';
import { RoleDashboard } from './dashboard-overview';
export function Dashboard() {
  return <RoleDashboard />;
}
export function Account() {
  const { user, logout } = useAuth();
  return (
    <>
      <PageTitle
        eyebrow="YOUR ACCOUNT"
        title="The person behind the projects."
        description="Your account details and session controls."
      />
      <div className="two-grid">
        <Panel title="Personal information">
          <div className="row">
            <AccountAvatar person={user} size="large" />
            <div>
              <h3>
                {user.firstName} {user.lastName}
              </h3>
              <Chip status={user.accountStatus} />
            </div>
          </div>
          <dl className="details">
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{user.phoneNumber}</dd>
            </div>
            <div>
              <dt>Account type</dt>
              <dd>
                {user.role === 'WORKER' ? 'Professional' : title(user.role)}
              </dd>
            </div>
          </dl>
          <Notice>
            Personal account editing is not available in this version.
            Professionals can edit their separate professional profile.
          </Notice>
        </Panel>
        <Panel title="Security & session">
          <p className="prose">
            Your session credentials are held only in this tab’s memory. Closing
            or reloading the page signs you out. Signing out here revokes the
            current server session.
          </p>
          <Button variant="outline" onClick={() => logout()}>
            Sign out of this session
          </Button>
          <hr />
          <h3>Account verification</h3>
          <p className="muted">
            Email/phone OTP and password recovery are not connected yet.
            Professional identity verification remains available separately.
          </p>
          {user.role === 'WORKER' && (
            <Button to="/work/profile/verification" variant="secondary">
              Professional verification
              <ArrowUpRight size={17} />
            </Button>
          )}
        </Panel>
      </div>
    </>
  );
}
