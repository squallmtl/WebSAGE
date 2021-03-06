"use strict";

// Importing modules (form node_modules directory)

// npm registry - defined in package.json
var crypto = require('crypto');            // https encryption
var fs = require('fs');                    // filesystem access
var gm = require('gm');                    // graphicsmagick
var http = require('http');                // http server
var https = require('https');              // https server
var imageinfo = require('imageinfo');      // gets width, height for images
var multiparty = require('multiparty');    // parses POST forms
var os = require('os');                    // operating system access
var path = require('path');                // file path extraction and creation
var request = require('request');          // external http requests
var json5 = require('json5');              // better JSON format

// custom node modules
var httpserver = require('node-httpserver');           // creates web server
var websocketIO = require('node-websocket.io');        // creates WebSocket server and clients
var loader = require('node-itemloader');               // handles sage item creation
var interaction = require('node-interaction');         // handles sage interaction (move, resize, etc.)
var sagepointer = require('node-sagepointer');         // handles sage pointers (creation, location, etc.)


// User defined config file
var wallfile = null;
//var wallfile = "config/tmarrinan-cfg.json";
//var wallfile = "config/desktop-omicron-cfg.json";
//var wallfile = "config/icewall-cfg.json";
//var wallfile = "config/icewallKB-cfg.json";
//var wallfile = "config/icewallJA-cfg.json";
//var wallfile = "config/icewallTM-cfg.json";
//var wallfile = "config/icewallAN-cfg.json";
//var wallfile = "config/icewallRight-omicron-cfg.json";

// If variable not set, use the hostname to find a matching file
if (wallfile == null) {
	var hn   = os.hostname();
	var dot = hn.indexOf(".");
	if(dot >= 0) hn = hn.substring(0, dot);
	wallfile = path.join("config", hn + "-cfg.json");
	if (fs.existsSync(wallfile)) {
		console.log("Found configuration file: ", wallfile);
	} else {
		wallfile = path.join("config", "desktop-cfg.json");
		console.log("Using default configuration file: ", wallfile);
	}
}

// parse config file to create data structure
var json_str = fs.readFileSync(wallfile, 'utf8');
var config = json5.parse(json_str);
config.totalWidth = config.resolution.width * config.layout.columns;
config.totalHeight = config.resolution.height * config.layout.rows;
config.titleBarHeight = Math.round(0.025 * config.totalHeight);
config.titleTextSize = Math.round(0.015 * config.totalHeight);
config.pointerWidth = Math.round(0.20 * config.totalHeight);
config.pointerHeight = Math.round(0.05 * config.totalHeight);
console.log(config);

// global variables
var public_https = "public_HTTPS";
var hostOrigin = "https://"+config.host+":"+config.port.toString()+"/";
var uploadsFolder = path.join(public_https, "uploads");


// Loads the web browser module if enabled in the configuration file:
//    experimental: { "webbrowser": true }
var webBrowser = null;
if (typeof config.experimental != "undefined" && typeof config.experimental.webbrowser != "undefined" && config.experimental.webbrowser == true) {
	webBrowser = require('node-awesomium');  // load the custom node module for awesomium
	console.log("WebBrowser loaded: awesomium")
}

if (webBrowser != null) webBrowser.init(config.totalWidth, config.totalHeight, 1366, 390);

// arrays of files on the server (used for media browser)
var savedFiles = {"image": [], "video": [], "pdf": [], "app": []};
var uploadedImages = fs.readdirSync(path.join(uploadsFolder, "images"));
var uploadedVideos = fs.readdirSync(path.join(uploadsFolder, "videos"));
var uploadedPdfs = fs.readdirSync(path.join(uploadsFolder, "pdfs"));
var uploadedApps = fs.readdirSync(path.join(uploadsFolder, "apps"));
for(var i=0; i<uploadedImages.length; i++) savedFiles["image"].push(uploadedImages[i]);
for(var i=0; i<uploadedVideos.length; i++) savedFiles["video"].push(uploadedVideos[i]);
for(var i=0; i<uploadedPdfs.length; i++) savedFiles["pdf"].push(uploadedPdfs[i]);
for(var i=0; i<uploadedApps.length; i++) savedFiles["app"].push(uploadedApps[i]);

// background image
if(typeof config.background.image !== "undefined" && config.background.image != null){
	var bg_file = path.join(public_https, config.background.image);
	var bg_info = imageinfo(fs.readFileSync(bg_file));
	
	if(config.background.style == "fit"){
		if(bg_info.width == config.totalWidth && bg_info.height == config.totalHeight){
			sliceBackgroundImage(bg_file, bg_file);
		}
		else{
			var tmpImg = path.join(public_https, "images", "background", "tmp_background.png");
			var out_res  = config.totalWidth.toString() + "x" + config.totalHeight.toString();
		
			gm(bg_file).command("convert").in("-gravity", "center").in("-background", "rgba(255,255,255,255)").in("-extent", out_res).write(tmpImg, function(err) {
				if(err) throw err;
			
				sliceBackgroundImage(tmpImg, bg_file);
			});
		}
	}
	else if(config.background.style == "stretch"){
		var imgExt = path.extname(bg_file);
		var tmpImg = path.join(public_https, "images", "background", "tmp_background" + imgExt);
		
		gm(bg_file).resize(config.totalWidth, config.totalHeight, "!").write(tmpImg, function(err) {
			if(err) throw err;
			
			sliceBackgroundImage(tmpImg, bg_file);
		});
	}
	else if(config.background.style == "tile"){
		var imgExt = path.extname(bg_file);
		var tmpImg = path.join(public_https, "images", "background", "tmp_background" + imgExt);
		
		var cols = Math.ceil(config.totalWidth / bg_info.width);
		var rows = Math.ceil(config.totalHeight / bg_info.height);
		var tile = cols.toString() + "x" + rows.toString();
		var in_res  = bg_info.width.toString() + "x" + bg_info.height.toString();
		
		var gmTile = gm().command("montage").in("-geometry", in_res).in("-tile", tile);
		for(var i=0; i<rows*cols; i++) gmTile = gmTile.in(bg_file);
		
		gmTile.write(tmpImg, function(err) {
			if(err) throw err;
			
			sliceBackgroundImage(tmpImg, bg_file);
		});
	}
}

function sliceBackgroundImage(fileName, outputBaseName) {
	for(var i=0; i<config.displays.length; i++){
		var x = config.displays[i].column * config.resolution.width;
		var y = config.displays[i].row * config.resolution.height;
		var output_dir = path.dirname(outputBaseName);
		var input_ext = path.extname(outputBaseName);
		var output_ext = path.extname(fileName);
		var output_base = path.basename(outputBaseName, input_ext);
		var output = path.join(output_dir, output_base + "_"+i.toString() + output_ext);
		console.log(output);
		gm(fileName).crop(config.resolution.width, config.resolution.height, x, y).write(output, function(err) {
			if(err) throw err;
		});
	}
}

// build a list of certs to support multi-homed computers
var certs = {};
// add the default cert from the hostname specified in the config file
certs[config.host] = crypto.createCredentials({
	key:  fs.readFileSync(path.join("keys", config.host + "-server.key")),
	cert: fs.readFileSync(path.join("keys", config.host + "-server.crt")),
	ca:   fs.readFileSync(path.join("keys", config.host + "-ca.crt")),
   }).context;

for(var h in config.alternate_hosts){
	var alth = config.alternate_hosts[h];
	certs[ alth ] = crypto.createCredentials({
		key:  fs.readFileSync(path.join("keys", alth + "-server.key")),
		cert: fs.readFileSync(path.join("keys", alth + "-server.crt")),
		ca:   fs.readFileSync(path.join("keys", alth + "-ca.crt")),
	}).context;
}

var options = {
	// server default keys
	key:  fs.readFileSync(path.join("keys", config.host + "-server.key")),
	cert: fs.readFileSync(path.join("keys", config.host + "-server.crt")),
	ca:   fs.readFileSync(path.join("keys", config.host + "-ca.crt")),
	requestCert: true,
	rejectUnauthorized: false,
	// callback to handle multi-homed machines
	SNICallback: function(servername){
		if(certs.hasOwnProperty(servername)){
			return certs[servername];
		}
		else{
			console.log("Unknown host, cannot find a certificate for ", servername);
			return null;
		}
	}
};

