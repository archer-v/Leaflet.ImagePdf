/**
 * Leaflet.Pdf control UI component, (c) Alexander Cherviakov (https://github.com/mandalorian-one)
 * Oririginal UI control was written by
 * [Herman Sletmoen](https://github.com/hersle) (c) [leaflet-route-print](https://hersle.github.io/leaflet-route-print/)
 *
 */

L.Control.PdfControl = L.Control.extend({
	options: {
		position: "topleft",
		pdf: null,
		fileName: "example.pdf"
	},

	initialize: function(options) {
		if (options) {
			L.setOptions(this, options)
		}
		this.hasRoute = false;

		this.css = document.createElement("style");
		document.head.appendChild(this.css)
		this.css.sheet.insertRule('.pdf-control form { display: table; }');
		this.css.sheet.insertRule('.pdf-control p { display: table-row;}');
		this.css.sheet.insertRule('.pdf-control label { display: table-cell; font-weight: bold; vertical-align: middle; }');
		this.css.sheet.insertRule('.pdf-control input { display: table-cell; }');
		this.css.sheet.insertRule('.pdf-control button { display: table-cell; }');
	},

	onAdd: function(map) { // constructor
		this.map = map;

		if (this.options.pdf === null) {
			console.warn("It would be better the pdf component were defined in options")
			this.pdf = L.pdf(this.map)
		} else {
			this.pdf = this.options.pdf
		}

		var divWrapper = this._createElement("div", {className: "leaflet-bar leaflet-control pdf-control"}, {backgroundColor: "white"});
		L.DomEvent.disableClickPropagation(divWrapper);
		L.DomEvent.disableScrollPropagation(divWrapper);

		var divControls = this._createElement("div", {}, {borderSpacing: "5px"});
		var container = this._createElement("form", {className: "text-input"});

		this.inputScale = this._createElement("input", {id: "input-scale-world", type: "number", defaultValue: this.pdf.getScale()}, {width: "6em"});
		this.inputDPI = this._createElement("span", {id: "input-dpi"}, {fontWeight: "bold"});
		var l = this._createElement("label", {innerHTML: "Scale:", for: this.inputScale.id});
		l.title = "Paper-to-World scale and resolution of the printed raster map in Dots Per Inch (DPI). The color of the DPI value indicates the expected print quality, from worst (0, red) to best (300, green). Hover on the labels below to see more help information.";
		l.style.cursor = "help";
		var p = this._createElement("p");
		p.append(l, "1 : ", this.inputScale, " (", this.inputDPI, ")");
		container.append(p);

		this.inputWidth = this._createElement("input", {id: "input-size-width", type: "number", defaultValue: 210}, {width: "3.5em"});
		this.inputHeight = this._createElement("input", {id: "input-size-height", type: "number", defaultValue: 297}, {width: "3.5em"});
		this.inputPreset  = this._createElement("select", {id: "input-size-preset"});
		this.inputPreset.append(new Option("-"));
		let defaultPageFormat = this.pdf.getPageFormat()
		let id = 1;
		for (let pageFormat of this.pdf.getPageFormats()) {
			this.inputPreset.append(new Option(pageFormat.name));
			if (defaultPageFormat.name === pageFormat.name) {
				this.inputPreset.selectedIndex = id
			}
			id++
        }
		l = this._createElement("label", {innerHTML: "Paper:", for: this.inputWidth.id + " " + this.inputHeight.id});
		l.title = "Physical paper size. Enter manually or select a preset (P = Portrait, L = Landscape).";
		l.style.cursor = "help";
		p = this._createElement("p");
		p.append(l, this.inputWidth, " mm x ", this.inputHeight, " mm = ", this.inputPreset);
		container.append(p);

		this.inputOrientation = this._createElement("select", {id: "input-orientation"});
		this.inputOrientation.append(new Option("Portrait"));
		this.inputOrientation.append(new Option("Landscape"));
		this.inputOrientation.append(new Option("Auto"));
		l = this._createElement("label", {innerHTML: "Orientation:", for: this.inputOrientation.id});
		p = this._createElement("p");
		p.append(l, this.inputOrientation);
		container.append(p);

		this.inputMargin = this._createElement("input", {id: "input-inset", type: "number", defaultValue: 10}, {width: "3em"});
		l = this._createElement("label", {innerHTML: "Margin:", for: this.inputMargin.id});
		l.title = "Enter a margin to require the route to be contained in a sequence of rectangles that are smaller than the paper. Useful for countering printer bleed, ensuring an overlap to make the route easier to follow across pages, and to ensure a minimum of contextual map area around the route.";
		l.style.cursor = "help";
		p = this._createElement("p");
		p.append(l, this.inputMargin, " mm ");
		container.append(p);

		this.inputPrint = this._createElement("input", {id: "input-print", type: "button", value: "Print"}, {display: "inline", fontWeight: "bold", backgroundColor: "limegreen", borderRadius: "5px", border: "none"});
		this.inputPrint.title = "Print the map as a PDF file and automatically open it when complete.";
		this.printStatus = this._createElement("span", {});
		this.inputPages = this._createElement("input", {id: "input-pages", type: "text"});
		this.inputPages.title = "Comma-separated list of (ranges of) pages to print. For example, \"1, 3-5, 7\" prints page 1, 3, 4, 5 and 7. Clear to reset to all pages.";
		this.inputPages.addEventListener("change", function() {
			if (this.inputPages.value === "") {
				// if user clears the field, fill it automatically
				this.pdf.setPagesToPrint()
			} else {
				//update list of pages to print
				let pages = [];
				let matches = this.inputPages.value.match(/\d+(-\d+)?/g);
				if (matches && matches.length > 0) {
					for (const match of matches) {
						let s = match.split("-");
						let p1 = parseInt(s[0]);
						let p2 = parseInt(s.length == 2 ? s[1] : s[0]);
						for (let p = p1; p <= p2; p++) {
							pages.push(p-1); // 0-index
						}
					}
				}
				this.pdf.setPagesToPrint(pages);
			}
			this.previewRoute(); // update this field
		}.bind(this));
		this.inputPages.addEventListener("input", function() {
			this.inputPages.style.width = `${this.inputPages.value.length}ch`;
		}.bind(this));
		l = this._createElement("label", {}, {fontWeight: "normal"});
		l.append(" pages ", this.inputPages, this.printStatus);
		p = this._createElement("p");
		p.append(this.inputPrint, l);
		container.append(p);

		this.downloadLink = this._createElement("a", {"download": this.options.fileName}, {"display": "none"});
		container.append(this.downloadLink);

		divControls.append(container);

		// TODO: improve organization of wrapper, header, button, etc.

		var divButton = this._createElement("div", {}, {display: "flex", justifyContent: "space-between", borderBottom: "1px solid black"}); // float left and right using https://stackoverflow.com/a/10277235

		var header = this._createElement("p", {innerHTML: "<b>Print route settings</b>"}, {margin: "0", fontSize: "13px", padding: divControls.style.borderSpacing}); // padding should be same as borderSpacing in divControls
		var button = this._createElement("a", {innerHTML: "✖", href: "#"}, {display: "inline-block", width: "30px", height: "30px", lineHeight: "30px", fontSize: "22px"});
		var help = this._createElement("a", {innerHTML: "?", title: "You get what you see! Zoom the map to your preferred level of detail, modify these settings and hit Print. The color of the DPI value indicates the print quality.", href: "#"}, {display: "inline-block", width: "30px", height: "30px", lineHeight: "30px", fontSize: "22px", cursor: "help"});
		button.addEventListener("click", function() {
			if (divControls.style.display == "none") {
				divControls.style.display = "block";
				header.style.display = "block";
				button.innerHTML = "✖";
				help.style.display = "inline-block";
			} else {
				divControls.style.display = "none";
				header.style.display = "none";
				button.innerHTML = "P";
				help.style.display = "none";
			}
		});
		var buttonWrapper = this._createElement("div", {});
		buttonWrapper.append(help, button);
		divButton.append(header, buttonWrapper);

		divWrapper.append(divButton, divControls);

		this.inputScale.addEventListener("change", this.previewRoute.bind(this));
		this.inputWidth.addEventListener("change", function () {
			this.inputPreset.selectedIndex = 0
			this.previewRoute()
		}.bind(this));
		this.inputHeight.addEventListener("change", function () {
			this.inputPreset.selectedIndex = 0
			this.previewRoute()
		}.bind(this));

		this.inputPreset.addEventListener("change", function(event) {
			if (this.inputPreset.selectedIndex > 0) { // 0 is "free"
				this.inputWidth.value = this.pdf.getPageFormats()[this.inputPreset.selectedIndex-1].width;
				this.inputHeight.value = this.pdf.getPageFormats()[this.inputPreset.selectedIndex-1].height;
				this.previewRoute();
			}
		}.bind(this));
		this.inputOrientation.addEventListener("change", this.previewRoute.bind(this));
		this.inputMargin.addEventListener("change", this.previewRoute.bind(this));
		this.inputPrint.onclick = this.printRoute.bind(this);
		this.map.addEventListener("zoomend", this.previewRoute.bind(this));

		this.map.on("pdf:progress", this.onProgress, this)

		return divWrapper;
	},

	onProgress: function (p) {
		if (p.operation === "image") {
			this.setPrintStatus(`Creating image ${p.itemNo+1} of ${p.totalItems} ...`);
		} else if (p.operation === "page") {
			this.setPrintStatus(`Creating page ${p.itemNo+1} of ${p.totalItems} ...`);
		}
	},

	onRemove: function () {
		this.pdf.destroy()

		// remove events
		this.map.off("pdf:progress", this.onProgress)

		// todo need more accurate cleanup:
		//  	hide everything that may be visible
		// 		remove events handlers
	},

	setPrintStatus: function(status) {
		this.printStatus.innerHTML = status == undefined ? "" : " " + status;
	},

	previewRoute: function() {
		if (!this.hasRoute) {
			return;
		}

		// update common pdf options
		this.pdf.setScale(this.inputScale.value)
		let o = this.inputOrientation.value
		for (o of this.pdf.getPageOrientations()) {
			if (o.name === this.inputOrientation.value) {
				this.pdf.setPageOrientation(o.value)
				break
			}
		}
		this.pdf.setPageMargin(this.inputMargin.value)
		if (this.inputPreset.selectedIndex > 0) { // 0 is "free"
			this.pdf.setPageFormat(this.inputPreset.value)
		} else {
			this.pdf.setPageSize(this.inputWidth.value, this.inputHeight.value)
		}

		let pd = this.pdf.showPages()

		if (pd === null) {
			this.inputDPI.innerHTML = ""
			this.inputPages.value = ""
			this.setPrintStatus(`area isn't defined`);
			return
		}

		this.inputDPI.innerHTML = `${pd.dpi} DPI`;

		if (pd.pagesToPrint.length === pd.rects.length) {
			this.inputPages.value = `1-${pd.rects.length}`;
		}

		this.inputPages.style.width = `${this.inputPages.value.length}ch`;

		// indicate print quality with color
		var dpi1 = 0, hue1 = 0;     // horrible print quality  (red)
		var dpi2 = 300, hue2 = 140; // excellent print quality (green)
		var hue = Math.min(Math.floor((hue2 - hue1) * (pd.dpi - dpi1) / (dpi2 - dpi1)), hue2); // restrict to hue2
		this.inputDPI.style.color = `hsl(${hue}, 100%, 50%)`;

		//var dpi = Math.floor((wpxWorld / (wmmPaper / 25.4) + hpxWorld / (hmmPaper / 25.4)) / 2);
		this.setPrintStatus(`at ${Math.floor(pd.wpxWorld)} x ${Math.floor(pd.hpxWorld)} pixels`);
	},

	printRoute: function() {
		let backupButtonHandler
		let backupButtonColor
		this.map.once("pdf:finish", function (data) {
			this.inputPrint.value = "Print";
			this.inputPrint.style.backgroundColor = backupButtonColor;
			this.inputPrint.onclick = backupButtonHandler;
			this.previewRoute()
			if (data.blob) {
				this.downloadLink.href = URL.createObjectURL(data.blob);
				this.downloadLink.click(); // download
			} else {
				this.setPrintStatus("Aborted because of error");
			}
		}.bind(this))
		this.map.once("pdf:start", function (pagesData) {
			backupButtonHandler = this.inputPrint.onclick
			backupButtonColor = this.inputPrint.style.backgroundColor

			this.inputPrint.value = "Abort";
			this.inputPrint.style.backgroundColor = "red";
			this.inputPrint.onclick = function () {
				this.pdf.abort()
			}.bind(this);

		}.bind(this))
		this.pdf.print()
	},

	setRoute: function(line) {
		// line should already be added to map
		this.line = line;
		this.pdf.setArea(this.line)
		this.hasRoute = true;
		this.previewRoute();
	},

	setImageFormat: function(format = "jpeg") {
		if (format != "jpeg" && format != "png")
			throw `Invalid image format: "${format}"`;

		this.pdf.setImageFormat(format);
	},

	setFillColor: function(color = "gray", opacity = 0.2) {
		this.pdf.setFillColor(color, opacity)
	},

	setStrokeColor: function(color = "gray", opacity = 1.0) {
		this.pdf.setStrokeColor(color, opacity)
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
