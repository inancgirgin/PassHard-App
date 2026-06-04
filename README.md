# PassHard - Secure Offline-First Password Manager

A lightweight, secure, and privacy-focused cross-platform password management application built with **React Native (Expo)** and **TypeScript**. Designed with an **offline-first** approach to ensure that your sensitive credentials never leave your local device.

---

## 🔒 Security Architecture

Security is the core foundation of PassHard. The app implements industry-standard cryptographic practices to shield user data from local and remote vulnerabilities:

* **AES-256 Encryption:** All stored credentials (passwords, notes, and usernames) are encrypted locally using the Advanced Encryption Standard (AES) with a 256-bit key length before persistence.
* **Zero-Knowledge & Offline-First:** No remote databases, no cloud synchronization, and no hidden tracking. Your master password is never stored or transmitted anywhere; the data can only be decrypted on your physical device.
* **Panic Mode:** A specialized security feature designed to instantly lock or clear sensitive session traces in high-risk environments.

---

## 🛠️ Tech Stack & Dependencies

* **Framework:** React Native via Expo (Expo Go compatible)
* **Language:** TypeScript (Strictly typed for reliable state handling)
* **Local Storage:** Secure local persistence mechanisms optimized for encrypted string structures.
* **Environment Management:** Powered by custom configuration loaders to keep development and production baselines perfectly isolated.

---

## 📂 Project Structure

```text
├── assets/               # Application icons, splash screens, and images
├── src/
│   ├── config/           # Security profiles and encryption initialization
│   ├── context/          # Application state and global security contexts
│   ├── navigation/       # Secure application routing and screen guards
│   ├── screens/          # Authentication, Vault, and Settings views
│   └── utils/            # AES-256 helper classes and cryptographic operations
├── .env.example          # Environment variables template for safe onboarding
├── app.json              # Expo configuration file
└── package.json          # Node dependencies and project scripts
