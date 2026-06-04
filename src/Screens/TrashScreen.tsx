import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, StatusBar, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { DatabaseService } from '../services/DatabaseService';
import { NotificationService } from '../services/NotificationService';

const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000;

export default function TrashScreen({ navigation }: any) {
  const [trashedItems, setTrashedItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadTrashedItems();
    }, [])
  );

  const loadTrashedItems = async () => {
    setIsLoading(true);
    try {
      const accounts = await DatabaseService.getTrashedAccounts();
      const folders = await DatabaseService.getTrashedFolders();
      
      const trashedFolderIds = new Set(folders.map(f => f.id));
      
      // Sadece bir klasörün içinde olmayan (veya klasörü çöpte olmayan) hesapları göster
      const standaloneAccounts = accounts.filter(a => !a.folder_id || !trashedFolderIds.has(a.folder_id));

      const allItems = [
        ...standaloneAccounts.map(a => ({ ...a, type: 'account' })),
        ...folders.map(f => ({ ...f, type: 'folder' }))
      ];

      allItems.sort((a, b) => (b.deleted_at || 0) - (a.deleted_at || 0));

      setTrashedItems(allItems);
    } catch (e) {
      Alert.alert("Hata", "Çöp kutusu yüklenirken bir sorun oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (item: any) => {
    try {
      if (item.type === 'folder') {
        await DatabaseService.restoreFolder(item.id);
      } else {
        await DatabaseService.restoreAccount(item.id);
      }
      Alert.alert("Başarılı", `'${item.name || item.title}' geri yüklendi.`);
      await loadTrashedItems();
    } catch (e) {
      Alert.alert("Hata", "Kayıt geri yüklenirken bir sorun oluştu.");
    }
  };

  const handleDeletePermanently = (item: any) => {
    const itemName = item.name || item.title;
    let message = `'${itemName}' kaydını kalıcı olarak silmek istediğinize emin misiniz?`;
    if (item.type === 'folder') {
        message += '\n\nBu işlem, klasörün içindeki tüm şifreleri de kalıcı olarak silecektir.';
    }
    message += '\nBu işlem geri alınamaz.';


    Alert.alert(
      "Kalıcı Olarak Sil",
      message,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            try {
              if (item.type === 'folder') {
                // Klasör içindeki hesapların bildirimlerini iptal et
                const accountsInFolder = await DatabaseService.getTrashedAccountsInFolder(item.id);
                for (const acc of accountsInFolder) {
                    await NotificationService.cancelNotification(acc.id);
                }
                await DatabaseService.deleteFolderPermanently(item.id);
              } else {
                await NotificationService.cancelNotification(item.id);
                await DatabaseService.deleteAccountPermanently(item.id);
              }
              Alert.alert("Başarılı", "Kayıt kalıcı olarak silindi.");
              await loadTrashedItems();
            } catch (e) {
              Alert.alert("Hata", "Kalıcı silme sırasında bir sorun oluştu.");
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    const timeRemaining = (item.deleted_at || 0) + THIRTY_DAYS_IN_MS - Date.now();
    const daysRemaining = Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60 * 24)));
    const isFolder = item.type === 'folder';
    const title = isFolder ? item.name : item.title;

    return (
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => {
          if (isFolder) {
            navigation.navigate('TrashedFolderContent', { folderId: item.id, folderName: title });
          }
        }}
      >
        <View style={styles.cardHeader}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              {isFolder && <Image source={require('../../assets/folder.png')} style={styles.folderIcon} />}
              <Text style={styles.cardTitle}>{title}</Text>
            </View>
            <Text style={styles.daysRemainingText}>{daysRemaining} gün kaldı</Text>
        </View>
        <Text style={styles.cardSub}>30 gün sonunda kalıcı olarak silinecek.</Text>
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.restoreButton]} 
            onPress={() => handleRestore(item)}
          >
            <Text style={styles.buttonText}>Geri Yükle</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.button, styles.deleteButton]}
            onPress={() => handleDeletePermanently(item)}
          >
            <Text style={[styles.buttonText, styles.deleteButtonText]}>Kalıcı Sil</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.headerContainer}>
            <Text style={styles.header}>Çöp Kutusu</Text>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>Kapat</Text>
            </TouchableOpacity>
        </View>

        <FlatList
            data={trashedItems}
            keyExtractor={(item) => `${item.type}-${item.id}`}
            renderItem={renderItem}
            ListEmptyComponent={<View style={{paddingTop: 80, alignItems:'center'}}><Text style={styles.emptyText}>Çöp kutusu boş.</Text></View>}
            contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}
            refreshing={isLoading}
            onRefresh={loadTrashedItems}
        />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: '500'
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#1e1e1e',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#eee',
  },
  folderIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
    tintColor: '#77a5ff'
  },
  daysRemainingText: {
    fontSize: 12,
    color: '#f97316',
    fontWeight: '600',
  },
  cardSub: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 15,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  restoreButton: {
    backgroundColor: '#10b981',
  },
  deleteButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  buttonText: {
    color: '#000',
    fontWeight: 'bold',
  },
  deleteButtonText: {
    color: '#ef4444',
  }
});