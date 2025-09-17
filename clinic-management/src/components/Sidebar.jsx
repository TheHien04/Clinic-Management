           <button style={{background:'#e3f2fd',color:'#1976d2',border:'none',borderRadius:6,padding:'6px 14px',fontWeight:600,cursor:'pointer',textDecoration:'underline'}} onClick={()=>window.open('docs/manual.html','_blank')}>View Docs</button>
import React, { useState } from 'react';
import './Sidebar.css';
import AvatarIcon from './AvatarIcon';
import { FaClinicMedical, FaCog, FaQuestionCircle, FaCommentDots, FaCircle, FaUserCircle, FaPalette, FaLock, FaUpload, FaBook, FaEnvelope, FaStar } from 'react-icons/fa';

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: <FaClinicMedical style={{marginRight:8}}/> },
  { key: 'appointments', label: 'Appointments', icon: <FaClinicMedical style={{marginRight:8}}/> },
  { key: 'patients', label: 'Patients', icon: <FaClinicMedical style={{marginRight:8}}/> },
  { key: 'doctors', label: 'Doctors', icon: <FaClinicMedical style={{marginRight:8}}/> },
  { key: 'reports', label: 'Reports', icon: <FaClinicMedical style={{marginRight:8}}/> },
];

const shortcuts = [
  { key: 'settings', label: 'Settings', icon: <FaCog /> },
  { key: 'help', label: 'Help', icon: <FaQuestionCircle /> },
  { key: 'feedback', label: 'Feedback', icon: <FaCommentDots /> },
];

