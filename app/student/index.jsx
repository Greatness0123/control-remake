import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, RefreshControl, ScrollView, FlatList, ActivityIndicator, SafeAreaView, StatusBar } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { auth, firestore } from '../../config/firebaseconfig';
import { doc, getDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { Platform } from 'react-native';

const StudentDashboard = ({ navigation, route }) => {
  const [userData, setUserData] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [updatedData, setUpdatedData] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [pastBroadcasts, setPastBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [isCourseRep, setIsCourseRep] = useState(false);
  const [sharedCoursesCount, setSharedCoursesCount] = useState(0);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const userDoc = await getDoc(doc(firestore, 'students', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserData(data);
            setUpdatedData(data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();

    const checkCourseRep = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const repsSnapshot = await getDocs(
            query(collection(firestore, 'courseReps'), where('studentId', '==', user.uid))
          );
          const activeReps = repsSnapshot.docs.filter(d => d.data().isActive);
          setIsCourseRep(activeReps.length > 0);
          setSharedCoursesCount(activeReps.length);
        }
      } catch (error) {
        console.error('Failed to check course rep status:', error);
      }
    };

    checkCourseRep();
  }, []);

  useEffect(() => {
    const fetchPastBroadcasts = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const broadcastsSnapshot = await getDocs(collection(firestore, 'broadcasts'));
          const broadcasts = [];

          for (const broadcastDoc of broadcastsSnapshot.docs) {
            const participantsSnapshot = await getDocs(collection(firestore, `broadcasts/${broadcastDoc.id}/participants`));
            const participantDoc = participantsSnapshot.docs.find(doc => doc.id === user.uid);

            if (participantDoc) {
              const broadcastData = broadcastDoc.data();
              const participantData = participantDoc.data();
              broadcasts.push({
                id: broadcastDoc.id,
                customId: broadcastData.customId || broadcastDoc.id,
                teacherFullName: broadcastData.teacherFullName || 'Unknown',
                joinedAt: participantData.timeSignedIn?.toDate() || 'N/A',
              });
            }
          }

          setPastBroadcasts(broadcasts);
        }
      } catch (error) {
        console.error('Failed to fetch past broadcasts:', error);
      }
    };

    fetchPastBroadcasts();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(firestore, 'students', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData(data);
          setUpdatedData(data);
        }

        const broadcastsSnapshot = await getDocs(collection(firestore, 'broadcasts'));
        const broadcasts = [];

        for (const broadcastDoc of broadcastsSnapshot.docs) {
          const participantsSnapshot = await getDocs(collection(firestore, `broadcasts/${broadcastDoc.id}/participants`));
          const participantDoc = participantsSnapshot.docs.find(doc => doc.id === user.uid);

          if (participantDoc) {
            const broadcastData = broadcastDoc.data();
            const participantData = participantDoc.data();
            broadcasts.push({
              id: broadcastDoc.id,
              customId: broadcastData.customId || broadcastDoc.id,
              teacherFullName: broadcastData.teacherFullName || 'Unknown',
              joinedAt: participantData.timeSignedIn?.toDate() || 'N/A',
            });
          }
        }

        setPastBroadcasts(broadcasts);
      }
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleBroadcastScreen = async () => {
    try {
      navigation.reset({
        index: 0,
        routes: [{ name: 'StudentBroadcastScreen' }],
      });
    } catch (error) {
      console.error('Routing failed:', error);
    }
  };

  const handleUpdate = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        await updateDoc(doc(firestore, 'students', user.uid), updatedData);
        setUserData(updatedData);
        setEditing(false);
        Alert.alert(
          'Success',
          'Your information has been updated. Note: Updates will be applied in 3 days.'
        );
      }
    } catch (error) {
      console.error('Failed to update user data:', error);
      Alert.alert('Error', 'Failed to update your information.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#3b82f6"]} />}
        >
          <View style={styles.headerContainer}>
            <Text style={styles.title} numberOfLines={1}>Welcome, {userData?.fullName || 'Student'}</Text>
            <View style={styles.topIconsContainer}>
              <TouchableOpacity onPress={handleLogout} style={styles.logoutIcon}>
                <Ionicons name="log-out-outline" size={24} color="#ef4444" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.profileIcon}>
                <Ionicons name="person-circle-outline" size={24} color="#3b82f6" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.welcomeSection}>
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{pastBroadcasts.length}</Text>
                <Text style={styles.statLabel}>Total Sessions</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>
                  {pastBroadcasts.filter(b => b.joinedAt !== 'N/A').length}
                </Text>
                <Text style={styles.statLabel}>Attended</Text>
              </View>
            </View>
          </View>

          <View style={styles.quickActionsSection}>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('CourseHistory')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#EFF6FC' }]}>
                <Ionicons name="school" size={24} color="#0078D4" />
              </View>
              <View style={styles.quickActionInfo}>
                <Text style={styles.quickActionTitle}>Attendance by Course</Text>
                <Text style={styles.quickActionSubtext}>View per-course statistics</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#A19F9D" />
            </TouchableOpacity>

            {isCourseRep && (
              <TouchableOpacity
                style={styles.quickActionCard}
                onPress={() => navigation.navigate('SharedCourses')}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#F3E8FF' }]}>
                  <Ionicons name="people" size={24} color="#8764B8" />
                </View>
                <View style={styles.quickActionInfo}>
                  <Text style={styles.quickActionTitle}>Shared Courses</Text>
                  <Text style={styles.quickActionSubtext}>You're a Course Rep for {sharedCoursesCount} course{sharedCoursesCount !== 1 ? 's' : ''}</Text>
                </View>
                <View style={styles.repBadge}>
                  <Text style={styles.repBadgeText}>Rep</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Attendance History</Text>
          </View>

          {pastBroadcasts.length === 0 ? (
            <View style={styles.noBroadcastsContainer}>
              <Ionicons name="document-text-outline" size={48} color="#cbd5e1" />
              <Text style={styles.noBroadcastsText}>No attendance records yet</Text>
              <Text style={styles.noBroadcastsSubtext}>Join available broadcasts to see your history</Text>
            </View>
          ) : (
            <View style={styles.broadcastsList}>
              {pastBroadcasts.map((item) => {
                const dateTime = item.joinedAt?.toLocaleString() || 'N/A';
                const [date, time] = dateTime.split(', ');
                return (
                  <View key={item.id} style={styles.broadcastItem}>
                    <View style={styles.broadcastHeader}>
                      <View style={styles.broadcastInfo}>
                        <Text style={styles.courseText}>{item.customId}</Text>
                        <Text style={styles.broadcastSubtext}>
                          <Ionicons name="person-outline" size={14} color="#64748b" />
                          <Text style={styles.lecturerText}> {item.teacherFullName}</Text>
                        </Text>
                      </View>
                      <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>Completed</Text>
                      </View>
                    </View>
                    
                    <View style={styles.broadcastDetails}>
                      <Text style={styles.broadcastDateTime}>
                        <Ionicons name="calendar-outline" size={14} color="#3b82f6" />
                        <Text style={styles.dateText}> {date}</Text>
                        <Text style={styles.timeText}> {time}</Text>
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        <TouchableOpacity onPress={handleBroadcastScreen} style={styles.floatingButton}>
          <Ionicons name="search" size={24} color="#ffffff" />
        </TouchableOpacity>

        {/* Profile Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Profile</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close-outline" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
              
              {editing ? (
                <View style={styles.editSection}>
                  <TouchableOpacity onPress={() => setEditing(false)} style={styles.backArrow}>
                    <Ionicons name="arrow-back" size={24} color="#3b82f6" />
                  </TouchableOpacity>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Full Name</Text>
                    <TextInput
                      style={styles.input}
                      value={updatedData.fullName}
                      onChangeText={(text) => setUpdatedData({ ...updatedData, fullName: text })}
                      placeholder="Full Name"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Matric Number</Text>
                    <TextInput
                      style={styles.input}
                      value={updatedData.matricNumber}
                      onChangeText={(text) => setUpdatedData({ ...updatedData, matricNumber: text })}
                      placeholder="Matric Number"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Department</Text>
                    <TextInput
                      style={styles.input}
                      value={updatedData.department}
                      onChangeText={(text) => setUpdatedData({ ...updatedData, department: text })}
                      placeholder="Department"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>College</Text>
                    <TextInput
                      style={styles.input}
                      value={updatedData.college}
                      onChangeText={(text) => setUpdatedData({ ...updatedData, college: text })}
                      placeholder="College"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Current Level</Text>
                    <TextInput
                      style={styles.input}
                      value={updatedData.currentLevel}
                      onChangeText={(text) => setUpdatedData({ ...updatedData, currentLevel: text })}
                      placeholder="Current Level"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>

                  <Text style={styles.noteText}>Note: Updates will be applied in 3 days.</Text>
                  
                  <TouchableOpacity onPress={handleUpdate} style={styles.saveButton}>
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.viewSection}>
                  <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Name</Text>
                      <Text style={styles.infoValue}>{userData?.fullName}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Matric Number</Text>
                      <Text style={styles.infoValue}>{userData?.matricNumber}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Department</Text>
                      <Text style={styles.infoValue}>{userData?.department}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>College</Text>
                      <Text style={styles.infoValue}>{userData?.college}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Current Level</Text>
                      <Text style={styles.infoValue}>{userData?.currentLevel}</Text>
                    </View>
                  </View>
                  
                  <TouchableOpacity onPress={() => setEditing(true)} style={styles.editButton}>
                    <Ionicons name="create-outline" size={18} color="#ffffff" />
                    <Text style={styles.editButtonText}>Edit Profile</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: 40,
    paddingBottom: 40,
    alignItems: 'center',
  },
  scrollContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 800,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
  },
  topIconsContainer: {
    flexDirection: 'row',
  },
  logoutIcon: {
    marginRight: 16,
  },
  profileIcon: {
    marginRight: 0,
  },
  welcomeSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  welcomeText: {
    fontSize: 18,
    color: '#64748b',
    marginBottom: 16,
  },
  nameText: {
    fontWeight: '600',
    color: '#3b82f6',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3b82f6',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  noBroadcastsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noBroadcastsText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
  },
  noBroadcastsSubtext: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
  },
  broadcastsList: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  broadcastItem: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  broadcastHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  broadcastInfo: {
    flex: 1,
  },
  courseText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  broadcastSubtext: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lecturerText: {
    fontSize: 14,
    color: '#64748b',
    marginLeft: 4,
  },
  statusBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  broadcastDetails: {
    marginTop: 8,
  },
  broadcastDateTime: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 14,
    color: '#64748b',
    marginLeft: 4,
  },
  timeText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
    marginLeft: 4,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    backgroundColor: '#3b82f6',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
  },
  editSection: {
    width: '100%',
  },
  backArrow: {
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1e293b',
    backgroundColor: '#f8fafc',
  },
  noteText: {
    fontSize: 12,
    color: '#f59e0b',
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  viewSection: {
    width: '100%',
  },
  infoCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '600',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  quickActionsSection: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  quickActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#EDEBE9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  quickActionInfo: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#242424',
  },
  quickActionSubtext: {
    fontSize: 12,
    color: '#605E5C',
    marginTop: 2,
  },
  repBadge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  repBadgeText: {
    color: '#8764B8',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default StudentDashboard;