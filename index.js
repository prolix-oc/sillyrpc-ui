// index.js
import './style.css';

(async function() {
  // 1. Fetch and render existing config
  const res = await fetch('/api/plugins/sillyrpc/settings');
  const cfg = await res.json();
  document.getElementById('rpc-mode').value    = cfg.mode;
  document.getElementById('agent-url').value   = cfg.agentUrl;

  // 2. Save button handler
  document.getElementById('save-settings').onclick = async () => {
    const newCfg = {
      mode: document.getElementById('rpc-mode').value,
      agentUrl: document.getElementById('agent-url').value
    };
    await fetch('/api/plugins/sillyrpc/settings', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(newCfg)
    });
    alert('Settings saved!');
  };

  // 3. Listen for chat and message events
  // These events fire per message and per chat switch
  window.SillyTavern.on('messageReceived', msg => {
    sendUpdate(msg.character, cfg);
  });
  window.SillyTavern.on('chatChanged', info => {
    sendUpdate(info.character, cfg);
  });

  function sendUpdate(character, cfg) {
    fetch('/api/plugins/sillyrpc/update', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        details: `Chatting as ${character.name}`,
        state: `${character.messageCount} messages`,
        largeImageKey: character.imageKey,
        startTimestamp: character.chatStartTimestamp
      })
    });
  }
})();
