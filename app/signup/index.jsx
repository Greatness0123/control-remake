import React, { useState, useRef } from 'react';
import { 
  View, 
  TextInput, 
  TouchableOpacity, 
  Text, 
  Image, 
  StyleSheet, 
  FlatList, 
  Modal, 
  RefreshControl, 
  ActivityIndicator, 
  SafeAreaView, 
  KeyboardAvoidingView, 
  Platform, 
  StatusBar,
  Animated,
  PanResponder,
  Dimensions,
  ScrollView
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import DropDownPicker from 'react-native-dropdown-picker';
import { auth, db } from '../../config/firebaseconfig';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

DropDownPicker.setMode('BADGE');

const COLLEGES = [
  { label: 'COLNAS', value: 'COLNAS' },
  { label: 'COLMANS', value: 'COLMANS' },
  { label: 'COLFAST', value: 'COLFAST' },
  { label: 'COLENG', value: 'COLENG' },
  { label: 'COLENVS', value: 'COLENVS' },
];

const LEVELS = [
  { label: '100 Level', value: '100 Level' },
  { label: '200 Level', value: '200 Level' },
  { label: '300 Level', value: '300 Level' },
  { label: '400 Level', value: '400 Level' },
  { label: '500 Level', value: '500 Level' },
];

const DEPARTMENTS_BY_COLLEGE = {
  'COLNAS': [
    { label: 'Biotechnology', value: 'Biotechnology' },
    { label: 'Applied Mathematics', value: 'Applied Mathematics' },
    { label: 'Statistics', value: 'Statistics' },
    { label: 'Microbiology', value: 'Microbiology' },
    { label: 'Physics with Electricity', value: 'Physics with Electricity' },
    { label: 'Industrial Chemistry', value: 'Industrial Chemistry' },
    { label: 'Biochemistry', value: 'Biochemistry' },
    { label: 'Computer Science', value: 'Computer Science' },
    { label: 'Information Technology', value: 'Information Technology' },
  ],
  'COLMANS': [
    { label: 'Business Administration', value: 'Business Administration' },
    { label: 'Human Resource Management', value: 'Human Resource Management' },
    { label: 'Marketing', value: 'Marketing' },
    { label: 'Accounting', value: 'Accounting' },
    { label: 'Economics', value: 'Economics' },
    { label: 'Finance and Banking', value: 'Finance and Banking' },
    { label: 'Management Technology', value: 'Management Technology' },
    { label: 'Project Management', value: 'Project Management' },
    { label: 'Transport Management', value: 'Transport Management' },
  ],
  'COLFAST': [
    { label: 'Agricultural and Agricultural technology', value: 'Agric and Agric tech' },
    { label: 'Food Technology', value: 'Food Technology' },
    { label: 'Agricbusiness', value: 'Agricbusiness' },
    { label: 'Agronomy', value: 'Agronomy' },
    { label: 'Fishery', value: 'Fishery' },
    { label: 'Animal sciences', value: 'Animal sciences' },
    { label: 'Nutrition and Dietetics', value: 'Nutrition and Dietetics' },
  ],
  'COLENG': [
    { label: 'Civil Engineering', value: 'Civil Engineering' },
    { label: 'Mechanical Engineering', value: 'Mechanical Engineering' },
    { label: 'Electrical and Electronics Engineering', value: 'Electrical and Electronics Engineering' },
    { label: 'biomedical Engineering', value: 'biomedical Engineering' },
    { label: 'Mechatronics Engineering', value: 'Mechatronics Engineering' },
    { label: 'Agricultural and Biosystems Engineering', value: 'Agricultural and Biosystems Engineering' },
    { label: 'Telecommunication Engineering', value: 'Telecommunication Engineering' },
    { label: 'Computer Engineering', value: 'Computer Engineering' },
  ],
  'COLENVS': [
    { label: 'Architecture', value: 'Architecture' },
    { label: 'Building Technology', value: 'Geology' },
    { label: 'Estate Management', value: 'Estate Management' },
    { label: 'Quantity Surveying', value: 'Quantity Surveying' },
    { label: 'Surveying and Geoinformatics', value: 'Surveying and Geo.' },
    { label: 'Urban and Regional Planning', value: 'Urban and Regional Planning' },
  ],
};

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

const IOSBottomModal = ({ visible, onClose, children }) => {
  const [panY] = useState(new Animated.Value(0));
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (e, { dy }) => {
        if (dy > 0) {
          Animated.event([null, { dy: panY }], { useNativeDriver: false })(e, { dy });
        }
      },
      onPanResponderRelease: (e, { dy }) => {
        if (dy > 100) {
          onClose();
          panY.setValue(0);
        } else {
          Animated.timing(panY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const translateY = panY.interpolate({
    inputRange: [0, 500],
    outputRange: [0, 500],
    extrapolate: 'clamp',
  });

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.iosModalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View 
          style={[
            styles.iosModalContent,
            { transform: [{ translateY }] }
          ]}
          {...panResponder.panHandlers}
        >
          <View style={styles.iosModalHandle} />
          {children}
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const SignUp = ({ navigation, onSignup }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentLevel, setCurrentLevel] = useState(null);
  const [college, setCollege] = useState(null);
  const [department, setDepartment] = useState(null);
  const [departmentInput, setDepartmentInput] = useState('');
  const [departmentIsValid, setDepartmentIsValid] = useState(true);
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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [alert, setAlert] = useState(null);
  const [departmentDropdownOpen, setDepartmentDropdownOpen] = useState(false);

  // Dropdown open states
  const [levelOpen, setLevelOpen] = useState(false);
  const [collegeOpen, setCollegeOpen] = useState(false);

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

  const handleCollegeChange = (value) => {
    setCollege(value);
    setDepartment(null);
    setDepartmentInput('');
    setDepartmentIsValid(true);
    setErrors((prev) => ({ ...prev, college: false, department: false }));
    setErrorMessage('');
  };

  const handleDepartmentInputChange = (text) => {
    setDepartmentInput(text);
    
    const allDepartments = college ? DEPARTMENTS_BY_COLLEGE[college] : [];
    const matchingDept = allDepartments.find(
      d => d.value.toLowerCase() === text.toLowerCase()
    );
    
    if (text.trim() === '') {
      setDepartmentIsValid(true);
      setDepartment(null);
    } else if (matchingDept) {
      setDepartmentIsValid(true);
      setDepartment(matchingDept.value);
    } else {
      setDepartmentIsValid(false);
      setDepartment(null);
    }
    
    setErrors((prev) => ({ ...prev, department: false }));
    setErrorMessage('');
  };

  const getFilteredDepartments = () => {
    if (!college) return [];
    
    const allDepartments = DEPARTMENTS_BY_COLLEGE[college];
    if (!departmentInput.trim()) return allDepartments;
    
    return allDepartments.filter(d =>
      d.label.toLowerCase().includes(departmentInput.toLowerCase())
    );
  };

  const selectDepartmentFromDropdown = (value) => {
    setDepartment(value);
    setDepartmentInput(value);
    setDepartmentIsValid(true);
    setDepartmentDropdownOpen(false);
  };

  const handleSignup = async () => {
    const newErrors = {
      fullName: fullName.trim() === '',
      email: email.trim() === '',
      password: password.trim() === '',
      currentLevel: userRole === 'Student' && !currentLevel,
      college: userRole === 'Student' && !college,
      department: userRole === 'Student' && (!department || !departmentIsValid),
      matricNumber: userRole === 'Student' && matricNumber.trim() === '',
      userRole: userRole.trim() === '',
    };
    setErrors(newErrors);

    if (Object.values(newErrors).some((error) => error)) {
      setErrorMessage('Please fill in all fields correctly.');
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
    setCurrentLevel(null);
    setCollege(null);
    setDepartment(null);
    setDepartmentInput('');
    setDepartmentIsValid(true);
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

  const filteredDepartments = getFilteredDepartments();

  const renderFormContent = () => (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Animated.View 
                      style={[
                        styles.logoContainer,
                      ]}
                    >
                      <Image source={require('../../assets/bells-logo.png')} style={styles.logo} />
                    </Animated.View>

      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Join Bells Attend today</Text>

      {errorMessage ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={20} color="#ef4444" />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      
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

    
      {userRole === 'Student' && (
        <>
          
          <View style={[styles.dropdownContainerWrapper, { zIndex: 4000 }]}>
            <Ionicons name="layers-outline" size={20} color="#64748b" style={styles.dropdownIcon} />
            <DropDownPicker
              open={levelOpen}
              value={currentLevel}
              items={LEVELS}
              setOpen={setLevelOpen}
              setValue={setCurrentLevel}
              placeholder="Select Current Level"
              style={[
                styles.dropdown,
                errors.currentLevel && styles.dropdownError
              ]}
              dropDownContainerStyle={styles.dropdownMenu}
              textStyle={styles.dropdownItemText}
              placeholderStyle={styles.dropdownPlaceholder}
              arrowIconStyle={styles.arrowIcon}
              maxHeight={200}
              zIndex={4000}
              zIndexInverse={1000}
            />
          </View>

          
          <View style={[styles.dropdownContainerWrapper, { zIndex: 3000 }]}>
            <Ionicons name="business-outline" size={20} color="#64748b" style={styles.dropdownIcon} />
            <DropDownPicker
              open={collegeOpen}
              value={college}
              items={COLLEGES}
              setOpen={setCollegeOpen}
              setValue={handleCollegeChange}
              placeholder="Select College"
              style={[
                styles.dropdown,
                errors.college && styles.dropdownError
              ]}
              dropDownContainerStyle={styles.dropdownMenu}
              textStyle={styles.dropdownItemText}
              placeholderStyle={styles.dropdownPlaceholder}
              arrowIconStyle={styles.arrowIcon}
              maxHeight={200}
              zIndex={3000}
              zIndexInverse={1000}
            />
          </View>

          
          {college && (
            <View style={[styles.dropdownContainerWrapper, { zIndex: 2000 }]}>
              <Ionicons name="library-outline" size={20} color="#64748b" style={styles.dropdownIcon} />
              <View style={styles.departmentInputWrapper}>
                <TextInput
                  style={[
                    styles.input,
                    styles.departmentInput,
                    (errors.department || !departmentIsValid) && styles.inputError,
                  ]}
                  placeholder="Type or select department"
                  placeholderTextColor="#94a3b8"
                  value={departmentInput}
                  onChangeText={handleDepartmentInputChange}
                  onFocus={() => setDepartmentDropdownOpen(true)}
                />
                {!departmentIsValid && departmentInput.trim() !== '' && (
                  <Ionicons 
                    name="close-circle" 
                    size={20} 
                    color="#ef4444" 
                    style={styles.invalidIcon}
                  />
                )}
                {departmentIsValid && departmentInput.trim() !== '' && (
                  <Ionicons 
                    name="checkmark-circle" 
                    size={20} 
                    color="#10b981" 
                    style={styles.validIcon}
                  />
                )}
              </View>

             
              {departmentDropdownOpen && college && filteredDepartments.length > 0 && (
                <View style={styles.customDropdownMenu}>
                  <ScrollView 
                    scrollEnabled={true}
                    nestedScrollEnabled={true}
                    style={{ maxHeight: 200 }}
                  >
                    {filteredDepartments.map((item) => (
                      <TouchableOpacity
                        key={item.value}
                        style={[
                          styles.departmentMenuItem,
                          department === item.value && styles.departmentMenuItemSelected,
                        ]}
                        onPress={() => selectDepartmentFromDropdown(item.value)}
                      >
                        <Text style={[
                          styles.departmentMenuItemText,
                          department === item.value && styles.departmentMenuItemTextSelected,
                        ]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {departmentDropdownOpen && college && filteredDepartments.length === 0 && departmentInput.trim() !== '' && (
                <View style={styles.customDropdownMenu}>
                  <Text style={styles.noResultsText}>No departments found</Text>
                </View>
              )}
            </View>
          )}

          
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
                const formatted = text.replace(/^(\d{4})\/?/, '$1/');
                setMatricNumber(formatted);
                setErrors((prev) => ({ ...prev, matricNumber: false }));
                setErrorMessage('');
              }}
              keyboardType="numeric"
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
  );

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
            <FlatList 
              data={[{ key: 'form' }]}
              renderItem={() => renderFormContent()}
              keyExtractor={(item) => item.key}
              scrollEnabled={!(levelOpen || collegeOpen || departmentDropdownOpen)}
              nestedScrollEnabled={true}
              contentContainerStyle={{ paddingTop: 30, paddingBottom: 50, paddingHorizontal: 0 }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3b82f6']} />
              }
            />
          </KeyboardAvoidingView>
        </SafeAreaView>
      )}

      {/* iOS-style Bottom Modal for Terms */}
      {Platform.OS !== 'web' ? (
        <IOSBottomModal
          visible={termsModalVisible}
          onClose={() => setTermsModalVisible(false)}
        >
          <FlatList
            data={[{ key: 'terms' }]}
            renderItem={() => (
              <View style={styles.iosModalScroll}>
                <Text style={styles.iosModalTitle}>Terms and Conditions</Text>
                <Text style={styles.iosModalText}>
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
              </View>
            )}
            keyExtractor={(item) => item.key}
            scrollEnabled={true}
          />
          <TouchableOpacity
            style={styles.iosModalCloseButton}
            onPress={() => setTermsModalVisible(false)}
          >
            <Text style={styles.iosModalCloseButtonText}>Understood</Text>
          </TouchableOpacity>
        </IOSBottomModal>
      ) : (
        // Web Modal
        <Modal
          animationType="slide"
          transparent={true}
          visible={termsModalVisible}
          onRequestClose={() => setTermsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Terms and Conditions</Text>
              <FlatList
                data={[{ key: 'content' }]}
                renderItem={() => (
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
                )}
                keyExtractor={(item) => item.key}
                scrollEnabled={true}
              />
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setTermsModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

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
    paddingTop: 40,
    paddingBottom: 40,
  },
  container: {
    paddingHorizontal: 20,
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
    left: 12,
    top: '50%',
    marginTop: -10,
    zIndex: 10,
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
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    color: '#1e293b',
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
  dropdownContainerWrapper: {
    marginBottom: 20,
    position: 'relative',
  },
  dropdownIcon: {
    position: 'absolute',
    left: 12,
    top: 17,
    zIndex: 10,
  },
  dropdown: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    paddingLeft: 40,
    paddingRight: 12,
    height: 55,
    justifyContent: 'center',
  },
  dropdownError: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
  },
  dropdownMenu: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 5,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#1e293b',
  },
  dropdownPlaceholder: {
    fontSize: 16,
    color: '#94a3b8',
  },
  arrowIcon: {
    marginRight: 12,
  },
  departmentInputWrapper: {
    position: 'relative',
  },
  departmentInput: {
    paddingRight: 50,
  },
  validIcon: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -10,
    zIndex: 10,
  },
  invalidIcon: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -10,
    zIndex: 10,
  },
  customDropdownMenu: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 5,
    maxHeight: 200,
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 5000,
    overflow: 'hidden',
  },
  departmentMenuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  departmentMenuItemSelected: {
    backgroundColor: '#eff6ff',
  },
  departmentMenuItemText: {
    fontSize: 14,
    color: '#1e293b',
  },
  departmentMenuItemTextSelected: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  noResultsText: {
    fontSize: 14,
    color: '#ef4444',
    padding: 16,
    textAlign: 'center',
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
    color: '#1e293b',
  },
  roleButtonTextSelected: {
    color: '#ffffff',
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
  iosModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end',
  },
  iosModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 0,
    maxHeight: '80%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  iosModalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    backgroundColor: '#cbd5e1',
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 15,
  },
  iosModalScroll: {
    paddingHorizontal: 20,
    maxHeight: '65%',
  },
  iosModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 15,
    textAlign: 'center',
  },
  iosModalText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 20,
  },
  iosModalCloseButton: {
    backgroundColor: '#3b82f6',
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 15,
  },
  iosModalCloseButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
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