// create HTTP server for index page (Table of Contents)
var httpServerIndex = new httpserver("public_HTTP");
httpServerIndex.httpGET('/config', function(req, res) {
	res.writeHead(200, {"Content-Type": "text/plain"});
	res.write(JSON.stringify(config));
	res.end();
});

// create HTTPS server for all SAGE content
var httpsServerApp = new httpserver("public_HTTPS");
// receiving newly uploaded files from drag-and-drop interface in SAGE Pointer / SAGE UI
httpsServerApp.httpPOST('/upload', function(req, res) {
	var form = new multiparty.Form();
	form.parse(req, function(err, fields, files) {
		if(err){
			res.writeHead(500, {"Content-Type": "text/plain"});
			res.write(err + "\n\n");
			res.end();
		}
		
		// saves files in appropriate directory and broadcasts the items to the displays
		uploadFiles(files);

		res.writeHead(200, {"Content-Type": "text/plain"});
		res.write("received upload:\n\n");
		res.end();
	});
});


// initializes HTTP and HTTPS servers
var index = http.createServer(httpServerIndex.onrequest);
var server = https.createServer(options, httpsServerApp.onrequest);

// creates a WebSocket server - 2 way communication between server and all browser clients
var wsioServer = new websocketIO.Server({server: server});

// global variables to manage items
var itemCount = 0;
var items = [];

// global variables to manage clients
var clients = [];
var sagePointers = {};
var remoteInteraction = {};
var mediaStreams = {};
var webStreams = {};

