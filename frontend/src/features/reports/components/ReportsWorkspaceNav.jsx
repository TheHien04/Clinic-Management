import PropTypes from 'prop-types';

const REPORT_VIEWS = [
  ['overview', 'Decision overview'],
  ['care', 'Care workflows'],
  ['research', 'Research & data'],
  ['advanced', 'Advanced tools'],
];

export default function ReportsWorkspaceNav({ activeView, onChange }) {
  return (
    <nav className="reports-view-tabs" aria-label="Report workspace views">
      {REPORT_VIEWS.map(([view, label]) => (
        <button
          key={view}
          type="button"
          className={activeView === view ? 'is-active' : ''}
          aria-pressed={activeView === view}
          onClick={() => onChange(view)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

ReportsWorkspaceNav.propTypes = {
  activeView: PropTypes.oneOf(REPORT_VIEWS.map(([view]) => view)).isRequired,
  onChange: PropTypes.func.isRequired,
};
