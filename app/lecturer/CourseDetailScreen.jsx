import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, Alert,
  ActivityIndicator, RefreshControl, SafeAreaView, Platform, StatusBar,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { auth, firestore } from '../../config/firebaseconfig';
import { collection, getDocs, doc, getDoc, deleteDoc, query, where } from 'firebase/firestore';
import { exportCoursePDF, exportSessionPDF, exportSessionXLSX } from '../../utils/pdfExport';
import { db } from '../../config/firebaseconfig';
import { fluentColors, fluentSpacing, fluentRadius, fluentShadows } from '../../utils/fluentTheme';

const CourseDetailScreen = ({ navigation, route }) => {
  const { courseId, courseCode, courseName, userRole = 'lecturer', userId, canEdit: canEditParam, canDelete: canDeleteParam } = route.params;
  const isRep = userRole === 'rep';
  const canEdit = isRep ? (canEditParam || false) : true;
  const canDelete = isRep ? (canDeleteParam || false) : true;
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const broadcastsSnapshot = await getDocs(collection(firestore, 'broadcasts'));
      const courseSessions = await Promise.all(
        broadcastsSnapshot.docs
          .filter((d) => d.data().courseId === courseId)
          .map(async (bDoc) => {
            const bData = bDoc.data();
            const participantsSnapshot = await getDocs(
              collection(firestore, `broadcasts/${bDoc.id}/participants`)
            );
            return {
              id: bDoc.id,
              ...bData,
              participantCount: participantsSnapshot.size,
            };
          })
      );

      courseSessions.sort((a, b) => {
        const dateA = a.createdAt?.toDate() || new Date(0);
        const dateB = b.createdAt?.toDate() || new Date(0);
        return dateB - dateA;
      });

      setSessions(courseSessions);
    } catch (error) {
      Alert.alert('Error', 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSessions();
    setRefreshing(false);
  };

  const handleExportCoursePDF = async () => {
    setExporting(true);
    try {
      await exportCoursePDF(courseId, courseCode, courseName);
    } catch (error) {
      Alert.alert('Error', 'Failed to export PDF: ' + (error.message || 'Unknown'));
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteSession = (broadcastId) => {
    const handleDelete = async () => {
      try {
        setLoading(true);
        await deleteDoc(doc(firestore, 'broadcasts', broadcastId));
        setSessions((prev) => prev.filter((s) => s.id !== broadcastId));
      } catch (error) {
        Alert.alert('Error', 'Failed to delete session');
      } finally {
        setLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this attendance record?')) {
        handleDelete();
      }
    } else {
      Alert.alert('Delete Session', 'Are you sure you want to delete this attendance record?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: handleDelete },
      ]);
    }
  };

  const viewParticipants = (session) => {
    navigation.navigate('ParticipantsView', {
      broadcastId: session.id,
      broadcastName: `${courseCode} - ${new Date(session.createdAt?.toDate()).toLocaleDateString()}`,
      userRole: isRep ? 'rep' : 'lecturer',
      userId: userId || auth.currentUser.uid,
      canEdit: canEdit,
    });
  };

  const handleBack = () => {
    navigation.goBack();
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
            <Text style={styles.courseCode}>{courseCode}</Text>
            <Text style={styles.courseName}>{courseName}</Text>
          </View>
        </View>

        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{sessions.length}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {sessions.reduce((sum, s) => sum + (s.participantCount || 0), 0)}
            </Text>
            <Text style={styles.statLabel}>Total Records</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {sessions.filter((s) => s.isActive).length}
            </Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          {canEdit && (
            <TouchableOpacity
              style={styles.newAttendanceButton}
              onPress={() => navigation.navigate('NewAttendance', { courseId, courseCode, userName: isRep ? 'Course Rep' : undefined })}
            >
              <Ionicons name="add-circle-outline" size={20} color={fluentColors.white} />
              <Text style={styles.newAttendanceText}>New Attendance</Text>
            </TouchableOpacity>
          )}

          {!isRep && (
            <TouchableOpacity
              style={styles.manageRepsButton}
              onPress={() => navigation.navigate('CourseRepManager', { courseId, courseCode, courseName })}
            >
              <Ionicons name="people-outline" size={20} color={fluentColors.brand} />
              <Text style={styles.manageRepsText}>Manage Reps</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Attendance Sessions</Text>
          <TouchableOpacity onPress={handleExportCoursePDF} style={styles.exportButton} disabled={exporting}>
            {exporting ? (
              <ActivityIndicator size="small" color={fluentColors.white} />
            ) : (
              <>
                <Ionicons name="document-text-outline" size={16} color={fluentColors.white} />
                <Text style={styles.exportButtonText}>Export PDF</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[fluentColors.brand]} />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color={fluentColors.neutralQuaternary} />
              <Text style={styles.emptyTitle}>No Sessions Yet</Text>
              <Text style={styles.emptyText}>Take attendance for this course</Text>
            </View>
          }
          renderItem={({ item }) => {
            const dateTime = item.createdAt?.toDate();
            const dateStr = dateTime?.toLocaleDateString() || 'N/A';
            const timeStr = dateTime?.toLocaleTimeString() || '';
            return (
              <TouchableOpacity
                style={styles.sessionCard}
                onPress={() => viewParticipants(item)}
                activeOpacity={0.7}
              >
                <View style={styles.sessionHeader}>
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionDate}>{dateStr}</Text>
                    <Text style={styles.sessionTime}>{timeStr}</Text>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: item.isActive ? fluentColors.successBackground : fluentColors.neutralLightest },
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { color: item.isActive ? fluentColors.success : fluentColors.neutralSecondary },
                    ]}>
                      {item.isActive ? 'Active' : 'Ended'}
                    </Text>
                  </View>
                </View>

                <View style={styles.sessionMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="person-outline" size={14} color={fluentColors.brand} />
                    <Text style={styles.metaText}>Taken by: {item.takenByName || item.teacherFullName || 'N/A'}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="people-outline" size={14} color={fluentColors.success} />
                    <Text style={styles.metaText}>{item.participantCount || 0} participants</Text>
                  </View>
                </View>

                <View style={styles.sessionActions}>
                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() => viewParticipants(item)}
                  >
                    <Ionicons name="eye-outline" size={16} color={fluentColors.brand} />
                    <Text style={styles.viewButtonText}>View</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionIconButton}
                    onPress={() => exportSessionPDF(item.id)}
                  >
                    <Ionicons name="document-outline" size={18} color={fluentColors.brand} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionIconButton}
                    onPress={() => exportSessionXLSX(item.id)}
                  >
                    <Ionicons name="grid-outline" size={18} color={fluentColors.success} />
                  </TouchableOpacity>

                  {canDelete && (
                    <TouchableOpacity
                      style={styles.deleteSessionButton}
                      onPress={() => handleDeleteSession(item.id)}
                    >
                      <Ionicons name="trash-outline" size={16} color={fluentColors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
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
  container: { flex: 1, backgroundColor: fluentColors.neutralLightest, alignItems: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: fluentColors.white },
  header: {
    width: '100%',
    maxWidth: 800,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: fluentSpacing.m,
    paddingVertical: fluentSpacing.m, backgroundColor: fluentColors.white,
    borderBottomWidth: 1, borderBottomColor: fluentColors.neutralLighter,
  },
  backButton: { marginRight: fluentSpacing.s },
  headerInfo: { flex: 1 },
  courseCode: { fontSize: 20, fontWeight: '700', color: fluentColors.neutralPrimary },
  courseName: { fontSize: 14, color: fluentColors.neutralSecondary, marginTop: 2 },
  statsBar: {
    width: '100%',
    maxWidth: 800,
    flexDirection: 'row', backgroundColor: fluentColors.white, paddingVertical: fluentSpacing.m,
    paddingHorizontal: fluentSpacing.l, borderBottomWidth: 1, borderBottomColor: fluentColors.neutralLighter,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 22, fontWeight: '700', color: fluentColors.neutralPrimary },
  statLabel: { fontSize: 11, color: fluentColors.neutralSecondary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: fluentColors.neutralLighter, marginHorizontal: fluentSpacing.s },
  actionsRow: {
    width: '100%',
    maxWidth: 800,
    flexDirection: 'row', gap: fluentSpacing.s, paddingHorizontal: fluentSpacing.m,
    paddingVertical: fluentSpacing.s,
  },
  newAttendanceButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: fluentColors.brand, paddingVertical: 12, borderRadius: fluentRadius.m, gap: fluentSpacing.xs,
  },
  newAttendanceText: { color: fluentColors.white, fontWeight: '600', fontSize: 14 },
  manageRepsButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: fluentColors.white, paddingVertical: 12, borderRadius: fluentRadius.m, gap: fluentSpacing.xs,
    borderWidth: 1, borderColor: fluentColors.brand,
  },
  manageRepsText: { color: fluentColors.brand, fontWeight: '600', fontSize: 14 },
  sectionHeader: {
    width: '100%',
    maxWidth: 800,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: fluentSpacing.m, paddingVertical: fluentSpacing.s,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: fluentColors.neutralPrimary },
  exportButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: fluentColors.brand,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: fluentRadius.m, gap: 4,
  },
  exportButtonText: { color: fluentColors.white, fontSize: 12, fontWeight: '600' },
  listContent: { width: '100%', maxWidth: 800, padding: fluentSpacing.m, paddingBottom: 100 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: fluentColors.neutralPrimary, marginTop: fluentSpacing.s },
  emptyText: { fontSize: 13, color: fluentColors.neutralSecondary, marginTop: 4 },
  sessionCard: {
    backgroundColor: fluentColors.white, borderRadius: fluentRadius.l, padding: fluentSpacing.m,
    marginBottom: fluentSpacing.s, borderWidth: 1, borderColor: fluentColors.neutralLighter,
    ...fluentShadows.card,
  },
  sessionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: fluentSpacing.s,
  },
  sessionInfo: { flex: 1 },
  sessionDate: { fontSize: 16, fontWeight: '600', color: fluentColors.neutralPrimary },
  sessionTime: { fontSize: 13, color: fluentColors.neutralSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: fluentRadius.round },
  statusText: { fontSize: 12, fontWeight: '600' },
  sessionMeta: { gap: 4, marginBottom: fluentSpacing.s },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, color: fluentColors.neutralSecondary },
  sessionActions: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: fluentSpacing.s, borderTopWidth: 1, borderTopColor: fluentColors.neutralLighter,
  },
  viewButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: fluentColors.brandBackground, paddingHorizontal: 12, paddingVertical: 6, borderRadius: fluentRadius.m,
  },
  viewButtonText: { color: fluentColors.brand, fontSize: 12, fontWeight: '600' },
  actionIconButton: { padding: fluentSpacing.s },
  deleteSessionButton: { padding: fluentSpacing.s },
});

export default CourseDetailScreen;
