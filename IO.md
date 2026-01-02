**Widget Input/Output System** (`useInput` and `useOutput` hooks)
- **Scope**: Direct widget-to-widget data connections
- **Purpose**: Create data flow pipelines between widgets without using shared global keys
- **Use Cases**: Modular widget compositions, data transformations, widget pipelines
- **Signatures**:
  - `const value = useInput(slotId, defaultValue)` - Receive data from connected outputs
    - `slotId` (string): Unique identifier for this input slot (e.g., 'input-slot-1', 'input-slot-2')
    - `defaultValue` (any): Value to use when no data is connected
    - Returns: Current value received from connected output
  - `const sendValue = useOutput(slotId)` - Get function to send data to connected inputs
    - `slotId` (string): Unique identifier for this output slot (e.g., 'output-slot-1', 'output-slot-2')
    - Returns: Function `sendValue(data)` that pushes data through all connections

**Slot ID Naming Rules:**
- Input slots: Use `'input-slot-1'`, `'input-slot-2'`, etc. for predictable, index-based naming
- Output slots: Use `'output-slot-1'`, `'output-slot-2'`, etc. for predictable, index-based naming
- Convention: Number slots from 1 for each widget (first input is 1, second is 2, etc.)
- Custom IDs: Not allowed -- stick to the above convention.

**How Connections Work:**
1. **Widget Connection**: Two widgets must be connected on the canvas (output slot → input slot)
2. **Data Flow**: When `sendValue(data)` is called on an output, data is pushed to ALL connected input slots
3. **Persistence**: Both input and output values are persisted in widget-specific storage (like `useStorage`)
4. **No Connection**: If an input has no connection, it returns the `defaultValue` provided
5. **Multiple Connections**: One output can send to multiple inputs; one input receives from the most recent connected output
6. **React Updates**: Both hooks trigger React re-renders when values change

### Example
**Input/Output Pattern:**
```jsx
// Widget A - Data Producer (e.g., Search Widget)
function SearchWidget() {
  const sendResults = useOutput('output-slot-1');
  const [query, setQuery] = useState('');
  
  const handleSearch = async () => {
    const results = await miyagiAPI.post('/wikipedia-search', { query });
    sendResults(results); // Push to connected widgets
  };
  
  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <button onClick={handleSearch}>Search</button>
    </div>
  );
}

// Widget B - Data Consumer (e.g., Results Display Widget)
function ResultsWidget() {
  const results = useInput('input-slot-1', []);
  
  return (
    <div>
      {results.map(item => (
        <div key={item.id}>{item.title}</div>
      ))}
    </div>
  );
}
```

### Simple widgets with this pattern
- text-summarizer-react for useInput
- text-generator-react for useOutput
