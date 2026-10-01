import crypto from "crypto";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { getDb, admin } from "../_lib/firebaseAdmin";

function verifyWebhookSignature(req: any): boolean {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret) {
    // If webhook secret not configured yet by user, allow notification processing
    return true;
  }

  const xSignature = req.headers?.["x-signature"];
  const xRequestId = req.headers?.["x-request-id"];
  if (!xSignature || !xRequestId) return false;

  const parts = xSignature.split(",");
  let ts = "";
  let v1 = "";
  for (const part of parts) {
    const [k, v] = part.split("=");
    if (k?.trim() === "ts") ts = v?.trim();
    if (k?.trim() === "v1") v1 = v?.trim();
  }

  if (!ts || !v1) return false;

  const dataId = req.query?.["data.id"] || req.body?.data?.id || "";
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const hmac = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  return hmac === v1;
}

const PACKAGE_CREDITS: Record<string, number> = {
  silver: 50,
  gold: 125,
};

async function grantCreditsSafely(params: {
  userId: string;
  packageId: string;
  paymentId: string;
  amount: number;
}) {
  const { userId, packageId, paymentId, amount } = params;
  const credits = PACKAGE_CREDITS[packageId] || (amount >= 120 ? 125 : 50);
  const plan = packageId === "gold" ? "gold" : "silver";

  const db = getDb();
  const userRef = db.collection("users").doc(userId);
  const paymentRef = db.collection("payment_logs").doc(String(paymentId));
  const creditLogRef = userRef.collection("credit_logs").doc(`pay_${paymentId}`);

  await db.runTransaction(async (t) => {
    const paymentDoc = await t.get(paymentRef);
    if (paymentDoc.exists && paymentDoc.data()?.status === "credited") {
      return; // Already credited - idempotent
    }

    const userDoc = await t.get(userRef);
    const currentCredits = userDoc.exists ? Number(userDoc.data()?.credits || 0) : 0;
    const newBalance = currentCredits + credits;

    t.set(
      userRef,
      {
        uid: userId,
        credits: newBalance,
        plan,
        lastPurchaseAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    t.set(
      paymentRef,
      {
        userId,
        credits,
        amount,
        packageId,
        plan,
        paymentId: String(paymentId),
        status: "credited",
        creditedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    t.set(creditLogRef, {
      transactionId: `pay_${paymentId}`,
      uid: userId,
      type: "purchase",
      amount: credits,
      balanceBefore: currentCredits,
      balanceAfter: newBalance,
      packageId,
      plan,
      paymentId: String(paymentId),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(200).json({ received: true });
  }

  try {
    if (!verifyWebhookSignature(req)) {
      console.warn("[MERCADO_PAGO_WEBHOOK] Assinatura inválida detectada");
      return res.status(401).json({ error: "Assinatura inválida" });
    }

    const paymentId =
      req.body?.data?.id ||
      req.body?.id ||
      req.query?.id ||
      req.query?.["data.id"];

    if (!paymentId) {
      return res.status(200).json({ received: true });
    }

    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!token) {
      return res.status(200).json({ received: true });
    }

    const mp = new MercadoPagoConfig({ accessToken: token });
    const paymentClient = new Payment(mp);

    const paymentData: any = await paymentClient.get({ id: String(paymentId) });
    const status = paymentData?.status;
    const metadata = paymentData?.metadata || {};

    const db = getDb();
    try {
      await db.collection("payment_webhooks").doc(String(paymentId)).set({
        paymentId: String(paymentId),
        status,
        metadata,
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.warn("[WEBHOOK_LOG_WARN]", e);
    }

    if (status === "approved") {
      const userId = metadata.userId || metadata.user_id;
      const packageId = metadata.packageId || metadata.package_id || "silver";
      const amount = Number(paymentData.transaction_amount || metadata.amount || 0);

      if (userId) {
        await grantCreditsSafely({
          userId,
          packageId,
          paymentId: String(paymentId),
          amount,
        });
      }
    }

    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error("[PAYMENT_WEBHOOK_ERROR]", error?.message || error);
    return res.status(200).json({ received: true });
  }
}
