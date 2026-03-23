import { StatusBar } from "expo-status-bar";
import { Picker } from "@react-native-picker/picker";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

type Role = "user" | "assistant";

type ChatMessage = {
  role: Role;
  content: string;
};

const DIAGRAM_TYPES = [
  "auto",
  "mindmap",
  "classDiagram",
  "sequenceDiagram",
  "flowchart",
  "erDiagram",
  "stateDiagram-v2",
  "journey",
  "gantt",
];

function extractMermaid(content: string): string | null {
  const match = content.match(/```mermaid\s*([\s\S]*?)```/i);
  return match?.[1]?.trim() || null;
}

function buildMermaidHtml(definition: string): string {
  const encoded = JSON.stringify(definition);
  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #f6f8fb;
        font-family: "Trebuchet MS", "Segoe UI", sans-serif;
      }
      #wrap {
        padding: 8px;
      }
      .mermaid {
        background: #ffffff;
        border-radius: 12px;
        padding: 8px;
      }
    </style>
    <script type="module">
      import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
      mermaid.initialize({ startOnLoad: true, theme: "neutral", securityLevel: "loose" });
      window.onload = () => {
        const el = document.querySelector('.mermaid');
        if (el) el.textContent = ${encoded};
        mermaid.run();
      };
    </script>
  </head>
  <body>
    <div id="wrap">
      <div class="mermaid"></div>
    </div>
  </body>