wsioServer.onconnection(function(wsio) {
	// unique identifier for WebSocket client
	var address = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port;
	console.log(address);

	wsio.emit('setupDisplayConfiguration', config); // may not need to send to all client types
	wsio.emit('initialize', {address: address, time: new Date()}); // address is unique id
	
	wsio.onclose(function() {
		if(wsio.clientType == "remoteServer"){
			var remoteIdx = -1;
			for(var i=0; i<config.remote_sites.length; i++){
				if(wsio.remoteAddress.address == config.remote_sites[i].host && wsio.remoteAddress.port == config.remote_sites[i].port) remoteIdx = i;
			}
			if(remoteIdx >= 0){
				console.log("Remote site \"" + config.remote_sites[remoteIdx].name + "\" now offline");
				remoteSites[remoteIdx].connected = false;
				var site = {name: remoteSites[remoteIdx].name, connected: remoteSites[remoteIdx].connected};
				broadcast('connectedToRemoteSite', site, "display");
			}
		}
		else if(wsio.clientType == "sageUI"){
			hidePointer( address );
			delete sagePointers[address];
			delete remoteInteraction[address];
		}
		else if(wsio.clientType == "sagePointer"){
			hidePointer( address );
			delete sagePointers[address];
			delete remoteInteraction[address];
		}
		else if(wsio.clientType == "display"){
			for(key in mediaStreams){
				delete mediaStreams[key].clients[address];
			}
            for(key in webStreams){
                delete webStreams[key].clients[address];
            }
		}
		removeElement(clients, wsio);
	});

	wsio.on('addClient', function(data) {
		wsio.clientType = data.clientType;
		if(wsio.clientType == "sageUI"){
			createSagePointer( address );
			for(var i=0; i<items.length; i++){
				wsio.emit('addNewElement', items[i]);
			}
		}
		else if(wsio.clientType == "sagePointer"){
			createSagePointer( address );
		}
		else if(wsio.clientType == "display"){
			for(var key in sagePointers){
				wsio.emit('createSagePointer', sagePointers[key]);
			}
			var now = new Date();
			wsio.emit('setSystemTime', {date: now});
			for(var i=0; i<items.length; i++){
				wsio.emit('addNewElement', items[i]);
			}
			for(var i=0; i<remoteSites.length; i++){
				var site = {name: remoteSites[i].name, connected: remoteSites[i].connected, width: remoteSites[i].width, height: remoteSites[i].height, pos: remoteSites[i].pos};
				wsio.emit('addRemoteSite', site);
			}
			for(key in mediaStreams){
				mediaStreams[key].clients[address] = false;
			}
            for(key in webStreams){
                webStreams[key].clients[address] = false;
            }
		}
		else if(wsio.clientType == "remoteServer"){
			var remoteIdx = -1;
			wsio.remoteAddress.address = data.host;
			wsio.remoteAddress.port = data.port;
			address = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port;
			for(var i=0; i<config.remote_sites.length; i++){
				if(wsio.remoteAddress.address == config.remote_sites[i].host && wsio.remoteAddress.port == config.remote_sites[i].port) remoteIdx = i;
			}

			// add remote server websocket to array
			if(remoteIdx >= 0){
				remoteSites[remoteIdx].wsio = wsio;
				remoteSites[remoteIdx].connected = true;
				var site = {name: remoteSites[remoteIdx].name, connected: remoteSites[remoteIdx].connected};
				broadcast('connectedToRemoteSite', site, "display");
			}
		}

		clients.push(wsio);
		console.log("New Connection: " + address + " (" + wsio.clientType + ")");
	});

	wsio.on('startSagePointer', function(data) {
		showPointer( address, data );
	});

	wsio.on('stopSagePointer', function() {
		hidePointer( address );

		if( remoteInteraction[address].appInteractionMode() ){//return to window interaction mode after stopping pointer
		    remoteInteraction[address].toggleModes();
		    broadcast('changeSagePointerMode', {id: sagePointers[address].id, mode: remoteInteraction[address].interactionMode } , 'display' );
		}
	});

	wsio.on('pointerPress', function() {
		var pointerX = sagePointers[address].left
		var pointerY = sagePointers[address].top

		pointerPress( address, pointerX, pointerY );
	});

	wsio.on('pointerRelease', function() {
		var pointerX = sagePointers[address].left
		var pointerY = sagePointers[address].top

	   pointerRelease( address, pointerX, pointerY );
	});

	wsio.on('pointerPosition', function(data) {
		pointerPosition( address, data );
	});

	// Got double-click event from the pointer
	wsio.on('pointerDblClick', function(data) {
		var pointerX = sagePointers[address].left
		var pointerY = sagePointers[address].top
		var elem     = findItemUnderPointer(pointerX, pointerY);

		if (elem != null) {
			if (!elem.isMaximized || elem.isMaximized == 0) {
				// need to maximize the item
				var updatedItem = remoteInteraction[address].maximizeSelectedItem(elem, config);
				if (updatedItem != null) {
					broadcast('setItemPositionAndSize', updatedItem);
					// the PDF files need an extra redraw
					broadcast('finishedResize', {id: elem.id}, "display");
					if (webBrowser != null)
                    	webBrowser.resize(elem.elemId, Math.round(elem.elemWidth), Math.round(elem.elemHeight));
				}
			} else {
				// already maximized, need to restore the item size
				var updatedItem = remoteInteraction[address].restoreSelectedItem(elem);
				if (updatedItem != null) {
					broadcast('setItemPositionAndSize', updatedItem);
					// the PDF files need an extra redraw
					broadcast('finishedResize', {id: elem.id}, "display");
					if (webBrowser != null)
	                    webBrowser.resize(elem.elemId, Math.round(elem.elemWidth), Math.round(elem.elemHeight));
				}
			}
		}
	});

	wsio.on('pointerMove', function(data) {
		sagePointers[address].left += data.deltaX;
		sagePointers[address].top += data.deltaY;
		if(sagePointers[address].left < 0) sagePointers[address].left = 0;
		if(sagePointers[address].left > config.totalWidth) sagePointers[address].left = config.totalWidth;
		if(sagePointers[address].top < 0) sagePointers[address].top = 0;
		if(sagePointers[address].top > config.totalHeight) sagePointers[address].top = config.totalHeight;

		broadcast('updateSagePointerPosition', sagePointers[address], "display");

	    if( remoteInteraction[address].windowManagementMode() ){
	    	var pointerX = sagePointers[address].left
			var pointerY = sagePointers[address].top

			var updatedMoveItem = remoteInteraction[address].moveSelectedItem(pointerX, pointerY);
			var updatedResizeItem = remoteInteraction[address].resizeSelectedItem(pointerX, pointerY);
			if(updatedMoveItem != null){
				broadcast('setItemPosition', updatedMoveItem);
			}
			else if(updatedResizeItem != null){
				broadcast('setItemPositionAndSize', updatedResizeItem);
			}
			else{
				var elem = findItemUnderPointer(pointerX, pointerY);
				if(elem != null){
					var localX = pointerX - elem.left;
					var localY = pointerY - (elem.top+config.titleBarHeight);
					var cornerSize = Math.min(elem.width, elem.height) / 5;
					// bottom right corner - select for drag resize
					if(localX >= elem.width-cornerSize && localY >= elem.height-cornerSize){
						if(remoteInteraction[address].hoverCornerItem != null){
							broadcast('hoverOverItemCorner', {elemId: remoteInteraction[address].hoverCornerItem.id, flag: false}, "display");
						}
						remoteInteraction[address].setHoverCornerItem(elem);
						broadcast('hoverOverItemCorner', {elemId: elem.id, flag: true}, "display");
					}
					else if(remoteInteraction[address].hoverCornerItem != null){
						broadcast('hoverOverItemCorner', {elemId: remoteInteraction[address].hoverCornerItem.id, flag: false}, "display");
						remoteInteraction[address].setHoverCornerItem(null);
					}
				}
				else if(remoteInteraction[address].hoverCornerItem != null){
					broadcast('hoverOverItemCorner', {elemId: remoteInteraction[address].hoverCornerItem.id, flag: false}, "display");
					remoteInteraction[address].setHoverCornerItem(null);
				}
			}
		}
		else if ( remoteInteraction[address].appInteractionMode() ) {
			var pointerX = sagePointers[address].left
			var pointerY = sagePointers[address].top

			var elem = findItemUnderPointer(pointerX, pointerY);

			if( elem != null ){

				var itemRelX = pointerX - elem.left;
				var itemRelY = pointerY - elem.top - config.titleBarHeight;
				var now = new Date();
				broadcast( 'eventInItem', { eventType: "pointerMove", elemId: elem.id, user_id: sagePointers[address].id, user_label: sagePointers[address].label, user_color: sagePointers[address].color, itemRelativeX: itemRelX, itemRelativeY: itemRelY, data: {}, date: now }, "display");
			}
		}
	});

	wsio.on('pointerScrollStart', function() {
		var pointerX = sagePointers[address].left
		var pointerY = sagePointers[address].top
		var elem = findItemUnderPointer(pointerX, pointerY);

		if(elem != null){
			remoteInteraction[address].selectScrollItem(elem);
			var newOrder = moveItemToFront(elem.id);
			broadcast('updateItemOrder', {idList: newOrder});
		}
	});

	wsio.on('pointerScroll', function(data) {
		pointerScroll( address, data );
	});

	wsio.on('keyDown', function(data) {
	    if(data.code == 16){ // shift
			remoteInteraction[address].SHIFT = true;
		}
		else if(data.code == 17){ // ctrl
			remoteInteraction[address].CTRL = true;
		}
		else if(data.code == 18) { // alt
			remoteInteraction[address].ALT = true;
		}
		else if(data.code == 20) { // caps lock
			remoteInteraction[address].CAPS = true;
		}
		else if(data.code == 91 || data.code == 92 || data.code == 93){ // command
			remoteInteraction[address].CMD = true;
		}

		//SEND SPECIAL KEY EVENT only will come here
		if ( remoteInteraction[address].appInteractionMode() ) {
				var pointerX = sagePointers[address].left
				var pointerY = sagePointers[address].top

				var elem = findItemUnderPointer(pointerX, pointerY);

				if( elem != null ){
					var itemRelX = pointerX - elem.left;
					var itemRelY = pointerY - elem.top - config.titleBarHeight;
					var now = new Date();
					var event = { eventType: "specialKey", elemId: elem.id, user_id: sagePointers[address].id, user_label: sagePointers[address].label, user_color: sagePointers[address].color, itemRelativeX: itemRelX, itemRelativeY: itemRelY, data: {code: data.code, state: "down" }, date: now };
					broadcast('eventInItem', event, "display");
					broadcast('eventInItem', event, "audioManager");
				    broadcast('eventInItem', event, "app");
}
		}

	});

	wsio.on('keyUp', function(data) {
		var pointerX = sagePointers[address].left
		var pointerY = sagePointers[address].top
		var elem = findItemUnderPointer(pointerX, pointerY);

		if(data.code == 16){ // shift
			remoteInteraction[address].SHIFT = false;
		}
		else if(data.code == 17){ // ctrl
			remoteInteraction[address].CTRL = false;
		}
		else if(data.code == 18) { // alt
			remoteInteraction[address].ALT = false;
		}
		else if(data.code == 20) { // caps lock
			remoteInteraction[address].CAPS = false;
		}
		else if(data.code == 91 || data.code == 92 || data.code == 93){ // command
			remoteInteraction[address].CMD = false;
		}

		if(elem != null){
			if( remoteInteraction[address].windowManagementMode() ){
				if(data.code == "8" || data.code == "46"){ // backspace or delete
					deleteElement( elem );
				}
			}
			else if ( remoteInteraction[address].appInteractionMode() ) {	//only send special keys
					var pointerX = sagePointers[address].left
					var pointerY = sagePointers[address].top

					var elem = findItemUnderPointer(pointerX, pointerY);

					if( elem != null ){
						var itemRelX = pointerX - elem.left;
						var itemRelY = pointerY - elem.top - config.titleBarHeight;
						var now = new Date();
						var event = { eventType: "specialKey", elemId: elem.id, user_id: sagePointers[address].id, user_label: sagePointers[address].label, user_color: sagePointers[address].color, itemRelativeX: itemRelX, itemRelativeY: itemRelY, data: {code: data.code, state: "up" }, date: now };
						broadcast('eventInItem', event, "display");
						broadcast('eventInItem', event, "audioManager");
					    broadcast('eventInItem', event, "app");
}
			}
		}
	});

	wsio.on('keyPress', function(data) {
		if(data.code == 9 && remoteInteraction[address].SHIFT && sagePointers[address].visible){ // shift + tab
			remoteInteraction[address].toggleModes();
			broadcast('changeSagePointerMode', {id: sagePointers[address].id, mode: remoteInteraction[address].interactionMode}, "display");
		    broadcast('changeSagePointerMode', {id: sagePointers[address].id, mode: remoteInteraction[address].interactionMode}, "app");
}

		if ( remoteInteraction[address].appInteractionMode() ) {
			var pointerX = sagePointers[address].left
			var pointerY = sagePointers[address].top

			var elem = findItemUnderPointer(pointerX, pointerY);

			 if( elem != null ){
				var itemRelX = pointerX - elem.left;
				var itemRelY = pointerY - elem.top - config.titleBarHeight;
				var now = new Date();
				var event = { eventType: "keyboard", elemId: elem.id, user_id: sagePointers[address].id, user_label: sagePointers[address].label, user_color: sagePointers[address].color, itemRelativeX: itemRelX, itemRelativeY: itemRelY, data: {code: parseInt(data.code), state: "down" }, date: now };
				broadcast('eventInItem', event, "display");
				broadcast('eventInItem', event, "audioManager");
			    // Send it to the webBrowser
				if (webBrowser != null)
	                webBrowser.keyPress(elem.id, data.code);
            }
		}

	});


	wsio.on('requestStoredFiles', function() {
		wsio.emit('storedFileList', savedFiles);
	});

	wsio.on('updateVideoTime', function(video_data) {
		broadcast('updateVideoItemTime', video_data, "display");
	});

	wsio.on('startNewMediaStream', function(data) {
		console.log("received new stream: " + data.id);
		mediaStreams[data.id] = {ready: true, clients: {}};
		for(var i=0; i<clients.length; i++){
			if(clients[i].clientType == "display"){
				var clientAddress = clients[i].remoteAddress.address + ":" + clients[i].remoteAddress.port;
				mediaStreams[data.id].clients[clientAddress] = false;
			}
		}

		loader.loadScreenCapture(data.src, data.id, data.title, data.width, data.height, function(newItem) {
			broadcast('addNewElement', newItem);

			items.push(newItem);
			itemCount++;
		});
	});

	wsio.on('updateMediaStreamFrame', function(data) {
		mediaStreams[data.id].ready = true;
		for(var key in mediaStreams[data.id].clients){
			mediaStreams[data.id].clients[key] = false;
		}
		var streamItem = findItemById(data.id);
		if(streamItem != null) streamItem.src = data.src;

		broadcast('updateMediaStreamFrame', data, "display");
	});

	wsio.on('updateRemoteMediaStreamFrame', function(data) {
		mediaStreams[data.id].ready = true;
		for(var key in mediaStreams[data.id].clients){
			mediaStreams[data.id].clients[key] = false;
		}
		var streamItem = findItemById(data.id);
		if(streamItem != null) streamItem.src = data.src;

		broadcast('updateRemoteMediaStreamFrame', data, "display");
	});

	wsio.on('receivedMediaStreamFrame', function(data) {
		mediaStreams[data.id].clients[address] = true;
		if(allTrueDict(mediaStreams[data.id].clients) && mediaStreams[data.id].ready){
			mediaStreams[data.id].ready = false;
			var broadcastWS = null;
			for(i=0; i<clients.length; i++){
				var clientAddress = clients[i].remoteAddress.address + ":" + clients[i].remoteAddress.port;
				if(clientAddress == data.id) broadcastWS = clients[i];
			}

			if(broadcastWS != null) broadcastWS.emit('requestNextFrame', null);
		}
	});

	wsio.on('receivedRemoteMediaStreamFrame', function(data) {
		mediaStreams[data.id].clients[address] = true;
		if(allTrueDict(mediaStreams[data.id].clients) && mediaStreams[data.id].ready){
			mediaStreams[data.id].ready = false;

			var broadcastWS = null;
			var serverAddress = data.id.substring(6).split("|")[0];
			var broadcastAddress = data.id.substring(6).split("|")[1];
			for(i=0; i<clients.length; i++){
				var clientAddress = clients[i].remoteAddress.address + ":" + clients[i].remoteAddress.port;
				if(clientAddress == serverAddress) broadcastWS = clients[i];
			}

			if(broadcastWS != null) broadcastWS.emit('requestNextRemoteFrame', {id: broadcastAddress});
		}
	});

	wsio.on('stopMediaStream', function(data) {
		var elem = findItemById(data.id);

		if(elem != null) deleteElement( elem );
	});

	wsio.on('addNewWebElement', function(data) {
		if(data.type == "img"){
			request({url: data.src, encoding: null, strictSSL: false}, function(err, response, body) {
				if(err) throw err;

				itemCount++;
				loader.loadImage(body, data.src, "item"+itemCount.toString(), decodeURI(data.src.substring(data.src.lastIndexOf("/")+1)), function(newItem) {
					broadcast('addNewElement', newItem);

					items.push(newItem);
				});
			});
		}
		else if(data.type == "video"){
			itemCount++;
			loader.loadVideo(data.src, data.src, data.src, "item"+itemCount.toString(), decodeURI(data.src.substring(data.src.lastIndexOf("/")+1)), function(newItem) {
				broadcast('addNewElement', newItem);

				items.push(newItem);
			});
		}
		else if(data.type == "youtube"){
			itemCount++;
			loader.loadYoutube(data.src, "item"+itemCount.toString(), function(newItem) {
				broadcast('addNewElement', newItem);

				items.push(newItem);
			});
		}
		else if(data.type == "pdf"){
			var filename = decodeURI(data.src.substring(data.src.lastIndexOf("/")+1));
			var url = path.join("uploads", "pdfs", filename);
			var localPath = path.join(public_https, url);
			var tmp = fs.createWriteStream(localPath);
			tmp.on('error', function(err) {
				if(err) throw err;
			});
			tmp.on('close', function() {
				itemCount++;
				loader.loadPdf(localPath, url, data.src, "item"+itemCount.toString(), path.basename(localPath), function(newItem) {
					broadcast('addNewElement', newItem);

					items.push(newItem);
				});
			});
			request({url: data.src, strictSSL: false}).pipe(tmp);
		}
	});

	wsio.on('addNewElementFromStoredFiles', function(file) {
		var url = path.join("uploads", file.dir, file.name);
		var external_url = hostOrigin + encodeURI(url);
		var localPath = path.join(public_https, url);

		if(file.dir == "images"){
			fs.readFile(localPath, function (err, data) {
				if(err) throw err;

				itemCount++;
				loader.loadImage(data, external_url, "item"+itemCount.toString(), path.basename(localPath), function(newItem) {
					broadcast('addNewElement', newItem);

					items.push(newItem);
				});
			});
		}
		else if(file.dir == "videos"){
			itemCount++;
			loader.loadVideo(localPath, url, external_url, "item"+itemCount.toString(), path.basename(localPath), function(newItem) {
				broadcast('addNewElement', newItem);

				items.push(newItem);
			});
		}
		else if(file.dir == "pdfs"){
			itemCount++;
			loader.loadPdf(localPath, url, external_url, "item"+itemCount.toString(), path.basename(localPath), function(newItem) {
				broadcast('addNewElement', newItem);

				items.push(newItem);
			});
		}
		else if(file.dir == "apps"){
			itemCount++;
			var id = "item"+itemCount.toString();
			loader.loadApp(localPath, url, external_url, id, function(newItem, instructions) {
				// add resource scripts to clients
				for(var i=0; i<instructions.resources.length; i++){
					if(instructions.resources[i].type == "script"){
						broadcast('addScript', {source: path.join(url, instructions.resources[i].src)});
					}
				}

				// add item to clients (after waiting 1 second to ensure resources have loaded)
				setTimeout(function() {
					broadcast('addNewElement', newItem);

					items.push(newItem);

					// set interval timer if specified
					if(instructions.animation == "timer"){
						setInterval(function() {
							var now = new Date();
							broadcast('animateCanvas', {elemId: id, type: instructions.type, date: now});
						}, instructions.interval);
					}
				}, 1000);
			});
		}
	});

	// Remote site
	wsio.on('addNewElementFromRemoteServer', function(data) {
		//console.log("received element from server: " + data.src);
		if(data.type == "img"){
			request({url: data.src, encoding: null, strictSSL: false}, function(err, response, body) {
				if(err) throw err;

				itemCount++;
				loader.loadImage(body, data.src, "item"+itemCount.toString(), decodeURI(data.src.substring(data.src.lastIndexOf("/")+1)), function(newItem) {
					broadcast('addNewElement', newItem);

					items.push(newItem);
				});
			});
		}
		else if(data.type == "video"){
			itemCount++;
			loader.loadVideo(data.src, data.src, data.src, "item"+itemCount.toString(), decodeURI(data.src.substring(data.src.lastIndexOf("/")+1)), function(newItem) {
				broadcast('addNewElement', newItem);

				items.push(newItem);
			});
		}
		else if(data.type == "youtube"){
			itemCount++;
			loader.loadYoutube(data.src, "item"+itemCount.toString(), function(newItem) {
				broadcast('addNewElement', newItem);

				items.push(newItem);
			});
		}
		else if(data.type == "pdf"){
			var filename = decodeURI(data.src.substring(data.src.lastIndexOf("/")+1));
			var url = path.join("uploads", "pdfs", filename);
			var localPath = path.join(public_https, url);
			var tmp = fs.createWriteStream(localPath);
			tmp.on('error', function(err) {
				if(err) throw err;
			});
			tmp.on('close', function() {
				itemCount++;
				loader.loadPdf(localPath, url, data.src, "item"+itemCount.toString(), path.basename(localPath), function(newItem) {
					broadcast('addNewElement', newItem);

					items.push(newItem);
				});
			});
			request({url: data.src, strictSSL: false}).pipe(tmp);
		}
		else if(data.type == "canvas" || data.type == "webgl" || data.type == "kineticjs" || data.type == "threejs"){
			console.log("remote app: " + data.src);
			
			itemCount++;
			var id = "item"+itemCount.toString();
			loader.loadRemoteApp(data.src, id, function(newItem, instructions) {
				// add resource scripts to clients
				for(var i=0; i<instructions.resources.length; i++){
					if(instructions.resources[i].type == "script"){
						broadcast('addScript', {source: data.src + "/" + instructions.resources[i].src});
					}
				}
	
				// add item to clients (after waiting 1 second to ensure resources have loaded)
				setTimeout(function() {
					broadcast('addNewElement', newItem);
					
					items.push(newItem);

					// set interval timer if specified
					if(instructions.animation == "timer"){
						setInterval(function() {
							var now = new Date();
							broadcast('animateCanvas', {elemId: id, type: instructions.type, date: now});
						}, instructions.interval);
					}
				}, 1000);
			});
		}
		else if(data.type == "screen"){
			var remote_id = "remote" + wsio.remoteAddress.address + ":" + wsio.remoteAddress.port + "|" + data.id;

			mediaStreams[remote_id] = {ready: true, clients: {}};
			for(var i=0; i<clients.length; i++){
				if(clients[i].clientType == "display"){
					var clientAddress = clients[i].remoteAddress.address + ":" + clients[i].remoteAddress.port;
					mediaStreams[remote_id].clients[clientAddress] = false;
				}
			}

			loader.loadRemoteScreen(data.src, remote_id, data.title, function(newItem) {
				console.log("REMOTE SCREEN");
				broadcast('addNewElement', newItem);

				items.push(newItem);
				itemCount++;
			});
		}
		else{
			console.log("unknown type: " + data.type);
		}
	});

	wsio.on('requestNextRemoteFrame', function(data) {
		var stream = findItemById(data.id);
		var remote_id = "remote" + config.host + ":" + config.port + "|" + data.id;

		if(stream != null) wsio.emit('updateRemoteMediaStreamFrame', {id: remote_id, src: stream.src});
		else wsio.emit('stopMediaStream', {id: remote_id});
	});

    wsio.on('receivedWebpageStreamFrame', function(data) {
        webStreams[data.id].clients[address] = true;
		if(allTrueDict(webStreams[data.id].clients) && webStreams[data.id].ready){
			webStreams[data.id].ready = false;
            data.src = webBrowser.getFrame(data.id);
            broadcast('updateWebpageStreamFrame', data, "display");

            webStreams[data.id].ready = true;
            for(var key in webStreams[data.id].clients){
                webStreams[data.id].clients[key] = false;
            }
        }
	});

    wsio.on('openNewWebpage', function(data) {
        var width = 1366;
        var height = 390;
        console.log("Opening a new webpage:" + data.url);

        data.id = data.id + "_" + itemCount.toString();
        var web = {src: "", title: "WebBrowser: " + data.url, width: width, height: height};

        webBrowser.createWindow(data.id, data.url);

        webStreams[data.id] = {ready: true, clients: {}};
		for(var i=0; i<clients.length; i++){
			if(clients[i].clientType == "display"){
				var clientAddress = clients[i].remoteAddress.address + ":" + clients[i].remoteAddress.port;
				webStreams[data.id].clients[clientAddress] = false;
			}
		
        }
	
        loader.loadWebpage(web.src, data.id, web.title, web.width, web.height, function(newItem) {
			broadcast('addNewElement', newItem);

            data.src = webBrowser.getFrame(data.id);
            broadcast('updateWebpageStreamFrame', data, "display");

			items.push(newItem);
			itemCount++;
		});
    });
});

