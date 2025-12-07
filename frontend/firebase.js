// firebase.js - Keep verification for registration, remove for login
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendEmailVerification,
    GoogleAuthProvider,
    signInWithPopup,
    fetchSignInMethodsForEmail,
    sendPasswordResetEmail,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    addDoc,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    getDocs,
    Timestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDd4jxSZ1qDJmjiVeauuGuVFFImANRdeLo",
    authDomain: "parkqueue-216c7.firebaseapp.com",
    projectId: "parkqueue-216c7",
    storageBucket: "parkqueue-216c7.firebasestorage.app",
    messagingSenderId: "616114899392",
    appId: "1:616114899392:web:2c38883648cecd4f1c6025",
    measurementId: "G-WB0EN4W62V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Set persistence to LOCAL
setPersistence(auth, browserLocalPersistence)
    .then(() => {
        console.log('✅ Auth persistence set to LOCAL');
    })
    .catch((error) => {
        console.error('❌ Auth persistence error:', error);
    });

// -----------------------------
// EmailJS Configuration (for registration verification)
// -----------------------------
const EMAILJS_CONFIG = {
    serviceId: 'service_rj5ncta',
    templateId: 'template_v5rpsub',
    publicKey: 'PeUm-qn8PF7v7jbPL'
};

// -----------------------------
// EMAILJS FUNCTIONS (for registration only)
// -----------------------------
function initializeEmailJS() {
    if (typeof emailjs !== 'undefined' && emailjs.init) {
        try {
            emailjs.init(EMAILJS_CONFIG.publicKey);
            console.log('✅ EmailJS initialized for registration');
        } catch (initErr) {
            console.error('❌ Error initializing EmailJS:', initErr);
        }
    } else {
        console.warn('⚠️ EmailJS SDK not loaded.');
    }
}

async function sendEmailViaEmailJS(email, code) {
    if (typeof emailjs === 'undefined' || !emailjs.send) {
        throw new Error('EmailJS SDK not loaded.');
    }

    const templateParams = {
        to_email: email,
        verification_code: code,
        to_name: email.split('@')[0],
        from_name: 'ParkQueue',
        reply_to: 'noreply@parkqueue.com',
        app_name: 'ParkQueue'
    };

    console.log('📨 Sending verification email to:', email);

    const resp = await emailjs.send(
        EMAILJS_CONFIG.serviceId,
        EMAILJS_CONFIG.templateId,
        templateParams
    );

    console.log('✅ Verification email sent');
    return resp;
}

// -----------------------------
// VERIFICATION CODE SYSTEM (for registration only)
// -----------------------------
async function storeVerificationCode(email, code) {
    try {
        const codeData = {
            code: code,
            email: email,
            createdAt: Timestamp.now(),
            expiresAt: Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000)), // 10 minutes
            used: false
        };

        const codeRef = doc(db, "verificationCodes", email);
        await setDoc(codeRef, codeData, { merge: true });
        console.log('✅ Verification code stored');
        return true;
    } catch (error) {
        console.error('❌ Error storing verification code:', error);
        throw error;
    }
}

async function sendVerificationCode(email) {
    let code = '';
    try {
        console.log('📧 Sending verification code to:', email);
        code = Math.floor(100000 + Math.random() * 900000).toString();
        console.log('🔑 Generated code:', code);

        await storeVerificationCode(email, code);
        await sendEmailViaEmailJS(email, code);

        console.log('✅ Verification code sent successfully');
        return true;
    } catch (error) {
        console.error('❌ Error sending verification code:', error);

        // Fallback: show code in alert
        if (code) {
            alert(`Verification Code: ${code}\n\nEmail delivery failed — use this code to verify.`);
        }
        return true;
    }
}

async function verifyCode(email, enteredCode) {
    try {
        console.log('🔍 Verifying code for:', email);

        const codeRef = doc(db, "verificationCodes", email);
        const codeSnap = await getDoc(codeRef);

        if (!codeSnap.exists()) {
            throw new Error('Verification code not found or expired');
        }

        const codeData = codeSnap.data();
        const now = Timestamp.now();

        if (now.seconds > codeData.expiresAt.seconds) {
            await deleteDoc(codeRef);
            throw new Error('Verification code has expired');
        }

        if (codeData.code !== enteredCode) {
            throw new Error('Invalid verification code');
        }

        if (codeData.used) {
            throw new Error('Verification code has already been used');
        }

        await updateDoc(codeRef, {
            used: true,
            usedAt: Timestamp.now()
        });

        console.log('✅ Verification code is valid');
        return true;
    } catch (error) {
        console.error('❌ Error verifying code:', error);
        throw error;
    }
}

