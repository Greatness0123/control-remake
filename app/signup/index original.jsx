import React, { useState } from 'react';
import { 
  View, 
  TextInput, 
  TouchableOpacity, 
  Text, 
  Image, 
  StyleSheet, 
  ScrollView, 
  Modal, 
  RefreshControl, 
  ActivityIndicator, 
  SafeAreaView, 
  KeyboardAvoidingView, 
  Platform, 
  StatusBar,
  Animated 
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { auth, db } from '../../config/firebaseconfig';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

const generateRandomId = () => {
  return 'TID-' + Math.random().toString(36).substr(2, 9).toUpperCase();
};

const saveUserData = async (user, fullName, userRole, currentLevel, college, department, matricNumber, teacherId) => {
  try {
    console.log('Attempting to save user data:', { userRole, fullName, currentLevel, college, department });
    const collectionId = userRole === 'Student' ? 'students' : 'teachers';
    const data = {
      fullName,
      email: user.email,
      role: userRole,
      createdAt: new Date(),
      currentLevel,
      college,
      department,
    };

    if (userRole === 'Student' && matricNumber) {
      data.matricNumber = matricNumber;
    }
    if (userRole === 'Teacher' && teacherId) {
      data.teacherId = teacherId;
    }

    await setDoc(doc(db, collectionId, user.uid), data);
    console.log(`User data saved to ${collectionId} collection successfully.`);
  } catch (error) {
    console.error('Error saving user data:', error);
    throw new Error('Failed to save user data to Firestore.');
  }
};

const SignUp = ({ navigation, onSignup }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentLevel, setCurrentLevel] = useState('');
  const [college, setCollege] = useState('');
  const [department, setDepartment] = useState('');
  const [matricNumber, setMatricNumber] = useState('');
  const [errors, setErrors] = useState({
    fullName: false,
    email: false,
    password: false,
    currentLevel: false,
    college: false,
    department: false,
    matricNumber: false,
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [levelDropdownVisible, setLevelDropdownVisible] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [alert, setAlert] = useState(null);

  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];

  React.useEffect(() => {
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
    ]).start();
  }, []);

  const showAlert = (title, message) => {
    setAlert({ title, message });
  };

  const closeAlert = () => {
    setAlert(null);
  };

  const handleRoleSelection = (role) => {
    setUserRole(role);
    setErrors((prev) => ({ ...prev, userRole: false }));
    setErrorMessage('');
    if (role === 'Teacher') {
      setTeacherId(generateRandomId());
    } else {
      setTeacherId('');
    }
  };

  const handleSignup = async () => {
    const newErrors = {
      fullName: fullName.trim() === '',
      email: email.trim() === '',
      password: password.trim() === '',
      currentLevel: userRole === 'Student' && currentLevel.trim() === '',
      college: userRole === 'Student' && college.trim() === '',
      department: userRole === 'Student' && department.trim() === '',
      matricNumber: userRole === 'Student' && matricNumber.trim() === '',
      userRole: userRole.trim() === '',
    };
    setErrors(newErrors);

    if (Object.values(newErrors).some((error) => error)) {
      setErrorMessage('Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await saveUserData(user, fullName, userRole, currentLevel, college, department, matricNumber, teacherId);
      showAlert('Success', 'Signup successful! Redirecting to login...');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        showAlert('Error', 'The email address is already in use by another account.');
      } else {
        showAlert('Error', 'Signup failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setFullName('');
    setEmail('');
    setPassword('');
    setCurrentLevel('');
    setCollege('');
    setDepartment('');
    setMatricNumber('');
    setTermsAccepted(false);
    setErrorMessage('');
    setErrors({
      fullName: false,
      email: false,
      password: false,
      currentLevel: false,
      college: false,
      department: false,
      matricNumber: false,
    });
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <>
      <StatusBar backgroundColor="#3b82f6" barStyle="light-content" />
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Creating your account...</Text>
        </View>
      ) : (
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView 
              contentContainerStyle={[styles.scrollViewContent, { paddingTop: 30, paddingBottom: 50 }]}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3b82f6']} />
              }
            >
              <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <View style={styles.logoContainer}>
                  <View style={styles.logoPlaceholder}>
                    <Ionicons name="school" size={80} color="#3b82f6" />
                  </View>
                </View>

                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>Join Bells Attend today</Text>

                {errorMessage ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={20} color="#ef4444" />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                ) : null}

                {/* Full Name Field */}
                <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={20} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={[
                      styles.input,
                      errors.fullName ? styles.inputError : styles.inputDefault,
                    ]}
                    placeholder="Full Name"
                    placeholderTextColor="#94a3b8"
                    value={fullName}
                    onChangeText={(text) => {
                      setFullName(text);
                      setErrors((prev) => ({ ...prev, fullName: false }));
                      setErrorMessage('');
                    }}
                    autoCorrect={true}
                    autoCapitalize="words"
                  />
                </View>

                {/* Email Field */}
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={[
                      styles.input,
                      errors.email ? styles.inputError : styles.inputDefault,
                    ]}
                    placeholder="Email"
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

                {/* Password Field */}
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={[
                      styles.input,
                      errors.password ? styles.inputError : styles.inputDefault,
                    ]}
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

                {/* User Role Selection */}
                <Text style={styles.label}>I am a:</Text>
                <View style={styles.roleContainer}>
                  <TouchableOpacity
                    style={[
                      styles.roleButton,
                      userRole === 'Student' ? styles.roleButtonSelected : styles.roleButtonDefault,
                    ]}
                    onPress={() => handleRoleSelection('Student')}
                  >
                    <Ionicons 
                      name="school-outline" 
                      size={20} 
                      color={userRole === 'Student' ? '#ffffff' : '#64748b'} 
                    />
                    <Text
                      style={[
                        styles.roleButtonText,
                        userRole === 'Student' ? styles.roleButtonTextSelected : {},
                      ]}
                    >
                      Student
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.roleButton,
                      userRole === 'Teacher' ? styles.roleButtonSelected : styles.roleButtonDefault,
                    ]}
                    onPress={() => handleRoleSelection('Teacher')}
                  >
                    <Ionicons 
                      name="person-outline" 
                      size={20} 
                      color={userRole === 'Teacher' ? '#ffffff' : '#64748b'} 
                    />
                    <Text
                      style={[
                        styles.roleButtonText,
                        userRole === 'Teacher' ? styles.roleButtonTextSelected : {},
                      ]}
                    >
                      Lecturer
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Select Level Dropdown */}
                {userRole === 'Student' && (
                  <View style={styles.inputContainer}>
                    <Ionicons name="layers-outline" size={20} color="#64748b" style={styles.inputIcon} />
                    <TouchableOpacity
                      onPress={() => setLevelDropdownVisible(!levelDropdownVisible)}
                      style={[styles.input, { justifyContent: 'center' }]}
                    >
                      <Text style={{ color: currentLevel ? '#1e293b' : '#94a3b8' }}>
                        {currentLevel || 'Select Current Level'}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color="#64748b" />
                    </TouchableOpacity>

                    {levelDropdownVisible && (
                      <View style={styles.dropdownList}>
                        <ScrollView keyboardShouldPersistTaps="handled">
                          {['100 Level', '200 Level', '300 Level', '400 Level', '500 Level'].map((level) => (
                            <TouchableOpacity
                              key={level}
                              onPress={() => {
                                setCurrentLevel(level);
                                setLevelDropdownVisible(false);
                                setErrors((prev) => ({ ...prev, currentLevel: false }));
                                setErrorMessage('');
                              }}
                              style={styles.dropdownItem}
                            >
                              <Text style={{ color: '#1e293b' }}>{level}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                )}

                {/* Conditional Input Fields */}
                {userRole === 'Student' && (
                  <>
                    <View style={styles.inputContainer}>
                      <Ionicons name="card-outline" size={20} color="#64748b" style={styles.inputIcon} />
                      <TextInput
                        style={[
                          styles.input,
                          errors.matricNumber ? styles.inputError : styles.inputDefault,
                        ]}
                        placeholder="Matric Number"
                        placeholderTextColor="#94a3b8"
                        value={matricNumber}
                        onChangeText={(text) => {
                          const formatted = text.replace(/^(\d{4})\//, '$1/');
                          setMatricNumber(formatted);
                          setErrors((prev) => ({ ...prev, matricNumber: false }));
                          setErrorMessage('');
                        }}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.inputContainer}>
                      <Ionicons name="business-outline" size={20} color="#64748b" style={styles.inputIcon} />
                      <TextInput
                        style={[
                          styles.input,
                          errors.college ? styles.inputError : styles.inputDefault,
                        ]}
                        placeholder="College"
                        placeholderTextColor="#94a3b8"
                        value={college}
                        onChangeText={(text) => {
                          setCollege(text.toUpperCase());
                          setErrors((prev) => ({ ...prev, college: false }));
                          setErrorMessage('');
                        }}
                      />
                    </View>

                    <View style={styles.inputContainer}>
                      <Ionicons name="library-outline" size={20} color="#64748b" style={styles.inputIcon} />
                      <TextInput
                        style={[
                          styles.input,
                          errors.department ? styles.inputError : styles.inputDefault,
                        ]}
                        placeholder="Department"
                        placeholderTextColor="#94a3b8"
                        value={department}
                        onChangeText={(text) => {
                          setDepartment(text);
                          setErrors((prev) => ({ ...prev, department: false }));
                          setErrorMessage('');
                        }}
                      />
                    </View>
                  </>
                )}

                {userRole === 'Teacher' && teacherId && (
                  <View style={styles.teacherIdContainer}>
                    <Ionicons name="key-outline" size={20} color="#3b82f6" />
                    <Text style={styles.teacherIdLabel}>Lecturer ID:</Text>
                    <Text style={styles.teacherIdValue}>{teacherId}</Text>
                  </View>
                )}

                {/* Terms and Conditions */}
                <View style={styles.termsContainer}>
                  <TouchableOpacity
                    onPress={() => setTermsAccepted(!termsAccepted)}
                    style={[
                      styles.checkbox,
                      termsAccepted ? styles.checkboxSelected : styles.checkboxDefault
                    ]}
                  >
                    {termsAccepted && (
                      <Ionicons name="checkmark" size={16} color="#ffffff" />
                    )}
                  </TouchableOpacity>
                  <Text style={styles.termsText}>
                    I agree to the{' '}
                    <Text 
                      style={styles.termsLink} 
                      onPress={() => setTermsModalVisible(true)}
                    >
                      Terms and Conditions
                    </Text>
                  </Text>
                </View>

                {/* Sign Up Button */}
                <TouchableOpacity 
                  style={[
                    styles.signupButton,
                    (!termsAccepted || !userRole) && styles.signupButtonDisabled
                  ]} 
                  onPress={handleSignup}
                  disabled={!termsAccepted || !userRole}
                >
                  <Text style={styles.signupButtonText}>Create Account</Text>
                </TouchableOpacity>

                {/* Login Link */}
                <View style={styles.loginContainer}>
                  <Text style={styles.loginText}>Already have an account? </Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                    <Text style={styles.loginLink}>Sign In</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      )}

      {/* Terms Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={termsModalVisible}
        onRequestClose={() => setTermsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Terms and Conditions</Text>
            <ScrollView style={styles.modalScroll}>
              <Text style={styles.modalText}>
                Welcome to Bells Attend! By using our app, you agree to:
                {'\n\n'}
                1. Provide accurate information when registering
                {'\n'}
                2. Use the app only for legitimate attendance purposes
                {'\n'}
                3. Respect the privacy and rights of other users
                {'\n'}
                4. Not attempt to manipulate or bypass location verification
                {'\n'}
                5. Maintain the security of your account credentials
                {'\n\n'}
                Location Services:
                {'\n'}
                The app requires location services to verify attendance. Your location data is used solely for attendance purposes and is not shared with third parties.
                {'\n\n'}
                Data Privacy:
                {'\n'}
                Your personal information is protected and will only be used for attendance management as intended by the educational institution.
                {'\n\n'}
                By agreeing to these terms, you commit to using Bells Attend responsibly and ethically.
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setTermsModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Custom Alert Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={!!alert}
        onRequestClose={closeAlert}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>{alert?.title}</Text>
            <Text style={styles.alertMessage}>{alert?.message}</Text>
            <TouchableOpacity style={styles.alertButton} onPress={closeAlert}>
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: 15,
    top: 15,
    zIndex: 1,
  },
  input: {
    height: 55,
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: 50,
    paddingRight: 15,
    fontSize: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputDefault: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    color: '#1e293b',
  },
  inputError: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
    color: '#1e293b',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  roleContainer: {
    flexDirection: 'row',
    marginBottom: 25,
    gap: 10,
  },
  roleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  roleButtonDefault: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  roleButtonSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  roleButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  roleButtonTextSelected: {
    color: '#ffffff',
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  teacherIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
  },
  teacherIdLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  teacherIdValue: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: 'bold',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxDefault: {
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  checkboxSelected: {
    backgroundColor: '#3b82f6',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  termsText: {
    fontSize: 14,
    color: '#64748b',
    flex: 1,
  },
  termsLink: {
    color: '#3b82f6',
    textDecorationLine: 'underline',
  },
  signupButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  signupButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  signupButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    color: '#64748b',
    fontSize: 14,
  },
  loginLink: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    color: '#64748b',
    fontSize: 16,
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalScroll: {
    maxHeight: 300,
    marginBottom: 20,
  },
  modalText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  modalButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    maxWidth: 300,
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 10,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
    textAlign: 'center',
  },
  alertButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  alertButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SignUp;