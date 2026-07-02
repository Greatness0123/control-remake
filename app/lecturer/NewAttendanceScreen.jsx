import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, Alert,
  ActivityIndicator, ScrollView, Switch, SafeAreaView, Platform, StatusBar, FlatList, RefreshControl, Modal,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { firestore } from '../../config/firebaseconfig';
import { collection, addDoc, Timestamp, GeoPoint, getDoc, doc, getDocs, query, where, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getCurrentLocation, getPlatformIdentifier } from '../../utils/locationHelpers';
import { fluentColors, fluentSpacing, fluentRadius, fluentShadows } from '../../utils/fluentTheme';
import QRCode from 'react-native-qrcode-svg';
import { showToast } from '../components/Toast';

const NewAttendanceScreen = ({ navigation, route }) => {
  const { courseId, courseCode, userName } = route.params;
  const [sessionName, setSessionName] = useState('');
  const [radius, setRadius] = useState('5');
  const [useLocation, setUseLocation] = useState(false);
  const [timeLimit, setTimeLimit] = useState('');
  const [isManualOnly, setIsManualOnly] = useState(false);
  const [excludeFromSummary, setExcludeFromSummary] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRadiusEmpty, setIsRadiusEmpty] = useState(false);
  const [isSessionNameEmpty, setIsSessionNameEmpty] = useState(false);

  const [activeBroadcasts, setActiveBroadcasts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [selectedBroadcastForQR, setSelectedBroadcastForQR] = useState(null);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingBroadcast, setEditingBroadcast] = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    const q = query(
      collection(firestore, 'broadcasts'),
      where('courseId', '==', courseId),
      where('isActive', '==', true)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const now = Date.now();
      const broadcasts = await Promise.all(snapshot.docs.map(async (d) => {
        const data = d.data();

        // Auto-stop if expired
        if (data.expiresAt && data.expiresAt.toMillis() < now && data.isActive) {
          await updateDoc(doc(firestore, 'broadcasts', d.id), { isActive: false, endedAt: Timestamp.now() });
          return null; // Will be filtered out by next snapshot or locally
        }

        const participantsSnapshot = await getDocs(collection(firestore, `broadcasts/${d.id}/participants`));
        return { id: d.id, ...data, participantCount: participantsSnapshot.size };
      }));
      setActiveBroadcasts(broadcasts.filter(b => b !== null).sort((a, b) => b.createdAt?.toDate() - a.createdAt?.toDate()));
    });

    return () => unsubscribe();
  }, [courseId]);

  const fetchActiveBroadcasts = async () => {
    setRefreshing(true);
    try {
      const q = query(
        collection(firestore, 'broadcasts'),
        where('courseId', '==', courseId),
        where('isActive', '==', true)
      );
      const snapshot = await getDocs(q);
      const broadcasts = await Promise.all(snapshot.docs.map(async (d) => {
        const data = d.data();
        const participantsSnapshot = await getDocs(collection(firestore, `broadcasts/${d.id}/participants`));
        return { id: d.id, ...data, participantCount: participantsSnapshot.size };
      }));
      setActiveBroadcasts(broadcasts.sort((a, b) => b.createdAt?.toDate() - a.createdAt?.toDate()));
    } catch (error) {
      console.error('Error fetching broadcasts:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const stopBroadcast = async (broadcastId) => {
    try {
      await updateDoc(doc(firestore, 'broadcasts', broadcastId), {
        isActive: false,
        endedAt: Timestamp.now(),
      });
      showToast('Attendance ended');
    } catch (error) {
      showToast('Failed to stop attendance', 'error');
    }
  };

  const updateBroadcastName = async () => {
    if (!editName.trim() || !editingBroadcast) return;
    try {
      setLoading(true);
      await updateDoc(doc(firestore, 'broadcasts', editingBroadcast.id), {
        sessionName: editName.trim()
      });
      showToast('Name updated');
      setEditModalVisible(false);
    } catch (error) {
      showToast('Failed to update name', 'error');
    } finally {
      setLoading(false);
    }
  };

  const deleteBroadcast = (broadcastId) => {
    const handleDelete = async () => {
      try {
        setLoading(true);
        await deleteDoc(doc(firestore, 'broadcasts', broadcastId));
        showToast('Record deleted');
      } catch (error) {
        showToast('Failed to delete record', 'error');
      } finally {
        setLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this attendance record?')) {
        handleDelete();
      }
    } else {
      Alert.alert('Delete Record', 'Are you sure you want to delete this attendance record?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: handleDelete },
      ]);
    }
  };

  const startAttendance = async () => {
    setLoading(true);
    const auth = getAuth();
    const user = auth.currentUser;
    const radiusMeters = parseFloat(radius);

    const isRadiusInvalid = useLocation && (isNaN(radiusMeters) || radiusMeters <= 0);
    const isNameInvalid = !sessionName.trim();

    setIsRadiusEmpty(isRadiusInvalid);
    setIsSessionNameEmpty(isNameInvalid);

    if (isRadiusInvalid || isNameInvalid) {
      Alert.alert('Error', 'Please fill in all required fields correctly');
      return;
    }

    setLoading(true);
    try {
      if (!user) {
        Alert.alert('Error', 'User is not authenticated');
        return;
      }

      let location = null;
      if (useLocation) {
        location = await getCurrentLocation();
      }

      let teacherFullName = userName || 'Unknown';
      if (!userName) {
        const teacherDoc = await getDoc(doc(firestore, 'teachers', user.uid));
        if (teacherDoc.exists()) {
          teacherFullName = teacherDoc.data()?.fullName || 'Unknown';
        }
      }

      const broadcastData = {
        teacherId: user.uid,
        teacherFullName,
        isActive: true,
        createdAt: Timestamp.now(),
        customId: courseCode,
        sessionName: sessionName.trim(),
        courseId,
        takenBy: user.uid,
        takenByName: teacherFullName,
        useLocation,
        isManualOnly,
        excludeFromSummary,
        broadcasterPlatform: getPlatformIdentifier(),
      };

      if (timeLimit.trim()) {
        const minutes = parseInt(timeLimit);
        if (!isNaN(minutes) && minutes > 0) {
          broadcastData.expiresAt = Timestamp.fromMillis(Date.now() + minutes * 60000);
        }
      }

      if (useLocation && location) {
        broadcastData.radiusMeters = radiusMeters;
        broadcastData.coordinates = new GeoPoint(location.latitude, location.longitude);
      }

      await addDoc(collection(firestore, 'broadcasts'), broadcastData);

      Alert.alert('Success', `Attendance session started for ${courseCode}`);
      setSessionName('');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to start attendance');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={fluentColors.white} />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchActiveBroadcasts} colors={[fluentColors.brand]} />}
        >
          <View style={styles.formWrapper}>
            <View style={styles.header}>
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={fluentColors.brand} />
              </TouchableOpacity>
              <View style={styles.headerInfo}>
                <Text style={styles.title}>New Attendance</Text>
                <Text style={styles.subtitle}>{courseCode}</Text>
              </View>
            </View>

            <View style={styles.formSection}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Session Name</Text>
                <TextInput
                  value={sessionName}
                  onChangeText={(text) => {
                    setSessionName(text);
                    setIsSessionNameEmpty(false);
                  }}
                  style={[styles.input, isSessionNameEmpty && styles.inputError]}
                  placeholder="e.g. Lecture 1, Week 3, Tutorial"
                  placeholderTextColor={fluentColors.neutralTertiary}
                />
                <Text style={styles.helperText}>Optional label for this attendance session</Text>
              </View>

              <View style={styles.switchContainer}>
                <View style={styles.switchRow}>
                  <View style={styles.switchLabel}>
                    <Ionicons name="location-outline" size={20} color={useLocation ? fluentColors.brand : fluentColors.neutralTertiary} />
                    <Text style={[styles.switchText, useLocation && styles.switchTextActive]}>
                      Use Location Restriction
                    </Text>
                  </View>
                  <Switch
                    value={useLocation}
                    onValueChange={setUseLocation}
                    trackColor={{ false: fluentColors.neutralLighter, true: fluentColors.brandBackground }}
                    thumbColor={useLocation ? fluentColors.brand : fluentColors.white}
                  />
                </View>
                <Text style={styles.helperText}>
                  {useLocation
                    ? 'Students must be within broadcast radius to join'
                    : 'Anyone can join regardless of location'}
                </Text>
              </View>

              {useLocation && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Broadcast Radius (meters)</Text>
                  <TextInput
                    value={radius}
                    onChangeText={(text) => {
                      setRadius(text);
                      setIsRadiusEmpty(false);
                    }}
                    keyboardType="numeric"
                    style={[styles.input, isRadiusEmpty && styles.inputError]}
                    placeholder="5"
                    placeholderTextColor={fluentColors.neutralTertiary}
                  />
                  <Text style={styles.helperText}>Classroom: 3-5m | Lecture Hall: 10-25m</Text>
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Time Limit (Minutes)</Text>
                <TextInput
                  value={timeLimit}
                  onChangeText={setTimeLimit}
                  keyboardType="numeric"
                  style={styles.input}
                  placeholder="e.g. 30 (Optional)"
                  placeholderTextColor={fluentColors.neutralTertiary}
                />
                <Text style={styles.helperText}>Auto-stops attendance after this time</Text>
              </View>

              <View style={styles.switchContainer}>
                <View style={styles.switchRow}>
                  <View style={styles.switchLabel}>
                    <Ionicons name="hand-right-outline" size={20} color={isManualOnly ? fluentColors.brand : fluentColors.neutralTertiary} />
                    <Text style={[styles.switchText, isManualOnly && styles.switchTextActive]}>
                      Manual Attendance Only
                    </Text>
                  </View>
                  <Switch
                    value={isManualOnly}
                    onValueChange={setIsManualOnly}
                    trackColor={{ false: fluentColors.neutralLighter, true: fluentColors.brandBackground }}
                    thumbColor={isManualOnly ? fluentColors.brand : fluentColors.white}
                  />
                </View>
                <Text style={styles.helperText}>
                  {isManualOnly
                    ? 'Students cannot self-join; you must add them'
                    : 'Students can join via QR/Code/Nearby'}
                </Text>
              </View>

              <View style={styles.switchContainer}>
                <View style={styles.switchRow}>
                  <View style={styles.switchLabel}>
                    <Ionicons name="stats-chart-outline" size={20} color={excludeFromSummary ? fluentColors.warning : fluentColors.neutralTertiary} />
                    <Text style={[styles.switchText, excludeFromSummary && styles.switchTextActive]}>
                      Exclude from Summary
                    </Text>
                  </View>
                  <Switch
                    value={excludeFromSummary}
                    onValueChange={setExcludeFromSummary}
                    trackColor={{ false: fluentColors.neutralLighter, true: fluentColors.warningBackground }}
                    thumbColor={excludeFromSummary ? fluentColors.warning : fluentColors.white}
                  />
                </View>
                <Text style={styles.helperText}>
                  This session won't count towards student attendance percentages.
                </Text>
              </View>

              <TouchableOpacity onPress={startAttendance} style={styles.startButton} disabled={loading}>
                {loading ? (
                  <ActivityIndicator size="small" color={fluentColors.white} />
                ) : (
                  <>
                    <Ionicons name="play-circle" size={22} color={fluentColors.white} />
                    <Text style={styles.startButtonText}>Start Attendance</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.activeSection}>
              <Text style={styles.sectionTitle}>Active Sessions</Text>
              {activeBroadcasts.length === 0 ? (
                <View style={styles.emptyActive}>
                  <Ionicons name="radio-outline" size={48} color={fluentColors.neutralQuaternary} />
                  <Text style={styles.emptyActiveText}>No active sessions for this course</Text>
                </View>
              ) : (
                activeBroadcasts.map((item) => (
                  <View key={item.id} style={styles.activeCard}>
                    <View style={styles.activeHeader}>
                      <View style={styles.activeInfo}>
                        <Text style={styles.activeName}>{item.sessionName || 'Unnamed Session'}</Text>
                        <View style={styles.activeMeta}>
                          <Ionicons name="people-outline" size={14} color={fluentColors.brand} />
                          <Text style={styles.activeMetaText}>{item.participantCount || 0} Joined</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity style={styles.editIconBadge} onPress={() => { setEditingBroadcast(item); setEditName(item.sessionName || ''); setEditModalVisible(true); }}>
                          <Ionicons name="create-outline" size={16} color={fluentColors.brand} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.stopBadge} onPress={() => stopBroadcast(item.id)}>
                          <Text style={styles.stopBadgeText}>Stop</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.activeActions}>
                      {!item.isManualOnly && (
                        <TouchableOpacity style={styles.activeActionButton} onPress={() => { setSelectedBroadcastForQR(item); setQrModalVisible(true); }}>
                          <Ionicons name="qr-code-outline" size={18} color={fluentColors.success} />
                          <Text style={styles.activeActionText}>QR</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={styles.activeActionButton} onPress={() => navigation.navigate('ParticipantsView', { broadcastId: item.id, broadcastName: item.sessionName || courseCode, canEdit: true })}>
                        <Ionicons name="eye-outline" size={18} color={fluentColors.brand} />
                        <Text style={styles.activeActionText}>View</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.activeDeleteButton} onPress={() => deleteBroadcast(item.id)}>
                        <Ionicons name="trash-outline" size={18} color={fluentColors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        </ScrollView>
      </View>

      <Modal animationType="fade" transparent visible={editModalVisible} onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Session Name</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close-outline" size={24} color={fluentColors.neutralSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter new session name"
              autoFocus
            />
            <TouchableOpacity onPress={updateBroadcastName} style={styles.startButton}>
              <Text style={styles.startButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={qrModalVisible} onRequestClose={() => setQrModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Attendance QR</Text>
              <TouchableOpacity onPress={() => setQrModalVisible(false)}>
                <Ionicons name="close-outline" size={24} color={fluentColors.neutralSecondary} />
              </TouchableOpacity>
            </View>
            {selectedBroadcastForQR && (
              <View style={styles.qrContent}>
                <Text style={styles.qrSessionName}>{selectedBroadcastForQR.sessionName}</Text>
                <View style={styles.qrWrapper}>
                  <QRCode value={selectedBroadcastForQR.customId} size={200} />
                </View>
                <Text style={styles.qrHelp}>Scan this code to join</Text>
              </View>
            )}
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
  container: { flex: 1, backgroundColor: fluentColors.neutralLightest },
  scrollContainer: { flex: 1, width: '100%' },
  formWrapper: { width: '100%' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: fluentSpacing.m,
    paddingVertical: fluentSpacing.m, backgroundColor: fluentColors.white,
    borderBottomWidth: 1, borderBottomColor: fluentColors.neutralLighter,
  },
  backButton: { marginRight: fluentSpacing.s },
  headerInfo: { flex: 1 },
  title: { fontSize: 22, fontWeight: '700', color: fluentColors.neutralPrimary },
  subtitle: { fontSize: 14, color: fluentColors.neutralSecondary, marginTop: 2 },
  formSection: { padding: fluentSpacing.l },
  inputGroup: { marginBottom: fluentSpacing.m },
  label: { fontSize: 14, fontWeight: '600', color: fluentColors.neutralPrimary, marginBottom: fluentSpacing.xs },
  input: {
    borderWidth: 1, borderColor: fluentColors.neutralLighter, borderRadius: fluentRadius.m,
    padding: 12, fontSize: 16, color: fluentColors.neutralPrimary, backgroundColor: fluentColors.white,
  },
  inputError: { borderColor: fluentColors.danger, backgroundColor: fluentColors.dangerBackground },
  helperText: { fontSize: 12, color: fluentColors.neutralSecondary, marginTop: 4 },
  switchContainer: { marginBottom: fluentSpacing.m },
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, backgroundColor: fluentColors.white, borderRadius: fluentRadius.m,
    borderWidth: 1, borderColor: fluentColors.neutralLighter,
  },
  switchLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  switchText: { fontSize: 14, color: fluentColors.neutralSecondary },
  switchTextActive: { color: fluentColors.neutralPrimary, fontWeight: '500' },
  startButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: fluentColors.brand, paddingVertical: 16, borderRadius: fluentRadius.m, gap: fluentSpacing.s,
    marginTop: fluentSpacing.l,
  },
  startButtonText: { color: fluentColors.white, fontSize: 18, fontWeight: '600' },
  activeSection: { padding: fluentSpacing.l, paddingTop: 0 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: fluentColors.neutralPrimary, marginBottom: fluentSpacing.m },
  emptyActive: { alignItems: 'center', paddingVertical: 40, backgroundColor: fluentColors.white, borderRadius: fluentRadius.l, borderWidth: 1, borderColor: fluentColors.neutralLighter, borderStyle: 'dashed' },
  emptyActiveText: { fontSize: 14, color: fluentColors.neutralSecondary, marginTop: 12 },
  activeCard: { backgroundColor: fluentColors.white, borderRadius: fluentRadius.l, padding: fluentSpacing.m, marginBottom: fluentSpacing.s, borderWidth: 1, borderColor: fluentColors.neutralLighter, ...fluentShadows.card },
  activeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: fluentSpacing.m },
  activeInfo: { flex: 1 },
  activeName: { fontSize: 16, fontWeight: '600', color: fluentColors.neutralPrimary, marginBottom: 4 },
  activeMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activeMetaText: { fontSize: 12, color: fluentColors.neutralSecondary },
  stopBadge: { backgroundColor: fluentColors.danger, paddingHorizontal: 12, paddingVertical: 6, borderRadius: fluentRadius.round },
  stopBadgeText: { color: fluentColors.white, fontSize: 12, fontWeight: '700' },
  activeActions: { flexDirection: 'row', gap: 8, paddingTop: fluentSpacing.m, borderTopWidth: 1, borderTopColor: fluentColors.neutralLighter },
  activeActionButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: fluentColors.neutralLightest, paddingHorizontal: 12, paddingVertical: 8, borderRadius: fluentRadius.m },
  activeActionText: { fontSize: 13, fontWeight: '600', color: fluentColors.neutralPrimary },
  activeDeleteButton: { marginLeft: 'auto', padding: 8 },
  editIconBadge: { backgroundColor: fluentColors.brandBackground, padding: 8, borderRadius: fluentRadius.round },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: fluentColors.white, borderRadius: fluentRadius.xl, padding: fluentSpacing.l, width: '85%', maxWidth: 400 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: fluentSpacing.l },
  modalTitle: { fontSize: 20, fontWeight: '700', color: fluentColors.neutralPrimary },
  qrContent: { alignItems: 'center', paddingVertical: fluentSpacing.m },
  qrSessionName: { fontSize: 16, fontWeight: '600', color: fluentColors.neutralPrimary, marginBottom: fluentSpacing.l },
  qrWrapper: { padding: 20, backgroundColor: fluentColors.white, borderRadius: fluentRadius.l, borderWidth: 1, borderColor: fluentColors.neutralLighter },
  qrHelp: { fontSize: 14, color: fluentColors.neutralSecondary, marginTop: fluentSpacing.l },
});

export default NewAttendanceScreen;
