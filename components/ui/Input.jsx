'use client';

import React from 'react';

export function Field({ id, label, error, hint, required, children }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const enhanced = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;
    return React.cloneElement(child, {
      id: child.props.id || id,
      'aria-describedby': child.props['aria-describedby'] || describedBy,
      invalid: child.props.invalid ?? Boolean(error),
      required: child.props.required ?? required,
    });
  });

  return (
    <div className="field">
      {label ? (
        <label className="field__label" htmlFor={id}>
          {label}
          {required ? <span className="field__required" aria-hidden="true"> *</span> : null}
        </label>
      ) : null}
      {enhanced}
      {hint && !error ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Select({
  id,
  value,
  onChange,
  invalid = false,
  disabled = false,
  required = false,
  children,
  className = '',
  ...rest
}) {
  const classes = ['input', 'input--select', invalid ? 'input--invalid' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <select
      id={id}
      className={classes}
      value={value}
      onChange={onChange}
      disabled={disabled}
      required={required}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Textarea({
  id,
  value,
  onChange,
  placeholder,
  rows = 4,
  invalid = false,
  disabled = false,
  required = false,
  className = '',
  ...rest
}) {
  const classes = ['input', 'input--textarea', invalid ? 'input--invalid' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <textarea
      id={id}
      className={classes}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      required={required}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export default function Input({
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  invalid = false,
  disabled = false,
  className = '',
  ...rest
}) {
  const classes = ['input', invalid ? 'input--invalid' : '', className].filter(Boolean).join(' ');

  return (
    <input
      id={id}
      type={type}
      className={classes}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}