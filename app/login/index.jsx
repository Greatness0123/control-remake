import React, { useState } from 'react';
import { 
  View, 
  TouchableOpacity, 
  StyleSheet, 
  Keyboard, 
  TouchableWithoutFeedback, 
  Image, 
  ScrollView, 
  StatusBar,
  SafeAreaView
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../config/firebaseconfig';
import { doc, getDoc } from 'firebase/firestore';
import { FluentTheme } from '../components/theme';
import { FluentText } from '../components/FluentText';
import { FluentButton } from '../components/FluentButton';
import { FluentInput } from '../components/FluentInput';
import { FluentLayoutShell } from '../components/FluentLayoutShell';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      const studentSnap = await getDoc(doc(db, 'students', uid));
      if (studentSnap.exists()) {
        navigation.reset({ index: 0, routes: [{ name: 'StudentScreen' }] });
        return;
      }

      const teacherSnap = await getDoc(doc(db, 'teachers', uid));
      if (teacherSnap.exists()) {
        navigation.reset({ index: 0, routes: [{ name: 'TeacherScreen' }] });
        return;
      }

      setError('User record not found');
    } catch (e) {
      setError('Invalid email or password');
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
            <View style={styles.logoContainer}>
              <Image source={require('../../assets/bells-logo.png')} style={styles.logo} />
            </View>

            <FluentText variant="header" weight="bold" style={styles.title}>Welcome Back</FluentText>
            <FluentText variant="body" color="neutralTextSecondary" style={styles.subtitle}>Sign in to your account</FluentText>

            {error ? <View style={styles.errorBox}><FluentText variant="caption" color="white" weight="semibold">{error}</FluentText></View> : null}

            <FluentInput label="Email Address" placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
            <FluentInput label="Password" placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />

            <FluentButton title="Sign In" onPress={handleLogin} loading={loading} style={styles.signInButton} />

            <TouchableOpacity style={styles.signUpLink} onPress={() => navigation.navigate('SignUp')}>
              <FluentText variant="body" color="neutralTextSecondary">Don't have an account? <FluentText color="accent" weight="semibold">Sign Up</FluentText></FluentText>
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
  logoContainer: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 100, height: 100 },
  title: { textAlign: 'center', marginBottom: 8 },
  subtitle: { textAlign: 'center', marginBottom: 32 },
  errorBox: { backgroundColor: FluentTheme.colors.error, padding: 12, borderRadius: 8, marginBottom: 16, alignItems: 'center' },
  signInButton: { marginTop: 16 },
  signUpLink: { marginTop: 24, alignItems: 'center' }
});

export default LoginScreen;
