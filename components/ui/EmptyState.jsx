export default function EmptyState({ title, description, action, icon, tone = 'neutral' }) {
  return (
    <div className={`empty-state empty-state--${tone}`} role="status">
      <span className="empty-state__glyph" aria-hidden="true">
        {icon || (
          <svg viewBox="0 0 48 48" width="48" height="48" focusable="false">
            <rect
              x="6"
              y="12"
              width="36"
              height="26"
              rx="4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M6 20h36"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M17 28h14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="12" cy="16" r="1.5" fill="currentColor" />
            <circle cx="17" cy="16" r="1.5" fill="currentColor" />
          </svg>
        )}
      </span>

      <h3 className="empty-state__title">{title || 'Nothing here yet'}</h3>

      {description ? (
        <p className="empty-state__description user-text">{description}</p>
      ) : null}

      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}