/******** Remote Site Collaboration ******************************************************/
var remoteSites = new Array(config.remote_sites.length);
config.remote_sites.forEach(function(element, index, array) {
	var wsURL = "wss://" + element.host + ":" + element.port.toString();

	var remote = createRemoteConnection(wsURL, element, index);

	var rWidth = Math.min((0.5*config.totalWidth)/remoteSites.length, config.titleBarHeight*6) - 2;
	var rHeight = config.titleBarHeight - 4;
	var rPos = (0.5*config.totalWidth) + ((rWidth+2)*(index-(remoteSites.length/2))) + 1;
	remoteSites[index] = {name: element.name, wsio: remote, connected: false, width: rWidth, height: rHeight, pos: rPos};

	// attempt to connect every 15 seconds, if connection failed
	setInterval(function() {
		if(!remoteSites[index].connected){
			var remote = createRemoteConnection(wsURL, element, index);
			remoteSites[index].wsio = remote;
		}
	}, 15000);
});

function createRemoteConnection(wsURL, element, index) {
	var remote = new websocketIO(wsURL, false, function() {
		console.log("connected to " + element.name);
		remote.remoteAddress.address = element.host;
		remote.remoteAddress.port = element.port+1;
		remote.emit('addClient', {clientType: "remoteServer", host: config.host, port: config.port});
		remoteSites[index].connected = true;
		var site = {name: remoteSites[index].name, connected: remoteSites[index].connected};
		broadcast('connectedToRemoteSite', site, "display");
	});

	remote.clientType = "remoteServer";

	remote.onclose(function() {
		console.log("Remote site \"" + config.remote_sites[index].name + "\" now offline");
		remoteSites[index].connected = false;
		var site = {name: remoteSites[index].name, connected: remoteSites[index].connected};
		broadcast('connectedToRemoteSite', site, "display");
	});

	remote.on('addNewElementFromRemoteServer', function(data) {
		//console.log("received element from server: " + data.src);
		if(data.type == "img"){
			request({url: data.src, encoding: null, strictSSL: false}, function(err, response, body) {
				if(err) throw err;

				itemCount++;
				loader.loadImage(body, data.src, "item"+itemCount.toString(), decodeURI(data.src.substring(data.src.lastIndexOf("/")+1)), function(newItem) {
					broadcast('addNewElement', newItem);

					items.push(newItem);
				});
			});
		}
		else if(data.type == "video"){
			itemCount++;
			loader.loadVideo(data.src, data.src, data.src, "item"+itemCount.toString(), decodeURI(data.src.substring(data.src.lastIndexOf("/")+1)), function(newItem) {
				broadcast('addNewElement', newItem);

				items.push(newItem);
			});
		}
		else if(data.type == "youtube"){
			itemCount++;
			loader.loadYoutube(data.src, "item"+itemCount.toString(), function(newItem) {
				broadcast('addNewElement', newItem);

				items.push(newItem);
			});
		}
		else if(data.type == "pdf"){
			var filename = decodeURI(data.src.substring(data.src.lastIndexOf("/")+1));
			var url = path.join("uploads", "pdfs", filename);
			var localPath = path.join(public_https, url);
			var tmp = fs.createWriteStream(localPath);
			tmp.on('error', function(err) {
				if(err) throw err;
			});
			tmp.on('close', function() {
				itemCount++;
				loader.loadPdf(localPath, url, data.src, "item"+itemCount.toString(), path.basename(localPath), function(newItem) {
					broadcast('addNewElement', newItem);

					items.push(newItem);
				});
			});
			request({url: data.src, strictSSL: false}).pipe(tmp);
		}
		else if(data.type == "canvas" || data.type == "webgl" || data.type == "kineticjs" || data.type == "threejs"){
			console.log("remote app: " + data.src);
			
			itemCount++;
			var id = "item"+itemCount.toString();
			loader.loadRemoteApp(data.src, id, function(newItem, instructions) {
				// add resource scripts to clients
				for(var i=0; i<instructions.resources.length; i++){
					if(instructions.resources[i].type == "script"){
						broadcast('addScript', {source: data.src + "/" + instructions.resources[i].src});
					}
				}
	
				// add item to clients (after waiting 1 second to ensure resources have loaded)
				setTimeout(function() {
					broadcast('addNewElement', newItem);
					
					items.push(newItem);

					// set interval timer if specified
					if(instructions.animation == "timer"){
						setInterval(function() {
							var now = new Date();
							broadcast('animateCanvas', {elemId: id, type: instructions.type, date: now});
						}, instructions.interval);
					}
				}, 1000);
			});
		}
		else if(data.type == "screen"){
			var remote_id = "remote" + remote.remoteAddress.address + ":" + remote.remoteAddress.port + "|" + data.id;

			mediaStreams[remote_id] = {ready: true, clients: {}};
			for(var i=0; i<clients.length; i++){
				if(clients[i].clientType == "display"){
					var clientAddress = clients[i].remoteAddress.address + ":" + clients[i].remoteAddress.port;
					mediaStreams[remote_id].clients[clientAddress] = false;
				}
			}

			loader.loadRemoteScreen(data.src, remote_id, data.title, function(newItem) {
				console.log("REMOTE SCREEN");
				broadcast('addNewElement', newItem);

				items.push(newItem);
				itemCount++;
			});
		}
		else{
			console.log("unknown type: " + data.type);
		}
	});

	remote.on('requestNextRemoteFrame', function(data) {
		var stream = findItemById(data.id);
		var remote_id = "remote" + config.host + ":" + config.port + "|" + data.id;

		if(stream != null) remote.emit('updateRemoteMediaStreamFrame', {id: remote_id, src: stream.src});
		else remote.emit('stopMediaStream', {id: remote_id});
	});

	return remote;
}

