import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaExclamationCircle, FaEye, FaEyeSlash } from 'react-icons/fa';
import { STORAGE_KEYS, ROUTES } from '../constants';
import { loginAPI } from '../services/auth';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = e => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await loginAPI(form.email, form.password);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));
      localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
      navigate(`/${ROUTES.DASHBOARD}`);
    } catch (err) {
      setError(err?.message || 'Invalid username or password!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <img className="login-bg-img" src="https://cdn.pixabay.com/photo/2017/08/06/00/09/people-2583492_1280.png" alt="hospital background" />
      <div className="login-card">
        <div className="login-logo">
          <img src="https://cdn-icons-png.flaticon.com/512/2966/2966484.png" alt="Clinic Logo" className="logo-img" />
        </div>
        <h2 className="login-title">Clinic Management</h2>
        <div className="login-subtitle">Sign in to your account</div>
        <form onSubmit={handleSubmit} style={{width:'100%'}}>
          <div className="input-group">
            <input name="email" type="text" placeholder="Username" value={form.email} onChange={handleChange} autoFocus required />
          </div>
          <div className="input-group" style={{position:'relative'}}>
            <input name="password" type={showPassword ? 'text' : 'password'} placeholder="Password" value={form.password} onChange={handleChange} required />
            <span style={{position:'absolute',right:12,top:10,cursor:'pointer'}} onClick={()=>setShowPassword(v=>!v)}>
              {showPassword ? <FaEyeSlash size={18} color="var(--brand-500)" /> : <FaEye size={18} color="var(--brand-500)" />}
            </span>
          </div>
          <div className="login-row">
            <label className="remember-label"><input type="checkbox" style={{marginRight:6}} /> Remember me</label>
            <span className="login-link" style={{marginLeft:'auto'}}>Forgot password?</span>
          </div>
          {error && <div className="login-error"><FaExclamationCircle style={{marginRight:6,color:'var(--danger-fg)'}} />{error}</div>}
          <button type="submit" className="login-btn" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
        </form>
        <div className="login-link" style={{marginTop:18}}>
          <span>Don't have an account?</span>
          <button type="button" className="login-register-btn" onClick={() => navigate(`/${ROUTES.REGISTER}`)}>Sign up</button>
        </div>
      </div>
    </div>
  );
}
