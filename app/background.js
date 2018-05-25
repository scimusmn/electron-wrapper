//
// Background
//
// This is main Electron process, started first thing when your app launches.
// This script runs through entire life of your application. It doesn't have
// any windows that you can see on screen, but we can open windows from here.
//

import jetpack from 'fs-jetpack';

// Base electron modules
import { screen, app, BrowserWindow, globalShortcut } from 'electron';

let childProcess = require('child_process');
let promisedExec = childProcess.exec;

// Development helper for showing Chromium Dev Tools
import devHelper from './vendor/electron_boilerplate/dev_helper';

// Special module holding environment variables which you declared
// in config/env_xxx.json file.
import env from './env';

import os from 'os';

// We want to track all currently
// connected displays, as well as
// all current browser windows.
let configDisplays = [];
let focusWindow;
let focusInterval;

app.on('ready', function() {

  // Always list available displays.
  // This can be used to retrieve IDs
  // to be added in config.json
  console.log('=== List Available Displays ===');
  console.log(screen.getAllDisplays());
  console.log('===');

  //
  // Open the app
  //
  console.log(`This platform is ${process.platform}`);

  if (env.name === 'test') {

    launchFallbackWindow('file://' + __dirname + '/spec.html')

  } else {

    parseConfigFile(getConfigPath());

  }

  //
  // Keyboard shortcuts
  //
  // Ctrl or Command + f will switch you to the Finder.
  // We use the "switch to Finder" approach instead of a quit, because in most
  // of our Electron setups we have a launchd process that will relaunch the
  // app on quit. For maintenance, we probably just need to be able to get
  // to the Finder while the application remains running in the background.
  //
  // FINDER
  const retQuit = globalShortcut.register('CommandOrControl+F', () => {
    console.log('Switching to Finder');
    promisedExec('open -a Finder');
  });

  if (!retQuit) {
    console.log('Quit keyboard registration failed');
  }

  // RELOAD
  const retReload = globalShortcut.register('CommandOrControl+R', () => {
    console.log('Reload the page');
    const windows = BrowserWindow.getAllWindows();
    for (let w in windows) {
      windows[w].reload();
    }
  });

  if (!retReload) {
    console.log('Reload keyboard registration failed');
  }

  // (RE)LAUNCH WINDOWS
  const retRelaunch = globalShortcut.register('CommandOrControl+L', () => {

    console.log('Relaunching all windows');

    // TODO: This currently breaks with multiple
    // windows but would be very nice to have.
    // closeActiveWindows();
    // launchWindowsToDisplays();

  });

  if (!retReload) {
    console.log('Relaunch windows keyboard registration failed');
  }

});

// Get all displays, then ensure
// correct windows are launched
// to each display.
function launchWindowsToDisplays(delayURL) {

  // List of currently available displays.
  const availableDisplays = screen.getAllDisplays();

  console.log('Available displays:', availableDisplays.length);

  for (let i in availableDisplays) {

    const targetDisplay = availableDisplays[i];

    console.log('targetDisplay', i);
    console.log(targetDisplay);

    // Find matching config display
    for (let j in configDisplays) {

      const displayConfig = configDisplays[j];

      if (displayConfig.targetDisplayId == targetDisplay.id) {

        console.log('Match found. ', displayConfig.label);

        // Match! Launch new window.
        displayConfig.targetDisplay = targetDisplay;
        launchNewWindow(displayConfig, delayURL);

      }
    }

  }

  // Ensure window focus
  // every 5 seconds
  ensureWindowFocus();

}

