/** Ajustes: the tutor's connection, study preferences, theme, and the learner's data (backup, restore, reset). */
import { useEffect, useRef, useState } from 'react';
import { useAccounts } from '../account.ts';
import { type SyncState, deleteAccountData, useSyncState } from '../cloud-sync.ts';
import { DownloadIcon, TutorIcon } from '../components/Icons.tsx';
import { UsageMeter } from '../components/UsageMeter.tsx';
import { exportAll, importAll } from '../persist.ts';
import { DAILY_GOALS, TUTOR_MODELS, type Theme, updateSettings, useSettings } from '../settings.ts';
import { resetProgress } from '../store.ts';
import { toast } from '../toast.ts';
import { href } from '../router.ts';
import { refreshTutorUsage, tutorStore, useConnection, useTutorUsage } from '../tutor-store.ts';

const SYNC_TEXT: Record<SyncState, string> = {
  loading: 'Carregando seus dados…',
  saving: 'Salvando na sua conta…',
  saved: 'Tudo salvo na sua conta.',
  offline: 'Sem conexão: as mudanças ficam neste aparelho e vão para a conta quando a internet voltar.',
  error: 'Não foi possível salvar na sua conta agora.',
};

/** Ajustes → Conta, when accounts are on: where the data lives, the plan and today's tutor allowance. */
function AccountSection() {
  const sync = useSyncState();
  const usage = useTutorUsage();
  useEffect(() => refreshTutorUsage(), []);
  return (
    <section className="settings-section" aria-labelledby="set-account">
      <h2 id="set-account">Conta</h2>
      <p className={`settings-status settings-status--${sync === 'error' ? 'error' : sync === 'offline' ? 'off' : 'on'}`} role="status">
        {SYNC_TEXT[sync]}
      </p>
      <p className="settings-note">Progresso, quadro, mapas, conversas e preferências ficam na sua conta e aparecem em qualquer aparelho em que você entrar.</p>
      {usage && (
        <>
          <p>
            Plano <strong>{usage.plan === 'plus' ? 'Pro' : 'Grátis'}</strong>
          </p>
          <UsageMeter used={usage.used} limit={usage.limit} />
        </>
      )}
      <div className="settings-actions">
        <a className="btn" href={href({ name: 'plans' })}>
          {usage?.plan === 'plus' ? 'Gerenciar plano' : 'Ver planos'}
        </a>
      </div>
      <div className="settings-actions settings-actions--danger">
        <button
          type="button"
          className="btn btn--quiet btn--danger"
          onClick={async () => {
            if (!confirm('Apagar todos os seus dados da conta e deste aparelho (progresso, quadro, mapas e conversas)? Isso não pode ser desfeito.')) return;
            if (await deleteAccountData()) location.reload();
            else toast('Não foi possível apagar agora. Verifique a conexão e tente de novo.');
          }}
        >
          Apagar meus dados
        </button>
      </div>
    </section>
  );
}

const THEMES: Array<{ id: Theme; label: string }> = [
  { id: 'system', label: 'Do aparelho' },
  { id: 'light', label: 'Claro' },
  { id: 'dark', label: 'Escuro' },
];

