const SCALE_X = 5.6;
const SCALE_Y = 2.4;
const DEAD_ZONE_TOP = 100.0 * SCALE_Y;
const DEAD_ZONE_HEIGHT = 100.0 * SCALE_Y;

let ws = null;
let heartbeatInterval = null;
let keys = { left: false, right: false, up: false, down: false };

const canvas = document.getElementById("arena");
const ctx = canvas.getContext("2d");

// Pre-paint initial arena
drawInitialArena();

function drawInitialArena() {
  ctx.fillStyle = "#0a0c10";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#161a24";
  ctx.fillRect(0, DEAD_ZONE_TOP, canvas.width, DEAD_ZONE_HEIGHT);

  // Initial Player A (Cyan Top)
  ctx.fillStyle = "#00d2ff";
  ctx.beginPath();
  ctx.moveTo(140, 20 * SCALE_Y + 8);
  ctx.lineTo(140 - 8, 20 * SCALE_Y - 6);
  ctx.lineTo(140 + 8, 20 * SCALE_Y - 6);
  ctx.closePath();
  ctx.fill();

  // Initial Player B (Red Bottom)
  ctx.fillStyle = "#ff4b4b";
  ctx.beginPath();
  ctx.moveTo(140, 280 * SCALE_Y - 8);
  ctx.lineTo(140 - 8, 280 * SCALE_Y + 6);
  ctx.lineTo(140 + 8, 280 * SCALE_Y + 6);
  ctx.closePath();
  ctx.fill();
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
    errorDiv.innerText = "Invalid WebSocket URL.";
    return;
  }

  ws.onopen = () => {
    ws.send(JSON.stringify({ username, password }));

    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 5000);
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "init") {
      document.getElementById("login-modal").classList.add("hidden");
      document.getElementById("app").classList.remove("hidden");
      document.getElementById("hud-a-name").innerText = `Player A (You): ${data.username}`;
      
      updateModelDropdown(data.models, data.selected_model);
      document.getElementById("match-status").innerText = "Ready! Choose a model and click Start.";
    } 
    else if (data.type === "error") {
      errorDiv.innerText = data.message;
    }
    else if (data.type === "models_updated") {
      updateModelDropdown(data.models, data.selected_model);
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

function updateModelDropdown(models, selectedModel) {
  const select = document.getElementById("model-select");
  select.innerHTML = "";
  for (const m of models) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.innerText = m;
    if (m === selectedModel) opt.selected = true;
    select.appendChild(opt);
  }
}

function onModelSelected() {
  const select = document.getElementById("model-select");
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "select_model", model: select.value }));
    document.getElementById("match-status").innerText = `Loaded model: ${select.value}`;
  }
}

function uploadLocalModel(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64Data = e.target.result.split(',')[1];
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "upload_model",
        filename: file.name,
        data: base64Data
      }));
      document.getElementById("match-status").innerText = `Uploading ${file.name}...`;
    }
  };
  reader.readAsDataURL(file);
}

function startMatch() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "start_match", solo: true }));
    document.getElementById("btn-start").classList.add("hidden");
    document.getElementById("btn-stop").classList.remove("hidden");
    document.getElementById("match-status").innerText = "Match in progress!";
  }
}

function stopMatch() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "stop_match" }));
    document.getElementById("btn-start").classList.remove("hidden");
    document.getElementById("btn-stop").classList.add("hidden");
    document.getElementById("match-status").innerText = "Match stopped.";
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
  document.getElementById("hud-a-name").innerText = `Player A: ${data.player_a.name}`;
  document.getElementById("hud-a-score").innerText = `Score: ${data.player_a.score}`;

  document.getElementById("hud-b-name").innerText = `Player B: ${data.player_b.name}`;
  document.getElementById("hud-b-score").innerText = `Score: ${data.player_b.score}`;

  ctx.fillStyle = "#0a0c10";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#161a24";
  ctx.fillRect(0, DEAD_ZONE_TOP, canvas.width, DEAD_ZONE_HEIGHT);

  for (const b of data.bullets) {
    ctx.fillStyle = (b.owner === "A") ? "#00d2ff" : "#ff4b4b";
    ctx.beginPath();
    ctx.arc(b.x * SCALE_X, b.y * SCALE_Y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const ax = data.player_a.x * SCALE_X;
  const ay = data.player_a.y * SCALE_Y;
  ctx.fillStyle = "#00d2ff";
  ctx.beginPath();
  ctx.moveTo(ax, ay + 8);
  ctx.lineTo(ax - 8, ay - 6);
  ctx.lineTo(ax + 8, ay - 6);
  ctx.closePath();
  ctx.fill();

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
