import { auth, db, doc, getDoc, setDoc, updateDoc, Timestamp, signOut, onAuthStateChanged } from '../firebase.js';

console.log('Dashboard loaded');

document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

async function initializeDashboard() {
    try {
        // Use onAuthStateChanged to wait for auth state
        const user = await new Promise((resolve) => {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                unsubscribe();
                resolve(user);
            });
        });

        if (!user) {
            console.log('❌ No authenticated user - redirecting to login');
            window.location.href = '../Login&Register.html';
            return;
        }

        console.log('✅ Dashboard initialized for user:', user.email, 'UID:', user.uid);
        
        // First, check if user needs verification
        const needsVerification = await checkUserVerificationStatus(user);
        
        if (needsVerification) {
            console.log('🔄 User needs verification - redirecting to verification page');
            window.location.href = '../userVerification/user-verification.html';
            return;
        }
        
        // User is verified, show dashboard content
        showDashboardContent();
        await loadUserData(user);
        
    } catch (error) {
        console.error('❌ Dashboard initialization error:', error);
        window.location.href = '../Login&Register.html';
    }
}

async function checkUserVerificationStatus(user) {
    try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
            console.log('❌ User document not found - needs verification');
            return true; // Needs verification
        }
        
        const userData = userDoc.data();
        console.log('📋 User data:', userData);
        
        // Check if admin has approved the user
        if (userData.admin_approved !== true) {
            console.log('⏳ User not approved by admin yet - needs verification');
            return true; // Needs admin approval
        }
        
        console.log('✅ User is fully verified and approved');
        return false; // User is fully verified
        
    } catch (error) {
        console.error('❌ Error checking verification status:', error);
        return true; // Assume needs verification on error
    }
}

function showDashboardContent() {
    // Hide loading, show dashboard
    const loadingState = document.getElementById('loadingState');
    const dashboardContent = document.getElementById('dashboardContent');
    
    if (loadingState) loadingState.style.display = 'none';
    if (dashboardContent) dashboardContent.style.display = 'block';
    
    // Show approved status and features
    const approvedStatus = document.getElementById('approvedStatus');
    const dashboardFeatures = document.getElementById('dashboardFeatures');
    
    if (approvedStatus) approvedStatus.style.display = 'block';
    if (dashboardFeatures) dashboardFeatures.style.display = 'grid';
    
    // Hide any verification elements
    const verificationModal = document.getElementById('verificationModal');
    const pendingStatus = document.getElementById('pendingStatus');
    
    if (verificationModal) verificationModal.style.display = 'none';
    if (pendingStatus) pendingStatus.style.display = 'none';
}

async function loadUserData(user) {
    try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            updateUserUI(userData);
        } else {
            console.log('❌ User document not found, creating one...');
            // Create user document if it doesn't exist
            await setDoc(userDocRef, {
                email: user.email,
                username: user.email.split('@')[0],
                first_name: '',
                last_name: '',
                is_verified: true,
                email_verified: user.emailVerified || false,
                created_at: Timestamp.now(),
                updated_at: Timestamp.now(),
                last_login: Timestamp.now(),
                uid: user.uid,
                admin_approved: true // Auto-approve for existing users
            });
            updateUserUI({
                email: user.email,
                username: user.email.split('@')[0]
            });
        }
    } catch (error) {
        console.error('❌ Error loading user data:', error);
    }
}

function updateUserUI(userData) {
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const userAvatar = document.getElementById('userAvatar');
    
    if (userName) {
        userName.textContent = userData.username || userData.email.split('@')[0];
    }
    if (userEmail) {
        userEmail.textContent = userData.email;
    }
    if (userAvatar) {
        userAvatar.textContent = (userData.username || userData.email[0]).toUpperCase();
    }
    
    // Update verification status in UI
    const verificationStatus = document.getElementById('verificationStatus');
    if (verificationStatus) {
        if (userData.admin_approved === true) {
            verificationStatus.textContent = 'Verified ✓';
            verificationStatus.style.color = '#4CAF50';
        } else if (userData.verification_submitted === true) {
            verificationStatus.textContent = 'Pending Approval ⏳';
            verificationStatus.style.color = '#FF9800';
        } else {
            verificationStatus.textContent = 'Not Verified ✗';
            verificationStatus.style.color = '#F44336';
        }
    }
}

// Logout function
async function logout() {
    try {
        console.log('🚪 Logging out...');
        await signOut(auth);
        // Redirect after signout completes
        window.location.href = '../Login&Register.html';
    } catch (error) {
        console.error('❌ Logout error:', error);
        alert('Logout failed: ' + error.message);
    }
}

// Make logout globally available
window.logout = logout;

// Monitor auth state changes
onAuthStateChanged(auth, (user) => {
    if (!user) {
        console.log('🔒 User signed out - monitoring auth state');
        // Don't redirect immediately, let the user manually logout or handle session expiry
    }
});