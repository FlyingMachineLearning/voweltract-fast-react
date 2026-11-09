import io
from fastapi.testclient import TestClient
from main import app
from engine import analyze
from docx import Document
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject

client = TestClient(app)


def test_sound_not_spelling():
    result = analyze("night sky\nlove move")
    pairs = {
        (
            result["events"][l["source"]]["normalized"],
            result["events"][l["target"]]["normalized"],
        )
        for l in result["links"]
    }
    assert ("night", "sky") in pairs
    assert ("love", "move") not in pairs
    assert result["events"][0]["vowel"] == "AY"


def test_section_and_distance_boundaries():
    for text in ["night\n\nsky", "night\n[Chorus]\nsky"]:
        assert analyze(text, line_gap=8)["links"] == []
    assert analyze("night\nsky", line_gap=0)["links"] == []
    assert len(analyze("night\nsky", line_gap=1)["links"]) == 1


def test_repetition_control():
    assert analyze("night night")["links"] == []
    assert len(analyze("night night", repeats=True)["links"]) == 1


def test_unknown_not_guessed_and_override():
    result = analyze("zzqxy sky")
    assert result["unknown_words"] == [{"word": "zzqxy", "count": 1}]
    result = analyze("zzqxy sky", overrides={"zzqxy": "Z AY1"})
    assert not result["unknown_words"]
    assert len(result["links"]) == 1
    assert result["tokens"][0]["source"] == "override"


def test_ambiguity_and_override_validation():
    result = analyze("read bed")
    assert len(result["tokens"][0]["variants"]) > 1
    changed = analyze("read bed", overrides={"read": "R EH1 D"})
    assert changed["tokens"][0]["phones"] == "R EH1 D"
    assert len(changed["links"]) == 1
    response = client.post(
        "/api/analyze", json={"text": "hello", "overrides": {"hello": "HH Q1"}}
    )
    assert response.status_code == 400


def test_stress_selection_and_zero_vector():
    custom = {"zzword": "AH0 B IY1 T EY2"}
    for mode, expected in [("all", 3), ("stressed", 2), ("primary", 1)]:
        result = analyze("zzword", stress=mode, overrides=custom)
        assert result["stats"]["active_vowels"] == expected
    result = analyze("zzword\nzznext", overrides={"zzword": "AH0", "zznext": "IY1"})
    assert result["similarity"]["matrix"][0][0] is None
    assert result["similarity"]["matrix"][1][1] == 1


def test_cosine_ignores_order():
    result = analyze("night sky\nsky night")
    assert result["similarity"]["matrix"][0][1] == 1


def test_text_api_and_limits():
    assert client.post("/api/analyze", json={"text": "night sky"}).status_code == 200
    assert (
        client.post("/api/analyze", json={"text": "x", "stress": "invalid"}).status_code
        == 422
    )
    assert (
        client.post("/api/analyze", json={"text": "x", "line_gap": 20}).status_code
        == 422
    )
    assert (
        client.post(
            "/api/analyze", json={"text": "\n".join(["night"] * 241)}
        ).status_code
        == 400
    )
    assert client.post("/api/analyze", json={"text": "[Verse]"}).status_code == 400
    assert (
        client.post("/api/analyze", json={"text": "night " * 5001}).status_code == 400
    )


def test_txt_ingestion_and_docx_line_breaks():
    text = "night sky\nlight high"
    for filename, content in [
        ("lyrics.txt", text.encode()),
        ("lyrics.md", text.encode()),
    ]:
        result = client.post("/api/ingest", files={"file": (filename, content)})
        assert result.status_code == 200
        assert result.json()["text"] == text
    doc = Document()
    doc.add_paragraph("night sky")
    doc.add_paragraph("light high")
    buf = io.BytesIO()
    doc.save(buf)
    result = client.post("/api/ingest", files={"file": ("lyrics.docx", buf.getvalue())})
    assert result.status_code == 200
    assert result.json()["text"] == "night sky\nlight high"


def test_pdf_extraction():
    writer = PdfWriter()
    page = writer.add_blank_page(width=300, height=300)
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    page[NameObject("/Resources")] = DictionaryObject(
        {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})}
    )
    stream = DecodedStreamObject()
    stream.set_data(b"BT /F1 12 Tf 20 200 Td (night sky) Tj ET")
    page[NameObject("/Contents")] = writer._add_object(stream)
    buf = io.BytesIO()
    writer.write(buf)
    result = client.post("/api/ingest", files={"file": ("lyrics.pdf", buf.getvalue())})
    assert result.status_code == 200
    assert "night sky" in result.json()["text"]


def test_invalid_uploads():
    for name, content in [
        ("empty.txt", b""),
        ("bad.pdf", b"not a pdf"),
        ("bad.exe", b"no"),
        ("bad.txt", b"\xff"),
    ]:
        assert (
            client.post("/api/ingest", files={"file": (name, content)}).status_code
            == 400
        )
    assert (
        client.post(
            "/api/ingest", files={"file": ("big.txt", b"x" * (10 * 1024 * 1024 + 1))}
        ).status_code
        == 413
    )
