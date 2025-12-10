function showError(inputId, message) {
    const input = document.getElementById(inputId);
    const inputGroup = input.parentElement;
    
    clearError(inputId);
    
    input.classList.add('input-error');
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.id = `${inputId}-error`;
    
    inputGroup.parentElement.insertBefore(errorDiv, inputGroup.nextSibling);
    
    input.style.animation = 'shake 0.5s';
    setTimeout(() => {
        input.style.animation = '';
    }, 500);
}

function clearError(inputId) {
    const input = document.getElementById(inputId);
    const errorMsg = document.getElementById(`${inputId}-error`);
    
    if (input) {
        input.classList.remove('input-error');
    }
    
    if (errorMsg) {
        errorMsg.remove();
    }
}

function clearAllErrors() {
    const errorInputs = document.querySelectorAll('.input-error');
    const errorMessages = document.querySelectorAll('.error-message');
    
    errorInputs.forEach(input => input.classList.remove('input-error'));
    errorMessages.forEach(msg => msg.remove());
}

function isMobileDevice() {
    return window.innerWidth <= 768;
}

function switchToRegister(e) {
    e.preventDefault();
    clearAllErrors();
    
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (isMobileDevice()) {
        // Simple instant swap for mobile - no animations
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        
        // Focus first input after swap
        setTimeout(() => {
            const registerEmail = document.getElementById('registerEmail');
            if (registerEmail) registerEmail.focus();
        }, 50);
    } else {
        // Desktop: keep the sliding animation
        const formContainer = document.querySelector('.form-container');
        const imageContainer = document.querySelector('.image-container');
        
        formContainer.classList.add('slide-right');
        imageContainer.classList.add('slide-left');
        
        setTimeout(() => {
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
        }, 400);
    }
}

function switchToLogin(e) {
    e.preventDefault();
    clearAllErrors();
    
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (isMobileDevice()) {
        // Simple instant swap for mobile - no animations
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
        
        // Focus first input after swap
        setTimeout(() => {
            const loginEmail = document.getElementById('loginEmail');
            if (loginEmail) loginEmail.focus();
        }, 50);
    } else {
        // Desktop: keep the sliding animation
        const formContainer = document.querySelector('.form-container');
        const imageContainer = document.querySelector('.image-container');
        
        formContainer.classList.remove('slide-right');
        imageContainer.classList.remove('slide-left');
        
        setTimeout(() => {
            registerForm.style.display = 'none';
            loginForm.style.display = 'block';
        }, 400);
    }
}

// Clean up on window resize
window.addEventListener('resize', function() {
    if (!isMobileDevice()) {
        const formContainer = document.querySelector('.form-container');
        const imageContainer = document.querySelector('.image-container');
        
        formContainer.classList.remove('slide-right', 'slide-left', 'slide-down', 'slide-up');
        imageContainer.classList.remove('slide-left', 'slide-right', 'slide-down', 'slide-up');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Remove any mobile-specific initializations that affected animations
    
    const inputs = ['loginEmail', 'loginPassword', 'registerEmail', 'registerUsername', 'registerPassword', 'confirmPassword'];
    
    inputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('input', () => {
                clearError(inputId);
            });
        }
    });

    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    
    if (loginEmail && loginPassword) {
        const handleLoginEnter = (e) => {
            if (e.key === 'Enter') {
                handleLogin();
            }
        };
        
        loginEmail.addEventListener('keypress', handleLoginEnter);
        loginPassword.addEventListener('keypress', handleLoginEnter);
    }

    const registerPassword = document.getElementById('registerPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    
    if (registerPassword && confirmPassword) {
        const handleRegisterEnter = (e) => {
            if (e.key === 'Enter') {
                handleRegistration();
            }
        };
        
        registerPassword.addEventListener('keypress', handleRegisterEnter);
        confirmPassword.addEventListener('keypress', handleRegisterEnter);
    }

    const loginEmailInput = document.getElementById('loginEmail');
    if (loginEmailInput) loginEmailInput.focus();

    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', function () {
            this.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Logging in...';
            this.disabled = true;
        });
    }
});

