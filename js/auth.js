const SUPABASE_URL = "https://mttbznhwfedroiylqykc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10dGJ6bmh3ZmVkcm9peWxxeWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0NzkyMDIsImV4cCI6MjEwMTA1NTIwMn0.P7tsvdH-C3WThy81d3cWj0poQNANVsPmF4qVb1Bvruo";

if (typeof window.supabaseClient === "undefined") {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
var supabase = window.supabaseClient;

async function ensureAnonSession() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) return session;
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        return data.session;
    } catch (err) {
        console.error("[Auth] Không thể tạo phiên ẩn danh:", err);
        return null;
    }
}
window.zchatEnsureAnonSession = ensureAnonSession;

function clearLocalAvatar() {
    [
        "zchat_avatar_type",
        "zchat_avatar_color",
        "zchat_avatar_emoji",
        "zchat_avatar_url",
    ].forEach((k) => localStorage.removeItem(k));
}

function saveSession(user, opts) {
    if (!user || !user.username) return;
    const isNewRegister = opts && opts.isNewRegister;
    clearLocalAvatar();
    if (!isNewRegister) {
        if (user.avatar_type) localStorage.setItem("zchat_avatar_type", user.avatar_type);
        if (user.avatar_color) localStorage.setItem("zchat_avatar_color", user.avatar_color);
        if (user.avatar_emoji) localStorage.setItem("zchat_avatar_emoji", user.avatar_emoji);
        if (user.avatar_url) localStorage.setItem("zchat_avatar_url", user.avatar_url);
    }
    localStorage.setItem("zchat_username", user.username);
    if (user.recovery_password) {
        localStorage.setItem("zchat_recovery_password", user.recovery_password);
    }
    if (user.public_key) localStorage.setItem("zchat_public_key", user.public_key);
    if (user.private_key) localStorage.setItem("zchat_private_key", user.private_key);
    if (user.id) localStorage.setItem("zchat_user_id", user.id);
    localStorage.setItem("zchat_user", JSON.stringify(user));
}
function enterChatApp(username) {
    if (typeof window.zchatEnterApp === "function") {
        window.zchatEnterApp(username);
        return;
    }
    document.getElementById("onboarding")?.classList.add("hidden");
    document.getElementById("recoveryModal")?.classList.add("hidden");
    const shell = document.getElementById("appShell");
    if (shell) {
        shell.classList.remove("hidden");
        shell.classList.add("md:flex");
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await ensureAnonSession();

    const onboardingForm = document.getElementById("onboardingForm");
    const loginForm = document.getElementById("loginForm");
    const usernameInput = document.getElementById("usernameInput");
    const loginUsernameInput = document.getElementById("loginUsernameInput");
    const loginRecoveryInput = document.getElementById("loginRecoveryInput");

    const switchToLoginBtn = document.getElementById("switchToLoginBtn");
    const switchToRegisterBtn = document.getElementById("switchToRegisterBtn");

    const recoveryModal = document.getElementById("recoveryModal");
    const recoveryPasswordDisplay = document.getElementById("recoveryPasswordDisplay");
    const copyRecoveryBtn = document.getElementById("copyRecoveryBtn");
    const recoveryContinueBtn = document.getElementById("recoveryContinueBtn");

    if (switchToLoginBtn) {
        switchToLoginBtn.addEventListener("click", () => {
            onboardingForm?.classList.add("hidden");
            loginForm?.classList.remove("hidden");
        });
    }
    if (switchToRegisterBtn) {
        switchToRegisterBtn.addEventListener("click", () => {
            loginForm?.classList.add("hidden");
            onboardingForm?.classList.remove("hidden");
        });
    }

    function generateRecoveryPassword() {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*";
        const part = (n) => {
            let s = "";
            for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
            return s;
        };
        return "zChat-" + part(4) + "-" + part(4);
    }

    if (onboardingForm) {
        onboardingForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();
            const username = usernameInput ? usernameInput.value.trim() : "";
            if (!username) {
                document.getElementById("usernameError")?.classList.remove("hidden");
                return;
            }
            document.getElementById("usernameError")?.classList.add("hidden");

            const recoveryPassword = generateRecoveryPassword();

            try {
                await ensureAnonSession();

                let public_key = null, private_key = null;
                if (window.ZChatE2EE) {
                    const pair = await window.ZChatE2EE.generateKeyPairJwk();
                    public_key = pair.publicKey;
                    private_key = pair.privateKey;
                }
                const { data, error } = await supabase
                    .rpc("register_user", {
                        p_username: username,
                        p_recovery_password: recoveryPassword,
                        p_public_key: public_key,
                        p_private_key: private_key,
                    })
                    .maybeSingle();
                if (error) throw error;
                const user = data || { username, recovery_password: recoveryPassword, public_key, private_key };
                saveSession(user, { isNewRegister: true });

                if (recoveryPasswordDisplay) recoveryPasswordDisplay.textContent = recoveryPassword;
                if (recoveryModal) recoveryModal.classList.remove("hidden");
            } catch (err) {
                console.error("Lỗi Đăng ký:", err);
                const loginError = document.getElementById("usernameError");
                if (loginError) {
                    const raw = `${err.code || ""} ${err.message || ""}`;
                    if (/23505|duplicate key|unique constraint|users_username/i.test(raw)) {
                        loginError.textContent = "Username already taken. Please choose another.";
                    } else {
                        loginError.textContent = "Registration failed. Please try again.";
                    }
                    loginError.classList.remove("hidden");
                }
            }
        }, true);
    }

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();
            const username = loginUsernameInput ? loginUsernameInput.value.trim() : "";
            const recoveryPassword = loginRecoveryInput ? loginRecoveryInput.value.trim() : "";
            const loginError = document.getElementById("loginError");

            if (!username || !recoveryPassword) {
                if (loginError) {
                    loginError.textContent = "Please enter username and recovery password.";
                    loginError.classList.remove("hidden");
                }
                return;
            }

            try {
                await ensureAnonSession();

                const { data, error } = await supabase
                    .rpc("verify_login", {
                        p_username: username,
                        p_recovery_password: recoveryPassword,
                    })
                    .maybeSingle();

                if (error) {
                    if (loginError) {
                        loginError.textContent = "Invalid username or recovery password.";
                        loginError.classList.remove("hidden");
                    }
                    return;
                }

                if (!data) {
                    if (loginError) {
                        loginError.textContent = "Invalid username or recovery password.";
                        loginError.classList.remove("hidden");
                    }
                    return;
                }

                if (loginError) loginError.classList.add("hidden");
                saveSession(data);
                if (window.ZChatE2EE) {
                    try { await window.ZChatE2EE.ensureUserKeys(data.username, data); }
                    catch (e) { console.error("[E2EE] login keys:", e); }
                }
                enterChatApp(data.username);
            } catch (err) {
                console.error("Lỗi Đăng nhập:", err);
                if (loginError) {
                    loginError.textContent = "Server connection error.";
                    loginError.classList.remove("hidden");
                }
            }
        }, true);
    }

    if (copyRecoveryBtn) {
        copyRecoveryBtn.addEventListener("click", async () => {
            const textToCopy = recoveryPasswordDisplay ? recoveryPasswordDisplay.textContent.trim() : "";
            if (!textToCopy) return;
            try {
                await navigator.clipboard.writeText(textToCopy);
            } catch (err) {
                const ta = document.createElement("textarea");
                ta.value = textToCopy;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
            }
            const wrapper = document.getElementById("copyIconWrapper") || copyRecoveryBtn;
            const originalHTML = wrapper.innerHTML;
            wrapper.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
            setTimeout(() => { wrapper.innerHTML = originalHTML; }, 3000);
        });
    }

    if (recoveryContinueBtn) {
        recoveryContinueBtn.addEventListener("click", () => {
            const u = localStorage.getItem("zchat_username") || "";
            if (recoveryModal) recoveryModal.classList.add("hidden");
            localStorage.removeItem("zchat_passcode_unlocked_at");
            enterChatApp(u);
        });
    }
});
