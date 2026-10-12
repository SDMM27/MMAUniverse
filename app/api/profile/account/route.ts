// app/api/profile/account/route.ts
import { auth, clerkClient } from '@clerk/nextjs/server';
import { sql } from '@/data/lib/db';

export const dynamic = 'force-dynamic';

// RGPD right to erasure: wipes everything tied to the signed-in user in our
// DB, then deletes the Clerk account itself (email, sessions, OAuth links).
// DB first: if Clerk fails afterwards the user can simply retry, whereas the
// reverse order could leave orphaned rows nobody can reach any more.
export async function DELETE() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return Response.json({ error: 'Vous devez être connecté pour supprimer votre compte.' }, { status: 401 });
  }

  try {
    const rows = await sql<{ id: number }>`SELECT id FROM users WHERE external_auth_id = ${clerkId}`;
    const userId = rows.rows[0]?.id;
    if (userId !== undefined) {
      await sql`DELETE FROM picks WHERE user_id = ${userId}`;
      await sql`DELETE FROM user_fighter_preferences WHERE user_id = ${userId}`;
      await sql`DELETE FROM user_nationality_preferences WHERE user_id = ${userId}`;
      await sql`DELETE FROM users WHERE id = ${userId}`;
    }

    const client = await clerkClient();
    await client.users.deleteUser(clerkId);
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Account deletion failed:', error);
    return Response.json({ error: 'La suppression a échoué, réessayez.' }, { status: 500 });
  }
}
