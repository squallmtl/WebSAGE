WebSAGE
=======

Browser based implementation of SAGE. A cluster-based html viewer used for displaying elements across multiple browser windows.

### Requirements ###
* ffmpeg
* poppler
* graphicsmagick
* openmp-devel (linux)
* nodejs-devel (linux)

##### For Windows: #####

* Download and install [Node.js](http://nodejs.org/)
* Download and install [7-Zip](http://www.7-zip.org/)
* Download and install [Awesomium](http://www.awesomium.com)
* Download [FFMpeg](http://ffmpeg.zeranoe.com/builds/)
* Download [Poppler-utils](http://manifestwebdesign.com/2013/01/09/xpdf-and-poppler-utils-on-windows/)
* Download [GraphicsMagick (Q8)](ftp://ftp.graphicsmagick.org/pub/GraphicsMagick/windows/)

Install FFMpeg
* Move the FFMpeg 7-zip file to "C:\"
* Right-click, go to 7-Zip > Extract Here
* Rename extracted folder to "FFMpeg"

Install Poppler
* Create Folder "C:\Poppler"
* Move the Poppler-utils zip file to "C:\Poppler"
* Right-click, go to 7-Zip > Extract Here

Install GraphicsMagick
* Create Folder "C:\GraphicsMacgick"
* Move the GraphicsMagick Q8 executable to "C:\GraphicsMacgick"

Set Environment
* Add "C:\FFMpeg", "C:\Poppler" and "C:\GraphicsMacgick" to you PATH variable

###### Setup Node js: ######
Open 'keys/GO-windows.bat'
Add lines with list of hostnames for your server
```
cd <WebSAGE_directory>
npm install
cd keys\
.\GO-windows.bat
```

##### For Mac OSX: #####

* Download and install [Node.js](http://nodejs.org/)
* Download and install [homebrew](http://brew.sh/)
* Download and install [Awesomium](http://www.awesomium.com)
```
brew install ffmpeg 
brew install poppler --without-glib
brew install graphicsmagick
brew install libjpeg-turbo
brew install openmp
```

###### Setup Node js: ######
Open 'keys/GO-mac'
Edit ```servers``` to be a list of hostnames for your server
```
cd <WebSAGE_directory>
npm install
cd keys/
./GO-mac
```

=======

##### Run WebSAGE: #####
```
cd <WebSAGE_directory>
node server.js
```

