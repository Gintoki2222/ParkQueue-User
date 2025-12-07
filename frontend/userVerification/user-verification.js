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
    signOut,
    updateDoc,
    deleteDoc,
} from "../firebase.js";

class UserVerification {
    constructor() {
        this.form = document.getElementById("verificationForm");
        this.submitButton = document.getElementById("submitVerification");
        this.verificationModal = document.getElementById("verificationModal");
        this.successMessage = document.getElementById("successMessage");
        this.pendingApproval = document.getElementById("pendingApproval");
        this.rejectedMessage = document.getElementById("rejectedMessage");
        this.closeSuccessBtn = document.getElementById("closeSuccess");
        this.updateInfoBtn = document.getElementById("updateInfoBtn");

        this.currentUser = null;
        this.userData = null;
        this.setupEventListeners();
        this.checkAuthState();
    }

    setupEventListeners() {
        if (this.form) {
            this.form.addEventListener("submit", (e) => this.handleFormSubmission(e));
        }

        if (this.closeSuccessBtn) {
            this.closeSuccessBtn.addEventListener("click", () => this.closeSuccessMessage());
        }

        if (this.updateInfoBtn) {
            this.updateInfoBtn.addEventListener("click", () => this.showUpdateForm());
        }

        const additionalDocumentType = document.getElementById("additionalDocumentType");
        if (additionalDocumentType) {
            additionalDocumentType.addEventListener("change", (e) => {
                const otherInput = document.getElementById("otherDocumentType");
                if (e.target.value === "Other") {
                    otherInput.style.display = "block";
                } else {
                    otherInput.style.display = "none";
                    otherInput.value = "";
                }
            });
        }
    }

