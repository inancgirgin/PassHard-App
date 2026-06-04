import { create } from 'zustand';

interface AuthState {
  key: string | null; // Şifreli verileri açacak anahtar
  setKey: (key: string) => void;
  clearKey: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  key: null,
  setKey: (key) => set({ key }),
  clearKey: () => set({ key: null }),
}));