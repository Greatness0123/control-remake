import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

const QRCodeScanner = ({ navigation, route }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    requestPermission();
  }, []);

  const handleBarCodeScanned = ({ data }) => {
    setScanned(true);

    
    const onScan = route.params?.onScan;
    if (onScan) {
      onScan(data);
    }

   
    setTimeout(() => {
      navigation.goBack();
    }, 500);
  };

  const handleBack = () => {
    navigation.goBack();
  };

  if (!permission) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center' }]}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={60} color="#cbd5e1" />
          <Text style={styles.permissionText}>Requesting camera access...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center' }]}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-off-outline" size={60} color="#cbd5e1" />
          <Text style={styles.permissionText}>Camera access denied</Text>
          <Text style={styles.permissionSubtext}>
            Please enable camera access in your settings to scan QR codes
          </Text>
          <TouchableOpacity
            onPress={() => requestPermission()}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      <CameraView
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        style={styles.camera}
        torch={torchOn ? 'on' : 'off'}
      >
     
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.title}>Scan QR Code</Text>
          <TouchableOpacity
            onPress={() => setTorchOn(!torchOn)}
            style={styles.torchButton}
          >
            <Ionicons
              name={torchOn ? 'flashlight' : 'flashlight-outline'}
              size={24}
              color="#ffffff"
            />
          </TouchableOpacity>
        </View>

        
        <View style={styles.scannerContainer}>
          <View style={styles.scannerOverlay} />
          <View style={styles.scannerBox}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <View style={styles.scannerOverlay} />
        </View>

       
        <View style={styles.footer}>
          <Text style={styles.instructionText}>
            Point your camera at a QR code to scan
          </Text>
          {scanned && (
            <Text style={styles.scannedText}>QR Code scanned! Redirecting...</Text>
          )}
        </View>
      </CameraView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,  
  },
  camera: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  torchButton: {
    padding: 8,
  },
  scannerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  scannerOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    flex: 1,
    width: '100%',
  },
  scannerBox: {
    width: 280,
    height: 280,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#3b82f6',
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  footer: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 14,
    color: '#ffffff',
    textAlign: 'center',
  },
  scannedText: {
    fontSize: 14,
    color: '#10b981',
    marginTop: 8,
    fontWeight: '600',
  },
  permissionContainer: {
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  permissionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 16,
  },
  permissionSubtext: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default QRCodeScanner;