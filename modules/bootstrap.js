function hideAppLoading() {
    const el = document.getElementById("appLoading");
    if (!el) return;
    el.classList.add("is-done");
    setTimeout(() => { try { el.remove(); } catch (_) {} }, 280);
}
window.zchatEnterApp = enterApp;

applyLanguage();
if (currentUsername) {
    enterApp(currentUsername);
} else {
    onboarding.classList.remove("hidden");
    hideAppLoading();
}

subscribeToMessages();
subscribeToUserAvatarChanges();
icons();
