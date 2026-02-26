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
import Svg, { Path, G, Defs, LinearGradient as SvgLinearGradient, Stop, Rect, ClipPath } from 'react-native-svg';
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
const ARC_STROKE_HALF = 1.5;
const ARC_CLIP_PATH = `M ${CX - (RADIUS + ARC_STROKE_HALF)} ${CY} A ${RADIUS + ARC_STROKE_HALF} ${RADIUS + ARC_STROKE_HALF} 0 0 1 ${CX + (RADIUS + ARC_STROKE_HALF)} ${CY} L ${CX + (RADIUS - ARC_STROKE_HALF)} ${CY} A ${RADIUS - ARC_STROKE_HALF} ${RADIUS - ARC_STROKE_HALF} 0 0 0 ${CX - (RADIUS - ARC_STROKE_HALF)} ${CY} Z`;

const FLAT = '#c6c6c6';

const BRONZE = {
  dark: '#7a6145',
  mid: '#aa8f6a',
  light: '#d4b48a',
  sweepHighlight: '#dfc4a0',
  glow: 'rgba(170, 143, 106, 0.45)',
};

const SILVER = {
  dark: '#6b7078',
  mid: '#9ca5ae',
  light: '#dde2e6',
  sweepHighlight: '#dee1e4',
  glow: 'rgba(194, 200, 206, 0.4)',
};

const GOLD = {
  dark: '#A8895E',
  mid: '#c4a070',
  light: '#D4B896',
  sweepHighlight: '#dcc8a8',
  glow: 'rgba(212, 184, 150, 0.5)',
};

type State = 'flat' | 'bronze' | 'silver' | 'gold';

function getState(data: NutritionData): State {
  const { calories, protein, carbs, fat } = data;
  const caloriesHit = calories.goal > 0 && calories.current >= calories.goal;
  const proteinHit = protein.goal > 0 && protein.current >= protein.goal;
  const carbsHit = carbs.goal > 0 && carbs.current >= carbs.goal;
  const fatHit = fat.goal > 0 && fat.current >= fat.goal;
  if (caloriesHit && proteinHit) return 'gold';
  if (caloriesHit || proteinHit) return 'silver';
  if (carbsHit || fatHit) return 'bronze';
  return 'flat';
}

function getPalette(state: State) {
  if (state === 'flat') {
    return { stroke: FLAT, gradient: [FLAT, FLAT, FLAT, FLAT, FLAT] as const, glow: null as string | null, mid: FLAT, light: FLAT, sweepLight: FLAT };
  }
  const p = state === 'bronze' ? BRONZE : state === 'silver' ? SILVER : GOLD;
  return {
    stroke: p.mid,
    gradient: [p.dark, p.mid, p.light, p.mid, p.dark] as const,
    glow: p.glow,
    mid: p.mid,
    light: p.light,
    sweepLight: p.sweepHighlight,
  };
}

