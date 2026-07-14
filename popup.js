const micStatus = document.getElementById("mic-status");
const grantBtn = document.getElementById("grant-mic");
const startBtn = document.getElementById("start-recording");
const stopBtn = document.getElementById("stop-recording");
const recordingStatus = document.getElementById("recording-status");

// 1. Sync UI layout with real-time background tracking state on startup
chrome.action.getBadgeText({}, (text) => {
  if (text === "REC") {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    recordingStatus.textContent = "🔴 Recording Session...";
  } else {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    recordingStatus.textContent = "Idle";
  }
});

// 2. Check microphone permission state on load
navigator.permissions.query({ name: 'microphone' }).then((permissionStatus) => {
  if (permissionStatus.state === 'granted') {
    micStatus.textContent = "✅ Permission Granted";
    grantBtn.disabled = true;
  } else {
    micStatus.textContent = "❌ Permission not granted";
  }
});

// 3. Open options page for permissions
grantBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// 4. Start Recording Action
startBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url.startsWith("https://meet.google.com/")) {
    recordingStatus.textContent = "⚠️ Please switch to a Google Meet tab!";
    return;
  }

  const perm = await navigator.permissions.query({ name: 'microphone' });
  if (perm.state !== 'granted') {
    recordingStatus.textContent = "⚠️ Please grant microphone permission first!";
    return;
  }

  // Pass off execution completely to the service worker context
  chrome.runtime.sendMessage({ type: "POPUP_START_RECORDING", tabId: tab.id });

  startBtn.disabled = true;
  stopBtn.disabled = false;
  recordingStatus.textContent = "🔴 Recording Session...";
});

// 5. Reflect start failures, upload progress, and upload results back into the UI
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'RECORDING_START_FAILED') {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    recordingStatus.textContent = "⚠️ Failed to start — try again";
  }

  if (message.type === 'UPLOAD_STARTED') {
    recordingStatus.textContent = "⏳ Uploading & extracting audio...";
  }

  if (message.type === 'UPLOAD_COMPLETE') {
    recordingStatus.textContent = `✅ Saved (class_id: ${message.class_id.slice(0, 8)}...)`;
  }

  if (message.type === 'UPLOAD_FAILED') {
    recordingStatus.textContent = "⚠️ Upload failed — check backend is running";
  }
});

// 6. Stop Recording Action
stopBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "STOP_RECORDING" });

  startBtn.disabled = false;
  stopBtn.disabled = true;
  // Don't say "Idle" yet - the recording still needs to be uploaded and have
  // its audio extracted. The UPLOAD_STARTED/UPLOAD_COMPLETE listener above
  // will update this text as that finishes.
  recordingStatus.textContent = "⏳ Stopping...";
});