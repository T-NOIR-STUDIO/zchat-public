(function () {
    "use strict";

    // Multilingual Dictionary
    const i18n = {
        en: {
            title: "Settings",
            subtitle: "Manage your application preferences, privacy, and active status.",
            secPrivacy: "Privacy & Permissions",
            strangerCalls: "Allow calls from strangers",
            strangerCallsDesc: "Let people not in your contacts start voice calls with you.",
            strangerVideo: "Allow video calls from strangers",
            strangerVideoDesc: "Let non-contacts invite you to video conversations.",
            msgRequests: "Message Requests",
            msgRequestsDesc: "Filter messages from unknown users into a separate request folder.",
            secGeneral: "General & Appearance",
            language: "Language",
            languageDesc: "Select your preferred language for the application UI.",
            theme: "Theme Mode",
            themeDesc: "Choose between Light and Dark visual appearance.",
            secSecurity: "Account Security",
            recovery: "Recovery Password",
            recoveryDesc: "Use this password with your username to log in again.",
            copy: "Copy",
            copied: "Copied!",
            noRecovery: "No recovery password saved",
            save: "Save Changes",
            savedAlert: "Settings updated successfully!",
            logout: "Log out",
            changePasscode: "Change Passcode",
            changePasscodeDesc: "Update your 4-digit app lock passcode. Saved to your account on the server.",
            currentPasscode: "Current",
            newPasscode: "New",
            confirmPasscode: "Confirm",
            updatePasscode: "Update Passcode",
            passcodeUpdated: "Passcode updated!",
            passcodeMismatch: "New passcodes do not match",
            passcodeWrong: "Current passcode is incorrect",
            passcodeInvalid: "Passcode must be 4 digits",
            passcodeNoUser: "Account not found"
        },
        vi: {
            title: "Cài đặt",
            subtitle: "Quản lý tùy chọn ứng dụng, quyền riêng tư và trạng thái hoạt động.",
            secPrivacy: "Quyền riêng tư & Cuộc gọi",
            strangerCalls: "Cho phép cuộc gọi từ người lạ",
            strangerCallsDesc: "Cho phép người không có trong danh bạ thực hiện cuộc gọi thoại.",
            strangerVideo: "Cho phép cuộc gọi Video từ người lạ",
            strangerVideoDesc: "Cho phép người lạ gửi lời mời trò chuyện video.",
            msgRequests: "Tin nhắn chờ",
            msgRequestsDesc: "Lọc tin nhắn từ người lạ vào thư mục tin nhắn chờ riêng biệt.",
            secGeneral: "Chung & Giao diện",
            language: "Ngôn ngữ",
            languageDesc: "Chọn ngôn ngữ hiển thị giao diện cho ứng dụng.",
            theme: "Giao diện",
            themeDesc: "Tùy chỉnh chế độ giao diện Sáng hoặc Tối.",
            secSecurity: "Bảo mật tài khoản",
            recovery: "Mật khẩu khôi phục",
            recoveryDesc: "Dùng mật khẩu này cùng tên người dùng để đăng nhập lại.",
            copy: "Sao chép",
            copied: "Đã sao chép!",
            noRecovery: "Chưa có mật khẩu khôi phục",
            save: "Lưu thay đổi",
            savedAlert: "Cập nhật cài đặt thành công!",
            logout: "Đăng xuất",
            changePasscode: "Đổi mã passcode",
            changePasscodeDesc: "Cập nhật mã khóa app 4 số. Lưu trên tài khoản (server).",
            currentPasscode: "Hiện tại",
            newPasscode: "Mới",
            confirmPasscode: "Xác nhận",
            updatePasscode: "Cập nhật passcode",
            passcodeUpdated: "Đã cập nhật passcode!",
            passcodeMismatch: "Passcode mới không khớp",
            passcodeWrong: "Passcode hiện tại không đúng",
            passcodeInvalid: "Passcode phải gồm 4 chữ số",
            passcodeNoUser: "Không tìm thấy tài khoản"
        },
        zh: {
            title: "设置",
            subtitle: "管理您的应用偏好设置、隐私和在线状态。",
            secPrivacy: "隐私与权限",
            strangerCalls: "允许陌生人来电",
            strangerCallsDesc: "允许未保存在联系人中的人发起语音通话。",
            strangerVideo: "允许陌生人视频通话",
            strangerVideoDesc: "允许非联系人邀请您进行视频聊天。",
            msgRequests: "消息请求",
            msgRequestsDesc: "将来自陌生人的消息过滤到单独的请求文件夹中。",
            secGeneral: "通用与外观",
            language: "语言",
            languageDesc: "选择应用界面的首选语言。",
            theme: "主题模式",
            themeDesc: "选择浅色或深色外观。",
            secSecurity: "账户安全",
            recovery: "恢复密码",
            recoveryDesc: "使用此密码与用户名再次登录。",
            copy: "复制",
            copied: "已复制！",
            noRecovery: "未保存恢复密码",
            save: "保存更改",
            savedAlert: "设置更新成功！",
            logout: "退出登录",
            changePasscode: "更改密码",
            changePasscodeDesc: "更新您的 4 位应用锁密码。将保存到服务器上的账户。",
            currentPasscode: "当前",
            newPasscode: "新密码",
            confirmPasscode: "确认",
            updatePasscode: "更新密码",
            passcodeUpdated: "密码已更新！",
            passcodeMismatch: "新密码不匹配",
            passcodeWrong: "当前密码不正确",
            passcodeInvalid: "密码必须为 4 位数字",
            passcodeNoUser: "未找到账户"
        },
        ru: {
            title: "Настройки",
            subtitle: "Управление настройками приложения, конфиденциальностью и статусом.",
            secPrivacy: "Конфиденциальность и разрешения",
            strangerCalls: "Звонки от незнакомцев",
            strangerCallsDesc: "Разрешить пользователям не из контактов совершать аудиозвонки.",
            strangerVideo: "Видеозвонки от незнакомцев",
            strangerVideoDesc: "Разрешить пользователям не из контактов приглашать вас в видеочат.",
            msgRequests: "Запросы на переписку",
            msgRequestsDesc: "Фильтровать сообщения от неизвестных пользователей в отдельную папку.",
            secGeneral: "Общие и внешний вид",
            language: "Язык",
            languageDesc: "Выберите предпочитаемый язык интерфейса приложения.",
            theme: "Тема оформления",
            themeDesc: "Выберите светлое или темное оформление.",
            secSecurity: "Безопасность аккаунта",
            recovery: "Пароль восстановления",
            recoveryDesc: "Используйте этот пароль с именем пользователя для повторного входа.",
            copy: "Копировать",
            copied: "Скопировано!",
            noRecovery: "Пароль восстановления не сохранён",
            save: "Сохранить изменения",
            savedAlert: "Настройки успешно обновлены!",
            logout: "Выйти",
            changePasscode: "Сменить код-пароль",
            changePasscodeDesc: "Обновите 4-значный код блокировки. Сохраняется на сервере.",
            currentPasscode: "Текущий",
            newPasscode: "Новый",
            confirmPasscode: "Подтверждение",
            updatePasscode: "Обновить код",
            passcodeUpdated: "Код обновлён!",
            passcodeMismatch: "Новые коды не совпадают",
            passcodeWrong: "Неверный текущий код",
            passcodeInvalid: "Код должен состоять из 4 цифр",
            passcodeNoUser: "Аккаунт не найден"
        }
    };

    const profileAvatar = document.getElementById("profileAvatar");
    const languageSelect = document.getElementById("languageSelect");
    const themeSelect = document.getElementById("themeSelect");
    const saveBtn = document.getElementById("saveBtn");
    const toast = document.getElementById("toast");
    const toastMsg = document.getElementById("toastMsg");

    let toastTimeout = null;

    function showToast(message) {
        toastMsg.textContent = message;
        toast.classList.remove("opacity-0", "translate-y-4", "pointer-events-none");
        toast.classList.add("opacity-100", "translate-y-0");

        if (toastTimeout) clearTimeout(toastTimeout);

        toastTimeout = setTimeout(() => {
            toast.classList.remove("opacity-100", "translate-y-0");
            toast.classList.add("opacity-0", "translate-y-4", "pointer-events-none");
        }, 3000);
    }

    const AVATAR_COLORS = ["#4F46E5", "#0284C7", "#16A34A", "#D97706", "#DC2626", "#9333EA", "#2563EB", "#0D9488"];
    function colorFor(seed) {
        let hash = 0;
        for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
        return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
    }

    function initials(name) {
        return (name || "")
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((n) => n[0].toUpperCase())
            .join("");
    }

    /* ---- Avatar display (giống ui-helpers / avatar-pin-clear): signed URL + cache ---- */
    const _avCache = Object.create(null);
    const _avInflight = Object.create(null);
    const AV_TTL = 6 * 24 * 3600 * 1000;

    function parseAvatarStoragePath(ref) {
        if (!ref) return null;
        const s = String(ref).trim();
        if (s.startsWith("storage:avatars/")) return s.slice("storage:avatars/".length).split("?")[0];
        if (s.startsWith("storage:")) {
            const rest = s.slice(8);
            const i = rest.indexOf("/");
            if (i > 0 && rest.slice(0, i) === "avatars") return rest.slice(i + 1).split("?")[0];
        }
        const pub = s.match(/\/storage\/v1\/object\/public\/avatars\/(.+?)(?:\?|$)/);
        if (pub) return decodeURIComponent(pub[1]);
        const sig = s.match(/\/storage\/v1\/object\/sign\/avatars\/(.+?)(?:\?|$)/);
        if (sig) return decodeURIComponent(sig[1]);
        return null;
    }

    function getCachedAvatarUrl(ref) {
        const key = parseAvatarStoragePath(ref) || String(ref || "").trim();
        if (!key) return null;
        const hit = _avCache[key];
        if (hit && hit.url && hit.exp > Date.now()) return hit.url;
        try {
            const raw = sessionStorage.getItem("zchat_avurl_" + key);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.url && parsed.exp > Date.now()) {
                    _avCache[key] = parsed;
                    return parsed.url;
                }
            }
        } catch (_) {}
        return null;
    }

    function setCachedAvatarUrl(ref, url) {
        const key = parseAvatarStoragePath(ref) || String(ref || "").trim();
        if (!key || !url) return;
        const entry = { url, exp: Date.now() + AV_TTL };
        _avCache[key] = entry;
        try { sessionStorage.setItem("zchat_avurl_" + key, JSON.stringify(entry)); } catch (_) {}
    }

    async function resolveAvatarDisplayUrl(ref) {
        if (!ref) return null;
        const s = String(ref).trim();
        if (/^https?:\/\//i.test(s) && !parseAvatarStoragePath(s)) return s;
        const cached = getCachedAvatarUrl(s);
        if (cached) return cached;
        const path = parseAvatarStoragePath(s);
        if (!path || !window.supabaseClient) {
            return /^https?:\/\//i.test(s) ? s : null;
        }
        if (_avInflight[path]) return _avInflight[path];
        _avInflight[path] = (async () => {
            try {
                const { data, error } = await window.supabaseClient.storage
                    .from("avatars")
                    .createSignedUrl(path, 3600 * 24 * 7);
                if (!error && data && data.signedUrl) {
                    setCachedAvatarUrl(s, data.signedUrl);
                    return data.signedUrl;
                }
            } catch (e) {
                console.warn("[ZChat] avatar signed URL:", e);
            } finally {
                delete _avInflight[path];
            }
            return /^https?:\/\//i.test(s) ? s : null;
        })();
        return _avInflight[path];
    }

    function renderProfileAvatarEl(el, opts) {
        if (!el) return;
        const username = opts.username || "Guest";
        const avatarType = opts.avatarType || "initials";
        const avatarColor = opts.avatarColor || colorFor(username);
        const avatarEmoji = opts.avatarEmoji || "😀";
        const avatarUrl = opts.avatarUrl || "";

        if (avatarType === "photo" && avatarUrl) {
            el.style.backgroundColor = "var(--elevated2)";
            const instant = getCachedAvatarUrl(avatarUrl);
            el.innerHTML = '<img src="' + (instant || "") + '" alt="Avatar" class="h-full w-full rounded-full object-cover" loading="lazy" decoding="async" />';
            if (!instant) {
                resolveAvatarDisplayUrl(avatarUrl).then((url) => {
                    const img = el.querySelector("img");
                    if (img && url) img.src = url;
                }).catch(() => {});
            }
        } else if (avatarType === "emoji") {
            el.style.backgroundColor = "var(--elevated2)";
            el.textContent = avatarEmoji;
        } else {
            el.style.backgroundColor = avatarColor;
            el.style.color = "var(--avatar-text)";
            el.textContent = initials(username);
        }
    }

    function loadProfileData() {
        if (!profileAvatar) return;
        renderProfileAvatarEl(profileAvatar, {
            username: localStorage.getItem("zchat_username") || "Guest",
            avatarType: localStorage.getItem("zchat_avatar_type") || "initials",
            avatarColor: localStorage.getItem("zchat_avatar_color") || null,
            avatarEmoji: localStorage.getItem("zchat_avatar_emoji") || "😀",
            avatarUrl: localStorage.getItem("zchat_avatar_url") || "",
        });
    }

    /** Avatar theo tài khoản — lấy từ Supabase khi mở Settings */
    async function syncAvatarFromAccount() {
        const username = (localStorage.getItem("zchat_username") || "").trim();
        if (!username || !window.supabaseClient || !profileAvatar) return;
        try {
            const { data, error } = await window.supabaseClient
                .from("users")
                .select("avatar_type, avatar_color, avatar_emoji, avatar_url")
                .ilike("username", username)
                .maybeSingle();
            if (error || !data) return;
            if (data.avatar_type) localStorage.setItem("zchat_avatar_type", data.avatar_type);
            if (data.avatar_color) localStorage.setItem("zchat_avatar_color", data.avatar_color);
            if (data.avatar_emoji) localStorage.setItem("zchat_avatar_emoji", data.avatar_emoji);
            if (data.avatar_url) localStorage.setItem("zchat_avatar_url", data.avatar_url);
            loadProfileData();
        } catch (err) {
            console.error("[ZChat] settings syncAvatarFromAccount error:", err);
        }
    }

    function applyLanguage(lang) {
        const dict = i18n[lang] || i18n.en;
        document.getElementById("txtTitle").textContent = dict.title;
        document.getElementById("txtSubtitle").textContent = dict.subtitle;
        document.getElementById("secGeneralTitle").textContent = dict.secGeneral;
        document.getElementById("lblLanguage").textContent = dict.language;
        document.getElementById("lblLanguageDesc").textContent = dict.languageDesc;
        document.getElementById("lblTheme").textContent = dict.theme;
        document.getElementById("lblThemeDesc").textContent = dict.themeDesc;
        document.getElementById("saveBtn").textContent = dict.save;

        const secSecurityTitle = document.getElementById("secSecurityTitle");
        if (secSecurityTitle) secSecurityTitle.textContent = dict.secSecurity;
        const lblRecovery = document.getElementById("lblRecovery");
        if (lblRecovery) lblRecovery.textContent = dict.recovery;
        const lblRecoveryDesc = document.getElementById("lblRecoveryDesc");
        if (lblRecoveryDesc) lblRecoveryDesc.textContent = dict.recoveryDesc;
        const settingsCopyLabel = document.getElementById("settingsCopyLabel");
        if (settingsCopyLabel) settingsCopyLabel.textContent = dict.copy;
        const logoutBtnLabel = document.getElementById("logoutBtnLabel");
        if (logoutBtnLabel) logoutBtnLabel.textContent = dict.logout || "Log out";

        const map = [
            ["lblChangePasscode", "changePasscode"],
            ["lblChangePasscodeDesc", "changePasscodeDesc"],
            ["lblCurrentPasscode", "currentPasscode"],
            ["lblNewPasscode", "newPasscode"],
            ["lblConfirmPasscode", "confirmPasscode"],
            ["changePasscodeBtn", "updatePasscode"],
        ];
        map.forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (el && dict[key]) el.textContent = dict[key];
        });
    }

    function generateRecoveryPassword() {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*";
        const part = (len) => {
            let s = "";
            for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
            return s;
        };
        return "zChat-" + part(4) + "-" + part(4);
    }

    function loadRecoveryPassword(lang) {
        const dict = i18n[lang] || i18n.en;
        const display = document.getElementById("settingsRecoveryDisplay");
        if (!display) return;
        let recovery = localStorage.getItem("zchat_recovery_password") || "";
        // Auto-generate for accounts created before this feature
        if (!recovery && localStorage.getItem("zchat_username")) {
            recovery = generateRecoveryPassword();
            localStorage.setItem("zchat_recovery_password", recovery);
        }
        display.textContent = recovery || dict.noRecovery;
    }

    function loadSettings() {
        const savedTheme = localStorage.getItem("zchat_theme") || "dark";
        const savedLang = localStorage.getItem("zchat_lang") || "en";
        document.documentElement.setAttribute("data-theme", savedTheme);
        themeSelect.value = savedTheme;
        languageSelect.value = savedLang;

        applyLanguage(savedLang);
        loadRecoveryPassword(savedLang);
    }

    themeSelect.addEventListener("change", (e) => {
        document.documentElement.setAttribute("data-theme", e.target.value);
    });

    languageSelect.addEventListener("change", (e) => {
        applyLanguage(e.target.value);
        loadRecoveryPassword(e.target.value);
    });

    const settingsCopyRecoveryBtn = document.getElementById("settingsCopyRecoveryBtn");
    if (settingsCopyRecoveryBtn) {
        settingsCopyRecoveryBtn.addEventListener("click", async () => {
            const recovery = localStorage.getItem("zchat_recovery_password") || "";
            if (!recovery) return;
            try {
                await navigator.clipboard.writeText(recovery);
            } catch (_) {
                const ta = document.createElement("textarea");
                ta.value = recovery;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
            }
            const lang = languageSelect.value || "en";
            const dict = i18n[lang] || i18n.en;
            const label = document.getElementById("settingsCopyLabel");
            const icon = document.getElementById("settingsCopyIcon");
            if (label) label.textContent = dict.copied;
            if (icon) {
                icon.setAttribute("data-lucide", "check");
                if (window.lucide) window.lucide.createIcons();
            }
            setTimeout(() => {
                if (label) label.textContent = dict.copy;
                if (icon) {
                    icon.setAttribute("data-lucide", "copy");
                    if (window.lucide) window.lucide.createIcons();
                }
            }, 1500);
        });
    }

    saveBtn.addEventListener("click", () => {
        const currentLang = languageSelect.value;
        localStorage.setItem("zchat_theme", themeSelect.value);
        localStorage.setItem("zchat_lang", currentLang);

        showToast(i18n[currentLang].savedAlert);
    });

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            // Clear session + avatar (tránh dính avatar user cũ sang account mới)
            [
                "zchat_username",
                "zchat_user",
                "zchat_recovery_password",
                "zchat_avatar_type",
                "zchat_avatar_color",
                "zchat_avatar_emoji",
                "zchat_avatar_url",
            ].forEach((k) => localStorage.removeItem(k));
            window.location.href = "index.html";
        });
    }

    /* ===== Change Passcode (server: public.passcode, beta elonmusk) ===== */
    const changePasscodeBlock = document.getElementById("changePasscodeBlock");
    const passcodeCurrent = document.getElementById("passcodeCurrent");
    const passcodeNew = document.getElementById("passcodeNew");
    const passcodeConfirm = document.getElementById("passcodeConfirm");
    const changePasscodeBtn = document.getElementById("changePasscodeBtn");
    const passcodeChangeError = document.getElementById("passcodeChangeError");

    function digitsOnly(el) {
        if (!el) return;
        el.addEventListener("input", () => {
            el.value = el.value.replace(/\D/g, "").slice(0, 4);
        });
    }
    digitsOnly(passcodeCurrent);
    digitsOnly(passcodeNew);
    digitsOnly(passcodeConfirm);

    function showPasscodeErr(msg) {
        if (!passcodeChangeError) return;
        if (!msg) {
            passcodeChangeError.classList.add("hidden");
            passcodeChangeError.textContent = "";
            return;
        }
        passcodeChangeError.textContent = msg;
        passcodeChangeError.classList.remove("hidden");
    }

    async function resolveMyUserId() {
        let uid = localStorage.getItem("zchat_user_id") || "";
        if (uid) return uid;
        const uname = (localStorage.getItem("zchat_username") || "").trim();
        if (!uname || !window.supabaseClient) return null;
        const { data } = await window.supabaseClient
            .from("users").select("id").ilike("username", uname).maybeSingle();
        if (data && data.id) {
            localStorage.setItem("zchat_user_id", data.id);
            return data.id;
        }
        return null;
    }

    async function initChangePasscodeUI() {
        const uname = (localStorage.getItem("zchat_username") || "").trim().toLowerCase();
        if (!changePasscodeBlock) return;
        // Beta: chỉ elonmusk
        if (uname !== "elonmusk") {
            changePasscodeBlock.classList.add("hidden");
            return;
        }
        changePasscodeBlock.classList.remove("hidden");
    }

    if (changePasscodeBtn) {
        changePasscodeBtn.addEventListener("click", async () => {
            const lang = languageSelect.value || "en";
            const dict = i18n[lang] || i18n.en;
            showPasscodeErr("");

            const cur = (passcodeCurrent && passcodeCurrent.value) || "";
            const neu = (passcodeNew && passcodeNew.value) || "";
            const conf = (passcodeConfirm && passcodeConfirm.value) || "";

            if (!/^\d{4}$/.test(cur) || !/^\d{4}$/.test(neu) || !/^\d{4}$/.test(conf)) {
                showPasscodeErr(dict.passcodeInvalid || "Passcode must be 4 digits");
                return;
            }
            if (neu !== conf) {
                showPasscodeErr(dict.passcodeMismatch || "New passcodes do not match");
                return;
            }
            if (!window.supabaseClient) {
                showPasscodeErr("Supabase unavailable");
                return;
            }

            try {
                const uid = await resolveMyUserId();
                if (!uid) {
                    showPasscodeErr(dict.passcodeNoUser || "Account not found");
                    return;
                }

                const { data: row, error: fetchErr } = await window.supabaseClient
                    .from("passcode")
                    .select("user_id, passcode")
                    .eq("user_id", uid)
                    .maybeSingle();
                if (fetchErr) throw fetchErr;

                if (!row || String(row.passcode) !== cur) {
                    showPasscodeErr(dict.passcodeWrong || "Current passcode is incorrect");
                    return;
                }

                const { error: upErr } = await window.supabaseClient
                    .from("passcode")
                    .update({ passcode: neu, updated_at: new Date().toISOString() })
                    .eq("user_id", uid);
                if (upErr) throw upErr;

                if (passcodeCurrent) passcodeCurrent.value = "";
                if (passcodeNew) passcodeNew.value = "";
                if (passcodeConfirm) passcodeConfirm.value = "";
                showToast(dict.passcodeUpdated || "Passcode updated!");
            } catch (e) {
                console.error("[Passcode] change:", e);
                showPasscodeErr(e.message || "Update failed");
            }
        });
    }

    loadSettings();
    loadProfileData();
    syncAvatarFromAccount();
    initChangePasscodeUI();
    if (window.lucide) window.lucide.createIcons();
})();