// Arc metallic gradient: more stops + non-even offsets = smooth (no banding)
function getArcPalette(state: State): typeof BRONZE | null {
  if (state === 'flat') return null;
  return state === 'bronze' ? BRONZE : state === 'silver' ? SILVER : GOLD;
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

const GRADIENT_SWEEP_PERIOD = 900; // one cycle; strip holds 2 cycles so reset is seamless (what leaves = what enters)
const GRADIENT_SWEEP_WIDTH = 2 * GRADIENT_SWEEP_PERIOD;
const GRADIENT_SWEEP_TRAVEL = GRADIENT_SWEEP_PERIOD;
const GRADIENT_SWEEP_DURATION_MS = 5100;
const ARC_GLIMMER_PERIOD = SVG_WIDTH;
const ARC_GLIMMER_RECT_WIDTH = 2 * SVG_WIDTH;
const ARC_GLIMMER_DURATION_MS = 5100;

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
  const [trackWidth, setTrackWidth] = useState(0);
  const widthAnim = useRef(new Animated.Value(0)).current;
  const gradientSlideAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(widthAnim, { toValue: pct, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct]);
  useEffect(() => {
    if (state === 'flat') {
      gradientSlideAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(gradientSlideAnim, {
          toValue: GRADIENT_SWEEP_TRAVEL,
          duration: GRADIENT_SWEEP_DURATION_MS,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(gradientSlideAnim, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [state]);
  const overlayWidth = widthAnim.interpolate({ inputRange: [0, 1], outputRange: ['100%', '0%'] });
  const fillWidthPx = widthAnim.interpolate({ inputRange: [0, 1], outputRange: [0, trackWidth] });
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
  const gradientColors = paletteCurr.gradient as [string, string, string, string, string];
  // During transition, use solid interpolated color so MaskedView is never under animated opacity
  // (MaskedView can show only gradient block when parent opacity < 1 - e.g. silver state transition)
  const LabelWrapper = state !== 'flat'
    ? ({ children }: { children: React.ReactNode }) =>
        prevState !== state ? (
          <Animated.Text style={[styles.macroLabel, { color: labelColor }]}>{children}</Animated.Text>
        ) : (
          <MaskedView style={styles.macroLabelMaskWrap} maskElement={<Text style={[styles.macroLabel, styles.labelMaskText]}>{children}</Text>}>
            <LinearGradient colors={gradientColors} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
          </MaskedView>
        )
    : ({ children }: { children: React.ReactNode }) => <Animated.Text style={[styles.macroLabel, { color: labelColor }]}>{children}</Animated.Text>;

  return (
    <View style={styles.macroRow}>
      <LabelWrapper>{label}</LabelWrapper>
      <View style={styles.macroTrack} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
        {prevState !== state ? (
          <>
            <Animated.View style={[styles.macroFillWrap, { width: fillWidthPx, opacity: prevOpacity }]} pointerEvents="none">
              {prevState !== 'flat' ? (
                <>
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: palettePrev.gradient[0] }]} />
                  <View style={styles.gradientSweepWrap} pointerEvents="none">
                    <Animated.View style={[styles.gradientSweepStrip, { transform: [{ translateX: gradientSlideAnim }] }]}>
                      <LinearGradient
                        colors={[palettePrev.gradient[0], palettePrev.mid, palettePrev.sweepLight, palettePrev.sweepLight, palettePrev.mid, palettePrev.gradient[4]]}
                        locations={[0, 0.3, 0.44, 0.56, 0.7, 1]}
                        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                        style={[styles.gradientSweepGradient, styles.macroGradientFull]}
                      />
                    </Animated.View>
                  </View>
                </>
              ) : (
                <LinearGradient colors={[...palettePrev.gradient]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[StyleSheet.absoluteFill, styles.macroGradientFull]} />
              )}
            </Animated.View>
            <Animated.View style={[styles.macroFillWrap, { width: fillWidthPx, opacity: currOpacity }]} pointerEvents="none">
              {state !== 'flat' ? (
                <>
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: paletteCurr.gradient[0] }]} />
                  <View style={styles.gradientSweepWrap} pointerEvents="none">
                    <Animated.View style={[styles.gradientSweepStrip, { transform: [{ translateX: gradientSlideAnim }] }]}>
                      <LinearGradient
                        colors={[paletteCurr.gradient[0], paletteCurr.mid, paletteCurr.sweepLight, paletteCurr.sweepLight, paletteCurr.mid, paletteCurr.gradient[4]]}
                        locations={[0, 0.3, 0.44, 0.56, 0.7, 1]}
                        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                        style={[styles.gradientSweepGradient, styles.macroGradientFull]}
                      />
                    </Animated.View>
                  </View>
                </>
              ) : (
                <LinearGradient colors={[...paletteCurr.gradient]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[StyleSheet.absoluteFill, styles.macroGradientFull]} />
              )}
            </Animated.View>
          </>
        ) : (
          <Animated.View style={[styles.macroFillWrap, { width: fillWidthPx }]}>
            {state !== 'flat' ? (
              <>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: paletteCurr.gradient[0] }]} />
                <View style={styles.gradientSweepWrap} pointerEvents="none">
                  <Animated.View style={[styles.gradientSweepStrip, { transform: [{ translateX: gradientSlideAnim }] }]}>
                    <LinearGradient
                      colors={[paletteCurr.gradient[0], paletteCurr.mid, paletteCurr.sweepLight, paletteCurr.sweepLight, paletteCurr.mid, paletteCurr.gradient[4], paletteCurr.mid, paletteCurr.sweepLight, paletteCurr.sweepLight, paletteCurr.mid, paletteCurr.gradient[4]]}
                      locations={[0, 0.15, 0.22, 0.28, 0.33, 0.5, 0.65, 0.72, 0.78, 0.83, 1]}
                      start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                      style={[styles.gradientSweepGradient, styles.macroGradientFull]}
                    />
                  </Animated.View>
                </View>
              </>
            ) : (
              <LinearGradient colors={[...paletteCurr.gradient]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[StyleSheet.absoluteFill, styles.macroGradientFull]} />
            )}
          </Animated.View>
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
      {state !== 'flat' ? (
        prevState !== state ? (
          <Animated.Text
            style={[styles.macroValue, styles.macroGoal, { color: labelColor }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {current} / {goal} g
          </Animated.Text>
        ) : (
          <MaskedView
            style={styles.macroValueMaskWrap}
            maskElement={
              <Text style={[styles.macroValue, styles.macroGoal, styles.labelMaskText]} numberOfLines={1}>
                {current} / {goal} g
              </Text>
            }
          >
            <LinearGradient colors={gradientColors} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
          </MaskedView>
        )
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
const AnimatedRect = Animated.createAnimatedComponent(Rect);

function ArcGroup({
  state,
  strokeDashoffset,
}: {
  state: State;
  strokeDashoffset: Animated.AnimatedInterpolation<number>;
}) {
  const palette = state === 'flat' ? null : getArcPalette(state);
  return (
    <AnimatedPath
      d={ARC_PATH}
      fill="none"
      stroke={state === 'flat' ? FLAT : palette!.dark}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={ARC_LENGTH}
      strokeDashoffset={strokeDashoffset}
    />
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
  const arcGlimmerAnim = useRef(new Animated.Value(-ARC_GLIMMER_PERIOD)).current;
  const arcGlimmerLoopRef = useRef<Animated.CompositeAnimation | null>(null);
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

  useEffect(() => {
    if (state === 'flat') {
      arcGlimmerAnim.setValue(-ARC_GLIMMER_PERIOD);
      arcGlimmerLoopRef.current?.stop();
      arcGlimmerLoopRef.current = null;
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(arcGlimmerAnim, {
          toValue: 0,
          duration: ARC_GLIMMER_DURATION_MS,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(arcGlimmerAnim, {
          toValue: -ARC_GLIMMER_PERIOD,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    );
    arcGlimmerLoopRef.current = loop;
    loop.start();
    return () => {
      loop.stop();
      arcGlimmerLoopRef.current = null;
    };
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
          style={[
            styles.arcGlowWrap,
            styles.arcWrap,
            state !== 'flat' &&
              currPalette && {
                shadowColor: currPalette.light,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.9,
                shadowRadius: 12,
                elevation: 20,
              },
            styles.arcWrapRaster,
          ]}
        >
          <Svg width={SVG_WIDTH} height={SVG_HEIGHT}>
            <Defs>
              <ClipPath id="arcClip">
                <Path d={ARC_CLIP_PATH} />
              </ClipPath>
              {state !== 'flat' && (() => {
                const p = getArcPalette(state)!;
                const sweep = p.sweepHighlight;
                return (
                  <SvgLinearGradient id={`macroArcGlimmer-${state}`} x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
                    <Stop offset={0} stopColor={p.dark} />
                    <Stop offset={0.12} stopColor={p.mid} />
                    <Stop offset={0.24} stopColor={sweep} />
                    <Stop offset={0.32} stopColor={sweep} />
                    <Stop offset={0.5} stopColor={p.dark} />
                    <Stop offset={0.68} stopColor={sweep} />
                    <Stop offset={0.76} stopColor={sweep} />
                    <Stop offset={0.88} stopColor={p.mid} />
                    <Stop offset={1} stopColor={p.dark} />
                  </SvgLinearGradient>
                );
              })()}
            </Defs>
            <Path d={ARC_PATH} fill="none" stroke="#252829" strokeWidth={3} strokeLinecap="round" />
            {prevState !== state ? (
              <>
                <AnimatedG opacity={arcPrevOpacity}>
                  <ArcGroup state={prevState} strokeDashoffset={strokeDashoffset} />
                </AnimatedG>
                <AnimatedG opacity={arcCurrOpacity}>
                  <ArcGroup state={state} strokeDashoffset={strokeDashoffset} />
                </AnimatedG>
              </>
            ) : (
              <ArcGroup state={state} strokeDashoffset={strokeDashoffset} />
            )}
            {state !== 'flat' && (
              <G clipPath="url(#arcClip)">
                <AnimatedRect
                  x={arcGlimmerAnim}
                  y={0}
                  width={ARC_GLIMMER_RECT_WIDTH}
                  height={SVG_HEIGHT}
                  fill={`url(#macroArcGlimmer-${state})`}
                />
              </G>
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
          {state !== 'flat' ? (
            <Animated.View
              style={[
                styles.goldLabelsWrap,
                prevState !== state && { opacity: arcCurrOpacity },
              ]}
              pointerEvents="none"
            >
              <MaskedView style={styles.kcalLabelMaskWrap} maskElement={<Text style={[styles.kcalLabel, styles.labelMaskText]}>calories</Text>}>
                <LinearGradient colors={[...currPalette.gradient]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
              </MaskedView>
              <MaskedView style={styles.calGoalMaskWrap} maskElement={<Text style={[styles.calGoal, styles.labelMaskText]}>{calories.current} / {calories.goal}</Text>}>
                <LinearGradient colors={[...currPalette.gradient]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
              </MaskedView>
            </Animated.View>
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
  container: { width: '100%', paddingHorizontal: 24, overflow: 'visible' },
  arcGlowWrap: { overflow: 'visible' },
  arcWrap: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  arcWrapRaster: { shouldRasterizeIOS: true },
  gaugeWrap: { width: '100%', height: SVG_HEIGHT, alignItems: 'center', justifyContent: 'flex-end', position: 'relative', overflow: 'visible' },
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
  goldLabelsWrap: { alignItems: 'center', minHeight: 44, overflow: 'visible' },
  kcalLabelMaskWrap: { alignSelf: 'center', minHeight: 14, minWidth: 56, marginTop: 4, overflow: 'visible' },
  calGoalMaskWrap: { alignSelf: 'center', minHeight: 22, minWidth: 80, marginTop: 6, overflow: 'visible' },
  labelMaskWrap: { alignSelf: 'center', overflow: 'hidden', minHeight: 14 },
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
  macroLabelMaskWrap: { width: 48, minHeight: 14 },
  macroValueMaskWrap: { width: 58, minHeight: 20, alignItems: 'flex-end' },
  macroTrack: { flex: 1, height: 3, backgroundColor: '#252729', borderRadius: 2, overflow: 'hidden', position: 'relative' },
  macroFillWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  macroGradientFull: { borderRadius: 0 },
  gradientSweepWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    overflow: 'hidden',
  },
  gradientSweepStrip: {
    position: 'absolute',
    left: -GRADIENT_SWEEP_PERIOD,
    top: 0,
    bottom: 0,
    width: GRADIENT_SWEEP_WIDTH,
  },
  gradientSweepGradient: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: GRADIENT_SWEEP_WIDTH,
  },
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
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
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
