# Voweltrace — see the sound

A React + FastAPI app for exploring **assonance candidates** in English lyrics. Ingest a document or paste lyrics; get a color-coded lyric score, a vowel-thread diagram, and a line-similarity matrix. No API key, LLM, external analysis service, or runtime model download required.

## Start on Windows, macOS, or Linux

Install **Node.js 22+** and **Python 3.12+**, then open a terminal in this folder (the one containing this README and the root `package.json`).

```powershell
npm install
npm run dev
```

Open **http://localhost:5173**. Keep the terminal open; **Ctrl+C stops both servers**.

The first `npm install` automatically creates `.venv`, installs FastAPI and document readers, and installs the React frontend. It can take a few minutes and requires an internet connection. Later launches only need `npm run dev`. No virtual-environment activation, administrator privileges, or separate backend terminal is needed.

### If setup reports that Python is missing

Install Python from https://www.python.org/downloads/ and enable **Add Python to PATH** if the installer offers it. Close and reopen PowerShell, return to this folder, and retry `npm install`. On Windows the setup also detects the Python launcher (`py -3`).

To select a specific Python installation in PowerShell:

```powershell
$env:VOWELTRACE_PYTHON = 'C:\path\to\python.exe'
npm install
```

If npm lifecycle scripts are disabled on your machine, run `npm run setup` after `npm install`. If PowerShell blocks `npm.ps1`, use `npm.cmd install` and `npm.cmd run dev`.

### Commands from the root folder

| Command | Action |
| --- | --- |
| `npm install` | Install the frontend and set up Python automatically |
| `npm run setup` | Retry setup or install changed backend requirements |
| `npm run dev` | Start React and FastAPI together |
| `npm run build` | Build React into `frontend/dist` |
| `npm test` | Run backend tests |

FastAPI listens on http://127.0.0.1:8000; API documentation is at http://localhost:8000/docs. Vite proxies `/api` requests to FastAPI. The launcher checks ports 5173 and 8000 before starting and reports conflicts. The build command creates frontend assets; it does not start a production API server.

The original sample in `samples/midnight.txt` loads immediately from checked-in output of the same Python engine (`frontend/src/demo.json`). New analyses and uploads use FastAPI.

## What you can explore

1. **Lyric score:** one colored bar per vowel nucleus, beneath each word. Taller bars mark primary stress. Click a vowel family to isolate its occurrences. Click a word for phonemes and pronunciation alternatives.
2. **Vowel threads:** syllables occupy equally spaced slots on each lyric line; colored arcs connect nearby identical vowel families. Slot positions do not represent musical time or text character positions. Hover over dots; click or use Enter/Space to inspect. Export a standalone SVG.
3. **Line echoes:** cosine similarity between line vowel-count vectors. Select a cell to compare its lines. This ignores vowel order and is **not a rhyme, assonance-density, or quality score**. A blank/no-data cell means at least one line has no active vowels.
4. **Pronunciation lab:** choose a dictionary alternative or enter ARPAbet (e.g., `S K AY1`). Apply reanalyzes the text. Overrides apply to all occurrences of that normalized word, persist through reanalysis, and export with the JSON. They reset on document upload, demo reload, or browser refresh. Occurrence-specific pronunciations are not yet supported.
5. **Inputs:** upload UTF-8 TXT/Markdown, DOCX paragraphs/tables, or selectable-text PDF; review extracted text in the editor before analysis. Scanned PDFs need OCR elsewhere. Section labels such as `[Verse 1]` and blank lines break connections. Metadata is not inferred: remove song titles, artist names, and non-lyric text in the editor.

Changes to lyrics or analysis settings require **Update analysis**. The app labels stale results. Vowel filtering is immediate and affects the score/thread view only, not the similarity matrix or exported JSON. The SVG export contains the currently visible thread filter, including dimmed nonmatching dots. JSON contains the full latest successful analysis.

## Transparent phonetic model