/******** System Time - Updated Every Minute *********************************************/
var cDate = new Date();
setTimeout(function() {
	setInterval(function() {
		var now = new Date();
		broadcast('setSystemTime', {date: now}, "display");
	}, 60000);

	var now = new Date();
	broadcast('setSystemTime', {date: now}, "display");
}, (61-cDate.getSeconds())*1000);

/******** File Upload From SAGE UI / SAGE Pointer ****************************************/
function uploadFiles(files) {
    var fileKeys = Object.keys(files);
	fileKeys.forEach(function(key) {
		var file = files[key][0];
		var type = file.headers['content-type'];

		if(type == "image/jpeg" || type == "image/png"){
			console.log("uploaded image: " + file.originalFilename);
			var url = path.join("uploads", "images", file.originalFilename);
			var external_url = hostOrigin + encodeURI(url);
			var localPath = path.join(public_https, url);
			fs.rename(file.path, localPath, function(err) {
				if(err) throw err;

				fs.readFile(localPath, function (err, data) {
					if(err) throw err;

					itemCount++;
					loader.loadImage(data, external_url, "item"+itemCount.toString(), file.originalFilename, function(newItem) {
						broadcast('addNewElement', newItem);

						items.push(newItem);

						if(savedFiles["image"].indexOf(file.originalFilename) < 0) savedFiles["image"].push(file.originalFilename);
					});
				});
			});
		}
		else if(type == "video/mp4"){
			console.log("uploaded video: " + file.originalFilename);
			var url = path.join("uploads", "videos", file.originalFilename);
			var external_url = hostOrigin + encodeURI(url);
			var localPath = path.join(public_https, url);
			fs.rename(file.path, localPath, function(err) {
				if(err) throw err;

				itemCount++;
				loader.loadVideo(localPath, url, external_url, "item"+itemCount.toString(), file.originalFilename, function(newItem) {
					broadcast('addNewElement', newItem);

					items.push(newItem);

					if(savedFiles["video"].indexOf(file.originalFilename) < 0) savedFiles["video"].push(file.originalFilename);
				});
			});
		}
		else if(type == "application/pdf"){
			console.log("uploaded pdf: " + file.originalFilename);
			var url = path.join("uploads", "pdfs", file.originalFilename);
			var external_url = hostOrigin + encodeURI(url);
			var localPath = path.join(public_https, url);
			fs.rename(file.path, localPath, function(err) {
				if(err) throw err;

				itemCount++;
				loader.loadPdf(localPath, url, external_url, "item"+itemCount.toString(), path.basename(localPath), function(newItem) {
					broadcast('addNewElement', newItem);

					items.push(newItem);

					if(savedFiles["pdf"].indexOf(file.originalFilename) < 0) savedFiles["pdf"].push(file.originalFilename);
				});
			});
		}
		else if(type == "application/zip" || type == "application/x-zip-compressed" ){
			console.log("uploaded app: " + file.originalFilename);
			var ext = path.extname(file.originalFilename);
			var url = path.join("uploads", "apps", path.basename(file.originalFilename, ext));
			var external_url = hostOrigin + encodeURI(url);
			var localPath = path.join(public_https, url) + ext;
			fs.rename(file.path, localPath, function(err) {
				if(err) throw err;

				itemCount++;
				var id = "item"+itemCount.toString();
				loader.loadZipApp(localPath, url, external_url, id, function(newItem, instructions) {
					// add resource scripts to clients
					for(var i=0; i<instructions.resources.length; i++){
						if(instructions.resources[i].type == "script"){
							broadcast('addScript', {source: path.join(url, instructions.resources[i].src)});
						}
					}

					// add item to clients (after waiting 1 second to ensure resources have loaded)
					setTimeout(function() {
						broadcast('addNewElement', newItem);

						items.push(newItem);

						var appName = path.basename(file.originalFilename, ext);
						if(savedFiles["app"].indexOf(appName) < 0) savedFiles["app"].push(appName);

						// set interval timer if specified
						if(instructions.animation == "timer"){
							setInterval(function() {
								var now = new Date();
								broadcast('animateCanvas', {elemId: id, type: instructions.type, date: now});
							}, instructions.interval);
						}
					}, 1000);
				});
			});
		}
		else{
			console.log("uploaded unknown type: " + type)
		}
	});
}

