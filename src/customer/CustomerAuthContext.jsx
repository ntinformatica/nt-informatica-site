import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { getCustomerProfile, markCustomerLastLogin, saveCustomerAddress, upsertCustomerProfile } from "./customerService";
import { isStrongPassword, isValidBrazilianPhone, isValidCpf, isValidEmail, normalizeProfilePayload } from "./customerValidation";

const CustomerAuthContext = createContext(null);

function authErrorMessage(error) {
  const message = String(error?.message || error || "");
  if (message.includes("Invalid login credentials")) return "E-mail ou senha inválidos.";
  if (message.includes("User already registered")) return "Este e-mail já possui cadastro.";
  if (message.includes("Email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (message.includes("Signup is disabled")) return "Cadastro indisponível no momento.";
  return message || "Não foi possível concluir a operação.";
}

export function CustomerAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  async function loadProfile(nextSession = session) {
    const userId = nextSession?.user?.id;
    if (!userId) {
      setProfile(null);
      return null;
    }

    setProfileLoading(true);
    try {
      const currentProfile = await getCustomerProfile(userId);
      setProfile(currentProfile);
      return currentProfile;
    } catch (error) {
      console.warn("Nao foi possivel carregar perfil do cliente:", error);
      setProfile(null);
      return null;
    } finally {
      setProfileLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function boot() {
      if (!isSupabaseConfigured) {
        if (mounted) setLoading(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session || null);
      if (data.session) {
        await loadProfile(data.session);
        markCustomerLastLogin(data.session.user?.id).catch(() => null);
      }
      if (mounted) setLoading(false);
    }

    boot();
    const subscription = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession || null);
      if (nextSession) {
        await loadProfile(nextSession);
        markCustomerLastLogin(nextSession.user?.id).catch(() => null);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription?.data?.subscription?.unsubscribe?.();
    };
  }, []);

  async function signIn(email, password) {
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) throw new Error(authErrorMessage(result.error));
    await markCustomerLastLogin(result.data.user?.id);
    return result.data;
  }

  async function signUp(values) {
    if (!isValidEmail(values.email)) throw new Error("Informe um e-mail válido.");
    if (!isValidCpf(values.cpf)) throw new Error("Informe um CPF válido.");
    if (!isValidBrazilianPhone(values.phone)) throw new Error("Informe um telefone celular brasileiro válido.");
    if (!isStrongPassword(values.password)) throw new Error("A senha ainda não atende aos requisitos de segurança.");
    if (values.password !== values.confirmPassword) throw new Error("As senhas não conferem.");
    if (!values.acceptTerms || !values.acceptPrivacy) throw new Error("Aceite os termos e a política de privacidade para continuar.");

    const profilePayload = normalizeProfilePayload(values);
    const result = await supabase.auth.signUp({
      email: values.email.trim(),
      password: values.password,
      options: {
        data: {
          full_name: profilePayload.full_name,
          cpf: profilePayload.cpf,
          phone: profilePayload.phone,
          phone_normalized: profilePayload.phone_normalized,
          birth_date: profilePayload.birth_date,
          terms_accepted: true,
          privacy_accepted: true,
          address: {
            label: "Principal",
            cep: values.cep || "",
            street: values.street || "",
            number: values.number || "",
            complement: values.complement || "",
            neighborhood: values.neighborhood || "",
            city: values.city || "",
            state: values.state || "",
            country: values.country || "Brasil",
            is_default: true,
          },
        },
      },
    });

    if (result.error) throw new Error(authErrorMessage(result.error));
    if (result.data.session?.user?.id) {
      await upsertCustomerProfile(result.data.session.user.id, {
        ...values,
        terms_accepted_at: new Date().toISOString(),
        privacy_accepted_at: new Date().toISOString(),
      }).catch(() => null);
      if (values.cep || values.street || values.city) {
        await saveCustomerAddress(result.data.session.user.id, { ...values, label: "Principal", isDefault: true }).catch(() => null);
      }
    }
    return result.data;
  }

  async function requestPasswordReset(email) {
    if (!isValidEmail(email)) throw new Error("Informe um e-mail válido.");
    const result = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    if (result.error) throw new Error(authErrorMessage(result.error));
    return result.data;
  }

  async function updatePassword(password) {
    if (!isStrongPassword(password)) throw new Error("A senha ainda não atende aos requisitos de segurança.");
    const result = await supabase.auth.updateUser({ password });
    if (result.error) throw new Error(authErrorMessage(result.error));
    return result.data;
  }

  async function updateEmail(email) {
    if (!isValidEmail(email)) throw new Error("Informe um e-mail válido.");
    const result = await supabase.auth.updateUser({ email: email.trim() });
    if (result.error) throw new Error(authErrorMessage(result.error));
    return result.data;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function signOutEverywhere() {
    await supabase.auth.signOut({ scope: "global" });
  }

  const value = useMemo(() => ({
    configured: isSupabaseConfigured,
    session,
    user: session?.user || null,
    profile,
    loading,
    profileLoading,
    authenticated: Boolean(session?.user),
    refreshProfile: loadProfile,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    updatePassword,
    updateEmail,
    signOutEverywhere,
    setRecoverySession: supabase.auth.setSession,
  }), [session, profile, loading, profileLoading]);

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (!context) throw new Error("useCustomerAuth deve ser usado dentro de CustomerAuthProvider.");
  return context;
}