function launchNewWindow(displayConfig, delayURL) {

  // Match. Launch appropriate window.
  const newWindow = new BrowserWindow({
    x: displayConfig.targetDisplay.bounds.x + 50,
    y: displayConfig.targetDisplay.bounds.y + 50,
    width: 600,
    height: 420,
  });

  // Load appropriate URL from config
  if (!delayURL || delayURL == false) {
    newWindow.loadURL(displayConfig.url);
  } else {
    const delaySecs = 30;
    const delayPage = 'file://' + __dirname + '/launch-delay.html?display=' + displayConfig.label + '&delay=' + delaySecs;
    newWindow.loadURL(delayPage);
  }

  // Attach this window to config obj
  displayConfig.launchedWindow = newWindow;

  // If flagged, remember this window
  // to ensure focus later.
  if (displayConfig.keepFocus == true) {

    console.log('Focus window set to: ', displayConfig.label);

    focusWindow = newWindow;

  }

  //
  // Hack to make full-screen kiosk mode actually work.
  //
  // There is an active bug with Electron, kiosk mode, and Yosemite.
  // https://github.com/atom/electron/issues/1054
  // This hack makes kiosk mode actually work by waiting for the app to launch
  // and then issuing a call to go into kiosk mode after a few milliseconds.
  //
  if (env.name === 'production') {

    setTimeout(() => {
      newWindow.setKiosk(true);
      newWindow.setAutoHideMenuBar(true);
      newWindow.setMenuBarVisibility(false);
    }, 100);

  }

  //
  // Show dev tools when we're not in production mode
  //
  if (env.name !== 'production') {
    devHelper.setDevMenu();
    newWindow.openDevTools();
  }

}

function reloadWindowURLs() {
  // Loop over previously launched
  // windows and load config URLs
  // Find matching config display
  for (let j in configDisplays) {

    const displayConfig = configDisplays[j];

    if (displayConfig.launchedWindow) {

      const launchedWindow = displayConfig.launchedWindow;
      launchedWindow.loadURL(displayConfig.url);

    }
  }
}

function launchFallbackWindow(url) {

  // Match. Launch appropriate window.
  const newWindow = new BrowserWindow({
    x: 50,
    y: 50,
    width: 700,
    height: 600,
  });

  // Load appropriate URL from config
  newWindow.loadURL(url);

}

function closeActiveWindows() {

  // Close all active windows
  // for a fresh start.
  // When no windows are open,
  // this does nothing.
  const windows = BrowserWindow.getAllWindows();
  for (let i = windows.length - 1; i >= 0; i--) {
    windows[i].close();
  }

}

function getConfigPath() {

  let path = '';

  switch (process.platform) {

    case 'win32': {
      path = '/usr/local/etc/kiosk/config.json';
      break;
    }

    case 'darwin': {
      path = '/usr/local/etc/kiosk/config.json';
      break;
    }

    default: {
      path = '/usr/local/etc/kiosk/config.json';
    }

  }

  return path;

}

function parseConfigFile(path) {

  const configFileObj = jetpack.read(path, 'json');

  if (configFileObj == null) {

    console.log('Config file [' + configFile + '] not present.');
    launchFallbackWindow('file://' + __dirname + '/config-error.html');
    return;

  } else {

    const commands = configFileObj.commands;

    console.log(commands);

    // Run as command line operations.
    // Useful for starting node servers.
    for (var i = 0; i < commands.length; i++) {
      const commandString = commands[i];
      console.log('Running command ->', commandString);
      promisedExec(commandString);
    }

    // Array representing all
    // the displays we're hoping
    // to launch.
    configDisplays = configFileObj.displays;

    loadWindowsUptimeDelay();

  }

}

function logDisplayIssue(message) {

  console.log('Display Issue:');
  console.log(' --> ' + message);

  // TODO: Inform a window that something is wrong,
  // so it can be displayed onscreen.

}

function ensureWindowFocus() {

  if (!focusWindow) {
    console.log('No focus window set. Skipping...');
    return null;
  }

  // When OS focus is outside Electron,
  // force focus on main window.
  clearInterval(focusInterval);
  focusInterval = setInterval(() => {

    // First, tell OS to focus on this window
    focusWindow.focus();

    // Then focus on web page (for keyboard events).
    focusWindow.webContents.focus();

  }, 5000);

}

function loadWindowsUptimeDelay() {

  console.log('loadWindowsUptimeDelay');

  // Seconds since launch, when it will be safe to load the URL
  const nominalUptime = 300;

  // Seconds to wait if we are not in the nominal uptime window
  const launchDelay = 30; // 60
  //TEMP
  if (1 == 2 && os.uptime() > nominalUptime) {

    console.log('Launching immediately');
    launchWindowsToDisplays();

  } else {

    console.log('Delaying launch ' + launchDelay + ' seconds');

    // Launch with countdown for now...
    launchWindowsToDisplays(true);

    setTimeout(() => {

      reloadWindowURLs();

    }, launchDelay * 1000);

  }

}

app.on('window-all-closed', function() {
  app.quit();
});

