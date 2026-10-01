import { verifyAuthToken, getDb, admin } from "../_lib/firebaseAdmin";
import { getClientIp, checkRateLimit } from "../_lib/rateLimit";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método não permitido." });
  }

  try {
    const decoded = await verifyAuthToken(req);
    if (!decoded || !decoded.uid) {
      return res.status(401).json({
        success: false,
        error: "Não autorizado. Token de sessão obrigatório.",
      });
    }

    const uid = decoded.uid;
    const email = decoded.email || "";
    const ip = getClientIp(req);

    const rate = checkRateLimit(`register_check_${ip}`, 15, 60 * 1000);
    if (!rate.allowed) {
      return res.status(429).json({
        success: false,
        error: "Muitas solicitações recentes. Tente novamente mais tarde.",
      });
    }

    const { deviceId, browser, sessionSign } = req.body || {};
    const fraudReasons: string[] = [];

    const db = getDb();

    // Check device ID reuse if provided
    if (deviceId && deviceId !== "dev_not_tracked") {
      try {
        const devSnap = await db
          .collection("users")
          .where("deviceId", "==", deviceId)
          .limit(2)
          .get();

        const otherUsersWithDevice = devSnap.docs.filter((d) => d.id !== uid);
        if (otherUsersWithDevice.length > 0) {
          fraudReasons.push("device_already_used");
        }
      } catch (e) {
        console.warn("[FRAUD_CHECK_DEVICE_QUERY_WARN]", e);
      }
    }

    // Shared IP is a secondary signal, only flags if excessive accounts created rapidly
    if (ip && ip !== "unknown") {
      try {
        const ipSnap = await db
          .collection("users")
          .where("ip", "==", ip)
          .limit(10)
          .get();

        const otherUsersWithIp = ipSnap.docs.filter((d) => d.id !== uid);
        if (otherUsersWithIp.length >= 5) {
          fraudReasons.push("too_many_accounts_same_ip");
        }
      } catch (e) {
        console.warn("[FRAUD_CHECK_IP_QUERY_WARN]", e);
      }
    }

    const promotionalCreditsBlocked = fraudReasons.length > 0;
    const initialCredits = promotionalCreditsBlocked ? 0 : 7;

    try {
      await db.collection("security_logs").add({
        type: "register_check",
        uid,
        email,
        ip,
        deviceId: deviceId || "dev_not_tracked",
        browser: browser || "unknown",
        sessionSign: sessionSign || "unknown",
        creditsGranted: initialCredits,
        promotionalCreditsBlocked,
        fraudReasons,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.warn("[SECURITY_LOG_WARN]", e);
    }

    return res.status(200).json({
      success: true,
      ip,
      initialCredits,
      promotionalCreditsBlocked,
      fraudReasons,
    });
  } catch (error: any) {
    console.error("[REGISTER_CHECK_ERROR]", error?.message || error);
    return res.status(200).json({
      success: true,
      ip: getClientIp(req),
      initialCredits: 7,
      promotionalCreditsBlocked: false,
      fraudReasons: [],
    });
  }
}
