#!/bin/bash
# Simple notification script using ntfy.sh
# Usage: ./notify.sh "Your message here" [title] [priority]

TOPIC="higgzlife"  # Change this to your own private topic name
MESSAGE="${1:-Time for your next task}"
TITLE="${2:-HiggzLife}"
PRIORITY="${3:-default}"  # low, default, high, urgent

curl -s \
  -H "Title: $TITLE" \
  -H "Priority: $PRIORITY" \
  -H "Tags: muscle" \
  -d "$MESSAGE" \
  "ntfy.sh/$TOPIC"
