import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
  Easing,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Shadows } from '../../../constants/theme';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'tmlsn_workout_streak_v2';
const TICK_MS = 80;
const COUNTDOWN_TOTAL = 86400;

// TMLSN theme colors
const BG = Colors.primaryDark;
const SURFACE = Colors.primaryDarkLighter;
const SURFACE2 = Colors.primaryLight + '30';
const WHITE = Colors.primaryLight;
const DIM = Colors.primaryLight + '99';
const DIMMER = Colors.primaryLight + '50';

// Bar palette – TMLSN duo-tone with accent accents
const PALETTE = [
  { fill: Colors.primaryLight, glow: Colors.primaryLight + '50' },
  { fill: Colors.primaryLight, glow: Colors.primaryLight + '50' },
  { fill: Colors.primaryLight, glow: Colors.primaryLight + '50' },
  { fill: Colors.primaryLight, glow: Colors.primaryLight + '50' },
  { fill: Colors.primaryLight, glow: Colors.primaryLight + '50' },
  { fill: Colors.primaryLight, glow: Colors.primaryLight + '50' },
];

const BAR_CONFIGS = [
  { key: 'years', label: 'years' },
  { key: 'months', label: 'months' },
  { key: 'days', label: 'days' },
  { key: 'hours', label: 'hours' },
  { key: 'minutes', label: 'minutes' },
  { key: 'seconds', label: 'seconds' },
];

// ─── DATE UTILS ───────────────────────────────────────────────────────────────
function daysInMonth(dt: Date) {
  return new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
}

function getWeekKey(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `${d.getUTCFullYear()}-W${Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)}`;
}

function formatCountdown(secs: number) {
  const h = String(Math.floor(secs / 3600)).padStart(2, '0');
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// ─── CORE BAR CALCULATION ────────────────────────────────────────────────────
function calcBars(startMs: number) {
  const curr = new Date();
  const start = new Date(startMs);
  const dim = daysInMonth(curr);

  let yrs = curr.getFullYear() - start.getFullYear();
  let mos = curr.getMonth() - start.getMonth();
  let dys = curr.getDate() - start.getDate();
  let hrs = curr.getHours() - start.getHours();
  let mins = curr.getMinutes() - start.getMinutes();
  let secs = curr.getSeconds() - start.getSeconds();
  let ms = curr.getMilliseconds() - start.getMilliseconds();

  if (ms < 0) { secs--; ms += 1000; }
  if (secs < 0) { mins--; secs += 60; }
  if (mins < 0) { hrs--; mins += 60; }
  if (hrs < 0) { dys--; hrs += 24; }
  if (dys < 0) {
    mos--;
    dys += new Date(curr.getFullYear(), curr.getMonth(), 0).getDate();
  }
  if (mos < 0) { yrs--; mos += 12; }
  if (yrs < 0) { yrs = mos = dys = hrs = mins = secs = ms = 0; }

  const secFrac = (secs + ms / 1000) / 60;
  const minFrac = (mins + secFrac) / 60;
  const hrFrac = (hrs + minFrac) / 24;
  const dayFrac = (dys + hrFrac) / dim;
  const moFrac = (mos + dayFrac) / 12;
  const yrFrac = Math.min((yrs + moFrac) / 150, 1);

  return {
    display: { years: yrs, months: mos, days: dys, hours: hrs, minutes: mins, seconds: secs },
    frac: { years: yrFrac, months: moFrac, days: dayFrac, hours: hrFrac, minutes: minFrac, seconds: secFrac },
    maxes: { years: 150, months: 12, days: dim, hours: 24, minutes: 60, seconds: 60 },
  };
}

// ─── LIVE BAR ─────────────────────────────────────────────────────────────────
const LiveBar = React.memo(function LiveBar({
  config,
  palette,
  frac,
  display,
  maxVal,
  index,
  dead,
}: {
  config: { key: string; label: string };
  palette: { fill: string; glow: string };
  frac: number;
  display: number;
  maxVal: number | string;
  index: number;
  dead: boolean;
}) {
  const animPct = useRef(new Animated.Value(0)).current;
  const entrance = useRef(new Animated.Value(0)).current;
  const currentAnim = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 480,
      delay: index * 100,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (currentAnim.current) currentAnim.current.stop();
    currentAnim.current = Animated.timing(animPct, {
      toValue: dead ? 0 : frac * 100,
      duration: TICK_MS + 30,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    currentAnim.current.start();
  }, [frac, dead]);

  const widthInterp = animPct.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        styles.barRow,
        {
          opacity: entrance,
          transform: [{
            translateX: entrance.interpolate({
              inputRange: [0, 1],
              outputRange: [-24, 0],
            }),
          }],
        },
      ]}
    >
      <View style={styles.barLabel}>
        <Text style={styles.barNum}>{display}</Text>
        <Text style={styles.barUnit}>{config.label}</Text>
      </View>

      <View style={styles.barTrack}>
        <Animated.View
          style={[styles.barFill, { backgroundColor: palette.fill, width: widthInterp }]}
        />

        <Text style={styles.barMax}>{maxVal}</Text>
      </View>
    </Animated.View>
  );
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
const BAR_H = 42;

