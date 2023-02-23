import "jspdf";
//import * as htmlToImage from 'html-to-image';
import {
    coverLineWithRectangles, coverAreaWithRectangles, areaRectanglesCount, Rectangle
} from "./covering.js";
import {resizeImage} from "./image-processing";
import {changeDpiBlob, changeDpiDataUrl} from 'changedpi';

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
export const OpLoadTiles = "tile"

let progressSplashScreenDefaultStyle = {width: "100vw", height: "100vw", background: "white", "z-index": 950, position: "fixed", top: "0px", left: "0px", "justify-content": "center", "align-items": "center"}

L.Control.Pdf = L.Control.extend({
    options: {
        pageFormat: "A4",
        pageOrientation: PageOrientationPortrait,
        pageMargin: 10, //mm
        areaPadding: 10, //mm, add padding to the area
        pagingMethod: 'pages',  // define paging method for multi-page pdf generation
                                // (possible values 'pages' | 'scale'), it's better to use 'pages'
                                // 'scale' method now is buggy
        scale: 50000,           // default starting scale for 'scale' paging method
        pageCount: 1,           // default pages count for 'pages' paging method
        dpi: 300,               // define max target images dpi, it defines how deep the map will be zoomed to create images
                                // the resulting image dpi depends on available tiles images resolution and page size in mm
                                // the better available dpi will be used
                                // higher dpi value leads to downloading more tiles and greatly increase images generation time
        maxZoom: null,          // define map maximum zoom level we can fall to load image tiles
                                // if null it will be evaluated from map.getMaxZoom()
                                // can be number, or function, that should return the number
        outputFileName: "map.pdf", // can be with or without file extension
        downloadOnFinish: false, // starts browser's file download process in order to save pdf file
        tilesLoadingTimeout: 10000, // msec, timeout for tile loading on every page(image) generation
        imageFormat: "jpeg",    // 'jpeg' or 'png'
        imagePixelRatio: 1,     // for generate images for retina screens. set to 2 or window.devicePixelRatio
        showProgressSplashScreen: true,
        progressSplashScreenStyle: progressSplashScreenDefaultStyle,
        rectanglePreviewStyle: {
            stroke: true,
            weight: 1,
            opacity: 1,
            color: "gray",
            fillColor: "gray",
            fillOpacity: 0.2
        },
        pdfFontSize: 15, // default font size of text labels in pdf document
        pdfPrintGraticule: true, // isn;t implemented yet
        pdfPrintScaleMeter: true, // isn;t implemented yet
        pdfSheetPageNumber: {       // add page number to a sheet at defined position
            position: "bottomright",
        },
        pdfSheetAttribution: {      // add attribution text to a sheet at defined position
            position: "topleft",
            text: "Created with Leaflet.Pdf"
        },
        pdfDocumentProperties: {    // properties to add to the PDF document // name-to-value object structure
            'creator': "Leaflet.Pdf"
        },
        skipNodesWithCSS: ['div.leaflet-control-container', 'div.control-pane-wrapper', 'div.pdf-progress-plug'], // exclude these nodes from images
        pdfPageCb: null, // callback function(pdf, pageNumber) that calls on every pdf page generation
                         // you can use it to add you custom text or data to pdf pages (see jspdf spec on how to operate with pdf document)
        nodeFilterCb: null, // callback function(domNode) that calls on every dom element and should return true or false
                            // in order to include or exclude element from images and pdf
        debug: false,
    },

    initialize: function (map, options) {
        if (options) {
            L.setOptions(this, options)
        }

        this.options.progressSplashScreenStyle = Object.assign({}, progressSplashScreenDefaultStyle, this.options.progressSplashScreenStyle)

        this.pixelRatio = this.options.imagePixelRatio || 1 // experimental, for HIDPI devices with retina screens and display scaling,
                                                            // we need to generate images with correct DPI value written to the image
        this.baseImageDpi = 72;
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

        this.progressDiv = document.createElement("div")
        Object.assign(this.progressDiv, {className: 'pdf-progress-plug'});
        Object.assign(this.progressDiv.style, this.options.progressSplashScreenStyle,{display: "none"});
        this.map._container.append(this.progressDiv)

        this.setScale(this.options.scale)
        this.setImageFormat(this.options.imageFormat);
        this.setRectPreviewStyle(this.options.rectanglePreviewStyle)
        this.setPageFormat(this.options.pageFormat)
        this.setPageOrientation(this.options.pageOrientation)
        this.setPageMargin(this.options.pageMargin)
        this.setPagesToPrint([])
        this.setPageCount(this.options.pageCount)
    },

    destroy: function () {
        this.hideImageRegions()
        this.map.removeLayer(this.rectGroup);
        this.map._container.remove(this.progressDiv)
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
            dimensionsAtCurrentZoom: {},
            dimensions: {},
            targetZoom: 0
        }

        let paperToWorld = pd.sPaper / pd.sWorld;
        let worldToPaper = 1 / paperToWorld;
        let wmmWorld = pd.wmmPaper * worldToPaper;
        let hmmWorld = pd.hmmPaper * worldToPaper;
        let pmmWorld = pd.pmmPaper * worldToPaper;
        let pmmAreaWorld = pd.pmmArea * worldToPaper;

        // page dimension in points at current map zoom level
        let cd = {
            wpx: this.metersToPixels(wmmWorld / 1000, pd.regionCenter),
            hpx: this.metersToPixels(hmmWorld / 1000, pd.regionCenter),
            // page margin
            ppx: this.metersToPixels(pmmWorld / 1000, pd.regionCenter),
            // area padding in points at current map zoom level
            appx: this.metersToPixels(pmmAreaWorld / 1000, pd.regionCenter),
            dpi: Math.round(this.scaleToDPI(pd.sWorld))
        }
        pd.dimensionsAtCurrentZoom = cd

        pd.targetScale = this.options.dpi / cd.dpi

        Object.assign(pd, this._calcTargetZoomAndScale(pd.targetScale, parseInt))
        pd.dpi = pd.dimensionsAtCurrentZoom.dpi / pd.scaleToTargetZoom

        pd.dimensions = {
            wpx: Math.floor(cd.wpx / pd.scaleToTargetZoom),
            hpx: Math.floor(cd.hpx / pd.scaleToTargetZoom),
            // page margin
            ppx: Math.floor(cd.ppx / pd.scaleToTargetZoom),
            // area padding in points at current map zoom level
            appx: Math.floor(cd.appx / pd.scaleToTargetZoom),
            dpi: pd.dpi
        }
        return pd
    },

    computeScaleAccordingPageCount: function (pageCount = 1) {

        pageCount *= 1
        let pageSize = this._orientedPageSize()
        let bounds = (this.area instanceof L.LatLngBounds) ? this.area : this.area.getBounds()
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

        // for route with one page covering returns the scale for route bounds
        if (pageCount === 1 && algorithm === AlgCoverPath)
            return onePagesScale

        if (algorithm === AlgCoverArea) {
            computePageCount = function (scale) {
                let pd = this._pageData(scale, pageSize.width, pageSize.height).dimensionsAtCurrentZoom
                let [rows, cols] = areaRectanglesCount(topLeft.subtract([pd.appx, pd.appx]), bottomRight.add([pd.appx, pd.appx]), pd.wpx - 2 * pd.ppx, pd.hpx - 2 * pd.ppx)
                return rows * cols
            }.bind(this)
        } else if (algorithm === AlgCoverPath) {
            computePageCount = function (scale) {
                let pd = this._pageData(scale, pageSize.width, pageSize.height).dimensionsAtCurrentZoom
                let rects = this._getRouteRectangles(this.area, pd.wpx, pd.hpx, pd.ppx, pd.appx, this.pageOrientation)
                return rects.length
            }.bind(this)
        }

        // sorts through the pages placements variants at different scale to get the better
        // initially it was developed for paging along the route
        // for rectangles it can be replaced with simple algorithm
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
        if ( LObject instanceof L.LatLngBounds ||
             LObject instanceof L.Polygon ||
            (LObject instanceof L.Polyline && this.isPagesPaging() && this.pageCount == 1)) {
            return AlgCoverArea
        } else if ( LObject instanceof L.Polyline) {
            return AlgCoverPath
        }
        console.log("unknown geometry type")
        return AlgCoverUnknown
    },
    /**
     * computes pages data according current map state and pages and pdf settings
     * @returns {object} pages data that is used to page generation
     */
    calcPdfPages: function () {
        if (!this.area)
            return null;

        if (this.area instanceof L.Polyline && !this.area._map) {
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

        pd.rectsAtCurrentZoom = []
        pd.rects = []
        pd.images = []

        let algorithm = this.rectanglesEvaluationMethod(this.area)
        let getRectangles =
            (algorithm === AlgCoverArea) ? this._getBoxRectangles.bind(this) :
                (algorithm === AlgCoverPath) ? this._getRouteRectangles.bind(this) :
                function () {return []}

        let dims = pd.dimensionsAtCurrentZoom
        pd.rectsAtCurrentZoom = getRectangles(this.area, dims.wpx, dims.hpx, dims.ppx, dims.appx, this.pageOrientation)

        // pad rectangles with margin and scale to printing zoom
        for (let i = 0; i < pd.rectsAtCurrentZoom.length; i++) {
            let rotated = pd.rectsAtCurrentZoom[i].rotated; // property is destroyed after padding
            pd.rectsAtCurrentZoom[i] = pd.rectsAtCurrentZoom[i].pad(dims.ppx);
            let scaledRect = pd.rectsAtCurrentZoom[i].scale(1/pd.scaleToTargetZoom);
            pd.rectsAtCurrentZoom[i].rotated = rotated; // todo check, may be obsolete
            scaledRect.rotated = rotated;
            pd.rects.push(scaledRect);
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
     * calc rectangles for image generation
     * now supports only one rectangle
     * @param targetSizePx
     * @param paddingPx
     * @param extendToSquare
     * @returns {{dimensionsAtCurrentZoom: {hpx: number, aapx: number, wpx: number}, targetScale: number, targetZoom: number, rects: *[], rectsAtCurrentZoom: []}}
     */
    calcImages: function (targetSizePx, paddingPx, extendToSquare) {
        if (!this.area)
            return null;

        if (this.area instanceof L.Polyline && !this.area._map) {
            // if object is not added to the map (or removed)
            return null;
        }

        let bounds = this.area instanceof L.LatLngBounds ? this.area : this.area.getBounds()

        //todo create Rectangle object and perform some calculations using his methods
        let areaRect = new Rectangle(this.map.project(bounds.getNorthWest()), this.map.project(bounds.getSouthEast()))

        // scale from current zoom to target resolution
        let targetScale = targetSizePx / Math.max(areaRect.width, areaRect.height)
        let scaledPadding = paddingPx / targetScale

        // extend area with padding
        areaRect = areaRect.pad(scaledPadding)

        if (extendToSquare)
            areaRect = areaRect.extendToSquare()

        let rects = coverAreaWithRectangles(areaRect.topleft, areaRect.bottomright, areaRect.width, areaRect.height)

        if (rects.length !== 1) {
            // only one rect is now supported
            console.error("pdf:image:something got wrong with rectangle evaluation")
        }

        let cd = {
            wpx: areaRect.width,
            hpx: areaRect.height,
            aapx: paddingPx / targetScale // not impl
        }

        targetScale = targetSizePx / Math.max(cd.wpx, cd.hpx)
        let imagesData = {
            dimensionsAtCurrentZoom: cd,
            targetScale: targetScale,
            targetZoom: 0,
            rectsAtCurrentZoom: rects,
            rects: [],
        }

        Object.assign(imagesData, this._calcTargetZoomAndScale(targetScale))

        // rescale rects to target zoom
        for (let i = 0; i < imagesData.rectsAtCurrentZoom.length; i++) {
            imagesData.rects[i] = imagesData.rectsAtCurrentZoom[i].scale(1/imagesData.scaleToTargetZoom)
        }

        imagesData.dimensions = {
            wpx: Math.floor(cd.wpx / imagesData.scaleToTargetZoom),
            hpx: Math.floor(cd.hpx / imagesData.scaleToTargetZoom),
            // page margin
            //ppx: Math.floor(cd.ppx / imagesData.scaleToTargetZoom),
            // area padding in points at current map zoom level
            appx: Math.floor(cd.appx / imagesData.scaleToTargetZoom),
        }

        // todo most of this calc also are used in pdf rectangles calculations
        //      improvement: create 'RectField' class, where to move most of rectangles calculations
        return imagesData
    },

    /**
     * // calculates target map zoom level in order to scale image from current zoom level at targetScale
     * @param targetScale
     * @param round
     * @private
     */
    _calcTargetZoomAndScale: function (targetScale, round = Math.ceil) {
        // with multiply tile layers map.getMaxZoom() returns maximum zoom from all layers
        // but if the layer with maximum zoom level is filtered from output we will get
        // an incorrect image at this target zoom, so we need to define maxMapZoom manually
        let maxZoom = (this.maxZoom) ?
            ((typeof this.maxZoom === "function") ? this.maxZoom() : this.maxZoom) :
            this.map.getMaxZoom()

        let targetZoom = Math.min(
            maxZoom,
            round(this.map.getScaleZoom(targetScale, this.map.getZoom()))
        )
        let scaleToTargetZoom = this.map.getZoomScale(this.map.getZoom(), targetZoom)

        return {targetZoom: targetZoom, scaleToTargetZoom: scaleToTargetZoom}
    },

    /**
     * shows pages preview rectangles on the map
     * @returns {{hmmPaper, regionCenter: *, sWorld: (*|number), sPaper: number, pmmPaper: number, wmmPaper}}
     */
    showPdfPages: function (printData) {
        if (this.area === null || this.status !== StatusReady) {
            console.error("pdf: pdf creating is already in progress")
            return null
        }

        if (! printData)
            printData = this.calcPdfPages()

        if (printData) {
            this._showRectangles(printData.rectsAtCurrentZoom, printData.dimensionsAtCurrentZoom.ppx)
        } else {
            this.hideImageRegions()
        }
        return printData
    },

    showImageRegions: function (imageData) {
        if (this.area === null || this.status !== StatusReady) {
            console.error("pdf: is already in progress")
            return null
        }

        if (! imageData) {
            this.hideImageRegions()
            return
        }

        this._showRectangles(imageData.rectsAtCurrentZoom, imageData.dimensionsAtCurrentZoom.aapx)

        return imageData
    },
    /**
     * hides pages preview rectangles on the map
     */
    hideImageRegions: function () {
        this.rectGroup.clearLayers();
    },

    _lockMap: function() {
        this.savedMapState = {
            width: this.map.getContainer().style.width,
            height: this.map.getContainer().style.height,
            center: this.map.getCenter(),
            zoom: this.map.getZoom(),
            imageRectangles: !!(this.rectGroup._map),
            containerOverflow: this.map._container.parentElement.style.overflow
        }
        // todo add rectGroup css selector to node filter, and we can avoid removing the layer
        this.map.removeLayer(this.rectGroup);
        if (this.options.debug) {
            this.debugRectGroup.clearLayers()
        }
        if (this.options.showProgressSplashScreen) {
            Object.assign(this.progressDiv.style, {
                display: "flex",
                height: window.visualViewport.height+'.px',
                width: window.visualViewport.width+'.px',
                position: "fixed",
                top: 0,
                left: 0,
            });
            this.map._container.parentElement.style.overflow = "hidden" // hide scrollbars
        }
        this._disableInput();
        this.css.disabled = false
    },

    _restoreMap: function () {
        this.map.getContainer().style.width = this.savedMapState.width;
        this.map.getContainer().style.height = this.savedMapState.height;
        this.map.setView(this.savedMapState.center, this.savedMapState.zoom, {animate: false})
        if (this.savedMapState.imageRectangles) {
            this.map.addLayer(this.rectGroup)
        }
        this.map._container.parentElement.style.overflow = this.savedMapState.containerOverflow
        this.map.invalidateSize();
        this.progressDiv.style.display = "none"
        //this.map.addLayer(this.rectGroup);
        this._enableInput();
        this.css.disabled = true
        this.status = StatusReady;
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
     * starts a background pdf generation process, the map will be locked.
     * subscribe to pdf events in order to control the progress and catch the results
     * @returns {boolean} false if there are already running printing
     */
    createPdf: function () {
        if (this.status !== StatusReady) {
            return false
        }

        let pagesData = this.calcPdfPages()

        if (!pagesData)
            return false

        this.status = StatusAtWork
        this.fireStarted(pagesData)
        this._lockMap()
        document.addEventListener("pdf:imagesCompleted", this._createPdf.bind(this, pagesData), {once: true});

        this._createImages(pagesData.rects, pagesData.pagesToPrint, pagesData.targetZoom, this.imageFormat);
    },

    createImage: function (targetSizePx, paddingPx, extendToSquare, performScaleToTargetSize = false) {
        if (this.status !== StatusReady) {
            return false
        }

        let finish = function (blob) {
            this._restoreMap();
            this.fireFinish(blob)
        }.bind(this)

        let imagesData = this.calcImages(targetSizePx, paddingPx, extendToSquare)

        if (!imagesData)
            return false

        let rect = imagesData.rects[0]
        let resultWidth = targetSizePx
        let resultHeight = targetSizePx
        if (! extendToSquare) {
            if (rect.width >= rect.height) {
                resultHeight = Math.round(rect.height / (rect.width / targetSizePx))
            } else {
                resultWidth = Math.round(rect.width / (rect.height / targetSizePx))
            }
        }

        this.status = StatusAtWork
        this.fireStarted(imagesData)
        this._lockMap()

        document.addEventListener("pdf:imagesCompleted", function (data) {
            if (! data.detail || ! data.detail.images || data.detail.images.length === 0) {
                finish()
                return
            }
            if (! performScaleToTargetSize) {
                this._startDownload(data.detail.images[0], this.imageFormat === 'jpeg' ? 'jpg' : this.imageFormat)
                finish(data.detail.images[0])
            } else {
                // todo there are some possible improvement to reduce vector layers blur on rendered image resizing.
                //      we can render vector layers separately at target scale and than mix them with raster layers
                resizeImage(data.detail.images[0], resultWidth, resultHeight).then(function (imageUrl) {
                        this._startDownload(imageUrl, this.imageFormat === 'jpeg' ? 'jpg' : this.imageFormat)
                        finish(imageUrl)
                    }.bind(this)
                ).catch(function (er) {
                    console.error(er)
                    finish()
                })
            }
        }.bind(this), {once: true});

        this._createImages([rect], null, imagesData.targetZoom, performScaleToTargetSize ? 'blob' :this.imageFormat);

    },
    /**
     * aborts a running pdf or image generation
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
    _createPdf(pd, data) {

        let images = (data.detail) ? data.detail.images : []
        let blob = null
        let finish = function () {
            this._restoreMap();
            this.fireFinish(blob)
        }.bind(this)

        if (this.status === StatusAborted) {
            finish()
            return
        }

        if (!images || images.length !== pd.pagesToPrintCount) {
            console.log("pdf: images count is not equal rects count")
            finish()
        }

        // todo add more intelligent text labels processing to except text overlapping
        let addText = function (pdf, pageFormat, descriptor) {
            if (!pdf || !descriptor || !descriptor.text || descriptor.text === "" || !descriptor.position)
                return
            let w = pageFormat[0]
            let h = pageFormat[1]
            let p = descriptor.position
            let t = descriptor.text
            let tw = 0
            let th = 0
            let attr = {}
            if (p === "topleft") {
                tw = 0+5; th = 0+5; attr = {align: "left", baseline: "top"}
            } else if (p === "topright") {
                tw = w-5; th = 0+5; attr = {align: "right", baseline: "top"}
            } else if (p === "bottomleft") {
                tw = 0+5; th = h-5; attr = {align: "left", baseline: "bottom"}
            } else if (p === "bottomright") {
                tw = w-5; th = h-5; attr = {align: "right", baseline: "bottom"}
            } else {
                console.warn("pdf: unknown text position")
                return
            }
            pdf.text(t, tw, th, attr);
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
                let pageFormat = [w, h]
                if (pdf == null) {
                    pdf = new jspdf.jsPDF({format: pageFormat, orientation: orientation, compress: true});
                    pdf.setFontSize(this.options.pdfFontSize);
                    if (this.options.pdfDocumentProperties !== null && Object.keys(this.options.pdfDocumentProperties).length > 0) {
                        pdf.setDocumentProperties(this.options.pdfDocumentProperties)
                    }
                }  else {
                    pdf.addPage([w, h], orientation);
                }
                pdf.addImage(images[i], this.imageFormat, 0, 0, w, h, undefined, "FAST");
                addText(pdf, pageFormat, this.options.pdfSheetAttribution)
                addText(pdf, pageFormat, Object.assign({text: `Page ${pd.pagesToPrint[i]+1} of ${pd.pageCount}`}, this.options.pdfSheetPageNumber))

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

        blob = pdf.output("blob", {filename: this._fixFileExt(this.options.outputFileName, 'pdf')});
        this._startDownload(blob, 'pdf')
        finish()
    },

    /**
     * creates series of images in background
     * subscribe to document event "pdf:imagesCompleted" to catch when it is finished
     * @private
     * @param rects {[Rectangle]} describes areas to imaging
     * @param indexes {[numbers]} list of indexes in rects array
     * @param targetZoom {number} defines map zoom level the Rectangle coordinates belong to
     * @param imageFormat {string}
     */
    _createImages: function(rects, indexes, targetZoom, imageFormat) {

        let images = []

        if (!indexes) {
            indexes = []
            for (let i = 0; i < rects.length; i++) {
                indexes.push(i)
            }
        }
        let finish = function () {
            document.removeEventListener("pdf:documentTilesLoaded", generateImage)
            document.removeEventListener("pdf:startNextImage", prepareDocumentForImaging)
            document.dispatchEvent(new CustomEvent("pdf:imagesCompleted", {detail: {images: images}}));
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
            return new Promise( (resolve, reject) => {
                reject("image generator isn't implemented")
            })
        }

        /**
         * it's better to use html-to-image or alternate package, but
         * html-to-image package has a bug with resulting image (one tile is displayed on the map)
         * need to investigate
         */
        if (imageFormat === "jpeg") {
            imageGenerator = domtoimage.toJpeg
        } else if (imageFormat === "png") {
            imageGenerator = domtoimage.toPng
        } else if (imageFormat === "blob") {
            imageGenerator = domtoimage.toBlob
        }

        let generateImage = function (ev) {
            let i = ev.detail.i
            let r = rects[indexes[i]]
            // we do scale to improve image quality of vector data rendering on retina screens
            let scale = this.pixelRatio
            let options = {
                width: Math.round(r.width) * scale,
                height: Math.round(r.height) * scale,
                style: {
                    transform: 'scale(' + scale + ')',
                    transformOrigin: 'top left'
                },
                filter: filter
            }

            imageGenerator(this.map.getContainer(), options)
                .then(function (data) {
                    if (this.status === StatusAborted) {
                        finish()
                        return;
                    }
                    // if scale > 1 fix images DPI value to correct display on retina screens
                    if (scale > 1 && data instanceof Blob) {
                        changeDpiBlob(data, this.baseImageDpi * this.pixelRatio).then(function (data) {
                            images.push(data)
                            document.dispatchEvent(new CustomEvent("pdf:startNextImage", {detail: {i:i+1}}))
                        })
                    } else if (scale > 1) {
                        data = changeDpiDataUrl(data, this.baseImageDpi * this.pixelRatio);
                    }
                    images.push(data)
                    document.dispatchEvent(new CustomEvent("pdf:startNextImage", {detail: {i:i+1}}))
                }.bind(this))
                .catch(function (er) {
                    console.error("_createImages:domtoimage: got error", er)
                    this.fireAborted("internal error")
                    this.status = StatusAborted
                    finish()
                }.bind(this));
        }.bind(this)

        let prepareDocumentForImaging = function(ev) {
            try {
                let i = ev.detail.i
                let p = indexes[i];

                if (i === indexes.length || this.status === StatusAborted) {
                    finish()
                    return;
                }

                let timestamp = new Date().getTime()
                let r = rects[p];
                this.fireProgress(OpGenerateImage, i, indexes.length, r)
                let w = r.width;
                let h = r.height;
                let viewCenter = r.middle;

                // when map is still not zoomed to target zoom (at the first image)
                if (this.map.getZoom() !== targetZoom) {
                    let scaleToTargetZoom = this.map.getZoomScale(this.map.getZoom(), targetZoom)
                    let scaledRect = r.scale(scaleToTargetZoom);
                    viewCenter = scaledRect.middle
                }
                viewCenter = this.map.unproject(viewCenter)

                this.map.getContainer().style.width = `${Math.ceil(w)}px`;
                this.map.getContainer().style.height = `${Math.ceil(h)}px`;
//                this.map.getContainer().style.width = `${w}px`;
//                this.map.getContainer().style.height = `${h}px`;
                this.map.invalidateSize();
                this.map.setView(viewCenter, targetZoom, {animate: false});

                // todo here we can fix some styles in order to vector layers, markers and tooltips
                //      looks better (not so small at high DPI resolution)

                //need to wait the all tiles is loaded
                let timer = setInterval(function () {
                    if (this.status === StatusAborted) {
                        clearInterval(timer);
                        finish()
                        return;
                    }
                    let [totalTiles, loadedTiles, loadingLayer] = this._loadedTiles(this.map)
                    if (this.options.debug) {
                        console.log(`tiles loaded: ${loadedTiles} from ${totalTiles}`)
                    }
                    this.fireProgress(OpLoadTiles, loadedTiles, totalTiles, null)
                    if (totalTiles === loadedTiles) {
                        clearInterval(timer);
                        document.dispatchEvent(new CustomEvent("pdf:documentTilesLoaded", {detail: {i:i}}))
                        return
                    }
                    if (new Date().getTime() - timestamp > this.options.tilesLoadingTimeout) {
                        if (this.options.debug) {
                            console.log(`Aborted due to tiles loading timeout of the layer: ${loadingLayer._url}`)
                        }
                        this.status = StatusAborted
                        this.fireAborted("timeout", loadingLayer)
                        clearInterval(timer);
                        finish()
                    }
                }.bind(this), 200);
            } catch (e) {
                console.error("prepareDocumentForImaging: got error", e)
                this.fireAborted("internal error")
                finish()
            }
        }.bind(this);

        document.addEventListener("pdf:documentTilesLoaded", generateImage);
        document.addEventListener("pdf:startNextImage", prepareDocumentForImaging);
        document.dispatchEvent(new CustomEvent("pdf:startNextImage", {detail: {i:0}}))
    },

    /**
     * checks if all tiles is loaded
     * @param map
     * @returns {number[]}
     * @private
     */
    _loadedTiles: function(map){
        let totalTiles = 0
        let loadedTiles = 0
        let stillLoadingLayer = null
        for (let l in map._layers) {
            let layer = map._layers[l];
            if (layer._url || layer._mutant) {
                totalTiles += layer._level.el.childNodes.length
                loadedTiles += layer._level.el.querySelectorAll("img.leaflet-tile-loaded").length
                if (layer._loading && stillLoadingLayer === null) {
                    stillLoadingLayer = layer
                }
            }
        }
        if (!stillLoadingLayer) {
            loadedTiles = totalTiles
        }
        return [totalTiles, loadedTiles, stillLoadingLayer];
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

    fireAborted: function (reason, data) {
        this.fireEvent("aborted", {reason: reason, data: data})
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

    _showRectangles: function (rects, p) {
        this.rectGroup.clearLayers();
        for (let i = 0; i < rects.length; i++) {
            let bigRect = rects[i];
            let smallRect = bigRect.pad(-p);

            smallRect = [this.map.unproject(smallRect.min), this.map.unproject(smallRect.max)];
            bigRect = [this.map.unproject(bigRect.min), this.map.unproject(bigRect.max)];

            L.rectangle(bigRect,
                Object.assign({}, this.rectPreviewStyle)).addTo(this.rectGroup);

            L.rectangle(smallRect,
                Object.assign({}, this.rectPreviewStyle, {fill: false})).addTo(this.rectGroup);
        }
        if (this.rectGroup._map == null) {
            this.rectGroup.addTo(this.map);
        }
    },

    _getBoxRectangles: function (LObject, w, h, p, areaPadding, o) {
        if (LObject === null)
            return []

        let bounds = null

        if ( LObject instanceof L.LatLngBounds)
            bounds = LObject

        if ( typeof LObject.getBounds == "function" )
            bounds = LObject.getBounds()

        if (!bounds)
            return []

        let topLeft = this.map.project(bounds.getNorthWest()).subtract([areaPadding,areaPadding])
        let bottomRight = this.map.project(bounds.getSouthEast()).add([areaPadding,areaPadding])

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

    _fixFileExt(filename, ext) {
        let exts = ['jpg', 'png', 'pdf']
        let i
        let e
        for (e of exts) {
            let suffix = '.' + e
            i = filename.lastIndexOf(suffix)
            if (i !== -1) {
                if (i === filename.length - suffix.length) {
                    break
                } else {
                    i = -1
                }
            }
        }
        //fix extension
        if (i !== -1) {
            if (e === ext) {
                return filename
            } else {
                return filename.substring(0, i) + '.' + ext
            }
        }
        return filename + '.' + ext
    },

    _startDownload(data, ext) {
        if (! this.options.downloadOnFinish || ! data)
            return

        // fix extensions if needed
        let fileName = this._fixFileExt(this.options.outputFileName, ext)

        Object.assign(this.downloadLink, {"download": fileName});
        this.downloadLink.href = (data instanceof Blob) ? URL.createObjectURL(data) : data
        this.downloadLink.click(); // download
    },

    isScalePaging() {
        return this.options.pagingMethod === "scale"
    },

    isPagesPaging() {
        return this.options.pagingMethod === "pages"
    },

    /**
     * set the maximum zoom level of the map we can fall down for image tiles loading
     * if null it will be evaluated from map.getMaxZoom()
     * can be number, or function, that should return the number
     * @param v
     */
    setMaxZoom: function (v) {
        this.maxZoom = v
    },

    setArea: function (area) {
        if (typeof area === 'object') {
            if (! (area instanceof L.LatLngBounds) && typeof area.getBounds !== 'function') {
                throw new Error("the area should be instance of LatLngBounds class, or must have getBounds method")
            }
        }
        this.area = area
        if (!area) {
            this.hideImageRegions()
        }
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
        if (pages * 1 === 0)
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

    getPageMargin: function () {
        return this.pageMargin
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

    setRectPreviewStyle: function (style) {
        if (!style) {
            style = this.options.rectanglePreviewStyle
        }
        this.rectPreviewStyle = Object.assign({}, style)
    },
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