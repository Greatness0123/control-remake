import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
  Switch
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
  setDoc
} from 'firebase/firestore';
import { FluentTheme } from '../components/theme';
import { FluentText } from '../components/FluentText';
import { FluentButton } from '../components/FluentButton';
import { FluentCard } from '../components/FluentCard';
import { FluentInput } from '../components/FluentInput';
import { FluentLayoutShell } from '../components/FluentLayoutShell';
import {
  ArrowLeft,
  UserPlus,
  Shield,
  UserCheck
} from 'lucide-react-native';

const CourseRepManagementScreen = ({ navigation, route }) => {
  const { courseId } = route.params;
  const [course, setCourse] = useState(null);
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [matricNumber, setMatricNumber] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundStudent, setFoundStudent] = useState(null);
  const [permissions, setPermissions] = useState({ takeAttendance: false, manageSessions: false, exportPdf: false });
  const [inviting, setInviting] = useState(false);

  useEffect(() => { fetchCourse(); fetchGrants(); }, [courseId]);

  const fetchCourse = async () => {
    const courseDoc = await getDoc(doc(firestore, 'courses', courseId));
    if (courseDoc.exists()) setCourse({ id: courseDoc.id, ...courseDoc.data() });
  };

  const fetchGrants = async () => {
    try {
      const q = query(collection(firestore, 'courseRepGrants'), where('courseId', '==', courseId));
      const snapshot = await getDocs(q);
      const grantsData = await Promise.all(snapshot.docs.map(async (grantDoc) => {
        const data = grantDoc.data();
        const studentDoc = await getDoc(doc(firestore, 'students', data.repStudentId));
        return { id: grantDoc.id, ...data, studentName: studentDoc.exists() ? studentDoc.data().fullName : 'Unknown', matricNumber: studentDoc.exists() ? studentDoc.data().matricNumber : 'N/A' };
      }));
      setGrants(grantsData);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSearchStudent = async () => {
    if (!matricNumber.trim()) return;
    setSearching(true);
    setFoundStudent(null);
    try {
      const q = query(collection(firestore, 'students'), where('matricNumber', '==', matricNumber.trim()));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) setFoundStudent({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      else Alert.alert('Not Found', 'No student found');
    } catch (e) { Alert.alert('Error', 'Search failed'); }
    finally { setSearching(false); }
  };

  const handleInviteRep = async () => {
    if (!foundStudent) return;
    setInviting(true);
    try {
      const grantId = `${courseId}_${foundStudent.id}`;
      await setDoc(doc(firestore, 'courseRepGrants', grantId), { courseId, lecturerId: auth.currentUser.uid, repStudentId: foundStudent.id, status: 'pending', permissions, invitedAt: Timestamp.now(), acceptedAt: null, revokedAt: null });
      Alert.alert('Success', 'Invite sent');
      setInviteModalVisible(false);
      fetchGrants();
    } catch (e) { Alert.alert('Error', 'Invite failed'); }
    finally { setInviting(false); }
  };

  const handleRevokeGrant = async (grantId) => {
    try {
      await updateDoc(doc(firestore, 'courseRepGrants', grantId), { status: 'revoked', revokedAt: Timestamp.now() });
      fetchGrants();
    } catch (e) { Alert.alert('Error', 'Revoke failed'); }
  };

  const renderGrantItem = ({ item }) => (
    <FluentCard style={styles.grantCard}>
      <View style={styles.grantHeader}><View style={{ flex: 1 }}><FluentText variant="body" weight="semibold">{item.studentName}</FluentText><FluentText variant="caption" color="neutralTextSecondary">{item.matricNumber}</FluentText></View><View style={[styles.statusBadge, { backgroundColor: item.status === 'active' ? FluentTheme.colors.success : FluentTheme.colors.warning }]}><FluentText variant="caption" weight="bold" color="white">{item.status.toUpperCase()}</FluentText></View></View>
      <View style={styles.permissionsList}><PermissionBadge active={item.permissions.takeAttendance} label="Attend" /><PermissionBadge active={item.permissions.manageSessions} label="Manage" /><PermissionBadge active={item.permissions.exportPdf} label="PDF" /></View>
      {item.status !== 'revoked' && <FluentButton title="Revoke" variant="outline" size="small" onPress={() => handleRevokeGrant(item.id)} style={{ borderColor: FluentTheme.colors.error }} />}
    </FluentCard>
  );

  const PermissionBadge = ({ active, label }) => (
    <View style={[styles.permBadge, { borderColor: active ? FluentTheme.colors.accent : FluentTheme.colors.neutralBorder }]}><Shield size={12} color={active ? FluentTheme.colors.accent : FluentTheme.colors.neutralBorderStrong} /><FluentText variant="caption" style={{ marginLeft: 4, color: active ? FluentTheme.colors.accent : FluentTheme.colors.neutralTextSecondary }}>{label}</FluentText></View>
  );

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={FluentTheme.colors.accent} /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <FluentLayoutShell variant="narrow">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}><ArrowLeft color={FluentTheme.colors.neutralText} size={24} /></TouchableOpacity>
          <View style={styles.headerTitle}><FluentText variant="title" weight="bold">Course Reps</FluentText><FluentText variant="caption" color="neutralTextSecondary">{course?.code}</FluentText></View>
          <TouchableOpacity style={styles.iconButton} onPress={() => setInviteModalVisible(true)}><UserPlus color={FluentTheme.colors.accent} size={22} /></TouchableOpacity>
        </View>
        <FlatList data={grants} renderItem={renderGrantItem} keyExtractor={item => item.id} contentContainerStyle={styles.listContent} ListEmptyComponent={<View style={styles.emptyState}><Shield color={FluentTheme.colors.neutralBorderStrong} size={48} /><FluentText variant="body" color="neutralTextSecondary" style={{ marginTop: 12 }}>No reps assigned.</FluentText></View>} />
      </FluentLayoutShell>
      <Modal visible={inviteModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <FluentLayoutShell variant="narrow">
            <FluentCard style={styles.modalContent}>
              <FluentText variant="title" weight="bold" style={{ marginBottom: 20 }}>Invite Rep</FluentText>
              <View style={styles.searchRow}><View style={{ flex: 1 }}><FluentInput label="Matric Number" value={matricNumber} onChangeText={setMatricNumber} /></View><FluentButton title="Search" variant="outline" loading={searching} onPress={handleSearchStudent} style={{ marginTop: 22, marginLeft: 8 }} /></View>
              {foundStudent && <View style={styles.foundStudentCard}><UserCheck size={20} color={FluentTheme.colors.success} /><View style={{ marginLeft: 12 }}><FluentText variant="body" weight="semibold">{foundStudent.fullName}</FluentText></View></View>}
              <PermissionSwitch label="Take Attendance" value={permissions.takeAttendance} onToggle={() => setPermissions(p => ({ ...p, takeAttendance: !p.takeAttendance }))} />
              <PermissionSwitch label="Manage Sessions" value={permissions.manageSessions} onToggle={() => setPermissions(p => ({ ...p, manageSessions: !p.manageSessions }))} />
              <PermissionSwitch label="Export PDF" value={permissions.exportPdf} onToggle={() => setPermissions(p => ({ ...p, exportPdf: !p.exportPdf }))} />
              <View style={styles.modalActions}><FluentButton title="Cancel" variant="ghost" onPress={() => setInviteModalVisible(false)} style={{ flex: 1, marginRight: 8 }} /><FluentButton title="Invite" variant="primary" loading={inviting} disabled={!foundStudent} onPress={handleInviteRep} style={{ flex: 1 }} /></View>
            </FluentCard>
          </FluentLayoutShell>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const PermissionSwitch = ({ label, value, onToggle }) => (
  <View style={styles.permSwitchRow}><FluentText variant="body">{label}</FluentText><Switch value={value} onValueChange={onToggle} trackColor={{ false: FluentTheme.colors.neutralBorder, true: FluentTheme.colors.accent + '80' }} thumbColor={value ? FluentTheme.colors.accent : FluentTheme.colors.white} /></View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FluentTheme.colors.neutralLayer },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: FluentTheme.colors.white, borderBottomWidth: 1, borderBottomColor: FluentTheme.colors.neutralBorder },
  iconButton: { padding: 8 },
  headerTitle: { flex: 1, marginLeft: 8 },
  listContent: { padding: 20 },
  grantCard: { marginBottom: 12, padding: 16 },
  grantHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  permissionsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  permBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalContent: { width: '100%' },
  searchRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  foundStudentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: FluentTheme.colors.neutralBackground2, padding: 12, borderRadius: 8, marginBottom: 16 },
  permSwitchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  modalActions: { flexDirection: 'row', marginTop: 24 }
});

export default CourseRepManagementScreen;