export default function StreakScreen() {
  const [streakStart, setStreakStart] = useState<Date | null>(null);
  const [lastWorkout, setLastWorkout] = useState<Date | null>(null);
  const [exemptWeek, setExemptWeek] = useState<string | null>(null);
  const [streakDead, setStreakDead] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_TOTAL);
  const [barData, setBarData] = useState<ReturnType<typeof calcBars> | null>(null);

  const streakRef = useRef<Date | null>(null);
  const deadRef = useRef(false);
  const exemptRef = useRef<string | null>(null);
  const lastWorkRef = useRef<Date | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { streakRef.current = streakStart; }, [streakStart]);
  useEffect(() => { deadRef.current = streakDead; }, [streakDead]);
  useEffect(() => { exemptRef.current = exemptWeek; }, [exemptWeek]);
  useEffect(() => { lastWorkRef.current = lastWorkout; }, [lastWorkout]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const s = JSON.parse(raw);
        const start = s.streakStart ? new Date(s.streakStart) : null;
        const last = s.lastWorkout ? new Date(s.lastWorkout) : null;
        if (start) setStreakStart(start);
        if (last) setLastWorkout(last);
        if (s.exemptWeek) setExemptWeek(s.exemptWeek);

        if (last) {
          const elapsed = Math.floor((Date.now() - last.getTime()) / 1000);
          const rem = COUNTDOWN_TOTAL - elapsed;
          if (rem <= 0 && s.exemptWeek !== getWeekKey(new Date())) {
            setStreakDead(true);
          } else {
            setCountdown(Math.max(0, rem));
          }
        }
      } catch (e) { console.warn('streak load error', e); }
    })();
  }, []);

  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (!streakStart || streakDead) return;
    const tick = () => setBarData(calcBars(streakStart.getTime()));
    tick();
    tickRef.current = setInterval(tick, TICK_MS);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [streakStart, streakDead]);

  useEffect(() => {
    if (cdRef.current) clearInterval(cdRef.current);
    if (!lastWorkout || streakDead) return;
    cdRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (cdRef.current) clearInterval(cdRef.current);
          if (exemptRef.current === getWeekKey(new Date())) {
            return COUNTDOWN_TOTAL;
          }
          setStreakDead(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (cdRef.current) clearInterval(cdRef.current); };
  }, [lastWorkout, streakDead]);

  const persist = useCallback(async (patch: Record<string, unknown> = {}) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        streakStart: streakRef.current?.toISOString() ?? null,
        lastWorkout: lastWorkRef.current?.toISOString() ?? null,
        exemptWeek: exemptRef.current ?? null,
        ...patch,
      }));
    } catch (e) { console.warn('streak save error', e); }
  }, []);

  const useRestDay = useCallback(async () => {
    const wk = getWeekKey(new Date());
    setExemptWeek(wk);
    await persist({ exemptWeek: wk });
  }, [persist]);

  const resetStreak = useCallback(async () => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (cdRef.current) clearInterval(cdRef.current);
    setStreakStart(null);
    setLastWorkout(null);
    setStreakDead(false);
    setExemptWeek(null);
    setCountdown(COUNTDOWN_TOTAL);
    setBarData(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const exemptThisWeek = exemptWeek === getWeekKey(new Date());
  const cdUrgent = countdown < 3600;
  const cdWarning = !cdUrgent && countdown < 10800;
  const cdColor = cdUrgent ? Colors.accentRed : cdWarning ? Colors.primaryLight : Colors.primaryLight;
  const cdPct = (countdown / COUNTDOWN_TOTAL) * 100;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.widget}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>tmlsn · workout streak</Text>
          <Text style={styles.title}>
            {streakDead
              ? "your streak ended"
              : !streakStart
                ? "start your streak"
                : "i've been consistent for"}
          </Text>
        </View>

        {/* Streak bars */}
        <View style={styles.barsCol}>
          {BAR_CONFIGS.map((cfg, i) => (
            <LiveBar
              key={cfg.key}
              config={cfg}
              palette={PALETTE[i]}
              frac={barData ? barData.frac[cfg.key as keyof typeof barData.frac] : 0}
              display={barData ? barData.display[cfg.key as keyof typeof barData.display] : 0}
              maxVal={barData ? barData.maxes[cfg.key as keyof typeof barData.maxes] : '—'}
              index={i}
              dead={streakDead}
            />
          ))}
        </View>

        {/* Next reset and rest day – below bars */}
        <View style={styles.widgetsRow}>
            <View style={styles.card}>
              <Text style={styles.cardEyebrow}>next{'\n'}reset</Text>
              <Text style={[styles.cdValue, { color: cdColor }]}>
                {formatCountdown(countdown)}
              </Text>
              <View style={styles.cdTrack}>
                <View
                  style={[styles.cdFill, { width: `${cdPct}%`, backgroundColor: cdColor }]}
                />
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardEyebrow}>rest{'\n'}day</Text>
              {!exemptThisWeek ? (
                <TouchableOpacity
                  style={styles.rdBtn}
                  onPress={useRestDay}
                  activeOpacity={0.7}
                >
                  <Text style={styles.rdBtnText}>use</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.rdDone}>
                  <Text style={styles.rdDoneText}>✓</Text>
                </View>
              )}
              <Text style={styles.cardNote}>1× week</Text>
            </View>
        </View>

        <TouchableOpacity style={styles.resetTouchable} onPress={resetStreak}>
          <Text style={styles.resetLabel}>reset streak</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.primaryDark },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl * 2 },

  widget: {
    backgroundColor: SURFACE,
    borderRadius: 38,
    padding: Spacing.lg,
    ...Shadows.card,
  },

  header: { marginBottom: Spacing.lg },
  eyebrow: { color: DIM, fontSize: 10, fontWeight: '700' as const, letterSpacing: 3, marginBottom: 6 },
  title: { color: WHITE, fontSize: 21, fontWeight: '300' as const, letterSpacing: 0.2 },

  barsCol: { gap: 9, marginBottom: Spacing.lg },
  barRow: { flexDirection: 'row' as const, alignItems: 'center', gap: 10 },
  barLabel: { width: 54, alignItems: 'flex-end' },
  barNum: {
    color: WHITE, fontSize: 18, fontWeight: '800' as const,
    fontStyle: 'italic', lineHeight: 21,
  },
  barUnit: {
    color: DIM, fontSize: 8, fontWeight: '700' as const,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  barTrack: {
    flex: 1, height: BAR_H,
    backgroundColor: BG,
    borderRadius: 38,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  barFill: {
    position: 'absolute', height: BAR_H, left: 0,
    borderRadius: 38,
  },
  barMax: {
    position: 'absolute', right: 10,
    color: DIMMER, fontSize: 9, fontWeight: '600' as const,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },

  widgetsRow: { flexDirection: 'row' as const, gap: 12, marginBottom: Spacing.lg },
  card: {
    flex: 1,
    backgroundColor: BG,
    borderRadius: 38, padding: 12,
    alignItems: 'center', gap: 7,
  },
  cardEyebrow: {
    color: DIM, fontSize: 8, fontWeight: '700' as const,
    letterSpacing: 1.8, textTransform: 'uppercase',
    textAlign: 'center',
  },
  cardNote: { color: DIMMER, fontSize: 8, letterSpacing: 0.5, textAlign: 'center' },

  cdValue: {
    fontSize: 14, fontWeight: '800' as const, textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  cdTrack: {
    width: '100%', height: 3,
    backgroundColor: SURFACE2, borderRadius: 38, overflow: 'hidden',
  },
  cdFill: { height: 3, borderRadius: 38 },

  rdBtn: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 38, paddingHorizontal: 13, paddingVertical: 7,
  },
  rdBtnText: { color: Colors.primaryDark, fontSize: 11, fontWeight: '800' as const, letterSpacing: 1.5 },
  rdDone: {
    width: 36, height: 36, borderRadius: 38,
    borderWidth: 2, borderColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  rdDoneText: { color: Colors.primaryLight, fontSize: 16, fontWeight: '800' as const },

  resetTouchable: { marginTop: Spacing.lg, alignItems: 'center', paddingVertical: 8 },
  resetLabel: { color: DIMMER, fontSize: 11, textDecorationLine: 'underline' as const },
});
