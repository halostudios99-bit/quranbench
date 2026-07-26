'use client';

import { useActionState } from 'react';

import { resendVerificationAction, type ResendState } from '../actions';
import { alertClass, noticeStyle } from '../form-styles';

export function ResendVerification({ csrf }: { csrf: string }) {
  const [state, action, pending] = useActionState<ResendState, FormData>(
    resendVerificationAction,
    {},
  );

  if (state.sent)
    return (
      <p className={alertClass} style={noticeStyle} role="status">
        A new verification link has been sent. In development it is written to
        the server console.
      </p>
    );

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="csrf" value={csrf} />
      {state.error ? (
        <p className="text-[14px] text-ink2" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md border border-line px-3 py-2 text-[14px] text-ink hover:border-line2 disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Resend verification email'}
      </button>
    </form>
  );
}
