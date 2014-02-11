#!/bin/bash

g++ -c -fPIC webBrowser.cpp -o webBrowser.o
g++ -shared -Wl,-soname,libwebbrowser.so -o libwebbrowser.so  webBrowser.o