export function SettingsScreen() {
  const settings = useSettings();
  const connection = useConnection();
  const accounts = useAccounts();
  const [showKey, setShowKey] = useState(false);
  const [test, setTest] = useState<{ state: 'idle' | 'testing' | 'ok' | 'error'; text?: string }>({ state: 'idle' });
  const file = useRef<HTMLInputElement>(null);

  const testKey = async () => {
    setTest({ state: 'testing' });
    const [{ default: Anthropic }, { describeError }] = await Promise.all([import('@anthropic-ai/sdk'), import('../../tutor/engine.ts')]);
    try {
      const client = new Anthropic({ apiKey: settings.apiKey.trim(), dangerouslyAllowBrowser: true, maxRetries: 0 });
      const model = await client.models.retrieve(settings.model);
      setTest({ state: 'ok', text: `Chave aceita. ${model.display_name} está disponível.` });
    } catch (err) {
      setTest({ state: 'error', text: describeError(err).text });
    }
  };

  const download = () => {
    const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chemrster-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const restore = async (f: File) => {
    try {
      const n = importAll(JSON.parse(await f.text()));
      toast(`Backup restaurado (${n} ${n === 1 ? 'parte' : 'partes'})`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Não foi possível ler o arquivo.');
    }
  };

  const status =
    connection.kind === 'server'
      ? accounts
        ? 'Conectado pelo servidor do app, dentro do limite diário do seu plano.'
        : 'Conectado pelo servidor do app: a chave fica no servidor.'
      : connection.kind === 'key'
        ? 'Conectado com a sua chave da API.'
        : connection.checked
          ? 'Modo offline: o tutor responde com a apostila do app.'
          : 'Verificando a conexão…';

  return (
    <div className="settings">
      <h1>Ajustes</h1>

      {accounts && <AccountSection />}

      <section className="settings-section" aria-labelledby="set-tutor">
        <h2 id="set-tutor">
          <TutorIcon /> Tutor com IA
        </h2>
        <p className={`settings-status settings-status--${connection.kind === 'offline' ? 'off' : 'on'}`}>{status}</p>
        <p className="settings-note">
          O tutor usa o Claude, da Anthropic. Sem conexão, ele ainda explica erros, mostra a teoria, analisa estruturas e propõe questões, a partir do conteúdo do
          app. Com a IA, ele conversa livremente, adapta a explicação a você e monta mapas e planos.
        </p>

        <label className="field">
          <span className="field-label">Sua chave da API da Anthropic</span>
          <span className="key-row">
            <input
              className="field-input"
              type={showKey ? 'text' : 'password'}
              value={settings.apiKey}
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-ant-…"
              onChange={(e) => {
                updateSettings({ apiKey: e.target.value });
                setTest({ state: 'idle' });
              }}
            />
            <button type="button" className="btn btn--small" onClick={() => setShowKey(!showKey)}>
              {showKey ? 'Ocultar' : 'Mostrar'}
            </button>
          </span>
          <span className="settings-note">
            A chave fica só neste aparelho e vai direto para a API da Anthropic. Crie uma em console.anthropic.com. Quem usa este aparelho pode vê-la.
          </span>
        </label>
        {settings.apiKey.trim() && (
          <div className="key-test">
            <button type="button" className="btn btn--small" onClick={testKey} disabled={test.state === 'testing'}>
              {test.state === 'testing' ? 'Testando…' : 'Testar a chave'}
            </button>
            {test.text && (
              <p className={`settings-status settings-status--${test.state === 'ok' ? 'on' : 'error'}`} role="status">
                {test.text}
              </p>
            )}
          </div>
        )}

        <fieldset className="choice-list">
          <legend className="field-label">Modelo</legend>
          {TUTOR_MODELS.map((m) => (
            <label key={m.id} className={`choice${settings.model === m.id ? ' is-on' : ''}`}>
              <input type="radio" name="model" checked={settings.model === m.id} onChange={() => updateSettings({ model: m.id })} />
              <span>
                <strong>{m.label}</strong>
                <span>{m.note}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </section>

      <section className="settings-section" aria-labelledby="set-study">
        <h2 id="set-study">Seus estudos</h2>
        <div className="settings-grid">
          <label className="field">
            <span className="field-label">Seu nome</span>
            <input className="field-input field-input--plain" value={settings.name} placeholder="Para o tutor te chamar" onChange={(e) => updateSettings({ name: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Data da prova</span>
            <input className="field-input field-input--plain" type="date" value={settings.examDate} onChange={(e) => updateSettings({ examDate: e.target.value })} />
          </label>
        </div>
        <fieldset className="choice-list choice-list--row">
          <legend className="field-label">Meta diária</legend>
          {DAILY_GOALS.map((g) => (
            <label key={g.xp} className={`choice${settings.dailyGoal === g.xp ? ' is-on' : ''}`}>
              <input type="radio" name="goal" checked={settings.dailyGoal === g.xp} onChange={() => updateSettings({ dailyGoal: g.xp })} />
              <span>
                <strong>
                  {g.label}: {g.xp} XP
                </strong>
                <span>{g.note}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </section>

      <section className="settings-section" aria-labelledby="set-look">
        <h2 id="set-look">Aparência</h2>
        <div className="segmented" role="radiogroup" aria-label="Tema">
          {THEMES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={settings.theme === t.id} className={settings.theme === t.id ? 'is-on' : ''} onClick={() => updateSettings({ theme: t.id })}>
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section" aria-labelledby="set-data">
        <h2 id="set-data">Seus dados</h2>
        <p className="settings-note">
          {accounts
            ? 'Além da sua conta, você pode guardar uma cópia em arquivo e restaurá-la quando quiser.'
            : 'Progresso, quadro, mapas e conversas ficam guardados neste navegador. Faça um backup para levar para outro aparelho.'}
        </p>
        <div className="settings-actions">
          <button type="button" className="btn" onClick={download}>
            <DownloadIcon /> Baixar backup
          </button>
          <button type="button" className="btn" onClick={() => file.current?.click()}>
            Restaurar backup
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void restore(f);
              e.target.value = '';
            }}
          />
        </div>
        <div className="settings-actions settings-actions--danger">
          <button
            type="button"
            className="btn btn--quiet btn--danger"
            onClick={() => {
              if (confirm('Apagar todas as conversas com o tutor?')) {
                tutorStore.set({ threads: {}, order: [] });
                toast('Conversas apagadas');
              }
            }}
          >
            Apagar conversas
          </button>
          <button
            type="button"
            className="btn btn--quiet btn--danger"
            onClick={() => {
              if (confirm('Zerar todo o progresso (XP, lições, revisões e histórico)? O quadro e os mapas continuam.')) {
                resetProgress();
                toast('Progresso zerado');
              }
            }}
          >
            Zerar progresso
          </button>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="set-keys">
        <h2 id="set-keys">Atalhos</h2>
        <dl className="shortcuts">
          <div>
            <dt>
              <kbd>Ctrl</kbd> + <kbd>K</kbd>
            </dt>
            <dd>Abrir o tutor em qualquer tela</dd>
          </div>
          <div>
            <dt>
              <kbd>1</kbd>–<kbd>4</kbd>, <kbd>Enter</kbd>
            </dt>
            <dd>Escolher e verificar nas questões</dd>
          </div>
          <div>
            <dt>
              <kbd>N</kbd>, <kbd>Delete</kbd>, <kbd>Ctrl</kbd> + <kbd>Z</kbd>
            </dt>
            <dd>Nova nota, apagar e desfazer no mapa</dd>
          </div>
          <div>
            <dt>
              <kbd>Alt</kbd> + setas
            </dt>
            <dd>Mover cartões no quadro</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
