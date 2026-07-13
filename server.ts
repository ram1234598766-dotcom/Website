import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { getWebSearchData, getWeatherData, getAstrologyData } from "./tools.js";
import fs from "fs";

function writeLog(msg: string) {
  fs.appendFileSync("chat.log", msg + "\n");
}

async function fetchWithRetry(url: string, options: any, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(url, options);
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
      continue;
    }
    return res;
  }
  return fetch(url, options);
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/training-stats", (req, res) => {
    // Generate some dynamic but realistic looking stats based on time
    const now = Date.now();
    const baseDatapoints = 142893110;
    const timeOffset = Math.floor((now - 1718000000000) / 1000); // just an arbitrary epoch
    
    res.json({
      datapoints: baseDatapoints + (timeOffset * 42),
      parameters: 4200 + Math.floor(Math.random() * 200),
      latency: 0.5 + (Math.random() * 1.5)
    });
  });

  app.get("/deployed/my-model", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Lion Deployed Model: my-model</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&family=JetBrains+Mono:wght@400;700&display=swap');
          body { font-family: 'Space Grotesk', sans-serif; background-color: #0f172a; color: #f8fafc; }
          .mono { font-family: 'JetBrains Mono', monospace; }
        </style>
      </head>
      <body class="min-h-screen p-8 flex flex-col items-center justify-center relative overflow-hidden">
        <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMzMzQxNTUiLz48L3N2Zz4=')] opacity-20"></div>
        <div class="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500 rounded-full blur-[100px] opacity-20"></div>
        <div class="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500 rounded-full blur-[100px] opacity-20"></div>
        
        <div class="max-w-4xl w-full z-10 space-y-8">
          <div class="text-center space-y-4">
            <div class="inline-flex items-center gap-2 px-3 py-1 bg-emerald-950 border border-emerald-800 rounded-full text-emerald-400 text-xs font-bold tracking-widest uppercase">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live: OpenLayer Global Mesh
            </div>
            <h1 class="text-5xl font-bold tracking-tight text-white">Model: <span class="text-indigo-400">my-model</span></h1>
            <p class="text-slate-400 text-lg max-w-2xl mx-auto">This neural inference endpoint is securely deployed on OpenLayer's free, distributed edge architecture.</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <div class="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Compute</div>
              <div class="text-3xl font-bold text-white mono">100 GB RAM</div>
              <div class="text-sm text-slate-400 mt-2">Burstable DDR5</div>
            </div>
            <div class="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <div class="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Storage</div>
              <div class="text-3xl font-bold text-white mono">50 TB</div>
              <div class="text-sm text-slate-400 mt-2">NVMe Gen5</div>
            </div>
            <div class="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <div class="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Hardware</div>
              <div class="text-3xl font-bold text-white mono">Premium GPU</div>
              <div class="text-sm text-slate-400 mt-2">Dedicated T4 Accelerator</div>
            </div>
          </div>

          <div class="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl">
            <h2 class="text-2xl font-bold mb-4">Inference API Ready</h2>
            <div class="bg-black p-4 rounded-xl mono text-sm text-slate-300">
              <p><span class="text-pink-500">POST</span> /api/v1/predict</p>
              <br>
              <p class="text-slate-500">// Example payload</p>
              <p class="text-emerald-300">{</p>
              <p class="text-emerald-300 ml-4">"inputs": [0.4, 0.9, -1.2, ...]</p>
              <p class="text-emerald-300">}</p>
            </div>
            <div class="mt-6 flex justify-end">
              <button class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-6 rounded-lg transition-all" onclick="alert('Inference requested! Simulated response: { output: [0.99] }')">
                Test Inference
              </button>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, model } = req.body;
      
      const systemInstruction = `You are the Omni-AI for OpenLayer. You are 100% free and unlimited. 
You have access to live data and the internet.
If the user asks for weather, reply EXACTLY with 'TOOL:WEATHER:<city>'.
If they ask for astrology/horoscope, reply EXACTLY with 'TOOL:ASTROLOGY:<sign>'.
If they ask for news, facts, or any other real-time data, reply EXACTLY with 'TOOL:SEARCH:<search_query>'.
DO NOT apologize. DO NOT say you don't have access. YOU DO HAVE ACCESS via these tools.
Just reply with the tool format and you will receive the data to formulate your answer.`;

      let formattedMessages = [
        { role: "system", content: systemInstruction },
        ...messages
      ];

      let response = await fetchWithRetry("https://text.pollinations.ai/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: formattedMessages,
          model: "openai",
          jsonMode: false
        })
      });

      if (!response.ok) {
        throw new Error(`Upstream API error: ${response.statusText}`);
      }

      let text = await response.text();
      writeLog("FIRST LLM RESPONSE: " + text);
      let toolCalled = false;

      // Sometimes pollinations.ai returns JSON, let's try to extract if it did a tool call
      let toolName = "";
      let toolArg = "";

      const weatherMatch = text.match(/TOOL:WEATHER:([A-Za-z0-9\s,\-]+)/);
      const astroMatch = text.match(/TOOL:ASTROLOGY:([A-Za-z0-9\s]+)/);
      const searchMatch = text.match(/TOOL:SEARCH:([A-Za-z0-9\s]+)/);

      if (weatherMatch) {
        toolName = "weather";
        toolArg = weatherMatch[1].trim();
      } else if (astroMatch) {
        toolName = "astrology";
        toolArg = astroMatch[1].trim();
      } else if (searchMatch) {
        toolName = "search";
        toolArg = searchMatch[1].trim();
      }

      if (toolName === "weather") {
        writeLog("WEATHER TOOL EXTRACTED CITY: " + toolArg);
        const data = await getWeatherData(toolArg);
        writeLog("WEATHER DATA: " + data);
        formattedMessages.push({ role: "assistant", content: text });
        formattedMessages.push({ role: "user", content: `Here is the real-time weather data:\n${data}\n\nPlease use this data to answer my previous question accurately. DO NOT call any more tools. Provide the final text answer directly to the user.` });
        toolCalled = true;
      } else if (toolName === "astrology") {
        writeLog("ASTROLOGY TOOL EXTRACTED SIGN: " + toolArg);
        const data = await getAstrologyData(toolArg);
        writeLog("ASTROLOGY DATA: " + data);
        formattedMessages.push({ role: "assistant", content: text });
        formattedMessages.push({ role: "user", content: `Here is the real-time astrology data:\n${data}\n\nPlease use this data to answer my previous question accurately. DO NOT call any more tools. Provide the final text answer directly to the user.` });
        toolCalled = true;
      } else if (toolName === "search") {
        writeLog("SEARCH TOOL EXTRACTED QUERY: " + toolArg);
        const data = await getWebSearchData(toolArg);
        writeLog("SEARCH DATA: " + data);
        formattedMessages.push({ role: "assistant", content: text });
        formattedMessages.push({ role: "user", content: `Here is the real-time data from the web search:\n${data}\n\nPlease use this data to answer my previous question accurately. DO NOT call any more tools. Provide the final text answer directly to the user.` });
        toolCalled = true;
      }

      if (toolCalled) {
        writeLog("CALLING LLM SECOND TIME WITH MESSAGES: " + JSON.stringify(formattedMessages, null, 2));
        // Wait to avoid rate limiting
        await new Promise(r => setTimeout(r, 2000));
        
        response = await fetchWithRetry("https://text.pollinations.ai/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messages: formattedMessages,
            model: "openai",
            jsonMode: false
          })
        });
        
        if (!response.ok) {
           throw new Error(`Upstream API error after tool call: ${response.statusText}`);
        }
        text = await response.text();
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Clean up the text response
      let cleanText = text.replace(/TOOL:(SEARCH|WEATHER|ASTROLOGY):[^\n]+\n?/g, '');
      cleanText = cleanText.split("\n\n\n\n---\n\n**Support Pollinations.AI:**")[0];

      // Send the entire text as a single SSE chunk for simplicity
      const data = JSON.stringify({ text: cleanText });
      res.write(`data: ${data}\n\n`);
      res.end();

    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || "Unknown error";
      
      try {
        const match = errMsg.match(/\{.*\}/s);
        if (match) {
          const parsed1 = JSON.parse(match[0]);
          if (parsed1.error && parsed1.error.message) {
            try {
              const parsed2 = JSON.parse(parsed1.error.message);
              if (parsed2.error && parsed2.error.message) {
                 errMsg = parsed2.error.message;
              } else {
                 errMsg = parsed1.error.message;
              }
            } catch (e) {
              errMsg = parsed1.error.message;
            }
          }
        }
      } catch (e) {}

      res.status(500).json({ error: errMsg });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
