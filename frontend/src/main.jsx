import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, Guard, useAuth } from './api/auth';
import { RealtimeProvider } from './api/realtime';
import { PublicLayout, WorkspaceLayout } from './layouts/Layouts';
import { Boundary, Skeleton, Toasts, Empty, Button } from './components/ui';
import { homeFor } from './utils/policy';
import './styles/app.css';
const page = (loader, name) =>
  lazy(() => loader().then((m) => ({ default: m[name] })));
const Home = page(() => import('./features/public'), 'Home'),
  Services = page(() => import('./features/public'), 'Services'),
  Discovery = page(() => import('./features/public'), 'Discovery'),
  WorkerProfile = page(() => import('./features/public'), 'WorkerProfile'),
  HowItWorks = page(() => import('./features/public'), 'HowItWorks'),
  Information = page(() => import('./features/public'), 'Information');
const AuthPage = page(() => import('./features/auth'), 'AuthPage'),
  AccountGap = page(() => import('./features/auth'), 'AccountGap'),
  Dashboard = page(() => import('./features/dashboard'), 'Dashboard'),
  Account = page(() => import('./features/dashboard'), 'Account');
const Jobs = page(() => import('./features/jobs'), 'Jobs'),
  JobEditor = page(() => import('./features/jobs'), 'JobEditor'),
  JobDetails = page(() => import('./features/jobs'), 'JobDetails'),
  Quotes = page(() => import('./features/jobs'), 'Quotes'),
  QuoteDetails = page(() => import('./features/jobs'), 'QuoteDetails');
const Bookings = page(() => import('./features/bookings'), 'Bookings'),
  BookingDetails = page(() => import('./features/bookings'), 'BookingDetails'),
  ProposalCreate = page(() => import('./features/proposals'), 'ProposalCreate'),
  Proposals = page(() => import('./features/proposals'), 'Proposals'),
  Payment = page(() => import('./features/bookings'), 'Payment'),
  PaymentRedirect = page(() => import('./features/bookings'), 'PaymentRedirect'),
  ReportProblem = page(() => import('./features/bookings'), 'ReportProblem'),
  Dispute = page(() => import('./features/bookings'), 'Dispute');
const ProfessionalWorkspace = page(
    () => import('./features/worker'),
    'ProfessionalWorkspace',
  ),
  Availability = page(() => import('./features/worker'), 'Availability'),
  Earnings = page(() => import('./features/worker'), 'Earnings'),
  Messages = page(() => import('./features/messaging'), 'Messages'),
  Notifications = page(
    () => import('./features/notifications'),
    'Notifications',
  );
const AdminDashboard = page(() => import('./features/admin'), 'AdminDashboard'),
  AdminUsers = page(() => import('./features/admin'), 'AdminUsers'),
  AdminWorker = page(() => import('./features/admin'), 'AdminWorker'),
  AdminVerifications = page(
    () => import('./features/admin'),
    'AdminVerifications',
  ),
  VerificationReview = page(
    () => import('./features/admin'),
    'VerificationReview',
  ),
  AdminCatalog = page(() => import('./features/admin'), 'AdminCatalog'),
  AdminRecords = page(() => import('./features/admin'), 'AdminRecords'),
  AdminRecord = page(() => import('./features/admin'), 'AdminRecord'),
  AdminGap = page(() => import('./features/admin'), 'AdminGap');
export function AppRoutes() {
  return (
    <Suspense
      fallback={
        <div className="container section">
          <Skeleton rows={4} />
        </div>
      }
    >
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="services" element={<Services />} />
          <Route path="professionals" element={<Discovery />} />
          <Route path="professionals/:id" element={<WorkerProfile />} />
          <Route path="how-it-works" element={<HowItWorks />} />
          {['help', 'privacy', 'terms'].map((p) => (
            <Route key={p} path={p} element={<Information />} />
          ))}
          {['forgot-password', 'reset-password', 'account-verification'].map(
            (p) => (
              <Route key={p} path={p} element={<AccountGap />} />
            ),
          )}
        </Route>
        <Route path="login" element={<AuthPage />} />
        <Route path="register/:kind" element={<AuthPage />} />
        <Route
          path="register"
          element={<Navigate to="/register/customer" replace />}
        />
        <Route
          path="app"
          element={
            <Guard roles={['CUSTOMER']}>
              <WorkspaceLayout />
            </Guard>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="jobs/new" element={<JobEditor />} />
          <Route path="jobs/:id" element={<JobDetails />} />
          <Route path="jobs/:id/edit" element={<JobEditor />} />
          <Route path="proposals" element={<Proposals />} />
          <Route path="proposals/new" element={<ProposalCreate />} />
          {sharedRoutes()}
          <Route path="bookings/:id/problem" element={<ReportProblem />} />
          <Route path="profile" element={<Account />} />
        </Route>
        <Route
          path="work"
          element={
            <Guard roles={['WORKER']}>
              <WorkspaceLayout />
            </Guard>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="opportunities" element={<Jobs />} />
          <Route path="opportunities/:id" element={<JobDetails />} />
          <Route path="quotes" element={<Quotes />} />
          <Route path="quotes/:id" element={<QuoteDetails />} />
          <Route path="proposals" element={<Proposals />} />
          <Route path="profile/:tab?" element={<ProfessionalWorkspace />} />
          <Route path="availability" element={<Availability />} />
          <Route path="earnings" element={<Earnings />} />
          {sharedRoutes()}
        </Route>
        <Route
          path="admin"
          element={
            <Guard roles={['ADMIN']}>
              <WorkspaceLayout />
            </Guard>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="workers/:id" element={<AdminWorker />} />
          <Route path="verifications" element={<AdminVerifications />} />
          <Route path="verifications/:id" element={<VerificationReview />} />
          <Route path="catalog" element={<AdminCatalog />} />
          {['bookings', 'payments', 'ledger', 'disputes', 'reviews'].map(
            (p) => (
              <Route key={p} path={p} element={<AdminRecords />} />
            ),
          )}
          {['bookings', 'payments', 'disputes'].map((p) => (
            <Route key={p} path={p + '/:id'} element={<AdminRecord />} />
          ))}
          <Route path="jobs" element={<AdminGap />} />
          <Route path="audit" element={<AdminGap />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Account />} />
        </Route>
        <Route path="workspace" element={<WorkspaceRedirect />} />
        <Route
          path="*"
          element={
            <div className="container section">
              <Empty
                title="A different path might help"
                description="This page doesn’t exist. Let’s get you back to SkillLink."
                action={<Button to="/">Back home</Button>}
              />
            </div>
          }
        />
      </Routes>
    </Suspense>
  );
}
function sharedRoutes() {
  return (
    <>
      <Route path="bookings" element={<Bookings />} />
      <Route path="bookings/:id" element={<BookingDetails />} />
      <Route path="bookings/:id/payment" element={<Payment />} />
      <Route path="payments/:id" element={<PaymentRedirect />} />
      <Route path="messages/:id?" element={<Messages />} />
      <Route path="notifications" element={<Notifications />} />
      <Route path="disputes/:id" element={<Dispute />} />
    </>
  );
}
function WorkspaceRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />;
}
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: false },
    mutations: { retry: false },
  },
});
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Boundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RealtimeProvider>
            <BrowserRouter>
              <AppRoutes />
              <Toasts />
            </BrowserRouter>
          </RealtimeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </Boundary>
  </React.StrictMode>,
);
