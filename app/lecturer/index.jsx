import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  FlatList
} from 'react-native';
import { auth, firestore } from '../../config/firebaseconfig';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  Timestamp,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  limit
} from 'firebase/firestore';
import { FluentTheme } from '../components/theme';
import { FluentText } from '../components/FluentText';
import { FluentButton } from '../components/FluentButton';
import { FluentCard } from '../components/FluentCard';
import { FluentInput } from '../components/FluentInput';
import { FluentBanner } from '../components/FluentBanner';
import { FluentLayoutShell } from '../components/FluentLayoutShell';
import { LogOut, User, Plus, BookOpen, ChevronRight } from 'lucide-react-native';

const LecturerDashboard = ({ navigation }) => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lecturerData, setLecturerData] = useState(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [courseTitle, setCourseTitle] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchData();
    const unsubscribeNotifications = subscribeToRepActivity();
    return () => {
      if (unsubscribeNotifications) unsubscribeNotifications();
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      const teacherDoc = await getDoc(doc(firestore, 'teachers', user.uid));
      if (teacherDoc.exists()) setLecturerData(teacherDoc.data());

      const q = query(collection(firestore, 'courses'), where('lecturerId', '==', user.uid));
      const snapshot = await getDocs(q);
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToRepActivity = () => {
    const user = auth.currentUser;
    if (!user) return null;

    const q = query(collection(firestore, 'repActivityLog'), orderBy('createdAt', 'desc'), limit(1));

    return onSnapshot(q, async (snapshot) => {
      if (!snapshot.empty) {
        const log = snapshot.docs[0].data();
        if (Timestamp.now().seconds - log.createdAt.seconds < 10) {
          const courseDoc = await getDoc(doc(firestore, 'courses', log.courseId));
          if (courseDoc.exists() && courseDoc.data().lecturerId === user.uid) {
            const courseData = courseDoc.data();
            const studentDoc = await getDoc(doc(firestore, 'students', log.repId));
            const repName = studentDoc.exists() ? studentDoc.data().fullName : 'A Rep';

            let actionText = 'performed an action';
            if (log.action === 'session_started') actionText = 'started a session';
            if (log.action === 'session_ended') actionText = 'ended a session';
            if (log.action === 'session_renamed') actionText = 'renamed a session';
            if (log.action === 'pdf_exported') actionText = 'exported a PDF';

            setNotification(`${repName} ${actionText} for ${courseData.code}`);
          }
        }
      }
    });
  };

  const handleCreateCourse = async () => {
    if (!courseTitle.trim() || !courseCode.trim()) return;
    setCreating(true);
    try {
      const user = auth.currentUser;
      await addDoc(collection(firestore, 'courses'), {
        lecturerId: user.uid,
        title: courseTitle,
        code: courseCode.toUpperCase(),
        createdAt: Timestamp.now(),
      });
      setCourseTitle('');
      setCourseCode('');
      setCreateModalVisible(false);
      fetchData();
    } catch (error) {
      console.error('Error creating course:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const renderCourseItem = ({ item }) => (
    <TouchableOpacity onPress={() => navigation.navigate('TeacherCourseDetails', { courseId: item.id })}>
      <FluentCard style={styles.courseCard}>
        <View style={styles.courseHeader}>
          <View style={styles.courseIconContainer}><BookOpen color={FluentTheme.colors.accent} size={24} /></View>
          <View style={{ flex: 1 }}>
            <FluentText variant="title" weight="semibold">{item.code}</FluentText>
            <FluentText variant="body" color="neutralTextSecondary">{item.title}</FluentText>
          </View>
          <ChevronRight color={FluentTheme.colors.neutralBorderStrong} size={20} />
        </View>
      </FluentCard>
    </TouchableOpacity>
  );

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={FluentTheme.colors.accent} /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <FluentBanner visible={!!notification} message={notification} type="info" onHide={() => setNotification(null)} />

      <FluentLayoutShell variant="wide">
        <View style={styles.header}>
          <View>
            <FluentText variant="header" weight="bold">BellsAttend+</FluentText>
            <FluentText variant="body" color="neutralTextSecondary">Lecturer Portal</FluentText>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.iconButton}>
            <LogOut color={FluentTheme.colors.error} size={22} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <FluentCard style={styles.profileCard}>
            <View style={styles.profileInfo}>
              <View style={styles.avatar}><User color={FluentTheme.colors.accent} size={32} /></View>
              <View>
                <FluentText variant="title" weight="semibold">{lecturerData?.fullName || 'Lecturer'}</FluentText>
                <FluentText variant="caption" color="neutralTextSecondary">{lecturerData?.email || auth.currentUser?.email}</FluentText>
              </View>
            </View>
          </FluentCard>

          <View style={styles.sectionHeader}>
            <FluentText variant="subtitle" weight="bold">Your Courses</FluentText>
            <FluentButton title="Create" size="small" variant="outline" icon={Plus} onPress={() => setCreateModalVisible(true)} />
          </View>

          {courses.length === 0 ? (
            <View style={styles.emptyState}>
              <BookOpen color={FluentTheme.colors.neutralBorderStrong} size={48} />
              <FluentText variant="body" color="neutralTextSecondary" style={{ marginTop: 12 }}>No courses created yet.</FluentText>
            </View>
          ) : (
            <FlatList data={courses} renderItem={renderCourseItem} keyExtractor={item => item.id} scrollEnabled={false} />
          )}
        </ScrollView>
      </FluentLayoutShell>

      <Modal visible={createModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <FluentLayoutShell variant="narrow">
            <FluentCard style={styles.modalContent}>
              <FluentText variant="title" weight="bold" style={{ marginBottom: 20 }}>Create New Course</FluentText>
              <FluentInput label="Course Code" placeholder="e.g. CSC301" value={courseCode} onChangeText={setCourseCode} />
              <FluentInput label="Course Title" placeholder="e.g. Software Engineering" value={courseTitle} onChangeText={setCourseTitle} />
              <View style={styles.modalActions}>
                <FluentButton title="Cancel" variant="ghost" onPress={() => setCreateModalVisible(false)} style={{ flex: 1, marginRight: 8 }} />
                <FluentButton title="Create" variant="primary" loading={creating} onPress={handleCreateCourse} style={{ flex: 1 }} />
              </View>
            </FluentCard>
          </FluentLayoutShell>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FluentTheme.colors.neutralLayer },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: FluentTheme.colors.white, borderBottomWidth: 1, borderBottomColor: FluentTheme.colors.neutralBorder },
  iconButton: { padding: 8 },
  scrollContent: { padding: 20 },
  profileCard: { marginBottom: 24 },
  profileInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: FluentTheme.colors.neutralBackground2, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  courseCard: { marginBottom: 12, padding: 16 },
  courseHeader: { flexDirection: 'row', alignItems: 'center' },
  courseIconContainer: { width: 44, height: 44, borderRadius: 8, backgroundColor: FluentTheme.colors.neutralBackground2, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalContent: { width: '100%' },
  modalActions: { flexDirection: 'row', marginTop: 12 }
});

export default LecturerDashboard;
