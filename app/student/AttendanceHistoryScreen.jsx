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
  Alert
} from 'react-native';
import { auth, firestore } from '../../config/firebaseconfig';
import {
  collectionGroup,
  query,
  where,
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
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  MapPin
} from 'lucide-react-native';

const StudentAttendanceHistoryScreen = ({ navigation }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const checkInsQuery = query(
        collectionGroup(firestore, 'checkIns'),
        where('studentId', '==', user.uid),
        orderBy('timeSignedIn', 'desc')
      );

      const snapshot = await getDocs(checkInsQuery);
      const results = [];

      for (const checkInDoc of snapshot.docs) {
        const checkInData = checkInDoc.data();
        const sessionId = checkInDoc.ref.parent.parent.id;

        const sessionDoc = await getDoc(doc(firestore, 'attendanceSessions', sessionId));
        if (sessionDoc.exists()) {
          const sessionData = sessionDoc.data();
          const courseDoc = await getDoc(doc(firestore, 'courses', sessionData.courseId));
          const courseData = courseDoc.exists() ? courseDoc.data() : { code: 'N/A', title: 'Unknown Course' };

          results.push({
            id: checkInDoc.id,
            sessionId: sessionId,
            sessionName: sessionData.sessionName,
            courseCode: courseData.code,
            courseTitle: courseData.title,
            date: checkInData.timeSignedIn?.toDate(),
            ...checkInData
          });
        }
      }

      setHistory(results);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (decision) => {
    switch (decision) {
      case 'allow': return { icon: <CheckCircle2 color={FluentTheme.colors.success} size={16} />, text: 'SUCCESS', color: FluentTheme.colors.success };
      case 'allow_flagged': return { icon: <AlertTriangle color={FluentTheme.colors.warning} size={16} />, text: 'FLAGGED', color: FluentTheme.colors.warning };
      case 'reject': return { icon: <XCircle color={FluentTheme.colors.error} size={16} />, text: 'FAILED', color: FluentTheme.colors.error };
      default: return { icon: <CheckCircle2 color={FluentTheme.colors.success} size={16} />, text: 'SUCCESS', color: FluentTheme.colors.success };
    }
  };

  const renderItem = ({ item }) => {
    const status = getStatusInfo(item.decision);
    return (
      <FluentCard style={styles.historyCard}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <FluentText variant="body" weight="semibold">{item.courseCode}</FluentText>
            <FluentText variant="caption" color="neutralTextSecondary">{item.courseTitle}</FluentText>
          </View>
          <View style={[styles.statusBadge, { borderColor: status.color }]}>
            {status.icon}
            <FluentText variant="caption" weight="bold" style={{ marginLeft: 4, color: status.color }}>{status.text}</FluentText>
          </View>
        </View>
        <View style={styles.cardFooter}>
          <Calendar size={12} color={FluentTheme.colors.neutralTextSecondary} />
          <FluentText variant="caption" color="neutralTextSecondary" style={{ marginLeft: 4 }}>{item.date?.toLocaleDateString()} at {item.date?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</FluentText>
          {item.auditFlag === 'low_confidence_location' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 12 }}><MapPin size={12} color={FluentTheme.colors.warning} /><FluentText variant="caption" color="warning" style={{ marginLeft: 4 }}>Low Confidence</FluentText></View>
          )}
        </View>
      </FluentCard>
    );
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={FluentTheme.colors.accent} /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <FluentLayoutShell variant="narrow">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}><ArrowLeft color={FluentTheme.colors.neutralText} size={24} /></TouchableOpacity>
          <FluentText variant="title" weight="bold" style={{ marginLeft: 8 }}>Attendance History</FluentText>
        </View>
        <FlatList
          data={history}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}><Calendar color={FluentTheme.colors.neutralBorderStrong} size={48} /><FluentText variant="body" color="neutralTextSecondary" style={{ marginTop: 12 }}>No attendance records found.</FluentText></View>
          }
        />
      </FluentLayoutShell>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FluentTheme.colors.neutralLayer },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: FluentTheme.colors.white, borderBottomWidth: 1, borderBottomColor: FluentTheme.colors.neutralBorder },
  iconButton: { padding: 8 },
  listContent: { padding: 20 },
  historyCard: { marginBottom: 12, padding: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: FluentTheme.colors.neutralBorder, paddingTop: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 60 }
});

export default StudentAttendanceHistoryScreen;
