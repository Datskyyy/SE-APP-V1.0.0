import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { AppCard } from '../../components/AppCard';
import { colors, radius } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { appService } from '../../services/appService';
import { HomeDashboardData } from '../../types';

const PURPLE = '#9D5CF8';
type ActivityPeriod = 7 | 30;

type ProgressData = {
  period: ActivityPeriod;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  home: HomeDashboardData;
};

function formatDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function InsightsScreen() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [period, setPeriod] = useState<ActivityPeriod>(7);
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProgress = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [progress, dashboard, home] = await Promise.all([
        appService.getProgress(user.id),
        appService.getDashboardData(user.id),
        appService.getHomeDashboardData(user.id, period),
      ]);
      setData({
        period,
        completionRate: progress?.completion_rate ?? 0,
        currentStreak: dashboard.currentStreak,
        longestStreak: dashboard.longestStreak,
        home,
      });
    } catch (loadError: any) {
      setError(loadError?.message || 'Unable to load progress right now.');
    } finally {
      setLoading(false);
    }
  }, [period, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadProgress();
    }, [loadProgress])
  );

  const activity = data?.period === period ? data.home.studyActivity : [];
  const chartWidth = Math.max(250, width - 76);
  const chart = useMemo(() => {
    const maxValue = Math.max(...activity.map((point) => point.count), 1);
    const left = 34;
    const right = chartWidth - 12;
    const top = 18;
    const bottom = 118;
    const points = activity.map((point, index) => {
      const x = activity.length < 2
        ? (left + right) / 2
        : left + (index / (activity.length - 1)) * (right - left);
      const y = bottom - (point.count / maxValue) * (bottom - top);
      return { x, y, date: point.date };
    });
    const indexes = activity.length > 14
      ? [0, Math.round((activity.length - 1) / 2), activity.length - 1]
      : activity.map((_, index) => index).filter((index) => index % 2 === 0 || index === activity.length - 1);

    return {
      maxValue,
      points,
      line: points.map((point) => `${point.x},${point.y}`).join(' '),
      labels: indexes.map((index) => points[index]).filter(Boolean),
    };
  }, [activity, chartWidth]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.page}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>YOUR STUDY HABITS</Text>
            <Text style={styles.title}>Progress</Text>
            <Text style={styles.subtitle}>A record of your activity and consistency.</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="analytics-outline" size={21} color={PURPLE} />
          </View>
        </View>

        {!!error && (
          <AppCard style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void loadProgress()}>
              <Text style={styles.retry}>Retry</Text>
            </Pressable>
          </AppCard>
        )}

        {loading && !data ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={PURPLE} size="large" />
            <Text style={styles.helperText}>Loading progress...</Text>
          </View>
        ) : data ? (
          <>
            <View style={styles.metricRow}>
              <AppCard style={styles.metricCard}>
                <View style={styles.metricIcon}>
                  <Ionicons name="calendar-outline" size={18} color={PURPLE} />
                </View>
                <Text style={styles.metricValue}>{data.home.filesAccessedThisWeek}</Text>
                <Text style={styles.metricLabel}>Files accessed this week</Text>
              </AppCard>
              <AppCard style={styles.metricCard}>
                <View style={styles.metricIcon}>
                  <Ionicons name="flame-outline" size={18} color={PURPLE} />
                </View>
                <Text style={styles.metricValue}>{data.currentStreak}</Text>
                <Text style={styles.metricLabel}>Current day streak</Text>
              </AppCard>
            </View>

            <AppCard style={styles.completionCard}>
              <View style={styles.completionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Study completion</Text>
                  <Text style={styles.helperText}>Based on completed study materials</Text>
                </View>
                <Text style={styles.completionValue}>{data.completionRate}%</Text>
              </View>
              <View
                style={styles.progressTrack}
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: data.completionRate }}
              >
                <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, data.completionRate))}%` }]} />
              </View>
              <Text style={styles.longestStreak}>Longest streak: {data.longestStreak} days</Text>
            </AppCard>

            <AppCard style={styles.activityCard}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Study Activity</Text>
                  <Text style={styles.helperText}>Unique files opened each day</Text>
                </View>
                {loading && <ActivityIndicator color={PURPLE} size="small" />}
              </View>

              <View style={styles.filterRow}>
                {([7, 30] as ActivityPeriod[]).map((days) => (
                  <Pressable
                    key={days}
                    onPress={() => setPeriod(days)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: period === days }}
                    style={[styles.filterButton, period === days && styles.filterButtonActive]}
                  >
                    <Text style={[styles.filterText, period === days && styles.filterTextActive]}>
                      {days} days
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.chartWrap}>
                <Svg width={chartWidth} height={154}>
                  {[18, 68, 118].map((y) => (
                    <Line
                      key={y}
                      x1="34"
                      x2={chartWidth - 12}
                      y1={y}
                      y2={y}
                      stroke="#EEE8F7"
                      strokeWidth="1"
                    />
                  ))}
                  <SvgText x="2" y="22" fill="#8A8495" fontSize="10">{chart.maxValue}</SvgText>
                  <SvgText x="18" y="122" fill="#8A8495" fontSize="10">0</SvgText>
                  {!!chart.line && (
                    <Polyline
                      points={chart.line}
                      fill="none"
                      stroke={PURPLE}
                      strokeWidth="3"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  )}
                  {chart.points.map((point) => (
                    <Circle
                      key={point.date}
                      cx={point.x}
                      cy={point.y}
                      r="3.5"
                      fill="#fff"
                      stroke={PURPLE}
                      strokeWidth="2"
                    />
                  ))}
                  {chart.labels.map((point) => (
                    <SvgText
                      key={point.date}
                      x={point.x}
                      y="148"
                      fill="#777180"
                      fontSize="9"
                      textAnchor="middle"
                    >
                      {formatDate(point.date)}
                    </SvgText>
                  ))}
                </Svg>
              </View>
              {activity.length && activity.every((point) => point.count === 0) ? (
                <Text style={styles.emptyText}>No file activity in this period yet.</Text>
              ) : null}
              {!activity.length && !loading && !error && (
                <Text style={styles.emptyText}>Activity data is not available yet.</Text>
              )}
            </AppCard>
          </>
        ) : !error ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={PURPLE} size="large" />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  page: {
    padding: 18,
    paddingBottom: 110,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  eyebrow: {
    color: PURPLE,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontSize: 27,
    fontWeight: '800',
    marginTop: 2,
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: 12,
    marginTop: 3,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#F0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    padding: 13,
    minHeight: 120,
    borderRadius: radius.md,
  },
  metricIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#F2EAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metricValue: {
    color: colors.text,
    fontSize: 23,
    lineHeight: 27,
    fontWeight: '800',
  },
  metricLabel: {
    color: colors.mutedText,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 3,
  },
  completionCard: {
    padding: 15,
    borderRadius: radius.md,
  },
  completionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  helperText: {
    color: colors.mutedText,
    fontSize: 11,
    marginTop: 3,
  },
  completionValue: {
    color: PURPLE,
    fontSize: 25,
    fontWeight: '800',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#F0EAF7',
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 15,
  },
  progressFill: {
    height: '100%',
    backgroundColor: PURPLE,
    borderRadius: 6,
  },
  longestStreak: {
    color: colors.mutedText,
    fontSize: 11,
    marginTop: 10,
  },
  activityCard: {
    padding: 14,
    borderRadius: radius.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  filterRow: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    padding: 3,
    marginTop: 14,
    marginBottom: 8,
    borderRadius: 9,
    backgroundColor: '#F3EFF8',
  },
  filterButton: {
    minWidth: 66,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
  },
  filterButtonActive: {
    backgroundColor: '#fff',
  },
  filterText: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: '600',
  },
  filterTextActive: {
    color: PURPLE,
  },
  chartWrap: {
    overflow: 'hidden',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 3,
  },
  loadingState: {
    paddingVertical: 42,
    alignItems: 'center',
    gap: 10,
  },
  errorCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderColor: '#F0C8CC',
    borderRadius: radius.md,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 12,
    marginRight: 10,
  },
  retry: {
    color: PURPLE,
    fontWeight: '700',
    fontSize: 12,
  },
});