// -----------------------------
// REGISTRATION FLOW (WITH verification)
// -----------------------------
async function registerUser(email, password, userData) {
    try {
        console.log('👤 Attempting registration:', email);

        if (!email || !password || !userData) {
            throw new Error('Missing required registration data');
        }

        const cleanEmail = email.trim().toLowerCase();

        // Check if user already exists
        try {
            const methods = await fetchSignInMethodsForEmail(auth, cleanEmail);
            if (methods && methods.length > 0) {
                throw new Error('User already exists with this email. Please login instead.');
            }
        } catch (err) {
            console.warn('⚠️ fetchSignInMethodsForEmail warning:', err);
        }

        // Send verification code via EmailJS
        await sendVerificationCode(cleanEmail);

        // Save temporary registration data
        try {
            const tempUserRef = doc(db, "tempUsers", cleanEmail);
            await setDoc(tempUserRef, {
                username: userData.username || '',
                firstName: userData.firstName || '',
                lastName: userData.lastName || '',
                email: cleanEmail,
                password: password, // Store temporarily
                createdAt: Timestamp.now()
            }, { merge: true });
            console.log('💾 Temp user data stored');
        } catch (fsErr) {
            console.error('❌ Firestore error storing temp data:', fsErr);
            throw new Error('Failed to save registration data. Please try again.');
        }

        // Redirect to verification page
        const verificationUrl = `verification.html?email=${encodeURIComponent(cleanEmail)}`;
        window.location.href = verificationUrl;
        return true;
    } catch (error) {
        console.error('❌ registerUser error:', error);
        if (error.message?.includes('already exists')) {
            throw new Error('An account with this email already exists. Please login instead.');
        }
        throw error;
    }
}

async function completeRegistration(email, code) {
    try {
        console.log('🔧 [DEBUG-1] Starting completeRegistration for:', email);

        // 1. Verify code
        console.log('🔧 [DEBUG-2] Verifying code...');
        await verifyCode(email, code);
        console.log('✅ [DEBUG-3] Code verification passed');

        // 2. Retrieve temp user data
        console.log('🔧 [DEBUG-4] Retrieving temp user data...');
        const tempUserRef = doc(db, "tempUsers", email);
        const tempSnap = await getDoc(tempUserRef);

        if (!tempSnap.exists()) {
            console.error('❌ [DEBUG-5] Temp user data not found for email:', email);
            throw new Error('Registration data not found. Please start over.');
        }

        const userData = tempSnap.data();
        console.log('🔧 [DEBUG-6] Temp user data found:', userData);

        const password = userData.password;
        if (!password) {
            console.error('❌ [DEBUG-7] No password in temp data');
            throw new Error('Registration data incomplete. Please start over.');
        }
        console.log('🔧 [DEBUG-8] Password retrieved');

        // 3. Create Firebase Auth user
        console.log('🔥 [DEBUG-9] Creating Firebase Auth user...');
        console.log('🔧 [DEBUG-10] Using email:', email, 'password length:', password.length);

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        console.log('✅ [DEBUG-11] Firebase Auth user created:', user.uid);
        console.log('🔧 [DEBUG-12] User email verified status:', user.emailVerified);

        // 4. Create user document in Firestore with Firebase UID as document ID
        console.log('📝 [DEBUG-13] Creating user document in Firestore...');
        // ✅ CRITICAL FIX: Use Firebase UID as document ID
        const userRef = doc(db, "users", user.uid);

        const userDocData = {
            // Essential identifiers
            uid: user.uid, // Store Firebase UID in the document too
            email: user.email,
            username: userData.username || user.email.split('@')[0],
            first_name: userData.firstName || '',
            last_name: userData.lastName || '',
            
            // Verification and approval fields
            is_verified: true,
            email_verified: true,
            approval_status: "pending",
            verification_submitted: true,
            admin_approved: false,
            admin_reviewed: false,
            
            // Timestamps
            created_at: Timestamp.now(),
            updated_at: Timestamp.now(),
            registration_method: 'email'
        };

        console.log('🔧 [DEBUG-14] User document data to save:', userDocData);

        await setDoc(userRef, userDocData);
        console.log('✅ [DEBUG-15] User document created in Firestore with UID as document ID');

        // 5. Verify the document was actually created
        console.log('🔍 [DEBUG-16] Verifying Firestore document was created...');
        const verifyDoc = await getDoc(userRef);
        if (verifyDoc.exists()) {
            console.log('✅ [DEBUG-17] Firestore document verified:', verifyDoc.data());
        } else {
            console.error('❌ [DEBUG-18] Firestore document NOT found after creation!');
        }

        // 6. Cleanup temp data
        console.log('🧹 [DEBUG-19] Cleaning up temporary data...');
        await deleteDoc(tempUserRef);
        await deleteDoc(doc(db, "verificationCodes", email));
        console.log('✅ [DEBUG-20] Temporary data cleaned up');

        console.log('🎉 [DEBUG-21] REGISTRATION COMPLETED SUCCESSFULLY!');

        // Wait a moment before redirect to ensure everything is saved
        setTimeout(() => {
            alert('✅ Registration successful! You are now logged in.');
            window.location.href = 'Dashboard/dashboard.html';
        }, 1000);

        return user;
    } catch (error) {
        console.error('❌ [DEBUG-ERROR] completeRegistration FAILED:');
        console.error('❌ Error code:', error.code);
        console.error('❌ Error message:', error.message);
        console.error('❌ Full error:', error);

        if (error.code === 'auth/email-already-in-use') {
            throw new Error('This email is already registered. Please login instead.');
        } else if (error.code === 'auth/weak-password') {
            throw new Error('Password is too weak. Please use a stronger password.');
        } else if (error.code === 'auth/invalid-email') {
            throw new Error('Please enter a valid email address.');
        } else if (error.code === 'auth/operation-not-allowed') {
            throw new Error('Email/password accounts are not enabled. Please contact support.');
        }

        throw error;
    }
}

