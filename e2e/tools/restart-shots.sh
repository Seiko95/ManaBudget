#!/usr/bin/env bash
# Dev helper: (re)start a server on :4180 with persistent data in test-data/shots.
fuser -k 4180/tcp 2>/dev/null
sleep 0.5
DATA_DIR=test-data/shots PORT=4180 ORIGIN=http://localhost:4180 GEOCODING_ENABLED=${GEOCODING_ENABLED:-false} nohup node build > test-results/shots-server.log 2>&1 &
sleep 1.5
curl -s localhost:4180/api/health
