const TONES = ['neutral', 'accent', 'success', 'warning', 'danger'];
const SIZES = ['sm', 'md'];

export default function Badge({
  children,
  tone = 'neutral',
  size = 'sm',
  className = '',
  ...rest
}) {
  const safeTone = TONES.includes(tone) ? tone : 'neutral';
  const safeSize = SIZES.includes(size) ? size : 'sm';

  const classes = [
    'badge',
    `badge--${safeTone}`,
    `badge--${safeSize}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (children === null || children === undefined || children === false) {
    return null;
  }

  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}