let mediaRecorder;
let recordedChunks = [];

// Where your FastAPI backend (app/main.py) is running.
const BACKEND_URL = "http://127.0.0.1:8000";

// Uploads the finished recording, then immediately triggers audio
// extraction for that same class_id. Both video_path and audio_path
// end up in the database with no manual steps.
async function uploadAndExtract(blob) {
  const formData = new FormData();
  const filename = `Meet_Recording_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
  formData.append("file", blob, filename); // "file" matches FastAPI's File(...) param name

  const uploadResp = await fetch(`${BACKEND_URL}/upload`, { method: "POST", body: formData });
  if (!uploadResp.ok) {
    throw new Error(`Upload failed: ${uploadResp.status} ${await uploadResp.text()}`);
  }
  const { class_id, video_path } = await uploadResp.json();

  const extractResp = await fetch(`${BACKEND_URL}/extract-audio/${class_id}`, { method: "POST" });
  if (!extractResp.ok) {
    throw new Error(`Audio extraction failed: ${extractResp.status} ${await extractResp.text()}`);
  }
  const { audio_path } = await extractResp.json();

  return { class_id, video_path, audio_path };
}

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.type === 'START_RECORDING') {
    const streamId = message.streamId;

    try {
      // 1. Capture the Tab Stream (We need both video and audio so the tab doesn't mute for you)
      const tabStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId }
        },
        video: {
          mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId }
        }
      });

      // 2. Capture your Hardware Microphone Stream (Your audio)
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      // 3. Keep the tab audio playing in your speakers so you can hear the meeting
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(tabStream);
      source.connect(audioContext.destination);

      // 4. CRITICAL: Assemble a brand new stream mixing ONLY Tab Video + Mic Audio
      const cleanStream = new MediaStream();

      // Add the video track from the tab
      cleanStream.addTrack(tabStream.getVideoTracks()[0]);

      // Add the audio track from your microphone (completely bypassing tab audio tracks)
      cleanStream.addTrack(micStream.getAudioTracks()[0]);

      // 5. Pass only the cleanStream to the MediaRecorder
      mediaRecorder = new MediaRecorder(cleanStream, { mimeType: 'video/webm;codecs=vp8,opus' });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      // Everything that depends on the finished blob has to live IN HERE,
      // because `blob` only exists once recording has actually stopped.
      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        recordedChunks = [];

        // Stop all tracks to release the hardware mic and tab capture cleanly
        tabStream.getTracks().forEach(track => track.stop());
        micStream.getTracks().forEach(track => track.stop());

        chrome.runtime.sendMessage({ type: 'UPLOAD_STARTED' });

        try {
          const result = await uploadAndExtract(blob);
          chrome.runtime.sendMessage({ type: 'UPLOAD_COMPLETE', ...result });
        } catch (err) {
          console.error("Upload/extract pipeline failed:", err);
          chrome.runtime.sendMessage({ type: 'UPLOAD_FAILED', error: String(err) });
        }
      };

      mediaRecorder.start(1000);
      console.log("Recording started: Video from tab, Audio exclusively from microphone.");

    } catch (err) {
      console.error("Failed to isolate media streams:", err);
    }
  }

  else if (message.type === 'STOP_RECORDING') {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      console.log("Recording stopped by user.");
    }
  }
});