import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Switch, ScrollView } from 'react-native';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
import { DatabaseService } from '../services/DatabaseService';
import { CryptoService } from '../services/CryptoService';
import { useAuthStore } from '../store/authStore';
import { NotificationService } from '../services/NotificationService';

export default function AddEditScreen({ navigation, route }: any) {
  // --- Parametreleri al ---
  const itemToEdit = route.params?.itemToEdit;
  const folderId = itemToEdit ? itemToEdit.folder_id : route.params?.folderId;
  const isEditMode = !!itemToEdit;

  // --- State'ler ---
  const [title, setTitle] = useState('');
  const [password, setPassword] = useState('');
  const [isGeoLocked, setIsGeoLocked] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationStatus, setLocationStatus] = useState('');
  const [notificationInterval, setNotificationInterval] = useState(0); // 0 = Asla
  
  const masterKey = useAuthStore((state) => state.key);

  // --- useEffect: Düzenleme modunda formu doldur ---
  useEffect(() => {
    if (isEditMode && masterKey) {
      // Başlık ve diğer basit state'leri ayarla
      setTitle(itemToEdit.title);
      setIsGeoLocked(itemToEdit.is_geo_locked === 1);
      setLatitude(itemToEdit.geo_lat);
      setLongitude(itemToEdit.geo_lng);
      setNotificationInterval(itemToEdit.notification_interval || 0);
      if(itemToEdit.is_geo_locked) setLocationStatus('Konum ayarlı.');

      // Şifreyi çöz ve state'e ata
      try {
        const decryptedJson = CryptoService.decrypt(itemToEdit.encrypted_data, masterKey, itemToEdit.iv);
        const data = JSON.parse(decryptedJson);
        setPassword(data.pass);
      } catch (e) {
        Alert.alert("Hata", "Bu kaydın şifresi çözülemedi. Veri bozulmuş olabilir.");
        navigation.goBack();
      }
    }
  }, [isEditMode, itemToEdit, masterKey]);

  // --- Fonksiyonlar ---

  const generateStrongPassword = () => {
    const length = 16;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let retVal = "";
    for (let i = 0, n = charset.length; i < length; ++i) {
        retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    setPassword(retVal);
  };

  const handleGetLocation = async () => {
      setLocationStatus('İzin isteniyor...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
          setLocationStatus('Konum izni reddedildi.');
          Alert.alert("İzin Gerekli", "Güvenli alan kilidi için konum izni vermeniz gerekiyor.");
          return;
      }

      setLocationStatus('Konum alınıyor...');
      try {
          const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          setLatitude(location.coords.latitude);
          setLongitude(location.coords.longitude);
          setLocationStatus(`Konum kaydedildi!`);
      } catch (error) {
          setLocationStatus('Konum alınamadı.');
          Alert.alert("Hata", "Konum bilgisi alınırken bir sorun oluştu.");
      }
  };

  const handleSave = async () => {
    if (!title || !password) {
      Alert.alert("Eksik", "Lütfen başlık ve şifreyi girin.");
      return;
    }

    if (isGeoLocked && (!latitude || !longitude)) {
        Alert.alert("Eksik", "Güvenli alan kilidi aktif ancak konum ayarlanmamış. Lütfen konum ayarlayın.");
        return;
    }

    if (!masterKey) {
      Alert.alert("Hata", "Oturum süreniz dolmuş.");
      return;
    }

    const secretPayload = JSON.stringify({ pass: password });
    const { content, iv } = CryptoService.encrypt(secretPayload, masterKey);

    try {
      let accountId = isEditMode ? itemToEdit.id : null;

      if (isEditMode) {
        // Güncelleme
        await DatabaseService.updateAccount(itemToEdit.id, title, content, iv, isGeoLocked, notificationInterval, itemToEdit.encrypted_data, latitude, longitude);
      } else {
        // Yeni ekleme
        accountId = await DatabaseService.addAccount(title, content, iv, isGeoLocked, notificationInterval, latitude, longitude, folderId);
      }

      // Bildirimleri ayarla
      if (accountId) {
        if (notificationInterval > 0) {
          await NotificationService.scheduleNotification(accountId, title, notificationInterval);
        } else {
          await NotificationService.cancelNotification(accountId);
        }
      }

      Alert.alert("Başarılı", isEditMode ? "Şifre güncellendi!" : "Şifre güvenli bir şekilde kaydedildi!", [
        { text: "Tamam", onPress: () => navigation.goBack() }
      ]);

    } catch (e) {
      console.error(e);
      Alert.alert("Hata", "Kayıt sırasında bir sorun oluştu.");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
      <Text style={styles.header}>{isEditMode ? 'Şifre Ayarlarını Değiştir' : 'Yeni Şifre Ekle'}</Text>

      <Text style={styles.label}>Platform / Başlık</Text>
      <TextInput 
        style={styles.input} 
        placeholder="Örn: Instagram, Kasa Şifresi..." 
        value={title}
        onChangeText={setTitle}
        placeholderTextColor="#888"
      />
      <Text style={styles.label}>Şifre</Text>
      <View style={styles.passwordContainer}>
        <TextInput 
          style={[styles.input, { flex: 1, marginBottom: 0 }]} 
          placeholder="Şifreniz" 
          value={password}
          onChangeText={setPassword}
          placeholderTextColor="#888"
        />
        <TouchableOpacity style={styles.genButton} onPress={generateStrongPassword}>
          <Text style={styles.genButtonText}>🎲 Üret</Text>
        </TouchableOpacity>
      </View>

      {/* Güvenli Alan Kilidi */}
      <View style={styles.settingContainer}>
        <View style={{flex: 1, paddingRight: 10}}>
          <Text style={styles.settingTitle}>🏠 Güvenli Alan Kilidi</Text>
          <Text style={styles.settingSub}>
            Aktif edilirse, bu şifre sadece ayarlanan konumun yakınındayken görünür olur.
          </Text>
        </View>
        <Switch 
          value={isGeoLocked}
          onValueChange={(value) => {
              setIsGeoLocked(value);
              if (!value) {
                  setLatitude(null);
                  setLongitude(null);
                  setLocationStatus('');
              }
          }}
          trackColor={{ false: "#767577", true: "#2ecc71" }}
          thumbColor={isGeoLocked ? "#fff" : "#f4f3f4"}
        />
      </View>

      {isGeoLocked && (
        <View style={styles.locationBox}>
            <TouchableOpacity style={styles.locationButton} onPress={handleGetLocation}>
                <Text style={styles.locationButtonText}>📍 Mevcut Konumu Ayarla</Text>
            </TouchableOpacity>
            {locationStatus ? <Text style={styles.locationStatusText}>{locationStatus}</Text> : null}
        </View>
      )}

      {/* Şifre Değiştirme Hatırlatıcısı */}
      <View style={[styles.settingContainer, {marginTop: 20, borderColor: '#f39c12'}]}>
        <View style={{flex: 1, paddingRight: 10}}>
          <Text style={[styles.settingTitle, {color: '#f39c12'}]}>⏰ Şifre Değiştirme Hatırlatıcısı</Text>
          <Text style={styles.settingSub}>
            Şifrenizi ne kadar sürede bir değiştirmeniz gerektiğini hatırlatır.
          </Text>
        </View>
      </View>
      <View style={styles.sliderContainer}>
        <Slider
          style={{flex: 1}}
          minimumValue={0}
          maximumValue={12}
          step={1}
          value={notificationInterval}
          onValueChange={setNotificationInterval}
          minimumTrackTintColor="#f39c12"
          thumbTintColor="#f39c12"
        />
        <Text style={styles.sliderValueText}>
          {notificationInterval === 0 ? 'Asla' : `${notificationInterval} Ay`}
        </Text>
      </View>


      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>💾 KAYDET</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#121212' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#fff', textAlign:'center' },
  label: { fontSize: 14, color: '#888', marginBottom: 5, marginTop: 15 },
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
  passwordContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  genButton: { backgroundColor: '#8e44ad', padding: 12, borderRadius: 8, justifyContent:'center' },
  genButtonText: { color: '#fff', fontWeight: 'bold' },
  
  settingContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    padding: 15, 
    borderRadius: 10, 
    marginTop: 25, 
    borderWidth: 1, 
    borderColor: '#10b981' 
  },
  settingTitle: { fontSize: 16, fontWeight: 'bold', color: '#34d399' },
  settingSub: { fontSize: 12, color: '#16a34a', marginTop: 3 },

  locationBox: {
      backgroundColor: '#1e1e1e',
      borderColor: '#333',
      borderWidth: 1,
      borderRadius: 10,
      padding: 15,
      marginTop: -10,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      alignItems: 'center'
  },
  locationButton: {
      backgroundColor: '#3b82f6',
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 8,
  },
  locationButtonText: {
      color: 'white',
      fontWeight: 'bold',
      fontSize: 14,
  },
  locationStatusText: {
      marginTop: 10,
      fontSize: 12,
      color: '#94a3b8',
      fontWeight: '500'
  },
  sliderContainer: {
    backgroundColor: '#1e1e1e',
    borderColor: '#f39c12',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 5,
    marginTop: -10,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sliderValueText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    width: 60,
    textAlign: 'right'
  },
  saveButton: { backgroundColor: '#10b981', padding: 15, borderRadius: 10, marginTop: 30, alignItems: 'center' },
  saveButtonText: { color: '#000', fontSize: 18, fontWeight: 'bold' }
});