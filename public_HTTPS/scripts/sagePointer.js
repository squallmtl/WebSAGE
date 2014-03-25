function sagePointer(wsio) {
	this.name = "Default";
	this.col  = [180, 180, 180];
	this.wsio = wsio;
	
	this.uniqueID = null;
	this.sensitivity = null;
	this.mediaStream = null;

	this.fileDrop = document.getElementById('fileDrop');
	this.fileDropText = document.getElementById('fileDropText');
	this.sagePointerBtn = document.getElementById('sagePointerBtn');
	this.screenShareBtn = document.getElementById('screenShareBtn');
	
	this.sagePointerLabel = document.getElementById('sagePointerLabel');
	this.sagePointerColor = document.getElementById('sagePointerColor');
	this.screenShareResolution = document.getElementById('screenShareResolution');
	this.screenShareQuality = document.getElementById('screenShareQuality');
	this.screenShareQualityIndicator = document.getElementById('screenShareQualityIndicator');
	
	this.mediaVideo = document.getElementById('mediaVideo');
	this.mediaCanvas = document.getElementById('mediaCanvas');
	this.mediaCtx = this.mediaCanvas.getContext('2d');
	this.mediaResolution = this.screenShareResolution.options[this.screenShareResolution.selectedIndex].value;
	this.mediaQuality = this.screenShareQuality.value;
	this.mediaHeight = Math.min(this.mediaResolution, screen.height);
	this.mediaWidth = screen.width/screen.height * this.mediaHeight;
	this.mediaCanvas.width = this.mediaWidth;
	this.mediaCanvas.height = this.mediaHeight;
	this.broadcasting = false;
	
	this.chunk = 32 * 1024; // 32 KB
	this.maxUploadSize = 500 * (1024*1024); // 500 MB
	
	if(localStorage["SAGE2_ptrName"]  != null) this.sagePointerLabel.value = localStorage['SAGE2_ptrName'];
	if(localStorage["SAGE2_ptrColor"] != null) this.sagePointerColor.value = localStorage['SAGE2_ptrColor'];
	
	
	
	this.setPointerId = function(id) {
		this.uniqueID = id;
	};
	
	this.setPointerSensitivity = function(value) {
		this.sensitivity = value;
	};
	
	this.preventDefaultMethod = function(event) {
		event.preventDefault();
	};
	
	this.startSagePointerMethod = function(event) {
		if(this.sagePointerLabel.value != ""){
			this.name = this.sagePointerLabel.value;
		}
		if(this.sagePointerColor.value != ""){
			this.col[0] = parseInt(this.sagePointerColor.value.substring(1,3), 16);
			this.col[1] = parseInt(this.sagePointerColor.value.substring(3,5), 16);
			this.col[2] = parseInt(this.sagePointerColor.value.substring(5,7), 16);
		}
	
		localStorage["SAGE2_ptrName"]  = this.sagePointerLabel.value;
		localStorage["SAGE2_ptrColor"] = this.sagePointerColor.value;
	
		this.sagePointerBtn.requestPointerLock = this.sagePointerBtn.requestPointerLock       || 
												 this.sagePointerBtn.mozRequestPointerLock    || 
												 this.sagePointerBtn.webkitRequestPointerLock;

		// Ask the browser to lock the pointer
		this.sagePointerBtn.requestPointerLock();
	};
	
	this.pointerLockChangeMethod = function() {
		if(document.pointerLockElement === this.sagePointerBtn ||  document.mozPointerLockElement === this.sagePointerBtn || document.webkitPointerLockElement === this.sagePointerBtn){
			console.log("pointer lock enabled");
			this.wsio.emit('startSagePointer', {label: this.name, color: this.col});
		
			document.addEventListener('mousedown',           this.pointerPress,     false);
			document.addEventListener('mousemove',           this.pointerMove,      false);
			document.addEventListener('mouseup',             this.pointerRelease,   false);
			document.addEventListener('dblclick',            this.pointerDblClick,  false);
			document.addEventListener('mousewheel',          this.pointerScroll,    false);
			document.addEventListener('DOMMouseScroll',      this.pointerScrollFF,  false);
			document.addEventListener('keydown',             this.pointerKeyDown,   false);
			document.addEventListener('keyup',               this.pointerKeyUp,     false);
			document.addEventListener('keypress',            this.pointerKeyPress,  false);
		
			this.sagePointerBtn.removeEventListener('click', this.startSagePointer, false);
		}
		else{
			console.log("pointer lock disabled");
			this.wsio.emit('stopSagePointer');
		
			document.removeEventListener('mousedown',        this.pointerPress,     false);
			document.removeEventListener('mousemove',        this.pointerMove,      false);
			document.removeEventListener('mouseup',          this.pointerRelease,   false);
			document.removeEventListener('dblclick',         this.pointerDblClick,  false);
			document.removeEventListener('mousewheel',       this.pointerScroll,    false);
			document.removeEventListener('DOMMouseScroll',   this.pointerScrollFF,  false);
			document.removeEventListener('keydown',          this.pointerKeyDown,   false);
			document.removeEventListener('keyup',            this.pointerKeyUp,     false);
			document.removeEventListener('keypress',         this.pointerKeyPress,  false);
		
			this.sagePointerBtn.addEventListener('click',    this.startSagePointer, false);
		}
	};
	
	this.pointerPressMethod = function(event) {
		this.wsio.emit('pointerPress');
		event.preventDefault();
	};

	this.pointerMoveMethod = function(event) {
		var movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
		var movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

		this.wsio.emit('pointerMove', {deltaX: Math.round(movementX*this.sensitivity), deltaY: Math.round(movementY*this.sensitivity)});	
		event.preventDefault();
	};

	this.pointerReleaseMethod = function(event) {
		this.wsio.emit('pointerRelease');
		event.preventDefault();
	};

	this.pointerDblClickMethod = function(event) {
		this.wsio.emit('pointerDblClick');
		event.preventDefault();
	};

	this.pointerScrollMethod = function(event) {
		var scale = 1.0 + Math.abs(event.wheelDelta)/512;
		if(event.wheelDelta > 0) scale = 1.0 / scale;
		this.wsio.emit('pointerScrollStart');
		this.wsio.emit('pointerScroll', {scale: scale});
		event.preventDefault();
	};

	this.pointerScrollFFMethod = function(event) {
		var wheelDelta = -120*event.detail;
		var scale = 1.0 + Math.abs(wheelDelta)/512;
		if(wheelDelta > 0) scale = 1.0 / scale;
		this.wsio.emit('pointerScrollStart');
		this.wsio.emit('pointerScroll', {scale: scale});
		event.preventDefault();
	};

	this.pointerKeyDownMethod = function(event) {
		var code = parseInt(event.keyCode);
		this.wsio.emit('keyDown', {code: code});
		if(code == 9){ // tab is a special case - no keypress event called (do we need to change code?)
			this.wsio.emit('keyPress', {code: code});
		}
		// if a special key - prevent default (otherwise let continue to keyPress)
		if(code == 8 || (code >= 16 && code != 32 && code <= 46) ||  (code >=91 && code <= 93) || (code >= 112 && code <= 145)){
			event.preventDefault();
		}
	};

	this.pointerKeyUpMethod = function(event) {
		var code = parseInt(event.keyCode);
		this.wsio.emit('keyUp', {code: code});
		event.preventDefault();
	};

	this.pointerKeyPressMethod = function(event) {
		var code = parseInt(event.charCode);
		this.wsio.emit('keyPress', {code: code});
		event.preventDefault();
	};
	
	this.startScreenShareMethod = function(event) {
		if(this.sagePointerLabel.value != ""){
			this.name = this.sagePointerLabel.value;
		}
		if(this.sagePointerColor.value != ""){
			this.col[0] = parseInt(this.sagePointerColor.value.substring(1,3), 16);
			this.col[1] = parseInt(this.sagePointerColor.value.substring(3,5), 16);
			this.col[2] = parseInt(this.sagePointerColor.value.substring(5,7), 16);
		}

		localStorage["SAGE2_ptrName"]  = this.sagePointerLabel.value;
		localStorage["SAGE2_ptrColor"] = this.sagePointerColor.value;
	
		// start screen share
		this.screenShareBtn.disabled = true;

		var streamHeight = Math.min(1080, screen.height);
		var streamWidth = screen.width/screen.height * streamHeight;

		var constraints = {chromeMediaSource: 'screen', maxWidth: streamWidth, maxHeight: streamHeight};
		navigator.getUserMedia({video: {mandatory: constraints, optional: []}, audio: false}, this.streamSuccess, this.streamFail);
	};
	
	this.streamSuccessMethod = function(stream) {
		console.log("media capture success!");

		this.mediaStream = stream;
		this.mediaStream.onended = this.streamEnded;

		this.mediaVideo.src = window.URL.createObjectURL(this.mediaStream);
		this.mediaVideo.play();

		var frame = this.captureMediaFrame();
		var raw = this.base64ToString(frame.split(",")[1]);
		this.wsio.emit('startNewMediaStream', {id: this.uniqueID, title: this.name+": Shared Screen", src: raw, width: screen.width, height: screen.height});

		this.broadcasting = true;
	};

	this.streamFailMethod = function() {
		console.log("no access to media capture");
	};
	
	this.streamEndedMethod = function(e) {
		console.log("media stream ended");
		this.broadcasting = false;
		this.screenShareBtn.disabled = false;
		this.wsio.emit('stopMediaStream', {id: this.uniqueID});
	};
	
	this.captureMediaFrame = function() {
		this.mediaCtx.clearRect(0, 0, this.mediaWidth, this.mediaHeight);
		this.mediaCtx.drawImage(mediaVideo, 0, 0, this.mediaWidth, this.mediaHeight);
		return this.mediaCanvas.toDataURL("image/jpeg", (this.mediaQuality/10));
	};
	
	this.sendMediaStreamFrame = function() {
		if(this.broadcasting){
			var frame = this.captureMediaFrame();
			var raw = this.base64ToString(frame.split(",")[1]);
			
			if(raw.length > this.chunk){
				var _this = this;
				var nchunks = Math.ceil(raw.length / this.chunk);
				var msg_chunks = new Array(nchunks);
				for(var i=0; i<nchunks; i++){
					var start = i*this.chunk;
					var end = (i+1)*this.chunk < raw.length ? (i+1)*this.chunk : raw.length;
					
					msg_chunks[i] = raw.substring(start, end);
				}
				msg_chunks.forEach(function(element, index, array){
					setTimeout(function() {
						this.wsio.emit('updateMediaStreamChunk', {id: _this.uniqueID, src: msg_chunks[index], piece: index, total: nchunks});
					}, 4);
				});
			}
			else{
				this.wsio.emit('updateMediaStreamFrame', {id: this.uniqueID, src: raw});
			}
		}
	};
	
	this.changeScreenShareResolutionMethod = function(event) {
		this.mediaResolution = parseInt(this.screenShareResolution.options[this.screenShareResolution.selectedIndex].value);
		this.mediaHeight = Math.min(this.mediaResolution, screen.height);
		this.mediaWidth  = screen.width/screen.height * this.mediaHeight;
		this.mediaCanvas.width  = this.mediaWidth;
		this.mediaCanvas.height = this.mediaHeight;
		console.log("media resolution: " + this.mediaResolution);
	};

	this.changeScreenShareQualityMethod = function(event) {
		this.mediaQuality = this.screenShareQuality.value;
		this.screenShareQualityIndicator.textContent = this.mediaQuality;
	};
	
	this.uploadFileToServerMethod = function(event) {
		event.preventDefault();

		var files = event.dataTransfer.files;
		var url = event.dataTransfer.getData("Url");
		var text = event.dataTransfer.getData("Text");
		if(files.length > 0){
			var _this = this;
			var total = {};
			var loaded = {};
			var pc = 0;

			for(var i=0; i<files.length; i++){
				if(files[i].size <= this.maxUploadSize){
					var formdata = new FormData();
					formdata.append("file"+i.toString(), files[i]);

					xhr = new XMLHttpRequest();
					xhr.open("POST", "/upload", true);
					xhr.upload.id = "file"+i.toString();
					xhr.upload.addEventListener('progress', function(event) {
						if(!(event.srcElement.id in total)){
							total[event.srcElement.id] = event.total;
						}
						loaded[event.srcElement.id] = event.loaded;

						var totalSize = 0;
						var uploaded = 0;
						for(key in total){ totalSize += total[key]; uploaded += loaded[key]; }
						pc = Math.floor((uploaded/totalSize) * 100);
						_this.fileDropText.textContent = "File upload... " + pc.toString() + "%";
						if(pc == 100){
							setTimeout(function() {
								if(pc == 100) _this.fileDropText.textContent = "Drop multimedia files here";
							}, 500);
						}
					}, false);
					xhr.send(formdata);
				}
				else{
					alert("File: " + files[i].name + " is too large (max size is " + (this.maxUploadSize / (1024*1024)) + " MB)");
				}
			}
		}
		else if(url != null || text != null){
			var dataUrl;
			if(url == null) dataUrl = text;
			else if(text == null) dataUrl = url;
			else dataUrl = (url.length > text.length) ? url : text;
			var urlType = "";
			var youtube = dataUrl.indexOf("www.youtube.com");
			var ext = dataUrl.substring(dataUrl.lastIndexOf('.')+1);
			if(ext.length > 3) ext = ext.substring(0,3);
			ext = ext.toLowerCase();
			if(youtube >= 0) urlType = "youtube";
			else if(ext == "jpg" || ext == "png") urlType = "img";
			else if(ext == "mp4") urlType = "video";
			else if(ext == "pdf") urlType = "pdf";
			else urlType = "site";  //if all else fails, will try to open in iframe as a webpage
			console.log("URL: " + dataUrl + ", type: " + urlType);

			if(urlType != "") this.wsio.emit('addNewWebElement', {type: urlType, src: dataUrl});
		}
	};
	
	
	// convert class methods to functions (to be used as callbacks)
	this.preventDefault              = this.preventDefaultMethod.bind(this);
	this.uploadFileToServer          = this.uploadFileToServerMethod.bind(this);
	this.startSagePointer            = this.startSagePointerMethod.bind(this);
	this.startScreenShare            = this.startScreenShareMethod.bind(this);
	this.changeScreenShareResolution = this.changeScreenShareResolutionMethod.bind(this);
	this.changeScreenShareQuality    = this.changeScreenShareQualityMethod.bind(this);
	this.pointerLockChange           = this.pointerLockChangeMethod.bind(this);
	this.pointerPress                = this.pointerPressMethod.bind(this);
	this.pointerMove                 = this.pointerMoveMethod.bind(this);
	this.pointerRelease              = this.pointerReleaseMethod.bind(this);
	this.pointerDblClick             = this.pointerDblClickMethod.bind(this);
	this.pointerScroll               = this.pointerScrollMethod.bind(this);
	this.pointerScrollFF             = this.pointerScrollFFMethod.bind(this);
	this.pointerKeyDown              = this.pointerKeyDownMethod.bind(this);
	this.pointerKeyUp                = this.pointerKeyUpMethod.bind(this);
	this.pointerKeyPress             = this.pointerKeyPressMethod.bind(this);
	this.streamSuccess               = this.streamSuccessMethod.bind(this);
	this.streamFail                  = this.streamFailMethod.bind(this);
	this.streamEnded                 = this.streamEndedMethod.bind(this);
	
	// Event Listeners
	window.addEventListener('dragover', this.preventDefault, false);
	window.addEventListener('dragend',  this.preventDefault, false);
	window.addEventListener('drop',     this.preventDefault, false);
	
	fileDrop.addEventListener('dragover', this.preventDefault,     false);
	fileDrop.addEventListener('dragend',  this.preventDefault,     false);
	fileDrop.addEventListener('drop',     this.uploadFileToServer, false);
	
	sagePointerBtn.addEventListener('click', this.startSagePointer, false);
	screenShareBtn.addEventListener('click', this.startScreenShare, false);
	
	screenShareResolution.addEventListener('change', this.changeScreenShareResolution, false);
	screenShareQuality.addEventListener('change',    this.changeScreenShareQuality,    false);
	
	document.addEventListener('pointerlockchange',       this.pointerLockChange, false);
	document.addEventListener('mozpointerlockchange',    this.pointerLockChange, false);
	document.addEventListener('webkitpointerlockchange', this.pointerLockChange, false);
	
	
	
	this.base64ToString = function(base64) {
		//return decodeURIComponent(escape(atob(base64)));
		return atob(base64);
	};
}

