import React, { useState } from 'react';
import { Alert, StyleSheet, TextInput } from 'react-native';
import { ScreenLayout } from '../../components/ScreenLayout';
import { AppButton } from '../../components/AppButton';
import { useAuth } from '../../hooks/useAuth';

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const { resetPassword } = useAuth();

  const onReset = async () => {
    try {
      setBusy(true);
      await resetPassword(email.trim());
      Alert.alert('Check your email', 'Password reset link sent.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Unable to send reset email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenLayout title="Forgot password" subtitle="Recover your account">
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <AppButton label="Send reset link" onPress={onReset} loading={busy} />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  input: { backgroundColor: '#fff', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e8e2f5' }
});
