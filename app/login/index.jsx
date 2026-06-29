import React, { useState, useLayoutEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  StyleSheet, 
  Keyboard, 
  TouchableWithoutFeedback, 
  Image, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform,
  Animated,
  Dimensions,
  StatusBar,
  FlatList
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../config/firebaseconfig';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebaseconfig';


const { width, height } = Dimensions.get('window');

const LoginScreen = ({ navigation, route }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ email: false, password: false });
  const [errorMessage, setErrorMessage] = useState('');
  
  // Animation values
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(height * 0.3)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;

  useLayoutEffect(() => {
    // Start entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    if (route?.params?.hideTabs) {
      navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } });
    }
    return () => {
      navigation.getParent()?.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation, route, fadeAnim, slideAnim, scaleAnim]);

  const handleLogin = async () => {
    Keyboard.dismiss();

    const newErrors = {
      email: email.trim() === '',
      password: password.trim() === '',
    };
    setErrors(newErrors);

    if (Object.values(newErrors).some((error) => error)) {
      setErrorMessage('Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const uid = user.uid;

      // Searching in the students collection for uber deytail
      const studentRef = doc(db, 'students', uid);
      const studentSnap = await getDoc(studentRef);

      if (studentSnap.exists()) {
        const studentData = studentSnap.data();
        navigation.reset({
          index: 0,
          routes: [{ name: 'StudentScreen', params: { user: studentData } }],
        });
        return;
      }

      // If not found in students, search in the teachers collection
      const teacherRef = doc(db, 'teachers', uid);
      const teacherSnap = await getDoc(teacherRef);

      if (teacherSnap.exists()) {
        const teacherData = teacherSnap.data();
        navigation.reset({
          index: 0,
          routes: [{ name: 'TeacherScreen', params: { user: teacherData } }],
        });
        return;
      }

      // If not found in either collection teacher or student
      setErrorMessage('User data not found.');
    } catch (error) {
      setErrorMessage('Login failed. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = () => {
    navigation.navigate('AdminScreen');
  };

  return (
    // <FlatList
    // scrollEnabled={true}
    // refreshControl={
    //                 <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3b82f6']} />
    //               }
    //               >
    <TouchableWithoutFeedback
      onPress={(event) => {
        if (event.target === event.currentTarget) {
          Keyboard.dismiss();
        }
      }}
      accessible={false}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
          
          
          <View style={styles.backgroundGradient} />
          
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          )}
          
          <ScrollView 
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={true}
          >
            <Animated.View 
              style={[
                styles.contentContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }, { scale: scaleAnim }]
                }
              ]}
            >
              
              <Animated.View 
                style={[
                  styles.logoContainer,
                  {
                    transform: [{
                      scale: scaleAnim.interpolate({
                        inputRange: [0.8, 1],
                        outputRange: [0.5, 1],
                      })
                    }]
                  }
                ]}
              >
                <Image source={require('../../assets/bells-logo.png')} style={styles.logo} />
              </Animated.View>

             
              <Animated.Text 
                style={[
                  styles.title,
                  {
                    opacity: fadeAnim,
                  }
                ]}
              >
                Welcome Back
              </Animated.Text>
              
              <Animated.Text 
                style={[
                  styles.subtitle,
                  {
                    opacity: fadeAnim,
                  }
                ]}
              >
                Sign in to your account
              </Animated.Text>

              {errorMessage ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              
              <Animated.View 
                style={{
                  opacity: fadeAnim,
                }}
              >
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[styles.input, errors.email && styles.inputError]}
                    placeholder="Email Address"
                    placeholderTextColor="#94a3b8"
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      setErrors((prev) => ({ ...prev, email: false }));
                      setErrorMessage('');
                    }}
                    autoCorrect={false}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <TextInput
                    style={[styles.input, errors.password && styles.inputError]}
                    placeholder="Password"
                    placeholderTextColor="#94a3b8"
                    secureTextEntry
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      setErrors((prev) => ({ ...prev, password: false }));
                      setErrorMessage('');
                    }}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                </View>
              </Animated.View>

              
              <Animated.View 
                style={{
                  opacity: fadeAnim,
                }}
              >
                <TouchableOpacity 
                  style={[styles.loginButton, loading && styles.loginButtonDisabled]} 
                  onPress={handleLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.loginButtonText}>Sign In</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>

              
              <Animated.View 
                style={{
                  opacity: fadeAnim,
                }}
              >
                <TouchableOpacity style={styles.link} onPress={() => navigation.navigate('SignUp')}>
                  <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkTextHighlight}>Sign Up</Text></Text>
                </TouchableOpacity>
              </Animated.View>

              
              <Animated.View 
                style={{
                  opacity: fadeAnim,
                }}
              >
                <TouchableOpacity style={styles.adminLink} onPress={handleAdminLogin}>
                  <Text style={styles.adminLinkText}>Sign in as Admin</Text>
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
    // </FlatList>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: 40,
    paddingBottom: 40,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.4,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    padding: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1e293b',
    backgroundColor: '#f8fafc',
    minHeight: 56,
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 20,
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
    elevation: 0,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  link: {
    marginTop: 8,
  },
  linkText: {
    color: '#64748b',
    textAlign: 'center',
    fontSize: 14,
  },
  linkTextHighlight: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  adminLink: {
    marginTop: 16,
  },
  adminLinkText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '10',
  },
});

export default LoginScreen;