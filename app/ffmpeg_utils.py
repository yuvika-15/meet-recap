import subprocess
import os


def extract_audio(video_path: str, audio_dir: str) -> str:
    """
    Pulls just the audio track out of a recorded .webm file and saves it
    as a standalone .mp3. Doesn't touch or re-encode the video - the full
    video file stays untouched on disk for clip-cutting later.
    """
    filename = os.path.splitext(os.path.basename(video_path))[0]
    audio_path = os.path.join(audio_dir, f"{filename}.mp3")

    command = [
        "ffmpeg",
        "-y",                    # overwrite if it already exists
        "-i", video_path,        # input file
        "-vn",                   # strip video, keep audio only
        "-acodec", "libmp3lame",
        "-q:a", "2",              # good quality, small file size
        audio_path,
    ]

    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed to extract audio: {result.stderr}")

    return audio_path
