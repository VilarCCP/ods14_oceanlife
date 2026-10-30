'use client';

import { useState, useTransition } from 'react';

import { signInAction } from '@/app/admin/actions';

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setMessage(null);
    setFieldErrors({});
    startTransition(async () => {
      // Em caso de sucesso a ação redireciona; só voltamos aqui em caso de erro.
      const result = await signInAction({ email: email.trim(), password }, next);
      if (result && !result.ok) {
        setMessage(result.message);
        setFieldErrors(result.fieldErrors ?? {});
        setPassword('');
      }
    });
  }

  const emailError = fieldErrors.email?.[0];
  const passwordError = fieldErrors.password?.[0];

  return (
    <form className="admin-form" onSubmit={submit} noValidate>
      {message ? (
        <p className="admin-flash admin-flash--error" role="alert">
          {message}
        </p>
      ) : null}

      <div className="field">
        <label className="field__label" htmlFor="login-email">
          E-mail
        </label>
        <input
          className="input"
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? 'login-email-erro' : undefined}
        />
        {emailError ? (
          <p className="field__error" id="login-email-erro">
            {emailError}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label className="field__label" htmlFor="login-senha">
          Senha
        </label>
        <input
          className="input"
          id="login-senha"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={passwordError ? 'login-senha-erro' : undefined}
        />
        {passwordError ? (
          <p className="field__error" id="login-senha-erro">
            {passwordError}
          </p>
        ) : null}
      </div>

      <div className="form-actions">
        <button className="button" type="submit" disabled={pending} aria-disabled={pending}>
          {pending ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
    </form>
  );
}
