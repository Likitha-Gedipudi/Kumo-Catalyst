# Kumo AI Python Sidecar

This directory contains the Python sidecar required to run the `kumoai` SDK. 

Because the main application runs in a Node.js container, the Python SDK needs to run as a separate service (sidecar) that the Next.js app communicates with.

## How to run locally

1. **Navigate to this directory:**
   ```bash
   cd kumo-sidecar
   ```

2. **Create a virtual environment (recommended):**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install the dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set your Kumo API Key (required):** The sidecar exits on startup if `KUMO_API_KEY` is missing. There is no default key in the repository.
   ```bash
   export KUMO_API_KEY="your_kumo_api_key_here"
   ```
   On Windows PowerShell: `$env:KUMO_API_KEY="your_kumo_api_key_here"`

5. **CORS (local vs production):** By default, only `http://localhost:3000` and `http://127.0.0.1:3000` may call the API from a browser. For production or ngrok, set allowed origins explicitly:
   ```bash
   export SIDECAR_CORS_ORIGINS="https://your-next-app.example.com"
   ```
   Multiple origins: comma-separated. Use `SIDECAR_CORS_ORIGINS=*` only for demos (allows any origin).

6. **Run the FastAPI server:**
   ```bash
   python main.py
   ```

The server will start on `http://localhost:8000`.

## Connecting it to the Next.js App

If you are running this sidecar locally, you can expose it to the internet using a tool like [ngrok](https://ngrok.com/):

```bash
ngrok http 8000
```

Then, copy the generated HTTPS URL (e.g., `https://1234-abcd.ngrok.io`) and:

- Set `KUMO_SIDECAR_URL` (or `SIDECAR_URL`) in the Next.js app so the chat API proxies to the tunnel.
- Set `SIDECAR_CORS_ORIGINS` to that same HTTPS origin (or include it in a comma-separated list) so browser requests from your deployed Next app are allowed.
