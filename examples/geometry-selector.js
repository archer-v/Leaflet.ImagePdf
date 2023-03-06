/**
 * Demo UI component for selecting a geometry object for Leaflet.Pdf demo. (c) Alexander Cherviakov
 *
 */

L.Control.GeometrySelector = L.Control.extend({
    options: {
        position: "topleft",
        pdfControl: null,
        imageControl: null,
    },


    initialize: function(geometries, geometrySelectCb, pdfControl, imageControl) {
        this.geometries = geometries;
        this.currentGeometry = undefined;
        this.geometrySelectCb = geometrySelectCb;
        this.options.pdfControl = pdfControl;
        this.options.imageControl = imageControl;

        this.css = document.createElement("style");
        document.head.appendChild(this.css)
        this.css.sheet.insertRule('.geometry-control form { display: table; }');
        this.css.sheet.insertRule('.geometry-control p { display: table-row;}');
        this.css.sheet.insertRule('.geometry-control p > label { display: table-cell; font-weight: bold; vertical-align: middle; }');
        this.css.sheet.insertRule('.geometry-control p > input { display: table-cell; }');
        this.css.sheet.insertRule('.geometry-control p > label:nth-child(n+2) { display: inline-block; font-weight: normal; vertical-align: 1px;}');
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
            let type = ""
            if (g instanceof L.Polygon) {
                type = "(Area)"
            } else if (g instanceof L.Polyline) {
                type = "(Route)"
            }
            this.inputLayer.append(new Option(`Geometry ${i} ${type}`));
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
        var l = this._createElement("label", {innerHTML: "Area:", for: "input-layer"});
        this.updateGeometries()
        var p = this._createElement("p");
        p.append(l, this.inputLayer);
        divControls.append(p);

        l = this._createElement("label", {innerHTML: "Export to:"});
        this.inputToPdf = this._createElement("input", {id: "input-to-pdf", type: "radio", name: "exportType", checked: true});
        this.inputToImage = this._createElement("input", {id: "input-to-image", type: "radio", name: "exportType"});
        let l_p = this._createElement("label", {innerHTML: "pdf", for: "input-to-pdf"});
        let l_i = this._createElement("label", {innerHTML: "image", for: "input-to-image"});
        p = this._createElement("p");
        p.append(l, l_p, this.inputToPdf, l_i, this.inputToImage);
        divControls.append(p);

        this.inputLayer.addEventListener("change", function(event) {
            this.setGeometry(event.target.selectedIndex)
        }.bind(this));

        this.inputToPdf.addEventListener("change", this.updateExportMode.bind(this));
        this.inputToImage.addEventListener("change", this.updateExportMode.bind(this));

        var divWrapper = this._createElement("div", {className: "leaflet-bar leaflet-control geometry-control"}, {backgroundColor: "white"});
        var divHeader = this._createElement("div", {}, {display: "flex", justifyContent: "space-between", borderBottom: "1px solid black"});

        var header = this._createElement("p", {innerHTML: "<b>Map export example</b>"}, {margin: "0", fontSize: "13px", padding: divControls.style.borderSpacing});

        divControls.style.display = "block";
        header.style.display = "block";

        divHeader.append(header);

        divWrapper.append(divHeader, divControls);
        L.DomEvent.disableClickPropagation(divWrapper);
        L.DomEvent.disableScrollPropagation(divWrapper);

        return divWrapper;
    },

    updateExportMode() {
        if (this.inputToPdf.checked) {
            this.options.imageControl.remove()
            this.options.pdfControl.addTo(this.map)
        } else if (this.inputToImage.checked) {
            this.options.pdfControl.remove()
            this.options.imageControl.addTo(this.map)
        }
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

