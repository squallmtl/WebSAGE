var express = require('express');
var fs = require('fs');
var https = require('https');
var path = require('path');
var request = require('request');

var websocketIOServer = require('node-websocket.io'); // custom node module
var loader = require('node-itemloader'); // custom node module
var interaction = require('node-interaction'); // custom node module
var sagepointer = require('node-sagepointer'); // custom node module
 
 
// CONFIG FILE
//var file = "config/desktop-cfg.json";
//var file = "config/thor-cfg.json";
var file = "config/iridium-cfg.json";
//var file = "config/lyraX-cfg.json";
//var file = "config/spidey-cfg.json";

var json_str = fs.readFileSync(file, 'utf8');
var config = JSON.parse(json_str);
config.totalWidth = config.resolution.width * config.layout.columns;
config.totalHeight = config.resolution.height * config.layout.rows;
config.titleBarHeight = Math.round(0.025 * config.totalHeight);
config.titleTextSize = Math.round(0.015 * config.totalHeight);
config.pointerWidth = Math.round(0.20 * config.totalHeight);
config.pointerHeight = Math.round(0.05 * config.totalHeight);
console.log(config);

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

var app = express();

app.configure(function(){
	app.use(express.methodOverride());
	app.use(express.bodyParser({uploadDir: uploadsFolder, limit: '250mb'}));
	app.use(express.multipart());
	app.use(express.static(__dirname + path.sep));
	app.use(app.router);
});

var options = {
  key: fs.readFileSync(path.join("keys", "server.key")),
  cert: fs.readFileSync(path.join("keys", "server.crt")),
  ca: fs.readFileSync(path.join("keys", "ca.crt")),
  requestCert: true,
  rejectUnauthorized: false
};

var server = https.createServer(options, app);
var wsioServer = new websocketIOServer(config.port+1);

var itemCount = 0;
var items = [];

var clients = [];
var sagePointers = {};
var remoteInteraction = {};
var mediaStreams = {};

