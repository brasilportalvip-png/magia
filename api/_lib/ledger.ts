import { getDb, admin } from "./firebaseAdmin";

export function calculateConsultationCost(message: string, oracleType?: string): number {
  const text = (message || "").toLowerCase();
  const oracle = (oracleType || "").toLowerCase();

  if (oracle === "tarot" || text.includes("tarot")) return 3;
  if (oracle === "mapa astral" || text.includes("mapa astral")) return 5;
  if (oracle.includes("búzios") || oracle.includes("buzios") || text.includes("búzios") || text.includes("buzios")) return 4;
  if (oracle.includes("ifá") || oracle.includes("ifa") || text.includes("ifá") || text.includes("ifa")) return 4;
  if (oracle === "odu" || text.includes("odu")) return 2;
  if (oracle.includes("orixá") || oracle.includes("orixa") || text.includes("orixá") || text.includes("orixa")) return 4;
  if (oracle === "numerologia" || text.includes("numerologia")) return 2;
  if (oracle.includes("anjo") || text.includes("anjo guardião") || text.includes("anjo guardiao")) return 2;
  if (oracle === "cabala" || text.includes("cabala")) return 2;
  if (oracle.includes("daimon") || text.includes("daimon")) return 2;
  if (
    text.includes("amor") ||
    text.includes("relacionamento") ||
    text.includes("ex") ||
    text.includes("me ama") ||
    text.includes("namorad") ||
    text.includes("casament") ||
    text.includes("paixao") ||
    text.includes("paixão") ||
    text.includes("reconcilia")
  ) {
    return 2;
  }
  if (text.includes("dinheiro") || text.includes("prosperidade")) return 2;
  if (text.includes("trabalho") || text.includes("emprego")) return 2;
  if (text.includes("saúde") || text.includes("saude")) return 2;
  if (text.includes("espiritual")) return 2;
  if (text.includes("família") || text.includes("familia")) return 2;

  return 1;
}

export interface DebitResult {
  success: boolean;
  transactionId?: string;
  balanceBefore?: number;
  balanceAfter?: number;
  error?: string;
}

export async function debitCredits(params: {
  uid: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
  consultationId?: string;
}): Promise<DebitResult> {
  const { uid, amount, reason, idempotencyKey, consultationId } = params;

  if (amount <= 0) {
    return { success: true, balanceBefore: 0, balanceAfter: 0 };
  }

  const db = getDb();
  const userRef = db.collection("users").doc(uid);
  const logRef = userRef.collection("credit_logs").doc(idempotencyKey);

  try {
    const result = await db.runTransaction(async (t) => {
      // Check for idempotency
      const existingLog = await t.get(logRef);
      if (existingLog.exists) {
        const data = existingLog.data();
        return {
          success: true,
          transactionId: idempotencyKey,
          balanceBefore: data?.balanceBefore,
          balanceAfter: data?.balanceAfter,
        };
      }

      const userDoc = await t.get(userRef);
      if (!userDoc.exists) {
        throw new Error("Usuário não encontrado.");
      }

      const currentCredits = Number(userDoc.data()?.credits || 0);
      if (currentCredits < amount) {
        throw new Error("Créditos insuficientes.");
      }

      const newBalance = currentCredits - amount;

      t.update(userRef, {
        credits: newBalance,
        lastCreditUseAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      t.set(logRef, {
        transactionId: idempotencyKey,
        uid,
        type: "debit",
        amount,
        balanceBefore: currentCredits,
        balanceAfter: newBalance,
        reason,
        consultationId: consultationId || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        transactionId: idempotencyKey,
        balanceBefore: currentCredits,
        balanceAfter: newBalance,
      };
    });

    return result;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Falha ao debitar créditos.",
    };
  }
}

export async function refundCredits(params: {
  uid: string;
  amount: number;
  reason: string;
  originalTransactionId: string;
}): Promise<boolean> {
  const { uid, amount, reason, originalTransactionId } = params;
  if (amount <= 0) return true;

  const db = getDb();
  const userRef = db.collection("users").doc(uid);
  const refundId = `refund_${originalTransactionId}`;
  const logRef = userRef.collection("credit_logs").doc(refundId);

  try {
    await db.runTransaction(async (t) => {
      const existingRefund = await t.get(logRef);
      if (existingRefund.exists) {
        return; // Idempotent refund
      }

      const userDoc = await t.get(userRef);
      const currentCredits = userDoc.exists ? Number(userDoc.data()?.credits || 0) : 0;
      const newBalance = currentCredits + amount;

      t.set(
        userRef,
        {
          credits: newBalance,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      t.set(logRef, {
        transactionId: refundId,
        originalTransactionId,
        uid,
        type: "refund",
        amount,
        balanceBefore: currentCredits,
        balanceAfter: newBalance,
        reason,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return true;
  } catch (err) {
    console.error("[REFUND_ERROR]", err);
    return false;
  }
}
