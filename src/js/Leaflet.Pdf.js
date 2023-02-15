import "jspdf";
import {
    coverLineWithRectangles, coverAreaWithRectangles, areaRectanglesCount
} from "./covering.js";

const DEBUG = false;
const PageOrientationPortrait = 0
const PageOrientationLandscape = 1
const PageOrientationAuto = 2

const StatusReady = 0
const StatusAtWork = 1
const StatusAborted = 2

const AlgCoverUnknown = 0
const AlgCoverArea = 1
const AlgCoverPath = 2

export const OpGenerateImage = "image"
export const OpCreatePage = "page"

L.Control.Pdf = L.Control.extend({
    options: {
        pageFormat: "A4",
        pageOrientation: PageOrientationPortrait,
        pageMargin: 10, //mm
        areaPadding: 10, //mm add padding to the area
        scale: 50000,
        pagingMethod: 'pages', // define paging method (possible values 'pages' | 'scale')
        pageCount: 1,
        pdfFileName: "map.pdf",
        tilesLoadingTimeout: 10000, // 10 sec
        imageFormat: "jpeg",
        pagePreviewStrokeColor: "gray",
        pagePreviewFillColor: "gray",
        pdfFontSize: 15, // default font size of text labels
        pdfPrintPageNumber: true,
        pdfPrintGraticule: true, // isn;t implemented
        pdfPrintScaleMeter: true, // isn;t implemented
        pdfDownloadOnFinish: false, // starts browser's file download process in order to save pdf file
        pdfAttributionText: "Printed with Leaflet.Pdf",
        pdfDocumentProperties: {}, // properties to add to the PDF document // property_name-to-property_value object structure
        skipNodesWithCSS: ['div.leaflet-control-container', 'div.control-pane-wrapper'],
        pdfPageCb: null, // callback function(pdf, pageNumber) that calls on every pdf page generation
                         // you can use it to add you custom text or data to pdf pages (see jspdf spec on how to operate with pdf document)
        nodeFilterCb: null, // callback function(domNode) that calls on every dom element and should return true or false
                            // in order to include or exclude element from pdf
        debug: false,
    },

    initialize: function (map, options) {
        if (options) {
            L.setOptions(this, options)
        }
        this.map = map;
        this.area = null; //region to print, can contain any Leaflet object that has getBounds method

        this.pageFormats = this.pageSizes()
        this.pageOrientations = [
            {name: "Portrait", value: PageOrientationPortrait},
            {name: "Landscape", value: PageOrientationLandscape},
            {name: "Auto", value: PageOrientationAuto},
        ]
        this.pageSize = {
            width: 0,
            height: 0,
        }

        this.status = StatusReady;
        this.savedMapState = null;

        this.pagesToPrint = [];

        // keep all page rectangles in one group
        this.rectGroup = L.layerGroup();

        if (this.options.debug) {
            this.debugRectGroup = L.layerGroup()
            this.debugRectGroup.addTo(map)
            this.debugRectStyle = {stroke: true, weight: 1, opacity: 0.8, color: "green", fillColor: "green", fillOpacity: 0.2};
        }

        //pdfDownloadOnFinish
        this.downloadLink = document.createElement("a")
        Object.assign(this.downloadLink.style, {"display": "none"});

        // css used on images generation stage
        this.css = document.createElement("style");
        this.css.disabled = true
        //this.css = new CSSStyleSheet() //isn't supported in safary yet
        document.head.appendChild(this.css)
        // prevent image opacity fade effect on tile load
        this.css.sheet.insertRule('.leaflet-tile-container > img {opacity: 1 !important;}', 0);

        this.setScale(this.options.scale)
        this.setImageFormat(this.options.imageFormat);
        this.setPagePreviewStrokeColor(this.options.pagePreviewStrokeColor);
        this.setPagePreviewFillColor(this.options.pagePreviewFillColor);
        this.setPageFormat(this.options.pageFormat)
        this.setPageOrientation(this.options.pageOrientation)
        this.setPageMargin(this.options.pageMargin)
        this.setPagesToPrint([])
        this.setPageCount(this.options.pageCount)
    },

    destroy: function () {
        this.hidePages()
        this.map.removeLayer(this.rectGroup);
    },

    pageSizes: function() {
        // list paper sizes from https://en.wikipedia.org/wiki/Paper_size#Overview_of_ISO_paper_sizes
        let paperSizes = [];
        let w = 0;
        let h = 0;
        for (let n = 0; n <= 6; n++) {
            w = Math.floor(841  / 2**(n/2));
            h = Math.floor(1189 / 2**(n/2));
            paperSizes.push({name: `A${n}`, width: w, height: h});
        }
        for (let n = 0; n <= 6; n++) {
            w = Math.floor(1000 / 2**(n/2));
            h = Math.floor(1414 / 2**(n/2));
            paperSizes.push({name: `B${n}`, width: w, height: h});
        }
        return paperSizes
    },

    /**
     * Returns current page size based on page orientation
     * @returns {{width: number, height: number}}
     * @private
     */
    _orientedPageSize: function () {
        let w = this.pageSize.width;
        let h = this.pageSize.height;
        if (this.pageOrientation === PageOrientationLandscape) { // swap width <-> height
            let wtmp = w; w = h; h = wtmp;
        }
        return {width: w, height: h}
    },

    /**
     *
     * @returns {object}
     * @private
     */
    _pageData: function (scale, wmmPaper, hmmPaper) {
        let pd = {
            sPaper: 1,
            sWorld: (scale != null) ? scale : this.scale,
            wmmPaper: wmmPaper,
            hmmPaper: hmmPaper,
            pmmPaper: this.pageMargin,
            pmmArea: this.options.areaPadding,
            regionCenter: this.area.getCenter(), //center of area
        }

        pd.paperToWorld = pd.sPaper / pd.sWorld;
        pd.worldToPaper = 1 / pd.paperToWorld;
        pd.wmmWorld = pd.wmmPaper * (pd.sWorld / pd.sPaper);
        pd.hmmWorld = pd.hmmPaper * (pd.sWorld / pd.sPaper);
        pd.pmmWorld = pd.pmmPaper * (pd.sWorld / pd.sPaper);
        pd.pmmAreaWorld = pd.pmmArea * (pd.sWorld / pd.sPaper)

        // page dimension in points at current map zoom level
        pd.wpxWorld = this.metersToPixels(pd.wmmWorld / 1000, pd.regionCenter);
        pd.hpxWorld = this.metersToPixels(pd.hmmWorld / 1000, pd.regionCenter);
        // page margin
        pd.ppxWorld = this.metersToPixels(pd.pmmWorld / 1000, pd.regionCenter);

        pd.dpi = Math.round(this.scaleToDPI(pd.sWorld));
        // area padding in points at current map zoom level
        pd.appx = this.metersToPixels(pd.pmmAreaWorld / 1000, pd.regionCenter);

        return pd
    },

    computeScaleAccordingPageCount: function (pageCount = 1) {

        pageCount *= 1
        let pageSize = this._orientedPageSize()
        let bounds = this.area.getBounds()
        let topLeft = this.map.project(bounds.getNorthWest())
        let bottomRight = this.map.project(bounds.getSouthEast())
        let areaW = bottomRight.x - topLeft.x // area width in points
        let areaH = bottomRight.y - topLeft.y
        let pd = this._pageData(this.scale, pageSize.width, pageSize.height) // only several
        // computes scale we need to use in order the area fits into one page
        let onePagesScaleW = Math.ceil(pd.sPaper * (this.pixelsToMeters(areaW, pd.regionCenter)) * 1000 / (pd.wmmPaper - pd.pmmPaper * 2 - pd.pmmArea * 2))
        let onePagesScaleH = Math.ceil(pd.sPaper * (this.pixelsToMeters(areaH, pd.regionCenter)) * 1000 / (pd.hmmPaper - pd.pmmPaper * 2 - pd.pmmArea * 2))
        let onePagesScale = Math.max(onePagesScaleW, onePagesScaleH)

        if (this.options.debug) {
            // draw bounds area
            let rect = [this.map.unproject(topLeft), this.map.unproject(bottomRight)];
            L.rectangle(rect, this.debugRectStyle).addTo(this.debugRectGroup);
        }

        let algorithm = this.rectanglesEvaluationMethod(this.area)
        let computePageCount = function (scale) {
            return 0
        }

        if (pageCount === 1 && (! this.area instanceof L.Polygon))
            return onePagesScale

        if (algorithm === AlgCoverArea) {
            computePageCount = function (scale) {
                let pd = this._pageData(scale, pageSize.width, pageSize.height)
                let [rows, cols] = areaRectanglesCount(topLeft.subtract([pd.appx, pd.appx]), bottomRight.add([pd.appx, pd.appx]), pd.wpxWorld - 2 * pd.ppxWorld, pd.hpxWorld - 2 * pd.ppxWorld)
                return rows * cols
            }.bind(this)
        } else if (algorithm === AlgCoverPath) {
            computePageCount = function (scale) {
                let pd = this._pageData(scale, pageSize.width, pageSize.height)
                let rects = this._getRouteRectangles(this.area, pd.wpxWorld, pd.hpxWorld, pd.ppxWorld, pd.appx, this.pageOrientation)
                return rects.length
            }.bind(this)
        }

        let iterations = 0;
        let scale = onePagesScale
        let step = -scale / 2
        let bestScale = 0
        while (step > 10 || step < - 10) {
            let switchDirection = false
            iterations++
            let c = computePageCount(scale)
            if (c > pageCount) {
                switchDirection = (step < 0)
            } else if (c < pageCount) {
                switchDirection = (step > 0)
            } else {
                bestScale = scale
                step = Math.abs(step) * -1
            }
            // need to switch direction and decrease the step
            if (switchDirection)
                step = -step / 2
            if (scale + step < 1) {
                step = step / 2
            }
            scale = scale + step
            if (iterations > 1000 || c === 0) {
                console.error("something got wrong, to much iterations")
                break
            }
        }
        if (bestScale > 0)
            scale = bestScale
        if (this.options.debug) {
            console.log(`computeScale iterations: ${iterations}`)
        }

        return Math.ceil(scale)
    },

    rectanglesEvaluationMethod: function (LObject) {
        if ( LObject instanceof L.Polygon || (LObject instanceof L.Polyline && this.isPagesPaging() && this.pageCount == 1)) {
            return AlgCoverArea
        } else if ( LObject instanceof L.Polyline) {
            return AlgCoverPath
        }
        console.log("unknown geometry type")
        return AlgCoverUnknown
    },
    /**
     * computes pages data according current map state and pages and pdf settings
     * @returns {object} pages data that can be used to page generation
     */
    computePages: function () {
        if (this.area === null)
            return null;

        if (this.area._map === null) {
            // object is not added to the map (or removed)
            return null;
        }

        if (this.options.debug) {
            this.debugRectGroup.clearLayers();
        }

        let scale = this.scale
        if (this.isPagesPaging()) {
            scale = this.computeScaleAccordingPageCount(this.pageCount)
        }

        let pageSize = this._orientedPageSize()
        let pd = this._pageData(scale, pageSize.width, pageSize.height)

        pd.rects = []
        pd.images = []

        let algorithm = this.rectanglesEvaluationMethod(this.area)
        let getRectangles =
            (algorithm === AlgCoverArea) ? this._getBoxRectangles.bind(this) :
                (algorithm === AlgCoverPath) ? this._getRouteRectangles.bind(this) :
                function () {return []}

        pd.rects = getRectangles(this.area, pd.wpxWorld, pd.hpxWorld, pd.ppxWorld, pd.appx, this.pageOrientation)

        // pad rectangles with margin
        for (let i = 0; i < pd.rects.length; i++) {
            let rotated = pd.rects[i].rotated; // property is destroyed after padding
            pd.rects[i] = pd.rects[i].pad(pd.ppxWorld);
            pd.rects[i].rotated = rotated;
        }

        pd.pageCount = pd.rects.length
        pd.pagesToPrint = []

        // prepare list of page numbers to print if pagesToPrintDefined
        if (this.pagesToPrintDefined.length > 0) {
            for (let p = 0; p < pd.rects.length; p++) {
                if (this.pagesToPrintDefined.includes(p))
                    pd.pagesToPrint.push(p);
            }
        } else {
            for (let p = 0; p < pd.rects.length; p++) {
                pd.pagesToPrint.push(p);
            }
        }

        pd.pagesToPrintCount = pd.pagesToPrint.length
        return pd
    },

    /**
     * shows pages preview rectangles on the map
     * @returns {{hmmPaper, regionCenter: *, sWorld: (*|number), sPaper: number, pmmPaper: number, wmmPaper}}
     */
    showPages: function () {
        if (this.area === null || this.status !== StatusReady)
            return;

        let printData = this.computePages()
        if (printData) {
            this._showPageRectangles(printData.rects, printData.ppxWorld)
        } else {
            this.hidePages()
        }
        return printData
    },

    /**
     * hides pages preview rectangles on the map
     */
    hidePages: function () {
        this.rectGroup.clearLayers();
    },

    _lockMap: function() {
        this.savedMapState = {
            width: this.map.getContainer().style.width,
            height: this.map.getContainer().style.height,
            center: this.map.getCenter(),
            zoom: this.map.getZoom()
        }
        this.map.removeLayer(this.rectGroup);
        this.fireMapLocked()
    },

    _restoreMap: function () {
        this.map.getContainer().style.width = this.savedMapState.width;
        this.map.getContainer().style.height = this.savedMapState.height;
        this.map.setView(this.savedMapState.center, this.savedMapState.zoom, {animate: false})
        this.map.invalidateSize();

        //this.map.addLayer(this.rectGroup);
        this.fireMapRestored()
    },

    /**
     * disables map controls and input
     * @private
     */
    _disableInput: function() {
        //console.log("input disabled");
        this.map.boxZoom.disable();
        this.map.doubleClickZoom.disable();
        this.map.dragging.disable();
        this.map.keyboard.disable();
        this.map.scrollWheelZoom.disable();
        if (this.map.tapHold) this.map.tapHold.disable(); // specific to mobile Safari
        this.map.touchZoom.disable();
    },

    /**
     * restores map controls and input
     * @private
     */
    _enableInput: function() {
        //console.log("input enabled");
        this.map.boxZoom.enable();
        this.map.doubleClickZoom.enable();
        this.map.dragging.enable();
        this.map.keyboard.enable();
        this.map.scrollWheelZoom.enable();
        if (this.map.tapHold) this.map.tapHold.enable(); // specific to mobile Safari
        this.map.touchZoom.enable();
    },

    /**
     * starts a background pdf generation process, the map will be locked
     * subscribe to pdf events in order to control printing and catch the result
     * @returns {boolean} false if there are already running printing
     */
    print: function () {
        if (this.status !== StatusReady) {
            return false
        }

        let pagesData = this.computePages()
        this.status = StatusAtWork
        this.fireStarted(pagesData)
        this._lockMap()
        document.addEventListener("pdf:imagesCompleted", this._createPdf.bind(this, pagesData), {once: true});

        this._createImages(pagesData);
    },

    /**
     * aborts a running pdf generation
     */
    abort: function () {
        if (this.status !== StatusAtWork)
            return

        this.status = StatusAborted
    },

    /**
     * _createPdf creates pdf and fire the finish event with data set to pdf blob on success or null on fail / abort
     * don't call it directly
     * @param {PagesData}
     * @private
     */
    _createPdf(pd) {

        let blob = null
        let finish = function () {
            this._restoreMap();
            this.status = StatusReady;
            this.fireFinish(blob)
        }.bind(this)

        if (this.status === StatusAborted) {
            finish()
            return
        }

        let pdf = null;
        for (let i = 0; i < pd.pagesToPrint.length; i++) {
            let rect = pd.rects[pd.pagesToPrint[i]];
            this.fireProgress(OpCreatePage, i, pd.pagesToPrint.length, rect)
            let w, h;
            // recognize rotated portrait/landscape rectangles
            if (rect.rotated) {
                w = pd.hmmPaper;
                h = pd.wmmPaper;
            } else {
                w = pd.wmmPaper;
                h = pd.hmmPaper;
            }
            let orientation = w > h ? "landscape" : "portrait";
            try {
                if (pdf == null) {
                    pdf = new jspdf.jsPDF({format: [w, h], orientation: orientation, compress: true});
                    pdf.setFontSize(this.options.pdfFontSize);
                    if (this.options.pdfDocumentProperties !== null && Object.keys(this.options.pdfDocumentProperties).length > 0) {
                        pdf.setDocumentProperties(this.options.pdfDocumentProperties)
                    }
                }  else {
                    pdf.addPage([w, h], orientation);
                }
                pdf.addImage(pd.images[i], this.imageFormat, 0, 0, w, h, undefined, "FAST");
                if (this.options.pdfAttributionText !== "") {
                    pdf.text(this.options.pdfAttributionText, 0+5, 0+5, {align: "left", baseline: "top"});
                }
                if (this.options.pdfPrintPageNumber) {
                    pdf.text(`Page ${pd.pagesToPrint[i]+1} of ${pd.pageCount}`, w-5, 0+5, {align: "right", baseline: "top"});
                }

                if (this.options.pdfPageCb && typeof this.options.pdfPageCb === "function") {
                    this.options.pdfPageCb(pdf, pd.pagesToPrint[i])
                }
                //pdf.text(`Scale ${pd.sPaper} : ${pd.sWorld}`, 0+5, h-5, {align: "left", baseline: "bottom"});
                //let attrib = this._getAttribution();
                //if (attrib) {
                //    pdf.text(attrib, w-5, h-5, {align: "right", baseline: "bottom"});
                //}
            } catch (e) {
                console.error(e)
                this.status = StatusAborted
                break
            }
        }
        if (this.status === StatusAborted) {
            finish()
            return
        }
        blob = pdf.output("blob", {filename: this.options.pdfFileName});
        if (this.options.pdfDownloadOnFinish) {
            Object.assign(this.downloadLink, {"download": this.options.pdfFileName});
            this.downloadLink.href = URL.createObjectURL(blob);
            this.downloadLink.click(); // download
        }

        finish()
    },

    /**
     * creates images
     * @param pd {object} describes pages to create (including their dimensions, scaling, position, etc)
     * @private
     */
    _createImages: function(pd) {

        let rects = pd.rects
        let pageIndexes = pd.pagesToPrint

        let finish = function () {
            this._enableInput();
            //document.head.removeChild(this.css);
            this.css.disabled = true
            document.removeEventListener("pdf:documentTilesLoaded", generateImage)
            document.removeEventListener("pdf:startNextImage", prepareDocumentForImaging)
            document.dispatchEvent(new Event("pdf:imagesCompleted"));
        }.bind(this)

        // filter out from printing some elements (buttons, dialogs, etc)
        let filter = function (nodeElement) {
            //console.log(node.nodeName + "." + node.className)
            if (nodeElement.matches)
                for (let s of this.options.skipNodesWithCSS) {
                    if (nodeElement.matches(s))
                        return false
                }
            if (this.options.nodeFilterCb && typeof this.options.nodeFilterCb === "function")
                return this.options.nodeFilterCb(nodeElement)

            return true
        }.bind(this)

        let imageGenerator = function () {
            throw ("image generator isn't implemented")
        }

        if (this.imageFormat === "jpeg") {
            imageGenerator = domtoimage.toJpeg
        } else if (this.imageFormat === "png") {
            imageGenerator = domtoimage.toPng
        }

        let generateImage = function (ev) {
            let i = ev.detail.i
            let r = pd.rects[pageIndexes[i]]
            imageGenerator(this.map.getContainer(), {width: r.width, height: r.height, filter: filter})
                .then(function (dataUrl) {
                    if (this.status === StatusAborted) {
                        finish()
                        return;
                    }
                    pd.images.push(dataUrl);
                    document.dispatchEvent(new CustomEvent("pdf:startNextImage", {detail: {i:i+1}}))
                    //createImage(i+1);
                }.bind(this))
                .catch(function (er) {
                    this.fireAborted("internal error")
                    this.status = StatusAborted
                    finish()
                });
        }.bind(this)

        let prepareDocumentForImaging = function(ev) {
            try {
                let i = ev.detail.i

                let p = pageIndexes[i];

                if (i === pageIndexes.length || this.status === StatusAborted) {
                    finish()
                    return;
                }

                let timestamp = new Date().getTime()
                let r = rects[p];
                this.fireProgress(OpGenerateImage, i, pageIndexes.length, r)
                let w = r.width;
                let h = r.height;
                let c = this.map.unproject(r.middle);

                this.map.getContainer().style.width = `${w}px`;
                this.map.getContainer().style.height = `${h}px`;
                this.map.invalidateSize();
                this.map.setView(c, this.map.getZoom(), {animate: false});

                //need to wait the all tiles is loaded
                let printInterval = setInterval(function () {
                    if (new Date().getTime() - timestamp > this.options.tilesLoadingTimeout) {
                        this.status = StatusAborted
                        this.fireAborted("timeout")
                    }
                    if (this.status === StatusAborted) {
                        clearInterval(printInterval);
                        finish()
                        return;
                    }
                    if (this._isTilesLoaded(this.map)) {
                        clearInterval(printInterval);
                        document.dispatchEvent(new CustomEvent("pdf:documentTilesLoaded", {detail: {i:i}}))
                    }
                }.bind(this), 50);
            } catch (e) {
                this.fireAborted("internal error")
                finish()
            }
        }.bind(this);

        document.addEventListener("pdf:documentTilesLoaded", generateImage);
        document.addEventListener("pdf:startNextImage", prepareDocumentForImaging);

        this._disableInput();
        this.css.disabled = false
        document.dispatchEvent(new CustomEvent("pdf:startNextImage", {detail: {i:0}}))
    },

    /**
     * checks if all tiles is loaded
     * @param map
     * @returns {boolean}
     * @private
     */
    _isTilesLoaded: function(map){
        for (let l in map._layers) {
            let layer = map._layers[l];
            if ((layer._url || layer._mutant) && layer._loading) {
                return false
            }
        }
        return true;
    },

    fireEvent: function (name, data) {
        this.map.fire("pdf:"+ name, data)
    },

    fireStarted: function (data) {
        this.fireEvent("start", data)
    },

    fireFinish: function (blob) {
        this.fireEvent("finish", {blob: blob})
    },

    fireProgress: function (operation, itemNo, totalItems, item) {
        this.fireEvent("progress", {operation: operation, itemNo: itemNo, totalItems: totalItems, item: item})
    },

    fireMapLocked: function () {
        this.fireEvent("mapLocked")
    },

    fireMapRestored: function () {
        this.fireEvent("mapRestored")
    },

    fireAborted: function (reason) {
        this.fireEvent("aborted", {reason: reason})
    },

    _getAttribution: function() {
        let attrib = undefined;
        this.map.eachLayer(function(layer) {
            if (attrib === undefined && layer.getAttribution()) {
                attrib = layer.getAttribution().replace(/<[^>]*>/g, "");
            }
        });
        return attrib;
    },

    pixelsToMeters: function(pixels, pos) {
        // https://stackoverflow.com/questions/49122416/use-value-from-scale-bar-on-a-leaflet-map
        let point1 = this.map.latLngToLayerPoint(pos).add(L.point(-pixels/2, 0));
        let point2 = this.map.latLngToLayerPoint(pos).add(L.point(+pixels/2, 0));
        point1 = this.map.layerPointToLatLng(point1);
        point2 = this.map.layerPointToLatLng(point2);
        return point1.distanceTo(point2);
    },

    metersToPixels: function(meters, pos) {
        return meters / this.pixelsToMeters(1, pos);
    },

    scaleToDPI: function(scale) {
        let sPaper = 1;
        let sWorld = scale;

        let size = this._orientedPageSize()
        let wmmPaper = size.width;
        let hmmPaper = size.height;
        let paperToWorld = sPaper / sWorld;
        let worldToPaper = 1 / paperToWorld;
        let wmmWorld = wmmPaper * worldToPaper;
        let hmmWorld = hmmPaper * worldToPaper;

        let routeCenter = this.area.getCenter();
        let wpxWorld = this.metersToPixels(wmmWorld / 1000, routeCenter);
        let hpxWorld = this.metersToPixels(hmmWorld / 1000, routeCenter);

        let dpix = wpxWorld / (wmmPaper / 25.4);
        let dpiy = hpxWorld / (hmmPaper / 25.4);
        let dpi = (dpix + dpiy) / 2;
        return dpi;
    },

    DPIToScale: function(dpi) {
        let size = this._orientedPageSize()
        let wmmPaper = size.width;
        let hmmPaper = size.height;
        let wpxWorld = dpi / 25.4 * wmmPaper;
        let hpxWorld = (hmmPaper / wmmPaper) * wpxWorld;
        let sWorldx = 1 * this.pixelsToMeters(wpxWorld, this.area.getCenter()) * 1000 / wmmPaper;
        let sWorldy = 1 * this.pixelsToMeters(hpxWorld, this.area.getCenter()) * 1000 / hmmPaper;
        let sWorld = (sWorldx + sWorldy) / 2;
        return sWorld;
    },

    _showPageRectangles: function (rects, p) {
        this.rectGroup.clearLayers();
        for (let i = 0; i < rects.length; i++) {
            let bigRect = rects[i];
            let smallRect = bigRect.pad(-p);

            smallRect = [this.map.unproject(smallRect.min), this.map.unproject(smallRect.max)];
            bigRect = [this.map.unproject(bigRect.min), this.map.unproject(bigRect.max)];

            L.rectangle(bigRect,
                {stroke: true,
                    weight: 1,
                    opacity: this.rectStrokeOpacity,
                    color: this.rectStrokeColor,
                    fillColor: this.rectFillColor,
                    fillOpacity: this.rectFillOpacity}).addTo(this.rectGroup);
            L.rectangle(smallRect,
                {stroke: true,
                    weight: 1,
                    opacity: this.rectStrokeOpacity,
                    color: this.rectStrokeColor,
                    fill: false}).addTo(this.rectGroup);
        }
        if (this.rectGroup._map == null) {
            this.rectGroup.addTo(this.map);
        }
    },

    _getBoxRectangles: function (LObject, w, h, p, areaPadding, o) {
        if (LObject === null || typeof LObject.getBounds !== "function")
            return []

        let topLeft = this.map.project(LObject.getBounds().getNorthWest()).subtract([areaPadding,areaPadding])
        let bottomRight = this.map.project(LObject.getBounds().getSouthEast()).add([areaPadding,areaPadding])

        const rects = coverAreaWithRectangles(topLeft, bottomRight, w-2*p, h-2*p)

        return rects
    },

    _getRouteRectangles: function(LObject, w, h, p, ap, o) {
        if (LObject === null || typeof LObject.getLatLngs !== "function")
            return []

        let ll = LObject.getLatLngs()

        if (ll.length === 0) {
            return [];
        }

        if (ll[0] instanceof Array) {
            // multidimensional array (possible multipath ? )
            // we will get only first path
            ll = ll[0]
        }
        let l = ll.slice(); // copy array (algorithm will modify it) TODO: don't modify
        for (let i = 0; i < l.length; i++) {
            l[i] = this.map.project(l[i]); // geo to pixel coords (so paper size becomes meaningful)
        }
        const [rects, intersections] = coverLineWithRectangles(l, w-2*p, h-2*p, o === PageOrientationAuto);

        // show intersection points (only for debugging purposes)
        if (this.options.debug) {
            // convert from pixel coordinates back to geographical coordinates
            for (let i = 0; i < intersections.length; i++) {
                intersections[i] = this.map.unproject(intersections[i]);
            }

            for (const p of intersections) {
                L.circleMarker(p, {radius: 5, stroke: false, color: "black", opacity: 1, fillOpacity: 1.0}).addTo(this.debugRectGroup);
            }
        }

        return rects;
    },

    isScalePaging() {
        return this.options.pagingMethod === "scale"
    },

    isPagesPaging() {
        return this.options.pagingMethod === "pages"
    },

    setArea: function (area) {
        if (area === null || typeof area !== 'object' || typeof area.getBounds !== 'function') {
            throw new Error("the area must have getBounds or LatLng method")
        }
        this.area = area
    },

    setScale: function(scale) {
        this.scale = parseInt(scale)
    },

    getScale: function() {
        return this.scale
    },

    /**
     * setPageCount defines the number of pages the area will be divided into
     * used only if pagingMethod set to 'pages'
     * @param pages
     */
    setPageCount: function (pages = 1) {
        if (pages === 0)
            pages = 1
        this.pageCount = pages
    },

    /**
     *
     * @returns {number}
     */
    getPageCount: function () {
        return this.pageCount
    },
    /**
     * setPageOrientation defines pdf page orientation
     * @param orientation
     */
    setPageOrientation: function (orientation) {
        for (let o of this.pageOrientations) {
            if (typeof orientation.toLowerCase === 'function' &&
                o.name.toLowerCase() === orientation.toLowerCase()) {
                this.pageOrientation = o.value
                return
            }
            if (o.value === orientation) {
                this.pageOrientation = orientation
                return
            }
        }
        //default page orientation
        this.pageOrientation = this.options.pageOrientation
    },

    /**
     * setPageMargin defines pdf page margin in mm
     * @param mm
     */
    setPageMargin: function (mm) {
        this.pageMargin = parseInt(mm)
    },

    /**
     * setPagesToPrint defines page numbers to include into pdf document
     * @param pagesNumbers
     */
    setPagesToPrint: function (pagesNumbers) {
        if (typeof pagesNumbers !== 'object') {
            this.pagesToPrintDefined = []
        } else {
            this.pagesToPrintDefined = pagesNumbers.slice()
        }
    },

    /**
     * setPageFormat defines page format
     * @param name
     */
    setPageFormat: function (name) {
        let i = this.pageFormats.findIndex(size => size.name === name)
        if (i === -1) {
            i = this.pageFormats.findIndex(size => size.name === this.options.pageFormat)
        }
        this.pageFormat = this.pageFormats[i];
        this.pageSize.width = this.pageFormat.width
        this.pageSize.height = this.pageFormat.height
    },

    setPageSize: function (width, height) {
        if ((width > 0) && (height > 0)) {
            this.pageSize.width = parseInt(width)
            this.pageSize.height = parseInt(height)
            this.pageFormat = null
        }
    },

    getPageFormats: function () {
      return this.pageFormats
    },

    getPageFormat: function () {
        return this.pageFormat
    },

    getPageOrientations: function () {
        return this.pageOrientations
    },

    setImageFormat: function(format) {
        if (format != "jpeg" && format != "png") {
            throw `Invalid image format: "${format}"`;
        }
        this.imageFormat = format;
    },

    setPagePreviewFillColor: function(color, opacity = 0.2) {
        this.rectFillColor = color;
        this.rectFillOpacity = opacity;
    },

    setPagePreviewStrokeColor: function(color, opacity = 1.0) {
        this.rectStrokeColor = color;
        this.rectStrokeOpacity = opacity;
    }
})

/**
 *
 * @param id
 * @param options
 * @returns {L.Pdf}
 */
L.pdf = function (map, options) {
    return new L.Control.Pdf(map, options);
};