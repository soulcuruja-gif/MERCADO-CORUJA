import { GoogleGenAI, Type } from "@google/genai";
import { Product, ScannedProduct, Category, ScannedExpense, ExpenseType } from "../types.ts";

// A instância do GoogleGenAI será criada dentro de cada função com a chave fornecida.

export const extractProductsFromMedia = async (base64Data: string, mimeType: string, apiKey: string): Promise<ScannedProduct[]> => {
  if (!apiKey) throw new Error("A chave da API do Gemini não foi configurada.");
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Extraia a lista de produtos desta Nota Fiscal (NF). 
    Campos necessários:
    - 'name': Nome descritivo do produto.
    - 'costPrice': Preço de custo UNITÁRIO (numérico).
    - 'quantity': Quantidade total comprada (numérico).
    - 'category': Uma destas categorias: ${Object.values(Category).join(", ")}.

    Retorne APENAS um array JSON válido.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mimeType, data: base64Data } }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              costPrice: { type: Type.NUMBER },
              quantity: { type: Type.NUMBER },
              category: { type: Type.STRING }
            },
            required: ["name", "costPrice", "quantity"]
          }
        }
      }
    });

    const text = response.text;
    return JSON.parse(text || "[]");
  } catch (error) {
    console.error("Gemini OCR Error:", error);
    throw new Error("Falha ao ler a Nota Fiscal.");
  }
};

export const extractExpenseFromMedia = async (base64Data: string, mimeType: string, apiKey: string): Promise<ScannedExpense> => {
  if (!apiKey) throw new Error("A chave da API do Gemini não foi configurada.");
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Analise este arquivo de conta.
    Extraia: 'description', 'amount', 'dueDate' (YYYY-MM-DD), 'type' ('Fixa' ou 'Estoque').
    Retorne APENAS o JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mimeType, data: base64Data } }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            dueDate: { type: Type.STRING },
            type: { type: Type.STRING }
          },
          required: ["description", "amount", "dueDate", "type"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
      description: result.description,
      amount: result.amount,
      dueDate: result.dueDate,
      type: (result.type === 'Estoque' ? ExpenseType.ESTOQUE : ExpenseType.FIXA)
    };
  } catch (error) {
    console.error("Gemini Expense Scan Error:", error);
    throw new Error("Não foi possível extrair dados.");
  }
};

export const identifyProductFromImage = async (base64Image: string, availableProducts: Product[], apiKey: string): Promise<Product | null> => {
  if (!apiKey) throw new Error("A chave da API do Gemini não foi configurada.");
  const ai = new GoogleGenAI({ apiKey });

  const productList = availableProducts.map(p => ({ id: p.id, name: p.name }));
  const prompt = `
    Qual produto desta lista melhor corresponde à imagem? 
    ${JSON.stringify(productList)}
    Retorne APENAS o JSON: {"productId": "ID_AQUI"} ou {"productId": null}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/jpeg", data: base64Image } }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            productId: { type: Type.STRING }
          }
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return availableProducts.find(p => p.id === result.productId) || null;
  } catch (error) {
    return null;
  }
};