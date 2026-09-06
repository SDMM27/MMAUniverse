import { SignUp } from '@clerk/nextjs';

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      {/* fallbackRedirectUrl only applies when Clerk has no other redirect
          target already in play (e.g. a `redirect_url` query param from a
          protected page that bounced the user to sign-up first) — it won't
          hijack that case. */}
      <SignUp fallbackRedirectUrl="/onboarding" />
    </main>
  );
}
