var crypto = require('crypto');
var fs = require('fs');
var gm = require('gm');
var https = require('https');
var imageinfo = require('imageinfo');
var multiparty = require('multiparty');
var os = require('os');
var path = require('path');
var request = require('request');

var httpserver = require('node-httpserver');           // custom node module
var websocketIO = require('node-websocket.io');        // custom node module
var loader = require('node-itemloader');               // custom node module
var interaction = require('node-interaction');         // custom node module
var sagepointer = require('node-sagepointer');         // custom node module
 

// CONFIG FILE
var wallfile = null;
var wallfile = "config/tmarrinan-cfg.json";
//var wallfile = "config/desktop-cfg.json";
//var wallfile = "config/desktop-omicron-cfg.json";
//var wallfile = "config/icewall-cfg.json";
//var wallfile = "config/icewallKB-cfg.json";
//var wallfile = "config/icewallJA-cfg.json";
//var wallfile = "config/icewallTM-cfg.json";
//var wallfile = "config/icewallAN-cfg.json";
//var wallfile = "config/icewallRight-omicron-cfg.json";
//var wallfile = "config/iridium-cfg.json";
//var wallfile = "config/lyra-cfg.json";

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


var json_str = fs.readFileSync(wallfile, 'utf8');
var config = JSON.parse(json_str);
config.totalWidth = config.resolution.width * config.layout.columns;
config.totalHeight = config.resolution.height * config.layout.rows;
config.titleBarHeight = Math.round(0.025 * config.totalHeight);
config.titleTextSize = Math.round(0.015 * config.totalHeight);
config.pointerWidth = Math.round(0.20 * config.totalHeight);
config.pointerHeight = Math.round(0.05 * config.totalHeight);
console.log(config);

var hostOrigin = "https://"+config.host+":"+config.port.toString()+"/";
var uploadsFolder = path.join(__dirname, "uploads");

var savedFiles = {"image": [], "video": [], "pdf": [], "app": []};
var uploadedImages = fs.readdirSync(path.join(uploadsFolder, "images"));
var uploadedVideos = fs.readdirSync(path.join(uploadsFolder, "videos"));
var uploadedPdfs = fs.readdirSync(path.join(uploadsFolder, "pdfs"));
var uploadedApps = fs.readdirSync(path.join(uploadsFolder, "apps"));
for(var i=0; i<uploadedImages.length; i++) savedFiles["image"].push(uploadedImages[i]);
for(var i=0; i<uploadedVideos.length; i++) savedFiles["video"].push(uploadedVideos[i]);
for(var i=0; i<uploadedPdfs.length; i++) savedFiles["pdf"].push(uploadedPdfs[i]);
for(var i=0; i<uploadedApps.length; i++) savedFiles["app"].push(uploadedApps[i]);

// background not a color
if(config.background.substring(0, 1) != "#" || config.background.length != 7){
	// divide background image if necessary
	var bg_info = imageinfo(fs.readFileSync(config.background));
	if(bg_info.width == config.totalWidth && bg_info.height == config.totalHeight){
		for(var i=0; i<config.displays.length; i++){
			var x = config.displays[i].column * config.resolution.width;
			var y = config.displays[i].row * config.resolution.height;
			var output_dir = path.dirname(config.background);
			var output_ext = path.extname(config.background);
			var output_base = path.basename(config.background, output_ext); 
			var output = path.join(output_dir, output_base + "_"+i.toString() + output_ext);
			console.log(output);
			gm(config.background).crop(config.resolution.width, config.resolution.height, x, y).write(output, function (err) {
				if(err) throw err;
			});
		}
	}
	else{
		console.log("Warning: could not use background image - not correct resolution");
		console.log("Image:   " + bg_info.width + "x" + bg_info.height);
		console.log("Display: " + config.totalWidth + "x" + config.totalHeight);
	}
}


// build a list of certs to support multi-homed computers
var certs = {};
// add the default cert from the hostname specified in the config file
certs[ config.host ] = crypto.createCredentials({ 
	key: fs.readFileSync(path.join("keys",  config.host + "-server.key")),
	cert: fs.readFileSync(path.join("keys", config.host + "-server.crt")),
	ca: fs.readFileSync(path.join("keys",   config.host + "-ca.crt")),
   }).context;

for(var h in config.alternate_hosts){
	var alth = config.alternate_hosts[ h ];
	certs[ alth ] = crypto.createCredentials({ 
		key: fs.readFileSync(path.join("keys",  alth + "-server.key")),
		cert: fs.readFileSync(path.join("keys", alth + "-server.crt")),
		ca: fs.readFileSync(path.join("keys",   alth + "-ca.crt")),
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
    } else {
		console.log("Unknown host, cannot find a certificate for ", servername);
        return null;
    }
  }
};

