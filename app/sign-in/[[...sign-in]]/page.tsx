import { SignIn } from '@clerk/nextjs';

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 shell py-4 sm:py-6">
      <p className="font-display text-4xl uppercase leading-[0.9] text-ink">
        MMA<span className="text-accent">/</span>Universe
      </p>
      <SignIn />
    </main>
  );
}
