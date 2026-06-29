import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, SafeAreaView, Platform, StatusBar,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { auth, firestore } from '../../config/firebaseconfig';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { fluentColors, fluentSpacing, fluentRadius, fluentShadows } from '../../utils/fluentTheme';

const CourseHistoryScreen = ({ navigation }) => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchCourseHistory();
  }, []);

  const fetchCourseHistory = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const broadcastsSnapshot = await getDocs(collection(firestore, 'broadcasts'));
      const studentUid = user.uid;

      const courseMap = new Map();

      for (const bDoc of broadcastsSnapshot.docs) {
        const bData = bDoc.data();
        const courseId = bData.courseId;
        if (!courseId) continue;

        const participantsSnapshot = await getDocs(
          collection(firestore, `broadcasts/${bDoc.id}/participants`)
        );

        const studentParticipant = participantsSnapshot.docs.find(
          d => d.id === studentUid || d.data().matricNumber
        );

        let studentMatch = false;
        if (studentParticipant) {
          studentMatch = true;
        } else {
          for (const pDoc of participantsSnapshot.docs) {
            const pData = pDoc.data();
            const studentDoc = await getDoc(doc(firestore, 'students', studentUid));
            if (studentDoc.exists()) {
              const studentData = studentDoc.data();
              if (pData.matricNumber === studentData.matricNumber) {
                studentMatch = true;
                break;
              }
            }
          }
        }

        if (!courseMap.has(courseId)) {
          courseMap.set(courseId, {
            courseId,
            courseCode: bData.customId || courseId,
            totalSessions: 0,
            attendedSessions: 0,
            sessions: [],
          });
        }

        const courseData = courseMap.get(courseId);
        courseData.totalSessions += 1;

        const sessionEntry = {
          id: bDoc.id,
          date: bData.createdAt?.toDate(),
          takenByName: bData.takenByName || bData.teacherFullName || 'N/A',
          isActive: bData.isActive,
          status: studentMatch ? 'success' : 'missed',
        };

        courseData.sessions.push(sessionEntry);

        if (studentMatch) {
          courseData.attendedSessions += 1;
        }
      }

      courseMap.forEach((data) => {
        data.sessions.sort((a, b) => (b.date || new Date(0)) - (a.date || new Date(0)));
        data.percentage = data.totalSessions > 0
          ? Math.round((data.attendedSessions / data.totalSessions) * 100)
          : 0;
      });

      setCourses(Array.from(courseMap.values()));
    } catch (error) {
      console.error('Failed to fetch course history:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCourseHistory();
    setRefreshing(false);
  };

  const handleBack = () => {
    navigation.reset({ index: 0, routes: [{ name: 'StudentScreen' }] });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={fluentColors.brand} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={fluentColors.white} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={fluentColors.brand} />
          </TouchableOpacity>
          <Text style={styles.title}>My Attendance</Text>
        </View>

        <View style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>
              {courses.reduce((sum, c) => sum + c.totalSessions, 0)}
            </Text>
            <Text style={styles.summaryLabel}>Total Sessions</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>
              {courses.reduce((sum, c) => sum + c.attendedSessions, 0)}
            </Text>
            <Text style={styles.summaryLabel}>Attended</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNumber, { color: fluentColors.success }]}>
              {courses.length > 0
                ? Math.round(courses.reduce((sum, c) => sum + c.percentage, 0) / courses.length)
                : 0}%
            </Text>
            <Text style={styles.summaryLabel}>Avg. Rate</Text>
          </View>
        </View>

        <FlatList
          data={courses}
          keyExtractor={(item) => item.courseId}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[fluentColors.brand]} />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="school-outline" size={64} color={fluentColors.neutralQuaternary} />
              <Text style={styles.emptyTitle}>No Course Records</Text>
              <Text style={styles.emptyText}>Attendance records will appear here grouped by course</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.courseCard}>
              <View style={styles.courseHeader}>
                <View style={styles.courseIcon}>
                  <Ionicons name="school" size={22} color={fluentColors.brand} />
                </View>
                <View style={styles.courseInfo}>
                  <Text style={styles.courseCode}>{item.courseCode}</Text>
                  <Text style={styles.courseMeta}>
                    {item.attendedSessions} of {item.totalSessions} sessions
                  </Text>
                </View>
                <View style={styles.percentageContainer}>
                  <Text style={[
                    styles.percentageText,
                    { color: item.percentage >= 75 ? fluentColors.success : item.percentage >= 50 ? fluentColors.warning : fluentColors.danger },
                  ]}>
                    {item.percentage}%
                  </Text>
                  <Text style={styles.percentageLabel}>Attendance</Text>
                </View>
              </View>

              <View style={styles.progressBar}>
                <View style={[
                  styles.progressFill,
                  {
                    width: `${item.percentage}%`,
                    backgroundColor: item.percentage >= 75 ? fluentColors.success : item.percentage >= 50 ? fluentColors.warning : fluentColors.danger,
                  },
                ]} />
              </View>

              <View style={styles.sessionsList}>
                {item.sessions.slice(0, 5).map((session) => (
                  <View key={session.id} style={styles.sessionRow}>
                    <View style={[
                      styles.sessionDot,
                      { backgroundColor: session.status === 'success' ? fluentColors.success : fluentColors.danger },
                    ]} />
                    <Text style={styles.sessionDate}>
                      {session.date?.toLocaleDateString() || 'N/A'}
                    </Text>
                    <Text style={styles.sessionTakenBy}>by {session.takenByName}</Text>
                    <View style={[
                      styles.sessionStatusBadge,
                      { backgroundColor: session.status === 'success' ? fluentColors.successBackground : fluentColors.dangerBackground },
                    ]}>
                      <Text style={[
                        styles.sessionStatusText,
                        { color: session.status === 'success' ? fluentColors.success : fluentColors.danger },
                      ]}>
                        {session.status === 'success' ? 'Present' : 'Absent'}
                      </Text>
                    </View>
                  </View>
                ))}
                {item.sessions.length > 5 && (
                  <Text style={styles.moreSessions}>+{item.sessions.length - 5} more sessions</Text>
                )}
              </View>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1, backgroundColor: fluentColors.white,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: { flex: 1, backgroundColor: fluentColors.neutralLightest },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: fluentColors.white },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: fluentSpacing.m,
    paddingVertical: fluentSpacing.m, backgroundColor: fluentColors.white,
    borderBottomWidth: 1, borderBottomColor: fluentColors.neutralLighter,
  },
  backButton: { marginRight: fluentSpacing.s },
  title: { flex: 1, fontSize: 24, fontWeight: '700', color: fluentColors.neutralPrimary },
  summaryBar: {
    flexDirection: 'row', backgroundColor: fluentColors.white, paddingVertical: fluentSpacing.m,
    paddingHorizontal: fluentSpacing.l, borderBottomWidth: 1, borderBottomColor: fluentColors.neutralLighter,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNumber: { fontSize: 22, fontWeight: '700', color: fluentColors.neutralPrimary },
  summaryLabel: { fontSize: 11, color: fluentColors.neutralSecondary, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: fluentColors.neutralLighter, marginHorizontal: fluentSpacing.s },
  listContent: { padding: fluentSpacing.m, paddingBottom: 100 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: fluentColors.neutralPrimary, marginTop: fluentSpacing.m },
  emptyText: { fontSize: 13, color: fluentColors.neutralSecondary, marginTop: 4, textAlign: 'center', paddingHorizontal: 40 },
  courseCard: {
    backgroundColor: fluentColors.white, borderRadius: fluentRadius.l, padding: fluentSpacing.m,
    marginBottom: fluentSpacing.m, borderWidth: 1, borderColor: fluentColors.neutralLighter,
    ...fluentShadows.card,
  },
  courseHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: fluentSpacing.s },
  courseIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: fluentColors.brandBackground,
    justifyContent: 'center', alignItems: 'center', marginRight: fluentSpacing.s,
  },
  courseInfo: { flex: 1 },
  courseCode: { fontSize: 18, fontWeight: '700', color: fluentColors.neutralPrimary },
  courseMeta: { fontSize: 13, color: fluentColors.neutralSecondary, marginTop: 2 },
  percentageContainer: { alignItems: 'flex-end' },
  percentageText: { fontSize: 22, fontWeight: '700' },
  percentageLabel: { fontSize: 10, color: fluentColors.neutralSecondary, marginTop: 2 },
  progressBar: {
    height: 6, backgroundColor: fluentColors.neutralLighter, borderRadius: 3,
    overflow: 'hidden', marginBottom: fluentSpacing.s,
  },
  progressFill: { height: '100%', borderRadius: 3 },
  sessionsList: {
    paddingTop: fluentSpacing.s, borderTopWidth: 1, borderTopColor: fluentColors.neutralLighter,
  },
  sessionRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8,
  },
  sessionDot: { width: 8, height: 8, borderRadius: 4 },
  sessionDate: { flex: 1, fontSize: 13, color: fluentColors.neutralPrimary },
  sessionTakenBy: { fontSize: 12, color: fluentColors.neutralTertiary },
  sessionStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: fluentRadius.round },
  sessionStatusText: { fontSize: 11, fontWeight: '600' },
  moreSessions: { fontSize: 12, color: fluentColors.brand, textAlign: 'center', marginTop: 8 },
});

export default CourseHistoryScreen;
