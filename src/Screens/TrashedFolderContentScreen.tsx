import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, StatusBar, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { DatabaseService } from '../services/DatabaseService';

const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000;

export default function TrashedFolderContentScreen({ navigation, route }: any) {
  const { folderId, folderName } = route.params;
  const [trashedAccounts, setTrashedAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadTrashedAccountsInFolder();
    }, [folderId])
  );

  const loadTrashedAccountsInFolder = async () => {
    setIsLoading(true);
    try {
      const accounts = await DatabaseService.getTrashedAccountsInFolder(folderId);
      setTrashedAccounts(accounts);
    } catch (e) {
      Alert.alert("Hata", "Klasör içeriği yüklenirken bir sorun oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreFolder = async () => {
    Alert.alert(
      "Klasörü Geri Yükle",
      `'${folderName}' klasörünü ve içindeki tüm şifreleri geri yüklemek istediğinize emin misiniz?`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Geri Yükle",
          style: "default",
          onPress: async () => {
            try {
              await DatabaseService.restoreFolder(folderId);
              Alert.alert("Başarılı", `'${folderName}' klasörü geri yüklendi.`);
              navigation.goBack(); // Çöp kutusu ekranına geri dön
            } catch (e) {
              Alert.alert("Hata", "Klasör geri yüklenirken bir sorun oluştu.");
            }
          },
        },
      ]
    );
  };

  const handleDeleteFolderPermanently = async () => {
    Alert.alert(
      "Klasörü Kalıcı Olarak Sil",
      `'${folderName}' klasörünü ve içindeki tüm şifreleri kalıcı olarak silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz.`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Kalıcı Sil",
          style: "destructive",
          onPress: async () => {
            try {
              await DatabaseService.deleteFolderPermanently(folderId);
              Alert.alert("Başarılı", `'${folderName}' klasörü kalıcı olarak silindi.`);
              navigation.goBack(); // Çöp kutusu ekranına geri dön
            } catch (e) {
              Alert.alert("Hata", "Klasör kalıcı olarak silinirken bir sorun oluştu.");
            }
          },
        },
      ]
    );
  };

  const renderAccountItem = ({ item }: { item: any }) => {
    return (
      <View style={styles.card}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <View style={styles.iconBox}>
            <Text style={styles.iconText}>{item.title.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.cardTitle}>{item.title}</Text>
        </View>
        <Text style={styles.cardSub}>AES-256 Şifreli</Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, {justifyContent:'center', alignItems:'center'}]}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={{color:'#fff', marginTop:20}}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{folderName} İçeriği</Text>
        <View style={{width: 30}} /> {/* Spacer */}
      </View>

      <FlatList
        data={trashedAccounts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderAccountItem}
        ListEmptyComponent={<Text style={styles.emptyText}>Bu klasör boş.</Text>}
        contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}
      />

      <View style={styles.bottomButtonsContainer}>
        <TouchableOpacity 
          style={[styles.bottomButton, styles.restoreButton]} 
          onPress={handleRestoreFolder}
        >
          <Text style={styles.bottomButtonText}>Klasörü Geri Yükle</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.bottomButton, styles.deleteButton]}
          onPress={handleDeleteFolderPermanently}
        >
          <Text style={[styles.bottomButtonText, styles.deleteButtonText]}>Kalıcı Sil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    paddingTop: 60,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backButton: {
    padding: 5,
    marginRight: 10,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    color: '#666',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#1e1e1e',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  iconBox: {
    width: 40,
    height: 40,
    backgroundColor: '#2d2d2d',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  iconText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#aaa',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#eee',
    flex: 1,
  },
  cardSub: {
    color: '#666',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bottomButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    backgroundColor: '#121212',
  },
  bottomButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  bottomButtonText: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#fff',
  },
  restoreButton: {
    backgroundColor: '#10b981',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  deleteButtonText: {
    color: '#fff',
  }
});
