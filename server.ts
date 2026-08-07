import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "20mb" }));

// Initialize Gemini client lazily
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// Health check route
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// AI Data Quality & Audit Route
app.post("/api/ai-analyze", async (req, res) => {
  try {
    const { esteirasSummary, sampleData, columnNames, totalRecords } = req.body;

    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({
        error: "Chave API Gemini não configurada no servidor.",
        fallback: true
      });
    }

    const prompt = `
Você é um especialista em Análise de Dados e Engenharia de Processos de Negócio (Esteiras de Operação/Tabuladores).
O usuário acabou de consolidar várias abas (esteiras) de um arquivo Excel em uma única Base de Dados Principal.

Estatísticas da Consolidação:
- Total de registros consolidados: ${totalRecords}
- Colunas unificadas: ${JSON.stringify(columnNames)}
- Resumo por Esteira: ${JSON.stringify(esteirasSummary)}
- Amostra dos Dados Consolidados (primeiras 5 linhas): ${JSON.stringify(sampleData)}

Por favor, faça uma auditoria rápida e gere um relatório executivo em português com o seguinte formato JSON estrito:
{
  "resumoExecutivo": "Resumo em 2 frases sobre a consolidação e integridade geral.",
  "qualidadeDados": {
    "score": 85,
    "diagnostico": "Explicação do score de qualidade considerando consistência das colunas e preenchimento."
  },
  "alertasInconsistencia": [
    "Alerta 1 sobre inconsistência potencial (ex: colunas sem correspondência em alguma esteira, formatos de data)",
    "Alerta 2 sobre duplicatas ou valores nulos"
  ],
  "insightsOperacionais": [
    "Insight 1 (ex: qual esteira possui maior volume de processos)",
    "Insight 2 sobre distribuição dos status"
  ],
  "recomendacoes": [
    "Recomendação 1 para padronização futura do tabulador",
    "Recomendação 2 para saneamento da base"
  ]
}

Responda APENAS com o JSON válido, sem marcadores de markdown adicionais nem texto fora do JSON.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text = response.text || "";
    const cleanJsonText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(cleanJsonText);

    res.json({ success: true, analysis: result });
  } catch (error: any) {
    console.error("Erro na análise IA:", error);
    res.status(500).json({
      error: "Falha ao processar análise da IA.",
      details: error?.message || String(error)
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Consolidador Express Server] Executando em http://localhost:${PORT}`);
  });
}

startServer();
