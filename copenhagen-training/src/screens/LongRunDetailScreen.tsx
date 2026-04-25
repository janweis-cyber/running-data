import React, { useEffect, useState, useRef } from 'react';
import { ScrollView, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LongRunStackParamList } from '../navigation/RootNavigator';
import { colors, sp, fs } from '../theme';
import { fetchActivityDetail } from '../api';
import { ActivityDetail, IcuGroup } from '../types';
import { formatPaceFromGap, hrColor } from '../utils';

type Props = NativeStackScreenProps<LongRunStackParamList, 'LRDetail'>;

const detailCache: Record<string, ActivityDetail> = {};

export default function LongRunDetailScreen({ route }: Props) {
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
      .catch(e => { if (isMounted.current) setError(e.message); })
      .finally(() => { if (isMounted.current) setLoading(false); });

    return () => { isMounted.current = false; };
  }, [activityId]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
  if (error) return <View style={styles.center}><Text style={styles.errorText}>{error}</Text></View>;
  if (!detail) return null;

  // Find MP finish segment: groups with HR > 160, usually in later portion
  const mpFinishGroups = detail.laps.icu_groups.filter(
    (g: IcuGroup) => g.average_heartrate > 160 && g.count >= 2
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Overall stats */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Run Stats</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statBlock}>
            <Text style={[styles.statVal, { color: hrColor(detail.activity.average_heartrate) }]}>
              {detail.activity.average_heartrate} bpm
            </Text>
            <Text style={styles.statLabel}>Avg HR</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statVal}>{formatPaceFromGap(detail.activity.gap)}/km</Text>
            <Text style={styles.statLabel}>Avg GAP</Text>
          </View>
        </View>
      </View>

      {/* All rep groups */}
      {detail.laps.icu_groups.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Segments</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 0.5 }]}>#</Text>
            <Text style={[styles.th, { flex: 1.2 }]}>Avg HR</Text>
            <Text style={[styles.th, { flex: 1.2 }]}>GAP Pace</Text>
            <Text style={[styles.th, { flex: 0.8 }]}>Laps</Text>
          </View>
          {detail.laps.icu_groups.map((g: IcuGroup, i: number) => {
            const isMP = mpFinishGroups.includes(g);
            return (
              <View key={i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt, isMP && styles.tableRowHighlight]}>
                <Text style={[styles.td, { flex: 0.5 }]}>{i + 1}</Text>
                <Text style={[styles.td, { flex: 1.2, color: hrColor(g.average_heartrate), fontWeight: isMP ? '700' : '400' }]}>
                  {g.average_heartrate} bpm
                </Text>
                <Text style={[styles.td, { flex: 1.2 }]}>{formatPaceFromGap(g.gap)}/km</Text>
                <Text style={[styles.td, { flex: 0.8 }]}>{g.count}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* MP finish segment callout */}
      {mpFinishGroups.length > 0 && (
        <View style={[styles.card, styles.mpCard]}>
          <Text style={styles.sectionTitle}>MP Finish Segment</Text>
          {mpFinishGroups.map((g, i) => (
            <View key={i} style={styles.mpRow}>
              <Text style={[styles.mpHR, { color: hrColor(g.average_heartrate) }]}>
                {g.average_heartrate} bpm
              </Text>
              <Text style={styles.mpPace}>{formatPaceFromGap(g.gap)}/km GAP</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: sp.lg, gap: sp.md },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: colors.red, fontSize: fs.sm },
  card: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: sp.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mpCard: { borderColor: colors.accentDim },
  sectionTitle: {
    fontSize: fs.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: sp.md,
  },
  statsGrid: { flexDirection: 'row' },
  statBlock: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: fs.xl, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: fs.xs, color: colors.textSecondary, marginTop: 2 },
  tableHeader: { flexDirection: 'row', paddingBottom: sp.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  th: { fontSize: fs.xs, color: colors.textSecondary, fontWeight: '600' },
  tableRow: { flexDirection: 'row', paddingVertical: sp.xs },
  tableRowAlt: { backgroundColor: colors.cardAlt },
  tableRowHighlight: { borderLeftWidth: 2, borderLeftColor: colors.accent, paddingLeft: sp.xs },
  td: { fontSize: fs.sm, color: colors.text },
  mpRow: { flexDirection: 'row', alignItems: 'baseline', gap: sp.md, marginBottom: sp.xs },
  mpHR: { fontSize: fs.xl, fontWeight: '700' },
  mpPace: { fontSize: fs.md, color: colors.text },
});
