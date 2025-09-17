import React, { useState } from 'react';
import './Login.css';
import { FaExclamationCircle, FaEye, FaEyeSlash } from 'react-icons/fa';

function Register({ onNavigate }) {
  const MOCK_USERS = [
    { email: 'hiendepzai', password: '123456' },
    { email: 'hienhihi', password: '159357' },
    { email: 'admin@clinic.com', password: '123456' },
  ];
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

  const handleSubmit = e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.email || !form.password || !form.confirm) {
      setError('Please fill all fields!');
      return;
    }
    if (MOCK_USERS.find(u => u.email === form.email)) {
      setError('Email/username already exists!');
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
    setTimeout(() => {
      setSuccess('Registration successful! You can now login.');
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="login-container">
      <img className="login-bg-img" src="https://cdn.pixabay.com/photo/2017/08/06/00/09/people-2583492_1280.png" alt="hospital background" />
      <div className="login-card">
        <div className="login-logo">
          <img src="https://cdn-icons-png.flaticon.com/512/2966/2966484.png" alt="Clinic Logo" className="logo-img" />
        </div>
        <h2 className="login-title">Register Account</h2>
        <form onSubmit={handleSubmit} style={{width:'100%'}}>
          <div className="input-group">
            <input name="email" type="text" placeholder="Email/Username" value={form.email} onChange={handleChange} required />
          </div>
          <div className="input-group" style={{position:'relative'}}>
            <input name="password" type={showPassword ? 'text' : 'password'} placeholder="Password" value={form.password} onChange={handleChange} required />
            <span style={{position:'absolute',right:12,top:10,cursor:'pointer'}} onClick={()=>setShowPassword(v=>!v)}>
              {showPassword ? <FaEyeSlash size={18} color="#1976d2" /> : <FaEye size={18} color="#1976d2" />}
            </span>
          </div>
          <div style={{fontSize:13,marginBottom:6}}>
            Password strength: <span style={{color: passwordStrength(form.password) >= 3 ? '#43a047' : passwordStrength(form.password) === 2 ? '#ffa000' : '#d32f2f',fontWeight:600}}>
              {passwordStrength(form.password) >= 3 ? 'Strong' : passwordStrength(form.password) === 2 ? 'Medium' : 'Weak'}
            </span>
          </div>
          <div className="input-group" style={{position:'relative'}}>
            <input name="confirm" type={showConfirm ? 'text' : 'password'} placeholder="Confirm Password" value={form.confirm} onChange={handleChange} required />
            <span style={{position:'absolute',right:12,top:10,cursor:'pointer'}} onClick={()=>setShowConfirm(v=>!v)}>
              {showConfirm ? <FaEyeSlash size={18} color="#1976d2" /> : <FaEye size={18} color="#1976d2" />}
            </span>
          </div>
          {error && <div className="login-error"><FaExclamationCircle style={{marginRight:6,color:'#d32f2f'}} />{error}</div>}
          {success && <div className="login-success">{success}</div>}
          <button type="submit" className="login-btn" disabled={loading}>{loading ? 'Registering...' : 'Register'}</button>
        </form>
        <div className="login-link" style={{marginTop:18}}>
          <span>Already have an account?</span>
          <button type="button" className="login-register-btn" onClick={() => onNavigate && onNavigate('login')}>Login</button>
        </div>
      </div>
    </div>
  );
}

export default Register;
