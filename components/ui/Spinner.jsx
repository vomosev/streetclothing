export default function Spinner({ size = 'sm', label = 'Loading' }) {
  const sizeClass = ['sm', 'md', 'lg'].includes(size) ? size : 'sm';

  return (
    <span className={`spinner spinner--${sizeClass}`} role="status" aria-live="polite">
      <svg
        className="spinner__ring"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <circle className="spinner__track" cx="12" cy="12" r="9" fill="none" strokeWidth="3" />
        <circle
          className="spinner__indicator"
          cx="12"
          cy="12"
          r="9"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className="visually-hidden">{label}</span>
    </span>
  );
}