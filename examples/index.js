/**
 * Leaflet.Pdf demo
 * Oririginal UI control was written by
 * [Herman Sletmoen](https://github.com/hersle)
 * [leaflet-route-print](https://hersle.github.io/leaflet-route-print/)
 */

let geometries = []
let geometrySelector
let pdfControl

function addGeometry(proto, data) {
	let geometry = proto(data).addTo(map);
	geometries.push(geometry)
	geometrySelector.updateGeometries()
}

function selectGeometry(id) {
	pdfControl.setRoute(geometries[id]);
	// set map view to this route
	map.fitBounds(geometries[id].getBounds(), {animate: false});
}


// map.getContainer().style will NOT return values set in stylesheet,
// so set them here instead
document.getElementById("map").style.width = "100vw";
document.getElementById("map").style.height = "100vh";

let map = L.map("map", {
	zoomControl: false,
});

// for debug purpose
L.control.coordinates({
	position:"topright", //optional default "bootomright"
	labelTemplateLat:"Latitude: {y}", //optional default "Lat: {y}"
	labelTemplateLng:"Longitude: {x}", //optional default "Lng: {x}"
	useLatLngOrder: true, //ordering of labels, default false-> lng-lat
}).addTo(map);

L.control.zoom({position: "topright"}).addTo(map);
L.control.scale({metric: true, imperial: false}).addTo(map);

map.setView([0, 0], 2);

let pdfFactory = L.pdf(map, {
	pageFormat: "A3"
})

pdfControl = new L.Control.PdfControl({pdf: pdfFactory}).addTo(map);
geometrySelector = new L.Control.GeometrySelector(geometries, selectGeometry).addTo(map);

addGeometry(L.rectangle, [[65.41, 12.55], [65.405, 12.53]])

selectGeometry(0)

fetch('./demo_route.json')
	.then((response) => response.json())
	.then((demo_route) => addGeometry(L.polyline, demo_route))
	.catch( function (err) {
		// if started locally we get this error, cause fetch doesn't allow loading local files,
		// here we load another testing example route
		addGeometry(L.polyline, [[38.6533433,-77.8054869],[38.6586383,-77.7974725], [38.6782383,-77.72333], [38.6782383,-77.68633], [38.6982383,-77.67633], [38.6982383,-77.63633]])
	});


L.tileLayer(
	"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
	{attribution: `© <a href="https://www.openstreetmap.org/copyright">"OpenStreetMap contributors"</a>`})
	.addTo(map)
