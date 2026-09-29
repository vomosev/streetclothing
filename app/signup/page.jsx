'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import Card, { CardBody, CardFooter, CardHeader } from '../../components/ui/Card';
import Input, { Field } from '../../components/ui/Input';
import Button from '../../components/ui/Button';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signup } = useAuth();

  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const nextPath = searchParams?.get('next') || '/account';

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  }

  function validate(values) {
    const errors = {};
    const fullName = values.fullName.trim();
    const email = values.email.trim();

    if (fullName.length < 2) {
      errors.fullName = 'Tell us the name to print on the shipping label.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Enter a valid email address.';
    }
    if (values.password.length < 8) {
      errors.password = 'Use at least 8 characters.';
    }
    return errors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    setFormError('');
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await signup({
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      router.replace(nextPath);
    } catch (err) {
      const status = err && typeof err.status === 'number' ? err.status : 0;
      if (status === 409) {
        setFieldErrors((prev) => ({
          ...prev,
          email: 'That email is already on the list.',
        }));
        setFormError('An account already exists with that email. Sign in instead.');
      } else if (status === 400) {
        setFormError((err && err.message) || 'Check the details above and try again.');
      } else if (status === 0) {
        setFormError('We could not reach the store right now. Try again in a moment.');
      } else {
        setFormError((err && err.message) || 'Sign up failed. Please try again.');
      }
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-page stack">
      <div className="auth-panel">
        <Card>
          <CardHeader>
            <h1>Join the list</h1>
            <p>
              Create a STREET/PLATINUM account to save your bag, track orders and unlock
              member-only colourways before they hit the public drop.
            </p>
          </CardHeader>

          <CardBody>
            <form className="form stack" onSubmit={handleSubmit} noValidate>
              <Field
                id="signup-fullname"
                label="Full name"
                error={fieldErrors.fullName}
                hint="Used on your shipping label."
              >
                <Input
                  id="signup-fullname"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Ada Okonkwo"
                  value={form.fullName}
                  onChange={(event) => update('fullName', event.target.value)}
                  invalid={Boolean(fieldErrors.fullName)}
                  required
                />
              </Field>

              <Field id="signup-email" label="Email" error={fieldErrors.email}>
                <Input
                  id="signup-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(event) => update('email', event.target.value)}
                  invalid={Boolean(fieldErrors.email)}
                  required
                />
              </Field>

              <Field
                id="signup-password"
                label="Password"
                error={fieldErrors.password}
                hint="Minimum 8 characters."
              >
                <Input
                  id="signup-password"
                  name="new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={form.password}
                  onChange={(event) => update('password', event.target.value)}
                  invalid={Boolean(fieldErrors.password)}
                  minLength={8}
                  required
                />
              </Field>

              <div className="form-status" role="status" aria-live="polite">
                {formError ? <p className="form-error user-text">{formError}</p> : null}
              </div>

              <Button type="submit" variant="primary" size="lg" loading={submitting} fullWidth>
                {submitting ? 'Creating account' : 'Create account'}
              </Button>
            </form>
          </CardBody>

          <CardFooter>
            <p className="auth-alt">
              Already have an account? <Link href="/login">Sign in</Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
