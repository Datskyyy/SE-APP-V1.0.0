import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle as SvgCircle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { AppCard } from '../../components/AppCard';
import { colors, radius } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { appService } from '../../services/appService';
import { HomeDashboardData, UploadedFile } from '../../types';

const PURPLE = '#9D5CF8';
type ActivityPeriod = 7 | 30;

function formatDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatAccessTime(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function DashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [period, setPeriod] = useState<ActivityPeriod>(7);
  const [data, setData] = useState<HomeDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [openingFileId, setOpeningFileId] = useState<string | null>(null);
  const [folderModalVisible, setFolderModalVisible] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [savingFolder, setSavingFolder] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await appService.getHomeDashboardData(user.id, period);
      setData(result);
    } catch (loadError: any) {
      setError(loadError?.message || 'Unable to load your home dashboard.');
    } finally {
      setLoading(false);
    }
  }, [period, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard])
  );

  const chartWidth = Math.max(250, width - 76);
  const chartData = data?.studyActivity || [];
  const chartGeometry = useMemo(() => {
    const maxCount = Math.max(...chartData.map((point) => point.count), 1);
    const left = 34;
    const right = chartWidth - 12;
    const top = 18;
    const bottom = 120;
    const points = chartData.map((point, index) => {
      const x = chartData.length < 2
        ? (left + right) / 2
        : left + (index / (chartData.length - 1)) * (right - left);
      const y = bottom - (point.count / maxCount) * (bottom - top);
      return { x, y, count: point.count, date: point.date };
    });
    const labelIndexes = chartData.length > 14
      ? [0, Math.round((chartData.length - 1) / 2), chartData.length - 1]
      : chartData.map((_, index) => index).filter((index) => index % 2 === 0 || index === chartData.length - 1);

    return {
      maxCount,
      points,
      line: points.map((point) => `${point.x},${point.y}`).join(' '),
      labels: labelIndexes.map((index) => points[index]).filter(Boolean),
    };
  }, [chartData, chartWidth]);

  const handleUpload = async () => {
    if (!user?.id) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'image/*',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset?.uri) throw new Error('The selected file could not be read.');

      setUploading(true);
      await appService.uploadAndSaveFile(
        user.id,
        asset.uri,
        asset.name,
        asset.mimeType
      );
      await loadDashboard();
      Alert.alert('Upload complete', `${asset.name} was added to your files.`);
    } catch (uploadError: any) {
      Alert.alert('Upload failed', uploadError?.message || 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleOpenFile = async (file: UploadedFile) => {
    if (!user?.id) return;

    setOpeningFileId(file.id);
    try {
      const url = await appService.getFileDownloadUrl(file.storage_path);
      await appService.recordFileAccess(user.id, file.id);
      await Linking.openURL(url);
      await loadDashboard();
    } catch (openError: any) {
      Alert.alert('Could not open file', openError?.message || 'Please try again.');
    } finally {
      setOpeningFileId(null);
    }
  };

  const handleCreateFolder = async () => {
    if (!user?.id) return;
    const name = folderName.trim();
    if (!name) return;

    setSavingFolder(true);
    try {
      await appService.createFolder(user.id, name);
      setFolderName('');
      setFolderModalVisible(false);
      await loadDashboard();
    } catch (createError: any) {
      Alert.alert('Could not create folder', createError?.message || 'Please try again.');
    } finally {
      setSavingFolder(false);
    }
  };

  const metricWidth = width < 360 ? '48%' : '31.5%';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.page}
      >
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.eyebrow}>EDUFILE</Text>
            <Text style={styles.pageTitle}>Home</Text>
            <Text style={styles.greeting}>A clear view of your study files.</Text>
          </View>
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={20} color={PURPLE} />
          </View>
        </View>

        {!!error && (
          <AppCard style={styles.errorCard}>
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
            <Pressable onPress={() => void loadDashboard()} accessibilityRole="button">
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </AppCard>
        )}

        {loading && !data ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={PURPLE} size="large" />
            <Text style={styles.mutedText}>Loading your files...</Text>
          </View>
        ) : data ? (
          <>
            <View style={styles.metricGrid}>
              <MetricCard
                label="Total Files"
                value={data.totalFiles}
                icon="document-text-outline"
                width={metricWidth}
              />
              <MetricCard
                label="Folders"
                value={data.totalFolders}
                icon="folder-outline"
                width={metricWidth}
              />
              <MetricCard
                label="Files Accessed This Week"
                value={data.filesAccessedThisWeek}
                icon="time-outline"
                width={metricWidth}
                wide={width < 360}
              />
            </View>

            <AppCard style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Study Activity</Text>
                  <Text style={styles.sectionSubtitle}>Unique files opened each day</Text>
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
                <Svg width={chartWidth} height={158}>
                  {[18, 69, 120].map((y) => (
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
                  <SvgText x="2" y="22" fill="#8A8495" fontSize="10">
                    {chartGeometry.maxCount}
                  </SvgText>
                  <SvgText x="18" y="124" fill="#8A8495" fontSize="10">0</SvgText>
                  {!!chartGeometry.line && (
                    <Polyline
                      points={chartGeometry.line}
                      fill="none"
                      stroke={PURPLE}
                      strokeWidth="3"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  )}
                  {chartGeometry.points.map((point) => (
                    <SvgCircle
                      key={point.date}
                      cx={point.x}
                      cy={point.y}
                      r="3.5"
                      fill="#fff"
                      stroke={PURPLE}
                      strokeWidth="2"
                    />
                  ))}
                  {chartGeometry.labels.map((point) => (
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
              {chartData.every((point) => point.count === 0) && (
                <Text style={styles.chartEmpty}>No file activity in this period yet.</Text>
              )}
            </AppCard>

            <AppCard style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Recently Accessed Files</Text>
                  <Text style={styles.sectionSubtitle}>Pick up where you left off</Text>
                </View>
                <Pressable
                  onPress={() => navigation.navigate('BrowseFiles')}
                  accessibilityRole="button"
                  hitSlop={8}
                >
                  <Text style={styles.viewAll}>View all</Text>
                </Pressable>
              </View>

              {data.recentlyAccessedFiles.length ? (
                <View style={styles.fileList}>
                  {data.recentlyAccessedFiles.slice(0, 5).map((file) => (
                    <Pressable
                      key={file.id}
                      style={styles.fileRow}
                      onPress={() => void handleOpenFile(file)}
                      disabled={openingFileId === file.id}
                      accessibilityRole="button"
                    >
                      <View style={styles.fileIcon}>
                        <Ionicons name="document-outline" size={19} color={PURPLE} />
                      </View>
                      <View style={styles.fileInfo}>
                        <Text numberOfLines={1} style={styles.fileName}>{file.name}</Text>
                        <Text style={styles.fileDate}>
                          Accessed {file.last_accessed_at ? formatAccessTime(file.last_accessed_at) : ''}
                        </Text>
                      </View>
                      {openingFileId === file.id ? (
                        <ActivityIndicator color={PURPLE} size="small" />
                      ) : (
                        <Ionicons name="open-outline" size={18} color="#8E879B" />
                      )}
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="documents-outline" size={25} color="#A79DB4" />
                  <Text style={styles.emptyTitle}>No recent files</Text>
                  <Text style={styles.emptyBody}>Open a file to see it here.</Text>
                </View>
              )}
            </AppCard>

            <View style={styles.actionsSection}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.actionRow}>
                <QuickAction
                  icon="cloud-upload-outline"
                  label="Upload File"
                  loading={uploading}
                  onPress={() => void handleUpload()}
                />
                <QuickAction
                  icon="folder-open-outline"
                  label="Browse Files"
                  onPress={() => navigation.navigate('BrowseFiles')}
                />
                <QuickAction
                  icon="add-circle-outline"
                  label="Create Folder"
                  onPress={() => setFolderModalVisible(true)}
                />
              </View>
            </View>
          </>
        ) : !error ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={PURPLE} size="large" />
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={folderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFolderModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeading}>
              <View style={styles.modalIcon}>
                <Ionicons name="folder-open-outline" size={22} color={PURPLE} />
              </View>
              <Pressable
                onPress={() => setFolderModalVisible(false)}
                accessibilityLabel="Close create folder dialog"
                hitSlop={10}
              >
                <Ionicons name="close" size={22} color="#6E6878" />
              </Pressable>
            </View>
            <Text style={styles.modalTitle}>Create a folder</Text>
            <Text style={styles.modalSubtitle}>Give your study materials a place.</Text>
            <TextInput
              value={folderName}
              onChangeText={setFolderName}
              placeholder="Folder name"
              placeholderTextColor="#9992A4"
              maxLength={48}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void handleCreateFolder()}
              style={styles.folderInput}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setFolderModalVisible(false)}
                style={styles.cancelButton}
                disabled={savingFolder}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleCreateFolder()}
                disabled={savingFolder || !folderName.trim()}
                style={[styles.createButton, (!folderName.trim() || savingFolder) && styles.disabledButton]}
              >
                {savingFolder ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.createText}>Create folder</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function MetricCard({
  label,
  value,
  icon,
  width,
  wide,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  width: '31.5%' | '48%';
  wide?: boolean;
}) {
  return (
    <AppCard style={[styles.metricCard, { width: wide ? '100%' : width }]}>
      <View style={styles.metricIcon}>
        <Ionicons name={icon} size={18} color={PURPLE} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </AppCard>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  loading = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
    >
      {loading ? <ActivityIndicator color={PURPLE} /> : <Ionicons name={icon} size={22} color={PURPLE} />}
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  page: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 112,
    gap: 14,
  },
  pageHeader: {
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
  pageTitle: {
    color: colors.text,
    fontSize: 27,
    fontWeight: '800',
    marginTop: 2,
  },
  greeting: {
    color: colors.mutedText,
    fontSize: 13,
    marginTop: 3,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 9,
  },
  metricCard: {
    padding: 12,
    minHeight: 116,
    borderRadius: radius.md,
  },
  metricIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#F2EAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  metricValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
  },
  metricLabel: {
    color: colors.mutedText,
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 13,
    marginTop: 2,
  },
  sectionCard: {
    padding: 14,
    borderRadius: radius.md,
  },
  sectionHeader: {
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
  sectionSubtitle: {
    color: colors.mutedText,
    fontSize: 11,
    marginTop: 3,
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
    shadowColor: '#211438',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
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
  chartEmpty: {
    color: colors.mutedText,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  viewAll: {
    color: PURPLE,
    fontWeight: '700',
    fontSize: 12,
  },
  fileList: {
    marginTop: 8,
  },
  fileRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  fileIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F2EAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    flex: 1,
    minWidth: 0,
  },
  fileName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  fileDate: {
    color: colors.mutedText,
    fontSize: 10,
    marginTop: 3,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 22,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 7,
  },
  emptyBody: {
    color: colors.mutedText,
    fontSize: 11,
    marginTop: 3,
  },
  actionsSection: {
    gap: 9,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 9,
  },
  actionButton: {
    flex: 1,
    minHeight: 82,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 5,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionPressed: {
    opacity: 0.75,
  },
  actionLabel: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  loadingState: {
    paddingVertical: 42,
    alignItems: 'center',
    gap: 10,
  },
  mutedText: {
    color: colors.mutedText,
    fontSize: 12,
  },
  errorCard: {
    padding: 12,
    borderColor: '#F0C8CC',
    borderRadius: radius.md,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 12,
  },
  retryText: {
    color: PURPLE,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'right',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 22,
    backgroundColor: 'rgba(23, 20, 35, 0.42)',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 20,
  },
  modalHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2EAFE',
  },
  modalTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
    marginTop: 16,
  },
  modalSubtitle: {
    color: colors.mutedText,
    fontSize: 12,
    marginTop: 4,
  },
  folderInput: {
    height: 46,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    color: colors.text,
    fontSize: 14,
    marginTop: 18,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  cancelButton: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  cancelText: {
    color: colors.mutedText,
    fontWeight: '700',
    fontSize: 12,
  },
  createButton: {
    minHeight: 42,
    minWidth: 112,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    paddingHorizontal: 14,
    backgroundColor: PURPLE,
  },
  createText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.55,
  },
});
