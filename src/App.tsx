import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { useAuth } from './hooks/useAuth';
import { ThemeProvider, useTheme } from './hooks/useTheme';
import { CoachingProvider } from './contexts/CoachingContext';

import { Layout } from './components/Layout';
import { AutoSync } from './components/AutoSync';
import { NotificationProvider } from './components/NotificationProvider';
import { Toaster } from 'sonner';

const lazyNamed = (
  loader: () => Promise<Record<string, unknown>>,
  exportName: string,
) => lazy(async () => ({
  default: (await loader())[exportName] as React.ComponentType,
}));

const Login = lazyNamed(() => import('./pages/Login'), 'Login');
const AuthBootstrap = lazyNamed(() => import('./pages/AuthBootstrap'), 'AuthBootstrap');
const AuthCallback = lazyNamed(() => import('./pages/AuthCallback'), 'AuthCallback');
const AuthConfirm = lazyNamed(() => import('./pages/AuthConfirm'), 'AuthConfirm');
const Callback = lazyNamed(() => import('./pages/Callback'), 'Callback');
const PublicAssignmentResultsShare = lazyNamed(() => import('./pages/PublicAssignmentResultsShare'), 'PublicAssignmentResultsShare');
const PublicTeamLeaderboardShare = lazyNamed(() => import('./pages/PublicTeamLeaderboardShare'), 'PublicTeamLeaderboardShare');
const About = lazyNamed(() => import('./pages/About'), 'About');
const Dashboard = lazyNamed(() => import('./pages/Dashboard'), 'Dashboard');
const Sync = lazyNamed(() => import('./pages/Sync'), 'Sync');
const Analytics = lazyNamed(() => import('./pages/Analytics'), 'Analytics');
const WorkoutDetail = lazyNamed(() => import('./pages/WorkoutDetail'), 'WorkoutDetail');
const Preferences = lazyNamed(() => import('./pages/Preferences'), 'Preferences');
const WorkoutHistory = lazyNamed(() => import('./pages/WorkoutHistory'), 'WorkoutHistory');
const WorkoutComparison = lazyNamed(() => import('./pages/WorkoutComparison'), 'WorkoutComparison');
const Feedback = lazyNamed(() => import('./pages/Feedback'), 'Feedback');
const RequestCoachingAccess = lazyNamed(() => import('./pages/coaching/RequestCoachingAccess'), 'RequestCoachingAccess');
const CoachDashboard = lazyNamed(() => import('./pages/coaching/CoachDashboard'), 'CoachDashboard');
const CoachSessions = lazyNamed(() => import('./pages/CoachSessions'), 'CoachSessions');
const CoachingRoster = lazyNamed(() => import('./pages/coaching/CoachingRoster'), 'CoachingRoster');
const CoachingAthleteDetail = lazyNamed(() => import('./pages/coaching/CoachingAthleteDetail'), 'CoachingAthleteDetail');
const CoachingSchedule = lazyNamed(() => import('./pages/coaching/CoachingSchedule'), 'CoachingSchedule');
const CoachingAssignments = lazyNamed(() => import('./pages/coaching/CoachingAssignments'), 'CoachingAssignments');
const AssignmentResults = lazyNamed(() => import('./pages/coaching/AssignmentResults'), 'AssignmentResults');
const CoachingBoatings = lazyNamed(() => import('./pages/coaching/CoachingBoatings'), 'CoachingBoatings');
const TeamAnalytics = lazyNamed(() => import('./pages/coaching/TeamAnalytics'), 'TeamAnalytics');
const TeamSetup = lazyNamed(() => import('./pages/coaching/TeamSetup'), 'TeamSetup');
const CoachingSettings = lazyNamed(() => import('./pages/coaching/CoachingSettings'), 'CoachingSettings');
const TemplateLibrary = lazyNamed(() => import('./pages/TemplateLibrary'), 'TemplateLibrary');
const TemplateDetail = lazyNamed(() => import('./pages/TemplateDetail'), 'TemplateDetail');
const TemplateProposalPage = lazyNamed(() => import('./pages/TemplateProposalPage'), 'TemplateProposalPage');
const TemplateProposalReview = lazyNamed(() => import('./pages/TemplateProposalReview'), 'TemplateProposalReview');
const SupportWorkLibrary = lazyNamed(() => import('./pages/SupportWorkLibrary'), 'SupportWorkLibrary');
const Documentation = lazyNamed(() => import('./pages/Documentation'), 'Documentation');
const DownloadC2Data = lazy(() => import('./pages/DownloadC2Data'));
const ResetPassword = lazyNamed(() => import('./pages/ResetPassword'), 'ResetPassword');
const JoinTeam = lazyNamed(() => import('./pages/JoinTeam'), 'JoinTeam');
const MyTeamDashboard = lazyNamed(() => import('./pages/team/MyTeamDashboard'), 'MyTeamDashboard');
const MyScores = lazyNamed(() => import('./pages/team/MyScores'), 'MyScores');
const MyTeamNotes = lazyNamed(() => import('./pages/team/MyTeamNotes'), 'MyTeamNotes');
const MyTeamSettings = lazyNamed(() => import('./pages/team/MyTeamSettings'), 'MyTeamSettings');
const TrainingBlock = lazyNamed(() => import('./pages/TrainingBlock'), 'TrainingBlock');
const NotFound = lazyNamed(() => import('./pages/NotFound'), 'NotFound');

