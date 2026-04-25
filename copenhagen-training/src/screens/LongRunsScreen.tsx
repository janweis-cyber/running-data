import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LongRunStackParamList } from '../navigation/RootNavigator';
import { colors, sp, fs } from '../theme';
import { fetchAllActivities } from '../api';
import { ActivitySummary } from '../types';
import { formatPace, formatShortDate, getWeekNumber, hrColor } from '../utils';

type Props = NativeStackScreenProps<LongRunStackParamList, 'LRList'>;

function isSundayLongRun(a: ActivitySummary): boolean {
  const day = new Date(a.date).getDay();
  return day === 0 && (a.distance_km ?? 0) > 15;
}

export default function LongRunsScreen({ navigation }: Props) {
  const [runs, setRuns] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAllActivities()
      .then(acts => {
        if (cancelled) return;
        const sundays = acts.filter(isSundayLongRun).reverse();
        setRuns(sundays);
      })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handlePress = useCallback((item: ActivitySummary) => {
    navigation.navigate('LRDetail', { activityId: item.id, activityName: item.name });
  }, [navigation]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
  if (error) return <View style={styles.center}><Text style={styles.errorText}>{error}</Text></View>;

  return (
    <FlatList
      style={styles.container}
      data={runs}
      keyExtractor={item => item.id}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => {
        const weekNum = getWeekNumber(item.date);
        const weekLabel = weekNum ? `W${weekNum}` : '—';
        const hrC = item.avg_hr ? hrColor(item.avg_hr) : colors.textSecondary;
        return (
          <TouchableOpacity style={styles.row} onPress={() => handlePress(item)} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <Text style={styles.weekBadge}>{weekLabel}</Text>
            </View>
            <View style={styles.rowCenter}>
              <Text style={styles.runName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.runDate}>{formatShortDate(item.date)}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.distVal}>{item.distance_km?.toFixed(1)} km</Text>
              {item.avg_hr ? (
                <Text style={[styles.hrVal, { color: hrC }]}>{item.avg_hr} bpm</Text>
              ) : null}
              {item.avg_pace_km ? (
                <Text style={styles.paceVal}>{formatPace(item.avg_pace_km)}/km</Text>
              ) : null}
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: colors.red, fontSize: fs.sm },
  separator: { height: 1, backgroundColor: colors.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: sp.lg,
    backgroundColor: colors.card,
  },
  rowLeft: { width: 36, marginRight: sp.md },
  rowCenter: { flex: 1, marginRight: sp.sm },
  rowRight: { alignItems: 'flex-end', minWidth: 90 },
  weekBadge: {
    fontSize: fs.xs,
    fontWeight: '700',
    color: colors.accent,
    backgroundColor: colors.accentDim,
    paddingHorizontal: sp.xs,
    paddingVertical: 2,
    borderRadius: 4,
    textAlign: 'center',
  },
  runName: { fontSize: fs.sm, fontWeight: '500', color: colors.text },
  runDate: { fontSize: fs.xs, color: colors.textSecondary, marginTop: 2 },
  distVal: { fontSize: fs.sm, fontWeight: '700', color: colors.text },
  hrVal: { fontSize: fs.xs, fontWeight: '600', marginTop: 2 },
  paceVal: { fontSize: fs.xs, color: colors.textSecondary, marginTop: 2 },
});
