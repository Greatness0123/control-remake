import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, Alert,
  ActivityIndicator, RefreshControl, TextInput, SafeAreaView, Platform, StatusBar, Switch, Modal,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { auth, firestore } from '../../config/firebaseconfig';
import {
  collection, getDocs, doc, addDoc, deleteDoc, updateDoc, query, where, Timestamp, getDoc,
} from 'firebase/firestore';
import { fluentColors, fluentSpacing, fluentRadius, fluentShadows } from '../../utils/fluentTheme';

const CourseRepManager = ({ navigation, route }) => {
  const { courseId, courseCode, courseName } = route.params;
  const [reps, setReps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [matricNumber, setMatricNumber] = useState('');
  const [adding, setAdding] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [permissions, setPermissions] = useState({
    canTakeAttendance: true,
    canEdit: true,
    canDelete: false,
  });

  const fetchReps = useCallback(async () => {
    try {
      const repsSnapshot = await getDocs(
        query(collection(firestore, 'courseReps'), where('courseId', '==', courseId))
      );
      setReps(repsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      Alert.alert('Error', 'Failed to load course reps');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchReps();
  }, [fetchReps]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReps();
    setRefreshing(false);
  };

  const addRep = async () => {
    if (!matricNumber.trim()) {
      Alert.alert('Error', 'Please enter a matric number');
      return;
    }

    setAdding(true);
    try {
      const studentsSnapshot = await getDocs(collection(firestore, 'students'));
      const student = studentsSnapshot.docs.find(
        (d) => d.data().matricNumber?.toLowerCase() === matricNumber.trim().toLowerCase()
      );

      if (!student) {
        Alert.alert('Error', 'Student not found with this matric number');
        return;
      }

      const studentData = student.data();

      const existingRep = reps.find((r) => r.studentId === student.id);
      if (existingRep) {
        Alert.alert('Error', 'This student is already a course rep for this course');
        setAdding(false);
        return;
      }

      const lecturerDoc = await getDoc(doc(firestore, 'teachers', auth.currentUser.uid));
      const lecturerName = lecturerDoc.exists() ? lecturerDoc.data()?.fullName : 'Unknown';

      await addDoc(collection(firestore, 'courseReps'), {
        courseId,
        courseCode,
        studentId: student.id,
        studentName: studentData.fullName,
        studentMatric: studentData.matricNumber,
        permissions: { ...permissions },
        grantedBy: auth.currentUser.uid,
        grantedByName: lecturerName,
        grantedAt: Timestamp.now(),
        isActive: true,
      });

      Alert.alert('Success', `${studentData.fullName} has been added as a course rep`);
      setMatricNumber('');
      setAddModalVisible(false);
      setPermissions({ canTakeAttendance: true, canEdit: true, canDelete: false });
      await fetchReps();
    } catch (error) {
      Alert.alert('Error', 'Failed to add course rep: ' + (error.message || 'Unknown'));
    } finally {
      setAdding(false);
    }
  };

  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [repToDelete, setRepToDelete] = useState(null);

  const confirmRemoveRep = (rep) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Remove ${rep.studentName} as a course rep?`)) {
        handleRemoveRep(rep.id);
      }
    } else {
      Alert.alert('Remove Course Rep', `Remove ${rep.studentName} as a course rep?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => handleRemoveRep(rep.id) },
      ]);
    }
  };

  const handleRemoveRep = async (repId) => {
    try {
      setLoading(true);
      await deleteDoc(doc(firestore, 'courseReps', repId));
      setReps((prev) => prev.filter((r) => r.id !== repId));
    } catch (error) {
      Alert.alert('Error', 'Failed to remove course rep');
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = async (repId, permKey, currentValue) => {
    try {
      const newReps = reps.map((r) =>
        r.id === repId ? { ...r, permissions: { ...r.permissions, [permKey]: !currentValue } } : r
      );
      setReps(newReps);

      const repRef = doc(firestore, 'courseReps', repId);
      await updateDoc(repRef, { [`permissions.${permKey}`]: !currentValue });
    } catch (error) {
      Alert.alert('Error', 'Failed to update permission');
      await fetchReps();
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
          <View style={styles.headerInfo}>
            <Text style={styles.title}>Course Reps</Text>
            <Text style={styles.subtitle}>{courseCode} - {courseName}</Text>
          </View>
          <TouchableOpacity onPress={() => setAddModalVisible(true)} style={styles.addButton}>
            <Ionicons name="person-add" size={24} color={fluentColors.brand} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={reps}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[fluentColors.brand]} />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color={fluentColors.neutralQuaternary} />
              <Text style={styles.emptyTitle}>No Course Reps</Text>
              <Text style={styles.emptyText}>Invite a student by matric number to assign as course rep</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.repCard}>
              <View style={styles.repHeader}>
                <View style={styles.repAvatar}>
                  <Ionicons name="person" size={24} color={fluentColors.brand} />
                </View>
                <View style={styles.repInfo}>
                  <Text style={styles.repName}>{item.studentName}</Text>
                  <Text style={styles.repMatric}>{item.studentMatric}</Text>
                </View>
                <TouchableOpacity onPress={() => confirmRemoveRep(item)} style={styles.removeButton}>
                  <Ionicons name="close-circle" size={24} color={fluentColors.danger} />
                </TouchableOpacity>
              </View>

              <View style={styles.permissionsSection}>
                <Text style={styles.permissionsLabel}>Permissions</Text>
                <View style={styles.permissionRow}>
                  <View style={styles.permissionInfo}>
                    <Ionicons name="checkmark-circle-outline" size={18} color={fluentColors.success} />
                    <Text style={styles.permissionText}>Take Attendance</Text>
                  </View>
                  <Switch
                    value={item.permissions?.canTakeAttendance}
                    onValueChange={() => togglePermission(item.id, 'canTakeAttendance', item.permissions?.canTakeAttendance)}
                    trackColor={{ false: fluentColors.neutralLighter, true: fluentColors.successBackground }}
                    thumbColor={item.permissions?.canTakeAttendance ? fluentColors.success : fluentColors.neutralTertiary}
                  />
                </View>
                <View style={styles.permissionRow}>
                  <View style={styles.permissionInfo}>
                    <Ionicons name="create-outline" size={18} color={fluentColors.brand} />
                    <Text style={styles.permissionText}>Add / Remove Students</Text>
                  </View>
                  <Switch
                    value={item.permissions?.canEdit}
                    onValueChange={() => togglePermission(item.id, 'canEdit', item.permissions?.canEdit)}
                    trackColor={{ false: fluentColors.neutralLighter, true: fluentColors.brandBackground }}
                    thumbColor={item.permissions?.canEdit ? fluentColors.brand : fluentColors.neutralTertiary}
                  />
                </View>
                <View style={styles.permissionRow}>
                  <View style={styles.permissionInfo}>
                    <Ionicons name="trash-outline" size={18} color={fluentColors.danger} />
                    <Text style={styles.permissionText}>Delete Records</Text>
                  </View>
                  <Switch
                    value={item.permissions?.canDelete}
                    onValueChange={() => togglePermission(item.id, 'canDelete', item.permissions?.canDelete)}
                    trackColor={{ false: fluentColors.neutralLighter, true: fluentColors.dangerBackground }}
                    thumbColor={item.permissions?.canDelete ? fluentColors.danger : fluentColors.neutralTertiary}
                  />
                </View>
              </View>

              <View style={styles.repFooter}>
                <Text style={styles.grantedByText}>Granted by: {item.grantedByName}</Text>
              </View>
            </View>
          )}
        />
      </View>

      <Modal animationType="slide" transparent visible={addModalVisible} onRequestClose={() => setAddModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Course Rep</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close-outline" size={24} color={fluentColors.neutralSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Enter the matric number of the student you want to assign as a course rep for {courseCode}.
            </Text>

            <Text style={styles.inputLabel}>Matric Number</Text>
            <TextInput
              style={styles.input}
              value={matricNumber}
              onChangeText={setMatricNumber}
              placeholder="e.g. 2024/1/00123"
              placeholderTextColor={fluentColors.neutralTertiary}
            />

            <Text style={styles.inputLabel}>Permissions</Text>
            <View style={styles.permissionToggles}>
              <View style={styles.permissionToggleRow}>
                <Text style={styles.permissionToggleText}>Take Attendance</Text>
                <Switch
                  value={permissions.canTakeAttendance}
                  onValueChange={(v) => setPermissions({ ...permissions, canTakeAttendance: v })}
                  trackColor={{ false: fluentColors.neutralLighter, true: fluentColors.successBackground }}
                  thumbColor={permissions.canTakeAttendance ? fluentColors.success : fluentColors.neutralTertiary}
                />
              </View>
              <View style={styles.permissionToggleRow}>
                <Text style={styles.permissionToggleText}>Add / Remove Students</Text>
                <Switch
                  value={permissions.canEdit}
                  onValueChange={(v) => setPermissions({ ...permissions, canEdit: v })}
                  trackColor={{ false: fluentColors.neutralLighter, true: fluentColors.brandBackground }}
                  thumbColor={permissions.canEdit ? fluentColors.brand : fluentColors.neutralTertiary}
                />
              </View>
              <View style={styles.permissionToggleRow}>
                <Text style={styles.permissionToggleText}>Delete Records</Text>
                <Switch
                  value={permissions.canDelete}
                  onValueChange={(v) => setPermissions({ ...permissions, canDelete: v })}
                  trackColor={{ false: fluentColors.neutralLighter, true: fluentColors.dangerBackground }}
                  thumbColor={permissions.canDelete ? fluentColors.danger : fluentColors.neutralTertiary}
                />
              </View>
            </View>

            <TouchableOpacity onPress={addRep} style={styles.addButtonModal} disabled={adding}>
              {adding ? (
                <ActivityIndicator size="small" color={fluentColors.white} />
              ) : (
                <>
                  <Ionicons name="person-add-outline" size={20} color={fluentColors.white} />
                  <Text style={styles.addButtonText}>Add Course Rep</Text>
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
  title: { fontSize: 22, fontWeight: '700', color: fluentColors.neutralPrimary },
  subtitle: { fontSize: 13, color: fluentColors.neutralSecondary, marginTop: 2 },
  addButton: { padding: 4 },
  listContent: { width: '100%', maxWidth: 800, padding: fluentSpacing.m, paddingBottom: 100 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: fluentColors.neutralPrimary, marginTop: fluentSpacing.m },
  emptyText: { fontSize: 13, color: fluentColors.neutralSecondary, marginTop: 4, textAlign: 'center', paddingHorizontal: 40 },
  repCard: {
    backgroundColor: fluentColors.white, borderRadius: fluentRadius.l, padding: fluentSpacing.m,
    marginBottom: fluentSpacing.s, borderWidth: 1, borderColor: fluentColors.neutralLighter,
    ...fluentShadows.card,
  },
  repHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: fluentSpacing.s },
  repAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: fluentColors.brandBackground,
    justifyContent: 'center', alignItems: 'center', marginRight: fluentSpacing.s,
  },
  repInfo: { flex: 1 },
  repName: { fontSize: 16, fontWeight: '600', color: fluentColors.neutralPrimary },
  repMatric: { fontSize: 13, color: fluentColors.brand, marginTop: 2 },
  removeButton: { padding: 4 },
  permissionsSection: {
    paddingTop: fluentSpacing.s, borderTopWidth: 1, borderTopColor: fluentColors.neutralLighter,
  },
  permissionsLabel: { fontSize: 12, fontWeight: '600', color: fluentColors.neutralSecondary, marginBottom: fluentSpacing.xs },
  permissionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6,
  },
  permissionInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  permissionText: { fontSize: 14, color: fluentColors.neutralPrimary },
  repFooter: {
    paddingTop: fluentSpacing.s, borderTopWidth: 1, borderTopColor: fluentColors.neutralLighter, marginTop: fluentSpacing.s,
  },
  grantedByText: { fontSize: 11, color: fluentColors.neutralTertiary },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: {
    backgroundColor: fluentColors.white, borderRadius: fluentRadius.xl, padding: fluentSpacing.l,
    width: '90%', maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: fluentSpacing.s,
  },
  modalTitle: { fontSize: 20, fontWeight: '600', color: fluentColors.neutralPrimary },
  modalDescription: { fontSize: 13, color: fluentColors.neutralSecondary, marginBottom: fluentSpacing.m },
  inputLabel: { fontSize: 14, fontWeight: '500', color: fluentColors.neutralPrimary, marginBottom: fluentSpacing.xs },
  input: {
    borderWidth: 1, borderColor: fluentColors.neutralLighter, borderRadius: fluentRadius.m,
    padding: 12, fontSize: 16, color: fluentColors.neutralPrimary, backgroundColor: fluentColors.neutralLightest,
    marginBottom: fluentSpacing.m,
  },
  permissionToggles: { marginBottom: fluentSpacing.m },
  permissionToggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: fluentColors.neutralLighter,
  },
  permissionToggleText: { fontSize: 14, color: fluentColors.neutralPrimary },
  addButtonModal: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: fluentColors.brand, paddingVertical: 14, borderRadius: fluentRadius.m, gap: fluentSpacing.s,
  },
  addButtonText: { color: fluentColors.white, fontSize: 16, fontWeight: '600' },
});

export default CourseRepManager;
