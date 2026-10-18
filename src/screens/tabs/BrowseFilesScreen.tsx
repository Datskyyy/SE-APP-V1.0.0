import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { AppCard } from '../../components/AppCard';
import { colors, radius } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { appService } from '../../services/appService';
import { UploadedFile, UserFolder } from '../../types';

const PURPLE = '#9D5CF8';

export function BrowseFilesScreen({ navigation }: any) {
  const { user } = useAuth();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [folders, setFolders] = useState<UserFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openingFileId, setOpeningFileId] = useState<string | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [uploadedFiles, userFolders] = await Promise.all([
        appService.getUploadedFiles(user.id),
        appService.getFolders(user.id),
      ]);
      setFiles(uploadedFiles);
      setFolders(userFolders);
    } catch (loadError: any) {
      setError(loadError?.message || 'Unable to load your files.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadFiles();
    }, [loadFiles])
  );

  const openFile = async (file: UploadedFile) => {
    if (!user?.id) return;

    setOpeningFileId(file.id);
    try {
      const url = await appService.getFileDownloadUrl(file.storage_path);
      await appService.recordFileAccess(user.id, file.id);
      await Linking.openURL(url);
    } catch (openError: any) {
      Alert.alert('Could not open file', openError?.message || 'Please try again.');
    } finally {
      setOpeningFileId(null);
    }
  };

  const deleteFile = async (file: UploadedFile) => {
    if (!user?.id) return;

    setDeletingFileId(file.id);
    try {
      await appService.deleteUploadedFile(user.id, file.id);
      setFiles((currentFiles) => currentFiles.filter((item) => item.id !== file.id));
      Alert.alert('File deleted', `${file.name} was removed.`);
    } catch (deleteError: any) {
      Alert.alert('Could not delete file', deleteError?.message || 'Please try again.');
    } finally {
      setDeletingFileId(null);
    }
  };

  const confirmDelete = (file: UploadedFile) => {
    Alert.alert(
      'Delete uploaded file?',
      `"${file.name}" will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void deleteFile(file),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={21} color={colors.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>YOUR LIBRARY</Text>
            <Text style={styles.title}>Browse Files</Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('Generate')}
            accessibilityLabel="Upload file"
            style={styles.uploadButton}
          >
            <Ionicons name="cloud-upload-outline" size={19} color="#fff" />
          </Pressable>
        </View>

        {!!error && (
          <AppCard style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void loadFiles()}>
              <Text style={styles.retry}>Retry</Text>
            </Pressable>
          </AppCard>
        )}

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={PURPLE} size="large" />
            <Text style={styles.helperText}>Loading your files...</Text>
          </View>
        ) : (
          <>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Folders</Text>
              <Text style={styles.count}>{folders.length}</Text>
            </View>
            {folders.length ? (
              <View style={styles.folderGrid}>
                {folders.map((folder) => (
                  <AppCard key={folder.id} style={styles.folderCard}>
                    <Ionicons name="folder" size={22} color={PURPLE} />
                    <Text numberOfLines={1} style={styles.folderName}>{folder.name}</Text>
                  </AppCard>
                ))}
              </View>
            ) : (
              <AppCard style={styles.emptyFolder}>
                <Ionicons name="folder-open-outline" size={21} color="#9D94A8" />
                <Text style={styles.helperText}>No folders yet.</Text>
              </AppCard>
            )}

            <View style={[styles.sectionHeading, styles.filesHeading]}>
              <Text style={styles.sectionTitle}>Files</Text>
              <Text style={styles.count}>{files.length}</Text>
            </View>
            <AppCard style={styles.fileCard}>
              {files.length ? (
                files.map((file, index) => (
                  <View
                    key={file.id}
                    style={[styles.fileRow, index > 0 && styles.fileDivider]}
                  >
                    <Pressable
                      style={styles.openFileRow}
                      onPress={() => void openFile(file)}
                      disabled={openingFileId === file.id || deletingFileId === file.id}
                      accessibilityRole="button"
                    >
                      <View style={styles.fileIcon}>
                        <Ionicons name="document-text-outline" size={19} color={PURPLE} />
                      </View>
                      <View style={styles.fileCopy}>
                        <Text numberOfLines={1} style={styles.fileName}>{file.name}</Text>
                        <Text style={styles.fileDate}>{new Date(file.created_at).toLocaleDateString()}</Text>
                      </View>
                      {openingFileId === file.id ? (
                        <ActivityIndicator color={PURPLE} size="small" />
                      ) : (
                        <Ionicons name="open-outline" size={18} color="#8E879B" />
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => confirmDelete(file)}
                      disabled={openingFileId === file.id || deletingFileId === file.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${file.name}`}
                      style={styles.deleteButton}
                    >
                      {deletingFileId === file.id ? (
                        <ActivityIndicator color={colors.danger} size="small" />
                      ) : (
                        <>
                          <Ionicons name="trash-outline" size={15} color={colors.danger} />
                          <Text style={styles.deleteLabel}>Delete</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                ))
              ) : (
                <View style={styles.emptyFiles}>
                  <Ionicons name="documents-outline" size={26} color="#A79DB4" />
                  <Text style={styles.emptyTitle}>No uploaded files</Text>
                  <Text style={styles.helperText}>Upload a study file to see it here.</Text>
                  <Pressable
                    onPress={() => navigation.navigate('Generate')}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonText}>Upload a file</Text>
                  </Pressable>
                </View>
              )}
            </AppCard>
          </>
        )}
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
    paddingBottom: 40,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: PURPLE,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '800',
    marginTop: 2,
  },
  uploadButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PURPLE,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  count: {
    minWidth: 24,
    textAlign: 'center',
    color: PURPLE,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: '#F0E7FF',
  },
  folderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  folderCard: {
    width: '48%',
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 12,
    borderRadius: radius.md,
  },
  folderName: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyFolder: {
    padding: 15,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  filesHeading: {
    marginTop: 8,
  },
  fileCard: {
    paddingVertical: 4,
    paddingHorizontal: 13,
    borderRadius: radius.md,
  },
  fileRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
  },
  openFileRow: {
    flex: 1,
    minWidth: 0,
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  fileDivider: {
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
  fileCopy: {
    flex: 1,
    minWidth: 0,
  },
  deleteButton: {
    minWidth: 68,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
    borderRadius: 9,
    backgroundColor: '#FCEDEF',
    marginLeft: 6,
  },
  deleteLabel: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: '700',
  },
  fileName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  fileDate: {
    color: colors.mutedText,
    fontSize: 10,
    marginTop: 3,
  },
  loadingState: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 10,
  },
  helperText: {
    color: colors.mutedText,
    fontSize: 12,
  },
  emptyFiles: {
    alignItems: 'center',
    paddingVertical: 25,
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
    marginTop: 8,
  },
  primaryButton: {
    marginTop: 15,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: PURPLE,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
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
