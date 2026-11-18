import { ArrowUpRight } from 'lucide-react';
import { useAuth } from '../api/auth';
import {
  PageTitle,
  Panel,
  Chip,
  AccountAvatar,
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
        title="My account"
        description="Your name, contact details and sign-in settings."
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
        </Panel>
        <Panel title="Sign-in settings">
          <p className="prose">
            You stay signed in when you refresh the page. Signing out clears
            your saved sign-in details.
          </p>
          <Button variant="outline" onClick={() => logout()}>
            Sign out of this session
          </Button>
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
