// options.js
document.getElementById('grant-mic').addEventListener('click', async () => {
  const statusEl = document.getElementById('status');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    statusEl.textContent = "✅ Permission Granted Successfully!";
    statusEl.style.color = "green";
    
    // Stop the track immediately so your recording hardware light turns off
    stream.getTracks().forEach(track => track.stop());
    
    // Optional: Close the tab automatically after 1.5 seconds
    setTimeout(() => { window.close(); }, 1500);
  } catch (err) {
    statusEl.textContent = "❌ Permission Denied. Please check your browser settings.";
    statusEl.style.color = "red";
    console.error(err);
  }
});