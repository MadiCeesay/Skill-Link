import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, ArrowUpRight } from 'lucide-react';
import { useApi, useAction } from '../api/hooks';
import { useAuth } from '../api/auth';
import {
  PageTitle,
  Panel,
  Button,
  QueryState,
  Empty,
  Pager,
  ErrorNotice,
} from '../components/ui';
import { dateTime, title } from '../utils/format';
import { homeFor } from '../utils/policy';
function target(n, user) {
  const b = homeFor(user.role);
  return n.relatedResourceType === 'Booking'
    ? b + '/bookings/' + n.relatedResourceId
    : n.relatedResourceType === 'Payment'
      ? b + '/payments/' + n.relatedResourceId
    : n.relatedResourceType === 'DirectProposal'
      ? b + '/proposals'
      : n.relatedResourceType === 'Quote'
        ? user.role === 'WORKER'
          ? '/work/quotes/' + n.relatedResourceId
          : '/app/jobs'
        : n.relatedResourceType === 'Message'
          ? b + '/messages'
          : n.relatedResourceType === 'Verification'
            ? '/work/profile/verification'
            : n.relatedResourceType === 'Dispute'
              ? user.role === 'ADMIN'
                ? '/admin/disputes/' + n.relatedResourceId
                : b + '/disputes/' + n.relatedResourceId
              : n.relatedResourceType === 'Review'
                ? '/work/profile/reviews'
                : b;
}
export function Notifications() {
  const { user } = useAuth(),
    [page, setPage] = useState(1),
    query = useApi(
      '/notifications/me',
      { page, limit: 15 },
      { refetchInterval: 60000 },
    ),
    action = useAction();
  return (
    <>
      <PageTitle
        eyebrow="THE LATEST, ALL TOGETHER"
        title="You’re in the loop."
        description="Updates on your projects, conversations and professional connections."
      >
        <Button
          variant="outline"
          disabled={action.isPending}
          onClick={() => action.mutate({ path: '/notifications/read-all' })}
        >
          <CheckCheck size={17} />
          Mark all read
        </Button>
      </PageTitle>
      {action.error && <ErrorNotice error={action.error} />}
      <Panel>
        <QueryState query={query}>
          {(data) => (
            <>
              {data.notifications.length ? (
                data.notifications.map((n) => (
                  <article
                    className={
                      'notification-row ' + (!n.readAt ? 'unread' : '')
                    }
                    key={n.id}
                  >
                    <span className="activity-icon">
                      <Bell size={20} />
                    </span>
                    <div>
                      <h3>{title(n.type)}</h3>
                      <p className="muted">{dateTime(n.createdAt)}</p>
                      <Link
                        className="text-link"
                        to={target(n, user)}
                        onClick={() => {
                          if (!n.readAt)
                            action.mutate({
                              path: '/notifications/' + n.id + '/read',
                            });
                        }}
                      >
                        View update
                        <ArrowUpRight size={15} />
                      </Link>
                    </div>
                    {!n.readAt && (
                      <button
                        className="icon-button"
                        onClick={() =>
                          action.mutate({
                            path: '/notifications/' + n.id + '/read',
                          })
                        }
                        aria-label="Mark notification read"
                      >
                        <CheckCheck size={19} />
                      </button>
                    )}
                  </article>
                ))
              ) : (
                <Empty
                  icon={Bell}
                  title="You’re all caught up"
                  description="Your next SkillLink update will appear here."
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
    </>
  );
}
