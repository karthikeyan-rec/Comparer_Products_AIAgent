// Unit Conversion Factors mapping to base units
// We normalize weights to 'kg' and volumes to 'l'
const UNIT_CONVERSIONS = {
    weight: {
        'kg': 1,
        'g': 0.001,
        'mg': 0.000001,
        'lb': 0.45359237,
        'lbs': 0.45359237,
        'oz': 0.028349523
    },
    volume: {
        'l': 1,
        'liter': 1,
        'liters': 1,
        'ml': 0.001,
        'floz': 0.0295735,
        'gal': 3.78541
    }
};

// Sanitizes and validates numeric inputs
function sanitizeNumber(val) {
    if (typeof val === 'number') {
        return val;
    }
    if (typeof val === 'string') {
        // Strip out currency signs and spaces
        const cleanStr = val.replace(/[^\d.]/g, '').trim();
        if (!cleanStr || (cleanStr.match(/\./g) || []).length > 1) {
            throw new Error(`Invalid non-numeric input: '${val}'`);
        }
        const parsed = parseFloat(cleanStr);
        if (isNaN(parsed)) {
            throw new Error(`Invalid non-numeric input: '${val}'`);
        }
        return parsed;
    }
    throw new TypeError(`Expected numeric input, got ${typeof val}`);
}

function validateInput(num, name) {
    const val = sanitizeNumber(num);
    if (val <= 0) {
        throw new Error(`${name} must be positive and non-zero. Received: ${val}`);
    }
    return val;
}

// -------------------------------------------------------------
// Core Deterministic Tools
// -------------------------------------------------------------

function calculateUnitPrice(price, quantity, unitName) {
    const p = validateInput(price, 'Price');
    const q = validateInput(quantity, 'Quantity');
    const unitPrice = p / q;
    return `${unitPrice.toFixed(4)} per ${unitName.trim()}`;
}

function compareUnitPrices(priceA, priceB, unitName) {
    const valA = validateInput(priceA, 'Price A');
    const valB = validateInput(priceB, 'Price B');
    const diff = Math.abs(valA - valB);
    const commonUnit = unitName.trim();

    if (diff < 1e-6) {
        return `Both products cost the same: ₹${valA.toFixed(2)} per ${commonUnit}.`;
    } else if (valA < valB) {
        const percentCheaper = ((valB - valA) / valB) * 100;
        return `Product A is cheaper at ₹${valA.toFixed(2)} per ${commonUnit} (Product B is ₹${valB.toFixed(2)} per ${commonUnit}). Product A is ${percentCheaper.toFixed(1)}% more cost-effective.`;
    } else {
        const percentCheaper = ((valA - valB) / valA) * 100;
        return `Product B is cheaper at ₹${valB.toFixed(2)} per ${commonUnit} (Product A is ₹${valA.toFixed(2)} per ${commonUnit}). Product B is ${percentCheaper.toFixed(1)}% more cost-effective.`;
    }
}

// -------------------------------------------------------------
// Freeform parsing helper
// -------------------------------------------------------------
function parseFreeformQuery(query) {
    let result = {
        nameA: "Product A", priceA: "", qtyA: "", unitA: "g",
        nameB: "Product B", priceB: "", qtyB: "", unitB: "g",
        targetUnit: "kg"
    };

    // Remove currency signs for matching
    const cleaned = query.replace(/[₹$€£]/g, ' ');

    // Split by product indicators
    const parts = cleaned.split(/(?:Product B|ProductB|versus|vs|and B)/i);
    
    const extractInfo = (text) => {
        const qtyMatch = text.match(/(\d+(?:\.\d+)?)\s*(g|kg|ml|l|liter|liters|lbs|lb|oz|pcs|units|packs|pack)/i);
        const priceMatches = [...text.matchAll(/(?:\b|rs\.?|rs\s*)(\d+(?:\.\d+)?)\b/ig)];
        
        let qty = "";
        let unit = "";
        if (qtyMatch) {
            qty = qtyMatch[1];
            unit = qtyMatch[2].toLowerCase();
        }
        
        let price = "";
        for (let m of priceMatches) {
            let val = m[1];
            if (val !== qty) {
                price = val;
                break;
            }
        }
        return { price, qty, unit };
    };

    if (parts.length >= 1) {
        const infoA = extractInfo(parts[0]);
        if (infoA.price) result.priceA = infoA.price;
        if (infoA.qty) result.qtyA = infoA.qty;
        if (infoA.unit) result.unitA = infoA.unit;
    }
    if (parts.length >= 2) {
        const infoB = extractInfo(parts[1]);
        if (infoB.price) result.priceB = infoB.price;
        if (infoB.qty) result.qtyB = infoB.qty;
        if (infoB.unit) result.unitB = infoB.unit;
    }

    const targetMatch = query.match(/cheaper\s+per\s+([a-zA-Z]+)|value\s+per\s+([a-zA-Z]+)|per\s+([a-zA-Z]+)/i);
    if (targetMatch) {
        result.targetUnit = (targetMatch[1] || targetMatch[2] || targetMatch[3]).toLowerCase();
    }

    return result;
}

