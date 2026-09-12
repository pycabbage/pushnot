# pushnot

A notification service that delivers coding agent (Claude Code, Codex, and more) completion events to your browser as Web Push notifications.

## Features

- Add a single hook to Claude Code or Codex, and get a browser notification whenever the agent finishes its work.
- Notifications show up in your OS notification center, so you don't need to keep the tab open or in focus.
- Add other devices, such as your phone, to the same notification session by scanning a QR code or opening a link.
- Review the delivery history (time, title, body, and success or failure) at any time.

## Usage

1. Open <https://pushnot.cabbagelettuce.com/> in your browser. A notification session is created for you automatically.
2. Click "Register client" and allow notifications. This browser is now registered as a notification target.
3. Pick the tab for the agent you use (Claude Code or Codex) and add the shown hook configuration to the matching config file.
   - Claude Code: `~/.claude/settings.json`
   - Codex: `~/.codex/hooks.json`
4. Notifications arrive on the registered browser whenever the agent finishes its work.
5. Use "Add other device" to scan the QR code or copy the link, and open the same session on another device.
6. Delivered notifications are listed at the bottom of the page at any time.
