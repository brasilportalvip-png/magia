import React, { useState } from "react";
import { X, Shield, FileText, Cookie, Mail, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { auth } from "../lib/firebase";

export type LegalPageType = "privacy" | "terms" | "cookies" | "contact" | "deletion";

interface LegalPagesModalProps {
  isOpen: boolean;
  type: LegalPageType;
  onClose: () => void;
  onAccountDeleted?: () => void;
}

export default function LegalPagesModal({
  isOpen,
  type,
  onClose,
  onAccountDeleted,
}: LegalPagesModalProps) {
  const [activeTab, setActiveTab] = useState<LegalPageType>(type);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  React.useEffect(() => {
    setActiveTab(type);
    setDeleteConfirm("");
    setDeleteError("");
    setDeleteSuccess(false);
  }, [type, isOpen]);

  if (!isOpen) return null;

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "EXCLUIR") {
      setDeleteError("Digite EXCLUIR em letras maiúsculas para confirmar.");
      return;
    }

    setDeleting(true);
    setDeleteError("");

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Usuário não autenticado.");

      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erro ao processar exclusão.");
      }

      setDeleteSuccess(true);
      setTimeout(async () => {
        await auth.signOut();
        if (onAccountDeleted) onAccountDeleted();
        onClose();
      }, 2000);
    } catch (err: any) {
      setDeleteError(err.message || "Falha na comunicação com o servidor.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="w-full max-w-4xl bg-zinc-950 border border-amber-500/20 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header Tabs */}
        <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-black/50">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab("privacy")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "privacy"
                  ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                  : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Shield size={14} /> Privacidade (LGPD)
            </button>
            <button
              onClick={() => setActiveTab("terms")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "terms"
                  ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                  : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <FileText size={14} /> Termos de Uso
            </button>
            <button
              onClick={() => setActiveTab("cookies")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "cookies"
                  ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                  : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Cookie size={14} /> Cookies
            </button>
            <button
              onClick={() => setActiveTab("contact")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "contact"
                  ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                  : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Mail size={14} /> Contato
            </button>
            <button
              onClick={() => setActiveTab("deletion")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "deletion"
                  ? "bg-rose-600 text-white"
                  : "bg-rose-950/40 text-rose-300 hover:bg-rose-900/60"
              }`}
            >
              <Trash2 size={14} /> Exclusão de Dados
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 md:p-8 overflow-y-auto space-y-6 text-sm text-white/80 leading-relaxed font-sans">
          {activeTab === "privacy" && (
            <div className="space-y-4">
              <h2 className="text-2xl font-serif text-amber-400 font-bold">
                Política de Privacidade e Proteção de Dados (LGPD)
              </h2>
              <p className="text-xs text-white/50">Última atualização: 01 de outubro de 2026</p>

              <p>
                O portal <strong>Magia das Crenças</strong> valoriza a sua privacidade e atua em estrita conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 - LGPD). Esta Política descreve com transparência como tratamos as suas informações.
              </p>

              <h3 className="text-base font-bold text-white pt-2">1. Dados Coletados e Finalidades</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Identificação e Cadastro:</strong> Nome completo, data e hora de nascimento e e-mail, necessários para os cálculos oraculares (Mapa Astral, Odù, Numerologia) e gestão da conta.</li>
                <li><strong>Informações de Uso e Sessão:</strong> Identificador técnico de dispositivo (deviceId), endereço IP e dados de navegador para controle antifraude e proteção de cotas promocionais.</li>
                <li><strong>Consultas e Mensagens:</strong> Histórico de conversas com Cigano Pablo, vinculado ao UID autenticado para conferência do próprio consulente.</li>
                <li><strong>Pagamentos:</strong> Dados de cobrança são processados diretamente pelo <strong>Mercado Pago</strong> com criptografia de ponta a ponta. Não armazenamos números de cartão ou credenciais bancárias em nossos servidores.</li>
              </ul>

              <h3 className="text-base font-bold text-white pt-2">2. Compartilhamento com Terceiros</h3>
              <p>
                Seus dados não são vendidos. O compartilhamento ocorre exclusivamente com parceiros tecnológicos essenciais:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Firebase (Google LLC):</strong> Autenticação de contas e banco de dados em nuvem sob rígidos padrões de segurança.</li>
                <li><strong>Google Cloud (Gemini API):</strong> Processamento e geração da interpretação oracular simbólica. As requisições são anônimas e protegidas contra uso para treinamento público.</li>
                <li><strong>Mercado Pago:</strong> Liquidação e processamento seguro de pagamentos.</li>
              </ul>

              <h3 className="text-base font-bold text-white pt-2">3. Seus Direitos (Art. 18 da LGPD)</h3>
              <p>
                Você possui total direito de confirmação de existência do tratamento, acesso aos dados, correção de informações incompletas e <strong>exclusão completa de sua conta e histórico</strong> a qualquer momento diretamente na aba "Exclusão de Dados".
              </p>
            </div>
          )}

          {activeTab === "terms" && (
            <div className="space-y-4">
              <h2 className="text-2xl font-serif text-amber-400 font-bold">
                Termos e Condições de Uso
              </h2>
              <p className="text-xs text-white/50">Última atualização: 01 de outubro de 2026</p>

              <h3 className="text-base font-bold text-white pt-2">1. Natureza do Serviço</h3>
              <p>
                O <strong>Magia das Crenças</strong> é uma plataforma dedicada ao autoconhecimento, entretenimento espiritual, simbolismo esotérico e reflexão pessoal através dos oráculos tradicionais e da sabedoria do <strong>Cigano Pablo</strong>.
              </p>
              <p className="text-amber-300/90 font-medium">
                Importante: As orientações possuem caráter estritamente oracular e simbólico. Não constituem nem substituem pareceres médicos, psicológicos, financeiros, jurídicos ou de saúde profissional.
              </p>

              <h3 className="text-base font-bold text-white pt-2">2. Créditos e Planos</h3>
              <p>
                As consultas consomem créditos de energia vital virtual conforme a profundidade do oráculo (Tarot, Búzios, Mapa Astral). O saldo de créditos é gerenciado com livro-razão no servidor. Os créditos são intransferíveis e vinculados ao titular da conta.
              </p>

              <h3 className="text-base font-bold text-white pt-2">3. Uso Responsável</h3>
              <p>
                O consulente compromete-se a utilizar o serviço de forma ética, não submetendo mensagens com conteúdo ilícito, discriminatório, violento ou com intenção de sobrecarregar os servidores.
              </p>
            </div>
          )}

          {activeTab === "cookies" && (
            <div className="space-y-4">
              <h2 className="text-2xl font-serif text-amber-400 font-bold">
                Política de Cookies
              </h2>
              <p>
                Utilizamos cookies e tecnologias de armazenamento local estritamente necessários para o funcionamento e a segurança do portal:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Cookies de Autenticação:</strong> Gerenciados pelo Firebase Authentication para manter a sua sessão segura após o login.</li>
                <li><strong>Armazenamento Local (localStorage/sessionStorage):</strong> Utilizado para salvar preferências de interface e o identificador técnico de segurança do dispositivo.</li>
              </ul>
              <p>
                Não utilizamos cookies de terceiros para rastreamento de anúncios invasivos ou venda de dados a corretores de publicidade.
              </p>
            </div>
          )}

          {activeTab === "contact" && (
            <div className="space-y-4">
              <h2 className="text-2xl font-serif text-amber-400 font-bold">
                Canais de Atendimento e Suporte
              </h2>
              <p>
                Dúvidas sobre consultas, liberação de créditos ou exercício de direitos de privacidade podem ser encaminhadas pelos canais oficiais:
              </p>
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2">
                <p><strong>E-mail de Suporte / DPO:</strong> brasilportalvip@gmail.com</p>
                <p><strong>WhatsApp Oficial:</strong> Disponível no botão flutuante de suporte na tela inicial.</p>
                <p><strong>Tempo de Resposta Médio:</strong> Até 24 horas úteis.</p>
              </div>
            </div>
          )}

          {activeTab === "deletion" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-rose-400">
                <AlertTriangle size={28} />
                <h2 className="text-2xl font-serif font-bold">
                  Exclusão Definitiva de Conta e Dados (LGPD)
                </h2>
              </div>

              <p>
                Conforme o Artigo 18 da LGPD, você tem o direito de solicitar a eliminação definitiva de todos os seus dados pessoais armazenados em nossa plataforma.
              </p>

              <div className="p-4 bg-rose-950/30 border border-rose-500/30 rounded-2xl text-xs space-y-1 text-rose-200">
                <p><strong>Esta ação é irreversível e resultará em:</strong></p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Remoção completa do seu perfil e data de nascimento.</li>
                  <li>Eliminação total de todas as consultas e histórico de leituras.</li>
                  <li>Perda irremediável de qualquer saldo restante de créditos espirituais.</li>
                  <li>Exclusão do seu login do Firebase Authentication.</li>
                </ul>
              </div>

              {deleteSuccess ? (
                <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl flex items-center gap-3 text-emerald-300">
                  <CheckCircle2 size={24} />
                  <span>Sua conta e histórico foram excluídos permanentemente. Até logo.</span>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <label className="block text-xs font-bold text-white/70">
                    Para confirmar, digite exatamente <span className="text-rose-400">EXCLUIR</span> abaixo:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="EXCLUIR"
                    className="w-full px-4 py-2.5 bg-black/60 border border-white/20 rounded-xl text-white font-mono focus:border-rose-500 outline-none"
                  />

                  {deleteError && (
                    <p className="text-rose-400 text-xs font-bold">{deleteError}</p>
                  )}

                  <button
                    disabled={deleting || deleteConfirm !== "EXCLUIR"}
                    onClick={handleDeleteAccount}
                    className="w-full py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} />
                    {deleting ? "Excluindo Dados..." : "Excluir Minha Conta e Histórico"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
