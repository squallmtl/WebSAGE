var SAGE2_App = Class.extend( {
	construct: function() {
		this.div = null;
		this.element = null;
		this.resrcPath = null;
	
		this.startDate = null;
		this.prevDate = null;
	
		this.t = null;
		this.dt = null;
		this.frame = null;
	},
	
	init: function(id, elem, resrc, date) {
		this.div = document.getElementById(id);
		this.element = document.createElement(elem);
		this.element.className = "sageItem";
		this.div.appendChild(this.element);
		
		this.resrcPath = resrc;
		this.startDate = date;
		this.prevDate = date;
		this.frame = 0;
	},
	
	preDraw: function(date) {
		this.t = (date.getTime() - this.startDate.getTime()) / 1000; // total time since start of program (sec)
		this.dt = (date.getTime() - this.prevDate.getTime()) / 1000; // delta time since last frame (sec)
	},
	
	postDraw: function(date) {
		this.prevDate = date;
		this.frame++;
	},
});


