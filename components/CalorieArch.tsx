/**
 * CalorieArch — 3-zone dashed arch (grey / gold / red).
 * Opening faces BOTTOM. Arch is ~200° (stops before becoming a semicircle).
 *
 * ZONE LAYOUT (left to right):
 *   Grey (undereating) → Line1 → Gold (target) → Line2/MAINTENANCE → Red (overeating)
 *
 * Line2 (MAINTENANCE) sits at the TOP/CENTER of the arch.
 * Line1 sits to the LEFT of line2.
 */
import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated as RNAnimated } from 'react-native';
import Svg, {
  Path as SvgPath, Defs, Line as SvgLine, Rect as SvgRect, G, ClipPath,
  LinearGradient as SvgLinearGradient, Stop,
  Circle as SvgCircle,
} from 'react-native-svg';

const AnimatedRect = RNAnimated.createAnimatedComponent(SvgRect);

export interface MacroData { current: number; goal: number; }
export interface NutritionData {
  calories: MacroData;
  protein: MacroData;
  carbs: MacroData;
  fat: MacroData;
}

const SCREEN_W = Dimensions.get('window').width;

// ── Sizing ──
// R=140 with 150° sweep maintains ~270px width but shorter height
const R = 140;
const STROKE = 11;
const CX = SCREEN_W / 2;
const CY = R + STROKE + 2;
const DASH = 2;
const GAP = 4;
const ARCH_W = SCREEN_W;

// ── Arc geometry ──
// 150° total arc — shorter than semicircle, same circle curvature.
// SVG convention: 0° = right (3 o'clock), CW positive.
// Bottom = 90°.
const TOTAL_ARC = 150;
const HALF_GAP = (360 - TOTAL_ARC) / 2; // 105°
const ARC_START = 90 + HALF_GAP; // 195° (bottom-left)
// Arc goes CW: 170° → 270° (top) → 370° = 10° (bottom-right)

// Zone degrees — same ratios, scaled to 150° total.
// Maintenance (Line2) stays at center/top of arch.
const GREY_DEG = 57;
const GOLD_DEG = 18;
const RED_DEG = 75;

const GREY_END = ARC_START + GREY_DEG;   // 195+57 = 252°
const GOLD_END = GREY_END + GOLD_DEG;    // 252+18 = 270° (= TOP = center) ✓
const RED_END = GOLD_END + RED_DEG;      // 270+75 = 345°

// Computed SVG height
const SVG_H = CY + STROKE / 2 + 10;

function degToRad(d: number) { return (d * Math.PI) / 180; }