/******** Omicron section ****************************************************************/
var net = require('net');
var util = require('util');
var dgram = require('dgram');

var udp = undefined;

var trackerIP = config.omicronServerIP;
var msgPort = config.omicronMsgPort;
var dataPort = config.omicronDataPort;

if( config.omicronServerIP )
{
	if( msgPort == undefined )
	{
		msgPort = 28000;
		console.log('Omicron: msgPort undefined. Using default: ', msgPort);
	}
	if( dataPort == undefined )
	{
		dataPort = 9123;
		console.log('Omicron: dataPort undefined. Using default: ', dataPort);
	}

	console.log('Connecting to Omicron server: ', trackerIP, msgPort);

	var client = net.connect(msgPort, trackerIP,  function()
	{ //'connect' listener
		console.log('Connected to Omicron server. Requesting data on port ', dataPort);

		var sendbuf = util.format("omicron_data_on,%d", dataPort);
		//console.log("Omicron> Sending handshake: ", sendbuf);
		client.write(sendbuf);

		udp = dgram.createSocket("udp4");
		var dstart = Date.now();
		var emit = 0;

		// array to hold all the button values (1 - down, 0 = up)
		var buttons = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
		var mouse   = [0, 0, 0];
		var mousexy = [0.0, 0.0];
		var colorpt = [0.0, 0.0, 0.0];
		var mousez  = 0;

		udp.on("message", function (msg, rinfo)
		{
			//console.log("UDP> got: " + msg + " from " + rinfo.address + ":" + rinfo.port);
			// var out = util.format("UDP> msg from [%s:%d] %d bytes", rinfo.address,rinfo.port,msg.length);
			// console.log(out);

			if ((Date.now() - dstart) > 100)
			{
				var offset = 0;
				var e = {};
				if (offset < msg.length) e.timestamp = msg.readUInt32LE(offset); offset += 4;
				if (offset < msg.length) e.sourceId = msg.readUInt32LE(offset); offset += 4;
				if (offset < msg.length) e.serviceId = msg.readInt32LE(offset); offset += 4;
				if (offset < msg.length) e.serviceType = msg.readUInt32LE(offset); offset += 4;
				if (offset < msg.length) e.type = msg.readUInt32LE(offset); offset += 4;
				if (offset < msg.length) e.flags = msg.readUInt32LE(offset); offset += 4;

				if (offset < msg.length) e.posx = msg.readFloatLE(offset); offset += 4;
				if (offset < msg.length) e.posy = msg.readFloatLE(offset); offset += 4;
				if (offset < msg.length) e.posz = msg.readFloatLE(offset); offset += 4;
				if (offset < msg.length) e.orw = msg.readFloatLE(offset); offset += 4;
				if (offset < msg.length) e.orx = msg.readFloatLE(offset); offset += 4;
				if (offset < msg.length) e.ory = msg.readFloatLE(offset); offset += 4;
				if (offset < msg.length) e.orz = msg.readFloatLE(offset); offset += 4;
				if (offset < msg.length) e.extraDataType = msg.readUInt32LE(offset); offset += 4;
				if (offset < msg.length) e.extraDataItems = msg.readUInt32LE(offset); offset += 4;
				if (offset < msg.length) e.extraDataMask = msg.readUInt32LE(offset); offset += 4;

				// Extra data types:
				//    0 ExtraDataNull,
				//    1 ExtraDataFloatArray,
				//    2 ExtraDataIntArray,
				//    3 ExtraDataVector3Array,
				//    4 ExtraDataString,
				//    5 ExtraDataKinectSpeech

				var r_roll  = Math.asin(2.0*e.orx*e.ory + 2.0*e.orz*e.orw);
				var r_yaw   = Math.atan2(2.0*e.ory*e.orw-2.0*e.orx*e.orz , 1.0 - 2.0*e.ory*e.ory - 2.0*e.orz*e.orz);
				var r_pitch = Math.atan2(2.0*e.orx*e.orw-2.0*e.ory*e.orz , 1.0 - 2.0*e.orx*e.orx - 2.0*e.orz*e.orz);

				var posX = e.posx * config.totalWidth;
				var posY = e.posy*config.totalHeight;
				var sourceID = e.sourceId;

				// serviceID: 0 = touch, 1 = SAGEPointer (note this depends on the order the services are specified on the server)
				var serviceID = e.serviceId;

				var touchWidth = 0;
				var touchHeight = 0;
				if( serviceID == 0 &&  e.extraDataItems >= 2)
				{
					touchWidth = msg.readFloatLE(offset); offset += 4;
					touchHeight = msg.readFloatLE(offset); offset += 4;
					//console.log("Touch size: " + touchWidth + "," + touchHeight);
				}

				// Appending sourceID to pointer address ID
				var address = trackerIP+":"+sourceID;

				// ServiceTypePointer //////////////////////////////////////////////////
				if (e.serviceType == 0)
				{
					//console.log("pointer ID "+ sourceID +" event! type: " + e.type  );
					//console.log("pointer event! type: " + e.type  );
					//console.log("ServiceTypePointer> source ", e.sourceId);
					//console.log("ServiceTypePointer> serviceID ", e.serviceId);

					// TouchGestureManager Flags:
					// 1 << 17 = User flag start (as of 12/20/13)
					// User << 1 = Unprocessed
					// User << 2 = Single touch
					// User << 3 = Big touch
					// User << 4 = 5-finger hold
					// User << 5 = 5-finger swipe
					// User << 6 = 3-finger hold
					var User = 1 << 17;

					var FLAG_SINGLE_TOUCH = User << 2;
					var FLAG_BIG_TOUCH = User << 3;
					var FLAG_FIVE_FINGER_HOLD = User << 4;
					var FLAG_FIVE_FINGER_SWIPE = User << 5;
					var FLAG_THREE_FINGER_HOLD = User << 6;
					var FLAG_SINGLE_CLICK = User << 7;
					var FLAG_DOUBLE_CLICK = User << 8;

					//console.log( e.flags );
					if (e.type == 3)
					{ // update (Used only by classic SAGE pointer)
						/* if( e.sourceId in ptrs )
							 return;
						colorpt = [Math.floor(e.posx*255.0), Math.floor(e.posy*255.0), Math.floor(e.posz*255.0)];
						if (offset < msg.length)
						{
							if (e.extraDataType == 4 && e.extraDataItems > 0)
							{
								console.log("create touch pointer");
								e.extraString = msg.toString("utf-8", offset, offset+e.extraDataItems);
								ptrinfo = e.extraString.split(" ");
								offset += e.extraDataItems;
								ptrs[e.sourceId] = {id:e.sourceId, label:ptrinfo[0], ip:ptrinfo[1], mouse:[0,0,0], color:colorpt, zoom:0, position:[0,0], mode:0};
								sio.sockets.emit('createPointer', {type: 'ptr', id: e.sourceId, label: ptrinfo[0], color: colorpt, zoom:0, position:[0,0], src: "resources/mouse-pointer-hi.png" });
							}
						}*/
					}
					else if (e.type == 4)
					{ // move
						if( e.flags == FLAG_SINGLE_TOUCH )
						{
							pointerPosition( address, { pointerX: posX, pointerY: posY } );

						}
					}
					else if (e.type == 15)
					{ // zoom
						console.log("Touch zoom");

						/*
						Omicron zoom event extra data:
						0 = touchWidth (parsed above)
						1 = touchHeight (parsed above)
						2  = zoom delta
						3 = event second type ( 1 = Down, 2 = Move, 3 = Up )
						*/
						// extraDataType 1 = float
						if (e.extraDataType == 1 && e.extraDataItems >= 4)
						{

							var zoomDelta = msg.readFloatLE(offset); offset += 4;
							var eventType = msg.readFloatLE(offset);  offset += 4;
							console.log( zoomDelta );

							if( eventType == 1 ) // Zoom start/down
							{
								pointerScrollStart( address, posX, posY );
							}
							else // Zoom move
							{
								pointerScroll( address, { scale: 1+zoomDelta } );
							}
						}

					}
					else if (e.type == 5) { // button down
						//console.log("\t down , flags ", e.flags);

						if( e.flags == FLAG_SINGLE_TOUCH )
						{
							console.log("starting pointer: " + address)
							// Create pointer
							if(address in sagePointers){
								showPointer( address, { label:  "Touch: " + sourceID, color: "rgba(255, 255, 255, 1.0)" } );
							}else{
								createSagePointer(address);

								showPointer( address, { label:  "Touch: " + sourceID, color: "rgba(255, 255, 255, 1.0)" } );

								pointerPress( address, posX, posY );
							}
						}
						else if( e.flags == FLAG_FIVE_FINGER_HOLD )
						{
							console.log("Touch gesture: Five finger hold");

							var elem = findItemUnderPointer(posX, posY);

							// Remove element
							if( elem != null )
							{
								deleteElement( elem );
							}
						}
						else if( e.flags == FLAG_THREE_FINGER_HOLD )
						{
							console.log("Touch gesture: Three finger hold");
						}
						else if( e.flags == FLAG_SINGLE_CLICK )
						{
							console.log("Touch gesture: Click");
						}
						else if( e.flags == FLAG_DOUBLE_CLICK )
						{
							console.log("Touch gesture: Double Click");
						}
					}
					else if (e.type == 6)
					{ // button up
						if( e.flags == FLAG_SINGLE_TOUCH )
						{
							// Hide pointer
							hidePointer(address);

							// Release event
							pointerRelease(address, posX, posY);

							console.log("Touch release");
						}
					}
					else
					{
					console.log("\t UNKNOWN event type ", e.type);
					}

					if (emit>2) { dstart = Date.now(); emit = 0; }
				}// ServiceTypePointer ends ///////////////////////////////////////////
			}
		});

		udp.on("listening", function () {
			var address = udp.address();
			console.log("UDP> listening " + address.address + ":" + address.port);
		});

		udp.bind(dataPort)

	});
}
/***************************************************************************************/

