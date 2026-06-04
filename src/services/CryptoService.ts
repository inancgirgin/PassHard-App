import CryptoJS from 'crypto-js';

const KEY_SIZE = 256 / 32; // 256-bit
const ITERATIONS = 10000; // Hız için biraz düşürdük, telefonda kasmaması için

export const CryptoService = {
  // 1. Rastgele Tuz (Salt) Üretir
  generateSalt: () => {
    const randomWord = CryptoJS.lib.WordArray.random(128 / 8);
    return randomWord.toString(CryptoJS.enc.Hex);
  },

  // 2. Şifreden Anahtar Türetir (PBKDF2)
  deriveKey: (password: string, salt: string) => {
    const key = CryptoJS.PBKDF2(password, CryptoJS.enc.Hex.parse(salt), {
      keySize: KEY_SIZE,
      iterations: ITERATIONS
    });
    return key.toString(CryptoJS.enc.Hex);
  },

  // 3. Veriyi Şifreler (AES)
  encrypt: (text: string, keyHex: string) => {
    // IV (Başlangıç Vektörü) oluştur
    const iv = CryptoJS.lib.WordArray.random(128 / 8);
    
    const key = CryptoJS.enc.Hex.parse(keyHex);
    
    const encrypted = CryptoJS.AES.encrypt(text, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    return {
      iv: iv.toString(CryptoJS.enc.Hex),
      content: encrypted.ciphertext.toString(CryptoJS.enc.Hex) // Sadece şifreli metni alıyoruz
    };
  },

  // 4. Şifreyi Çözer
  decrypt: (encryptedHex: string, keyHex: string, ivHex: string) => {
    const key = CryptoJS.enc.Hex.parse(keyHex);
    const iv = CryptoJS.enc.Hex.parse(ivHex);
    
    // Crypto-JS formatına uygun hale getirme
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Hex.parse(encryptedHex)
    });

    const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    return decrypted.toString(CryptoJS.enc.Utf8);
  }
};