// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database"; // Correct import for Realtime Database
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB9BKs_pZLtJtDEhTmgcNlyELCTZN4nj7o",
  authDomain: "bellsattend.firebaseapp.com",
  projectId: "bellsattend",
  storageBucket: "bellsattend.firebasestorage.app",
  messagingSenderId: "910898041807",
  appId: "1:910898041807:web:040cb198e20f1b7ad078ba",
  measurementId: "G-JDY1ER2QGJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);


export const auth = getAuth(app);
export const db = getFirestore(app);
export const database = getDatabase(app); 
export const firestore = getFirestore(app);
export default app;  



  //  "assetBundlePatterns": [
  //     "**/*",
  //     "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/*.ttf"
  //   ],
