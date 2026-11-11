import { SignUp } from '@clerk/nextjs';

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 shell py-4 sm:py-6">
      <p className="font-display text-4xl uppercase leading-[0.9] text-ink">
        MMA<span className="text-accent">/</span>Universe
      </p>
      {/* fallbackRedirectUrl only applies when Clerk has no other redirect
          target already in play (e.g. a `redirect_url` query param from a
          protected page that bounced the user to sign-up first) — it won't
          hijack that case. */}
      <SignUp fallbackRedirectUrl="/onboarding" />
    </main>
  );
}
