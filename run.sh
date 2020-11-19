#!/bin/bash

command="npm run production"

if [[ $DESKTOP_SESSION == *plasma* ]]; then
  konsole --noclose -e $command
elif [[ $DESKTOP_SESSION == *gnome* ]]; then
  gnome-terminal -e "bash -c '$command';bash"
elif [[ $DESKTOP_SESSION == *xfce* ]]; then
  xfce4-terminal -H -e "$command"
else
  npm run production
fi
