(function () {
    "use strict";

    /* ============ I18N DICTIONARY (EN, VI, ZH, RU) ============ */
    const i18n = {
        en: {
            backToChat: "Back to Chat",
            editProfile: "Edit Profile",
            changeAvatar: "Change avatar",
            colorTab: "Color",
            emojiTab: "Emoji",
            photoTab: "Photo",
            uploadPhoto: "Upload photo",
            uploading: "Uploading...",
            username: "Username",
            usernameErr: "Username can't be empty.",
            status: "Status",
            statusPlaceholder: "e.g. Available, In a meeting...",
            statusDesc: "Shown to others alongside your name.",
            presence: "Presence",
            online: "Online",
            away: "Away",
            dnd: "Do Not Disturb",
            appearance: "Appearance",
            theme: "Theme",
            darkMode: "Dark mode",
            lightMode: "Light mode",
            saveChanges: "Save Changes",
            successToast: "Profile updated successfully!"
        },
        vi: {
            backToChat: "Quay lại Chat",
            editProfile: "Chỉnh sửa hồ sơ",
            changeAvatar: "Đổi ảnh đại diện",
            colorTab: "Màu sắc",
            emojiTab: "Biểu tượng",
            photoTab: "Ảnh",
            uploadPhoto: "Tải ảnh lên",
            uploading: "Đang tải lên...",
            username: "Tên người dùng",
            usernameErr: "Tên người dùng không được để trống.",
            status: "Trạng thái",
            statusPlaceholder: "Ví dụ: Đang rảnh, Đang họp...",
            statusDesc: "Hiển thị cho người khác cùng với tên của bạn.",
            presence: "Trạng thái hoạt động",
            online: "Trực tuyến",
            away: "Vắng mặt",
            dnd: "Không làm phiền",
            appearance: "Giao diện",
            theme: "Chế độ nền",
            darkMode: "Chế độ tối",
            lightMode: "Chế độ sáng",
            saveChanges: "Lưu thay đổi",
            successToast: "Cập nhật hồ sơ thành công!"
        },
        zh: {
            backToChat: "返回聊天",
            editProfile: "编辑个人资料",
            changeAvatar: "更换头像",
            colorTab: "颜色",
            emojiTab: "表情",
            photoTab: "照片",
            uploadPhoto: "上传照片",
            uploading: "上传中...",
            username: "用户名",
            usernameErr: "用户名不能为空。",
            status: "状态",
            statusPlaceholder: "例如：在线、开会中...",
            statusDesc: "与其他用户一起显示在您的名字旁。",
            presence: "在线状态",
            online: "在线",
            away: "离开",
            dnd: "请勿打扰",
            appearance: "外观",
            theme: "主题Mode",
            darkMode: "深色模式",
            lightMode: "浅色模式",
            saveChanges: "保存更改",
            successToast: "个人资料更新成功！"
        },
        ru: {
            backToChat: "Назад в чат",
            editProfile: "Редактировать профиль",
            changeAvatar: "Сменить аватар",
            colorTab: "Цвет",
            emojiTab: "Эмодзи",
            photoTab: "Фото",
            uploadPhoto: "Загрузить фото",
            uploading: "Загрузка...",
            username: "Имя пользователя",
            usernameErr: "Имя пользователя не может быть пустым.",
            status: "Статус",
            statusPlaceholder: "Например: Доступен, На встрече...",
            statusDesc: "Отображается другим рядом с вашим именем.",
            presence: "Статус сети",
            online: "В сети",
            away: "Отошел",
            dnd: "Не беспокоить",
            appearance: "Внешний вид",
            theme: "Тема",
            darkMode: "Темная тема",
            lightMode: "Светлая тема",
            saveChanges: "Сохранить",
            successToast: "Профиль успешно обновлен!"
        }
    };

    function applyLanguage() {
        const lang = localStorage.getItem("zchat_lang") || "en";
        const dict = i18n[lang] || i18n.en;

        const backBtn = document.querySelector("header a");
        if (backBtn) backBtn.childNodes[2].textContent = " " + dict.backToChat;

        const headerTitle = document.querySelector("header h1");
        if (headerTitle) headerTitle.textContent = dict.editProfile;

        if (changeAvatarBtn) changeAvatarBtn.childNodes[2].textContent = " " + dict.changeAvatar;

        const tabColor = document.querySelector('.avatar-tab[data-avatar-tab="color"]');
        if (tabColor) tabColor.textContent = dict.colorTab;
        const tabEmoji = document.querySelector('.avatar-tab[data-avatar-tab="emoji"]');
        if (tabEmoji) tabEmoji.textContent = dict.emojiTab;
        const tabPhoto = document.querySelector('.avatar-tab[data-avatar-tab="photo"]');
        if (tabPhoto) tabPhoto.textContent = dict.photoTab;
        if (uploadPhotoBtnLabel && !isUploadingAvatar) uploadPhotoBtnLabel.textContent = dict.uploadPhoto;

        const labelUsername = document.querySelector("label[for='usernameField']");
        if (labelUsername) labelUsername.textContent = dict.username;
        if (usernameError) usernameError.textContent = dict.usernameErr;

        const labelStatus = document.querySelector("label[for='bioField']");
        if (labelStatus) labelStatus.textContent = dict.status;
        if (bioField) bioField.placeholder = dict.statusPlaceholder;
        const statusDesc = document.getElementById("statusDesc");
        if (statusDesc) statusDesc.textContent = dict.statusDesc;

        const presenceLabel = document.getElementById("presenceLabel");
        if (presenceLabel) presenceLabel.textContent = dict.presence;

        const presenceTexts = document.querySelectorAll(".presence-text");
        if (presenceTexts[0]) presenceTexts[0].textContent = dict.online;
        if (presenceTexts[1]) presenceTexts[1].textContent = dict.away;
        if (presenceTexts[2]) presenceTexts[2].textContent = dict.dnd;

        const appearanceLabel = document.getElementById("appearanceLabel");
        if (appearanceLabel) appearanceLabel.textContent = dict.appearance;
        const themeTitle = document.getElementById("themeTitle");
        if (themeTitle) themeTitle.textContent = dict.theme;

        const saveBtn = document.getElementById("saveBtn");
        if (saveBtn) saveBtn.textContent = dict.saveChanges;

        renderTheme();
    }

    /* Listen for language change in other tabs */
    window.addEventListener("storage", (e) => {
        if (e.key === "zchat_lang") {
            applyLanguage();
        }
    });

    const AVATAR_COLORS = ["#3B3B3B", "#333333", "#2E2E2E", "#363636", "#303030", "#3A3A3A", "#7F96FF", "#5170FF", "#31D07C", "#F5A623", "#EF4444", "#8C6CF0"];
    const EMOJIS = ["😀", "😎", "🤖", "🐱", "🐼", "🦊", "🦁", "🐸", "🌟", "🔥", "🎧", "🎮", "🍜", "🚀", "🌈", "🌸", "⚡", "🧠"];

    function initials(name) {
        return (name || "")
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((n) => n[0].toUpperCase())
            .join("");
    }

    function colorFor(seed) {
        let hash = 0;
        for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
        return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
    }

    function icons() {
        if (window.lucide) window.lucide.createIcons();
    }

    /* ============ GUARD: no account yet ============ */
    const savedUsername = localStorage.getItem("zchat_username");
    if (!savedUsername) {
        window.location.href = "index.html";
        return;
    }

    /* ============ LOAD SAVED STATE (local trước, rồi đồng bộ từ tài khoản Supabase) ============ */
    const saved = {
        username: savedUsername,
        bio: localStorage.getItem("zchat_bio") || "Available",
        presence: localStorage.getItem("zchat_presence") || "online",
        avatarType: localStorage.getItem("zchat_avatar_type") || "initials",
        avatarColor: localStorage.getItem("zchat_avatar_color") || colorFor(savedUsername),
        avatarEmoji: localStorage.getItem("zchat_avatar_emoji") || "😀",
        avatarUrl: localStorage.getItem("zchat_avatar_url") || "",
        theme: localStorage.getItem("zchat_theme") || "dark",
    };

    const draft = Object.assign({}, saved);

    /** Ghi avatar lên bảng users (đồng bộ mọi thiết bị + realtime cho người chat cùng) */
    async function syncAvatarToAccount(fields) {
        if (!window.supabaseClient) return false;
        const accountKey = savedUsername || draft.username || localStorage.getItem("zchat_username");
        if (!accountKey) return false;
        try {
            localStorage.setItem("zchat_avatar_type", fields.avatar_type || "initials");
            if (fields.avatar_color) localStorage.setItem("zchat_avatar_color", fields.avatar_color);
            if (fields.avatar_emoji) localStorage.setItem("zchat_avatar_emoji", fields.avatar_emoji);
            if (fields.avatar_url) localStorage.setItem("zchat_avatar_url", fields.avatar_url);
            else if (fields.avatar_type !== "photo") localStorage.removeItem("zchat_avatar_url");

            const { error } = await window.supabaseClient
                .from("users")
                .update(fields)
                .ilike("username", accountKey);
            if (error) {
                console.error("[ZChat] syncAvatarToAccount error:", error);
                return false;
            }
            return true;
        } catch (err) {
            console.error("[ZChat] syncAvatarToAccount exception:", err);
            return false;
        }
    }

    /** Lấy user id (UUID) — path Storage không phụ thuộc username */
    async function resolveAccountUserId() {
        const cached = localStorage.getItem("zchat_user_id");
        if (cached) return cached;
        if (!window.supabaseClient || !savedUsername) return null;
        try {
            const { data, error } = await window.supabaseClient
                .from("users")
                .select("id")
                .ilike("username", savedUsername)
                .maybeSingle();
            if (error || !data || !data.id) return null;
            localStorage.setItem("zchat_user_id", data.id);
            return data.id;
        } catch (err) {
            console.error("[ZChat] resolveAccountUserId error:", err);
            return null;
        }
    }

    /** Avatar gắn với tài khoản — fetch từ server để đồng bộ mọi thiết bị */
    async function loadAvatarFromAccount() {
        if (!window.supabaseClient || !savedUsername) return;
        try {
            const { data, error } = await window.supabaseClient
                .from("users")
                .select("id, username, avatar_type, avatar_color, avatar_emoji, avatar_url")
                .ilike("username", savedUsername)
                .maybeSingle();
            if (error || !data) return;

            if (data.id) localStorage.setItem("zchat_user_id", data.id);

            if (data.avatar_type) {
                draft.avatarType = saved.avatarType = data.avatar_type;
                localStorage.setItem("zchat_avatar_type", data.avatar_type);
            }
            if (data.avatar_color) {
                draft.avatarColor = saved.avatarColor = data.avatar_color;
                localStorage.setItem("zchat_avatar_color", data.avatar_color);
            }
            if (data.avatar_emoji) {
                draft.avatarEmoji = saved.avatarEmoji = data.avatar_emoji;
                localStorage.setItem("zchat_avatar_emoji", data.avatar_emoji);
            }
            if (data.avatar_url) {
                draft.avatarUrl = saved.avatarUrl = data.avatar_url;
                localStorage.setItem("zchat_avatar_url", data.avatar_url);
            }
            if (typeof renderAvatarPreview === "function") renderAvatarPreview();
        } catch (err) {
            console.error("[ZChat] loadAvatarFromAccount error:", err);
        }
    }

    /* ============ DOM REFS ============ */
    const usernameField = document.getElementById("usernameField");
    const usernamePreview = document.getElementById("usernamePreview");
    const usernameError = document.getElementById("usernameError");
    const bioField = document.getElementById("bioField");

    const avatarPreview = document.getElementById("avatarPreview");
    const presenceDotPreview = document.getElementById("presenceDotPreview");
    const changeAvatarBtn = document.getElementById("changeAvatarBtn");
    const avatarPopover = document.getElementById("avatarPopover");
    const colorSwatches = document.getElementById("colorSwatches");
    const emojiSwatches = document.getElementById("emojiSwatches");
    const photoPanel = document.getElementById("photoPanel");
    const avatarFileInput = document.getElementById("avatarFileInput");
    const uploadPhotoBtn = document.getElementById("uploadPhotoBtn");
    const uploadPhotoBtnLabel = document.getElementById("uploadPhotoBtnLabel");
    const photoUploadError = document.getElementById("photoUploadError");
    let isUploadingAvatar = false;

    const presenceBtns = document.querySelectorAll(".presence-btn");

    const themeSwitch = document.getElementById("themeSwitch");
    const themeIcon = document.getElementById("themeIcon");
    const themeLabel = document.getElementById("themeLabel");

    const form = document.getElementById("profileForm");
    const toast = document.getElementById("toast");
    const toastMsg = document.getElementById("toastMsg");

    const PRESENCE_COLORS = { online: "var(--online)", away: "var(--away)", dnd: "var(--dnd)" };

    /* ============ RENDER ============ */
    function renderAvatarPreview() {
        if (draft.avatarType === "photo" && draft.avatarUrl) {
            avatarPreview.style.backgroundColor = "var(--elevated2)";
            avatarPreview.innerHTML = `<img src="${draft.avatarUrl}" alt="Avatar" class="h-full w-full rounded-full object-cover" />`;
        } else {
            avatarPreview.style.backgroundColor = draft.avatarType === "emoji" ? "var(--elevated2)" : draft.avatarColor;
            avatarPreview.textContent = draft.avatarType === "emoji" ? draft.avatarEmoji : initials(draft.username || savedUsername);
        }
        if (presenceDotPreview) { presenceDotPreview.style.display = "none"; }
    }

    function renderPresenceButtons() {
        presenceBtns.forEach((btn) => {
            const active = btn.dataset.presence === draft.presence;
            btn.setAttribute("aria-pressed", String(active));
        });
    }

    function renderUsernamePreview() {
        const name = usernameField.value.trim() || savedUsername;
        usernamePreview.textContent = "@" + name.toLowerCase().replace(/\s+/g, "");
    }

    function renderTheme() {
        const theme = (draft.theme === "light" || draft.theme === "dark")
            ? draft.theme
            : (localStorage.getItem("zchat_theme") || "dark");
        draft.theme = theme;
        try { localStorage.setItem("zchat_theme", theme); } catch (_) {}

        document.documentElement.setAttribute("data-theme", theme);
        if (document.body) document.body.setAttribute("data-theme", theme);
        document.documentElement.style.backgroundColor = theme === "light" ? "#FFFFFF" : "#000000";
        if (document.body) {
            document.body.style.backgroundColor = "var(--canvas)";
            document.body.style.color = "var(--ink)";
        }

        const isLight = theme === "light";
        const lang = localStorage.getItem("zchat_lang") || "en";
        const dict = i18n[lang] || i18n.en;

        if (themeSwitch) {
            themeSwitch.setAttribute("aria-checked", String(isLight));
            themeSwitch.dataset.on = String(isLight);
            const thumb = themeSwitch.querySelector(".switch-thumb");
            if (thumb) thumb.style.transform = isLight ? "translateX(20px)" : "translateX(0)";
        }
        if (themeIcon) themeIcon.setAttribute("data-lucide", isLight ? "sun" : "moon");
        if (themeLabel) themeLabel.textContent = isLight ? dict.lightMode : dict.darkMode;
        try { icons(); } catch (_) {}
    }

    function buildColorSwatches() {
        colorSwatches.innerHTML = AVATAR_COLORS.map((c) => `
      <button type="button" class="color-swatch h-8 w-8 rounded-full transition-transform hover:scale-110" data-color="${c}" style="background-color:${c}"></button>
    `).join("");
        colorSwatches.querySelectorAll(".color-swatch").forEach((btn) => {
            btn.addEventListener("click", () => {
                draft.avatarType = "initials";
                draft.avatarColor = btn.dataset.color;
                draft.avatarUrl = "";
                renderAvatarPreview();
                avatarPopover.classList.add("hidden");
                // Đồng bộ màu avatar lên tài khoản ngay
                syncAvatarToAccount({
                    avatar_type: "initials",
                    avatar_color: draft.avatarColor,
                    avatar_emoji: null,
                    avatar_url: null,
                });
            });
        });
    }

    function buildEmojiSwatches() {
        emojiSwatches.innerHTML = EMOJIS.map((e) => `
      <button type="button" class="emoji-swatch text-lg p-1.5 rounded-lg transition-colors" data-emoji="${e}">${e}</button>
    `).join("");
        emojiSwatches.querySelectorAll(".emoji-swatch").forEach((btn) => {
            btn.addEventListener("mouseover", () => (btn.style.backgroundColor = "var(--elevated2)"));
            btn.addEventListener("mouseout", () => (btn.style.backgroundColor = "transparent"));
            btn.addEventListener("click", () => {
                draft.avatarType = "emoji";
                draft.avatarEmoji = btn.dataset.emoji;
                draft.avatarUrl = "";
                renderAvatarPreview();
                avatarPopover.classList.add("hidden");
                // Đồng bộ emoji avatar lên tài khoản ngay
                syncAvatarToAccount({
                    avatar_type: "emoji",
                    avatar_color: null,
                    avatar_emoji: draft.avatarEmoji,
                    avatar_url: null,
                });
            });
        });
    }

    /* ============ INIT FORM VALUES ============ */
    usernameField.value = saved.username;
    bioField.value = saved.bio;
    buildColorSwatches();
    buildEmojiSwatches();
    renderAvatarPreview();
    renderPresenceButtons();
    renderUsernamePreview();
    applyLanguage();
    renderTheme();

    /* ============ EVENTS ============ */
    usernameField.addEventListener("input", () => {
        draft.username = usernameField.value;
        renderUsernamePreview();
        renderAvatarPreview();
        if (usernameField.value.trim()) usernameError.classList.add("hidden");
    });

    bioField.addEventListener("input", () => {
        draft.bio = bioField.value;
    });

    changeAvatarBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        avatarPopover.classList.toggle("hidden");
    });
    document.addEventListener("click", (e) => {
        if (!avatarPopover.contains(e.target) && e.target !== changeAvatarBtn) {
            avatarPopover.classList.add("hidden");
        }
    });

    document.querySelectorAll(".avatar-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".avatar-tab").forEach((t) => {
                t.style.backgroundColor = "transparent";
                t.style.color = "var(--muted)";
            });
            tab.style.backgroundColor = "var(--ink)";
            tab.style.color = "var(--bubble-sent-text)";
            const isColor = tab.dataset.avatarTab === "color";
            const isEmoji = tab.dataset.avatarTab === "emoji";
            const isPhoto = tab.dataset.avatarTab === "photo";
            colorSwatches.classList.toggle("hidden", !isColor);
            emojiSwatches.classList.toggle("hidden", !isEmoji);
            if (photoPanel) {
                photoPanel.classList.toggle("hidden", !isPhoto);
                photoPanel.classList.toggle("flex", isPhoto);
            }
        });
    });
    document.querySelector('.avatar-tab[data-avatar-tab="' + (saved.avatarType === "photo" ? "photo" : saved.avatarType === "emoji" ? "emoji" : "color") + '"]').click();

    /* ============ AVATAR PHOTO UPLOAD (Supabase Storage: bucket "avatars") ============ */
    const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB
    const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif"];

    function sanitizeForPath(name) {
        return (name || "user")
            .toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // bỏ dấu tiếng Việt
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "user";
    }

    function setUploadError(message) {
        if (!photoUploadError) return;
        if (message) {
            photoUploadError.textContent = message;
            photoUploadError.classList.remove("hidden");
        } else {
            photoUploadError.classList.add("hidden");
        }
    }

    function setUploadingState(uploading) {
        isUploadingAvatar = uploading;
        const lang = localStorage.getItem("zchat_lang") || "en";
        const dict = i18n[lang] || i18n.en;
        if (uploadPhotoBtn) uploadPhotoBtn.disabled = uploading;
        if (uploadPhotoBtnLabel) uploadPhotoBtnLabel.textContent = uploading ? dict.uploading : dict.uploadPhoto;
        if (uploadPhotoBtn) uploadPhotoBtn.style.opacity = uploading ? "0.6" : "1";
    }

    if (uploadPhotoBtn && avatarFileInput) {
        uploadPhotoBtn.addEventListener("click", () => {
            if (isUploadingAvatar) return;
            avatarFileInput.click();
        });

        avatarFileInput.addEventListener("change", async () => {
            const file = avatarFileInput.files && avatarFileInput.files[0];
            avatarFileInput.value = ""; // cho phép chọn lại cùng 1 file lần sau
            if (!file) return;

            setUploadError("");

            if (!ALLOWED_MIME.includes(file.type)) {
                setUploadError("Unsupported file type. Please use PNG, JPG, WEBP or GIF.");
                return;
            }
            if (file.size > MAX_AVATAR_BYTES) {
                setUploadError("Image is too large. Max size is 5MB.");
                return;
            }
            if (!window.supabaseClient) {
                setUploadError("Can't connect to storage right now. Please try again later.");
                return;
            }

            setUploadingState(true);
            try {
                const userId = await resolveAccountUserId();
                if (!userId) {
                    throw new Error("Could not resolve account id. Please re-login and try again.");
                }

                const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
                // Path theo user id + timestamp → URL mới mỗi lần (tránh cache ảnh cũ)
                const path = `${userId}/avatar_${Date.now()}.${ext}`;

                const { error: uploadErr } = await window.supabaseClient
                    .storage
                    .from("avatars")
                    .upload(path, file, { upsert: false, cacheControl: "3600", contentType: file.type });

                if (uploadErr) throw uploadErr;

                const { data: publicUrlData } = window.supabaseClient
                    .storage
                    .from("avatars")
                    .getPublicUrl(path);

                const publicUrl = publicUrlData && publicUrlData.publicUrl;
                if (!publicUrl) throw new Error("Could not get public URL");

                // Lưu URL kèm version → mọi thiết bị load ảnh mới
                const versionedUrl = `${publicUrl}?v=${Date.now()}`;
                draft.avatarType = "photo";
                draft.avatarUrl = versionedUrl;
                renderAvatarPreview();
                avatarPopover.classList.add("hidden");

                const ok = await syncAvatarToAccount({
                    avatar_type: "photo",
                    avatar_url: versionedUrl,
                    avatar_color: null,
                    avatar_emoji: null,
                });
                if (!ok) {
                    setUploadError("Photo uploaded but not synced to account. Press Save Changes.");
                }
            } catch (err) {
                console.error("[ZChat] Avatar upload error:", err);
                setUploadError(err.message || "Upload failed. Please try again.");
            } finally {
                setUploadingState(false);
            }
        });
    }

    presenceBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            draft.presence = btn.dataset.presence;
            renderPresenceButtons();
            renderAvatarPreview();
        });
    });

    if (themeSwitch) {
        themeSwitch.addEventListener("click", () => {
            draft.theme = draft.theme === "light" ? "dark" : "light";
            try { localStorage.setItem("zchat_theme", draft.theme); } catch (_) {}
            renderTheme();
        });
    }

    let toastTimeout = null;
    function showToast(message) {
        toastMsg.textContent = message;
        toast.classList.remove("opacity-0", "translate-y-4", "pointer-events-none");
        toast.classList.add("opacity-100", "translate-y-0");
        icons();

        if (toastTimeout) clearTimeout(toastTimeout);

        toastTimeout = setTimeout(() => {
            toast.classList.remove("opacity-100", "translate-y-0");
            toast.classList.add("opacity-0", "translate-y-4", "pointer-events-none");
        }, 3000);
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = usernameField.value.trim();
        if (!name) {
            usernameError.classList.remove("hidden");
            usernameField.focus();
            return;
        }

        localStorage.setItem("zchat_bio", bioField.value.trim() || "Available");
        localStorage.setItem("zchat_presence", draft.presence);
        localStorage.setItem("zchat_avatar_type", draft.avatarType);
        localStorage.setItem("zchat_avatar_color", draft.avatarColor);
        localStorage.setItem("zchat_avatar_emoji", draft.avatarEmoji);
        localStorage.setItem("zchat_avatar_url", draft.avatarUrl || "");
        localStorage.setItem("zchat_theme", draft.theme);

        // Đổi username lên Supabase (nếu có thay đổi) — dùng RPC rename_username
        // để tự động migrate luôn sender_username + chat_id của tin nhắn cũ
        const usernameChanged = savedUsername && name.toLowerCase() !== savedUsername.toLowerCase();
        if (usernameChanged && window.supabaseClient) {
            try {
                const { data: renamedRows, error: renameErr } = await window.supabaseClient
                    .rpc("rename_username", { p_new_username: name });

                if (renameErr) {
                    console.error("[ZChat] rename_username error:", renameErr);
                    usernameError.textContent = renameErr.message || "Could not change username.";
                    usernameError.classList.remove("hidden");
                    return; // đừng lưu localStorage với username mới nếu server từ chối
                }
                console.log("[ZChat] Username renamed on server:", renamedRows);
            } catch (err) {
                console.error("[ZChat] rename_username exception:", err);
                usernameError.textContent = "Could not change username. Please try again.";
                usernameError.classList.remove("hidden");
                return;
            }
        }
        usernameError.classList.add("hidden");

        localStorage.setItem("zchat_username", name);

        // Lưu avatar vào tài khoản trên Supabase (đồng bộ PC / điện thoại / trình duyệt)
        if (window.supabaseClient) {
            try {
                // Giữ nguyên URL (kể cả ?v=) — không cắt query
                const avatarUrlToSave = draft.avatarUrl || null;
                const accountKey = savedUsername || name;
                const { data: updatedRows, error } = await window.supabaseClient
                    .from("users")
                    .update({
                        avatar_type: draft.avatarType,
                        avatar_color: draft.avatarColor || null,
                        avatar_emoji: draft.avatarEmoji || null,
                        avatar_url: avatarUrlToSave,
                    })
                    .ilike("username", accountKey)
                    .select("username");

                if (error) {
                    console.error("[ZChat] Sync avatar to Supabase error:", error);
                } else if (!updatedRows || updatedRows.length === 0) {
                    console.warn(`[ZChat] Sync avatar: không khớp username="${accountKey}" trong bảng users.`);
                } else {
                    console.log("[ZChat] Avatar saved to account:", updatedRows);
                    if (avatarUrlToSave) {
                        draft.avatarUrl = avatarUrlToSave;
                        localStorage.setItem("zchat_avatar_url", avatarUrlToSave);
                    }
                }
            } catch (err) {
                console.error("[ZChat] Sync avatar to Supabase exception:", err);
            }
        }

        saved.username = name;
        const lang = localStorage.getItem("zchat_lang") || "en";
        const dict = i18n[lang] || i18n.en;
        showToast(dict.successToast);
    });

    icons();
    // Đồng bộ avatar từ tài khoản (sau khi DOM/render sẵn sàng)
    loadAvatarFromAccount();
})();
