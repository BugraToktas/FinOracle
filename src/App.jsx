import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Events from './pages/Events'
import EventDetail from './pages/EventDetail'
import NewEvent from './pages/NewEvent'
import CredibilityBoard from './pages/CredibilityBoard'
import Admin from './pages/Admin'
import NotFound from './pages/NotFound'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-fin-bg">
        <div className="w-6 h-6 border-2 border-fin-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { user, loading } = useAuth()

  return (
    <Routes>
      {/* Public */}
      <Route
        path="/"
        element={
          loading
            ? <div className="min-h-screen flex items-center justify-center bg-fin-bg">
                <div className="w-6 h-6 border-2 border-fin-accent border-t-transparent rounded-full animate-spin" />
              </div>
            : user
              ? <Navigate to="/dashboard" replace />
              : <Landing />
        }
      />
      <Route path="/login" element={user && !loading ? <Navigate to="/dashboard" replace /> : <Login />} />

      {/* Protected app shell */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
      </Route>

      {/* Protected flat routes (inside Layout) */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard"   element={<Dashboard />} />
        <Route path="events"      element={<Events />} />
        <Route path="events/:id"  element={<EventDetail />} />
        <Route path="new-event"   element={<NewEvent />} />
        <Route path="credibility" element={<CredibilityBoard />} />
        <Route path="admin"       element={<Admin />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}
