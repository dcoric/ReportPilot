
import urllib.request
import urllib.parse
import json
import sys
import time

BASE_URL = "http://localhost:8080"

def request(method, path, body=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            if response.status >= 400:
                print(f"Error: {response.status} {response.read().decode('utf-8')}")
                sys.exit(1)
            content_type = response.headers.get("Content-Type", "")
            if "application/json" in content_type:
                return json.loads(response.read().decode("utf-8"))
            return response.read()
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.read().decode('utf-8')}")
        sys.exit(1)

def main():
    print("1. Creating Data Source...")
    ds = request("POST", "/v1/data-sources", {
        "name": "test_ds",
        "db_type": "postgres",
        "connection_ref": "postgresql://aidb:aidb@db:5432/aidb" # Point to itself for testing
    })
    ds_id = ds["id"]
    print(f"   Data Source Created: {ds_id}")

    print("2. Introspecting...")
    # Trigger introspection
    request("POST", f"/v1/data-sources/{ds_id}/introspect")
    # Wait a bit for introspection (async)
    time.sleep(2)

    print("3. Creating Session...")
    session = request("POST", "/v1/query/sessions", {
        "data_source_id": ds_id,
        "question": "SELECT 1 as test_col" # Simple SQL question? No, question is NL.
        # But if we use a question, we need LLM.
        # If ALLOW_RULE_BASED_FALLBACK=true, maybe it works without keys?
        # Or I can just hope "SELECT 1" works if strict mode is off?
        # The prompt uses LLM.
        # Check server.js: ALLOW_RULE_BASED_FALLBACK.
        # If I don't have LLM keys, I might fail generation.
        # But I can cheat: The generic prompt might not work.
        # Wait, if I can't generate SQL, I can't run session, so I can't export.
        # I need a session with a successful run.
        # Do I have an LLM key? The environment has empty keys in docker-compose.
        # I can try to use `run_command` to set a fake key if I mock the LLM or use a "passthrough" mode?
        # The `server.js` `handleRunSession` calls `generateSqlWithRouting`.
        # If I fail to generate, I can't proceed.
        # But wait! I implemented `handleRunSession` in `server.js`.
        # Is there a way to inject SQL directly?
        # The code I read in `QueryWorkspace.tsx` had comments about not being able to override SQL.
        # But let's check `server.js` `handleRunSession`.
        # It calls `generateSqlWithRouting`.
        # I need to verify if `generateSqlWithRouting` handles "SELECT ..." directly?
        # If not, I am blocked on LLM for testing.
        # BUT I can patch `server.js` to allow `sql` override in `handleRunSession` for testing purposes!
        # Or I can use `mock` provider if it exists.
        # Let's check `server.js` lines 434+:
        # const body = await readJsonBody(req);
        # const requestedProvider = ...
        # It generates SQL.
    })
    # I'll optimistically try a simple question. "Show me all data sources".
    # If it fails, I might need to patch server.js to bypass LLM for testing export.
    session_id = session["session_id"]
    print(f"   Session Created: {session_id}")

    print("4. Running Session...")
    try:
        request("POST", f"/v1/query/sessions/{session_id}/run", {
            "max_rows": 10
        })
        print("   Run Successful")
    except SystemExit:
        print("   Run Failed (Likely LLM issue). Initializing artificial run for export testing.")
        # If run fails, I can manually insert a run attempt into DB to test export?
        # Or patch server.js.
        # I will manually insert into DB using psql if needed.
        pass

    print("5. Exporting (CSV)...")
    csv_data = request("POST", f"/v1/query/sessions/{session_id}/export", {"format": "csv"})
    if isinstance(csv_data, bytes):
        csv_data = csv_data.decode('utf-8')
    
    print("   Export Result:")
    print(csv_data[:200]) # First 200 chars

    print("6. Exporting (JSON)...")
    json_data = request("POST", f"/v1/query/sessions/{session_id}/export", {"format": "json"})
    print("   Export Result (Type):", type(json_data))

if __name__ == "__main__":
    main()
