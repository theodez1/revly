import React, { useState, useRef, useEffect } from 'react';
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
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useAuth } from '../../contexts/AuthContext';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';

type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
};

type SignUpScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'SignUp'>;
type SignUpScreenRouteProp = RouteProp<AuthStackParamList, 'SignUp'>;

interface SignUpScreenProps {
  navigation: SignUpScreenNavigationProp;
  route: SignUpScreenRouteProp;
}

const { width } = Dimensions.get('window');
const CONTENT_PADDING = 24;
const STEP_WIDTH = width - (CONTENT_PADDING * 2);

export default function SignUpScreen({ navigation }: SignUpScreenProps) {
  const { signUp } = useAuth();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  // Animation for sliding steps
  const slideAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Errors
  const [usernameError, setUsernameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  // Refs for auto-focus
  const firstNameRef = useRef<TextInput | null>(null);
  const lastNameRef = useRef<TextInput | null>(null);
  const emailRef = useRef<TextInput | null>(null);
  const passwordRef = useRef<TextInput | null>(null);
  const confirmPasswordRef = useRef<TextInput | null>(null);

  const validateEmail = (email: string) => {
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

  // Animation when step changes
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: -(step - 1) * STEP_WIDTH,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
  }, [step]);

  const handleNext = () => {
    if (step === 1) {
      setUsernameError('');

      if (!username.trim()) {
        setUsernameError('Le nom d\'utilisateur est requis');
        shakeError();
        return;
      }

      if (username.trim().length < 3) {
        setUsernameError('Le nom d\'utilisateur doit contenir au moins 3 caractères');
        shakeError();
        return;
      }

      setStep(2);
      // Focus next input immediately
      setTimeout(() => emailRef.current?.focus(), 100);
    } else if (step === 2) {
      setEmailError('');

      if (!email.trim()) {
        setEmailError('L\'email est requis');
        shakeError();
        return;
      }

      if (!validateEmail(email)) {
        setEmailError('Adresse email invalide');
        shakeError();
        return;
      }

      setStep(3);
      // Focus next input immediately
      setTimeout(() => passwordRef.current?.focus(), 100);
    }
  };

  const handleSignUp = async () => {
    // Reset errors
    setPasswordError('');
    setConfirmPasswordError('');

    // Validations
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

    if (!confirmPassword) {
      setConfirmPasswordError('Veuillez confirmer votre mot de passe');
      shakeError();
      return;
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError('Les mots de passe ne correspondent pas');
      shakeError();
      return;
    }

    setLoading(true);
    const { error } = await signUp(
      email.trim().toLowerCase(),
      password,
      {
        username: username.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      }
    );
    setLoading(false);

    if (error) {
      console.error('Erreur inscription:', error);

      if (error.message?.includes('already registered') || error.message?.includes('duplicate')) {
        setEmailError('Cet email est déjà utilisé');
        setStep(2);
        setTimeout(() => emailRef.current?.focus(), 100);
      } else if (error.message?.includes('username')) {
        setUsernameError('Ce nom d\'utilisateur est déjà pris');
        setStep(1);
      } else {
        Alert.alert('Erreur d\'inscription', 'Une erreur est survenue. Veuillez réessayer.');
      }
      shakeError();
    } else {
      Alert.alert(
        'Inscription réussie',
        'Votre compte a été créé avec succès !',
        [{ text: 'OK' }]
      );
    }
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
        {/* Back Button */}
        <TouchableOpacity
          style={[styles.topBackButton, { top: insets.top + 10 }]}
          onPress={() => step === 1 ? navigation.goBack() : setStep(step - 1)}
          disabled={loading}
        >
          <BlurView intensity={20} tint="light" style={styles.backButtonBlur}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </BlurView>
        </TouchableOpacity>

        <KeyboardAwareScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          enableOnAndroid={true}
          enableAutomaticScroll={true}
          extraScrollHeight={Platform.OS === 'ios' ? 20 : 60}
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
            <Text style={styles.title}>Créer un compte</Text>
            <Text style={styles.subtitle}>
              {step === 1 && 'Étape 1/3 • Identité'}
              {step === 2 && 'Étape 2/3 • Contact'}
              {step === 3 && 'Étape 3/3 • Sécurité'}
            </Text>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              {[1, 2, 3].map((s) => (
                <View
                  key={s}
                  style={[
                    styles.progressDot,
                    s <= step && styles.progressDotActive,
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Form Container with Overflow Hidden */}
          <View style={styles.formContainer}>
            <Animated.View
              style={[
                styles.slidingContainer,
                {
                  transform: [
                    { translateX: slideAnim },
                    { translateX: shakeAnim } // Combine animations
                  ]
                }
              ]}
            >
              {/* Step 1 */}
              <View style={styles.stepContainer}>
                {/* Username */}
                <View style={styles.inputWrapper}>
                  <View style={[styles.inputContainer, usernameError && styles.inputError]}>
                    <BlurView intensity={20} tint="light" style={styles.inputBlur}>
                      <Ionicons name="person-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Nom d'utilisateur *"
                        placeholderTextColor="#64748B"
                        value={username}
                        onChangeText={(text) => {
                          setUsername(text);
                          setUsernameError('');
                        }}
                        autoCapitalize="none"
                        autoComplete="username"
                        editable={!loading}
                        returnKeyType="next"
                        onSubmitEditing={() => firstNameRef.current?.focus()}
                        blurOnSubmit={false}
                      />
                    </BlurView>
                  </View>
                  {usernameError ? <Text style={styles.errorText}>{usernameError}</Text> : null}
                </View>

                {/* First Name */}
                <View style={styles.inputWrapper}>
                  <View style={styles.inputContainer}>
                    <BlurView intensity={20} tint="light" style={styles.inputBlur}>
                      <Ionicons name="person-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                      <TextInput
                        ref={firstNameRef}
                        style={styles.input}
                        placeholder="Prénom (optionnel)"
                        placeholderTextColor="#64748B"
                        value={firstName}
                        onChangeText={setFirstName}
                        autoCapitalize="words"
                        textContentType="givenName"
                        autoComplete="name-given"
                        editable={!loading}
                        returnKeyType="next"
                        onSubmitEditing={() => lastNameRef.current?.focus()}
                        blurOnSubmit={false}
                      />
                    </BlurView>
                  </View>
                </View>

                {/* Last Name */}
                <View style={styles.inputWrapper}>
                  <View style={styles.inputContainer}>
                    <BlurView intensity={20} tint="light" style={styles.inputBlur}>
                      <Ionicons name="person-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                      <TextInput
                        ref={lastNameRef}
                        style={styles.input}
                        placeholder="Nom (optionnel)"
                        placeholderTextColor="#64748B"
                        value={lastName}
                        onChangeText={setLastName}
                        autoCapitalize="words"
                        textContentType="familyName"
                        autoComplete="name-family"
                        editable={!loading}
                        returnKeyType="next"
                        onSubmitEditing={handleNext}
                        blurOnSubmit={false}
                      />
                    </BlurView>
                  </View>
                </View>

                {/* Continue Button */}
                <TouchableOpacity
                  style={styles.continueButton}
                  onPress={handleNext}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#2563EB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.buttonGradient}
                  >
                    <Text style={styles.continueButtonText}>Continuer</Text>
                    <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* Step 2 */}
              <View style={styles.stepContainer}>
                {/* Email */}
                <View style={styles.inputWrapper}>
                  <View style={[styles.inputContainer, emailError && styles.inputError]}>
                    <BlurView intensity={20} tint="light" style={styles.inputBlur}>
                      <Ionicons name="mail-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                      <TextInput
                        ref={emailRef}
                        style={styles.input}
                        placeholder="Email *"
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
                        onSubmitEditing={handleNext}
                        blurOnSubmit={false}
                      />
                    </BlurView>
                  </View>
                  {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
                </View>

                <TouchableOpacity
                  style={styles.continueButton}
                  onPress={handleNext}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#2563EB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.buttonGradient}
                  >
                    <Text style={styles.continueButtonText}>Continuer</Text>
                    <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* Step 3 */}
              <View style={styles.stepContainer}>
                {/* Password */}
                <View style={styles.inputWrapper}>
                  <View style={[styles.inputContainer, passwordError && styles.inputError]}>
                    <BlurView intensity={20} tint="light" style={styles.inputBlur}>
                      <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                      <TextInput
                        ref={passwordRef}
                        style={styles.input}
                        placeholder="Mot de passe *"
                        placeholderTextColor="#64748B"
                        value={password}
                        onChangeText={(text) => {
                          setPassword(text);
                          setPasswordError('');
                          // Real-time validation for password match
                          if (confirmPassword && text !== confirmPassword) {
                            setConfirmPasswordError('Les mots de passe ne correspondent pas');
                          } else {
                            setConfirmPasswordError('');
                          }
                        }}
                        secureTextEntry={!showPassword}
                        textContentType="newPassword"
                        autoComplete="password-new"
                        editable={!loading}
                        returnKeyType="next"
                        onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                        blurOnSubmit={false}
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

                {/* Confirm Password */}
                <View style={styles.inputWrapper}>
                  <View style={[styles.inputContainer, confirmPasswordError && styles.inputError]}>
                    <BlurView intensity={20} tint="light" style={styles.inputBlur}>
                      <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                      <TextInput
                        ref={confirmPasswordRef}
                        style={styles.input}
                        placeholder="Confirmer le mot de passe *"
                        placeholderTextColor="#64748B"
                        value={confirmPassword}
                        onChangeText={(text) => {
                          setConfirmPassword(text);
                          // Real-time validation
                          if (password && text !== password) {
                            setConfirmPasswordError('Les mots de passe ne correspondent pas');
                          } else {
                            setConfirmPasswordError('');
                          }
                        }}
                        secureTextEntry={!showConfirmPassword}
                        textContentType="password"
                        autoComplete="password-new"
                        editable={!loading}
                        returnKeyType="go"
                        onSubmitEditing={handleSignUp}
                      />
                      <TouchableOpacity
                        style={styles.eyeIcon}
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        <Ionicons
                          name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                          size={20}
                          color="#94A3B8"
                        />
                      </TouchableOpacity>
                    </BlurView>
                  </View>
                  {confirmPasswordError ? <Text style={styles.errorText}>{confirmPasswordError}</Text> : null}
                </View>

                <TouchableOpacity
                  style={[styles.signUpButton, loading && styles.signUpButtonDisabled]}
                  onPress={handleSignUp}
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
                        <Text style={styles.signUpButtonText}>S'inscrire</Text>
                        <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Terms */}
                <Text style={styles.termsText}>
                  En vous inscrivant, vous acceptez nos conditions d'utilisation et notre politique de confidentialité
                </Text>
              </View>
            </Animated.View>
          </View>

          {/* Footer - only show on step 1 */}
          {step === 1 && (
            <View style={styles.footer}>
              <Text style={styles.footerText}>Vous avez déjà un compte ?</Text>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                disabled={loading}
              >
                <Text style={styles.loginLink}>Se connecter</Text>
              </TouchableOpacity>
            </View>
          )}
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
    paddingHorizontal: CONTENT_PADDING,
    paddingBottom: 40,
    paddingTop: 80,
    justifyContent: 'center',
    minHeight: Dimensions.get('window').height - 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  topBackButton: {
    position: 'absolute',
    left: 16,
    zIndex: 1000,
  },
  backButtonBlur: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
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
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressDotActive: {
    backgroundColor: '#3B82F6',
    width: 24,
  },
  formContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  slidingContainer: {
    flexDirection: 'row',
    width: STEP_WIDTH * 3, // 3 steps
  },
  stepContainer: {
    width: STEP_WIDTH,
    paddingRight: 0, // No extra padding needed as parent has padding
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
  continueButton: {
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  signUpButton: {
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  signUpButtonDisabled: {
    shadowOpacity: 0.1,
  },
  buttonGradient: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  signUpButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  termsText: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
    paddingHorizontal: 20,
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
  loginLink: {
    color: '#60A5FA',
    fontSize: 14,
    fontWeight: '600',
  },
});
