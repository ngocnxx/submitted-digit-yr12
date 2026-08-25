#!/usr/bin/env bash
# Starts both servers when the Codespace opens, so the app is ready to use.
# Logs go to /tmp so you can read them if something fails.

cd "$(dirname "$0")/.." || exit 1

# Stop anything already listening, so re-opening does not clash.
pkill -f "flask run" 2>/dev/null
pkill -f "http.server 5500" 2>/dev/null
sleep 1

# Back-end: the Flask API on port 5050.
# --host=0.0.0.0 is required, otherwise Codespaces cannot forward the port.
(cd back-end && python3 -m flask run --host=0.0.0.0 --port=5050 > /tmp/backend.log 2>&1 &)

# Front-end: plain static files on port 5500.
(cd front-end && python3 -m http.server 5500 > /tmp/frontend.log 2>&1 &)

sleep 3

# Port 5050 must be Public, because the page on 5500 calls it from the browser.
if command -v gh > /dev/null 2>&1 && [ -n "$CODESPACE_NAME" ]; then
  gh codespace ports visibility 5050:public -c "$CODESPACE_NAME" > /dev/null 2>&1 \
    && echo "Port 5050 set to Public." \
    || echo "Could not set port 5050 automatically. Open the PORTS tab, right-click 5050, Port Visibility, Public."
fi

echo ""
echo "-----------------------------------------------"
if curl -s -m 5 http://127.0.0.1:5050/api/health | grep -q ok; then
  echo "Back-end  : running on port 5050"
else
  echo "Back-end  : FAILED - see /tmp/backend.log"
fi
echo "Front-end : running on port 5500"
echo ""
echo "Open the PORTS tab and click the globe icon on port 5500."
echo "-----------------------------------------------"
