import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock, Mail, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { Section } from "../components/Section";
import { useCustomerAuth } from "./CustomerAuthContext";
import { formatCpf, formatPhone, passwordHelpText } from "./customerValidation";

function FormShell({ eyebrow, title, description, children, onNavigate, getNavHref }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-nt-ink text-white">
      <Header onNavigate={onNavigate} getNavHref={getNavHref} />
      <main className="pt-20">
        <Section eyebrow={eyebrow} title={title} description={description}>
          <div className="mx-auto max-w-3xl">{children}</div>
        </Section>
      </main>
      <Footer />
    </div>
  );
}

function Field({ label, id, required, children, hint }) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-2 block text-sm font-bold text-slate-200">
        {label} {required ? <span className="text-nt-cyan">*</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-2 block text-xs leading-5 text-slate-400">{hint}</span> : null}
    </label>
  );
}

function inputClass() {
  return "w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-nt-cyan focus:ring-2 focus:ring-nt-cyan/30";
}

function Alert({ type = "info", children }) {
  const color = type === "success" ? "border-lime-300/30 bg-lime-300/10 text-lime-100" : type === "error" ? "border-red-300/30 bg-red-300/10 text-red-100" : "border-nt-cyan/30 bg-nt-cyan/10 text-slate-100";
  return (
    <div className={`flex gap-3 rounded-lg border p-4 text-sm leading-6 ${color}`} role={type === "error" ? "alert" : "status"}>
      {type === "success" ? <CheckCircle2 className="mt-0.5 shrink-0" size={18} /> : <AlertCircle className="mt-0.5 shrink-0" size={18} />}
      <span>{children}</span>
    </div>
  );
}

function PasswordInput({ id, value, onChange, placeholder = "Sua senha", required = true }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input id={id} required={required} type={visible ? "text" : "password"} value={value} onChange={onChange} placeholder={placeholder} className={`${inputClass()} pr-12`} autoComplete="current-password" />
      <button type="button" aria-label={visible ? "Ocultar senha" : "Mostrar senha"} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-slate-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nt-cyan" onClick={() => setVisible((next) => !next)}>
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export function LoginPage({ onNavigate, getNavHref, navigateTo }) {
  const auth = useCustomerAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (auth.authenticated) navigateTo("/minha-conta");
  }, [auth.authenticated]);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await auth.signIn(email, password);
      if (!remember) {
        // Supabase Auth keeps the browser session by default; this checkbox is reserved for future session policy.
      }
      navigateTo("/minha-conta");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormShell eyebrow="Área do cliente" title="Entrar na sua conta" description="Acompanhe seus dados e deixe seu cadastro pronto para as próximas etapas do e-commerce da NT." onNavigate={onNavigate} getNavHref={getNavHref}>
      <Card>
        {!auth.configured ? <Alert type="error">Supabase não configurado. O login real fica disponível quando as variáveis do projeto estiverem carregadas.</Alert> : null}
        {message ? <div className="mb-5"><Alert type="error">{message}</Alert></div> : null}
        <form className="mt-6 grid gap-5" onSubmit={submit}>
          <Field id="login-email" label="E-mail" required>
            <input id="login-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass()} autoComplete="email" required />
          </Field>
          <Field id="login-password" label="Senha" required>
            <PasswordInput id="login-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex items-center gap-2 text-slate-300">
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-nt-cyan" />
              Lembrar-me
            </label>
            <a href="/esqueci-senha" className="font-bold text-nt-cyan hover:text-white">Esqueci minha senha</a>
          </div>
          <button type="submit" disabled={loading || !auth.configured} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-nt-blue px-5 py-3 text-sm font-black text-white shadow-glow transition hover:bg-nt-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nt-cyan disabled:cursor-not-allowed disabled:opacity-60">
            <Lock size={18} /> {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
        <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4 text-center text-sm text-slate-300">
          Ainda não tem conta? <a href="/cadastro" className="font-black text-nt-cyan hover:text-white">Criar conta</a>
        </div>
      </Card>
    </FormShell>
  );
}

