import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenLayout } from '../../components/ScreenLayout';
import { AppCard } from '../../components/AppCard';
import { useAuth } from '../../hooks/useAuth';
import { appService } from '../../services/appService';
import { colors } from '../../constants/theme';

export function MCQScreen() {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        if (!user?.id) return;
        setLoading(true);
        const latest = await appService.getLatestByType(user.id, 'mcq');
        setContent(latest?.content || '');
        setLoading(false);
      };
      load();
    }, [user?.id])
  );

  return (
    <ScreenLayout title="MCQ Quiz" subtitle="Practice with your latest MCQ set">
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {!loading && !content ? <AppCard><Text style={styles.empty}>No MCQ yet. Generate one from the Generate tab.</Text></AppCard> : null}
      {!!content && <AppCard><Text style={styles.content}>{content}</Text></AppCard>}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: { color: colors.text, lineHeight: 22 },
  empty: { color: colors.mutedText }
});
