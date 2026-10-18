import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenLayout } from '../../components/ScreenLayout';
import { AppCard } from '../../components/AppCard';
import { colors } from '../../constants/theme';
import { appService } from '../../services/appService';
import { useAuth } from '../../hooks/useAuth';

interface ActionItem {
  label: string;
  table: string;
  scopedToUser?: boolean;
}

interface Props {
  title: string;
  subtitle: string;
  actions: ActionItem[];
}

export function GenericManagementScreen({ title, subtitle, actions }: Props) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        setLoading(true);
        setError('');

        try {
          const next: Record<string, number> = {};
          for (const action of actions) {
            const key = `${action.table}:${action.label}`;
            next[key] = await appService.getEntityCount(action.table, action.scopedToUser ? user?.id : undefined);
          }
          setCounts(next);
        } catch (err: any) {
          setError(err.message || 'Unable to load records.');
        } finally {
          setLoading(false);
        }
      };

      load();
    }, [actions, user?.id])
  );

  return (
    <ScreenLayout title={title} subtitle={subtitle}>
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          {!!error && <Text style={styles.error}>{error}</Text>}
          {actions.map((action) => {
            const key = `${action.table}:${action.label}`;
            return (
              <AppCard key={key}>
                <View style={styles.row}>
                  <Text style={styles.action}>{action.label}</Text>
                  <Text style={styles.count}>{counts[key] || 0}</Text>
                </View>
                <Text style={styles.helper}>Live records in `{action.table}`</Text>
              </AppCard>
            );
          })}
        </>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  action: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1, paddingRight: 12 },
  count: { fontSize: 18, fontWeight: '800', color: colors.primaryDark },
  helper: { marginTop: 6, color: colors.mutedText },
  error: { color: colors.danger }
});
