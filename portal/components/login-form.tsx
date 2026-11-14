"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Icon } from "./brand";
function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="button" type="submit" disabled={pending}>
      {pending ? "Checking your account…" : "Sign in securely"}
      <Icon name={pending ? "lock" : "arrow"} />
    </button>
  );
}
export function LoginForm() {
  const [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="auth-form"
      action="/auth/login"
      method="post"
      aria-busy={busy}
      onSubmit={() => setBusy(true)}
    >
      <label htmlFor="clinician-email">
        Email address
        <input
          id="clinician-email"
          type="email"
          name="email"
          required
          autoComplete="username"
          placeholder="you@practice.com"
          maxLength={320}
        />
      </label>
      <label htmlFor="clinician-password">
        Password
        <span className="password-field">
          <input
            id="clinician-password"
            aria-label="Password"
            type={visible ? "text" : "password"}
            name="password"
            required
            autoComplete="current-password"
            maxLength={1024}
          />
          <button
            type="button"
            className="password-toggle"
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            {visible ? "Hide" : "Show"}
          </button>
        </span>
      </label>
      {busy ? (
        <button className="button" type="submit" disabled>
          Checking your account…
        </button>
      ) : (
        <Submit />
      )}
    </form>
  );
}
