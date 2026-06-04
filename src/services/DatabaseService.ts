import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('securepass.db');

export const DatabaseService = {
  init: async () => {
    try {
      // ACCOUNTS TABLOSU (temel sütunlarla)
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          encrypted_data TEXT NOT NULL,
          iv TEXT NOT NULL,
          created_at INTEGER
        );
      `);

      // FOLDERS TABLOSU (temel sütunlarla)
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS folders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          created_at INTEGER
        );
      `);

      // --- MIGRATIONS ---
      const accountColumns = await db.getAllAsync('PRAGMA table_info(accounts)');
      const accountColumnNames = accountColumns.map((c: any) => c.name);

      if (!accountColumnNames.includes('is_geo_locked')) {
        await db.execAsync(`ALTER TABLE accounts ADD COLUMN is_geo_locked INTEGER DEFAULT 0;`);
        console.log("MIGRATION: accounts.is_geo_locked eklendi.");
      }
      if (!accountColumnNames.includes('geo_lat')) {
        await db.execAsync(`ALTER TABLE accounts ADD COLUMN geo_lat REAL DEFAULT 0;`);
        console.log("MIGRATION: accounts.geo_lat eklendi.");
      }
      if (!accountColumnNames.includes('geo_lng')) {
        await db.execAsync(`ALTER TABLE accounts ADD COLUMN geo_lng REAL DEFAULT 0;`);
        console.log("MIGRATION: accounts.geo_lng eklendi.");
      }
      if (!accountColumnNames.includes('folder_id')) {
        await db.execAsync(`ALTER TABLE accounts ADD COLUMN folder_id INTEGER;`);
         console.log("MIGRATION: accounts.folder_id eklendi.");
      }
      if (!accountColumnNames.includes('deleted_at')) {
        await db.execAsync(`ALTER TABLE accounts ADD COLUMN deleted_at INTEGER;`);
        console.log("MIGRATION: accounts.deleted_at eklendi.");
      }
      if (!accountColumnNames.includes('notification_interval')) {
        await db.execAsync(`ALTER TABLE accounts ADD COLUMN notification_interval INTEGER DEFAULT 0;`);
        console.log("MIGRATION: accounts.notification_interval eklendi.");
      }
      if (!accountColumnNames.includes('password_updated_at')) {
        await db.execAsync(`ALTER TABLE accounts ADD COLUMN password_updated_at INTEGER;`);
        console.log("MIGRATION: accounts.password_updated_at eklendi.");
      }
      
      const folderColumns = await db.getAllAsync('PRAGMA table_info(folders)');
      const folderColumnNames = folderColumns.map((c: any) => c.name);

      if (!folderColumnNames.includes('deleted_at')) {
        await db.execAsync(`ALTER TABLE folders ADD COLUMN deleted_at INTEGER;`);
        console.log("MIGRATION: folders.deleted_at eklendi.");
      }

      console.log('Veritabanı (Expo) ve tablolar (Folders, Accounts) hazır!');
    } catch (error) {
      console.error("Veritabanı başlatma hatası:", error);
      throw error;
    }
  },

  // --- Account Metotları ---

  addAccount: async (title: string, encryptedData: string, iv: string, isGeoLocked: boolean, notificationInterval: number, geoLat?: number, geoLng?: number, folderId?: number): Promise<number> => {
    try {
      const query = 'INSERT INTO accounts (title, encrypted_data, iv, created_at, is_geo_locked, geo_lat, geo_lng, folder_id, notification_interval, password_updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
      const now = Date.now();
      const params = [title, encryptedData, iv, now, isGeoLocked ? 1 : 0, geoLat || 0, geoLng || 0, folderId || null, notificationInterval, now];
      const result = await db.runAsync(query, params);
      console.log(`Kayıt eklendi: ${title} (FolderID: ${folderId})`);
      return result.lastInsertRowId;
    } catch (error) {
      console.error("Ekleme hatası:", error);
      throw error;
    }
  },

  updateAccount: async (id: number, title: string, encryptedData: string, iv: string, isGeoLocked: boolean, notificationInterval: number, originalEncryptedData: string, geoLat?: number | null, geoLng?: number | null) => {
    try {
      // Şifre değiştiyse, `password_updated_at` alanını güncelle
      const passwordChanged = encryptedData !== originalEncryptedData;
      const now = Date.now();
      
      let query = `
        UPDATE accounts 
        SET title = ?, encrypted_data = ?, iv = ?, is_geo_locked = ?, geo_lat = ?, geo_lng = ?, notification_interval = ?
      `;
      
      const params: (string | number | null)[] = [title, encryptedData, iv, isGeoLocked ? 1 : 0, geoLat || 0, geoLng || 0, notificationInterval];

      if (passwordChanged) {
        query += ', password_updated_at = ?';
        params.push(now);
      }
      
      query += ' WHERE id = ?';
      params.push(id);

      await db.runAsync(query, params);
      console.log(`Kayıt güncellendi: ID ${id}`);
    } catch (error) {
      console.error("Güncelleme hatası:", error);
      throw error;
    }
  },

  getAccounts: async (folderId?: number): Promise<any[]> => {
    try {
      let query = 'SELECT * FROM accounts';
      const params: any[] = [];
      
      if (folderId) {
        query += ' WHERE folder_id = ? AND deleted_at IS NULL';
        params.push(folderId);
      } else {
        query += ' WHERE folder_id IS NULL AND deleted_at IS NULL';
      }
      
      query += ' ORDER BY created_at DESC';
      
      return await db.getAllAsync(query, params);
    } catch (error) {
      console.error("Veri çekme hatası:", error);
      return [];
    }
  },

  getAllAccounts: async (): Promise<any[]> => {
    try {
      return await db.getAllAsync('SELECT * FROM accounts WHERE deleted_at IS NULL');
    } catch (error) {
      console.error("Tüm verileri çekme hatası:", error);
      return [];
    }
  },

  // Çöp Kutusu ve Silme İşlemleri
  moveAccountToTrash: async (id: number) => {
    try {
      await db.runAsync('UPDATE accounts SET deleted_at = ? WHERE id = ?', [Date.now(), id]);
      console.log(`Kayıt çöpe taşındı: ID ${id}`);
    } catch (error) {
      console.error("Çöpe taşıma hatası:", error);
      throw error;
    }
  },

  getTrashedAccounts: async (): Promise<any[]> => {
    try {
      return await db.getAllAsync('SELECT * FROM accounts WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC');
    } catch (error) {
      console.error("Çöpteki verileri çekme hatası:", error);
      return [];
    }
  },

  restoreAccount: async (id: number) => {
    try {
      await db.runAsync('UPDATE accounts SET deleted_at = NULL WHERE id = ?', [id]);
      console.log(`Kayıt geri yüklendi: ID ${id}`);
    } catch (error) {
      console.error("Geri yükleme hatası:", error);
      throw error;
    }
  },

  deleteAccountPermanently: async (id: number) => {
    try {
      await db.runAsync('DELETE FROM accounts WHERE id = ?', [id]);
      console.log(`Kayıt kalıcı olarak silindi: ID ${id}`);
    } catch (error) {
      console.error("Kalıcı silme hatası:", error);
      throw error;
    }
  },

  purgeOldTrash: async () => {
    try {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      // Hem hesapları hem de klasörleri temizle
      await db.runAsync('DELETE FROM accounts WHERE deleted_at <= ?', [thirtyDaysAgo]);
      await db.runAsync('DELETE FROM folders WHERE deleted_at <= ?', [thirtyDaysAgo]);
      console.log('30 günden eski çöp verileri temizlendi.');
    } catch (error) {
      console.error("Eski çöpleri temizleme hatası:", error);
      throw error;
    }
  },

  // --- Folder Metotları ---

  addFolder: async (name: string) => {
    try {
      await db.runAsync('INSERT INTO folders (name, created_at) VALUES (?, ?)', [name, Date.now()]);
      console.log(`Klasör eklendi: ${name}`);
    } catch (error) {
      console.error("Klasör ekleme hatası:", error);
      throw error;
    }
  },

  getFolders: async (): Promise<any[]> => {
    try {
      // Sadece silinmemiş klasörleri getir
      return await db.getAllAsync('SELECT * FROM folders WHERE deleted_at IS NULL ORDER BY name ASC');
    } catch (error) {
      console.error("Klasörleri çekme hatası:", error);
      return [];
    }
  },

  getTrashedFolders: async (): Promise<any[]> => {
    try {
        return await db.getAllAsync('SELECT * FROM folders WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC');
    } catch (error) {
        console.error("Çöpteki klasörleri çekme hatası:", error);
        return [];
    }
  },

  getTrashedAccountsInFolder: async (folderId: number): Promise<any[]> => {
    try {
        return await db.getAllAsync('SELECT * FROM accounts WHERE folder_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC', [folderId]);
    } catch (error) {
        console.error("Çöpteki klasördeki hesapları çekme hatası:", error);
        return [];
    }
  },

  moveFolderToTrash: async (folderId: number) => {
    try {
      await db.withTransactionAsync(async () => {
        const now = Date.now();
        // Önce klasör içindeki hesapları çöpe taşı
        await db.runAsync('UPDATE accounts SET deleted_at = ? WHERE folder_id = ?', [now, folderId]);
        // Sonra klasörün kendisini çöpe taşı
        await db.runAsync('UPDATE folders SET deleted_at = ? WHERE id = ?', [now, folderId]);
      });
      console.log(`Klasör ve içeriği çöpe taşındı: ID ${folderId}`);
    } catch (error) {
      console.error("Klasör çöpe taşıma hatası:", error);
      throw error;
    }
  },

  restoreFolder: async (folderId: number) => {
    try {
        await db.withTransactionAsync(async () => {
            // Klasör içindeki ilişkili hesapları geri yükle
            await db.runAsync('UPDATE accounts SET deleted_at = NULL WHERE folder_id = ?', [folderId]);
            // Klasörün kendisini geri yükle
            await db.runAsync('UPDATE folders SET deleted_at = NULL WHERE id = ?', [folderId]);
        });
        console.log(`Klasör ve içeriği geri yüklendi: ID ${folderId}`);
    } catch (error) {
        console.error("Klasör geri yükleme hatası:", error);
        throw error;
    }
  },

  deleteFolderPermanently: async (folderId: number) => {
    try {
      await db.withTransactionAsync(async () => {
        // Önce klasör içindeki hesapları kalıcı olarak sil
        await db.runAsync('DELETE FROM accounts WHERE folder_id = ?', [folderId]);
        // Sonra klasörün kendisini kalıcı olarak sil
        await db.runAsync('DELETE FROM folders WHERE id = ?', [folderId]);
      });
      console.log(`Klasör ve içeriği kalıcı olarak silindi: ID ${folderId}`);
    } catch (error) {
      console.error("Klasör kalıcı silme hatası:", error);
      throw error;
    }
  },

  deleteAll: async () => {
    await db.runAsync('DELETE FROM accounts');
    await db.runAsync('DELETE FROM folders');
    console.log("Tüm veriler temizlendi.");
  }
};