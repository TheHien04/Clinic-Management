import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaPhoneAlt,
  FaAmbulance,
  FaMapMarkerAlt,
  FaGlobeEurope,
  FaLanguage,
  FaHandshake,
  FaVideo,
  FaRegClock,
  FaRegHospital,
  FaShieldAlt,
} from 'react-icons/fa';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { ROUTES } from '../constants';
import './Common.css';
import './HospitalPortal.css';

const emergencyContacts = [
  { label: 'Emergency Hotline', value: '+84 28 3812 3456', href: 'tel:+842838123456' },
  { label: 'Ambulance Dispatch', value: '+84 28 3812 9115', href: 'tel:+842838129115' },
  { label: 'International Desk', value: '+84 28 3812 7000', href: 'tel:+842838127000' },
];

const coreServices = [
  '24/7 Emergency & Trauma Center',
  'Cardiology, Oncology, Neurology, Pediatrics',
  'Digital Imaging (CT/MRI/Ultrasound)',
  'Same-day laboratory diagnostics',
  'Comprehensive surgery and ICU support',
  'Rehabilitation and preventive care programs',
];

const internationalPrograms = [
  'Visa invitation and treatment itinerary support',
  'Airport transfer coordination and medical transport',
  'Multilingual interpreter service on-site',
  'International insurance pre-authorization workflow',
  'Remote second-opinion consultation for global patients',
  'Family concierge and accommodation guidance',
];

const insurancePartners = [
  'Allianz Care',
  'Aetna International',
  'Cigna Global',
  'Bupa Global',
  'Blue Cross Blue Shield Global',
  'Bao Viet and major local providers',
];

const supportedLanguages = ['English', 'French', 'German', 'Japanese', 'Korean', 'Vietnamese'];

const digitalExperience = [
  {
    title: 'Telehealth Consultations',
    detail: 'Secure video consultations for follow-up, medication reviews, and cross-border specialist advice.',
    icon: <FaVideo />,
  },
  {
    title: 'Online Results Access',
    detail: 'Patients can track labs, prescriptions, and discharge plans in a single digital timeline.',
    icon: <FaShieldAlt />,
  },
  {
    title: 'Live Capacity Signals',
    detail: 'Operational dashboards provide wait-time intelligence and bed occupancy transparency.',
    icon: <FaRegHospital />,
  },
];

export default function HospitalPortal() {
  const navigate = useNavigate();

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-main">
        <Header />
        <main className="hospital-portal-content">
          <section className="hospital-hero">
            <div className="hospital-hero-left">
              <p className="hospital-eyebrow"><FaGlobeEurope /> International Care Network</p>
              <h1>Global Hospital Portal</h1>
              <p>
                One destination for emergency response, specialist care, international patient support,
                and digital-first healthcare coordination.
              </p>
              <div className="hospital-cta-row">
                <button className="hospital-btn hospital-btn-primary" onClick={() => navigate(`/${ROUTES.APPOINTMENTS}`)}>
                  Book Appointment
                </button>
                <button className="hospital-btn hospital-btn-outline" onClick={() => navigate(`/${ROUTES.DOCTORS}`)}>
                  Find Specialist
                </button>
              </div>
            </div>
            <div className="hospital-hero-right">
              <div className="hospital-kpi-card">
                <b>15 min</b>
                <span>Average ER triage target</span>
              </div>
              <div className="hospital-kpi-card">
                <b>24/7</b>
                <span>Emergency and ICU readiness</span>
              </div>
              <div className="hospital-kpi-card">
                <b>45+</b>
                <span>Partner insurers and global payers</span>
              </div>
            </div>
          </section>

          <section className="hospital-grid">
            <article className="hospital-card">
              <h3><FaMapMarkerAlt /> Address & Campus</h3>
              <p>International Medical District, 102 Nguyen Hue Boulevard, District 1, Ho Chi Minh City, Vietnam</p>
              <a href="https://maps.google.com/?q=102+Nguyen+Hue+Boulevard+District+1+Ho+Chi+Minh+City" target="_blank" rel="noreferrer">
                Open in Google Maps
              </a>
              <div className="hospital-map-wrap">
                <iframe
                  title="Hospital location map"
                  src="https://maps.google.com/maps?q=102%20Nguyen%20Hue%20Boulevard%20District%201%20Ho%20Chi%20Minh%20City&t=&z=14&ie=UTF8&iwloc=&output=embed"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </article>

            <article className="hospital-card">
              <h3><FaAmbulance /> Emergency Contacts</h3>
              <ul className="hospital-list">
                {emergencyContacts.map((item) => (
                  <li key={item.label}>
                    <span>{item.label}</span>
                    <a href={item.href}><FaPhoneAlt /> {item.value}</a>
                  </li>
                ))}
              </ul>
              <p className="hospital-note"><FaRegClock /> Emergency desk and trauma teams operate 24/7.</p>
            </article>
          </section>

          <section className="hospital-grid hospital-grid-three">
            <article className="hospital-card">
              <h3>Core Clinical Services</h3>
              <ul className="hospital-bullet-list">
                {coreServices.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </article>

            <article className="hospital-card">
              <h3><FaHandshake /> International Patient Services</h3>
              <ul className="hospital-bullet-list">
                {internationalPrograms.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </article>

            <article className="hospital-card">
              <h3><FaLanguage /> Languages & Insurance</h3>
              <p className="hospital-subtitle">Supported languages</p>
              <div className="hospital-chip-wrap">
                {supportedLanguages.map((lang) => <span key={lang} className="hospital-chip">{lang}</span>)}
              </div>
              <p className="hospital-subtitle">Insurance partners</p>
              <ul className="hospital-bullet-list">
                {insurancePartners.map((partner) => <li key={partner}>{partner}</li>)}
              </ul>
            </article>
          </section>

          <section className="hospital-digital-panel">
            <h3>Digital Care Experience</h3>
            <div className="hospital-digital-grid">
              {digitalExperience.map((item) => (
                <article key={item.title} className="hospital-digital-card">
                  <div className="hospital-digital-icon">{item.icon}</div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
