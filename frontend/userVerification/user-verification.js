import { 
    auth, 
    db, 
    doc, 
    setDoc, 
    getDoc,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    onAuthStateChanged,
    Timestamp,
    signOut 
} from '../firebase.js';

class UserVerification {
    constructor() {
        this.form = document.getElementById('verificationForm');
        this.submitButton = document.getElementById('submitVerification');
        this.successMessage = document.getElementById('successMessage');
        this.closeSuccessBtn = document.getElementById('closeSuccess');
        
        this.currentUser = null;
        this.setupEventListeners();
        this.checkAuthState();
    }

    setupEventListeners() {
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleFormSubmission(e));
        }
        
        if (this.closeSuccessBtn) {
            this.closeSuccessBtn.addEventListener('click', () => this.closeSuccessMessage());
        }

        // Show/hide other document type input
        const additionalDocumentType = document.getElementById('additionalDocumentType');
        if (additionalDocumentType) {
            additionalDocumentType.addEventListener('change', (e) => {
                const otherInput = document.getElementById('otherDocumentType');
                if (e.target.value === 'Other') {
                    otherInput.style.display = 'block';
                } else {
                    otherInput.style.display = 'none';
                    otherInput.value = '';
                }
            });
        }
    }

    checkAuthState() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.currentUser = user;
                console.log('User signed in:', user.email);
                await this.checkIfAlreadyVerified(user);
            } else {
                console.log('No user signed in - redirecting to login');
                window.location.href = '../Login&Register.html';
            }
        });
    }

    async checkIfAlreadyVerified(user) {
        try {
            // Check if user already has personal info submitted
            const personalInfoQuery = await getDocs(
                query(collection(db, "personalInfo"), where("user_id", "==", user.uid))
            );
            
            // Check if user already has motor info submitted  
            const motorInfoQuery = await getDocs(
                query(collection(db, "motorInfo"), where("user_id", "==", user.uid))
            );

            const hasPersonalInfo = !personalInfoQuery.empty;
            const hasMotorInfo = !motorInfoQuery.empty;

            if (hasPersonalInfo && hasMotorInfo) {
                console.log('User already submitted verification - showing pending message');
                this.showPendingMessage();
                return;
            }

            // Check if user is already approved in users collection
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists() && userDoc.data().admin_approved === true) {
                console.log('User already approved - redirecting to dashboard');
                window.location.href = '../Dashboard/dashboard.html';
                return;
            }
            
        } catch (error) {
            console.error('Error checking verification status:', error);
        }
    }

    showPendingMessage() {
        if (this.form) {
            this.form.innerHTML = `
                <div class="pending-approval">
                    <h3>Pending Approval</h3>
                    <p>Your information has been submitted and is awaiting admin approval.</p>
                    <p>You will receive an email notification once your account is verified.</p>
                    <p>You cannot access the dashboard until your account is approved.</p>
                    <button onclick="logout()" class="logout-btn">Logout</button>
                </div>
            `;
        }
    }

    async handleFormSubmission(e) {
        e.preventDefault();
        
        if (!this.currentUser) {
            alert('Please sign in to submit verification.');
            return;
        }

        const formData = new FormData(this.form);
        const verificationData = {
            // Personal Information
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'), 
            middleName: formData.get('middleName'),
            dateOfBirth: formData.get('dateOfBirth'),
            contactNumber: formData.get('contactNumber'),
            address: formData.get('address'),
            
            // Motor Information
            brand: formData.get('brand'),
            model: formData.get('model'),
            plateNumber: formData.get('plateNumber'),
            registrationDate: formData.get('registrationDate'),
            
            // Document Information
            licenseDocumentType: formData.get('licenseDocumentType'),
            licenseDocument: formData.get('licenseDocument'),
            registrationDocumentType: formData.get('registrationDocumentType'),
            registrationDocument: formData.get('registrationDocument'),
            additionalDocumentType: formData.get('additionalDocumentType'),
            additionalDocument: formData.get('additionalDocument'),
            otherDocumentType: formData.get('otherDocumentType')
        };

        // Validate required fields
        if (!verificationData.firstName || !verificationData.lastName || 
            !verificationData.dateOfBirth || !verificationData.contactNumber ||
            !verificationData.address || !verificationData.brand || 
            !verificationData.model || !verificationData.plateNumber ||
            !verificationData.licenseDocumentType || !verificationData.licenseDocument ||
            !verificationData.registrationDocumentType || !verificationData.registrationDocument) {
            alert('Please fill in all required fields.');
            return;
        }

        // Validate Google Drive URLs
        if (!this.isValidGoogleDriveUrl(verificationData.licenseDocument)) {
            alert('Please provide a valid Google Drive link for Driver\'s License.');
            return;
        }

        if (!this.isValidGoogleDriveUrl(verificationData.registrationDocument)) {
            alert('Please provide a valid Google Drive link for Motor Registration.');
            return;
        }

        if (verificationData.additionalDocument && !this.isValidGoogleDriveUrl(verificationData.additionalDocument)) {
            alert('Please provide a valid Google Drive link for additional document.');
            return;
        }

        this.setLoadingState(true);

        try {
            await this.submitVerificationData(verificationData);
            this.showSuccessMessage();
            
        } catch (error) {
            console.error('Error submitting verification:', error);
            alert('Failed to submit verification. Please try again.');
            this.setLoadingState(false);
        }
    }

    isValidGoogleDriveUrl(url) {
        // Basic Google Drive URL validation
        const driveRegex = /^https:\/\/drive\.google\.com\/.+/;
        return driveRegex.test(url);
    }

    async submitVerificationData(verificationData) {
        const timestamp = Timestamp.now();
        
        // 1. Save to personalInfo collection
        const personalInfoData = {
            first_name: verificationData.firstName,
            last_name: verificationData.lastName,
            middle_name: verificationData.middleName || '',
            date_of_birth: Timestamp.fromDate(new Date(verificationData.dateOfBirth)),
            contact_number: verificationData.contactNumber,
            address: verificationData.address,
            user_id: this.currentUser.uid,
            created_at: timestamp,
            updated_at: timestamp
        };

        await addDoc(collection(db, "personalInfo"), personalInfoData);
        console.log('✅ Personal information saved');

        // 2. Save to motorInfo collection  
        const motorInfoData = {
            brand: verificationData.brand,
            model: verificationData.model,
            plate_number: verificationData.plateNumber,
            registration_date: verificationData.registrationDate ? 
                Timestamp.fromDate(new Date(verificationData.registrationDate)) : timestamp,
            user_id: this.currentUser.uid,
            created_at: timestamp,
            updated_at: timestamp
        };

        await addDoc(collection(db, "motorInfo"), motorInfoData);
        console.log('✅ Motor information saved');

        // 3. Save documents to documents collection
        const documentsToSave = [
            {
                document_type: verificationData.licenseDocumentType,
                document_url: verificationData.licenseDocument,
                user_id: this.currentUser.uid,
                uploaded_at: timestamp,
                verified: false
            },
            {
                document_type: verificationData.registrationDocumentType,
                document_url: verificationData.registrationDocument,
                user_id: this.currentUser.uid,
                uploaded_at: timestamp,
                verified: false
            }
        ];

        // Add additional document if provided
        if (verificationData.additionalDocument) {
            const docType = verificationData.additionalDocumentType === 'Other' 
                ? verificationData.otherDocumentType 
                : verificationData.additionalDocumentType;
            
            documentsToSave.push({
                document_type: docType,
                document_url: verificationData.additionalDocument,
                user_id: this.currentUser.uid,
                uploaded_at: timestamp,
                verified: false
            });
        }

        // Save all documents
        for (const docData of documentsToSave) {
            await addDoc(collection(db, "documents"), docData);
        }
        console.log('✅ Documents saved');

        // 4. Update users collection with verification status
        const userUpdateData = {
            verification_submitted: true,
            verification_submitted_at: timestamp,
            admin_approved: false,
            admin_reviewed: false,
            updated_at: timestamp
        };

        await setDoc(doc(db, "users", this.currentUser.uid), userUpdateData, { merge: true });
        console.log('✅ User verification status updated');
    }

    setLoadingState(isLoading) {
        if (this.submitButton) {
            if (isLoading) {
                this.submitButton.disabled = true;
                this.submitButton.classList.add('loading');
            } else {
                this.submitButton.disabled = false;
                this.submitButton.classList.remove('loading');
            }
        }
    }

    showSuccessMessage() {
        if (this.successMessage) {
            this.successMessage.style.display = 'block';
        }
        
        if (this.form) {
            this.form.style.display = 'none';
        }
    }

    closeSuccessMessage() {
        if (this.successMessage) {
            this.successMessage.style.display = 'none';
        }
        
        // Show pending message after submission
        this.showPendingMessage();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new UserVerification();
});

// Add logout function for the verification page
window.logout = async function() {
    try {
        await signOut(auth);
        window.location.href = '../Login&Register.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
};