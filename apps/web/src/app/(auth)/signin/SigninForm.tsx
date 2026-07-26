'use client';

import { useActionState } from 'react';

import { signinAction, type AuthFormState } from '../actions';
import {
  alertClass,
  alertStyle,
  fieldClass,
  formButtonClass,
  labelClass,
} from '../form-styles';

export function SigninForm({ csrf }: { csrf: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    signinAction,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="csrf" value={csrf} />
      {state.error ? (
        <p role="alert" className={alertClass} style={alertStyle}>
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email}
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className={labelClass}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={fieldClass}
        />
      </div>

      <button type="submit" disabled={pending} className={formButtonClass}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-[14px] text-ink2">
        No account yet?{' '}
        <a href="/signup" className="text-accent underline">
          Create one
        </a>
        .
      </p>
    </form>
  );
}
