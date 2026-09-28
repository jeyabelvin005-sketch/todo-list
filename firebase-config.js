// firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyAfaahiYJ4SZ3ffUEd-RgAfOWTiLsXh2qE",
  authDomain: "todo-tracker-69db1.firebaseapp.com",
  projectId: "todo-tracker-69db1",
  storageBucket: "todo-tracker-69db1.firebasestorage.app",
  messagingSenderId: "200031883510",
  appId: "1:200031883510:web:010f7ee01ecbd82dc05cd7",
  measurementId: "G-B2DBM7EY8T"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
