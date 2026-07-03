import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
  SafeAreaView, Platform, StatusBar, RefreshControl, TextInput, Alert, Modal,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { firestore } from '../../config/firebaseconfig';
import { collection, getDocs, onSnapshot, deleteDoc, doc, addDoc, Timestamp, query, where } from 'firebase/firestore';
import { getDoc, updateDoc } from 'firebase/firestore';
import { fluentColors, fluentSpacing, fluentRadius, fluentShadows } from '../../utils/fluentTheme';
import { showToast } from '../components/Toast';

const ParticipantsView = ({ navigation, route }) => {
  const { broadcastId, broadcastName, userRole, userId, canEdit } = route.params;
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredParticipants, setFilteredParticipants] = useState([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [matricNumber, setMatricNumber] = useState('');
  const [adding, setAdding] = useState(false);
  const [expandedCards, setExpandedCards] = useState({});
  const [currentUserName, setCurrentUserName] = useState('');

  useEffect(() => {
    const fetchUserName = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const collectionName = userRole === 'rep' ? 'students' : 'teachers';
        const userDoc = await getDoc(doc(firestore, collectionName, user.uid));
        if (userDoc.exists()) {
          setCurrentUserName(userDoc.data().fullName);
        }
      } catch (e) {
        console.error("Error fetching user name:", e);
      }
    };
    fetchUserName();
  }, [userRole]);

  const toggleCard = (id) => {
    setExpandedCards(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(firestore, `broadcasts/${broadcastId}/participants`),
      (snapshot) => {
        const participantsList = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
        }));

        participantsList.sort((a, b) => {
          const timeA = a.timeSignedIn?.toDate() || new Date(0);
          const timeB = b.timeSignedIn?.toDate() || new Date(0);
          return timeB - timeA;
        });

        setParticipants(participantsList);
        setFilteredParticipants(participantsList);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching participants:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [broadcastId]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredParticipants(participants);
    } else {
      const filtered = participants.filter(p =>
        p.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.matricNumber?.toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.college?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.department?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredParticipants(filtered);
    }
  }, [searchQuery, participants]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const snapshot = await getDocs(collection(firestore, `broadcasts/${broadcastId}/participants`));
      const participantsList = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      }));

      participantsList.sort((a, b) => {
        const timeA = a.timeSignedIn?.toDate() || new Date(0);
        const timeB = b.timeSignedIn?.toDate() || new Date(0);
        return timeB - timeA;
      });

      setParticipants(participantsList);
      setFilteredParticipants(participantsList);
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const addStudentByMatric = async () => {
    if (!matricNumber.trim()) {
      Alert.alert('Error', 'Please enter a matric number');
      return;
    }

    setAdding(true);
    try {
      const studentsSnapshot = await getDocs(collection(firestore, 'students'));
      const student = studentsSnapshot.docs.find(
        d => d.data().matricNumber?.toLowerCase() === matricNumber.trim().toLowerCase()
      );

      if (!student) {
        Alert.alert('Error', 'Student not found with this matric number');
        return;
      }

      const alreadyExists = participants.some(
        p => p.matricNumber?.toLowerCase() === matricNumber.trim().toLowerCase()
      );
      if (alreadyExists) {
        Alert.alert('Error', 'This student is already in the attendance record');
        return;
      }

      const studentData = student.data();

      await addDoc(collection(firestore, `broadcasts/${broadcastId}/participants`), {
        fullName: studentData.fullName,
        matricNumber: studentData.matricNumber,
        college: studentData.college,
        department: studentData.department,
        currentLevel: studentData.currentLevel,
        timeSignedIn: Timestamp.now(),
        addedByLecturer: userRole === 'lecturer',
        addedByRep: userRole === 'rep',
        addedBy: userId,
        addedByName: currentUserName || (userRole === 'lecturer' ? 'Lecturer' : 'Course Rep'),
        addedByRole: userRole,
        studentPlatform: 'MANUAL_ADD',
      });

      Alert.alert('Success', `${studentData.fullName} added to attendance`);
      setMatricNumber('');
      setAddModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to add student: ' + (error.message || 'Unknown'));
    } finally {
      setAdding(false);
    }
  };

  const removeParticipant = (participantId, participantName) => {
    const handleRemove = async () => {
      try {
        setLoading(true);
        await deleteDoc(doc(firestore, `broadcasts/${broadcastId}/participants`, participantId));
        showToast(`Removed ${participantName}`);
      } catch (error) {
        showToast('Failed to remove student', 'error');
      } finally {
        setLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Remove ${participantName} from this attendance record?`)) {
        handleRemove();
      }
    } else {
      Alert.alert(
        'Remove Student',
        `Remove ${participantName} from this attendance record?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: handleRemove },
        ]
      );
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const renderParticipantItem = ({ item, index }) => {
    const timeSignedIn = item.timeSignedIn?.toDate().toLocaleString() || 'N/A';
    const [date, time] = timeSignedIn.split(', ');
    const isExpanded = expandedCards[item.id];

    return (
      <View style={styles.participantCard}>
        <View style={styles.participantHeaderRow}>
          <TouchableOpacity
            style={styles.participantMainArea}
            onPress={() => toggleCard(item.id)}
            activeOpacity={0.7}
          >
            <View style={styles.participantNumber}>
              <Text style={styles.participantNumberText}>{index + 1}</Text>
            </View>
            <View style={styles.participantMainInfo}>
              <Text style={styles.participantName}>{item.fullName || 'N/A'}</Text>
              <Text style={styles.participantMatric}>{item.matricNumber || 'N/A'}</Text>
            </View>
            <View style={styles.headerBadges}>
              {item.addedByLecturer && (
                <View style={styles.manualBadge}>
                  <Ionicons name="person-add" size={12} color={fluentColors.warning} />
                  <Text style={styles.manualBadgeText}>Manual</Text>
                </View>
              )}
              {item.addedByRep && (
                <View style={styles.repBadge}>
                  <Ionicons name="people" size={12} color={fluentColors.purple} />
                  <Text style={styles.repBadgeText}>Rep Added</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.participantActions}>
            {canEdit && (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeParticipant(item.id, item.fullName)}
              >
                <Ionicons name="close-circle" size={26} color={fluentColors.danger} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => toggleCard(item.id)} style={{ padding: 4 }}>
              <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={22}
                color={fluentColors.neutralSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.participantDetails}>
              <View style={styles.detailRow}>
                <Ionicons name="school-outline" size={16} color={fluentColors.neutralSecondary} />
                <Text style={styles.detailText}>{item.college || 'N/A'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="book-outline" size={16} color={fluentColors.neutralSecondary} />
                <Text style={styles.detailText}>{item.department || 'N/A'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="ribbon-outline" size={16} color={fluentColors.neutralSecondary} />
                <Text style={styles.detailText}>Level {item.currentLevel || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.timeInfo}>
              <Ionicons name="time-outline" size={14} color={fluentColors.brand} />
              <Text style={styles.timeText}>Signed in: {date} at {time}</Text>
            </View>

            {item.addedBy && (
              <View style={styles.addedByInfo}>
                <Ionicons name="person-outline" size={12} color={fluentColors.neutralTertiary} />
                <Text style={styles.addedByText}>
                  Added by: {item.addedByName} ({item.addedByRole})
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={fluentColors.brand} />
          <Text style={styles.loadingText}>Loading participants...</Text>
        </View>
      </SafeAreaView>
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
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Participants</Text>
            <Text style={styles.subtitle}>{broadcastName}</Text>
          </View>
          {canEdit && (
            <TouchableOpacity onPress={() => setAddModalVisible(true)} style={styles.addButton}>
              <Ionicons name="person-add" size={24} color={fluentColors.brand} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Ionicons name="people" size={24} color={fluentColors.brand} />
            <Text style={styles.statNumber}>{participants.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle" size={24} color={fluentColors.success} />
            <Text style={styles.statNumber}>
              {participants.filter(p => !p.addedByLecturer && !p.addedByRep).length}
            </Text>
            <Text style={styles.statLabel}>Self Check-in</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="person-add" size={24} color={fluentColors.warning} />
            <Text style={styles.statNumber}>
              {participants.filter(p => p.addedByLecturer || p.addedByRep).length}
            </Text>
            <Text style={styles.statLabel}>Manual</Text>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color={fluentColors.neutralSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, matric, college..."
            placeholderTextColor={fluentColors.neutralTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={fluentColors.neutralTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {filteredParticipants.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color={fluentColors.neutralQuaternary} />
            <Text style={styles.emptyStateTitle}>
              {searchQuery ? 'No matching participants' : 'No participants yet'}
            </Text>
            <Text style={styles.emptyStateText}>
              {searchQuery
                ? 'Try adjusting your search'
                : 'Participants will appear here in real-time'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredParticipants}
            renderItem={renderParticipantItem}
            keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[fluentColors.brand]}
              />
            }
            ListHeaderComponent={
              searchQuery.length > 0 && (
                <Text style={styles.resultsHeader}>
                  {filteredParticipants.length} result{filteredParticipants.length !== 1 ? 's' : ''} found
                </Text>
              )
            }
          />
        )}
      </View>

      <Modal animationType="slide" transparent visible={addModalVisible} onRequestClose={() => setAddModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Student</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close-outline" size={24} color={fluentColors.neutralSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDescription}>Enter the matric number of the student to add</Text>
            <TextInput
              style={styles.input}
              value={matricNumber}
              onChangeText={setMatricNumber}
              placeholder="Matric Number"
              placeholderTextColor={fluentColors.neutralTertiary}
            />
            <TouchableOpacity onPress={addStudentByMatric} style={styles.addButtonModal} disabled={adding}>
              {adding ? (
                <ActivityIndicator size="small" color={fluentColors.white} />
              ) : (
                <Text style={styles.addButtonText}>Add Student</Text>
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
  container: { flex: 1, backgroundColor: fluentColors.white },
  header: {
    width: '100%',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: fluentColors.neutralLighter,
  },
  statsBar: {
    width: '100%',
    flexDirection: 'row', backgroundColor: fluentColors.neutralLightest, paddingVertical: 16,
    paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: fluentColors.neutralLighter,
  },
  searchContainer: {
    width: '100%',
    flexDirection: 'row', alignItems: 'center', backgroundColor: fluentColors.neutralLightest,
    marginHorizontal: 20, marginVertical: 16, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: fluentRadius.m, borderWidth: 1, borderColor: fluentColors.neutralLighter,
  },
  listContainer: { width: '100%', paddingHorizontal: 20, paddingBottom: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: fluentColors.neutralSecondary },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: fluentColors.neutralLighter,
  },
  backButton: { marginRight: 16 },
  headerTextContainer: { flex: 1 },
  title: { fontSize: 24, fontWeight: '700', color: fluentColors.neutralPrimary },
  subtitle: { fontSize: 14, color: fluentColors.neutralSecondary, marginTop: 2 },
  addButton: { padding: 4 },
  statsBar: {
    flexDirection: 'row', backgroundColor: fluentColors.neutralLightest, paddingVertical: 16,
    paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: fluentColors.neutralLighter,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: '700', color: fluentColors.neutralPrimary, marginTop: 4 },
  statLabel: { fontSize: 11, color: fluentColors.neutralSecondary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: fluentColors.neutralLighter, marginHorizontal: 8 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: fluentColors.neutralLightest,
    marginHorizontal: 20, marginVertical: 16, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: fluentRadius.m, borderWidth: 1, borderColor: fluentColors.neutralLighter,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: fluentColors.neutralPrimary },
  clearButton: { padding: 4 },
  resultsHeader: { fontSize: 14, color: fluentColors.neutralSecondary, marginBottom: 12, fontWeight: '500' },
  listContainer: { paddingHorizontal: 20, paddingBottom: 20 },
  participantCard: {
    backgroundColor: fluentColors.white, borderWidth: 1, borderColor: fluentColors.neutralLighter,
    borderRadius: fluentRadius.l, padding: 12, marginBottom: 12, ...fluentShadows.card,
  },
  participantHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  participantMainArea: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  participantActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginRight: 8 },
  expandedContent: { marginTop: 12, borderTopWidth: 1, borderTopColor: fluentColors.neutralLighter, paddingTop: 12 },
  participantNumber: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: fluentColors.brandBackground,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  participantNumberText: { fontSize: 16, fontWeight: '700', color: fluentColors.brand },
  participantMainInfo: { flex: 1 },
  participantName: { fontSize: 16, fontWeight: '600', color: fluentColors.neutralPrimary, marginBottom: 2 },
  participantMatric: { fontSize: 14, color: fluentColors.brand, fontWeight: '500' },
  manualBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: fluentColors.warningBackground,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: fluentRadius.s, gap: 4, marginRight: 4,
  },
  manualBadgeText: { fontSize: 11, color: fluentColors.warning, fontWeight: '600' },
  repBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: fluentColors.purpleBackground,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: fluentRadius.s, gap: 4, marginRight: 4,
  },
  repBadgeText: { fontSize: 11, color: fluentColors.purple, fontWeight: '600' },
  removeButton: { padding: 2 },
  participantDetails: { marginBottom: 12, gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 14, color: fluentColors.neutralSecondary },
  timeInfo: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: fluentColors.brandBackground,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: fluentRadius.s, gap: 6,
  },
  timeText: { fontSize: 12, color: fluentColors.brand, fontWeight: '500' },
  addedByInfo: {
    flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4,
  },
  addedByText: { fontSize: 11, color: fluentColors.neutralTertiary },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyStateTitle: { fontSize: 18, fontWeight: '600', color: fluentColors.neutralPrimary, marginTop: 16, textAlign: 'center' },
  emptyStateText: { fontSize: 14, color: fluentColors.neutralSecondary, marginTop: 8, textAlign: 'center' },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: {
    backgroundColor: fluentColors.white, borderRadius: fluentRadius.xl, padding: fluentSpacing.l,
    width: '90%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: fluentSpacing.s,
  },
  modalTitle: { fontSize: 20, fontWeight: '600', color: fluentColors.neutralPrimary },
  modalDescription: { fontSize: 13, color: fluentColors.neutralSecondary, marginBottom: fluentSpacing.m },
  input: {
    borderWidth: 1, borderColor: fluentColors.neutralLighter, borderRadius: fluentRadius.m,
    padding: 12, fontSize: 16, color: fluentColors.neutralPrimary, backgroundColor: fluentColors.neutralLightest,
    marginBottom: fluentSpacing.m,
  },
  addButtonModal: {
    backgroundColor: fluentColors.brand, paddingVertical: 14, borderRadius: fluentRadius.m, alignItems: 'center',
  },
  addButtonText: { color: fluentColors.white, fontSize: 16, fontWeight: '600' },
});

export default ParticipantsView;
