/* ZChat Passcode Lock*/
(function () {
    "use strict";

    const MAX_ATTEMPTS = 20;
    const LOCK_SECONDS = 30;
    const TTL_MS = 50 * 60 * 60 * 1000; // 50 hours
    const APP_URL = "index.html";
    const LS_UNLOCKED_AT = "zchat_passcode_unlocked_at";
    const LS_FAILS = "zchat_passcode_fails";
    const LS_LOCK_UNTIL = "zchat_passcode_lock_until";

    let mode = "enter";
    let buffer = "";
    let firstPass = "";
    let lockedUntil = 0;
    let timerId = null;
    let busy = false;

    const $ = (id) => document.getElementById(id);
    const titleEl = $("passTitle");
    const subEl = $("passSubtitle");
    const errorEl = $("passError");
    const timerEl = $("lockTimer");
    const attemptsEl = $("attemptsLeft");
    const dotsWrap = $("passDots");
    const screen = $("passcodeScreen");
    const betaBlocked = $("betaBlocked");
    const hiddenInput = $("passHiddenInput");
    const dotsHit = $("passDotsHit");

    function username() { return (localStorage.getItem("zchat_username") || "").trim(); }
    function userId() { return localStorage.getItem("zchat_user_id") || null; }

    function applyThemeFromSettings() {
        try {
            const t = localStorage.getItem("zchat_theme") || localStorage.getItem("theme") || "system";
            const dark = t === "dark" || (t !== "light" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
            document.documentElement.classList.toggle("dark", !!dark);
            document.documentElement.dataset.theme = dark ? "dark" : "light";
        } catch (_) {}
    }

    function setMode(m) {
        mode = m;
        buffer = "";
        if (hiddenInput) hiddenInput.value = "";
        renderDots();
        hideError();
        if (m === "create") {
            if (titleEl) titleEl.textContent = "Create a passcode";
            if (subEl) subEl.textContent = "Choose a 4-digit passcode";
        } else if (m === "confirm") {
            if (titleEl) titleEl.textContent = "Confirm passcode";
            if (subEl) subEl.textContent = "Re-enter your 4-digit passcode";
        } else {
            if (titleEl) titleEl.textContent = "Enter a passcode";
            if (subEl) subEl.textContent = "Enter your 4-digit passcode";
        }
        focusInput();
    }

    function renderDots(errorFlash) {
        if (!dotsWrap) return;
        dotsWrap.querySelectorAll(".pass-dot").forEach((d, i) => {
            d.classList.toggle("filled", i < buffer.length);
            d.classList.toggle("error", !!errorFlash && i < 4);
        });
        if (errorFlash) {
            dotsWrap.classList.remove("pass-shake");
            void dotsWrap.offsetWidth;
            dotsWrap.classList.add("pass-shake");
        }
    }

    function hideError() {
        if (errorEl) { errorEl.classList.add("hidden"); errorEl.textContent = ""; }
    }
    function showError(msg) {
        if (errorEl) { errorEl.textContent = msg; errorEl.classList.remove("hidden"); }
    }

    function getFailCount() { return parseInt(sessionStorage.getItem(LS_FAILS) || "0", 10) || 0; }
    function setFailCount(n) { sessionStorage.setItem(LS_FAILS, String(n)); }

    function updateAttemptsHint() {
        const n = getFailCount();
        if (!attemptsEl) return;
        attemptsEl.textContent = (n > 0 && n < MAX_ATTEMPTS) ? `${MAX_ATTEMPTS - n} attempts left` : "";
    }

    function setInputEnabled(on) {
        if (!hiddenInput) return;
        hiddenInput.disabled = !on;
        if (on) focusInput();
    }

    function focusInput() {
        if (!hiddenInput || hiddenInput.disabled) return;
        try { hiddenInput.focus({ preventScroll: true }); } catch (_) { hiddenInput.focus(); }
    }

    function startLock(seconds) {
        lockedUntil = Date.now() + seconds * 1000;
        sessionStorage.setItem(LS_LOCK_UNTIL, String(lockedUntil));
        setInputEnabled(false);
        if (timerEl) timerEl.classList.remove("hidden");
        showError("Too many attempts. Try again later.");
        tickLock();
        if (timerId) clearInterval(timerId);
        timerId = setInterval(tickLock, 250);
    }

    function tickLock() {
        const left = Math.max(0, lockedUntil - Date.now());
        if (left <= 0) {
            if (timerId) clearInterval(timerId);
            timerId = null;
            lockedUntil = 0;
            sessionStorage.removeItem(LS_LOCK_UNTIL);
            setFailCount(0);
            setInputEnabled(true);
            if (timerEl) { timerEl.classList.add("hidden"); timerEl.textContent = ""; }
            hideError();
            updateAttemptsHint();
            return;
        }
        if (timerEl) {
            timerEl.classList.remove("hidden");
            timerEl.textContent = `0:${String(Math.ceil(left / 1000)).padStart(2, "0")}`;
        }
    }

    function restoreLockIfNeeded() {
        const until = parseInt(sessionStorage.getItem(LS_LOCK_UNTIL) || "0", 10) || 0;
        if (until > Date.now()) {
            lockedUntil = until;
            setInputEnabled(false);
            if (timerEl) timerEl.classList.remove("hidden");
            showError("Too many attempts. Try again later.");
            tickLock();
            if (timerId) clearInterval(timerId);
            timerId = setInterval(tickLock, 250);
            return true;
        }
        sessionStorage.removeItem(LS_LOCK_UNTIL);
        return false;
    }

    async function resolveUserId() {
        let uid = userId();
        if (uid) return uid;
        const uname = username();
        if (!window.supabaseClient || !uname) return null;
        const { data } = await window.supabaseClient
            .from("users").select("id").ilike("username", uname).maybeSingle();
        if (data && data.id) {
            localStorage.setItem("zchat_user_id", data.id);
            return data.id;
        }
        return null;
    }

    async function fetchPasscodeRow() {
        if (!window.supabaseClient) return null;
        try {
            const uid = await resolveUserId();
            if (!uid) return null;
            const { data, error } = await window.supabaseClient
                .from("passcode")
                .select("user_id, passcode")
                .eq("user_id", uid)
                .maybeSingle();
            if (error) {
                console.error("[Passcode] fetch:", error);
                return null;
            }
            return data;
        } catch (e) {
            console.error("[Passcode] fetch:", e);
            return null;
        }
    }

    async function savePasscode(code) {
        if (!window.supabaseClient) throw new Error("Supabase missing");
        const uid = await resolveUserId();
        if (!uid) throw new Error("Missing user_id — hãy đăng nhập trước");
        const { error } = await window.supabaseClient.from("passcode").upsert({
            user_id: uid,
            passcode: code,
            updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        if (error) throw error;
    }

    function unlockAndGo() {
        localStorage.setItem(LS_UNLOCKED_AT, String(Date.now()));
        setFailCount(0);
        sessionStorage.removeItem(LS_LOCK_UNTIL);
        sessionStorage.removeItem("zchat_passcode_ok"); // legacy
        window.location.replace(APP_URL);
    }

    async function onComplete(code) {
        if (busy) return;
        busy = true;
        try {
            if (mode === "create") {
                firstPass = code;
                setMode("confirm");
                return;
            }
            if (mode === "confirm") {
                if (code !== firstPass) {
                    showError("Passcodes do not match");
                    renderDots(true);
                    buffer = "";
                    if (hiddenInput) hiddenInput.value = "";
                    setTimeout(() => { setMode("create"); firstPass = ""; }, 450);
                    return;
                }
                try {
                    await savePasscode(code);
                    unlockAndGo();
                } catch (e) {
                    console.error("[Passcode] save:", e);
                    showError(e.message || "Could not save passcode");
                    buffer = "";
                    if (hiddenInput) hiddenInput.value = "";
                    renderDots(true);
                }
                return;
            }

            try {
                const row = await fetchPasscodeRow();
                if (!row || !row.passcode) {
                    showError("No passcode found. Create one.");
                    setMode("create");
                    return;
                }
                if (String(row.passcode) === code) {
                    unlockAndGo();
                    return;
                }
                const fails = getFailCount() + 1;
                setFailCount(fails);
                updateAttemptsHint();
                showError("Wrong passcode");
                renderDots(true);
                buffer = "";
                if (hiddenInput) hiddenInput.value = "";
                setTimeout(() => renderDots(false), 400);
                if (fails >= MAX_ATTEMPTS) startLock(LOCK_SECONDS);
                else focusInput();
            } catch (e) {
                console.error("[Passcode] verify:", e);
                showError("Error verifying passcode");
                buffer = "";
                if (hiddenInput) hiddenInput.value = "";
                renderDots(true);
            }
        } finally {
            busy = false;
        }
    }

    function setBufferFromDigits(digits) {
        if (lockedUntil && Date.now() < lockedUntil) return;
        const clean = String(digits || "").replace(/\D/g, "").slice(0, 4);
        buffer = clean;
        if (hiddenInput && hiddenInput.value !== clean) hiddenInput.value = clean;
        renderDots();
        hideError();
        if (buffer.length === 4) {
            const code = buffer;
            setTimeout(() => onComplete(code), 60);
        }
    }

    function bindInput() {
        if (dotsHit) dotsHit.addEventListener("click", focusInput);
        document.addEventListener("click", () => {
            if (!hiddenInput || hiddenInput.disabled) return;
            if (document.activeElement !== hiddenInput) focusInput();
        });
        if (hiddenInput) {
            hiddenInput.addEventListener("input", () => setBufferFromDigits(hiddenInput.value));
        }
        window.addEventListener("keydown", (e) => {
            if (lockedUntil && Date.now() < lockedUntil) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key >= "0" && e.key <= "9") {
                if (document.activeElement === hiddenInput) return;
                e.preventDefault();
                setBufferFromDigits(buffer + e.key);
            } else if (e.key === "Backspace") {
                if (document.activeElement === hiddenInput) return;
                e.preventDefault();
                setBufferFromDigits(buffer.slice(0, -1));
            }
        });
    }

    async function init() {
        applyThemeFromSettings();
        if (betaBlocked) betaBlocked.classList.add("hidden");
        if (screen) screen.classList.remove("hidden");

        const name = username();
        if (!name) {
            window.location.replace(APP_URL);
            return;
        }

        // Đã unlock trong 50h → vào app
        const unlockedAt = parseInt(localStorage.getItem(LS_UNLOCKED_AT) || "0", 10) || 0;
        if (unlockedAt > 0 && (Date.now() - unlockedAt) < TTL_MS) {
            window.location.replace(APP_URL);
            return;
        }

        bindInput();
        updateAttemptsHint();
        if (restoreLockIfNeeded()) {
            setMode("enter");
            return;
        }

        const row = await fetchPasscodeRow();
        if (row && row.passcode) setMode("enter");
        else setMode("create");
        focusInput();
    }

    window.ZChatPasscode = { init, TTL_MS };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
