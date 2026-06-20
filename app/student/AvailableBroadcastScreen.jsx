import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  FlatList, 
  Animated, 
  SafeAreaView, 
  ActivityIndicator, 
  Platform, 
  Modal, 
  TextInput, 
  Alert, 
  StatusBar,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { firestore } from '../../config/firebaseconfig';
import { collection, getDoc, doc, setDoc, Timestamp, GeoPoint, getDocs, query, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getCurrentLocation } from '../../utils/locationHelpers';
import { calculateDistance, getPlatformAccuracyBuffer, isInRange, getPlatformIdentifier } from '../../utils/locationHelpers';

const ScanningAnimation = () => {
  const rotation = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const rotationInterpolate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate: rotationInterpolate }] }}>
      <View style={styles.scannerCircles}>
        <View style={[styles.scannerCircle, styles.scannerCircleLarge]} />
        <View style={[styles.scannerCircle, styles.scannerCircleMedium]} />
        <View style={[styles.scannerCircle, styles.scannerCircleSmall]} />
        <View style={styles.scannerLine} />
      </View>
    </Animated.View>
  );
};

const JoiningAnimation = () => (
  <View style={styles.joiningContainer}>
    <ActivityIndicator size="large" color="#3b82f6" />
    <Text style={styles.text}>Joining broadcast...</Text>
  </View>
);

