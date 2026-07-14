import os
import uuid
from fastapi import FastAPI, UploadFile, File, HTTPException

from .config import UPLOAD_DIR, AUDIO_DIR
from .ffmpeg_utils import extract_audio
from .db import init_db, create_class_record, get_class, update_audio_path

app = FastAPI(title="Dance Class Recap Agent")

# Creates the `classes` table if it doesn't exist yet. This runs once, the
# moment the server starts up (when this file is first imported).
init_db()


@app.post("/upload")
async def upload_recording(file: UploadFile = File(...)):
    """
    Step 1: save the uploaded .webm to disk and create a row for it in
    the database. Nothing else happens yet - no audio extraction, no
    transcription. Just: "this recording exists, here's its ID."
    """
    class_id = str(uuid.uuid4())
    video_path = os.path.join(UPLOAD_DIR, f"{class_id}.webm")

    with open(video_path, "wb") as f:
        f.write(await file.read())

    create_class_record(class_id, video_path)

    return {"class_id": class_id, "video_path": video_path, "status": "uploaded"}


@app.post("/extract-audio/{class_id}")
def run_audio_extraction(class_id: str):
    """
    Step 2: look up the video file for this class_id in the database
    (we don't need it passed in again - the DB already knows where it is),
    run ffmpeg on it, then save the resulting audio path back and mark
    this class as 'audio_extracted'.
    """
    record = get_class(class_id)
    if not record:
        raise HTTPException(status_code=404, detail="No class with that ID")

    try:
        audio_path = extract_audio(record["video_path"], AUDIO_DIR)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    update_audio_path(class_id, audio_path)

    return {"class_id": class_id, "audio_path": audio_path, "status": "audio_extracted"}


@app.get("/classes/{class_id}")
def get_class_record(class_id: str):
    """Lets you inspect exactly what's stored in the database for a class."""
    record = get_class(class_id)
    if not record:
        raise HTTPException(status_code=404, detail="No class with that ID")
    return record