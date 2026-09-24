"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { ROLES } from "@/lib/roles";

export default function LoginPage() {
  const { user, loading, login, register } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/chat");
  }, [loading, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(name, email, password);
      router.replace("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="grid w-full max-w-4xl gap-10 md:grid-cols-[1.1fr_1fr] md:items-center">
        <section>
          <h1 className="font-display text-5xl leading-[1.05] font-semibold tracking-tight md:text-6xl">
            Four coaches, one conversation away.
          </h1>
          <ul className="mt-8 space-y-3">
            {ROLES.map((r) => (
              <li key={r.id} className="flex items-center gap-3">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: r.hue }} aria-hidden />
                <span className="font-medium">{r.name}</span>
                <span className="text-ink-soft">{r.blurb}</span>
              </li>
            ))}
          </ul>
        </section>

        <form onSubmit={submit} className="rounded-2xl border border-line bg-paper p-7 shadow-[0_1px_0_var(--line)]">
          <h2 className="font-display text-2xl font-semibold">{isLogin ? "Log in" : "Create your account"}</h2>
          <div className="mt-6 space-y-4">
            {!isLogin && (
              <Field label="Name" value={name} onChange={setName} autoComplete="name" minLength={2} maxLength={50} />
            )}
            <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete={isLogin ? "current-password" : "new-password"}
              minLength={6}
            />
          </div>
          {error && (
            <p role="alert" className="mt-4 text-sm text-danger">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="mt-6 w-full rounded-lg bg-ink py-3 font-medium text-paper transition-opacity disabled:opacity-60"
          >
            {busy ? "Please wait…" : isLogin ? "Log in" : "Create account"}
          </button>
          <p className="mt-5 text-sm text-ink-soft">
            {isLogin ? "New here? " : "Already have an account? "}
            <button
              type="button"
              className="font-medium text-ink underline underline-offset-4"
              onClick={() => {
                setMode(isLogin ? "register" : "login");
                setError("");
              }}
            >
              {isLogin ? "Create an account" : "Log in"}
            </button>
          </p>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  onChange,
  ...props
}: { label: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        {...props}
        required
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-lg border border-line bg-mist px-3.5 py-2.5 outline-none focus:border-accent"
      />
    </label>
  );
}