async function handleGoogleLogin() {
    try {
        console.log('🔐 Starting Google login...');
        clearAllErrors();
        
        if (typeof loginWithGoogle === 'function') {
            await loginWithGoogle();
        } else {
            await signInWithGoogleDirect();
        }
    } catch (error) {
        console.error('❌ Google login failed:', error);
        showError('loginEmail', 'Google login failed: ' + error.message);
    }
}

async function signInWithGoogleDirect() {
    try {
        const provider = new GoogleAuthProvider();
        
        provider.addScope('email');
        provider.addScope('profile');
        
        console.log('🔐 Starting direct Google sign-in...');
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        console.log('✅ Google authentication successful:', user.email);

        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (userDoc.exists()) {
            console.log('👤 Existing Google user, redirecting...');
            window.location.href = 'Dashboard/dashboard.html';
        } else {
            console.log('👤 New Google user, creating document...');
            await setDoc(doc(db, "users", user.uid), {
                email: user.email,
                username: user.displayName || user.email.split('@')[0],
                is_verified: true,
                email_verified: true,
                photo_url: user.photoURL || null,
                created_at: Timestamp.now(),
                updated_at: Timestamp.now(),
                uid: user.uid,
                last_login: Timestamp.now(),
                registration_method: 'google'
            });
            
            console.log('✅ Google user document created, redirecting...');
            window.location.href = 'Dashboard/dashboard.html';
        }

    } catch (error) {
        console.error('❌ Direct Google sign-in error:', error);
        
        if (error.code === 'auth/popup-closed-by-user') {
            showError('loginEmail', 'Google sign-in was cancelled.');
        } else if (error.code === 'auth/network-request-failed') {
            showError('loginEmail', 'Network error. Please check your internet connection.');
        } else {
            showError('loginEmail', 'Google sign-in failed: ' + error.message);
        }
    }
}

async function handleRegistration() {
    const email = document.getElementById('registerEmail').value;
    const username = document.getElementById('registerUsername').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    clearAllErrors();

    if (!email) {
        showError('registerEmail', 'Email is required');
        return;
    }

    if (!username) {
        showError('registerUsername', 'Username is required');
        return;
    }

    if (!password) {
        showError('registerPassword', 'Password is required');
        return;
    }

    if (!confirmPassword) {
        showError('confirmPassword', 'Please confirm your password');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showError('registerEmail', 'Please enter a valid email address');
        return;
    }

    if (password.length < 6) {
        showError('registerPassword', 'Password must be at least 6 characters');
        return;
    }

    if (password !== confirmPassword) {
        showError('confirmPassword', 'Passwords do not match');
        return;
    }

    if (username.length < 3) {
        showError('registerUsername', 'Username must be at least 3 characters');
        return;
    }

    try {
        const userData = {
            username: username,
            firstName: '',
            lastName: ''
        };

        await registerUser(email, password, userData);
    } catch (error) {
        console.error('Registration error:', error);
        
        if (error.code === 'auth/email-already-in-use') {
            showError('registerEmail', 'This email is already registered');
        } else if (error.code === 'auth/invalid-email') {
            showError('registerEmail', 'Invalid email address');
        } else if (error.code === 'auth/weak-password') {
            showError('registerPassword', 'Password is too weak');
        } else {
            showError('registerEmail', error.message || 'Registration failed');
        }
    }
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    clearAllErrors();

    if (!email) {
        showError('loginEmail', 'Email is required');
        return;
    }

    if (!password) {
        showError('loginPassword', 'Password is required');
        return;
    }

    try {
        if (typeof window.loginUser === 'function') {
            await window.loginUser(email, password);
        } else {
            throw new Error('Login system not ready. Please refresh the page.');
        }
    } catch (error) {
        console.error('Login error:', error);
        
        if (error.code === 'auth/user-not-found') {
            showError('loginEmail', 'No account found with this email');
        } else if (error.code === 'auth/wrong-password') {
            showError('loginPassword', 'Incorrect password');
        } else if (error.code === 'auth/invalid-email') {
            showError('loginEmail', 'Invalid email address');
        } else if (error.code === 'auth/user-disabled') {
            showError('loginEmail', 'This account has been disabled');
        } else if (error.code === 'auth/too-many-requests') {
            showError('loginEmail', 'Too many failed attempts. Please try again later');
        } else if (error.code === 'auth/invalid-credential') {
            showError('loginEmail', 'Invalid email or password');
            showError('loginPassword', 'Invalid email or password');
        } else {
            showError('loginEmail', error.message || 'Login failed');
        }
        
        resetLoginButton();
    }
}

