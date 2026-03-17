import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import './Sidebar.css';
import AvatarIcon from './AvatarIcon';
import { FaClinicMedical, FaCog, FaQuestionCircle, FaCommentDots, FaCircle, FaUserCircle, FaPalette, FaLock, FaUpload, FaBook, FaEnvelope, FaStar, FaAngleDoubleLeft, FaAngleDoubleRight } from 'react-icons/fa';
import { ROUTES, STORAGE_KEYS } from '../constants';

const navItems = [
  { key: ROUTES.DASHBOARD, label: 'Dashboard', icon: <FaClinicMedical style={{marginRight:8}}/> },
  { key: ROUTES.APPOINTMENTS, label: 'Appointments', icon: <FaClinicMedical style={{marginRight:8}}/> },
  { key: ROUTES.PATIENTS, label: 'Patients', icon: <FaClinicMedical style={{marginRight:8}}/> },
  { key: ROUTES.DOCTORS, label: 'Doctors', icon: <FaClinicMedical style={{marginRight:8}}/> },
  { key: ROUTES.REPORTS, label: 'Reports', icon: <FaClinicMedical style={{marginRight:8}}/> },
  { key: ROUTES.MEDICAL_RECORDS, label: 'Medical Records', icon: <FaClinicMedical style={{marginRight:8}}/> },
  { key: ROUTES.INNOVATION_LAB, label: 'Innovation Lab', icon: <FaClinicMedical style={{marginRight:8}}/> },
];

const shortcuts = [
  { key: 'settings', label: 'Settings', icon: <FaCog /> },
  { key: 'help', label: 'Help', icon: <FaQuestionCircle /> },
  { key: 'feedback', label: 'Feedback', icon: <FaCommentDots /> },
];

const RECENT_ROUTES_KEY = 'recent_routes';
const SIDEBAR_COLLAPSED_KEY = 'sidebar_collapsed';

const getRouteLabel = (routeKey) => {
  return navItems.find((item) => item.key === routeKey)?.label || routeKey;
};

const getStoredTheme = () => {
  return localStorage.getItem(STORAGE_KEYS.THEME) === 'slate' ? 'slate' : 'light';
};

