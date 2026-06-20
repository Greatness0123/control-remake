import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { firestore } from '../../config/firebaseconfig';
import {
  collection,
  query,
  getDocs,
  getDoc,
  doc,
  orderBy
} from 'firebase/firestore';
import { FluentTheme } from '../components/theme';
import { FluentText } from '../components/FluentText';
import { FluentCard } from '../components/FluentCard';
import { FluentLayoutShell } from '../components/FluentLayoutShell';
import {
  ArrowLeft,
  User,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from 'lucide-react-native';

const SessionDetailsScreen = ({ navigation, route }) => {
  const { sessionId, courseCode } = route.params;
  const [session, setSession] = useState(null);
  const [checkIns, setCheckIns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessionDetails();
  }, [sessionId]);

  const fetchSessionDetails = async () => {
    try {
      const sessionDoc = await getDoc(doc(firestore, 'attendanceSessions', sessionId));
      if (sessionDoc.exists()) setSession({ id: sessionDoc.id, ...sessionDoc.data() });
      const q = query(collection(firestore, `attendanceSessions/${sessionId}/checkIns`), orderBy('timeSignedIn', 'desc'));
      const snapshot = await getDocs(q);
      setCheckIns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const getDecisionIcon = (decision) => {
    if (decision === 'allow') return <CheckCircle2 color={FluentTheme.colors.success} size={20} />;
    if (decision === 'allow_flagged') return <AlertTriangle color={FluentTheme.colors.warning} size={20} />;
    return <XCircle color={FluentTheme.colors.error} size={20} />;
  };

  const renderCheckIn = ({ item }) => (
    <FluentCard style={styles.checkInCard}>
      <View style={styles.checkInHeader}>
        <View style={{ flex: 1 }}><FluentText variant="body" weight="semibold">{item.fullName}</FluentText><FluentText variant="caption" color="neutralTextSecondary">{item.matricNumber}</FluentText></View>
        <View style={styles.decisionBadge}>{getDecisionIcon(item.decision)}<FluentText variant="caption" style={{ marginLeft: 4, color: item.decision === 'reject' ? FluentTheme.colors.error : item.decision === 'allow_flagged' ? FluentTheme.colors.warning : FluentTheme.colors.success }} weight="semibold">{item.decision?.toUpperCase()}</FluentText></View>
      </View>
      <View style={styles.checkInMeta}><MapPin size={12} color={FluentTheme.colors.neutralTextSecondary} /><FluentText variant="caption" color="neutralTextSecondary" style={{ marginLeft: 4 }}>{item.auditFlag === 'low_confidence_location' ? 'Low Accuracy' : 'Accurate'}</FluentText><View style={{ flex: 1 }} /><FluentText variant="caption" color="neutralTextSecondary">{item.timeSignedIn?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</FluentText></View>
    </FluentCard>
  );

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={FluentTheme.colors.accent} /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <FluentLayoutShell variant="narrow">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}><ArrowLeft color={FluentTheme.colors.neutralText} size={24} /></TouchableOpacity>
          <View style={styles.headerTitle}><FluentText variant="title" weight="bold">{session?.sessionName}</FluentText><FluentText variant="caption" color="neutralTextSecondary">{courseCode} • {checkIns.length} check-ins</FluentText></View>
        </View>
        <FlatList data={checkIns} renderItem={renderCheckIn} keyExtractor={item => item.id} contentContainerStyle={styles.listContent} ListEmptyComponent={<View style={styles.emptyState}><User color={FluentTheme.colors.neutralBorderStrong} size={48} /><FluentText variant="body" color="neutralTextSecondary" style={{ marginTop: 12 }}>No check-ins yet.</FluentText></View>} />
      </FluentLayoutShell>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FluentTheme.colors.neutralLayer },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: FluentTheme.colors.white, borderBottomWidth: 1, borderBottomColor: FluentTheme.colors.neutralBorder },
  iconButton: { padding: 8 },
  headerTitle: { flex: 1, marginLeft: 8 },
  listContent: { padding: 20 },
  checkInCard: { marginBottom: 12, padding: 12 },
  checkInHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  decisionBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: FluentTheme.colors.neutralBackground2, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  checkInMeta: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: FluentTheme.colors.neutralBorder, paddingTop: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 60 }
});

export default SessionDetailsScreen;
