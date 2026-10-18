import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, radius } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { appService } from '../../services/appService';
import { GeneratedContent } from '../../types';

type FilterType = 'summaries' | 'quizzes' | 'all';

const PURPLE = '#9D5CF8';

function formatType(type: GeneratedContent['type'] | 'mock_exam') {
  if (type === 'mock_exam') return 'MOCK EXAM';
  return type.replace('_', ' ').toUpperCase();
}

function getIcon(type: GeneratedContent['type'] | 'mock_exam') {
  if (type === 'mock_exam') return 'assignment';
  if (type === 'summary') return 'summarize';
  if (type === 'flashcards') return 'style';
  if (type === 'true_false') return 'rule';
  if (type === 'identification') return 'badge';
  return 'quiz';
}

export function LibraryScreen({ navigation }: any) {
  const { user } = useAuth();

  const [items, setItems] = useState<GeneratedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resourceCounts, setResourceCounts] = useState<{ files: number; folders: number } | null>(null);
  const [resourceCountsError, setResourceCountsError] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedItem, setSelectedItem] = useState<GeneratedContent | null>(null);

  const loadLibrary = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [libraryResult, countsResult] = await Promise.allSettled([
        appService.getLibrary(user.id),
        Promise.all([
          appService.getEntityCount('files', user.id),
          appService.getEntityCount('folders', user.id),
        ]),
      ]);

      if (libraryResult.status === 'rejected') throw libraryResult.reason;
      setItems(libraryResult.value);

      if (countsResult.status === 'fulfilled') {
        setResourceCounts({ files: countsResult.value[0], folders: countsResult.value[1] });
        setResourceCountsError(false);
      } else {
        setResourceCounts(null);
        setResourceCountsError(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load library.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadLibrary();
    }, [loadLibrary])
  );

  const onDeleteItem = (item: GeneratedContent) => {
    if (!user?.id) return;

    Alert.alert(
      'Delete Content',
      `Are you sure you want to delete "${item.title || 'Untitled'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await appService.deleteGeneratedContent(String(item.id), user.id);

              setItems((prev) =>
                prev.filter((content) => content.id !== item.id)
              );

              if (selectedItem?.id === item.id) {
                setSelectedItem(null);
              }

              Alert.alert('Deleted', 'Generated content was deleted.');
            } catch (err: any) {
              Alert.alert(
                'Delete Failed',
                err.message || 'Failed to delete content.'
              );
            }
          },
        },
      ]
    );
  };

  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return items;

    if (activeFilter === 'summaries') {
      return items.filter((item) => item.type === 'summary');
    }

    return items.filter((item) =>
      ['mcq', 'true_false', 'identification'].includes(item.type)
    );
  }, [items, activeFilter]);

  const recentFiles = items.slice(0, 5);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Study Library</Text>

        {loading ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 35 }} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentRow}
          >
            {recentFiles.length === 0 ? (
              <Text style={styles.noRecent}>No generated files yet.</Text>
            ) : (
              recentFiles.map((item) => (
                <Pressable
                  key={String(item.id)}
                  style={styles.recentCard}
                  onPress={() => navigation.navigate('StudyResult', { id: item.id })}
                >
                  <View style={styles.recentTop}>
                    <View style={styles.circle}>
                      <MaterialIcons
                        name={getIcon(item.format || item.type)}
                        size={16}
                        color={PURPLE}
                      />
                    </View>

                    <Text style={styles.subject}>{formatType(item.format || item.type)}</Text>
                  </View>

                  <Text numberOfLines={2} style={styles.cardTitle}>
                    {item.title || 'Untitled'}
                  </Text>

                  <View style={styles.recentBottom}>
                    <Text style={styles.dateText}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </Text>

                    <Pressable
                      style={styles.smallDeleteButton}
                      onPress={() => onDeleteItem(item)}
                    >
                      <Ionicons name="trash-outline" size={15} color="#d11a2a" />
                    </Pressable>
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}
      </View>

      <View style={styles.content}>
        <Pressable
          onPress={() => navigation?.navigate?.('BrowseFiles')}
          style={styles.uploadedFilesLink}
          accessibilityRole="button"
        >
          <View style={styles.uploadedFilesIcon}>
            <Ionicons name="folder-open-outline" size={20} color={PURPLE} />
          </View>
          <View style={styles.uploadedFilesCopy}>
            <Text style={styles.uploadedFilesTitle}>Uploaded files & folders</Text>
            <Text style={styles.uploadedFilesSubtitle}>
              {resourceCounts
                ? `${resourceCounts.files} files | ${resourceCounts.folders} folders`
                : resourceCountsError
                  ? 'Files and folders are unavailable.'
                  : 'Loading file counts...'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#898394" />
        </Pressable>

        <View style={styles.filterRow}>
          {(['summaries', 'quizzes', 'all'] as FilterType[]).map((filter) => (
            <Pressable
              key={filter}
              onPress={() => setActiveFilter(filter)}
              style={[
                styles.filterButton,
                activeFilter === filter && styles.activeFilter,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === filter && styles.activeFilterText,
                ]}
              >
                {filter === 'all'
                  ? 'All'
                  : filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.listCard}>
          {filteredItems.length === 0 ? (
            <Text style={styles.empty}>No generated materials yet.</Text>
          ) : (
            <FlatList
              data={filteredItems}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.listItem}
                  onPress={() => navigation.navigate('StudyResult', { id: item.id })}
                >
                  <View style={styles.fileBox}>
                    <MaterialIcons
                      name={getIcon(item.format || item.type)}
                      size={16}
                      color={PURPLE}
                    />
                  </View>

                  <View style={styles.fileInfo}>
                    <Text numberOfLines={1} style={styles.fileTitle}>
                      {item.title || 'Untitled'}
                    </Text>

                    <Text style={styles.fileType}>{formatType(item.format || item.type)}</Text>
                  </View>

                  <Text style={styles.fileDate}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </Text>

                  <Pressable
                    style={styles.deleteIconButton}
                    onPress={() => onDeleteItem(item)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#d11a2a" />
                  </Pressable>
                </Pressable>
              )}
            />
          )}
        </View>
      </View>

      <Modal
        visible={!!selectedItem}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalType}>
                  {selectedItem ? formatType(selectedItem.type) : ''}
                </Text>

                <Text style={styles.modalTitle}>
                  {selectedItem?.title || 'Untitled'}
                </Text>
              </View>

              <Pressable
                style={styles.deleteButton}
                onPress={() => selectedItem && onDeleteItem(selectedItem)}
              >
                <Ionicons name="trash-outline" size={20} color="#d11a2a" />
              </Pressable>

              <Pressable
                style={styles.closeButton}
                onPress={() => setSelectedItem(null)}
              >
                <Ionicons name="close" size={22} color="#333" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.generatedText}>
                {selectedItem?.content || 'No content available.'}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    height: 285,
    backgroundColor: colors.background,
    paddingTop: 8,
  },

  headerTitle: {
    marginTop: 65,
    marginLeft: 10,
    color: colors.text,
    fontSize: 25,
    fontWeight: '800',
  },

  recentRow: {
    paddingLeft: 10,
    paddingRight: 15,
    paddingTop: 14,
  },

  noRecent: {
    color: colors.mutedText,
    marginTop: 20,
  },

  recentCard: {
    width: 135,
    height: 165,
    backgroundColor: '#fff',
    borderRadius: radius.md,
    padding: 10,
    justifyContent: 'space-between',
    marginRight: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },

  recentTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  circle: {
    width: 28,
    height: 28,
    borderRadius: 20,
    backgroundColor: '#F2EAFE',
    marginRight: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },

  subject: {
    fontSize: 11,
    color: '#333',
    fontWeight: '600',
  },

  cardTitle: {
    fontSize: 14,
    color: '#111',
    fontWeight: '800',
    lineHeight: 17,
  },

  recentBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dateText: {
    fontSize: 10,
    color: '#999',
  },

  smallDeleteButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ffecec',
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    flex: 1,
    paddingHorizontal: 10,
    paddingBottom: 88,
    marginTop: -12,
  },

  uploadedFilesLink: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 9,
    paddingHorizontal: 12,
    marginBottom: 4,
  },

  uploadedFilesIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f2eafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  uploadedFilesCopy: {
    flex: 1,
    minWidth: 0,
  },

  uploadedFilesTitle: {
    color: '#171423',
    fontSize: 12,
    fontWeight: '700',
  },

  uploadedFilesSubtitle: {
    color: colors.mutedText,
    fontSize: 10,
    marginTop: 3,
  },

  filterRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },

  filterButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: radius.sm,
    elevation: 4,
    marginRight: 8,
    marginTop: 20,
  },

  activeFilter: {
    backgroundColor: PURPLE,
  },

  filterText: {
    fontSize: 12,
    color: '#111',
    fontWeight: '700',
  },

  activeFilterText: {
    color: '#fff',
  },

  error: {
    color: colors.danger,
    marginBottom: 8,
  },

  listCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 9,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },

  listItem: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
  },

  fileBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F2EAFE',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  fileInfo: {
    flex: 1,
  },

  fileTitle: {
    fontSize: 12,
    color: '#333',
    fontWeight: '700',
  },

  fileType: {
    fontSize: 9,
    color: PURPLE,
    marginTop: 2,
    fontWeight: '700',
  },

  fileDate: {
    fontSize: 9,
    color: '#999',
    marginRight: 8,
  },

  deleteIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FCEDEF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  empty: {
    color: colors.mutedText,
    padding: 18,
    textAlign: 'center',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },

  modalCard: {
    maxHeight: '82%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
  },

  modalHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },

  modalType: {
    color: PURPLE,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },

  modalTitle: {
    fontSize: 18,
    color: '#111',
    fontWeight: '800',
  },

  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FCEDEF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  generatedText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
    paddingBottom: 24,
  },
});