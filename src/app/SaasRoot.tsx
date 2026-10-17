/**
 * The app with accounts (Clerk): signed-out visitors get the landing page; a signed-in
 * learner gets the app once this device holds their saved data (see cloud-sync.ts).
 * Loaded only when the server has Clerk keys, so the device-only app never downloads Clerk.
 */
import { ClerkProvider, UserButton, useAuth, useUser } from '@clerk/react';
import { ptBR } from '@clerk/localizations';
import { useEffect, useRef, useState } from 'react';
import { App } from './App.tsx';
import { setTokenSource } from './account.ts';
import { syncBilling } from './billing.ts';
import { startSync } from './cloud-sync.ts';
import { href } from './router.ts';
import { LandingScreen } from './screens/LandingScreen.tsx';
import { settingsStore, updateSettings } from './settings.ts';
import { toast } from './toast.ts';

export function SaasRoot({ publishableKey }: { publishableKey: string }) {
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      localization={ptBR}
      afterSignOutUrl="/"
      appearance={{ variables: { colorPrimary: '#c0157a', fontFamily: "'Atkinson Hyperlegible Next', system-ui, sans-serif", borderRadius: '12px' } }}
    >
      <Gate />
    </ClerkProvider>
  );
}

function Gate() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const { user } = useUser();
  const tokens = useRef(getToken);
  tokens.current = getToken;
  const [readyFor, setReadyFor] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    setTokenSource(() => tokens.current());
    const sync = startSync(userId);
    let live = true;
    void sync.ready.then(() => live && setReadyFor(userId));
    return () => {
      live = false;
      void sync.flush().finally(() => sync.stop());
    };
  }, [userId]);

  // Back from paying on Mercado Pago (back_url ?assinatura=retorno&preapproval_id=...): read the subscription, show Planos.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!readyFor || !params.has('assinatura')) return;
    history.replaceState(null, '', `/${href({ name: 'plans' })}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    syncBilling(params.get('preapproval_id') ?? undefined)
      .then((view) => toast(view.plan === 'plus' ? 'Pro ativo. Bons estudos!' : 'Assim que o Mercado Pago confirmar o pagamento, o Pro é ativado.'))
      .catch((err: Error) => toast(err.message));
  }, [readyFor]);

  // The tutor calls the learner by name: take it from the account when none was set.
  useEffect(() => {
    if (readyFor && user?.firstName && !settingsStore.get().name) updateSettings({ name: user.firstName });
  }, [readyFor, user?.firstName]);

  if (!isLoaded) return <p className="page-loading">Carregando…</p>;
  if (!isSignedIn) return <LandingScreen />;
  if (readyFor !== userId) return <p className="page-loading">Carregando seus dados…</p>;
  return <App account={<UserButton />} />;
}