function polarXY(cx: number, cy: number, r: number, deg: number) {
  const rad = degToRad(deg);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  let sweep = endDeg - startDeg;
  if (sweep < 0) sweep += 360;
  if (sweep < 0.5) return '';
  const large = sweep > 180 ? 1 : 0;
  const s = polarXY(cx, cy, r, startDeg);
  const e = polarXY(cx, cy, r, endDeg);
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

function dividerLine(cx: number, cy: number, r: number, deg: number, ext: number) {
  const inner = polarXY(cx, cy, r - STROKE / 2 - ext, deg);
  const outer = polarXY(cx, cy, r + STROKE / 2 + ext, deg);
  return { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y };
}

type State = 'flat' | 'bronze' | 'silver' | 'gold';
function getState(data: NutritionData): State {
  const { calories, protein, carbs, fat } = data;
  const cH = calories.goal > 0 && calories.current >= calories.goal;
  const pH = protein.goal > 0 && protein.current >= protein.goal;
  const cbH = carbs.goal > 0 && carbs.current >= carbs.goal;
  const fH = fat.goal > 0 && fat.current >= fat.goal;
  if (cH && pH) return 'gold';
  if (cH || pH) return 'silver';
  if (cbH || fH) return 'bronze';
  return 'flat';
}

const MR_SIZE = 41;
const MR_SW = 4;
const MR_R = (MR_SIZE - MR_SW) / 2;
const MR_CIRC = 2 * Math.PI * MR_R;
const MR_COLS = ['#D4B896', '#8a96a2', '#6e7c87'] as const;

export type CalorieArchProps = {
  data: NutritionData;
  calorieDisplay: number;
  proteinDisplay: number;
  carbsDisplay: number;
  fatDisplay: number;
  calorieGoal: number;
  calProgress: number;
  proteinProgress: number;
  carbsProgress: number;
  fatProgress: number;
  /** When true and no tickerOverlayOpacity, hide arch + macro rings; only show calorie numbers */
  emptyState?: boolean;
  /** When provided with emptyState, render full arch with tickers that reveal (0→1) / hide (1→0) in sync with overlay */
  tickerOverlayOpacity?: RNAnimated.Value;
  /** Called when macro row (protein/carbs/fat) is laid out; receives bottom Y in window coords */
  onMacroRowLayout?: (bottomY: number) => void;
};

export function CalorieArch({
  data, calorieDisplay, proteinDisplay, carbsDisplay,
  fatDisplay, calorieGoal, calProgress,
  proteinProgress, carbsProgress, fatProgress,
  emptyState = false,
  tickerOverlayOpacity,
  onMacroRowLayout,
}: CalorieArchProps) {
  const macroRowRef = useRef<View>(null);
  const handleMacroRowLayout = useCallback(() => {
    if (!onMacroRowLayout) return;
    macroRowRef.current?.measureInWindow((_x, y, _w, h) => {
      onMacroRowLayout(y + h);
    });
  }, [onMacroRowLayout]);
  const greyBg = arcPath(CX, CY, R, ARC_START, GREY_END);
  const goldBg = arcPath(CX, CY, R, GREY_END, GOLD_END);
  const redBg = arcPath(CX, CY, R, GOLD_END, RED_END);

  const prog = Math.min(Math.max(calProgress, 0), 1.4);
  const fillDeg = prog * TOTAL_ARC;
  const fillEnd = ARC_START + fillDeg;
  const fillP = fillDeg > 0.5
    ? arcPath(CX, CY, R, ARC_START, Math.min(fillEnd, RED_END)) : '';
  let fCol = 'url(#fGrey)';
  if (fillEnd > GOLD_END) fCol = 'url(#fRed)';
  else if (fillEnd > GREY_END) fCol = 'url(#fGold)';

  // Divider line size reduced again by 20% (ext 4 → 3.2, stroke 2.4 → 1.92)
  const DIVIDER_EXT = 3.2;
  const DIVIDER_STROKE = 1.92;
  const l1 = dividerLine(CX, CY, R, GREY_END, DIVIDER_EXT);
  const l2 = dividerLine(CX, CY, R, GOLD_END, DIVIDER_EXT);

  const macros = [
    { v: proteinDisplay, p: proteinProgress, c: MR_COLS[0], l: 'protein' },
    { v: carbsDisplay, p: carbsProgress, c: MR_COLS[1], l: 'carbs' },
    { v: fatDisplay, p: fatProgress, c: MR_COLS[2], l: 'fat' },
  ];

  // Ticker animation: overlay 1 = hidden (clip width 0), overlay 0 = visible (clip width ARCH_W)
  // Clip rect reveals arch left→right; each dash pops in as the clip edge passes
  const clipWidth = tickerOverlayOpacity?.interpolate({
    inputRange: [0, 1],
    outputRange: [ARCH_W, 0],
  });
  const revealOpacity = tickerOverlayOpacity?.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const showAnimatedArch = emptyState && tickerOverlayOpacity && clipWidth != null;
  const showNormalArch = !emptyState;

  return (
    <View style={[styles.wrap, emptyState && !showAnimatedArch && styles.wrapEmpty]}>
      {(showNormalArch || showAnimatedArch) && (
      <Svg width={ARCH_W} height={SVG_H}>
        <Defs>
          <SvgLinearGradient id="bGrey" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor="#676868" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.5" />
          </SvgLinearGradient>
          <SvgLinearGradient id="bGold" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#D4B896" />
            <Stop offset="1" stopColor="#A8895E" />
          </SvgLinearGradient>
          <SvgLinearGradient id="bRed" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#D07753" />
            <Stop offset="0.5" stopColor="#FF0D0D" />
            <Stop offset="1" stopColor="#800606" />
          </SvgLinearGradient>
          <SvgLinearGradient id="fGrey" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor="#8a8c8c" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.8" />
          </SvgLinearGradient>
          <SvgLinearGradient id="fGold" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#D4B896" />
            <Stop offset="1" stopColor="#A8895E" />
          </SvgLinearGradient>
          <SvgLinearGradient id="fRed" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#D07753" />
            <Stop offset="0.5" stopColor="#FF0D0D" />
            <Stop offset="1" stopColor="#800606" />
          </SvgLinearGradient>
          {showAnimatedArch && clipWidth != null && (
            <ClipPath id="archRevealClip">
              <AnimatedRect x={0} y={0} width={clipWidth} height={SVG_H} />
            </ClipPath>
          )}
        </Defs>

        {showAnimatedArch && clipWidth != null ? (
          <G clipPath="url(#archRevealClip)">
            <SvgPath d={greyBg} fill="none" stroke="url(#bGrey)"
              strokeWidth={STROKE} strokeDasharray={`${DASH} ${GAP}`}
              strokeLinecap="butt" opacity={0.45} />
            <SvgPath d={goldBg} fill="none" stroke="url(#bGold)"
              strokeWidth={STROKE} strokeDasharray={`${DASH} ${GAP}`}
              strokeLinecap="butt" opacity={0.4} />
            <SvgPath d={redBg} fill="none" stroke="url(#bRed)"
              strokeWidth={STROKE} strokeDasharray={`${DASH} ${GAP}`}
              strokeLinecap="butt" opacity={0.35} />
            {fillP ? (
              <SvgPath d={fillP} fill="none" stroke={fCol}
                strokeWidth={STROKE} strokeDasharray={`${DASH} ${GAP}`}
                strokeLinecap="butt" />
            ) : null}
            <SvgLine {...l1} stroke="#D4B896" strokeWidth={DIVIDER_STROKE} strokeLinecap="round" />
            <SvgLine {...l2} stroke="#D4B896" strokeWidth={DIVIDER_STROKE} strokeLinecap="round" />
          </G>
        ) : (
          <>
            <SvgPath d={greyBg} fill="none" stroke="url(#bGrey)"
              strokeWidth={STROKE} strokeDasharray={`${DASH} ${GAP}`}
              strokeLinecap="butt" opacity={0.45} />
            <SvgPath d={goldBg} fill="none" stroke="url(#bGold)"
              strokeWidth={STROKE} strokeDasharray={`${DASH} ${GAP}`}
              strokeLinecap="butt" opacity={0.4} />
            <SvgPath d={redBg} fill="none" stroke="url(#bRed)"
              strokeWidth={STROKE} strokeDasharray={`${DASH} ${GAP}`}
              strokeLinecap="butt" opacity={0.35} />
            {fillP ? (
              <SvgPath d={fillP} fill="none" stroke={fCol}
                strokeWidth={STROKE} strokeDasharray={`${DASH} ${GAP}`}
                strokeLinecap="butt" />
            ) : null}
            <SvgLine {...l1} stroke="#D4B896" strokeWidth={DIVIDER_STROKE} strokeLinecap="round" />
            <SvgLine {...l2} stroke="#D4B896" strokeWidth={DIVIDER_STROKE} strokeLinecap="round" />
          </>
        )}
      </Svg>
      )}

      <View style={styles.center} pointerEvents="none">
        <Text style={styles.calNum}>{calorieDisplay}</Text>
        <Text style={styles.calSub}>/{calorieGoal} cal</Text>
        {(!emptyState || showAnimatedArch) && (
          showAnimatedArch && revealOpacity != null ? (
            <RNAnimated.View ref={macroRowRef} onLayout={handleMacroRowLayout} style={[styles.macroRow, { opacity: revealOpacity }]}>
              {macros.map((m) => {
                const pct = Math.min(m.p, 1);
                const off = MR_CIRC * (1 - pct);
                return (
                  <View key={m.l} style={styles.macroItem}>
                    <View style={styles.ringBox}>
                      <Svg width={MR_SIZE} height={MR_SIZE}
                        style={{ transform: [{ rotate: '-90deg' }] }}>
                        <SvgCircle cx={MR_SIZE/2} cy={MR_SIZE/2}
                          r={MR_R} fill="none" stroke="#3a3b3c" strokeWidth={MR_SW} />
                        <SvgCircle cx={MR_SIZE/2} cy={MR_SIZE/2}
                          r={MR_R} fill="none" stroke={m.c} strokeWidth={MR_SW}
                          strokeDasharray={`${MR_CIRC}`} strokeDashoffset={off}
                          strokeLinecap="round" />
                      </Svg>
                      <View style={styles.ringValWrap}>
                        <Text style={styles.ringVal}>{m.v}</Text>
                      </View>
                    </View>
                    <Text style={styles.ringLbl}>{m.l}</Text>
                  </View>
                );
              })}
            </RNAnimated.View>
          ) : (
            <View ref={macroRowRef} onLayout={handleMacroRowLayout} style={styles.macroRow}>
              {macros.map((m) => {
                const pct = Math.min(m.p, 1);
                const off = MR_CIRC * (1 - pct);
                return (
                  <View key={m.l} style={styles.macroItem}>
                    <View style={styles.ringBox}>
                      <Svg width={MR_SIZE} height={MR_SIZE}
                        style={{ transform: [{ rotate: '-90deg' }] }}>
                        <SvgCircle cx={MR_SIZE/2} cy={MR_SIZE/2}
                          r={MR_R} fill="none" stroke="#3a3b3c" strokeWidth={MR_SW} />
                        <SvgCircle cx={MR_SIZE/2} cy={MR_SIZE/2}
                          r={MR_R} fill="none" stroke={m.c} strokeWidth={MR_SW}
                          strokeDasharray={`${MR_CIRC}`} strokeDashoffset={off}
                          strokeLinecap="round" />
                      </Svg>
                      <View style={styles.ringValWrap}>
                        <Text style={styles.ringVal}>{m.v}</Text>
                      </View>
                    </View>
                    <Text style={styles.ringLbl}>{m.l}</Text>
                  </View>
                );
              })}
            </View>
          )
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: ARCH_W, alignSelf: 'center', alignItems: 'center', position: 'relative', height: SVG_H },
  wrapEmpty: { height: 80, justifyContent: 'center' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, height: SVG_H, alignItems: 'center', justifyContent: 'center', paddingTop: STROKE },
  calNum: { fontSize: 37, fontWeight: '500', letterSpacing: -1, color: '#FFFFFF' },
  calSub: { fontSize: 12, color: '#FFFFFF', marginTop: 2 },
  macroRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 9, gap: 40 },
  macroItem: { alignItems: 'center', width: MR_SIZE },
  ringBox: { width: MR_SIZE, height: MR_SIZE },
  ringValWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ringVal: { fontSize: 13, fontWeight: '600', color: '#dde2e6' },
  ringLbl: { fontSize: 11, color: '#9ca5ae', marginTop: 4 },
});

export default CalorieArch;
