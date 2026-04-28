import type { Metadata } from "next";

import { AuthForm } from "@/components/account/auth-form";

export const metadata: Metadata = {
  title: "Create account | CryptDash",
};

export default function RegisterPage() {
  return (
    <main className="flex flex-1">
      <AuthForm mode="register" />
    </main>
  );
}
