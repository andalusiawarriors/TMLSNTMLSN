// ============================================================
// TMLSN — Heatmap Controls
// Calendar|Body toggle, period pills, metric sub-control.
// Gender is read from user settings — no toggle here.
// ============================================================

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LiquidGlassSegmented } from '../ui/liquidGlass';
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
      <LiquidGlassSegmented
        options={[
          { key: 'Calendar', label: 'Calendar' },
          { key: 'Body', label: 'Body' },
        ]}
        value={view}
        onChange={(k) => onViewChange(k as HeatmapView)}
        width={200}
      />

      <LiquidGlassSegmented
        options={PERIODS.map(p => ({ key: p.key, label: p.label }))}
        value={period}
        onChange={(k) => onPeriodChange(k as HeatmapPeriod)}
      />

      {view === 'Calendar' && (
        <LiquidGlassSegmented
          options={[
            { key: 'workouts', label: 'Workouts' },
            { key: 'volume', label: 'Volume' },
          ]}
          value={metric}
          onChange={(k) => onMetricChange(k as CalendarMetric)}
          width={180}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    marginBottom: 8,
  },
});
