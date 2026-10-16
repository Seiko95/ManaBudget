#!/bin/sh
# Starts as root only to make sure /data is writable by the app user
# (Docker creates a missing bind-mount folder as root), then drops privileges.
set -e
if [ "$(id -u)" = "0" ]; then
	mkdir -p /data
	if [ "$(stat -c %u /data)" != "$(id -u node)" ]; then
		chown -R node:node /data
	fi
	exec setpriv --reuid=node --regid=node --init-groups "$@"
fi
exec "$@"
