import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SignUpScreen from './signup/index';
import LoginScreen from './login/index';
import TeacherDashboard from './lecturer'; 
import StudentDashboard from './student'; 
import TeacherBroadcast from './lecturer/BroadcastScreen';
import FindBroadcastScreen from './student/AvailableBroadcastScreen';
import AdminScreen from './admin';
import QRCodeScanner from './screens/QRCodeScanner';
import ParticipantsView from './screens/ParticipantView';
import CourseDashboard from './lecturer/CourseDashboard';
import CourseDetailScreen from './lecturer/CourseDetailScreen';
import CourseRepManager from './lecturer/CourseRepManager';
import NewAttendanceScreen from './lecturer/NewAttendanceScreen';
import CourseHistoryScreen from './student/CourseHistoryScreen';
import SharedCoursesScreen from './student/SharedCoursesScreen';
import Toast from './components/Toast';

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    const checkFirstTime = async () => {
      const isFirstTime = await AsyncStorage.getItem('isFirstTime');
      setInitialRoute('Login'); 
    };

    checkFirstTime();
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer
      documentTitle={{
        enabled: false
      }}
    >
      <Stack.Navigator screenOptions={{
        headerShown: false,
      }}>
        
        <Stack.Screen 
          name="Login" 
          component={LoginScreen} 
        />
        <Stack.Screen 
          name="SignUp" 
          component={SignUpScreen} 
        />
        <Stack.Screen 
          name="TeacherScreen" 
          component={TeacherDashboard} 
        />
        <Stack.Screen 
          name="StudentScreen" 
          component={StudentDashboard} 
        />
        <Stack.Screen 
          name="TeacherBroadcastScreen" 
          component={TeacherBroadcast} 
        />
        <Stack.Screen 
          name="StudentBroadcastScreen" 
          component={FindBroadcastScreen} 
        />
        <Stack.Screen 
          name="AdminScreen" 
          component={AdminScreen} 
        />
        <Stack.Screen 
          name="QRCodeScanner" 
          component={QRCodeScanner} 
        />
        <Stack.Screen 
        name="ParticipantsView"
         component={ParticipantsView} 
         />
        <Stack.Screen 
          name="CourseDashboard" 
          component={CourseDashboard} 
        />
        <Stack.Screen 
          name="CourseDetail" 
          component={CourseDetailScreen} 
        />
        <Stack.Screen 
          name="CourseRepManager" 
          component={CourseRepManager} 
        />
        <Stack.Screen 
          name="NewAttendance" 
          component={NewAttendanceScreen} 
        />
        <Stack.Screen 
          name="CourseHistory" 
          component={CourseHistoryScreen} 
        />
        <Stack.Screen 
          name="SharedCourses" 
          component={SharedCoursesScreen} 
        />
      </Stack.Navigator>
      <Toast />
    </NavigationContainer>
  );
}