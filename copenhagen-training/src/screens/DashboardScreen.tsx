import React, { useEffect, useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet, ActivityIndicator,
} from 'react-native';
import { colors, sp, fs } from '../theme';
import { fetchRecentActivities, fetchActivityDetail } from '../api';
import { ActivitySummary, ActivityDetail, IcuGroup } from '../types';
import {
  getDaysToRace, formatPace, formatPaceFromGap, formatShortDate,
  hrColor, sessionVerdict,
} from '../utils';
import { MP_HR_MIN, MP_HR_MAX, HONEST_ESTIMATE_LABEL, GOAL_LABEL } from '../constants';

function StatRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function qualityGroup(groups: IcuGroup[]): IcuGroup | null {
  if (!groups || groups.length === 0) return null;
  // Exclude very low-HR groups (warmup/cooldown: HR < 150) and find highest-HR group
  const candidates = groups.filter(g => g.average_heartrate >= 155);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, g) => g.average_heartrate > best.average_heartrate ? g : best);
}

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<ActivitySummary[]>([]);
  const [mpDetail, setMpDetail] = useState<ActivityDetail | null>(null);
  const [mpActivity, setMpActivity] = useState<ActivitySummary | null>(null);

  const daysToRace = getDaysToRace();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const activities = await fetchRecentActivities();
        if (cancelled) return;
        setRecent(activities);

        // Most recent Tuesday with distance > 10km (quality session)
        const tuesday = activities.find(a => {
          const day = new Date(a.date).getDay();
          return day === 2 && (a.distance_km ?? 0) > 8;
        });

        if (tuesday) {
          setMpActivity(tuesday);
          const detail = await fetchActivityDetail(tuesday.id);
          if (!cancelled) setMpDetail(detail);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const latest = recent[0] ?? null;
  const qGroup = mpDetail ? qualityGroup(mpDetail.laps.icu_groups) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Countdown */}
      <Card style={styles.countdownCard}>
        <Text style={styles.countdownNum}>{daysToRace}</Text>
        <Text style={styles.countdownLabel}>days to Copenhagen Marathon</Text>
        <Text style={styles.countdownDate}>10 May 2026</Text>
      </Card>

      {/* Sub-3 Status */}
      <Card>
        <SectionTitle title="Sub-3:00 Status" />
        <StatRow label="Goal" value={GOAL_LABEL} valueColor={colors.accent} />
        <StatRow label="Current estimate" value={HONEST_ESTIMATE_LABEL} valueColor={colors.amber} />
        <View style={styles.gapBar}>
          <Text style={styles.gapBarText}>Gap: ~3–7 sec/km to close</Text>
        </View>
      </Card>

      {/* Latest Activity */}
      {loading && !latest ? (
        <Card><ActivityIndicator color={colors.accent} /></Card>
      ) : error ? (
        <Card><Text style={styles.errorText}>{error}</Text></Card>
      ) : latest ? (
        <Card>
          <SectionTitle title="Latest Activity" />
          <Text style={styles.activityName}>{latest.name}</Text>
          <Text style={styles.activityDate}>{formatShortDate(latest.date)}</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBlock}>
              <Text style={styles.statBlockVal}>{latest.distance_km?.toFixed(1)} km</Text>
              <Text style={styles.statBlockLabel}>Distance</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statBlockVal}>{latest.avg_hr ?? '—'} bpm</Text>
              <Text style={styles.statBlockLabel}>Avg HR</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statBlockVal}>{formatPace(latest.avg_pace_km)}/km</Text>
              <Text style={styles.statBlockLabel}>Avg Pace</Text>
            </View>
          </View>
        </Card>
      ) : null}

      {/* MP Economy Gauge */}
      <Card>
        <SectionTitle title="MP Economy" />
        {loading && !mpDetail ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: sp.md }} />
        ) : mpActivity ? (
          <>
            <Text style={styles.mpSessionLabel}>{formatShortDate(mpActivity.date)} · {mpActivity.name}</Text>
            {qGroup ? (
              <>
                <View style={styles.mpGauge}>
                  <View style={styles.mpGaugeLeft}>
                    <Text style={[styles.mpGaugeHR, { color: hrColor(qGroup.average_heartrate) }]}>
                      {qGroup.average_heartrate} bpm
                    </Text>
                    <Text style={styles.mpGaugeSub}>Rep group avg HR</Text>
                  </View>
                  <View style={styles.mpGaugeRight}>
                    <Text style={styles.mpGaugePace}>{formatPaceFromGap(qGroup.gap)}/km</Text>
                    <Text style={styles.mpGaugeSub}>GAP pace</Text>
                  </View>
                </View>
                <View style={styles.hrZoneBar}>
                  <Text style={styles.hrZoneLabel}>Target zone: {MP_HR_MIN}–{MP_HR_MAX} bpm</Text>
                  <View style={[styles.hrZoneDot, { backgroundColor: hrColor(qGroup.average_heartrate) }]} />
                </View>
                <Text style={[styles.verdictText, { color: hrColor(qGroup.average_heartrate) }]}>
                  {sessionVerdict(qGroup.average_heartrate)}
                </Text>
              </>
            ) : (
              <Text style={styles.dimText}>No quality rep group found</Text>
            )}
          </>
        ) : (
          <Text style={styles.dimText}>No recent Tuesday session</Text>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: sp.lg, gap: sp.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: sp.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countdownCard: {
    alignItems: 'center',
    paddingVertical: sp.xl,
    borderColor: colors.accentDim,
  },
  countdownNum: {
    fontSize: 64,
    fontWeight: '700',
    color: colors.accent,
    lineHeight: 70,
  },
  countdownLabel: { fontSize: fs.md, color: colors.textSecondary, marginTop: sp.xs },
  countdownDate: { fontSize: fs.sm, color: colors.textDim, marginTop: sp.xs },
  sectionTitle: {
    fontSize: fs.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: sp.md,
  },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: sp.xs },
  statLabel: { fontSize: fs.sm, color: colors.textSecondary },
  statValue: { fontSize: fs.sm, color: colors.text, fontWeight: '500' },
  gapBar: {
    marginTop: sp.sm,
    padding: sp.sm,
    backgroundColor: colors.cardAlt,
    borderRadius: 6,
  },
  gapBarText: { fontSize: fs.xs, color: colors.textSecondary, textAlign: 'center' },
  activityName: { fontSize: fs.lg, fontWeight: '600', color: colors.text },
  activityDate: { fontSize: fs.sm, color: colors.textSecondary, marginBottom: sp.md },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statBlock: { alignItems: 'center', flex: 1 },
  statBlockVal: { fontSize: fs.md, fontWeight: '600', color: colors.text },
  statBlockLabel: { fontSize: fs.xs, color: colors.textSecondary, marginTop: 2 },
  mpSessionLabel: { fontSize: fs.sm, color: colors.textSecondary, marginBottom: sp.md },
  mpGauge: { flexDirection: 'row', marginBottom: sp.md },
  mpGaugeLeft: { flex: 1 },
  mpGaugeRight: { flex: 1, alignItems: 'flex-end' },
  mpGaugeHR: { fontSize: fs.xl, fontWeight: '700' },
  mpGaugePace: { fontSize: fs.xl, fontWeight: '700', color: colors.text },
  mpGaugeSub: { fontSize: fs.xs, color: colors.textSecondary, marginTop: 2 },
  hrZoneBar: { flexDirection: 'row', alignItems: 'center', marginBottom: sp.sm },
  hrZoneLabel: { fontSize: fs.xs, color: colors.textSecondary, flex: 1 },
  hrZoneDot: { width: 10, height: 10, borderRadius: 5 },
  verdictText: { fontSize: fs.md, fontWeight: '600' },
  errorText: { color: colors.red, fontSize: fs.sm },
  dimText: { fontSize: fs.sm, color: colors.textDim },
});
