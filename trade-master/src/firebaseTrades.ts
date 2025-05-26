import { getFirestore, collection, addDoc, getDocs, onSnapshot, doc, deleteDoc, updateDoc, query, orderBy } from "firebase/firestore";
import { firebaseApp } from "./firebaseConfig";

const db = getFirestore(firebaseApp);
const tradesCollection = collection(db, "trades");

// Add a new trade
export async function addTrade(trade: any) {
  return await addDoc(tradesCollection, trade);
}

// Get all trades (one-time fetch)
export async function getAllTrades() {
  const snapshot = await getDocs(query(tradesCollection, orderBy("Date", "desc")));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Update a trade by id
export async function updateTrade(id: string, data: any) {
  return await updateDoc(doc(tradesCollection, id), data);
}

// Delete a trade by id
export async function deleteTrade(id: string) {
  return await deleteDoc(doc(tradesCollection, id));
}

// Subscribe to trades in real-time
export function subscribeToTrades(callback: (trades: any[]) => void) {
  return onSnapshot(query(tradesCollection, orderBy("Date", "desc")), (snapshot) => {
    const trades = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(trades);
  });
}