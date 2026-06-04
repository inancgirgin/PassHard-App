import * as Notifications from 'expo-notifications';
import { Alert, Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const NotificationService = {
  
  async requestPermissions() {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Şifre son kullanma tarihlerini hatırlatmak için bildirim izinleri gereklidir.');
      return false;
    }
    
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
    }

    return true;
  },

  async scheduleNotification(accountId: number, title: string, intervalMonths: number) {
    const identifier = `password-expiry-${accountId}`;
    console.log(`[DIAGNOSTIC] scheduleNotification called with: accountId=${accountId}, title=${title}, intervalMonths=${intervalMonths}`);

    try {
      // Önceki bildirimi iptal et, varsa
      await this.cancelNotification(accountId);

      if (typeof intervalMonths !== 'number' || intervalMonths <= 0) {
        console.log(`[DIAGNOSTIC] Invalid intervalMonths (${intervalMonths}). Aborting scheduling.`);
        return;
      }

      const now = new Date();
      const expirationDate = new Date(new Date().setMonth(now.getMonth() + intervalMonths));
      const secondsUntilExpiration = (expirationDate.getTime() - Date.now()) / 1000;
      
      console.log(`[DIAGNOSTIC] Calculated expirationDate: ${expirationDate.toISOString()}`);
      console.log(`[DIAGNOSTIC] Calculated secondsUntilExpiration: ${secondsUntilExpiration}`);

      if (secondsUntilExpiration <= 0) {
        console.log(`[DIAGNOSTIC] Notification time is in the past. Aborting.`);
        return;
      }

      const trigger = {
        seconds: secondsUntilExpiration,
        type: 'timeInterval',
      };
      console.log(`[DIAGNOSTIC] Final trigger object:`, JSON.stringify(trigger));

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "PassHard: Şifre Süresi Doldu!",
          body: `'${title}' başlıklı şifrenizin süresi doldu. Güvenliğiniz için şimdi değiştirin.`,
          data: { accountId },
        },
        trigger,
        identifier,
      });

      console.log(`[SUCCESS] Bildirim başarıyla planlandı: '${title}' için ${intervalMonths} ay sonrası`);

    } catch (e) {
      console.error(`[CRITICAL ERROR] scheduleNotificationAsync içinde hata! Trigger: ${JSON.stringify({ seconds: (new Date().setMonth(new Date().getMonth() + intervalMonths)) })}`, e);
    }
  },

  async cancelNotification(accountId: number) {
    const identifier = `password-expiry-${accountId}`;
    await Notifications.cancelScheduledNotificationAsync(identifier);
    console.log(`Bildirim iptal edildi: ID ${accountId}`);
  },

  async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log("Tüm planlanmış bildirimler iptal edildi.");
  }
};
