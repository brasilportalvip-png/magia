import { verifyAuthToken, getDb, admin } from "./_lib/firebaseAdmin";
import { checkRateLimit, getClientIp } from "./_lib/rateLimit";
import { calculateConsultationCost, debitCredits, refundCredits } from "./_lib/ledger";
import { generateResilientResponse } from "./_lib/geminiResilient";

function getPabloConsultationTime() {
  const now = new Date();
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
}

function buildPabloPrompt(message: string, user: any, oracleContext?: any, history?: any[]) {
  const consultationTime = getPabloConsultationTime();

  let prompt = `
Você é CIGANO PABLO, guia espiritual e oraculista principal do site MAGIA DAS CRENÇAS.
Sua função é interpretar a pergunta do consulente com profundidade, humanidade, simbolismo e coerência.

==================================================
IDENTIDADE DE CIGANO PABLO
==================================================
Você é Cigano Pablo. Sua presença é firme, sábia, acolhedora, observadora, intuitiva, direta e humana.
Nunca diga que é uma inteligência artificial.
Fale naturalmente como Cigano Pablo se dirigindo diretamente ao consulente.

==================================================
REGRA FUNDAMENTAL
==================================================
Você interpreta símbolos, padrões, possibilidades e caminhos. Não apresente previsões espirituais como fato científico ou certeza absoluta.

==================================================
DADOS DO CONSULENTE (CARREGADOS DO PERFIL)
==================================================
Nome: ${user?.displayName || user?.name || "Consulente"}
Data de nascimento: ${user?.birthDate || "não informada"}
Hora de nascimento: ${user?.birthTime || "não informada"}
Signo: ${user?.sign || "não informado"}
Número da Alma: ${user?.nameNumber || "não calculado"}
Número de Destino: ${user?.lifePathNumber || "não calculado"}
Elemento espiritual: ${user?.spiritualElement || "não informado"}
Anjo guardião: ${user?.guardianAngel || "não informado"}
Odù regente: ${user?.regentOdu?.name || user?.regentOdu || "não informado"}
Plano: ${user?.plan || "free"}

==================================================
MOMENTO REAL DA CONSULTA
==================================================
${consultationTime}

==================================================
PERGUNTA DO CONSULENTE
==================================================
${message}
`;

  if (Array.isArray(history) && history.length > 0) {
    const formattedHistory = history
      .slice(-6)
      .map((item) => {
        const role = item?.role === "model" ? "Cigano Pablo" : "Consulente";
        const txt = typeof item?.text === "string" ? item.text.trim() : "";
        return txt ? `${role}: ${txt}` : "";
      })
      .filter(Boolean)
      .join("\n\n");

    if (formattedHistory) {
      prompt += `\n==================================================\nHISTÓRICO RECENTE\n==================================================\n${formattedHistory}\n`;
    }
  }

  if (oracleContext?.formattedContext) {
    prompt += `\n==================================================\nCONTEXTO ORACULAR ESTRUTURADO\n==================================================\n${oracleContext.formattedContext.slice(0, 12000)}\n`;
  }

  prompt += `\nResponda diretamente e acolha o consulente com o estilo autêntico do Cigano Pablo.\n`;
  return prompt;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método não permitido." });
  }

  try {
    const decoded = await verifyAuthToken(req);
    if (!decoded || !decoded.uid) {
      return res.status(401).json({
        success: false,
        error: "Não autorizado. Faça login para realizar sua consulta.",
      });
    }

    const uid = decoded.uid;
    const ip = getClientIp(req);

    const rateUid = checkRateLimit(`consult_uid_${uid}`, 20, 60 * 1000);
    const rateIp = checkRateLimit(`consult_ip_${ip}`, 40, 60 * 1000);

    if (!rateUid.allowed || !rateIp.allowed) {
      return res.status(429).json({
        success: false,
        error: "Muitas consultas em sequência. Respire fundo e tente novamente em instantes.",
      });
    }

    const { message, oracleContext, history } = req.body || {};

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ success: false, error: "Mensagem inválida." });
    }

    if (message.length > 3000) {
      return res.status(400).json({ success: false, error: "Mensagem muito longa." });
    }

    // Load user directly from Firestore
    const db = getDb();
    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ success: false, error: "Perfil de usuário não encontrado." });
    }

    const userData = userDoc.data() || {};
    const cost = calculateConsultationCost(message, oracleContext?.oracle);
    const currentCredits = Number(userData.credits || 0);

    if (currentCredits < cost) {
      return res.status(402).json({
        success: false,
        error: "Energias vitais insuficientes para esta leitura.",
        creditsRequired: cost,
        creditsAvailable: currentCredits,
      });
    }

    const consultationId = `c_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Debit credits atomically
    const debitRes = await debitCredits({
      uid,
      amount: cost,
      reason: `Consulta oracular: ${oracleContext?.oracle || "Pablo"}`,
      idempotencyKey: consultationId,
      consultationId,
    });

    if (!debitRes.success) {
      return res.status(400).json({
        success: false,
        error: debitRes.error || "Não foi possível debitar os créditos.",
      });
    }

    // Build prompt & call resilient Gemini
    const prompt = buildPabloPrompt(message, userData, oracleContext, history);
    let geminiRes;

    try {
      geminiRes = await generateResilientResponse(prompt);
    } catch (geminiErr) {
      // Rollback debit on failure!
      await refundCredits({
        uid,
        amount: cost,
        reason: "Estorno automático por falha no processamento oracular",
        originalTransactionId: consultationId,
      });

      return res.status(502).json({
        success: false,
        error: "O oráculo encontrou uma instabilidade temporária. Seus créditos foram preservados.",
      });
    }

    // Save consultation record in user's subcollection
    try {
      await db
        .collection("users")
        .doc(uid)
        .collection("consultations")
        .doc(consultationId)
        .set({
          id: consultationId,
          uid,
          oracle: oracleContext?.oracle || "geral",
          cost,
          message: message.slice(0, 1000),
          response: geminiRes.text.slice(0, 4000),
          model: geminiRes.model,
          isContingency: Boolean(geminiRes.isContingency),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (saveErr) {
      console.warn("[CONSULTATION_SAVE_FAILED]", saveErr);
    }

    return res.status(200).json({
      success: true,
      text: geminiRes.text,
      consultationId,
      cost,
      creditsRemaining: debitRes.balanceAfter,
    });
  } catch (error: any) {
    console.error("[CONSULT_ERROR]", error?.message || error);
    return res.status(500).json({
      success: false,
      error: "Ocorreu um erro interno no oráculo.",
    });
  }
}
