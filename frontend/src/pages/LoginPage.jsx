import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Field from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import Notice from '../components/ui/Notice';
import { PAGE_TITLE, SECTION_TITLE, cx } from '../lib/classes';
import { useLibraryStore } from '../store/library';

function validate({ username, password }) {
  const errors = {};
  if (!username.trim()) errors.username = 'Enter your username.';
  if (!password) errors.password = 'Enter your password.';
  return errors;
}

// The design system has no sign-in screen, so this page only composes its existing parts:
// Card, Field, Input, a primary Button and the Notice banner.
export default function LoginPage() {
  const token = useLibraryStore((state) => state.token);
  const notice = useLibraryStore((state) => state.notice);
  const login = useLibraryStore((state) => state.login);
  const location = useLocation();

  const [values, setValues] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Signed in (or just signed in): go back to the page that sent us here.
  if (token) {
    return <Navigate to={location.state?.from?.pathname || '/'} replace />;
  }

  const onChange = (event) => setValues({ ...values, [event.target.name]: event.target.value });

  const onSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    setServerError('');
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await login(values.username.trim(), values.password);
    } catch (err) {
      setServerError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col justify-center gap-6 px-6 py-12">
      <h1 className={cx(PAGE_TITLE, 'text-center')}>Vartama Library</h1>
      {notice && <Notice>{notice}</Notice>}
      <Card as="form" noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <h2 className={SECTION_TITLE}>Sign in</h2>
        {serverError && <Notice tone="danger">{serverError}</Notice>}
        <Field id="username" label="Username" error={errors.username}>
          <Input name="username" autoComplete="username" value={values.username} onChange={onChange} />
        </Field>
        <Field id="password" label="Password" error={errors.password}>
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
            value={values.password}
            onChange={onChange}
          />
        </Field>
        <Button type="submit" disabled={submitting} className="mt-2 w-full">
          Sign in
        </Button>
      </Card>
    </div>
  );
}