const readRecentRoutes = () => {
  try {
    const raw = localStorage.getItem(RECENT_ROUTES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, 4) : [];
  } catch {
    return [];
  }
};

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPage = location.pathname.slice(1) || ROUTES.DASHBOARD; // Remove leading slash
  
  // Mock user  
  const user = { name: 'hiendepzai', online: true };
  const [modal, setModal] = useState(null);
  const [activeTheme, setActiveTheme] = useState(getStoredTheme);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
  const [avatar, setAvatar] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [recentRoutes, setRecentRoutes] = useState(readRecentRoutes);

  React.useEffect(() => {
    if (!currentPage) return;
    setRecentRoutes((previous) => {
      const next = [currentPage, ...previous.filter((route) => route !== currentPage)].slice(0, 4);
      localStorage.setItem(RECENT_ROUTES_KEY, JSON.stringify(next));
      return next;
    });
  }, [currentPage]);

  const applyTheme = React.useCallback((nextTheme) => {
    const resolvedTheme = nextTheme === 'slate' ? 'slate' : 'light';
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    localStorage.setItem(STORAGE_KEYS.THEME, resolvedTheme);
    setActiveTheme(resolvedTheme);
    window.dispatchEvent(new CustomEvent('app-theme:changed', { detail: { theme: resolvedTheme } }));
  }, []);

  React.useEffect(() => {
    applyTheme(getStoredTheme());
  }, [applyTheme]);

  React.useEffect(() => {
    const onThemeChanged = (event) => {
      const nextTheme = event?.detail?.theme;
      if (nextTheme === 'light' || nextTheme === 'slate') {
        setActiveTheme(nextTheme);
      }
    };

    window.addEventListener('app-theme:changed', onThemeChanged);
    return () => window.removeEventListener('app-theme:changed', onThemeChanged);
  }, []);

  React.useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  // Nội dung modal cho từng shortcut
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [rating, setRating] = useState(0);
  const [faqOpen, setFaqOpen] = useState(false);

  const closeModal = React.useCallback(() => setModal(null), []);

  React.useEffect(() => {
    if (!modal) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [modal, closeModal]);

  const modalContent = {
    settings: {
      title: 'Settings',
      content: (
        <div style={{display:'grid',gridTemplateColumns:'40px 1fr 1fr',rowGap:18,columnGap:10,alignItems:'center'}}>
          {/* Avatar upload row */}
          <span style={{justifySelf:'center'}}>
            {avatar ? (
              <img src={avatar} alt="avatar" style={{width:32,height:32,borderRadius:'50%',objectFit:'cover',border:'2px solid var(--brand-500)',cursor:'pointer'}} onClick={()=>document.getElementById('avatar-upload').click()} />
            ) : (
              <FaUserCircle size={32} style={{color:'var(--brand-500)',cursor:'pointer'}} onClick={()=>document.getElementById('avatar-upload').click()} />
            )}
          </span>
          <span style={{fontWeight:600}}>Avatar</span>
          <label style={{padding:'4px 10px',borderRadius:6,border:'1px solid var(--brand-500)',background:'var(--brand-100)',color:'var(--brand-500)',fontWeight:600,display:'flex',alignItems:'center',gap:4,cursor:'pointer',justifySelf:'start'}}>
            <FaUpload/>Upload
            <input id="avatar-upload" type="file" accept="image/*" style={{display:'none'}}
              onChange={e => {
                const file = e.target.files[0];
                if (file) {
                  setUploading(true);
                  const reader = new FileReader();
                  reader.onload = () => {
                    setAvatar(reader.result);
                    setUploading(false);
                  };
                  reader.readAsDataURL(file);
                }
              }}
              disabled={uploading}
            />
          </label>
          {/* Change password row */}
          <span style={{justifySelf:'center'}}>
            <FaLock style={{color:'var(--brand-500)',cursor:'pointer'}} onClick={()=>setShowChangePwd(s=>!s)} />
          </span>
          <span style={{fontWeight:600}}>Change Password</span>
          <button title="Change password" style={{padding:'4px 10px',borderRadius:6,border:'1px solid var(--brand-500)',background:'var(--brand-100)',color:'var(--brand-500)',fontWeight:600,display:'flex',alignItems:'center',gap:4,justifySelf:'start'}} onClick={()=>setShowChangePwd(s=>!s)}><FaLock/>Change</button>
          {/* Change password form row (full width) */}
          {showChangePwd && (
            <div style={{gridColumn:'2/4',marginLeft:0}}>
              <form onSubmit={e => {
                e.preventDefault();
                setPwdLoading(true);
                setTimeout(() => {
                  setPwdLoading(false);
                  setShowChangePwd(false);
                  setNewPwd('');
                  alert('Password changed!');
                }, 1200);
              }} style={{display:'flex',alignItems:'center',gap:10}}>
                <input type="password" value={newPwd} onChange={e=>setNewPwd(e.target.value)} placeholder="New password" style={{padding:'4px 10px',borderRadius:6,border:'1px solid var(--surface-border)'}} required />
                <button type="submit" style={{padding:'4px 10px',borderRadius:6,border:'1px solid var(--brand-500)',background:'var(--brand-500)',color:'#fff',fontWeight:600}} disabled={pwdLoading}>{pwdLoading ? 'Saving...' : 'Save'}</button>
              </form>
            </div>
          )}
          {/* Theme switcher row */}
          <span style={{justifySelf:'center'}}>
            <FaPalette style={{color:'var(--brand-500)',cursor:'pointer'}} onClick={()=>applyTheme(activeTheme === 'light' ? 'slate' : 'light')} />
          </span>
          <span style={{fontWeight:600}}>Theme</span>
          <div style={{display:'flex',gap:8}}>
            <button title="Light mode" style={{padding:'4px 10px',borderRadius:6,border:'1px solid var(--brand-500)',background:activeTheme==='light'?'#fff':'var(--brand-100)',color:'var(--brand-500)',fontWeight:600,boxShadow:activeTheme==='light'?'0 0 0 2px var(--brand-500)':''}} onClick={()=>applyTheme('light')}>Light</button>
            <button title="Slate mode" style={{padding:'4px 10px',borderRadius:6,border:'1px solid var(--brand-500)',background:activeTheme==='slate'?'#2d3f4d':'var(--brand-100)',color:activeTheme==='slate'?'#fff':'var(--brand-500)',fontWeight:600,boxShadow:activeTheme==='slate'?'0 0 0 2px var(--brand-500)':''}} onClick={()=>applyTheme('slate')}>Slate</button>
          </div>
        </div>
      )
    },
    help: {
      title: 'Help',
      content: (
        <div style={{display:'grid',gridTemplateColumns:'40px 1fr 1fr',rowGap:18,columnGap:10,alignItems:'center',fontSize:15}}>
          {/* How to use row */}
          <span style={{justifySelf:'center'}}><FaQuestionCircle style={{color:'var(--brand-500)'}}/></span>
          <span style={{fontWeight:600}}>How to use</span>
          <div style={{display:'flex',justifyContent:'flex-start'}}>
            <button onClick={()=>setFaqOpen(f=>!f)} style={{background:'var(--brand-100)',color:'var(--brand-500)',border:'none',borderRadius:6,padding:'6px 14px',fontWeight:600,cursor:'pointer'}}>{faqOpen ? 'Hide FAQ' : 'Show FAQ'}</button>
          </div>
          {/* FAQ row (full width) */}
          {faqOpen && (
            <div style={{gridColumn:'2/4',marginLeft:0,display:'flex',flexDirection:'column',alignItems:'center',width:'100%',padding:'8px 0'}}>
              <div style={{fontWeight:700,marginBottom:12,fontSize:'1.08rem',color:'var(--brand-500)',textAlign:'center'}}>Frequently Asked Questions</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr',rowGap:10,width:'90%',maxWidth:320}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:15}}>
                  <span style={{color:'#333'}}>Use the sidebar to navigate between pages.</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:15}}>
                  <span style={{color:'#333'}}>Click <b>Book New Appointment</b> to create a new schedule.</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:15}}>
                  <span style={{color:'#333'}}>Use the controls on each page to filter/search.</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:15}}>
                  <span style={{color:'#333'}}>Go to <b>Patients &gt; Add Patient</b></span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:15}}>
                  <span style={{color:'#333'}}>Go to <b>Reports &gt; Export CSV</b></span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:15}}>
                  <span style={{color:'#333'}}>Email <span style={{color:'var(--brand-500)'}}>support@clinic.com</span></span>
                </div>
              </div>
            </div>
          )}
          {/* Docs row */}
          <span style={{justifySelf:'center'}}><FaBook style={{color:'var(--brand-500)'}}/></span>
          <span style={{fontWeight:600}}>Documentation</span>
          <button style={{background:'var(--brand-100)',color:'var(--brand-500)',border:'none',borderRadius:6,padding:'6px 14px',fontWeight:600,cursor:'pointer',justifySelf:'start',textDecoration:'underline'}} onClick={()=>window.open('https://clinic-docs.example.com','_blank')}>View Docs</button>
          {/* Email row */}
          <span style={{justifySelf:'center'}}><FaEnvelope style={{color:'var(--brand-500)'}}/></span>
          <span style={{fontWeight:600}}>Support</span>
          <button style={{background:'none',color:'var(--brand-500)',border:'none',borderRadius:6,padding:'0',fontWeight:600,cursor:'pointer',justifySelf:'start',textDecoration:'underline'}} onClick={()=>window.open('mailto:support@clinic.com')}>support@clinic.com</button>
        </div>
      )
    },
    feedback: {
      title: 'Feedback',
      content: (
        <form onSubmit={e => {
          e.preventDefault();
          setFeedbackLoading(true);
          setTimeout(() => {
            setFeedbackLoading(false);
            setFeedbackHistory(h => [...h, { text: feedbackText, rating }]);
            setFeedbackText('');
            setRating(0);
            alert('Thank you for your feedback!');
          }, 900);
        }} style={{display:'flex',flexDirection:'column',gap:12}}>
          <div><b>Your feedback:</b></div>
          <textarea value={feedbackText} onChange={e=>setFeedbackText(e.target.value)} rows={4} style={{width:'100%',borderRadius:6,border:'1px solid var(--surface-border)',padding:8}} placeholder="Type your feedback here..." />
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontWeight:600}}>Rating:</span>
            {[1,2,3,4,5].map(star => (
              <FaStar key={star} style={{color: star <= rating ? 'var(--warning-fg)' : '#eee',cursor:'pointer',fontSize:20}} onClick={()=>setRating(star)} />
            ))}
          </div>
          <button type="submit" style={{background:'var(--brand-500)',color:'#fff',border:'none',borderRadius:6,padding:'6px 18px',fontWeight:600,cursor:'pointer',opacity:feedbackLoading?0.7:1}} disabled={feedbackLoading}>{feedbackLoading ? 'Sending...' : 'Send'}</button>
          {feedbackHistory.length > 0 && (
            <div style={{marginTop:10}}>
              <div style={{fontWeight:600}}>Your previous feedback:</div>
              <ul style={{margin:'8px 0 0 18px',padding:0}}>
                {feedbackHistory.map((f,idx) => (
                  <li key={idx} style={{fontSize:14}}>
                    <span style={{color:'var(--brand-500)',fontWeight:600}}>{f.text}</span> <span style={{color:'var(--warning-fg)'}}>{'★'.repeat(f.rating)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>
      )
    }
  };

  return (
    <aside className={`sidebar${collapsed ? ' is-collapsed' : ''}`}>
      <button
        type="button"
        className="sidebar-collapse-btn"
        onClick={() => setCollapsed((prev) => !prev)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <FaAngleDoubleRight /> : <FaAngleDoubleLeft />}
      </button>
      <div className="sidebar-logo">
        <FaClinicMedical size={32} style={{marginBottom:8}}/>
      </div>
      <div className="sidebar-title">Clinic Management</div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.key}
            className={`sidebar-link${currentPage === item.key ? ' active' : ''}`}
            onClick={() => navigate(`/${item.key}`)}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: collapsed ? 'center' : 'left', cursor: 'pointer', display:'flex', alignItems:'center', gap:8 }}
          >
            {item.icon}<span className="sidebar-link-label">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-user">
          <AvatarIcon name={user.name} size={36} />
          <div style={{marginLeft:10}}>
            <div style={{fontWeight:600, fontSize:15}}>{user.name}</div>
            <div style={{display:'flex',alignItems:'center',gap:4,fontSize:13}}>
              <FaCircle color={user.online ? 'var(--success-fg)' : 'var(--danger-fg)'} style={{fontSize:10}}/>
              <span style={{color:user.online?'var(--success-fg)':'var(--danger-fg)'}}>{user.online ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        </div>
        <div className="sidebar-shortcuts">
          {shortcuts.map(s => (
            <button key={s.key} className="sidebar-shortcut-btn" title={s.label} onClick={() => setModal(s.key)}>
              {s.icon}
            </button>
          ))}
        </div>
        <div className="sidebar-recents" aria-label="Recently visited modules">
          <div className="sidebar-recents-title">Recent</div>
          <div className="sidebar-recents-list">
            {recentRoutes.map((route) => (
              <button
                key={route}
                type="button"
                className="sidebar-recent-chip"
                onClick={() => navigate(`/${route}`)}
              >
                {getRouteLabel(route)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Modal popup cho shortcut */}
      {modal && createPortal(
        <div className="sidebar-modal-overlay" onClick={closeModal}>
          <div className="sidebar-modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3 className="sidebar-modal-title">{modalContent[modal]?.title}</h3>
            <div className="sidebar-modal-body">{modalContent[modal]?.content}</div>
            <button className="sidebar-modal-close" onClick={closeModal}>Close</button>
          </div>
        </div>,
        document.body
      )}
    </aside>
  );
}
