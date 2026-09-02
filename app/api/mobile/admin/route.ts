import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { families, familyMembers, postComments, postLikes, posts, pointsLedger, users, workouts } from "../../../../db/schema";
import { apiError, cleanText, hashPassword, json, options, randomToken, requireMobileUser } from "../_shared";
import { OFFICIAL_FAMILY_USERS } from "../auth/login/route";

export const OPTIONS = options;

// In-memory or database-backed monthly prize storage (defaulting to state)
let monthlyPrize = {
  title: "Smartwatch Deportivo o Audífonos Pro 🎧",
  description: "Cumple mínimo tus 4 check-ins por semana en Septiembre y participa en la rifa familiar del mes.",
  imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80",
  month: "Septiembre 2026",
  minWeeklyCheckIns: 4,
};

const ADMIN_PIN = "123456";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("action") === "prize") {
      return json({ prize: monthlyPrize });
    }
    return json({ prize: monthlyPrize });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Sesión no válida." }, 401);

    const payload = await request.json() as Record<string, unknown>;
    const pin = cleanText(payload.pin, 10);
    const action = cleanText(payload.action, 50);

    // Validate 6-digit PIN
    if (pin !== ADMIN_PIN) {
      return json({ error: "PIN de administrador incorrecto." }, 403);
    }

    const db = getDb();

    // 1. List all users
    if (action === "list_users") {
      const allUsers = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
      }).from(users).orderBy(desc(users.createdAt));

      const allWorkouts = await db.select().from(workouts);

      const usersWithStats = allUsers.map((u) => {
        const userWorkouts = allWorkouts.filter((w) => w.userId === u.id);
        return {
          ...u,
          workoutCount: userWorkouts.length,
          eligibleForPrize: userWorkouts.length >= 4,
        };
      });

      return json({ users: usersWithStats, prize: monthlyPrize });
    }

    // 2. Reset user password
    if (action === "reset_password") {
      const targetUserId = Number(payload.targetUserId);
      const newPassword = cleanText(payload.newPassword, 100);

      if (!targetUserId || !newPassword || newPassword.length < 6) {
        return json({ error: "La nueva contraseña debe tener al menos 6 caracteres." }, 400);
      }

      const salt = randomToken(16);
      const passwordHash = await hashPassword(newPassword, salt);

      await db.update(users).set({
        passwordHash,
        passwordSalt: salt,
      }).where(eq(users.id, targetUserId));

      return json({ ok: true, message: `Contraseña restablecida exitosamente para el usuario #${targetUserId}.` });
    }

    // 3. Delete user
    if (action === "delete_user") {
      const targetUserId = Number(payload.targetUserId || payload.userId);
      if (!targetUserId || targetUserId === current.userId) {
        return json({ error: "No puedes eliminar tu propia cuenta de administrador actual." }, 400);
      }

      await db.delete(users).where(eq(users.id, targetUserId));
      return json({ ok: true, message: `Usuario #${targetUserId} eliminado del sistema.` });
    }

    // 4. Save Monthly Prize & Square Image
    if (action === "save_prize") {
      const title = cleanText(payload.title, 100) || monthlyPrize.title;
      const description = cleanText(payload.description, 250) || monthlyPrize.description;
      const imageUrl = cleanText(payload.imageUrl, 2000) || monthlyPrize.imageUrl;
      const month = cleanText(payload.month, 50) || monthlyPrize.month;

      monthlyPrize = {
        title,
        description,
        imageUrl,
        month,
        minWeeklyCheckIns: 4,
      };

      return json({ ok: true, prize: monthlyPrize, message: "¡Premio del mes actualizado exitosamente!" });
    }

    // 5. Clear all test workouts, posts, comments and likes for clean operation
    if (action === "clear_test_data") {
      await db.delete(postComments);
      await db.delete(postLikes);
      await db.delete(posts);
      await db.delete(workouts);
      await db.delete(pointsLedger);
      return json({ ok: true, message: "¡Datos de prueba limpiados exitosamente! La app está lista en ceros para iniciar la operación oficial." });
    }

    // 6. Sync official 12 users
    if (action === "sync_official_users") {
      let [fam] = await db.select().from(families).limit(1);
      if (!fam) {
        [fam] = await db.insert(families).values({
          name: "López y Amigos",
          inviteCode: "4X7FAM123",
          createdBy: current.userId,
        }).returning();
      } else {
        await db.update(families).set({ name: "López y Amigos" }).where(eq(families.id, fam.id));
      }

      for (const u of OFFICIAL_FAMILY_USERS) {
        const normEmail = u.email.toLowerCase();
        let [existing] = await db.select().from(users).where(eq(users.email, normEmail)).limit(1);
        const salt = randomToken(16);
        const hash = await hashPassword(u.password, salt);

        if (!existing) {
          [existing] = await db.insert(users).values({
            name: u.name,
            email: normEmail,
            passwordHash: hash,
            passwordSalt: salt,
          }).returning();
        } else {
          await db.update(users).set({
            name: u.name,
            passwordHash: hash,
            passwordSalt: salt,
          }).where(eq(users.id, existing.id));
        }

        // Family membership
        const [mem] = await db.select().from(familyMembers).where(eq(familyMembers.userId, existing.id)).limit(1);
        if (!mem) {
          await db.insert(familyMembers).values({
            familyId: fam.id,
            userId: existing.id,
            role: u.role,
          });
        } else if (mem.role !== u.role) {
          await db.update(familyMembers).set({ role: u.role }).where(eq(familyMembers.id, mem.id));
        }
      }

      return json({ ok: true, message: "¡Los 12 usuarios oficiales fueron sincronizados exitosamente con sus contraseñas reales!" });
    }

    return json({ error: "Acción no reconocida." }, 400);
  } catch (error) {
    return apiError(error);
  }
}
