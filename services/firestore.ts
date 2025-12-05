
import { initializeApp, FirebaseApp } from "firebase/app";
import { 
    getFirestore, 
    doc, 
    onSnapshot, 
    setDoc, 
    Firestore, 
    enableMultiTabIndexedDbPersistence,
    collection,
    getDoc
} from "firebase/firestore";
import { GlobalData } from "../types";

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

const COLLECTION_NAME = 'wallets';

export const isFirebaseInitialized = () => !!app;

// Helper to remove undefined values as Firestore doesn't support them
const sanitizeForFirestore = <T>(data: T): T => {
    return JSON.parse(JSON.stringify(data));
};

export const initializeFirebase = async (config: any) => {
    try {
        if (!app) {
            app = initializeApp(config);
            db = getFirestore(app);
            
            // Enable Offline Persistence
            try {
                await enableMultiTabIndexedDbPersistence(db);
                console.log("Firestore offline persistence enabled");
            } catch (err: any) {
                if (err.code === 'failed-precondition') {
                    console.warn("Persistence failed: Multiple tabs open");
                } else if (err.code === 'unimplemented') {
                    console.warn("Persistence not supported by browser");
                }
            }
        }
        return true;
    } catch (e) {
        console.error("Firebase init failed", e);
        return false;
    }
};

export const subscribeToWallet = (walletId: string, onUpdate: (data: GlobalData) => void) => {
    if (!db) throw new Error("Firebase not initialized");
    
    // Validate ID
    const safeId = walletId.replace(/[^a-zA-Z0-9-]/g, '');
    
    const docRef = doc(db, COLLECTION_NAME, safeId);
    
    return onSnapshot(docRef, 
        (docSnap) => {
            const source = docSnap.metadata.hasPendingWrites ? "Local" : "Server";
            // console.log(`Data received from ${source}`);
            
            if (docSnap.exists()) {
                onUpdate(docSnap.data() as GlobalData);
            }
        },
        (error) => {
            console.error("Sync Error:", error);
        }
    );
};

export const saveWalletToCloud = async (walletId: string, data: GlobalData) => {
    if (!db) return; // Fail silently if not connected, but usually this won't happen if initialized
    
    const safeId = walletId.replace(/[^a-zA-Z0-9-]/g, '');
    const docRef = doc(db, COLLECTION_NAME, safeId);
    
    // Sanitize data to remove undefined fields which Firestore rejects
    const cleanData = sanitizeForFirestore(data);

    try {
        // We use merge: true to avoid nuking fields if schema changes in future,
        // though for this app we mostly overwrite the JSON blob.
        await setDoc(docRef, cleanData, { merge: true });
    } catch (e) {
        console.error("Failed to save to cloud", e);
        // Note: Firestore SDK automatically queues this write for later if offline
    }
};

export const checkWalletExists = async (walletId: string): Promise<boolean> => {
    if (!db) return false;
    const safeId = walletId.replace(/[^a-zA-Z0-9-]/g, '');
    const docRef = doc(db, COLLECTION_NAME, safeId);
    const snap = await getDoc(docRef);
    return snap.exists();
}
