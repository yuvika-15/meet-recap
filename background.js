const MEET_URL_PREFIX = "https://meet.google.com/";
let isRecording = false;

// ---------- Restrict the action to Google Meet tabs only ----------
// A disabled action does not respond to clicks at all (no popup opens),
// and Chrome greys out the icon automatically - so this is all we need
// to "restrict" the extension to Meet tabs.

function isMeetUrl(url) {
  return typeof url === "string" && url.startsWith(MEET_URL_PREFIX);
}

async function syncActionStateForTab(tabId, url) {
  try {
    if (isMeetUrl(url)) {
      await chrome.action.enable(tabId);
    } else {
      await chrome.action.disable(tabId);
    }
  } catch (err) {
    // Tab may have closed mid-update; safe to ignore
  }
}

// Set initial state for every already-open tab when the extension loads/installs
chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    syncActionStateForTab(tab.id, tab.url);
  }
});
chrome.runtime.onStartup.addListener(async () => {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    syncActionStateForTab(tab.id, tab.url);
  }
});

// Keep state in sync as tabs navigate or get created
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    syncActionStateForTab(tabId, tab.url);
  }
});
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  syncActionStateForTab(tabId, tab.url);
});

// ---------- Recording pipeline ----------
// This is the ONE real place recording gets started. It is triggered by a
// message from the popup, not by chrome.action.onClicked - onClicked never
// fires when a default_popup is set, so that old code path was dead.

async function startRecordingPipeline(tabId) {
  try {
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });

    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: 'Recording tab video and microphone audio via MediaRecorder API'
    }).catch(() => { /* Already exists, that's fine */ });

    // Give the offscreen document a moment to attach its listener the very
    // first time it's created. Cheap and avoids a race on cold start.
    await new Promise((resolve) => setTimeout(resolve, 150));

    chrome.runtime.sendMessage({
      type: 'START_RECORDING',
      streamId: streamId
    });

    isRecording = true;
    chrome.action.setBadgeText({ text: "REC" });
    chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
  } catch (err) {
    console.error("Failed to start recording pipeline:", err);
    chrome.runtime.sendMessage({ type: 'RECORDING_START_FAILED', error: String(err) });
  }
}

function stopRecordingPipeline() {
  chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
  isRecording = false;
  chrome.action.setBadgeText({ text: "" });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'POPUP_START_RECORDING') {
    startRecordingPipeline(message.tabId);
  }

  if (message.type === 'STOP_RECORDING') {
    stopRecordingPipeline();
  }

  if (message.type === 'UPLOAD_STARTED') {
    chrome.action.setBadgeText({ text: "..." });
    chrome.action.setBadgeBackgroundColor({ color: "#FFA500" });
  }

  if (message.type === 'UPLOAD_COMPLETE') {
    chrome.action.setBadgeText({ text: "OK" });
    chrome.action.setBadgeBackgroundColor({ color: "#00AA00" });
    // Clean up the offscreen document now that the pipeline is done
    chrome.offscreen.closeDocument();
    // Let a listening popup (if open) know it can update its UI
    chrome.runtime.sendMessage(message).catch(() => {});
  }

  if (message.type === 'UPLOAD_FAILED') {
    chrome.action.setBadgeText({ text: "ERR" });
    chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
    chrome.offscreen.closeDocument();
    chrome.runtime.sendMessage(message).catch(() => {});
  }
});