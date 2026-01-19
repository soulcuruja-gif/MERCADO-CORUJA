
import { GoogleGenAI, Type } from "@google/genai";
import { Product, Sale, Expense, ScannedProduct, Category, ScannedExpense, ExpenseType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getBusinessInsights = async (products: Product[], sales: Sale[], expenses: Expense[]) => {
  const prompt = `
    Analise os seguintes dados de um mini-mercado e forneça insights estratégicos (em português):
    
    Produtos: ${JSON.stringify(products.map(p => ({ name: p.name, stock: p.stock, minStock: p.minStock, margin: ((p.salePrice - p.costPrice)/p.salePrice * 100).toFixed(2) + '%' })))}
    Vendas Totais: ${sales.length} transações, Total: R$ ${sales.reduce((acc, s) => acc + s.total, 0).toFixed(2)}
    Despesas: R$ ${expenses.reduce((acc, e) => acc + e.amount, 0).toFixed(2)}

    Por favor, retorne um resumo com:
    1. Itens críticos de estoque.
    2. Produtos com margens baixas ou altas.
    3. Uma dica para aumentar a lucratividade este mês.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    return "Não foi possível gerar insights no momento.";
  }
};

export const extractProductsFromMedia = async (base64Data: string, mimeType: string): Promise<ScannedProduct[]> => {
  const prompt = `
    Extraia a lista de produtos desta Nota Fiscal (NF). 
    REGRAS CRÍTICAS DE CÁLCULO:
    1. 'quantity': Identifique a quantidade total de unidades. Se constar "45UN", a quantidade é 45.
    2. 'costPrice': Este deve ser o VALOR UNITÁRIO de custo. Se a NF apresentar apenas o VALOR TOTAL do item, você DEVE dividir esse valor total pela quantidade para encontrar o preço unitário.
    Exemplo: Se a NF diz "Cerveja Latão 12UN - Total R$ 60,00", retorne quantity: 12 e costPrice: 5.00.
    
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

export const extractExpenseFromMedia = async (base64Data: string, mimeType: string): Promise<ScannedExpense> => {
  const prompt = `
    Analise este arquivo de conta (luz, água, aluguel, NF de fornecedor, etc).
    Extraia os seguintes campos:
    - 'description': O que é a despesa (ex: Conta de Luz, Fornecedor X).
    - 'amount': Valor total a pagar.
    - 'dueDate': Data de vencimento no formato YYYY-MM-DD. Se não houver, use a data de hoje.
    - 'type': Identifique se é 'Fixa' ou 'Estoque'. NFs de mercadoria são 'Estoque'.

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
            type: { 
              type: Type.STRING,
              description: "Deve ser exatamente 'Fixa' ou 'Estoque'."
            }
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
    throw new Error("Não foi possível extrair os dados da fatura.");
  }
};

export const identifyProductFromImage = async (base64Image: string, availableProducts: Product[]): Promise<Product | null> => {
  const productList = availableProducts.map(p => ({ id: p.id, name: p.name }));
  const prompt = `
    Analise a imagem deste produto de supermercado.
    Temos a seguinte lista de produtos cadastrados no estoque:
    ${JSON.stringify(productList)}

    Qual produto da lista melhor corresponde à imagem? 
    Retorne o ID do produto ou nulo se for impossível identificar.
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
    if (result.productId) {
      return availableProducts.find(p => p.id === result.productId) || null;
    }
    return null;
  } catch (error) {
    console.error("Gemini Vision POS Error:", error);
    return null;
  }
};
