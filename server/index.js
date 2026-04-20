const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const xlsx = require("xlsx");

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8787);
const ollamaBaseUrl = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

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

app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const buffer = req.file.buffer;
    const name = req.file.originalname.toLowerCase();
    let text = "";

    try {
      if (name.endsWith(".pdf")) {
        const data = await pdfParse(buffer);
        text = data.text;
      } else if (name.endsWith(".docx") || name.endsWith(".doc")) {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } else if (name.match(/\.(xlsx|xls|csv)$/)) {
        const workbook = xlsx.read(buffer, { type: "buffer" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        text = xlsx.utils.sheet_to_csv(firstSheet);
      } else {
        text = buffer.toString("utf8");
      }
    } catch (parseError) {
      return res.status(400).json({ error: "Could not parse file content. Make sure the file is not corrupted or password protected." });
    }

    // Limit document context to prevent blowing up the LLM's context window
    const maxLength = 200000;
    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + "\n\n[...TRUNCATED due to length...]";
    }

    res.json({ text: text.trim(), filename: req.file.originalname });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "File processing failed: " + err.message });
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
      "When user asks for a diagram, return ONLY one fenced Mermaid block (starting with ```mermaid and ending with ```) and a short title line above it. Keep syntax valid. Supported diagram types: flowchart, mindmap, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, journey, gantt. ONLY use ```mermaid.",
  };
  
  const systemForApps = {
    role: "system",
    content:
      "You are a helpful AI assistant. Answer conversations naturally.\n" +
      "1. WESBITES/APPS: If the user asks you to write code, create an app, make a website, or create a UI, wrap your ENTIRE code (HTML, CSS, JS combined) securely inside a single ```html code block.\n" +
      "2. CHARTS: If the user asks for a chart or data visualization (e.g. bar, line, pie, radar, doughnut, scatter chart), YOU MUST return a valid JSON object representing a complete Chart.js configuration EXACTLY inside a ```chartjs code block. Do NOT write JS functions, only valid JSON.\n" +
      "3. DIAGRAMS: If the user asks for a diagram, flowchart, mindmap, sequence, structural map, or architecture diagram, YOU MUST return valid Mermaid.js code EXACTLY inside a ```mermaid code block.\n" +
      "CRITICAL: You must choose the CORRECT format and wrap it in the exact language tag (```html, ```chartjs, or ```mermaid). Never use generic ```code or ```json for charts/diagrams! Never use markdown for apps. Be highly visual when requested.\n",
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