    async checkAuthState() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.currentUser = user;
                const userDoc = await getDoc(doc(db, "users", user.uid));
                this.userData = userDoc.exists() ? userDoc.data() : null;
                await this.checkVerificationStatus(user);
            } else {
                window.location.href = "../Login&Register.html";
            }
        });
    }

    async checkVerificationStatus(user) {
        try {
            if (this.userData?.admin_approved === true) {
                window.location.href = "../Dashboard/dashboard.html";
                return;
            }

            if (this.userData?.approval_status === "rejected") {
                this.showRejectionMessage();
                return;
            }

            const personalInfoQuery = await getDocs(
                query(collection(db, "personalInfo"), where("user_id", "==", user.uid))
            );

            const motorInfoQuery = await getDocs(
                query(collection(db, "motorInfo"), where("user_id", "==", user.uid))
            );

            const hasPersonalInfo = !personalInfoQuery.empty;
            const hasMotorInfo = !motorInfoQuery.empty;

            if (hasPersonalInfo && hasMotorInfo) {
                if (this.userData?.approval_status === "pending") {
                    this.showPendingMessage();
                } else {
                    this.showPendingMessage();
                }
                return;
            }

            this.showVerificationForm();
        } catch (error) {
            this.showVerificationForm();
        }
    }

    showRejectionMessage() {
        this.hideAllModals();
        const rejectionReasonText = document.getElementById("rejectionReasonText");
        if (rejectionReasonText && this.userData?.rejection_reason) {
            rejectionReasonText.textContent = this.userData.rejection_reason;
        }
        if (this.rejectedMessage) {
            this.rejectedMessage.style.display = "block";
        }
    }

    showVerificationForm() {
        this.hideAllModals();
        if (this.verificationModal) {
            this.verificationModal.style.display = "block";
        }
    }

    showPendingMessage() {
        this.hideAllModals();
        if (this.pendingApproval) {
            this.pendingApproval.style.display = "block";
        }
    }

    hideAllModals() {
        if (this.verificationModal) this.verificationModal.style.display = "none";
        if (this.successMessage) this.successMessage.style.display = "none";
        if (this.pendingApproval) this.pendingApproval.style.display = "none";
        if (this.rejectedMessage) this.rejectedMessage.style.display = "none";
    }

    showUpdateForm() {
        this.hideAllModals();
        this.showVerificationForm();
        this.loadExistingData();
    }

    async loadExistingData() {
        try {
            if (!this.currentUser) return;

            const personalInfoQuery = await getDocs(
                query(collection(db, "personalInfo"), where("user_id", "==", this.currentUser.uid))
            );
            
            if (!personalInfoQuery.empty) {
                const personalInfo = personalInfoQuery.docs[0].data();
                document.getElementById("firstName").value = personalInfo.first_name || "";
                document.getElementById("lastName").value = personalInfo.last_name || "";
                document.getElementById("middleName").value = personalInfo.middle_name || "";
                document.getElementById("studentId").value = personalInfo.student_id || "";
                document.getElementById("course").value = personalInfo.course || "";
                document.getElementById("yearLevel").value = personalInfo.year_level || "";
                document.getElementById("section").value = personalInfo.section || "";
                document.getElementById("contactNumber").value = personalInfo.contact_number || "";
                document.getElementById("address").value = personalInfo.address || "";
                
                if (personalInfo.date_of_birth) {
                    const dobDate = personalInfo.date_of_birth.toDate();
                    document.getElementById("dateOfBirth").value = dobDate.toISOString().split('T')[0];
                }
            }

            const motorInfoQuery = await getDocs(
                query(collection(db, "motorInfo"), where("user_id", "==", this.currentUser.uid))
            );
            
            if (!motorInfoQuery.empty) {
                const motorInfo = motorInfoQuery.docs[0].data();
                document.getElementById("brand").value = motorInfo.motorcycle_brand || motorInfo.brand || "";
                document.getElementById("model").value = motorInfo.motorcycle_model || motorInfo.model || "";
                document.getElementById("vehicleColor").value = motorInfo.motorcycle_color || motorInfo.color || "";
                document.getElementById("plateNumber").value = motorInfo.plate_number || "";
                document.getElementById("licenseNumber").value = motorInfo.license_number || "";
                
                if (motorInfo.license_expiry) {
                    const expiryDate = motorInfo.license_expiry.toDate();
                    document.getElementById("licenseExpiry").value = expiryDate.toISOString().split('T')[0];
                }
            }

            const documentsQuery = await getDocs(
                query(collection(db, "documents"), where("user_id", "==", this.currentUser.uid))
            );
            
            if (!documentsQuery.empty) {
                const docs = documentsQuery.docs.map(doc => doc.data());
                
                const licenseDoc = docs.find(d => 
                    d.document_type === "Driver's License" || d.document_type === "Student Permit"
                );
                if (licenseDoc) {
                    document.getElementById("licenseDocumentType").value = licenseDoc.document_type;
                    document.getElementById("licenseDocument").value = licenseDoc.document_url || "";
                }

                const regDoc = docs.find(d => 
                    d.document_type.includes("Registration") || d.document_type === "OR/CR"
                );
                if (regDoc) {
                    document.getElementById("registrationDocumentType").value = regDoc.document_type;
                    document.getElementById("registrationDocument").value = regDoc.document_url || "";
                }

                const additionalDoc = docs.find(d => 
                    d.document_type !== licenseDoc?.document_type && 
                    d.document_type !== regDoc?.document_type
                );
                if (additionalDoc) {
                    document.getElementById("additionalDocumentType").value = additionalDoc.document_type === "Other" ? 
                        "Other" : additionalDoc.document_type;
                    document.getElementById("additionalDocument").value = additionalDoc.document_url || "";
                    
                    if (additionalDoc.document_type === "Other") {
                        document.getElementById("otherDocumentType").style.display = "block";
                        document.getElementById("otherDocumentType").value = additionalDoc.document_type;
                    }
                }
            }
        } catch (error) {
            console.error("Error loading existing data:", error);
        }
    }

    async handleFormSubmission(e) {
        e.preventDefault();

        if (!this.currentUser) {
            alert("Please sign in to submit verification.");
            return;
        }

        const formData = new FormData(this.form);
        const verificationData = {
            firstName: formData.get("firstName"),
            lastName: formData.get("lastName"),
            middleName: formData.get("middleName"),
            studentId: formData.get("studentId"),
            course: formData.get("course"),
            yearLevel: formData.get("yearLevel"),
            section: formData.get("section"),
            dateOfBirth: formData.get("dateOfBirth"),
            contactNumber: formData.get("contactNumber"),
            address: formData.get("address"),
            brand: formData.get("brand"),
            model: formData.get("model"),
            vehicleColor: formData.get("vehicleColor"),
            plateNumber: formData.get("plateNumber"),
            licenseNumber: formData.get("licenseNumber"),
            licenseExpiry: formData.get("licenseExpiry"),
            licenseDocumentType: formData.get("licenseDocumentType"),
            licenseDocument: formData.get("licenseDocument"),
            registrationDocumentType: formData.get("registrationDocumentType"),
            registrationDocument: formData.get("registrationDocument"),
            additionalDocumentType: formData.get("additionalDocumentType"),
            additionalDocument: formData.get("additionalDocument"),
            otherDocumentType: formData.get("otherDocumentType"),
        };

        const requiredFields = [
            'firstName', 'lastName', 'studentId', 'course', 'yearLevel', 'section', 'dateOfBirth',
            'contactNumber', 'address', 'brand', 'model', 'vehicleColor', 'plateNumber', 'licenseNumber', 'licenseExpiry',
            'licenseDocumentType', 'licenseDocument', 'registrationDocumentType', 'registrationDocument'
        ];

        for (const field of requiredFields) {
            if (!verificationData[field]) {
                alert(`Please fill in all required fields. Missing: ${field}`);
                return;
            }
        }

        if (!this.isValidGoogleDriveUrl(verificationData.licenseDocument)) {
            alert("Please provide a valid Google Drive link for Driver's License.");
            return;
        }

        if (!this.isValidGoogleDriveUrl(verificationData.registrationDocument)) {
            alert("Please provide a valid Google Drive link for Vehicle Registration.");
            return;
        }

        if (verificationData.additionalDocument && !this.isValidGoogleDriveUrl(verificationData.additionalDocument)) {
            alert("Please provide a valid Google Drive link for additional document.");
            return;
        }

        this.setLoadingState(true);

        try {
            await this.deleteExistingData();
            await this.submitVerificationData(verificationData);
            this.showSuccessMessage();
        } catch (error) {
            console.error("Error submitting verification:", error);
            alert("Failed to submit verification. Please try again.");
            this.setLoadingState(false);
        }
    }

    async deleteExistingData() {
        try {
            const personalInfoQuery = await getDocs(
                query(collection(db, "personalInfo"), where("user_id", "==", this.currentUser.uid))
            );
            for (const doc of personalInfoQuery.docs) {
                await deleteDoc(doc.ref);
            }

            const motorInfoQuery = await getDocs(
                query(collection(db, "motorInfo"), where("user_id", "==", this.currentUser.uid))
            );
            for (const doc of motorInfoQuery.docs) {
                await deleteDoc(doc.ref);
            }

            const documentsQuery = await getDocs(
                query(collection(db, "documents"), where("user_id", "==", this.currentUser.uid))
            );
            for (const doc of documentsQuery.docs) {
                await deleteDoc(doc.ref);
            }
        } catch (error) {
            console.error("Error deleting existing data:", error);
        }
    }

    isValidGoogleDriveUrl(url) {
        const driveRegex = /^https:\/\/drive\.google\.com\/.+/;
        return driveRegex.test(url);
    }

    async submitVerificationData(verificationData) {
        const timestamp = Timestamp.now();

        const personalInfoData = {
            first_name: verificationData.firstName,
            last_name: verificationData.lastName,
            middle_name: verificationData.middleName || "",
            student_id: verificationData.studentId,
            course: verificationData.course,
            year_level: verificationData.yearLevel,
            section: verificationData.section,
            date_of_birth: Timestamp.fromDate(new Date(verificationData.dateOfBirth)),
            contact_number: verificationData.contactNumber,
            address: verificationData.address,
            user_id: this.currentUser.uid,
            created_at: timestamp,
            updated_at: timestamp,
        };

        await addDoc(collection(db, "personalInfo"), personalInfoData);

        const motorInfoData = {
            motorcycle_brand: verificationData.brand,
            motorcycle_model: verificationData.model,
            motorcycle_color: verificationData.vehicleColor,
            plate_number: verificationData.plateNumber,
            license_number: verificationData.licenseNumber,
            license_expiry: Timestamp.fromDate(new Date(verificationData.licenseExpiry)),
            user_id: this.currentUser.uid,
            created_at: timestamp,
            updated_at: timestamp,
        };

        await addDoc(collection(db, "motorInfo"), motorInfoData);

        const documentsToSave = [
            {
                document_type: verificationData.licenseDocumentType,
                document_url: verificationData.licenseDocument,
                user_id: this.currentUser.uid,
                uploaded_at: timestamp,
                verified: false,
            },
            {
                document_type: verificationData.registrationDocumentType,
                document_url: verificationData.registrationDocument,
                user_id: this.currentUser.uid,
                uploaded_at: timestamp,
                verified: false,
            },
        ];

        if (verificationData.additionalDocument) {
            const docType = verificationData.additionalDocumentType === "Other"
                ? verificationData.otherDocumentType || "Other Document"
                : verificationData.additionalDocumentType;

            documentsToSave.push({
                document_type: docType,
                document_url: verificationData.additionalDocument,
                user_id: this.currentUser.uid,
                uploaded_at: timestamp,
                verified: false,
            });
        }

        for (const docData of documentsToSave) {
            await addDoc(collection(db, "documents"), docData);
        }

        const userUpdateData = {
            verification_submitted: true,
            verification_submitted_at: timestamp,
            admin_approved: false,
            admin_reviewed: false,
            approval_status: "pending",
            rejection_reason: "",
            rejected_at: null,
            updated_at: timestamp,
        };

        await setDoc(doc(db, "users", this.currentUser.uid), userUpdateData, {
            merge: true,
        });
    }

    setLoadingState(isLoading) {
        if (this.submitButton) {
            if (isLoading) {
                this.submitButton.disabled = true;
                this.submitButton.classList.add("loading");
            } else {
                this.submitButton.disabled = false;
                this.submitButton.classList.remove("loading");
            }
        }
    }

    showSuccessMessage() {
        this.hideAllModals();
        if (this.successMessage) {
            this.successMessage.style.display = "block";
        }
    }

    closeSuccessMessage() {
        this.hideAllModals();
        this.showPendingMessage();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    new UserVerification();
});

window.logout = async function () {
    try {
        await signOut(auth);
        window.location.href = "../Login&Register.html";
    } catch (error) {
        console.error("Logout error:", error);
    }
};