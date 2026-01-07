# McAPI Integration

- Refer to McAPI.yaml for the full catalogue of integrations
- McAPI is short for miyagiAPI

---

## Response Format (all integrations)
All responses follow this structure:
```javascript
// Success: { success: true, data: { ...payload } }
// Error:   { success: false, error: "message" }
```

---

## API Usage Pattern:
```javascript
// POST requests (most integrations)
const response = await miyagiAPI.post('/generate-text', { prompt: '...' });
if (response.success) {
  console.log(response.data.text);  // Access payload via response.data
}

// GET requests (fetching data)
const response = await miyagiAPI.get('/flights', { from: 'NYC', to: 'LAX', date: '2025-06-15' });
```

---

## Example API Calls:
```javascript
// Generate text with LLM
const response = await miyagiAPI.post('/generate-text', {
  prompt: 'Explain quantum computing',
  provider: 'openai',
  model: 'gpt-4o-mini',
});
// Response: { success: true, data: { text: "...", provider: "openai", model: "gpt-4o-mini" } }
const text = response.data.text;

// Search Amazon products
const response = await miyagiAPI.post('/amazon-search', { query: 'laptop', limit: 5 });
const products = response.data.products;

// Get weather data
const response = await miyagiAPI.post('/current-weather', { location: 'New York' });
const weather = response.data.weather;
```

---

## Critical Rules:
- **Always access payload via `response.data`** (not `response.text`, `response.products`, etc.)
- **Use the `endpoint` field from McAPI.yaml** with leading `/` (e.g., `/generate-text`)
- Use `miyagiAPI.post()` for most integrations
- Use `miyagiAPI.get()` for simple data fetches
- Check `output.data` schema in McAPI.yaml for available fields

---

## ⚠️ CRITICAL: Trust the Schema

**The response structure in McAPI.yaml is EXACTLY what you get.** Do not assume wrappers or transformations based on other libraries you've seen.

### Before Using miyagiAPI:
1. **Read the endpoint's schema in McAPI.yaml**
2. **Use exactly the structure shown** — no additions, no assumptions
3. **If unsure, re-read the schema** — it's the single source of truth

### Common Mistake:
```javascript
// ❌ WRONG - Adding layers that don't exist
response.data.data.text   // Where did the extra .data come from?

// ✅ CORRECT - Match the schema exactly
response.data.text        // Schema says: { success, data: { text } }
```

**If the schema says `data.text`, write `response.data.text`. Don't add extra layers from muscle memory.**
