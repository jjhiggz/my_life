#!/bin/bash
# Setup script for higgzlife notification schedules
# This installs launchd jobs that send notifications at scheduled times

SCHEDULES_DIR="$(dirname "$0")/schedules"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"

# Ensure LaunchAgents directory exists
mkdir -p "$LAUNCH_AGENTS_DIR"

echo "Setting up higgzlife notification schedules..."

# Function to install a schedule
install_schedule() {
    local plist="$1"
    local name=$(basename "$plist")
    local dest="$LAUNCH_AGENTS_DIR/$name"

    # Unload if already loaded
    launchctl unload "$dest" 2>/dev/null

    # Copy and load
    cp "$plist" "$dest"
    launchctl load "$dest"

    echo "  ✓ Installed: $name"
}

# Function to uninstall a schedule
uninstall_schedule() {
    local name="$1"
    local dest="$LAUNCH_AGENTS_DIR/$name"

    launchctl unload "$dest" 2>/dev/null
    rm -f "$dest"

    echo "  ✓ Removed: $name"
}

# Function to list schedules
list_schedules() {
    echo "Installed higgzlife schedules:"
    ls -la "$LAUNCH_AGENTS_DIR"/com.higgzlife.* 2>/dev/null || echo "  (none)"
}

case "${1:-install}" in
    install)
        for plist in "$SCHEDULES_DIR"/*.plist; do
            [ -f "$plist" ] && install_schedule "$plist"
        done
        echo ""
        echo "Done! Schedules are now active."
        echo ""
        echo "IMPORTANT: Install the ntfy app on your phone and subscribe to topic: higgzlife"
        echo "  iOS: https://apps.apple.com/app/ntfy/id1625396347"
        echo "  Android: https://play.google.com/store/apps/details?id=io.heckel.ntfy"
        ;;
    uninstall)
        for plist in "$LAUNCH_AGENTS_DIR"/com.higgzlife.*.plist; do
            [ -f "$plist" ] && uninstall_schedule "$(basename "$plist")"
        done
        echo "All higgzlife schedules removed."
        ;;
    list)
        list_schedules
        ;;
    test)
        echo "Sending test notification..."
        "$(dirname "$0")/notify.sh" "Test notification from higgzlife! 🎉" "Test" "default"
        echo "Check your phone (make sure ntfy app is installed and subscribed to 'higgzlife' topic)"
        ;;
    *)
        echo "Usage: $0 {install|uninstall|list|test}"
        exit 1
        ;;
esac
