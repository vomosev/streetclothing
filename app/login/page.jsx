'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import Card, { CardBody, CardFooter, CardHeader } from '../../components/ui/Card';
import Input, { Field } from '../../components/ui/Input';
import Button from '../../components/ui/Button';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, status, login } = useAuth();

  const nextParam = searchParams?.get('next');
  const nextPath = nextParam && nextParam.startsWith('/') ? nextParam : '/account';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'ready' && user) {
      router.replace(nextPath);
    }
  }, [status, user, router, nextPath]);

  function validate() {
    const errors = {};
    const trimmed = email.trim();
    if (!trimmed) {
      errors.email = 'Enter the email you joined with.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      errors.email = 'That email address does not look right.';
    }
    if (!password) {
      errors.password = 'Enter your password.';
    } else if (password.length < 8) {
      errors.password = 'Passwords are at least 8 characters.';
    }
    return errors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    setFormError('');
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      router.replace(nextPath);
    } catch (err) {
      const statusCode = err && err.status;
      if (statusCode === 401) {
        setFormError('Those details did not match an account. Check your email and password.');
      } else if (statusCode === 429) {
        setFormError('Too many attempts. Wait a minute and try again.');
      } else if (statusCode === 400) {
        setFormError((err && err.message) || 'Please check the details you entered.');
      } else {
        setFormError(
          (err && err.message) ||
            'We could not reach the store right now. Try again in a moment.'
        );
      }
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-page stack">
      <Card className="auth-card">
        <CardHeader>
          <h1>Sign in</h1>
          <p>
            Welcome back. Sign in to track orders, manage your Street Pass membership and get
            first access to every drop.
          </p>
        </CardHeader>

        <CardBody>
          <form className="form stack" onSubmit={handleSubmit} noValidate>
            <div className="form-status" role="alert" aria-live="polite">
              {formError ? <p className="form-error user-text">{formError}</p> : null}
            </div>

            <Field
              id="login-email"
              label="Email address"
              error={fieldErrors.email}
              hint="The address you used when you joined."
            >
              <Input
                id="login-email"
                type="email"
                name="email"
                value={email}
                autoComplete="email"
                placeholder="you@example.com"
                invalid={Boolean(fieldErrors.email)}
                required
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
              />
            </Field>

            <Field id="login-password" label="Password" error={fieldErrors.password}>
              <Input
                id="login-password"
                type="password"
                name="password"
                value={password}
                autoComplete="current-password"
                placeholder="At least 8 characters"
                invalid={Boolean(fieldErrors.password)}
                required
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }
                }}
              />
            </Field>

            <Button type="submit" variant="primary" size="lg" fullWidth loading={submitting}>
              {submitting ? 'Signing in' : 'Sign in'}
            </Button>
          </form>
        </CardBody>

        <CardFooter>
          <p>
            New here? <Link href="/signup">Create an account</Link> and join the Street Pass list.
          </p>
        </CardFooter>
      </Card>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <section className="auth-page stack">
          <Card className="auth-card">
            <CardBody>
              <p>Loading the sign-in form…</p>
            </CardBody>
          </Card>
        </section>
      }
    >
      <LoginForm />
    </Suspense>
  );
}