import os
from dotenv import load_dotenv

load_dotenv()

UPLOAD_DIR = "uploads"
AUDIO_DIR = "audio"
RESULTS_DIR = "results"
GLOSSARY_PATH = "glossary.json"

for folder in (UPLOAD_DIR, AUDIO_DIR, RESULTS_DIR):
    os.makedirs(folder, exist_ok=True)


