import React, { useState } from 'react';
import { 
  View, 
  TouchableOpacity, 
  StyleSheet, 
  Keyboard,
  TouchableWithoutFeedback,
  ScrollView,
  StatusBar,
  SafeAreaView,
  Alert,
  Switch
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../config/firebaseconfig';
import { doc, setDoc } from 'firebase/firestore';
import { FluentTheme } from '../components/theme';
import { FluentText } from '../components/FluentText';
import { FluentButton } from '../components/FluentButton';
import { FluentInput } from '../components/FluentInput';
import { FluentLayoutShell } from '../components/FluentLayoutShell';

const SignUpScreen = ({ navigation }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [matricNumber, setMatricNumber] = useState('');
  const [isLecturer, setIsLecturer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async () => {
    if (!fullName || !email || !password || (!isLecturer && !matricNumber)) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const collectionId = isLecturer ? 'teachers' : 'students';
      const data = {
        fullName,
        email: user.email,
        role: isLecturer ? 'Teacher' : 'Student',
        createdAt: new Date(),
      };

      if (!isLecturer) {
        data.matricNumber = matricNumber;
      }

      await setDoc(doc(db, collectionId, user.uid), data);

      Alert.alert('Success', 'Account created successfully!');
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <FluentLayoutShell variant="narrow">
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <FluentText variant="header" weight="bold" style={styles.title}>Create Account</FluentText>
            <FluentText variant="body" color="neutralTextSecondary" style={styles.subtitle}>Join BellsAttend+ today</FluentText>

            {error ? <View style={styles.errorBox}><FluentText variant="caption" color="white" weight="semibold">{error}</FluentText></View> : null}

            <FluentInput label="Full Name" placeholder="Full Name" value={fullName} onChangeText={setFullName} />
            <FluentInput label="Email Address" placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
            <FluentInput label="Password" placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />

            {!isLecturer && (
              <FluentInput label="Matric Number" placeholder="e.g. 19/1234" value={matricNumber} onChangeText={setMatricNumber} />
            )}

            <View style={styles.switchRow}>
              <FluentText variant="body">I am a Lecturer</FluentText>
              <Switch
                value={isLecturer}
                onValueChange={setIsLecturer}
                trackColor={{ false: FluentTheme.colors.neutralBorder, true: FluentTheme.colors.accent + '80' }}
                thumbColor={isLecturer ? FluentTheme.colors.accent : FluentTheme.colors.white}
              />
            </View>

            <FluentButton title="Create Account" onPress={handleSignup} loading={loading} style={styles.signUpButton} />

            <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('Login')}>
              <FluentText variant="body" color="neutralTextSecondary">Already have an account? <FluentText color="accent" weight="semibold">Sign In</FluentText></FluentText>
            </TouchableOpacity>
          </ScrollView>
        </FluentLayoutShell>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FluentTheme.colors.white },
  scrollContent: { padding: 24, justifyContent: 'center', flexGrow: 1 },
  title: { textAlign: 'center', marginBottom: 8 },
  subtitle: { textAlign: 'center', marginBottom: 32 },
  errorBox: { backgroundColor: FluentTheme.colors.error, padding: 12, borderRadius: 8, marginBottom: 16, alignItems: 'center' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingVertical: 8 },
  signUpButton: { marginTop: 16 },
  loginLink: { marginTop: 24, alignItems: 'center' }
});

export default SignUpScreen;
