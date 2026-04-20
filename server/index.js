const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8787);
const ollamaBaseUrl = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static("public")); // Serve the frontend from the 'public' directory

async function callOllama(path, body) {
  const response = await fetch(`${ollamaBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Ollama request failed: ${response.status}`);
    error.details = text;
    throw error;
  }

  return response.json();
}

app.get("/health", async (req, res) => {
  try {
    const response = await fetch(`${ollamaBaseUrl}/api/tags`);
    const ok = response.ok;
    res.json({
      status: ok ? "ok" : "degraded",
      ollamaBaseUrl,
      ollamaReachable: ok,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "down",
      ollamaBaseUrl,
      ollamaReachable: false,
      error: String(error.message || error),
    });
  }
});

app.get("/api/models", async (req, res) => {
  try {
    const response = await fetch(`${ollamaBaseUrl}/api/tags`);
    if (!response.ok) {
      return res.status(502).json({
        error: `Failed to fetch models from Ollama (${response.status})`,
      });
    }

    const data = await response.json();
    const models = Array.isArray(data.models)
      ? data.models.map((item) => ({
          name: item.name,
          modified_at: item.modified_at,
          size: item.size,
        }))
      : [];

    return res.json({ models });
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
});

app.post("/api/chat", async (req, res) => {
  const { messages, model, mode, diagramType, temperature } = req.body || {};

  if (!model || typeof model !== "string") {
    return res.status(400).json({ error: "'model' is required" });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "'messages' must be a non-empty array" });
  }

    const systemForDiagrams = {
    role: "system",
    content:
      "When user asks for a diagram, return ONLY one fenced Mermaid block and a short title line above it. Keep syntax valid. Supported diagram types: flowchart, mindmap, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, journey, gantt.",
  };
  
  const systemForApps = {
    role: "system",
    content:
      "You are a helpful and conversational AI assistant. For normal chatter, just reply naturally and conversationally without any code.\n\n" +
      "ONLY WHEN the user explicitly asks you to build, create, or code a web app, game, or component, you must act as an expert web developer and strictly wrap your entire code inside a SINGLE Markdown codeblock (starting with ```html and ending with ```).\n\n" +
      "CRITICAL RULES FOR APPS:\n" +
      "1. NEVER output raw HTML outside or before the codeblock.\n" +
      "2. Merge all CSS (inside <style>) and Javascript (inside <script>) tightly into that one HTML file.\n" +
      "3. Do NOT provide separate codeblocks for CSS/JS.",
  };

  const finalMessages = mode === "diagram" ? [systemForDiagrams, ...messages] : [systemForApps, ...messages];

  try {
    const fetchRes = await fetch(`${ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: true, // Enabled live streaming
        options: {
          temperature: typeof temperature === "number" ? temperature : 0.4,
        },
        messages:
          mode === "diagram"
            ? [
                ...finalMessages,
                {
                  role: "user",
                  content: `Preferred diagram type: ${diagramType || "auto"}. If this type does not fit, choose the closest Mermaid-compatible type.`,
                },
              ]
            : finalMessages,
      })
    });

    if (!fetchRes.ok) {
      const errText = await fetchRes.text();
      return res.status(fetchRes.status).json({ error: `Ollama request failed: ${fetchRes.status}`, details: errText });
    }

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    for await (const chunk of fetchRes.body) {
      res.write(chunk);
    }
    
    return res.end();
  } catch (error) {
    return res.status(500).json({
      error: String(error.message || error),
      details: error.details,
      ollamaBaseUrl,
    });
  }
});

app.listen(port, () => {
  console.log(`awesome-bot server running at http://localhost:${port}`);
  console.log(`proxying Ollama at ${ollamaBaseUrl}`);
});
