import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useAuth } from '../../contexts/AuthContext';

const { width } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const { signIn, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Refs for auto-focus
  const passwordRef = useRef(null);

  // Animation
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const shakeError = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    // Reset errors
    setEmailError('');
    setPasswordError('');

    // Validation
    if (!email) {
      setEmailError('L\'email est requis');
      shakeError();
      return;
    }

    if (!validateEmail(email)) {
      setEmailError('Adresse email invalide');
      shakeError();
      return;
    }

    if (!password) {
      setPasswordError('Le mot de passe est requis');
      shakeError();
      return;
    }

    if (password.length < 6) {
      setPasswordError('Le mot de passe doit contenir au moins 6 caractères');
      shakeError();
      return;
    }

    setLoading(true);
    const { error } = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);

    if (error) {
      console.error('Erreur connexion:', error);
      setPasswordError('Email ou mot de passe incorrect');
      shakeError();
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert(
        'Email requis',
        'Veuillez entrer votre adresse email pour réinitialiser votre mot de passe.'
      );
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Email invalide', 'Veuillez entrer une adresse email valide.');
      return;
    }

    Alert.alert(
      'Réinitialiser le mot de passe',
      `Un email de réinitialisation sera envoyé à ${email}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Envoyer',
          onPress: async () => {
            setLoading(true);
            const { error } = await resetPassword(email.trim().toLowerCase());
            setLoading(false);

            if (error) {
              Alert.alert(
                'Erreur',
                'Impossible d\'envoyer l\'email de réinitialisation. Veuillez réessayer.'
              );
            } else {
              Alert.alert(
                'Email envoyé',
                'Vérifiez votre boîte de réception pour réinitialiser votre mot de passe.'
              );
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0F172A', '#1E3A8A', '#0F172A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.background}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <KeyboardAwareScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          enableOnAndroid={true}
          enableAutomaticScroll={true}
          extraScrollHeight={Platform.OS === 'ios' ? 20 : 40}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logoGradient}>
                <Image
                  source={require('../../assets/icon-without-back.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
            </View>
            <Text style={styles.title}>Bon retour !</Text>
            <Text style={styles.subtitle}>Connectez-vous pour continuer</Text>
          </View>

          {/* Form */}
          <Animated.View style={[styles.form, { transform: [{ translateX: shakeAnim }] }]}>
            {/* Email */}
            <View style={styles.inputWrapper}>
              <View style={[styles.inputContainer, emailError && styles.inputError]}>
                <BlurView intensity={20} tint="light" style={styles.inputBlur}>
                  <Ionicons name="mail-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="#64748B"
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      setEmailError('');
                    }}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    autoComplete="email"
                    editable={!loading}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    blurOnSubmit={false}
                  />
                </BlurView>
              </View>
              {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
            </View>

            {/* Password */}
            <View style={styles.inputWrapper}>
              <View style={[styles.inputContainer, passwordError && styles.inputError]}>
                <BlurView intensity={20} tint="light" style={styles.inputBlur}>
                  <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                  <TextInput
                    ref={passwordRef}
                    style={styles.input}
                    placeholder="Mot de passe"
                    placeholderTextColor="#64748B"
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      setPasswordError('');
                    }}
                    secureTextEntry={!showPassword}
                    textContentType="password"
                    autoComplete="password"
                    editable={!loading}
                    returnKeyType="go"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>
                </BlurView>
              </View>
              {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
            </View>

            {/* Forgot Password */}
            <TouchableOpacity
              style={styles.forgotButton}
              onPress={handleForgotPassword}
              disabled={loading}
            >
              <Text style={styles.forgotButtonText}>Mot de passe oublié ?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={loading ? ['#64748B', '#475569'] : ['#3B82F6', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.loginButtonText}>Se connecter</Text>
                    <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Pas encore de compte ?</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('SignUp')}
              disabled={loading}
            >
              <Text style={styles.signUpLink}>S'inscrire</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    justifyContent: 'center',
    minHeight: Dimensions.get('window').height - 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    marginBottom: 24,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  logoGradient: {
    width: 100,
    height: 100,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  logo: {
    width: 70,
    height: 70,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
  },
  form: {
    width: '100%',
  },
  inputWrapper: {
    marginBottom: 16,
  },
  inputContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  inputBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
  },
  eyeIcon: {
    padding: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    padding: 4,
  },
  forgotButtonText: {
    color: '#60A5FA',
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  loginButtonDisabled: {
    shadowOpacity: 0.1,
  },
  buttonGradient: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
    gap: 6,
  },
  footerText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  signUpLink: {
    color: '#60A5FA',
    fontSize: 14,
    fontWeight: '600',
  },
});