// Helper to determine conversion ratio between units
function getConversionFactor(from, to) {
    if (UNIT_CONVERSIONS.weight[from] && UNIT_CONVERSIONS.weight[to]) {
        return UNIT_CONVERSIONS.weight[from] / UNIT_CONVERSIONS.weight[to];
    }
    if (UNIT_CONVERSIONS.volume[from] && UNIT_CONVERSIONS.volume[to]) {
        return UNIT_CONVERSIONS.volume[from] / UNIT_CONVERSIONS.volume[to];
    }
    if (from === to) return 1;
    throw new Error(`Incompatible units or unsupported conversion: from '${from}' to '${to}'`);
}

// -------------------------------------------------------------
// Local Sandbox ReAct Agent Simulator
// -------------------------------------------------------------
async function runLocalSandboxAgent(data, logCallback, completionCallback) {
    const { nameA, priceA, qtyA, unitA, nameB, priceB, qtyB, unitB, targetUnit } = data;
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    logCallback({ type: 'info', text: 'Initializing Sandbox ReAct Agent...' });
    await delay(800);
    
    const questionText = `Product A (${nameA}): ₹${priceA} for ${qtyA}${unitA}. Product B (${nameB}): ₹${priceB} for ${qtyB}${unitB}. Which is cheaper per ${targetUnit}?`;
    logCallback({ type: 'info', text: `Question: ${questionText}` });
    await delay(1000);

    // Thought 1
    logCallback({ 
        type: 'thought', 
        text: `Thought: I need to determine which product offers the better value per ${targetUnit}. First, I will normalize the quantities of both products to the common target unit: ${targetUnit}. Normalization ensures that subsequent calculations are accurate and directly comparable.
        - Product A: Convert ${qtyA}${unitA} to ${targetUnit}.
        - Product B: Convert ${qtyB}${unitB} to ${targetUnit}.` 
    });
    await delay(2000);

    let normalizedQtyA, normalizedQtyB;
    let explanationA = "", explanationB = "";

    try {
        const factorA = getConversionFactor(unitA, targetUnit);
        normalizedQtyA = parseFloat(qtyA) * factorA;
        explanationA = factorA !== 1 
            ? `converting ${qtyA}${unitA} to ${targetUnit} gives ${normalizedQtyA.toFixed(4)}${targetUnit} (ratio: ${factorA.toFixed(4)})` 
            : `already in target unit ${targetUnit}`;

        const factorB = getConversionFactor(unitB, targetUnit);
        normalizedQtyB = parseFloat(qtyB) * factorB;
        explanationB = factorB !== 1 
            ? `converting ${qtyB}${unitB} to ${targetUnit} gives ${normalizedQtyB.toFixed(4)}${targetUnit} (ratio: ${factorB.toFixed(4)})` 
            : `already in target unit ${targetUnit}`;
    } catch (e) {
        logCallback({ type: 'error', text: `Unit conversion failed: ${e.message}` });
        completionCallback({ success: false });
        return;
    }

    logCallback({ 
        type: 'thought', 
        text: `Thought: Product A quantity is normalized. ${explanationA}. I will now call the 'calculate_unit_price' tool to calculate the unit price for Product A.` 
    });
    await delay(1800);

    // Action 1
    logCallback({ 
        type: 'action', 
        text: `Action: calculate_unit_price(price=${priceA}, quantity=${normalizedQtyA.toFixed(4)}, unit_name='${targetUnit}')` 
    });
    await delay(1000);

    let resA;
    try {
        resA = calculateUnitPrice(priceA, normalizedQtyA, targetUnit);
    } catch(err) {
        logCallback({ type: 'error', text: `Observation (Error): ${err.message}` });
        completionCallback({ success: false });
        return;
    }
    const valA = parseFloat(resA.split(' ')[0]);

    logCallback({ type: 'observation', text: `Observation: ${resA}` });
    await delay(1500);

    // Thought 2
    logCallback({ 
        type: 'thought', 
        text: `Thought: Product A costs ₹${valA.toFixed(4)} per ${targetUnit}. Next, I need to normalize and calculate the unit price for Product B. ${explanationB}. I will call the 'calculate_unit_price' tool for Product B.` 
    });
    await delay(1800);

    // Action 2
    logCallback({ 
        type: 'action', 
        text: `Action: calculate_unit_price(price=${priceB}, quantity=${normalizedQtyB.toFixed(4)}, unit_name='${targetUnit}')` 
    });
    await delay(1000);

    let resB;
    try {
        resB = calculateUnitPrice(priceB, normalizedQtyB, targetUnit);
    } catch(err) {
        logCallback({ type: 'error', text: `Observation (Error): ${err.message}` });
        completionCallback({ success: false });
        return;
    }
    const valB = parseFloat(resB.split(' ')[0]);

    logCallback({ type: 'observation', text: `Observation: ${resB}` });
    await delay(1500);

    // Thought 3
    logCallback({ 
        type: 'thought', 
        text: `Thought: Product B costs ₹${valB.toFixed(4)} per ${targetUnit}. I now have both unit prices: Product A (₹${valA.toFixed(4)} per ${targetUnit}) and Product B (₹${valB.toFixed(4)} per ${targetUnit}). I will use the 'compare_unit_prices' tool to compare them deterministically.` 
    });
    await delay(1800);

    // Action 3
    logCallback({ 
        type: 'action', 
        text: `Action: compare_unit_prices(price_a=${valA.toFixed(4)}, price_b=${valB.toFixed(4)}, unit_name='${targetUnit}')` 
    });
    await delay(1000);

    let compRes;
    try {
        compRes = compareUnitPrices(valA, valB, targetUnit);
    } catch(err) {
        logCallback({ type: 'error', text: `Observation (Error): ${err.message}` });
        completionCallback({ success: false });
        return;
    }

    logCallback({ type: 'observation', text: `Observation: ${compRes}` });
    await delay(1500);

    // Final Thought
    logCallback({ 
        type: 'thought', 
        text: `Thought: I have obtained the final comparison details. I can now conclude my recommendation.` 
    });
    await delay(1200);

    // Final Answer
    const isWinnerA = valA < valB;
    const isWinnerB = valB < valA;
    const isTie = Math.abs(valA - valB) < 1e-6;

    let verdict = "";
    if (isTie) {
        verdict = `Both products offer equal value at ₹${valA.toFixed(2)} per ${targetUnit}.`;
    } else if (isWinnerA) {
        const pct = ((valB - valA) / valB) * 100;
        verdict = `${nameA} offers the better value at ₹${valA.toFixed(2)} per ${targetUnit}, making it ${pct.toFixed(1)}% cheaper than ${nameB} (which costs ₹${valB.toFixed(2)} per ${targetUnit}).`;
    } else {
        const pct = ((valA - valB) / valA) * 100;
        verdict = `${nameB} offers the better value at ₹${valB.toFixed(2)} per ${targetUnit}, making it ${pct.toFixed(1)}% cheaper than ${nameA} (which costs ₹${valA.toFixed(2)} per ${targetUnit}).`;
    }

    logCallback({ type: 'answer', text: `Final Answer: ${verdict}` });

    completionCallback({
        success: true,
        valA: valA,
        valB: valB,
        winner: isTie ? 'tie' : (isWinnerA ? 'A' : 'B'),
        verdict: verdict
    });
}

