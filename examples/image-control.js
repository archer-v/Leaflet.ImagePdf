/**
 * Leaflet.Pdf control UI component, (c) Alexander Cherviakov (https://github.com/mandalorian-one)
 * Oririginal UI control was written by
 * [Herman Sletmoen](https://github.com/hersle) (c) [leaflet-route-print](https://hersle.github.io/leaflet-route-print/)
 *
 */

L.Control.ImageControl = L.Control.extend({
	options: {
		position: "topleft",
		imagePdf: null,
		fileName: "example.pdf"
	},

	initialize: function(options) {
		if (options) {
			L.setOptions(this, options)
		}
		this.area = false;
		this.imagePdf = this.options.imagePdf

		this.css = document.createElement("style");
		document.head.appendChild(this.css)
		this.css.sheet.insertRule('.image-control form { display: table; }');
		this.css.sheet.insertRule('.image-control p { display: table-row;}');
		this.css.sheet.insertRule('.image-control p > label { display: table-cell; font-weight: bold; vertical-align: middle; }');
		this.css.sheet.insertRule('.image-control p > input { display: table-cell; }');
		this.css.sheet.insertRule('.image-control button { display: table-cell; }');
	},

	onAdd: function(map) { // constructor
		this.map = map;

		var divWrapper = this._createElement("div", {className: "leaflet-bar leaflet-control image-control"}, {backgroundColor: "white"});
		L.DomEvent.disableClickPropagation(divWrapper);
		L.DomEvent.disableScrollPropagation(divWrapper);

		var divControls = this._createElement("div", {}, {borderSpacing: "5px"});
		var container = this._createElement("form", {className: "text-input"});

		this.inputSize = this._createElement("input", {id: "input-size", type: "number", defaultValue: 1000}, {width: "4em"});
		this.inputType  = this._createElement("select", {id: "input-type"});
		this.inputType.append(new Option("jpeg"));
		this.inputType.append(new Option("png"));
		let l = this._createElement("label", {innerHTML: "Size:", for: this.inputSize.id});
		l.title = "Image size in pixels";
		l.style.cursor = "help";
		p = this._createElement("p");
		p.append(l, this.inputSize, " pixels ", " format ", this.inputType);
		container.append(p);

		this.inputPadding = this._createElement("input", {id: "input-padding", type: "number", defaultValue: 10}, {width: "3.5em"});
		l = this._createElement("label", {innerHTML: "Padding:", for: this.inputPadding.id});
		l.title = "Enter a padding";
		l.style.cursor = "help";
		p = this._createElement("p");
		p.append(l, this.inputPadding, " px");
		container.append(p);

		this.inputSquare = this._createElement("input", {id: "input-square", type: "checkbox", defaultValue: false});
		l = this._createElement("label", {innerHTML: "To square:", for: this.inputSquare.id});
		l.title = "Extend to square";
		l.style.cursor = "help";
		p = this._createElement("p");
		p.append(l, this.inputSquare);
		container.append(p);

		this.imagePixelSize = this._createElement("span", {});
		l = this._createElement("label", {innerHTML: "Image size:"});
		l.title = "The result image size";
		l.style.cursor = "help";
		var p = this._createElement("p");
		p.append(l,
			this.imagePixelSize,
			" pixels"
		);
		container.append(p);

		this.inputPrint = this._createElement("input", {id: "input-create-image", type: "button", value: "Create image"}, {display: "inline", fontWeight: "bold", backgroundColor: "limegreen", borderRadius: "5px", border: "none"});
		this.inputPrint.title = "Create the image and automatically download it when complete.";
		this.printStatus = this._createElement("span", {});
		this.printStatus.style.color = "orange";

		l = this._createElement("label", {}, {fontWeight: "normal"});
		l.append(this.printStatus);
		p = this._createElement("p");
		p.append(this.inputPrint, l);
		container.append(p);

		this.downloadLink = this._createElement("a", {"download": this.options.fileName}, {"display": "none"});
		container.append(this.downloadLink);


		divControls.append(container);

		var divButton = this._createElement("div", {}, {display: "flex", justifyContent: "space-between", borderBottom: "1px solid black"}); // float left and right using https://stackoverflow.com/a/10277235

		var header = this._createElement("p", {innerHTML: "<b>Image settings</b>"}, {margin: "0", fontSize: "13px", padding: divControls.style.borderSpacing}); // padding should be same as borderSpacing in divControls
		var button = this._createElement("a", {innerHTML: "✖", href: "#"}, {display: "inline-block", width: "30px", height: "30px", lineHeight: "30px", fontSize: "13px"});
		var help = this._createElement("a", {innerHTML: "?", title: "You get what you see! Modify these settings and hit Create image.", href: "#"}, {display: "inline-block", width: "30px", height: "30px", lineHeight: "30px", fontSize: "22px", cursor: "help"});
		button.addEventListener("click", function() {
			if (divControls.style.display == "none") {
				divControls.style.display = "block";
				header.style.display = "block";
				button.innerHTML = "✖";
				help.style.display = "inline-block";
			} else {
				divControls.style.display = "none";
				header.style.display = "none";
				button.innerHTML = "Img";
				help.style.display = "none";
			}
		});
		var buttonWrapper = this._createElement("div", {});
		buttonWrapper.append(help, button);
		divButton.append(header, buttonWrapper);

		divWrapper.append(divButton, divControls);

		this.inputSize.addEventListener("change", this.updatePreview.bind(this));
		this.inputPadding.addEventListener("change", this.updatePreview.bind(this));
		this.inputType.addEventListener("change", this.updatePreview.bind(this));
		this.inputSquare.addEventListener("change", this.updatePreview.bind(this));

		this.inputPrint.onclick = this.createImage.bind(this);

		this.map.on("imagePdf:progress", this.onProgress, this)

		this.updatePreview()

		return divWrapper;
	},

	onProgress: function (p) {
		if (p.operation === "tile") {
			let percent = Math.ceil((p.itemNo / p.totalItems) * 100)
			this.showProgress(`Creating image: ${percent}%`);
		}
	},

	onRemove: function () {
		// remove events
		this.map.off("imagePdf:progress", this.onProgress)
		this.imagePdf.hideImageRegions()

		// todo need more accurate cleanup:
		//  	hide everything that may be visible
		// 		remove events handlers
	},

	updatePreview: function(ev) {
		if (!this.area || !this.map) {
			return;
		}

		this.imagePdf.setImageFormat(this.inputType.value)

		let id = this.imagePdf.calcImages(
			this.inputSize.value,
			this.inputPadding.value,
			this.inputSquare.checked
		)

		if (!id) {
			this.imagePixelSize.hidden = true
			return
		}

		// calc target image size. why this calculation is doing here?
		let s = this.inputSize.value
		let w
		let h
		if (this.inputSquare.checked) {
			w = s
			h = s
		} else {
			let scale = id.dimensions.wpx / id.dimensions.hpx
			if (id.dimensions.wpx > id.dimensions.hpx) {
				w = s
				h = Math.floor(s / scale)
			} else {
				h = s
				w = Math.floor(s * scale)
			}

		}

		this.imagePixelSize.innerHTML = `${w} x ${h}`
		this.imagePixelSize.hidden = false

		this.imagePdf.showImageRegions(id)
	},

	createImage: function() {
		let backupButtonHandler
		let backupButtonColor
		this.map.once("imagePdf:finish", function (data) {
			this.inputPrint.value = "Create image";
			this.inputPrint.style.backgroundColor = backupButtonColor;
			this.inputPrint.onclick = backupButtonHandler;
			this.updatePreview()
			if (data.blob) {
				this.downloadLink.href = data.blob;
				this.downloadLink.click(); // download
				this.showProgress("Success");
			} else {
				this.showProgress("Aborted because of error");
			}
		}.bind(this))
		this.map.once("imagePdf:start", function (pagesData) {
			backupButtonHandler = this.inputPrint.onclick
			backupButtonColor = this.inputPrint.style.backgroundColor

			this.inputPrint.value = "Abort";
			this.inputPrint.style.backgroundColor = "red";
			this.inputPrint.onclick = function () {
				this.imagePdf.abort()
			}.bind(this);

		}.bind(this))

		this.imagePdf.createImage(
			this.inputSize.value,
			this.inputPadding.value,
			this.inputSquare.checked,
			true
		)
	},

	showProgress: function(status) {
		this.printStatus.innerHTML = status == undefined ? "" : " " + status;
	},

	setArea: function(area) {
		// line should already be added to map
		this.area = area;
		this.imagePdf.setArea(this.area)
		this.updatePreview();
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