var privateFiles = ["./server.js", "./package.json", "./README.md", "./keys/", "./config"];
var httpServerApp = new httpserver(privateFiles);
httpServerApp.post('/upload', function(req, res) {
	var form = new multiparty.Form();
	form.parse(req, function(err, fields, files) {
		if(err){
			res.writeHead(500, {"Content-Type": "text/plain"});
			res.write(err + "\n\n");
			res.end();
		}
		
		uploadFiles(files);

		res.writeHead(200, {"Content-Type": "text/plain"});
		res.write("received upload:\n\n");
		res.end();
	});
});

var server = https.createServer(options, httpServerApp.onrequest);
var wsioServer = new websocketIO.Server(config.port+1);

var itemCount = 0;
var items = [];

var clients = [];
var sagePointers = {};
var remoteInteraction = {};
var mediaStreams = {};

wsioServer.onconnection(function(wsio) {
	var address = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port;
	console.log(address);
	
	wsio.emit('setupDisplayConfiguration', config);
	wsio.emit('initialize', {address: address});
	
	wsio.onclose(function() {
		if(wsio.clientType == "remoteServer"){
			var remoteIdx = -1;
			for(var i=0; i<config.remote_sites.length; i++){
				if(wsio.remoteAddress.address == config.remote_sites[i].host) remoteIdx = i;
			}
			if(remoteIdx >= 0){
				console.log("Remote site \"" + config.remote_sites[remoteIdx].name + "\" now offline");
				remoteSites[remoteIdx].connected = false;
				var site = {name: remoteSites[remoteIdx].name, connected: remoteSites[remoteIdx].connected};
				broadcast('connectedToRemoteSite', site, "display");
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
		}
		else if(wsio.clientType == "remoteServer"){
			var remoteIdx = -1;
			wsio.remoteAddress.address = data.host;
			address = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port;
			for(var i=0; i<config.remote_sites.length; i++){
				if(wsio.remoteAddress.address == config.remote_sites[i].host) remoteIdx = i;
			}
			
			// add remote server websocket to array
			if(remoteIdx >= 0){
				remoteSites[remoteIdx].wsio = wsio;
				remoteSites[remoteIdx].connected = true;
				var site = {name: remoteSites[remoteIdx].name, connected: remoteSites[remoteIdx].connected};
				broadcast('connectedToRemoteSite', site, "display");
			}
			/* && remoteSites[remoteIdx].wsio.ws.readyState != 1){
				var wsURL = "ws://" + data.host + ":" + (data.port+1).toString();
				console.log(wsURL);
				var remote = new websocketIO(wsURL, function() {
					console.log("connected to " + remoteSites[remoteIdx].name);
					remote.emit('addClient', {clientType: "remoteServer", host: config.host, port: config.port});
					remoteSites[remoteIdx].connected = true;
					var site = {name: remoteSites[remoteIdx].name, connected: remoteSites[remoteIdx].connected};
					broadcast('connectedToRemoteSite', site, "display");
				});
			}*/
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
				}
			} else {
				// already maximized, need to restore the item size
				var updatedItem = remoteInteraction[address].restoreSelectedItem(elem);
				if (updatedItem != null) {
					broadcast('setItemPositionAndSize', updatedItem);
					// the PDF files need an extra redraw
					broadcast('finishedResize', {id: elem.id}, "display");
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
					}
			}  
		}
	});
	
	wsio.on('keyPress', function(data) {
		if(data.code == 9 && remoteInteraction[address].SHIFT && sagePointers[address].visible){ // shift + tab
			remoteInteraction[address].toggleModes();
			broadcast('changeSagePointerMode', {id: sagePointers[address].id, mode: remoteInteraction[address].interactionMode}, "display");
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
		mediaStreams[data.id] = {};
		for(var i=0; i<clients.length; i++){
			if(clients[i].clientType == "display"){
				var clientAddress = clients[i].remoteAddress.address + ":" + clients[i].remoteAddress.port;
				mediaStreams[data.id][clientAddress] = false;
			}
		}
		
		loader.loadScreenCapture(data.src, data.id, data.title, data.width, data.height, function(newItem) {
			broadcast('addNewElement', newItem);
			
			items.push(newItem);
			itemCount++;
		});
	});
	
	wsio.on('updateMediaStreamFrame', function(data) {
		for(var key in mediaStreams[data.id]){
			mediaStreams[data.id][key] = false;
		}
		
		broadcast('updateMediaStreamFrame', data, "display");
	});
	
	wsio.on('receivedMediaStreamFrame', function(data) {
		mediaStreams[data.id][address] = true;
		
		if(allTrueDict(mediaStreams[data.id])){
			var broadcastWS = null;
			for(i=0; i<clients.length; i++){
				var clientAddress = clients[i].remoteAddress.address + ":" + clients[i].remoteAddress.port;
				if(clientAddress == data.id) broadcastWS = clients[i];
			}
			
			if(broadcastWS != null) broadcastWS.emit('requestNextFrame', null);
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
			loader.loadVideo(data.src, data.src, "item"+itemCount.toString(), decodeURI(data.src.substring(data.src.lastIndexOf("/")+1)), function(newItem) {
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
			var localPath = path.join("uploads", "pdfs", filename);
			var tmp = fs.createWriteStream(localPath);
			tmp.on('error', function(err) {
				if(err) throw err;
			});
			tmp.on('close', function() {
				itemCount++;
				loader.loadPdf(localPath, data.src, "item"+itemCount.toString(), path.basename(localPath), function(newItem) {
					broadcast('addNewElement', newItem);
		
					items.push(newItem);
				});
			});
			request({url: data.src, strictSSL: false}).pipe(tmp);
		}
	});
	
	wsio.on('addNewElementFromStoredFiles', function(file) {
		var localPath = path.join("uploads", file.dir, file.name);
		var url = hostOrigin + encodeURI(localPath);
		
		if(file.dir == "images"){
			fs.readFile(localPath, function (err, data) {
				if(err) throw err;
				
				itemCount++;
				loader.loadImage(data, url, "item"+itemCount.toString(), path.basename(localPath), function(newItem) {
					broadcast('addNewElement', newItem);
			
					items.push(newItem);
				});
			});
		}
		else if(file.dir == "videos"){
			itemCount++;
			loader.loadVideo(localPath, url, "item"+itemCount.toString(), path.basename(localPath), function(newItem) {
				broadcast('addNewElement', newItem);
		
				items.push(newItem);
			});
		}
		else if(file.dir == "pdfs"){
			itemCount++;
			loader.loadPdf(localPath, url, "item"+itemCount.toString(), path.basename(localPath), function(newItem) {
				broadcast('addNewElement', newItem);
		
				items.push(newItem);
			});
		}
		else if(file.dir == "apps"){
			itemCount++;
			var id = "item"+itemCount.toString();
			loader.loadApp(localPath, id, function(newItem, instructions) {
				// add resource scripts to clients
				for(var i=0; i<instructions.resources.length; i++){
					if(instructions.resources[i].type == "script"){
						broadcast('addScript', {source: path.join(localPath, instructions.resources[i].src)});
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
		console.log("received element from server: " + data.src);
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
			loader.loadVideo(data.src, data.src, "item"+itemCount.toString(), decodeURI(data.src.substring(data.src.lastIndexOf("/")+1)), function(newItem) {
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
			var localPath = path.join("uploads", "pdfs", filename);
			var tmp = fs.createWriteStream(localPath);
			tmp.on('error', function(err) {
				if(err) throw err;
			});
			tmp.on('close', function() {
				itemCount++;
				loader.loadPdf(localPath, data.src, "item"+itemCount.toString(), path.basename(localPath), function(newItem) {
					broadcast('addNewElement', newItem);
		
					items.push(newItem);
				});
			});
			request({url: data.src, strictSSL: false}).pipe(tmp);
		}
	});
});

/******** Remote Site Collaboration ******************************************************/
var remoteSites = new Array(config.remote_sites.length);
config.remote_sites.forEach(function(element, index, array) {
	var wsURL = "ws://" + element.host + ":" + (element.port+1).toString();
	var remote = new websocketIO(wsURL, function() {
		console.log("connected to " + element.name);
		remote.emit('addClient', {clientType: "remoteServer", host: config.host, port: config.port});
		remoteSites[index].connected = true;
	});
	
	remote.clientType = "remoteServer";
	
	remote.onclose(function() {
		console.log("Remote site \"" + config.remote_sites[index].name + "\" now offline");
		remoteSites[index].connected = false;
		var site = {name: remoteSites[index].name, connected: remoteSites[index].connected};
		broadcast('connectedToRemoteSite', site, "display");
	});
	
	remote.on('addNewElementFromRemoteServer', function(data) {
		console.log("received element from server: " + data.src);
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
			loader.loadVideo(data.src, data.src, "item"+itemCount.toString(), decodeURI(data.src.substring(data.src.lastIndexOf("/")+1)), function(newItem) {
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
			var localPath = path.join("uploads", "pdfs", filename);
			var tmp = fs.createWriteStream(localPath);
			tmp.on('error', function(err) {
				if(err) throw err;
			});
			tmp.on('close', function() {
				itemCount++;
				loader.loadPdf(localPath, data.src, "item"+itemCount.toString(), path.basename(localPath), function(newItem) {
					broadcast('addNewElement', newItem);
		
					items.push(newItem);
				});
			});
			request({url: data.src, strictSSL: false}).pipe(tmp);
		}
	});
	
	var rWidth = Math.min((0.5*config.totalWidth)/remoteSites.length, config.titleBarHeight*6) - 2;
	var rHeight = config.titleBarHeight - 4;
	var rPos = (0.5*config.totalWidth) + ((rWidth+2)*(index-(remoteSites.length/2))) + 1;
	remoteSites[index] = {name: element.name, wsio: remote, connected: false, width: rWidth, height: rHeight, pos: rPos};
});

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
		var uploadsDir = path.join(__dirname, "uploads");
		
		if(type == "image/jpeg" || type == "image/png"){
			console.log("uploaded image: " + file.originalFilename);
			var localPath = path.join("uploads", "images", file.originalFilename);
			var url = hostOrigin + encodeURI(localPath);
			fs.rename(file.path, localPath, function(err) {
				if(err) throw err;
				
				fs.readFile(localPath, function (err, data) {
					if(err) throw err;
					
					itemCount++;
					loader.loadImage(data, url, "item"+itemCount.toString(), file.originalFilename, function(newItem) {
						broadcast('addNewElement', newItem);
				
						items.push(newItem);
				
						if(savedFiles["image"].indexOf(file.originalFilename) < 0) savedFiles["image"].push(file.originalFilename);
					});
				});
			});
		}
		else if(type == "video/mp4"){
			console.log("uploaded video: " + file.originalFilename);
			var localPath = path.join("uploads", "videos", file.originalFilename);
			var url = hostOrigin + encodeURI(localPath);
			fs.rename(file.path, localPath, function(err) {
				if(err) throw err;
				
				itemCount++;
				loader.loadVideo(localPath, url, "item"+itemCount.toString(), file.originalFilename, function(newItem) {
					broadcast('addNewElement', newItem);
			
					items.push(newItem);
					
					if(savedFiles["video"].indexOf(file.originalFilename) < 0) savedFiles["video"].push(file.originalFilename);
				});
			});
		}
		else if(type == "application/pdf"){
			console.log("uploaded pdf: " + file.originalFilename);
			var localPath = path.join("uploads", "pdfs", file.originalFilename);
			var url = hostOrigin + encodeURI(localPath);
			fs.rename(file.path, localPath, function(err) {
				if(err) throw err;
				
				itemCount++;
				loader.loadPdf(localPath, url, "item"+itemCount.toString(), path.basename(localPath), function(newItem) {
					broadcast('addNewElement', newItem);
		
					items.push(newItem);
					
					if(savedFiles["pdf"].indexOf(file.originalFilename) < 0) savedFiles["pdf"].push(file.originalFilename);
				});
			});
		}
		else if(type == "application/zip" || type == "application/x-zip-compressed" ){
			console.log("uploaded app: " + file.originalFilename);
			var localPath = path.join("uploads", "apps", file.originalFilename);
			fs.rename(file.path, localPath, function(err) {
				if(err) throw err;
				
				itemCount++;
				var id = "item"+itemCount.toString();
				loader.loadZipApp(localPath, id, function(newItem, instructions) {
					// add resource scripts to clients
					for(var i=0; i<instructions.resources.length; i++){
						if(instructions.resources[i].type == "script"){
							broadcast('addScript', {source: path.join(localPath, instructions.resources[i].src)});
						}
					}
	
					// add item to clients (after waiting 1 second to ensure resources have loaded)
					setTimeout(function() {
						broadcast('addNewElement', newItem);
					
						items.push(newItem);
						
						if(savedFiles["app"].indexOf(file.originalFilename) < 0) savedFiles["app"].push(file.originalFilename);

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

udp = undefined;
	
trackerIP = config.omicronServerIP;
msgPort = config.omicronMsgPort;
dataPort = config.omicronDataPort;
	
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
	sagePointers[address].stop;
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
				if(source != null){
					console.log("Transfering to " + remoteSites[remoteIdx].name + ": " + source);
					remoteSites[remoteIdx].wsio.emit('addNewElementFromRemoteServer', {type: remoteInteraction[address].selectedMoveItem.type, src: source});
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
		}, 500);
	}
}

function deleteElement( elem ) {
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
