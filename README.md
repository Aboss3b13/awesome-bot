# Awesome Bot ?

A beautiful, local, and blazing-fast chat interface connecting to the gemma3:4b AI model (running entirely on your NVIDIA GPU via Ollama), wrapped in a sleek Express Server frontend with full Markdown, syntax-highlighting, and DOM-purification built right in!

## Why is it Awesome?
- ?? **Zero Latency & 100% Private:** Runs entirely on-device using your GPU. No cloud APIs, no data telemetry.
- ?? **Gorgeous UI:** Glassmorphism chat design featuring an auto-expanding input box, bouncing dark-mode dot-typing indicators, responsive message bounds, and smooth scroll.
- ?? **Syntax Highlight:** Auto-detects programming languages (Python, JS, C++, HTML) the AI emits and renders beautiful Tokyo Night Dark highlighted code boxes inside bubbles.
- ?? **Markdown Output:** Supports bolding, italics, code snippets, nested quotes, tables, and ordered lists, powered by Marked.js.
- ?? **XSS Protection:** Integrates DOMPurify natively so you're safe.

---

## ?? Prerequisites

1. **[Ollama](https://ollama.com/)** running locally to serve the model. You must have pulled the model (ollama pull gemma3:4b).
2. **[Node.js](https://nodejs.org)** installed on your machine.
3. *Optional:* **[ngrok](https://ngrok.com/)** if you intend to share the UI over the internet.

---

## ?? One-Click Start (Windows)
We've made starting the application extremely easy.

1. Double-click the start.bat file in the root directory.
2. The script will automatically check if Node.js dependencies are missing and 
pm install them. 
3. It will launch the node server automatically.
4. Click or open **http://localhost:8787** to use the application!

*Note: For Unix/Mac users, manually enter the \server\ folder, run \
pm install\, then \
pm start\.*

---

## ?? Public Sharing
To host this out to the world:
1. Ensure the start.bat is running your server locally.
2. In a separate terminal, type:
   \\\ash
   ngrok http 8787
   \\\
3. Share the \https://xxxx.ngrok-free.app\ URL with anyone!
