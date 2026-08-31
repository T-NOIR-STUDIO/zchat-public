/* ============================================================
 * 20-chat-image-upload.js
 * Upload/nén ảnh gửi trong chat lên Supabase Storage. Phụ thuộc: 03, 04, 19.
 * ============================================================ */
const MAX_CHAT_IMAGE_BYTES = 50 * 1024 * 1024; // >50MB → nén

function isAllowedChatImage(file) {
    if (!file) return false;
    const type = String(file.type || "").toLowerCase();
    if (type === "image/jpeg" || type === "image/jpg" || type === "image/png") return true;
    const name = String(file.name || "").toLowerCase();
    return /\.(jpe?g|png)$/.test(name);
}

async function compressImageUnderLimit(file, maxBytes) {
    if (!file || file.size <= maxBytes) return file;
    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
    });
    const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("image load failed"));
        image.src = dataUrl;
    });
    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;
    let quality = 0.92;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    for (let attempt = 0; attempt < 12; attempt++) {
        canvas.width = Math.max(1, Math.round(width));
        canvas.height = Math.max(1, Math.round(height));
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", quality));
        if (!blob) break;
        if (blob.size <= maxBytes) {
            const base = (file.name || "image").replace(/\.[^.]+$/, "");
            return new File([blob], base + ".jpg", { type: "image/jpeg", lastModified: Date.now() });
        }
        if (quality > 0.45) quality -= 0.12;
        else { width *= 0.75; height *= 0.75; quality = Math.max(0.4, quality); }
    }
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const lastBlob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.4));
    if (!lastBlob) throw new Error("compress failed");
    const base = (file.name || "image").replace(/\.[^.]+$/, "");
    return new File([lastBlob], base + ".jpg", { type: "image/jpeg", lastModified: Date.now() });
}

async function uploadChatImage(file) {
    if (!window.supabaseClient || !file) return null;
    try {
        // Thư mục theo user_id (không theo username) — đổi tên không mất ảnh
        let folder = myUserIdCache || localStorage.getItem("zchat_user_id") || "";
        if (!folder && typeof getMyUserId === "function") {
            try { folder = (await getMyUserId()) || ""; } catch (_) {}
        }
        if (!folder) {
            console.error("[ZChat] uploadChatImage: missing user id");
            return null;
        }
        const ext = (file.name && file.name.split(".").pop()) || "jpg";
        const safeExt = String(ext).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "jpg";
        const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${safeExt}`;

        const { error: upErr } = await window.supabaseClient.storage
            .from("chat-images")
            .upload(path, file, {
                cacheControl: "3600",
                upsert: false,
                contentType: file.type || "image/jpeg",
            });
        if (upErr) {
            console.error("[ZChat] uploadChatImage error:", upErr);
            return null;
        }
        const { data } = window.supabaseClient.storage.from("chat-images").getPublicUrl(path);
        return (data && data.publicUrl) || null;
    } catch (err) {
        console.error("[ZChat] uploadChatImage exception:", err);
        return null;
    }
}

if (fileInput) {
    // Hộp chọn file: chỉ hiện PNG / JPG / JPEG (ẩn video & file khác)
    try {
        fileInput.setAttribute("accept", "image/png,image/jpeg,.png,.jpg,.jpeg");
    } catch (_) {}

    fileInput.addEventListener("change", async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const chat = state.chats.find((c) => c.id === state.activeChatId);
        if (!chat) {
            fileInput.value = "";
            return;
        }

        if (!isAllowedChatImage(file)) {
            alert("Chỉ được gửi ảnh PNG, JPG hoặc JPEG.");
            fileInput.value = "";
            return;
        }

        let toUpload = file;
        try {
            if (file.size > MAX_CHAT_IMAGE_BYTES) {
                toUpload = await compressImageUnderLimit(file, MAX_CHAT_IMAGE_BYTES);
                if (!toUpload || toUpload.size > MAX_CHAT_IMAGE_BYTES) {
                    alert("Ảnh quá lớn. Không thể nén xuống dưới 50MB.");
                    fileInput.value = "";
                    return;
                }
            }
        } catch (err) {
            console.error("[ZChat] compress image:", err);
            alert("Không thể nén ảnh. Thử ảnh nhỏ hơn.");
            fileInput.value = "";
            return;
        }

        const imageUrl = await uploadChatImage(toUpload);
        if (imageUrl) {
            const msg = {
                id: uid("m"),
                senderId: "me",
                text: `[IMAGE]:${imageUrl}`,
                createdAt: Date.now(),
                status: "delivered"
            };
            chat.messages.push(msg);
            postMessageToSupabase(msg, chat.id);
            renderMessages(chat);
            renderChatList();
        } else {
            console.error("[ZChat] Image upload failed — no public URL");
            alert("Upload ảnh thất bại. Thử lại.");
        }

        fileInput.value = "";
    });
}
