var movie_player = SAGE2_App.extend( {
	construct: function() {
		this.source = null;
		this.playTimeout = null;
		this.playDelay = 0.75;
	},
	
	init: function(id, width, height, resrc, date) {
		// call super-class 'init'
		arguments.callee.superClass.init.call(this, id, "video", width, height, resrc, date);
		
		// application specific 'init'
		this.element.controls = false;
		this.element.muted = true;
		
		this.source = document.createElement("source");
		this.element.appendChild(this.source);
	},
	
	load: function(data, date) {
		var param = data.src.indexOf('?');
		if(param >= 0) this.source.src = data.src + "&clientID=" + clientID.toString();
		else this.source.src = data.src + "?clientID=" + clientID.toString();
		this.source.type = data.type;
	},
	
	draw: function(date) {
		// call super-class 'preDraw'
		arguments.callee.superClass.preDraw.call(this, date);
		
		// application specific 'draw'
		
		
		// call super-class 'postDraw'
		arguments.callee.superClass.postDraw.call(this, date);
	},
	
	resize: function(date) {
		
	},
	
	event: function(eventType, userId, x, y, data, date) {
		var _this = this;
		
		if(eventType === "videoTimeSync"){
			// play a paused video
			if(data.play && this.element.paused){
				var vidTime = data.videoTime + data.delay + this.playDelay;
				if(vidTime < this.element.duration){
					this.element.currentTime = vidTime;
					this.playTimeout = setTimeout(function() {
						_this.element.play();
					}, this.playDelay*1000);
				}
			}
			
			// pause a video
			else if(!data.play){
				this.element.pause();
				this.element.currentTime = data.videoTime;
				if(this.playTimeout !== null) clearTimeout(this.playTimeout);	
			}
			
			// re-sync if more the 1/30 of a second off
			// (currently not working due to seek taking large and varying amounts of time)
		}
	}
});
