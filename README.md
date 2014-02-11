WebSAGE
=======

Browser based implementation of SAGE. A cluster-based html viewer used for displaying elements across multiple browser windows.

## Requirements ##
* ffmpeg
* graphicsmagick
* poppler

For Mac OSX

```
brew install ffmpeg 
brew install graphicsmagick 
brew install poppler --with-glib
export PKG_CONFIG_PATH=/usr/X11/lib/pkgconfig
```

### Installing the webBrowser ###
#### Prerequisites (libraries) ####
Awesomium: http://www.awesomium.com

##### Mac OSX #####
```
brew install boost libjpeg-turbo
sudo easy_install pip
```

##### OpenSuse #####
```
sudo zypper in boost-devel libjpeg-turbo python-pip
```

#### Prerequisites (python libraries) ####
To install the python prerequisites you can use pip
```
sudo pip install Twisted autobahn
```

#### Installation ####
```
cd webBrowser/awesomium
mkdir build
cd build
cmake ../
make
```
