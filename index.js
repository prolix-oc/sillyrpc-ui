// index.js
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { eventSource, event_types, getRequestHeaders, saveSettingsDebounced } from "../../../../script.js";

// Keep track of where your extension is located
const extensionName = "sillyrpc-ui";
const defaultSettings = {
  mode: 'local',
  agentIp: 'localhost',
  agentPort: '6472',
  agentUrl: 'ws://localhost:6472'
};

// Format model name as requested
function formatModelName(modelName) {
  if (!modelName) return '';
  
  // Handle hyphens and capitalization
  if (modelName.includes('/')) {
    // Format like 'deepseek-ai/Deepseek-V3-0324' to 'Deepseek V3 0324'
    const parts = modelName.split('/');
    const nameOnly = parts[parts.length - 1];
    return nameOnly.replace(/-/g, ' ').split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  } else {
    // For locally hosted models, just capitalize first letter of each word
    return modelName.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }
}

// Try to get current model info from SillyTavern
function getCurrentModelInfo() {
  try {
    const context = getContext();
    // Try different possible locations for the model name
    let modelName = '';
    
    if (context.chat_metadata?.model) {
      modelName = context.chat_metadata.model;
    } else if (window.SillyTavern?.getActiveModelName) {
      modelName = window.SillyTavern.getActiveModelName();
    } else if (context.currentModel) {
      modelName = context.currentModel;
    } else if (context.api?.currentModel) {
      modelName = context.api.currentModel;
    }
    
    return {
      name: formatModelName(modelName)
    };
  } catch (error) {
    console.error('SillyRPC UI: Error getting model info:', error);
    return { name: '' };
  }
}

// Loads the extension settings if they exist, otherwise initializes them to the defaults
async function loadSettings() {
  // Create the settings if they don't exist
  extension_settings[extensionName] = extension_settings[extensionName] || {};
  if (Object.keys(extension_settings[extensionName]).length === 0) {
    Object.assign(extension_settings[extensionName], defaultSettings);
    saveSettingsDebounced();
  }

  // If we have agentUrl but not IP/port, parse them
  if (extension_settings[extensionName].agentUrl && 
      (!extension_settings[extensionName].agentIp || !extension_settings[extensionName].agentPort)) {
    const url = extension_settings[extensionName].agentUrl;
    const match = url.match(/^ws:\/\/([^:]+):(\d+)$/);
    if (match) {
      extension_settings[extensionName].agentIp = match[1];
      extension_settings[extensionName].agentPort = match[2];
    } else {
      extension_settings[extensionName].agentIp = 'localhost';
      extension_settings[extensionName].agentPort = '6472';
    }
  }

  // Ensure defaults are set
  extension_settings[extensionName].agentIp = extension_settings[extensionName].agentIp || 'localhost';
  extension_settings[extensionName].agentPort = extension_settings[extensionName].agentPort || '6472';

  // Updating settings in the UI
  $("#rpc-mode").val(extension_settings[extensionName].mode);
  $("#agent-ip").val(extension_settings[extensionName].agentIp);
  $("#agent-port").val(extension_settings[extensionName].agentPort);
}

// Save button handler
async function onSaveClick() {
  try {
    // Update settings
    extension_settings[extensionName].mode = $("#rpc-mode").val();
    extension_settings[extensionName].agentIp = $("#agent-ip").val() || 'localhost';
    extension_settings[extensionName].agentPort = $("#agent-port").val() || '6472';
    
    // Create the agent URL from IP and port
    extension_settings[extensionName].agentUrl = `ws://${extension_settings[extensionName].agentIp}:${extension_settings[extensionName].agentPort}`;
    
    // Save to server
    const response = await fetch('/api/plugins/sillyrpc/settings', {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify(extension_settings[extensionName])
    });
    
    if (!response.ok) {
      throw new Error(`Failed to save settings: ${response.status}`);
    }
    
    saveSettingsDebounced();
    toastr.success('SillyRPC settings saved!');
    console.log('SillyRPC settings saved successfully');
  } catch (error) {
    console.error('SillyRPC error:', error);
    toastr.error('Failed to save settings: ' + error.message);
  }
}

// Function to send updates to the RPC server
function sendUpdate(character) {
  if (!character) return;
  
  try {
    // Try to get model info
    const modelInfo = getCurrentModelInfo();
    
    // Create a state string with both model and message count when possible
    let stateText = '';
    if (modelInfo.name) {
      stateText = `Using ${modelInfo.name} | ${character.messageCount || 0} messages`;
    } else {
      stateText = `${character.messageCount || 0} messages deep`;
    }
    
    fetch('/api/plugins/sillyrpc/update', {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify({
        details: `Chatting it up with ${character.name || 'Unknown'}`,
        state: stateText,
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

// Enhanced chat change handler
function onChatChanged() {
  console.log('SillyRPC UI: Chat changed event detected');
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
    console.log('SillyRPC UI: Sending update for character:', character.name);
    sendUpdate(character);
  }
}

// This function is called when the extension is loaded
jQuery(async () => {
  try {
    console.log('SillyRPC UI: Initializing...');
    
    // Add styles directly to the document
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .sillyrpc-settings .inline-drawer-header b {
        font-size: 1rem;
      }
      .sillyrpc-settings .inline-drawer-content {
        padding: 0.5rem;
      }
      /* Fix for text color */
      .sillyrpc-settings input, .sillyrpc-settings select {
        color: black !important;
        font-weight: normal;
      }
    `;
    document.head.appendChild(styleElement);
    
    // Create and inject the updated HTML with separate IP and port inputs
    const settingsHtml = `
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
            <label>Agent IP:
              <input id="agent-ip" type="text" placeholder="localhost" />
            </label><br/>
            <label>Agent Port:
              <input id="agent-port" type="text" placeholder="6472" />
            </label><br/>
            <button id="save-settings" class="menu_button">Save</button>
          </div>
        </div>
      </div>
    `;
    
    // Append settings HTML to the extensions settings container
    $("#extensions_settings2").append(settingsHtml);
    
    // Set up event listeners
    $("#save-settings").on("click", onSaveClick);
    
    // Subscribe to SillyTavern events
    // Listen for message received events
    eventSource.on(event_types.MESSAGE_RECEIVED, (msg) => {
      if (msg?.character) {
        sendUpdate(msg.character);
      }
    });
    
    // Listen for chat changed events
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    
    // Add additional listeners for character selection events
    if (event_types.CHARACTER_SELECTED) {
      eventSource.on(event_types.CHARACTER_SELECTED, () => {
        console.log('SillyRPC UI: Character selected event detected');
        onChatChanged();
      });
    }
    
    if (event_types.GROUP_SELECTED) {
      eventSource.on(event_types.GROUP_SELECTED, () => {
        console.log('SillyRPC UI: Group selected event detected');
        onChatChanged();
      });
    }
    
    // Force an update check every 30 seconds to catch any missed changes
    setInterval(onChatChanged, 30000);
    
    // Load initial settings
    await loadSettings();
    
    // Trigger an initial update if a character is already selected
    onChatChanged();
    
    console.log('SillyRPC UI: Successfully initialized');
  } catch (error) {
    console.error('SillyRPC UI: Initialization error', error);
  }
});