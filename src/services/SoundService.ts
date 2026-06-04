import { Audio } from 'expo-av';

const clickSound = require('../../assets/tiklamases.wav');

class SoundService {
    private sound: Audio.Sound | null = null;
    private isLoaded: boolean = false;

    constructor() {
        this.loadSound();
    }

    // Sesi hafızaya bir kere yükle
    private async loadSound() {
        try {
            const { sound } = await Audio.Sound.createAsync(clickSound);
            this.sound = sound;
            this.isLoaded = true;
        } catch (error) {
            console.log('Ses yüklenemedi:', error);
        }
    }

    async playClick() {
        try {
            if (this.sound && this.isLoaded) {
                // Zaten yüklüyse baştan oynat (Çok hızlı)
                await this.sound.replayAsync();
            } else {
                // Yüklü değilse yükle ve oynat (İlk seferde)
                await this.loadSound();
                if (this.sound) await this.sound.playAsync();
            }
        } catch (error) {
            // Hata olursa sessiz kal
        }
    }
}

export const soundService = new SoundService();