const RouteLoadingScreen: React.FC = () => (
  <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-400">
    Loading...
  </div>
);

// ... (previous imports)

/** Redirect old /coaching/* routes to /team-management/* preserving sub-path */
function CoachingRedirect() {
  const location = useLocation();
  const newPath = location.pathname.replace('/coaching', '/team-management') + location.search + location.hash;
  return <Navigate to={newPath} replace />;
}

/** Redirect old /templates/* routes to /library/* preserving sub-path */
function TemplateRedirect() {
  const location = useLocation();
  const newPath = location.pathname.replace('/templates', '/library') + location.search + location.hash;
  return <Navigate to={newPath} replace />;
}

/** Loading screen with escape hatch for stuck sessions */
const AuthLoadingScreen: React.FC = () => {
  const { clearStaleSession } = useAuth();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowHelp(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-emerald-500 gap-4">
      <div className="animate-pulse">Loading...</div>
      {showHelp && (
        <button
          onClick={clearStaleSession}
          className="text-sm text-neutral-400 hover:text-emerald-400 underline transition-colors"
        >
          Trouble signing in? Click here to reset your session.
        </button>
      )}
    </div>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }
  return <Layout>{children}</Layout>;
};

const CoachRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, profileLoading, isCoach } = useAuth();
  const location = useLocation();

  if (loading || (profileLoading && !isCoach)) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (!isCoach) {
    return <Navigate to="/team-management/request-access" replace />;
  }

  return <Layout>{children}</Layout>;
};

