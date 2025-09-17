import React, { useState } from 'react';
import { FaExclamationCircle, FaEye, FaEyeSlash } from 'react-icons/fa';

export default function Login({ onLogin, onNavigate }) {
  const MOCK_USERS = [
    { email: 'hiendepzai', password: '123456' },
    { email: 'hienhihi', password: '159357' },
    { email: 'admin@clinic.com', password: '123456' },
  ];
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(1); // 1: login, 2: otp
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');

  const handleChange = e => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setTimeout(() => {
      const found = MOCK_USERS.find(u => u.email === form.email && u.password === form.password);
      if (found) {
        // Bước xác thực OTP/email code
        setStep(2);
        setLoading(false);
      } else {
        setError('Invalid username or password!');
        setLoading(false);
      }
    }, 800);
  };

  const handleOtpSubmit = e => {
    e.preventDefault();
    setLoading(true);
    setOtpError('');
    setTimeout(() => {
      // Mock OTP: always '123456'
      if (otp === '123456') {
        localStorage.setItem('user', JSON.stringify({ email: form.email }));
        if (onLogin) onLogin(form.email);
        if (onNavigate) onNavigate('dashboard');
      } else {
        setOtpError('Invalid OTP code!');
      }
      setLoading(false);
    }, 800);
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
        {step === 1 ? (
          <form onSubmit={handleSubmit} style={{width:'100%'}}>
            <div className="input-group">
              <input name="email" type="text" placeholder="Username" value={form.email} onChange={handleChange} autoFocus required />
            </div>
            <div className="input-group" style={{position:'relative'}}>
              <input name="password" type={showPassword ? 'text' : 'password'} placeholder="Password" value={form.password} onChange={handleChange} required />
              <span style={{position:'absolute',right:12,top:10,cursor:'pointer'}} onClick={()=>setShowPassword(v=>!v)}>
                {showPassword ? <FaEyeSlash size={18} color="#1976d2" /> : <FaEye size={18} color="#1976d2" />}
              </span>
            </div>
            <div className="login-row">
              <label className="remember-label"><input type="checkbox" style={{marginRight:6}} /> Remember me</label>
              <span className="login-link" style={{marginLeft:'auto'}}>Forgot password?</span>
            </div>
            {error && <div className="login-error"><FaExclamationCircle style={{marginRight:6,color:'#d32f2f'}} />{error}</div>}
            <button type="submit" className="login-btn" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit} style={{width:'100%'}}>
            <div className="input-group">
              <input name="otp" type="text" placeholder="Enter OTP code (123456)" value={otp} onChange={e=>setOtp(e.target.value)} autoFocus required maxLength={6} />
            </div>
            {otpError && <div className="login-error"><FaExclamationCircle style={{marginRight:6,color:'#d32f2f'}} />{otpError}</div>}
            <button type="submit" className="login-btn" disabled={loading}>{loading ? 'Verifying...' : 'Verify OTP'}</button>
          </form>
        )}
        <div className="login-link" style={{marginTop:18}}>
          <span>Don't have an account?</span>
          <button type="button" className="login-register-btn" onClick={() => onNavigate && onNavigate('register')}>Sign up</button>
        </div>
      </div>
    </div>
  );
}
