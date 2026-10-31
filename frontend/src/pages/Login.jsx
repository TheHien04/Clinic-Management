import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaArrowRight,
  FaChartLine,
  FaClinicMedical,
  FaExclamationCircle,
  FaEye,
  FaEyeSlash,
  FaHeartbeat,
  FaShieldAlt,
} from 'react-icons/fa';
import { ROUTES } from '../constants';
import { loginAPI, verifyMfaAPI } from '../services/auth';
import { useAuth } from '../contexts/auth-context';
import './Login.css';

export default function Login() {
  const { establishSession } = useAuth();
  const navigate = useNavigate();
  const pageRef = useRef(null);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mfaTicket, setMfaTicket] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaHint, setMfaHint] = useState('');

  useEffect(() => {
    const sections = pageRef.current?.querySelectorAll('[data-reveal]') || [];
    if (!('IntersectionObserver' in window)) {
      sections.forEach((section) => section.classList.add('is-visible'));
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16 });

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const focusWorkspaceAccess = () => {
    const target = document.getElementById(mfaTicket ? 'login-mfa' : 'login-email');
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target?.focus({ preventScroll: true });
  };

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = mfaTicket
        ? await verifyMfaAPI(mfaTicket, mfaCode)
        : await loginAPI(form.email, form.password);

      if (data?.mfaRequired && data?.mfaTicket) {
        setMfaTicket(data.mfaTicket);
        setMfaHint(data.mfaHint || 'Enter your MFA code to continue');
        setError('');
        return;
      }

      establishSession({
        user: data.user,
        token: data.token,
      });
      const destination = ['patient', 'user'].includes(String(data.user?.role || '').toLowerCase())
        ? ROUTES.PATIENT_PORTAL
        : ROUTES.DASHBOARD;
      navigate(`/${destination}`);
    } catch (err) {
      setError(err?.message || 'Invalid username or password!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-experience" ref={pageRef}>
      <header className="auth-topbar">
        <a className="auth-brand" href="#welcome" aria-label="Clinic Care OS home">
          <span className="auth-brand-mark"><FaClinicMedical aria-hidden="true" /></span>
          <span>CLINIC <small>CARE OS</small></span>
        </a>
        <nav className="auth-nav" aria-label="Public navigation">
          <a href="#platform">Platform</a>
          <a href="#care-experience">Care experience</a>
          <button type="button" onClick={focusWorkspaceAccess}>Access workspace <FaArrowRight aria-hidden="true" /></button>
        </nav>
      </header>

      <main>
        <section className="auth-hero" id="welcome">
          <img className="auth-hero-image" src="/images/clinic-hero.jpg" alt="" aria-hidden="true" />
          <div className="auth-hero-shade" />

          <div className="auth-hero-copy" data-reveal>
            <p className="auth-eyebrow"><span /> INTELLIGENT HOSPITAL OPERATIONS</p>
            <h1>See every patient.<br />Act on every signal.</h1>
            <p className="auth-hero-lead">
              One secure workspace for care teams to coordinate appointments, capacity,
              medical records, and operational decisions in real time.
            </p>
            <button className="auth-primary-cta" type="button" onClick={focusWorkspaceAccess}>
              Enter care workspace <FaArrowRight aria-hidden="true" />
            </button>
            <div className="auth-proof-row" aria-label="Platform capabilities">
              <span><FaShieldAlt aria-hidden="true" /> Role-based access</span>
              <span><FaHeartbeat aria-hidden="true" /> Live care operations</span>
              <span><FaChartLine aria-hidden="true" /> Decision-ready analytics</span>
            </div>
          </div>

          <aside className="auth-access-panel" aria-label="Workspace access" data-reveal>
            <div className="auth-panel-heading">
              <span className="auth-panel-kicker">SECURE ACCESS</span>
              <span className="auth-live-indicator"><i /> Systems online</span>
            </div>
            <div className="login-logo" aria-hidden="true">
              <FaClinicMedical className="logo-icon" />
            </div>
            <h2 className="login-title">Clinic Management</h2>
            <div className="login-subtitle">{mfaTicket ? 'Multi-factor verification required' : 'Sign in to your care workspace'}</div>

            <form onSubmit={handleSubmit} className="auth-form">
              {!mfaTicket && (
                <>
                  <div className="input-group">
                    <label htmlFor="login-email">Email address</label>
                    <input id="login-email" name="email" type="email" autoComplete="username" placeholder="name@clinic.com" value={form.email} onChange={handleChange} required />
                  </div>
                  <div className="input-group" style={{ position: 'relative' }}>
                    <label htmlFor="login-password">Password</label>
                    <input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={form.password} onChange={handleChange} required />
                    <button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((v) => !v)}>
                      {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                    </button>
                  </div>
                </>
              )}

              {mfaTicket && (
                <>
                  <div className="input-group">
                    <label htmlFor="login-mfa">Verification code</label>
                    <input
                      id="login-mfa"
                      name="mfaCode"
                      type="text"
                      placeholder="Enter 6-digit MFA code"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      autoFocus
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      required
                    />
                  </div>
                  {mfaHint && <div className="login-row auth-mfa-hint">{mfaHint}</div>}
                </>
              )}

              {!mfaTicket && <div className="login-row login-security-note">Protected access for clinical and administrative teams.</div>}
              {error && <div className="login-error" role="alert"><FaExclamationCircle aria-hidden="true" />{error}</div>}
              <button type="submit" className="login-btn" disabled={loading}>{loading ? 'Signing in...' : (mfaTicket ? 'Verify & Continue' : 'Sign In')}</button>
            </form>

            <div className="login-link">
              <span>New patient?</span>
              <button type="button" className="login-register-btn" aria-label="Sign up" onClick={() => navigate(`/${ROUTES.REGISTER}`)}>Create account</button>
            </div>
          </aside>

          <div className="auth-floating-signal auth-floating-signal-one" aria-hidden="true">
            <span>01</span><strong>Patient flow</strong><small>Live coordination</small>
          </div>
          <div className="auth-floating-signal auth-floating-signal-two" aria-hidden="true">
            <span>02</span><strong>Care continuity</strong><small>One clinical picture</small>
          </div>
        </section>

        <section className="auth-story" id="platform" data-reveal>
          <div className="auth-story-copy">
            <p className="auth-section-number">01 · OPERATIONS INTELLIGENCE</p>
            <h2>From hospital activity<br />to confident decisions.</h2>
            <p>Unify capacity, appointments, staffing signals, and handovers in a calm operational view built for fast-moving care teams.</p>
            <ul>
              <li>Real-time command center</li>
              <li>Role-aware clinical workflows</li>
              <li>Auditable operational handovers</li>
            </ul>
          </div>
          <figure className="auth-story-visual auth-float-slow">
            <img src="/images/operations-center.jpg" alt="Hospital clinicians coordinating inside a modern operations center" loading="lazy" />
            <figcaption><span>LIVE OPERATIONS</span> Humans remain in control.</figcaption>
          </figure>
        </section>

        <section className="auth-story auth-story-reverse" id="care-experience" data-reveal>
          <div className="auth-story-copy">
            <p className="auth-section-number">02 · HUMAN-CENTERED CARE</p>
            <h2>Technology that leaves<br />room for empathy.</h2>
            <p>Give every patient interaction the context it deserves while keeping sensitive information protected and accessible only to the right care role.</p>
            <button className="auth-text-link" type="button" onClick={() => navigate(`/${ROUTES.REGISTER}`)}>
              Open patient access <FaArrowRight aria-hidden="true" />
            </button>
          </div>
          <figure className="auth-story-visual auth-float-delayed">
            <img src="/images/patient-consultation.jpg" alt="Doctor having a compassionate consultation with an adult patient" loading="lazy" />
            <figcaption><span>CONNECTED CARE</span> Context at every touchpoint.</figcaption>
          </figure>
        </section>
      </main>

      <footer className="auth-footer">
        <div className="auth-brand auth-brand-footer"><span className="auth-brand-mark"><FaClinicMedical aria-hidden="true" /></span><span>CLINIC <small>CARE OS</small></span></div>
        <p>Operational clarity for safer, more connected care.</p>
        <button type="button" onClick={focusWorkspaceAccess}>Access workspace <FaArrowRight aria-hidden="true" /></button>
      </footer>
    </div>
  );
}