export function RegisterPage({ onNavigate, getNavHref, navigateTo }) {
  const auth = useCustomerAuth();
  const [values, setValues] = useState({
    fullName: "",
    cpf: "",
    birthDate: "",
    phone: "",
    secondaryPhone: "",
    email: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
    acceptPrivacy: false,
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    country: "Brasil",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");

  const passwordHint = useMemo(() => passwordHelpText(values.password), [values.password]);

  function setField(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setSuccess("");
    try {
      await auth.signUp(values);
      setSuccess("Cadastro criado. Se o Supabase exigir confirmação, verifique seu e-mail antes de entrar.");
      window.setTimeout(() => navigateTo("/minha-conta"), 900);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormShell eyebrow="Cadastro" title="Crie sua conta NT" description="Seu cadastro deixa perfil, segurança e dados de retirada preparados para o e-commerce." onNavigate={onNavigate} getNavHref={getNavHref}>
      <Card>
        <div className="mb-6 rounded-lg border border-amber-300/35 bg-amber-300/10 p-4 text-sm font-semibold leading-6 text-amber-100">
          ATENÇÃO: atualmente todos os pedidos da NT Informática são exclusivamente para RETIRADA NA LOJA. O endereço é mantido para futuras funcionalidades de entrega.
        </div>
        {message ? <div className="mb-5"><Alert type="error">{message}</Alert></div> : null}
        {success ? <div className="mb-5"><Alert type="success">{success}</Alert></div> : null}
        <form className="grid gap-6" onSubmit={submit}>
          <div className="grid gap-5 md:grid-cols-2">
            <Field id="register-name" label="Nome completo" required><input id="register-name" value={values.fullName} onChange={(event) => setField("fullName", event.target.value)} className={inputClass()} autoComplete="name" required /></Field>
            <Field id="register-cpf" label="CPF" required><input id="register-cpf" value={values.cpf} onChange={(event) => setField("cpf", formatCpf(event.target.value))} className={inputClass()} inputMode="numeric" required /></Field>
            <Field id="register-birth" label="Data de nascimento"><input id="register-birth" type="date" value={values.birthDate} onChange={(event) => setField("birthDate", event.target.value)} className={inputClass()} /></Field>
            <Field id="register-phone" label="Telefone celular" required><input id="register-phone" value={values.phone} onChange={(event) => setField("phone", formatPhone(event.target.value))} className={inputClass()} inputMode="tel" autoComplete="tel" required /></Field>
            <Field id="register-secondary-phone" label="Telefone secundário"><input id="register-secondary-phone" value={values.secondaryPhone} onChange={(event) => setField("secondaryPhone", formatPhone(event.target.value))} className={inputClass()} inputMode="tel" /></Field>
            <Field id="register-email" label="E-mail" required><input id="register-email" type="email" value={values.email} onChange={(event) => setField("email", event.target.value)} className={inputClass()} autoComplete="email" required /></Field>
            <Field id="register-password" label="Senha" required hint={passwordHint}><PasswordInput id="register-password" value={values.password} onChange={(event) => setField("password", event.target.value)} placeholder="Mínimo 8 caracteres" /></Field>
            <Field id="register-confirm" label="Confirmar senha" required><PasswordInput id="register-confirm" value={values.confirmPassword} onChange={(event) => setField("confirmPassword", event.target.value)} placeholder="Repita sua senha" /></Field>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-5">
            <h3 className="text-lg font-black text-white">Endereço para futuras entregas</h3>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <Field id="register-cep" label="CEP"><input id="register-cep" value={values.cep} onChange={(event) => setField("cep", event.target.value)} className={inputClass()} inputMode="numeric" /></Field>
              <Field id="register-street" label="Rua"><input id="register-street" value={values.street} onChange={(event) => setField("street", event.target.value)} className={inputClass()} /></Field>
              <Field id="register-number" label="Número"><input id="register-number" value={values.number} onChange={(event) => setField("number", event.target.value)} className={inputClass()} /></Field>
              <Field id="register-complement" label="Complemento"><input id="register-complement" value={values.complement} onChange={(event) => setField("complement", event.target.value)} className={inputClass()} /></Field>
              <Field id="register-neighborhood" label="Bairro"><input id="register-neighborhood" value={values.neighborhood} onChange={(event) => setField("neighborhood", event.target.value)} className={inputClass()} /></Field>
              <Field id="register-city" label="Cidade"><input id="register-city" value={values.city} onChange={(event) => setField("city", event.target.value)} className={inputClass()} /></Field>
              <Field id="register-state" label="Estado"><input id="register-state" value={values.state} onChange={(event) => setField("state", event.target.value.toUpperCase().slice(0, 2))} className={inputClass()} maxLength={2} /></Field>
              <Field id="register-country" label="País"><input id="register-country" value={values.country} onChange={(event) => setField("country", event.target.value)} className={inputClass()} /></Field>
            </div>
          </div>

          <div className="grid gap-3 text-sm text-slate-300">
            <label className="flex gap-3"><input type="checkbox" checked={values.acceptTerms} onChange={(event) => setField("acceptTerms", event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-950 text-nt-cyan" required /> Aceito os Termos de Uso da NT Informática.</label>
            <label className="flex gap-3"><input type="checkbox" checked={values.acceptPrivacy} onChange={(event) => setField("acceptPrivacy", event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-950 text-nt-cyan" required /> Aceito a Política de Privacidade.</label>
          </div>

          <button type="submit" disabled={loading || !auth.configured} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-nt-blue px-5 py-3 text-sm font-black text-white shadow-glow transition hover:bg-nt-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nt-cyan disabled:cursor-not-allowed disabled:opacity-60">
            <UserPlus size={18} /> {loading ? "Criando conta..." : "Cadastrar"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-300">Já tem conta? <a href="/login" className="font-black text-nt-cyan hover:text-white">Entrar</a></p>
      </Card>
    </FormShell>
  );
}

export function ForgotPasswordPage({ onNavigate, getNavHref }) {
  const auth = useCustomerAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setSuccess("");
    try {
      await auth.requestPasswordReset(email);
      setSuccess("Enviamos as instruções para o e-mail informado.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormShell eyebrow="Segurança" title="Recuperar senha" description="Informe seu e-mail para receber o link seguro de redefinição." onNavigate={onNavigate} getNavHref={getNavHref}>
      <Card>
        {message ? <div className="mb-5"><Alert type="error">{message}</Alert></div> : null}
        {success ? <div className="mb-5"><Alert type="success">{success}</Alert></div> : null}
        <form className="grid gap-5" onSubmit={submit}>
          <Field id="forgot-email" label="E-mail" required><input id="forgot-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass()} required /></Field>
          <button type="submit" disabled={loading || !auth.configured} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-nt-blue px-5 py-3 text-sm font-black text-white shadow-glow transition hover:bg-nt-cyan disabled:opacity-60">
            <Mail size={18} /> {loading ? "Enviando..." : "Enviar e-mail"}
          </button>
        </form>
        <Button href="/login" variant="secondary" className="mt-5 w-full">Voltar para login</Button>
      </Card>
    </FormShell>
  );
}

export function ResetPasswordPage({ onNavigate, getNavHref, navigateTo }) {
  const auth = useCustomerAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (accessToken) {
      auth.setRecoverySession({ access_token: accessToken, refresh_token: refreshToken || "" });
      window.history.replaceState({}, "", "/redefinir-senha");
    }
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setMessage("As senhas não conferem.");
      return;
    }
    setLoading(true);
    setMessage("");
    setSuccess("");
    try {
      await auth.updatePassword(password);
      setSuccess("Senha alterada com sucesso.");
      window.setTimeout(() => navigateTo("/minha-conta/seguranca"), 900);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormShell eyebrow="Segurança" title="Redefinir senha" description="Crie uma nova senha forte para sua conta NT." onNavigate={onNavigate} getNavHref={getNavHref}>
      <Card>
        {message ? <div className="mb-5"><Alert type="error">{message}</Alert></div> : null}
        {success ? <div className="mb-5"><Alert type="success">{success}</Alert></div> : null}
        <form className="grid gap-5" onSubmit={submit}>
          <Field id="reset-password" label="Nova senha" required hint={passwordHelpText(password)}><PasswordInput id="reset-password" value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
          <Field id="reset-confirm" label="Confirmar nova senha" required><PasswordInput id="reset-confirm" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></Field>
          <button type="submit" disabled={loading || !auth.authenticated} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-nt-blue px-5 py-3 text-sm font-black text-white shadow-glow transition hover:bg-nt-cyan disabled:opacity-60">
            {loading ? "Salvando..." : "Alterar senha"}
          </button>
        </form>
      </Card>
    </FormShell>
  );
}

export { Alert, Field, FormShell, inputClass };