// Start the https server
index.listen(config.index_port);
server.listen(config.port);

console.log('Now serving the app at https://localhost:' + config.port);



/***************************************************************************************/

function broadcast(func, data, type) {
	for(var i=0; i<clients.length; i++){
		if(type == null || type == clients[i].clientType) clients[i].emit(func, data);
	}
}

function findItemUnderPointer(pointerX, pointerY) {
	for(var i=items.length-1; i>=0; i--){
		if(pointerX >= items[i].left && pointerX <= (items[i].left+items[i].width) && pointerY >= items[i].top && pointerY <= (items[i].top+items[i].height+config.titleBarHeight)){
			return items[i];
		}
	}
	return null;
}

function findItemById(id) {
	for(var i=0; i<items.length; i++){
		if(items[i].id == id) return items[i];
	}
	return null;
}

function moveItemToFront(id) {
	var selectedIndex;
	var selectedItem;
	var itemIds = [];

	for(var i=0; i<items.length; i++){
		if(items[i].id == id){
			selectedIndex = i;
			selectedItem = items[selectedIndex];
			break;
		}
		itemIds.push(items[i].id);
	}
	for(var i=selectedIndex; i<items.length-1; i++){
		items[i] = items[i+1];
		itemIds.push(items[i].id);
	}
	items[items.length-1] = selectedItem;
	itemIds.push(id);

	return itemIds;
}

function allTrueDict(dict) {
	for(key in dict){
		if(dict[key] == false) return false;
	}
	return true;
}

function removeElement(list, elem) {
	if(list.indexOf(elem) >= 0){
		moveElementToEnd(list, elem);
		list.pop();
	}
}

function moveElementToEnd(list, elem) {
	var pos = list.indexOf(elem);
	for(var i=pos; i<list.length-1; i++){
		list[i] = list[i+1];
	}
	list[list.length-1] = elem;
}

/**** Pointer Functions ********************************************************************/

function createSagePointer( address ) {
	// From addClient type == sageUI
	sagePointers[address] = new sagepointer(address+"_pointer");
	remoteInteraction[address] = new interaction();

	broadcast('createSagePointer', sagePointers[address], "display");
}

