#!/bin/bash
# Capture screenshots of the x402 Paywall demo flow
# Uses AppleScript to control Chrome + screencapture for screenshots

SCREENSHOTS_DIR="$(dirname "$0")/../assets/screenshots"
mkdir -p "$SCREENSHOTS_DIR"

# Set window size for consistent captures
WINDOW_WIDTH=1280
WINDOW_HEIGHT=800

echo "=== Capturing x402 Paywall Demo Flow ==="
echo "Screenshots dir: $SCREENSHOTS_DIR"

# Open Chrome to the demo
open -a "Google Chrome" "http://localhost:5173"
sleep 3

# Resize and position the window
osascript -e '
tell application "Google Chrome"
  set bounds of front window to {100, 100, 1380, 900}
end tell
'
sleep 1

# Step 1: Initial page
echo "Step 1: Initial page with two cards..."
screencapture -x "$SCREENSHOTS_DIR/01-initial-page.png"
sleep 1

# Step 2: Click "Access Premium Data" button using JavaScript
echo "Step 2: Clicking 'Access Premium Data'..."
osascript -e '
tell application "Google Chrome"
  tell active tab of front window
    set URL to "javascript:(function(){
      var btns = document.querySelectorAll(\"button\");
      for(var b of btns){
        if(b.textContent.includes(\"Access Premium\") || b.textContent.includes(\"Premium Data\")){
          b.click(); return;
        }
      }
      // Try finding by text content
      var all = document.body.getElementsByTagName(\"*\");
      for(var el of all){
        if(el.tagName===\"BUTTON\" || el.tagName===\"A\" || el.tagName===\"SPAN\"){
          if(el.textContent.includes(\"Access\")) { el.click(); return; }
        }
      }
      console.log(\"Button not found\");
    })()"
  end tell
end tell
'
sleep 4

screencapture -x "$SCREENSHOTS_DIR/02-payment-modal.png"
sleep 1

# Step 3: Click "Pay 0.01 USDC" button
echo "Step 3: Clicking 'Pay 0.01 USDC'..."
osascript -e '
tell application "Google Chrome"
  tell active tab of front window
    set URL to "javascript:(function(){
      var btns = document.querySelectorAll(\"button\");
      for(var b of btns){
        if(b.textContent.includes(\"Pay\") && b.textContent.includes(\"USDC\")){
          b.click(); return;
        }
      }
      console.log(\"Pay button not found\");
    })()"
  end tell
end tell
'
sleep 3

screencapture -x "$SCREENSHOTS_DIR/03-payment-details.png"
sleep 1

# Step 4: Click "Confirm Payment" button
echo "Step 4: Clicking 'Confirm Payment'..."
osascript -e '
tell application "Google Chrome"
  tell active tab of front window
    set URL to "javascript:(function(){
      var btns = document.querySelectorAll(\"button\");
      for(var b of btns){
        if(b.textContent.includes(\"Confirm\")){
          b.click(); return;
        }
      }
      console.log(\"Confirm button not found\");
    })()"
  end tell
end tell
'
sleep 4

screencapture -x "$SCREENSHOTS_DIR/04-premium-data.png"
sleep 1

echo ""
echo "=== All screenshots captured ==="
ls -la "$SCREENSHOTS_DIR"/
