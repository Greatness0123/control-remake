import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView, Platform, StatusBar, RefreshControl, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { firestore } from '../../config/firebaseconfig';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';

const ParticipantsView = ({ navigation, route }) => {
  const { broadcastId, broadcastName } = route.params;
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredParticipants, setFilteredParticipants] = useState([]);

  useEffect(() => {
    // Setting up real-time listener for participants
    const unsubscribe = onSnapshot(
      collection(firestore, `broadcasts/${broadcastId}/participants`),
      (snapshot) => {
        const participantsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Sortin by time signed in 
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
    // Filter participants based on search qwery (when the lecturer searches)
    if (searchQuery.trim() === '') {
      setFilteredParticipants(participants);
    } else {
      const filtered = participants.filter(participant => 
        participant.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        participant.matricNumber?.toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
        participant.college?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        participant.department?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredParticipants(filtered);
    }
  }, [searchQuery, participants]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const snapshot = await getDocs(collection(firestore, `broadcasts/${broadcastId}/participants`));
      const participantsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      participantsList.sort((a, b) => {
        const timeA = a.timeSignedIn?.toDate() || new Date(0);
        const timeB = b.timeSignedIn?.toDate() || new Date(0);
        return timeB - timeA;
      });
      
      setParticipants(participantsList);
      setFilteredParticipants(participantsList);
    } catch (error) {
      console.error('Error refreshing participants:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const renderParticipantItem = ({ item, index }) => {
    const timeSignedIn = item.timeSignedIn?.toDate().toLocaleString() || 'N/A';
    const [date, time] = timeSignedIn.split(', ');
    
    return (
      <View style={styles.participantCard}>
        <View style={styles.participantHeader}>
          <View style={styles.participantNumber}>
            <Text style={styles.participantNumberText}>{index + 1}</Text>
          </View>
          <View style={styles.participantMainInfo}>
            <Text style={styles.participantName}>{item.fullName || 'N/A'}</Text>
            <Text style={styles.participantMatric}>{item.matricNumber || 'N/A'}</Text>
          </View>
          {item.addedByLecturer && (
            <View style={styles.manualBadge}>
              <Ionicons name="person-add" size={12} color="#f59e0b" />
              <Text style={styles.manualBadgeText}>Manual</Text>
            </View>
          )}
        </View>
        
        <View style={styles.participantDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="school-outline" size={16} color="#64748b" />
            <Text style={styles.detailText}>{item.college || 'N/A'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="book-outline" size={16} color="#64748b" />
            <Text style={styles.detailText}>{item.department || 'N/A'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="ribbon-outline" size={16} color="#64748b" />
            <Text style={styles.detailText}>Level {item.currentLevel || 'N/A'}</Text>
          </View>
        </View>
        
        <View style={styles.timeInfo}>
          <Ionicons name="time-outline" size={14} color="#3b82f6" />
          <Text style={styles.timeText}>Signed in: {date} at {time}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading participants...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#3b82f6" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Participants</Text>
            <Text style={styles.subtitle}>{broadcastName}</Text>
          </View>
        </View>

        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Ionicons name="people" size={24} color="#3b82f6" />
            <Text style={styles.statNumber}>{participants.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle" size={24} color="#10b981" />
            <Text style={styles.statNumber}>
              {participants.filter(p => !p.addedByLecturer).length}
            </Text>
            <Text style={styles.statLabel}>Self Check-in</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="person-add" size={24} color="#f59e0b" />
            <Text style={styles.statNumber}>
              {participants.filter(p => p.addedByLecturer).length}
            </Text>
            <Text style={styles.statLabel}>Manual</Text>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, matric, college..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {filteredParticipants.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#cbd5e1" />
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
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#3b82f6"]}
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backButton: {
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    marginHorizontal: 20,
    marginVertical: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
  },
  clearButton: {
    padding: 4,
  },
  resultsHeader: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
    fontWeight: '500',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  participantCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  participantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  participantNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  participantNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3b82f6',
  },
  participantMainInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  participantMatric: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  manualBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  manualBadgeText: {
    fontSize: 11,
    color: '#d97706',
    fontWeight: '600',
  },
  participantDetails: {
    marginBottom: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#64748b',
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 6,
  },
  timeText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default ParticipantsView;