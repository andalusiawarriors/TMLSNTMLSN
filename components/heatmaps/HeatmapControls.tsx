// ============================================================
// TMLSN — Heatmap Controls
// Calendar|Body toggle, period pills, metric sub-control.
// Gender is read from user settings — no toggle here.
// ============================================================

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { PillSegmentedControl } from '../PillSegmentedControl';
import { Colors, Glass } from '../../constants/theme';
import type { HeatmapPeriod, CalendarMetric } from '../../utils/dateBins';

export type HeatmapView = 'Calendar' | 'Body';

interface HeatmapControlsProps {
  view: HeatmapView;
  onViewChange: (v: HeatmapView) => void;
  period: HeatmapPeriod;
  onPeriodChange: (p: HeatmapPeriod) => void;
  metric: CalendarMetric;
  onMetricChange: (m: CalendarMetric) => void;
}

const PERIODS: { key: HeatmapPeriod; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'all', label: 'All' },
];

export function HeatmapControls({
  view,
  onViewChange,
  period,
  onPeriodChange,
  metric,
  onMetricChange,
}: HeatmapControlsProps) {
  return (
    <View style={styles.container}>
      <PillSegmentedControl
        value={view}
        onValueChange={(v) => onViewChange(v as HeatmapView)}
        segments={['Calendar', 'Body']}
      />

      <View style={styles.periodRow}>
        {PERIODS.map((p) => {
          const active = period === p.key;
          return (
            <Pressable
              key={p.key}
              style={[styles.periodPill, active && styles.periodPillActive]}
              onPress={() => onPeriodChange(p.key)}
            >
              <Text style={[styles.periodLabel, active && styles.periodLabelActive]}>
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {view === 'Calendar' && (
        <View style={styles.subRow}>
          <SmallToggle
            options={['Workouts', 'Volume']}
            value={metric === 'workouts' ? 'Workouts' : 'Volume'}
            onChange={(v) => onMetricChange(v === 'Workouts' ? 'workouts' : 'volume')}
          />
        </View>
      )}
    </View>
  );
}

function SmallToggle({
  options,
  value,
  onChange,
}: {
  options: [string, string];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.smallToggle}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <Pressable
            key={opt}
            style={[styles.smallToggleBtn, active && styles.smallToggleBtnActive]}
            onPress={() => onChange(opt)}
          >
            <Text style={[styles.smallToggleLabel, active && styles.smallToggleLabelActive]}>
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    marginBottom: 8,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  periodPill: {
    flex: 1,
    height: 32,
    borderRadius: Glass.radius.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Glass.fill,
    borderWidth: Glass.borderWidth,
    borderColor: Glass.border,
  },
  periodPillActive: {
    backgroundColor: Glass.fillSelected,
    borderColor: Glass.borderSelected,
  },
  periodLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Glass.textSecondary,
    letterSpacing: -0.2,
  },
  periodLabelActive: {
    fontWeight: '600',
    color: Glass.textPrimary,
  },
  subRow: {
    flexDirection: 'row',
  },
  smallToggle: {
    flexDirection: 'row',
    backgroundColor: Glass.fill,
    borderRadius: Glass.radius.micro,
    borderWidth: Glass.borderWidth,
    borderColor: Glass.border,
    padding: 2,
    gap: 2,
  },
  smallToggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: Glass.radius.micro - 2,
  },
  smallToggleBtnActive: {
    backgroundColor: Glass.fillSelected,
  },
  smallToggleLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Glass.textSecondary,
  },
  smallToggleLabelActive: {
    color: Glass.textPrimary,
    fontWeight: '600',
  },
});
