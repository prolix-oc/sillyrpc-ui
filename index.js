// index.js
import { eventSource, event_types, getRequestHeaders, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings, getContext } from '../../../extensions.js';
import './style.css';

// Initialize settings if they don't exist
if (!extension_settings.sillyrpc) {
  extension_settings.sillyrpc = {
    mode: 'local',
    agentUrl: 'ws://localhost:6472'
  };
  saveSettingsDebounced();
}

// Function to send updates to the RPC server
function sendUpdate(character) {
  if (!extension_settings.sillyrpc || !character) return;
  
  fetch('/api/plugins/sillyrpc/update', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({
      details: `Chatting as ${character.name}`,
      state: `${character.messageCount} messages`,
      largeImageKey: character.imageKey,
      startTimestamp: character.chatStartTimestamp
    })
  }).catch(err => {
    console.error('SillyRPC UI: Error sending update', err);
  });
}

// Handle chat and message events
function onChatChanged() {
  const context = getContext();
  let character = null;

  if (context.characterId !== undefined && context.characterId !== null) {
    character = {
      name: context.name2 || 'Unknown',
      messageCount: context.chat?.length || 0,
      imageKey: context.characters[context.characterId]?.avatar || '',
      chatStartTimestamp: Date.now()
    };
  } else if (context.groupId) {
    const group = context.groups.find(g => g.id === context.groupId);
    if (group) {
      character = {
        name: group.name || 'Group Chat',
        messageCount: context.chat?.length || 0,
        imageKey: '', // Groups may not have an image key
        chatStartTimestamp: Date.now()
      };
    }
  }

  if (character) {
    sendUpdate(character);
  }
}

// Initialize when jQuery is ready
jQuery(() => {
  // Create and inject the settings HTML
  const html = `
  <div class="sillyrpc-settings">
    <div class="inline-drawer">
      <div class="inline-drawer-toggle inline-drawer-header">
        <b>Discord RPC Settings</b>
        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down"></div>
      </div>
      <div class="inline-drawer-content">
        <label>Mode:
          <select id="rpc-mode">
            <option value="local">Local</option>
            <option value="remote">Remote</option>
          </select>
        </label><br/>
        <label>Agent URL:
          <input id="agent-url" type="text" placeholder="ws://localhost:6472"/>
        </label><br/>
        <button id="save-settings" class="menu_button">Save</button>
      </div>
    </div>
  </div>`;
  
  // Append settings HTML to the extensions settings container
  $('#extensions_settings2').append(html);
  
  // Populate settings with current values
  $('#rpc-mode').val(extension_settings.sillyrpc.mode);
  $('#agent-url').val(extension_settings.sillyrpc.agentUrl);
  
  // Save button handler
  $('#save-settings').on('click', async () => {
    // Update settings object
    extension_settings.sillyrpc.mode = $('#rpc-mode').val();
    extension_settings.sillyrpc.agentUrl = $('#agent-url').val();
    
    // Save to server
    await fetch('/api/plugins/sillyrpc/settings', {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify(extension_settings.sillyrpc)
    });
    
    // Save to local storage
    saveSettingsDebounced();
    
    toastr.success('SillyRPC settings saved!');
  });
  
  // Subscribe to events
  eventSource.on(event_types.MESSAGE_RECEIVED, (msg) => {
    if (msg?.character) {
      sendUpdate(msg.character);
    }
  });
  
  eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
  
  console.log('SillyRPC UI extension initialized');
});