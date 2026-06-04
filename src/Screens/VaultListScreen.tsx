import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, StatusBar, ActivityIndicator, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import { DatabaseService } from '../services/DatabaseService';
import { CryptoService } from '../services/CryptoService';
import { useAuthStore } from '../store/authStore';
import { NotificationService } from '../services/NotificationService';
import { soundService } from '../services/SoundService';

const SAFE_RADIUS_METERS = 500;

export default function VaultListScreen({ navigation, route }: any) {
  const currentFolderId = route.params?.folderId;
  const isPanicMode = route.params?.panicMode || false;

  // --- STATE ---
  const [allItems, setAllItems] = useState<any[]>([]); // Klasörler + Hesaplar (Filtresiz)
  const [filteredItems, setFilteredItems] = useState<any[]>([]); // Arama sonrası gösterilenler
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('GPS Beklemede');
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [currentUserLocation, setCurrentUserLocation] = useState<Location.LocationObject | null>(null);

  const masterKey = useAuthStore((state) => state.key);

  // --- DATA LOADING & FOCUS ---

  useFocusEffect(
    useCallback(() => {
      if (!isPanicMode) {
        loadItems();
      }
    }, [isPanicMode, currentUserLocation, currentFolderId])
  );

  useEffect(() => {
    const timer = setTimeout(() => initApp(), 1000);
    return () => clearTimeout(timer);
  }, []);

  const initApp = async () => {
    try {
      if (isPanicMode) {
        loadPanicData();
        return;
      }
      await DatabaseService.init();
      await DatabaseService.purgeOldTrash();
      await setupNotifications();
      await checkLocationSilent();
      await loadItems();
      setIsLoading(false);
    } catch (e: any) {
      Alert.alert("Hata", "Sistem başlatılamadı: " + e.message);
      setIsLoading(false);
    }
  };

  const setupNotifications = async () => {
    const hasPermission = await NotificationService.requestPermissions();
    if (!hasPermission) return;

    try {
      const accounts = await DatabaseService.getAllAccounts();
      // Önce tüm bildirimleri temizle
      await NotificationService.cancelAllNotifications();
      // Sonra yeniden planla
      for (const acc of accounts) {
        if (acc.notification_interval > 0 && acc.password_updated_at) {
          const passwordDate = new Date(acc.password_updated_at);
          const expirationDate = new Date(passwordDate.setMonth(passwordDate.getMonth() + acc.notification_interval));

          if (expirationDate.getTime() > Date.now()) {
            await NotificationService.scheduleNotification(acc.id, acc.title, acc.notification_interval);
          }
        }
      }
    } catch (e) {
      console.error("Bildirimleri planlarken hata oluştu:", e);
    }
  };

  const loadItems = async () => {
    // Sadece root dizindeyken klasörleri çek
    const folderPromise = !currentFolderId ? DatabaseService.getFolders() : Promise.resolve([]);
    const accountPromise = DatabaseService.getAccounts(currentFolderId);

    const [folders, accounts] = await Promise.all([folderPromise, accountPromise]);

    const processedAccounts = accounts.map(acc => {
      let isExpiringSoon = false;
      if (acc.notification_interval > 0 && acc.password_updated_at) {
        const passwordDate = new Date(acc.password_updated_at);
        const expirationDate = new Date(new Date(passwordDate).setMonth(passwordDate.getMonth() + acc.notification_interval));
        const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;

        // Süre dolmadıysa ve 7 günden az kaldıysa
        if (expirationDate.getTime() > Date.now() && (expirationDate.getTime() - Date.now() < sevenDaysInMs)) {
          isExpiringSoon = true;
        }
      }

      return { ...acc, isExpiringSoon };
    });

    const visibleAccounts = processedAccounts.filter((acc: any) => {
      if (!acc.is_geo_locked) return true;
      if (!currentUserLocation || !acc.geo_lat || !acc.geo_lng) return false;
      const dist = getDistanceFromLatLonInMeters(currentUserLocation.coords.latitude, currentUserLocation.coords.longitude, acc.geo_lat, acc.geo_lng);
      return dist < SAFE_RADIUS_METERS;
    });

    const combinedItems = [
      ...folders.map(f => ({ ...f, type: 'folder' })),
      ...visibleAccounts.map(a => ({ ...a, type: 'account' }))
    ];

    setAllItems(combinedItems);
    setFilteredItems(combinedItems); // Başlangıçta hepsi görünsün
    if (searchQuery) handleSearch(searchQuery, combinedItems);
  };

  const loadPanicData = () => {
    const fakeData = [{ id: 999, title: 'Banka Hesabı', type: 'account', fake: true }];
    setAllItems(fakeData);
    setFilteredItems(fakeData);
    setIsLoading(false);
    setStatusMessage('Offline Mod');
  };

  // --- LOCATION ---

  const handleManualLocationCheck = async () => {
    if (isGpsLoading) return;
    setIsGpsLoading(true);
    setStatusMessage('Uydu Aranıyor...');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setStatusMessage('İzin Verilmedi');
        setCurrentUserLocation(null);
      } else {
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCurrentUserLocation(location);
        setStatusMessage('Konum Alındı');
      }
    } catch (error) {
      setStatusMessage('Konum Yok');
      setCurrentUserLocation(null);
    } finally {
      await loadItems();
      setIsGpsLoading(false);
    }
  };

  const checkLocationSilent = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const lastKnown = await Location.getLastKnownPositionAsync({});
        if (lastKnown) {
          setCurrentUserLocation(lastKnown);
          setStatusMessage('Konum Alındı');
        }
      } else {
        setStatusMessage('İzin Verilmedi');
      }
    } catch (e) { setStatusMessage('Konum Yok'); }
  };

  // --- HANDLERS & HELPERS ---

  const handleSearch = (text: string, sourceData = allItems) => {
    setSearchQuery(text);
    if (text) {
      const upperText = text.toUpperCase();
      const newData = sourceData.filter((item) => {
        const nameToSearch = item.type === 'folder' ? item.name : item.title;
        return nameToSearch.toUpperCase().includes(upperText);
      });
      setFilteredItems(newData);
    } else {
      setFilteredItems(sourceData);
    }
  };

  const handleItemPress = (item: any) => {
    if (item.type === 'folder') {
      navigation.push('VaultList', { folderId: item.id });
    } else {
      handleDecryptAndCopy(item);
    }
  };

  const handleDelete = (item: any) => {
    if (item.type === 'folder') {
      Alert.alert(
        "Klasörü Çöpe Taşı",
        `'${item.name}' klasörünü ve içindeki tüm şifreleri çöp kutusuna taşımak istediğinize emin misiniz?`,
        [
          { text: "Vazgeç", style: "cancel" },
          {
            text: "Taşı",
            style: "destructive",
            onPress: async () => {
              try {
                await DatabaseService.moveFolderToTrash(item.id);
                await loadItems();
              } catch (e) {
                Alert.alert("Hata", "Klasör çöpe taşınırken bir sorun oluştu.");
              }
            }
          }
        ]
      );
      return;
    }

    Alert.alert("Çöpe Taşı", `'${item.title}' kaydını çöp kutusuna taşımak istediğine emin misin?`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Taşı", style: "destructive", onPress: async () => {
          try {
            await DatabaseService.moveAccountToTrash(item.id);
            await NotificationService.cancelNotification(item.id); // Bildirimi iptal et
            await loadItems();
          } catch (e) {
            Alert.alert("Hata", "Kayıt çöpe taşınırken bir sorun oluştu.");
          }
        }
      }
    ]);
  };

  const handleDecryptAndCopy = async (item: any) => {
    if (isPanicMode || !masterKey) return;
    try {
      const decryptedJson = CryptoService.decrypt(item.encrypted_data, masterKey, item.iv);
      const data = JSON.parse(decryptedJson);
      Alert.alert(item.title, `Şifre: ${data.pass}`, [
        { text: "Kapat" },
        {
          text: "Kopyala", onPress: async () => {
            await Clipboard.setStringAsync(data.pass);
            Alert.alert("Kopyalandı", "Şifre panoya kopyalandı.\n\nGüvenlik için 30 saniye sonra otomatik olarak silinecektir.");

            // 30 Saniye sonra sil
            setTimeout(async () => {
              try {
                // Sadece o anki pano içeriği hala bizim şifremizse sil (Opsiyonel ama güvenli)
                // Ancak mobilde içeriği okumak bazen izne tabidir, o yüzden direkt siliyoruz.
                await Clipboard.setStringAsync('');
              } catch (e) { /* Sessiz hata */ }
            }, 30000);
          }
        }
      ]);
    } catch (e) { Alert.alert("Hata", "Şifre çözülemedi!"); }
  };

  const getDistanceFromLatLonInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    var R = 6371; var dLat = deg2rad(lat2 - lat1); var dLon = deg2rad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000;
  }
  const deg2rad = (deg: number) => deg * (Math.PI / 180);

  // --- RENDER ---
  const renderItem = ({ item }: { item: any }) => {
    if (item.type === 'folder') {
      return (
        <TouchableOpacity style={styles.folderCard} onPress={() => { soundService.playClick(); handleItemPress(item); }}>
          <Image source={require('../../assets/folder.png')} style={styles.folderIcon} />
          <Text style={styles.folderTitle}>{item.name}</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => { soundService.playClick(); handleDelete(item); }} style={styles.settingsButton}>
            <Image source={require('../../assets/setting.png')} style={styles.settingsIcon} />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    }
    // type === 'account'
    return (
      <TouchableOpacity style={styles.card} onPress={() => { soundService.playClick(); handleItemPress(item); }} onLongPress={() => handleDelete(item)}>
        <View style={[styles.iconBox, isPanicMode && { backgroundColor: '#3f1f1f' }]}>
          <Text style={[styles.iconText, isPanicMode && { color: '#f87171' }]}>
            {item.title.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.is_geo_locked === 1 && <Text style={{ fontSize: 12, marginLeft: 8 }}>📍</Text>}
            {item.isExpiringSoon && <Text style={{ fontSize: 12, marginLeft: 8 }}>❗</Text>}
          </View>
          <Text style={styles.cardSub}>{isPanicMode ? 'ERİŞİM YOK' : ' AES-256 Şifreli'}</Text>
        </View>
        {!isPanicMode && (
          <TouchableOpacity onPress={() => { soundService.playClick(); navigation.navigate('AddEdit', { itemToEdit: item }); }} style={styles.settingsButton}>
            <Image source={require('../../assets/setting.png')} style={styles.settingsIcon} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={{ color: '#fff', marginTop: 20 }}>Sistem Başlatılıyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, isPanicMode && { color: '#ef4444' }]}>
            {isPanicMode ? 'OFFLINE MOD' : (currentFolderId ? 'Klasör' : 'KASAM')}
          </Text>
          {!isPanicMode && (
            <TouchableOpacity onPress={handleManualLocationCheck} disabled={isGpsLoading} style={[styles.badge, { backgroundColor: !!currentUserLocation ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', borderColor: !!currentUserLocation ? '#10b981' : '#ef4444' }]}>
              {isGpsLoading ? <ActivityIndicator size="small" color={!!currentUserLocation ? '#34d399' : '#f87171'} /> : <Text style={{ color: !!currentUserLocation ? '#34d399' : '#f87171', fontSize: 10, fontWeight: 'bold' }}>{!!currentUserLocation ? '● ' : '○ '}{statusMessage}</Text>}
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.headerButtonContainer}>
          {/* Sadece ana dizindeyken klasör ve çöp kutusu butonları görünsün */}
          {!currentFolderId && (
            <>
              <TouchableOpacity onPress={() => { soundService.playClick(); navigation.navigate('Trash'); }} style={[styles.addButton, { backgroundColor: '#ef4444' }]}>
                <Image source={require('../../assets/trash.png')} style={[styles.buttonIcon, { tintColor: '#fff' }]} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { soundService.playClick(); navigation.navigate('AddFolder'); }} style={[styles.addButton, styles.addFolderButton]}>
                <Image source={require('../../assets/folder.png')} style={styles.buttonIcon} />
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity onPress={() => { soundService.playClick(); navigation.navigate('AddEdit', { folderId: currentFolderId }); }} style={styles.addButton}>
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* SEARCH */}
      <View style={styles.searchContainer}>
        <TextInput style={styles.searchInput} placeholder="Ara..." value={searchQuery} onChangeText={(text) => handleSearch(text)} placeholderTextColor="#888" />
      </View>
      {/* LIST */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Henüz kayıtlı şifreniz veya klasörünüz yok.</Text>
            <Text style={styles.emptySubText}>Başlamak için '+' veya 'Klasör' butonlarını kullanın.</Text>
          </View>
        }
        contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}
        refreshing={isLoading}
        onRefresh={loadItems}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#fff' },
  headerButtonContainer: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  addButton: { backgroundColor: '#2563eb', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  addFolderButton: { backgroundColor: '#10b981' },
  buttonIcon: { width: 20, height: 20, tintColor: '#000' },
  addButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginTop: 5, borderWidth: 1, flexDirection: 'row', alignItems: 'center', minHeight: 28 },
  searchContainer: { paddingHorizontal: 20, marginBottom: 20 },
  searchInput: { backgroundColor: '#1e1e1e', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#333', fontSize: 16, color: '#fff' },
  // Account Card
  card: { backgroundColor: '#1e1e1e', padding: 16, marginHorizontal: 20, marginBottom: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a' },
  iconBox: { width: 48, height: 48, backgroundColor: '#2d2d2d', borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  iconText: { fontSize: 22, fontWeight: 'bold', color: '#aaa' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#eee' },
  cardSub: { color: '#666', fontSize: 11, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  settingsButton: {
    padding: 10,
    marginLeft: 10,
  },
  settingsIcon: {
    width: 24,
    height: 24,
    tintColor: '#888',
  },
  // Folder Card
  folderCard: { backgroundColor: '#222736', padding: 20, marginHorizontal: 20, marginBottom: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#3a4466' },
  folderIcon: { width: 32, height: 32, marginRight: 15, tintColor: '#77a5ff' },
  folderTitle: { fontSize: 18, fontWeight: '600', color: '#c3daff' },

  // Empty List Component Styles
  emptyContainer: {
    marginTop: 50,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#eee',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 5,
  },
  emptySubText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 14,
    lineHeight: 20,
  }
});