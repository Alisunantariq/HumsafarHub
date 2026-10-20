import { useState } from 'react'
import { ArrowRight, BriefcaseBusiness, CircleUserRound, LockKeyhole, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

const inputClass = 'w-full rounded-lg border border-[#dce4de] bg-white px-3.5 py-3 text-sm text-[#20332b] outline-none transition placeholder:text-[#9aa79f] focus:border-[#28775b] focus:ring-4 focus:ring-[#28775b]/10'
const MAX_ADULT_BIRTH_DATE = (() => {
  const date = new Date()
  date.setUTCFullYear(date.getUTCFullYear() - 18)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
})()

function Field({ label, name, type = 'text', value, onChange, placeholder, autoComplete, required = true, minLength, maxLength }) {
  return (
    <label className="block space-y-1.5 text-sm font-semibold text-[#34463e]" htmlFor={name}>
      <span>{label}</span>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        className={inputClass}
      />
    </label>
  )
}

export default function AuthPage({ onAuthenticate }) {
  const [role, setRole] = useState('consultant')
  const [mode, setMode] = useState('login')
  const [values, setValues] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [acceptedLegal, setAcceptedLegal] = useState(false)

  function changeRole(nextRole) {
    setRole(nextRole)
    setMode('login')
    setValues({})
    setError('')
    setAcceptedLegal(false)
  }

  function changeMode(nextMode) {
    setMode(nextMode)
    setValues({})
    setError('')
    setAcceptedLegal(false)
  }

  function updateField(event) {
    setValues((previous) => ({ ...previous, [event.target.name]: event.target.value }))
    setError('')
  }

  async function submit(event) {
    event.preventDefault()
    if (isSignup && !acceptedLegal) {
      setError('Please read and accept the Terms and Conditions and Privacy Policy to create an account.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await onAuthenticate(role, mode, values)
      if (result?.error) setError(result.error)
    } catch (submitError) {
      setError(submitError.message || 'Could not sign in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const isSignup = role === 'consultant' && mode === 'signup'

  return (
    <main className="min-h-screen bg-[#f4f7f3] lg:grid lg:grid-cols-[minmax(340px,0.88fr)_1.12fr]">
      <aside className="relative hidden min-h-screen overflow-hidden bg-[#173d31] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div className="pointer-events-none absolute inset-0 opacity-[0.12]" aria-hidden="true" style={{ backgroundImage: 'linear-gradient(135deg, transparent 48%, #c7dfc8 49%, transparent 50%), linear-gradient(45deg, transparent 48%, #c7dfc8 49%, transparent 50%)', backgroundSize: '46px 46px' }} />
        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-[#d6e8d4] text-[#173d31]"><BriefcaseBusiness size={21} /></span>
          <span className="font-display text-lg font-extrabold tracking-normal">HamsafarHub</span>
        </div>
        <div className="relative max-w-lg pb-10">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-[#b8d4bd]">Your work, in good company</p>
          <h1 className="font-display text-5xl font-semibold leading-[1.08] tracking-normal xl:text-[3.6rem]">Good work starts with a trusted connection.</h1>
          <p className="mt-6 max-w-md text-base leading-7 text-[#c5d6cc]">A dedicated workspace for consultants to build meaningful relationships and manage every client with care.</p>
          <div className="mt-10 flex items-center gap-3 border-t border-white/15 pt-5 text-sm text-[#c5d6cc]">
            <ShieldCheck size={18} className="text-[#c9e3c8]" />
            <span>Private workspaces for every role</span>
          </div>
        </div>
        <p className="relative text-xs text-[#a7c2b3]">© 2026 HamsafarHub</p>
      </aside>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10 lg:px-12">
        <div className="w-full max-w-[510px]">
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-[#173d31] text-white"><BriefcaseBusiness size={19} /></span>
            <span className="font-display text-lg font-extrabold text-[#203c31]">HamsafarHub</span>
          </div>
          <div className="mb-8">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#54806a]">Welcome to your workspace</p>
            <h2 className="font-display text-3xl font-bold text-[#1d3229] sm:text-4xl">{isSignup ? 'Create your account' : 'Sign in to continue'}</h2>
            <p className="mt-2 text-sm text-[#748078]">{isSignup ? 'Start with a few details about you.' : 'Choose your workspace and enter your details.'}</p>
          </div>

          <div className="mb-6 grid grid-cols-2 rounded-lg border border-[#dce4de] bg-[#eaf0e9] p-1" aria-label="Choose account type">
            <button type="button" onClick={() => changeRole('admin')} className={`flex min-h-11 items-center justify-center gap-2 rounded-md text-sm font-semibold transition ${role === 'admin' ? 'bg-white text-[#1c4737] shadow-sm' : 'text-[#728078] hover:text-[#34463e]'}`}>
              <ShieldCheck size={16} /> Admin
            </button>
            <button type="button" onClick={() => changeRole('consultant')} className={`flex min-h-11 items-center justify-center gap-2 rounded-md text-sm font-semibold transition ${role === 'consultant' ? 'bg-white text-[#1c4737] shadow-sm' : 'text-[#728078] hover:text-[#34463e]'}`}>
              <CircleUserRound size={16} /> Consultant
            </button>
          </div>

          {role === 'consultant' && (
            <div className="mb-6 flex border-b border-[#dce4de]" aria-label="Authentication mode">
              <button type="button" onClick={() => changeMode('login')} className={`relative px-1 pb-3 pr-6 text-sm font-semibold ${mode === 'login' ? 'text-[#1b684b] after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:bg-[#28775b]' : 'text-[#818c85] hover:text-[#41544a]'}`}>Log in</button>
              <button type="button" onClick={() => changeMode('signup')} className={`relative px-1 pb-3 text-sm font-semibold ${mode === 'signup' ? 'text-[#1b684b] after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:bg-[#28775b]' : 'text-[#818c85] hover:text-[#41544a]'}`}>Sign up</button>
            </div>
          )}

          {role === 'admin' && (
            <div className="mb-6 flex items-center gap-2 rounded-md border border-[#d9e7db] bg-[#edf4ed] px-3.5 py-3 text-xs text-[#42634e]">
              <LockKeyhole size={15} /> Admin accounts are provisioned separately. Sign up is unavailable.
            </div>
          )}

          {error && <p role="alert" className="mb-5 rounded-md border border-[#f0c8bf] bg-[#fff1ed] px-3.5 py-3 text-sm text-[#a84334]">{error}</p>}

          <form className="space-y-4" onSubmit={submit}>
            {isSignup ? (
              <>
                <Field label="Full name" name="fullName" value={values.fullName || ''} onChange={updateField} placeholder="Your name" autoComplete="name" />
                <Field label="Email address" name="email" type="email" value={values.email || ''} onChange={updateField} placeholder="you@example.com" autoComplete="email" />
                <Field label="Consultant phone number" name="phoneNumber" type="tel" value={values.phoneNumber || ''} onChange={updateField} placeholder="+92 300 1234567" autoComplete="tel" minLength={7} maxLength={40} />
                <Field label="Date of birth (you must be at least 18)" name="dateOfBirth" type="date" value={values.dateOfBirth || ''} onChange={updateField} autoComplete="bday" max={MAX_ADULT_BIRTH_DATE} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Password" name="password" type="password" value={values.password || ''} onChange={updateField} placeholder="At least 12 characters" autoComplete="new-password" minLength={12} maxLength={72} />
                  <Field label="Confirm password" name="confirmPassword" type="password" value={values.confirmPassword || ''} onChange={updateField} placeholder="Re-enter password" autoComplete="new-password" />
                </div>
                <p className="text-xs leading-5 text-[#849087]">Use at least 12 characters. Your password is stored only as a server-side hash.</p>
                <label className="flex items-start gap-2.5 text-sm leading-6 text-[#58695f]">
                  <input
                    type="checkbox"
                    name="acceptedLegal"
                    checked={acceptedLegal}
                    onChange={(event) => { setAcceptedLegal(event.target.checked); setError('') }}
                    required
                    className="mt-1 size-4 shrink-0 accent-[#1e6348]"
                  />
                  <span>
                    I have read both <Link to="/terms" target="_blank" rel="noreferrer" className="font-semibold text-[#1e6348] underline">Terms and Conditions</Link> and <Link to="/privacy" target="_blank" rel="noreferrer" className="font-semibold text-[#1e6348] underline">Privacy Policy</Link> of Humsafar Hub
                  </span>
                </label>
              </>
            ) : role === 'admin' ? (
              <>
                <Field label="Admin email" name="email" type="email" value={values.email || ''} onChange={updateField} placeholder="name@company.com" autoComplete="username" />
                <Field label="Password" name="password" type="password" value={values.password || ''} onChange={updateField} placeholder="Enter your password" autoComplete="current-password" />
              </>
            ) : (
              <>
                <Field label="Email address" name="email" type="email" value={values.email || ''} onChange={updateField} placeholder="you@example.com" autoComplete="username" />
                <Field label="Password" name="password" type="password" value={values.password || ''} onChange={updateField} placeholder="Enter your password" autoComplete="current-password" />
              </>
            )}
            <button type="submit" disabled={busy} className="group mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#1e6348] px-4 text-sm font-bold text-white transition hover:bg-[#174d39] focus:outline-none focus:ring-4 focus:ring-[#28775b]/20 disabled:cursor-wait disabled:opacity-60">
              {busy ? 'Connecting securely…' : isSignup ? 'Create consultant account' : `Continue as ${role === 'admin' ? 'Admin' : 'Consultant'}`}
              <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </form>
          <p className="mt-7 text-center text-xs leading-5 text-[#849088]">By continuing, you agree to use this workspace responsibly and keep account details private.</p>
        </div>
      </section>
    </main>
  )
}