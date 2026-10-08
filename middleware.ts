import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { legacyFighterIdFromPath, legacyRedirectPathForId } from '@/data/lib/fighter-redirect';

export default clerkMiddleware(async (_auth, req) => {
  // Legacy "/fighters/<id>" -> real HTTP 308 to "/fighters/<slug>". It has to
  // happen here: app/loading.tsx makes pages stream with a 200 status, so a
  // permanentRedirect() thrown while rendering degrades to a meta refresh.
  // Only this exact path shape touches the DB; any failure lets the page serve.
  const id = legacyFighterIdFromPath(req.nextUrl.pathname);
  if (id === null || !process.env.DATABASE_URL) return;
  try {
    const target = await legacyRedirectPathForId(id);
    if (target) {
      const url = req.nextUrl.clone();
      url.pathname = target;
      return NextResponse.redirect(url, 308);
    }
  } catch (error) {
    console.error('Legacy fighter redirect failed:', error);
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
};
