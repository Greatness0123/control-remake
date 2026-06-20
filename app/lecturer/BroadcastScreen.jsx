import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Switch,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Alert,
  Modal,
  FlatList,
  TouchableOpacity
} from 'react-native';
import { auth, firestore } from '../../config/firebaseconfig';
import {
  collection,
  addDoc,
  Timestamp,
  getDoc,
  doc,
  GeoPoint,
  query,
  where,
  getDocs,
  onSnapshot,
  updateDoc
} from 'firebase/firestore';
import { FluentTheme } from '../components/theme';
import { FluentText } from '../components/FluentText';
import { FluentButton } from '../components/FluentButton';
import { FluentCard } from '../components/FluentCard';
import { FluentInput } from '../components/FluentInput';
import { FluentLayoutShell } from '../components/FluentLayoutShell';
import {
  ArrowLeft,
  PlayCircle,
  MapPin,
  Users,
  StopCircle,
  QrCode,
  Share2,
  UserPlus,
  MessageSquare,
  BookOpen
} from 'lucide-react-native';
import { getCurrentLocation, getPlatformIdentifier } from '../../utils/locationHelpers';
import QRCode from 'react-native-qrcode-svg';

const LecturerBroadcast = ({ navigation, route }) => {
  const { courseId, isRep } = route.params || {};

  const [course, setCourse] = useState(null);
  const [sessionName, setSessionName] = useState('');
  const [radius, setRadius] = useState('15');
  const [useLocation, setUseLocation] = useState(true);
  const [loading, setLoading] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [qrModalVisible, setQrModalVisible] = useState(false);

  useEffect(() => {
    if (courseId) {
      getDoc(doc(firestore, 'courses', courseId)).then(snap => {
        if (snap.exists()) setCourse(snap.data());
      });
    }
    const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    setSessionName(today);
  }, [courseId]);

  const startSession = async () => {
    if (!courseId) return Alert.alert('Error', 'No course selected');
    setLoading(true);
    try {
      const user = auth.currentUser;
      let location = null;
      if (useLocation) location = await getCurrentLocation();

      const sessionData = {
        courseId,
        createdBy: user.uid,
        createdByRole: isRep ? 'rep' : 'lecturer',
        sessionName: sessionName || new Date().toLocaleDateString(),
        startedAt: Timestamp.now(),
        endedAt: null,
        radiusMeters: useLocation ? parseFloat(radius) : 0,
        status: 'active',
        useLocation,
        broadcasterPlatform: getPlatformIdentifier(),
        coordinates: location ? new GeoPoint(location.latitude, location.longitude) : null
      };

      const docRef = await addDoc(collection(firestore, 'attendanceSessions'), sessionData);
      setActiveSession({ id: docRef.id, ...sessionData });

      if (isRep) {
        await addDoc(collection(firestore, 'repActivityLog'), {
          courseId, repId: user.uid, action: 'session_started', targetSessionId: docRef.id, createdAt: Timestamp.now()
        });
      }
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };

  const stopSession = async () => {
    if (!activeSession) return;
    try {
      await updateDoc(doc(firestore, 'attendanceSessions', activeSession.id), { status: 'ended', endedAt: Timestamp.now() });
      if (isRep) {
        await addDoc(collection(firestore, 'repActivityLog'), {
          courseId, repId: auth.currentUser.uid, action: 'session_ended', targetSessionId: activeSession.id, createdAt: Timestamp.now()
        });
      }
      setActiveSession(null);
      Alert.alert('Ended', 'Attendance session has been closed.');
    } catch (e) { Alert.alert('Error', 'Failed to end session'); }
  };

  useEffect(() => {
    if (activeSession) {
      const unsubscribe = onSnapshot(collection(firestore, `attendanceSessions/${activeSession.id}/checkIns`), (snap) => {
        setParticipants(snap.docs.map(d => d.data()));
      });
      return () => unsubscribe();
    }
  }, [activeSession]);

  if (activeSession) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <FluentLayoutShell variant="wide">
          <View style={styles.header}>
            <FluentText variant="title" weight="bold" style={{ flex: 1 }}>Session Active</FluentText>
            <FluentButton title="End Session" variant="outline" size="small" icon={StopCircle} onPress={stopSession} style={{ borderColor: FluentTheme.colors.error }} />
          </View>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <FluentCard style={styles.activeCard}>
              <FluentText variant="header" weight="bold" color="accent">{activeSession.sessionName}</FluentText>
              <FluentText variant="body" color="neutralTextSecondary">{course?.code} - {course?.title}</FluentText>
              <View style={styles.statsRow}>
                <View style={styles.statItem}><FluentText variant="title" weight="bold">{participants.length}</FluentText><FluentText variant="caption">Present</FluentText></View>
              </View>
              <View style={styles.actionGrid}>
                <TouchableOpacity style={styles.gridBtn} onPress={() => setQrModalVisible(true)}><QrCode size={24} color={FluentTheme.colors.accent} /><FluentText variant="caption">Show QR</FluentText></TouchableOpacity>
                <TouchableOpacity style={styles.gridBtn}><Share2 size={24} color={FluentTheme.colors.accent} /><FluentText variant="caption">Share Link</FluentText></TouchableOpacity>
                <TouchableOpacity style={styles.gridBtn}><UserPlus size={24} color={FluentTheme.colors.accent} /><FluentText variant="caption">Manual Add</FluentText></TouchableOpacity>
                <TouchableOpacity style={styles.gridBtn}><MessageSquare size={24} color={FluentTheme.colors.accent} /><FluentText variant="caption">Broadcast</FluentText></TouchableOpacity>
              </View>
            </FluentCard>

            <FluentText variant="subtitle" weight="bold" style={{ marginVertical: 16 }}>Recent Check-ins</FluentText>
            {participants.map((p, i) => (
              <FluentCard key={i} style={styles.participantItem}>
                <View><FluentText weight="semibold">{p.fullName}</FluentText><FluentText variant="caption" color="neutralTextSecondary">{p.matricNumber}</FluentText></View>
              </FluentCard>
            ))}
          </ScrollView>
        </FluentLayoutShell>

        <Modal visible={qrModalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <FluentCard style={styles.modalContent}>
              <FluentText variant="title" weight="bold" style={{ textAlign: 'center', marginBottom: 20 }}>Scan to Check In</FluentText>
              <View style={{ alignItems: 'center', padding: 20, backgroundColor: 'white', borderRadius: 12 }}><QRCode value={activeSession.id} size={250} /></View>
              <FluentButton title="Close" variant="primary" style={{ marginTop: 20 }} onPress={() => setQrModalVisible(false)} />
            </FluentCard>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <FluentLayoutShell variant="narrow">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}><ArrowLeft size={24} color={FluentTheme.colors.neutralText} /></TouchableOpacity>
          <FluentText variant="title" weight="bold" style={{ marginLeft: 16 }}>New Attendance</FluentText>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <FluentCard>
            <FluentInput label="Session Name" value={sessionName} onChangeText={setSessionName} />
            <View style={styles.switchRow}><View style={{ flex: 1 }}><FluentText weight="semibold">Use Geofencing</FluentText><FluentText variant="caption" color="neutralTextSecondary">Students must be in range</FluentText></View><Switch value={useLocation} onValueChange={setUseLocation} /></View>
            {useLocation && <FluentInput label="Radius (meters)" value={radius} onChangeText={setRadius} keyboardType="numeric" />}
            <FluentButton title="Start Session" icon={PlayCircle} loading={loading} onPress={startSession} style={{ marginTop: 24 }} />
          </FluentCard>
        </ScrollView>
      </FluentLayoutShell>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FluentTheme.colors.neutralLayer },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: FluentTheme.colors.neutralBorder },
  scrollContent: { padding: 20 },
  activeCard: { padding: 24, alignItems: 'center' },
  statsRow: { flexDirection: 'row', marginVertical: 20 },
  statItem: { alignItems: 'center' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', borderTopWidth: 1, borderTopColor: FluentTheme.colors.neutralBorder, paddingTop: 20 },
  gridBtn: { width: '25%', alignItems: 'center', gap: 8 },
  participantItem: { marginBottom: 8, padding: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalContent: { width: '100%' }
});

export default LecturerBroadcast;
