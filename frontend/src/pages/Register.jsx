import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';
import { FaClinicMedical, FaExclamationCircle, FaEye, FaEyeSlash } from 'react-icons/fa';
import { registerAPI } from '../services/auth';
import { ROUTES } from '../constants';
import { useAuth } from '../contexts/auth-context';

function Register() {
  const { establishSession } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange = e => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  function passwordStrength(pw) {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.email || !form.password || !form.confirm) {
      setError('Please fill all fields!');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match!');
      return;
    }
    if (passwordStrength(form.password) < 2) {
      setError('Password is too weak! (Min 8 chars, number, uppercase, symbol)');
      return;
    }
    setLoading(true);
    try {
      const data = await registerAPI({
        email: form.email,
        password: form.password,
        name: form.email,
      });

      establishSession({
        user: data.user,
        token: data.token,
        refreshToken: data.refreshToken,
      });
      setSuccess('Registration successful! Redirecting to dashboard...');
      navigate(`/${ROUTES.PATIENT_PORTAL}`);
    } catch (err) {
      setError(err?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo" aria-hidden="true">
          <FaClinicMedical className="logo-icon" />
        </div>
        <h2 className="login-title">Register Account</h2>
        <form onSubmit={handleSubmit} style={{width:'100%'}}>
          <div className="input-group">
            <label htmlFor="register-email">Email address</label>
            <input id="register-email" name="email" type="email" autoComplete="username" placeholder="name@example.com" value={form.email} onChange={handleChange} required />
          </div>
          <div className="input-group" style={{position:'relative'}}>
            <label htmlFor="register-password">Password</label>
            <input id="register-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={handleChange} required />
            <button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={()=>setShowPassword(v=>!v)}>
              {showPassword ? <FaEyeSlash size={18} color="var(--brand-500)" /> : <FaEye size={18} color="var(--brand-500)" />}
            </button>
          </div>
          <div style={{fontSize:13,marginBottom:6}}>
            Password strength: <span style={{color: passwordStrength(form.password) >= 3 ? 'var(--success-fg)' : passwordStrength(form.password) === 2 ? 'var(--warning-fg)' : 'var(--danger-fg)',fontWeight:600}}>
              {passwordStrength(form.password) >= 3 ? 'Strong' : passwordStrength(form.password) === 2 ? 'Medium' : 'Weak'}
            </span>
          </div>
          <div className="input-group" style={{position:'relative'}}>
            <label htmlFor="register-confirm">Confirm password</label>
            <input id="register-confirm" name="confirm" type={showConfirm ? 'text' : 'password'} autoComplete="new-password" placeholder="Repeat your password" value={form.confirm} onChange={handleChange} required />
            <button type="button" className="password-toggle" aria-label={showConfirm ? 'Hide confirmed password' : 'Show confirmed password'} aria-pressed={showConfirm} onClick={()=>setShowConfirm(v=>!v)}>
              {showConfirm ? <FaEyeSlash size={18} color="var(--brand-500)" /> : <FaEye size={18} color="var(--brand-500)" />}
            </button>
          </div>
          {error && <div className="login-error" role="alert"><FaExclamationCircle aria-hidden="true" style={{marginRight:6,color:'var(--danger-fg)'}} />{error}</div>}
          {success && <div className="login-success" role="status">{success}</div>}
          <button type="submit" className="login-btn" disabled={loading}>{loading ? 'Registering...' : 'Register'}</button>
        </form>
        <div className="login-link" style={{marginTop:18}}>
          <span>Already have an account?</span>
          <button type="button" className="login-register-btn" onClick={() => navigate(`/${ROUTES.LOGIN}`)}>Login</button>
        </div>
      </div>
    </div>
  );
}

export default Register;