// -----------------------------
// LOGIN FLOW (NO verification required)
// -----------------------------
async function loginUser(email, password) {
    try {
        console.log('🔑 Login attempt:', email);

        if (!email || !password) {
            throw new Error('Please fill in all fields');
        }

        const cleanEmail = email.trim().toLowerCase();

        await setPersistence(auth, browserLocalPersistence);

        const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
        const user = userCredential.user;

        console.log('✅ Login successful:', user.uid);

        // ✅ CRITICAL FIX: Always use Firebase UID as document ID
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            // Update existing user
            await updateDoc(userDocRef, {
                last_login: Timestamp.now(),
                updated_at: Timestamp.now()
            });
        } else {
            // ✅ CRITICAL FIX: Create new user with Firebase UID as document ID
            await setDoc(userDocRef, {
                uid: user.uid, // Store UID in document
                email: user.email,
                username: user.email.split('@')[0],
                first_name: '',
                last_name: '',
                is_verified: true,
                email_verified: user.emailVerified || false,
                approval_status: "pending",
                verification_submitted: false,
                admin_approved: false,
                admin_reviewed: false,
                created_at: Timestamp.now(),
                updated_at: Timestamp.now(),
                last_login: Timestamp.now(),
                registration_method: 'email'
            });
        }

        window.location.href = 'Dashboard/dashboard.html';

    } catch (error) {
        console.error('❌ Login error:', error);
        throw error;
    }
}

// ✅ FIXED: Google Login with Firebase UID as document ID
async function loginWithGoogle() {
    try {
        console.log('🔐 Google sign-in...');

        await setPersistence(auth, browserLocalPersistence);

        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        console.log('✅ Google login:', user.email);

        // ✅ CRITICAL FIX: Use Firebase UID as document ID
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            // Update existing user
            await updateDoc(userDocRef, {
                last_login: Timestamp.now(),
                updated_at: Timestamp.now()
            });
        } else {
            // ✅ CRITICAL FIX: Create new user with Firebase UID as document ID
            await setDoc(userDocRef, {
                uid: user.uid, // Store UID in document
                email: user.email,
                username: user.displayName || user.email.split('@')[0],
                first_name: user.displayName?.split(' ')[0] || '',
                last_name: user.displayName?.split(' ')[1] || '',
                is_verified: true,
                email_verified: true,
                approval_status: "pending",
                verification_submitted: true,
                admin_approved: false,
                admin_reviewed: false,
                photo_url: user.photoURL || null,
                created_at: Timestamp.now(),
                updated_at: Timestamp.now(),
                last_login: Timestamp.now(),
                registration_method: 'google'
            });
        }

        // Go directly to dashboard
        window.location.href = 'Dashboard/dashboard.html';
    } catch (error) {
        console.error('❌ Google login error:', error);
        alert('Google sign-in failed: ' + error.message);
    }
}

// Password Reset
async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        alert('Password reset email sent! Check your inbox.');
    } catch (error) {
        console.error('❌ Password reset error:', error);
        alert('Error: ' + error.message);
    }
}

