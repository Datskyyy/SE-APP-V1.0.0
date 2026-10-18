import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { AppCard } from '../../components/AppCard';
import { aiService } from '../../services/aiService';
import { appService } from '../../services/appService';
import { useAuth } from '../../hooks/useAuth';
import { StudyFormat, UploadedFile } from '../../types';
import { colors, radius } from '../../constants/theme';

const PURPLE = colors.primary;

function createRequestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

type SelectedSource = UploadedFile & {
  localUri: string;
  previewType: 'image' | 'document';
};

function formatFileSize(size: number) {
  return size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function GenerateScreen({ navigation }: any) {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [source, setSource] = useState<SelectedSource | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [busyType, setBusyType] = useState<StudyFormat | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<StudyFormat | null>(null);
  const [generationError, setGenerationError] = useState('');
  const [questionCount, setQuestionCount] = useState(20);
  const generationController = useRef<AbortController | null>(null);
  const requestIdRef = useRef<string | null>(null);

  const onUpload = async () => {
    if (!user?.id || uploading || busyType) return;
    setUploadError('');
    setUploading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'image/jpeg',
          'image/png',
        ],
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset?.uri) {
        throw new Error('The selected file could not be read.');
      }
      const extension = asset.name.split('.').pop()?.toLowerCase() || '';
      const expectedMime: Record<string, string> = {
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
      };
      if (!expectedMime[extension]) {
        throw new Error('Unsupported file type. Choose PDF, DOCX, PPTX, JPG, or PNG.');
      }
      if (asset.size === 0) throw new Error('The selected file is empty.');
      if (asset.size && asset.size > 20 * 1024 * 1024) {
        throw new Error('Files must be 20 MB or smaller.');
      }
      if (
        asset.mimeType &&
        asset.mimeType !== 'application/octet-stream' &&
        asset.mimeType !== expectedMime[extension]
      ) {
        throw new Error('The selected file extension and file type do not match.');
      }

      const uploaded = await appService.uploadAndSaveFile(
        user.id,
        asset.uri,
        asset.name,
        asset.mimeType || expectedMime[extension]
      );

      setSource({
        ...uploaded,
        size_bytes: uploaded.size_bytes ?? asset.size ?? null,
        localUri: asset.uri,
        previewType: extension === 'jpg' || extension === 'jpeg' || extension === 'png'
          ? 'image'
          : 'document',
      });
      setSelectedFormat(null);
      requestIdRef.current = null;
    } catch (error: any) {
      setUploadError(error.message || 'Upload failed. Please choose the file again.');
    } finally {
      setUploading(false);
    }
  };

  const removeSelectedFile = () => {
    if (!source) return;
    Alert.alert(
      'Remove selected file?',
      'This clears the file from Generate. The uploaded copy remains in Browse Files.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setSource(null);
            setSelectedFormat(null);
            setGenerationError('');
            requestIdRef.current = null;
          },
        },
      ]
    );
  };

  const previewSource = async () => {
    if (!source) return;
    try {
      const url = await appService.getFileDownloadUrl(source.storage_path);
      await Linking.openURL(url);
    } catch (previewError: any) {
      setUploadError(previewError?.message || 'Unable to preview this file.');
    }
  };

  const selectFormat = (format: StudyFormat) => {
    if (selectedFormat !== format) requestIdRef.current = null;
    setSelectedFormat(format);
    setGenerationError('');
  };

  const onGenerate = async (type: StudyFormat) => {
    if (!user?.id || !source || busyType) return;

    const controller = new AbortController();
    generationController.current = controller;
    setSelectedFormat(type);
    setGenerationError('');
    setBusyType(type);
    try {
      const requestId = requestIdRef.current || createRequestId();
      requestIdRef.current = requestId;
      const payload = await aiService.generate(type, source.id, questionCount, controller.signal);
      if (controller.signal.aborted) return;
      const title = `${type} - ${new Date().toLocaleDateString()}`;

      const saved = await appService.saveGeneratedContent(
        user.id,
        type,
        title,
        payload,
        source.id,
        source.name,
        requestId
      );

      requestIdRef.current = null;
      navigation.navigate('StudyResult', { id: saved.id });
    } catch (error: any) {
      setGenerationError(error.message || 'Generation failed. Please retry.');
    } finally {
      generationController.current = null;
      setBusyType(null);
    }
  };

  const cancelGeneration = () => generationController.current?.abort();

  const optionWidth = width >= 700 ? '31.5%' : '48%';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.page}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>STUDY TOOLS</Text>
            <Text style={styles.title}>Generate</Text>
            <Text style={styles.subtitle}>Choose a file and a study format.</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="sparkles-outline" size={21} color={PURPLE} />
          </View>
        </View>

        <AppCard style={styles.uploadCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Source file</Text>
              <Text style={styles.helperText}>PDF, DOCX, PPTX, or image</Text>
            </View>
            <View style={styles.fileTypesRow}>
              <FileType icon="description" label="DOCX" />
              <FileType icon="picture-as-pdf" label="PDF" />
              <FileType icon="image" label="IMG" />
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.uploadArea, pressed && styles.pressed]}
            onPress={onUpload}
            disabled={uploading || !!busyType}
            accessibilityRole="button"
          >
            {source?.previewType === 'image' ? (
              <Image source={{ uri: source.localUri }} style={styles.imagePreview} />
            ) : (
              <View style={styles.uploadIconCircle}>
                {uploading ? <ActivityIndicator color={PURPLE} /> : <MaterialIcons name="file-upload" size={23} color={PURPLE} />}
              </View>
            )}
            <View style={styles.uploadCopy}>
              <Text numberOfLines={1} style={styles.uploadText}>
                {uploading ? 'Uploading file...' : source?.name || 'Choose a file'}
              </Text>
              <Text style={styles.uploadedText}>
                {source
                  ? `${formatFileSize(source.size_bytes || 0)} | Ready to process`
                  : 'PDF, DOCX, PPTX, JPG, or PNG. Max 20 MB.'}
              </Text>
            </View>
            <Ionicons name={source ? 'repeat-outline' : 'chevron-forward'} size={18} color={colors.mutedText} />
          </Pressable>
          {!!source && (
            <View style={styles.sourceActions}>
              <Text numberOfLines={1} style={styles.sourceReady}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} /> File uploaded and ready
              </Text>
              <Pressable onPress={() => void previewSource()} disabled={!!busyType} accessibilityRole="button" style={styles.previewButton}>
                <Ionicons name="eye-outline" size={14} color={PURPLE} />
                <Text style={styles.previewText}>Preview</Text>
              </Pressable>
              <Pressable onPress={removeSelectedFile} disabled={!!busyType} accessibilityRole="button">
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          )}
          {!!uploadError && <Text style={styles.errorText}>{uploadError}</Text>}
        </AppCard>

        <View style={styles.formatHeading}>
          <Text style={styles.sectionTitle}>Study format</Text>
          <Text style={styles.helperText}>Select what you want to create.</Text>
        </View>

        {!!selectedFormat && selectedFormat === 'mock_exam' && (
          <AppCard style={styles.questionCountCard}>
            <View style={styles.questionCountCopy}>
              <Text style={styles.sectionTitle}>Exam length</Text>
              <Text style={styles.helperText}>Choose 5 to 30 questions</Text>
            </View>
            <Pressable
              onPress={() => setQuestionCount((count) => Math.max(5, count - 5))}
              disabled={questionCount <= 5 || !!busyType}
              style={styles.stepperButton}
              accessibilityLabel="Decrease question count"
            >
              <Ionicons name="remove" size={18} color={PURPLE} />
            </Pressable>
            <Text style={styles.questionCount}>{questionCount}</Text>
            <Pressable
              onPress={() => setQuestionCount((count) => Math.min(30, count + 5))}
              disabled={questionCount >= 30 || !!busyType}
              style={styles.stepperButton}
              accessibilityLabel="Increase question count"
            >
              <Ionicons name="add" size={18} color={PURPLE} />
            </Pressable>
          </AppCard>
        )}

        <View style={styles.grid}>
          <GenerateOption
            icon="summarize"
            label="Summary"
            width={optionWidth}
            onPress={() => selectFormat('summary')}
            loading={busyType === 'summary'}
            selected={selectedFormat === 'summary'}
            disabled={!source || !!busyType}
          />
          <GenerateOption
            icon="quiz"
            label="MCQ"
            width={optionWidth}
            onPress={() => selectFormat('mcq')}
            loading={busyType === 'mcq'}
            selected={selectedFormat === 'mcq'}
            disabled={!source || !!busyType}
          />
          <GenerateOption
            icon="rule"
            label="True or False"
            width={optionWidth}
            onPress={() => selectFormat('true_false')}
            loading={busyType === 'true_false'}
            selected={selectedFormat === 'true_false'}
            disabled={!source || !!busyType}
          />
          <GenerateOption
            icon="style"
            label="Flashcards"
            width={optionWidth}
            onPress={() => selectFormat('flashcards')}
            loading={busyType === 'flashcards'}
            selected={selectedFormat === 'flashcards'}
            disabled={!source || !!busyType}
          />
          <GenerateOption
            icon="badge"
            label="Identification"
            width={optionWidth}
            onPress={() => selectFormat('identification')}
            loading={busyType === 'identification'}
            selected={selectedFormat === 'identification'}
            disabled={!source || !!busyType}
          />
          <GenerateOption
            icon="assignment"
            label="Mock Exam"
            width={optionWidth}
            onPress={() => selectFormat('mock_exam')}
            loading={busyType === 'mock_exam'}
            selected={selectedFormat === 'mock_exam'}
            disabled={!source || !!busyType}
          />
        </View>

        {!!generationError && (
          <AppCard style={styles.generationErrorCard}>
            <Text style={styles.errorText}>{generationError}</Text>
            <Pressable onPress={() => selectedFormat && void onGenerate(selectedFormat)} disabled={!source || !!busyType}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </AppCard>
        )}

        {busyType ? (
          <AppCard style={styles.generatingCard}>
            <ActivityIndicator color={PURPLE} />
            <View style={styles.generatingCopy}>
              <Text style={styles.generatingTitle}>Reading file and creating {busyType.replace('_', ' ')}...</Text>
              <Text style={styles.helperText}>This can take a little while for larger files.</Text>
            </View>
            <Pressable onPress={cancelGeneration} accessibilityRole="button" style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </AppCard>
        ) : (
          <Pressable
            onPress={() => selectedFormat && void onGenerate(selectedFormat)}
            disabled={!source || !selectedFormat || uploading}
            accessibilityRole="button"
            style={[styles.generateButton, (!source || !selectedFormat || uploading) && styles.generateButtonDisabled]}
          >
            <Ionicons name="sparkles-outline" size={18} color="#fff" />
            <Text style={styles.generateButtonText}>
              {selectedFormat ? `Generate ${selectedFormat.replace('_', ' ')}` : 'Select a study format'}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FileType({
  icon,
  label,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.fileType}>
      <MaterialIcons name={icon} size={13} color={PURPLE} />
      <Text style={styles.fileTypeText}>{label}</Text>
    </View>
  );
}

function GenerateOption({
  icon,
  label,
  width,
  onPress,
  loading,
  selected,
  disabled,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  width: '31.5%' | '48%';
  onPress: () => void;
  loading: boolean;
  selected: boolean;
  disabled: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.optionCard,
        { width },
        selected && styles.optionCardSelected,
        disabled && styles.optionCardDisabled,
        pressed && styles.pressed,
        loading && styles.optionDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={PURPLE} />
      ) : (
        <>
          <View style={styles.optionIcon}>
            <MaterialIcons name={icon} size={21} color={PURPLE} />
          </View>
          <Text style={styles.optionLabel}>{label}</Text>
        </>
      )}
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
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  uploadCard: {
    padding: 14,
    borderRadius: radius.md,
  },
  imagePreview: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#F2EAFE',
  },
  sourceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  sourceReady: {
    flex: 1,
    color: colors.success,
    fontSize: 10,
  },
  previewButton: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
  },
  previewText: {
    color: PURPLE,
    fontSize: 10,
    fontWeight: '700',
  },
  removeText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 12,
  },
  questionCountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: radius.md,
  },
  questionCountCopy: {
    flex: 1,
  },
  stepperButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2EAFE',
  },
  questionCount: {
    minWidth: 24,
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  generationErrorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderColor: '#F1C9CE',
  },
  retryText: {
    color: PURPLE,
    fontWeight: '700',
    fontSize: 12,
  },
  generatingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 13,
    borderRadius: radius.md,
  },
  generatingCopy: {
    flex: 1,
  },
  generatingTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  cancelButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  cancelText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 11,
  },
  generateButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.md,
    backgroundColor: PURPLE,
  },
  generateButtonDisabled: {
    opacity: 0.45,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'capitalize',
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
  helperText: {
    color: colors.mutedText,
    fontSize: 11,
    marginTop: 3,
  },
  fileTypesRow: {
    flexDirection: 'row',
    gap: 4,
  },
  fileType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#F2EAFE',
  },
  fileTypeText: {
    color: colors.text,
    fontSize: 8,
    fontWeight: '700',
  },
  uploadArea: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 10,
    marginTop: 13,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  uploadIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#F2EAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadCopy: {
    flex: 1,
    minWidth: 0,
  },
  uploadText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  uploadedText: {
    color: colors.mutedText,
    fontSize: 10,
    marginTop: 3,
  },
  formatHeading: {
    marginTop: 3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  optionCard: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionCardSelected: {
    borderColor: PURPLE,
    backgroundColor: '#F8F3FF',
  },
  optionCardDisabled: {
    opacity: 0.48,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2EAFE',
  },
  optionLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  optionDisabled: {
    opacity: 0.7,
  },
  pressed: {
    opacity: 0.75,
  },
});
