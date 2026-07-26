'use client';

import { useActionState } from 'react';

import { resetPasswordAction, type ResetState } from '../actions';
import {
  alertClass,
  alertStyle,
  fieldClass,
  formButtonClass,
  labelClass,
} from '../form-styles';

export function ResetPasswordForm({
  csrf,
  token,
}: {
  csrf: string;
  token: string;
}) {
  const [state, action, pending] = useActionState<ResetState, FormData>(
    resetPasswordAction,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="csrf" value={csrf} />
      <input type="hidden" name="token" value={state.values?.token ?? token} />
      {state.error ? (
        <p role="alert" className={alertClass} style={alertStyle}>
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className={labelClass}>
          New password
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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm" className={labelClass}>
          Confirm new password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={fieldClass}
        />
      </div>

      <button type="submit" disabled={pending} className={formButtonClass}>
        {pending ? 'Saving…' : 'Set new password'}
      </button>
    </form>
  );
}
