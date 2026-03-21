import { CheckCircle2, Github } from 'lucide-react'

import { signInWithEmail, signInWithGitHub, signUpWithEmail } from './actions/auth'

async function signInWithEmailAction(formData: FormData) {
  'use server'

  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')

  return signInWithEmail(email, password)
}

async function signUpWithEmailAction(formData: FormData) {
  'use server'

  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')

  return signUpWithEmail(email, password)
}

export default function Home() {
  return (
    <main className="landing">
      <div className="landing-grid-overlay" />

      <div className="landing-frame">
        <header className="landing-nav">
          <div className="landing-brand-row">
            <a className="landing-logo" href="/">
              <span className="landing-logo-mark">$</span>
              <span>pendline</span>
            </a>
            <span className="landing-beta-badge">Beta</span>
          </div>
        </header>

        <div className="landing-shell">
          <section className="landing-hero">
            <h1 className="landing-headline">
              <span className="landing-headline-line">Track and control</span>
              <span className="landing-headline-line">
                your <span>LLM spend</span> in
              </span>
              <span className="landing-headline-line">real time</span>
            </h1>

            <p className="landing-subtext">
              See exactly where every token goes. Fix cost spikes before they hit your bill. Spendline
              provides the observational HUD your dev team needs.
            </p>

            <div className="landing-code-block" aria-label="Spendline Python quickstart">
              <div className="landing-code-chrome" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div>
                <span className="landing-keyword">from</span>{' '}
                <span className="landing-brand">spendline</span>{' '}
                <span className="landing-keyword">import</span>{' '}
                <span className="landing-brand">track</span>
              </div>
              <div>
                <span className="landing-brand">track</span>(
                <span className="landing-function">openai</span>.chat.completions.
                <span className="landing-function">create</span>(
              </div>
              <div className="landing-code-indent">
                <span className="landing-keyword">model</span>=
                <span className="landing-model">&quot;gpt-5-mini&quot;</span>,
              </div>
              <div className="landing-code-indent">
                <span className="landing-keyword">messages</span>=[
                {'{'}
                <span className="landing-string">&quot;role&quot;</span>:{' '}
                <span className="landing-string">&quot;user&quot;</span>,{' '}
                <span className="landing-string">&quot;content&quot;</span>:{' '}
                <span className="landing-string">&quot;...&quot;</span>
                {'}'}
                ]
              </div>
              <div>)</div>
            </div>

            <div className="landing-trust-row">
              <span className="landing-trust-item">
                <CheckCircle2 size={16} strokeWidth={1.5} />
                <span>No Latency</span>
              </span>
              <span className="landing-trust-item">
                <CheckCircle2 size={16} strokeWidth={1.5} />
                <span>Open Source SDK</span>
              </span>
              <span className="landing-trust-item">
                <CheckCircle2 size={16} strokeWidth={1.5} />
                <span>Zero-Config</span>
              </span>
            </div>
          </section>

          <section className="landing-auth-card">
            <div className="landing-auth-copy">
              <h2>Access Terminal</h2>
              <p>LLM cost monitoring for high-performance teams.</p>
            </div>

            <form action={signInWithGitHub}>
              <button className="landing-github-button" type="submit">
                <Github size={18} strokeWidth={1.5} />
                <span>Continue with GitHub</span>
              </button>
            </form>

            <div className="landing-divider">
              <span />
              <strong>Or Email</strong>
              <span />
            </div>

            <form className="landing-email-form">
              <label className="landing-field">
                <span>Email Address</span>
                <input name="email" type="email" placeholder="dev@company.com" required />
              </label>

              <label className="landing-field">
                <span className="landing-password-row">
                  <span>Password</span>
                  <a href="/">Forgot?</a>
                </span>
                <input name="password" type="password" placeholder="••••••••" required />
              </label>

              <button className="landing-primary-button" type="submit" formAction={signInWithEmailAction}>
                Get started free
              </button>

              <button className="landing-signup-link" type="submit" formAction={signUpWithEmailAction}>
                Don&apos;t have an account? <span>Sign up</span>
              </button>
            </form>
          </section>
        </div>

        <footer className="landing-footer">
          <span>Free During Beta</span>
          <nav>
            <a href="/">Documentation</a>
            <a href="/">Security</a>
            <a href="/">Privacy</a>
            <a href="/">Status</a>
          </nav>
        </footer>
      </div>
    </main>
  )
}
