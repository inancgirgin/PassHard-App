import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, StatusBar } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { CommonActions } from '@react-navigation/native'; // <--- EKLENDİ
import { CryptoService } from '../services/CryptoService';
import { useAuthStore } from '../store/authStore';
import { soundService } from '../services/SoundService';

export default function LoginScreen({ navigation }: any) {
  const [password, setPassword] = useState('');
  const [isFirstRun, setIsFirstRun] = useState(true);
  const setKey = useAuthStore((state) => state.setKey);

  useEffect(() => {
    checkSetup();
  }, []);

  const checkSetup = async () => {
    const storedHash = await SecureStore.getItemAsync('auth_hash');
    if (storedHash) {
      setIsFirstRun(false);
      // Kayıtlı kullanıcı ise direkt biyometrik dene
      setTimeout(() => {
        tryBiometricLogin();
      }, 500); // UI yüklensin diye minik bir gecikme
    }
  };



  const navigateToVault = (panic: boolean) => {
    // Navigasyon Geçmişini Sıfırla ve Kasaya Git
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'VaultList', params: { panicMode: panic } }],
      })
    );
  };

  const handleAction = async () => {
    try {
      if (password.length < 4) {
        Alert.alert('Uyarı', 'Şifre çok kısa.');
        return;
      }

      if (isFirstRun) {
        const salt = CryptoService.generateSalt();
        const key = CryptoService.deriveKey(password, salt);
        const authHash = CryptoService.deriveKey(key, salt);
        await SecureStore.setItemAsync('auth_salt', salt);
        await SecureStore.setItemAsync('auth_hash', authHash);
        // YENİ: Şifreyi de güvenli alana kaydet (Biyometrik giriş için)
        await SecureStore.setItemAsync('user_password', password);

        Alert.alert('Sistem Hazır', 'Ana şifreniz oluşturuldu.');
        setKey(key);
        navigateToVault(false);
      } else {
        if (password === '0000') {
          navigateToVault(true);
          return;
        }

        const salt = await SecureStore.getItemAsync('auth_salt');
        const storedHash = await SecureStore.getItemAsync('auth_hash');

        if (!salt || !storedHash) {
          Alert.alert("Hata", "Veri bulunamadı.");
          return;
        }

        const derivedKey = CryptoService.deriveKey(password, salt);
        const checkHash = CryptoService.deriveKey(derivedKey, salt);

        if (checkHash === storedHash) {
          // YENİ: Başarıyla şifre girildiyse, bir dahaki sefere parmak iziyle girebilmek için şifreyi güncelle/kaydet
          await SecureStore.setItemAsync('user_password', password);

          setKey(derivedKey);
          navigateToVault(false);
        } else {
          Alert.alert('Hata', 'Yanlış şifre!');
        }
      }
    } catch (error: any) {
      Alert.alert('Hata', error.message);
    }
  };

  // Yeni fonksiyon: Otomatik Biyometrik Giriş Denemesi
  const tryBiometricLogin = async () => {
    // Donanım ve kayıt kontrolü
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !isEnrolled) return;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Hızlı Giriş 👆',
      cancelLabel: 'Şifre ile Gir',
      disableDeviceFallback: true, // Sadece biyometrik, pin koduna düşmesin
    });

    if (result.success) {
      // Başarılı ise saklanan şifreyi al
      const storedPassword = await SecureStore.getItemAsync('user_password');
      const salt = await SecureStore.getItemAsync('auth_salt');

      if (storedPassword && salt) {
        const derivedKey = CryptoService.deriveKey(storedPassword, salt);
        setKey(derivedKey);
        // Kullanıcıya hissettirmeden geçiş yap
        setTimeout(() => {
          navigateToVault(false);
        }, 100);
      } else {
        Alert.alert("Bilgi", "Biyometrik giriş için önce şifre ile bir kez giriş yapmalısınız.");
      }
    }
    // Eğer başarısız olursa veya iptal edilirse hiçbir şey yapma, kullanıcı zaten Login ekranında.
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.iconCircle}>
        <Text style={styles.iconText}>🔒</Text>
      </View>
      <Text style={styles.title}>{isFirstRun ? 'KASA KURULUMU' : 'PASSHARD'}</Text>
      <Text style={styles.subtitle}>{isFirstRun ? 'Ana şifrenizi belirleyin' : 'Güvenli giriş yapın'}</Text>

      <TextInput
        style={styles.input}
        placeholder="🔑 Ana Şifre"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholderTextColor="#666"
        keyboardType="numeric"
        selectionColor="#10b981"
      />

      <TouchableOpacity style={styles.mainButton} onPress={() => { soundService.playClick(); handleAction(); }}>
        <Text style={styles.mainButtonText}>{isFirstRun ? "SİSTEMİ KUR" : "GİRİŞ YAP"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 30, backgroundColor: '#121212' },
  iconCircle: { width: 80, height: 80, backgroundColor: '#1e1e1e', borderRadius: 40, alignSelf: 'center', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#333', marginTop: -80 },
  iconText: { fontSize: 32 },
  title: { fontSize: 28, fontWeight: '900', textAlign: 'center', color: '#fff', letterSpacing: 2, marginBottom: 5 },
  subtitle: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 40 },
  input: { backgroundColor: '#1e1e1e', color: '#fff', padding: 18, borderRadius: 12, marginBottom: 20, fontSize: 18, textAlign: 'center', borderWidth: 1, borderColor: '#333' },
  mainButton: { backgroundColor: '#10b981', padding: 18, borderRadius: 12, alignItems: 'center', shadowColor: '#10b981', shadowOpacity: 0.3, shadowRadius: 10 },
  mainButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 }
});