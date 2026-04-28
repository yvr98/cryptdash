import type { Metadata } from "next";

import { AuthForm } from "@/components/account/auth-form";

export const metadata: Metadata = {
  title: "Sign in | CryptDash",
};

export default function LoginPage() {
  return (
    <main className="flex flex-1">
      <AuthForm mode="login" />
    </main>
  );
}
