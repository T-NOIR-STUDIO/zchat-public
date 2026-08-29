/* ============================================================
 * 01-i18n.js
 * Từ điển đa ngôn ngữ (EN/VI/ZH/RU) + applyLanguage(). Không phụ thuộc file nào khác.
 * ============================================================ */
function getVerifiedBadge(isVerified) {
    if (!isVerified) return "";
    return `<svg class="inline-block flex-shrink-0 text-blue-500" width="18" height="18" viewBox="0 0 22 22" fill="currentColor" style="margin-left:3px;vertical-align:-3px" title="Verified"><path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"/></svg>`;
}

/* ============ I18N DICTIONARY (EN, VI, ZH, RU) ============ */
const i18n = {
    en: {
        welcomeTitle: "Welcome to ZChat",
        welcomeDesc: "Private & Encrypted Messenger",
        enterUsername: "Enter username:",
        usernameErr: "Please enter a username to continue.",
        createAccount: "Create new account",
        chatTitle: "Chat",
        searchPlaceholder: "Search conversations",
        noMatch: "No conversations match your search",
        startConvTitle: "Start conversation",
        startConvDesc: "Pick a chat from the list, or start a new one.",
        newChatBtn: "New chat",
        typeMessage: "Message",
        sentPhoto: "Sent a photo",
        youSentPhoto: "You sent a photo",
        noMessagesYet: "No messages yet",
        newChatModalTitle: "New Conversation",
        newChatModalDesc: "Enter the name or username of the person you want to chat with:",
        startChatBtn: "Start Chat",
        cancelBtn: "Cancel",
        newChatInputPlaceholder: "Search or enter username...",
        infoTitle: "Contact Info",
        disappearingTitle: "Disappearing messages",
        disappearingDesc: "Auto delete after time",
        blockScreenshotsTitle: "Block Screenshots",
        blockScreenshotsDesc: "Prevent screen capture",
        optionOff: "Off",
        option10s: "10 seconds",
        option1m: "1 minute",
        option10m: "10 minutes",
        option24h: "24 hours",
        screenshotBlocked: "This conversation prohibits screenshots",
        haveAccount: "Already have an account?",
        loginLink: "Login",
        noAccount: "Don't have an account?",
        createOneLink: "Create one",
        loginUsername: "Username",
        recoveryPassword: "Recovery Password",
        enterChat: "Enter Chat",
        loginErrorEmpty: "Please enter username and recovery password.",
        loginErrorInvalid: "Invalid username or recovery password.",
        recoveryModalTitle: "Account created!",
        recoveryModalDesc: "Save your Recovery Password. You will need it to log in again.",
        recoveryModalLabel: "Recovery Password",
        recoveryModalWarn: "This password is only shown once. Store it somewhere safe.",
        recoveryContinue: "Continue to Chat",
        copied: "Copied!",
        editMsg: "Edit",
        deleteMsg: "Delete",
        editModalTitle: "Edit Message",
        saveBtn: "Save",
        confirmDelete: "Are you sure you want to delete this message?",
        editedTag: "(edited)",
        confirmDeleteTitle: "Delete Message",
        deleteBtn: "Delete"
    },
    vi: {
        welcomeTitle: "Chào mừng đến với ZChat",
        welcomeDesc: "Ứng dụng nhắn tin bảo mật & mã hóa",
        enterUsername: "Nhập tên người dùng:",
        usernameErr: "Vui lòng nhập tên người dùng để tiếp tục.",
        createAccount: "Tạo tài khoản mới",
        chatTitle: "Trò chuyện",
        searchPlaceholder: "Tìm kiếm cuộc trò chuyện",
        noMatch: "Không tìm thấy cuộc trò chuyện phù hợp",
        startConvTitle: "Bắt đầu cuộc trò chuyện",
        startConvDesc: "Chọn một đoạn chat từ danh sách hoặc tạo cuộc trò chuyện mới.",
        newChatBtn: "Tin nhắn mới",
        typeMessage: "Tin nhắn",
        sentPhoto: "Đã gửi một ảnh",
        youSentPhoto: "Bạn đã gửi một ảnh",
        noMessagesYet: "Chưa có tin nhắn",
        newChatModalTitle: "Cuộc trò chuyện mới",
        newChatModalDesc: "Nhập tên hoặc username của người bạn muốn nhắn tin:",
        startChatBtn: "Bắt đầu chat",
        cancelBtn: "Hủy",
        newChatInputPlaceholder: "Tìm kiếm hoặc nhập username...",
        infoTitle: "Thông tin liên hệ",
        disappearingTitle: "Tin nhắn tự xóa",
        disappearingDesc: "Tự động xóa sau thời gian",
        blockScreenshotsTitle: "Chặn chụp màn hình",
        blockScreenshotsDesc: "Ngăn chụp ảnh màn hình",
        optionOff: "Tắt",
        option10s: "10 giây",
        option1m: "1 phút",
        option10m: "10 phút",
        option24h: "24 giờ",
        screenshotBlocked: "Cuộc trò chuyện này cấm chụp màn hình",
        haveAccount: "Đã có tài khoản?",
        loginLink: "Đăng nhập",
        noAccount: "Chưa có tài khoản?",
        createOneLink: "Tạo tài khoản",
        loginUsername: "Tên người dùng",
        recoveryPassword: "Mật khẩu khôi phục",
        enterChat: "Vào Chat",
        loginErrorEmpty: "Vui lòng nhập tên người dùng và mật khẩu khôi phục.",
        loginErrorInvalid: "Tên người dùng hoặc mật khẩu khôi phục không đúng.",
        recoveryModalTitle: "Tạo tài khoản thành công!",
        recoveryModalDesc: "Hãy lưu Mật khẩu khôi phục. Bạn sẽ cần nó để đăng nhập lại.",
        recoveryModalLabel: "Mật khẩu khôi phục",
        recoveryModalWarn: "Mật khẩu này chỉ hiện một lần. Hãy lưu ở nơi an toàn.",
        recoveryContinue: "Tiếp tục vào Chat",
        copied: "Đã sao chép!",
        editMsg: "Chỉnh sửa",
        deleteMsg: "Xóa",
        editModalTitle: "Chỉnh sửa tin nhắn",
        saveBtn: "Save",
        confirmDelete: "Bạn có chắc chắn muốn xóa tin nhắn này?",
        editedTag: "(đã chỉnh sửa)",
        confirmDeleteTitle: "Xóa tin nhắn",
        deleteBtn: "Xóa"
    },
    zh: {
        welcomeTitle: "欢迎使用 ZChat",
        welcomeDesc: "私密与加密即时通讯",
        enterUsername: "输入用户名：",
        usernameErr: "请输入用户名以继续。",
        createAccount: "创建新账户",
        chatTitle: "聊天",
        searchPlaceholder: "搜索对话",
        noMatch: "未找到匹配的对话",
        startConvTitle: "发起对话",
        startConvDesc: "从列表中选择一个聊天，或发起新对话。",
        newChatBtn: "新聊天",
        typeMessage: "信息",
        sentPhoto: "发送了一张照片",
        youSentPhoto: "你发送了一张照片",
        noMessagesYet: "暂无消息",
        newChatModalTitle: "新对话",
        newChatModalDesc: "输入您想与其聊天的联系人姓名或用户名：",
        startChatBtn: "开始聊天",
        cancelBtn: "取消",
        newChatInputPlaceholder: "搜索或输入用户名...",
        infoTitle: "联系人信息",
        disappearingTitle: "阅后即焚消息",
        disappearingDesc: "定时自动删除",
        blockScreenshotsTitle: "禁止截屏",
        blockScreenshotsDesc: "防止截屏与录屏",
        optionOff: "关闭",
        option10s: "10秒",
        option1m: "1分钟",
        option10m: "10分钟",
        option24h: "24小时",
        screenshotBlocked: "此对话禁止截屏",
        haveAccount: "已有账户？",
        loginLink: "登录",
        noAccount: "还没有账户？",
        createOneLink: "创建账户",
        loginUsername: "用户名",
        recoveryPassword: "恢复密码",
        enterChat: "进入聊天",
        loginErrorEmpty: "请输入用户名和恢复密码。",
        loginErrorInvalid: "用户名或恢复密码无效。",
        recoveryModalTitle: "账户创建成功！",
        recoveryModalDesc: "请保存您的恢复密码。再次登录时需要用到。",
        recoveryModalLabel: "恢复密码",
        recoveryModalWarn: "此密码仅显示一次。请妥善保管。",
        recoveryContinue: "继续进入聊天",
        copied: "已复制！",
        editMsg: "编辑",
        deleteMsg: "删除",
        editModalTitle: "编辑消息",
        saveBtn: "保存",
        confirmDelete: "您确定要删除这条消息吗？",
        editedTag: "(已编辑)",
        confirmDeleteTitle: "删除消息",
        deleteBtn: "删除"
    },
    ru: {
        welcomeTitle: "Добро пожаловать в ZChat",
        welcomeDesc: "Зашифрованный мессенджер",
        enterUsername: "Введите имя пользователя:",
        usernameErr: "Пожалуйста, введите имя пользователя.",
        createAccount: "Создать аккаунт",
        chatTitle: "Чат",
        searchPlaceholder: "Поиск чатов",
        noMatch: "Разговоры не найдены",
        startConvTitle: "Начать разговор",
        startConvDesc: "Выберите чат из списка или нажмите новый.",
        newChatBtn: "Новый чат",
        typeMessage: "Сообщение",
        sentPhoto: "Отправил(а) фото",
        youSentPhoto: "Вы отправили фото",
        noMessagesYet: "Нет сообщений",
        newChatModalTitle: "Новый разговор",
        newChatModalDesc: "Введите имя или имя пользователя:",
        startChatBtn: "Начать чат",
        cancelBtn: "Отмена",
        newChatInputPlaceholder: "Поиск или имя пользователя...",
        infoTitle: "Информация",
        disappearingTitle: "Исчезающие сообщения",
        disappearingDesc: "Автоудаление через время",
        blockScreenshotsTitle: "Запрет скриншотов",
        blockScreenshotsDesc: "Защита от снимков экрана",
        optionOff: "Выкл",
        option10s: "10 сек",
        option1m: "1 мин",
        option10m: "10 мин",
        option24h: "24 час",
        screenshotBlocked: "В этом чате запрещены скриншоты",
        haveAccount: "Уже есть аккаунт?",
        loginLink: "Войти",
        noAccount: "Нет аккаунта?",
        createOneLink: "Создать",
        loginUsername: "Имя пользователя",
        recoveryPassword: "Пароль восстановления",
        enterChat: "Войти в чат",
        loginErrorEmpty: "Введите имя пользователя и пароль восстановления.",
        loginErrorInvalid: "Неверное имя пользователя или пароль восстановления.",
        recoveryModalTitle: "Аккаунт создан!",
        recoveryModalDesc: "Сохраните пароль восстановления. Он понадобится для входа.",
        recoveryModalLabel: "Пароль восстановления",
        recoveryModalWarn: "Пароль показывается только один раз. Храните его в безопасном месте.",
        recoveryContinue: "Перейти в чат",
        copied: "Скопировано!",
        editMsg: "Редактировать",
        deleteMsg: "Удалить",
        editModalTitle: "Редактировать сообщение",
        saveBtn: "Сохранить",
        confirmDelete: "Вы уверены, что хотите удалить это сообщение?",
        editedTag: "(изменено)",
        confirmDeleteTitle: "Удалить сообщение",
        deleteBtn: "Удалить"
    }
};

