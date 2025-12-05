const firebaseConfig = {
    apiKey: "AIzaSyACHPZIQumMPFtbnfbKgBkIXFAqc-g8YS4",
    authDomain: "gerador-faturas-egs.firebaseapp.com",
    projectId: "gerador-faturas-egs",
    storageBucket: "gerador-faturas-egs.firebasestorage.app",
    messagingSenderId: "77864961772",
    appId: "1:77864961772:web:e39536de2f8c7dcc0707c9",
    measurementId: "G-H0TKZR626W"
};

import { initializeApp } from 'firebase/app';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

// Conectar ao emulador em ambiente local
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('Utilizando emulador do Firebase Functions');
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

export { app, functions };
