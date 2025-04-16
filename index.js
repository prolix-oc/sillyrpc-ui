// index.js
import './style.css';

document.addEventListener('DOMContentLoaded', async function() {
  // Store configuration globally so it's always current
  let globalConfig = {
    mode: 'local',
    agentUrl: 'ws://localhost:6472'
  };

  try {
    console.log('SillyRPC UI: Initializing...');
    
    // Check if SillyTavern object exists
    if (!window.SillyTavern) {
      console.error('SillyRPC UI: SillyTavern object not found');
      return;
    }

    // 1. Fetch and render existing config
    try {
      const res = await fetch('/api/plugins/sillyrpc/settings');
      if (!res.ok) {
        throw new Error(`Failed to fetch settings: ${res.status} ${res.statusText}`);
      }
      globalConfig = await res.json();
      console.log('SillyRPC UI: Configuration loaded');
    } catch (error) {
      console.warn('SillyRPC UI: Could not load settings, using defaults', error);
    }

    // Make sure the DOM elements exist before accessing them
    const modeElement = document.getElementById('rpc-mode');
    const urlElement = document.getElementById('agent-url');
    const saveButton = document.getElementById('save-settings');
    
    if (!modeElement || !urlElement || !saveButton) {
      console.error('SillyRPC UI: Required DOM elements not found');
      return;
    }
    
    // Set initial values
    modeElement.value = globalConfig.mode || 'local';
    urlElement.value = globalConfig.agentUrl || 'ws://localhost:6472';

    // 2. Save button handler
    saveButton.addEventListener('click', async () => {
      try {
        const newConfig = {
          mode: modeElement.value,
          agentUrl: urlElement.value
        };
        
        const saveRes = await fetch('/api/plugins/sillyrpc/settings', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(newConfig)
        });
        
        if (!saveRes.ok) {
          throw new Error(`Failed to save settings: ${saveRes.status} ${saveRes.statusText}`);
        }
        
        // Update global config
        globalConfig = newConfig;
        alert('Settings saved!');
        console.log('SillyRPC UI: Settings saved successfully');
      } catch (err) {
        console.error('SillyRPC UI: Error saving settings', err);
        alert(`Error saving settings: ${err.message}`);
      }
    });

    // 3. Listen for chat and message events
    window.SillyTavern.on('messageReceived', msg => {
      if (msg && msg.character) {
        sendUpdate(msg.character);
      }
    });
    
    window.SillyTavern.on('chatChanged', info => {
      if (info && info.character) {
        sendUpdate(info.character);
      }
    });

    console.log('SillyRPC UI: Successfully initialized');
  } catch (err) {
    console.error('SillyRPC UI: Initialization error', err);
  }

  function sendUpdate(character) {
    if (!character) return;
    
    try {
      fetch('/api/plugins/sillyrpc/update', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          details: `Chatting as ${character.name || 'Unknown'}`,
          state: `${character.messageCount || 0} messages`,
          largeImageKey: character.imageKey || '',
          startTimestamp: character.chatStartTimestamp || Date.now()
        })
      }).catch(err => {
        console.error('SillyRPC UI: Error sending update', err);
      });
    } catch (err) {
      console.error('SillyRPC UI: Error preparing update', err);
    }
  }
});