/**
 * Leaflet.Pdf demo
 * Oririginal UI control was written by
 * [Herman Sletmoen](https://github.com/hersle)
 * [leaflet-route-print](https://hersle.github.io/leaflet-route-print/)
 */

// map.getContainer().style will NOT return values set in stylesheet,
// so set them here instead
document.getElementById("map").style.width = "100vw";
document.getElementById("map").style.height = "100vh";

var map = L.map("map", {
	zoomControl: false,
});
map.setView([0, 0], 2);

let pdfFactory = L.pdf(map, {
	pageFormat: "A3"
})
let routePrinter = new L.Control.PdfControl({pdf: pdfFactory});
routePrinter.addTo(map);

function addRoute(route) {
	let routeLine = L.polyline(route);
	routeLine.addTo(map);
	routePrinter.setRoute(routeLine);
	// set map view to this route
	map.fitBounds(routeLine.getBounds(), {animate: false});
}

let demo_data_fileName = './demo_route.json'
fetch(demo_data_fileName)
	.then((response) => response.json())
	.then((demo_route) => addRoute(demo_route))
	.catch( function (err) {
		// if started locally we get this error, cause fetch doesn't allow loading local files,
		// here we load another testing example route
		addRoute([[38.6533433,-77.8054869],[38.6586383,-77.7974725], [38.6782383,-77.72333], [38.6782383,-77.68633], [38.6982383,-77.67633], [38.6982383,-77.63633]])
	});


L.tileLayer(
	"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
	{attribution: `© <a href="https://www.openstreetmap.org/copyright">"OpenStreetMap contributors"</a>`})
	.addTo(map)
L.control.zoom().addTo(map);
L.control.scale({metric: true, imperial: false}).addTo(map);
