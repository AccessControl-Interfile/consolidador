import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, remove } from 'firebase/database';
import { getFirestore, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { SupabaseConfig, HistoryEntry } from '../types';

export const firebaseConfig = {
  apiKey: "AIzaSyBjCPdeqk5xU6KVEn58h1yoS4mueTqz7Og",
  authDomain: "banco-qualityvision.firebaseapp.com",
  databaseURL: "https://banco-qualityvision-default-rtdb.firebaseio.com",
  projectId: "banco-qualityvision",
  storageBucket: "banco-qualityvision.firebasestorage.app",
  messagingSenderId: "556621005632",
  appId: "1:556621005632:web:8927153415da576495f0a5",
  measurementId: "G-WK3F73395C"
};

// Initialize Firebase App instance
export const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Database references
export const realtimeDb = getDatabase(firebaseApp);
export const firestoreDb = getFirestore(firebaseApp);

/**
 * Completely clears all legacy localStorage cache to enforce Firebase as single source of truth
 */
export function purgeLocalStorage(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
      console.log('✓ Memória local (localStorage) limpa com sucesso. Usando Firebase (banco-qualityvision).');
    }
  } catch (e) {
    console.warn('Erro ao limpar localStorage:', e);
  }
}

/**
 * Saves generic key-value settings directly to Firebase Realtime Database and Firestore
 */
export async function saveToFirebase<T = any>(key: string, value: T): Promise<boolean> {
  let success = false;
  const payload = {
    data: value,
    updatedAt: new Date().toISOString()
  };

  // 1. Try Realtime Database
  try {
    const dbRef = ref(realtimeDb, `settings/${key}`);
    await set(dbRef, payload);
    success = true;
  } catch (err) {
    console.warn(`Firebase Realtime DB save failed for key (${key}):`, err);
  }

  // 2. Try Firestore
  try {
    const docRef = doc(firestoreDb, 'settings', key);
    await setDoc(docRef, payload, { merge: true });
    success = true;
  } catch (err) {
    console.warn(`Firebase Firestore save failed for key (${key}):`, err);
  }

  return success;
}

/**
 * Fetches generic key-value settings directly from Firebase
 */
export async function loadFromFirebase<T = any>(key: string): Promise<T | null> {
  // 1. Try Realtime Database first
  try {
    const dbRef = ref(realtimeDb, `settings/${key}`);
    const snapshot = await get(dbRef);
    if (snapshot.exists()) {
      const val = snapshot.val();
      return val?.data !== undefined ? val.data : val;
    }
  } catch (err) {
    console.warn(`Realtime DB load failed for key (${key}):`, err);
  }

  // 2. Fallback to Firestore
  try {
    const docRef = doc(firestoreDb, 'settings', key);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const val = docSnap.data();
      return (val?.data !== undefined ? val.data : val) as T;
    }
  } catch (err) {
    console.warn(`Firestore load failed for key (${key}):`, err);
  }

  return null;
}

/**
 * Deletes a setting key from Firebase
 */
export async function deleteFromFirebase(key: string): Promise<boolean> {
  try {
    await remove(ref(realtimeDb, `settings/${key}`));
    await deleteDoc(doc(firestoreDb, 'settings', key));
    return true;
  } catch (e) {
    console.warn(`Failed to delete key (${key}) from Firebase:`, e);
    return false;
  }
}

/**
 * Saves Supabase credentials (URL, service_role/anonKey, auth) directly to Firebase
 */
export async function saveSupabaseConfigToFirebase(config: SupabaseConfig): Promise<boolean> {
  return saveToFirebase('supabase_config', config);
}

/**
 * Fetches Supabase credentials from Firebase
 */
export async function loadSupabaseConfigFromFirebase(): Promise<SupabaseConfig | null> {
  const data = await loadFromFirebase<SupabaseConfig>('supabase_config');
  if (data) {
    return {
      url: data.url || '',
      anonKey: data.anonKey || '',
      connected: data.connected ?? true,
      email: data.email || '',
      password: data.password || ''
    };
  }
  return null;
}

/**
 * Listens for real-time changes to Supabase Config in Firebase
 */
export function subscribeToSupabaseConfig(callback: (config: SupabaseConfig) => void): () => void {
  const configRef = ref(realtimeDb, 'settings/supabase_config');
  const unsubscribeRealtime = onValue(configRef, (snapshot) => {
    if (snapshot.exists()) {
      const val = snapshot.val();
      callback(val?.data || val);
    }
  }, (err) => {
    console.warn('Realtime subscription error:', err);
  });

  return unsubscribeRealtime;
}
