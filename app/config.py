import os
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY")

UPLOAD_DIR = "uploads"
AUDIO_DIR = "audio"
RESULTS_DIR = "results"
GLOSSARY_PATH = "glossary.json"

for folder in (UPLOAD_DIR, AUDIO_DIR, RESULTS_DIR):
    os.makedirs(folder, exist_ok=True)

# We deliberately don't hard-crash here if ANTHROPIC_API_KEY or
# ASSEMBLYAI_API_KEY are missing. At this stage of the project (upload +
# audio extraction only) neither key is actually used yet, so failing here
# would block you from testing what you've already built. transcription.py
# and claude_extraction.py will check for their own key once you build
# those steps and actually need them.
