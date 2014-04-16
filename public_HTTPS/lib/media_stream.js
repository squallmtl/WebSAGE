var media_stream = SAGE2_App.extend( {
	construct: function() {
		this.src = null;
	},
	
	init: function(id, width, height, resrc, date) {
		// call super-class 'init'
		arguments.callee.superClass.init.call(this, id, "img", width, height, resrc, date);
		
		// application specific 'init'
	},
	
	load: function(state, date) {
		var base64;
		if(state.encoding === "base64") base64 = state.src;
		else if(state.encoding === "binary") base64 = btoa(state.src);
		this.element.src = "data:" + state.type + ";base64," + base64;
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
		
	}
});