// -------------------------------------------------------------
// Live Gemini ReAct Agent
// -------------------------------------------------------------
async function runGeminiAgent(apiKey, queryText, logCallback, completionCallback) {
    let conversationHistory = [
        {
            role: "user",
            parts: [{ text: queryText }]
        }
    ];

    const systemInstruction = `You are a Unit-Price Comparer Agent.
Your task is to determine which product offers the better value per unit.

CRITICAL RULES:
1. NEVER do division or arithmetic calculations yourself.
2. Normalize quantities to a common target unit (e.g., if comparing 500g and 1kg, convert 500g to 0.5kg or 1kg to 1000g).
3. Use 'calculate_unit_price' for both products separately.
4. Use 'compare_unit_prices' to get the final comparison.
5. Provide a clear final answer with the per-unit price of each product and your recommendation.
6. When thinking, explain your steps clearly.`;

    const tools = [{
        functionDeclarations: [
            {
                name: 'calculate_unit_price',
                description: 'Calculates the price per unit deterministically. Returns unit price string.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        price: { type: 'NUMBER', description: 'Total cost of the product (numeric)' },
                        quantity: { type: 'NUMBER', description: 'Total quantity in the normalized unit (numeric)' },
                        unit_name: { type: 'STRING', description: 'The unit representation (e.g., kg, g, liter)' }
                    },
                    required: ['price', 'quantity', 'unit_name']
                }
            },
            {
                name: 'compare_unit_prices',
                description: 'Compares two per-unit prices deterministically to decide which is cheaper. Returns comparison report string.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        price_a: { type: 'NUMBER', description: 'Per-unit price of Product A' },
                        price_b: { type: 'NUMBER', description: 'Per-unit price of Product B' },
                        unit_name: { type: 'STRING', description: 'The common unit used for both prices (e.g., kg, g, liter)' }
                    },
                    required: ['price_a', 'price_b', 'unit_name']
                }
            }
        ]
    }];

    const maxLoops = 10;
    let loop = 0;
    let unitPricesCalculated = { A: null, B: null };

    logCallback({ type: 'info', text: "Starting Live Gemini Agent..." });

    while (loop < maxLoops) {
        loop++;
        const payload = {
            contents: conversationHistory,
            systemInstruction: { parts: [{ text: systemInstruction }] },
            tools: tools
        };

        logCallback({ type: 'info', text: `Contacting Gemini API via secure proxy (turn ${loop})...` });

        let response;
        try {
            // Route through the local server proxy (/api/gemini).
            // The GEMINI_API_KEY is injected server-side from .env — never exposed to the browser.
            const res = await fetch('/api/gemini?model=gemini-1.5-flash', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error?.message || `HTTP ${res.status}`);
            }
            response = await res.json();
        } catch (error) {
            logCallback({ type: 'error', text: `Gemini API Error: ${error.message}` });
            completionCallback({ success: false });
            return;
        }

        const candidate = response.candidates?.[0];
        if (!candidate) {
            logCallback({ type: 'error', text: "No response candidates returned by Gemini." });
            completionCallback({ success: false });
            return;
        }

        const content = candidate.content;
        conversationHistory.push(content);

        const parts = content.parts || [];
        let textPart = parts.find(p => p.text)?.text;
        let functionCalls = parts.filter(p => p.functionCall);

        if (textPart) {
            logCallback({ type: 'thought', text: `Thought: ${textPart}` });
        }

        if (functionCalls.length === 0) {
            logCallback({ type: 'answer', text: `Final Answer: ${textPart || "Comparison complete."}` });
            
            const isWinnerA = unitPricesCalculated.A < unitPricesCalculated.B;
            const isWinnerB = unitPricesCalculated.B < unitPricesCalculated.A;
            const isTie = unitPricesCalculated.A && unitPricesCalculated.B && Math.abs(unitPricesCalculated.A - unitPricesCalculated.B) < 1e-6;

            completionCallback({
                success: true,
                valA: unitPricesCalculated.A,
                valB: unitPricesCalculated.B,
                winner: isTie ? 'tie' : (isWinnerA ? 'A' : (isWinnerB ? 'B' : null)),
                verdict: textPart || "Done."
            });
            return;
        }

        let toolResponseParts = [];
        for (let call of functionCalls) {
            const { name, args } = call.functionCall;
            logCallback({ type: 'action', text: `Action: ${name}(${JSON.stringify(args)})` });

            let resultText = "";
            try {
                if (name === 'calculate_unit_price') {
                    resultText = calculateUnitPrice(args.price, args.quantity, args.unit_name);
                    const parsedVal = parseFloat(resultText.split(' ')[0]);
                    if (unitPricesCalculated.A === null) {
                        unitPricesCalculated.A = parsedVal;
                    } else if (unitPricesCalculated.B === null) {
                        unitPricesCalculated.B = parsedVal;
                    }
                } else if (name === 'compare_unit_prices') {
                    resultText = compareUnitPrices(args.price_a, args.price_b, args.unit_name);
                } else {
                    throw new Error(`Unknown tool: ${name}`);
                }
            } catch (err) {
                resultText = `Error: ${err.message}`;
            }

            logCallback({ type: 'observation', text: `Observation: ${resultText}` });

            toolResponseParts.push({
                functionResponse: {
                    name: name,
                    response: { result: resultText }
                }
            });
        }

        conversationHistory.push({
            role: "function",
            parts: toolResponseParts
        });

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logCallback({ type: 'error', text: "Reached max loop iterations without final answer." });
    completionCallback({ success: false });
}

