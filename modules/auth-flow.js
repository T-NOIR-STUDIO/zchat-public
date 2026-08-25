/* ============================================================
 * 06-auth-flow.js
 * ============================================================ */
function generateRecoveryPassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    const part = (len) => {
        let s = "";
        for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
        return s;
    };
    return "zChat-" + part(4) + "-" + part(4);
}

function showRegisterView() {
    onboardingForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
    if (loginError) loginError.classList.add("hidden");
    usernameInput.focus();
    icons();
}

function showLoginView() {
    onboardingForm.classList.add("hidden");
    loginForm.classList.remove("hidden");
    if (usernameError) usernameError.classList.add("hidden");
    if (loginError) loginError.classList.add("hidden");
    loginUsernameInput.focus();
    icons();
}

function enterApp(username) {
    if (window.ZChatE2EE && username) {
        window.ZChatE2EE.ensureUserKeys(username).catch((e) => console.error("[E2EE] enterApp:", e));
    }

    currentUsername = username;
    localStorage.setItem("zchat_username", username);

    // Passcode: chưa unlock / hết 50h → recovery.html (Create hoặc Enter)
    // recovery.js tự phân nhánh Create nếu chưa có trên server
    try {
        const TTL_MS = 50 * 60 * 60 * 1000;
        const unlockedAt = parseInt(localStorage.getItem("zchat_passcode_unlocked_at") || "0", 10) || 0;
        const stillOk = unlockedAt > 0 && (Date.now() - unlockedAt) < TTL_MS;
        const onRecoveryPage = /recovery\.html/i.test(location.pathname || "") || /recovery\.html/i.test(location.href || "");
        if (!stillOk && !onRecoveryPage) {
            window.location.replace("recovery.html");
            return;
        }
    } catch (_) {}

    onboarding.classList.add("hidden");
    if (recoveryModal) recoveryModal.classList.add("hidden");
    appShell.classList.remove("hidden");
    appShell.classList.add("md:flex");

    state.chats = [];
    state.activeChatId = null;
    ensureSavedMessagesChat();

    state.searchQuery = "";
    if (searchInput) {
        searchInput.value = "";
    }

    syncProfileData();
    // Đồng bộ avatar từ tài khoản (Supabase) — mọi thiết bị / trình duyệt cùng 1 ảnh
    syncMyAvatarFromServer(username);
    applyLanguage();
    renderChatList();

    loadMessagesFromSupabase();

    renderActiveChat();
    icons();
}

function showRecoveryModal(password) {
    if (!recoveryModal) {
        enterApp(currentUsername);
        return;
    }
    recoveryPasswordDisplay.textContent = password;
    recoveryModal.classList.remove("hidden");
    icons();
}

onboardingForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const val = usernameInput.value.trim();
    if (!val) {
        usernameError.classList.remove("hidden");
        usernameInput.focus();
        return;
    }
    usernameError.classList.add("hidden");

    const recovery = generateRecoveryPassword();
    localStorage.setItem("zchat_username", val);
    localStorage.setItem("zchat_recovery_password", recovery);
    currentUsername = val;
    showRecoveryModal(recovery);
});

if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
        e.preventDefault();
        const user = (loginUsernameInput.value || "").trim();
        const pass = (loginRecoveryInput.value || "").trim();
        const lang = localStorage.getItem("zchat_lang") || "en";
        const dict = i18n[lang] || i18n.en;

        if (!user || !pass) {
            loginError.textContent = dict.loginErrorEmpty;
            loginError.classList.remove("hidden");
            return;
        }

        const storedUser = localStorage.getItem("zchat_username") || "";
        const storedPass = localStorage.getItem("zchat_recovery_password") || "";

        if (user === storedUser && pass === storedPass && storedUser) {
            loginError.classList.add("hidden");
            enterApp(user);
        } else {
            loginError.textContent = dict.loginErrorInvalid;
            loginError.classList.remove("hidden");
        }
    });
}

if (switchToLoginBtn) switchToLoginBtn.addEventListener("click", showLoginView);
if (switchToRegisterBtn) switchToRegisterBtn.addEventListener("click", showRegisterView);

if (toggleRecoveryVisibility && loginRecoveryInput) {
    toggleRecoveryVisibility.addEventListener("click", () => {
        const isPass = loginRecoveryInput.type === "password";
        loginRecoveryInput.type = isPass ? "text" : "password";
        const icon = document.getElementById("recoveryEyeIcon");
        if (icon) {
            icon.setAttribute("data-lucide", isPass ? "eye-off" : "eye");
            icons();
        }
    });
}

if (copyRecoveryBtn) {
    copyRecoveryBtn.addEventListener("click", async () => {
        const text = recoveryPasswordDisplay.textContent || "";
        try {
            await navigator.clipboard.writeText(text);
        } catch (_) {
            const ta = document.createElement("textarea");
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
        }
        const icon = document.getElementById("copyRecoveryIcon");
        if (icon) {
            icon.setAttribute("data-lucide", "check");
            icons();
            setTimeout(() => {
                icon.setAttribute("data-lucide", "copy");
                icons();
            }, 1500);
        }
    });
}

if (recoveryContinueBtn) {
    recoveryContinueBtn.addEventListener("click", () => {
        enterApp(currentUsername || localStorage.getItem("zchat_username") || "");
    });
}