const AppContent: React.FC = () => {
    const { resolvedTheme } = useTheme();

    return (
        <>
            <AutoSync />
            <Toaster position="top-center" richColors theme={resolvedTheme} toastOptions={{ style: { marginTop: '0.5rem' } }} />
            <BrowserRouter>
              <CoachingProvider>
                <Suspense fallback={<RouteLoadingScreen />}><Routes>
          <Route path="/login" element={<Login />} />
                  <Route path="/auth/bootstrap" element={<AuthBootstrap />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/auth/confirm" element={<AuthConfirm />} />
          <Route path="/callback" element={<Callback />} />
          <Route path="/share/assignment-results/:shareToken" element={<PublicAssignmentResultsShare />} />
          <Route path="/share/team-leaderboard/:shareToken" element={<PublicTeamLeaderboardShare />} />
          <Route path="/about" element={<About />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sync"
            element={
              <ProtectedRoute>
                <Sync />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <Analytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workout/:id"
            element={
              <ProtectedRoute>
                <WorkoutDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/preferences"
            element={
              <ProtectedRoute>
                <Preferences />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history/:name"
            element={
              <ProtectedRoute>
                <WorkoutHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/compare/:aId/:bId?"
            element={
              <ProtectedRoute>
                {/* Lazy load or direct import comparison page */}
                <WorkoutComparison />
              </ProtectedRoute>
            }
          />
          <Route
            path="/feedback"
            element={
              <ProtectedRoute>
                <Feedback />
              </ProtectedRoute>
            }
          />
          <Route
            path="/live"
            element={<Navigate to="/team-management/live" replace />}
          />
          {/* Coaching access request (no coach role required) */}
          <Route
            path="/team-management/request-access"
            element={
              <ProtectedRoute>
                <RequestCoachingAccess />
              </ProtectedRoute>
            }
          />
          {/* Team Management Routes (coach role required) */}
          <Route
            path="/team-management"
            element={
              <CoachRoute>
                <CoachDashboard />
              </CoachRoute>
            }
          />
          <Route
            path="/team-management/live"
            element={
              <CoachRoute>
                <CoachSessions />
              </CoachRoute>
            }
          />
          <Route
            path="/team-management/roster"
            element={
              <CoachRoute>
                <CoachingRoster />
              </CoachRoute>
            }
          />
          <Route
            path="/team-management/roster/:athleteId"
            element={
              <CoachRoute>
                <CoachingAthleteDetail />
              </CoachRoute>
            }
          />
          <Route
            path="/team-management/schedule"
            element={
              <CoachRoute>
                <CoachingSchedule />
              </CoachRoute>
            }
          />
          <Route
            path="/team-management/log"
            element={<Navigate to="/team-management/schedule" replace />}
          />
          <Route
            path="/team-management/assignments"
            element={
              <CoachRoute>
                <CoachingAssignments />
              </CoachRoute>
            }
          />
          <Route
            path="/team-management/assignments/:assignmentId/results"
            element={
              <CoachRoute>
                <AssignmentResults />
              </CoachRoute>
            }
          />
          <Route
            path="/team-management/boatings"
            element={
              <CoachRoute>
                <CoachingBoatings />
              </CoachRoute>
            }
          />
          <Route
            path="/team-management/analytics"
            element={
              <CoachRoute>
                <TeamAnalytics />
              </CoachRoute>
            }
          />
          <Route
            path="/team-management/setup"
            element={
              <CoachRoute>
                <TeamSetup />
              </CoachRoute>
            }
          />
          <Route
            path="/team-management/settings"
            element={
              <CoachRoute>
                <CoachingSettings />
              </CoachRoute>
            }
          />
          {/* Redirect old /coaching/* URLs → /team-management/* */}
          <Route
            path="/coaching/*"
            element={<CoachingRedirect />}
          />
          <Route
            path="/library"
            element={
              <Layout>
                <TemplateLibrary />
              </Layout>
            }
          />
          <Route
            path="/library/:templateId"
            element={
              <Layout>
                <TemplateDetail />
              </Layout>
            }
          />
          <Route
            path="/library/propose"
            element={
              <Layout>
                <TemplateProposalPage />
              </Layout>
            }
          />
          <Route
            path="/library/review"
            element={
              <ProtectedRoute>
                <TemplateProposalReview />
              </ProtectedRoute>
            }
          />
          <Route
            path="/library/:templateId/edit"
            element={
              <ProtectedRoute>
                <TemplateDetail />
              </ProtectedRoute>
            }
          />
          <Route path="/templates/*" element={<TemplateRedirect />} />
          <Route path="/workout-library" element={<Navigate to="/library" replace />} />
          <Route
            path="/support-work"
            element={
              <ProtectedRoute>
                <SupportWorkLibrary />
              </ProtectedRoute>
            }
          />
          <Route
            path="/docs"
            element={
              <Layout>
                <Documentation />
              </Layout>
            }
          />
          <Route
            path="/download-c2-data"
            element={
              <ProtectedRoute>
                <DownloadC2Data />
              </ProtectedRoute>
            }
          />
          <Route
            path="/training-block"
            element={
              <ProtectedRoute>
                <TrainingBlock />
              </ProtectedRoute>
            }
          />
          <Route
            path="/team-management/training-block"
            element={<Navigate to="/team-management/assignments" replace />}
          />
          <Route
            path="/team/training-block"
            element={<Navigate to="/training-block" replace />}
          />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/join"
            element={
              <ProtectedRoute>
                <JoinTeam />
              </ProtectedRoute>
            }
          />
          <Route
            path="/team"
            element={
              <ProtectedRoute>
                <Layout>
                  <MyTeamDashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/team/scores"
            element={
              <ProtectedRoute>
                <Layout>
                  <MyScores />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/team/notes"
            element={
              <ProtectedRoute>
                <Layout>
                  <MyTeamNotes />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/team/settings"
            element={
              <ProtectedRoute>
                <Layout>
                  <MyTeamSettings />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="*"
            element={
              <Layout>
                <NotFound />
              </Layout>
            }
          />
        </Routes></Suspense>
              </CoachingProvider>
      </BrowserRouter>
    </>
    );
};

function App() {
    return (
        <AuthProvider>
            <ThemeProvider>
                <NotificationProvider>
                    <AppContent />
                </NotificationProvider>
            </ThemeProvider>
        </AuthProvider >
    );
}

export default App;
