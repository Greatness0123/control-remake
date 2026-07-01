import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert, Modal, ActivityIndicator, RefreshControl, ScrollView, PanResponder, SafeAreaView, TextInput, Platform, StatusBar } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { auth, firestore } from '../../config/firebaseconfig';
import { collection, getDocs, doc, getDoc, deleteDoc, addDoc, query, where } from 'firebase/firestore';
import { fluentColors, fluentSpacing, fluentRadius, fluentShadows } from '../../utils/fluentTheme';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import QRCode from 'react-native-qrcode-svg';

const LecturerDashboard = ({ navigation }) => {
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [lecturerData, setLecturerData] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [loadingOverlay, setLoadingOverlay] = useState(false);
  const [selectedBroadcastId, setSelectedBroadcastId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [buttonPosition, setButtonPosition] = useState({ x: 20, y: 630 });
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({
    count: 0,
    occurrences: [],
  });
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [filterType, setFilterType] = useState('course');
  const [filterValue, setFilterValue] = useState('');
  const [reportData, setReportData] = useState([]);
  const [addStudentModalVisible, setAddStudentModalVisible] = useState(false);
  const [matricNumber, setMatricNumber] = useState('');
  const [courses, setCourses] = useState([]);
      
  const clearSearchResults = () => {
    setSearchResults({ count: 0, occurrences: [] });
    setSearchQuery('');
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {},
    onPanResponderMove: (_, gestureState) => {
      setButtonPosition({
        x: Math.max(0, Math.min(gestureState.moveX, 300)),
        y: Math.max(0, Math.min(gestureState.moveY, 700)),
      });
    },
    onPanResponderRelease: (_, gestureState) => {
      const screenWidth = 360;
      const screenHeight = 800;
      const newX = gestureState.moveX < screenWidth / 2 ? 20 : screenWidth - 76;
      const newY = Math.max(20, Math.min(gestureState.moveY, screenHeight - 76));

      if (Math.abs(newX - 300) > 10 || Math.abs(newY - 620) > 10) {
        setButtonPosition({ x: 300, y: 620 });
      } else {
        setButtonPosition({ x: newX, y: newY });
      }
    },
  });

  useEffect(() => {
    const fetchLecturerData = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const teacherDoc = await getDoc(doc(firestore, 'teachers', user.uid));
          if (teacherDoc.exists()) {
            const data = teacherDoc.data();
            setLecturerData(data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch lecturer data:', error);
      }
    };

    const fetchLecturerBroadcasts = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          Alert.alert('Error', 'User is not authenticated.');
          return;
        }

        const broadcastsSnapshot = await getDocs(collection(firestore, 'broadcasts'));
        const lecturerBroadcasts = await Promise.all(
          broadcastsSnapshot.docs
            .filter(doc => doc.data().teacherId === user.uid)
            .map(async doc => {
              const broadcastData = doc.data();
              const participantsSnapshot = await getDocs(collection(firestore, `broadcasts/${doc.id}/participants`));
              const participantCount = participantsSnapshot.size;
              return { id: doc.id, ...broadcastData, participantCount };
            })
        );

        setBroadcasts(lecturerBroadcasts);
      } catch (error) {
        Alert.alert('Error', 'Failed to fetch broadcasts: ' + (error instanceof Error ? error.message : 'Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    const fetchData = async () => {
      await fetchLecturerData();
      await fetchLecturerBroadcasts();
      await fetchCourses();
    };
    fetchData();
  }, []);

  const fetchCourses = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const coursesSnapshot = await getDocs(
        query(collection(firestore, 'courses'), where('lecturerId', '==', user.uid))
      );
      setCourses(coursesSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Failed to fetch courses:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setButtonPosition({ x: 300, y: 620 });
    });

    return unsubscribe;
  }, [navigation]);

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

  const exportToPDF = async (broadcastId) => {
    setLoadingOverlay(true);
    try {
      const participantsSnapshot = await getDocs(collection(firestore, `broadcasts/${broadcastId}/participants`));
      const participants = participantsSnapshot.docs.map(doc => doc.data());

      const broadcastDoc = await getDoc(doc(firestore, 'broadcasts', broadcastId));
      const broadcast = broadcastDoc.exists() ? broadcastDoc.data() : {};
      const timestamp = broadcast.createdAt?.toDate().toLocaleString() || 'N/A';
      const customId = broadcast.customId || broadcastId;

    
      // Create HTML for PDF
      const pdfhtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: Arial, sans-serif;
                padding: 20px;
                font-size: 12px;
              }
              h1 {
                text-align: center;
                color: #1e293b;
                font-size: 24px;
                margin-bottom: 10px;
              }
              .header-info {
                text-align: center;
                color: #64748b;
                margin-bottom: 20px;
                font-size: 14px;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
              }
              th {
                background-color: #f1f5f9;
                color: #1e293b;
                padding: 12px 8px;
                text-align: left;
                border: 1px solid #e2e8f0;
                font-weight: 600;
              }
              td {
                padding: 10px 8px;
                border: 1px solid #e2e8f0;
                color: #475569;
              }
              tr:nth-child(even) {
                background-color: #f8fafc;
              }
              .footer {
                margin-top: 30px;
                text-align: center;
                color: #94a3b8;
                font-size: 10px;
              }
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

      // Generate PDF
      if (Platform.OS === 'web') {
        await Print.printAsync({ html: pdfhtml });
      } else {
        const { uri } = await Print.printToFileAsync({ html: pdfhtml });
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `${customId} Attendance`,
          UTI: 'com.adobe.pdf'
        });
      }

    } catch (error) {
      Alert.alert('Error', 'Failed to export to PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoadingOverlay(false);
    }
  };

  const confirmDeleteBroadcast = (broadcastId) => {
    setSelectedBroadcastId(broadcastId);
    setDeleteModalVisible(true);
  };

  const deleteBroadcast = async () => {
    if (!selectedBroadcastId) return;
    try {
      await deleteDoc(doc(firestore, 'broadcasts', selectedBroadcastId));
      setBroadcasts(prev => prev.filter(broadcast => broadcast.id !== selectedBroadcastId));
      Alert.alert('Broadcast deleted successfully.');
    } catch (error) {
      Alert.alert('Error', 'Failed to delete broadcast: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setDeleteModalVisible(false);
      setSelectedBroadcastId(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'User is not authenticated.');
        return;
      }

      const broadcastsSnapshot = await getDocs(collection(firestore, 'broadcasts'));
      const lecturerBroadcasts = await Promise.all(
        broadcastsSnapshot.docs
          .filter(doc => doc.data().teacherId === user.uid)
          .map(async doc => {
            const broadcastData = doc.data();
            const participantsSnapshot = await getDocs(collection(firestore, `broadcasts/${doc.id}/participants`));
            const participantCount = participantsSnapshot.size;
            return { id: doc.id, ...broadcastData, participantCount };
          })
      );

      setBroadcasts(lecturerBroadcasts);
      setButtonPosition({ x: 300, y: 620 });
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh broadcasts: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setRefreshing(false);
    }
  };

  const searchParticipants = async () => {
    setLoadingOverlay(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'User is not authenticated.');
        return;
      }

      const broadcastsSnapshot = await getDocs(collection(firestore, 'broadcasts'));
      const lecturerBroadcasts = broadcastsSnapshot.docs.filter(doc => doc.data().teacherId === user.uid);

      let count = 0;
      const occurrences = [];

      for (const broadcast of lecturerBroadcasts) {
        const participantsSnapshot = await getDocs(collection(firestore, `broadcasts/${broadcast.id}/participants`));
        participantsSnapshot.forEach(participantDoc => {
          const participantData = participantDoc.data();
          if (
            participantData.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            participantData.matricNumber?.toString().toLowerCase().includes(searchQuery.toLowerCase())
          ) {
            count++;
            const dateTime = participantData.timeSignedIn?.toDate().toLocaleString() || 'N/A';
            const [date, time] = dateTime.split(', ');
            occurrences.push({ customId: broadcast.data().customId || broadcast.id, date, time });
          }
        });
      }

      setSearchResults({ count, occurrences });
    } catch (error) {
      Alert.alert('Error', 'Failed to search participants: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoadingOverlay(false);
    }
  };

  const generateQRCode = (broadcast) => {
    setSelectedBroadcast(broadcast);
    setQrModalVisible(true);
  };

  const addStudentByMatric = async () => {
    if (!matricNumber.trim() || !selectedBroadcastId) {
      Alert.alert('Error', 'Please enter a matric number');
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
      
      await addDoc(collection(firestore, `broadcasts/${selectedBroadcastId}/participants`), {
        fullName: studentData.fullName,
        matricNumber: studentData.matricNumber,
        college: studentData.college,
        department: studentData.department,
        currentLevel: studentData.currentLevel,
        timeSignedIn: new Date(),
        addedByLecturer: true,
      });

      Alert.alert('Success', 'Student added successfully');
      setMatricNumber('');
      setAddStudentModalVisible(false);
      onRefresh();
    } catch (error) {
      Alert.alert('Error', 'Failed to add student: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoadingOverlay(false);
    }
  };

  const viewParticipants = (broadcast) => {
    navigation.navigate('ParticipantsView', { 
      broadcastId: broadcast.id,
      broadcastName: broadcast.customId || 'Broadcast'
    });
  };

  const generateGeneralReport = async () => {
    setLoadingOverlay(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      const broadcastsSnapshot = await getDocs(collection(firestore, 'broadcasts'));
      const lecturerBroadcasts = broadcastsSnapshot.docs.filter(doc => doc.data().teacherId === user.uid);

      const studentMap = new Map();

      for (const broadcast of lecturerBroadcasts) {
        const participantsSnapshot = await getDocs(collection(firestore, `broadcasts/${broadcast.id}/participants`));
        participantsSnapshot.forEach(participantDoc => {
          const participantData = participantDoc.data();
          const key = participantData.matricNumber;
          
          if (!studentMap.has(key)) {
            studentMap.set(key, {
              ...participantData,
              attendanceCount: 0
            });
          }
          
          const student = studentMap.get(key);
          student.attendanceCount += 1;
        });
      }

      let filteredData = Array.from(studentMap.values());
      
      if (filterValue) {
        filteredData = filteredData.filter(student => {
          switch (filterType) {
            case 'level':
              return student.currentLevel?.toLowerCase().includes(filterValue.toLowerCase());
            case 'college':
              return student.college?.toLowerCase().includes(filterValue.toLowerCase());
            case 'course':
              return true;
            default:
              return true;
          }
        });
      }

      setReportData(filteredData);
      setReportModalVisible(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate report: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoadingOverlay(false);
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
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#3b82f6"]} />}
        >
          <View style={styles.headerContainer}>
            <Text style={styles.title} numberOfLines={1}>Welcome, {lecturerData?.fullName || 'Lecturer'}</Text>
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
                <Text style={styles.statNumber}>{broadcasts.length}</Text>
                <Text style={styles.statLabel}>Total Sessions</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>
                  {broadcasts.reduce((sum, b) => sum + (b.participantCount || 0), 0)}
                </Text>
                <Text style={styles.statLabel}>Total Attendance</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Courses</Text>
            <TouchableOpacity style={styles.reportButton} onPress={() => navigation.navigate('CourseDashboard')}>
              <Ionicons name="school-outline" size={20} color="#ffffff" />
              <Text style={styles.reportButtonText}>View All</Text>
            </TouchableOpacity>
          </View>

          {courses.length === 0 ? (
            <View style={styles.noCoursesContainer}>
              <Ionicons name="school-outline" size={36} color="#cbd5e1" />
              <Text style={styles.noCoursesText}>No courses yet. Create one to get started.</Text>
              <TouchableOpacity style={styles.createCourseButton} onPress={() => navigation.navigate('CourseDashboard')}>
                <Text style={styles.createCourseText}>Create Course</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.coursesScroll} contentContainerStyle={styles.coursesScrollContent}>
              {courses.slice(0, 5).map(course => (
                <TouchableOpacity
                  key={course.id}
                  style={styles.courseQuickCard}
                  onPress={() => navigation.navigate('CourseDetail', { courseId: course.id, courseCode: course.courseCode, courseName: course.courseName })}
                >
                  <Ionicons name="school" size={20} color="#3b82f6" />
                  <Text style={styles.courseQuickCode}>{course.courseCode}</Text>
                  <Text style={styles.courseQuickName} numberOfLines={1}>{course.courseName}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

        </ScrollView>

       
        <TouchableOpacity
          style={[styles.searchButton]}
          onPress={() => setSearchModalVisible(true)}
        >
          <Ionicons name="search-outline" size={24} color="#ffffff" />
        </TouchableOpacity>

        
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
              <View style={styles.profileInfo}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Name:</Text>
                  <Text style={styles.infoValue}>{lecturerData?.fullName || 'N/A'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Lecturer ID:</Text>
                  <Text style={styles.infoValue}>{lecturerData?.teacherId || 'N/A'}</Text>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        
        <Modal
          animationType="fade"
          transparent={true}
          visible={deleteModalVisible}
          onRequestClose={() => setDeleteModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Confirm Delete</Text>
              <Text style={styles.modalText}>Are you sure you want to delete this broadcast?</Text>
              <View style={styles.modalButtonsContainer}>
                <TouchableOpacity onPress={deleteBroadcast} style={styles.confirmButton}>
                  <Text style={styles.confirmButtonText}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setDeleteModalVisible(false)} style={styles.cancelButton}>
                  <Text style={styles.cancelButtonText}>No</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        
        <Modal
          animationType="slide"
          transparent={true}
          visible={searchModalVisible}
          onRequestClose={() => {
            setSearchModalVisible(false);
            clearSearchResults();
          }}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Search Participants</Text>
                <TouchableOpacity onPress={() => { setSearchModalVisible(false); clearSearchResults(); }}>
                  <Ionicons name="close-outline" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Enter name or matric number"
                placeholderTextColor="#94a3b8"
              />
              {loadingOverlay ? (
                <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 16 }} />
              ) : (
                <>
                  {searchResults.count > 0 && (
                    <View style={styles.searchResults}>
                      <Text style={styles.resultsText}>Occurrences Found: {searchResults.count}</Text>
                      {searchResults.occurrences.map((occurrence, index) => (
                        <View key={index} style={styles.resultItem}>
                          <Text style={styles.resultCourse}>{occurrence.customId}</Text>
                          <Text style={styles.resultDateTime}>{occurrence.date} at {occurrence.time}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {searchResults.count === 0 && searchQuery && (
                    <Text style={styles.noResultsText}>No occurrences found.</Text>
                  )}
                </>
              )}
              <TouchableOpacity onPress={searchParticipants} style={styles.searchButtonModal}>
                <Text style={styles.searchButtonText}>Search</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        
        <Modal
          animationType="slide"
          transparent={true}
          visible={qrModalVisible}
          onRequestClose={() => setQrModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Share Broadcast</Text>
                <TouchableOpacity onPress={() => setQrModalVisible(false)}>
                  <Ionicons name="close-outline" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
              {selectedBroadcast && (
                <View style={styles.qrContent}>
                  <Text style={styles.qrTitle}>{selectedBroadcast.customId || 'Broadcast'}</Text>
                  <View style={styles.qrPlaceholder}>
                    <QRCode
                      value={`${selectedBroadcast.customId}`}
                      size={200}
                      color="#1e293b"
                      backgroundColor="#ffffff"
                    />
                  </View>
                  <Text style={styles.qrText}>Scan this QR code to join</Text>
                  <Text style={styles.linkText}>Broadcast ID: {selectedBroadcast.id}</Text>
                </View>
              )}
            </View>
          </View>
        </Modal>

        
        <Modal
          animationType="slide"
          transparent={true}
          visible={addStudentModalVisible}
          onRequestClose={() => setAddStudentModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Student</Text>
                <TouchableOpacity onPress={() => setAddStudentModalVisible(false)}>
                  <Ionicons name="close-outline" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSubtitle}>Enter student matric number</Text>
              <TextInput
                style={styles.input}
                value={matricNumber}
                onChangeText={setMatricNumber}
                placeholder="Matric Number"
                placeholderTextColor="#94a3b8"
              />
              <TouchableOpacity onPress={addStudentByMatric} style={styles.actionModalButton}>
                <Text style={styles.buttonText}>Add Student</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        
        <Modal
          animationType="slide"
          transparent={true}
          visible={reportModalVisible}
          onRequestClose={() => setReportModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>General Report</Text>
                <TouchableOpacity onPress={() => setReportModalVisible(false)}>
                  <Ionicons name="close-outline" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
              <View style={styles.filterContainer}>
                <Text style={styles.filterLabel}>Filter by:</Text>
                <View style={styles.filterRow}>
                  <TouchableOpacity
                    style={[styles.filterOption, filterType === 'level' && styles.activeFilter]}
                    onPress={() => setFilterType('level')}
                  >
                    <Text style={[styles.filterOptionText, filterType === 'level' && styles.activeFilterText]}>Level</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterOption, filterType === 'college' && styles.activeFilter]}
                    onPress={() => setFilterType('college')}
                  >
                    <Text style={[styles.filterOptionText, filterType === 'college' && styles.activeFilterText]}>College</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.input}
                  value={filterValue}
                  onChangeText={setFilterValue}
                  placeholder={`Enter ${filterType}`}
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <TouchableOpacity onPress={generateGeneralReport} style={styles.searchButtonModal}>
                <Text style={styles.searchButtonText}>Generate Report</Text>
              </TouchableOpacity>
              {reportData.length > 0 && (
                <ScrollView style={styles.reportResults}>
                  {reportData.map((student, index) => (
                    <View key={index} style={styles.reportItem}>
                      <Text style={styles.reportStudentName}>{student.fullName}</Text>
                      <Text style={styles.reportStudentDetails}>{student.matricNumber} • {student.attendanceCount} attendances</Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {loadingOverlay && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingBottom: 40,
  },
  scrollView: {
    flex: 1,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  reportButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  noBroadcastsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noBroadcastsText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
  },
  broadcastItem: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    marginBottom: 12,
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
  dateText: {
    color: '#64748b',
    fontSize: 14,
  },
  timeText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  broadcastStats: {
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statItemText: {
    fontSize: 14,
    color: '#64748b',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3b82f6',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginLeft: 'auto',
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
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
  },
  profileInfo: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: '#1e293b',
  },
  modalText: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: 16,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  locationButton: {
    position: 'absolute',
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
    right: 20,
    bottom: 100,
  },
  searchButton: {
    position: 'absolute',
    backgroundColor: '#10b981',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    right: 20,
    bottom: 180,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1e293b',
    backgroundColor: '#f8fafc',
    marginBottom: 16,
  },
  searchButtonModal: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  searchResults: {
    marginTop: 16,
    maxHeight: 200,
  },
  resultsText: {
    fontSize: 16,
    color: '#1e293b',
    marginBottom: 12,
    fontWeight: '500',
  },
  resultItem: {
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  resultCourse: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
    marginBottom: 4,
  },
  resultDateTime: {
    fontSize: 12,
    color: '#64748b',
  },
  noResultsText: {
    fontSize: 14,
    color: '#ef4444',
    marginTop: 16,
    textAlign: 'center',
  },
  qrContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 20,
  },
  qrPlaceholder: {
    width: 220,
    height: 220,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    padding: 10,
  },
  qrText: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  linkText: {
    fontSize: 12,
    color: '#3b82f6',
    fontFamily: 'monospace',
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500',
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    alignItems: 'center',
  },
  activeFilter: {
    backgroundColor: '#3b82f6',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#ffffff',
  },
  reportResults: {
    maxHeight: 200,
    marginTop: 16,
  },
  reportItem: {
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  reportStudentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  reportStudentDetails: {
    fontSize: 12,
    color: '#64748b',
  },
  actionModalButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  noCoursesContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  noCoursesText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
  createCourseButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  createCourseText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  coursesScroll: {
    marginHorizontal: 20,
    marginBottom: 8,
  },
  coursesScrollContent: {
    gap: 12,
    paddingVertical: 4,
  },
  courseQuickCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    width: 140,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  courseQuickCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 8,
  },
  courseQuickName: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
});

export default LecturerDashboard;