import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, Alert,
  ActivityIndicator, ScrollView, Switch, SafeAreaView, Platform, StatusBar,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { firestore } from '../../config/firebaseconfig';
import { collection, addDoc, Timestamp, GeoPoint, getDoc, doc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getCurrentLocation, getPlatformIdentifier } from '../../utils/locationHelpers';
import { fluentColors, fluentSpacing, fluentRadius } from '../../utils/fluentTheme';

const NewAttendanceScreen = ({ navigation, route }) => {
  const { courseId, courseCode, userName } = route.params;
  const [sessionName, setSessionName] = useState('');
  const [radius, setRadius] = useState('5');
  const [useLocation, setUseLocation] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isRadiusEmpty, setIsRadiusEmpty] = useState(false);
  const [isSessionNameEmpty, setIsSessionNameEmpty] = useState(false);

  const startAttendance = async () => {
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
        broadcasterPlatform: getPlatformIdentifier(),
      };

      if (useLocation && location) {
        broadcastData.radiusMeters = radiusMeters;
        broadcastData.coordinates = new GeoPoint(location.latitude, location.longitude);
      }

      await addDoc(collection(firestore, 'broadcasts'), broadcastData);

      Alert.alert('Success', `Attendance session started for ${courseCode}`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
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
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
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
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1, backgroundColor: fluentColors.white,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: { flex: 1, backgroundColor: fluentColors.neutralLightest },
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
});

export default NewAttendanceScreen;
