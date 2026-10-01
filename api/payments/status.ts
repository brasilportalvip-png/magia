import { MercadoPagoConfig, Payment } from "mercadopago";
import { verifyAuthToken, getDb } from "../_lib/firebaseAdmin";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Método não permitido." });
  }

  try {
    const decoded = await verifyAuthToken(req);
    if (!decoded || !decoded.uid) {
      return res.status(401).json({ success: false, error: "Não autorizado." });
    }

    const paymentId = req.query?.paymentId || req.query?.id;
    if (!paymentId) {
      return res.status(400).json({ success: false, error: "ID do pagamento não informado." });
    }

    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!token) {
      // Check local DB if Mercado Pago token is not set in environment
      const db = getDb();
      const snap = await db.collection("payment_logs").doc(String(paymentId)).get();
      if (snap.exists) {
        const data = snap.data();
        if (data?.userId !== decoded.uid) {
          return res.status(403).json({ success: false, error: "Acesso negado." });
        }
        return res.status(200).json({
          success: true,
          status: data?.status || "pending",
          approved: data?.status === "credited" || data?.status === "approved",
        });
      }
      return res.status(404).json({ success: false, error: "Pagamento não encontrado." });
    }

    const mp = new MercadoPagoConfig({ accessToken: token });
    const payment = new Payment(mp);
    const paymentData: any = await payment.get({ id: String(paymentId) });

    const metadata = paymentData?.metadata || {};
    const paymentOwner = metadata.userId || metadata.user_id;

    if (paymentOwner && paymentOwner !== decoded.uid) {
      return res.status(403).json({ success: false, error: "Acesso negado ao pagamento solicitado." });
    }

    const status = paymentData?.status;

    return res.status(200).json({
      success: true,
      status,
      approved: status === "approved",
    });
  } catch (error: any) {
    console.error("[PAYMENT_STATUS_ERROR]", error?.message || error);
    return res.status(500).json({
      success: false,
      error: "Erro ao consultar status do pagamento.",
    });
  }
}