</html>`;
}

export default function App() {
  const [backendUrl, setBackendUrl] = useState("https://YOUR-NGROK-URL.ngrok-free.app");
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("qwen3.5:9b");
  const [mode, setMode] = useState<"chat" | "diagram">("chat");
  const [diagramType, setDiagramType] = useState("auto");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loadingModels, setLoadingModels] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = useMemo(
    () => !!prompt.trim() && !!selectedModel.trim() && !!backendUrl.trim() && !sending,
    [prompt, selectedModel, backendUrl, sending],
  );

  async function fetchModels() {
    setError(null);
    setLoadingModels(true);
    try {
      const response = await fetch(`${backendUrl.replace(/\/$/, "")}/api/models`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to fetch models");
      }

      const fetchedModels: string[] = (data?.models || []).map((item: { name: string }) => item.name);
      setModels(fetchedModels);

      if (fetchedModels.length > 0) {
        const hasCurrent = fetchedModels.includes(selectedModel);
        if (!hasCurrent) {
          const preferred = fetchedModels.find((name) => name.includes("qwen3.5:9b"))
            || fetchedModels.find((name) => name.toLowerCase().includes("gemma"))
            || fetchedModels[0];
          setSelectedModel(preferred);
        }
      }
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
      setError(message);
    } finally {
      setLoadingModels(false);
    }
  }

  async function sendMessage() {
    if (!canSend) {
      return;
    }

    setError(null);
    const userText = prompt.trim();
    const nextMessages = [...messages, { role: "user" as const, content: userText }];
    setMessages(nextMessages);
    setPrompt("");
    setSending(true);

    try {
      const response = await fetch(`${backendUrl.replace(/\/$/, "")}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          mode,
          diagramType,
          messages: nextMessages,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Chat request failed");
      }

      const assistantText: string = data?.content || "No response content returned.";
      setMessages((prev) => [...prev, { role: "assistant", content: assistantText }]);
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : String(sendError);
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Request failed: ${message}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>Awesome Bot</Text>
        <Text style={styles.subtitle}>Ollama phone chat + diagrams</Text>
      </View>

      <View style={styles.configCard}>
        <Text style={styles.label}>Backend URL (ngrok)</Text>
        <TextInput
          style={styles.input}
          value={backendUrl}
          onChangeText={setBackendUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://your-tunnel.ngrok-free.app"
        />

        <View style={styles.rowBetween}>
          <Text style={styles.label}>Model</Text>
          <Pressable onPress={fetchModels} style={styles.smallButton}>
            {loadingModels ? <ActivityIndicator size="small" color="#1d3557" /> : <Text style={styles.smallButtonText}>Refresh Models</Text>}
          </Pressable>
        </View>

        <View style={styles.pickerWrap}>
          <Picker selectedValue={selectedModel} onValueChange={(value) => setSelectedModel(String(value))}>
            {models.length === 0 ? <Picker.Item label={selectedModel} value={selectedModel} /> : null}
            {models.map((name) => (
              <Picker.Item key={name} label={name} value={name} />
            ))}
          </Picker>
        </View>

        <View style={styles.modeRow}>
          <Pressable onPress={() => setMode("chat")} style={[styles.modeButton, mode === "chat" && styles.modeButtonActive]}>
            <Text style={[styles.modeText, mode === "chat" && styles.modeTextActive]}>Chat</Text>
          </Pressable>
          <Pressable onPress={() => setMode("diagram")} style={[styles.modeButton, mode === "diagram" && styles.modeButtonActive]}>
            <Text style={[styles.modeText, mode === "diagram" && styles.modeTextActive]}>Diagram</Text>
          </Pressable>
        </View>

        {mode === "diagram" ? (
          <>
            <Text style={styles.label}>Diagram Type</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={diagramType} onValueChange={(value) => setDiagramType(String(value))}>
                {DIAGRAM_TYPES.map((kind) => (
                  <Picker.Item key={kind} label={kind} value={kind} />
                ))}
              </Picker>
            </View>
          </>
        ) : null}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <ScrollView style={styles.messagesWrap} contentContainerStyle={styles.messagesContent}>
        {messages.map((message, idx) => {
          const mermaid = extractMermaid(message.content);
          const isUser = message.role === "user";

          return (
            <View key={`${message.role}-${idx}`} style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
              <Text style={styles.roleLabel}>{isUser ? "You" : "Assistant"}</Text>
              <Text style={styles.bubbleText}>{message.content.replace(/```mermaid[\s\S]*?```/i, "").trim() || "(diagram below)"}</Text>
              {mermaid ? (
                <View style={styles.diagramContainer}>
                  <WebView
                    style={styles.webview}
                    originWhitelist={["*"]}
                    source={{ html: buildMermaidHtml(mermaid) }}
                    javaScriptEnabled
                    domStorageEnabled
                    nestedScrollEnabled
                  />
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.messageInput}
          placeholder={mode === "diagram" ? "Describe the diagram you want..." : "Ask anything..."}
          value={prompt}
          onChangeText={setPrompt}
          multiline
        />
        <Pressable onPress={sendMessage} disabled={!canSend} style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}>
          {sending ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.sendButtonText}>Send</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#e8f1f7",
    paddingTop: 56,
    paddingHorizontal: 14,
  },
  header: {
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1d3557",
  },
  subtitle: {
    color: "#2a6f97",
    fontSize: 13,
  },
  configCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#d9e7f0",
    marginBottom: 10,
  },
  label: {
    color: "#1d3557",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#b9d4e5",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 8,
    color: "#16324f",
    backgroundColor: "#f7fcff",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  smallButton: {
    backgroundColor: "#dff1fb",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallButtonText: {
    color: "#1d3557",
    fontWeight: "700",
    fontSize: 12,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: "#b9d4e5",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 8,
    backgroundColor: "#f7fcff",
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
  },
  modeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#9cc6de",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "#f0f8fd",
  },
  modeButtonActive: {
    backgroundColor: "#1d3557",
    borderColor: "#1d3557",
  },
  modeText: {
    color: "#1d3557",
    fontWeight: "700",
  },
  modeTextActive: {
    color: "#ffffff",
  },
  errorText: {
    color: "#b3002d",
    marginBottom: 8,
  },
  messagesWrap: {
    flex: 1,
  },
  messagesContent: {
    paddingBottom: 16,
    gap: 10,
  },
  bubble: {
    borderRadius: 14,
    padding: 10,
  },
  userBubble: {
    backgroundColor: "#cde9f9",
    alignSelf: "flex-end",
    maxWidth: "92%",
  },
  assistantBubble: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d9e7f0",
    alignSelf: "stretch",
  },
  roleLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#3f6c86",
    marginBottom: 4,
  },
  bubbleText: {
    color: "#112a40",
    lineHeight: 20,
  },
  diagramContainer: {
    marginTop: 8,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#d9e7f0",
    height: 300,
  },
  webview: {
    backgroundColor: "#f6f8fb",
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
    marginTop: 8,
  },
  messageInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#9cc6de",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#112a40",
  },
  sendButton: {
    width: 84,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1d3557",
  },
  sendButtonDisabled: {
    backgroundColor: "#8aa0b8",
  },
  sendButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
});