// Auth State Listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log('✅ User signed in:', user.email);
    } else {
        console.log('🔒 No user signed in');
    }
});

// Helper functions
function clearRegisterForm() {
    const fields = ['registerEmail', 'registerUsername', 'registerPassword', 'confirmPassword'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

function clearLoginForm() {
    const fields = ['loginEmail', 'loginPassword'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}
// -----------------------------
// COMPLETE PROFILE MANAGEMENT FUNCTIONS
// -----------------------------

// Get current user's complete profile data
async function getCompleteUserProfile() {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('No user logged in');
        }

        console.log('📥 Fetching complete profile for:', user.uid);

        // Get user document
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
            throw new Error('User profile not found');
        }
        
        const userData = userDoc.data();
        console.log('✅ User data loaded:', userData);

        // Get personal information
        let personalInfo = {};
        const personalQuery = query(
            collection(db, "personalInfo"),
            where("user_id", "==", user.uid)
        );
        const personalSnapshot = await getDocs(personalQuery);
        
        if (!personalSnapshot.empty) {
            personalInfo = personalSnapshot.docs[0].data();
            console.log('✅ Personal info loaded:', personalInfo);
        }

        // Get motorcycle information
        let vehicleInfo = {};
        const vehicleQuery = query(
            collection(db, "motorInfo"),
            where("user_id", "==", user.uid)
        );
        const vehicleSnapshot = await getDocs(vehicleQuery);
        
        if (!vehicleSnapshot.empty) {
            vehicleInfo = vehicleSnapshot.docs[0].data();
            console.log('✅ Vehicle info loaded:', vehicleInfo);
        }

        // Get counts
        const [parkingCount, violationsCount] = await Promise.all([
            getCollectionCount("parkingHistory", user.uid),
            getCollectionCount("violations", user.uid)
        ]);

        return {
            user: userData,
            personal: personalInfo,
            vehicle: vehicleInfo,
            counts: {
                parkings: parkingCount,
                violations: violationsCount,
                vehicles: vehicleSnapshot.empty ? 0 : 1
            }
        };

    } catch (error) {
        console.error('❌ Error getting complete profile:', error);
        throw error;
    }
}

// Helper function to get collection count
async function getCollectionCount(collectionName, userId) {
    try {
        const q = query(
            collection(db, collectionName),
            where("user_id", "==", userId)
        );
        const snapshot = await getDocs(q);
        return snapshot.size;
    } catch (error) {
        console.error(`❌ Error counting ${collectionName}:`, error);
        return 0;
    }
}

// Update personal information with all fields
async function updatePersonalInfo(personalData) {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('No user logged in');
        }

        // Get existing personal info
        const personalQuery = query(
            collection(db, "personalInfo"),
            where("user_id", "==", user.uid)
        );
        const personalSnapshot = await getDocs(personalQuery);

        const dataWithTimestamp = {
            ...personalData,
            updated_at: Timestamp.now()
        };

        if (!personalSnapshot.empty) {
            // Update existing document
            const docId = personalSnapshot.docs[0].id;
            const docRef = doc(db, "personalInfo", docId);
            await updateDoc(docRef, dataWithTimestamp);
        } else {
            // Create new document
            dataWithTimestamp.user_id = user.uid;
            dataWithTimestamp.created_at = Timestamp.now();
            await addDoc(collection(db, "personalInfo"), dataWithTimestamp);
        }

        console.log('✅ Personal info updated');
        return true;
    } catch (error) {
        console.error('❌ Error updating personal info:', error);
        throw error;
    }
}

// Update motorcycle information
async function updateVehicleInfo(vehicleData) {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('No user logged in');
        }

        // Get existing vehicle info
        const vehicleQuery = query(
            collection(db, "motorInfo"),
            where("user_id", "==", user.uid)
        );
        const vehicleSnapshot = await getDocs(vehicleQuery);

        const dataWithTimestamp = {
            ...vehicleData,
            updated_at: Timestamp.now()
        };

        if (!vehicleSnapshot.empty) {
            // Update existing document
            const docId = vehicleSnapshot.docs[0].id;
            const docRef = doc(db, "motorInfo", docId);
            await updateDoc(docRef, dataWithTimestamp);
        } else {
            // Create new document
            dataWithTimestamp.user_id = user.uid;
            dataWithTimestamp.created_at = Timestamp.now();
            await addDoc(collection(db, "motorInfo"), dataWithTimestamp);
        }

        console.log('✅ Vehicle info updated');
        return true;
    } catch (error) {
        console.error('❌ Error updating vehicle info:', error);
        throw error;
    }
}

