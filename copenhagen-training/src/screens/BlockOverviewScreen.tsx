import React, { useEffect, useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet, ActivityIndicator,
} from 'react-native';
import { colors, sp, fs } from '../theme';
import { fetchAllActivities } from '../api';
import { WeekData } from '../types';
import { buildWeekGrid, formatPace, formatPaceFromGap, formatShortDate, hrColor } from '../utils';

function WeekRow({ week }: { week: WeekData }) {
  const isTaper = week.isTaper;
  const isKey = week.isKey;

  let rowBg = colors.card;
  let borderColor = colors.border;
  if (isKey) { rowBg = '#1a1208'; borderColor = colors.amber; }
  if (isTaper) { rowBg = '#071014'; borderColor = colors.accentDim; }

  const tue = week.tuesday;
  const sun = week.sunday;

  const weekLabel = `W${week.weekNum}`;
  const dateRange = `${formatShortDate(week.startDate)}–${formatShortDate(week.endDate)}`;
  const tag = isTaper ? '  TAPER' : isKey ? '  KEY' : '';

  return (
    <View style={[styles.weekRow, { backgroundColor: rowBg, borderColor }]}>
      {/* Week header */}
      <View style={styles.weekHeader}>
        <Text style={[styles.weekNum, isKey && styles.weekNumKey, isTaper && styles.weekNumTaper]}>
          {weekLabel}
          {tag ? <Text style={styles.tag}>{tag}</Text> : null}
        </Text>
        <Text style={styles.dateRange}>{dateRange}</Text>
      </View>

      {/* Content row */}
      <View style={styles.weekContent}>
        {/* Tuesday column */}
        <View style={styles.col}>
          <Text style={styles.colHeader}>TUE</Text>
          {tue ? (
            <>
              <Text style={[styles.hrText, { color: hrColor(tue.avg_hr ?? 0) }]}>
                {tue.avg_hr ? `${tue.avg_hr} bpm` : '—'}
              </Text>
              <Text style={styles.subText}>
                {tue.avg_pace_km ? `${formatPace(tue.avg_pace_km)}/km` : ''}
              </Text>
              <Text style={styles.subText} numberOfLines={1}>{tue.name?.split('-').pop()?.trim() ?? tue.name}</Text>
            </>
          ) : (
            <Text style={styles.emptyText}>—</Text>
          )}
        </View>

        {/* Sunday column */}
        <View style={styles.col}>
          <Text style={styles.colHeader}>SUN</Text>
          {sun ? (
            <>
              <Text style={styles.distText}>{sun.distance_km?.toFixed(0)} km</Text>
              <Text style={[styles.hrText, { color: hrColor(sun.avg_hr ?? 0) }]}>
                {sun.avg_hr ? `${sun.avg_hr} bpm` : '—'}
              </Text>
              <Text style={styles.subText}>
                {sun.avg_pace_km ? `${formatPace(sun.avg_pace_km)}/km` : ''}
              </Text>
            </>
          ) : (
            <Text style={styles.emptyText}>—</Text>
          )}
        </View>
      </View>
    </View>
  );
}

export default function BlockOverviewScreen() {
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAllActivities()
      .then(acts => {
        if (cancelled) return;
        setWeeks(buildWeekGrid(acts));
      })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
  if (error) return <View style={styles.center}><Text style={styles.errorText}>{error}</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.amber }]} />
          <Text style={styles.legendText}>Key week</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
          <Text style={styles.legendText}>Taper</Text>
        </View>
      </View>
      {weeks.map(w => <WeekRow key={w.weekNum} week={w} />)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: sp.md, gap: sp.xs },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: colors.red, fontSize: fs.sm },
  legend: { flexDirection: 'row', gap: sp.lg, marginBottom: sp.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: sp.xs },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: fs.xs, color: colors.textSecondary },
  weekRow: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: sp.xs,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: sp.md,
    paddingTop: sp.sm,
    paddingBottom: sp.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  weekNum: { fontSize: fs.sm, fontWeight: '700', color: colors.textSecondary },
  weekNumKey: { color: colors.amber },
  weekNumTaper: { color: colors.accent },
  tag: { fontSize: fs.xs, fontWeight: '600', letterSpacing: 0.5 },
  dateRange: { fontSize: fs.xs, color: colors.textDim },
  weekContent: { flexDirection: 'row', padding: sp.sm, gap: sp.sm },
  col: { flex: 1 },
  colHeader: {
    fontSize: fs.xs,
    fontWeight: '700',
    color: colors.textDim,
    letterSpacing: 0.8,
    marginBottom: sp.xs,
  },
  hrText: { fontSize: fs.sm, fontWeight: '600' },
  distText: { fontSize: fs.md, fontWeight: '700', color: colors.text },
  subText: { fontSize: fs.xs, color: colors.textSecondary, marginTop: 1 },
  emptyText: { fontSize: fs.sm, color: colors.textDim },
});
