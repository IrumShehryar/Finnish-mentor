# Finnish Mentor – Metropolia AI Assignment

This is a small Flask application that uses a Large Language Model (LLM) to help beginner Finnish learners at Metropolia, especially immigrant students.

The app lets a student write a simple sentence (even with mistakes), sends it to an LLM (Gemini), and returns:

- A corrected Finnish sentence
- English translation
- Simple grammar explanations in English
- Pronunciation hints and per-word tips
- A verb table for the main verb (minä, sinä, hän, me, te, he)
- Example sentences for each person
- Optional pronunciation feedback using browser speech recognition

## The user can even type a sentence in English and the app will translate into English and explain how to say it in Finnish.

## Why this is relevant for Metropolia

Metropolia has many international and immigrant students who are learning Finnish, but:

- They struggle with grammar explanations during self-study.
- They often need help with pronunciations and real-time correction .
- Teachers cannot always give 1-to-1 feedback outside class.

This app is a prototype of an **AI Finnish mentor** that:

- Works in the browser
- Uses plain language, A1–A2 level explanations
- Focuses on practical issues: endings, word order, verb forms, pronunciation

It can be extended later into a larger Metropolia-wide Finnish support tool.

---

The app is different than Duolingo and other language learning helps, as they do not provide explanations ,corrections and feedback which are required for interactive learning.

## Features

- ✅ Flask backend with two JSON APIs:
  - `POST /api/correct` for grammar, explanation, verb table, pronunciation hints
  - `POST /api/pronunciation-eval` for comparing spoken vs target sentence
- ✅ Frontend in HTML/CSS/JS
- ✅ Uses `google-genai` (Gemini) via API key in `.env`
- ✅ Browser speech synthesis (text-to-speech) for Finnish sentences
- ✅ Browser speech recognition (if supported) to check pronunciation

---

## Tech stack

- **Backend**: Python, Flask
- **AI**: Google Gemini API (`google-genai`)
- **Frontend**: HTML, vanilla JS, CSS
- **Env handling**: `python-dotenv`

---

## Project structure

```text
.
├─ app.py                     # Flask app, API routes and Gemini calls
├─ requirements.txt           # Python dependencies
├─ .env.example               # Example env file (no real key)
├─ README.md
├─ templates/
│  └─ index.html              # Main HTML page
└─ static/
   ├─ style.css               # Layout and styling
   └─ spoken-finnish.js       # Frontend logic (fetch, speech, UI updates)
```
