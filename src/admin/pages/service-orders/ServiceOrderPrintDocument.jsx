import logoUrl from "../../../assets/nt-informatica-logo.jpg";
import {
  accessoryLabels,
  authorizationItems,
  checkedItems,
  conditionLabels,
  emptyText,
  formatDate,
  formatDateTime,
  formatDocument,
  formatMoney,
  formatOsNumber,
  formatPhone,
  formatTime,
  parseUnlockPattern,
  requestedServiceLabels,
  serviceOrderCompany,
  serviceOrderTerms,
} from "./serviceOrderPrintUtils";
import "./serviceOrderPrint.css";

function PrintField({ label, value }) {
  return (
    <div className="print-field">
      <span className="print-label">{label}</span>
      <span className="print-value">{value}</span>
    </div>
  );
}

function PrintSection({ title, children, className = "" }) {
  return (
    <section className={`print-section ${className}`}>
      <h3 className="print-section-title">{title}</h3>
      {children}
    </section>
  );
}

function ItemsList({ value, labels, emptyLabel = "Não informado" }) {
  const { items, unknown } = checkedItems(value, labels);
  if (unknown) return <p className="print-text">Informação registrada, mas não disponível para exibição estruturada.</p>;
  if (!items.length) return <p className="print-text">{emptyLabel}</p>;
  return (
    <div className="print-list">
      {items.map((item) => <span key={item} className="print-chip">{item}</span>)}
    </div>
  );
}

function AuthorizationsList({ value }) {
  const { items, unknown } = authorizationItems(value);
  if (unknown) return <p className="print-text">Informação registrada, mas não disponível para exibição estruturada.</p>;

  return (
    <div className="print-grid two">
      {items.map((item) => (
        <PrintField key={item.label} label={item.label} value={item.result} />
      ))}
    </div>
  );
}

function UnlockPatternGrid({ pattern }) {
  const parsed = parseUnlockPattern(pattern);
  if (!parsed.text) return <p className="print-text">Não informado</p>;
  if (!parsed.valid) return <p className="print-text">{parsed.text}</p>;

  const positions = {
    1: [18, 18],
    2: [56, 18],
    3: [94, 18],
    4: [18, 56],
    5: [56, 56],
    6: [94, 56],
    7: [18, 94],
    8: [56, 94],
    9: [94, 94],
  };
  const linePoints = parsed.points.map((point) => positions[point]).filter(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <svg className="unlock-pattern" viewBox="0 0 112 112" role="img" aria-label="Padrão de desbloqueio informado">
        {linePoints.length > 1 ? (
          <polyline
            points={linePoints.map(([x, y]) => `${x},${y}`).join(" ")}
            fill="none"
            stroke="#2563eb"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
        ) : null}
        {Object.entries(positions).map(([point, [x, y]]) => {
          const active = parsed.points.includes(Number(point));
          return (
            <g key={point}>
              <circle cx={x} cy={y} r="8" fill={active ? "#2563eb" : "#fff"} stroke="#111827" strokeWidth="2" />
              <text x={x} y={y + 3} textAnchor="middle" fontSize="8" fontWeight="800" fill={active ? "#fff" : "#111827"}>{point}</text>
            </g>
          );
        })}
      </svg>
      <p className="print-text text-xs">Sequência: {parsed.text}</p>
    </div>
  );
}

function PrintHeader({ order, copyLabel }) {
  return (
    <header className="mb-3 flex flex-col gap-3 border-b border-slate-300 pb-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <img src={logoUrl} alt="NT Informática" className="h-14 w-14 rounded-md object-contain" />
        <div className="min-w-0">
          <h2 className="text-base font-black text-slate-950">{serviceOrderCompany.name}</h2>
          <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-700">
            {serviceOrderCompany.addressLines.join(" | ")}<br />
            WhatsApp: {serviceOrderCompany.whatsapp} | CNPJ: {serviceOrderCompany.cnpj}<br />
            {serviceOrderCompany.email}
          </p>
        </div>
      </div>

      <div className="text-left sm:text-right">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Ordem de Serviço</p>
        <p className="mt-1 text-2xl font-black text-slate-950">{formatOsNumber(order)}</p>
        <p className="mt-1 inline-flex rounded border border-slate-400 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-800">{copyLabel}</p>
        <div className="mt-2 text-[10px] font-bold leading-4 text-slate-700">
          Entrada: {formatDate(order.entryDate)} às {formatTime(order.entryTime)}<br />
          Status: {emptyText(order.status)}
        </div>
      </div>
    </header>
  );
}

function WarrantyBlock({ order }) {
  const days = Number(order.warrantyDays || 0);
  return (
    <PrintSection title="Garantia">
      <p className="print-text">
        {days > 0 ? `Garantia do serviço: ${days} dias.` : "Serviço sem prazo adicional de garantia informado."}
      </p>
      <p className="print-text mt-2">
        A garantia cobre exclusivamente o serviço executado e as peças substituídas pela assistência, dentro das condições descritas nesta Ordem de Serviço.
      </p>
    </PrintSection>
  );
}

function TermsBlock() {
  return (
    <PrintSection title="Termos da Ordem de Serviço">
      <ol className="print-terms">
        {serviceOrderTerms.map((term) => <li key={term}>{term}</li>)}
      </ol>
    </PrintSection>
  );
}

