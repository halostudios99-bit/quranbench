'use client';

import { useActionState } from 'react';

import { signupAction, type AuthFormState } from '../actions';
import {
  alertClass,
  alertStyle,
  fieldClass,
  formButtonClass,
  labelClass,
} from '../form-styles';

export function SignupForm({
  terms,
  termsVersion,
}: {
  terms: React.ReactNode;
  termsVersion: string;
}) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    signupAction,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
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
        <label htmlFor="handle" className={labelClass}>
          Public handle
        </label>
        <input
          id="handle"
          name="handle"
          type="text"
          autoComplete="username"
          required
          defaultValue={state.values?.handle}
          className={fieldClass}
          aria-describedby="handle-hint"
        />
        <span id="handle-hint" className="text-[13px] text-ink3">
          Permanent and public. Lowercase letters, digits, hyphen or underscore.
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="displayName" className={labelClass}>
          Real name <span className="text-ink3">(optional)</span>
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          autoComplete="name"
          defaultValue={state.values?.displayName}
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
          autoComplete="new-password"
          required
          minLength={8}
          className={fieldClass}
          aria-describedby="password-hint"
        />
        <span id="password-hint" className="text-[13px] text-ink3">
          At least 8 characters.
        </span>
      </div>

      <fieldset className="flex flex-col gap-2 rounded-md border border-line bg-soft p-3">
        <legend className="px-1 text-[13px] font-medium text-ink2">
          Contributor terms · version {termsVersion}
        </legend>
        <div className="max-h-64 overflow-y-auto rounded border border-line bg-panel px-4 py-3 text-[14px]">
          {terms}
        </div>
        <label className="mt-1 flex items-start gap-2.5 text-[14px] text-ink">
          <input
            type="checkbox"
            name="acceptTerms"
            required
            className="mt-1 h-4 w-4 accent-[var(--accent)]"
          />
          <span>
            I have read and accept the contributor terms (version {termsVersion}). My
            acceptance is recorded with this version and the current time.
          </span>
        </label>
      </fieldset>

      <button type="submit" disabled={pending} className={formButtonClass}>
        {pending ? 'Creating account…' : 'Create account'}
      </button>
      <p className="text-[14px] text-ink2">
        Already have an account?{' '}
        <a href="/signin" className="text-accent underline">
          Sign in
        </a>
        .
      </p>
    </form>
  );
}
