'use client';

import { useActionState } from 'react';

import { forgotPasswordAction, type ForgotState } from '../actions';
import {
  alertClass,
  alertStyle,
  fieldClass,
  formButtonClass,
  labelClass,
  noticeStyle,
} from '../form-styles';

export function ForgotPasswordForm({ csrf }: { csrf: string }) {
  const [state, action, pending] = useActionState<ForgotState, FormData>(
    forgotPasswordAction,
    {},
  );

  if (state.done)
    return (
      <p className={alertClass} style={noticeStyle} role="status">
        If an account exists for that email, a reset link is on its way. The
        link expires in one hour. In development it is written to the server
        console.
      </p>
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

      <button type="submit" disabled={pending} className={formButtonClass}>
        {pending ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  );
}
