import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { AppCard } from '../../components/AppCard';
import { colors, radius } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { aiService } from '../../services/aiService';
import { appService } from '../../services/appService';
import {
  GeneratedContent,
  IdentificationQuestion,
  MultipleChoiceQuestion,
  StudyFormat,
  StudyPayload,
  StudyQuestion,
  StudySessionState,
  TrueFalseQuestion,
} from '../../types';

const PURPLE = '#9D5CF8';
const emptySession: StudySessionState = {
  answers: {},
  revealed: {},
  knownCardIndexes: [],
  shuffleOrder: [],
  currentIndex: 0,
  examStartedAt: null,
  examSubmitted: false,
};

function parsePayload(content: string): StudyPayload | null {
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' && typeof parsed.kind === 'string'
      ? parsed as StudyPayload
      : null;
  } catch {
    return null;
  }
}

function createRequestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function normalizeAnswer(answer: string) {
  return answer.toLowerCase().trim().replace(/[^a-z0-9]+/g, ' ');
}

function questionIsCorrect(question: StudyQuestion, answer: string | number | boolean | undefined) {
  if (question.kind === 'mcq') return answer === question.answerIndex;
  if (question.kind === 'true_false') return answer === question.answer;
  if (typeof answer !== 'string') return false;
  const accepted = [question.answer, ...question.acceptedAnswers].map(normalizeAnswer);
  return accepted.includes(normalizeAnswer(answer));
}

