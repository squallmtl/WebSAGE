WebSAGE
=======

Browser based implementation of SAGE. A cluster-based html viewer used for displaying elements across multiple browser windows.

### Requirements ###
* ffmpeg
* poppler

##### For Windows: #####

* Download and install [Node.js](http://nodejs.org/)
* Download and install [7-Zip](http://www.7-zip.org/)
* Download [FFMpeg](http://ffmpeg.zeranoe.com/builds/)
* Download [Poppler-utils](http://manifestwebdesign.com/2013/01/09/xpdf-and-poppler-utils-on-windows/)

Install FFMpeg
* Move the FFMpeg 7-zip file to "C:\"
* Right-click, go to 7-Zip > Extract Here
* Rename extracted folder to "FFMpeg"

Install Poppler
* Create Folder "C:\Poppler"
* Move the Poppler-utils zip file to "C:\Poppler"
* Right-click, go to 7-Zip > Extract Here

Set Environment
* Add both "C:\FFMpeg" and "C:\Poppler" to you PATH variable


##### For Mac OSX: #####

* Download and install [Node.js](http://nodejs.org/)
* Download and install [homebrew](http://brew.sh/)

```
brew install ffmpeg 
brew install poppler --with-glib
```


=======

##### Setup Node js (Mac OSX and Linux): #####
Open keys/GO
Edit ```servers``` to be a list of hostnames for your server
```
cd <WebSAGE_directory>
npm install
cd keys/
./GO
```

=======

##### Run WebSAGE: #####
```
cd <WebSAGE_directory>
node server.js
```


