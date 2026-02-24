import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg, {
  Path,
  Defs,
  G,
  LinearGradient as SvgGradient,
  Stop,
} from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface MacroData { current: number; goal: number; }
interface NutritionData {
  calories: MacroData;
  protein: MacroData;
  carbs: MacroData;
  fat: MacroData;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SVG_WIDTH = SCREEN_WIDTH - 48;
const SVG_HEIGHT = 210;
const RADIUS = SVG_WIDTH * 0.448;
const CX = SVG_WIDTH / 2;
const CY = SVG_HEIGHT - 10;
const ARC_LENGTH = Math.PI * RADIUS;
const ARC_PATH = `M ${CX - RADIUS} ${CY} A ${RADIUS} ${RADIUS} 0 0 1 ${CX + RADIUS} ${CY}`;

const FLAT = '#c6c6c6';

const BRONZE = {
  dark: '#7a6145',
  mid: '#aa8f6a',
  light: '#d4b48a',
  glow: 'rgba(170, 143, 106, 0.45)',
};

const SILVER = {
  dark: '#6b7078',
  mid: '#9ca5ae',
  light: '#dde2e6',
  glow: 'rgba(194, 200, 206, 0.4)',
};

const GOLD = {
  dark: '#A8895E',
  mid: '#c4a070',
  light: '#D4B896',
  glow: 'rgba(212, 184, 150, 0.5)',
};

type State = 'flat' | 'bronze' | 'silver' | 'gold';

function getState(data: NutritionData): State {
  const { calories, protein, carbs, fat } = data;
  const anyProgress = calories.current > 0 || protein.current > 0 || carbs.current > 0 || fat.current > 0;
  const eitherHit = calories.current >= calories.goal || protein.current >= protein.goal;
  const bothHit = calories.current >= calories.goal && protein.current >= protein.goal;
  return bothHit ? 'gold' : eitherHit ? 'silver' : anyProgress ? 'bronze' : 'flat';
}

function getPalette(state: State) {
  if (state === 'flat') {
    return { stroke: FLAT, gradient: [FLAT, FLAT, FLAT, FLAT, FLAT] as const, glow: null as string | null, mid: FLAT, light: FLAT };
  }
  const p = state === 'bronze' ? BRONZE : state === 'silver' ? SILVER : GOLD;
  return {
    stroke: p.mid,
    gradient: [p.dark, p.mid, p.light, p.mid, p.dark] as const,
    glow: p.glow,
    mid: p.mid,
    light: p.light,
  };
}

function useAnimatedNumber(target: number, duration = 600): number {
  const [display, setDisplay] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    const from = current.current;
    const start = Date.now();
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const val = Math.round(from + (target - from) * ease);
      if (val !== current.current) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setDisplay(val);
      current.current = val;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target]);
  return display;
}

