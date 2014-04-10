function computeSize(widgetObj){
	var arr = widgetObj.enumerate();
	var butCount = 0;
	var sliderCount = 0; // total number of steps from all the sliders
	var gap = 10; // distance between widgets
	var sliderUnit = 10;
	for(var i in arr){
		if (arr[i] instanceof button){
			butCount++;
		}
		else if (arr[i] instanceof slider){
			sliderCount += remapVal(arr[i].step);
		}
	}
	return {width : butCount*1.5*titleBarHeight + sliderCount*sliderUnit + (arr.length+1)*gap, height: 2*titleBarHeight};
}

function remapVal(val){
	var r = (val==2)? 10 : (val<20)? 16 : (val<50)? 25 : 40;
	return r;
}

function createControls(ctrId, spec){
	var size = computeSize(spec);
	var buttonRad = 0.75 * titleBarHeight;
	var windowControls = Snap(size.width, size.height);
	var gap = 10;

	windowControls.attr({
		fill: "#000",
		id: ctrId + "SVG"
	});
	
	var ctrHandle = document.getElementById(ctrId + "SVG");
	
	var wArr = spec.enumerate();
	var x = gap;
	var y = titleBarHeight;
	for (var i in wArr){
		if (wArr[i] instanceof button){
			createButton(windowControls,wArr[i],x+buttonRad,y);
			x = x + buttonRad*2 + gap; 
		}

	}

	return ctrHandle;
}

var buttonType = {
	"play-pause": {
		"from":"m -5 -5 l 0 10 l 6 -3 l 4 -2 z",
		"to":"m -2 -5 l 0 10 m 4 0 l 0 -10",
		"strokeWidth": 2,
		"fill":"#000000",
		"switch": 0,
		"speed": 400
	},
	"play-stop": {
		"from":"m -5 -5 l 0 10 l 6 -3 l 4 -2 z",
		"to":"m -5 -5 l 0 10 l 10 0 l 0 -10 z",
		"strokeWidth": 2,
		"fill":"#000000",
		"switch": 0,
		"speed": 400
	},
	"next": {
		"switch": null,
		"from":"m 0 -6 l 4 6 l -4 6",
		"to":"m 0 -7 l 0 7 l 0 7",
		"fill":"none",
		"strokeWidth": 2,
		"speed": 600
	},
	"prev": {
		"switch": null,
		"from":"m 0 -6 l -4 6 l 4 6",
		"to":"m 0 -7 l 0 7 l 0 7",
		"fill":"none",
		"strokeWidth": 2,
		"speed":600

	}
};


function createButton(paper, buttonSpec, cx, cy){
	var buttonRad = 0.75 * titleBarHeight;
	var buttonBack = paper.circle(cx,cy,buttonRad);
	buttonBack.attr({
		id: buttonSpec.id + "bkgnd",
		fill:"#baba55",
		strokeWidth : 2,
		stroke: "#000"
	});

	var type = buttonType[buttonSpec.type];
	var pthf = "M " + cx + " " + cy  + " " + type["from"];
	var ptht= "M " + cx + " " + cy  + " " + type["to"];
	var buttonCover = paper.path(pthf);
	buttonCover.attr({
		id: buttonSpec.id + "cover",
		transform: "s " + parseInt(buttonRad/8) + " " + parseInt(buttonRad/8),
		strokeWidth:type["strokeWidth"],
		stroke:"#000",
		fill:type["fill"]
	});
	var button = paper.group(buttonBack,buttonCover);

	buttonCover.data("call",buttonSpec.call);
	buttonCover.data("switch", type["switch"]) ;
	buttonCover.data("from",pthf);
	buttonCover.data("to",ptht);
	buttonCover.data("speed",type["speed"]);
	buttonCover.data("appId", buttonSpec.appId);
	buttonBack.data("appId", buttonSpec.appId);
	return button;
}