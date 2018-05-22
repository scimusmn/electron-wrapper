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
let availableDisplays = [];
let windows = [];
let focusWindow;
let focusInterval;

app.on('ready', function() {

  //
  // Hack to make full-screen kiosk mode actually work.
  //
  // There is an active bug with Electron, kiosk mode, and Yosemite.
  // https://github.com/atom/electron/issues/1054
  // This hack makes kiosk mode actually work by waiting for the app to launch
  // and then issuing a call to go into kiosk mode after a few milliseconds.
  //
  /*  if (env.name === 'production') {
      setTimeout(function() {
        mainWindow.setKiosk(true);
      }, 100);
    }*/

  //
  // Show dev tools when we're not in production mode
  //
  /*  if (env.name !== 'production') {
      devHelper.setDevMenu();
      mainWindow.openDevTools();
    }*/

  //
  // Open the app
  //
  console.log(`This platform is ${process.platform}`);

  if (env.name === 'test') {

    mainWindow.loadURL('file://' + __dirname + '/spec.html');

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
  const retQuit = globalShortcut.register('CommandOrControl+F', () => {
    console.log('Switching to Finder');
    promisedExec('open -a Finder');
  });

  if (!retQuit) {
    console.log('Quit keyboard registration failed');
  }

  const retReload = globalShortcut.register('CommandOrControl+R', () => {
    console.log('Reload the page');
    mainWindow.reload();
  });

  if (!retReload) {
    console.log('Reload keyboard registration failed');
  }

});

// Get all displays, then ensure
// correct windows are launched
// to each display.
function matchWindowsToDisplays() {

  availableDisplays = screen.getAllDisplays();
  windows = BrowserWindow.getAllWindows();

  console.log('Available displays:', availableDisplays.length);

  for (let i in availableDisplays) {

    const targetDisplay = availableDisplays[i];

    console.log('targetDisplay', i);
    console.log(targetDisplay);

    const newWindow = new BrowserWindow({
      x: targetDisplay.bounds.x + 50,
      y: targetDisplay.bounds.y + 50,
      width: 600,
      height: 400,
    });

    // Find matching config display
    for (let j in configDisplays) {

      const cfgDisplay = configDisplays[j];

      if (cfgDisplay.targetDisplayId == targetDisplay.id) {

        console.log('Match found! ', cfgDisplay.label);

        // Match
        newWindow.loadURL(cfgDisplay.url);

        if (cfgDisplay.keepFocus == true) {

          console.log('Focus window set: ', cfgDisplay.label);

          focusWindow = newWindow;

        }

      }
    }

  }

  // Ensure window focus
  // every 5 seconds
  clearInterval(focusInterval);
  focusInterval = setInterval(() => {

    ensureWindowFocus();

    windows = BrowserWindow.getAllWindows();

    // console.dir(windows);
    // console.log(windows[0].getTitle());

    // windows[0].setTitle(configDisplays[0].label);

  }, 5000);

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
    mainWindow.loadURL('file://' + __dirname + '/config-error.html');
    return;

  } else {

    // Array representing all
    // the displays we're hoping
    // to launch.
    configDisplays = configFileObj.displays;

    loadWindowsUptimeDelay();

  }

}

function logMultiDisplayIssue(message) {

  console.log('MultiDisplay Issue:');
  console.log(' --> ' + message);

  // TODO: Inform a window that something is wrong,
  // so it can be displayed onscreen.

}

function ensureWindowFocus() {

  // When OS focus is outside Electron,
  // force focus on main window.
  if (focusWindow && BrowserWindow.getFocusedWindow() == null) {
    // First,ell OS to focus on this window
    focusWindow.focus();

    // Then focus on web page (for keyboard events).
    focusWindow.webContents.focus();
  }

}

function loadWindowsUptimeDelay() {

  console.log('loadWindowsUptimeDelay');

  // Seconds since launch, when it will be safe to load the URL
  const nominalUptime = 300;

  // Seconds to wait if we are not in the nominal uptime window
  const launchDelay = 10; // 60

  if (os.uptime() > nominalUptime) {

    console.log('Launching immediately');
    matchWindowsToDisplays();

  } else {

    console.log('Delaying launch ' + launchDelay + ' seconds');
    mainWindow.loadURL('file://' + __dirname + '/launch-delay.html?delay=' + launchDelay);

    setTimeout(() => {

      matchWindowsToDisplays();

    }, launchDelay * 1000);

  }

}

app.on('window-all-closed', function() {
  app.quit();
});

