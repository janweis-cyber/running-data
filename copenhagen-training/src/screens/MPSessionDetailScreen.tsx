import React, { useEffect, useState, useRef } from 'react';
import {
  ScrollView, View, Text, StyleSheet, ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MPStackParamList } from '../navigation/RootNavigator';
import { colors, sp, fs } from '../theme';
import { fetchActivityDetail } from '../api';
import { ActivityDetail, IcuGroup } from '../types';
import { formatPaceFromGap, hrColor, sessionVerdict, getWeekNumber } from '../utils';

type Props = NativeStackScreenProps<MPStackParamList, 'MPDetail'>;

const detailCache: Record<string, ActivityDetail> = {};

function isQualityGroup(g: IcuGroup): boolean {
  return g.average_heartrate >= 155 && g.count >= 2;
}

export default function MPSessionDetailScreen({ route }: Props) {
  const { activityId } = route.params;
  const [detail, setDetail] = useState<ActivityDetail | null>(detailCache[activityId] ?? null);
  const [loading, setLoading] = useState(!detailCache[activityId]);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    if (detailCache[activityId]) return;

    fetchActivityDetail(activityId)
      .then(d => {
        if (!isMounted.current) return;
        detailCache[activityId] = d;
        setDetail(d);
      })
      .catch(e => {
        if (isMounted.current) setError(e.message);
      })
      .finally(() => {
        if (isMounted.current) setLoading(false);
      });

    return () => { isMounted.current = false; };
  }, [activityId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!detail) return null;

  const qualityGroups = detail.laps.icu_groups.filter(isQualityGroup);
  const topGroup = qualityGroups.length > 0
    ? qualityGroups.reduce((best, g) => g.average_heartrate > best.average_heartrate ? g : best)
    : null;
  const repHr = topGroup?.average_heartrate ?? detail.activity.average_heartrate;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Session verdict */}
      <View style={styles.verdictCard}>
        <Text style={[styles.verdictText, { color: hrColor(repHr) }]}>
          {sessionVerdict(repHr)}
        </Text>
        <Text style={styles.verdictSub}>
          Rep HR {repHr} bpm · Target {' '}162–167
        </Text>
      </View>

      {/* Overall stats */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Session Stats</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={[styles.statVal, { color: hrColor(detail.activity.average_heartrate) }]}>
              {detail.activity.average_heartrate} bpm
            </Text>
            <Text style={styles.statLabel}>Overall HR</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statVal}>{formatPaceFromGap(detail.activity.gap)}/km</Text>
            <Text style={styles.statLabel}>Overall GAP</Text>
          </View>
        </View>
      </View>

      {/* Rep groups table */}
      {qualityGroups.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Rep Groups</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 0.6 }]}>Group</Text>
            <Text style={[styles.th, { flex: 1.2 }]}>Avg HR</Text>
            <Text style={[styles.th, { flex: 1.2 }]}>GAP Pace</Text>
            <Text style={[styles.th, { flex: 0.8 }]}>Laps</Text>
          </View>
          {qualityGroups.map((g, i) => (
            <View key={i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
              <Text style={[styles.td, { flex: 0.6 }]}>{i + 1}</Text>
              <Text style={[styles.td, { flex: 1.2, color: hrColor(g.average_heartrate), fontWeight: '600' }]}>
                {g.average_heartrate} bpm
              </Text>
              <Text style={[styles.td, { flex: 1.2 }]}>{formatPaceFromGap(g.gap)}/km</Text>
              <Text style={[styles.td, { flex: 0.8 }]}>{g.count}</Text>
            </View>
          ))}
        </View>
      )}

      {/* HR zone annotation */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>HR Zone Key</Text>
        <View style={styles.zoneRow}>
          <View style={[styles.zoneDot, { backgroundColor: colors.green }]} />
          <Text style={styles.zoneText}>162–167 bpm — MP target</Text>
        </View>
        <View style={styles.zoneRow}>
          <View style={[styles.zoneDot, { backgroundColor: colors.amber }]} />
          <Text style={styles.zoneText}>168–172 bpm — Slightly overcooked</Text>
        </View>
        <View style={styles.zoneRow}>
          <View style={[styles.zoneDot, { backgroundColor: colors.red }]} />
          <Text style={styles.zoneText}>173+ bpm — Threshold effort</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: sp.lg, gap: sp.md },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: colors.red, fontSize: fs.sm },
  verdictCard: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: sp.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    paddingVertical: sp.xl,
  },
  verdictText: { fontSize: fs.xl, fontWeight: '700' },
  verdictSub: { fontSize: fs.sm, color: colors.textSecondary, marginTop: sp.xs },
  card: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: sp.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: fs.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: sp.md,
  },
  statsRow: { flexDirection: 'row' },
  statBlock: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: fs.xl, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: fs.xs, color: colors.textSecondary, marginTop: 2 },
  tableHeader: { flexDirection: 'row', paddingBottom: sp.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  th: { fontSize: fs.xs, color: colors.textSecondary, fontWeight: '600' },
  tableRow: { flexDirection: 'row', paddingVertical: sp.xs },
  tableRowAlt: { backgroundColor: colors.cardAlt },
  td: { fontSize: fs.sm, color: colors.text },
  zoneRow: { flexDirection: 'row', alignItems: 'center', marginBottom: sp.xs },
  zoneDot: { width: 10, height: 10, borderRadius: 5, marginRight: sp.sm },
  zoneText: { fontSize: fs.sm, color: colors.text },
});
