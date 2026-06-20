import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal
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
  orderBy,
  addDoc
} from 'firebase/firestore';
import { FluentTheme } from '../components/theme';
import { FluentText } from '../components/FluentText';
import { FluentButton } from '../components/FluentButton';
import { FluentCard } from '../components/FluentCard';
import { FluentInput } from '../components/FluentInput';
import { FluentLayoutShell } from '../components/FluentLayoutShell';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Edit2,
  Plus,
  FileDown,
  ChevronRight,
  ShieldCheck
} from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const RepCourseDetailsScreen = ({ navigation, route }) => {
  const { courseId, grantId } = route.params;
  const [course, setCourse] = useState(null);
  const [grant, setGrant] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingSession, setEditingSession] = useState(null);
  const [newSessionName, setNewSessionName] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [courseId]);

  const fetchData = async () => {
    try {
      const courseDoc = await getDoc(doc(firestore, 'courses', courseId));
      if (courseDoc.exists()) setCourse({ id: courseDoc.id, ...courseDoc.data() });

      const grantDoc = await getDoc(doc(firestore, 'courseRepGrants', grantId));
      if (grantDoc.exists()) setGrant(grantDoc.data());

      const q = query(collection(firestore, 'attendanceSessions'), where('courseId', '==', courseId), orderBy('startedAt', 'desc'));
      const snapshot = await getDocs(q);
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRenameSession = async () => {
    if (!newSessionName.trim() || !editingSession) return;
    try {
      const oldName = editingSession.sessionName;
      await updateDoc(doc(firestore, 'attendanceSessions', editingSession.id), { sessionName: newSessionName.trim() });

      await addDoc(collection(firestore, 'repActivityLog'), {
        courseId,
        repId: auth.currentUser.uid,
        action: 'session_renamed',
        targetSessionId: editingSession.id,
        metadata: { oldName, newName: newSessionName.trim() },
        createdAt: Timestamp.now()
      });

      setEditingSession(null);
      setNewSessionName('');
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to rename session');
    }
  };

  const compileCoursePDF = async () => {
    setExporting(true);
    try {
      if (sessions.length === 0) return Alert.alert('Info', 'No sessions');
      const studentMatrix = {};
      for (const session of sessions) {
        const participantsSnapshot = await getDocs(collection(firestore, `attendanceSessions/${session.id}/checkIns`));
        participantsSnapshot.forEach(doc => {
          const data = doc.data();
          if (!studentMatrix[doc.id]) studentMatrix[doc.id] = { fullName: data.fullName, matricNumber: data.matricNumber, attendance: {} };
          studentMatrix[doc.id].attendance[session.id] = data.decision;
        });
      }
      const students = Object.values(studentMatrix).sort((a, b) => a.fullName.localeCompare(b.fullName));
      const tableHeaders = sessions.map(s => `<th style="font-size: 8px; transform: rotate(-45deg); height: 80px;">${s.sessionName}</th>`).join('');
      const tableRows = students.map((student, idx) => {
        const rowCells = sessions.map(session => {
          const decision = student.attendance[session.id];
          let status = '—', color = '#ccc';
          if (decision === 'allow' || decision === 'allow_flagged') { status = 'P'; color = decision === 'allow' ? '#107C10' : '#D83B01'; }
          else if (decision === 'reject') { status = 'A'; color = '#C50F1F'; }
          return `<td style="text-align: center; color: ${color}; font-weight: bold;">${status}</td>`;
        }).join('');
        const presentCount = sessions.filter(s => student.attendance[s.id] === 'allow' || student.attendance[s.id] === 'allow_flagged').length;
        const percentage = ((presentCount / sessions.length) * 100).toFixed(0);
        return `<tr><td>${idx + 1}</td><td>${student.fullName}</td><td>${student.matricNumber}</td>${rowCells}<td style="font-weight: bold;">${percentage}%</td></tr>`;
      }).join('');

      const html = `<html><body><h1>Attendance report: ${course.code}</h1><table><thead><tr><th>#</th><th>Name</th><th>Matric</th>${tableHeaders}<th>%</th></tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
      const { uri } = await Print.printToFileAsync({ html });

      await addDoc(collection(firestore, 'repActivityLog'), {
        courseId,
        repId: auth.currentUser.uid,
        action: 'pdf_exported',
        createdAt: Timestamp.now()
      });

      await Sharing.shareAsync(uri);
    } catch (e) { Alert.alert('Error', 'Failed to export'); }
    finally { setExporting(false); }
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={FluentTheme.colors.accent} /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <FluentLayoutShell variant="wide">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
            <ArrowLeft color={FluentTheme.colors.neutralText} size={24} />
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <FluentText variant="title" weight="bold">{course?.code}</FluentText>
              <View style={styles.repBadge}><ShieldCheck size={12} color="white" /><FluentText variant="caption" color="white" weight="bold" style={{ marginLeft: 4 }}>REP</FluentText></View>
            </View>
            <FluentText variant="caption" color="neutralTextSecondary">{course?.title}</FluentText>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.actionRow}>
            <FluentButton
              title="New Attendance"
              variant="primary"
              icon={Plus}
              disabled={!grant?.permissions.takeAttendance}
              onPress={() => navigation.navigate('TeacherBroadcastScreen', { courseId, courseCode: course.code, isRep: true })}
              style={{ flex: 1, marginRight: 8 }}
            />
            <FluentButton
              title="Export PDF"
              variant="outline"
              icon={FileDown}
              loading={exporting}
              disabled={!grant?.permissions.exportPdf}
              onPress={compileCoursePDF}
              style={{ flex: 1 }}
            />
          </View>

          <View style={styles.sectionHeader}><FluentText variant="subtitle" weight="bold">Sessions</FluentText></View>

          {sessions.map(session => (
            <TouchableOpacity key={session.id} onPress={() => navigation.navigate('SessionDetails', { sessionId: session.id, courseCode: course.code })}>
              <FluentCard style={styles.sessionCard}>
                <View style={styles.sessionInfo}>
                  <View style={{ flex: 1 }}>
                    <FluentText variant="body" weight="semibold">{session.sessionName}</FluentText>
                    <View style={styles.sessionMeta}><Clock size={12} color={FluentTheme.colors.neutralTextSecondary} /><FluentText variant="caption" color="neutralTextSecondary" style={{ marginLeft: 4 }}>{session.startedAt?.toDate().toLocaleDateString()}</FluentText></View>
                  </View>
                  {grant?.permissions.manageSessions && (
                    <TouchableOpacity onPress={() => { setEditingSession(session); setNewSessionName(session.sessionName); }}><Edit2 size={18} color={FluentTheme.colors.accent} /></TouchableOpacity>
                  )}
                  <ChevronRight size={20} color={FluentTheme.colors.neutralBorderStrong} style={{ marginLeft: 8 }} />
                </View>
              </FluentCard>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </FluentLayoutShell>

      <Modal visible={!!editingSession} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <FluentLayoutShell variant="narrow">
            <FluentCard style={styles.modalContent}>
              <FluentText variant="subtitle" weight="bold" style={{ marginBottom: 16 }}>Rename Session</FluentText>
              <FluentInput value={newSessionName} onChangeText={setNewSessionName} placeholder="Session Name" />
              <View style={styles.modalActions}>
                <FluentButton title="Cancel" variant="ghost" onPress={() => setEditingSession(null)} style={{ flex: 1, marginRight: 8 }} />
                <FluentButton title="Save" variant="primary" onPress={handleRenameSession} style={{ flex: 1 }} />
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: FluentTheme.colors.white, borderBottomWidth: 1, borderBottomColor: FluentTheme.colors.neutralBorder },
  iconButton: { padding: 8 },
  headerTitle: { flex: 1, marginLeft: 8 },
  repBadge: { backgroundColor: FluentTheme.colors.accent, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  scrollContent: { padding: 20 },
  actionRow: { flexDirection: 'row', marginBottom: 24 },
  sectionHeader: { marginBottom: 16 },
  sessionCard: { marginBottom: 12, padding: 12 },
  sessionInfo: { flexDirection: 'row', alignItems: 'center' },
  sessionMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalContent: { width: '100%' },
  modalActions: { flexDirection: 'row', marginTop: 12 }
});

export default RepCourseDetailsScreen;
