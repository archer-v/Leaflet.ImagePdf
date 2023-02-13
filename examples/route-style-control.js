/**
 * Demo UI component to control map & route state of Leaflet.Pdf demo example
 * Oririginal UI control was written by
 * [Herman Sletmoen](https://github.com/hersle) (c) [leaflet-route-print](https://hersle.github.io/leaflet-route-print/) *
 */

function createNamedTileLayer(name, tileURL, attribName, attribURL) {
    var tl = L.tileLayer(tileURL, {attribution: `© <a href="${attribURL}">${attribName}</a>`});
    tl.name = name;
    return tl;
}

L.Control.MiscSelector = L.Control.extend({
    options: {
        position: "topleft",
    },

    initialize: function(tileLayers) {
        this.tileLayers = tileLayers;
        this.currentTileLayer = undefined;
    },

    setTileLayer: function(tileLayer) {
        if (this.currentTileLayer != undefined) {
            map.removeLayer(this.currentTileLayer);
        }
        this.map.addLayer(tileLayer);
        this.currentTileLayer = tileLayer;
    },

    onAdd: function(map) {
        this.map = map;
        this.setTileLayer(this.tileLayers[0]);

        var divControls = L.DomUtil.create("form", "text-input");
        divControls.style.backgroundColor = "white";
        divControls.style.borderSpacing = "5px";

        this.inputLayer = this._createElement("select", {id: "input-layer"});
        var l = this._createElement("label", {innerHTML: "Map source:", for: "input-layer"});
        for (var tl of this.tileLayers) {
            this.inputLayer.append(new Option(tl.name));
        }
        var p = this._createElement("p");
        p.append(l, this.inputLayer);
        divControls.append(p);

        this.inputLayer.addEventListener("change", function(event) {
            var tl = this.tileLayers.find(t => t.name == this.inputLayer.value);
            if (tl != undefined) {
                this.setTileLayer(tl);
            }
        }.bind(this));

        this.inputColor = this._createElement("input", {id: "input-color", type: "color", value: routeLine.options.color});
        var l = this._createElement("label", {innerHTML: "Line color:", for: "input-color"});
        var p = this._createElement("p");
        p.append(l, this.inputColor);
        divControls.append(p);

        this.inputColor.addEventListener("change", function(event) {
            routeLine.setStyle({color: this.inputColor.value});
        }.bind(this));

        this.inputThickness = this._createElement("input", {id: "input-thickness", type: "number", value: routeLine.options.weight}, {width: "3em"});
        var l = this._createElement("label", {innerHTML: "Line thickness:", for: "input-thickness"});
        var p = this._createElement("p");
        p.append(l, this.inputThickness, " px");
        divControls.append(p);

        this.inputThickness.addEventListener("change", function(event) {
            routeLine.setStyle({weight: this.inputThickness.value});
        }.bind(this));

        var inputRoute = this._createElement("input", {id: "input-routefile", type: "file", accept: ".gpx"}, {width: "13em"});
        var l = this._createElement("label", {innerHTML: "Route file:", for: inputRoute.id});
        var p = this._createElement("p");
        p.append(l, inputRoute);
        divControls.append(p);

        inputRoute.addEventListener("change", async function(event) {
            var file = this.files[0];
            var stream = file.stream();
            var reader = stream.getReader();
            const utf8Decoder = new TextDecoder("utf-8");
            var done = false;
            var newpoints = [];
            while (!done) {
                var res = await reader.read();
                done = res.done;
                var s = utf8Decoder.decode(res.value, {stream: true});
                var l = "";
                while (true) {
                    var i = s.indexOf("\n");
                    l += s.slice(0, i);
                    if (i == -1) {
                        break;
                    } else {
                        // have one newline, handle it
                        var regex = /trkpt lat="([+-]?\d+(?:\.\d+)?)" lon="([+-]?\d+(?:\.\d+)?)"/; // match <trkpt lat="float" lon="float"
                        var matches = l.match(regex);
                        var rev = false;
                        if (!matches || matches.length == 0) {
                            // try lat="" lon"" instead
                            regex = /trkpt lon="([+-]?\d+(?:\.\d+)?)" lat="([+-]?\d+(?:\.\d+)?)"/; // match <trkpt lat="float" lon="float"
                            matches = l.match(regex);
                            rev = true;
                        }
                        if (matches && matches.length == 3) { // have [fullmatch, lat, lon]
                            if (rev) {
                                newpoints.push([parseFloat(matches[2]), parseFloat(matches[1])]);
                            } else {
                                newpoints.push([parseFloat(matches[1]), parseFloat(matches[2])]);
                            }
                        }

                        s = s.slice(i+1);
                        l = "";
                    }
                }
            }

            // remove old line from map and add a new one
            map.removeLayer(routeLine);
            routeLine = L.polyline(newpoints, {renderer: L.canvas()});
            routeLine.addTo(map);
            routePrinter.setRoute(routeLine);
        });

        var divWrapper = this._createElement("div", {className: "leaflet-bar leaflet-control"}, {backgroundColor: "white"});
        var divHeader = this._createElement("div", {}, {display: "flex", justifyContent: "space-between", borderBottom: "1px solid black"});

        var header = this._createElement("p", {innerHTML: "<b>Miscellaneous settings</b>"}, {margin: "0", fontSize: "13px", padding: divControls.style.borderSpacing});
        var button = this._createElement("a", {innerHTML: "✖", href: "#"}, {width: "30px", height: "30px", lineHeight: "30px", fontSize: "22px"});
        button.addEventListener("click", function() {
            if (divControls.style.display == "none") {
                divControls.style.display = "block";
                header.style.display = "block";
                button.innerHTML = "✖";
            } else {
                divControls.style.display = "none";
                header.style.display = "none";
                button.innerHTML = "M";
            }
        });
        divHeader.append(header, button);

        divWrapper.append(divHeader, divControls);
        L.DomEvent.disableClickPropagation(divWrapper);
        L.DomEvent.disableScrollPropagation(divWrapper);

        return divWrapper;
    },

    _setProperties: function (element, properties, style) {
        Object.assign(element, properties);
        Object.assign(element.style, style);
    },

    _createElement: function createElement(type, properties, style) {
        var element = document.createElement(type);
        this._setProperties(element, properties, style);
        return element;
    }
});