export default function Sidebar({ onNavigate, currentPage }) {
  // Mock user
  const user = { name: 'hiendepzai', online: true };
  const [modal, setModal] = useState(null);
  const [theme, setTheme] = useState('light');
  const [avatar, setAvatar] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  // Đổi theme cho app
  React.useEffect(() => {
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  // Nội dung modal cho từng shortcut
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [rating, setRating] = useState(0);
  const [faqOpen, setFaqOpen] = useState(false);
  const modalContent = {
    settings: {
      title: 'Settings',
      content: (
        <div style={{display:'grid',gridTemplateColumns:'40px 1fr 1fr',rowGap:18,columnGap:10,alignItems:'center'}}>
          {/* Avatar upload row */}
          <span style={{justifySelf:'center'}}>
            {avatar ? (
              <img src={avatar} alt="avatar" style={{width:32,height:32,borderRadius:'50%',objectFit:'cover',border:'2px solid #1976d2',cursor:'pointer'}} onClick={()=>document.getElementById('avatar-upload').click()} />
            ) : (
              <FaUserCircle size={32} style={{color:'#1976d2',cursor:'pointer'}} onClick={()=>document.getElementById('avatar-upload').click()} />
            )}
          </span>
          <span style={{fontWeight:600}}>Avatar</span>
          <label style={{padding:'4px 10px',borderRadius:6,border:'1px solid #1976d2',background:'#e3f2fd',color:'#1976d2',fontWeight:600,display:'flex',alignItems:'center',gap:4,cursor:'pointer',justifySelf:'start'}}>
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
            <FaLock style={{color:'#1976d2',cursor:'pointer'}} onClick={()=>setShowChangePwd(s=>!s)} />
          </span>
          <span style={{fontWeight:600}}>Change Password</span>
          <button title="Change password" style={{padding:'4px 10px',borderRadius:6,border:'1px solid #1976d2',background:'#e3f2fd',color:'#1976d2',fontWeight:600,display:'flex',alignItems:'center',gap:4,justifySelf:'start'}} onClick={()=>setShowChangePwd(s=>!s)}><FaLock/>Change</button>
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
                <input type="password" value={newPwd} onChange={e=>setNewPwd(e.target.value)} placeholder="New password" style={{padding:'4px 10px',borderRadius:6,border:'1px solid #b0bec5'}} required />
                <button type="submit" style={{padding:'4px 10px',borderRadius:6,border:'1px solid #1976d2',background:'#1976d2',color:'#fff',fontWeight:600}} disabled={pwdLoading}>{pwdLoading ? 'Saving...' : 'Save'}</button>
              </form>
            </div>
          )}
          {/* Theme switcher row */}
          <span style={{justifySelf:'center'}}>
            <FaPalette style={{color:'#1976d2',cursor:'pointer'}} onClick={()=>setTheme(theme==='light'?'dark':'light')} />
          </span>
          <span style={{fontWeight:600}}>Theme</span>
          <div style={{display:'flex',gap:8}}>
            <button title="Light mode" style={{padding:'4px 10px',borderRadius:6,border:'1px solid #1976d2',background:theme==='light'?'#fff':'#e3f2fd',color:'#1976d2',fontWeight:600,boxShadow:theme==='light'?'0 0 0 2px #1976d2':''}} onClick={()=>setTheme('light')}>Light</button>
            <button title="Dark mode" style={{padding:'4px 10px',borderRadius:6,border:'1px solid #1976d2',background:theme==='dark'?'#333':'#e3f2fd',color:theme==='dark'?'#fff':'#1976d2',fontWeight:600,boxShadow:theme==='dark'?'0 0 0 2px #1976d2':''}} onClick={()=>setTheme('dark')}>Dark</button>
          </div>
        </div>
      )
    },
    help: {
      title: 'Help',
      content: (
        <div style={{display:'grid',gridTemplateColumns:'40px 1fr 1fr',rowGap:18,columnGap:10,alignItems:'center',fontSize:15}}>
          {/* How to use row */}
          <span style={{justifySelf:'center'}}><FaQuestionCircle style={{color:'#1976d2'}}/></span>
          <span style={{fontWeight:600}}>How to use</span>
          <div style={{display:'flex',justifyContent:'flex-start'}}>
            <button onClick={()=>setFaqOpen(f=>!f)} style={{background:'#e3f2fd',color:'#1976d2',border:'none',borderRadius:6,padding:'6px 14px',fontWeight:600,cursor:'pointer'}}>{faqOpen ? 'Hide FAQ' : 'Show FAQ'}</button>
          </div>
          {/* FAQ row (full width) */}
          {faqOpen && (
            <div style={{gridColumn:'2/4',marginLeft:0,display:'flex',flexDirection:'column',alignItems:'center',width:'100%',padding:'8px 0'}}>
              <div style={{fontWeight:700,marginBottom:12,fontSize:'1.08rem',color:'#1976d2',textAlign:'center'}}>Frequently Asked Questions</div>
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
                  <span style={{color:'#333'}}>Email <span style={{color:'#1976d2'}}>support@clinic.com</span></span>
                </div>
              </div>
            </div>
          )}
          {/* Docs row */}
          <span style={{justifySelf:'center'}}><FaBook style={{color:'#1976d2'}}/></span>
          <span style={{fontWeight:600}}>Documentation</span>
          <button style={{background:'#e3f2fd',color:'#1976d2',border:'none',borderRadius:6,padding:'6px 14px',fontWeight:600,cursor:'pointer',justifySelf:'start',textDecoration:'underline'}} onClick={()=>window.open('https://clinic-docs.example.com','_blank')}>View Docs</button>
          {/* Email row */}
          <span style={{justifySelf:'center'}}><FaEnvelope style={{color:'#1976d2'}}/></span>
          <span style={{fontWeight:600}}>Support</span>
          <button style={{background:'none',color:'#1976d2',border:'none',borderRadius:6,padding:'0',fontWeight:600,cursor:'pointer',justifySelf:'start',textDecoration:'underline'}} onClick={()=>window.open('mailto:support@clinic.com')}>support@clinic.com</button>
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
          <textarea value={feedbackText} onChange={e=>setFeedbackText(e.target.value)} rows={4} style={{width:'100%',borderRadius:6,border:'1px solid #b0bec5',padding:8}} placeholder="Type your feedback here..." />
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontWeight:600}}>Rating:</span>
            {[1,2,3,4,5].map(star => (
              <FaStar key={star} style={{color: star <= rating ? '#fbc02d' : '#eee',cursor:'pointer',fontSize:20}} onClick={()=>setRating(star)} />
            ))}
          </div>
          <button type="submit" style={{background:'#1976d2',color:'#fff',border:'none',borderRadius:6,padding:'6px 18px',fontWeight:600,cursor:'pointer',opacity:feedbackLoading?0.7:1}} disabled={feedbackLoading}>{feedbackLoading ? 'Sending...' : 'Send'}</button>
          {feedbackHistory.length > 0 && (
            <div style={{marginTop:10}}>
              <div style={{fontWeight:600}}>Your previous feedback:</div>
              <ul style={{margin:'8px 0 0 18px',padding:0}}>
                {feedbackHistory.map((f,idx) => (
                  <li key={idx} style={{fontSize:14}}>
                    <span style={{color:'#1976d2',fontWeight:600}}>{f.text}</span> <span style={{color:'#fbc02d'}}>{'★'.repeat(f.rating)}</span>
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
    <aside className="sidebar">
      <div className="sidebar-logo">
        <FaClinicMedical size={32} style={{marginBottom:8}}/>
      </div>
      <div className="sidebar-title">Clinic Management</div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.key}
            className={`sidebar-link${currentPage === item.key ? ' active' : ''}`}
            onClick={() => onNavigate && onNavigate(item.key)}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', display:'flex', alignItems:'center', gap:8 }}
          >
            {item.icon}{item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-user">
          <AvatarIcon name={user.name} size={36} />
          <div style={{marginLeft:10}}>
            <div style={{fontWeight:600, fontSize:15}}>{user.name}</div>
            <div style={{display:'flex',alignItems:'center',gap:4,fontSize:13}}>
              <FaCircle color={user.online ? '#43a047' : '#d32f2f'} style={{fontSize:10}}/>
              <span style={{color:user.online?'#43a047':'#d32f2f'}}>{user.online ? 'Online' : 'Offline'}</span>
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
      </div>

      {/* Modal popup cho shortcut */}
      {modal && (
        <div style={{position:'fixed',top:0,left:0,width:'100vw',height:'100vh',background:'rgba(0,0,0,0.18)',zIndex:999,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:'#fff',borderRadius:12,padding:32,minWidth:320,boxShadow:'0 2px 16px rgba(25,118,210,0.13)',maxWidth:400}}>
            <h3 style={{color:'#1976d2',marginBottom:18}}>{modalContent[modal]?.title}</h3>
            <div style={{marginBottom:24}}>{modalContent[modal]?.content}</div>
            <button onClick={()=>setModal(null)} style={{background:'#1976d2',color:'#fff',border:'none',borderRadius:6,padding:'6px 18px',fontWeight:600,cursor:'pointer'}}>Close</button>
          </div>
        </div>
      )}
    </aside>
  );
}
