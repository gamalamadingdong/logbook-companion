import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { useAuth } from './hooks/useAuth';
import { Login } from './pages/Login';
import { Callback } from './pages/Callback';
import { Dashboard } from './pages/Dashboard';
import { Sync } from './pages/Sync';
import { Analytics } from './pages/Analytics';
import { WorkoutDetail } from './pages/WorkoutDetail';
import { WorkoutHistory } from './pages/WorkoutHistory';
import { WorkoutComparison } from './pages/WorkoutComparison';
import { Preferences } from './pages/Preferences';

import { Layout } from './components/Layout';
import { AutoSync } from './components/AutoSync';

// ... (previous imports)

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-emerald-500">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <AuthProvider>
      <AutoSync />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/callback" element={<Callback />} />
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
        </Routes>
      </BrowserRouter>
    </AuthProvider >
  );
}

export default App;
