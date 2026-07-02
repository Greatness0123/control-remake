import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, Alert, Modal,
  ActivityIndicator, RefreshControl, TextInput, SafeAreaView, Platform, StatusBar,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { auth, firestore } from '../../config/firebaseconfig';
import {
  collection, getDocs, doc, getDoc, addDoc, deleteDoc, query, where, Timestamp,
} from 'firebase/firestore';
import { fluentColors, fluentSpacing, fluentRadius, fluentShadows } from '../../utils/fluentTheme';

const CourseDashboard = ({ navigation }) => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [creating, setCreating] = useState(false);
  const [lecturerData, setLecturerData] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const teacherDoc = await getDoc(doc(firestore, 'teachers', user.uid));
      if (teacherDoc.exists()) {
        setLecturerData(teacherDoc.data());
      }

      const coursesSnapshot = await getDocs(
        query(collection(firestore, 'courses'), where('lecturerId', '==', user.uid))
      );

      const coursesWithStats = await Promise.all(
        coursesSnapshot.docs.map(async (cDoc) => {
          const courseData = cDoc.data();
          const broadcastsSnapshot = await getDocs(collection(firestore, 'broadcasts'));
          const courseBroadcasts = broadcastsSnapshot.docs.filter(
            (b) => b.data().courseId === cDoc.id
          );

          let totalParticipants = 0;
          const uniqueStudents = new Set();
          for (const bDoc of courseBroadcasts) {
            const participantsSnapshot = await getDocs(
              collection(firestore, `broadcasts/${bDoc.id}/participants`)
            );
            totalParticipants += participantsSnapshot.size;
            participantsSnapshot.docs.forEach((p) => uniqueStudents.add(p.data().matricNumber));
          }

          const repsSnapshot = await getDocs(
            query(collection(firestore, 'courseReps'), where('courseId', '==', cDoc.id))
          );

          return {
            id: cDoc.id,
            ...courseData,
            sessionCount: courseBroadcasts.length,
            totalParticipants,
            uniqueStudentCount: uniqueStudents.size,
            repCount: repsSnapshot.size,
          };
        })
      );

      setCourses(coursesWithStats);
    } catch (error) {
      Alert.alert('Error', 'Failed to load courses: ' + (error.message || 'Unknown'));
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const createCourse = async () => {
    if (!newCourseCode.trim() || !newCourseName.trim()) {
      Alert.alert('Error', 'Please enter both course code and name');
      return;
    }

    setCreating(true);
    try {
      const user = auth.currentUser;
      await addDoc(collection(firestore, 'courses'), {
        lecturerId: user.uid,
        lecturerName: lecturerData?.fullName || 'Unknown',
        courseCode: newCourseCode.trim().toUpperCase(),
        courseName: newCourseName.trim(),
        createdAt: Timestamp.now(),
        isActive: true,
      });

      Alert.alert('Success', 'Course created');
      setCreateModalVisible(false);
      setNewCourseCode('');
      setNewCourseName('');
      await fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to create course: ' + (error.message || 'Unknown'));
    } finally {
      setCreating(false);
    }
  };

  const deleteCourse = (courseId, courseCode) => {
    const handleDelete = async () => {
      try {
        setLoading(true);
        await deleteDoc(doc(firestore, 'courses', courseId));
        setCourses((prev) => prev.filter((c) => c.id !== courseId));
      } catch (error) {
        Alert.alert('Error', 'Failed to delete course');
      } finally {
        setLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to delete ${courseCode}? This will not delete attendance records.`)) {
        handleDelete();
      }
    } else {
      Alert.alert(
        'Delete Course',
        `Are you sure you want to delete ${courseCode}? This will not delete attendance records.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: handleDelete },
        ]
      );
    }
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
          <Text style={styles.title}>My Courses</Text>
          <TouchableOpacity onPress={() => setCreateModalVisible(true)} style={styles.addButton}>
            <Ionicons name="add-circle" size={28} color={fluentColors.brand} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={courses}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[fluentColors.brand]} />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="school-outline" size={64} color={fluentColors.neutralQuaternary} />
              <Text style={styles.emptyTitle}>No Courses Yet</Text>
              <Text style={styles.emptyText}>Create a course to start managing attendance</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(true)} style={styles.emptyButton}>
                <Ionicons name="add" size={20} color={fluentColors.white} />
                <Text style={styles.emptyButtonText}>Create Course</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.courseCard}
              onPress={() => navigation.navigate('CourseDetail', { courseId: item.id, courseCode: item.courseCode, courseName: item.courseName })}
              activeOpacity={0.7}
            >
              <View style={styles.courseHeader}>
                <View style={styles.courseIcon}>
                  <Ionicons name="school" size={24} color={fluentColors.brand} />
                </View>
                <View style={styles.courseInfo}>
                  <Text style={styles.courseCode}>{item.courseCode}</Text>
                  <Text style={styles.courseName}>{item.courseName}</Text>
                </View>
                <TouchableOpacity onPress={() => deleteCourse(item.id, item.courseCode)} style={styles.deleteButton}>
                  <Ionicons name="trash-outline" size={18} color={fluentColors.danger} />
                </TouchableOpacity>
              </View>

              <View style={styles.courseStats}>
                <View style={styles.statItem}>
                  <Ionicons name="calendar-outline" size={14} color={fluentColors.brand} />
                  <Text style={styles.statText}>{item.sessionCount} Sessions</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="people-outline" size={14} color={fluentColors.success} />
                  <Text style={styles.statText}>{item.uniqueStudentCount} Students</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="person-outline" size={14} color={fluentColors.purple} />
                  <Text style={styles.statText}>{item.repCount} Reps</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>

      <Modal animationType="slide" transparent visible={createModalVisible} onRequestClose={() => setCreateModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Course</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Ionicons name="close-outline" size={24} color={fluentColors.neutralSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Course Code</Text>
            <TextInput
              style={styles.input}
              value={newCourseCode}
              onChangeText={setNewCourseCode}
              placeholder="e.g. CSC301"
              placeholderTextColor={fluentColors.neutralTertiary}
              autoCapitalize="characters"
            />

            <Text style={styles.inputLabel}>Course Name</Text>
            <TextInput
              style={styles.input}
              value={newCourseName}
              onChangeText={setNewCourseName}
              placeholder="e.g. Operating Systems"
              placeholderTextColor={fluentColors.neutralTertiary}
            />

            <TouchableOpacity onPress={createCourse} style={styles.createButton} disabled={creating}>
              {creating ? (
                <ActivityIndicator size="small" color={fluentColors.white} />
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={20} color={fluentColors.white} />
                  <Text style={styles.createButtonText}>Create Course</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: fluentColors.white,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: { flex: 1, backgroundColor: fluentColors.neutralLightest },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: fluentColors.white },
  header: {
    width: '100%',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: fluentSpacing.m,
    paddingVertical: fluentSpacing.m, backgroundColor: fluentColors.white,
    borderBottomWidth: 1, borderBottomColor: fluentColors.neutralLighter,
  },
  backButton: { marginRight: fluentSpacing.s },
  title: { flex: 1, fontSize: 24, fontWeight: '700', color: fluentColors.neutralPrimary },
  addButton: { padding: 4 },
  listContent: { width: '100%', padding: fluentSpacing.m, paddingBottom: 100 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: fluentColors.neutralPrimary, marginTop: fluentSpacing.m },
  emptyText: { fontSize: 14, color: fluentColors.neutralSecondary, marginTop: fluentSpacing.xs, marginBottom: fluentSpacing.l },
  emptyButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: fluentColors.brand,
    paddingHorizontal: fluentSpacing.m, paddingVertical: 12, borderRadius: fluentRadius.m, gap: fluentSpacing.s,
  },
  emptyButtonText: { color: fluentColors.white, fontSize: 16, fontWeight: '600' },
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
  courseCode: { fontSize: 16, fontWeight: '700', color: fluentColors.neutralPrimary },
  courseName: { fontSize: 13, color: fluentColors.neutralSecondary, marginTop: 2 },
  deleteButton: { padding: fluentSpacing.s },
  courseStats: {
    flexDirection: 'row', gap: fluentSpacing.m, paddingTop: fluentSpacing.s,
    borderTopWidth: 1, borderTopColor: fluentColors.neutralLighter,
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: fluentColors.neutralSecondary },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: {
    backgroundColor: fluentColors.white, borderRadius: fluentRadius.xl, padding: fluentSpacing.l,
    width: '90%', maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: fluentSpacing.m,
  },
  modalTitle: { fontSize: 20, fontWeight: '600', color: fluentColors.neutralPrimary },
  inputLabel: { fontSize: 14, fontWeight: '500', color: fluentColors.neutralPrimary, marginBottom: fluentSpacing.xs },
  input: {
    borderWidth: 1, borderColor: fluentColors.neutralLighter, borderRadius: fluentRadius.m,
    padding: 12, fontSize: 16, color: fluentColors.neutralPrimary, backgroundColor: fluentColors.neutralLightest,
    marginBottom: fluentSpacing.m,
  },
  createButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: fluentColors.brand, paddingVertical: 14, borderRadius: fluentRadius.m, gap: fluentSpacing.s,
  },
  createButtonText: { color: fluentColors.white, fontSize: 16, fontWeight: '600' },
});

export default CourseDashboard;
