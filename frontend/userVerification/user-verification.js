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
    this.closeSuccessBtn = document.getElementById("closeSuccess");

    // Add rejection message container to HTML first
    this.addRejectionContainer();
    this.rejectedMessage = document.getElementById("rejectedMessage");

    this.currentUser = null;
    this.userData = null;
    this.setupEventListeners();
    this.checkAuthState();
  }

  addRejectionContainer() {
    // Add rejection message container after pendingApproval div
    const pendingApproval = document.getElementById("pendingApproval");
    if (pendingApproval && !document.getElementById("rejectedMessage")) {
      const rejectedMessage = document.createElement("div");
      rejectedMessage.id = "rejectedMessage";
      rejectedMessage.className = "verification-modal";
      rejectedMessage.style.display = "none";
      rejectedMessage.innerHTML = `
        <div class="rejection-content">
          <div class="rejection-icon">❌</div>
          <h3>Account Rejected</h3>
          <div class="rejection-reason">
            <h4>Reason for Rejection:</h4>
            <p id="rejectionReasonText">No reason provided</p>
          </div>
          <p class="rejection-instruction">
            Please review the reason above and update your information accordingly.
          </p>
          <div class="rejection-actions">
            <button id="updateInfoBtn" class="update-btn">Update Information</button>
            <button onclick="logout()" class="logout-btn">Logout</button>
          </div>
        </div>
      `;
      pendingApproval.parentNode.insertBefore(rejectedMessage, pendingApproval.nextSibling);
    }
  }

  setupEventListeners() {
    if (this.form) {
      this.form.addEventListener("submit", (e) => this.handleFormSubmission(e));
    }

    if (this.closeSuccessBtn) {
      this.closeSuccessBtn.addEventListener("click", () =>
        this.closeSuccessMessage()
      );
    }

    // Show/hide other document type input
    const additionalDocumentType = document.getElementById(
      "additionalDocumentType"
    );
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

    // Add event listener for update info button
    document.addEventListener("click", (e) => {
      if (e.target.id === "updateInfoBtn") {
        this.showUpdateForm();
      }
    });
  }

  async checkAuthState() {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        this.currentUser = user;
        console.log("User signed in:", user.email);
        
        // Get user data from users collection
        const userDoc = await getDoc(doc(db, "users", user.uid));
        this.userData = userDoc.exists() ? userDoc.data() : null;
        
        await this.checkVerificationStatus(user);
      } else {
        console.log("No user signed in - redirecting to login");
        window.location.href = "../Login&Register.html";
      }
    });
  }

  async checkVerificationStatus(user) {
    try {
      // Check if user is already approved
      if (this.userData?.admin_approved === true) {
        console.log("User already approved - redirecting to dashboard");
        window.location.href = "../Dashboard/dashboard.html";
        return;
      }

      // Check if user was rejected
      if (this.userData?.approval_status === "rejected") {
        console.log("User account was rejected");
        this.showRejectionMessage();
        return;
      }

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
        console.log(
          "User already submitted verification - showing pending message"
        );
        
        // Check if user is actually pending or if they need to update
        if (this.userData?.approval_status === "pending") {
          this.showPendingMessage();
        } else {
          // If no approval_status but has info, assume pending
          this.showPendingMessage();
        }
        return;
      }

      // If user has no info and is not rejected, show verification form
      this.showVerificationForm();

    } catch (error) {
      console.error("Error checking verification status:", error);
      this.showVerificationForm();
    }
  }

  showRejectionMessage() {
    this.hideAllModals();
    
    // Display rejection reason
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
    
    // Load existing data into form if available
    this.loadExistingData();
  }

  async loadExistingData() {
    try {
      if (!this.currentUser) return;

      // Load personal info
      const personalInfoQuery = await getDocs(
        query(collection(db, "personalInfo"), where("user_id", "==", this.currentUser.uid))
      );
      
      if (!personalInfoQuery.empty) {
        const personalInfo = personalInfoQuery.docs[0].data();
        document.getElementById("firstName").value = personalInfo.first_name || "";
        document.getElementById("lastName").value = personalInfo.last_name || "";
        document.getElementById("middleName").value = personalInfo.middle_name || "";
        document.getElementById("contactNumber").value = personalInfo.contact_number || "";
        document.getElementById("address").value = personalInfo.address || "";
        
        if (personalInfo.date_of_birth) {
          const dobDate = personalInfo.date_of_birth.toDate();
          document.getElementById("dateOfBirth").value = dobDate.toISOString().split('T')[0];
        }
      }

      // Load motor info
      const motorInfoQuery = await getDocs(
        query(collection(db, "motorInfo"), where("user_id", "==", this.currentUser.uid))
      );
      
      if (!motorInfoQuery.empty) {
        const motorInfo = motorInfoQuery.docs[0].data();
        document.getElementById("brand").value = motorInfo.brand || "";
        document.getElementById("model").value = motorInfo.model || "";
        document.getElementById("plateNumber").value = motorInfo.plate_number || "";
        
        if (motorInfo.registration_date) {
          const regDate = motorInfo.registration_date.toDate();
          document.getElementById("registrationDate").value = regDate.toISOString().split('T')[0];
        }
      }

      // Load documents
      const documentsQuery = await getDocs(
        query(collection(db, "documents"), where("user_id", "==", this.currentUser.uid))
      );
      
      if (!documentsQuery.empty) {
        const docs = documentsQuery.docs.map(doc => doc.data());
        
        // Find license document
        const licenseDoc = docs.find(d => 
          d.document_type === "Driver's License" || d.document_type === "Student Permit"
        );
        if (licenseDoc) {
          document.getElementById("licenseDocumentType").value = licenseDoc.document_type;
          document.getElementById("licenseDocument").value = licenseDoc.document_url || "";
        }

        // Find registration document
        const regDoc = docs.find(d => 
          d.document_type.includes("Registration") || d.document_type === "OR/CR"
        );
        if (regDoc) {
          document.getElementById("registrationDocumentType").value = regDoc.document_type;
          document.getElementById("registrationDocument").value = regDoc.document_url || "";
        }

        // Find additional document
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
            // Note: You might want to store the actual type in a separate field
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
      // Personal Information
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      middleName: formData.get("middleName"),
      dateOfBirth: formData.get("dateOfBirth"),
      contactNumber: formData.get("contactNumber"),
      address: formData.get("address"),

      // Motor Information
      brand: formData.get("brand"),
      model: formData.get("model"),
      plateNumber: formData.get("plateNumber"),
      registrationDate: formData.get("registrationDate"),

      // Document Information
      licenseDocumentType: formData.get("licenseDocumentType"),
      licenseDocument: formData.get("licenseDocument"),
      registrationDocumentType: formData.get("registrationDocumentType"),
      registrationDocument: formData.get("registrationDocument"),
      additionalDocumentType: formData.get("additionalDocumentType"),
      additionalDocument: formData.get("additionalDocument"),
      otherDocumentType: formData.get("otherDocumentType"),
    };

    // Validate required fields
    if (
      !verificationData.firstName ||
      !verificationData.lastName ||
      !verificationData.dateOfBirth ||
      !verificationData.contactNumber ||
      !verificationData.address ||
      !verificationData.brand ||
      !verificationData.model ||
      !verificationData.plateNumber ||
      !verificationData.licenseDocumentType ||
      !verificationData.licenseDocument ||
      !verificationData.registrationDocumentType ||
      !verificationData.registrationDocument
    ) {
      alert("Please fill in all required fields.");
      return;
    }

    // Validate Google Drive URLs
    if (!this.isValidGoogleDriveUrl(verificationData.licenseDocument)) {
      alert("Please provide a valid Google Drive link for Driver's License.");
      return;
    }

    if (!this.isValidGoogleDriveUrl(verificationData.registrationDocument)) {
      alert("Please provide a valid Google Drive link for Motor Registration.");
      return;
    }

    if (
      verificationData.additionalDocument &&
      !this.isValidGoogleDriveUrl(verificationData.additionalDocument)
    ) {
      alert(
        "Please provide a valid Google Drive link for additional document."
      );
      return;
    }

    this.setLoadingState(true);

    try {
      // Delete existing data if updating
      await this.deleteExistingData();
      
      // Submit new data
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
      // Delete personal info
      const personalInfoQuery = await getDocs(
        query(collection(db, "personalInfo"), where("user_id", "==", this.currentUser.uid))
      );
      for (const doc of personalInfoQuery.docs) {
        await deleteDoc(doc.ref);
      }

      // Delete motor info
      const motorInfoQuery = await getDocs(
        query(collection(db, "motorInfo"), where("user_id", "==", this.currentUser.uid))
      );
      for (const doc of motorInfoQuery.docs) {
        await deleteDoc(doc.ref);
      }

      // Delete documents
      const documentsQuery = await getDocs(
        query(collection(db, "documents"), where("user_id", "==", this.currentUser.uid))
      );
      for (const doc of documentsQuery.docs) {
        await deleteDoc(doc.ref);
      }

      console.log("✅ Existing data deleted");
    } catch (error) {
      console.error("Error deleting existing data:", error);
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
      middle_name: verificationData.middleName || "",
      date_of_birth: Timestamp.fromDate(new Date(verificationData.dateOfBirth)),
      contact_number: verificationData.contactNumber,
      address: verificationData.address,
      user_id: this.currentUser.uid,
      created_at: timestamp,
      updated_at: timestamp,
    };

    await addDoc(collection(db, "personalInfo"), personalInfoData);
    console.log("✅ Personal information saved");

    // 2. Save to motorInfo collection
    const motorInfoData = {
      brand: verificationData.brand,
      model: verificationData.model,
      plate_number: verificationData.plateNumber,
      registration_date: verificationData.registrationDate
        ? Timestamp.fromDate(new Date(verificationData.registrationDate))
        : timestamp,
      user_id: this.currentUser.uid,
      created_at: timestamp,
      updated_at: timestamp,
    };

    await addDoc(collection(db, "motorInfo"), motorInfoData);
    console.log("✅ Motor information saved");

    // 3. Save documents to documents collection
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

    // Add additional document if provided
    if (verificationData.additionalDocument) {
      const docType =
        verificationData.additionalDocumentType === "Other"
          ? verificationData.otherDocumentType
          : verificationData.additionalDocumentType;

      documentsToSave.push({
        document_type: docType,
        document_url: verificationData.additionalDocument,
        user_id: this.currentUser.uid,
        uploaded_at: timestamp,
        verified: false,
      });
    }

    // Save all documents
    for (const docData of documentsToSave) {
      await addDoc(collection(db, "documents"), docData);
    }
    console.log("✅ Documents saved");

    // 4. Update users collection with verification status
    const userUpdateData = {
      verification_submitted: true,
      verification_submitted_at: timestamp,
      admin_approved: false,
      admin_reviewed: false,
      approval_status: "pending", // Reset to pending
      rejection_reason: "", // Clear rejection reason
      rejected_at: null, // Clear rejection timestamp
      updated_at: timestamp,
    };

    await setDoc(doc(db, "users", this.currentUser.uid), userUpdateData, {
      merge: true,
    });
    console.log("✅ User verification status updated");
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
    // Show pending message after submission
    this.showPendingMessage();
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new UserVerification();
});

// Add logout function for the verification page
window.logout = async function () {
  try {
    await signOut(auth);
    window.location.href = "../Login&Register.html";
  } catch (error) {
    console.error("Logout error:", error);
  }
};