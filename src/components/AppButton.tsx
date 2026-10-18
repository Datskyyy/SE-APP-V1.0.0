import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius } from '../constants/theme';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
}

export function AppButton({ label, onPress, loading, variant = 'primary' }: AppButtonProps) {
  return (
    <Pressable
      disabled={loading}
      onPress={onPress}
      style={[styles.button, variant === 'secondary' && styles.secondary]}
    >
      {loading ? <ActivityIndicator color={variant === 'primary' ? '#fff' : colors.primary} /> : <Text style={[styles.label, variant === 'secondary' && styles.secondaryLabel]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center'
  },
  secondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.primary
  },
  label: {
    color: '#fff',
    fontWeight: '700'
  },
  secondaryLabel: {
    color: colors.primary
  }
});
