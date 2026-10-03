const SCALE_X = 5.6;
const SCALE_Y = 2.4;
const DEAD_ZONE_TOP = 100.0 * SCALE_Y;
const DEAD_ZONE_HEIGHT = 100.0 * SCALE_Y;

let ws = null;
let mySlot = null;
let heartbeatInterval = null;
let keys = { left: false, right: false, up: false, down: false };

const canvas = document.getElementById("arena");
const ctx = canvas.getContext("2d");

// Paint blank arena initially
drawInitialArena();

function drawInitialArena() {
  ctx.fillStyle = "#0a0c10";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#161a24";
  ctx.fillRect(0, DEAD_ZONE_TOP, canvas.width, DEAD_ZONE_HEIGHT);
}

function connect() {
  const username = document.getElementById("username").value.trim() || "Player";
  const password = document.getElementById("password").value;
  const serverUrl = document.getElementById("server-url").value.trim();
  const errorDiv = document.getElementById("login-error");

  errorDiv.innerText = "Connecting...";

  try {
    ws = new WebSocket(serverUrl);
  } catch (e) {
    errorDiv.innerText = "Invalid WebSocket URL format.";
    return;
  }

  ws.onopen = () => {
    ws.send(JSON.stringify({ username, password }));
    
    // Heartbeat every 10s prevents idle timeout!
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 10000);
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "init") {
      mySlot = data.slot;
      document.getElementById("login-modal").classList.add("hidden");
      document.getElementById("app").classList.remove("hidden");
      
      if (data.is_solo) {
        document.getElementById("match-status").innerHTML = 
          `Waiting for Player 2...<br><button onclick="startSolo()" style="margin-top:8px; background:#ffdc00; color:#000;">Play vs AI (${data.ai_name})</button>`;
      } else {
        document.getElementById("match-status").innerText = "Opponent found! Click Ready.";
      }
    } 
    else if (data.type === "error") {
      errorDiv.innerText = data.message;
    }
    else if (data.type === "waiting_ready") {
      document.getElementById("match-status").innerText = `${data.player} is Ready! Click Ready to join.`;
    }
    else if (data.type === "start") {
      document.getElementById("match-status").innerText = "Match in progress!";
      document.getElementById("btn-ready").classList.add("hidden");
    }
    else if (data.type === "player_left") {
      document.getElementById("match-status").innerText = data.message;
      document.getElementById("btn-ready").classList.remove("hidden");
    }
    else if (data.type === "state") {
      renderState(data);
    }
  };

  ws.onclose = (event) => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (![4001, 4002, 4003].includes(event.code)) {
      document.getElementById("match-status").innerText = "Disconnected from server.";
    }
  };
}

function startSolo() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "start_solo" }));
    document.getElementById("match-status").innerText = "Playing Solo vs Model!";
  }
}

function sendReady() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "ready" }));
    document.getElementById("match-status").innerText = "Ready! Waiting for opponent...";
  }
}

function logout() {
  if (ws) ws.close();
  location.reload();
}

window.addEventListener("keydown", (e) => {
  let changed = false;
  if (["ArrowLeft", "KeyA"].includes(e.code) && !keys.left) { keys.left = true; changed = true; }
  if (["ArrowRight", "KeyD"].includes(e.code) && !keys.right) { keys.right = true; changed = true; }
  if (["ArrowUp", "KeyW"].includes(e.code) && !keys.up) { keys.up = true; changed = true; }
  if (["ArrowDown", "KeyS"].includes(e.code) && !keys.down) { keys.down = true; changed = true; }

  if (changed && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "keys", ...keys }));
  }
});

window.addEventListener("keyup", (e) => {
  let changed = false;
  if (["ArrowLeft", "KeyA"].includes(e.code) && keys.left) { keys.left = false; changed = true; }
  if (["ArrowRight", "KeyD"].includes(e.code) && keys.right) { keys.right = false; changed = true; }
  if (["ArrowUp", "KeyW"].includes(e.code) && keys.up) { keys.up = false; changed = true; }
  if (["ArrowDown", "KeyS"].includes(e.code) && keys.down) { keys.down = false; changed = true; }

  if (changed && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "keys", ...keys }));
  }
});

function renderState(data) {
  document.getElementById("hud-a-name").innerText = `Player A (Top): ${data.player_a.name}`;
  document.getElementById("hud-a-score").innerText = `Score: ${data.player_a.score}`;

  document.getElementById("hud-b-name").innerText = `Player B (Bottom): ${data.player_b.name}`;
  document.getElementById("hud-b-score").innerText = `Score: ${data.player_b.score}`;

  // Clear Arena
  ctx.fillStyle = "#0a0c10";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Dead Zone
  ctx.fillStyle = "#161a24";
  ctx.fillRect(0, DEAD_ZONE_TOP, canvas.width, DEAD_ZONE_HEIGHT);

  // Bullets
  for (const b of data.bullets) {
    ctx.fillStyle = (b.owner === "A") ? "#00d2ff" : "#ff4b4b";
    ctx.beginPath();
    ctx.arc(b.x * SCALE_X, b.y * SCALE_Y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player A (Cyan Triangle)
  const ax = data.player_a.x * SCALE_X;
  const ay = data.player_a.y * SCALE_Y;
  ctx.fillStyle = "#00d2ff";
  ctx.beginPath();
  ctx.moveTo(ax, ay + 8);
  ctx.lineTo(ax - 8, ay - 6);
  ctx.lineTo(ax + 8, ay - 6);
  ctx.closePath();
  ctx.fill();

  // Player B (Red Triangle)
  const bx = data.player_b.x * SCALE_X;
  const by = data.player_b.y * SCALE_Y;
  ctx.fillStyle = "#ff4b4b";
  ctx.beginPath();
  ctx.moveTo(bx, by - 8);
  ctx.lineTo(bx - 8, by + 6);
  ctx.lineTo(bx + 8, by + 6);
  ctx.closePath();
  ctx.fill();
}
