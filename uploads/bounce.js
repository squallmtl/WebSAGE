//WS: width=400
//WS: height=300
//WS: animation=timer
//WS: interval=16

function bounce(){
	this.element = null;
	this.ctx = null;
	this.startDate = null;
	this.prevDate = null;
	this.frame = null;
	
	this.vel = 1.0;
	this.pos = [0.5, 0.5];
	this.dir = [0.7071, 0.7071];
	
	this.init = function(id, date) {
		this.element = document.getElementById(id);
		this.ctx = this.element.getContext("2d");
		
		this.startDate = date;
		this.prevDate = date;
		this.frame = 0;
	}
	
	this.draw = function(date) {
		var t = (date.getTime() - this.startDate.getTime()) / 1000; // total time since start of program (sec)
		var dt = (date.getTime() - this.prevDate.getTime()) / 1000; // delta time since last frame (sec)
		
	
		// clear canvas		
		this.ctx.clearRect(0,0, this.element.width, this.element.height);
		
		this.ctx.fillStyle = "rgba(0, 0, 0, 1.0)"
		this.ctx.fillRect(0,0, this.element.width, this.element.height)
		
		var minDim = Math.min(this.element.width, this.element.height);
		var wScale = 1.0;
		var hScale = 1.0;
		if(this.element.width < this.element.height) hScale = this.element.height / this.element.width;
		if(this.element.height < this.element.width) wScale = this.element.width / this.element.height;
		
		if(this.pos[0]<0 || this.pos[0]>1.0*wScale) this.dir[0] = -this.dir[0];
		if(this.pos[1]<0 || this.pos[1]>1.0*hScale) this.dir[1] = -this.dir[1];
		this.pos[0] += this.dir[0]*this.vel*dt;
		this.pos[1] += this.dir[1]*this.vel*dt;
		
		this.ctx.fillStyle="rgba(250, 60, 20, 1.0)";
		this.ctx.beginPath();
		this.ctx.arc(this.pos[0]*minDim, this.pos[1]*minDim, 0.1*minDim, 0, 2*Math.PI, true);
		this.ctx.closePath();
		this.ctx.fill();
		
		// update time variables
		//console.log("frame: " + this.frame + ", time: " + t + ", dt: " + dt);
		
		this.prevDate = date;
		this.frame++;
	};
}
