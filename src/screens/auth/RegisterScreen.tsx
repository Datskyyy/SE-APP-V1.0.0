import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { colors, radius } from '../../constants/theme';
import { isStrongEnoughPassword, isValidEmail } from '../../utils/validators';

export function RegisterScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const { signUp } = useAuth();

  const onRegister = async () => {
    setMessage('');
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();

    if (!isValidEmail(normalizedEmail)) {
      setMessage('Please enter a valid email address.');
      return;
    }

    if (!normalizedUsername) {
      setMessage('Username is required.');
      return;
    }

    if (!isStrongEnoughPassword(password)) {
      setMessage('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    try {
      setBusy(true);
      await signUp(normalizedEmail, password, normalizedUsername);
      setMessage('Account created successfully. You can now log in.');
    } catch (error: any) {
      Alert.alert('Register failed', error.message || 'Please try again.');
      setMessage(error.message || 'Please try again.');
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
        <Text style={styles.logo}>EduFile</Text>
      </View>

      <View style={styles.formCard}>
        <View style={styles.tabContainer}>
          <Pressable
            style={styles.inactiveTab}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.inactiveTabText}>Login</Text>
          </Pressable>

          <Pressable style={styles.activeTab}>
            <Text style={styles.activeTabText}>Register</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Enter your email"
          placeholderTextColor={colors.mutedText}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Create a username"
          placeholderTextColor={colors.mutedText}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Create a password"
          placeholderTextColor={colors.mutedText}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          placeholderTextColor={colors.mutedText}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        {!!message && <Text style={styles.message}>{message}</Text>}

        <Pressable
          style={[styles.registerButton, busy && styles.disabledButton]}
          onPress={onRegister}
          disabled={busy}
        >
          <Text style={styles.registerButtonText}>
            {busy ? 'Registering...' : 'Register'}
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
  },

  logo: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '800',
  },

  formCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingTop: 18,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    marginTop: -20,
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

  message: {
    color: colors.primaryDark,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },

  registerButton: {
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

  registerButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});