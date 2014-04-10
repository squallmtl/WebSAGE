function button(){
	this.appId = null;
	this.id = null;
	this.type = null;
	this.call = null;
};

function slider(){
	this.id = null;
	this.min = null;
	this.max = null;
	this.step = null;
	this.call = null;
	this.val = null;
	this.pVal = null;
};

function widgetSpec(id){
	this.id = id;
	this.itemCount = 0;
	this.c = [];
	this.r = [];
	this.l = [];
};
widgetSpec.prototype.addButton = function(data) {
	var b = new button();
	b.appId = this.id;
	b.id = "button" + this.itemCount;
	b.type = data.type;
	b.call = data.action;

	if (data.align==="left"){
		this.l.push(b);	
		this.itemCount++;
	}
	else if (data.align==="right"){
		this.r.push(b);
		this.itemCount++;
	}
	else if (data.align==="center"){
		this.c.push(b);	
		this.itemCount++;
	}
}
widgetSpec.prototype.addSlider = function(mn,mx,st,val,a,action){
	var s = new slider();
	s.id = "slider" + this.itemCount;
	s.min = mn;
	s.max = mx;
	s.step = st < 2 ? 2 : st;
	s.call = action;
	s.val = val;
	s.pVal = null;


	if (a==="left"){
		this.l.push(s);
		this.itemCount++;
	}
	else if (a==="right"){
		this.r.push(s);
		this.itemCount++;
	}
	else if (a==="center"){
		this.c.push(s);
		this.itemCount++;
	}
};

widgetSpec.prototype.addText = function(t,a) {
	if (a==="left"){
		this.l.push({ctrl:"text",value:t});
		this.itemCount++;
	}
	else if (a==="right"){
		this.r.push({ctrl:"text",value:t});
		this.itemCount++;
	}
	else if (a==="center"){
		this.c.push({ctrl:"text",value:t});
		this.itemCount++;
	}
	
};

widgetSpec.prototype.enumerate = function(){
	return this.l.concat(this.c).concat(this.r);
};



function sageApp (){};

sageApp.prototype.appInit = function(id, date, resrc){
	//console.log(id);
	this.element = document.getElementById(id);
	//console.log(this.element);
	this.ctx = this.element.getContext("2d");
	this.resrcPath = resrc;
	this.minDim = null;
	this.controls = new widgetSpec(id);
	this.controls.id = id;
	this.enableControls = false;
	this.writeEnableRequest = false;
	this.writeRequest = false;
	this.writeFile = null;
	this.writeData = null;
}
