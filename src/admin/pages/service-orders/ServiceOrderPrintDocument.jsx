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
  responsibilityTerms,
  serviceOrderCompany,
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

function CheckedList({ value, labels, emptyLabel = "Não informado" }) {
  const { items, unknown } = checkedItems(value, labels);
  if (unknown) return <p className="print-text">Informação registrada, mas não disponível para exibição estruturada.</p>;
  if (!items.length) return <p className="print-text">{emptyLabel}</p>;
  return (
    <div className="print-check-list">
      {items.map((item) => <span key={item} className="print-check">☑ {item}</span>)}
    </div>
  );
}

function AuthorizationsList({ value }) {
  const { items, unknown } = authorizationItems(value);
  if (unknown) return <p className="print-text">Informação registrada, mas não disponível para exibição estruturada.</p>;

  return (
    <div className="print-check-list two-cols">
      {items.map((item) => (
        <span key={item.key} className="print-check">{item.checked ? "☑" : "☐"} {item.label}</span>
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
    <div className="unlock-wrap">
      <svg className="unlock-pattern" viewBox="0 0 112 112" role="img" aria-label="Padrão de desbloqueio informado">
        {linePoints.length > 1 ? (
          <polyline
            points={linePoints.map(([x, y]) => `${x},${y}`).join(" ")}
            fill="none"
            stroke="#1d4ed8"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
        ) : null}
        {Object.entries(positions).map(([point, [x, y]]) => {
          const active = parsed.points.includes(Number(point));
          return (
            <g key={point}>
              <circle cx={x} cy={y} r="8" fill={active ? "#1d4ed8" : "#fff"} stroke="#111827" strokeWidth="2" />
              <text x={x} y={y + 3} textAnchor="middle" fontSize="8" fontWeight="800" fill={active ? "#fff" : "#111827"}>{point}</text>
            </g>
          );
        })}
      </svg>
      <p className="print-text small">Sequência registrada: {parsed.text}</p>
    </div>
  );
}

function DocumentHeader({ order, title = "Ordem de Serviço", compact = false }) {
  return (
    <header className={`os-header ${compact ? "compact" : ""}`}>
      <div className="os-brand">
        <img src={logoUrl} alt="NT Informática" className="os-logo" />
        <div>
          <h2>{serviceOrderCompany.name}</h2>
          <p className="brand-subtitle">{serviceOrderCompany.subtitle}</p>
          <p>{serviceOrderCompany.addressLines.join(" | ")}</p>
          <p>WhatsApp: {serviceOrderCompany.whatsapp} | CNPJ: {serviceOrderCompany.cnpj}</p>
        </div>
      </div>
      <div className="os-title-box">
        <p className="os-title">{title}</p>
        <strong>{formatOsNumber(order)}</strong>
        {!compact ? (
          <div className="os-title-meta">
            <span>Data: {formatDate(order.entryDate)}</span>
            <span>Hora: {formatTime(order.entryTime)}</span>
            <span>Status: {emptyText(order.status)}</span>
          </div>
        ) : null}
      </div>
    </header>
  );
}

function DocumentNotice({ order }) {
  const archived = Boolean(order.deletedAt);
  const canceled = order.status === "Cancelado";
  if (!archived && !canceled) return null;
  return (
    <div className="document-notice">
      {archived ? "ORDEM DE SERVIÇO ARQUIVADA" : "ORDEM DE SERVIÇO CANCELADA"}
    </div>
  );
}

function WarrantyLine({ order }) {
  const days = Number(order.warrantyDays ?? 90);
  if (!Number.isFinite(days) || days <= 0) return "Garantia: serviço sem prazo adicional informado.";
  return `Garantia: ${days} dias.`;
}

function PageFooter({ order, generatedAt }) {
  return (
    <footer className="os-footer">
      {serviceOrderCompany.name} | WhatsApp: {serviceOrderCompany.whatsapp} | CNPJ: {serviceOrderCompany.cnpj}<br />
      Documento referente à {formatOsNumber(order)} | Gerado em {formatDateTime(generatedAt)}
    </footer>
  );
}

function Signatures({ responsibility = false }) {
  return (
    <PrintSection title="Assinaturas" className="signature-section">
      {responsibility ? <p className="print-text mb-3">Declaro que li e concordo com os termos desta Ordem de Serviço.</p> : null}
      <div className="signature-grid">
        <div>
          <div className="signature-line" />
          <p>Assinatura do cliente ou responsável</p>
          <p>Nome: _______________________________</p>
        </div>
        <div>
          <div className="signature-line" />
          <p>Responsável pela NT Informática</p>
          <p>Nome: _______________________________</p>
        </div>
      </div>
      <p className="signature-date">Data: ____/____/________</p>
    </PrintSection>
  );
}

function ServiceOrderPage({ order, generatedAt }) {
  return (
    <article className="service-order-sheet service-order-page">
      <div className="service-order-sheet-inner">
        <DocumentHeader order={order} />
        <DocumentNotice order={order} />

        <div className="print-grid page-one-grid">
          <PrintSection title="Dados do cliente">
            <div className="print-grid three">
              <PrintField label="Nome completo" value={emptyText(order.customerName)} />
              <PrintField label="CPF/RG ou CPF/CNPJ" value={formatDocument(order.customerDocument)} />
              <PrintField label="WhatsApp" value={formatPhone(order.customerPhone)} />
              <PrintField label="Data de entrada" value={formatDate(order.entryDate)} />
              <PrintField label="Hora de entrada" value={formatTime(order.entryTime)} />
            </div>
          </PrintSection>

          <PrintSection title="Dados do equipamento">
            <div className="print-grid four">
              <PrintField label="Marca" value={emptyText(order.deviceBrand)} />
              <PrintField label="Modelo" value={emptyText(order.deviceModel)} />
              <PrintField label="Cor" value={emptyText(order.deviceColor, "-")} />
              <PrintField label="Número de série ou IMEI" value={emptyText(order.deviceSerialImei, "-")} />
            </div>
          </PrintSection>

          <PrintSection title="Senha / desbloqueio">
            <div className="print-grid two unlock-section">
              <div>
                <PrintField label="Senha digitada" value={emptyText(order.devicePassword, "Não informada")} />
                <p className="print-text small mt-2">Informação fornecida pelo cliente para realização dos testes técnicos.</p>
              </div>
              <div>
                <span className="print-label">Padrão Android</span>
                <UnlockPatternGrid pattern={order.unlockPattern} />
              </div>
            </div>
          </PrintSection>

          <div className="print-grid two">
            <PrintSection title="Acessórios entregues">
              <CheckedList value={order.accessories} labels={accessoryLabels} emptyLabel="Nenhum acessório informado." />
            </PrintSection>
            <PrintSection title="Estado do equipamento na entrada">
              <CheckedList value={order.deviceCondition} labels={conditionLabels} />
            </PrintSection>
          </div>

          <PrintSection title="Defeito informado pelo cliente" className="highlight-section">
            <p className="print-text">{emptyText(order.reportedDefect)}</p>
          </PrintSection>

          <div className="print-grid two">
            <PrintSection title="Serviço solicitado">
              <CheckedList value={order.requestedServices} labels={requestedServiceLabels} />
            </PrintSection>
            <PrintSection title="Análise e prazo">
              <div className="print-grid">
                <PrintField label="Valor da análise" value={formatMoney(order.analysisPrice)} />
                <PrintField label="Valor do serviço" value={formatMoney(order.servicePrice)} />
                <PrintField label="Prazo estimado" value={emptyText(order.estimatedDeadline, "A definir após diagnóstico")} />
              </div>
              <p className="print-text small mt-2">O prazo informado é uma estimativa e poderá sofrer alteração em razão da complexidade do serviço, necessidade de testes ou disponibilidade de peças.</p>
            </PrintSection>
          </div>

          <PrintSection title="Observações">
            <p className="print-text">{emptyText(order.customerNotes, "Sem observações adicionais.")}</p>
          </PrintSection>

          <PrintSection title="Autorizações">
            <AuthorizationsList value={order.authorizations} />
          </PrintSection>

          <PrintSection title="Declaração resumida">
            <p className="print-text">
              Declaro que as informações fornecidas são verdadeiras e que recebi as orientações iniciais referentes à análise do equipamento. Declaro também que li e concordo com os termos apresentados na segunda página desta Ordem de Serviço.
            </p>
            <p className="print-text mt-2 font-bold">{WarrantyLine({ order })}</p>
          </PrintSection>

          <Signatures />
        </div>

        <PageFooter order={order} generatedAt={generatedAt} />
      </div>
    </article>
  );
}

function TermsPage({ order, generatedAt }) {
  return (
    <article className="service-order-sheet terms-page">
      <div className="service-order-sheet-inner">
        <DocumentHeader order={order} title="Termo de Responsabilidade" compact />

        <section className="terms-identification">
          <PrintField label="Cliente" value={emptyText(order.customerName)} />
          <PrintField label="Equipamento" value={[order.deviceBrand, order.deviceModel].filter(Boolean).join(" ") || "Não informado"} />
          <PrintField label="Ordem de Serviço" value={formatOsNumber(order)} />
        </section>

        <h1 className="terms-title">Termo de Responsabilidade</h1>
        <div className="responsibility-terms">
          {responsibilityTerms.map((term) => (
            <section key={term.title} className="term-block">
              <h2>{term.title}</h2>
              {term.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </section>
          ))}
        </div>

        <Signatures responsibility />
        <PageFooter order={order} generatedAt={generatedAt} />
      </div>
    </article>
  );
}

export function ServiceOrderPrintDocument({ order, generatedAt }) {
  return (
    <div className="service-order-document service-order-print-root">
      <ServiceOrderPage order={order} generatedAt={generatedAt} />
      <TermsPage order={order} generatedAt={generatedAt} />
    </div>
  );
}