// Submit profile for admin approval
async function submitProfileForApproval() {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('No user logged in');
        }

        // Check if profile is complete
        const isComplete = await isProfileComplete();
        if (!isComplete) {
            throw new Error('Please complete all profile information before submitting');
        }

        // Update user document
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
            verification_submitted: true,
            approval_status: "pending",
            submitted_at: Timestamp.now(),
            updated_at: Timestamp.now()
        });

        console.log('✅ Profile submitted for admin approval');
        return true;
    } catch (error) {
        console.error('❌ Error submitting profile:', error);
        throw error;
    }
}

// Check if profile is complete for submission
async function isProfileComplete() {
    try {
        const user = auth.currentUser;
        if (!user) return false;

        // Get personal info
        const personalQuery = query(
            collection(db, "personalInfo"),
            where("user_id", "==", user.uid)
        );
        const personalSnapshot = await getDocs(personalQuery);
        
        // Get vehicle info
        const vehicleQuery = query(
            collection(db, "motorInfo"),
            where("user_id", "==", user.uid)
        );
        const vehicleSnapshot = await getDocs(vehicleQuery);

        if (personalSnapshot.empty || vehicleSnapshot.empty) {
            return false;
        }

        const personalData = personalSnapshot.docs[0].data();
        const vehicleData = vehicleSnapshot.docs[0].data();

        // Required personal fields
        const requiredPersonal = [
            'first_name', 'last_name', 'contact_number', 
            'course', 'year_level', 'section'
        ];
        
        // Required vehicle fields
        const requiredVehicle = [
            'plate_number', 'license_number', 'motorcycle_brand',
            'motorcycle_model'
        ];

        const hasAllPersonal = requiredPersonal.every(field => 
            personalData[field] && personalData[field].toString().trim() !== ''
        );
        
        const hasAllVehicle = requiredVehicle.every(field => 
            vehicleData[field] && vehicleData[field].toString().trim() !== ''
        );

        return hasAllPersonal && hasAllVehicle;
    } catch (error) {
        console.error('❌ Error checking profile completion:', error);
        return false;
    }
}

// Get optimized QR code data
async function getOptimizedQRData() {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('No user logged in');
        }

        // Get user document
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists() || !userDoc.data().admin_approved) {
            return null;
        }

        // Get personal info
        const personalQuery = query(
            collection(db, "personalInfo"),
            where("user_id", "==", user.uid)
        );
        const personalSnapshot = await getDocs(personalQuery);
        
        // Get vehicle info
        const vehicleQuery = query(
            collection(db, "motorInfo"),
            where("user_id", "==", user.uid)
        );
        const vehicleSnapshot = await getDocs(vehicleQuery);

        const personalData = personalSnapshot.empty ? {} : personalSnapshot.docs[0].data();
        const vehicleData = vehicleSnapshot.empty ? {} : vehicleSnapshot.docs[0].data();

        // ✅ OPTIMIZED QR DATA - Shorter keys, essential info only
        const qrData = {
            // Essential identifiers (short keys)
            uid: user.uid, // Firebase UID
            fn: personalData.first_name || '', // First name
            ln: personalData.last_name || '', // Last name
            c: personalData.course || '', // Course
            pl: vehicleData.plate_number || '', // Plate number
            ts: Date.now() // Timestamp for freshness
        };

        console.log('📋 Optimized QR Data:', qrData);
        return qrData;
    } catch (error) {
        console.error('❌ Error getting QR data:', error);
        throw error;
    }
}

// Export functions - MAKE SURE ALL ARE INCLUDED
export {
    app,
    auth,
    db,
    registerUser,
    loginUser,
    loginWithGoogle,
    resetPassword,
    signOut,
    completeRegistration,
    verifyCode,
    sendVerificationCode,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    addDoc,
    where,
    getDocs,
    onSnapshot,
    Timestamp,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    getCompleteUserProfile,
    updatePersonalInfo,
    updateVehicleInfo,
    submitProfileForApproval,
    isProfileComplete,
    getOptimizedQRData,
    getCollectionCount
};

// Global functions
window.registerUser = registerUser;
window.loginUser = loginUser;
window.loginWithGoogle = loginWithGoogle;
window.resetPassword = resetPassword;
window.completeRegistration = completeRegistration;
window.verifyCode = verifyCode;
window.clearRegisterForm = clearRegisterForm;
window.clearLoginForm = clearLoginForm;

// Initialize EmailJS for registration
document.addEventListener('DOMContentLoaded', function () {
    initializeEmailJS();
    console.log('✅ ParkQueue loaded - Verification for registration only');
});