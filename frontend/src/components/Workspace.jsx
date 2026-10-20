import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, BriefcaseBusiness, Check, ChevronDown, CircleUserRound, ClipboardList,
  Crown, LogOut, MessageCircle, Phone, Plus, RefreshCw, ShieldCheck, Sparkles,
  Pencil, Users, X,
} from 'lucide-react'
import {
  adminApi, authApi, coordinationApi, matchingApi, profileApi, subscriptionApi,
} from '../api/client.js'

const inputClass = 'w-full rounded-lg border border-[#dce4de] bg-white px-3.5 py-3 text-sm text-[#20332b] outline-none transition placeholder:text-[#9aa79f] focus:border-[#28775b] focus:ring-4 focus:ring-[#28775b]/10'
const MAX_BIRTH_DATE = (() => {
  const date = new Date()
  date.setUTCFullYear(date.getUTCFullYear() - 18)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
})()

function StatusNotice({ error, success }) {
  return (
    <>
      {error && <p role="alert" className="mb-5 rounded-lg border border-[#f0c8bf] bg-[#fff1ed] px-4 py-3 text-sm text-[#a84334]">{error}</p>}
      {success && <p role="status" className="mb-5 rounded-lg border border-[#cfe1d1] bg-[#eff7ef] px-4 py-3 text-sm text-[#286447]">{success}</p>}
    </>
  )
}

