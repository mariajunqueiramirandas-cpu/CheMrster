/**
 * Ajustes (src/app/screens/SettingsScreen.tsx): the tutor's connection, study preferences, theme,
 * and the learner's data (backup, restore, reset). The web's account and plan sections need
 * sign-in, which the Android app does not have yet, so they are not here.
 */
import { type ReactNode, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { exportAll, importAll } from '../../../src/app/persist.ts';
import { DAILY_GOALS, TUTOR_MODELS, type Theme, updateSettings, useSettings } from '../../../src/app/settings.ts';
import { resetProgress } from '../../../src/app/store.ts';
import { toast } from '../../../src/app/toast.ts';
import { tutorStore, useConnection } from '../../../src/app/tutor-store.ts';
import { ChoiceCard, Field, Segmented } from '../settings/controls.tsx';
import { pickJson, shareText } from '../settings/files.ts';
import { FONT, SIZE, useTheme } from '../theme.ts';
import { BackBar } from '../ui/Bars.tsx';
import { DownloadIcon, TutorIcon } from '../ui/Icons.tsx';
import { Btn, Txt } from '../ui/kit.tsx';
import { Page } from '../ui/Page.tsx';

const THEMES: Array<{ id: Theme; label: string }> = [
  { id: 'system', label: 'Do aparelho' },
  { id: 'light', label: 'Claro' },
  { id: 'dark', label: 'Escuro' },
];

/** "2026-11-08" ↔ "08/11/2026": the date is typed the Brazilian way and stored as the web stores it. */
const toBr = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : '');
function fromBr(text: string): string | undefined {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!m) return undefined;
  const [, d, mo, y] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  if (date.getDate() !== Number(d) || date.getMonth() !== Number(mo) - 1) return undefined;
  return `${y}-${mo}-${d}`;
}
/** Adds the slashes while typing: 08112026 → 08/11/2026. */
function maskDate(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
}

/** Asks before something that cannot be undone. */
const confirm = (title: string, message: string, action: string, run: () => void) =>
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: action, style: 'destructive', onPress: run },
  ]);

