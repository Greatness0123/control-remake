import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, SafeAreaView, Platform, StatusBar,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { auth, firestore } from '../../config/firebaseconfig';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { fluentColors, fluentSpacing, fluentRadius, fluentShadows } from '../../utils/fluentTheme';

const SharedCoursesScreen = ({ navigation }) => {
  const [sharedCourses, setSharedCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchSharedCourses();
  }, []);

  const fetchSharedCourses = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const repsSnapshot = await getDocs(
        query(collection(firestore, 'courseReps'), where('studentId', '==', user.uid))
      );

      const activeReps = repsSnapshot.docs.filter(d => d.data().isActive);

      const coursesWithSessions = await Promise.all(
        activeReps.map(async (repDoc) => {
          const repData = repDoc.data();
          const broadcastsSnapshot = await getDocs(collection(firestore, 'broadcasts'));
          const courseBroadcasts = broadcastsSnapshot.docs.filter(
            d => d.data().courseId === repData.courseId
          );

          let totalSessions = courseBroadcasts.length;
          let activeSessions = courseBroadcasts.filter(d => d.data().isActive).length;

          let totalParticipants = 0;
          for (const bDoc of courseBroadcasts) {
            const participantsSnapshot = await getDocs(
              collection(firestore, `broadcasts/${bDoc.id}/participants`)
            );
            totalParticipants += participantsSnapshot.size;
          }

          return {
            id: repDoc.id,
            courseCode: repData.courseCode,
            courseId: repData.courseId,
            permissions: repData.permissions,
            grantedByName: repData.grantedByName,
            totalSessions,
            activeSessions,
            totalParticipants,
          };
        })
      );

      setSharedCourses(coursesWithSessions);
    } catch (error) {
      console.error('Failed to fetch shared courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSharedCourses();
    setRefreshing(false);
  };

  const handleBack = () => {
    navigation.reset({ index: 0, routes: [{ name: 'StudentScreen' }] });
  };

  const navigateToCourseDetail = (course) => {
    navigation.navigate('CourseDetail', {
      courseId: course.courseId,
      courseCode: course.courseCode,
      courseName: course.courseCode,
      userRole: 'rep',
      userId: auth.currentUser.uid,
      canEdit: course.permissions?.canEdit || false,
      canDelete: course.permissions?.canDelete || false,
    });
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
          <View style={styles.headerInfo}>
            <Text style={styles.title}>Shared Courses</Text>
            <Text style={styles.subtitle}>Courses you've been assigned as Course Rep</Text>
          </View>
        </View>

        <View style={styles.roleBadge}>
          <Ionicons name="shield-checkmark" size={20} color={fluentColors.purple} />
          <Text style={styles.roleText}>Course Rep</Text>
        </View>

        <FlatList
          data={sharedCourses}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[fluentColors.brand]} />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color={fluentColors.neutralQuaternary} />
              <Text style={styles.emptyTitle}>No Shared Courses</Text>
              <Text style={styles.emptyText}>You haven't been assigned as a course rep yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.courseCard}
              onPress={() => navigateToCourseDetail(item)}
              activeOpacity={0.7}
            >
              <View style={styles.courseHeader}>
                <View style={styles.courseIcon}>
                  <Ionicons name="school" size={24} color={fluentColors.brand} />
                </View>
                <View style={styles.courseInfo}>
                  <Text style={styles.courseCode}>{item.courseCode}</Text>
                  <Text style={styles.courseMeta}>Granted by: {item.grantedByName}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={fluentColors.neutralTertiary} />
              </View>

              <View style={styles.courseStats}>
                <View style={styles.statItem}>
                  <Ionicons name="calendar-outline" size={14} color={fluentColors.brand} />
                  <Text style={styles.statText}>{item.totalSessions} Sessions</Text>
                </View>
                {item.activeSessions > 0 && (
                  <View style={styles.statItem}>
                    <Ionicons name="radio" size={14} color={fluentColors.success} />
                    <Text style={styles.statText}>{item.activeSessions} Active</Text>
                  </View>
                )}
                <View style={styles.statItem}>
                  <Ionicons name="people-outline" size={14} color={fluentColors.neutralSecondary} />
                  <Text style={styles.statText}>{item.totalParticipants} Records</Text>
                </View>
              </View>

              <View style={styles.permissionsRow}>
                {item.permissions?.canTakeAttendance && (
                  <View style={[styles.permBadge, { backgroundColor: fluentColors.successBackground }]}>
                    <Ionicons name="checkmark-circle" size={12} color={fluentColors.success} />
                    <Text style={[styles.permText, { color: fluentColors.success }]}>Take Attendance</Text>
                  </View>
                )}
                {item.permissions?.canEdit && (
                  <View style={[styles.permBadge, { backgroundColor: fluentColors.brandBackground }]}>
                    <Ionicons name="create" size={12} color={fluentColors.brand} />
                    <Text style={[styles.permText, { color: fluentColors.brand }]}>Add/Remove</Text>
                  </View>
                )}
                {item.permissions?.canDelete && (
                  <View style={[styles.permBadge, { backgroundColor: fluentColors.dangerBackground }]}>
                    <Ionicons name="trash" size={12} color={fluentColors.danger} />
                    <Text style={[styles.permText, { color: fluentColors.danger }]}>Delete</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
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
  headerInfo: { flex: 1 },
  title: { fontSize: 24, fontWeight: '700', color: fluentColors.neutralPrimary },
  subtitle: { fontSize: 13, color: fluentColors.neutralSecondary, marginTop: 2 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: fluentColors.purpleBackground,
    paddingHorizontal: 16, paddingVertical: 10, marginHorizontal: fluentSpacing.m, marginTop: fluentSpacing.m,
    borderRadius: fluentRadius.m, gap: 8,
  },
  roleText: { fontSize: 14, fontWeight: '600', color: fluentColors.purple },
  listContent: { padding: fluentSpacing.m, paddingBottom: 100 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: fluentColors.neutralPrimary, marginTop: fluentSpacing.m },
  emptyText: { fontSize: 13, color: fluentColors.neutralSecondary, marginTop: 4, textAlign: 'center', paddingHorizontal: 40 },
  courseCard: {
    backgroundColor: fluentColors.white, borderRadius: fluentRadius.l, padding: fluentSpacing.m,
    marginBottom: fluentSpacing.s, borderWidth: 1, borderColor: fluentColors.neutralLighter,
    ...fluentShadows.card,
  },
  courseHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: fluentSpacing.s },
  courseIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: fluentColors.brandBackground,
    justifyContent: 'center', alignItems: 'center', marginRight: fluentSpacing.s,
  },
  courseInfo: { flex: 1 },
  courseCode: { fontSize: 18, fontWeight: '700', color: fluentColors.neutralPrimary },
  courseMeta: { fontSize: 12, color: fluentColors.neutralSecondary, marginTop: 2 },
  courseStats: {
    flexDirection: 'row', gap: fluentSpacing.m, paddingTop: fluentSpacing.s,
    borderTopWidth: 1, borderTopColor: fluentColors.neutralLighter, marginBottom: fluentSpacing.s,
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: fluentColors.neutralSecondary },
  permissionsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  permBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: fluentRadius.round, gap: 4,
  },
  permText: { fontSize: 11, fontWeight: '600' },
});

export default SharedCoursesScreen;
