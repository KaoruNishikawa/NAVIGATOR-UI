# specify server IP address and port if given as args
if [ $# -ne 0 ]; then
    export NASCO_SERVER_IP=$1
    if [ $# -ge 2 ]; then
        export NASCO_SERVER_PORT=$2
# start the server
node server.js
