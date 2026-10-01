import { verifyAuthToken, getDb, admin } from "../_lib/firebaseAdmin";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método não permitido." });
  }

  try {
    const decoded = await verifyAuthToken(req);
    if (!decoded || !decoded.uid) {
      return res.status(401).json({ success: false, error: "Não autorizado." });
    }

    const uid = decoded.uid;
    const db = getDb();
    const userRef = db.collection("users").doc(uid);

    // 1. Delete consultations subcollection
    const consultationsSnap = await userRef.collection("consultations").get();
    const batch = db.batch();
    consultationsSnap.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // 2. Anonymize/delete user profile
    batch.delete(userRef);
    await batch.commit();

    // 3. Delete from Firebase Auth
    try {
      await admin.auth().deleteUser(uid);
    } catch (authErr) {
      console.warn("[DELETE_USER_AUTH_WARN]", authErr);
    }

    return res.status(200).json({
      success: true,
      message: "Conta e histórico excluídos com sucesso conforme a LGPD.",
    });
  } catch (error: any) {
    console.error("[ACCOUNT_DELETE_ERROR]", error);
    return res.status(500).json({
      success: false,
      error: "Erro ao processar exclusão de conta.",
    });
  }
}
