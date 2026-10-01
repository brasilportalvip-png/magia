import { MercadoPagoConfig, Preference } from "mercadopago";
import { verifyAuthToken, getDb, admin } from "../_lib/firebaseAdmin";
import { checkRateLimit, getClientIp } from "../_lib/rateLimit";

const PLANS: Record<string, { id: string; title: string; amount: number; credits: number }> = {
  silver: {
    id: "silver",
    title: "Plano Prata - Magia das Crenças",
    amount: 49,
    credits: 50,
  },
  prata: {
    id: "silver",
    title: "Plano Prata - Magia das Crenças",
    amount: 49,
    credits: 50,
  },
  gold: {
    id: "gold",
    title: "Plano Ouro - Magia das Crenças",
    amount: 120,
    credits: 125,
  },
  ouro: {
    id: "gold",
    title: "Plano Ouro - Magia das Crenças",
    amount: 120,
    credits: 125,
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método não permitido." });
  }

  try {
    const decoded = await verifyAuthToken(req);
    if (!decoded || !decoded.uid) {
      return res.status(401).json({
        success: false,
        error: "Não autorizado. Faça login para adquirir créditos.",
      });
    }

    const userId = decoded.uid;
    const userEmail = decoded.email || "";
    const ip = getClientIp(req);

    const rate = checkRateLimit(`payment_create_${userId}`, 10, 60 * 1000);
    if (!rate.allowed) {
      return res.status(429).json({
        success: false,
        error: "Muitas tentativas de compra recentes. Aguarde um minuto.",
      });
    }

    const { packageId } = req.body || {};
    const normalizedPkg = String(packageId || "").toLowerCase().trim();
    const plan = PLANS[normalizedPkg];

    if (!plan) {
      return res.status(400).json({ success: false, error: "Pacote inválido selecionado." });
    }

    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!token) {
      return res.status(503).json({
        success: false,
        error: "Serviço de pagamento indisponível no momento. Tente mais tarde.",
      });
    }

    const mp = new MercadoPagoConfig({ accessToken: token });
    const preference = new Preference(mp);

    const appUrl = process.env.APP_URL || "https://www.magiadascrencas.com.br";
    const externalRef = `order_${userId}_${plan.id}_${Date.now()}`;

    // Record payment intent in Firestore
    const db = getDb();
    try {
      await db.collection("payment_logs").doc(externalRef).set({
        userId,
        userEmail,
        packageId: plan.id,
        amount: plan.amount,
        credits: plan.credits,
        externalReference: externalRef,
        status: "pending",
        ip,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (dbErr) {
      console.warn("[PAYMENT_INTENT_LOG_WARN]", dbErr);
    }

    const result: any = await preference.create({
      body: {
        items: [
          {
            id: plan.id,
            title: plan.title,
            quantity: 1,
            currency_id: "BRL",
            unit_price: plan.amount,
          },
        ],
        payer: {
          email: userEmail || undefined,
        },
        external_reference: externalRef,
        metadata: {
          userId,
          packageId: plan.id,
          credits: plan.credits,
          amount: plan.amount,
        },
        back_urls: {
          success: `${appUrl}/?payment=success&credits=${plan.credits}`,
          failure: `${appUrl}/?payment=failure`,
          pending: `${appUrl}/?payment=pending`,
        },
        auto_return: "approved",
        notification_url: `${appUrl}/api/payments/webhook`,
      },
    });

    return res.status(200).json({
      success: true,
      checkoutUrl: result.init_point || result.sandbox_init_point,
      preferenceId: result.id,
    });
  } catch (error: any) {
    console.error("[PAYMENTS_CREATE_ERROR]", error?.message || error);
    return res.status(500).json({
      success: false,
      error: "Erro ao gerar preferência de pagamento.",
    });
  }
}