function StatusPill({ children, tone = 'green' }) {
  const colors = {
    green: 'bg-[#eaf2e9] text-[#477454]',
    amber: 'bg-[#fbf3df] text-[#8a6c2e]',
    red: 'bg-[#fff1ed] text-[#a84334]',
    gray: 'bg-[#eef1ee] text-[#647168]',
  }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${colors[tone]}`}>{children}</span>
}

function toneForStatus(status) {
  if (status === 'APPROVED' || status === 'ACTIVE' || status === 'PAID') return 'green'
  if (status === 'PENDING' || status === 'INACTIVE') return 'amber'
  if (status === 'REJECTED' || status === 'FAILED' || status === 'CANCELED') return 'red'
  return 'gray'
}

function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#568069]">{eyebrow}</p>
        <h1 className="font-display text-3xl font-bold text-[#20372c] sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[#718078]">{description}</p>
      </div>
      {action}
    </div>
  )
}

function WorkspaceShell({ role, userName, onLogout, children }) {
  const links = role === 'admin'
    ? [{ to: '/admin', label: 'Overview' }, { to: '/admin/profiles', label: 'Client profiles' }]
    : [
        { to: '/consultant', label: 'Overview' },
        { to: '/consultant/profiles', label: 'My profiles' },
        { to: '/consultant/matches', label: 'AI matching' },
        { to: '/consultant/requests', label: 'Coordination' },
        { to: '/consultant/help', label: 'Help' },
      ]
  return (
    <div className="min-h-screen bg-[#f5f7f4]">
      <header className="border-b border-[#e3e9e4] bg-white">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link to={role === 'admin' ? '/admin' : '/consultant'} className="flex items-center gap-2.5 text-[#203c31] no-underline">
            <span className="grid size-9 place-items-center rounded-lg bg-[#1d4c39] text-white"><BriefcaseBusiness size={17} /></span>
            <span className="font-display text-base font-extrabold">HamsafarHub</span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-5">
            <span className="hidden text-sm text-[#627168] sm:block">{userName}</span>
            <span className="grid size-9 place-items-center rounded-full bg-[#e2eee3] text-sm font-bold text-[#315e46]">{userName?.slice(0, 1).toUpperCase()}</span>
            <button type="button" onClick={onLogout} title="Log out" aria-label="Log out" className="grid size-9 place-items-center rounded-lg text-[#6f7c74] transition hover:bg-[#f0f4f0] hover:text-[#224c39]"><LogOut size={17} /></button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-11">
        <nav className="mb-8 flex flex-wrap gap-2 border-b border-[#dfe7df]" aria-label={`${role} pages`}>
          {links.map(({ to, label }) => (
            <Link key={to} to={to} className="inline-flex min-h-11 items-center rounded-t-lg px-4 text-sm font-semibold text-[#66766d] no-underline transition hover:bg-white hover:text-[#286447]">
              {label}
            </Link>
          ))}
        </nav>
        {children}
      </main>
      <footer className="border-t border-[#e3e9e4] px-5 py-5 text-center text-xs text-[#8a958e]">Private matchmaker workspace · HamsafarHub</footer>
    </div>
  )
}

function Metric({ icon: Icon, label, value, detail }) {
  return (
    <div className="border-t-2 border-[#d9e5dc] bg-white px-5 py-5 sm:px-6">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#6c7b72]">{label}</span>
        <span className="grid size-9 place-items-center rounded-lg bg-[#eef4ed] text-[#477454]"><Icon size={17} /></span>
      </div>
      <p className="mt-5 font-display text-3xl font-bold text-[#20372c]">{value}</p>
      <p className="mt-1 text-xs text-[#89948d]">{detail}</p>
    </div>
  )
}

function Detail({ label, value }) {
  return (
    <div className="py-2">
      <dt className="text-xs font-medium text-[#849087]">{label}</dt>
      <dd className="mt-1 text-sm text-[#31453a]">{value || '—'}</dd>
    </div>
  )
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

function ageFromDate(value) {
  if (!value) return null
  const birthDate = new Date(`${String(value).slice(0, 10)}T00:00:00Z`)
  const now = new Date()
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear()
  const monthDelta = now.getUTCMonth() - birthDate.getUTCMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < birthDate.getUTCDate())) age -= 1
  return age
}

function ErrorBlock({ error, onRetry }) {
  return (
    <div className="border border-[#f0c8bf] bg-[#fff8f5] p-5 text-sm text-[#a84334]">
      <p>{error}</p>
      {onRetry && <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-2 font-bold"><RefreshCw size={14} /> Try again</button>}
    </div>
  )
}

function useLoad(loader, dependencies) {
  const [value, setValue] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setValue(await loader())
    } catch (loadError) {
      setError(loadError.message || 'Could not load this information.')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)
  useEffect(() => { void reload() }, [reload])
  return { value, error, loading, reload }
}

function ReadinessPanel({ user }) {
  const paid = user.subscriptionAccess
  const approved = user.approvalStatus === 'APPROVED'
  return (
    <section className="border border-[#dfe7e0] bg-white p-5 sm:p-7">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#eef4ed] text-[#477454]"><ShieldCheck size={21} /></span>
        <div>
          <h2 className="font-display text-lg font-bold text-[#20372c]">Account access</h2>
          <p className="mt-1 text-sm leading-6 text-[#718078]">{user.subscriptionTestMode ? 'Free testing access is enabled. Administrator approval is still required to use the workspace.' : 'Your workspace unlocks after your package is paid and your matchmaker account is approved by an administrator.'}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusPill tone={user.subscriptionTestMode ? 'gray' : toneForStatus(user.subscriptionStatus)}>{user.subscriptionTestMode ? 'Payment: Test mode' : `Payment: ${user.subscriptionStatus}`}</StatusPill>
            <StatusPill tone={toneForStatus(user.approvalStatus)}>Review: {user.approvalStatus}</StatusPill>
            {user.subscriptionPlan && <StatusPill tone="gray">Package: {user.subscriptionPlan}</StatusPill>}
          </div>
        </div>
      </div>
      {!paid && <Link to="/consultant/onboarding" className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#1e6348] px-4 text-sm font-bold text-white no-underline hover:bg-[#174d39]">Choose a package <Crown size={16} /></Link>}
      {user.subscriptionTestMode && <Link to="/consultant/onboarding" className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#b9d7bf] px-4 text-sm font-bold text-[#286447] no-underline hover:bg-[#eff7ef]">Choose a test package <Crown size={16} /></Link>}
      {paid && !approved && <p className="mt-5 rounded-lg bg-[#fbf7eb] px-4 py-3 text-sm text-[#7a612e]">{user.subscriptionTestMode ? 'Your account is awaiting administrator approval; workspace features will unlock when it is approved.' : 'Your subscription is paid. Your account is awaiting administrator approval; you’ll be able to use the workspace as soon as it is approved.'}</p>}
      {user.subscriptionStatus === 'PAST_DUE' && user.subscriptionAccess && <p className="mt-5 rounded-lg bg-[#fbf7eb] px-4 py-3 text-sm text-[#7a612e]">Your latest renewal payment failed. Workspace access remains available during the grace period{user.subscriptionGracePeriodEndsAt ? ` until ${formatDate(user.subscriptionGracePeriodEndsAt)}` : ''}. Update your payment with Safepay to avoid interruption.</p>}
      {approved && paid && user.subscriptionStatus !== 'PAST_DUE' && <p className="mt-5 rounded-lg bg-[#eff7ef] px-4 py-3 text-sm text-[#286447]">Your subscription is paid and your account is approved.</p>}
    </section>
  )
}

export function AdminDashboard({ session, onLogout }) {
  const { value, error, loading, reload } = useLoad(async () => {
    const [summary, users] = await Promise.all([
      adminApi.summary(session.token),
      adminApi.matchmakers(session.token),
    ])
    return { ...summary.summary, matchmakerAccounts: users.matchmakers }
  }, [session.token])
  const [actionError, setActionError] = useState('')
  const [updatingId, setUpdatingId] = useState('')

  async function updateApproval(user, approvalStatus) {
    setActionError('')
    setUpdatingId(user.id)
    try {
      await adminApi.updateMatchmaker(session.token, user.id, approvalStatus)
      await reload()
    } catch (updateError) {
      setActionError(updateError.message)
    } finally {
      setUpdatingId('')
    }
  }

  return (
    <WorkspaceShell role="admin" userName={session.user.fullName} onLogout={onLogout}>
      <PageHeading eyebrow="Administrator workspace" title="Platform overview" description="Review matchmaker applications, payments, and the platform’s client profiles." action={<button type="button" onClick={reload} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dce4de] bg-white px-3.5 text-sm font-semibold text-[#43594b]"><RefreshCw size={15} /> Refresh</button>} />
      {error && <ErrorBlock error={error} onRetry={reload} />}
      {actionError && <StatusNotice error={actionError} />}
      {loading ? <p className="py-8 text-sm text-[#718078]">Loading platform data…</p> : value && (
        <>
          <section className="mb-8 grid gap-px overflow-hidden border border-[#e2e9e3] bg-[#e2e9e3] sm:grid-cols-2 lg:grid-cols-4" aria-label="Platform metrics">
            <Metric icon={Users} label="Matchmakers" value={value.matchmakers} detail="Registered accounts" />
            <Metric icon={ClipboardList} label="Client profiles" value={value.profiles} detail="Profiles in the platform" />
            <Metric icon={ShieldCheck} label="Awaiting review" value={value.pendingApprovals} detail="Matchmaker applications" />
            <Metric icon={Crown} label="Payments in progress" value={value.pendingPayments} detail="Matchmakers with a selected package checkout" />
          </section>
          <section className="border border-[#e2e9e3] bg-white">
            <div className="flex items-center justify-between border-b border-[#e8ede8] px-5 py-4 sm:px-6">
              <div><h2 className="font-display text-lg font-bold text-[#20372c]">Matchmaker accounts</h2><p className="mt-1 text-xs text-[#839087]">Payment and approval are separate gates; approving an account never marks an unpaid order as paid.</p></div>
              <span className="rounded-md bg-[#eef4ed] px-2.5 py-1 text-xs font-semibold text-[#477454]">{value.matchmakerAccounts.length}</span>
            </div>
            <div className="divide-y divide-[#edf0ed]">
              {value.matchmakerAccounts.map((user) => (
                <article key={user.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-[#31453a]">{user.fullName}</h3>
                    <p className="mt-1 break-all text-xs text-[#718078]">{user.email} · {user._count.profiles} profiles · joined {formatDate(user.createdAt)}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusPill tone={toneForStatus(user.approvalStatus)}>Review: {user.approvalStatus}</StatusPill>
                      <StatusPill tone={toneForStatus(user.subscriptionStatus)}>Payment: {user.subscriptionStatus}</StatusPill>
                      {user.subscriptionPlan && <StatusPill tone="gray">{user.subscriptionPlan}</StatusPill>}
                    </div>
                  </div>
                  {user.approvalStatus === 'PENDING' && (
                    <div className="flex shrink-0 gap-2">
                      <button type="button" disabled={updatingId === user.id} onClick={() => updateApproval(user, 'APPROVED')} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#1e6348] px-3 text-sm font-bold text-white disabled:opacity-50"><Check size={15} /> Approve</button>
                      <button type="button" disabled={updatingId === user.id} onClick={() => updateApproval(user, 'REJECTED')} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#f0c8bf] px-3 text-sm font-bold text-[#a84334] disabled:opacity-50"><X size={15} /> Reject</button>
                    </div>
                  )}
                </article>
              ))}
              {!value.matchmakerAccounts.length && <p className="px-5 py-10 text-center text-sm text-[#718078]">No matchmaker accounts have registered yet.</p>}
            </div>
          </section>
        </>
      )}
    </WorkspaceShell>
  )
}

export function AdminProfiles({ session, onLogout }) {
  const { value, error, loading, reload } = useLoad(
    async () => (await adminApi.profiles(session.token)).profiles,
    [session.token],
  )
  return (
    <WorkspaceShell role="admin" userName={session.user.fullName} onLogout={onLogout}>
      <PageHeading eyebrow="Administrator workspace" title="All client profiles" description="Review profiles shared with the platform and their uploading matchmaker." action={<button type="button" onClick={reload} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dce4de] bg-white px-3.5 text-sm font-semibold text-[#43594b]"><RefreshCw size={15} /> Refresh</button>} />
      {error && <ErrorBlock error={error} onRetry={reload} />}
      {loading && <p className="py-8 text-sm text-[#718078]">Loading profiles…</p>}
      {value && <ProfileList profiles={value} showOwner token={session.token} />}
    </WorkspaceShell>
  )
}

function ProfilePhoto({ profileId, token }) {
  const [photoUrl, setPhotoUrl] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    let objectUrl
    profileApi.photo(token, profileId)
      .then((photo) => {
        if (!active) return
        objectUrl = URL.createObjectURL(photo)
        setPhotoUrl(objectUrl)
      })
      .catch(() => { if (active) setError(true) })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [profileId, token])

  if (error) return <p className="border-t border-[#e8ede8] px-2 py-3 text-xs text-[#849087]">Photo unavailable.</p>
  if (!photoUrl) return <p className="border-t border-[#e8ede8] px-2 py-3 text-xs text-[#849087]">Loading photo…</p>
  return <div className="border-t border-[#e8ede8] bg-[#fbfcfa] px-2 py-3"><img src={photoUrl} alt="Client profile" className="size-36 rounded-lg object-cover" /></div>
}

function ProfileThumbnail({ profileId, token }) {
  const [photoUrl, setPhotoUrl] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    let objectUrl
    profileApi.photo(token, profileId)
      .then((photo) => {
        if (!active) return
        objectUrl = URL.createObjectURL(photo)
        setPhotoUrl(objectUrl)
      })
      .catch(() => { if (active) setError(true) })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [profileId, token])

  return photoUrl
    ? <img src={photoUrl} alt="Client profile" className="size-12 shrink-0 rounded-lg object-cover" />
    : <span aria-label={error ? 'Client photo unavailable' : 'Loading client photo'} className="grid size-12 shrink-0 place-items-center rounded-lg bg-[#e9f1e8] text-[#477454]"><CircleUserRound size={19} /></span>
}

function MatchCandidatePhoto({ sourceProfileId, profileId, token }) {
  const [photoUrl, setPhotoUrl] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    let objectUrl
    matchingApi.photo(token, sourceProfileId, profileId)
      .then((photo) => {
        if (!active) return
        objectUrl = URL.createObjectURL(photo)
        setPhotoUrl(objectUrl)
      })
      .catch(() => { if (active) setError(true) })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [profileId, sourceProfileId, token])

  if (error) return <p className="text-xs text-[#849087]">Photo unavailable.</p>
  if (!photoUrl) return <p className="text-xs text-[#849087]">Loading photo…</p>
  return <img src={photoUrl} alt="Client profile" className="size-40 rounded-lg border border-[#dce4de] object-cover" />
}

function ProfileList({ profiles, showOwner = false, onRemove, onEdit, token }) {
  const [expandedProfileIds, setExpandedProfileIds] = useState(() => new Set())
  if (!profiles.length) return <div className="border border-dashed border-[#d3ded5] bg-white px-5 py-12 text-center text-sm text-[#718078]">No profiles found.</div>
  return (
    <section className="divide-y divide-[#edf0ed] border border-[#e2e9e3] bg-white">
      {profiles.map((profile) => (
        <details
          key={profile.id}
          className="group px-4 sm:px-6"
          onToggle={(event) => {
            const isOpen = event.currentTarget.open
            setExpandedProfileIds((current) => {
              const next = new Set(current)
              if (isOpen) next.add(profile.id)
              else next.delete(profile.id)
              return next
            })
          }}
        >
          <summary className="flex cursor-pointer list-none items-center gap-3 py-4 marker:hidden">
            {token ? <ProfileThumbnail profileId={profile.id} token={token} /> : <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e9f1e8] text-[#477454]"><CircleUserRound size={19} /></span>}
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[#31453a]">{profile.fullName}</span><span className="mt-0.5 block truncate text-xs text-[#849087]">{[profile.city, profile.caste, profile.education].filter(Boolean).join(' · ')}</span>{showOwner && <span className="mt-0.5 block truncate text-xs font-medium text-[#568069]">Consultant: {profile.matchmaker.fullName} · {profile.matchmaker.phoneNumber || 'Phone not provided'}</span>}</span>
            <ChevronDown size={17} className="shrink-0 text-[#718078] transition-transform group-open:rotate-180" />
          </summary>
          {token && expandedProfileIds.has(profile.id) && <ProfilePhoto profileId={profile.id} token={token} />}
          <dl className="grid gap-x-6 border-t border-[#e8ede8] bg-[#fbfcfa] px-2 py-3 sm:grid-cols-2 sm:px-3 lg:grid-cols-3">
            <Detail label="Gender / age" value={`${profile.gender}, ${ageFromDate(profile.dateOfBirth) ?? '—'}`} />
            <Detail label="Height" value={`${profile.heightCm} cm`} />
            <Detail label="Property" value={`${profile.propertyMarlas} Marlas`} />
            <Detail label="Marital status" value={profile.maritalStatus?.replaceAll('_', ' ')} />
            <Detail label="Profession" value={profile.profession} />
            <Detail label="Structured match preferences" value={[
              profile.preferredMinAge != null || profile.preferredMaxAge != null
                ? `${profile.preferredMinAge ?? 18}-${profile.preferredMaxAge ?? 120} years`
                : null,
              profile.preferredCity && `City: ${profile.preferredCity}`,
              profile.preferredEducation && `Education: ${profile.preferredEducation}`,
              profile.preferredCaste && `Caste: ${profile.preferredCaste}`,
              profile.preferredMinHeightCm != null || profile.preferredMaxHeightCm != null
                ? `Height: ${profile.preferredMinHeightCm ?? 80}-${profile.preferredMaxHeightCm ?? 250} cm`
                : null,
            ].filter(Boolean).join(' · ')} />
            <Detail label="Contact phone" value={profile.contactPhone} />
            <Detail label="Contact email" value={profile.contactEmail} />
            <Detail label="Added" value={formatDate(profile.createdAt)} />
          </dl>
          {onEdit && <div className="flex gap-4 border-t border-[#e8ede8] bg-[#fbfcfa] px-2 py-3 sm:px-3"><button type="button" onClick={() => onEdit(profile)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#286447] hover:underline"><Pencil size={14} /> Update profile</button></div>}
          {onRemove && <div className="border-t border-[#e8ede8] bg-[#fbfcfa] px-2 pb-3 sm:px-3"><button type="button" onClick={() => onRemove(profile)} className="text-sm font-semibold text-[#a84334] hover:underline">Delete profile</button></div>}
        </details>
      ))}
    </section>
  )
}

export function ConsultantDashboard({ session, onLogout }) {
  const ready = session.user.approvalStatus === 'APPROVED' &&
    session.user.subscriptionAccess
  const { value, error, loading, reload } = useLoad(
    async () => (ready ? (await profileApi.mine(session.token)).profiles : []),
    [session.token, ready],
  )
  return (
    <WorkspaceShell role="consultant" userName={session.user.fullName} onLogout={onLogout}>
      <PageHeading eyebrow="Matchmaker workspace" title={`Welcome, ${session.user.fullName.split(' ')[0]}`} description="Manage your client profiles and find thoughtful introductions." action={ready && <Link to="/consultant/add-client" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#1e6348] px-4 text-sm font-bold text-white no-underline hover:bg-[#174d39]"><Plus size={17} /> Add client</Link>} />
      {!ready ? <ReadinessPanel user={session.user} /> : (
        <>
          {error && <ErrorBlock error={error} onRetry={reload} />}
          <section className="mb-8 grid gap-px overflow-hidden border border-[#e2e9e3] bg-[#e2e9e3] sm:grid-cols-2">
            <Metric icon={Users} label="Your client profiles" value={loading ? '…' : value?.length ?? 0} detail="Profiles uploaded by you" />
            <Metric icon={Crown} label="Active package" value={session.user.subscriptionPlan || '—'} detail={`Payment: ${session.user.subscriptionStatus} · Review: ${session.user.approvalStatus}`} />
          </section>
          <section className="grid gap-4 sm:grid-cols-3">
            <QuickLink to="/consultant/profiles" icon={ClipboardList} title="My profiles" text="Review your saved client records." />
            <QuickLink to="/consultant/matches" icon={Sparkles} title="AI matching" text="Find profiles that satisfy your clients’ criteria." />
            <QuickLink to="/consultant/requests" icon={Users} title="Coordination" text="Manage introductions and consent requests." />
          </section>
        </>
      )}
    </WorkspaceShell>
  )
}

function QuickLink({ to, icon: Icon, title, text }) {
  return <Link to={to} className="border border-[#e2e9e3] bg-white p-5 text-[#34483c] no-underline transition hover:border-[#b9cdbd] hover:bg-[#fbfcfa]"><Icon size={19} className="text-[#477454]" /><h2 className="mt-3 font-display font-bold">{title}</h2><p className="mt-1 text-sm leading-5 text-[#718078]">{text}</p></Link>
}

export function ConsultantProfiles({ session, onLogout }) {
  const navigate = useNavigate()
  const { value, error, loading, reload } = useLoad(
    async () => (await profileApi.mine(session.token)).profiles,
    [session.token],
  )
  const [actionError, setActionError] = useState('')

  async function removeProfile(profile) {
    if (!window.confirm(`Delete the profile for ${profile.fullName}?`)) return
    setActionError('')
    try {
      await profileApi.remove(session.token, profile.id)
      await reload()
    } catch (removeError) {
      setActionError(removeError.message)
    }
  }

  return (
    <WorkspaceShell role="consultant" userName={session.user.fullName} onLogout={onLogout}>
      <PageHeading eyebrow="Client management" title="My profiles" description="Private details are shown only to you and remain behind the platform’s consent controls." action={<Link to="/consultant/add-client" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#1e6348] px-4 text-sm font-bold text-white no-underline"><Plus size={17} /> Add client</Link>} />
      {error && <ErrorBlock error={error} onRetry={reload} />}
      {actionError && <StatusNotice error={actionError} />}
      {loading && <p className="py-8 text-sm text-[#718078]">Loading your profiles…</p>}
      {value && <ProfileList
        profiles={value}
        onRemove={removeProfile}
        onEdit={(profile) => navigate(`/consultant/profiles/${profile.id}/edit`)}
        token={session.token}
      />}
    </WorkspaceShell>
  )
}

function Field({ label, name, type = 'text', required = false, className = '', ...props }) {
  return <label htmlFor={name} className={`block space-y-1.5 text-sm font-semibold text-[#34463e] ${className}`}><span>{label}{required && ' *'}</span><input id={name} name={name} type={type} required={required} className={inputClass} {...props} /></label>
}

function SelectField({ label, name, options, required = false, className = '', defaultValue = '' }) {
  return <label htmlFor={name} className={`block space-y-1.5 text-sm font-semibold text-[#34463e] ${className}`}><span>{label}{required && ' *'}</span><select id={name} name={name} required={required} defaultValue={defaultValue} className={inputClass}><option value="" disabled>Select…</option>{options.map(([value, labelText]) => <option key={value} value={value}>{labelText}</option>)}</select></label>
}

function TextAreaField({ label, name, className = '', defaultValue = '', ...props }) {
  return <label htmlFor={name} className={`block space-y-1.5 text-sm font-semibold text-[#34463e] ${className}`}><span>{label}</span><textarea id={name} name={name} defaultValue={defaultValue} className={`${inputClass} resize-y`} {...props} /></label>
}

export function AddClientPage({ session, onLogout, profileId }) {
  const navigate = useNavigate()
  const routeParams = useParams()
  const editingProfileId = profileId || routeParams.profileId
  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(Boolean(editingProfileId))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [clientAge, setClientAge] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const isNormal = session.user.subscriptionPlan === 'NORMAL'

  useEffect(() => {
    if (!editingProfileId) return undefined
    let active = true
    profileApi.get(session.token, editingProfileId)
      .then(({ profile: loadedProfile }) => {
        if (!active) return
        setProfile(loadedProfile)
        setClientAge(ageFromDate(loadedProfile.dateOfBirth))
      })
      .catch((loadError) => { if (active) setError(loadError.message) })
      .finally(() => { if (active) setLoadingProfile(false) })
    return () => { active = false }
  }, [editingProfileId, session.token])

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
  }, [photoPreview])

  async function saveClient(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    const optionalNumber = (key) => form.get(key) ? Number(form.get(key)) : null
    const body = {
      fullName: String(form.get('fullName')).trim(),
      gender: form.get('gender'),
      dateOfBirth: form.get('dateOfBirth'),
      heightCm: Number(form.get('heightCm')),
      propertyMarlas: Number(form.get('propertyMarlas')),
      education: String(form.get('education')).trim(),
      profession: String(form.get('profession') || '').trim() || null,
      incomeMin: optionalNumber('incomeMin'),
      incomeMax: optionalNumber('incomeMax'),
      maritalStatus: String(form.get('maritalHistory')).startsWith('Single')
        ? 'NEVER_MARRIED'
        : String(form.get('maritalHistory')).startsWith('Divorced') ? 'DIVORCED' : 'WIDOWED',
      maritalHistory: form.get('maritalHistory'),
      caste: String(form.get('caste')).trim(),
      city: String(form.get('city')).trim(),
      contactPhone: String(form.get('contactPhone')).trim(),
      contactEmail: String(form.get('contactEmail') || '').trim() || null,
      preferredCaste: String(form.get('preferredCaste') || '').trim() || null,
      preferredMinAge: optionalNumber('preferredMinAge'),
      preferredMaxAge: optionalNumber('preferredMaxAge'),
      preferredCity: String(form.get('preferredCity') || '').trim() || null,
      preferredEducation: String(form.get('preferredEducation') || '').trim() || null,
      preferredMinHeightCm: optionalNumber('preferredMinHeightCm'),
      preferredMaxHeightCm: optionalNumber('preferredMaxHeightCm'),
      clientOrigin: form.get('clientOrigin'),
      preferences: String(form.get('preferences') || '').trim() || null,
      description: String(form.get('description') || '').trim() || null,
      requirements: String(form.get('requirements') || '').trim() || null,
    }
    const payload = new FormData()
    for (const [key, value] of Object.entries(body)) {
      if (value !== null) payload.append(key, String(value))
      else if (editingProfileId) payload.append(key, '')
    }
    const selectedPhoto = form.get('photo')
    if (selectedPhoto instanceof File && selectedPhoto.size > 0) {
      payload.append('photo', selectedPhoto)
    }
    try {
      if (editingProfileId) {
        await profileApi.update(session.token, editingProfileId, payload)
        navigate('/consultant/profiles', { replace: true, state: { notice: 'Client profile updated.' } })
      } else {
        await profileApi.create(session.token, payload)
        navigate('/consultant/profiles', { replace: true, state: { notice: 'Client profile saved.' } })
      }
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <WorkspaceShell role="consultant" userName={session.user.fullName} onLogout={onLogout}>
      <Link to="/consultant" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-[#597065] no-underline hover:text-[#1e6348]"><ArrowLeft size={16} /> Back to dashboard</Link>
      <PageHeading eyebrow="Client management" title={editingProfileId ? 'Update client profile' : 'Add a client'} description="Client information is stored in the secured backend and never saved in browser storage. Use the structured preference fields to set requirements that the matching rules can enforce; free-text notes are not automatically interpreted." />
      <StatusNotice error={error} />
      {loadingProfile && <p className="py-8 text-sm text-[#718078]">Loading client profile…</p>}
      {!loadingProfile && (!editingProfileId || profile) && <form key={editingProfileId || 'new-profile'} onSubmit={saveClient} className="border border-[#e2e9e3] bg-white">
        <div className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2 sm:p-7">
          <p className="sm:col-span-2 text-xs text-[#718078]">Fields marked * are required. Do not include government ID or other data you do not need to coordinate a match.</p>
          <label htmlFor="photo" className="block space-y-1.5 text-sm font-semibold text-[#34463e] sm:col-span-2">
            <span>Client photo{!profile?.photoMimeType && ' *'}</span>
            {profile?.photoMimeType && <ProfilePhoto profileId={profile.id} token={session.token} />}
            <input
              id="photo"
              name="photo"
              type="file"
              required={!profile?.photoMimeType}
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                if (file && file.size > 3 * 1024 * 1024) {
                  event.currentTarget.value = ''
                  setPhotoPreview('')
                  setError('Client photo must be 3 MB or smaller.')
                  return
                }
                setError('')
                setPhotoPreview(file ? URL.createObjectURL(file) : '')
              }}
              className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-[#eaf2e9] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#315e46]`}
            />
            <span className="block text-xs font-normal text-[#718078]">JPEG, PNG, or WebP; maximum 3 MB. Upload only a photo the client has authorized you to use. Select a new photo to replace the existing one.</span>
            {photoPreview && <img src={photoPreview} alt="Client photo preview" className="mt-2 size-36 rounded-lg border border-[#dce4de] object-cover" />}
          </label>
          <Field label="Full name" name="fullName" required minLength={2} maxLength={160} autoComplete="off" defaultValue={profile?.fullName ?? ''} />
          <SelectField label="Gender" name="gender" required defaultValue={profile?.gender ?? ''} options={ [['Male', 'Male'], ['Female', 'Female'], ['Other', 'Other']] } />
          <Field label="Date of birth" name="dateOfBirth" type="date" required max={MAX_BIRTH_DATE} defaultValue={profile?.dateOfBirth ? String(profile.dateOfBirth).slice(0, 10) : ''} onChange={(event) => setClientAge(ageFromDate(event.target.value))} />
          <Field label="Age (years)" name="clientAge" type="number" value={clientAge ?? ''} readOnly aria-label="Calculated client age" placeholder="Calculated from date of birth" />
          <Field label="Height (cm)" name="heightCm" type="number" required min="80" max="250" step="1" defaultValue={profile?.heightCm ?? ''} />
          <Field label="Property (Marlas)" name="propertyMarlas" type="number" required min="0" max="99999" step="0.01" defaultValue={profile?.propertyMarlas ?? ''} />
          <Field label="Education" name="education" required maxLength={160} defaultValue={profile?.education ?? ''} />
          <Field label="Profession" name="profession" maxLength={160} defaultValue={profile?.profession ?? ''} />
          <Field label="Monthly income from (PKR)" name="incomeMin" type="number" min="0" step="any" defaultValue={profile?.incomeMin ?? ''} />
          <Field label="Monthly income to (PKR)" name="incomeMax" type="number" min="0" step="any" defaultValue={profile?.incomeMax ?? ''} />
          <SelectField label="Marital history" name="maritalHistory" required defaultValue={profile?.maritalHistory || (profile?.maritalStatus === 'NEVER_MARRIED' ? 'Single' : profile?.maritalStatus === 'DIVORCED' ? 'Divorced' : profile?.maritalStatus === 'WIDOWED' ? 'Widow' : '')} options={ [['Single', 'Single'], ['Divorced', 'Divorced'], ['Widow', 'Widow'], ['Divorced with children', 'Divorced with children'], ['Widow with children', 'Widow with children']] } />
          <Field label="Caste" name="caste" required maxLength={120} defaultValue={profile?.caste ?? ''} />
          <Field label="City" name="city" required maxLength={120} defaultValue={profile?.city ?? ''} />
          <Field label="Contact phone" name="contactPhone" type="tel" required maxLength={40} autoComplete="tel" defaultValue={profile?.contactPhone ?? ''} />
          <Field label="Contact email" name="contactEmail" type="email" maxLength={320} autoComplete="off" defaultValue={profile?.contactEmail ?? ''} />
          <Field label="Preferred caste" name="preferredCaste" maxLength={120} defaultValue={profile?.preferredCaste ?? ''} />
          <Field label="Preferred minimum age" name="preferredMinAge" type="number" min="18" max="120" step="1" defaultValue={profile?.preferredMinAge ?? ''} />
          <Field label="Preferred maximum age" name="preferredMaxAge" type="number" min="18" max="120" step="1" defaultValue={profile?.preferredMaxAge ?? ''} />
          <Field label="Preferred city" name="preferredCity" maxLength={120} defaultValue={profile?.preferredCity ?? ''} />
          <Field label="Preferred education" name="preferredEducation" maxLength={160} defaultValue={profile?.preferredEducation ?? ''} />
          <SelectField label="Client location" name="clientOrigin" required defaultValue={profile?.clientOrigin ?? 'PAKISTAN'} options={isNormal ? [['PAKISTAN', 'Pakistan']] : [['PAKISTAN', 'Pakistan'], ['FOREIGN', 'Outside Pakistan']]} />
          <Field label="Preferred minimum height (cm)" name="preferredMinHeightCm" type="number" min="80" max="250" step="1" defaultValue={profile?.preferredMinHeightCm ?? ''} />
          <Field label="Preferred maximum height (cm)" name="preferredMaxHeightCm" type="number" min="80" max="250" step="1" defaultValue={profile?.preferredMaxHeightCm ?? ''} />
          <TextAreaField label="Match preferences" name="preferences" rows={2} maxLength={1000} placeholder="Additional non-sensitive preferences" defaultValue={profile?.preferences ?? ''} />
          <TextAreaField label="Additional client requirements (notes)" name="requirements" rows={3} maxLength={2000} className="sm:col-span-2" placeholder="Additional partner expectations…" defaultValue={profile?.requirements ?? ''} />
          <TextAreaField label="Profile description" name="description" rows={3} maxLength={2000} className="sm:col-span-2" defaultValue={profile?.description ?? ''} />
        </div>
        <div className="flex flex-col-reverse justify-end gap-3 border-t border-[#e8ede8] bg-[#fbfcfa] px-5 py-4 sm:flex-row sm:px-7">
          <button type="button" onClick={() => navigate('/consultant/profiles')} className="min-h-11 rounded-lg border border-[#dce4de] px-4 text-sm font-semibold text-[#58675e]">Cancel</button>
          <button type="submit" disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#1e6348] px-5 text-sm font-bold text-white disabled:opacity-60">{busy ? 'Saving…' : <>{editingProfileId ? 'Update profile' : 'Save profile'} <Check size={16} /></>}</button>
        </div>
      </form>}
    </WorkspaceShell>
  )
}

