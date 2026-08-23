/**
 * Z-Chat WebRTC 1-1 Video Call client (FIXED: Auto-hangup & Mobile Cam issue)
 */
(function () {
    "use strict";

    const SIGNAL_URL =
        window.ZCHAT_SIGNAL_URL ||
        localStorage.getItem("zchat_signal_url") ||
        "https://zchat-backend-call.onrender.com";

    const METERED_USER = window.ZCHAT_TURN_USER || "2bcc0de831c3742cc7c4c4aa";
    const METERED_PASS = window.ZCHAT_TURN_PASS || "fxTk7UPyGXEeDjN1";

    const ICE_SERVERS = {
        iceServers: [
            { urls: "stun:stun.relay.metered.ca:80" },
            {
                urls: "turn:standard.relay.metered.ca:80",
                username: METERED_USER,
                credential: METERED_PASS,
            },
            {
                urls: "turns:standard.relay.metered.ca:443?transport=tcp",
                username: METERED_USER,
                credential: METERED_PASS,
            },
        ],
        // Bỏ iceTransportPolicy: "relay" cứng để tránh lỗi nghẽn trên Chrome Mobile
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
    };

    let socket = null;
    let pc = null;
    let localStream = null;
    let remoteStream = null;
    let myUsername = "";
    let peerUsername = "";
    let isCaller = false;
    let callActive = false;
    let pendingOffer = null;
    let micEnabled = true;
    let camEnabled = true;
    let remoteIceCandidatesQueue = [];

    function $(id) { return document.getElementById(id); }

    function icons() {
        if (window.lucide && typeof window.lucide.createIcons === "function") {
            window.lucide.createIcons();
        }
    }

    function show(el) { if (el) el.classList.remove("hidden"); }
    function hide(el) { if (el) el.classList.add("hidden"); }

    function setStatus(text) {
        const el = $("zcCallStatus");
        if (el) el.textContent = text || "";
        document.querySelectorAll(".zc-incall-status").forEach((n) => {
            n.textContent = text || "";
        });
    }

    function peerInitials(name) {
        return (
            (name || "?")
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((s) => s[0].toUpperCase())
                .join("") || "?"
        );
    }

    function resolvePeerParticipant(name) {
        const n = (name || "").trim().toLowerCase();
        if (n && typeof state !== "undefined" && state.chats) {
            const chat = state.chats.find(
                (c) =>
                    c.participant &&
                    c.participant.name &&
                    String(c.participant.name).toLowerCase() === n
            );
            if (chat && chat.participant) return chat.participant;
        }
        return {
            name: name || "?",
            avatarType: "initials",
            avatarColor: null,
            avatarUrl: null,
            avatarEmoji: null,
        };
    }

    function resolveMyParticipant() {
        return {
            name: myUsername || "Me",
            avatarType: localStorage.getItem("zchat_avatar_type") || "initials",
            avatarColor: localStorage.getItem("zchat_avatar_color") || null,
            avatarUrl: localStorage.getItem("zchat_avatar_url") || null,
            avatarEmoji: localStorage.getItem("zchat_avatar_emoji") || null,
        };
    }

    function fillCallAvatarEl(el, participant) {
        if (!el) return;
        const p = participant || { name: "?", avatarType: "initials" };
        const name = p.name || "?";
        const ini = peerInitials(name);

        if (p.avatarType === "photo" && p.avatarUrl) {
            el.innerHTML =
                '<img src="' +
                String(p.avatarUrl).replace(/"/g, "&quot;") +
                '" alt="' +
                ini +
                '" class="h-full w-full rounded-full object-cover select-none" />';
            el.style.background = "transparent";
            el.style.color = "transparent";
            el.style.fontSize = "0";
            return;
        }
        if (p.avatarType === "emoji" && p.avatarEmoji) {
            el.innerHTML = "";
            el.textContent = p.avatarEmoji;
            el.style.background = "#2a2a2a";
            el.style.color = "#fff";
            el.style.fontSize = "";
            return;
        }
        el.innerHTML = "";
        el.textContent = ini;
        el.style.background = p.avatarColor || "#1f1f1f";
        el.style.color = "#fff";
        el.style.fontSize = "";
    }

    function setPeerName(name) {
        const label = name || "Unknown";
        const peer = resolvePeerParticipant(name);
        const me = resolveMyParticipant();

        const el = $("zcCallPeerName");
        if (el) el.textContent = label;

        fillCallAvatarEl($("zcCallPeerAvatar"), peer);
        document.querySelectorAll(".zc-incoming-name, .zc-incall-name").forEach((n) => {
            n.textContent = label;
        });
        document.querySelectorAll(".zc-incoming-avatar").forEach((n) => {
            fillCallAvatarEl(n, peer);
        });
        fillCallAvatarEl($("zcRemoteAvatarCircle"), peer);
        fillCallAvatarEl($("zcLocalAvatarCircle"), me);
    }

    function setLocalCamAvatarVisible(on) {
        const overlay = $("zcLocalAvatarOverlay");
        const video = $("zcLocalVideo");
        if (overlay) {
            if (on) overlay.classList.remove("hidden");
            else overlay.classList.add("hidden");
        }
        if (video) {
            if (on) video.classList.add("zc-cam-off");
            else video.classList.remove("zc-cam-off");
        }
        if (on) fillCallAvatarEl($("zcLocalAvatarCircle"), resolveMyParticipant());
    }

    function setRemoteCamAvatarVisible(on) {
        const overlay = $("zcRemoteAvatarOverlay");
        const video = $("zcRemoteVideo");
        if (overlay) {
            if (on) overlay.classList.remove("hidden");
            else overlay.classList.add("hidden");
        }
        if (video) video.style.opacity = on ? "0" : "1";
        if (on) {
            fillCallAvatarEl(
                $("zcRemoteAvatarCircle"),
                resolvePeerParticipant(peerUsername)
            );
        }
    }

    async function getMedia(video) {
        if (localStream) return localStream;
        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: video
                    ? {
                        facingMode: "user",
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        frameRate: { max: 24 },
                    }
                    : false,
            });
            const localVideo = $("zcLocalVideo");
            if (localVideo) {
                localVideo.srcObject = localStream;
                localVideo.muted = true;
                localVideo.setAttribute("playsinline", "true");
                localVideo.setAttribute("autoplay", "true");
                await localVideo.play().catch(() => {});
            }
            return localStream;
        } catch (e) {
            console.error("Lỗi cấp quyền Media:", e);
            throw e;
        }
    }

    function stopMedia() {
        if (localStream) {
            localStream.getTracks().forEach((t) => t.stop());
            localStream = null;
        }
        const localVideo = $("zcLocalVideo");
        if (localVideo) localVideo.srcObject = null;
        const remoteVideo = $("zcRemoteVideo");
        if (remoteVideo) remoteVideo.srcObject = null;
        remoteStream = null;
    }

    function applyBandwidthLimit() {
        if (!pc) return;
        pc.getSenders().forEach((sender) => {
            if (sender.track && sender.track.kind === "video") {
                const params = sender.getParameters();
                if (!params.encodings || !params.encodings.length) {
                    params.encodings = [{}];
                }
                params.encodings[0].maxBitrate = 400000;
                sender.setParameters(params).catch(() => {});
            }
        });
    }

    async function processQueuedIceCandidates() {
        while (remoteIceCandidatesQueue.length > 0) {
            const cand = remoteIceCandidatesQueue.shift();
            try {
                if (pc && pc.remoteDescription) {
                    await pc.addIceCandidate(new RTCIceCandidate(cand));
                }
            } catch (err) {
                console.warn("[ZChatCall] addIceCandidate error:", err);
            }
        }
    }

    function createPeerConnection() {
        if (pc) {
            try { pc.close(); } catch (_) {}
        }
        remoteIceCandidatesQueue = [];
        pc = new RTCPeerConnection(ICE_SERVERS);

        pc.onicecandidate = (ev) => {
            if (ev.candidate && socket && peerUsername) {
                socket.emit("ice_candidate", {
                    to: peerUsername,
                    from: myUsername,
                    candidate: ev.candidate,
                });
            }
        };

        pc.ontrack = (ev) => {
            if (!remoteStream) remoteStream = new MediaStream();
            remoteStream.addTrack(ev.track);
            const remoteVideo = $("zcRemoteVideo");
            if (remoteVideo) {
                remoteVideo.srcObject = remoteStream;
                remoteVideo.setAttribute("playsinline", "true");
                remoteVideo.setAttribute("autoplay", "true");
                remoteVideo.play().catch(() => {});
            }
            if (ev.track && ev.track.kind === "video") {
                setRemoteCamAvatarVisible(false);
                ev.track.onmute = () => setRemoteCamAvatarVisible(true);
                ev.track.onunmute = () => setRemoteCamAvatarVisible(false);
                ev.track.onended = () => setRemoteCamAvatarVisible(true);
            }
        };

        pc.onconnectionstatechange = () => {
            const st = pc && pc.connectionState;
            console.log("[ZChatCall] connectionState:", st);
            if (st === "connected") {
                setStatus("Connected");
                showInCallUI();
            } else if (st === "failed" || st === "closed") {
                if (callActive) cleanupCall(false);
            }
        };

        return pc;
    }

    async function attachLocalTracks(video) {
        const stream = await getMedia(video);
        stream.getTracks().forEach((track) => {
            if (pc) pc.addTrack(track, stream);
        });
    }

    function showOutgoingUI(name) {
        hide($("zcIncomingPanel"));
        hide($("zcInCallPanel"));
        show($("zcOutgoingPanel"));
        show($("zcCallModal"));
        setPeerName(name);
        setStatus("Calling...");
        icons();
    }

    function showIncomingUI(name) {
        hide($("zcOutgoingPanel"));
        hide($("zcInCallPanel"));
        show($("zcIncomingPanel"));
        show($("zcCallModal"));
        setPeerName(name);
        setStatus("Incoming video call");
        icons();
    }

    function showInCallUI() {
        hide($("zcOutgoingPanel"));
        hide($("zcIncomingPanel"));
        show($("zcInCallPanel"));
        show($("zcCallModal"));
        setStatus("In call");
        fillCallAvatarEl($("zcLocalAvatarCircle"), resolveMyParticipant());
        fillCallAvatarEl(
            $("zcRemoteAvatarCircle"),
            resolvePeerParticipant(peerUsername)
        );
        icons();
    }

    function hideAllCallUI() {
        hide($("zcCallModal"));
        hide($("zcOutgoingPanel"));
        hide($("zcIncomingPanel"));
        hide($("zcInCallPanel"));
        setStatus("");
    }

    function cleanupCall(notifyPeer) {
        const peer = peerUsername;
        callActive = false;
        pendingOffer = null;
        isCaller = false;
        remoteIceCandidatesQueue = [];

        if (pc) {
            try { pc.close(); } catch (_) {}
            pc = null;
        }
        stopMedia();
        micEnabled = true;
        camEnabled = true;
        setLocalCamAvatarVisible(false);
        setRemoteCamAvatarVisible(false);
        updateMicCamButtons();
        hideAllCallUI();

        if (notifyPeer && peer && socket) {
            socket.emit("end_call", {
                to: peer,
                from: myUsername,
                reason: "hangup",
            });
        }
        peerUsername = "";
    }

    async function startCall(targetUsername) {
        const target = (targetUsername || "").trim();
        if (!target) return;
        if (!myUsername) {
            alert("Please sign in first.");
            return;
        }
        
        // Đảm bảo dọn dẹp sạch state trước khi thực hiện cuộc gọi mới
        cleanupCall(false);

        peerUsername = target;
        isCaller = true;
        callActive = true;
        showOutgoingUI(target);

        try {
            createPeerConnection();
            await attachLocalTracks(true);
            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
            });
            await pc.setLocalDescription(offer);
            applyBandwidthLimit();

            socket.emit("call_user", {
                to: target,
                from: myUsername,
                offer: { type: offer.type, sdp: offer.sdp },
                callType: "video",
            });
        } catch (err) {
            console.error("[ZChatCall] startCall error:", err);
            alert("Could not access camera/mic. Check browser permissions.");
            cleanupCall(false);
        }
    }

    async function acceptCall() {
        if (!pendingOffer || !peerUsername) return;
        callActive = true;
        isCaller = false;
        showInCallUI();

        try {
            createPeerConnection();
            await attachLocalTracks(true);
            await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer));
            await processQueuedIceCandidates();

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            applyBandwidthLimit();

            socket.emit("make_answer", {
                to: peerUsername,
                from: myUsername,
                answer: { type: answer.type, sdp: answer.sdp },
            });
            pendingOffer = null;
        } catch (err) {
            console.error("[ZChatCall] acceptCall error:", err);
            alert("Could not answer the call.");
            cleanupCall(true);
        }
    }

    function rejectCall() {
        if (peerUsername && socket) {
            socket.emit("end_call", {
                to: peerUsername,
                from: myUsername,
                reason: "reject",
            });
        }
        cleanupCall(false);
    }

    function cancelOutgoing() {
        if (peerUsername && socket) {
            socket.emit("end_call", {
                to: peerUsername,
                from: myUsername,
                reason: "cancel",
            });
        }
        cleanupCall(false);
    }

    function hangup() {
        cleanupCall(true);
    }

    function toggleMic() {
        if (!localStream) return;
        micEnabled = !micEnabled;
        localStream.getAudioTracks().forEach((t) => {
            t.enabled = micEnabled;
        });
        updateMicCamButtons();
    }

    function toggleCam() {
        if (!localStream) return;
        camEnabled = !camEnabled;
        localStream.getVideoTracks().forEach((t) => {
            t.enabled = camEnabled;
        });
        setLocalCamAvatarVisible(!camEnabled);
        if (socket && peerUsername) {
            socket.emit("media_state", {
                to: peerUsername,
                from: myUsername,
                video: camEnabled,
                audio: micEnabled,
            });
        }
        updateMicCamButtons();
    }

    function updateMicCamButtons() {
        const micBtn = $("zcBtnMute");
        const camBtn = $("zcBtnCam");
        if (micBtn) {
            micBtn.classList.toggle("zc-call-btn-off", !micEnabled);
            const icon = micBtn.querySelector("[data-lucide]");
            if (icon) icon.setAttribute("data-lucide", micEnabled ? "mic" : "mic-off");
        }
        if (camBtn) {
            camBtn.classList.toggle("zc-call-btn-off", !camEnabled);
            const icon = camBtn.querySelector("[data-lucide]");
            if (icon) {
                icon.setAttribute("data-lucide", camEnabled ? "video" : "video-off");
            }
        }
        icons();
    }

    function connectSocket() {
        if (typeof io === "undefined") return;
        if (socket) return;

        socket = io(SIGNAL_URL, {
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionAttempts: 10,
        });

        socket.on("connect", () => {
            if (myUsername) {
                socket.emit("register", { username: myUsername });
            }
        });

        socket.on("incoming_call", async (payload) => {
            // FIX LỖI MẤT POPUP: Nếu đang dính cuộc gọi cũ bẩn state thì dọn trước
            if (callActive && peerUsername !== payload.from) {
                cleanupCall(false);
            }
            
            peerUsername = payload.from;
            pendingOffer = payload.offer;
            callActive = true;
            isCaller = false;
            showIncomingUI(payload.from);
        });

        socket.on("call_answered", async (payload) => {
            if (!pc || !isCaller) return;
            try {
                await pc.setRemoteDescription(
                    new RTCSessionDescription(payload.answer)
                );
                await processQueuedIceCandidates();
                applyBandwidthLimit();
                setStatus("Connected");
                showInCallUI();
            } catch (err) {
                console.error("[ZChatCall] setRemoteDescription answer:", err);
                cleanupCall(true);
            }
        });

        socket.on("ice_candidate", async (payload) => {
            if (!payload || !payload.candidate) return;
            if (!pc || !pc.remoteDescription) {
                remoteIceCandidatesQueue.push(payload.candidate);
                return;
            }
            try {
                await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (err) {
                console.warn("[ZChatCall] addIceCandidate:", err);
            }
        });

        socket.on("call_ended", () => {
            cleanupCall(false);
        });

        socket.on("media_state", (payload) => {
            if (!payload) return;
            if (payload.video === false) setRemoteCamAvatarVisible(true);
            else if (payload.video === true) setRemoteCamAvatarVisible(false);
        });

        socket.on("disconnect", () => {
            console.log("[ZChatCall] socket disconnected");
        });
    }

    function register(username) {
        myUsername = (username || localStorage.getItem("zchat_username") || "").trim();
        if (!myUsername) return;
        connectSocket();
        if (socket && socket.connected) {
            socket.emit("register", { username: myUsername });
        }
    }

    function bindUI() {
        const accept = $("zcBtnAccept");
        const reject = $("zcBtnReject");
        const cancel = $("zcBtnCancel");
        const hang = $("zcBtnHangup");
        const mute = $("zcBtnMute");
        const cam = $("zcBtnCam");

        if (accept) accept.onclick = () => acceptCall();
        if (reject) reject.onclick = () => rejectCall();
        if (cancel) cancel.onclick = () => cancelOutgoing();
        if (hang) hang.onclick = () => hangup();
        if (mute) mute.onclick = () => toggleMic();
        if (cam) cam.onclick = () => toggleCam();

        const videoBtn = document.querySelector('button[aria-label="Video call"]');
        if (videoBtn && !videoBtn.dataset.zchatCallBound) {
            videoBtn.dataset.zchatCallBound = "1";
            videoBtn.addEventListener("click", () => {
                const nameEl = document.getElementById("chatHeaderName");
                let peer = nameEl ? nameEl.textContent.trim() : "";
                peer = peer.split("\n")[0].trim();
                if (!peer || peer === "Saved Messages") {
                    alert("Open a chat with a friend to start a video call.");
                    return;
                }
                startCall(peer);
            });
        }
    }

    function init() {
        myUsername = (localStorage.getItem("zchat_username") || "").trim();
        bindUI();
        if (myUsername) register(myUsername);

        const prev = window.zchatEnterApp;
        window.zchatEnterApp = function (username) {
            if (typeof prev === "function") prev(username);
            register(username);
        };
    }

    window.ZChatCall = {
        init,
        register,
        startCall,
        hangup,
        acceptCall,
        rejectCall,
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
