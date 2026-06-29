import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Modal,
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc,
  query,
  where
} from 'firebase/firestore';
import { firestore } from '../../config/firebaseconfig';

const db = firestore;
const ADMIN_PIN = "Adminbells";

const AdminScreen = ({ navigation }) => {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [databaseData, setDatabaseData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [addStudentModalVisible, setAddStudentModalVisible] = useState(false);
  const [matricNumber, setMatricNumber] = useState('');
  const [broadcastId, setBroadcastId] = useState('');
  const [editData, setEditData] = useState({});
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const collections = ['students', 'teachers', 'broadcasts'];

  useEffect(() => {
    if (isAuthenticated) {
      loadDatabaseData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    filterData();
  }, [searchQuery, databaseData]);

  const filterData = () => {
    if (!searchQuery.trim()) {
      setFilteredData(databaseData);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = databaseData.filter(item => {
      // Search in document ID
      if (item.id.toLowerCase().includes(query)) return true;
      
      // Search in document data
      const dataString = JSON.stringify(item.data).toLowerCase();
      return dataString.includes(query);
    });

    setFilteredData(filtered);
  };

  const handlePinSubmit = () => {
    if (pin === ADMIN_PIN) {
      setIsAuthenticated(true);
    } else {
      Alert.alert('Error', 'Invalid PIN. Please try again.');
      setPin('');
    }
  };

  const loadDatabaseData = async () => {
    setLoading(true);
    try {
      const allData = [];
      
      for (const collectionName of collections) {
        const querySnapshot = await getDocs(collection(db, collectionName));
        querySnapshot.forEach((doc) => {
          allData.push({
            collection: collectionName,
            id: doc.id,
            data: doc.data()
          });
        });
      }
      
      setDatabaseData(allData);
      setFilteredData(allData);
    } catch (error) {
      Alert.alert('Error', 'Failed to load database data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadCollectionData = async (collectionName) => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, collectionName));
      const collectionData = [];
      
      querySnapshot.forEach((doc) => {
        collectionData.push({
          collection: collectionName,
          id: doc.id,
          data: doc.data()
        });
      });
      
      // For broadcasts, load participants
      if (collectionName === 'broadcasts') {
        for (let i = 0; i < collectionData.length; i++) {
          const broadcast = collectionData[i];
          const participantsSnapshot = await getDocs(collection(db, `broadcasts/${broadcast.id}/participants`));
          const participants = [];
          
          participantsSnapshot.forEach((doc) => {
            participants.push({
              id: doc.id,
              data: doc.data()
            });
          });
          
          broadcast.data.participants = participants;
          broadcast.data.participantCount = participants.length;
        }
      }
      
      setDatabaseData(collectionData);
      setFilteredData(collectionData);
    } catch (error) {
      Alert.alert('Error', 'Failed to load collection data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setSelectedDocument(item);
    setEditData(item.data);
    setEditModalVisible(true);
  };

  const confirmDelete = (item) => {
    setItemToDelete(item);
    setDeleteModalVisible(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    setLoading(true);
    try {
      await deleteDoc(doc(db, itemToDelete.collection, itemToDelete.id));
      Alert.alert('Success', 'Item deleted successfully');
      setDeleteModalVisible(false);
      setItemToDelete(null);
      
      // Reload data
      if (selectedCollection) {
        await loadCollectionData(selectedCollection);
      } else {
        await loadDatabaseData();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to delete item: ' + (error.message || 'Unknown error'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedDocument) return;
    
    setLoading(true);
    try {
      await updateDoc(doc(db, selectedDocument.collection, selectedDocument.id), editData);
      Alert.alert('Success', 'Item updated successfully');
      setEditModalVisible(false);
      
      // Reload data
      if (selectedCollection) {
        await loadCollectionData(selectedCollection);
      } else {
        await loadDatabaseData();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update item');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudentToBroadcast = async () => {
    if (!matricNumber || !broadcastId) {
      Alert.alert('Error', 'Please enter both matric number and broadcast ID');
      return;
    }

    setLoading(true);
    try {
      // Find student by matric number
      const studentsQuery = query(collection(db, 'students'), where('matricNumber', '==', matricNumber));
      const studentSnapshot = await getDocs(studentsQuery);
      
      if (studentSnapshot.empty) {
        Alert.alert('Error', 'Student not found with this matric number');
        return;
      }

      const studentData = studentSnapshot.docs[0].data();
      
      // Add student to broadcast participants
      await addDoc(collection(db, `broadcasts/${broadcastId}/participants`), {
        fullName: studentData.fullName,
        matricNumber: studentData.matricNumber,
        college: studentData.college,
        department: studentData.department,
        currentLevel: studentData.currentLevel,
        timeSignedIn: new Date(),
        addedByAdmin: true
      });

      Alert.alert('Success', 'Student added to broadcast successfully');
      setMatricNumber('');
      setBroadcastId('');
      setAddStudentModalVisible(false);
      
      // Reload data
      if (selectedCollection) {
        await loadCollectionData(selectedCollection);
      } else {
        await loadDatabaseData();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add student to broadcast');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getDisplayValue = (value) => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') {
      if (value.toDate && typeof value.toDate === 'function') {
        return value.toDate().toLocaleString();
      }
      if (value.latitude !== undefined && value.longitude !== undefined) {
        return `Lat: ${value.latitude.toFixed(6)}, Lng: ${value.longitude.toFixed(6)}`;
      }
      if (Array.isArray(value)) {
        return `Array (${value.length} items)`;
      }
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const renderDataItem = ({ item }) => {
    const mainFields = ['fullName', 'matricNumber', 'teacherId', 'customId', 'teacherFullName', 'email'];
    const displayFields = Object.entries(item.data)
      .filter(([key]) => !['participants', 'password'].includes(key))
      .slice(0, 6);

    return (
      <View style={styles.dataCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.collectionBadge}>
              <Text style={styles.collectionBadgeText}>{item.collection}</Text>
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.id}</Text>
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.actionButton} onPress={() => handleEdit(item)}>
              <Ionicons name="create-outline" size={20} color="#3b82f6" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => confirmDelete(item)}>
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.dataContent}>
          {displayFields.map(([key, value]) => (
            <View key={key} style={styles.dataRow}>
              <Text style={styles.dataKey}>{key}:</Text>
              <Text style={styles.dataValue} numberOfLines={2}>
                {getDisplayValue(value)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderEditField = (key, value) => {
    // Skip certain fields that shouldn't be edited
    if (['createdAt', 'updatedAt', 'participants'].includes(key)) {
      return null;
    }

    return (
      <View key={key} style={styles.editField}>
        <Text style={styles.editLabel}>{key}:</Text>
        <TextInput
          style={styles.editInput}
          value={typeof value === 'string' || typeof value === 'number' ? String(value) : JSON.stringify(value)}
          onChangeText={(text) => {
            try {
              const parsedValue = JSON.parse(text);
              setEditData({ ...editData, [key]: parsedValue });
            } catch {
              setEditData({ ...editData, [key]: text });
            }
          }}
          multiline={typeof value === 'object'}
        />
      </View>
    );
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.authContainer}>
            <View style={styles.logoContainer}>
              <View style={styles.iconCircle}>
                <Ionicons name="shield-checkmark" size={48} color="#3b82f6" />
              </View>
              <Text style={styles.adminTitle}>Admin Panel</Text>
              <Text style={styles.adminSubtitle}>Enter PIN to access database</Text>
            </View>
            
            <View style={styles.pinContainer}>
              <TextInput
                style={styles.pinInput}
                placeholder="Enter Admin PIN"
                placeholderTextColor="#94a3b8"
                value={pin}
                onChangeText={setPin}
                secureTextEntry
                maxLength={20}
              />
              <TouchableOpacity style={styles.pinButton} onPress={handlePinSubmit}>
                <Ionicons name="arrow-forward" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            {filteredData.length} {filteredData.length === 1 ? 'record' : 'records'}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={() => selectedCollection ? loadCollectionData(selectedCollection) : loadDatabaseData()}
        >
          <Ionicons name="refresh-outline" size={24} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#94a3b8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by ID, name, matric number, etc."
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.collectionTabs}>
        <TouchableOpacity
          style={[
            styles.collectionTab,
            !selectedCollection && styles.activeTab
          ]}
          onPress={() => {
            setSelectedCollection(null);
            loadDatabaseData();
            setSearchQuery('');
          }}
        >
          <Text style={[
            styles.tabText,
            !selectedCollection && styles.activeTabText
          ]}>
            All
          </Text>
        </TouchableOpacity>
        {collections.map((collection) => (
          <TouchableOpacity
            key={collection}
            style={[
              styles.collectionTab,
              selectedCollection === collection && styles.activeTab
            ]}
            onPress={() => {
              setSelectedCollection(collection);
              loadCollectionData(collection);
              setSearchQuery('');
            }}
          >
            <Text style={[
              styles.tabText,
              selectedCollection === collection && styles.activeTabText
            ]}>
              {collection.charAt(0).toUpperCase() + collection.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.addStudentTab}
          onPress={() => setAddStudentModalVisible(true)}
        >
          <Ionicons name="person-add" size={16} color="#ffffff" />
          <Text style={styles.addStudentTabText}>Add Student</Text>
        </TouchableOpacity>
      </ScrollView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading data...</Text>
        </View>
      ) : filteredData.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="file-tray-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyText}>
            {searchQuery ? 'No results found' : 'No data available'}
          </Text>
          <Text style={styles.emptySubtext}>
            {searchQuery ? 'Try a different search term' : 'Database is empty'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredData}
          renderItem={renderDataItem}
          keyExtractor={(item, index) => `${item.collection}-${item.id}-${index}`}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Document</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close-outline" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.editScroll}>
              {selectedDocument && Object.entries(editData).map(([key, value]) =>
                renderEditField(key, value)
              )}
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.updateButton} onPress={handleUpdate}>
                <Text style={styles.updateButtonText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={deleteModalVisible}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteIconContainer}>
              <Ionicons name="warning" size={48} color="#ef4444" />
            </View>
            <Text style={styles.deleteModalTitle}>Confirm Delete</Text>
            <Text style={styles.deleteModalText}>
              Are you sure you want to delete this {itemToDelete?.collection} record?
            </Text>
            <Text style={styles.deleteModalSubtext}>
              ID: {itemToDelete?.id}
            </Text>
            <Text style={styles.deleteWarning}>
              This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => {
                  setDeleteModalVisible(false);
                  setItemToDelete(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
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
              <Text style={styles.modalTitle}>Add Student to Broadcast</Text>
              <TouchableOpacity onPress={() => setAddStudentModalVisible(false)}>
                <Ionicons name="close-outline" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Enter student and broadcast details</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Student Matric Number"
              placeholderTextColor="#94a3b8"
              value={matricNumber}
              onChangeText={setMatricNumber}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Broadcast ID"
              placeholderTextColor="#94a3b8"
              value={broadcastId}
              onChangeText={setBroadcastId}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => {
                  setAddStudentModalVisible(false);
                  setMatricNumber('');
                  setBroadcastId('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.updateButton} onPress={handleAddStudentToBroadcast}>
                <Text style={styles.updateButtonText}>Add Student</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: 40,
    paddingBottom: 40,
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#ffffff',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  adminTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  adminSubtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  pinContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  pinInput: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
    paddingVertical: 16,
  },
  pinButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  refreshButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1e293b',
  },
  collectionTabs: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    maxHeight: 60,
    minHeight:60,
  },
  collectionTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  activeTab: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  tabText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  addStudentTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#10b981',
    borderRadius: 8,
    gap: 6,
  },
  addStudentTabText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  dataCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  collectionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  collectionBadgeText: {
    fontSize: 11,
    color: '#3b82f6',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  cardActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  dataContent: {
    gap: 8,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dataKey: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    width: 120,
    flexShrink: 0,
  },
  dataValue: {
    fontSize: 13,
    color: '#1e293b',
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(234, 222, 222, 0.68)',
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
    marginBottom: 16,
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
  modalInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1e293b',
    backgroundColor: '#f8fafc',
    marginBottom: 16,
  },
  editScroll: {
    maxHeight: 400,
    marginBottom: 16,
  },
  editField: {
    marginBottom: 16,
  },
  editLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 6,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1e293b',
    backgroundColor: '#f8fafc',
    minHeight: 44,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '600',
  },
  updateButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  updateButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
});

export default AdminScreen;