function applyLanguage() {
    const lang = localStorage.getItem("zchat_lang") || "en";
    const dict = i18n[lang] || i18n.en;

    const welcomeTitle = document.getElementById("onboardingTitle") || document.querySelector("#onboarding h1");
    if (welcomeTitle) welcomeTitle.textContent = dict.welcomeTitle;
    const welcomeDesc = document.getElementById("onboardingDesc");
    if (welcomeDesc) welcomeDesc.textContent = dict.welcomeDesc;
    const labelUsername = document.getElementById("lblEnterUsername") || document.querySelector("label[for='usernameInput']");
    if (labelUsername) labelUsername.textContent = dict.enterUsername;
    if (usernameError) usernameError.textContent = dict.usernameErr;
    const submitBtn = document.getElementById("createAccountBtn") || document.querySelector("#onboardingForm button[type='submit']");
    if (submitBtn) submitBtn.textContent = dict.createAccount;

    const elHave = document.getElementById("txtHaveAccount");
    if (elHave) elHave.textContent = (dict.haveAccount || "") + " ";
    const elLoginLink = document.getElementById("switchToLoginBtn");
    if (elLoginLink) elLoginLink.textContent = dict.loginLink || "Login";
    const elNoAcc = document.getElementById("txtNoAccount");
    if (elNoAcc) elNoAcc.textContent = (dict.noAccount || "") + " ";
    const elCreateOne = document.getElementById("switchToRegisterBtn");
    if (elCreateOne) elCreateOne.textContent = dict.createOneLink || "Create one";
    const elLblLoginUser = document.getElementById("lblLoginUsername");
    if (elLblLoginUser) elLblLoginUser.textContent = dict.loginUsername || "Username";
    const elLblRecovery = document.getElementById("lblRecoveryPassword");
    if (elLblRecovery) elLblRecovery.textContent = dict.recoveryPassword || "Recovery Password";
    const elLoginBtn = document.getElementById("loginBtn");
    if (elLoginBtn) elLoginBtn.textContent = dict.enterChat || "Enter Chat";

    const elRecTitle = document.getElementById("recoveryModalTitle");
    if (elRecTitle) elRecTitle.textContent = dict.recoveryModalTitle || "Account created!";
    const elRecDesc = document.getElementById("recoveryModalDesc");
    if (elRecDesc) elRecDesc.textContent = dict.recoveryModalDesc || "";
    const elRecLabel = document.getElementById("recoveryModalLabel");
    if (elRecLabel) elRecLabel.textContent = dict.recoveryModalLabel || "Recovery Password";
    const elRecWarn = document.getElementById("recoveryModalWarn");
    if (elRecWarn) elRecWarn.textContent = dict.recoveryModalWarn || "";
    const elRecContinue = document.getElementById("recoveryContinueBtn");
    if (elRecContinue) elRecContinue.textContent = dict.recoveryContinue || "Continue to Chat";

    const chatTitle = document.querySelector("#sidebarWrap h1");
    if (chatTitle) chatTitle.textContent = dict.chatTitle;
    if (searchInput) searchInput.placeholder = dict.searchPlaceholder;
    if (messageInput) messageInput.placeholder = dict.typeMessage;

    const noMatchText = document.querySelector("#chatListEmpty p");
    if (noMatchText) noMatchText.textContent = dict.noMatch;
    const emptyTitle = document.querySelector("#emptyState h2");
    if (emptyTitle) emptyTitle.textContent = dict.startConvTitle;
    const emptyDesc = document.querySelector("#emptyState p");
    if (emptyDesc) emptyDesc.textContent = dict.startConvDesc;
    if (newChatEmptyBtn) newChatEmptyBtn.textContent = dict.newChatBtn;

    const modalTitle = document.querySelector("#newChatModal h3");
    if (modalTitle) modalTitle.textContent = dict.newChatModalTitle;
    const modalDesc = document.querySelector("#newChatModal p");
    if (modalDesc) modalDesc.textContent = dict.newChatModalDesc;
    if (newChatNameInput) newChatNameInput.placeholder = dict.newChatInputPlaceholder;
    if (cancelModalBtn) cancelModalBtn.textContent = dict.cancelBtn;
    const startChatSubmit = document.querySelector("#newChatForm button[type='submit']");
    if (startChatSubmit) startChatSubmit.textContent = dict.startChatBtn;

    const infoDrawerTitle = document.getElementById("infoDrawerTitle");
    if (infoDrawerTitle) infoDrawerTitle.textContent = dict.infoTitle;
    const disappearingTitle = document.getElementById("disappearingTitle");
    if (disappearingTitle) disappearingTitle.textContent = dict.disappearingTitle;
    const disappearingDesc = document.getElementById("disappearingDesc");
    if (disappearingDesc) disappearingDesc.textContent = dict.disappearingDesc;
    const blockScreenshotsTitle = document.getElementById("blockScreenshotsTitle");
    if (blockScreenshotsTitle) blockScreenshotsTitle.textContent = dict.blockScreenshotsTitle;
    const blockScreenshotsDesc = document.getElementById("blockScreenshotsDesc");
    if (blockScreenshotsDesc) blockScreenshotsDesc.textContent = dict.blockScreenshotsDesc;

    const optionLabels = {
        off: dict.optionOff,
        "10s": dict.option10s,
        "1m": dict.option1m,
        "10m": dict.option10m,
        "24h": dict.option24h
    };
    disappearingOptions.forEach((opt) => {
        const val = opt.getAttribute("data-value");
        const labelEl = opt.querySelector(".opt-label") || opt.querySelector("span");
        if (labelEl && optionLabels[val]) {
            labelEl.textContent = optionLabels[val];
        }
    });
    const chat = state.chats.find((c) => c.id === state.activeChatId);
    if (chat) {
        updateDisappearingUI(chat.disappearingTime || "off");
    }
}

window.addEventListener("storage", (e) => {
    if (e.key === "zchat_lang") {
        applyLanguage();
    }
});
