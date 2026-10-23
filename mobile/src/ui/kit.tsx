/** The building blocks every screen uses: text, buttons, paper, meters. */
import { type ReactNode, useRef } from 'react';
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  Text,
  type TextProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { FONT, type Palette, SIZE, paperShadow, useTheme } from '../theme.ts';
import { haptic } from '../lib/haptics.ts';

type Variant = 'body' | 'small' | 'strong' | 'title' | 'heading' | 'display' | 'kicker';
type Tone = 'text' | 'muted' | 'magenta' | 'right' | 'wrong' | 'ink' | 'white' | 'cobalt' | 'amber';

const VARIANT: Record<Variant, TextStyle> = {
  body: { fontFamily: FONT.ui, fontSize: SIZE.body, lineHeight: SIZE.body * 1.5 },
  small: { fontFamily: FONT.ui, fontSize: SIZE.small, lineHeight: SIZE.small * 1.4 },
  strong: { fontFamily: FONT.uiBold, fontSize: SIZE.body, lineHeight: SIZE.body * 1.4 },
  heading: { fontFamily: FONT.display, fontSize: SIZE.step1, lineHeight: SIZE.step1 * 1.2 },
  title: { fontFamily: FONT.display, fontSize: SIZE.step2, lineHeight: SIZE.step2 * 1.18, letterSpacing: -0.2 },
  display: { fontFamily: FONT.displayHeavy, fontSize: SIZE.step3, lineHeight: SIZE.step3 * 1.12, letterSpacing: -0.3 },
  kicker: { fontFamily: FONT.uiBold, fontSize: SIZE.small, lineHeight: SIZE.small * 1.3, letterSpacing: 0.6, textTransform: 'uppercase' },
};

export const toneColor = (c: Palette, tone: Tone) =>
  tone === 'white' ? '#fff' : tone === 'ink' ? c.ink : c[tone as Exclude<Tone, 'white' | 'ink'>];

/** Text in the app's type: `variant` sets the size and face, `tone` the colour. */
export function Txt({ variant = 'body', tone = 'text', style, ...rest }: TextProps & { variant?: Variant; tone?: Tone }) {
  const c = useTheme();
  return <Text {...rest} style={[VARIANT[variant], { color: toneColor(c, tone) }, style]} />;
}

/** Keeps a suffix in one piece ("-ico" never breaks after its hyphen): a word joiner after the hyphen. */
export const keepSuffixes = (text: string) => text.replace(/(^|[\s(*])-(?=\p{L})/gu, '$1-\u2060');

/** `**key terms**` in bold. */
export function Rich({ text, variant = 'body', tone = 'text', style }: { text: string; variant?: Variant; tone?: Tone; style?: StyleProp<TextStyle> }) {
  const parts = keepSuffixes(text).split(/\*\*(.+?)\*\*/g);
  return (
    <Txt variant={variant} tone={tone} style={style}>
      {parts.map((p, i) =>
        i % 2 ? (
          <Text key={i} style={{ fontFamily: FONT.uiBold }}>
            {p}
          </Text>
        ) : (
          p
        ),
      )}
    </Txt>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A press that sinks a little, like the web app's buttons. */
export function Press({
  children,
  style,
  onPress,
  disabled,
  sink = 2,
  tap = true,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & { children: ReactNode; style?: StyleProp<ViewStyle>; sink?: number; tap?: boolean }) {
  const y = useRef(new Animated.Value(0)).current;
  const to = (v: number) => Animated.timing(y, { toValue: v, duration: 70, useNativeDriver: true }).start();
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={() => to(sink)}
      onPressOut={() => to(0)}
      onPress={(e) => {
        if (tap) haptic('tap');
        onPress?.(e);
      }}
      style={[style, { transform: [{ translateY: y }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

type BtnKind = 'default' | 'primary' | 'quiet' | 'tutor' | 'danger';

/** The rounded pill button; `primary` is the magenta one with a pressed edge. */
export function Btn({
  label,
  icon,
  kind = 'default',
  wide,
  small,
  disabled,
  onPress,
  style,
  accessibilityLabel,
}: {
  label: string;
  icon?: (color: string) => ReactNode;
  kind?: BtnKind;
  wide?: boolean;
  small?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const c = useTheme();
  const look: Record<BtnKind, { bg: string; border: string; fg: string; edge?: string }> = {
    default: { bg: c.surface, border: c.rule, fg: c.text },
    primary: disabled ? { bg: c.benchDeep, border: 'transparent', fg: c.muted, edge: c.rule } : { bg: c.magenta, border: 'transparent', fg: '#fff', edge: c.magentaPress },
    quiet: { bg: 'transparent', border: 'transparent', fg: c.muted },
    tutor: { bg: c.cobaltWash, border: 'transparent', fg: c.cobalt },
    danger: { bg: 'transparent', border: 'transparent', fg: c.wrong },
  };
  const l = look[kind];
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={[
        styles.btn,
        small && styles.btnSmall,
        wide && styles.wide,
        { backgroundColor: l.bg, borderColor: l.border },
        // The pressed edge sits 3px under the face.
        l.edge ? { marginBottom: 3 } : null,
        kind !== 'primary' && disabled ? { opacity: 0.55 } : null,
        style,
      ]}
    >
      {l.edge ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.edge, { backgroundColor: l.edge }]} /> : null}
      {l.edge ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.face, { backgroundColor: l.bg }]} /> : null}
      {/* Above the edge and face layers, which are positioned and would paint over it. */}
      <View style={styles.btnContent}>
        {icon?.(l.fg)}
        <Text style={[styles.btnText, small && styles.btnTextSmall, { color: l.fg }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Press>
  );
}

/** A square icon button (close, settings). */
export function IconBtn({
  children,
  label,
  onPress,
  style,
}: {
  children: ReactNode;
  label: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[styles.iconBtn, style]} hitSlop={6}>
      {children}
    </Press>
  );
}

/** White paper, where molecules live (it stays white in the dark, like a printed page). */
export function Paper({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  return <View style={[styles.paper, { backgroundColor: c.paper }, paperShadow(c), style]}>{children}</View>;
}

/** A rounded progress bar. */
export function Meter({ value, height = 12, color, style }: { value: number; height?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={[{ height, borderRadius: height, backgroundColor: c.benchDeep, overflow: 'hidden' }, style]}
    >
      <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: height, backgroundColor: color ?? c.magenta }} />
    </View>
  );
}

/** A card on the bench (surface with a rule border). */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.rule }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 48,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'visible',
  },
  btnSmall: { minHeight: 40, paddingHorizontal: 14, paddingVertical: 6 },
  wide: { alignSelf: 'stretch' },
  edge: { borderRadius: 999, top: 3, bottom: -3 },
  face: { borderRadius: 999 },
  btnContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, zIndex: 1, flexShrink: 1 },
  btnText: { fontFamily: FONT.uiBold, fontSize: SIZE.body, flexShrink: 1 },
  btnTextSmall: { fontSize: 15 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  paper: { borderRadius: 6 },
  card: { borderRadius: 14, borderWidth: 2, padding: 14 },
});