function Signatures({ copyType }) {
  return (
    <PrintSection title="Assinaturas">
      <p className="print-text mb-4">
        {copyType === "store"
          ? "Declaro que li e concordo com as condições desta Ordem de Serviço."
          : "Recebi uma via desta Ordem de Serviço."}
      </p>
      <div className="signature-grid">
        <div className="signature-line">Assinatura do cliente</div>
        <div className="signature-line">Responsável pela loja</div>
      </div>
      <div className="signature-grid">
        <div className="signature-line">Nome legível</div>
        <div className="signature-line">Data</div>
      </div>
    </PrintSection>
  );
}

function PrintFooter({ generatedAt }) {
  return (
    <footer className="mt-3 border-t border-slate-300 pt-2 text-center text-[9px] font-bold leading-4 text-slate-600">
      {serviceOrderCompany.name} | WhatsApp: {serviceOrderCompany.whatsapp} | CNPJ: {serviceOrderCompany.cnpj}<br />
      Documento gerado em {formatDateTime(generatedAt)}
    </footer>
  );
}

function ServiceOrderPrintCopy({ order, copyType, generatedAt }) {
  const isStore = copyType === "store";
  const copyLabel = isStore ? "Via da loja" : "Via do cliente";
  const archived = Boolean(order.deletedAt);
  const canceled = order.status === "Cancelado";

  return (
    <article className="service-order-copy">
      <div className="service-order-copy-inner">
        <PrintHeader order={order} copyLabel={copyLabel} />

        {archived || canceled ? (
          <div className="mb-3 rounded border border-slate-400 bg-slate-100 px-3 py-2 text-center text-[11px] font-black uppercase tracking-[0.16em] text-slate-900">
            {archived ? "Documento arquivado" : "Ordem de Serviço cancelada"}
          </div>
        ) : null}

        <div className="print-grid">
          <PrintSection title="Dados do cliente">
            <div className="print-grid three">
              <PrintField label="Nome" value={emptyText(order.customerName)} />
              <PrintField label="CPF/CNPJ" value={formatDocument(order.customerDocument)} />
              <PrintField label="WhatsApp/telefone" value={formatPhone(order.customerPhone)} />
            </div>
          </PrintSection>

          <PrintSection title="Equipamento">
            <div className="print-grid three">
              <PrintField label="Marca" value={emptyText(order.deviceBrand)} />
              <PrintField label="Modelo" value={emptyText(order.deviceModel)} />
              <PrintField label="Cor" value={emptyText(order.deviceColor, "-")} />
              <PrintField label="Série/IMEI" value={emptyText(order.deviceSerialImei, "-")} />
              <PrintField
                label="Senha"
                value={isStore ? emptyText(order.devicePassword, "Não informada") : (order.devicePassword ? "Senha fornecida à assistência" : "Não informada")}
              />
              <PrintField
                label="Padrão de desbloqueio"
                value={isStore ? (order.unlockPattern ? "Ver grade abaixo" : "Não informado") : (order.unlockPattern ? "Padrão fornecido à assistência" : "Não informado")}
              />
            </div>
            {isStore && order.unlockPattern ? (
              <div className="mt-3">
                <UnlockPatternGrid pattern={order.unlockPattern} />
              </div>
            ) : null}
          </PrintSection>

          <div className="print-grid two">
            <PrintSection title="Acessórios recebidos">
              <ItemsList value={order.accessories} labels={accessoryLabels} emptyLabel="Nenhum acessório informado" />
            </PrintSection>
            <PrintSection title="Estado do equipamento na entrada">
              <ItemsList value={order.deviceCondition} labels={conditionLabels} />
            </PrintSection>
          </div>

          <PrintSection title="Defeito informado pelo cliente">
            <p className="print-text">{emptyText(order.reportedDefect)}</p>
          </PrintSection>

          <div className="print-grid two">
            <PrintSection title="Serviços solicitados">
              <ItemsList value={order.requestedServices} labels={requestedServiceLabels} />
            </PrintSection>
            <PrintSection title="Valores e prazo">
              <div className="print-grid">
                <PrintField label="Valor da análise" value={formatMoney(order.analysisPrice)} />
                <PrintField label="Valor do serviço" value={formatMoney(order.servicePrice)} />
                <PrintField label="Prazo estimado" value={emptyText(order.estimatedDeadline, "A definir após diagnóstico")} />
              </div>
              <p className="print-text mt-2 text-[10px]">
                O prazo poderá sofrer alteração em razão da disponibilidade de peças, complexidade do reparo ou necessidade de testes adicionais.
              </p>
            </PrintSection>
          </div>

          <PrintSection title="Autorizações e ciência do cliente">
            <AuthorizationsList value={order.authorizations} />
          </PrintSection>

          <PrintSection title={isStore ? "Observações para o cliente" : "Observações"}>
            <p className="print-text">{emptyText(order.customerNotes, "Sem observações adicionais.")}</p>
          </PrintSection>

          {isStore && order.internalNotes ? (
            <PrintSection title="Observações internas">
              <p className="print-text">{order.internalNotes}</p>
            </PrintSection>
          ) : null}

          <WarrantyBlock order={order} />
          <TermsBlock />
          <Signatures copyType={copyType} />
        </div>

        <PrintFooter generatedAt={generatedAt} />
      </div>
    </article>
  );
}

export function ServiceOrderPrintDocument({ order, generatedAt }) {
  return (
    <div className="service-order-document service-order-print-root">
      <ServiceOrderPrintCopy order={order} copyType="store" generatedAt={generatedAt} />
      <ServiceOrderPrintCopy order={order} copyType="customer" generatedAt={generatedAt} />
    </div>
  );
}
