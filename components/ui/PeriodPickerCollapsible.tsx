// ─────────────────────────────────────────────────────────────────────────────
// PeriodPickerCollapsible
//
// Month / Year / All control with collapse/expand behavior.
// - Expanded: show all 3 options
// - On select: collapse to show only selected
// - On tap collapsed: expand
// - Uses GraphPillGroup / GraphPill for Stoic proportions
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  Layout,
} from 'react-native-reanimated';
import { GraphPillGroup, GraphScrubPill } from './GraphPillGroup';

const ROW_GAP = 12;

export type PeriodValue = 'month' | 'year' | 'all';

export type PeriodPickerCollapsibleProps = {
  value: PeriodValue;
  onChange: (v: PeriodValue) => void;
  monthLabel?: string;
  yearLabel?: string;
  onMonthTap?: () => void;
  onYearTap?: () => void;
  monthPillRef?: React.RefObject<View | null>;
  yearPillRef?: React.RefObject<View | null>;
};

const OPTIONS = [
  { key: 'month' as const, label: 'Month' },
  { key: 'year' as const, label: 'Year' },
  { key: 'all' as const, label: 'All' },
];

export function PeriodPickerCollapsible({
  value,
  onChange,
  monthLabel,
  yearLabel,
  onMonthTap,
  onYearTap,
  monthPillRef,
  yearPillRef,
}: PeriodPickerCollapsibleProps) {
  const [expanded, setExpanded] = useState(true);

  const handleSelect = useCallback(
    (k: string) => {
      onChange(k as PeriodValue);
      setExpanded(false);
    },
    [onChange],
  );

  const handleExpandTap = useCallback(() => {
    setExpanded(true);
  }, []);

  if (!expanded) {
    const label = value === 'month' ? (monthLabel ?? 'Month') : value === 'year' ? (yearLabel ?? 'Year') : 'All';
    return (
      <View style={styles.row}>
        <View style={styles.periodBlock}>
          <GraphPillGroup
            options={OPTIONS}
            value={value}
            onChange={(k) => {
              if (k !== value) handleSelect(k);
              else handleExpandTap();
            }}
            style={styles.collapsedBlock}
          />
          <Animated.View
            layout={Layout.springify().damping(22).stiffness(260)}
            style={styles.collapsedOverlay}
            entering={FadeIn.duration(200)}
          >
            <GraphScrubPill label={label} onTap={handleExpandTap} />
          </Animated.View>
        </View>
        {value === 'month' && monthLabel && (
          <Animated.View
            ref={monthPillRef}
            collapsable={false}
            entering={FadeIn.springify().damping(22).stiffness(240)}
            layout={Layout.springify().damping(26).stiffness(200)}
          >
            <GraphScrubPill label={monthLabel} onTap={onMonthTap ?? (() => {})} />
          </Animated.View>
        )}
        {value === 'year' && yearLabel && (
          <Animated.View
            ref={yearPillRef}
            collapsable={false}
            entering={FadeIn.springify().damping(22).stiffness(240)}
            layout={Layout.springify().damping(26).stiffness(200)}
          >
            <GraphScrubPill label={yearLabel} onTap={onYearTap ?? (() => {})} />
          </Animated.View>
        )}
      </View>
    );
  }

  return (
    <Animated.View
      layout={Layout.springify().damping(22).stiffness(260)}
      style={styles.row}
    >
      <GraphPillGroup
        options={OPTIONS}
        value={value}
        onChange={handleSelect}
      />
      {value === 'month' && monthLabel && (
        <Animated.View
          ref={monthPillRef}
          collapsable={false}
          entering={FadeIn.springify().damping(22).stiffness(240)}
          exiting={FadeOut.duration(180)}
          layout={Layout.springify().damping(26).stiffness(200)}
        >
          <GraphScrubPill label={monthLabel} onTap={onMonthTap ?? (() => {})} />
        </Animated.View>
      )}
      {value === 'year' && yearLabel && (
        <Animated.View
          ref={yearPillRef}
          collapsable={false}
          entering={FadeIn.springify().damping(22).stiffness(240)}
          exiting={FadeOut.duration(180)}
          layout={Layout.springify().damping(26).stiffness(200)}
        >
          <GraphScrubPill label={yearLabel} onTap={onYearTap ?? (() => {})} />
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ROW_GAP,
    alignSelf: 'center',
  },
  periodBlock: {
    position: 'relative',
  },
  collapsedBlock: {
    opacity: 0,
    position: 'absolute',
    pointerEvents: 'none',
  },
  collapsedOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