export function SettingsScreen() {
  const c = useTheme();
  const settings = useSettings();
  const connection = useConnection();
  const [showKey, setShowKey] = useState(false);
  const [test, setTest] = useState<{ state: 'idle' | 'testing' | 'ok' | 'error'; text?: string }>({ state: 'idle' });
  const [examText, setExamText] = useState(() => toBr(settings.examDate));
  const examValid = !examText || !!fromBr(examText);

  const testKey = async () => {
    setTest({ state: 'testing' });
    const [{ default: Anthropic }, { describeError }] = await Promise.all([import('@anthropic-ai/sdk'), import('../../../src/tutor/engine.ts')]);
    try {
      const client = new Anthropic({ apiKey: settings.apiKey.trim(), dangerouslyAllowBrowser: true, maxRetries: 0 });
      const model = await client.models.retrieve(settings.model);
      setTest({ state: 'ok', text: `Chave aceita. ${model.display_name} está disponível.` });
    } catch (err) {
      setTest({ state: 'error', text: describeError(err).text });
    }
  };

  const backup = async () => {
    try {
      await shareText(`chemrster-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(exportAll(), null, 2), 'application/json', 'Salvar backup');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Não foi possível criar o backup.');
    }
  };

  const restore = async () => {
    try {
      const text = await pickJson();
      if (text === undefined) return;
      const n = importAll(JSON.parse(text));
      toast(`Backup restaurado (${n} ${n === 1 ? 'parte' : 'partes'})`);
    } catch (err) {
      toast(err instanceof Error && !(err instanceof SyntaxError) ? err.message : 'Não foi possível ler o arquivo.');
    }
  };

  const status =
    connection.kind === 'server'
      ? 'Conectado pelo servidor do app: a chave fica no servidor.'
      : connection.kind === 'key'
        ? 'Conectado com a sua chave da API.'
        : connection.checked
          ? 'Modo offline: o tutor responde com a apostila do app.'
          : 'Verificando a conexão…';

  return (
    <Page header={<BackBar title="Ajustes" />} bottomPad={48}>
      <View style={styles.sections}>
        <Section title="Tutor com IA" icon={<TutorIcon color={c.cobalt} />}>
          <Status tone={connection.kind === 'offline' ? 'off' : 'on'} text={status} />
          <Txt variant="small" tone="muted">
            O tutor usa o Claude, da Anthropic. Sem conexão, ele ainda explica erros, mostra a teoria, analisa estruturas e propõe questões, a partir do conteúdo do
            app. Com a IA, ele conversa livremente, adapta a explicação a você e monta mapas e planos.
          </Txt>
          <Field
            label="Sua chave da API da Anthropic"
            mono
            value={settings.apiKey}
            placeholder="sk-ant-…"
            secureTextEntry={!showKey}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            importantForAutofill="no"
            onChangeText={(apiKey) => {
              updateSettings({ apiKey });
              setTest({ state: 'idle' });
            }}
            note="A chave fica só neste aparelho e vai direto para a API da Anthropic. Crie uma em console.anthropic.com. Quem usa este aparelho pode vê-la."
            right={<Btn small label={showKey ? 'Ocultar' : 'Mostrar'} onPress={() => setShowKey(!showKey)} />}
          />
          {settings.apiKey.trim() ? (
            <View style={styles.keyTest}>
              <Btn small label={test.state === 'testing' ? 'Testando…' : 'Testar a chave'} disabled={test.state === 'testing'} onPress={testKey} />
              {test.text ? <Status tone={test.state === 'ok' ? 'on' : 'error'} text={test.text} /> : null}
            </View>
          ) : null}
          <Label text="Modelo" />
          <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel="Modelo">
            {TUTOR_MODELS.map((m) => (
              <ChoiceCard key={m.id} on={settings.model === m.id} title={m.label} note={m.note} onPress={() => updateSettings({ model: m.id })} />
            ))}
          </View>
        </Section>

        <Section title="Seus estudos">
          <Field label="Seu nome" value={settings.name} placeholder="Para o tutor te chamar" onChangeText={(name) => updateSettings({ name })} autoCapitalize="words" />
          <Field
            label="Data da prova"
            value={examText}
            placeholder="DD/MM/AAAA"
            keyboardType="number-pad"
            maxLength={10}
            invalid={!examValid}
            note={examValid ? undefined : 'Escreva a data como 08/11/2026.'}
            onChangeText={(t) => {
              const masked = maskDate(t);
              setExamText(masked);
              if (!masked) updateSettings({ examDate: '' });
              else {
                const iso = fromBr(masked);
                if (iso) updateSettings({ examDate: iso });
              }
            }}
          />
          <Label text="Meta diária" />
          <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel="Meta diária">
            {DAILY_GOALS.map((g) => (
              <ChoiceCard key={g.xp} on={settings.dailyGoal === g.xp} title={`${g.label}: ${g.xp} XP`} note={g.note} onPress={() => updateSettings({ dailyGoal: g.xp })} />
            ))}
          </View>
        </Section>

        <Section title="Aparência">
          <Segmented label="Tema" options={THEMES} value={settings.theme} onChange={(theme) => updateSettings({ theme })} />
        </Section>

        <Section title="Seus dados">
          <Txt variant="small" tone="muted">
            Progresso, quadro, mapas e conversas ficam guardados neste aparelho. Faça um backup para levar para outro aparelho ou para o CheMrster no navegador.
          </Txt>
          <View style={styles.actions}>
            <Btn label="Salvar backup" icon={(color) => <DownloadIcon color={color} width={20} height={20} />} onPress={backup} />
            <Btn label="Restaurar backup" onPress={restore} />
          </View>
          <View style={styles.actions}>
            <Btn
              kind="danger"
              label="Apagar conversas"
              onPress={() =>
                confirm('Apagar conversas?', 'Todas as conversas com o tutor serão apagadas.', 'Apagar', () => {
                  tutorStore.set({ threads: {}, order: [] });
                  toast('Conversas apagadas');
                })
              }
            />
            <Btn
              kind="danger"
              label="Zerar progresso"
              onPress={() =>
                confirm('Zerar progresso?', 'XP, lições, revisões e histórico voltam ao zero. O quadro e os mapas continuam.', 'Zerar', () => {
                  resetProgress();
                  toast('Progresso zerado');
                })
              }
            />
          </View>
        </Section>

        <Section title="Gestos">
          {GESTURES.map(([gesture, what]) => (
            <View key={gesture} style={styles.gesture}>
              <Text style={[styles.gestureName, { color: c.text }]}>{gesture}</Text>
              <Txt variant="small" tone="muted">
                {what}
              </Txt>
            </View>
          ))}
        </Section>
      </View>
    </Page>
  );
}

const GESTURES: Array<[string, string]> = [
  ['Deslizar para o lado', 'Passar os cartões de teoria de uma lição'],
  ['Puxar para baixo', 'Fechar o tutor e as janelas que sobem da borda'],
  ['Voltar do Android', 'Sair de uma tela; numa lição, pergunta antes de sair'],
  ['Pinçar com dois dedos', 'Aproximar e afastar o mapa'],
  ['Tocar na aba aberta', 'Voltar ao topo da tela'],
];

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  const c = useTheme();
  return (
    <View style={[styles.section, { borderColor: c.benchDeep, backgroundColor: c.surface }]}>
      <View style={styles.sectionHead}>
        {icon}
        <Txt variant="heading" accessibilityRole="header">
          {title}
        </Txt>
      </View>
      {children}
    </View>
  );
}

function Label({ text }: { text: string }) {
  const c = useTheme();
  return <Text style={[styles.label, { color: c.text }]}>{text}</Text>;
}

/** A coloured dot and a line: connected, offline, or what went wrong. */
function Status({ tone, text }: { tone: 'on' | 'off' | 'error'; text: string }) {
  const c = useTheme();
  const dot = tone === 'on' ? c.right : tone === 'error' ? c.wrong : c.muted;
  return (
    <View style={styles.status} accessibilityLiveRegion="polite">
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={[styles.statusText, { color: tone === 'error' ? c.wrong : c.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sections: { gap: 18, paddingTop: 4 },
  section: { gap: 14, padding: 18, borderRadius: 18, borderWidth: 2 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontFamily: FONT.uiBold, fontSize: SIZE.small },
  choices: { gap: 8 },
  keyTest: { gap: 10, alignItems: 'flex-start' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  statusText: { flex: 1, fontFamily: FONT.uiBold, fontSize: 15, lineHeight: 21 },
  gesture: { gap: 2 },
  gestureName: { fontFamily: FONT.uiBold, fontSize: 15 },
});
