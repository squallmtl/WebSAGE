#!/bin/sh
osascript <<END 
tell application "Terminal"
    do script "cd \"`pwd`\";cd ..;node server.js;exit"
end tell
END

echo ""
echo ""
sleep 1

#global_param="--new-window --window-size=1920,1080 --kiosk --disable-popup-blocking --nfirst-run --use-gl --enable-accelerated-compositing --allow-file-access-from-files"

#UDD=$HOME/.config/chrome-nfs/mac0
#mkdir -p $UDD/Default
#param="$global_param --user-data-dir=$UDD"
#/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome $param 'https://localhost:9090?clientID=0' &


global_param="--new-window --window-size=700,700 --disable-popup-blocking --nfirst-run --use-gl --enable-accelerated-compositing --allow-file-access-from-files"

UDD=$HOME/.config/chrome-nfs/mac0
mkdir -p $UDD/Default
param="$global_param --window-position=0,0 --user-data-dir=$UDD --app=https://localhost:9090?clientID=0"
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome $param &

UDD=$HOME/.config/chrome-nfs/mac1
mkdir -p $UDD/Default
param="$global_param --window-position=700,0 --user-data-dir=$UDD --app=https://localhost:9090?clientID=1"
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome $param &