function MacroBar({
  label,
  current,
  goal,
  state,
  prevState,
  shimmerAnim,
  transitionAnim,
}: {
  label: string;
  current: number;
  goal: number;
  state: State;
  prevState: State;
  shimmerAnim?: Animated.Value;
  transitionAnim?: Animated.Value;
}) {
  const pct = goal > 0 ? Math.min(current / goal, 1) : 0;
  const widthAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(widthAnim, { toValue: pct, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct]);
  const overlayWidth = widthAnim.interpolate({ inputRange: [0, 1], outputRange: ['100%', '0%'] });
  const shimmerOpacity = shimmerAnim && state !== 'flat'
    ? shimmerAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.08, 0] })
    : 0;
  const prevOpacity = transitionAnim?.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) ?? 1;
  const currOpacity = transitionAnim?.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) ?? 1;
  const palettePrev = getPalette(prevState);
  const paletteCurr = getPalette(state);
  const labelColor = prevState !== state && transitionAnim
    ? transitionAnim.interpolate({ inputRange: [0, 1], outputRange: [palettePrev.mid, paletteCurr.mid] })
    : paletteCurr.mid;
  const LabelWrapper = state === 'gold'
    ? ({ children }: { children: React.ReactNode }) => (
        <MaskedView style={styles.macroLabelMaskWrap} maskElement={<Text style={[styles.macroLabel, styles.labelMaskText]}>{children}</Text>}>
          <LinearGradient colors={[GOLD.dark, GOLD.mid, GOLD.light, GOLD.mid, GOLD.dark]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </MaskedView>
      )
    : ({ children }: { children: React.ReactNode }) => <Animated.Text style={[styles.macroLabel, { color: labelColor }]}>{children}</Animated.Text>;

  return (
    <View style={styles.macroRow}>
      <LabelWrapper>{label}</LabelWrapper>
      <View style={styles.macroTrack}>
        {prevState !== state ? (
          <>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: prevOpacity }]} pointerEvents="none">
              <LinearGradient
                colors={[...palettePrev.gradient]}
                start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                style={[StyleSheet.absoluteFill, styles.macroGradientFull]}
              />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: currOpacity }]} pointerEvents="none">
              <LinearGradient
                colors={[...paletteCurr.gradient]}
                start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                style={[StyleSheet.absoluteFill, styles.macroGradientFull]}
              />
            </Animated.View>
          </>
        ) : (
          <LinearGradient
            colors={[...paletteCurr.gradient]}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={[StyleSheet.absoluteFill, styles.macroGradientFull]}
          />
        )}
        {state !== 'flat' && shimmerAnim && (
          <Animated.View
            style={[
              styles.macroShimmerHighlight,
              { opacity: shimmerOpacity, backgroundColor: paletteCurr.light },
            ]}
          />
        )}
        <Animated.View
          style={[
            styles.macroOverlay,
            { width: overlayWidth },
          ]}
        />
      </View>
      {state === 'gold' ? (
        <MaskedView
          style={styles.macroValueMaskWrap}
          maskElement={
            <Text style={[styles.macroValue, styles.macroGoal, styles.labelMaskText]} numberOfLines={1}>
              {current} / {goal} g
            </Text>
          }
        >
          <LinearGradient colors={[GOLD.dark, GOLD.mid, GOLD.light, GOLD.mid, GOLD.dark]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </MaskedView>
      ) : (
        <Animated.Text
          style={[styles.macroValue, { color: labelColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {current}<Animated.Text style={[styles.macroGoal, { color: labelColor }]}> / {goal} g</Animated.Text>
        </Animated.Text>
      )}
    </View>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

function ArcGroup({
  state,
  strokeDashoffset,
  shimmerOpacity,
}: {
  state: State;
  strokeDashoffset: Animated.AnimatedInterpolation<number>;
  shimmerOpacity: Animated.AnimatedInterpolation<number>;
}) {
  const palette = getPalette(state);
  if (state === 'flat') {
    return (
      <AnimatedPath
        d={ARC_PATH}
        fill="none"
        stroke={FLAT}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={ARC_LENGTH}
        strokeDashoffset={strokeDashoffset}
      />
    );
  }
  return (
    <>
      <AnimatedPath
        d={ARC_PATH}
        fill="none"
        stroke={`url(#${state}Arc)`}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={ARC_LENGTH}
        strokeDashoffset={strokeDashoffset}
      />
      <AnimatedPath
        d={ARC_PATH}
        fill="none"
        stroke={state === 'silver' ? SILVER.light : state === 'bronze' ? BRONZE.light : GOLD.light}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={ARC_LENGTH}
        strokeDashoffset={strokeDashoffset}
        opacity={shimmerOpacity}
      />
    </>
  );
}

export default function NutritionHero({ data }: { data: NutritionData }) {
  const { calories, protein, carbs, fat } = data;
  const calPct = calories.goal > 0 ? Math.min(calories.current / calories.goal, 1) : 0;
  const state = getState(data);
  const [prevState, setPrevState] = useState<State>(state);
  const arcAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const transitionAnim = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);
  const displayCal = useAnimatedNumber(calories.current);

  useEffect(() => {
    Animated.timing(arcAnim, { toValue: calPct, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [calPct]);

  useEffect(() => {
    if (state !== prevState) {
      transitionAnim.setValue(0);
      Animated.timing(transitionAnim, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: false }).start(() => {
        setPrevState(state);
        transitionAnim.setValue(0);
      });
    }
  }, [state, prevState]);

  useEffect(() => {
    if (state !== 'flat') {
      shimmerAnim.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 4000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
          Animated.timing(shimmerAnim, { toValue: 0, duration: 1, useNativeDriver: false }),
        ])
      );
      loopRef.current = loop;
      loop.start();
    } else {
      loopRef.current?.stop();
      loopRef.current = null;
      shimmerAnim.setValue(0);
    }
  }, [state]);

  const strokeDashoffset = arcAnim.interpolate({ inputRange: [0, 1], outputRange: [ARC_LENGTH, 0] });
  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, state === 'silver' ? 0.04 : 0.08, 0],
  });
  const currPalette = getPalette(state);
  const arcPrevOpacity = transitionAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const arcCurrOpacity = transitionAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <View style={styles.container}>
      <View style={styles.gaugeWrap}>
        <View
          style={{
            shadowColor: currPalette.glow ?? '#c6c6c6',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: currPalette.glow ? (state === 'silver' ? 0.35 : state === 'bronze' ? 0.5 : 0.9) : 0,
            shadowRadius: state === 'silver' ? 8 : 12,
            elevation: 20,
          }}
        >
          <Svg width={SVG_WIDTH} height={SVG_HEIGHT}>
            <Defs>
              <SvgGradient id="trackGrad" x1="0" y1="0.5" x2="1" y2="0.5">
                <Stop offset="0" stopColor="#1e2022" /><Stop offset="0.5" stopColor="#252829" /><Stop offset="1" stopColor="#1e2022" />
              </SvgGradient>
              <SvgGradient id="bronzeArc" x1="0" y1="0.5" x2="1" y2="0.5">
                <Stop offset="0" stopColor={BRONZE.dark} /><Stop offset="0.25" stopColor={BRONZE.mid} /><Stop offset="0.5" stopColor={BRONZE.light} /><Stop offset="0.75" stopColor={BRONZE.mid} /><Stop offset="1" stopColor={BRONZE.dark} />
              </SvgGradient>
              <SvgGradient id="silverArc" x1="0" y1="0.5" x2="1" y2="0.5">
                <Stop offset="0" stopColor={SILVER.dark} /><Stop offset="0.25" stopColor={SILVER.mid} /><Stop offset="0.5" stopColor={SILVER.light} /><Stop offset="0.75" stopColor={SILVER.mid} /><Stop offset="1" stopColor={SILVER.dark} />
              </SvgGradient>
              <SvgGradient id="goldArc" x1="0" y1="0.5" x2="1" y2="0.5">
                <Stop offset="0" stopColor={GOLD.dark} /><Stop offset="0.35" stopColor={GOLD.mid} /><Stop offset="0.55" stopColor={GOLD.light} /><Stop offset="0.75" stopColor={GOLD.mid} /><Stop offset="1" stopColor={GOLD.dark} />
              </SvgGradient>
            </Defs>
            <Path d={ARC_PATH} fill="none" stroke="url(#trackGrad)" strokeWidth={3} strokeLinecap="round" />
            {prevState !== state ? (
              <>
                <AnimatedG opacity={arcPrevOpacity}>
                  <ArcGroup state={prevState} strokeDashoffset={strokeDashoffset} shimmerOpacity={shimmerOpacity} />
                </AnimatedG>
                <AnimatedG opacity={arcCurrOpacity}>
                  <ArcGroup state={state} strokeDashoffset={strokeDashoffset} shimmerOpacity={shimmerOpacity} />
                </AnimatedG>
              </>
            ) : (
              <ArcGroup state={state} strokeDashoffset={strokeDashoffset} shimmerOpacity={shimmerOpacity} />
            )}
          </Svg>
        </View>
        <View style={styles.gaugeCenter} pointerEvents="none">
          <View style={styles.calNumberWrap}>
            <MaskedView
              style={styles.calNumberMask}
              maskElement={
                <View style={styles.calNumberMaskInner}>
                  <Text style={[styles.calNumber, styles.calNumberMaskText]}>{displayCal}</Text>
                </View>
              }
            >
              <View style={styles.calNumberMaskContent}>
                {prevState !== state ? (
                  <>
                    <Animated.View style={[StyleSheet.absoluteFill, { opacity: arcPrevOpacity }]}>
                      <LinearGradient
                        colors={[getPalette(prevState).light, getPalette(prevState).light, getPalette(prevState).light]}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                      />
                    </Animated.View>
                    <Animated.View style={[StyleSheet.absoluteFill, { opacity: arcCurrOpacity }]}>
                      <LinearGradient
                        colors={[currPalette.light, currPalette.light, currPalette.light]}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                      />
                    </Animated.View>
                  </>
                ) : (
                  <LinearGradient
                    colors={[currPalette.light, currPalette.light, currPalette.light]}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                  />
                )}
                {state !== 'flat' && (
                  <Animated.View
                    style={[
                      styles.calShimmerHighlight,
                      { opacity: shimmerOpacity, backgroundColor: currPalette.light },
                    ]}
                  />
                )}
              </View>
            </MaskedView>
          </View>
          {state === 'gold' ? (
            <>
              <MaskedView
                style={styles.labelMaskWrap}
                maskElement={<Text style={[styles.kcalLabel, styles.labelMaskText]}>calories</Text>}
              >
                <LinearGradient colors={[GOLD.dark, GOLD.mid, GOLD.light, GOLD.mid, GOLD.dark]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
              </MaskedView>
              <MaskedView
                style={styles.labelMaskWrap}
                maskElement={<Text style={[styles.calGoal, styles.labelMaskText]}>{calories.current} / {calories.goal}</Text>}
              >
                <LinearGradient colors={[GOLD.dark, GOLD.mid, GOLD.light, GOLD.mid, GOLD.dark]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
              </MaskedView>
            </>
          ) : (
            <>
              <Animated.Text style={[styles.kcalLabel, { color: prevState !== state ? transitionAnim.interpolate({ inputRange: [0, 1], outputRange: [getPalette(prevState).mid, currPalette.mid] }) : currPalette.mid }]}>calories</Animated.Text>
              <Animated.Text style={[styles.calGoal, { color: prevState !== state ? transitionAnim.interpolate({ inputRange: [0, 1], outputRange: [getPalette(prevState).mid, currPalette.mid] }) : currPalette.mid }]}>{calories.current} / {calories.goal}</Animated.Text>
            </>
          )}
        </View>
      </View>
      <View style={styles.macros}>
        <MacroBar label="protein" current={protein.current} goal={protein.goal} state={state} prevState={prevState} shimmerAnim={shimmerAnim} transitionAnim={transitionAnim} />
        <MacroBar label="carbs" current={carbs.current} goal={carbs.goal} state={state} prevState={prevState} shimmerAnim={shimmerAnim} transitionAnim={transitionAnim} />
        <MacroBar label="fat" current={fat.current} goal={fat.goal} state={state} prevState={prevState} shimmerAnim={shimmerAnim} transitionAnim={transitionAnim} />
      </View>
    </View>
  );
}

