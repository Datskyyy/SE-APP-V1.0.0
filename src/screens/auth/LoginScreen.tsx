import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { colors, radius } from '../../constants/theme';
import { isValidEmail } from '../../utils/validators';

export function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { signIn } = useAuth();

  const onLogin = async () => {
    setErrorMessage('');

    if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!password.trim()) {
      setErrorMessage('Password is required.');
      return;
    }

    try {
      setBusy(true);
      await signIn(email.trim(), password);
    } catch (error: any) {
      setErrorMessage(error.message || 'Check your credentials and try again.');
      Alert.alert('Login failed', error.message || 'Check your credentials.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
  <View style={styles.logoWrapper}>
    <Text style={styles.logo}>EduFile</Text>
  </View>
</View>

      <View style={styles.formCard}>
        <View style={styles.tabContainer}>
          <Pressable style={styles.activeTab}>
            <Text style={styles.activeTabText}>Login</Text>
          </Pressable>

          <Pressable
            style={styles.inactiveTab}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.inactiveTabText}>Register</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          placeholder="Enter email"
          placeholderTextColor={colors.mutedText}
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Enter password"
          placeholderTextColor={colors.mutedText}
        />

        <View style={styles.optionsRow}>
          <Pressable
            style={styles.rememberBox}
            onPress={() => setRememberMe(!rememberMe)}
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]} />
            <Text style={styles.rememberText}>Remember me</Text>
          </Pressable>

          <Pressable onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>
        </View>

        {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

        <Pressable
          style={[styles.loginButton, busy && styles.disabledButton]}
          onPress={onLogin}
          disabled={busy}
        >
          <Text style={styles.loginButtonText}>
            {busy ? 'Logging in...' : 'Login'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    height: 230,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  
  logoWrapper: {
    paddingHorizontal: 25,
    paddingVertical: 10,
    overflow: 'visible',
  },
  
  logo: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '800',
    includeFontPadding: true,
  },   

  formCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingTop: 18,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    marginTop: -20,
    overflow: 'hidden',
  },

  tabContainer: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    flexDirection: 'row',
    padding: 3,
    marginBottom: 20,
  },

  activeTab: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  inactiveTab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  activeTabText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },

  inactiveTabText: {
    color: colors.mutedText,
    fontSize: 14,
    fontWeight: '700',
  },

  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.text,
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },

  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -2,
    marginBottom: 12,
    paddingHorizontal: 1,
  },

  rememberBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  checkbox: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 2,
    marginRight: 5,
  },

  checkboxChecked: {
    backgroundColor: colors.primary,
  },

  rememberText: {
    fontSize: 10,
    color: colors.text,
  },

  forgotText: {
    fontSize: 10,
    color: colors.primaryDark,
  },

  error: {
    color: colors.danger,
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },

  loginButton: {
    height: 49,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },

  disabledButton: {
    opacity: 0.7,
  },

  loginButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});