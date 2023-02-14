/**
 * Demo UI component for selecting a geometry object for Leaflet.Pdf demo. (c) Alexander Cherviakov
 *
 */

L.Control.GeometrySelector = L.Control.extend({
    options: {
        position: "topleft",
    },

    initialize: function(geometries, geometrySelectCb) {
        this.geometries = geometries;
        this.currentGeometry = undefined;
        this.geometrySelectCb = geometrySelectCb;
    },

    setGeometry: function(id) {
        this.currentGeometry = id;
        if (typeof this.geometrySelectCb === "function")
            this.geometrySelectCb(id)
    },

    updateGeometries: function () {
        this.inputLayer.replaceChildren()
        let i = 1
        for (let g of this.geometries) {
            this.inputLayer.append(new Option(`geometry ${i}`));
            i++
        }
    },

    onAdd: function(map) {
        this.map = map;
        //this.setTileLayer(this.tileLayers[0]);

        var divControls = L.DomUtil.create("form", "text-input");
        divControls.style.backgroundColor = "white";
        divControls.style.borderSpacing = "5px";

        this.inputLayer = this._createElement("select", {id: "input-layer"});
        var l = this._createElement("label", {innerHTML: "Geometries:", for: "input-layer"});
        this.updateGeometries()
        var p = this._createElement("p");
        p.append(l, this.inputLayer);
        divControls.append(p);

        this.inputLayer.addEventListener("change", function(event) {
            this.setGeometry(event.target.selectedIndex)
        }.bind(this));

        var divWrapper = this._createElement("div", {className: "leaflet-bar leaflet-control"}, {backgroundColor: "white"});
        var divHeader = this._createElement("div", {}, {display: "flex", justifyContent: "space-between", borderBottom: "1px solid black"});

        var header = this._createElement("p", {innerHTML: "<b>Geometry selector</b>"}, {margin: "0", fontSize: "13px", padding: divControls.style.borderSpacing});
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