const FindBroadcastScreen = ({ navigation, route }) => {
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [alert, setAlert] = useState(null);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [broadcastCode, setBroadcastCode] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredBroadcasts, setFilteredBroadcasts] = useState([]);
  const [userLocation, setUserLocation] = useState(null);

  const showAlert = (title, message) => {
    setAlert({ title, message });
  };

  const closeAlert = () => {
    setAlert(null);
  };

  const fetchNearbyBroadcasts = async () => {
    try {
      setLoading(true);
      let location = null;

      // Try to get user location
      try {
        location = await getCurrentLocation();
        setUserLocation(location);
        console.log(`[${getPlatformIdentifier()}] User location acquired:`, location);
      } catch (error) {
        console.log('Could not get location:', error);
        setUserLocation(null);
      }

      // Fetch all active broadcasts
      const q = query(collection(firestore, 'broadcasts'), where('isActive', '==', true));
      const snapshot = await getDocs(q);

      const qNew = query(collection(firestore, 'attendanceSessions'), where('status', '==', 'active'));
      const snapshotNew = await getDocs(qNew);

      const oldBroadcasts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        isNewSystem: false,
      }));

      const newSessions = await Promise.all(snapshotNew.docs.map(async (docSnap) => {
        const data = docSnap.data();
        const courseDoc = await getDoc(doc(firestore, 'courses', data.courseId));
        const courseData = courseDoc.exists() ? courseDoc.data() : { code: 'N/A', title: 'Unknown' };
        return {
          id: docSnap.id,
          ...data,
          customId: courseData.code,
          teacherFullName: data.createdByRole === 'lecturer' ? 'Lecturer' : 'Course Rep',
          isNewSystem: true,
        };
      }));

      const allBroadcasts = [...oldBroadcasts, ...newSessions];

      // Map through all broadcasts and add distance/range info with cross-platform awareness
      const broadcastsWithRange = allBroadcasts.map((broadcast) => {
        let distance = null;
        let inRange = false;
        let broadcasterPlatform = broadcast.broadcasterPlatform || 'UNKNOWN';

        if (broadcast.useLocation && broadcast.coordinates && location) {
          const teacherLocation = broadcast.coordinates;

          if (
            teacherLocation &&
            typeof teacherLocation.latitude !== 'undefined' &&
            typeof teacherLocation.longitude !== 'undefined'
          ) {
            distance = calculateDistance(
              location.latitude,
              location.longitude,
              teacherLocation.latitude,
              teacherLocation.longitude
            );

            // Use cross-platform aware range check
            inRange = isInRange(broadcast, location, broadcasterPlatform);
          }
        } else if (!broadcast.useLocation) {
          inRange = true; // Open broadcasts are always "in range"
        }

        return {
          ...broadcast,
          distance,
          inRange,
        };
      });

      // Sort: In-range broadcasts first, then by distance
      const sortedBroadcasts = broadcastsWithRange.sort((a, b) => {
        if (a.inRange !== b.inRange) {
          return a.inRange ? -1 : 1; // In range first
        }
        if (a.distance && b.distance) {
          return a.distance - b.distance; // Closest first
        }
        return 0;
      });

      setBroadcasts(sortedBroadcasts);
      setFilteredBroadcasts(sortedBroadcasts);

      // Check for toast messages
      allBroadcasts.forEach((broadcast) => {
        if (broadcast.toastMessage && broadcast.toastTimestamp) {
          const toastTime = broadcast.toastTimestamp.toDate?.() || broadcast.toastTimestamp;
          const now = new Date();
          const timeDiff = now.getTime() - toastTime.getTime();

          if (timeDiff < 5 * 60 * 1000) {
            setToastMessage(broadcast.toastMessage);
          }
        }
      });
    } catch (error) {
      showAlert(
        'Error',
        'Failed to fetch broadcasts: ' + (error instanceof Error ? error.message : 'Unknown error')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNearbyBroadcasts();
  }, []);

  // Handle search filtering
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredBroadcasts(broadcasts);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = broadcasts.filter(
        (broadcast) =>
          broadcast.customId?.toLowerCase().includes(query) ||
          broadcast.teacherFullName?.toLowerCase().includes(query) ||
          broadcast.courseName?.toLowerCase().includes(query)
      );
      setFilteredBroadcasts(filtered);
    }
  }, [searchQuery, broadcasts]);

  const joinBroadcast = async (broadcastId, broadcastData) => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      showAlert('Error', 'User is not authenticated.');
      return;
    }

    setJoining(true);
    try {
      const studentDocRef = doc(firestore, 'students', user.uid);
      const studentDoc = await getDoc(studentDocRef);

      if (!studentDoc.exists()) {
        showAlert('Error', 'Student data not found.');
        setJoining(false);
        return;
      }

      const studentData = studentDoc.data();

      // Check if broadcast uses location and if user is in range
      if (broadcastData.useLocation && broadcastData.coordinates) {
        let userLoc = userLocation;

        // Try to get fresh location if not already retrieved
        if (!userLoc) {
          try {
            userLoc = await getCurrentLocation();
          } catch (error) {
            showAlert('Location Error', 'Could not verify your location. Please enable location services.');
            setJoining(false);
            return;
          }
        }

        // Use cross-platform aware range check
        const broadcasterPlatform = broadcastData.broadcasterPlatform || 'UNKNOWN';
        if (!isInRange(broadcastData, userLoc, broadcasterPlatform)) {
          const distance = calculateDistance(
            userLoc.latitude,
            userLoc.longitude,
            broadcastData.coordinates.latitude,
            broadcastData.coordinates.longitude
          );

          const studentBuffer = getPlatformAccuracyBuffer();
          const crossPlatformBuffer = broadcasterPlatform !== getPlatformIdentifier() ? 200 : 0;
          const totalBuffer = studentBuffer + crossPlatformBuffer;
          const requiredRadius = broadcastData.radiusMeters || 0;
          const totalRadius = requiredRadius + totalBuffer;

          const platformInfo = broadcasterPlatform !== getPlatformIdentifier() 
            ? `\n(Broadcaster: ${broadcasterPlatform}, You: ${getPlatformIdentifier()})` 
            : '';

          showAlert(
            'Out of Range',
            `You are ${Math.round(distance)}m away.\n\nBroadcast radius: ${requiredRadius}m\nWith tolerance: ${Math.round(totalBuffer)}m\nTotal: ${Math.round(totalRadius)}m\n\nPlease move closer.${platformInfo}`
          );
          setJoining(false);
          return;
        }
      }

      const studentInfo = {
        ...studentData,
        timeSignedIn: Timestamp.now(),
        coordinates: userLocation ? new GeoPoint(userLocation.latitude, userLocation.longitude) : null,
        studentPlatform: getPlatformIdentifier(),
      };

      if (broadcastData.isNewSystem) {
        const inRange = broadcastData.inRange;
        const accuracy = userLocation?.accuracy || 0;
        const decision = inRange ? (accuracy > 50 ? 'allow_flagged' : 'allow') : 'reject';
        const auditFlag = accuracy > 50 ? 'low_confidence_location' : null;

        const checkInData = {
          studentId: user.uid,
          fullName: studentData.fullName || 'Unknown Student',
          matricNumber: studentData.matricNumber || 'N/A',
          timeSignedIn: Timestamp.now(),
          coordinates: userLocation ? new GeoPoint(userLocation.latitude, userLocation.longitude) : null,
          accuracy,
          decision,
          auditFlag,
          studentPlatform: getPlatformIdentifier(),
        };

        await setDoc(doc(firestore, `attendanceSessions/${broadcastId}/checkIns`, user.uid), checkInData);

        if (decision === 'reject') {
          showAlert('Out of Range', 'Your check-in attempt was recorded but rejected because you are too far away.');
          setJoining(false);
          return;
        }
      } else {
        await setDoc(doc(firestore, `broadcasts/${broadcastId}/participants`, user.uid), studentInfo);
      }
      showAlert('Success', 'You have successfully joined the broadcast!');
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'StudentDashboard', params: { broadcastId } }],
        });
      }, 1500);
    } catch (error) {
      showAlert('Error', 'Failed to join broadcast: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setJoining(false);
    }
  };

  const joinByCode = async () => {
    if (!broadcastCode.trim()) {
      showAlert('Error', 'Please enter a broadcast code');
      return;
    }

    try {
      const q = query(
        collection(firestore, 'broadcasts'),
        where('customId', '==', broadcastCode.trim().toUpperCase())
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        showAlert('Error', 'Broadcast not found with this code');
        return;
      }

      const broadcastDoc = snapshot.docs[0];
      const broadcastData = broadcastDoc.data();

      if (!broadcastData.isActive) {
        showAlert('Error', 'This broadcast is no longer active');
        return;
      }

      setJoinModalVisible(false);
      await joinBroadcast(broadcastDoc.id, broadcastData);
      setBroadcastCode('');
    } catch (error) {
      showAlert('Error', 'Failed to join broadcast: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleQRScan = () => {
    navigation.navigate('QRCodeScanner', {
      onScan: (scannedCode) => {
        setBroadcastCode(scannedCode);
        setJoinModalVisible(true);
      },
    });
  };

  const handleBack = async () => {
    try {
      navigation.reset({
        index: 0,
        routes: [{ name: 'StudentScreen' }],
      });
    } catch (error) {
      console.error('Navigation failed:', error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: '#ffffff',
          paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
        }}
      >
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.loadingContainer}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#3b82f6" />
          </TouchableOpacity>
          <ScanningAnimation />
          <Text style={styles.text}>Scanning for broadcasts...</Text>
          <Text style={styles.subText}>Loading available broadcasts</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (joining) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: '#ffffff',
          paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
        }}
      >
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <JoiningAnimation />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: '#ffffff',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
      }}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#3b82f6" />
          </TouchableOpacity>
          <Text style={styles.title}>Available Broadcasts</Text>
          <TouchableOpacity onPress={() => setJoinModalVisible(true)} style={styles.codeButton}>
            <Ionicons name="qr-code-outline" size={24} color="#3b82f6" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by code, lecturer, or course"
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-outline" size={20} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {toastMessage && (
          <View style={styles.toastContainer}>
            <View style={styles.toastContent}>
              <Ionicons name="chatbubble-outline" size={20} color="#8b5cf6" />
              <Text style={styles.toastText}>{toastMessage}</Text>
              <TouchableOpacity onPress={() => setToastMessage('')}>
                <Ionicons name="close-outline" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {filteredBroadcasts.length === 0 ? (
          <View style={styles.noBroadcastsContainer}>
            <Ionicons name="radio-outline" size={64} color="#cbd5e1" />
            <Text style={styles.noBroadcastsText}>
              {searchQuery ? 'No broadcasts found' : 'No broadcasts available'}
            </Text>
            <Text style={styles.noBroadcastsSubtext}>
              {searchQuery ? 'Try a different search term' : 'Check back later or use a broadcast code'}
            </Text>
            <TouchableOpacity onPress={fetchNearbyBroadcasts} style={styles.refreshButton}>
              <Ionicons name="refresh-outline" size={18} color="#3b82f6" />
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredBroadcasts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => joinBroadcast(item.id, item)}
                style={[styles.broadcastItem, !item.inRange && styles.outOfRangeItem]}
              >
                <View style={styles.broadcastHeader}>
                  <View style={styles.broadcastInfo}>
                    <Text style={styles.courseText}>{item.customId}</Text>
                    <Text style={styles.lecturerText}>
                      <Ionicons name="person-outline" size={14} color="#64748b" />
                      <Text> {item.teacherFullName}</Text>
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.proximityBadge,
                      item.inRange ? styles.inRangeBadge : styles.outOfRangeBadge,
                    ]}
                  >
                    <Ionicons
                      name={item.inRange ? 'checkmark-circle' : 'alert-circle'}
                      size={14}
                      color="#ffffff"
                    />
                    <Text style={styles.proximityText}>{item.inRange ? 'In Range' : 'Not in Range'}</Text>
                  </View>
                </View>

                <View style={styles.broadcastFooter}>
                  <View style={styles.broadcastStats}>
                    {item.useLocation ? (
                      <>
                        <Text style={styles.broadcastRadius}>Radius: {item.radiusMeters}m</Text>
                        {item.distance && (
                          <Text style={styles.broadcastDistance}>
                            Distance: {Math.round(item.distance)}m away
                          </Text>
                        )}
                      </>
                    ) : (
                      <Text style={styles.broadcastRadius}>Open Access</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.joinButton, !item.inRange && styles.joinButtonDisabled]}
                    onPress={() => joinBroadcast(item.id, item)}
                    disabled={!item.inRange && item.useLocation}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={18}
                      color={item.inRange ? '#ffffff' : '#cbd5e1'}
                    />
                    <Text style={[styles.joinButtonText, !item.inRange && styles.joinButtonDisabledText]}>
                      Join
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Broadcast Code Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={joinModalVisible}
          onRequestClose={() => setJoinModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Join Broadcast</Text>
                <TouchableOpacity onPress={() => setJoinModalVisible(false)}>
                  <Ionicons name="close-outline" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>Enter broadcast code or scan QR code</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Broadcast Code</Text>
                <TextInput
                  style={styles.input}
                  value={broadcastCode}
                  onChangeText={setBroadcastCode}
                  placeholder="Enter course code"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.qrSection}>
                <TouchableOpacity style={styles.qrPlaceholder} onPress={handleQRScan}>
                  <Ionicons name="qr-code-outline" size={60} color="#3b82f6" />
                </TouchableOpacity>
                <Text style={styles.qrText}>Tap to scan QR code</Text>
              </View>

              <TouchableOpacity onPress={joinByCode} style={styles.joinModalButton}>
                <Text style={styles.joinModalButtonText}>Join Broadcast</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {alert && (
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>{alert.title}</Text>
            <Text style={styles.alertMessage}>{alert.message}</Text>
            <TouchableOpacity onPress={closeAlert} style={styles.alertButton}>
              <Text style={styles.alertButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', paddingTop: 40, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  backButton: { padding: 4 },
  title: { fontSize: 24, fontWeight: '700', color: '#1e293b' },
  codeButton: { padding: 4 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginVertical: 12, paddingHorizontal: 12, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: '#1e293b' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff', paddingHorizontal: 20 },
  text: { fontSize: 18, color: '#1e293b', marginTop: 24, fontWeight: '600' },
  subText: { fontSize: 14, color: '#64748b', marginTop: 8, textAlign: 'center' },
  scannerCircles: { width: 200, height: 200, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  scannerCircle: { position: 'absolute', borderWidth: 2, borderRadius: 100 },
  scannerCircleLarge: { width: 160, height: 160, borderColor: '#3b82f6' },
  scannerCircleMedium: { width: 100, height: 100, borderColor: '#60a5fa' },
  scannerCircleSmall: { width: 40, height: 40, borderColor: '#93c5fd' },
  scannerLine: { position: 'absolute', width: 2, height: 80, backgroundColor: '#3b82f6', top: 0 },
  joiningContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' },
  toastContainer: { marginHorizontal: 20, marginTop: 16 },
  toastContent: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3e8ff', borderWidth: 1, borderColor: '#d8b4fe', borderRadius: 8, padding: 12, gap: 8 },
  toastText: { flex: 1, fontSize: 14, color: '#6b21a8', fontWeight: '500' },
  listContainer: { padding: 20, paddingBottom: 100 },
  broadcastItem: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  outOfRangeItem: { backgroundColor: '#fafafa', opacity: 0.7 },
  broadcastHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  broadcastInfo: { flex: 1 },
  courseText: { fontSize: 18, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
  lecturerText: { fontSize: 14, color: '#64748b' },
  proximityBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  inRangeBadge: { backgroundColor: '#10b981' },
  outOfRangeBadge: { backgroundColor: '#ef4444' },
  proximityText: { fontSize: 12, color: '#ffffff', fontWeight: '500', marginLeft: 4 },
  broadcastFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  broadcastStats: { flex: 1 },
  broadcastRadius: { fontSize: 12, color: '#64748b' },
  broadcastDistance: { fontSize: 12, color: '#3b82f6', marginTop: 4, fontWeight: '500' },
  joinButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3b82f6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 4 },
  joinButtonDisabled: { backgroundColor: '#e2e8f0' },
  joinButtonText: { fontSize: 14, color: '#ffffff', fontWeight: '600' },
  joinButtonDisabledText: { color: '#94a3b8' },
  noBroadcastsContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  noBroadcastsText: { fontSize: 18, color: '#1e293b', fontWeight: '600', marginTop: 16, textAlign: 'center' },
  noBroadcastsSubtext: { fontSize: 14, color: '#64748b', marginTop: 8, textAlign: 'center', marginBottom: 24 },
  refreshButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, gap: 8 },
  refreshButtonText: { fontSize: 14, color: '#3b82f6', fontWeight: '500' },
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '600', color: '#1e293b' },
  modalSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 20 },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '500', color: '#1e293b', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 16, color: '#1e293b', backgroundColor: '#f8fafc' },
  qrSection: { alignItems: 'center', marginBottom: 20 },
  qrPlaceholder: { width: 120, height: 120, backgroundColor: '#eff6ff', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 2, borderColor: '#3b82f6' },
  qrText: { fontSize: 12, color: '#64748b' },
  joinModalButton: { backgroundColor: '#3b82f6', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  joinModalButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  alertBox: { position: 'absolute', top: '40%', left: '5%', right: '5%', backgroundColor: '#ffffff', borderRadius: 12, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 8 },
  alertTitle: { fontSize: 18, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
  alertMessage: { fontSize: 14, color: '#64748b', marginBottom: 16, textAlign: 'center' },
  alertButton: { backgroundColor: '#3b82f6', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  alertButtonText: { color: '#ffffff', fontWeight: '600' },
});

export default FindBroadcastScreen;