const CardFontLetterSpacing = -0.1;
const LabelLetterSpacing = -0.11;

const styles = StyleSheet.create({
  container: { width: '100%', paddingHorizontal: 24 },
  gaugeWrap: { width: '100%', height: SVG_HEIGHT, alignItems: 'center', justifyContent: 'flex-end', position: 'relative' },
  gaugeCenter: { position: 'absolute', bottom: 20, alignItems: 'center' },
  calNumberWrap: { height: 72, minWidth: 220, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  calNumberMask: { flex: 1, alignSelf: 'stretch' },
  calNumberMaskContent: { flex: 1, position: 'relative' },
  calShimmerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f0f2f3',
  },
  calNumberMaskInner: { flex: 1, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  calNumber: {
    fontSize: 54,
    fontWeight: '500',
    letterSpacing: 54 * -0.03,
    color: '#FFFFFF',
  },
  calNumberMaskText: { color: 'white' },
  labelMaskWrap: { alignSelf: 'center', overflow: 'hidden' },
  labelMaskText: { color: 'white', backgroundColor: 'transparent' },
  kcalLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: LabelLetterSpacing,
    color: '#FFFFFF',
    marginTop: 4,
  },
  calGoal: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: LabelLetterSpacing,
    color: '#FFFFFF',
    marginTop: 6,
  },
  macros: { marginTop: 8, gap: 14 },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  macroLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 10 * -0.03,
    color: '#FFFFFF',
    width: 48,
  },
  macroLabelMaskWrap: { width: 48 },
  macroValueMaskWrap: { width: 58, alignItems: 'flex-end' },
  macroTrack: { flex: 1, height: 3, backgroundColor: '#252729', borderRadius: 2, overflow: 'hidden', position: 'relative' },
  macroGradientFull: { borderRadius: 2 },
  macroShimmerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f0f2f3',
  },
  macroOverlay: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#252729',
    borderRadius: 2,
  },
  macroValue: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: CardFontLetterSpacing,
    color: '#FFFFFF',
    width: 58,
    textAlign: 'right',
  },
  macroGoal: {
    fontSize: 9,
    fontWeight: '300',
    letterSpacing: LabelLetterSpacing,
    color: '#FFFFFF',
  },
});