function showPointer( address, data ) {
	if( sagePointers[address] == undefined )
		return;
	// From startSagePointer
	console.log("starting pointer: " + address);

	sagePointers[address].start(data.label, data.color);
	broadcast('showSagePointer', sagePointers[address], "display");
}

function hidePointer( address ) {
	if( sagePointers[address] == undefined )
		return;

	// From stopSagePointer
	sagePointers[address].stop();
	broadcast('hideSagePointer', sagePointers[address], "display");
}

function pointerPress( address, pointerX, pointerY ) {
	if( sagePointers[address] == undefined ) return;

	var elem = findItemUnderPointer(pointerX, pointerY);
		if(elem != null){
			if( remoteInteraction[address].windowManagementMode() ){
				var localX = pointerX - elem.left;
				var localY = pointerY - (elem.top+config.titleBarHeight);
				var cornerSize = Math.min(elem.width, elem.height) / 5;
				// bottom right corner - select for drag resize
				if(localX >= elem.width-cornerSize && localY >= elem.height-cornerSize){
					remoteInteraction[address].selectResizeItem(elem, pointerX, pointerY);
				}
				// otherwise - select for move
				else{
					remoteInteraction[address].selectMoveItem(elem, pointerX, pointerY); //will only go through if window management mode
				}
			}
			else if ( remoteInteraction[address].appInteractionMode() ) {
				var itemRelX = pointerX - elem.left;
				var itemRelY = pointerY - elem.top - config.titleBarHeight;
				var now = new Date();
				broadcast( 'eventInItem', { eventType: "pointerPress", elemId: elem.id, user_id: sagePointers[address].id, user_label: sagePointers[address].label, user_color: sagePointers[address].color, itemRelativeX: itemRelX, itemRelativeY: itemRelY, data: {button: "left"}, date: now }, "display");
            			broadcast( 'eventInItem', { eventType: "pointerPress", elemId: elem.id, user_id: sagePointers[address].id, user_label: sagePointers[address].label, user_color: sagePointers[address].color, itemRelativeX: itemRelX, itemRelativeY: itemRelY, data: {button: "left"}, date: now }, "app");
                // Send the pointer press to node-modules
                // Send it to the webBrowser
				if (webBrowser != null)
	                webBrowser.click(elem.id, itemRelX, itemRelY);
			}

			var newOrder = moveItemToFront(elem.id);
			broadcast('updateItemOrder', {idList: newOrder});
		}

		// removed pointer press in open space to change modes - also triggered when using sageUI
		// use shift+tab to switch modes when in sagePointer
		/*
		else { //if no item, change pointer mode
		    remoteInteraction[address].toggleModes();
		    broadcast('changeSagePointerMode', {id: sagePointers[address].id, mode: remoteInteraction[address].interactionMode } , 'display' );
		}
		*/
}

// Copied from pointerPress. Eventually a touch gesture will use this to toggle modes
function togglePointerMode(address) {
	if( sagePointers[address] == undefined )
		return;

	remoteInteraction[address].toggleModes();
	broadcast('changeSagePointerMode', {id: sagePointers[address].id, mode: remoteInteraction[address].interactionMode } , 'display' );
}

function pointerRelease(address, pointerX, pointerY) {
	if( sagePointers[address] == undefined )
		return;

	// From pointerRelease
	if( remoteInteraction[address].windowManagementMode() ){
		if(remoteInteraction[address].selectedResizeItem != null){
			broadcast('finishedResize', {id: remoteInteraction[address].selectedResizeItem.id}, "display");
			remoteInteraction[address].releaseItem(true);
			if (webBrowser != null)
	            webBrowser.resize(elem.elemId, Math.round(elem.elemWidth), Math.round(elem.elemHeight));
		}
		if(remoteInteraction[address].selectedMoveItem != null){
			var remoteIdx = -1;
			for(var i=0; i<remoteSites.length; i++){
				if(sagePointers[address].left >= remoteSites[i].pos && sagePointers[address].left <= remoteSites[i].pos+remoteSites[i].width &&
				   sagePointers[address].top >= 2 && sagePointers[address].top <= remoteSites[i].height){
					remoteIdx = i;
					break;
				}
			}
			if(remoteIdx < 0){
				remoteInteraction[address].releaseItem(true);
			}
			else{
				var source = remoteInteraction[address].selectedMoveItem.url;
				if(source == null) source = remoteInteraction[address].selectedMoveItem.src;
				if(source != null){
					console.log("Transfering to " + remoteSites[remoteIdx].name + ": " + remoteInteraction[address].selectedMoveItem.title);
					remoteSites[remoteIdx].wsio.emit('addNewElementFromRemoteServer', {type: remoteInteraction[address].selectedMoveItem.type, id: remoteInteraction[address].selectedMoveItem.id, src: source, title: remoteInteraction[address].selectedMoveItem.title});
				}
				var updatedItem = remoteInteraction[address].releaseItem(false);
				if(updatedItem != null) broadcast('setItemPosition', updatedItem);
			}
		}
	}
	else if ( remoteInteraction[address].appInteractionMode() ) {
		var elem = findItemUnderPointer(pointerX, pointerY);

		if( elem != null ){
			var itemRelX = pointerX - elem.left;
			var itemRelY = pointerY - elem.top - config.titleBarHeight;
			var now = new Date();
			broadcast( 'eventInItem', { eventType: "pointerRelease", elemId: elem.id, user_id: sagePointers[address].id, user_label: sagePointers[address].label, user_color: sagePointers[address].color, itemRelativeX: itemRelX, itemRelativeY: itemRelY, data: {button: "left"}, date: now }, "display");
		}
	}
}

function pointerPosition( address, data ) {
	if( sagePointers[address] == undefined )
		return;

	sagePointers[address].left = data.pointerX;
	sagePointers[address].top = data.pointerY;
	if(sagePointers[address].left < 0) sagePointers[address].left = 0;
	if(sagePointers[address].left > config.totalWidth) sagePointers[address].left = config.totalWidth;
	if(sagePointers[address].top < 0) sagePointers[address].top = 0;
	if(sagePointers[address].top > config.totalHeight) sagePointers[address].top = config.totalHeight;

	broadcast('updateSagePointerPosition', sagePointers[address], "display");

	var updatedItem = remoteInteraction[address].moveSelectedItem(sagePointers[address].left, sagePointers[address].top);
	if(updatedItem != null) broadcast('setItemPosition', updatedItem);
}

function pointerScrollStart( address, pointerX, pointerY ) {
	if( sagePointers[address] == undefined )
		return;

	var elem = findItemUnderPointer(pointerX, pointerY);

	if(elem != null){
		remoteInteraction[address].selectScrollItem(elem, pointerX, pointerY);
		var newOrder = moveItemToFront(elem.id);
		broadcast('updateItemOrder', newOrder);
	}
}


function pointerScroll( address, data ) {
	if( sagePointers[address] == undefined )
		return;

	var updatedItem = remoteInteraction[address].scrollSelectedItem(data.scale);
	if(updatedItem != null){
		broadcast('setItemPositionAndSize', updatedItem);

		if(updatedItem.elemId in remoteInteraction[address].selectTimeId){
			clearTimeout(remoteInteraction[address].selectTimeId[updatedItem.elemId]);
		}

		remoteInteraction[address].selectTimeId[updatedItem.elemId] = setTimeout(function() {
			broadcast('finishedResize', {id: updatedItem.elemId}, "display");
			remoteInteraction[address].selectedScrollItem = null;
			if (webBrowser != null)
			    webBrowser.resize(updatedItem.elemId, Math.round(updatedItem.elemWidth), Math.round(updatedItem.elemHeight));
}, 500);
	}
}

function deleteElement( elem ) {
    if(elem.type == "webpage") {
		if (webBrowser != null)
	        webBrowser.removeWindow(elem.id);
    }

	broadcast('deleteElement', {elemId: elem.id});
	if(elem.type == "screen"){
		var broadcastWS = null;
		for(i=0; i<clients.length; i++){
			var clientAddress = clients[i].remoteAddress.address + ":" + clients[i].remoteAddress.port;
			if(clientAddress == elem.id) broadcastWS = clients[i];
		}

		if(broadcastWS != null) broadcastWS.emit('stopMediaCapture');
	}
	removeElement(items, elem);
}