wsioServer.onconnection(function(wsio) {
	var address = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port;
	console.log("New Connection: " + address);
	
	wsio.emit('setupDisplayConfiguration', config);
	wsio.emit('initialize', {address: address});
	
	wsio.onclose(function() {
		removeElement(clients, wsio);
	});
	
	wsio.on('addClient', function(data) {
		wsio.clientType = data.clientType;
		if(wsio.clientType == "sageUI"){
			sagePointers[address] = new sagepointer(address+"_pointer");
			remoteInteraction[address] = new interaction();
			
			broadcast('createSagePointer', sagePointers[address], "display");
		}
		else if(wsio.clientType == "display"){
			for(var key in sagePointers){
				wsio.emit('createSagePointer', sagePointers[key]);
			}
		}
		clients.push(wsio);
		
		for(i=0; i<items.length; i++){
			wsio.emit('addNewElement', items[i]);
		}
	});
	
	wsio.on('startSagePointer', function(data) {
		console.log("starting pointer: " + address);
		
		sagePointers[address].start(data.label, data.color);
		broadcast('showSagePointer', sagePointers[address], "display");
	});
	
	wsio.on('stopSagePointer', function() {
		sagePointers[address].stop;
		broadcast('hideSagePointer', sagePointers[address], "display");
		
		if( remoteInteraction[address].appInteractionMode() ){//return to window interaction mode after stopping pointer
		    remoteInteraction[address].toggleModes(); 
		    broadcast('changeSagePointerMode', {id: sagePointers[address].id, mode: remoteInteraction[address].interactionMode } , 'display' ); 
		}
	});
	
	wsio.on('pointerPress', function() {
		var pointerX = sagePointers[address].left
		var pointerY = sagePointers[address].top

        var elem = findItemUnderPointer(pointerX, pointerY);
		if(elem != null){
            if( remoteInteraction[address].windowManagementMode() ){
                remoteInteraction[address].selectMoveItem(elem, pointerX, pointerY); //will only go through if window management mode 
            }
            else if ( remoteInteraction[address].appInteractionMode() ) {
                var itemRelX = pointerX - elem.left;
				var itemRelY = pointerY - elem.top - config.titleBarHeight;
				var now = new Date();
				broadcast( 'eventInItem', { eventType: "pointerPress", elemId: elem.id, user_id: sagePointers[address].id, user_label: sagePointers[address].label, user_color: sagePointers[address].color, itemRelativeX: itemRelX, itemRelativeY: itemRelY, data: {button: "left"}, date: now }, "display");  
            broadcast( 'eventInItem', { eventType: "pointerPress", elemId: elem.id, user_id: sagePointers[address].id, user_label: sagePointers[address].label, user_color: sagePointers[address].color, itemRelativeX: itemRelX, itemRelativeY: itemRelY, data: {button: "left"}, date: now }, "app");  
            }        
            
			var newOrder = moveItemToFront(elem.id);
			broadcast('updateItemOrder', newOrder);
		} 
		else { //if no item, change pointer mode
		    remoteInteraction[address].toggleModes(); 
		    broadcast('changeSagePointerMode', {id: sagePointers[address].id, mode: remoteInteraction[address].interactionMode } , 'display' ); 
		}
		
		
	});
	
	wsio.on('pointerRelease', function() {
	    if( remoteInteraction[address].windowManagementMode() ){
            remoteInteraction[address].releaseItem();

	    }
	    else if ( remoteInteraction[address].appInteractionMode() ) {
            var pointerX = sagePointers[address].left
            var pointerY = sagePointers[address].top
            
            var elem = findItemUnderPointer(pointerX, pointerY);

            if( elem != null ){           
                var itemRelX = pointerX - elem.left;
                var itemRelY = pointerY - elem.top - config.titleBarHeight;
                var now = new Date();
                broadcast( 'eventInItem', { eventType: "pointerRelease", elemId: elem.id, user_id: sagePointers[address].id, user_label: sagePointers[address].label, user_color: sagePointers[address].color, itemRelativeX: itemRelX, itemRelativeY: itemRelY, data: {button: "left"}, date: now }, "display");  
            }
	    }
	});
	
	wsio.on('pointerPosition', function(data) {
		sagePointers[address].left = data.pointerX;
		sagePointers[address].top = data.pointerY;
		if(sagePointers[address].left < 0) sagePointers[address].left = 0;
		if(sagePointers[address].left > config.totalWidth) sagePointers[address].left = config.totalWidth;
		if(sagePointers[address].top < 0) sagePointers[address].top = 0;
		if(sagePointers[address].top > config.totalHeight) sagePointers[address].top = config.totalHeight;
		
		broadcast('updateSagePointerPosition', sagePointers[address], "display");
		
		var updatedItem = remoteInteraction[address].moveSelectedItem(sagePointers[address].left, sagePointers[address].top);
		if(updatedItem != null) broadcast('setItemPosition', updatedItem);
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
            var updatedItem = remoteInteraction[address].moveSelectedItem(sagePointers[address].left, sagePointers[address].top);
            if(updatedItem != null) broadcast('setItemPosition', updatedItem);
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
			remoteInteraction[address].selectScrollItem(elem, pointerX, pointerY);
			var newOrder = moveItemToFront(elem.id);
			broadcast('updateItemOrder', newOrder);
		}
	});
	
	wsio.on('pointerScroll', function(data) {
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
	});
	
	wsio.on('keyDown', function(data) {
	    console.log("keydown");

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
                    broadcast( 'eventInItem', { eventType: "specialKey", elemId: elem.id, user_id: sagePointers[address].id, user_label: sagePointers[address].label, user_color: sagePointers[address].color, itemRelativeX: itemRelX, itemRelativeY: itemRelY, data: {code: data.code, state: "down" }, date: now }, "display");  
                }
        }
		
	});
		
    wsio.on('keyUp', function(data) {
        console.log("keyup");

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
                    removeElement(items, elem);
                    broadcast('deleteElement', elem.id);
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
                        broadcast( 'eventInItem', { eventType: "specialKey", elemId: elem.id, user_id: sagePointers[address].id, user_label: sagePointers[address].label, user_color: sagePointers[address].color, itemRelativeX: itemRelX, itemRelativeY: itemRelY, data: {code: data.code, state: "up" }, date: now }, "display");  
                    }
            }  
		}
	});
	
    wsio.on('keyPress', function(data) {
        console.log("keypress");

        if(data.code == 9 && (remoteInteraction[address].CTRL)){ // ctrl + tab
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
                broadcast( 'eventInItem', { eventType: "keyboard", elemId: elem.id, user_id: sagePointers[address].id, user_label: sagePointers[address].label, user_color: sagePointers[address].color, itemRelativeX: itemRelX, itemRelativeY: itemRelY, data: {code: parseInt(data.code), state: "down" }, date: now }, "display");  
                broadcast( 'eventInItem', { eventType: "keyboard", elemId: elem.id, user_id: sagePointers[address].id, user_label: sagePointers[address].label, user_color: sagePointers[address].color, itemRelativeX: itemRelX, itemRelativeY: itemRelY, data: {code: parseInt(data.code), state: "down" }, date: now }, "audioManager");  

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
			var broadcastWS;
			for(i=0; i<clients.length; i++){
				var clientAddress = clients[i].remoteAddress.address + ":" + clients[i].remoteAddress.port;
				if(clientAddress == data.id) broadcastWS = clients[i];
			}
			
			if(broadcastWS != null) broadcastWS.emit('requestNextFrame', null);
		}
	});
	
	wsio.on('addNewWebElement', function(data) {
		if(data.type == "img"){
			request({url: data.src, encoding: null}, function(err, response, body) {
				if(err) throw err;
				
				loader.loadImage(body, "item"+itemCount.toString(), data.src.substring(data.src.lastIndexOf("/")+1), function(newItem) {
					broadcast('addNewElement', newItem);
				
					items.push(newItem);
					itemCount++;
				});
			});
		}
		else if(data.type == "video"){
			loader.loadVideo(data.src, "item"+itemCount.toString(), data.src.substring(data.src.lastIndexOf("/")+1), function(newItem) {
				broadcast('addNewElement', newItem);
			
				items.push(newItem);
				itemCount++;
			});
		}
		else if(data.type == "youtube"){
			loader.loadYoutube(data.src, "item"+itemCount.toString(), function(newItem) {
				broadcast('addNewElement', newItem);
			
				items.push(newItem);
				itemCount++;
			});
		}
		else if(data.type == "pdf"){
			request({url: data.src, encoding: null}, function(err, response, body) {
				if(err) throw err;
				
				loader.loadPdf(body, "item"+itemCount.toString(), data.src.substring(data.src.lastIndexOf("/")+1), function(newItem) {
					broadcast('addNewElement', newItem);
				
					items.push(newItem);
					itemCount++;
				});
			});
		}
	});
	
	wsio.on('addNewElementFromStoredFiles', function(file) {
		if(file.dir == "images"){
			var localPath = path.join("uploads", file.dir, file.name);
			
			fs.readFile(localPath, function (err, data) {
				if(err) throw err;
				
				loader.loadImage(data, "item"+itemCount.toString(), path.basename(localPath), function(newItem) {
					broadcast('addNewElement', newItem);
			
					items.push(newItem);
					itemCount++;
				});
			});
		}
		else if(file.dir == "videos"){
			var localPath = path.join("uploads", file.dir, file.name);
			
			loader.loadVideo(localPath, "item"+itemCount.toString(), path.basename(localPath), function(newItem) {
				broadcast('addNewElement', newItem);
		
				items.push(newItem);
				itemCount++;
			});
		}
		else if(file.dir == "pdfs"){
			var localPath = path.join("uploads", file.dir, file.name);
			
			fs.readFile(localPath, function (err, data) {
				if(err) throw err;
				
				loader.loadPdf(data, "item"+itemCount.toString(), path.basename(localPath), function(newItem) {
					broadcast('addNewElement', newItem);
			
					items.push(newItem);
					itemCount++;
				});
			});
		}
		else if(file.dir == "apps"){
			var localPath = path.join("uploads", file.dir, file.name);
			
			console.log(localPath);
			var id = "item"+itemCount.toString();
			loader.loadApp(localPath, id, function(newItem, instructions) {
				// add resource scripts to clients
				for(var i=0; i<instructions.resources.length; i++){
					if(instructions.resources[i].type == "script"){
						broadcast('addScript', path.join(zipFolder, instructions.resources[i].src));
					}
				}
	
				// add item to clients (after waiting 1 second to ensure resources have loaded)
				setTimeout(function() {
					broadcast('addNewElement', newItem);
					
					items.push(newItem);
					itemCount++;

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

    wsio.on('updateWebpageStreamFrame', function(data) {
        broadcast('updateWebpageStreamFrame', data, "display");
    });

    wsio.on('receivedWebpageStreamFrame', function(data) {
		
        var broadcastWS;
        for(i=0; i<clients.length; i++){
            var clientAddress = clients[i].remoteAddress.address + ":" + clients[i].remoteAddress.port;
            if(clientAddress == data.id) broadcastWS = clients[i];
        }
        
        if(broadcastWS != null) broadcastWS.emit('requestNextWebpageFrame', null);
	});

    wsio.on('openNewWebpage', function(data) {
        var width = 1200;
        var height = 800;
        console.log("Opening a new webpage:" + data.url);
        
        id = data.id + "_" + itemCount.toString();
        var web = {src: "", title: "WebBrowser: " + data.url, width: width, height: height};
		loader.loadWebpage(web.src, id, web.title, web.width, web.height, function(newItem) {
            console.log(data.id+"_"+ itemCount.toString());
			broadcast('addNewElement', newItem);
			
			items.push(newItem);
			itemCount++;
		});
        var spawn = require("child_process").spawn;
        wb = spawn('python', ['webBrowser/awesomium/build/webBrowser.py', id, data.url, width, height]);

	wb.stdout.on('data', function (data) {
  		console.log('stdout: ' + data);
	});
	
	wb.stderr.on('data', function (data) {
  		console.log('stderr: ' + data);
	});

	wb.on('close', function (code) {
  		console.log('child process exited with code ' + code);
	});
    });
});

app.post('/upload', function(request, response) {
	var fileKeys = Object.keys(request.files);
	fileKeys.forEach(function(key) {
		var uploadPath = path.dirname(request.files[key].path);
		
		if(request.files[key].type == "image/jpeg" || request.files[key].type == "image/png"){
			var finalPath = path.join(uploadPath, "images", request.files[key].name);
			var localPath = finalPath.substring(__dirname.length+1);
			fs.rename(request.files[key].path, finalPath, function(err) {
				if(err) throw err;
				
				fs.readFile(localPath, function (err, data) {
					if(err) throw err;
					
					loader.loadImage(data, "item"+itemCount.toString(), path.basename(localPath), function(newItem) {
						broadcast('addNewElement', newItem);
				
						items.push(newItem);
						itemCount++;
				
						var file = path.basename(localPath);
						if(savedFiles["image"].indexOf(file) < 0) savedFiles["image"].push(file);
					});
				});
			});
		}
		else if(request.files[key].type == "video/mp4"){
			var finalPath = path.join(uploadPath, "videos", request.files[key].name);
			var localPath = finalPath.substring(__dirname.length+1);
			fs.rename(request.files[key].path, finalPath, function(err) {
				if(err) throw err;
				
				loader.loadVideo(localPath, "item"+itemCount.toString(), path.basename(localPath), function(newItem) {
					broadcast('addNewElement', newItem);
			
					items.push(newItem);
					itemCount++;
				
					var file = path.basename(localPath);
					if(savedFiles["video"].indexOf(file) < 0) savedFiles["video"].push(file);
				});
			});
		}
		else if(request.files[key].type == "application/pdf"){
			var finalPath = path.join(uploadPath, "pdfs", request.files[key].name);
			var localPath = finalPath.substring(__dirname.length+1);
			fs.rename(request.files[key].path, finalPath, function(err) {
				if(err) throw err;
				
				fs.readFile(finalPath, function (err, data) {
					if(err) throw err;
					
					loader.loadPdf(data, "item"+itemCount.toString(), path.basename(localPath), function(newItem) {
						broadcast('addNewElement', newItem);
				
						items.push(newItem);
						itemCount++;
						
						var file = path.basename(localPath);
						if(savedFiles["pdf"].indexOf(file) < 0) savedFiles["pdf"].push(file);
					});
				});
			});
		}
		else if(request.files[key].type == "application/zip"){
			var finalPath = path.join(uploadPath, "apps", request.files[key].name);
			var localPath = finalPath.substring(__dirname.length+1);
			fs.rename(request.files[key].path, finalPath, function(err) {
				if(err) throw err;
				
				var id = "item"+itemCount.toString();
				loader.loadZipApp(localPath, id, function(newItem, instructions) {
					// add resource scripts to clients
					for(var i=0; i<instructions.resources.length; i++){
						if(instructions.resources[i].type == "script"){
							broadcast('addScript', path.join(zipFolder, instructions.resources[i].src));
						}
					}
		
					// add item to clients (after waiting 1 second to ensure resources have loaded)
					setTimeout(function() {
						broadcast('addNewElement', newItem);
						
						items.push(newItem);
						itemCount++;
	
						// set interval timer if specified
						if(instructions.animation == "timer"){
							setInterval(function() {
								var now = new Date();
								broadcast('animateCanvas', {elemId: id, type: instructions.type, date: now});
							}, instructions.interval);
						}
					}, 1000);
					
					var file = path.basename(localPath, path.extname(localPath));
					if(savedFiles["app"].indexOf(file) < 0) savedFiles["app"].push(file);
				});
			});
		}
	});
});
	


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


