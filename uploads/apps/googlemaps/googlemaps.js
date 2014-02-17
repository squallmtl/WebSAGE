
function addScript( url, callback ) {
    var script = document.createElement( 'script' );
    if( callback ) script.onload = callback;
    script.type = 'text/javascript';
    script.src = url;
    document.body.appendChild( script );  
}



function googlemaps(){
	this.element = null;
	this.resrcPath = null;
	this.map = null;
	this.mapType = null;
	this.APIKEY = null;  // google maps developer API key

	this.initialize = function() {
		this.mapType = google.maps.MapTypeId.HYBRID;
		this.APIKEY = "AIzaSyBEngu_3hdR3tzZs6yVKho8LxhkEVkfgcw"; // luc's key

		// Enable the visual refresh
		google.maps.visualRefresh = true;

		var chicago = new google.maps.LatLng(41.850033, -87.6500523);
		var styles = [
		{
		  stylers: [
		    { hue: "#00ffe6" },
		    { saturation: -20 }
		  ]
		},{
		  featureType: "road",
		  elementType: "geometry",
		  stylers: [
		    { lightness: 100 },
		    { visibility: "simplified" }
		  ]
		},{
		  featureType: "road",
		  elementType: "labels",
		  stylers: [
		    { visibility: "off" }
		  ]
		}
		];
		var mapOptions = {
			center: chicago,
			zoom: 8,
			mapTypeId: this.mapType,
			disableDefaultUI: true
		};
		console.log("element: ", this.element);
		this.map = new google.maps.Map(this.element, mapOptions);
		this.map.setTilt(45);
		this.map.setOptions({styles: styles});

		//
		// StreetView API test
		//
		 //var fenway = new google.maps.LatLng(42.345573,-71.098326);
		 //var panoramaOptions = {
		   //position: fenway,
		   //pov: {
		     //heading: 34,
		     //pitch: 10
		   //}
		 //};
		 //var panorama = new  google.maps.StreetViewPanorama(this.element, panoramaOptions);
		 //this.map.setStreetView(panorama);

		//
		// Extra layers
		//
		this.trafficLayer = new google.maps.TrafficLayer();
		this.weatherLayer = new google.maps.weather.WeatherLayer({
		    temperatureUnits: google.maps.weather.TemperatureUnit.FAHRENHEIT
  		});
	}

	// setup the application in the init function
	this.init = function(id, date, resrc) {
		// get the supporting div created by the engine
		this.element = document.getElementById(id);
		// remember the application path
		this.resrcPath = resrc;

		// need a global handler for the callback (i.e. scope pollution)
		googlemaps_self = this;
		// load google maps
		addScript('https://maps.googleapis.com/maps/api/js?key=' + this.APIKEY + '&sensor=false&libraries=weather&callback=googlemaps_self.initialize');
	}

	// draw callback
    this.draw = function(date) {
		console.log("div draw");
	}
	
	// resize callback
    this.resize = function(date) {
		console.log("div resize");
 		google.maps.event.trigger(this.map, 'resize');
 	}

	// callback for application events
    this.event = function(eventType, user_id, itemX, itemY, data, date) {
		console.log("div event", eventType, user_id, itemX, itemY, data, date);
		if (eventType == "keyboard" && data.code == 109 && data.state == "down") {
			// m key down
			// change map type
			if (this.mapType == google.maps.MapTypeId.TERRAIN)
				this.mapType = google.maps.MapTypeId.ROADMAP;
			else if (this.mapType == google.maps.MapTypeId.ROADMAP)
				this.mapType = google.maps.MapTypeId.SATELLITE;
			else if (this.mapType == google.maps.MapTypeId.SATELLITE)
				this.mapType = google.maps.MapTypeId.HYBRID;
			else if (this.mapType == google.maps.MapTypeId.HYBRID)
				this.mapType = google.maps.MapTypeId.TERRAIN;
			else 
				this.mapType = google.maps.MapTypeId.HYBRID;
			this.map.setMapTypeId(this.mapType);
		}
		if (eventType == "keyboard" && data.code == 116 && data.state == "down") {
			// t key down
			// add/remove traffic layer
			if (this.trafficLayer.getMap() == null)
				this.trafficLayer.setMap(this.map);
			else
				this.trafficLayer.setMap(null);
		}
		if (eventType == "keyboard" && data.code == 119 && data.state == "down") {
			// w key down
			// add/remove weather layer
			if (this.weatherLayer.getMap() == null)
				this.weatherLayer.setMap(this.map);
			else
				this.weatherLayer.setMap(null);
		}
		else if (eventType == "specialKey" && data.code == 16 && data.state == "down") {
			// shift down
			// zoom in
			var z = this.map.getZoom();
			this.map.setZoom(z+1);
		}
		else if (eventType == "specialKey" && data.code == 17 && data.state == "down") {
			// control down
			// zoom out
			var z = this.map.getZoom();
			this.map.setZoom(z-1);
		}
		else if (eventType == "specialKey" && data.code == 37 && data.state == "down") {
			// left
			this.map.panBy(-100,0);
		}
		else if (eventType == "specialKey" && data.code == 38 && data.state == "down") {
			// up
			this.map.panBy(0,-100);
		}
		else if (eventType == "specialKey" && data.code == 39 && data.state == "down") {
			// right
			this.map.panBy(100,0);
		}
		else if (eventType == "specialKey" && data.code == 40 && data.state == "down") {
			// down
			this.map.panBy(0,100);
		}
		this.draw(date);
	}

}