// -------------------------------------------------------------
// Live OpenAI ReAct Agent
// -------------------------------------------------------------
async function runOpenAIAgent(apiKey, queryText, logCallback, completionCallback) {
    let messages = [
        {
            role: "system",
            content: `You are a Unit-Price Comparer Agent.
Your task is to determine which product offers the better value per unit.

CRITICAL RULES:
1. NEVER do division or arithmetic calculations yourself.
2. Normalize quantities to a common target unit (e.g., if comparing 500g and 1kg, convert 500g to 0.5kg or 1kg to 1000g).
3. Use 'calculate_unit_price' for both products separately.
4. Use 'compare_unit_prices' to get the final comparison.
5. Provide a clear final answer with the per-unit price of each product and your recommendation.`
        },
        {
            role: "user",
            content: queryText
        }
    ];

    const tools = [
        {
            type: "function",
            function: {
                name: "calculate_unit_price",
                description: "Calculates the price per unit deterministically. Returns unit price string.",
                parameters: {
                    type: "object",
                    properties: {
                        price: { type: "number", description: "Total cost of the product" },
                        quantity: { type: "number", description: "Total quantity in the normalized unit" },
                        unit_name: { type: "string", description: "The unit name" }
                    },
                    required: ["price", "quantity", "unit_name"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "compare_unit_prices",
                description: "Compares two per-unit prices deterministically to decide which is cheaper. Returns comparison report string.",
                parameters: {
                    type: "object",
                    properties: {
                        price_a: { type: "number", description: "Per-unit price of Product A" },
                        price_b: { type: "number", description: "Per-unit price of Product B" },
                        unit_name: { type: "string", description: "The common unit used for both prices" }
                    },
                    required: ["price_a", "price_b", "unit_name"]
                }
            }
        }
    ];

    let loop = 0;
    const maxLoops = 10;
    let unitPricesCalculated = { A: null, B: null };

    logCallback({ type: 'info', text: "Starting Live OpenAI Agent..." });

    while (loop < maxLoops) {
        loop++;
        logCallback({ type: 'info', text: `Contacting OpenAI API (turn ${loop})...` });

        let response;
        try {
            const res = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: messages,
                    tools: tools,
                    temperature: 0
                })
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error?.message || `HTTP ${res.status}`);
            }
            response = await res.json();
        } catch (error) {
            logCallback({ type: 'error', text: `OpenAI API Error: ${error.message}` });
            completionCallback({ success: false });
            return;
        }

        const choice = response.choices?.[0];
        const message = choice?.message;
        if (!message) {
            logCallback({ type: 'error', text: "No response message returned by OpenAI." });
            completionCallback({ success: false });
            return;
        }

        messages.push(message);

        if (message.content) {
            logCallback({ type: 'thought', text: `Thought: ${message.content}` });
        }

        const toolCalls = message.tool_calls;
        if (!toolCalls || toolCalls.length === 0) {
            logCallback({ type: 'answer', text: `Final Answer: ${message.content || "Comparison complete."}` });
            
            const isWinnerA = unitPricesCalculated.A < unitPricesCalculated.B;
            const isWinnerB = unitPricesCalculated.B < unitPricesCalculated.A;
            const isTie = unitPricesCalculated.A && unitPricesCalculated.B && Math.abs(unitPricesCalculated.A - unitPricesCalculated.B) < 1e-6;

            completionCallback({
                success: true,
                valA: unitPricesCalculated.A,
                valB: unitPricesCalculated.B,
                winner: isTie ? 'tie' : (isWinnerA ? 'A' : (isWinnerB ? 'B' : null)),
                verdict: message.content || "Done."
            });
            return;
        }

        for (let call of toolCalls) {
            const { name, arguments: argsString } = call.function;
            const args = JSON.parse(argsString);
            logCallback({ type: 'action', text: `Action: ${name}(${argsString})` });

            let resultText = "";
            try {
                if (name === "calculate_unit_price") {
                    resultText = calculateUnitPrice(args.price, args.quantity, args.unit_name);
                    const parsedVal = parseFloat(resultText.split(' ')[0]);
                    if (unitPricesCalculated.A === null) {
                        unitPricesCalculated.A = parsedVal;
                    } else if (unitPricesCalculated.B === null) {
                        unitPricesCalculated.B = parsedVal;
                    }
                } else if (name === "compare_unit_prices") {
                    resultText = compareUnitPrices(args.price_a, args.price_b, args.unit_name);
                } else {
                    throw new Error(`Unknown function: ${name}`);
                }
            } catch (err) {
                resultText = `Error: ${err.message}`;
            }

            logCallback({ type: 'observation', text: `Observation: ${resultText}` });

            messages.push({
                role: "tool",
                tool_call_id: call.id,
                name: name,
                content: resultText
            });
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logCallback({ type: 'error', text: "Reached max loop iterations without final answer." });
    completionCallback({ success: false });
}
