"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAccount } from "@/components/account/account-provider";

type AuthFormMode = "login" | "register";

type AuthFormProps = {
  mode: AuthFormMode;
};

function errorMessageForStatus(status: number) {
  if (status === 401) return "Email or password is incorrect.";
  if (status === 422) return "That account could not be created.";
  if (status === 400) return "Check the form and try again.";
  return "Something went wrong. Try again in a moment.";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { refreshSession } = useAccount();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === "register";
  const title = isRegister ? "Create account" : "Sign in";
  const submitLabel = isRegister ? "Create account" : "Sign in";
  const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          ...(isRegister ? { passwordConfirmation } : {}),
        }),
      });

      if (!response.ok) {
        setError(errorMessageForStatus(response.status));
        return;
      }

      await refreshSession();
      router.push("/discover");
    } catch {
      setError("Something went wrong. Try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-panel)]">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--muted)]">
            Account
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[color:var(--foreground)]">
            {title}
          </h1>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-[color:var(--muted)]">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="mt-2 h-11 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 text-sm text-[color:var(--foreground)] outline-none transition placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent-soft)]"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-[color:var(--muted)]">
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              minLength={8}
              className="mt-2 h-11 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 text-sm text-[color:var(--foreground)] outline-none transition placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent-soft)]"
            />
          </label>

          {isRegister && (
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-[color:var(--muted)]">
                Confirm password
              </span>
              <input
                type="password"
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                className="mt-2 h-11 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 text-sm text-[color:var(--foreground)] outline-none transition placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent-soft)]"
              />
            </label>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-[color:var(--danger)]/30 bg-[color:var(--down-soft)] px-3 py-2 text-sm text-[color:var(--foreground)]"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-[color:var(--accent)] px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Working..." : submitLabel}
          </button>
        </form>

        <p className="mt-5 text-sm text-[color:var(--muted)]">
          {isRegister ? "Already have an account?" : "New to CryptDash?"}{" "}
          <Link
            href={isRegister ? "/login" : "/register"}
            className="font-semibold text-[color:var(--accent)] transition hover:text-[color:var(--foreground)]"
          >
            {isRegister ? "Sign in" : "Create one"}
          </Link>
        </p>
      </div>
    </section>
  );
}
