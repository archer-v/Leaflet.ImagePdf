# Leaflet.ImagePdf

Leaflet plugin that creates an jpeg/png image or pdf document of selected map region directly from a browser. 
The image also includes all rendered vector layers, markers, tooltips, images, svg drawing, etc. Size, quality (dpi) and format can be defined in plugin options. 

## Demonstration

See online demo [archer-v.github.io/Leaflet.ImagePdf](https://archer-v.github.io/Leaflet.ImagePdf/) 

or clone and run demo locally:

```console
git clone https://github.com/archer-v/Leaflet.ImagePdf.git
cd Leaflet.ImagePdf
./examples/demo.sh
```

## General information

Pdf features: 
- predefined page sizes (A0-A10, B0-B10, etc) and custom page sizes defined in mm
- landscape and portrait page orientations
- multipaging with automatic page positioning with optimal covering 
- customizable scaling
- cutomizable page padding
- any additional text can be added for every page, including a page number, a total pages, an annotation and some text description

Image features:
- customizable width and height in px
- automatic or custom image scaling
- jpeg / png format is supported

General features:
- the area can be defined as LatLngBounds object, or any leaflet polygon or polyline object
- any layer (raster and vector) can be included or excluded from the result image
- a splash screen and progress bar during image generation
- an events model that allow you to control the process including start and finish and also a progress of tile images loading and image / pdf pages generation

Unlike of plugins that rely on browser printing, this plugin generates pdf using jspfd module for pdf generation and dom-to-image module for images. That gives more control and flexibility on content positioning and image quality and makes it different from other plugins which have issues with drawing some layers or scaling limitations.

Since the image generation is performed on a client side, the execution time is depend on client's cpu and memory and also on network bandwith for tile images loading. At this time only Google Chrome and Firefox browsers was tested and supported and there is some issues with safary. Mobile browsers usually have limited resourses in comparison with desktop browsers, especially for creating of high resolution images, so it's better to use desktop browsers for image generation.

You can define "printing" area with LatLngBounds object or any Leaflet geometry object (Polyline, Polygon). 
The plugin covers this area with one, or multiple pages depends on configuration (dpi, page size, etc)

Thanks [Herman Sletmoen](https://github.com/hersle) and his [leaflet-route-print](https://hersle.github.io/leaflet-route-print/) plugin.
It helped me with basic concept and some idea with page calculations and positioning.

This plugin is implemented as UI-less component.
It gives you more flexibility in integration to your application.
You can implement your own UI control or took it from an example (see examples folder), 
that was borrowed from [leaflet-route-print](https://hersle.github.io/leaflet-route-print/) with some refactoring. 
 
The plugin is under development now and api specification is unstable

## Usage

Initalize and configure plugin
```javascript
let imagePdf = L.imagePdf(map, {
//  	.... some options ...
})
```

Describe the area, using L.LatLngBounds or L.polygon or L.polyline objects
```javascript
imagePdf.setArea(L.LatLngBounds([]))
```

### Creating pdf document

Tune some pdf options like page count, margins, paper size, etc
```javascript
imagePdf.setPageCount(2)   // 2 pages
imagePdf.setPageMargin(10) // mm
```

Show pages preview on the map if needed
```javascript
imagePdf.showPdfPages()
```

Create pdf document
```javascript
imagePdf.createPdf()
```

### Creating jpeg/png image

Tune some image options like image format, etc
```javascript
imagePdf.setImageFormat('jpeg')
```

Show the image area on the map if needed
```javascript
let imageSizeInPixels = 1000;
let areaPaddingInPixels = 10;
let extendToSquareBooleanOption = false;
imagePdf.showImageRegions( imagePdf.calcImages(imageSizeInPixels, areaPaddingInPixels, extendToSquareBooleanOption) )
```

```javascript
imagePdf.createImage(imageSizeInPixels, areaPaddingInPixels, extendToSquareBooleanOption)
```

### Susbscribe to events

```javascript
this.map.once("imagePdf:start", function (data) {
  console.log("started")
})

this.map.once("imagePdf:finish", function (data) {
  console.log("finished")
})

this.map.once("imagePdf:progress", function (data) {
  if (p.operation === "page") {
			console.log(`Creating page ${p.itemNo+1} of ${p.totalItems} ...`);
		}
  if (p.operation === "tile") {
   console.log(`Loaded ${p.itemNo+1} tiles from ${p.totalItems}`);
		}
  if (p.operation === "image") {
   console.log(`Creating image ${p.itemNo+1} of ${p.totalItems} ...`);
  }
})
```

### Plugin options

You can pass a number of options:

```javascript
{
        pageFormat: "A4",
        pageOrientation: PageOrientationPortrait,
        pageMargin: 10,         // pdf option, page margin in mm
        areaPadding: 10,        // pdf option, add padding to the area in mm
        pagingMethod: 'pages',  // pdf option, define paging method for multi-page pdf generation
                                // (possible values 'pages' | 'scale'), it's better to use 'pages' because 'scale' method now is not properly tested
        scale: 50000,           // pdf option, default starting scale for 'scale' paging method
        pageCount: 1,           // pdf option, default pages count for 'pages' paging method
        dpi: 300,               // pdf option, define max target images dpi, it defines how deep the map will be zoomed to create images
                                // the resulting image dpi depends on available tiles images resolution and page size in mm
                                // the better available dpi will be used
                                // higher dpi value leads to downloading more tiles and greatly increase images generation time
        maxZoom: null,          // define map maximum zoom level we can fall to load image tiles
                                // if null it will be evaluated from map.getMaxZoom()
                                // can be number, or function, that should return the number
        outputFileName: "map.pdf", // can be with or without file extension
        downloadOnFinish: false, // starts browser's file download process in order to save pdf file
        tilesLoadingTimeout: 10000, // msec, timeout for tile loading on every page(image) generation
        imageFormat: "jpeg",    // pdf and image option, 'jpeg' or 'png'
        imagePixelRatio: 1,     // for generate images for retina screens. set to 2 or window.devicePixelRatio
        showProgressSplashScreen: true,
        progressSplashScreenStyle: progressSplashScreenDefaultStyle,
        rectanglePreviewStyle: { // defines the style of area preview rectangle
            stroke: true,
            weight: 1,
            opacity: 1,
            color: "gray",
            fillColor: "gray",
            fillOpacity: 0.2
        },
        pdfFontSize: 15,            // default font size of text labels in pdf document
        pdfPrintGraticule: true,    // isn;t implemented yet
        pdfPrintScaleMeter: true,   // isn;t implemented yet
        pdfSheetPageNumber: {       // add page number to a sheet at defined position
            position: "bottomright",
        },
        pdfSheetAttribution: {      // add attribution text to a sheet at defined position
            position: "topleft",
            text: "Created with Leaflet.ImagePdf"
        },
        pdfDocumentProperties: {    // properties to add to the PDF document // name-to-value object structure
            'creator': "Leaflet.ImagePdf"
        },
        excludeNodesWithCSS: ['div.leaflet-control-container', 'div.leaflet-control', 'div.pdf-progress-plug'], // exclude these dom nodes from the result images
        pdfPageCb: null,        // callback function(pdf, pageNumber) that calls on every pdf page generation
                                // you can use it to add you custom text or data to pdf pages (see jspdf spec on how to operate with pdf document)
        nodeFilterCb: null,     // callback function(domNode) that calls on every dom element and should return true or false
                                // in order to include or exclude element from images and pdf
        debug: false,
    }
```