function resetLoginButton() {
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.innerHTML = "Login";
    }
}

async function handleForgotPassword() {
    const email = document.getElementById('loginEmail')?.value;
    
    clearAllErrors();
    
    if (!email) {
        showError('loginEmail', 'Please enter your email address');
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showError('loginEmail', 'Please enter a valid email address');
        return;
    }
    
    try {
        await resetPassword(email);
        showError('loginEmail', '✅ Password reset email sent! Check your inbox.');
        document.getElementById('loginEmail').classList.remove('input-error');
        document.getElementById('loginEmail').style.borderColor = '#28a745';
    } catch (error) {
        console.error('Password reset error:', error);
        
        if (error.code === 'auth/user-not-found') {
            showError('loginEmail', 'No account found with this email');
        } else if (error.code === 'auth/invalid-email') {
            showError('loginEmail', 'Invalid email address');
        } else {
            showError('loginEmail', 'Failed to send reset email. Please try again.');
        }
    }
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(inputId + 'Icon');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('bi-eye');
        icon.classList.add('bi-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('bi-eye-slash');
        icon.classList.add('bi-eye');
    }
}

function clearRegisterForm() {
    clearAllErrors();
    document.getElementById('registerEmail').value = '';
    document.getElementById('registerUsername').value = '';
    document.getElementById('registerPassword').value = '';
    document.getElementById('confirmPassword').value = '';
}

function clearLoginForm() {
    clearAllErrors();
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
}

document.addEventListener('DOMContentLoaded', () => {
    if (isMobileDevice()) {
        const imageContainer = document.querySelector('.image-container');
        if (imageContainer) {
            imageContainer.style.display = 'none';
        }
    }
    
    const inputs = ['loginEmail', 'loginPassword', 'registerEmail', 'registerUsername', 'registerPassword', 'confirmPassword'];
    
    inputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('input', () => {
                clearError(inputId);
            });
        }
    });

    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    
    if (loginEmail && loginPassword) {
        const handleLoginEnter = (e) => {
            if (e.key === 'Enter') {
                handleLogin();
            }
        };
        
        loginEmail.addEventListener('keypress', handleLoginEnter);
        loginPassword.addEventListener('keypress', handleLoginEnter);
    }

    const registerPassword = document.getElementById('registerPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    
    if (registerPassword && confirmPassword) {
        const handleRegisterEnter = (e) => {
            if (e.key === 'Enter') {
                handleRegistration();
            }
        };
        
        registerPassword.addEventListener('keypress', handleRegisterEnter);
        confirmPassword.addEventListener('keypress', handleRegisterEnter);
    }

    const loginEmailInput = document.getElementById('loginEmail');
    if (loginEmailInput) loginEmailInput.focus();

    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', function () {
            this.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Logging in...';
            this.disabled = true;
        });
    }
});

window.handleRegistration = handleRegistration;
window.handleLogin = handleLogin;
window.handleGoogleLogin = handleGoogleLogin;
window.switchToRegister = switchToRegister;
window.switchToLogin = switchToLogin;
window.togglePassword = togglePassword;
window.clearRegisterForm = clearRegisterForm;
window.clearLoginForm = clearLoginForm;
window.showError = showError;
window.clearError = clearError;
window.clearAllErrors = clearAllErrors;
window.handleForgotPassword = handleForgotPassword;