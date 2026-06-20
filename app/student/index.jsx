import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert
} from 'react-native';
import { auth, firestore } from '../../config/firebaseconfig';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { FluentTheme } from '../components/theme';
import { FluentText } from '../components/FluentText';
import { FluentButton } from '../components/FluentButton';
import { FluentCard } from '../components/FluentCard';
import { FluentLayoutShell } from '../components/FluentLayoutShell';
import {
  LogOut,
  User,
  BookOpen,
  ShieldCheck,
  History,
  ChevronRight,
  Bell
} from 'lucide-react-native';

const StudentDashboard = ({ navigation }) => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [grants, setGrants] = useState([]);

  useEffect(() => {
    fetchData();
    const unsubscribeGrants = subscribeToGrants();
    return () => {
      if (unsubscribeGrants) unsubscribeGrants();
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      const studentDoc = await getDoc(doc(firestore, 'students', user.uid));
      if (studentDoc.exists()) setUserData(studentDoc.data());
    } catch (error) {
      console.error('Error fetching student data:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToGrants = () => {
    const user = auth.currentUser;
    if (!user) return null;

    const q = query(collection(firestore, 'courseRepGrants'), where('repStudentId', '==', user.uid));

    return onSnapshot(q, async (snapshot) => {
      const grantsData = await Promise.all(snapshot.docs.map(async (grantDoc) => {
        const data = grantDoc.data();
        const courseDoc = await getDoc(doc(firestore, 'courses', data.courseId));
        const lecturerDoc = await getDoc(doc(firestore, 'teachers', data.lecturerId));

        return {
          id: grantDoc.id,
          ...data,
          courseCode: courseDoc.exists() ? courseDoc.data().code : 'N/A',
          courseTitle: courseDoc.exists() ? courseDoc.data().title : 'Unknown Course',
          lecturerName: lecturerDoc.exists() ? lecturerDoc.data().fullName : 'Unknown Lecturer'
        };
      }));
      setGrants(grantsData);
    });
  };

  const handleAcceptInvite = async (grantId) => {
    try {
      await updateDoc(doc(firestore, 'courseRepGrants', grantId), {
        status: 'active',
        acceptedAt: Timestamp.now()
      });
      Alert.alert('Success', 'You are now a Course Rep!');
    } catch (error) {
      Alert.alert('Error', 'Failed to accept invite');
    }
  };

  const handleDeclineInvite = async (grantId) => {
    try {
      await updateDoc(doc(firestore, 'courseRepGrants', grantId), {
        status: 'revoked',
        revokedAt: Timestamp.now()
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to decline invite');
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

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={FluentTheme.colors.accent} /></View>;

  const pendingInvites = grants.filter(g => g.status === 'pending');
  const activeGrants = grants.filter(g => g.status === 'active');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <FluentLayoutShell variant="wide">
        <View style={styles.header}>
          <View>
            <FluentText variant="header" weight="bold">BellsAttend+</FluentText>
            <FluentText variant="body" color="neutralTextSecondary">Student Portal</FluentText>
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
                <FluentText variant="title" weight="semibold">{userData?.fullName || 'Student'}</FluentText>
                <FluentText variant="caption" color="neutralTextSecondary">{userData?.matricNumber}</FluentText>
              </View>
            </View>
          </FluentCard>

          {pendingInvites.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Bell size={18} color={FluentTheme.colors.warning} />
                <FluentText variant="subtitle" weight="bold" style={{ marginLeft: 8 }}>Pending Rep Invites</FluentText>
              </View>
              {pendingInvites.map(invite => (
                <FluentCard key={invite.id} style={styles.inviteCard}>
                  <FluentText variant="body" weight="semibold">{invite.courseCode}: {invite.courseTitle}</FluentText>
                  <FluentText variant="caption" color="neutralTextSecondary">Invited by: {invite.lecturerName}</FluentText>
                  <View style={styles.inviteActions}>
                    <FluentButton title="Decline" variant="ghost" size="small" onPress={() => handleDeclineInvite(invite.id)} style={{ flex: 1, marginRight: 8 }} />
                    <FluentButton title="Accept" variant="primary" size="small" onPress={() => handleAcceptInvite(invite.id)} style={{ flex: 1 }} />
                  </View>
                </FluentCard>
              ))}
            </View>
          )}

          {activeGrants.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ShieldCheck size={18} color={FluentTheme.colors.accent} />
                <FluentText variant="subtitle" weight="bold" style={{ marginLeft: 8 }}>Course Rep Access</FluentText>
              </View>
              {activeGrants.map(grant => (
                <TouchableOpacity key={grant.id} onPress={() => navigation.navigate('RepCourseDetails', { courseId: grant.courseId, grantId: grant.id })}>
                  <FluentCard style={styles.grantCard}>
                    <View style={styles.grantInfo}>
                      <View style={{ flex: 1 }}>
                        <FluentText variant="body" weight="semibold">{grant.courseCode}</FluentText>
                        <FluentText variant="caption" color="neutralTextSecondary">{grant.courseTitle}</FluentText>
                      </View>
                      <ChevronRight size={20} color={FluentTheme.colors.neutralBorderStrong} />
                    </View>
                  </FluentCard>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <History size={18} color={FluentTheme.colors.neutralText} />
              <FluentText variant="subtitle" weight="bold" style={{ marginLeft: 8 }}>Your Attendance</FluentText>
            </View>
            <FluentButton title="Join Attendance Broadcast" variant="primary" icon={BookOpen} onPress={() => navigation.navigate('StudentBroadcastScreen')} style={{ marginBottom: 16 }} />
            <FluentButton title="View Attendance History" variant="outline" icon={History} onPress={() => navigation.navigate('StudentAttendanceHistory')} />
          </View>
        </ScrollView>
      </FluentLayoutShell>
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
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  inviteCard: { marginBottom: 12, borderLeftWidth: 4, borderLeftColor: FluentTheme.colors.warning },
  inviteActions: { flexDirection: 'row', marginTop: 12 },
  grantCard: { marginBottom: 12 },
  grantInfo: { flexDirection: 'row', alignItems: 'center' }
});

export default StudentDashboard;
