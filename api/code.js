module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  const { invoice, chart } = req.body || {};
  if (!invoice || invoice.length > 8000) return res.status(400).json({ error: "Paste invoice text (max 8,000 characters)." });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: "Server is missing GROQ_API_KEY." });

  const accounts = chart && chart.trim() ? chart : [
    "5000 Cost of goods sold", "6000 Salaries", "6100 Rent", "6200 Utilities", "6300 Software and subscriptions",
    "6400 Professional fees", "6500 Travel and meals", "6600 Marketing", "6700 Office supplies",
    "6800 Repairs and maintenance", "6900 Insurance", "1500 Fixed assets"].join("\n");

  const system = `You are an experienced accounts payable accountant. Given invoice text and a chart of accounts, return ONLY JSON with keys:
vendor, invoice_number, invoice_date, currency, total (number), tax (number or null),
gl_account (exactly one line from the chart), confidence (0 to 1), reason (one sentence),
flags (array of short strings for anything needing review, e.g. missing PO, unusual amount, possible capital item, unclear tax).
Never invent values missing from the invoice; use null.`;

  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.GROQ_API_KEY },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: "Chart of accounts:\n" + accounts + "\n\nInvoice:\n" + invoice }
        ]
      })
    });
    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ error: "Groq error " + r.status + ": " + detail.slice(0, 200) });
    }
    const data = await r.json();
    return res.status(200).json(JSON.parse(data.choices[0].message.content));
  } catch (e) {
    return res.status(500).json({ error: "Could not read the AI response. Try again." });
  }
};
