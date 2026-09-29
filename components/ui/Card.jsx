function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function CardHeader({ className, children, ...rest }) {
  return (
    <div className={cx('card__header', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardBody({ className, children, ...rest }) {
  return (
    <div className={cx('card__body', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...rest }) {
  return (
    <div className={cx('card__footer', className)} {...rest}>
      {children}
    </div>
  );
}

export default function Card({
  as: Component = 'div',
  interactive = false,
  padded = true,
  className,
  children,
  ...rest
}) {
  const Tag = Component || 'div';
  const classes = cx(
    'card',
    padded ? 'card--padded' : 'card--flush',
    interactive ? 'card--interactive' : null,
    className
  );

  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}