- Uses the CMU Pronouncing Dictionary bundled with the pinned `cmudict` Python package. Its North American English pronunciations are defaults, not a transcription of a singer.
- Tokens are Unicode letter words with optional apostrophes; case and curly apostrophes normalize. Hyphens separate words. Punctuation and source line numbers remain visible; arbitrary whitespace may wrap on screen.
- All 15 ARPAbet vowel families have stable colors. Diphthongs (`AY`, `AW`, etc.) each count as one vowel nucleus. No spelling-based vowel guesses are made.
- Default uses primary and secondary stressed vowels (`1`, `2`). Optional all-vowels or primary-only modes. Stress comes from the dictionary, not musical meter. Underlying vowel bars remain visible but dim when filtered.
- Matches require the **same vowel family**, ignoring its stress number after filtering. `night` and `sky` can connect; `love` and `move` cannot. `AH` groups both stressed /ʌ/ and reduced /ə/; `ER` similarly includes stressed and reduced rhotic vowels. Exact family matching is an approximation, especially in all-vowels mode. No acoustic distance or slant-vowel similarity is computed.
- A thread connects an active vowel to its nearest eligible earlier occurrence in a **different token**, within 32 token positions and the selected maximum physical-line gap, in the same stanza. Only one incoming thread per vowel is drawn; this is a sparse reading aid, not an exhaustive pair graph. Zero-line gap means same line only.
- Identical normalized words do not link by default. Full rhymes are still allowed: a shared vowel can be both rhyme and assonance. This app does not isolate assonance-only pairs by consonant mismatch.
- First distinct dictionary pronunciation is used by default; alternatives are shown and ambiguity counted. No context disambiguation or grapheme-to-phoneme model. Unknown words stay unknown until overridden; coverage is token-weighted dictionary/override coverage.
- Repeated lines affect counts. Similarity uses raw active-vowel counts without stopword removal. Large thread views display the first 1,200 eligible edges, with an explicit notice; full JSON retains all links.

## API

`POST /api/ingest` — multipart field `file`; returns `{text, title}` for review.

`POST /api/analyze` — JSON:

```json
{
  "text": "Night sky\nBright eyes",
  "title": "My lyrics",
  "stress": "stressed",
  "line_gap": 2,
  "repeats": false,
  "overrides": {"night": "N AY1 T"}
}
```

Returns source lines, tokens, phones and alternatives, vowel events, sparse connections, vowel counts, cosine matrix, coverage and unknown words, settings and overrides. `GET /api/health` is a liveness check. Errors return FastAPI `detail` messages.

## Bounds and deployment

10 MB upload, 100,000 extracted/input characters, 5,000 words, 240 physical lines, 300 PDF pages, 30 MB expanded DOCX, 300 overrides. Maximum cross-line gap is 8. Files and analyses are processed in memory and not persisted by the app; refresh clears the session. Uploads go to the server hosting FastAPI. Document parsing and analysis run in worker threads.

Local/single-user starter. Before exposing it to the internet, add authentication, rate limits, resource-isolated document parsing and appropriate service limits. Application upload limits run after multipart parsing; production hosting should also limit request size at its reverse proxy. The development servers bind to your local machine. Frontend fonts optionally load from Google Fonts; system fonts are the fallback. No lyrics or phonetic data are sent to Google Fonts or an AI service.

PDF line extraction is layout dependent; review line breaks. No audio alignment, OCR, singer/dialect inference, cross-document comparison, lemma normalization, automatic rhyme scheme labeling, or audio playback is included.

## Checks

```sh
npm test
npm run build
```

Tests cover phonetic vs. orthographic matching, stanza/distance boundaries, repeated words, unknowns and overrides, ambiguity, stress filtering, undefined similarity, API limits, PDF/DOCX/text parsing and invalid uploads. GitHub Actions runs these checks on pushes and pull requests.

## Research and attribution

Independent implementation inspired by this research area; no Poemage/RhymeDesign source code or assets are included.

- Nina McCurdy, Vivek Srikumar, and Miriah Meyer. **RhymeDesign: A Tool for Analyzing Sonic Devices in Poetry** (2015). https://aclanthology.org/W15-0702/
- Nina McCurdy, Julie Lein, Katharine Coles, and Miriah Meyer. **Poemage: Visualizing the Sonic Topology of a Poem** (2016). https://pubmed.ncbi.nlm.nih.gov/26529714/
- **CMU Pronouncing Dictionary**, Carnegie Mellon University and contributors. https://github.com/cmusphinx/cmudict . Dictionary data remains under its own license; installed package includes the upstream notices. See `THIRD_PARTY_NOTICES.md`.

The demo lyrics are original sample text created for this project.

## Add to GitHub

From this folder, after creating an empty repository (replace YOUR_USERNAME):

```sh
git init -b main
git add .
git commit -m "Build Voweltrace lyric assonance explorer"
git remote add origin https://github.com/YOUR_USERNAME/voweltrace.git
git push -u origin main
```

Or with the authenticated GitHub CLI:

```sh
git init -b main
git add .
git commit -m "Build Voweltrace lyric assonance explorer"
gh repo create voweltrace --private --source=. --remote=origin --push
```

No project license has been selected. Choose one before releasing as open source; third-party dependencies retain their own licenses.