export function ConsultantMatches({ session, onLogout }) {
  const { value: profiles, error, loading } = useLoad(
    async () => (await profileApi.mine(session.token)).profiles,
    [session.token],
  )
  const [selectedId, setSelectedId] = useState('')
  const [matches, setMatches] = useState(null)
  const [actionError, setActionError] = useState('')
  const [requested, setRequested] = useState({})
  const [busy, setBusy] = useState(false)
  const selectedProfile = profiles?.find((profile) => profile.id === selectedId)

  async function findMatches(event) {
    event.preventDefault()
    setBusy(true)
    setActionError('')
    try {
      const response = await matchingApi.find(session.token, selectedId)
      setMatches(response.matches)
    } catch (matchError) {
      setActionError(matchError.message)
      setMatches(null)
    } finally {
      setBusy(false)
    }
  }

  async function requestCoordination(profile) {
    setActionError('')
    try {
      await coordinationApi.request(session.token, profile.id)
      setRequested((state) => ({ ...state, [profile.id]: true }))
    } catch (requestError) {
      setActionError(requestError.message)
    }
  }

  return (
    <WorkspaceShell role="consultant" userName={session.user.fullName} onLogout={onLogout}>
      <PageHeading eyebrow="Matchmaker workspace" title="AI client matches" description="You can select only clients you uploaded. Results compare opposite-gender profiles against both clients’ structured preferences and the 8/10 Marla property rule. Profiles are ranked by score; scores of 85% or higher meet the compatibility criteria. Lower-scoring results are included for review with the unmet criteria shown. Free-text notes are not parsed as rules. Contact details remain private until the receiving consultant approves coordination." />
      {error && <ErrorBlock error={error} />}
      {actionError && <StatusNotice error={actionError} />}
      <form onSubmit={findMatches} className="border border-[#e2e9e3] bg-white p-5 sm:p-7">
        <label htmlFor="match-client" className="block space-y-2 text-sm font-semibold text-[#34463e]">
          <span>Select one of your clients</span>
          <select id="match-client" value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setMatches(null) }} required className={`${inputClass} sm:max-w-xl`}>
            <option value="">Choose a client profile</option>
            {(profiles || []).map((profile) => <option key={profile.id} value={profile.id}>{profile.fullName} · {profile.city}</option>)}
          </select>
        </label>
        <button type="submit" disabled={!profiles?.length || busy || loading} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#1e6348] px-5 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Finding matches…' : <><Sparkles size={17} /> Find matches</>}</button>
      </form>
      {selectedProfile?.requirements && <div className="mt-4 border border-[#dfe9df] bg-[#f8faf7] px-4 py-3"><p className="text-xs font-bold uppercase tracking-wide text-[#718078]">Requirements</p><p className="mt-1 whitespace-pre-wrap text-sm text-[#34483c]">{selectedProfile.requirements}</p><p className="mt-2 text-xs text-[#718078]">For reliable matching, set requirements in the structured preference fields when editing the profile.</p></div>}
      {matches && (
        <section className="mt-8">
          <h2 className="mb-4 font-display text-xl font-bold text-[#20372c]">Profile comparisons <span className="text-base font-medium text-[#718078]">· {matches.filter((profile) => profile.isCompatible).length} compatible / {matches.length} total</span></h2>
          {matches.length ? <div className="grid gap-4 md:grid-cols-2">
            {matches.map((profile) => <article key={profile.id} className="border border-[#e2e9e3] bg-white p-5">
              <div className="flex items-start gap-3"><MatchCandidatePhoto sourceProfileId={selectedId} profileId={profile.id} token={session.token} /><div className="min-w-0 flex-1"><h3 className="font-display text-lg font-bold text-[#20372c]">{profile.fullName}</h3><p className="mt-1 text-sm text-[#718078]">{ageFromDate(profile.dateOfBirth)} years · {profile.city}</p></div><div className="flex shrink-0 flex-col items-end gap-2"><StatusPill>{profile.caste}</StatusPill><StatusPill tone={profile.isCompatible ? 'green' : 'amber'}>{profile.compatibilityPercent}% · {profile.isCompatible ? 'Compatible' : 'Below criteria'}</StatusPill></div></div>
              <p className="mt-4 text-sm text-[#43594b]">{profile.education} · {profile.profession || 'Profession not provided'}</p>
              <p className="mt-1 text-xs text-[#718078]">{profile.heightCm} cm · {profile.propertyMarlas} Marlas</p>
              {profile.failedCriteria.length > 0 && <p className="mt-3 text-xs text-[#8a6c2e]">Needs review: {profile.failedCriteria.join(', ')}.</p>}
              <details className="mt-4 border-t border-[#e8ede8] pt-3">
                <summary className="cursor-pointer text-sm font-semibold text-[#315e46]">View full profile</summary>
                <div className="mt-4 space-y-4">
                  <dl className="grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
                    <Detail label="Gender" value={profile.gender} />
                    <Detail label="Date of birth / age" value={`${formatDate(profile.dateOfBirth)} · ${ageFromDate(profile.dateOfBirth)} years`} />
                    <Detail label="Height" value={`${profile.heightCm} cm`} />
                    <Detail label="Property" value={`${profile.propertyMarlas} Marlas`} />
                    <Detail label="Education" value={profile.education} />
                    <Detail label="Profession" value={profile.profession} />
                    <Detail label="Income range" value={profile.incomeMin != null || profile.incomeMax != null ? `PKR ${profile.incomeMin ?? '—'} – ${profile.incomeMax ?? '—'}` : null} />
                    <Detail label="Marital status" value={profile.maritalStatus?.replaceAll('_', ' ')} />
                    <Detail label="Marital history" value={profile.maritalHistory} />
                    <Detail label="Caste" value={profile.caste} />
                    <Detail label="City" value={profile.city} />
                    <Detail label="Client location" value={profile.clientOrigin?.replaceAll('_', ' ')} />
                    <Detail label="Preferred age" value={profile.preferredMinAge != null || profile.preferredMaxAge != null ? `${profile.preferredMinAge ?? 18}–${profile.preferredMaxAge ?? 120} years` : null} />
                    <Detail label="Preferred height" value={profile.preferredMinHeightCm != null || profile.preferredMaxHeightCm != null ? `${profile.preferredMinHeightCm ?? 80}–${profile.preferredMaxHeightCm ?? 250} cm` : null} />
                    <Detail label="Preferred city" value={profile.preferredCity} />
                    <Detail label="Preferred education" value={profile.preferredEducation} />
                    <Detail label="Preferred caste" value={profile.preferredCaste} />
                    <Detail label="Profile added" value={formatDate(profile.createdAt)} />
                  </dl>
                  {profile.preferences && <div><p className="text-xs font-bold uppercase tracking-wide text-[#718078]">Match preferences</p><p className="mt-1 whitespace-pre-wrap text-sm text-[#34483c]">{profile.preferences}</p></div>}
                  {profile.requirements && <div><p className="text-xs font-bold uppercase tracking-wide text-[#718078]">Additional requirements</p><p className="mt-1 whitespace-pre-wrap text-sm text-[#34483c]">{profile.requirements}</p></div>}
                  {profile.description && <div><p className="text-xs font-bold uppercase tracking-wide text-[#718078]">Profile description</p><p className="mt-1 whitespace-pre-wrap text-sm text-[#34483c]">{profile.description}</p></div>}
                  <div className="border-t border-[#e8ede8] pt-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#718078]">Consultant who added this client</p>
                    <p className="mt-1 text-sm font-semibold text-[#34483c]">{profile.matchmaker.fullName}</p>
                    {profile.matchmaker.phoneNumber
                      ? <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm"><a href={`tel:${profile.matchmaker.phoneNumber}`} className="text-[#315e46] underline">{profile.matchmaker.phoneNumber}</a><a href={`https://wa.me/${profile.matchmaker.phoneNumber.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-[#315e46] underline">WhatsApp consultant</a></p>
                      : <p className="mt-1 text-sm text-[#43594b]">Phone not provided</p>}
                  </div>
                </div>
              </details>
              {profile.isCompatible && <button type="button" disabled={requested[profile.id]} onClick={() => requestCoordination(profile)} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dce4de] px-3.5 text-sm font-semibold text-[#315e46] disabled:opacity-60">{requested[profile.id] ? <><Check size={15} /> Request sent</> : 'Request coordination'}</button>}
            </article>)}
          </div> : <div className="border border-dashed border-[#d3ded5] bg-white px-5 py-10 text-center text-sm text-[#718078]">No opposite-gender profiles are available within your package’s matching pool.</div>}
        </section>
      )}
    </WorkspaceShell>
  )
}

