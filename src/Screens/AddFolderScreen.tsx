import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, StatusBar } from 'react-native';
import { DatabaseService } from '../services/DatabaseService';

export default function AddFolderScreen({ navigation }: any) {
  const [name, setName] = useState('');

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Eksik Bilgi", "Lütfen bir klasör adı girin.");
      return;
    }

    try {
      await DatabaseService.addFolder(name.trim());
      Alert.alert("Başarılı", `"${name.trim()}" klasörü oluşturuldu!`, [
        { text: "Tamam", onPress: () => navigation.goBack() }
      ]);
    } catch (e: any) {
      if (e.message.includes('UNIQUE constraint failed')) {
          Alert.alert("Hata", "Bu isimde bir klasör zaten mevcut.");
      } else {
          Alert.alert("Hata", "Klasör oluşturulurken bir sorun oluştu.");
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Text style={styles.header}>Yeni Klasör Oluştur</Text>

      <Text style={styles.label}>Klasör Adı</Text>
      <TextInput 
        style={styles.input} 
        placeholder="Örn: Sosyal Medya, Banka Hesapları..."
        value={name}
        onChangeText={setName}
        placeholderTextColor="#888"
      />

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>💾 OLUŞTUR</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20, 
    backgroundColor: '#121212',
    justifyContent: 'center'
  },
  header: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 30, 
    color: '#fff', 
    textAlign:'center' 
  },
  label: { 
    fontSize: 14, 
    color: '#888', 
    marginBottom: 5, 
    marginTop: 15 
  },
  input: {
    borderWidth: 1,
    borderColor: '#333',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#1e1e1e',
    marginBottom: 5,
    color: '#fff'
  },
  saveButton: { 
    backgroundColor: '#10b981', 
    padding: 15, 
    borderRadius: 10, 
    marginTop: 30, 
    alignItems: 'center' 
  },
  saveButtonText: { 
    color: '#000', 
    fontSize: 18, 
    fontWeight: 'bold' 
  }
});
