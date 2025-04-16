// index.js
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { eventSource, event_types, getRequestHeaders, saveSettingsDebounced } from "../../../../script.js";

// Keep track of where your extension is located
const extensionName = "sillyrpc-ui";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const defaultSettings = {
  mode: 'local',
  agentUrl: 'ws://localhost:6472'
};

// Loads the extension settings if they exist, otherwise initializes them to the defaults.
async function loadSettings() {
  // Create the settings if they don't exist
  extension_settings[extensionName] = extension_settings[extensionName] || {};
  if (Object.keys(extension_settings[extensionName]).length === 0) {
    Object.assign(extension_settings[extensionName], defaultSettings);
    saveSettingsDebounced();
  }

  // Updating settings in the UI
  $("#rpc-mode").val(extension_settings[extensionName].mode);
  $("#agent-url").val(extension_settings[extensionName].agentUrl);
}

// Save button handler
async function onSaveClick() {
  try {
    // Update settings
    extension_settings[extensionName].mode = $("#rpc-mode").val();
    extension_settings[extensionName].agentUrl = $("#agent-url").val();
    
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
    fetch('/api/plugins/sillyrpc/update', {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify({
        details: `Chatting it up with ${character.name || 'Unknown'}`,
        state: `${character.messageCount || 0} messages deep`,
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

// This function is called when the extension is loaded
jQuery(async () => {
  try {
    console.log('SillyRPC UI: Initializing...');
    
    // Instead of importing CSS, let's add our styles directly to the document
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .sillyrpc-settings .inline-drawer-header b {
        font-size: 1rem;
      }
      .sillyrpc-settings .inline-drawer-content {
        padding: 0.5rem;
      }
    `;
    document.head.appendChild(styleElement);
    
    // Create and inject the HTML directly
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
            <label>Agent URL:
              <input id="agent-url" type="text" placeholder="ws://localhost:6472"/>
            </label><br/>
            <button id="save-settings" class="menu_button">Save</button>
          </div>
        </div>
      </div>
    `;
    
    // Append settings HTML to the extensions settings container
    // Using extensions_settings2 for UI-related extensions
    $("#extensions_settings2").append(settingsHtml);
    
    // Set up event listeners
    $("#save-settings").on("click", onSaveClick);
    
    // Subscribe to SillyTavern events
    eventSource.on(event_types.MESSAGE_RECEIVED, (msg) => {
      if (msg?.character) {
        sendUpdate(msg.character);
      }
    });
    
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    
    // Load initial settings
    await loadSettings();
    
    console.log('SillyRPC UI: Successfully initialized');
  } catch (error) {
    console.error('SillyRPC UI: Initialization error', error);
  }
});