"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import KookaLogo from "../../KookaLogo";
import { authClient } from "../../../src/platform/auth-client";
import StaffNotice from "../_components/StaffNotice";
import styles from "../staff.module.css";
import { safeStaffDestination } from "./login-utils";

export default function LoginForm({ destination }: { destination: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const target = safeStaffDestination(destination);

  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await authClient.signIn.email({
      email: email.trim(),
      password,
      rememberMe: false,
      callbackURL: target,
    });
    setBusy(false);
    if (result.error) {
      setError("Email atau kata sandi tidak sesuai.");
      return;
    }
    router.replace(target);
    router.refresh();
  }

  return (
    <div className={styles.loginCard}>
      <div className={styles.loginBrand}>
        <KookaLogo className={styles.loginLogo} priority sizes="185px" />
      </div>
      <div className={styles.loginIntro}>
        <span className={styles.eyebrow}>Ruang kerja staf</span>
        <h1>Selamat datang</h1>
        <p>Masuk menggunakan email dan kata sandi akun staf Anda.</p>
      </div>

      <form className={styles.loginForm} onSubmit={submitCredentials}>
        <label>
          Email staf
          <input
            autoComplete="username"
            inputMode="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nama@kooka..."
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          Kata sandi
          <input
            autoComplete="current-password"
            minLength={12}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <StaffNotice
          notice={error ? { tone: "error", message: error } : null}
          onDismiss={() => setError(null)}
        />
        <button className={styles.primaryButton} disabled={busy} type="submit">
          {busy ? "Memeriksa…" : "Masuk ke operasional"}
        </button>
      </form>

      <p className={styles.loginHelp}>
        Kesulitan masuk? Hubungi Owner atau administrator KOOKA untuk reset
        akun.
      </p>
    </div>
  );
}
