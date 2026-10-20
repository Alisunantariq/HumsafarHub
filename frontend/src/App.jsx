import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { authApi } from './api/client.js'
import AuthPage from './components/AuthPage.jsx'
import { PrivacyPolicy, TermsAndConditions } from './components/LegalPage.jsx'
import {
  AddClientPage, AdminDashboard, AdminProfiles, ConsultantDashboard,
  ConsultantHelp, ConsultantMatches, ConsultantProfiles, ConsultantRequests,
  PackageOnboarding, PaymentResult,
} from './components/Workspace.jsx'

const SESSION_KEY = 'hamsafar_api_session'

function readSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null')
    return session?.token && session?.user ? session : null
  } catch {
    return null
  }
}

function destinationFor(session) {
  if (session?.user?.role === 'ADMIN') return '/admin'
  if (session?.user?.subscriptionAccess) return '/consultant'
  return '/consultant/onboarding'
}

function ProtectedRoute({ session, ready, role, children }) {
  if (!ready) return <LoadingScreen />
  if (!session) return <Navigate to="/login" replace />
  if (session.user.role !== role) return <Navigate to={destinationFor(session)} replace />
  return children
}

function ReadyMatchmakerRoute({ session, ready, children }) {
  if (!ready) return <LoadingScreen />
  if (!session) return <Navigate to="/login" replace />
  if (session.user.role !== 'MATCHMAKER') return <Navigate to={destinationFor(session)} replace />
  if (session.user.approvalStatus !== 'APPROVED' ||
      !session.user.subscriptionAccess) {
    return <Navigate to="/consultant" replace />
  }
  return children
}

function LoadingScreen() {
  return <main className="grid min-h-screen place-items-center bg-[#f5f7f4] text-sm font-semibold text-[#718078]">Connecting to your secure workspace…</main>
}

function AppRoutes() {
  const navigate = useNavigate()
  const [session, setSession] = useState(readSession)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    if (!session?.token) {
      setReady(true)
      return undefined
    }
    authApi.me(session.token)
      .then(({ user }) => {
        if (!active) return
        const refreshed = { ...session, user }
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(refreshed))
        setSession(refreshed)
      })
      .catch(() => {
        if (!active) return
        sessionStorage.removeItem(SESSION_KEY)
        setSession(null)
      })
      .finally(() => { if (active) setReady(true) })
    return () => { active = false }
  // Validate a saved access token once when the app starts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function authenticate(role, mode, values) {
    try {
      if (mode === 'signup') {
        if (values.password !== values.confirmPassword) {
          return { error: 'The passwords do not match.' }
        }
        await authApi.register({
          email: values.email,
          password: values.password,
          fullName: values.fullName,
          phoneNumber: values.phoneNumber,
          dateOfBirth: values.dateOfBirth,
          legalAccepted: true,
        })
      }

      const response = await authApi.login({ email: values.email, password: values.password })
      const expectedRole = role === 'admin' ? 'ADMIN' : 'MATCHMAKER'
      if (response.user.role !== expectedRole) {
        return { error: `This account does not have access to the ${role} workspace.` }
      }
      const nextSession = { token: response.token, user: response.user }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession))
      setSession(nextSession)
      setReady(true)
      navigate(destinationFor(nextSession), { replace: true })
      return { success: true }
    } catch (error) {
      return { error: error.message }
    }
  }

  const applyUserUpdate = useCallback((user) => {
    setSession((current) => {
      if (!current) return current
      const refreshed = { ...current, user }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(refreshed))
      return refreshed
    })
  }, [])

  function logout() {
    sessionStorage.removeItem(SESSION_KEY)
    setSession(null)
    navigate('/login', { replace: true })
  }

  if (!ready) return <LoadingScreen />

  return (
    <Routes>
      <Route path="/" element={<Navigate to={session ? destinationFor(session) : '/login'} replace />} />
      <Route path="/terms" element={<TermsAndConditions />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/login" element={session ? <Navigate to={destinationFor(session)} replace /> : <AuthPage onAuthenticate={authenticate} />} />
      <Route path="/payment/result" element={
        <ProtectedRoute session={session} ready={ready} role="MATCHMAKER">
          <PaymentResult session={session} onLogout={logout} onRefreshUser={applyUserUpdate} />
        </ProtectedRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute session={session} ready={ready} role="ADMIN">
          <AdminDashboard session={session} onLogout={logout} />
        </ProtectedRoute>
      } />
      <Route path="/admin/profiles" element={
        <ProtectedRoute session={session} ready={ready} role="ADMIN">
          <AdminProfiles session={session} onLogout={logout} />
        </ProtectedRoute>
      } />
      <Route path="/consultant" element={
        <ProtectedRoute session={session} ready={ready} role="MATCHMAKER">
          <ConsultantDashboard session={session} onLogout={logout} />
        </ProtectedRoute>
      } />
      <Route path="/consultant/onboarding" element={
        <ProtectedRoute session={session} ready={ready} role="MATCHMAKER">
          {session?.user?.subscriptionAccess && !session?.user?.subscriptionTestMode
            ? <Navigate to="/consultant" replace />
            : <PackageOnboarding session={session} onLogout={logout} onRefreshUser={applyUserUpdate} />}
        </ProtectedRoute>
      } />
      <Route path="/consultant/profiles" element={
        <ReadyMatchmakerRoute session={session} ready={ready}>
          <ConsultantProfiles session={session} onLogout={logout} />
        </ReadyMatchmakerRoute>
      } />
      <Route path="/consultant/add-client" element={
        <ReadyMatchmakerRoute session={session} ready={ready}>
          <AddClientPage session={session} onLogout={logout} />
        </ReadyMatchmakerRoute>
      } />
      <Route path="/consultant/profiles/:profileId/edit" element={
        <ReadyMatchmakerRoute session={session} ready={ready}>
          <AddClientPage session={session} onLogout={logout} />
        </ReadyMatchmakerRoute>
      } />
      <Route path="/consultant/matches" element={
        <ReadyMatchmakerRoute session={session} ready={ready}>
          <ConsultantMatches session={session} onLogout={logout} />
        </ReadyMatchmakerRoute>
      } />
      <Route path="/consultant/requests" element={
        <ReadyMatchmakerRoute session={session} ready={ready}>
          <ConsultantRequests session={session} onLogout={logout} />
        </ReadyMatchmakerRoute>
      } />
      <Route path="/consultant/help" element={
        <ProtectedRoute session={session} ready={ready} role="MATCHMAKER">
          <ConsultantHelp session={session} onLogout={logout} />
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to={session ? destinationFor(session) : '/login'} replace />} />
    </Routes>
  )
}

export default function App() {
  return <BrowserRouter><AppRoutes /></BrowserRouter>
}