function toReadableText(payload: StudyPayload | null, fallback: string) {
  if (!payload) return fallback;
  if (payload.kind === 'summary') {
    return [
      payload.title,
      ...payload.sections.flatMap((section) => [section.heading, section.content, ...section.keyConcepts]),
      'Key takeaways',
      ...payload.keyTakeaways,
    ].join('\n\n');
  }
  if (payload.kind === 'flashcards') {
    return payload.cards.map((card, index) => `${index + 1}. ${card.front}\n${card.back}`).join('\n\n');
  }
  return payload.questions.map((question, index) => {
    const options = question.kind === 'mcq' ? `\n${question.options.join('\n')}` : '';
    const answer = question.kind === 'mcq'
      ? question.options[question.answerIndex]
      : question.kind === 'true_false'
        ? String(question.answer)
        : question.answer;
    return `${index + 1}. ${question.prompt}${options}\nAnswer: ${answer}\n${question.explanation}`;
  }).join('\n\n');
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const remainingSeconds = Math.max(0, seconds) % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function StudyResultScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const materialId = route?.params?.id as string | undefined;
  const [material, setMaterial] = useState<GeneratedContent | null>(null);
  const [payload, setPayload] = useState<StudyPayload | null>(null);
  const [session, setSession] = useState<StudySessionState>(emptySession);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const flipValue = useRef(new Animated.Value(0)).current;
  const sessionRef = useRef(session);
  const stateWriteQueue = useRef(Promise.resolve());
  sessionRef.current = session;

  const loadMaterial = useCallback(async () => {
    if (!user?.id || !materialId) {
      setLoading(false);
      setError('This saved material could not be found.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const saved = await appService.getGeneratedContent(user.id, materialId);
      if (!saved) {
        setMaterial(null);
        setError('This material is not available in your Library.');
        return;
      }
      setMaterial(saved);
      setPayload(parsePayload(saved.content));
      setSession({ ...emptySession, ...(saved.study_state || {}) });
      setCurrentIndex(saved.study_state?.currentIndex || 0);
      setFlipped(false);
      flipValue.setValue(0);
      stateWriteQueue.current = Promise.resolve();
    } catch (loadError: any) {
      setError(loadError?.message || 'Unable to open this saved material.');
    } finally {
      setLoading(false);
    }
  }, [materialId, user?.id]);

  useFocusEffect(useCallback(() => {
    void loadMaterial();
  }, [loadMaterial]));

  const persistSession = (next: StudySessionState) => {
    sessionRef.current = next;
    setSession(next);
    setSaveError('');
    if (!user?.id || !material) return;
    stateWriteQueue.current = stateWriteQueue.current
      .then(() => appService.updateStudySessionState(user.id, material.id, next))
      .catch((stateError: any) => {
        setSaveError(stateError?.message || 'Progress could not be saved.');
      });
  };

  const quizQuestions = payload && payload.kind !== 'summary' && payload.kind !== 'flashcards'
    ? payload.questions
    : [];
  const question = quizQuestions[currentIndex];
  const quizScore = quizQuestions.reduce((score, item, index) => (
    score + (questionIsCorrect(item, session.answers[String(index)]) ? 1 : 0)
  ), 0);
  const readableText = useMemo(
    () => toReadableText(payload, material?.content || ''),
    [material?.content, payload]
  );

  useEffect(() => {
    if (payload?.kind !== 'mock_exam' || !session.examStartedAt || session.examSubmitted) return;
    const duration = payload.questions.length * 90;
    const startedAt = new Date(session.examStartedAt).getTime();
    const updateRemaining = () => {
      const remaining = Math.max(0, duration - Math.floor((Date.now() - startedAt) / 1000));
      setRemainingSeconds(remaining);
      if (remaining === 0) {
        persistSession({ ...sessionRef.current, examSubmitted: true });
      }
    };
    updateRemaining();
    const timer = setInterval(updateRemaining, 1000);
    return () => clearInterval(timer);
  }, [payload, session.examStartedAt, session.examSubmitted]);

  const submitExam = (force = false) => {
    if (!payload || payload.kind !== 'mock_exam' || session.examSubmitted) return;
    const unanswered = payload.questions.reduce((count, _, index) => {
      const answer = session.answers[String(index)];
      return count + (answer === undefined || answer === '' ? 1 : 0);
    }, 0);
    const finalize = () => {
      const revealed = Object.fromEntries(payload.questions.map((_, index) => [String(index), true]));
      persistSession({ ...session, revealed, examSubmitted: true });
    };
    if (unanswered > 0 && !force) {
      Alert.alert(
        'Unanswered questions',
        `${unanswered} questions are unanswered. Submit the exam anyway?`,
        [
          { text: 'Keep working', style: 'cancel' },
          { text: 'Submit exam', style: 'destructive', onPress: finalize },
        ]
      );
      return;
    }
    finalize();
  };

  const saveAnswer = (index: number, answer: string | number | boolean) => {
    persistSession({ ...session, answers: { ...session.answers, [String(index)]: answer } });
  };

  const checkAnswer = (index: number) => {
    persistSession({ ...session, revealed: { ...session.revealed, [String(index)]: true } });
  };

  const startExam = () => {
    persistSession({ ...session, examStartedAt: new Date().toISOString(), examSubmitted: false });
  };

  const moveToQuestion = (index: number) => {
    setCurrentIndex(index);
    persistSession({ ...sessionRef.current, currentIndex: index });
  };

  const moveFlashcard = (delta: number) => {
    if (!payload || payload.kind !== 'flashcards') return;
    const order = sessionRef.current.shuffleOrder.length === payload.cards.length
      ? sessionRef.current.shuffleOrder
      : payload.cards.map((_, index) => index);
    const nextIndex = Math.min(order.length - 1, Math.max(0, currentIndex + delta));
    setCurrentIndex(nextIndex);
    persistSession({ ...sessionRef.current, currentIndex: nextIndex });
    setFlipped(false);
    flipValue.setValue(0);
  };

  const shuffleCards = () => {
    if (!payload || payload.kind !== 'flashcards') return;
    const order = payload.cards.map((_, index) => index);
    for (let index = order.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
    }
    persistSession({ ...session, shuffleOrder: order, currentIndex: 0 });
    setCurrentIndex(0);
    setFlipped(false);
  };

  const flipCard = () => {
    const nextFlipped = !flipped;
    setFlipped(nextFlipped);
    Animated.spring(flipValue, {
      toValue: nextFlipped ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
    }).start();
  };

  const moveCard = (delta: number) => {
    if (!payload || payload.kind !== 'flashcards') return;
    const order = session.shuffleOrder.length === payload.cards.length
      ? session.shuffleOrder
      : payload.cards.map((_, index) => index);
    setCurrentIndex((index) => Math.min(order.length - 1, Math.max(0, index + delta)));
    setFlipped(false);
    flipValue.setValue(0);
  };

  const copyMaterial = async () => {
    try {
      await Clipboard.setStringAsync(readableText);
      Alert.alert('Copied', 'Study material copied to the clipboard.');
    } catch (copyError: any) {
      Alert.alert('Copy failed', copyError?.message || 'Clipboard access is unavailable.');
    }
  };

  const shareMaterial = async () => {
    try {
      await Share.share({ title: material?.title || 'Study material', message: readableText });
    } catch (shareError: any) {
      Alert.alert('Share failed', shareError?.message || 'Unable to share this material.');
    }
  };

  const renameMaterial = async () => {
    if (!material || !user?.id || !renameValue.trim()) return;
    try {
      const renamed = await appService.renameGeneratedContent(user.id, material.id, renameValue);
      setMaterial(renamed);
      setRenameVisible(false);
    } catch (renameError: any) {
      setSaveError(renameError?.message || 'Could not rename this material.');
    }
  };

  const deleteMaterial = () => {
    if (!material || !user?.id) return;
    Alert.alert('Delete saved material?', `"${material.title}" will be permanently removed from your Library.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await appService.deleteGeneratedContent(material.id, user.id);
            navigation.navigate('Tabs', { screen: 'Library' });
          } catch (deleteError: any) {
            setSaveError(deleteError?.message || 'Could not delete this material.');
          }
        },
      },
    ]);
  };

  const regenerate = async () => {
    if (!material?.file_id || !material.format || !user?.id) {
      setSaveError('The source upload is unavailable, so this material cannot be regenerated.');
      return;
    }
    const controller = new AbortController();
    setBusy(true);
    setSaveError('');
    try {
      const count = payload && payload.kind !== 'summary' && payload.kind !== 'flashcards'
        ? payload.questions.length
        : 10;
      const freshPayload = await aiService.generate(material.format, material.file_id, count, controller.signal);
      const saved = await appService.saveGeneratedContent(
        user.id,
        material.format,
        `${material.format.replace('_', ' ')} - ${new Date().toLocaleDateString()}`,
        freshPayload,
        material.file_id,
        material.source_file_name || 'Study file',
        createRequestId()
      );
      navigation.replace('StudyResult', { id: saved.id });
    } catch (regenerateError: any) {
      setSaveError(regenerateError?.message || 'Regeneration failed.');
    } finally {
      setBusy(false);
    }
  };

  const displayFormat = material?.format || material?.type || 'summary';
  const headerTitle = material?.title || 'Study material';
  const timerText = formatDuration(remainingSeconds);
  const currentAnswer = question ? session.answers[String(currentIndex)] : undefined;
  const isAnswered = currentAnswer !== undefined && currentAnswer !== '';
  const isRevealed = !!session.revealed[String(currentIndex)];

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable onPress={() => navigation.goBack()} style={styles.headerButton} accessibilityLabel="Go back">
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>{String(displayFormat).replace('_', ' ').toUpperCase()}</Text>
              <Text numberOfLines={2} style={styles.title}>{headerTitle}</Text>
              {!!material?.source_file_name && (
                <Text numberOfLines={1} style={styles.subtitle}>Source: {material.source_file_name}</Text>
              )}
            </View>
            <Pressable onPress={() => { setRenameValue(material?.title || ''); setRenameVisible(true); }} style={styles.headerButton} accessibilityLabel="Rename material">
              <Ionicons name="pencil-outline" size={18} color={PURPLE} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={PURPLE} size="large" />
              <Text style={styles.helperText}>Opening your saved material...</Text>
            </View>
          ) : error ? (
            <AppCard style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={() => void loadMaterial()}><Text style={styles.linkText}>Retry</Text></Pressable>
            </AppCard>
          ) : payload ? (
            <>
              {payload.kind === 'summary' && (
                <>
                  <AppCard style={styles.takeawayCard}>
                    <Text style={styles.sectionTitle}>Key takeaways</Text>
                    {payload.keyTakeaways.map((item, index) => (
                      <View key={`${index}-${item}`} style={styles.takeawayRow}>
                        <View style={styles.bullet} />
                        <Text style={styles.bodyText}>{item}</Text>
                      </View>
                    ))}
                  </AppCard>
                  {payload.sections.map((section, index) => {
                    const expanded = expandedSections[String(index)] ?? true;
                    return (
                      <AppCard key={`${index}-${section.heading}`} style={styles.sectionCard}>
                        <Pressable
                          onPress={() => setExpandedSections((current) => ({ ...current, [String(index)]: !expanded }))}
                          style={styles.expandHeader}
                          accessibilityRole="button"
                          accessibilityState={{ expanded }}
                        >
                          <Text style={styles.sectionTitle}>{section.heading}</Text>
                          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={PURPLE} />
                        </Pressable>
                        {expanded && (
                          <>
                            <Text selectable style={styles.bodyText}>{section.content}</Text>
                            {!!section.keyConcepts.length && (
                              <View style={styles.conceptsWrap}>
                                {section.keyConcepts.map((concept) => <Text key={concept} style={styles.concept}>{concept}</Text>)}
                              </View>
                            )}
                          </>
                        )}
                      </AppCard>
                    );
                  })}
                </>
              )}

              {payload.kind === 'flashcards' && (
                <FlashcardRunner
                  cards={payload.cards}
                  currentIndex={currentIndex}
                  flipped={flipped}
                  flipValue={flipValue}
                  onFlip={flipCard}
                  onMove={moveFlashcard}
                  onShuffle={shuffleCards}
                  shuffleOrder={session.shuffleOrder}
                  knownIndexes={session.knownCardIndexes}
                  onMark={(known) => {
                    const cardIndex = (session.shuffleOrder.length === payload.cards.length
                      ? session.shuffleOrder
                      : payload.cards.map((_, index) => index))[currentIndex];
                    const next = new Set(session.knownCardIndexes);
                    if (known) next.add(cardIndex); else next.delete(cardIndex);
                    persistSession({ ...session, knownCardIndexes: Array.from(next) });
                  }}
                />
              )}

              {(payload.kind === 'mcq' || payload.kind === 'true_false' || payload.kind === 'identification') && (
                <QuizRunner
                  kind={payload.kind}
                  questions={payload.questions}
                  index={currentIndex}
                  answer={currentAnswer}
                  revealed={isRevealed}
                  score={quizScore}
                  onAnswer={(answer) => saveAnswer(currentIndex, answer)}
                  onCheck={() => checkAnswer(currentIndex)}
                  onPrevious={() => moveToQuestion(Math.max(0, currentIndex - 1))}
                  onNext={() => moveToQuestion(Math.min(payload.questions.length - 1, currentIndex + 1))}
                  onCopy={() => void copyMaterial()}
                />
              )}

              {payload.kind === 'mock_exam' && (
                <MockExamRunner
                  questions={payload.questions}
                  session={session}
                  index={currentIndex}
                  remainingSeconds={remainingSeconds}
                  onStart={startExam}
                  onAnswer={(answer) => saveAnswer(currentIndex, answer)}
                  onPrevious={() => moveToQuestion(Math.max(0, currentIndex - 1))}
                  onNext={() => moveToQuestion(Math.min(payload.questions.length - 1, currentIndex + 1))}
                  onSubmit={() => submitExam()}
                  onCopy={() => void copyMaterial()}
                  score={quizScore}
                />
              )}
              <ResultActions
                onShare={() => void shareMaterial()}
                onCopy={() => void copyMaterial()}
                onRegenerate={() => void regenerate()}
                onDelete={deleteMaterial}
                busy={busy}
              />
            </>
          ) : (
            <AppCard style={styles.errorCard}>
              <Text style={styles.bodyText}>This older material is available as plain text.</Text>
              <Text selectable style={styles.legacyText}>{material?.content}</Text>
              <ResultActions onShare={() => void shareMaterial()} onCopy={() => void copyMaterial()} onRegenerate={() => void regenerate()} onDelete={deleteMaterial} busy={busy} />
            </AppCard>
          )}

          {!!saveError && <Text style={styles.saveError}>{saveError}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal transparent visible={renameVisible} animationType="fade" onRequestClose={() => setRenameVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Rename material</Text>
            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              style={styles.renameInput}
              placeholder="Material title"
              placeholderTextColor={colors.mutedText}
              maxLength={100}
              returnKeyType="done"
              onSubmitEditing={() => void renameMaterial()}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setRenameVisible(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable onPress={() => void renameMaterial()} disabled={!renameValue.trim()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Save name</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  disabled = false,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={styles.actionButton} accessibilityRole="button">
      <Ionicons name={icon} size={17} color={danger ? colors.danger : PURPLE} />
      <Text style={[styles.actionLabel, danger && styles.dangerText]}>{label}</Text>
    </Pressable>
  );
}

function ResultActions({
  onShare,
  onCopy,
  onRegenerate,
  onDelete,
  busy,
}: {
  onShare: () => void;
  onCopy: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <View style={styles.actionsRow}>
      <ActionButton icon="copy-outline" label="Copy" onPress={onCopy} />
      <ActionButton icon="share-outline" label="Share" onPress={onShare} />
      <ActionButton icon="refresh-outline" label="Regenerate" onPress={onRegenerate} disabled={busy} />
      <ActionButton icon="trash-outline" label="Delete" onPress={onDelete} danger />
    </View>
  );
}

function FlashcardRunner({
  cards,
  currentIndex,
  flipped,
  flipValue,
  onFlip,
  onMove,
  onShuffle,
  shuffleOrder,
  knownIndexes,
  onMark,
}: {
  cards: { front: string; back: string }[];
  currentIndex: number;
  flipped: boolean;
  flipValue: Animated.Value;
  onFlip: () => void;
  onMove: (delta: number) => void;
  onShuffle: () => void;
  shuffleOrder: number[];
  knownIndexes: number[];
  onMark: (known: boolean) => void;
}) {
  const order = shuffleOrder.length === cards.length
    ? shuffleOrder
    : cards.map((_, index) => index);
  const cardIndex = order[currentIndex];
  const card = cards[cardIndex];
  const rotation = flipValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const faceRotation = flipValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  if (!card) return <EmptyResult message="No flashcards are available in this material." />;

  return (
    <>
      <AppCard style={styles.flashcardTools}>
        <Text style={styles.helperText}>{currentIndex + 1} of {cards.length} | {knownIndexes.length} mastered</Text>
        <Pressable onPress={onShuffle} accessibilityRole="button" style={styles.inlineAction}>
          <Ionicons name="shuffle-outline" size={17} color={PURPLE} />
          <Text style={styles.linkText}>Shuffle</Text>
        </Pressable>
      </AppCard>
      <Pressable onPress={onFlip} accessibilityRole="button" accessibilityLabel={flipped ? 'Show question' : 'Flip to answer'}>
        <Animated.View style={[styles.flashcard, { transform: [{ perspective: 900 }, { rotateY: rotation }] }]}>
          <Animated.Text selectable style={[styles.flashcardFace, { transform: [{ rotateY: faceRotation }] }]}>
            {flipped ? card.back : card.front}
          </Animated.Text>
          <Text style={styles.flipHint}>Tap card to {flipped ? 'see question' : 'reveal answer'}</Text>
        </Animated.View>
      </Pressable>
      <View style={styles.flashcardControls}>
        <Pressable onPress={() => onMove(-1)} disabled={currentIndex === 0} style={styles.navButton} accessibilityLabel="Previous card">
          <Ionicons name="chevron-back" size={20} color={PURPLE} />
        </Pressable>
        <Pressable onPress={() => onMark(false)} style={[styles.masteryButton, styles.unknownButton]}>
          <Ionicons name="close" size={17} color={colors.danger} />
          <Text style={styles.dangerText}>Unknown</Text>
        </Pressable>
        <Pressable onPress={() => onMark(true)} style={[styles.masteryButton, styles.knownButton]}>
          <Ionicons name="checkmark" size={17} color={colors.success} />
          <Text style={styles.knownText}>Known</Text>
        </Pressable>
        <Pressable onPress={() => onMove(1)} disabled={currentIndex >= cards.length - 1} style={styles.navButton} accessibilityLabel="Next card">
          <Ionicons name="chevron-forward" size={20} color={PURPLE} />
        </Pressable>
      </View>
      <Text style={styles.helperText}>Card order: {order.length}. Mastery is saved to your Library.</Text>
    </>
  );
}

function EmptyResult({ message }: { message: string }) {
  return <AppCard><Text style={styles.bodyText}>{message}</Text></AppCard>;
}

function QuizRunner({
  kind,
  questions,
  index,
  answer,
  revealed,
  score,
  onAnswer,
  onCheck,
  onPrevious,
  onNext,
  onCopy,
}: {
  kind: 'mcq' | 'true_false' | 'identification';
  questions: (MultipleChoiceQuestion | TrueFalseQuestion | IdentificationQuestion)[];
  index: number;
  answer: string | number | boolean | undefined;
  revealed: boolean;
  score: number;
  onAnswer: (answer: string | number | boolean) => void;
  onCheck: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onCopy: () => void;
}) {
  const question = questions[index];
  if (!question) return <EmptyResult message="No questions are available in this material." />;
  const correct = questionIsCorrect(question, answer);

  return (
    <>
      <AppCard style={styles.quizMeta}>
        <Text style={styles.helperText}>Question {index + 1} of {questions.length}</Text>
        <Text style={styles.scoreText}>Score {score}/{questions.length}</Text>
      </AppCard>
      <AppCard style={styles.questionCard}>
        <Text style={styles.questionText}>{question.prompt}</Text>
        {question.kind === 'mcq' && question.options.map((option, optionIndex) => {
          const isSelected = answer === optionIndex;
          const isCorrectOption = question.answerIndex === optionIndex;
          return (
            <Pressable
              key={`${optionIndex}-${option}`}
              onPress={() => onAnswer(optionIndex)}
              style={[
                styles.answerOption,
                isSelected && styles.answerSelected,
                revealed && isCorrectOption && styles.answerCorrect,
                revealed && isSelected && !isCorrectOption && styles.answerWrong,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={styles.optionLetter}>{String.fromCharCode(65 + optionIndex)}</Text>
              <Text style={styles.answerText}>{option}</Text>
            </Pressable>
          );
        })}
        {question.kind === 'true_false' && (
          <View style={styles.trueFalseRow}>
            {[true, false].map((value) => (
              <Pressable
                key={String(value)}
                onPress={() => onAnswer(value)}
                style={[styles.answerOption, styles.booleanOption, answer === value && styles.answerSelected, revealed && value === question.answer && styles.answerCorrect]}
              >
                <Text style={styles.answerText}>{value ? 'True' : 'False'}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {question.kind === 'identification' && (
          <TextInput
            value={typeof answer === 'string' ? answer : ''}
            onChangeText={onAnswer}
            editable={!revealed}
            placeholder="Type your answer"
            placeholderTextColor={colors.mutedText}
            style={styles.answerInput}
            returnKeyType="done"
          />
        )}
        {revealed && (
          <View style={[styles.feedbackBox, correct ? styles.feedbackCorrect : styles.feedbackWrong]}>
            <Text style={styles.feedbackTitle}>{correct ? 'Correct' : 'Review this answer'}</Text>
            {question.kind === 'mcq' && <Text style={styles.feedbackAnswer}>Answer: {question.options[question.answerIndex]}</Text>}
            {question.kind === 'true_false' && <Text style={styles.feedbackAnswer}>Answer: {question.answer ? 'True' : 'False'}</Text>}
            {question.kind === 'identification' && <Text style={styles.feedbackAnswer}>Answer: {question.answer}</Text>}
            <Text style={styles.feedbackExplanation}>{question.explanation}</Text>
          </View>
        )}
        {!revealed && (
          <Pressable onPress={onCheck} disabled={answer === undefined || answer === ''} style={[styles.checkButton, (answer === undefined || answer === '') && styles.disabledButton]}>
            <Text style={styles.checkButtonText}>Check answer</Text>
          </Pressable>
        )}
      </AppCard>
      <View style={styles.questionNavigation}>
        <Pressable onPress={onPrevious} disabled={index === 0} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Previous</Text>
        </Pressable>
        <Pressable onPress={onNext} disabled={index >= questions.length - 1} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{index >= questions.length - 1 ? 'Finished' : 'Next'}</Text>
        </Pressable>
      </View>
    </>
  );
}

function MockExamRunner({
  questions,
  session,
  index,
  remainingSeconds,
  onStart,
  onAnswer,
  onPrevious,
  onNext,
  onSubmit,
  onCopy,
  score,
}: {
  questions: StudyQuestion[];
  session: StudySessionState;
  index: number;
  remainingSeconds: number;
  onStart: () => void;
  onAnswer: (answer: string | number | boolean) => void;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
  onCopy: () => void;
  score: number;
}) {
  const question = questions[index];
  const answer = session.answers[String(index)];
  const unansweredCount = questions.length - Object.keys(session.answers).length;
  const complete = !!session.examSubmitted;

  if (!session.examStartedAt && !complete) {
    return (
      <AppCard style={styles.examStartCard}>
        <View style={styles.metricIcon}><Ionicons name="time-outline" size={20} color={PURPLE} /></View>
        <Text style={styles.sectionTitle}>Ready to begin?</Text>
        <Text style={styles.bodyText}>{questions.length} questions | {Math.ceil(questions.length * 1.5)} minutes</Text>
        <Pressable onPress={onStart} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Start exam</Text></Pressable>
      </AppCard>
    );
  }

  if (!question) return <EmptyResult message="This exam contains no questions." />;

  return (
    <>
      <AppCard style={styles.examMeta}>
        <View>
          <Text style={styles.helperText}>Question {index + 1} of {questions.length}</Text>
          <Text style={styles.scoreText}>{Object.keys(session.answers).length} answered</Text>
        </View>
        {complete ? (
          <Text style={styles.examScore}>{score}/{questions.length}</Text>
        ) : (
          <View style={[styles.timerBadge, remainingSeconds < 60 && styles.timerWarning]}>
            <Ionicons name="time-outline" size={15} color={remainingSeconds < 60 ? colors.danger : PURPLE} />
            <Text style={[styles.timerText, remainingSeconds < 60 && styles.dangerText]}>{formatDuration(remainingSeconds)}</Text>
          </View>
        )}
      </AppCard>

      <View style={styles.examProgressTrack}>
        <View style={[styles.examProgressFill, { width: `${((index + 1) / questions.length) * 100}%` }]} />
      </View>

      {complete ? (
        <AppCard style={styles.reviewCard}>
          <Text style={styles.feedbackTitle}>{questionIsCorrect(question, answer) ? 'Correct' : 'Review answer'}</Text>
          <Text style={styles.questionText}>{question.prompt}</Text>
          <Text style={styles.feedbackAnswer}>Correct: {question.kind === 'mcq' ? question.options[question.answerIndex] : question.kind === 'true_false' ? String(question.answer) : question.answer}</Text>
          {question.kind === 'mcq' && question.options.map((option, optionIndex) => (
            <Text key={optionIndex} style={styles.reviewOption}>{String.fromCharCode(65 + optionIndex)}. {option}</Text>
          ))}
          <Text style={styles.feedbackExplanation}>{question.explanation}</Text>
        </AppCard>
      ) : (
        <ExamQuestion
          question={question}
          answer={answer}
          onAnswer={onAnswer}
        />
      )}

      <View style={styles.questionNavigation}>
        <Pressable onPress={onPrevious} disabled={index === 0} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Previous</Text></Pressable>
        {index < questions.length - 1 ? (
          <Pressable onPress={onNext} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Next</Text></Pressable>
        ) : complete ? (
          <Text style={styles.examScore}>{score}/{questions.length}</Text>
        ) : (
          <Pressable onPress={onSubmit} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Submit exam</Text></Pressable>
        )}
      </View>
      {!complete && unansweredCount > 0 && <Text style={styles.unansweredText}>{unansweredCount} unanswered</Text>}
      {complete && <Text style={styles.examScoreLine}>Final score: {score} of {questions.length} ({Math.round(score / questions.length * 100)}%)</Text>}
    </>
  );
}

function ExamQuestion({
  question,
  answer,
  onAnswer,
}: {
  question: StudyQuestion;
  answer: string | number | boolean | undefined;
  onAnswer: (answer: string | number | boolean) => void;
}) {
  return (
    <AppCard style={styles.questionCard}>
      <Text style={styles.questionText}>{question.prompt}</Text>
      {question.kind === 'mcq' && question.options.map((option, optionIndex) => (
        <Pressable key={optionIndex} onPress={() => onAnswer(optionIndex)} style={[styles.answerOption, answer === optionIndex && styles.answerSelected]}>
          <Text style={styles.optionLetter}>{String.fromCharCode(65 + optionIndex)}</Text>
          <Text style={styles.answerText}>{option}</Text>
        </Pressable>
      ))}
      {question.kind === 'true_false' && (
        <View style={styles.trueFalseRow}>
          {[true, false].map((value) => <Pressable key={String(value)} onPress={() => onAnswer(value)} style={[styles.answerOption, styles.booleanOption, answer === value && styles.answerSelected]}><Text style={styles.answerText}>{value ? 'True' : 'False'}</Text></Pressable>)}
        </View>
      )}
      {question.kind === 'identification' && <TextInput value={typeof answer === 'string' ? answer : ''} onChangeText={onAnswer} placeholder="Type your answer" placeholderTextColor={colors.mutedText} style={styles.answerInput} />}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: { flex: 1 },
  page: {
    padding: 18,
    paddingBottom: 36,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 5,
  },
  headerButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: PURPLE, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 2 },
  subtitle: { color: colors.mutedText, fontSize: 10, marginTop: 3 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 36,
    paddingHorizontal: 9,
    borderRadius: 9,
    backgroundColor: '#F2EAFE',
  },
  actionLabel: { color: PURPLE, fontSize: 10, fontWeight: '700' },
  dangerText: { color: colors.danger },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  helperText: { color: colors.mutedText, fontSize: 11, marginTop: 3 },
  bodyText: { color: colors.text, fontSize: 13, lineHeight: 21, marginTop: 10 },
  takeawayCard: { padding: 15, borderRadius: radius.md },
  takeawayRow: { flexDirection: 'row', gap: 9, marginTop: 8 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: PURPLE, marginTop: 7 },
  sectionCard: { padding: 15, borderRadius: radius.md },
  expandHeader: { minHeight: 32, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  conceptsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  concept: { color: PURPLE, backgroundColor: '#F2EAFE', overflow: 'hidden', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, fontSize: 10, fontWeight: '600' },
  loadingState: { minHeight: 180, justifyContent: 'center', alignItems: 'center', gap: 10 },
  errorCard: { gap: 12, borderColor: '#F1C9CE' },
  errorText: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  linkText: { color: PURPLE, fontSize: 12, fontWeight: '700' },
  saveError: { color: colors.danger, fontSize: 11 },
  legacyText: { color: colors.text, fontSize: 13, lineHeight: 21, marginTop: 12 },
  quizMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: radius.md },
  scoreText: { color: PURPLE, fontSize: 11, fontWeight: '700' },
  questionCard: { padding: 15, borderRadius: radius.md },
  questionText: { color: colors.text, fontSize: 16, fontWeight: '700', lineHeight: 23, marginBottom: 12 },
  answerOption: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10, marginTop: 7, backgroundColor: '#FAF8FC', borderWidth: 1, borderColor: colors.border, borderRadius: 10 },
  answerSelected: { borderColor: PURPLE, backgroundColor: '#F5EEFF' },
  answerCorrect: { borderColor: colors.success, backgroundColor: '#EAF7EF' },
  answerWrong: { borderColor: colors.danger, backgroundColor: '#FCEDEF' },
  optionLetter: { color: PURPLE, fontWeight: '800', fontSize: 12 },
  answerText: { flex: 1, color: colors.text, fontSize: 12, lineHeight: 18 },
  trueFalseRow: { flexDirection: 'row', gap: 8 },
  booleanOption: { flex: 1, justifyContent: 'center' },
  answerInput: { minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 12, color: colors.text, fontSize: 13, marginTop: 8 },
  checkButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: PURPLE, borderRadius: 9, marginTop: 14 },
  checkButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  disabledButton: { opacity: 0.5 },
  feedbackBox: { padding: 11, borderRadius: 9, marginTop: 13 },
  feedbackCorrect: { backgroundColor: '#EAF7EF' },
  feedbackWrong: { backgroundColor: '#FCEDEF' },
  feedbackTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  feedbackAnswer: { color: colors.text, fontSize: 12, fontWeight: '700', marginTop: 5 },
  feedbackExplanation: { color: colors.text, fontSize: 12, lineHeight: 18, marginTop: 5 },
  questionNavigation: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  primaryButton: { minHeight: 42, minWidth: 105, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, borderRadius: 9, backgroundColor: PURPLE },
  primaryButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  secondaryButton: { minHeight: 42, minWidth: 105, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  secondaryButtonText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  flashcardTools: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: radius.md },
  inlineAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  flashcard: { minHeight: 260, justifyContent: 'center', alignItems: 'center', padding: 26, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  flashcardFace: { color: colors.text, textAlign: 'center', fontSize: 21, lineHeight: 30, fontWeight: '700' },
  flipHint: { position: 'absolute', bottom: 14, color: colors.mutedText, fontSize: 10 },
  flashcardControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  navButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#F2EAFE' },
  masteryButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 8, borderRadius: 9 },
  unknownButton: { backgroundColor: '#FCEDEF' },
  knownButton: { backgroundColor: '#EAF7EF' },
  knownText: { color: colors.success, fontSize: 10, fontWeight: '700' },
  examStartCard: { alignItems: 'flex-start', gap: 10, padding: 16, borderRadius: radius.md },
  metricIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#F2EAFE' },
  examMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: radius.md },
  timerBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#F2EAFE', borderRadius: 8 },
  timerWarning: { backgroundColor: '#FCEDEF' },
  timerText: { color: PURPLE, fontSize: 12, fontWeight: '800' },
  examScore: { color: PURPLE, fontSize: 19, fontWeight: '800' },
  examProgressTrack: { height: 7, overflow: 'hidden', borderRadius: 5, backgroundColor: '#EAE4F1' },
  examProgressFill: { height: '100%', backgroundColor: PURPLE },
  reviewCard: { padding: 15, borderRadius: radius.md },
  reviewOption: { color: colors.text, fontSize: 12, marginTop: 5 },
  unansweredText: { color: colors.danger, fontSize: 11, textAlign: 'right' },
  examScoreLine: { color: colors.text, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(23,20,35,0.42)' },
  modalCard: { padding: 18, borderRadius: radius.md, backgroundColor: colors.surface, gap: 12 },
  renameInput: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 12, color: colors.text },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10 },
  cancelButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12 },
  cancelText: { color: colors.mutedText, fontSize: 12, fontWeight: '700' },
  dangerButton: { backgroundColor: colors.danger },
});