export function ConsultantRequests({ session, onLogout }) {
  const { value, error, loading, reload } = useLoad(
    async () => (await coordinationApi.list(session.token)).requests,
    [session.token],
  )
  const [actionError, setActionError] = useState('')
  const [contacts, setContacts] = useState({})
  const [busyId, setBusyId] = useState('')

  async function updateRequest(request, status) {
    setActionError('')
    setBusyId(request.id)
    try {
      await coordinationApi.update(session.token, request.id, status)
      await reload()
    } catch (updateError) {
      setActionError(updateError.message)
    } finally {
      setBusyId('')
    }
  }

  async function revealContact(profileId) {
    setActionError('')
    try {
      const { profile } = await profileApi.get(session.token, profileId)
      setContacts((current) => ({ ...current, [profileId]: profile }))
    } catch (contactError) {
      setActionError(contactError.message)
    }
  }

  return (
    <WorkspaceShell role="consultant" userName={session.user.fullName} onLogout={onLogout}>
      <PageHeading eyebrow="Consent workflow" title="Coordination requests" description="Approve or decline incoming requests. Contact details are available only after approval." action={<button type="button" onClick={reload} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dce4de] bg-white px-3.5 text-sm font-semibold text-[#43594b]"><RefreshCw size={15} /> Refresh</button>} />
      {error && <ErrorBlock error={error} onRetry={reload} />}
      {actionError && <StatusNotice error={actionError} />}
      {loading && <p className="py-8 text-sm text-[#718078]">Loading requests…</p>}
      {value && (value.length ? <div className="space-y-3">
        {value.map((request) => {
          const incoming = request.receiverId === session.user.id
          const contact = contacts[request.targetProfileId]
          return <article key={request.id} className="border border-[#e2e9e3] bg-white p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <div className="flex items-start gap-3">
                  <ProfileThumbnail profileId={request.targetProfile.id} token={session.token} />
                  <div><div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-lg font-bold text-[#20372c]">{request.targetProfile.fullName}</h2><StatusPill tone={toneForStatus(request.status)}>{request.status}</StatusPill></div>
                    <p className="mt-1 text-sm text-[#718078]">{request.targetProfile.city} · {request.targetProfile.caste} · {request.targetProfile.education}</p>
                    <p className="mt-2 text-xs text-[#849087]">{incoming ? `From ${request.sender.fullName}` : `To ${request.receiver.fullName}`} · {formatDate(request.createdAt)}</p>
                  </div>
                </div>
              </div>
              {request.status === 'PENDING' && <div className="flex gap-2">
                {incoming
                  ? <><button type="button" disabled={busyId === request.id} onClick={() => updateRequest(request, 'APPROVED')} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#1e6348] px-3 text-sm font-bold text-white disabled:opacity-50"><Check size={15} /> Approve</button><button type="button" disabled={busyId === request.id} onClick={() => updateRequest(request, 'DECLINED')} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#f0c8bf] px-3 text-sm font-bold text-[#a84334] disabled:opacity-50"><X size={15} /> Decline</button></>
                  : <button type="button" disabled={busyId === request.id} onClick={() => updateRequest(request, 'WITHDRAWN')} className="min-h-10 rounded-lg border border-[#dce4de] px-3 text-sm font-semibold text-[#58675e] disabled:opacity-50">Withdraw</button>}
              </div>}
            </div>
            {!incoming && request.status === 'APPROVED' && <div className="mt-4 border-t border-[#edf0ed] pt-4">
              {contact ? <p className="text-sm text-[#315e46]">Contact: {contact.contactPhone}{contact.contactEmail ? ` · ${contact.contactEmail}` : ''}</p> : <button type="button" onClick={() => revealContact(request.targetProfileId)} className="text-sm font-bold text-[#28775b] hover:underline">View approved contact details</button>}
            </div>}
          </article>
        })}
      </div> : <div className="border border-dashed border-[#d3ded5] bg-white px-5 py-12 text-center text-sm text-[#718078]">No coordination requests yet.</div>)}
    </WorkspaceShell>
  )
}

export function ConsultantHelp({ session, onLogout }) {
  const phoneNumber = '+92 3080163990'
  const whatsappNumber = '923080163990'
  return (
    <WorkspaceShell role="consultant" userName={session.user.fullName} onLogout={onLogout}>
      <PageHeading eyebrow="Consultant support" title="Help and contact" description="Reach the HamsafarHub administrator if you need help with your account, subscription, client profiles, or coordination requests." />
      <section className="max-w-2xl border border-[#e2e9e3] bg-white p-6 sm:p-8">
        <span className="grid size-12 place-items-center rounded-xl bg-[#eef4ed] text-[#477454]"><CircleUserRound size={23} /></span>
        <h2 className="mt-5 font-display text-xl font-bold text-[#20372c]">Administrator</h2>
        <p className="mt-1 text-lg font-semibold text-[#31453a]">Shagufta Durani</p>
        <p className="mt-1 text-sm text-[#718078]">{phoneNumber}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="tel:+923080163990" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#1e6348] px-4 text-sm font-bold text-white no-underline hover:bg-[#174d39]"><Phone size={16} /> Call admin</a>
          <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#b9d7bf] bg-[#eff7ef] px-4 text-sm font-bold text-[#286447] no-underline hover:bg-[#e4f1e5]"><MessageCircle size={16} /> Message on WhatsApp</a>
        </div>
      </section>
    </WorkspaceShell>
  )
}

export function PaymentResult({ session, onLogout, onRefreshUser }) {
  const navigate = useNavigate()
  const query = new URLSearchParams(window.location.search)
  const reference = query.get('reference')
  const [subscription, setSubscription] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const cancelled = new URLSearchParams(window.location.search).get('status') === 'cancelled'

  useEffect(() => {
    if (cancelled) return undefined
    let active = true
    let timer
    if (!reference) return undefined
    async function checkPayment() {
      try {
        const response = await subscriptionApi.get(session.token, reference)
        if (!active) return
        setSubscription(response.subscription)
        setError('')
        if (response.subscription.status === 'PENDING') {
          timer = window.setTimeout(() => setAttempt((count) => count + 1), 2500)
          return
        }
        if (response.subscription.status === 'ACTIVE' || response.subscription.latestPaymentStatus === 'SUCCEEDED') {
          await authApi.me(session.token).then((response) => {
            if (active) onRefreshUser(response.user)
          })
        }
      } catch (loadError) {
        if (active) setError(loadError.message)
      }
    }
    void checkPayment()
    return () => { active = false; window.clearTimeout(timer) }
  }, [session.token, reference, attempt, cancelled, onRefreshUser])

  const successful = subscription?.latestPaymentStatus === 'SUCCEEDED'
  const failed = subscription?.status === 'PAYMENT_FAILED' || subscription?.status === 'PAST_DUE'
  return (
    <WorkspaceShell role="consultant" userName={session.user.fullName} onLogout={onLogout}>
      <section className="mx-auto max-w-xl border border-[#e2e9e3] bg-white p-6 text-center sm:p-9">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#eef4ed] text-[#477454]">{successful ? <Check size={23} /> : <Crown size={22} />}</span>
        <h1 className="mt-4 font-display text-2xl font-bold text-[#20372c]">{cancelled ? 'Checkout cancelled' : successful ? 'Subscription confirmed' : failed ? 'Payment not completed' : 'Confirming your subscription'}</h1>
        {error && <p role="alert" className="mt-4 text-sm text-[#a84334]">{error}</p>}
        {cancelled
          ? <p className="mt-2 text-sm leading-6 text-[#718078]">No payment was recorded. You can return to package selection whenever you’re ready.</p>
          : successful
            ? <p className="mt-2 text-sm leading-6 text-[#718078]">Your {subscription.tier} subscription payment is verified. Renewal is monthly; your matchmaker account still requires administrator approval before workspace features unlock.</p>
            : failed
              ? <p className="mt-2 text-sm leading-6 text-[#718078]">The subscription payment was not successful. Retry checkout or contact support. Access is never granted by this page alone.</p>
              : <p className="mt-2 text-sm leading-6 text-[#718078]">Waiting for Safepay’s signed subscription webhook. This page will update after the server verifies it.</p>}
        {!cancelled && subscription?.status === 'PENDING' && <p className="mt-3 text-xs text-[#849087]">PKR {subscription.amountPkr.toLocaleString()} per month · Reference {subscription.reference}</p>}
        <button type="button" onClick={() => navigate(successful ? '/consultant' : '/consultant/onboarding')} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#1e6348] px-5 text-sm font-bold text-white">{successful ? 'Go to workspace' : 'Return to packages'}</button>
      </section>
    </WorkspaceShell>
  )
}

export function PackageOnboarding({ session, onLogout, onRefreshUser }) {
  const navigate = useNavigate()
  const [plans, setPlans] = useState(null)
  const [error, setError] = useState('')
  const [busyPlan, setBusyPlan] = useState('')
  const [step, setStep] = useState(1)

  useEffect(() => {
    let active = true
    subscriptionApi.plans()
      .then((response) => { if (active) setPlans(response) })
      .catch((loadError) => { if (active) setError(loadError.message) })
    return () => { active = false }
  }, [])

  async function startCheckout(plan) {
    setBusyPlan(plan)
    setError('')
    try {
      const response = await subscriptionApi.checkout(session.token, plan)
      window.location.assign(response.checkoutUrl)
    } catch (checkoutError) {
      setError(checkoutError.message)
      setBusyPlan('')
    }
  }

  async function startTestAccess(plan) {
    setBusyPlan(plan)
    setError('')
    try {
      await subscriptionApi.testAccess(session.token, plan)
      const { user } = await authApi.me(session.token)
      onRefreshUser(user)
      navigate('/consultant')
    } catch (testError) {
      setError(testError.message)
      setBusyPlan('')
    }
  }

  return (
    <WorkspaceShell role="consultant" userName={session.user.fullName} onLogout={onLogout}>
      <div className="mb-8 flex items-center gap-3"><span className={`size-2.5 rounded-full ${step === 1 ? 'bg-[#28775b]' : 'bg-[#c9d9ce]'}`} /><span className="h-px w-10 bg-[#d9e3dc]" /><span className={`size-2.5 rounded-full ${step === 2 ? 'bg-[#28775b]' : 'bg-[#c9d9ce]'}`} /><span className="text-xs font-semibold text-[#7e8a82]">Step {step} of 2</span></div>
      {step === 1 ? (
        <section className="mx-auto max-w-3xl border border-[#e2e9e3] bg-white p-6 sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#568069]">Welcome to HamsafarHub</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-[#20372c]">A private workspace for thoughtful introductions</h1>
          <p className="mt-4 text-sm leading-6 text-[#718078]">Your package lets you manage client profiles and use our matching tools. Your account is reviewed separately; checkout never bypasses administrator approval.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="border border-[#e8ede8] p-4"><h2 className="font-bold text-[#31453a]">Normal</h2><p className="mt-1 text-sm text-[#718078]">Manage Pakistan-based client profiles.</p></div>
            <div className="border border-[#e8ede8] p-4"><h2 className="font-bold text-[#8a6c2e]">Golden</h2><p className="mt-1 text-sm text-[#718078]">Manage Pakistan-based and international client profiles.</p></div>
          </div>
          <button type="button" onClick={() => setStep(2)} className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#1e6348] px-5 text-sm font-bold text-white">View packages <Crown size={16} /></button>
        </section>
      ) : (
        <>
          <div className="mb-7 max-w-2xl"><button type="button" onClick={() => setStep(1)} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#597065]"><ArrowLeft size={15} /> Back</button><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#568069]">{plans?.testMode ? 'Free testing access' : 'Monthly subscription'}</p><h1 className="mt-2 font-display text-3xl font-bold text-[#20372c]">Choose your tier</h1><p className="mt-2 text-sm text-[#718078]">{plans?.testMode ? 'Safepay payments are temporarily disabled for local testing. Select a tier to continue without payment; administrator approval is still required.' : 'Safepay securely collects your first payment and authorizes monthly renewal. HamsafarHub never collects or stores card details. Access starts only after a verified Safepay subscription payment webhook.'}</p></div>
          <StatusNotice error={error} />
          {!plans && !error && <p className="py-6 text-sm text-[#718078]">Loading package options…</p>}
          {plans && <div className="grid gap-5 md:grid-cols-2">
            {plans.plans.map((plan) => {
              const golden = plan.tier === 'golden'
              return <section key={plan.id} className={`flex flex-col border bg-white p-6 ${golden ? 'border-[#c3a764]' : 'border-[#dfe7e0]'}`}>
                <span className={`grid size-10 place-items-center rounded-lg ${golden ? 'bg-[#fbf3df] text-[#9a772e]' : 'bg-[#eaf2e9] text-[#477454]'}`}>{golden ? <Crown size={19} /> : <ShieldCheck size={19} />}</span>
                <h2 className="mt-5 font-display text-xl font-bold text-[#20372c]">{plan.name}</h2>
                <p className="mt-2 text-sm text-[#718078]">{golden ? 'For consultants with clients in Pakistan and abroad.' : 'For consultants with clients in Pakistan.'}</p>
                {!plans.testMode && <p className="mt-5 font-display text-3xl font-bold text-[#20372c]">PKR {plan.amount.toLocaleString()}<span className="ml-1 text-sm font-medium text-[#89948d]">/ month</span></p>}
                {plans.testMode && <p className="mt-5 font-display text-3xl font-bold text-[#20372c]">Free<span className="ml-1 text-sm font-medium text-[#89948d]">during local testing</span></p>}
                {!plans.testMode && <p className="mt-3 text-xs leading-5 text-[#718078]">Choose from the payment methods available on the secure checkout page.</p>}
                <button type="button" disabled={(!plans.testMode && !plans.provider) || Boolean(busyPlan)} onClick={() => plans.testMode ? startTestAccess(plan.tier) : startCheckout(plan.tier)} className={`mt-6 min-h-11 rounded-lg px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 ${golden ? 'bg-[#9a772e] hover:bg-[#806224]' : 'bg-[#1e6348] hover:bg-[#174d39]'}`}>{busyPlan === plan.tier ? (plans.testMode ? 'Enabling test access…' : 'Connecting to Safepay…') : plans.testMode ? `Continue with ${plan.name}` : `Subscribe to ${plan.name}`}</button>
                {!plans.testMode && !plans.provider && <p className="mt-3 text-xs text-[#a84334]">{plans.checkoutUnavailableReason || 'Payment provider credentials are not configured. Contact the platform administrator.'}</p>}
              </section>
            })}
          </div>}
        </>
      )}
    </WorkspaceShell>
  )
}
