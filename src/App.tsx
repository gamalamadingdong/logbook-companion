import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { useAuth } from './hooks/useAuth';
import { ThemeProvider, useTheme } from './hooks/useTheme';
import { Login } from './pages/Login';
import { AuthBootstrap } from './pages/AuthBootstrap';
import { Callback } from './pages/Callback';
import { Dashboard } from './pages/Dashboard';
import { Sync } from './pages/Sync';
import { Analytics } from './pages/Analytics';
import { WorkoutDetail } from './pages/WorkoutDetail';
import { WorkoutHistory } from './pages/WorkoutHistory';
import { WorkoutComparison } from './pages/WorkoutComparison';
import { Preferences } from './pages/Preferences';
import { Feedback } from './pages/Feedback';
import { About } from './pages/About';
import { CoachSessions } from './pages/CoachSessions';
import { TemplateLibrary } from './pages/TemplateLibrary';
import { TemplateDetail } from './pages/TemplateDetail';
import { Documentation } from './pages/Documentation';
import DownloadC2Data from './pages/DownloadC2Data';
import { ResetPassword } from './pages/ResetPassword';
import { CoachDashboard } from './pages/coaching/CoachDashboard';
import { CoachingRoster } from './pages/coaching/CoachingRoster';
import { CoachingSchedule } from './pages/coaching/CoachingSchedule';
import { CoachingBoatings } from './pages/coaching/CoachingBoatings';
import { CoachingAthleteDetail } from './pages/coaching/CoachingAthleteDetail';
import { CoachingAssignments } from './pages/coaching/CoachingAssignments';
import { TeamSetup } from './pages/coaching/TeamSetup';
import { TeamAnalytics } from './pages/coaching/TeamAnalytics';
import { CoachingSettings } from './pages/coaching/CoachingSettings';
import { JoinTeam } from './pages/JoinTeam';
import { MyTeamDashboard } from './pages/team/MyTeamDashboard';
import { MyScores } from './pages/team/MyScores';
import { NotFound } from './pages/NotFound';

import { Layout } from './components/Layout';
import { AutoSync } from './components/AutoSync';
import { Toaster } from 'sonner';

// ... (previous imports)

/** Redirect old /coaching/* routes to /team-management/* preserving sub-path */
function CoachingRedirect() {
  const location = useLocation();
  const newPath = location.pathname.replace('/coaching', '/team-management') + location.search + location.hash;
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

  if (loading || profileLoading) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (!isCoach) {
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
};

const AppContent: React.FC = () => {
    const { resolvedTheme } = useTheme();

    return (
        <>
            <AutoSync />
            <Toaster position="top-right" richColors theme={resolvedTheme} />
            <BrowserRouter>
                <Routes>
          <Route path="/login" element={<Login />} />
                  <Route path="/auth/bootstrap" element={<AuthBootstrap />} />
          <Route path="/callback" element={<Callback />} />
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
            path="/templates"
            element={
              <ProtectedRoute>
                <TemplateLibrary />
              </ProtectedRoute>
            }
          />
          <Route
            path="/templates/:templateId"
            element={
              <ProtectedRoute>
                <TemplateDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/templates/:templateId/edit"
            element={
              <ProtectedRoute>
                <TemplateDetail />
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
            path="*"
            element={
              <Layout>
                <NotFound />
              </Layout>
            }
          />
        </Routes>
      </BrowserRouter>
    </>
    );
};

function App() {
    return (
        <AuthProvider>
            <ThemeProvider>
                <AppContent />
            </ThemeProvider>
        </AuthProvider >
    );
}

export default App;
