import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Share, StyleSheet, RefreshControl, ScrollView, ActivityIndicator, SafeAreaView, Keyboard, Platform, Modal, StatusBar, Alert, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { firestore } from '../../config/firebaseconfig';
import QRCode from 'react-native-qrcode-svg';
import { collection, getDocs, updateDoc, doc, addDoc, Timestamp, deleteDoc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { GeoPoint } from 'firebase/firestore';
import { getCurrentLocation } from '../../utils/locationHelpers';
import { getPlatformIdentifier } from '../../utils/locationHelpers';
import * as Sharing from 'expo-sharing';
import * as Notifications from 'expo-notifications';
import * as Print from 'expo-print';

const LecturerBroadcast = ({ navigation, route }) => {
  const [broadcasts, setBroadcasts] = useState([]);
  const [radius, setRadius] = useState('5');
  const [customBroadcastId, setCustomBroadcastId] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectedBroadcast, setSelectedBroadcast] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isRadiusEmpty, setIsRadiusEmpty] = useState(false);
  const [isBroadcastIdEmpty, setIsBroadcastIdEmpty] = useState(false);
  const [loadingOverlay, setLoadingOverlay] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [selectedBroadcastForQR, setSelectedBroadcastForQR] = useState(null);
  const [addStudentModalVisible, setAddStudentModalVisible] = useState(false);
  const [matricNumber, setMatricNumber] = useState('');
  const [toastModalVisible, setToastModalVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [useLocation, setUseLocation] = useState(true);

  const sendNotification = async (title, body) => {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  };

  const exportToPDF = async (broadcastId) => {
    setLoadingOverlay(true);
    try {
      const participantsSnapshot = await getDocs(collection(firestore, `broadcasts/${broadcastId}/participants`));
      const participants = participantsSnapshot.docs.map(doc => doc.data());

      const broadcastDoc = await getDoc(doc(firestore, 'broadcasts', broadcastId));
      const broadcast = broadcastDoc.exists() ? broadcastDoc.data() : {};
      const timestamp = broadcast.createdAt?.toDate().toLocaleString() || 'N/A';
      const customId = broadcast.customId || broadcastId;

      const pdfhtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
              h1 { text-align: center; color: #1e293b; font-size: 24px; margin-bottom: 10px; }
              .header-info { text-align: center; color: #64748b; margin-bottom: 20px; font-size: 14px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th { background-color: #f1f5f9; color: #1e293b; padding: 12px 8px; text-align: left; border: 1px solid #e2e8f0; font-weight: 600; }
              td { padding: 10px 8px; border: 1px solid #e2e8f0; color: #475569; }
              tr:nth-child(even) { background-color: #f8fafc; }
              .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 10px; }
            </style>
          </head>
          <body>
            <h1>Attendance Record</h1>
            <div class="header-info">
              <div><strong>Course:</strong> ${customId}</div>
              <div><strong>Timestamp:</strong> ${timestamp}</div>
              <div><strong>Total Participants:</strong> ${participants.length}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 40px;">S/N</th>
                  <th>Full Name</th>
                  <th>Matric Number</th>
                  <th>College</th>
                  <th>Department</th>
                  <th style="width: 80px;">Level</th>
                </tr>
              </thead>
              <tbody>
                ${participants.map((p, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${p.fullName || 'N/A'}</td>
                    <td>${p.matricNumber || 'N/A'}</td>
                    <td>${p.college || 'N/A'}</td>
                    <td>${p.department || 'N/A'}</td>
                    <td>${p.currentLevel || 'N/A'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="footer">
              Generated on ${new Date().toLocaleString()}
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ pdfhtml });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `${customId} Attendance`,
        UTI: 'com.adobe.pdf'
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to export to PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoadingOverlay(false);
    }
  };

  const fetchTeacherBroadcasts = async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        Alert.alert('Error', 'User is not authenticated.');
        return;
      }

      const q = collection(firestore, 'broadcasts');
      const snapshot = await getDocs(q);

      const teacherBroadcasts = snapshot.docs
        .filter(doc => doc.data().teacherId === user.uid && doc.data().isActive)
        .map(async doc => {
          const broadcastData = doc.data();
          const participantsSnapshot = await getDocs(collection(firestore, `broadcasts/${doc.id}/participants`));
          const participantCount = participantsSnapshot.size;
          return { id: doc.id, ...broadcastData, participantCount };
        });

      const broadcasts = await Promise.all(teacherBroadcasts);
      setBroadcasts(broadcasts);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch broadcasts: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  useEffect(() => {
    fetchTeacherBroadcasts();

    const interval = setInterval(async () => {
      try {
        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
          console.error('User is not authenticated.');
          return;
        }

        const updatedBroadcasts = await Promise.all(
          broadcasts.map(async broadcast => {
            const participantsSnapshot = await getDocs(collection(firestore, `broadcasts/${broadcast.id}/participants`));
            const participantCount = participantsSnapshot.size;
            return { ...broadcast, participantCount };
          })
        );

        setBroadcasts(updatedBroadcasts);
      } catch (error) {
        console.error('Error updating participant counts:', error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [broadcasts]);

  const startBroadcast = async () => {
    Keyboard.dismiss();
    const auth = getAuth();
    const user = auth.currentUser;
    const radiusMeters = parseFloat(radius);

    const isRadiusInvalid = useLocation && (isNaN(radiusMeters) || radiusMeters <= 0);
    const isBroadcastIdInvalid = !customBroadcastId.trim();

    setIsRadiusEmpty(isRadiusInvalid);
    setIsBroadcastIdEmpty(isBroadcastIdInvalid);

    if (isRadiusInvalid || isBroadcastIdInvalid) {
      Alert.alert('Error', 'Please fill in all required fields correctly.');
      return;
    }

    setLoadingOverlay(true);
    try {
      if (!user) {
        Alert.alert('Error', 'User is not authenticated.');
        setLoadingOverlay(false);
        return;
      }

      let location = null;
      if (useLocation) {
        location = await getCurrentLocation();
        console.log(`[${getPlatformIdentifier()}] Broadcaster location:`, location);
      }

      const teacherDoc = await getDoc(doc(firestore, 'teachers', user.uid));
      const teacherFullName = teacherDoc.exists() ? teacherDoc.data()?.fullName || 'Unknown' : 'Unknown';

      const { courseId, isRep } = route.params || {};

      if (courseId) {
        const sessionData = {
          courseId,
          createdBy: user.uid,
          createdByRole: isRep ? 'rep' : 'lecturer',
          sessionName: customBroadcastId.trim() || new Date().toLocaleDateString(),
          startedAt: Timestamp.now(),
          endedAt: null,
          radiusMeters: useLocation ? radiusMeters : 0,
          status: 'active',
          useLocation: useLocation,
          broadcasterPlatform: getPlatformIdentifier(),
        };

        if (useLocation && location) {
          sessionData.coordinates = new GeoPoint(location.latitude, location.longitude);
        }

        await addDoc(collection(firestore, 'attendanceSessions'), sessionData);

        if (isRep) {
          await addDoc(collection(firestore, 'repActivityLog'), {
            courseId,
            repId: user.uid,
            action: 'session_started',
            createdAt: Timestamp.now(),
          });
        }
      } else {
        const broadcastData = {
          teacherId: user.uid,
          teacherFullName,
          isActive: true,
          createdAt: Timestamp.now(),
          customId: customBroadcastId.trim().toUpperCase(),
          useLocation: useLocation,
          broadcasterPlatform: getPlatformIdentifier(),
        };

        if (useLocation && location) {
          broadcastData.radiusMeters = radiusMeters;
          broadcastData.coordinates = new GeoPoint(location.latitude, location.longitude);
        }

        await addDoc(collection(firestore, 'broadcasts'), broadcastData);
      }

      Alert.alert('Success', `Attendance started!\nID: ${customBroadcastId.trim().toUpperCase()}\nBroadcaster: ${getPlatformIdentifier()}`);
      sendNotification('Broadcast Started', `Broadcast "${customBroadcastId.trim().toUpperCase()}" has started.`);
      setCustomBroadcastId('');
      fetchTeacherBroadcasts();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to start the broadcast.');
    } finally {
      setLoadingOverlay(false);
    }
  };

  const stopBroadcast = async (broadcastId) => {
    setActionLoading(true);
    try {
      await updateDoc(doc(firestore, 'broadcasts', broadcastId), {
        isActive: false,
        endedAt: Timestamp.now(),
      });
      Alert.alert('Success', 'Broadcast stopped.');
      sendNotification('Broadcast Stopped', 'Broadcast has been stopped.');
      fetchTeacherBroadcasts();
      setSelectedStudents([]);
      setSelectedBroadcast(null);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteBroadcast = async (broadcastId) => {
    setActionLoading(true);
    try {
      await deleteDoc(doc(firestore, 'broadcasts', broadcastId));
      setBroadcasts(prevBroadcasts => prevBroadcasts.filter(broadcast => broadcast.id !== broadcastId));
      Alert.alert('Success', 'Broadcast deleted.');
      sendNotification('Broadcast Deleted', 'Broadcast has been deleted.');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const loadParticipants = async (broadcastId) => {
    try {
      if (selectedBroadcast === broadcastId) {
        setSelectedBroadcast(null);
        setSelectedStudents([]);
        return;
      }

      const participantsSnapshot = await getDocs(collection(firestore, `broadcasts/${broadcastId}/participants`));
      const students = participantsSnapshot.docs.map(doc => doc.data());
      setSelectedStudents(students);
      setSelectedBroadcast(broadcastId);

      setBroadcasts(prevBroadcasts =>
        prevBroadcasts.map(broadcast =>
          broadcast.id === broadcastId
            ? { ...broadcast, participantCount: students.length }
            : broadcast
        )
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to load participants: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleBack = async () => {
    try {
      navigation.reset({
        index: 0,
        routes: [{ name: 'TeacherScreen' }],
      });
    } catch (error) {
      console.error('Navigation failed:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setSelectedBroadcast(null);
    setSelectedStudents([]);
    await fetchTeacherBroadcasts();
    setRefreshing(false);
  };

  const generateShareLink = (broadcast) => {
    const shareUrl = `${broadcast.id}`;
    Share.share({
      message: `Join ${broadcast.customId} broadcast: ${shareUrl}`,
      url: shareUrl,
      title: `Join ${broadcast.customId} Broadcast`,
    });
  };

  const generateQRCode = (broadcast) => {
    setSelectedBroadcastForQR(broadcast);
    setQrModalVisible(true);
  };

  const addStudentByMatric = async () => {
    if (!matricNumber.trim() || !selectedBroadcast) {
      Alert.alert('Error', 'Please enter a matric number and select a broadcast');
      return;
    }

    setLoadingOverlay(true);
    try {
      const studentsQuery = collection(firestore, 'students');
      const studentSnapshot = await getDocs(studentsQuery);
      const student = studentSnapshot.docs.find(doc => 
        doc.data().matricNumber?.toString().toLowerCase() === matricNumber.trim().toLowerCase()
      );

      if (!student) {
        Alert.alert('Error', 'Student not found with this matric number');
        return;
      }

      const studentData = student.data();
      
      await addDoc(collection(firestore, `broadcasts/${selectedBroadcast}/participants`), {
        fullName: studentData.fullName,
        matricNumber: studentData.matricNumber,
        college: studentData.college,
        department: studentData.department,
        currentLevel: studentData.currentLevel,
        timeSignedIn: Timestamp.now(),
        addedByLecturer: true,
        studentPlatform: 'MANUAL_ADD',
      });

      Alert.alert('Success', 'Student added successfully');
      setMatricNumber('');
      setAddStudentModalVisible(false);
      loadParticipants(selectedBroadcast);
    } catch (error) {
      Alert.alert('Error', 'Failed to add student: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoadingOverlay(false);
    }
  };

  const sendToastMessage = async () => {
    if (!toastMessage.trim() || !selectedBroadcast) {
      Alert.alert('Error', 'Please enter a message and select a broadcast');
      return;
    }

    try {
      const broadcastDoc = await getDoc(doc(firestore, 'broadcasts', selectedBroadcast));
      if (!broadcastDoc.exists()) return;

      await updateDoc(doc(firestore, 'broadcasts', selectedBroadcast), {
        toastMessage: toastMessage.trim(),
        toastTimestamp: Timestamp.now(),
      });

      sendNotification('Message from Lecturer', toastMessage.trim());
      
      Alert.alert('Success', 'Message sent to all participants');
      setToastMessage('');
      setToastModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to send message: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const sortedBroadcasts = broadcasts.sort((a, b) => {
    const dateA = a.createdAt?.toDate() || new Date(0);
    const dateB = b.createdAt?.toDate() || new Date(0);
    return dateB - dateA;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#3b82f6"]} />}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#3b82f6" />
          </TouchableOpacity>
          <Text style={styles.title}>Broadcast Manager</Text>
          <Text style={styles.platformBadge}>{getPlatformIdentifier()}</Text>
        </View>

        <View style={styles.formSection}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Course Code/Name</Text>
            <TextInput
              value={customBroadcastId}
              onChangeText={text => {
                setCustomBroadcastId(text);
                setIsBroadcastIdEmpty(false);
              }}
              style={[styles.input, isBroadcastIdEmpty && styles.inputError]}
              placeholder="Enter course name"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.switchContainer}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Ionicons name="location-outline" size={20} color={useLocation ? "#3b82f6" : "#94a3b8"} />
                <Text style={[styles.switchText, useLocation && styles.switchTextActive]}>
                  Use Location Restriction
                </Text>
              </View>
              <Switch
                value={useLocation}
                onValueChange={setUseLocation}
                trackColor={{ false: "#cbd5e1", true: "#93c5fd" }}
                thumbColor={useLocation ? "#3b82f6" : "#f1f5f9"}
              />
            </View>
            <Text style={styles.helperText}>
              {useLocation 
                ? "Students must be within broadcast radius to join" 
                : "Anyone can join this broadcast regardless of location"}
            </Text>
          </View>

          {useLocation && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Broadcast Radius (meters)</Text>
              <TextInput
                value={radius}
                onChangeText={text => {
                  setRadius(text);
                  setIsRadiusEmpty(false);
                }}
                keyboardType="numeric"
                style={[styles.input, isRadiusEmpty && styles.inputError]}
                placeholder="5"
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.helperText}>
                Classroom: 3-5m, Lecture Hall: 10-25m
              </Text>
            </View>
          )}

          <TouchableOpacity onPress={startBroadcast} style={styles.startButton}>
            <Ionicons name="play-circle" size={20} color="#ffffff" />
            <Text style={styles.buttonText}>Start Broadcast</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Broadcasts</Text>
          {broadcasts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="radio-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyStateText}>No active broadcasts</Text>
            </View>
          ) : (
            <FlatList
              data={sortedBroadcasts}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={[styles.broadcastItem, selectedBroadcast === item.id && styles.selectedBroadcastItem]}>
                  <View style={styles.broadcastHeader}>
                    <View style={styles.broadcastInfo}>
                      <Text style={styles.broadcastCourse}>{item.customId || item.id}</Text>
                      <Text style={styles.broadcastStatus}>
                        <Ionicons name="people-outline" size={14} color="#3b82f6" />
                        <Text style={styles.participantCount}> {item.participantCount || 0} participants</Text>
                      </Text>
                      {!item.useLocation && (
                        <View style={styles.locationBadge}>
                          <Ionicons name="globe-outline" size={12} color="#10b981" />
                          <Text style={styles.locationBadgeText}>Open Access</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>Active</Text>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.expandButton} onPress={() => loadParticipants(item.id)}>
                    <Text style={styles.expandButtonText}>
                      {selectedBroadcast === item.id ? 'Hide Participants' : 'View Participants'}
                    </Text>
                    <Ionicons name={selectedBroadcast === item.id ? "chevron-up" : "chevron-down"} size={16} color="#3b82f6" />
                  </TouchableOpacity>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity style={styles.actionButton} onPress={() => generateQRCode(item)}>
                      <Ionicons name="qr-code-outline" size={18} color="#10b981" />
                      <Text style={styles.actionButtonText}>QR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={() => generateShareLink(item)}>
                      <Ionicons name="share-outline" size={18} color="#3b82f6" />
                      <Text style={styles.actionButtonText}>Share</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={() => { setSelectedBroadcast(item.id); setAddStudentModalVisible(true); }}>
                      <Ionicons name="person-add-outline" size={18} color="#f59e0b" />
                      <Text style={styles.actionButtonText}>Add</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={() => { setSelectedBroadcast(item.id); setToastModalVisible(true); }}>
                      <Ionicons name="chatbubble-outline" size={18} color="#8b5cf6" />
                      <Text style={styles.actionButtonText}>Toast</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.stopButton} onPress={() => stopBroadcast(item.id)}>
                      <Ionicons name="stop-circle" size={18} color="#ef4444" />
                      <Text style={styles.stopButtonText}>Stop</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              contentContainerStyle={{ paddingBottom: 20 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        {selectedBroadcast && selectedStudents.length > 0 && (
          <View style={styles.participantsSection}>
            <Text style={styles.participantsTitle}>Participants ({selectedStudents.length})</Text>
            <ScrollView style={styles.participantsList}>
              {selectedStudents.map((student, i) => (
                <View key={i} style={styles.participantItem}>
                  <Text style={styles.participantName}>{student.fullName}</Text>
                  <Text style={styles.participantDetails}>{student.matricNumber} • {student.college} • {student.currentLevel}</Text>
                  {student.studentPlatform && <Text style={styles.platformLabel}>{student.studentPlatform}</Text>}
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.exportButton} onPress={() => exportToPDF(selectedBroadcast)}>
              <Ionicons name="download-outline" size={18} color="#ffffff" />
              <Text style={styles.buttonText}>Download PDF</Text>
            </TouchableOpacity>
          </View>
        )}

        {(loadingOverlay || actionLoading) && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        )}

        <Modal animationType="slide" transparent visible={qrModalVisible} onRequestClose={() => setQrModalVisible(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Share Broadcast</Text>
                <TouchableOpacity onPress={() => setQrModalVisible(false)}>
                  <Ionicons name="close-outline" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
              {selectedBroadcastForQR && (
                <View style={styles.qrContent}>
                  <Text style={styles.qrTitle}>{selectedBroadcastForQR.customId || 'Broadcast'}</Text>
                  <View style={styles.qrPlaceholder}>
                    <QRCode value={`${selectedBroadcastForQR.customId}`} size={200} color="#1e293b" backgroundColor="#ffffff" />
                  </View>
                  <Text style={styles.qrText}>Scan this QR code to join the broadcast</Text>
                  <Text style={styles.linkText}>Broadcast ID: {selectedBroadcastForQR.id}</Text>
                  <TouchableOpacity style={styles.shareButton} onPress={() => generateShareLink(selectedBroadcastForQR)}>
                    <Ionicons name="share-outline" size={18} color="#ffffff" />
                    <Text style={styles.buttonText}>Share Link</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>

        <Modal animationType="slide" transparent visible={addStudentModalVisible} onRequestClose={() => setAddStudentModalVisible(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Student</Text>
                <TouchableOpacity onPress={() => setAddStudentModalVisible(false)}>
                  <Ionicons name="close-outline" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSubtitle}>Enter student matric number</Text>
              <TextInput style={styles.input} value={matricNumber} onChangeText={setMatricNumber} placeholder="Matric Number" placeholderTextColor="#94a3b8" />
              <TouchableOpacity onPress={addStudentByMatric} style={styles.actionModalButton}>
                <Text style={styles.buttonText}>Add Student</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal animationType="slide" transparent visible={toastModalVisible} onRequestClose={() => setToastModalVisible(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Send Message</Text>
                <TouchableOpacity onPress={() => setToastModalVisible(false)}>
                  <Ionicons name="close-outline" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSubtitle}>Send message to all participants</Text>
              <TextInput style={[styles.input, styles.textArea]} value={toastMessage} onChangeText={setToastMessage} placeholder="Enter your message" placeholderTextColor="#94a3b8" multiline numberOfLines={3} />
              <TouchableOpacity onPress={sendToastMessage} style={styles.actionModalButton}>
                <Text style={styles.buttonText}>Send Message</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  backButton: { marginRight: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#1e293b', flex: 1 },
  platformBadge: { fontSize: 10, fontWeight: '600', color: '#ffffff', backgroundColor: '#3b82f6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  formSection: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 16, color: '#1e293b', backgroundColor: '#f8fafc' },
  inputError: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
  helperText: { fontSize: 12, color: '#64748b', marginTop: 4 },
  switchContainer: { marginBottom: 20 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  switchLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  switchText: { fontSize: 14, color: '#64748b' },
  switchTextActive: { color: '#1e293b', fontWeight: '500' },
  startButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#3b82f6', paddingVertical: 14, borderRadius: 8, gap: 8 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  section: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1e293b', marginBottom: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyStateText: { fontSize: 16, color: '#64748b', marginTop: 12 },
  broadcastItem: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  selectedBroadcastItem: { borderColor: '#3b82f6', backgroundColor: '#f0f9ff' },
  broadcastHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  broadcastInfo: { flex: 1 },
  broadcastCourse: { fontSize: 18, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
  broadcastStatus: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  participantCount: { fontSize: 14, color: '#64748b', marginLeft: 4 },
  locationBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', gap: 4 },
  locationBadgeText: { fontSize: 11, color: '#059669', fontWeight: '500' },
  statusBadge: { backgroundColor: '#10b981', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  expandButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, marginBottom: 12 },
  expandButtonText: { fontSize: 14, color: '#3b82f6', fontWeight: '500' },
  actionButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, gap: 4 },
  actionButtonText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  stopButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, gap: 4, marginLeft: 'auto' },
  stopButtonText: { fontSize: 12, color: '#ef4444', fontWeight: '500' },
  participantsSection: { padding: 20, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  participantsTitle: { fontSize: 18, fontWeight: '600', color: '#1e293b', marginBottom: 12 },
  participantsList: { maxHeight: 200, marginBottom: 16 },
  participantItem: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 8 },
  participantName: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
  participantDetails: { fontSize: 12, color: '#64748b' },
  platformLabel: { fontSize: 10, color: '#3b82f6', fontWeight: '600', marginTop: 4 },
  exportButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#3b82f6', paddingVertical: 12, borderRadius: 8, gap: 8 },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.9)' },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, width: '90%', maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '600', color: '#1e293b' },
  modalSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 16 },
  qrContent: { alignItems: 'center', paddingVertical: 20 },
  qrTitle: { fontSize: 18, fontWeight: '600', color: '#1e293b', marginBottom: 20 },
  qrPlaceholder: { width: 220, height: 220, backgroundColor: '#ffffff', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 16, padding: 10 },
  qrText: { fontSize: 14, color: '#64748b', marginBottom: 8 },
  linkText: { fontSize: 12, color: '#3b82f6', fontFamily: 'monospace', marginBottom: 16 },
  shareButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#10b981', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, gap: 8 },
  actionModalButton: { backgroundColor: '#3b82f6', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  textArea: { height: 80, textAlignVertical: 'top' },
});

export default LecturerBroadcast;