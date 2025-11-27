import os
import json
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from google import genai

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not set in .env")

client = genai.Client(api_key=GEMINI_API_KEY)

app = Flask(__name__, static_folder="static", template_folder="templates")


@app.route("/")
def index():
    return render_template("index.html")


def extract_json(text: str):
    if not text:
        raise ValueError("Empty response from model")

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object found in model response")

    json_str = text[start : end + 1]
    return json.loads(json_str)

@app.post("/api/correct")
def api_correct():
    try:
        data = request.get_json() or {}
        sentence = data.get("sentence", "").strip()

        if not sentence:
            return jsonify({"error": "No sentence provided."}), 400

        prompt = f"""
You are a Finnish teacher helping immigrant beginners in Finland (A1–A2 level).

The student writes a simple Finnish sentence. Your job is to:
1) Correct the sentence.
2) Translate it to English.
3) Give 2–4 short explanations of important grammar or word choices in very simple English.
4) Give pronunciation help.
5) Find the main verb and show how to use it.
6) Be kind and encouraging.

Pronunciation help should:
- Focus on stress, long vs short vowels, difficult sounds (y, ä, ö, r).
- Use simple pseudo-phonetics (not full IPA), e.g. "käyn" ≈ "kæ-un".
- Mention 1–2 typical mistakes beginners make with this sentence.
- Also give a short breakdown for 3–6 important words or parts from the sentence
  (for example: "Minä", "haluan", "vettä") as a list of objects:
  part + simple tip.

Verb practice:
- Find ONE main verb in the student's sentence (infinitive, e.g. "haluta").
- Give the present tense for all 6 persons with pronouns:
  minä, sinä, hän, me, te, he
- Give 6 simple example sentences that use this verb:
  one example for each person (minä, sinä, hän, me, te, he).
- Include English translations so the learner sees the structure difference.


Student sentence:
"{sentence}"

Respond ONLY with JSON in this exact format:

{{
  "corrected": "corrected Finnish sentence",
  "translation_en": "English translation",
  "explanations": [
    "short explanation 1 in simple English",
    "short explanation 2 in simple English"
  ],
  "pronunciation_overview": "short paragraph explaining how to pronounce this sentence, with examples and hints",
  "pronunciation_breakdown": [
    {{"part": "Minä", "tip": "Stress on the first syllable: MI-nä. The ä is like 'a' in 'cat'."}},
    {{"part": "haluan", "tip": "Three syllables: ha-lu-an. All vowels are short."}}
  ],
  "tone_feedback": "one short encouraging sentence to the student",
  "verb_base": "infinitive form of the main verb, e.g. 'haluta'",
  "verb_meaning_en": "short English meaning, e.g. 'to want'",
  "verb_conjugation": [
    {{"person": "minä", "form": "haluan"}},
    {{"person": "sinä", "form": "haluat"}},
    {{"person": "hän", "form": "haluaa"}},
    {{"person": "me", "form": "haluamme"}},
    {{"person": "te", "form": "haluatte"}},
    {{"person": "he", "form": "haluavat"}}
  ],
    "verb_examples": [
    {{"fi": "Minä haluan vettä.", "en": "I want water."}},
    {{"fi": "Sinä haluat kahvia.", "en": "You want coffee."}},
    {{"fi": "Hän haluaa teetä.", "en": "He/She wants tea."}},
    {{"fi": "Me haluamme pizzaa.", "en": "We want pizza."}},
    {{"fi": "Te haluatte jäätelöä.", "en": "You (plural) want ice cream."}},
    {{"fi": "He haluavat maitoa.", "en": "They want milk."}}
  ]

}}
"""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )

        raw_text = response.text
        feedback = extract_json(raw_text)

        corrected = feedback.get("corrected", "").strip()
        translation_en = feedback.get("translation_en", "").strip()
        explanations = feedback.get("explanations", [])

        # backwards-compatible: some models might still return pronunciation_guide
        pronunciation_overview = feedback.get("pronunciation_overview", "").strip()
        if not pronunciation_overview:
            pronunciation_overview = feedback.get("pronunciation_guide", "").strip()

        pronunciation_breakdown = feedback.get("pronunciation_breakdown", [])
        tone_feedback = feedback.get("tone_feedback", "").strip()

        verb_base = feedback.get("verb_base", "").strip()
        verb_meaning_en = feedback.get("verb_meaning_en", "").strip()
        verb_conjugation = feedback.get("verb_conjugation", [])
        verb_examples = feedback.get("verb_examples", [])

        if not corrected:
            raise ValueError("Model did not return 'corrected' sentence")

        if not isinstance(explanations, list):
            explanations = [str(explanations)]

        if not isinstance(verb_conjugation, list):
            verb_conjugation = []

        if not isinstance(verb_examples, list):
            verb_examples = []

        if not isinstance(pronunciation_breakdown, list):
            pronunciation_breakdown = []

        return jsonify({
            "corrected": corrected,
            "translation_en": translation_en,
            "explanations": explanations,
            "pronunciation_overview": pronunciation_overview,
            "pronunciation_breakdown": pronunciation_breakdown,
            "tone_feedback": tone_feedback,
            "verb_base": verb_base,
            "verb_meaning_en": verb_meaning_en,
            "verb_conjugation": verb_conjugation,
            "verb_examples": verb_examples,
        })

    except Exception as e:
        print("Error in /api/correct:", repr(e))
        return jsonify({"error": str(e)}), 500


@app.post("/api/pronunciation-eval")
def api_pronunciation_eval():
    try:
        data = request.get_json() or {}

        target = data.get("target", "").strip()
        spoken = data.get("spoken", "").strip()

        if not target or not spoken:
            return jsonify({"error": "Missing target or spoken text."}), 400

        prompt = f"""
You are a Finnish teacher for beginner immigrant students.

You do NOT hear the audio directly. Instead, you see:
- The correct Finnish target sentence.
- The automatic speech recognition (ASR) transcript of what the student said.

Target correct sentence:
"{target}"

ASR transcript of student's speech:
"{spoken}"

Assume differences between these are mainly because of pronunciation problems or missing words.

Give feedback in very simple English, focusing on pronunciation, rhythm, and endings.

Respond ONLY with JSON in this exact format:

{{
  "match_quality": "1-5 with a short label (for example: '4/5 – quite clear, only small issues')",
  "overall_comment": "short comment (2–3 sentences) in simple English about how understandable the pronunciation is",
  "problem_words": [
    {{
      "word": "Finnish word that is probably difficult",
      "tip": "short tip in simple English on how to pronounce it (stress, vowels, long/short, etc.)"
    }}
  ]
}}
"""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )

        raw_text = response.text
        feedback = extract_json(raw_text)

        match_quality = feedback.get("match_quality", "").strip()
        overall_comment = feedback.get("overall_comment", "").strip()
        problem_words = feedback.get("problem_words", [])

        if not isinstance(problem_words, list):
            problem_words = []

        return jsonify({
            "match_quality": match_quality,
            "overall_comment": overall_comment,
            "problem_words": problem_words,
        })

    except Exception as e:
        print("Error in /api/pronunciation-eval:", repr(e))
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
